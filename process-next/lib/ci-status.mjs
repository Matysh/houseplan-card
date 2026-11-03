import { PUBLIC_PRODUCT_INPUTS } from './catalog.mjs';
import { matchesInputs } from './storage.mjs';
import { checkedRef, sha256 } from './github.mjs';

const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const successful = value => ['passed', 'reused', 'not-required'].includes(value);
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const text = value => String(value ?? '').replace(/[\r\n|<>]/g, ' ');
const serialized = value => JSON.stringify(value, null, 2) + '\n';

async function productSnapshot(git, commit) {
  if (!sha(commit)) throw Error('Exact product commit required');
  await git.ensureCommit(commit);
  const entries = new Map();
  for (const row of (await git.git(['ls-tree', '-r', '-z', '--full-tree', commit])).split('\0').filter(Boolean)) {
    const match = row.match(/^(\d+) (blob|commit) ([a-f0-9]{40})\t([\s\S]+)$/);
    if (!match) throw Error('Invalid product tree');
    const [, mode, type, oid, path] = match;
    if (path !== 'package.json' && matchesInputs(path, PUBLIC_PRODUCT_INPUTS)) entries.set(path, { mode, type, oid });
  }
  const packageJson = JSON.parse(await git.git(['show', `${commit}:package.json`])), selected = {};
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides', 'version', 'type', 'engines', 'packageManager'])
    if (Object.hasOwn(packageJson, key)) selected[key] = packageJson[key];
  // npm runs pre/post hooks with build; unrelated retired test commands are not product changes.
  selected.scripts = Object.fromEntries(['prebuild', 'build', 'postbuild'].filter(key => Object.hasOwn(packageJson.scripts ?? {}, key))
    .map(key => [key, packageJson.scripts[key]]));
  entries.set('package.json', { mode: '100644', type: 'normalized-package', oid: sha256(JSON.stringify(canonical(selected))) });
  return entries;
}
const snapshotHash = entries => sha256(JSON.stringify([...entries].sort(([a], [b]) => a.localeCompare(b))));
export async function productIdentity(git, commit) { return snapshotHash(await productSnapshot(git, commit)); }

function nativeProof(published) {
  const r = published?.runner;
  if (!r || r.ready !== true || r.status !== 'passed' || r.materialClean !== true || r.sha !== published.sha
    || !['stable', 'hotfix'].includes(r.event) || typeof r.id !== 'string' || !r.id
    || !/^[a-f0-9]{64}$/.test(r.digest ?? '') || !Number.isFinite(Date.parse(r.finishedAt))
    || !Number.isSafeInteger(r.required) || r.required < 1 || !Array.isArray(r.failed) || r.failed.length
    || !Number.isSafeInteger(r.reused) || r.reused < 0 || r.reused > r.required
    || Array.isArray(r.checks) && r.checks.some(check => !check.diagnostic && !successful(check.status))) return null;
  return { profile: r.event, finishedAt: r.finishedAt, required: r.required, reused: r.reused, id: r.id, digest: r.digest,
    checks: r.checks, source: 'Сохранённый результат локального/резервного тест-сета выпуска.' };
}

async function legacyProof(api, published, evidence) {
  if (evidence?.schema !== 1 || evidence.sha !== published.sha || evidence.tag !== published.tag
    || !['stable', 'hotfix'].includes(evidence.profile) || !sha(evidence.runHeadSha)
    || !Number.isSafeInteger(evidence.runId) || evidence.runId < 1 || !Number.isSafeInteger(evidence.runAttempt)
    || evidence.runAttempt < 1 || !Array.isArray(evidence.jobs) || !evidence.jobs.length) return null;
  const run = await api.request('GET', `${api.root}/actions/runs/${evidence.runId}`);
  if (run.id !== evidence.runId || run.status !== 'completed' || run.conclusion !== 'success'
    || run.head_sha !== evidence.runHeadSha || run.head_sha !== published.sha || run.run_attempt !== evidence.runAttempt) return null;
  const jobs = await Promise.all(evidence.jobs.map(async expected => {
    if (!Number.isSafeInteger(expected.id) || expected.id < 1 || !expected.name
      || !Array.isArray(expected.steps) || !expected.steps.length) return null;
    const job = await api.request('GET', `${api.root}/actions/jobs/${expected.id}`);
    if (job.run_id !== run.id || job.name !== expected.name || job.status !== 'completed' || job.conclusion !== 'success'
      || expected.steps.some(name => !job.steps?.some(step => step.name === name && step.status === 'completed' && step.conclusion === 'success'))) return null;
    return { name: expected.name, steps: expected.steps };
  }));
  if (jobs.some(job => !job)) return null;
  return { profile: evidence.profile, finishedAt: run.updated_at ?? evidence.finishedAt, jobs,
    url: `https://github.com/${api.owner}/${api.repo}/actions/runs/${run.id}`, source: 'Исторический запуск: результат run, обязательных jobs и шагов повторно прочитан из GitHub.' };
}

async function comparisonIdentity(git, tested, evidence) {
  const before = await productSnapshot(git, tested);
  if (!evidence?.equivalentProductSha) return { hash: snapshotHash(before) };
  const after = await productSnapshot(git, evidence.equivalentProductSha), allowed = evidence.equivalence?.allowedChanges;
  if (!Array.isArray(allowed) || !allowed.length || new Set(allowed.map(row => row.path)).size !== allowed.length)
    throw Error('Invalid historical equivalence');
  const changed = [...new Set([...before.keys(), ...after.keys()])].filter(path => JSON.stringify(before.get(path)) !== JSON.stringify(after.get(path)));
  if (changed.length !== allowed.length || changed.some(path => {
    const a = before.get(path), b = after.get(path), expected = allowed.find(row => row.path === path);
    return !expected || (a?.oid ?? null) !== expected.before || (b?.oid ?? null) !== expected.after
      || a && b && (a.mode !== b.mode || a.type !== b.type);
  })) throw Error('Historical equivalence does not match the exact reviewed changes');
  return { hash: snapshotHash(after), bridge: evidence.equivalentProductSha, explanation: evidence.equivalence.explanation };
}

/** Publish a historical fact about unchanged product bytes; do not run tests or reinterpret their coverage. */
export async function buildCiStatus({ api, git, published, legacyEvidence } = {}) {
  const repository = `https://github.com/${api.owner}/${api.repo}`;
  let mainSha = null, proof = null, comparison = null, reason = 'Нет подходящего сохранённого результата stable/hotfix.';
  try {
    mainSha = (await api.getRef('main')).object.sha;
    if (!sha(mainSha)) throw Error('Invalid main');
    if (sha(published?.sha) && typeof published.tag === 'string' && /^v\d+\.\d+\.\d+$/.test(published.tag)) {
      proof = nativeProof(published);
      const legacy = !proof && await legacyProof(api, published, legacyEvidence);
      proof ||= legacy;
      if (proof) {
        comparison = await comparisonIdentity(git, published.sha, legacy ? legacyEvidence : null);
        reason = comparison.hash === await productIdentity(git, mainSha) ? null
          : 'Продукт или входы его сборки в main отличаются от подтверждённого выпуска.';
      }
    }
  } catch { reason = 'Не удалось подтвердить применимость сохранённого результата к main.'; }
  const badge = { schemaVersion: 1, label: 'CI', message: reason ? 'not tested' : 'passing', color: reason ? 'lightgrey' : 'brightgreen' };
  const lines = ['# CI: проверенный продукт в main', '', reason ? `**Не подтверждено.** ${reason}` : '**Passing:** продукт в main соответствует подтверждённому выпуску.', '',
    mainSha && sha(mainSha) ? `Main: [\`${mainSha}\`](${repository}/commit/${mainSha}).` : 'Текущий SHA main недоступен.',
    'Статус использует уже завершённые проверки выпуска. Новых тестов, сборок или гейтов этот отчёт не запускает.'];
  if (proof) {
    lines.push('', `Проверенный коммит: [\`${published.sha}\`](${repository}/commit/${published.sha}).`,
      `Выпуск: [${text(published.tag)}](${repository}/releases/tag/${encodeURIComponent(published.tag)}). Профиль: **${proof.profile}**.`,
      `Завершение исходного результата: ${text(proof.finishedAt)}. ${proof.source}`);
    if (proof.url) lines.push(`Источник: [GitHub Actions](${proof.url}).`);
    if (proof.id) lines.push(`ID исходного тест-сета: \`${text(proof.id)}\`. SHA256 отчёта: \`${proof.digest}\`.`);
    if (proof.required) lines.push(`Обязательных шагов: ${proof.required}; зачтено прежних успешных результатов: ${proof.reused}.`);
    if (comparison?.bridge) lines.push(`Сопоставление после исторического переноса обвязки: [\`${comparison.bridge}\`](${repository}/commit/${comparison.bridge}). `
      + `${text(comparison.explanation)} Это не отдельный тестовый прогон этого коммита.`);
    if (proof.jobs || proof.checks?.length) {
      lines.push('', '<details>', '<summary>Состав исходных проверок</summary>', '');
      for (const job of proof.jobs ?? []) lines.push(`- ${text(job.name)}: ${job.steps.map(text).join('; ')} — success.`);
      for (const check of proof.checks ?? []) {
        const counts = ['tests', 'passed', 'failed', 'skipped', 'cancelled', 'todo']
          .filter(key => Number.isSafeInteger(check.counts?.[key]) && check.counts[key] >= 0).map(key => `${key}: ${check.counts[key]}`);
        const source = /^[A-Za-z0-9_.:-]{1,200}$/.test(check.sourceRun ?? '') ? `; исходный набор ${check.sourceRun}` : '';
        lines.push(`- ${text(check.name ?? check.id)}: ${text(check.status)}${check.diagnostic ? ' (диагностика)' : ''}${counts.length ? '; ' + counts.join(', ') : ''}${source}.`);
      }
      lines.push('', '</details>');
    }
  }
  lines.push('', 'Изменения документации, тестов и процесса сами по себе не отменяют уже полученный результат для прежнего продукта. '
    + 'Passing означает успешный набор данного выпуска; hotfix не выдаётся за полный stable-набор.');
  return { badge, report: lines.join('\n') + '\n', mainSha };
}

/** Both files share one commit. A concurrent release-state write is retained by rebuilding on its new tree. */
export async function publishCiStatus({ api, git, published, branch = 'process-release-state', legacyEvidence } = {}) {
  checkedRef(branch);
  if (!api.activated) throw Error('CI publication requires activated GitHub writes');
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await buildCiStatus({ api, git, published, legacyEvidence });
    const head = (await api.getRef(branch)).object.sha;
    const commit = await api.request('GET', `${api.root}/git/commits/${head}`);
    const tree = await api.request('GET', `${api.root}/git/trees/${commit.tree.sha}`);
    if (tree.truncated) throw Error('CI publication tree is incomplete');
    const files = { 'ci.json': serialized(result.badge), 'CI.md': result.report };
    const changes = [];
    for (const [path, content] of Object.entries(files)) {
      const old = tree.tree.find(entry => entry.path === path);
      let previous = null;
      if (old?.type === 'blob') {
        const blob = await api.request('GET', `${api.root}/git/blobs/${old.sha}`);
        if (blob.encoding !== 'base64') throw Error('CI publication blob is unreadable');
        previous = Buffer.from(blob.content, 'base64').toString('utf8');
      }
      if (previous !== content) changes.push({ path, type: 'blob', mode: '100644', content });
    }
    if ((await api.getRef('main')).object.sha !== result.mainSha || (await api.getRef(branch)).object.sha !== head) continue;
    if (!changes.length) return { ...result, updated: false, commit: head };
    const nextTree = await api.request('POST', `${api.root}/git/trees`, { base_tree: commit.tree.sha, tree: changes });
    const next = await api.request('POST', `${api.root}/git/commits`, { message: 'process-next: public CI result for main', tree: nextTree.sha, parents: [head] });
    if ((await api.getRef('main')).object.sha !== result.mainSha) continue;
    try {
      await api.request('PATCH', `${api.root}/git/refs/heads/${branch}`, { sha: next.sha, force: false });
      if ((await api.getRef('main')).object.sha !== result.mainSha) continue;
      return { ...result, updated: true, commit: next.sha };
    } catch (error) { if (![409, 422].includes(error.status)) throw error; }
  }
  throw Error('Main or release state kept changing; retry CI status publication');
}
