import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_STATUS,
  STRICT_STATUS,
  buildReport,
  checkBranchRule,
  checkCommitEraStatuses,
  isPipelineReviewDocCommit,
  checkIssueStatuses,
  checkReviewDocLimit,
  REVIEW_DOC_LIMIT,
  checkSpecs,
  clampIssueBranchRange,
  classify,
  commitsNeedingIssueStatus,
  commitsNeedingTargetValidation,
  commitsUnderRuleOne,
  evaluateCommit,
  isInfrastructureRange,
  isReleaseVersionOnlyChange,
  makeCommit,
  parseRecords,
  FS,
  RS,
} from '../scripts/process-gate.mjs';

const commit = (subject, body, files) => makeCommit({ sha: 'deadbeefcafe', subject, body, files });
const rules = (findings) => findings.filter((f) => f.level === 'fail').map((f) => f.rule);

test('paths classify into A/B/C/D with the generated tree winning over source', () => {
  assert.equal(classify('src/houseplan-card.ts'), 'A');
  assert.equal(classify('custom_components/houseplan/api.py'), 'A');
  // Собранный бандл лежит внутри custom_components — класс D должен победить.
  assert.equal(classify('custom_components/houseplan/frontend/houseplan-card.js'), 'D');
  assert.equal(classify('demo/golden/baselines/view.png'), 'D');
  assert.equal(classify('dist/houseplan-card.js'), 'D');
  assert.equal(classify('test/canvas.test.mjs'), 'B');
  assert.equal(classify('.github/workflows/validate.yml'), 'B');
  assert.equal(classify('package-lock.json'), 'B');
  assert.equal(classify('docs/SCOPE.md'), 'C');
  assert.equal(classify('PROCESS.md'), 'C');
  assert.equal(classify('CODE-REVIEW-111-r1.md'), 'C');
  assert.equal(classify('something-unheard-of.xyz'), '?');
});

test('a clean class A commit produces no failures', () => {
  const c = commit('Fix empty plan render', 'Issue: #111\nUser-Visible: yes', [
    'src/houseplan-card.ts', 'docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md',
  ]);
  assert.deepEqual(rules(evaluateCommit(c)), []);
  assert.deepEqual(c.issues, ['#111']);
  assert.equal(c.isRelease, false);
});

test('class A/B without an Issue trailer fails rule 1', () => {
  assert.deepEqual(rules(evaluateCommit(commit('Fix thing', 'User-Visible: no', ['src/a.ts']))), [1]);
  assert.deepEqual(rules(evaluateCommit(commit('Tune CI', 'User-Visible: no', ['.github/workflows/x.yml']))), [1]);
  // Класс C живёт без issue — документация не требует задачи.
  assert.deepEqual(rules(evaluateCommit(commit('Reword docs', '', ['docs/README.md']))), []);
});

test('a malformed Issue trailer fails even when present', () => {
  assert.deepEqual(rules(evaluateCommit(commit('Fix', 'Issue: 111\nUser-Visible: no', ['src/a.ts']))), [1]);
});

test('several Issue trailers are all collected', () => {
  const c = commit('Fix three things', 'Issue: #75\nIssue: #95\nIssue: #98\nUser-Visible: no', ['src/a.ts']);
  assert.deepEqual(c.issues, ['#75', '#95', '#98']);
  assert.deepEqual(rules(evaluateCommit(c)), []);
});

test('User-Visible: yes demands both changelogs in the same commit', () => {
  assert.deepEqual(
    rules(evaluateCommit(commit('Fix', 'Issue: #1\nUser-Visible: yes', ['src/a.ts', 'docs/CHANGELOG.md']))),
    [4],
  );
  assert.deepEqual(
    rules(evaluateCommit(commit('Fix', 'Issue: #1\nUser-Visible: yes', [
      'src/a.ts', 'docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md',
    ]))),
    [],
  );
});

test('a class D only commit needs a release or a reviewed baseline', () => {
  const bare = commit('Rebuild bundle', 'Issue: #1', ['dist/houseplan-card.js']);
  assert.deepEqual(rules(evaluateCommit(bare)), [5]);
  const reviewed = commit('Accept baselines', 'Issue: #1\nBaseline-Reviewed: https://example/run/1', [
    'demo/golden/baselines/a.png',
  ]);
  assert.deepEqual(rules(evaluateCommit(reviewed)), []);
});

test('beta candidates are ordinary commits, stable releases are not', () => {
  // Решение 1: кандидат беты несёт работу, поэтому трейлер Issue обязателен.
  const beta = commit('Release v1.62.0-beta.8 candidate', '', ['src/a.ts']);
  assert.equal(beta.isRelease, false);
  assert.deepEqual(rules(evaluateCommit(beta)), [1]);

  const stable = commit('Release v1.62.0', 'Release: v1.62.0', ['dist/houseplan-card.js']);
  assert.equal(stable.isRelease, true);
  assert.deepEqual(rules(evaluateCommit(stable)), []);
});

test('a release commit carrying product source fails rule 6', () => {
  const bad = commit('Release v1.62.0', 'Release: v1.62.0', ['src/a.ts', 'dist/houseplan-card.js']);
  assert.deepEqual(rules(evaluateCommit(bad)), [6]);
});

test('a release commit allows only proven canonical version declarations', () => {
  const path = 'src/houseplan-card.ts';
  const before = "const CARD_VERSION = '1.69.0-beta.5';\nexport const value = 1;\n";
  const after = "const CARD_VERSION = '1.69.0';\nexport const value = 1;\n";
  assert.equal(isReleaseVersionOnlyChange(path, before, after), true);
  assert.equal(isReleaseVersionOnlyChange(
    path, before, "const CARD_VERSION = '1.69.0';\nexport const value = 2;\n",
  ), false);
  assert.equal(isReleaseVersionOnlyChange('src/another.ts', before, after), false);

  const stable = makeCommit({
    sha: 'deadbeefcafe',
    subject: 'Release v1.69.0',
    body: 'Release: v1.69.0',
    files: [path, 'src/houseplan-editor-runtime.ts', 'custom_components/houseplan/const.py'],
    releaseSourceViolations: [],
  });
  assert.deepEqual(rules(evaluateCommit(stable)), []);

  const mixed = makeCommit({
    sha: 'deadbeefcafe',
    subject: 'Release v1.69.0',
    body: 'Release: v1.69.0',
    files: [path, 'src/houseplan-editor-runtime.ts', 'custom_components/houseplan/const.py'],
    releaseSourceViolations: ['src/houseplan-card.ts'],
  });
  assert.deepEqual(rules(evaluateCommit(mixed)), [6]);
});

test('Gates: light is refused on release and generated commits', () => {
  assert.deepEqual(
    rules(evaluateCommit(commit('Release v1.62.0', 'Release: v1.62.0\nGates: light', ['dist/a.js']))),
    [9],
  );
  assert.deepEqual(
    rules(evaluateCommit(commit('Rebuild', 'Issue: #1\nBaseline-Reviewed: x\nGates: light', ['dist/a.js']))),
    [9],
  );
});

test('the branch name must agree with the Issue trailers', () => {
  const c = commit('Fix', 'Issue: #104', ['src/a.ts']);
  assert.deepEqual(rules(checkBranchRule('issue/104-opening-ha-reference', [c])), []);
  assert.deepEqual(rules(checkBranchRule('issue/111-empty-plan', [c])), [2]);
  // dev и main под правило не попадают.
  assert.deepEqual(checkBranchRule('dev', [c]), []);
});

test('a class A commit without a spec warns offline and fails with labels', () => {
  const c = commit('Fix', 'Issue: #104', ['src/a.ts']);
  assert.deepEqual(checkSpecs([c], ['104-opening-ha-reference.md']), []);

  // Офлайн отличить «ТЗ в теле issue» от «ТЗ нет» нельзя — только предупреждение.
  const offline = checkSpecs([c], ['111-something-else.md']);
  assert.equal(offline.length, 1);
  assert.equal(offline[0].level, 'warn');
  assert.equal(offline[0].rule, 3);

  // С метками: small и trivial оправдывают отсутствие файла, их отсутствие — нет.
  assert.deepEqual(checkSpecs([c], [], () => ['small', 'S5-ready']), []);
  assert.deepEqual(checkSpecs([c], [], () => ['trivial', 'S5-ready']), []);
  const strict = checkSpecs([c], [], () => ['S5-ready']);
  assert.equal(strict.length, 1);
  assert.equal(strict[0].level, 'fail');
  assert.equal(strict[0].rule, 3);

  // Метки недоступны — падать обратно на предупреждение: за недоступность
  // отвечает проверка 8, она уже краснеет fail closed.
  assert.equal(checkSpecs([c], [], () => null)[0].level, 'warn');
});

test('a rebase re-run may exceed the cycle limit in documents (#227)', () => {
  // Документ нумеруется по заходу, бюджет §4 — по блокирующим вердиктам.
  // Зелёное ревью с неудавшимся слиянием требует ещё одного захода после
  // ребейза, цикла при этом не образуя: порог документов обязан быть выше
  // лимита циклов, иначе гейт отказывает за то, что конвейер сам предписал.
  assert.equal(REVIEW_DOC_LIMIT, 6);
  const docs = (n) => Array.from({ length: n }, (_, i) => `CODE-REVIEW-225-r${i + 1}.md`);
  assert.deepEqual(rules(checkReviewDocLimit(docs(5))), []);
  assert.deepEqual(rules(checkReviewDocLimit(docs(6))), []);
  assert.deepEqual(rules(checkReviewDocLimit(docs(7))), [7]);
  // Дырка в нумерации тоже ловится: r7 в одиночку — это седьмой заход.
  assert.deepEqual(rules(checkReviewDocLimit(['CODE-REVIEW-225-r7.md'])), [7]);
});

test('the review document count is per issue and per stage', () => {
  // Считать надо по issue: документы разных задач не складываются, иначе
  // репозиторий с историей ревью упирался бы в порог сам по себе.
  assert.deepEqual(rules(checkReviewDocLimit([
    'CODE-REVIEW-104-r1.md', 'CODE-REVIEW-104-r2.md',
  ])), []);
  const manyIssues = Array.from({ length: 12 }, (_, i) => `CODE-REVIEW-${100 + i}-r1.md`);
  assert.deepEqual(rules(checkReviewDocLimit(manyIssues)), []);
  // А внутри одного issue порог действует.
  assert.deepEqual(rules(checkReviewDocLimit(
    Array.from({ length: 7 }, (_, i) => `CODE-REVIEW-104-r${i + 1}.md`),
  )), [7]);
  // Файл без номера захода проверку не роняет и не ломает разбор.
  assert.deepEqual(rules(checkReviewDocLimit(['CODE-REVIEW-issue-068-2026-08-12.md'])), []);
});

test('only class A/B commits are held to the issue status', () => {
  // Документ ревью ложится в ветку, пока задача в S4-spec-review или
  // S7-code-review: рабочего статуса в этот момент нет, и спрашивать его нельзя.
  const reviewDoc = commit('docs: review document for #104', 'Issue: #104\nUser-Visible: no', [
    'docs/reviews/CODE-REVIEW-104-r1.md',
  ]);
  const code = commit('Fix', 'Issue: #104\nUser-Visible: no', ['src/a.ts']);
  const release = commit('Release v1.62.0', 'Release: v1.62.0', ['dist/a.js']);

  assert.deepEqual(commitsUnderRuleOne([reviewDoc, code, release]).map((c) => c.subject), ['Fix']);
  assert.deepEqual(commitsUnderRuleOne([reviewDoc]), []);
});

test('stable promotion skips status recheck only for commits already published in a prerelease', () => {
  const published = makeCommit({
    sha: 'a'.repeat(40), subject: 'Fix shipped in beta', body: 'Issue: #123', files: ['src/a.ts'],
  });
  const postBeta = makeCommit({
    sha: 'b'.repeat(40), subject: 'New promotion work', body: 'Issue: #130', files: ['scripts/a.mjs'],
  });
  const publishedShas = new Set([published.sha]);
  assert.deepEqual(
    commitsNeedingIssueStatus([published, postBeta], {
      targetRef: 'refs/heads/main',
      isPublishedPrereleaseCommit: (sha) => publishedShas.has(sha),
    }).map((commit) => commit.sha),
    [postBeta.sha],
  );
  assert.deepEqual(
    rules(checkIssueStatuses(['130'], () => ({
      ok: true, json: { state: 'CLOSED', labels: [] },
    }))),
    [8],
  );
  assert.deepEqual(
    commitsNeedingIssueStatus([published, postBeta], {
      targetRef: 'refs/heads/dev',
      isPublishedPrereleaseCommit: (sha) => publishedShas.has(sha),
    }).map((commit) => commit.sha),
    [published.sha, postBeta.sha],
  );
});

test('dev reconciliation ignores published main commits but keeps new post-merge work', () => {
  const mainOnly = makeCommit({
    sha: 'a'.repeat(40), subject: 'Main-only workflow fix', body: 'Issue: #85',
    files: ['.github/workflows/mutation-gate.yml'],
  });
  const postMerge = makeCommit({
    sha: 'b'.repeat(40), subject: 'New gate fix', body: 'Issue: #155',
    files: ['scripts/process-gate.mjs'],
  });
  const commits = [mainOnly, postMerge];
  const isCommitOnMain = (sha) => sha === mainOnly.sha;

  const dev = commitsNeedingTargetValidation(commits, {
    targetRef: 'refs/heads/dev', isCommitOnMain,
  });
  assert.deepEqual(dev.map((commit) => commit.sha), [postMerge.sha]);

  const statusByIssue = (nn) => ({
    ok: true,
    json: nn === '85'
      ? { state: 'CLOSED', labels: [] }
      : { state: 'OPEN', labels: [{ name: 'S6-in-progress' }] },
  });
  assert.deepEqual(
    rules(checkIssueStatuses(
      dev.flatMap((candidate) => candidate.issues).map((issue) => issue.slice(1)),
      statusByIssue,
    )),
    [],
  );
  assert.deepEqual(rules(checkIssueStatuses(['85', '155'], statusByIssue)), [8]);

  // The exemption belongs only to a dev destination. Main promotion, issue
  // branches and an ordinary dev push with no main-reachable commits keep the
  // complete input set.
  for (const targetRef of ['refs/heads/main', 'refs/heads/issue/155-gate']) {
    assert.deepEqual(
      commitsNeedingTargetValidation(commits, { targetRef, isCommitOnMain }),
      commits,
    );
  }
  assert.deepEqual(
    commitsNeedingTargetValidation(commits, {
      targetRef: 'refs/heads/dev', isCommitOnMain: () => false,
    }),
    commits,
  );
});

test('issue status check is fail closed when the source of truth is unreachable', () => {
  // AC3: недоступный gh должен давать отказ, а не молчаливый пропуск.
  const broken = () => ({ ok: false, error: 'gh: could not resolve to a Repository' });
  const found = checkIssueStatuses(['104'], broken);
  assert.deepEqual(rules(found), [8]);
  assert.match(found[0].msg, /fail closed/);

  const garbage = () => ({ ok: true, json: 'not json at all' });
  assert.deepEqual(rules(checkIssueStatuses(['104'], garbage)), [8]);
});

test('issue status check accepts the working statuses and refuses the rest', () => {
  const withLabels = (labels, state = 'OPEN') => () => ({ ok: true, json: JSON.stringify({ state, labels }) });
  for (const status of ALLOWED_STATUS) {
    assert.deepEqual(rules(checkIssueStatuses(['1'], withLabels([{ name: status }]))), [], status);
  }
  assert.deepEqual(rules(checkIssueStatuses(['1'], withLabels([{ name: 'S2-analysis' }]))), [8]);
  assert.deepEqual(rules(checkIssueStatuses(['1'], withLabels([]))), [8]);
  assert.deepEqual(rules(checkIssueStatuses(['1'], withLabels([{ name: 'S5-ready' }], 'CLOSED'))), [8]);
  // blocked дополняет статус, а не заменяет — и всё равно останавливает работу.
  assert.deepEqual(
    rules(checkIssueStatuses(['1'], withLabels([{ name: 'S5-ready' }, { name: 'blocked' }]))),
    [8],
  );
  // --no-merged возвращает строгое множество: S8-merged перестаёт проходить.
  assert.deepEqual(
    rules(checkIssueStatuses(['1'], withLabels([{ name: 'S8-merged' }]), { allowed: STRICT_STATUS })),
    [8],
  );
});

test('#385(в) the diff proof runs only for release-classified commits, by the shared predicate', () => {
  const raw = [
    // обычный рабочий коммит — вычислитель не зовётся
    `aaaaaaaaaaaa${FS}fix: ordinary work${FS}2026-08-30T10:00:00+03:00${FS}Issue: #1\nUser-Visible: no\n${RS}`,
    // бета-приёмка с Release:-трейлером — ВТОРОЙ дизъюнкт предиката: релизный
    `bbbbbbbbbbbb${FS}test: accept golden${FS}2026-08-30T10:05:00+03:00${FS}Issue: #2\nUser-Visible: no\nRelease: v1.69.0-beta.5\n${RS}`,
    // стабильный релиз по subject — ПЕРВЫЙ дизъюнкт
    `cccccccccccc${FS}Release v1.69.0${FS}2026-08-30T10:10:00+03:00${FS}Baseline-Reviewed: yes\n${RS}`,
  ].join('');
  const calls = [];
  const spy = (sha) => { calls.push(sha); return []; };
  const list = parseRecords(raw, () => ['src/a.ts'], spy);
  assert.deepEqual(list.map((c) => c.isRelease), [false, true, true]);
  assert.deepEqual(calls, ['bbbbbbbbbbbb', 'cccccccccccc'],
    'exactly the release-classified commits pay for the diff proof — same predicate, no drift');
  assert.equal(list[0].releaseSourceViolations, null,
    'non-release commits keep the null "unproven" marker, as before');
  assert.deepEqual(list[1].releaseSourceViolations, [],
    'release-classified commits carry the computed proof');
});

test('the log record parser survives multi-line commit bodies', () => {
  // Разбор по строкам ломался здесь: тело содержит пустые строки и абзацы.
  // Формат несёт четыре поля (#311 добавил authorDate третьим).
  const raw = [
    `aaaaaaaaaaaa${FS}First subject${FS}2026-08-25T19:00:00+03:00${FS}Some prose.\n\nMore prose.\n\nIssue: #1\nUser-Visible: no\n${RS}`,
    `bbbbbbbbbbbb${FS}Second subject${FS}2026-08-25T20:00:00+03:00${FS}Issue: #2\nUser-Visible: yes\n${RS}`,
  ].join('');
  const list = parseRecords(raw, () => ['src/a.ts']);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((c) => c.issues), [['#1'], ['#2']]);
  assert.equal(list[0].subject, 'First subject');
  assert.equal(list[0].authorDate, '2026-08-25T19:00:00+03:00');
  assert.deepEqual(parseRecords('', () => []), []);
});

test('the JSON report keeps the shape later workflows read', () => {
  // AC5: форма объекта — часть контракта, её ломать нельзя молча.
  const findings = [
    { level: 'fail', rule: 1, sha: 'abc', msg: 'x' },
    { level: 'warn', rule: 0, sha: 'abc', msg: 'y' },
  ];
  const report = buildReport({ range: 'a..b', branch: 'dev', commits: 2, findings });
  assert.deepEqual(Object.keys(report).sort(),
    ['branch', 'commits', 'fails', 'findings', 'ok', 'range', 'warns']);
  assert.equal(report.ok, false);
  assert.equal(report.fails, 1);
  assert.equal(report.warns, 1);
  assert.equal(buildReport({ range: 'a..b', branch: 'dev', commits: 0, findings: [] }).ok, true);
});

// AC1: сквозной прогон CLI по настоящему репозиторию — заведомо чистый коммит
// даёт 0, заведомо битый даёт 1. Проверяет то, чего не видят юнит-тесты: разбор
// git log, обход файлов, код выхода.
test('the CLI exits 0 on a clean range and 1 on a broken one', (t) => {
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    t.skip('git недоступен');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'hp-gate-'));
  // fileURLToPath, а не URL.pathname: на Windows pathname даёт «/C:/…», и
  // spawnSync прочитал бы его как «C:\C:\…» (#133). Linux CI это не ловил —
  // оба варианта там совпадают.
  const gate = fileURLToPath(new URL('../scripts/process-gate.mjs', import.meta.url));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  const write = (rel, text) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  };
  const commitAll = (message) => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null',
      'commit', '-q', '-m', message);
  };
  const runGate = (range) => spawnSync(process.execPath, [gate, '--repo', dir, '--range', range], {
    encoding: 'utf8',
  });

  try {
    git('init', '-q', '-b', 'dev');
    write('README.md', 'base\n');
    commitAll('Base');
    const base = git('rev-parse', 'HEAD').trim();

    write('src/a.ts', 'export const a = 1;\n');
    write('docs/CHANGELOG.md', 'ru\n');
    write('docs/CHANGELOG.ru.md', 'en\n');
    commitAll('Add a\n\nIssue: #1\nUser-Visible: yes');
    const clean = runGate(`${base}..HEAD`);
    assert.equal(clean.status, 0, clean.stdout + clean.stderr);

    write('src/b.ts', 'export const b = 2;\n');
    commitAll('Add b without provenance');
    const broken = runGate(`${base}..HEAD`);
    assert.equal(broken.status, 1, broken.stdout + broken.stderr);
    assert.match(broken.stdout, /FAIL п\.1/);

    // Stable promotion меняет канонические строки версии внутри исходников,
    // но не несёт никакого другого продуктового diff.
    git('checkout', '-q', 'dev');
    git('reset', '-q', '--hard', base);
    write('src/houseplan-card.ts', "const CARD_VERSION = '1.69.0-beta.5';\nexport const a = 1;\n");
    write('src/houseplan-editor-runtime.ts', "const CARD_VERSION = '1.69.0-beta.5';\nexport const b = 1;\n");
    write('custom_components/houseplan/const.py', 'VERSION = "1.69.0-beta.5"\nVALUE = 1\n');
    commitAll('Prerelease tree\n\nIssue: #1\nUser-Visible: no');
    const prerelease = git('rev-parse', 'HEAD').trim();
    write('src/houseplan-card.ts', "const CARD_VERSION = '1.69.0';\nexport const a = 1;\n");
    write('src/houseplan-editor-runtime.ts', "const CARD_VERSION = '1.69.0';\nexport const b = 1;\n");
    write('custom_components/houseplan/const.py', 'VERSION = "1.69.0"\nVALUE = 1\n');
    commitAll('Release v1.69.0\n\nRelease: v1.69.0\nUser-Visible: yes');
    const stable = runGate(`${prerelease}..HEAD`);
    assert.equal(stable.status, 0, stable.stdout + stable.stderr);

    write('src/houseplan-card.ts', "const CARD_VERSION = '1.69.1';\nexport const a = 2;\n");
    commitAll('Release v1.69.1\n\nRelease: v1.69.1\nUser-Visible: yes');
    const polluted = runGate('HEAD^..HEAD');
    assert.equal(polluted.status, 1, polluted.stdout + polluted.stderr);
    assert.match(polluted.stdout, /FAIL п\.6/);

    // --report печатает то же, но не краснеет.
    const report = spawnSync(process.execPath,
      [gate, '--repo', dir, '--range', `${base}..HEAD`, '--report'], { encoding: 'utf8' });
    assert.equal(report.status, 0, report.stdout + report.stderr);

    const asJson = spawnSync(process.execPath,
      [gate, '--repo', dir, '--range', `${base}..HEAD`, '--json'], { encoding: 'utf8' });
    const parsed = JSON.parse(asJson.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.commits, 3);

    // Проверка 2 судит только коммиты самой ветки. Диапазон из события CI шире:
    // после ребейза merge-base уезжает назад и втягивает коммиты dev с чужими
    // номерами issue. На реальной истории это давало 26 ложных отказов из 26.
    git('checkout', '-q', 'dev');
    git('reset', '-q', '--hard', base);
    write('src/on-dev.ts', 'export const d = 1;\n');
    write('docs/CHANGELOG.md', 'ru\n');
    write('docs/CHANGELOG.ru.md', 'en\n');
    commitAll('Land on dev\n\nIssue: #1\nUser-Visible: yes');
    const devTip = git('rev-parse', 'HEAD').trim();
    git('update-ref', 'refs/remotes/origin/dev', devTip);

    git('checkout', '-q', '-b', 'issue/2-own-work');
    write('src/on-branch.ts', 'export const b = 1;\n');
    commitAll('Work on the task branch\n\nIssue: #2\nUser-Visible: no');

    // Диапазон намеренно захватывает коммит dev про #1, пока HEAD на ветке #2.
    const spanning = spawnSync(process.execPath,
      [gate, '--repo', dir, '--range', `${base}..HEAD`, '--json'], { encoding: 'utf8' });
    const spanned = JSON.parse(spanning.stdout);
    assert.equal(spanned.commits, 2);
    assert.deepEqual(spanned.findings.filter((f) => f.rule === 2), [], spanning.stdout);
    assert.equal(spanned.ok, true, spanning.stdout);

    // А своё же нарушение ветка по-прежнему получает.
    write('src/wrong-issue.ts', 'export const w = 1;\n');
    commitAll('Wrong trailer for this branch\n\nIssue: #3\nUser-Visible: no');
    const wrong = spawnSync(process.execPath,
      [gate, '--repo', dir, '--range', `${devTip}..HEAD`, '--json'], { encoding: 'utf8' });
    const wrongReport = JSON.parse(wrong.stdout);
    assert.equal(wrongReport.findings.some((f) => f.rule === 2), true, wrong.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an issue-branch range is clamped to its own commits only when the base is stale', () => {
  // #190: после обязательного ребейза remote_old..local_new втягивает историю
  // dev. Сужение включается только для issue-веток и только когда база
  // перестала быть предком вершины — fast-forward остаётся точным.
  const deps = (ancestor, mb = 'MB') => ({
    targetRef: 'refs/heads/issue/117-registryless-opening',
    isAncestor: () => ancestor,
    mergeBaseWithDev: () => mb,
  });
  assert.equal(clampIssueBranchRange('OLD..NEW', deps(false)), 'MB..NEW');
  assert.equal(clampIssueBranchRange('OLD..NEW', deps(true)), 'OLD..NEW');
  // Не issue-ветка — не трогаем: dev и main живут по своим правилам.
  assert.equal(
    clampIssueBranchRange('OLD..NEW', { ...deps(false), targetRef: 'refs/heads/dev' }),
    'OLD..NEW',
  );
  // Без origin/dev сужать не во что — fail closed остаётся за широким диапазоном.
  assert.equal(clampIssueBranchRange('OLD..NEW', deps(false, null)), 'OLD..NEW');
  // Тройная точка и не-диапазон проходят насквозь.
  assert.equal(clampIssueBranchRange('OLD...NEW', deps(false)), 'OLD...NEW');
  assert.equal(clampIssueBranchRange('HEAD', deps(false)), 'HEAD');
});

// AC #190: опубликованная issue-ветка от старого dev -> dev ушёл вперёд ->
// обязательный rebase -> push старым диапазоном remote_old..local_new. Гейт
// обязан судить только собственные коммиты ветки, но реальное нарушение в
// post-rebase коммите — по-прежнему ловить.
test('the CLI judges a rebased issue branch by its own commits (#190)', (t) => {
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    t.skip('git недоступен');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'hp-gate-190-'));
  const gate = fileURLToPath(new URL('../scripts/process-gate.mjs', import.meta.url));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  const write = (rel, text) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  };
  const commitAll = (message) => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null',
      'commit', '-q', '-m', message);
  };
  const runGate = (range, targetRef) => spawnSync(process.execPath,
    [gate, '--repo', dir, '--range', range, '--target-ref', targetRef, '--json'],
    { encoding: 'utf8' });
  const targetRef = 'refs/heads/issue/7-own-work';

  try {
    git('init', '-q', '-b', 'dev');
    write('README.md', 'base\n');
    commitAll('Base');

    // Опубликованная issue-ветка от старого dev.
    git('checkout', '-q', '-b', 'issue/7-own-work');
    write('scripts/w.mjs', 'export const w = 1;\n');
    commitAll('Own work\n\nIssue: #7\nUser-Visible: no');
    const publishedTip = git('rev-parse', 'HEAD').trim();

    // dev ушёл вперёд коммитом с чужим номером issue — под старым диапазоном
    // он выглядел бы нарушением проверки 2.
    git('checkout', '-q', 'dev');
    write('src/d.ts', 'export const d = 1;\n');
    write('docs/CHANGELOG.md', 'ru\n');
    write('docs/CHANGELOG.ru.md', 'en\n');
    commitAll('Land on dev\n\nIssue: #1\nUser-Visible: yes');
    git('update-ref', 'refs/remotes/origin/dev', git('rev-parse', 'HEAD').trim());

    // Обязательный rebase issue-ветки (сценарий возврата из конфликтного слияния).
    git('checkout', '-q', 'issue/7-own-work');
    git('-c', 'user.name=t', '-c', 'user.email=t@t',
      'rebase', '-q', 'refs/remotes/origin/dev');

    // Диапазон ровно тот, что строит pre-push: старая вершина..новая.
    const clamped = JSON.parse(runGate(`${publishedTip}..HEAD`, targetRef).stdout);
    assert.equal(clamped.commits, 1, JSON.stringify(clamped));
    assert.equal(clamped.ok, true, JSON.stringify(clamped.findings));

    // Реальное нарушение в post-rebase коммите по-прежнему блокируется.
    write('scripts/broken.mjs', 'export const b = 1;\n');
    commitAll('Broken work without provenance');
    const held = runGate(`${publishedTip}..HEAD`, targetRef);
    const report = JSON.parse(held.stdout);
    assert.equal(held.status, 1, held.stdout + held.stderr);
    assert.equal(report.commits, 2);
    assert.equal(report.findings.some((f) => f.rule === 1), true, held.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the CLI falls back to origin/dev when BEFORE_SHA is orphaned by a force-push (#315)', (t) => {
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    t.skip('git недоступен');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'hp-gate-315-'));
  const gate = fileURLToPath(new URL('../scripts/process-gate.mjs', import.meta.url));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  const write = (rel, text) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  };
  const commitAll = (message) => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null',
      'commit', '-q', '-m', message);
  };

  try {
    git('init', '-q', '-b', 'dev');
    write('README.md', 'base\n');
    commitAll('Base');
    git('update-ref', 'refs/remotes/origin/dev', git('rev-parse', 'HEAD').trim());

    git('checkout', '-q', '-b', 'issue/7-own-work');
    write('scripts/w.mjs', 'export const w = 1;\n');
    commitAll('Own work\n\nIssue: #7\nUser-Visible: no');

    // Push-событие после force-push: BEFORE_SHA указывает на переписанную
    // вершину, которой в клоне больше нет. Раньше первый же cat-file убивал
    // процесс кодом 2; теперь диапазон берётся от merge-base с origin/dev.
    const r = spawnSync(process.execPath, [gate, '--repo', dir, '--github-range', '--json'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        EVENT_NAME: 'push',
        BEFORE_SHA: 'f'.repeat(40),
        BASE_SHA: '',
        HEAD_SHA: git('rev-parse', 'HEAD').trim(),
        DEVELOPMENT_BRANCH: 'dev',
        TARGET_REF: 'refs/heads/issue/7-own-work',
      },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const report = JSON.parse(r.stdout);
    assert.equal(report.commits, 1, JSON.stringify(report));
    assert.equal(report.ok, true, JSON.stringify(report.findings));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an infrastructure range is recognised by the absence of class A files (#207)', () => {
  const infra = makeCommit({
    sha: 'a'.repeat(40), subject: 'Tune CI', body: 'Issue: #206\nUser-Visible: no',
    files: ['.github/workflows/validate.yml'],
  });
  const docs = makeCommit({
    sha: 'b'.repeat(40), subject: 'Reword', body: '', files: ['docs/PROCESS.md'],
  });
  const product = makeCommit({
    sha: 'c'.repeat(40), subject: 'Fix render', body: 'Issue: #150\nUser-Visible: yes',
    files: ['src/a.ts', 'docs/CHANGELOG.md', 'docs/CHANGELOG.ru.md'],
  });

  assert.equal(isInfrastructureRange([infra]), true);
  assert.equal(isInfrastructureRange([infra, docs]), true);
  // Один файл класса A лишает диапазон исключения целиком: «в основном
  // инфраструктурная» не бывает, иначе продуктовая правка минует проверку.
  assert.equal(isInfrastructureRange([infra, product]), false);
  assert.equal(isInfrastructureRange([product]), false);
  // Пустой диапазон исключением не пользуется — нечему быть инфраструктурным.
  assert.equal(isInfrastructureRange([]), false);
});

test('statusOptional waives the status label but keeps every other rule-8 refusal (#207)', () => {
  // Метки инфраструктурного issue по #118: тип, приоритет, тема — без S*.
  const infraIssue = () => ({
    ok: true, json: JSON.stringify({ state: 'OPEN', labels: [
      { name: 'bug' }, { name: 'P2' }, { name: 'infra' },
    ] }),
  });
  assert.deepEqual(rules(checkIssueStatuses(['206'], infraIssue)), [8]);
  assert.deepEqual(
    rules(checkIssueStatuses(['206'], infraIssue, { statusOptional: true })), [],
  );

  // Исключение снимает ТОЛЬКО требование статуса.
  const closed = () => ({ ok: true, json: JSON.stringify({ state: 'CLOSED', labels: [{ name: 'infra' }] }) });
  assert.deepEqual(rules(checkIssueStatuses(['206'], closed, { statusOptional: true })), [8]);

  const blocked = () => ({ ok: true, json: JSON.stringify({ state: 'OPEN', labels: [
    { name: 'infra' }, { name: 'blocked' },
  ] }) });
  assert.deepEqual(rules(checkIssueStatuses(['206'], blocked, { statusOptional: true })), [8]);

  const unreachable = () => ({ ok: false, error: 'gh: could not resolve to a Repository' });
  const found = checkIssueStatuses(['206'], unreachable, { statusOptional: true });
  assert.deepEqual(rules(found), [8]);
  assert.match(found[0].msg, /fail closed/);

  const garbage = () => ({ ok: true, json: 'not json at all' });
  assert.deepEqual(rules(checkIssueStatuses(['206'], garbage, { statusOptional: true })), [8]);
});

// AC #207: сквозной прогон CLI по настоящему репозиторию с подставным gh.
// Диапазон без класса A и с issue без статусной метки обязан быть зелёным;
// тот же диапазон плюс один файл `src/**` — красным по проверке 8.
test('the CLI waives the issue status for a class-B-only range but not with class A (#207)', (t) => {
  if (process.platform === 'win32') {
    t.skip('нужен исполняемый stub gh — прогон в Linux CI');
    return;
  }
  const probe = spawnSync('git', ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0) {
    t.skip('git недоступен');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'hp-gate-207-'));
  const gate = fileURLToPath(new URL('../scripts/process-gate.mjs', import.meta.url));
  const git = (...args) => {
    const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  const write = (rel, text) => {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, text);
  };
  const commitAll = (message) => {
    git('add', '-A');
    git('-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null',
      'commit', '-q', '-m', message);
  };
  // Подставной gh: инфраструктурный issue по #118 — тип, приоритет, тема, без S*.
  const ghStub = join(dir, 'gh-stub.mjs');
  writeFileSync(ghStub, '#!/usr/bin/env node\n'
    + 'process.stdout.write(JSON.stringify({ number: 206, state: "OPEN", labels: '
    + '[{ name: "bug" }, { name: "P2" }, { name: "infra" }] }));\n', { mode: 0o755 });
  const runGate = (range) => spawnSync(process.execPath,
    [gate, '--repo', dir, '--range', range, '--issues'],
    { encoding: 'utf8', env: { ...process.env, GH_BIN: ghStub } });

  try {
    git('init', '-q', '-b', 'dev');
    write('README.md', 'base\n');
    commitAll('Base');
    const base = git('rev-parse', 'HEAD').trim();

    write('.github/workflows/validate.yml', 'name: Validate\n');
    commitAll('Tune CI\n\nIssue: #206\nUser-Visible: no');
    const infraOnly = runGate(`${base}..HEAD`);
    assert.equal(infraOnly.status, 0, infraOnly.stdout + infraOnly.stderr);
    // Пропуск виден в выводе, а не молчалив.
    assert.match(infraOnly.stdout, /инфраструктурный диапазон/);

    // Один продуктовый файл — и требование статуса возвращается.
    write('src/a.ts', 'export const a = 1;\n');
    write('docs/CHANGELOG.md', 'ru\n');
    write('docs/CHANGELOG.ru.md', 'en\n');
    commitAll('Fix render\n\nIssue: #206\nUser-Visible: yes');
    const withProduct = runGate(`${base}..HEAD`);
    assert.equal(withProduct.status, 1, withProduct.stdout + withProduct.stderr);
    assert.match(withProduct.stdout, /FAIL п\.8/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('rule 2 exempts a pipeline review document proven by subject and diff (#305)', () => {
  const doc = makeCommit({
    sha: 'a'.repeat(40),
    subject: 'docs: review document for #304',
    body: 'Issue: #304\nUser-Visible: no',
    files: ['docs/reviews/CODE-REVIEW-304-r1.md'],
  });
  assert.equal(isPipelineReviewDocCommit(doc), true);
  assert.deepEqual(checkBranchRule('issue/302-junction-node-material', [doc]), []);

  // Any code beside the document voids the proof — rule 2 fires again.
  const forged = makeCommit({
    sha: 'b'.repeat(40),
    subject: 'docs: review document for #304',
    body: 'Issue: #304',
    files: ['docs/reviews/CODE-REVIEW-304-r1.md', 'src/houseplan-card.ts'],
  });
  assert.equal(isPipelineReviewDocCommit(forged), false);
  assert.equal(checkBranchRule('issue/302-junction-node-material', [forged]).length, 1);

  // Fail-closed: without a file list the exemption cannot prove itself.
  const blind = makeCommit({
    sha: 'c'.repeat(40),
    subject: 'docs: review document for #304',
    body: 'Issue: #304',
    files: [],
  });
  assert.equal(isPipelineReviewDocCommit(blind), false);
  assert.equal(checkBranchRule('issue/302-junction-node-material', [blind]).length, 1);
});

test('rule 10 pins DoR to the commit author date, not to the current label (#311)', () => {
  const codeAt = (iso) => makeCommit({
    sha: 'e'.repeat(40), subject: 'feat: work (#266)',
    body: 'Issue: #266\nUser-Visible: no',
    files: ['src/houseplan-card.ts'], authorDate: iso,
  });
  const timeline = (events) => () => ({ ok: true, events });
  const ready = [{ label: 'S5-ready', at: '2026-08-25T20:00:00Z' }];

  // Written BEFORE the issue ever reached S5-ready — the violation stays
  // visible no matter how far the label has advanced since.
  const early = checkCommitEraStatuses([codeAt('2026-08-25T19:00:00Z')], timeline(ready));
  assert.equal(early.length, 1);
  assert.equal(early[0].level, 'fail');
  assert.equal(early[0].rule, 10);

  // Written after readiness — clean.
  assert.deepEqual(
    checkCommitEraStatuses([codeAt('2026-08-25T21:00:00Z')], timeline(ready)), []);

  // Secondary check degrades to a warn without timeline data; rule 8 stays
  // the fail-closed primary.
  const blind = checkCommitEraStatuses([codeAt('2026-08-25T19:00:00Z')], () => ({ ok: false }));
  assert.equal(blind.length, 1);
  assert.equal(blind[0].level, 'warn');
  const empty = checkCommitEraStatuses([codeAt('2026-08-25T19:00:00Z')], timeline([]));
  assert.equal(empty.length, 1);
  assert.equal(empty[0].level, 'warn');

  // Non-code commits (spec/docs before S5) are legitimate and out of scope.
  const doc = makeCommit({
    sha: 'f'.repeat(40), subject: 'docs: spec for #266',
    body: 'Issue: #266', files: ['docs/specs/266-x.md'], authorDate: '2026-08-25T19:00:00Z',
  });
  assert.deepEqual(checkCommitEraStatuses([doc], timeline(ready)), []);
});
