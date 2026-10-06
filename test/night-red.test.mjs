import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCiProof, githubServerUrl } from '../scripts/ci-proof.mjs';
import { jobInstanceNames, validateJobs } from '../scripts/workflow-jobs.mjs';
import { findStep, stepCommand } from './helpers/workflow-step.mjs';
import {
  LIST_LIMIT, NIGHT_RED_MARKER_RE, actionsClient, commentBody, commentVerdict, countsForNightRed, findLastGreen, gitClient,
  nightRed, parseNightRedMarkers, rangeSuspects,
} from '../scripts/night-red.mjs';

// #736: красная ночь — комментарий в задачи, чьи коммиты A/B вошли в `dev`
// после последней зелёной ночи. Git — настоящий, во временных репозиториях;
// доказательство зелёной ночи — настоящий `ci-proof` (buildCiProof →
// evaluateCiProof). Подменены только Actions API и `gh`. Шаг workflow
// исполняется настоящим bash: Actions — локальный HTTP-сервер по
// GITHUB_API_URL, issue — подменённый `gh`.

const SCRIPTS = fileURLToPath(new URL('../scripts', import.meta.url));
const REPO = 'o/r';
const TREE = 'b'.repeat(40);

// Окружение git без GIT_* родителя (урок #633) и без глобального конфига (#496).
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false',
  GIT_CONFIG_KEY_1: 'init.defaultBranch', GIT_CONFIG_VALUE_1: 'dev',
};
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: ENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Коммит файлов `files` с сообщением `message`; возвращает SHA. */
function commit(cwd, files, message) {
  for (const file of files) {
    mkdirSync(join(cwd, file, '..'), { recursive: true });
    writeFileSync(join(cwd, file), `${file} ${Math.random()}\n`);
  }
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', message);
  return git(cwd, 'rev-parse', 'HEAD');
}

/**
 * История `dev`: G — последняя зелёная ночь, R — красная. Между ними — по
 * коммиту на каждый случай AC1 и двенадцать коммитов #8 (комментарий называет
 * десять). Ветка `side` с #5 влита слиянием, само слияние несёт `Issue: #6`.
 * Ветка `other` в `dev` не влита.
 */
function history(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'hp-736-git-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  git(cwd, 'init', '-q');
  const sha = {};
  sha.base = commit(cwd, ['README.md'], 'chore: base');
  sha.G = commit(cwd, ['src/g.ts'], 'feat: green\n\nIssue: #9\nUser-Visible: no');
  sha.c1 = commit(cwd, ['src/a.ts'], 'feat: a\n\nIssue: #1\nUser-Visible: no');
  git(cwd, 'checkout', '-q', '-b', 'side');
  sha.c6 = commit(cwd, ['src/side.ts'], 'feat: side branch\n\nIssue: #5\nUser-Visible: no');
  git(cwd, 'checkout', '-q', 'dev');
  sha.c2 = commit(cwd, ['test/b.test.mjs'], 'test: b only\n\nIssue: #2\nUser-Visible: no');
  sha.c3 = commit(cwd, ['docs/reviews/CODE-REVIEW-3.md'], 'docs: review document for #3\n\nIssue: #3\nUser-Visible: no');
  sha.c4 = commit(cwd, ['src/release.ts'], 'chore(release): beta candidate\n\nRelease: v9.9.9-beta.1\nIssue: #4\nUser-Visible: no');
  sha.c5 = commit(cwd, ['scripts/x.mjs'], 'chore: script without a task');
  sha.many = [];
  for (let i = 1; i <= 12; i += 1) sha.many.push(commit(cwd, [`src/many-${i}.ts`], `feat: many ${i}\n\nIssue: #8\nUser-Visible: no`));
  git(cwd, 'merge', '-q', '--no-ff', 'side', '-m', 'Merge branch side\n\nIssue: #6');
  sha.R = git(cwd, 'rev-parse', 'HEAD');
  git(cwd, 'checkout', '-q', '-b', 'other', sha.G);
  sha.other = commit(cwd, ['src/other.ts'], 'feat: never merged\n\nIssue: #7\nUser-Visible: no');
  git(cwd, 'checkout', '-q', 'dev');
  return { cwd, sha, add: (files, message) => commit(cwd, files, message) };
}

// #622: имена job — из validate.yml, не копией строк.
const WORKFLOW = validateJobs();
const greenJobs = (...ids) => ids.flatMap((id) => jobInstanceNames(WORKFLOW.get(id)).map((name) => ({ name, conclusion: 'success' })));

/** Прогон Validate-dispatch на `dev` и его доказательство: полный или лёгкий. */
function validateRun({ id, sha, at, conclusion = 'success', status = 'completed', full = true }) {
  const run = {
    id, run_attempt: 1, status, conclusion, event: 'workflow_dispatch', head_sha: sha, head_branch: 'dev',
    created_at: at, html_url: `https://github.com/${REPO}/actions/runs/${id}`,
  };
  const skipped = { result: full ? 'success' : 'skipped' };
  const needs = {
    preflight: { result: 'success' }, reuse: { result: 'success', outputs: {} }, frontend: { result: 'success' },
    changes: { result: 'success', outputs: { heavy: String(full), mutants_requested: 'false', frontend: 'true' } },
    smoke: skipped, smoke_done: skipped, golden: skipped, performance_smoke: skipped,
  };
  const proof = buildCiProof({ candidateSha: sha, candidateTree: TREE, runId: id, attempt: 1, event: 'workflow_dispatch', needs });
  const jobs = greenJobs('preflight', 'changes', 'reuse', 'frontend');
  if (full) jobs.push(...greenJobs('smoke', 'smoke_done', 'golden', 'performance_smoke'));
  return { run, context: { proof, jobs, reuseRuns: new Map() } };
}

const day = (n) => `2026-09-${String(n).padStart(2, '0')}T02:20:00Z`;

// ---------- AC1: последняя зелёная и подозреваемые ----------

test('#736 AC1 К2: последняя зелёная — полный зелёный предок красного; лёгкий, поздний и чужой не выбираются', async (t) => {
  const { cwd, sha } = history(t);
  const runs = [
    validateRun({ id: 106, sha: sha.R, at: day(25) }), // зелёный, но создан после красного
    validateRun({ id: 105, sha: sha.R, at: day(24), conclusion: 'failure' }), // красный R
    validateRun({ id: 107, sha: sha.other, at: day(23) }), // зелёный полный, не предок R
    validateRun({ id: 104, sha: sha.c2, at: day(22), full: false }), // зелёный лёгкий — stale
    validateRun({ id: 103, sha: sha.c1, at: day(21), conclusion: 'failure' }), // красный прошлой ночи
    validateRun({ id: 102, sha: sha.G, at: day(20) }), // зелёный полный G
    validateRun({ id: 101, sha: sha.base, at: day(19) }),
  ];
  const contexts = new Map(runs.map((item) => [item.run.id, item.context]));
  const loaded = [];
  const proofContext = async (run) => { loaded.push(run.id); return contexts.get(run.id); };
  const { isAncestor } = gitClient({ cwd });
  const red = runs[1].run;
  // Порядок списка не важен: поиск идёт от новых к старым по created_at.
  const found = await findLastGreen({ red, runs: [...runs].reverse().map((item) => item.run), isAncestor, proofContext });
  assert.equal(found.run?.id, 102, 'выбран полный зелёный G');
  assert.deepEqual(found.skipped.map((item) => [item.run.id, item.status]), [[104, 'stale']], 'лёгкий зелёный отсеян как stale');
  assert.match(found.skipped[0].note, /light/);
  assert.deepEqual(loaded, [104, 102], 'доказательство грузится только у прошедших дешёвые проверки: поздний и чужой — нет');

  // Ничего не подошло — null: G без полного доказательства, base за окном выдачи.
  const none = await findLastGreen({
    red, isAncestor, proofContext,
    runs: runs.filter((item) => ![102, 101].includes(item.run.id)).map((item) => item.run),
  });
  assert.equal(none.run, null);
  // Доказательство истекло (artifact нет) — не зелёный: missing.
  const expired = await findLastGreen({
    red, isAncestor, runs: [runs[1].run, runs[5].run],
    proofContext: async () => ({ proof: null, jobs: [], reuseRuns: new Map() }),
  });
  assert.equal(expired.run, null);
  assert.equal(expired.skipped[0].status, 'missing');
  // Окно — 50 прогонов: G за ним не ищется.
  const filler = Array.from({ length: 50 }, (_, i) => validateRun({
    id: 200 + i, sha: sha.c1, at: `2026-09-23T${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String(i % 6 * 10).padStart(2, '0')}:00Z`,
    conclusion: 'failure',
  }).run);
  const beyond = await findLastGreen({ red, isAncestor, proofContext, runs: [red, ...filler, runs[5].run] });
  assert.equal(beyond.run, null, 'G — 52-й прогон списка, за окном');
});

test('#736 AC1 К3: подозреваемые — коммиты A/B с задачей без Release:, ветка второго родителя входит, слияние — нет', (t) => {
  const { cwd, sha } = history(t);
  const commits = gitClient({ cwd }).rangeCommits(sha.G, sha.R);
  assert.ok(!commits.some((c) => c.sha === sha.R), 'слияние не в списке (--no-merges)');
  assert.ok(commits.some((c) => c.sha === sha.c6), 'коммит ветки, влитой вторым родителем, в списке');
  const { issues, orphans } = rangeSuspects(commits);
  assert.deepEqual(issues.map((issue) => issue.number), [1, 2, 5, 8],
    '#3 — только docs/**, #4 — Release:, #6 — слияние, #9 — сама зелёная, #7 — не влит');
  assert.deepEqual(issues.find((issue) => issue.number === 1).commits, [{ sha: sha.c1, subject: 'feat: a' }]);
  assert.deepEqual(issues.find((issue) => issue.number === 8).commits.map((c) => c.sha), sha.many, 'коммиты — по времени');
  assert.deepEqual(orphans, [{ sha: sha.c5, subject: 'chore: script without a task' }], 'scripts/** без трейлера — «без задачи»');
  // Чистое правило счёта.
  assert.equal(countsForNightRed({ message: 'x\n\nIssue: #3', files: ['docs/reviews/A.md', 'docs/INDEX.md'] }), false);
  assert.equal(countsForNightRed({ message: 'x\n\nRelease: v1.0.0\nIssue: #4', files: ['src/a.ts'] }), false);
  assert.equal(countsForNightRed({ message: 'x\n\nIssue: #2', files: ['docs/a.md', 'test/a.test.mjs'] }), true);
  assert.equal(countsForNightRed({ message: 'x', files: ['dist/houseplan-card.js'] }), false, 'класс D — не A/B');
  // G == R — диапазон пуст.
  assert.deepEqual(gitClient({ cwd }).rangeCommits(sha.R, sha.R), []);
});

// ---------- AC2: когда и сколько комментариев ----------

/** Actions по списку прогонов: доказательства — из validateRun. */
function fakeApi(items, failed = ['Смоки в браузере (шард 2/6)', 'Golden-кадры против принятых эталонов']) {
  const runs = items.map((item) => item.run);
  const contexts = new Map(items.map((item) => [item.run.id, item.context]));
  return {
    run: async (id) => runs.find((run) => run.id === Number(id)),
    runs: async () => runs,
    failedJobs: async () => failed,
    proofContext: async (run) => contexts.get(run.id),
  };
}

/** Issue в памяти: комментарий виден следующему чтению, как в GitHub. */
function issueStore(states = {}) {
  const comments = new Map();
  const posted = [];
  return {
    posted,
    view: (number) => ({ number, state: states[number] || 'OPEN', comments: [...(comments.get(number) || [])] }),
    comment: (number, body) => {
      if (!comments.has(number)) comments.set(number, []);
      comments.get(number).push({ body });
      posted.push({ number, body });
    },
  };
}

test('#736 AC2 К1: красным считается только failure — cancelled, success, timed_out комментариев не дают', async (t) => {
  const { cwd, sha } = history(t);
  for (const conclusion of ['cancelled', 'success', 'timed_out']) {
    const store = issueStore();
    const items = [validateRun({ id: 105, sha: sha.R, at: day(24), conclusion }), validateRun({ id: 102, sha: sha.G, at: day(20) })];
    const result = await nightRed({ repo: REPO, redRunId: '105', api: fakeApi(items), issues: store, git: gitClient({ cwd }) });
    assert.deepEqual(store.posted, [], conclusion);
    assert.match(result.summary.join('\n'), new RegExp(`completed/${conclusion}, не failure — комментариев нет`));
  }
});

test('#736 AC2 К4–К5: один комментарий на задачу за серию; закрытая — строка сводки; новый коммит или новая зелёная — снова', async (t) => {
  const { cwd, sha, add } = history(t);
  const store = issueStore({ 2: 'CLOSED' });
  const repoGit = gitClient({ cwd });
  const G = validateRun({ id: 102, sha: sha.G, at: day(20) });
  const R1 = validateRun({ id: 105, sha: sha.R, at: day(24), conclusion: 'failure' });
  const night = (items, red) => nightRed({ repo: REPO, redRunId: String(red), api: fakeApi(items), issues: store, git: repoGit });

  // Ночь 1: #1, #5, #8 — комментарии; #2 закрыта.
  const first = await night([R1, G], 105);
  assert.deepEqual(store.posted.map((item) => item.number), [1, 5, 8]);
  const summary = first.summary.join('\n');
  assert.match(summary, /- #2 \(коммитов A\/B: 1\): закрыта — комментарий не пишется\./);
  assert.match(summary, /- #8 \(коммитов A\/B: 12\): комментарий написан\./);
  assert.match(summary, new RegExp(`- Без задачи: \`${sha.c5.slice(0, 8)}\` chore: script without a task\\.`));
  const body8 = store.posted.find((item) => item.number === 8).body;
  const marker = [...body8.matchAll(NIGHT_RED_MARKER_RE)];
  assert.equal(marker.length, 1);
  assert.equal(marker[0][1], sha.G, 'green — полный SHA');
  assert.equal(marker[0][2], sha.R, 'red — полный SHA');
  assert.deepEqual(marker[0][3].split('+'), sha.many.map((s) => s.slice(0, 12)), 'метка перечисляет все коммиты задачи');
  const listed = body8.split('\n')[1];
  assert.equal([...listed.matchAll(/`([0-9a-f]{8})`/g)].length, LIST_LIMIT, 'комментарий называет не больше десяти коммитов');
  assert.match(listed, /; и ещё 2\.$/);
  assert.match(body8, /Упали job: Смоки в браузере \(шард 2\/6\); Golden-кадры против принятых эталонов\./);
  assert.match(body8, /^\*\*Красная ночь:\*\* полный Validate на `dev` красный — https:\/\/github\.com\/o\/r\/actions\/runs\/105 \(`[0-9a-f]{12}`\)\. Последняя зелёная ночь — https:\/\/github\.com\/o\/r\/actions\/runs\/102/);
  assert.match(body8, /Задача — подозреваемая по диапазону, а не виновная\./);

  // Та же пара — повтора нет.
  const again = await night([R1, G], 105);
  assert.equal(store.posted.length, 3, 'второй комментарий на ту же пару не пишется');
  assert.match(again.summary.join('\n'), /- #1 \(коммитов A\/B: 1\): уже предупреждена в этой серии\./);

  // Тот же G, новый R: у #1 новый коммит — комментарий; у #5 и #8 нового нет — повтора нет.
  const c7 = add(['src/a2.ts'], 'fix: a again\n\nIssue: #1\nUser-Visible: no');
  const R2 = validateRun({ id: 108, sha: c7, at: day(26), conclusion: 'failure' });
  await night([R2, R1, G], 108);
  assert.deepEqual(store.posted.slice(3).map((item) => item.number), [1]);
  assert.match(store.posted[3].body, new RegExp(`commits=${sha.c1.slice(0, 12)}\\+${c7.slice(0, 12)} -->$`));

  // Новая зелёная ночь начинает серию: от неё судится следующая красная.
  const G2 = validateRun({ id: 109, sha: c7, at: day(27) });
  const c8 = add(['src/side2.ts'], 'fix: side again\n\nIssue: #5\nUser-Visible: no');
  const R3 = validateRun({ id: 110, sha: c8, at: day(28), conclusion: 'failure' });
  const third = await night([R3, G2, R2, R1, G], 110);
  assert.deepEqual(store.posted.slice(4).map((item) => item.number), [5]);
  assert.match(store.posted[4].body, new RegExp(`green=${c7} red=${c8} commits=${c8.slice(0, 12)} -->$`));
  assert.match(third.summary.join('\n'), /Последняя зелёная ночь: https:\/\/github\.com\/o\/r\/actions\/runs\/109/);

  // Зелёная на том же SHA, что красная, — тот же код был зелёным: никого.
  const sameCode = await night([validateRun({ id: 112, sha: c8, at: day(30), conclusion: 'failure' }),
    validateRun({ id: 111, sha: c8, at: day(29) })], 112);
  assert.equal(store.posted.length, 5);
  assert.match(sameCode.summary.join('\n'), /Тот же код был зелёным — вероятен флак/);

  // Зелёной в окне нет — подозреваемых не назначаю.
  const lost = await night([R3, validateRun({ id: 99, sha: sha.G, at: day(19), full: false })], 110);
  assert.equal(store.posted.length, 5);
  assert.match(lost.summary.join('\n'), /Последняя зелёная ночь не найдена \(просмотрено прогонов: 2\) — подозреваемых не назначаю/);
  assert.match(lost.summary.join('\n'), /Отсеян зелёный .*runs\/99 .*: stale/);
});

test('#736 AC2 К5: правило повтора — та же зелёная и все нынешние коммиты в метке; закрытая задача не комментируется', () => {
  const G = 'a'.repeat(40);
  const G2 = 'c'.repeat(40);
  const R = 'd'.repeat(40);
  const c1 = { sha: '1'.repeat(40), subject: 'one' };
  const c2 = { sha: '2'.repeat(40), subject: 'two' };
  const body = commentBody({ repo: REPO, red: { id: 5, head_sha: R }, green: { id: 4, head_sha: G }, commits: [c1, c2] });
  assert.match(body, /Упали job: —\./);
  const issue = (state, ...bodies) => ({ state, comments: bodies.map((text) => ({ body: text })) });
  assert.deepEqual(parseNightRedMarkers([{ body }]).map((m) => [m.green, m.red, [...m.commits]]),
    [[G, R, [c1.sha.slice(0, 12), c2.sha.slice(0, 12)]]]);
  assert.equal(commentVerdict({ issue: issue('OPEN', body), green: G, commits: [c1, c2] }), 'warned', 'та же серия, те же коммиты');
  assert.equal(commentVerdict({ issue: issue('OPEN', body), green: G, commits: [c2] }), 'warned', 'подмножество — уже предупреждена');
  assert.equal(commentVerdict({ issue: issue('OPEN', body), green: G, commits: [c1, c2, { sha: '3'.repeat(40) }] }), 'comment', 'новый коммит');
  assert.equal(commentVerdict({ issue: issue('OPEN', body), green: G2, commits: [c1, c2] }), 'comment', 'новая зелёная — новая серия');
  assert.equal(commentVerdict({ issue: issue('OPEN'), green: G, commits: [c1] }), 'comment');
  assert.equal(commentVerdict({ issue: issue('CLOSED'), green: G, commits: [c1] }), 'closed');
  assert.equal(commentVerdict({ issue: issue('closed', body), green: G2, commits: [c1] }), 'closed');
  // Чужой текст без метки — не предупреждение.
  assert.equal(commentVerdict({ issue: issue('OPEN', `hp:night-red green=${G}`), green: G, commits: [c1] }), 'comment');
});

// ---------- Шаг workflow на настоящем bash ----------

const hasBash = () => process.platform !== 'win32' && spawnSync('bash', ['--version']).status === 0;

/** Тело `run:` шага, как его прочтёт YAML. */
function stepRun(text, name) {
  const start = text.indexOf(`      - name: "${name}"\n`);
  assert.ok(start >= 0, `шаг «${name}»`);
  const lines = text.slice(start).split('\n');
  const from = lines.indexOf('        run: |');
  assert.ok(from > 0, `у шага «${name}» есть run: |`);
  const body = [];
  for (const line of lines.slice(from + 1)) {
    if (line.trim() && !/^ {10}/.test(line)) break;
    body.push(line.replace(/^ {10}/, ''));
  }
  return body.join('\n');
}

/** Минимальный ZIP с одним `proof.json` (stored), как читает readCiProofArtifact. */
function zipWith(proof) {
  const body = Buffer.from(JSON.stringify(proof));
  const name = Buffer.from('proof.json');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 8);
  local.writeUInt32LE(body.length, 18); local.writeUInt32LE(body.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0, 10);
  central.writeUInt32LE(body.length, 20); central.writeUInt32LE(body.length, 24); central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length + name.length, 12);
  eocd.writeUInt32LE(local.length + name.length + body.length, 16);
  return Buffer.concat([local, name, body, central, name, eocd]);
}

/**
 * Actions API на локальном порту: прогоны, артефакт доказательства, job. Каждый
 * запрос к /repos обязан нести `Bearer actions-token`; `fail` — ответ 500.
 */
async function actionsServer(t, items, { fail = false } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    requests.push({ path: url.pathname + url.search, auth: req.headers.authorization || '' });
    const send = (status, body, type = 'application/json') => {
      res.writeHead(status, { 'content-type': type });
      res.end(type === 'application/json' ? JSON.stringify(body) : body);
    };
    if (fail) return send(500, { message: 'boom' });
    const download = url.pathname.match(/^\/download\/(\d+)$/);
    if (download) return send(200, zipWith(items.find((item) => item.run.id === Number(download[1])).context.proof), 'application/zip');
    if (req.headers.authorization !== 'Bearer actions-token') return send(401, { message: 'bad token' });
    if (url.pathname === `/repos/${REPO}/actions/workflows/validate.yml/runs`) return send(200, { workflow_runs: items.map((item) => item.run) });
    const route = url.pathname.match(new RegExp(`^/repos/${REPO}/actions/runs/(\\d+)(/artifacts|/jobs)?$`));
    const item = route && items.find((entry) => entry.run.id === Number(route[1]));
    if (!item) return send(404, { message: 'not found' });
    if (!route[2]) return send(200, item.run);
    if (route[2] === '/jobs') {
      return send(200, { jobs: item.run.conclusion === 'failure' ? [{ name: 'Смоки в браузере (шард 3/6)', conclusion: 'failure' }, { name: 'Предполёт', conclusion: 'success' }] : item.context.jobs });
    }
    const name = url.searchParams.get('name');
    return send(200, { artifacts: [{ name, expired: false, archive_download_url: `http://127.0.0.1:${server.address().port}/download/${item.run.id}` }] });
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => server.close());
  return { base: `http://127.0.0.1:${server.address().port}`, requests };
}

/** Подменённый `gh`: issue из JSON-файлов, комментарии — в файлы; токен — в журнал. */
function fakeGh(root, issues) {
  const bin = join(root, 'bin');
  const data = join(root, 'issues');
  mkdirSync(bin);
  mkdirSync(data);
  for (const [number, issue] of Object.entries(issues)) writeFileSync(join(data, `${number}.json`), JSON.stringify({ number: Number(number), ...issue }));
  writeFileSync(join(bin, 'gh'), [
    '#!/usr/bin/env bash',
    'echo "gh $1 $2 $3 token=$GH_TOKEN" >> "$FAKE_LOG"',
    'case "$1 $2" in',
    '  "issue view") cat "$FAKE_ISSUES/$3.json" ;;',
    '  "issue comment") n=$3; shift 3',
    '    while [ $# -gt 0 ]; do if [ "$1" = --body ]; then printf "%s" "$2" > "$FAKE_ISSUES/comment-$n.md"; shift 2; else shift; fi; done ;;',
    '  *) echo "unexpected gh $*" >&2; exit 1 ;;',
    'esac',
    '',
  ].join('\n'), { mode: 0o755 });
  return { bin, data };
}

/** Шаг ночи в рабочей копии `cwd` с `scripts/` из этого дерева; асинхронно — сервер живёт в этом процессе. */
async function runNightStep(t, { cwd, items, issues = {}, fail = false, scripts = SCRIPTS, env = {} }) {
  const root = mkdtempSync(join(tmpdir(), 'hp-736-step-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const api = await actionsServer(t, items, { fail });
  const gh = fakeGh(root, issues);
  rmSync(join(cwd, 'scripts'), { recursive: true, force: true });
  symlinkSync(scripts, join(cwd, 'scripts'));
  const files = { log: join(root, 'gh.log'), summary: join(root, 'summary.md') };
  const name = 'Комментарий в задачи диапазона от последней зелёной ночи до красной';
  const nightly = readFileSync(new URL('../.github/workflows/_nightly.yml', import.meta.url), 'utf8');
  // #766: shell шага — по правилам раннера (без `shell:` — `bash -e {0}`); тело — файлом.
  const { command, args, dir } = stepCommand(findStep(nightly, `      - name: "${name}"\n`, '_nightly.yml'), stepRun(nightly, name));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const child = spawn(command, args, {
    cwd,
    env: {
      ...ENV, PATH: `${gh.bin}:${process.env.PATH}`, REPO, RED_RUN: '105',
      ACTIONS_TOKEN: 'actions-token', GH_TOKEN: 'process-token', GITHUB_API_URL: api.base,
      GITHUB_STEP_SUMMARY: files.summary, FAKE_LOG: files.log, FAKE_ISSUES: gh.data, ...env,
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const status = await new Promise((done) => child.on('close', done));
  const text = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
  const comment = (number) => text(join(gh.data, `comment-${number}.md`));
  return { status, stdout, stderr, requests: api.requests, log: text(files.log).split('\n').filter(Boolean), summary: text(files.summary), comment };
}

// #751: база API идёт в loadGithubProofContext параметром; обёртки над fetch,
// переписывавшей префикс api.github.com, больше нет. Ссылку на архив
// доказательства API отдаёт абсолютной — она не трогается.
test('#751 AC2: actionsClient — прогоны, job и доказательство из apiBase, архив — по ссылке API', async () => {
  const base = 'https://ghe.example/api/v3';
  const archive = 'https://objects.example/artifacts/5/zip';
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    if (url === archive) return { ok: true, arrayBuffer: async () => zipWith({}) };
    if (/\/artifacts\?name=/.test(url)) return { ok: true, json: async () => ({ artifacts: [{ name: 'ci-proof-5-1', expired: false, archive_download_url: archive }] }) };
    return { ok: true, json: async () => ({ id: 5, workflow_runs: [], jobs: [] }) };
  };
  const api = actionsClient({ repo: REPO, token: 'actions-token', apiBase: `${base}/`, fetchImpl });
  await api.run(5);
  await api.runs();
  await api.failedJobs(5);
  await api.proofContext({ id: 5, run_attempt: 1 });
  assert.deepEqual(urls, [
    `${base}/repos/${REPO}/actions/runs/5`,
    `${base}/repos/${REPO}/actions/workflows/validate.yml/runs?branch=dev&event=workflow_dispatch&per_page=50`,
    `${base}/repos/${REPO}/actions/runs/5/jobs?per_page=100`,
    `${base}/repos/${REPO}/actions/runs/5/artifacts?name=ci-proof-5-1`,
    archive,
    `${base}/repos/${REPO}/actions/runs/5/jobs?per_page=100`,
  ]);
});

test('#736 AC2/AC3 на настоящем bash: шаг ночи читает Actions токеном ночи, пишет issue токеном процесса', async (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  const { cwd, sha } = history(t);
  const items = [
    validateRun({ id: 105, sha: sha.R, at: day(24), conclusion: 'failure' }),
    validateRun({ id: 104, sha: sha.c2, at: day(22), full: false }),
    validateRun({ id: 102, sha: sha.G, at: day(20) }),
  ];
  const warned = commentBody({ repo: REPO, red: { id: 90, head_sha: 'e'.repeat(40) }, green: items[2].run, commits: [{ sha: sha.c6, subject: 'feat: side branch' }] });
  const run = await runNightStep(t, {
    cwd, items,
    issues: { 1: { state: 'OPEN', comments: [] }, 2: { state: 'CLOSED', comments: [] }, 5: { state: 'OPEN', comments: [{ body: warned }] }, 8: { state: 'OPEN', comments: [] } },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /::warning::/, run.stdout);
  assert.ok(run.requests.length > 0);
  assert.deepEqual(run.requests.filter((r) => r.path.startsWith('/repos/') && r.auth !== 'Bearer actions-token'), [], 'Actions — токеном ночи');
  assert.ok(run.requests.some((r) => r.path === `/repos/${REPO}/actions/workflows/validate.yml/runs?branch=dev&event=workflow_dispatch&per_page=50`));
  assert.ok(run.log.length > 0 && run.log.every((line) => line.endsWith('token=process-token')), 'issue — токеном процесса');
  assert.deepEqual(run.log.filter((line) => line.startsWith('gh issue comment')).map((line) => line.split(' ')[3]), ['1', '8']);
  assert.match(run.comment(1), new RegExp(`<!-- hp:night-red green=${sha.G} red=${sha.R} commits=${sha.c1.slice(0, 12)} -->$`));
  assert.match(run.comment(1), /Упали job: Смоки в браузере \(шард 3\/6\)\./);
  assert.equal(run.comment(2), '', 'закрытая задача не комментируется');
  assert.equal(run.comment(5), '', 'уже предупреждена в этой серии');
  assert.match(run.summary, /^### Красная ночь \(#736\)$/m);
  assert.match(run.summary, /- Отсеян зелёный https:\/\/github\.com\/o\/r\/actions\/runs\/104 .*: stale/);
  assert.match(run.summary, /- #2 \(коммитов A\/B: 1\): закрыта — комментарий не пишется\./);
  assert.match(run.summary, /- #5 \(коммитов A\/B: 1\): уже предупреждена в этой серии\./);
  assert.match(run.summary, new RegExp(`- Без задачи: \`${sha.c5.slice(0, 8)}\``));
});

test('#736 К6 на настоящем bash: сбой API или упавший скрипт — предупреждение и строка сводки, шаг зелёный, комментариев нет', async (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  const { cwd, sha } = history(t);
  const items = [validateRun({ id: 105, sha: sha.R, at: day(24), conclusion: 'failure' }), validateRun({ id: 102, sha: sha.G, at: day(20) })];
  const broken = await runNightStep(t, { cwd, items, fail: true, issues: { 1: { state: 'OPEN', comments: [] } } });
  assert.equal(broken.status, 0, broken.stderr);
  assert.match(broken.stdout, /^::warning::красная ночь \(#736\): GitHub API 500 .* — комментарии не написаны; цвет ночи — цвет Validate$/m);
  assert.match(broken.summary, /- Сбой: GitHub API 500/);
  assert.deepEqual(broken.log, []);
  const empty = mkdtempSync(join(tmpdir(), 'hp-736-noscripts-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  const crashed = await runNightStep(t, { cwd, items, scripts: empty });
  assert.equal(crashed.status, 0, crashed.stderr);
  assert.match(crashed.stdout, /^::warning::красная ночь \(#736\): скрипт упал — комментарии не написаны/m);
  assert.match(crashed.summary, /- Красная ночь \(#736\): скрипт упал/);
});

// #766: ссылка на прогон без `html_url` строится от сервера раннера
// (`GITHUB_SERVER_URL`), а не от зашитого https://github.com.
test('#766: сервер ссылок — GITHUB_SERVER_URL без хвостового /, по умолчанию github.com; html_url главнее', () => {
  assert.equal(githubServerUrl({}), 'https://github.com');
  assert.equal(githubServerUrl({ GITHUB_SERVER_URL: 'https://ghe.example.test/' }), 'https://ghe.example.test');
  const R = 'd'.repeat(40);
  const G = 'a'.repeat(40);
  const body = commentBody({
    repo: REPO, red: { id: 5, head_sha: R }, green: { id: 4, head_sha: G, html_url: 'https://api.example/runs/4' },
    commits: [{ sha: '1'.repeat(40), subject: 'one' }], server: 'https://ghe.example.test',
  });
  assert.ok(body.includes(`красный — https://ghe.example.test/${REPO}/actions/runs/5 `), body);
  assert.ok(body.includes('Последняя зелёная ночь — https://api.example/runs/4 '), 'ссылка API не переписывается');
  assert.doesNotMatch(body, /github\.com/);
});

test('#766 на настоящем bash: шаг ночи на нестандартном сервере — ссылки прогонов без html_url от GITHUB_SERVER_URL', async (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  const { cwd, sha } = history(t);
  const bare = ({ run: { html_url: _dropped, ...run }, context }) => ({ run, context });
  const items = [
    validateRun({ id: 105, sha: sha.R, at: day(24), conclusion: 'failure' }),
    validateRun({ id: 104, sha: sha.c2, at: day(22), full: false }),
    validateRun({ id: 102, sha: sha.G, at: day(20) }),
  ].map(bare);
  const run = await runNightStep(t, {
    cwd, items, env: { GITHUB_SERVER_URL: 'https://ghe.example.test/' },
    issues: { 1: { state: 'OPEN', comments: [] }, 2: { state: 'OPEN', comments: [] }, 5: { state: 'OPEN', comments: [] }, 8: { state: 'OPEN', comments: [] } },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.doesNotMatch(run.stdout, /::warning::/, run.stdout);
  const server = `https://ghe.example.test/${REPO}/actions/runs`;
  assert.ok(run.comment(1).includes(`красный — ${server}/105 `), run.comment(1));
  assert.ok(run.comment(1).includes(`Последняя зелёная ночь — ${server}/102 `), run.comment(1));
  assert.ok(run.summary.includes(`- Красный прогон: ${server}/105 `), run.summary);
  assert.ok(run.summary.includes(`- Отсеян зелёный ${server}/104 `), run.summary);
  assert.doesNotMatch(run.comment(1) + run.summary, /github\.com/);
});
