#!/usr/bin/env node
/**
 * Красная ночь (#736, PROCESS.md §10.4): один комментарий в каждую задачу,
 * чьи коммиты классов A/B вошли в `dev` после последней зелёной ночи.
 *
 *   node scripts/night-red.mjs --repo=owner/name --red-run=<id прогона Validate>
 *
 * Ночь (`_nightly.yml`) красна, когда красен её полный Validate на `dev`. До
 * этой задачи красный прогон был виден только в Actions: сигнал «автору
 * последних коммитов» не имел адресата. Скрипт его называет.
 *
 * - Работает только при `conclusion: failure` красного прогона: `cancelled`
 *   (новый dispatch отменил ночной), `timed_out` и прочее — строка сводки.
 * - Последняя зелёная ночь `G` — первый прогон Validate `workflow_dispatch` на
 *   `dev` (от новых к старым, не дальше RUN_WINDOW), завершённый успехом,
 *   созданный раньше красного, чей SHA — предок красного `R` или равен ему, и
 *   чьё доказательство `ci-proof` по политике `release` — `green`: лёгкий
 *   зелёный прогон полного набора не доказывает (`stale`).
 * - Подозреваемые — задачи из `Issue: #NN` коммитов `git rev-list --no-merges
 *   G..R` с файлом класса A или B и без трейлера `Release:`. Ветка, влитая
 *   слиянием, приносит коммиты вторым родителем — они тоже вошли.
 * - Комментарий не пишется в закрытую задачу и в задачу, где метка
 *   `hp:night-red` с тем же `green` уже перечисляет все её нынешние коммиты
 *   диапазона: одна серия красных ночей — один комментарий, пока задача не
 *   докоммитит.
 *
 * Actions читаются `ACTIONS_TOKEN` (в ночи — `github.token`), issue читаются
 * и пишутся `gh` с `GH_TOKEN` (в ночи — `HP_PROCESS_TOKEN`: у `github.token`
 * ночи нет `issues: write`, и потолок прав тонкого `nightly.yml` в `main` его
 * не даёт). Сбой — `::warning::` и строка сводки, код возврата 0: цвет ночи —
 * цвет Validate.
 */
import { appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';
import { classify } from './change-classes.mjs';
import { issueTrailers } from './release-membership.mjs';
import { hasReleaseTrailer } from './ship-review.mjs';
import { CI_PROOF_POLICIES, evaluateCiProof, githubApiBase, loadGithubProofContext } from './ci-proof.mjs';

/** Сколько последних dispatch-прогонов Validate на `dev` смотрит поиск `G`. */
export const RUN_WINDOW = 50;
/** Сколько коммитов и упавших job называет комментарий; остальные — «и ещё N». */
export const LIST_LIMIT = 10;
export const NIGHT_RED_MARKER_RE = /<!-- hp:night-red green=([0-9a-f]{40,64}) red=([0-9a-f]{40,64}) commits=([0-9a-f+]*) -->/g;

const short = (sha, n) => String(sha || '').slice(0, n);
const stamp = (run) => Date.parse(run?.created_at || '') || 0;
const runUrl = (repo, run) => run?.html_url || `https://github.com/${repo}/actions/runs/${run?.id}`;
const subjectOf = (message) => String(message || '').split(/\r?\n/)[0].trim();

/**
 * К2: последняя зелёная ночь. `runs` — список API (порядок любой), `red` —
 * красный прогон, `isAncestor(g, r)` — git, `proofContext(run)` — то же, что
 * `loadGithubProofContext`. Доказательство грузится только у прогона, прошедшего
 * дешёвые проверки; ошибка загрузки — сбой (не «не зелёный»): иначе пропуск
 * настоящей зелёной ночи расширил бы диапазон и умножил подозреваемых.
 */
export async function findLastGreen({ red, runs = [], isAncestor, proofContext, workflowJobs = undefined }) {
  const redStamp = stamp(red);
  const ordered = [...runs].sort((a, b) => stamp(b) - stamp(a) || Number(b?.id || 0) - Number(a?.id || 0))
    .slice(0, RUN_WINDOW);
  const skipped = [];
  for (const run of ordered) {
    if (run?.status !== 'completed' || run?.conclusion !== 'success') continue;
    if (!(stamp(run) < redStamp)) continue;
    if (!run.head_sha || !isAncestor(run.head_sha, red.head_sha)) continue;
    const verdict = evaluateCiProof({
      run, ...(await proofContext(run)), policy: CI_PROOF_POLICIES.release, workflowJobs,
    });
    if (verdict.status === 'green') return { run, skipped, looked: ordered.length };
    skipped.push({ run, status: verdict.status, note: verdict.note });
  }
  return { run: null, skipped, looked: ordered.length };
}

/** К3: коммит диапазона считается — без `Release:` и хотя бы с одним файлом класса A или B. */
export function countsForNightRed({ message = '', files = [] } = {}) {
  if (hasReleaseTrailer(message)) return false;
  return files.some((file) => ['A', 'B'].includes(classify(String(file))));
}

/**
 * К3: подозреваемые задачи и коммиты «без задачи». `commits` — в порядке
 * `git rev-list` (новые первыми); в ответе коммиты — по времени, задачи — по
 * номеру.
 */
export function rangeSuspects(commits = []) {
  const byIssue = new Map();
  const orphans = [];
  for (const commit of [...commits].reverse()) {
    if (!countsForNightRed(commit)) continue;
    const entry = { sha: commit.sha, subject: subjectOf(commit.message) };
    const numbers = issueTrailers(commit.message);
    if (!numbers.length) orphans.push(entry);
    for (const number of numbers) {
      if (!byIssue.has(number)) byIssue.set(number, []);
      byIssue.get(number).push(entry);
    }
  }
  const issues = [...byIssue].sort((a, b) => a[0] - b[0]).map(([number, list]) => ({ number, commits: list }));
  return { issues, orphans };
}

/** Метки `hp:night-red` из комментариев задачи. */
export function parseNightRedMarkers(comments = []) {
  const found = [];
  for (const comment of comments) {
    for (const match of String(comment?.body ?? '').matchAll(NIGHT_RED_MARKER_RE)) {
      found.push({ green: match[1], red: match[2], commits: new Set(match[3].split('+').filter(Boolean)) });
    }
  }
  return found;
}

/**
 * К5: `closed` — задача закрыта; `warned` — метка с тем же `green` уже
 * перечисляет все её нынешние коммиты диапазона; иначе `comment`.
 */
export function commentVerdict({ issue, green, commits = [] }) {
  if (String(issue?.state || '').toUpperCase() === 'CLOSED') return 'closed';
  const warned = parseNightRedMarkers(issue?.comments).some((marker) => marker.green === green
    && commits.every((commit) => marker.commits.has(short(commit.sha, 12))));
  return warned ? 'warned' : 'comment';
}

const limited = (items, render) => {
  const shown = items.slice(0, LIST_LIMIT).map(render);
  if (items.length > LIST_LIMIT) shown.push(`и ещё ${items.length - LIST_LIMIT}`);
  return shown.join('; ');
};

/** К4: тело комментария. `commits` — все коммиты задачи в диапазоне; метка несёт все. */
export function commentBody({ repo, red, green, commits = [], failedJobs = [] }) {
  const R = red.head_sha;
  const G = green.head_sha;
  return [
    `**Красная ночь:** полный Validate на \`dev\` красный — ${runUrl(repo, red)} (\`${short(R, 12)}\`).`
      + ` Последняя зелёная ночь — ${runUrl(repo, green)} (\`${short(G, 12)}\`).`,
    `Коммиты этой задачи с файлами классов A/B вошли в \`dev\` между ними: ${limited(commits, (c) => `\`${short(c.sha, 8)}\` ${c.subject}`)}.`,
    `Упали job: ${failedJobs.length ? limited(failedJobs, (name) => name) : '—'}.`,
    'Задача — подозреваемая по диапазону, а не виновная. Ночь — сигнал, не гейт: бета по-прежнему требует зелёный Validate на SHA кандидата.',
    `<!-- hp:night-red green=${G} red=${R} commits=${commits.map((c) => short(c.sha, 12)).join('+')} -->`,
  ].join('\n');
}

const VERDICT_LINE = {
  comment: 'комментарий написан',
  warned: 'уже предупреждена в этой серии',
  closed: 'закрыта — комментарий не пишется',
};

/**
 * Весь разбор красной ночи. `api` — Actions (`run`, `runs`, `failedJobs`,
 * `proofContext`), `issues` — `view`/`comment`, `git` — `isAncestor`,
 * `rangeCommits`. Возвращает строки сводки, написанные комментарии и
 * предупреждения; сбой до первой задачи — исключение.
 */
export async function nightRed({ repo, redRunId, api, issues, git, workflowJobs = undefined }) {
  const head = '### Красная ночь (#736)';
  const red = await api.run(redRunId);
  const redLine = `${runUrl(repo, red)} (\`${short(red.head_sha, 12)}\`)`;
  if (red.status !== 'completed' || red.conclusion !== 'failure') {
    return {
      posted: [], warnings: [],
      summary: [head, `- Прогон Validate ${redLine}: ${red.status}/${red.conclusion || '—'}, не failure — комментариев нет.`],
    };
  }
  const found = await findLastGreen({
    red, runs: await api.runs(), isAncestor: git.isAncestor, proofContext: api.proofContext, workflowJobs,
  });
  const summary = [head, `- Красный прогон: ${redLine}.`];
  for (const item of found.skipped) {
    summary.push(`- Отсеян зелёный ${runUrl(repo, item.run)} (\`${short(item.run.head_sha, 12)}\`): ${item.status} — ${item.note}.`);
  }
  if (!found.run) {
    summary.push(`- Последняя зелёная ночь не найдена (просмотрено прогонов: ${found.looked}) — подозреваемых не назначаю.`);
    return { posted: [], warnings: [], summary };
  }
  const green = found.run;
  summary.push(`- Последняя зелёная ночь: ${runUrl(repo, green)} (\`${short(green.head_sha, 12)}\`).`);
  const commits = green.head_sha === red.head_sha ? [] : git.rangeCommits(green.head_sha, red.head_sha);
  if (!commits.length) {
    summary.push('- Тот же код был зелёным — вероятен флак. Комментариев нет.');
    return { posted: [], warnings: [], summary };
  }
  const { issues: suspects, orphans } = rangeSuspects(commits);
  summary.push(`- Коммитов в диапазоне без слияний: ${commits.length}; задач-подозреваемых: ${suspects.length}.`);
  const failedJobs = suspects.length ? await api.failedJobs(red.id) : [];
  const posted = [];
  const warnings = [];
  for (const suspect of suspects) {
    const count = `коммитов A/B: ${suspect.commits.length}`;
    try {
      const issue = issues.view(suspect.number);
      const verdict = commentVerdict({ issue, green: green.head_sha, commits: suspect.commits });
      if (verdict === 'comment') {
        const body = commentBody({ repo, red, green, commits: suspect.commits, failedJobs });
        issues.comment(suspect.number, body);
        posted.push({ number: suspect.number, body });
      }
      summary.push(`- #${suspect.number} (${count}): ${VERDICT_LINE[verdict]}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      summary.push(`- #${suspect.number} (${count}): сбой — ${message}.`);
      warnings.push(`красная ночь: #${suspect.number} — ${message}`);
    }
  }
  if (orphans.length) {
    summary.push(`- Без задачи: ${limited(orphans, (c) => `\`${short(c.sha, 8)}\` ${c.subject}`)}.`);
  }
  return { posted, warnings, summary };
}

function runGit(args, { cwd, allowFailure = false } = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !allowFailure) throw new Error(`git ${args.join(' ')}: ${(r.stderr || r.error?.message || '').trim()}`);
  return r;
}

/**
 * Git рабочей копии. Пути — `-z` и без поиска переименований: checkout ночи —
 * `filter: blob:none`, и сравнение содержимого догружало бы блобы.
 */
export function gitClient({ cwd } = {}) {
  return {
    isAncestor: (ancestor, descendant) => runGit(['merge-base', '--is-ancestor', ancestor, descendant], { cwd, allowFailure: true }).status === 0,
    rangeCommits: (green, red) => runGit(['rev-list', '--no-merges', `${green}..${red}`], { cwd }).stdout
      .split('\n').filter(Boolean).map((sha) => ({
        sha,
        message: runGit(['show', '-s', '--format=%B', sha], { cwd }).stdout,
        files: runGit(['diff-tree', '--no-commit-id', '--name-only', '-r', '--no-renames', '-z', '--root', sha], { cwd })
          .stdout.split('\0').filter(Boolean),
      })),
  };
}

/**
 * Actions API: `token` — `github.token`; база — `GITHUB_API_URL`, как у раннера.
 * #751: база идёт в `loadGithubProofContext` параметром — переписывать URL
 * обёрткой над `fetch` больше незачем.
 */
export function actionsClient({ repo, token, apiBase = githubApiBase(), fetchImpl = fetch }) {
  const base = String(apiBase || githubApiBase()).replace(/\/+$/, '');
  const json = async (path) => {
    const response = await fetchImpl(`${base}/repos/${repo}${path}`, {
      headers: {
        Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
        'User-Agent': 'houseplan-night-red', 'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status} ${path}: ${(await response.text()).slice(0, 300)}`);
    return response.json();
  };
  return {
    run: (id) => json(`/actions/runs/${id}`),
    runs: async () => (await json(`/actions/workflows/validate.yml/runs?branch=dev&event=workflow_dispatch&per_page=${RUN_WINDOW}`))
      ?.workflow_runs || [],
    failedJobs: async (id) => ((await json(`/actions/runs/${id}/jobs?per_page=100`))?.jobs || [])
      .filter((job) => job?.conclusion === 'failure').map((job) => job.name),
    proofContext: (run) => loadGithubProofContext({ repo, run, token, fetchImpl, apiBase: base }),
  };
}

/** Issue через `gh` (`GH_TOKEN` — токен процесса). */
export function ghIssues({ repo }) {
  const gh = (args) => {
    const r = spawnSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(' ')}: ${(r.stderr || r.stdout || r.error?.message || '').trim()}`);
    return r.stdout;
  };
  return {
    view: (number) => JSON.parse(gh(['issue', 'view', String(number), '--repo', repo, '--json', 'number,state,comments'])),
    comment: (number, body) => gh(['issue', 'comment', String(number), '--repo', repo, '--body', body]),
  };
}

if (isMainModule(import.meta.url)) {
  const value = (name) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '';
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  const toSummary = (text) => { if (summaryFile) appendFileSync(summaryFile, `${text}\n`); };
  try {
    const repo = value('repo') || process.env.GITHUB_REPOSITORY || '';
    const redRunId = value('red-run');
    if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new Error(`--repo=owner/name обязателен, получено «${repo}»`);
    if (!/^[1-9]\d*$/.test(redRunId)) throw new Error(`--red-run=<id прогона> обязателен, получено «${redRunId}»`);
    const result = await nightRed({
      repo, redRunId,
      api: actionsClient({ repo, token: process.env.ACTIONS_TOKEN || '', apiBase: githubApiBase() }),
      issues: ghIssues({ repo }),
      git: gitClient(),
    });
    const text = result.summary.join('\n');
    console.log(text);
    toSummary(text);
    for (const warning of result.warnings) console.log(`::warning::${warning}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`::warning::красная ночь (#736): ${message} — комментарии не написаны; цвет ночи — цвет Validate`);
    toSummary(`### Красная ночь (#736)\n- Сбой: ${message} — комментарии не написаны.`);
  }
}
