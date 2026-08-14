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
  checkIssueStatuses,
  checkReviewDocLimit,
  checkSpecs,
  classify,
  commitsNeedingIssueStatus,
  commitsUnderRuleOne,
  evaluateCommit,
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

test('more than four review documents on one issue exhausts the cycle limit', () => {
  assert.deepEqual(rules(checkReviewDocLimit([
    'CODE-REVIEW-104-r1.md', 'CODE-REVIEW-104-r2.md',
  ])), []);
  assert.deepEqual(rules(checkReviewDocLimit([
    'CODE-REVIEW-104-r1.md', 'CODE-REVIEW-104-r2.md',
    'CODE-REVIEW-104-r3.md', 'CODE-REVIEW-104-r4.md', 'CODE-REVIEW-104-r5.md',
  ])), [7]);
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

test('the log record parser survives multi-line commit bodies', () => {
  // Разбор по строкам ломался здесь: тело содержит пустые строки и абзацы.
  const raw = [
    `aaaaaaaaaaaa${FS}First subject${FS}Some prose.\n\nMore prose.\n\nIssue: #1\nUser-Visible: no\n${RS}`,
    `bbbbbbbbbbbb${FS}Second subject${FS}Issue: #2\nUser-Visible: yes\n${RS}`,
  ].join('');
  const list = parseRecords(raw, () => ['src/a.ts']);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((c) => c.issues), [['#1'], ['#2']]);
  assert.equal(list[0].subject, 'First subject');
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

    // --report печатает то же, но не краснеет.
    const report = spawnSync(process.execPath,
      [gate, '--repo', dir, '--range', `${base}..HEAD`, '--report'], { encoding: 'utf8' });
    assert.equal(report.status, 0, report.stdout + report.stderr);

    const asJson = spawnSync(process.execPath,
      [gate, '--repo', dir, '--range', `${base}..HEAD`, '--json'], { encoding: 'utf8' });
    const parsed = JSON.parse(asJson.stdout);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.commits, 2);

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
