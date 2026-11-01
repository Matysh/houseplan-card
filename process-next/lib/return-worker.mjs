import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { checkedRef } from './github.mjs';

const exec = promisify(execFile);
const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');
const labels = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
const exists = async path => { try { return await stat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };

/** Called inside S6, after its final synchronization. No lifecycle hooks or old gates. */
export async function prepareReturnEnvironment({ worktree, onProgress = () => {}, signal, execute = exec } = {}) {
  const [manifest, lock] = await Promise.all(['package.json', 'package-lock.json'].map(name => readFile(join(worktree, name))));
  const fingerprint = createHash('sha256').update(manifest).update(lock).update(process.version).update(process.platform).digest('hex');
  const stamp = join(worktree, 'node_modules', '.process-next-dependencies');
  let previous; try { previous = (await readFile(stamp, 'utf8')).trim(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous === fingerprint) return { status: 'reused' };
  onProgress({ phase: 'return-environment', status: 'running', name: 'Подготовка зависимостей возврата релиза (S6)' });
  await execute(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--ignore-scripts'], {
    cwd: worktree, signal, timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024,
    windowsHide: true, shell: process.platform === 'win32',
  });
  await writeFile(stamp, fingerprint + '\n');
  onProgress({ phase: 'return-environment', status: 'completed', name: 'Зависимости возврата релиза готовы' });
  return { status: 'prepared' };
}

async function findServiceIssue(api, marker) {
  const matches = [];
  for (let page = 1; ; page++) {
    const rows = await api.request('GET', `${api.root}/issues?state=all&labels=infra&per_page=100&page=${page}`);
    if (!Array.isArray(rows)) throw Error('Service issue inventory is unavailable');
    matches.push(...rows.filter(issue => !issue.pull_request && String(issue.body ?? '').includes(marker)));
    if (matches.length > 1) throw Error('Several service issues claim this release return');
    if (rows.length < 100) return matches[0] ?? null;
  }
}

async function localWorktree(git, branch, path, materialSha) {
  const rows = (await git.git(['worktree', 'list', '--porcelain'])).replace(/\r/g, '').split('\n\n').filter(Boolean)
    .map(block => Object.fromEntries(block.split('\n').map(line => { const at = line.indexOf(' '); return at < 0 ? [line, true] : [line.slice(0, at), line.slice(at + 1)]; })));
  const existing = rows.find(row => row.branch === `refs/heads/${branch}`);
  if (existing) {
    if (!await exists(existing.worktree)) throw Error('Return branch has a missing worktree; repair its Git registration without resetting the branch');
    return resolve(existing.worktree);
  }
  const occupant = rows.find(row => row.worktree && resolve(row.worktree) === resolve(path));
  if (occupant || await exists(path)) throw Error('Return worktree path is already occupied; preserve it for inspection');
  let local;
  try { local = await git.git(['rev-parse', '--verify', `refs/heads/${branch}`]); }
  catch (error) { if (![1, 128].includes(error.code)) throw error; }
  if (local) await git.git(['worktree', 'add', path, branch]);
  else await git.git(['worktree', 'add', '-b', branch, path, materialSha]);
  return path;
}

async function closeServiceIssue({ api, issue, candidate, devSha }) {
  const current = await api.getIssue(issue);
  await api.upsertComment(issue, { marker: `<!-- process-next-release-return-complete:${candidate.tag} -->`,
    body: `Опубликованный \`${candidate.tag}\` вошёл в dev (${devSha}). Служебный возврат завершён; исходные продуктовые задачи учтены в выпуске.` });
  for (const name of labels(current).filter(name => /^S[1-8]-/.test(name) || name === 'to_release')) await api.removeLabel(issue, name);
  if (current.state !== 'closed') await api.updateIssue(issue, { state: 'closed', state_reason: 'completed' });
}

/** Completes one existing queue task; publication itself never gets replayed here. */
export async function returnPublishedHistory({ candidate, previous = {}, api, git, queue, config = {}, finish,
  onUpdate, onProgress = () => {}, signal, prepareEnvironment = prepareReturnEnvironment } = {}) {
  if (candidate?.status !== 'published' || !sha(candidate.sha) || !candidate.tag || !candidate.id) throw Error('Published release identity required');
  checkedRef(candidate.tag);
  if (!onUpdate || !finish) throw Error('Return requires the existing release state and task finish route');
  let issue = previous?.issue ?? config.returnIssue ?? config.release?.returnIssue;
  if (issue !== undefined && (!Number.isSafeInteger(issue) || issue < 1)) throw Error('Return issue must be a positive number');
  let branch = previous?.branch, worktree;
  const marker = `<!-- process-next-release-return:${candidate.tag} -->`, invocation = randomUUID();
  const progress = () => ({ ...(issue ? { issue } : {}), ...(branch ? { branch } : {}), ...(worktree ? { worktree } : {}) });
  const save = async () => onUpdate({ type: 'completion-step', candidate: candidate.id, name: 'return-to-dev',
    result: { status: 'running', ...progress() } });
  try {
    let included;
    try { included = await git.verifyDevReturn(candidate.sha); }
    catch (error) { if (error.code !== 1) throw error; }
    if (included) {
      if (!issue) issue = (await findServiceIssue(api, marker))?.number;
      if (issue) await closeServiceIssue({ api, issue, candidate, devSha: included.devSha });
      return { status: 'completed', alreadyIncluded: true, devSha: included.devSha, ...progress() };
    }
    let current = issue ? await api.getIssue(issue) : await findServiceIssue(api, marker);
    if (!current) {
      try {
        current = await api.createIssue({ title: `Вернуть ${candidate.tag} в dev`,
          body: `${marker}\n\nСлужебный возврат опубликованного релиза ${candidate.tag} (${candidate.sha}) через общую очередь.\n\nСохранить опубликованную историю; короткие проверки S6, зачёт принятого ревью при чистом автоматическом merge.`,
          labels: ['infra', 'track:show', 'S6-in-progress'] });
      } catch (error) {
        // A POST can succeed while its response is lost. Search before any later creation.
        current = await findServiceIssue(api, marker);
        if (!current) throw error;
      }
    }
    if (!Number.isSafeInteger(current.number) || current.number < 1) throw Error('Service issue creation has no confirmed identity');
    issue = current.number;
    branch ??= `issue/${issue}-release-return-${candidate.sha.slice(0, 12)}`;
    checkedRef(branch);
    worktree = resolve(config.workspace ?? git.cwd ?? '.', 'artifacts/process-next/return-worktrees', candidate.sha.slice(0, 12));
    await save();
    if (current.state === 'closed' || labels(current).includes('blocked')) throw Error('The owner stopped the service issue; preserve its state');
    let tracks = labels(current).filter(name => /^track:(ship|show|ask)$/.test(name));
    if (!tracks.length) {
      await api.request('POST', `${api.root}/issues/${issue}/labels`, { labels: ['track:show'] });
      current = await api.getIssue(issue); tracks = labels(current).filter(name => /^track:(ship|show|ask)$/.test(name));
    }
    if (tracks.length !== 1) throw Error('Resolve conflicting track labels on the return issue');
    const snapshot = (await queue.store.read()).state, queued = snapshot.tasks[issue];
    if (queued && (queued.releaseTag !== candidate.tag || queued.mergeSourceSha && queued.mergeSourceSha !== candidate.sha))
      throw Error('Service issue is already attached to different queued work');
    if (queued && !queued.queued && snapshot.active?.issue !== issue
      && ['review-findings', 'checks-failed', 'rebase-conflict', 'review-retry-exhausted'].includes(queued.reason))
      throw Error(`Return requires an executor correction: ${queued.reason}`);
    const prepared = await git.prepareDevReturn({ candidate, issue, branch, worktree });
    if (prepared.alreadyIncluded) {
      const verified = await git.verifyDevReturn(candidate.sha);
      await closeServiceIssue({ api, issue, candidate, devSha: verified.devSha });
      return { status: 'completed', devSha: verified.devSha, ...progress() };
    }
    if (!prepared.task || !sha(prepared.task.materialSha)) throw Error('Return branch is not prepared');
    worktree = await localWorktree(git, branch, worktree, prepared.task.materialSha);
    await save();
    const task = { ...prepared.task, track: tracks[0].slice(6) };
    if (!queued?.queued && snapshot.active?.issue !== issue && queued?.status !== 'S8-merged') {
      await api.moveStatus(issue, 'S6-in-progress', current.labels);
      await queue.dispatch({ id: `release-return:${invocation}`, type: 'enqueue', task });
    }
    onProgress({ phase: 'return-to-dev', status: 'running', issue, tag: candidate.tag, name: `Возврат ${candidate.tag} в dev: задача #${issue}` });
    const result = await finish({ config: { ...config, workspace: worktree }, worktree, task,
      event: { id: `release-return-finish:${invocation}`, issue, branch, s6: config.release?.returnS6 ?? 'local' }, signal, onProgress,
      prepareEnvironment: options => prepareEnvironment({ worktree, signal, onProgress, ...options }) });
    if (result?.action !== 'merged') return { status: 'pending', ...progress(), reason: result?.reason ?? `Return task is ${result?.action ?? 'unfinished'}` };
    const verified = await git.verifyDevReturn(candidate.sha);
    await closeServiceIssue({ api, issue, candidate, devSha: verified.devSha });
    return { status: 'completed', devSha: verified.devSha, ...progress() };
  } catch (error) { return { status: 'pending', ...progress(), reason: String(error.message).slice(0, 1200) }; }
}
