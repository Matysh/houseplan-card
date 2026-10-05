// #696, PROCESS.md §11.7: задачи track:ship сливаются без ревью модели; их код
// читает пакетное ревью ночью и по дельте перед бетой; гейт беты требует покрытие.
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SHIP_MERGE_MARKER_RE, anchorBlock, commitPatchIds, countsForPatchSet, formatPatches, highCommentBody, highCommentTargets,
  isShipIssue, issuePatchSets, nightlyDocPath, parseAnchorBlock, parsePatches, planShipReview, renderShipBrief, reviewSubject,
  shipCoverage, shipDocPath, shipIssuesInRange, shipReviewDocPath, shipReviewMode, shipReviewProblems, shipRiskFrom, specSection,
} from '../scripts/ship-review.mjs';
import { parseDocName, renderIndex } from '../scripts/reviews-index.mjs';
import { archivePlan } from '../scripts/reviews-archive.mjs';

const sha = (c) => c.repeat(40);
const MARKER = `<!-- hp:ship-merge material=${sha('a')} -->`;

test('#696 документ — по тегу беты или стабильному, имя фиксировано', () => {
  assert.equal(shipReviewDocPath('v1.79.0-beta.1'), 'docs/reviews/SHIP-REVIEW-v1.79.0-beta.1.md');
  assert.equal(shipReviewDocPath('v1.79.0'), 'docs/reviews/SHIP-REVIEW-v1.79.0.md');
  for (const bad of ['1.79.0', 'v1.79', 'v1.79.0-rc.1', '', 'v1.79.0/../x']) {
    assert.throws(() => shipReviewDocPath(bad), /not a release tag/, bad);
  }
});

test('#696 ship-задача — по маркеру конвейера или метке track:ship', () => {
  assert.equal(isShipIssue({ labels: [], comments: [{ body: `Слияние без ревью модели\n\n${MARKER}` }] }), true);
  assert.equal(isShipIssue({ labels: [{ name: 'track:ship' }], comments: [] }), true);
  assert.equal(isShipIssue({ labels: ['track:show'], comments: [{ body: 'hp:ship-merge без маркера' }] }), false);
  assert.equal(isShipIssue({}), false);
});

test('#696 состав — трейлеры диапазона; show и ask в пакет не входят', () => {
  const commits = [
    { sha: sha('c'), message: 'fix: text\n\nIssue: #701\nUser-Visible: yes' },
    { sha: sha('b'), message: 'feat: y\n\nIssue: #702\nUser-Visible: yes' },
    { sha: sha('a'), message: 'fix: css\n\nIssue: #701\nUser-Visible: yes' },
    { sha: sha('d'), message: 'chore: упоминание #703 — не трейлер' },
  ];
  const data = {
    701: { title: 'Опечатка', body: 'Отчёт\n\n## ТЗ\n\nЗаменить «Сохранть» на «Сохранить»; видно в диалоге.\n\n## Прочее\nх', labels: [], comments: [{ body: MARKER }] },
    702: { title: 'Фича', body: '', labels: [{ name: 'track:show' }], comments: [] },
  };
  const ship = shipIssuesInRange({ commits, issueData: (n) => data[n] ?? null });
  assert.deepEqual(ship.map((i) => i.number), [701]);
  assert.deepEqual(ship[0].commits.map((c) => c.sha), [sha('a'), sha('c')], 'коммиты по порядку истории');
  assert.equal(ship[0].spec, '## ТЗ\n\nЗаменить «Сохранть» на «Сохранить»; видно в диалоге.');
  const brief = renderShipBrief({ tag: 'v1.79.0-beta.1', candidate: sha('e'), base: { tag: 'v1.78.0', sha: sha('f') }, ship });
  assert.match(brief, /### #701 · Опечатка/);
  assert.match(brief, /SHIP-REVIEW-v1\.79\.0-beta\.1\.md/);
  assert.match(brief, new RegExp(sha('a')));
  assert.equal(specSection('без раздела'), '');
});

test('#696 гейт: без ship-задач документ не нужен, без документа — отказ с командой', () => {
  assert.deepEqual(shipReviewProblems({ tag: 'v1.79.0-beta.1', ship: [], docText: null }), []);
  const [problem] = shipReviewProblems({ tag: 'v1.79.0-beta.1', ship: [{ number: 701 }], docText: null });
  assert.match(problem, /#701/);
  assert.match(problem, /gh workflow run ship-review\.yml --ref dev -f tag=v1\.79\.0-beta\.1/);
});

test('#696 гейт: машинный блок покрывает все задачи и не несёт High', () => {
  const tag = 'v1.79.0-beta.1';
  const doc = (fields) => `# Ревью\nИтог: …\n\n${anchorBlock({ tag, candidate: sha('e'), issues: [701, 704], ...fields })}`;
  assert.deepEqual(parseAnchorBlock(doc({ high: 0, medium: 1, low: 2 })), {
    tag, candidate: sha('e'), issues: [701, 704], high: 0, medium: 1, low: 2,
  });
  assert.deepEqual(shipReviewProblems({ tag, ship: [{ number: 701 }, { number: 704 }], docText: doc({ high: 0 }) }), []);
  const partial = shipReviewProblems({ tag, ship: [{ number: 701 }, { number: 709 }], docText: doc({ high: 0 }) });
  assert.equal(partial.length, 1);
  assert.match(partial[0], /не покрывает ship-задачи #709/);
  const high = shipReviewProblems({ tag, ship: [{ number: 701 }], docText: doc({ high: 2 }) });
  assert.equal(high.length, 1);
  assert.match(high[0], /High 2/);
  assert.match(shipReviewProblems({ tag, ship: [{ number: 701 }], docText: '# без блока' })[0], /без машинного блока/);
  assert.match(shipReviewProblems({ tag: 'v1.79.0-beta.2', ship: [{ number: 701 }], docText: doc({ high: 0 }) })[0], /для тега v1\.79\.0-beta\.1/);
});

test('#696 индекс и архив знают SHIP-REVIEW: бета в индексе, архив — каталог стабильной линии', () => {
  assert.deepEqual(parseDocName('SHIP-REVIEW-v1.79.0-beta.1.md'), { stage: 'ship', issue: null, round: null, suffix: null, tag: 'v1.79.0-beta.1' });
  const md = renderIndex({ entries: [
    { name: 'SHIP-REVIEW-v1.79.0-beta.1.md', stage: 'ship', issue: null, tag: 'v1.79.0-beta.1', verdict: '—', high: 0, medium: 1, findings: [], files: [] },
    { name: 'SHIP-REVIEW-v1.79.0-beta.2.md', stage: 'ship', issue: null, tag: 'v1.79.0-beta.2', verdict: '—', high: 0, medium: 0, findings: [], files: [] },
    { name: 'RELEASE-REVIEW-v1.79.0.md', stage: 'release', issue: null, tag: 'v1.79.0', verdict: '—', high: 1, medium: 0, findings: [], files: [] },
  ] });
  const rows = md.split('\n').filter((line) => line.startsWith('| бета') || line.startsWith('| линия'));
  assert.deepEqual(rows.map((r) => r.split('|')[1].trim()), ['линия v1.79.0', 'бета v1.79.0-beta.2', 'бета v1.79.0-beta.1']);
  assert.match(rows[1], /пакетное ревью ship · —/);
  const plan = archivePlan({
    names: ['SHIP-REVIEW-v1.79.0-beta.1.md', 'SHIP-REVIEW-v1.80.0-beta.1.md'],
    lines: [{ tag: 'v1.79.0', issues: [] }], open: [], through: 'v1.79.0',
  });
  assert.deepEqual(plan.moves.map((m) => m.to), ['legacy/reviews/v1.79.0/SHIP-REVIEW-v1.79.0-beta.1.md']);
  assert.ok(plan.kept.some((k) => k.name === 'SHIP-REVIEW-v1.80.0-beta.1.md'));
});

test('#696 _ship-review.yml: модель без права записи, документ с машинным блоком в dev', () => {
  // #716: тело из dev; тонкий `ship-review.yml` в main — кнопка и потолок прав.
  const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/_ship-review.yml', import.meta.url)), 'utf8');
  const model = workflow.slice(workflow.indexOf('\n  model_review:'), workflow.indexOf('\n  publish:'));
  assert.match(model, /permissions:\n\s+contents: read\n\s+steps:/, 'модель только читает');
  assert.match(model, /github_token: \$\{\{ secrets\.GITHUB_TOKEN \}\}/, 'без обмена OIDC на App-токен (#556)');
  const publish = workflow.slice(workflow.indexOf('\n  publish:'));
  assert.match(publish, /m\.anchorBlock\(/, 'машинный блок пишет публикация, не модель');
  assert.match(publish, /reviews-index\.mjs --dir=docs\/reviews --strict/);
  assert.match(workflow, /if: needs\.prepare\.outputs\.proceed == 'true'/);
  assert.match(workflow, /ship-задач в диапазоне нет — ревью не нужно/);
});

test('#696 оба пути публикации беты проверяют пакетное ревью ship до выпуска', () => {
  const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/publish-prerelease.yml', import.meta.url)), 'utf8');
  const gate = workflow.slice(workflow.indexOf('\n  gate:'), workflow.indexOf('\n  publish:'));
  assert.match(gate, /node scripts\/ship-review\.mjs check --tag="\$TAG" --candidate="\$SHA"/, 'гейт CI-публикации');
  const local = readFileSync(fileURLToPath(new URL('../scripts/release-prerelease.mjs', import.meta.url)), 'utf8');
  const main = local.slice(local.indexOf('const main = async'));
  const check = main.indexOf("'scripts/ship-review.mjs', 'check'");
  assert.ok(check > 0, 'локальная публикация зовёт тот же гейт');
  assert.ok(check < main.indexOf('if (checkOnly) return;'), 'и в режиме --check тоже');
});

test('#707 AC12: бриф ship печатает строку риска из комментария hp:ship-merge, если она есть', async () => {
  const { classifyRisk, shipRiskText } = await import('../scripts/process-track.mjs');
  const risk = classifyRisk("diff --git a/src/pointer-modality.ts b/src/pointer-modality.ts\n--- a/src/pointer-modality.ts\n+++ b/src/pointer-modality.ts\n@@ -2,0 +3 @@\n+  if (e.pointerType === 'touch') return;\n");
  const line = shipRiskText({ risk, confirmed: true });
  const merge = `**Слияние без ревью модели: трек ship.** …\n\n${line}\n\n${MARKER}\n`;
  assert.equal(SHIP_MERGE_MARKER_RE.exec(merge)?.[1], sha('a'), 'маркер слияния находится и с новой строкой');
  assert.deepEqual(shipRiskFrom([{ body: 'обсуждение' }, { body: merge }]), { classes: ['touch'], line: line.split('\n')[0] });
  assert.equal(shipRiskFrom([{ body: `Слияние без ревью модели\n\n${MARKER}` }]), null, 'комментарий до #707 — риск не записан');
  assert.equal(shipRiskFrom([{ body: '<!-- hp:ship-risk classes=touch -->' }]), null, 'строка риска вне комментария слияния не считается');
  const commits = [{ sha: sha('c'), message: 'fix: x\n\nIssue: #701\nUser-Visible: no' }, { sha: sha('d'), message: 'fix: y\n\nIssue: #702\nUser-Visible: no' }];
  const data = {
    701: { title: 'С риском', body: '## ТЗ\n\nстрока', labels: [], comments: [{ body: merge }] },
    702: { title: 'Без риска', body: '## ТЗ\n\nстрока', labels: [], comments: [{ body: MARKER }] },
  };
  const ship = shipIssuesInRange({ commits, issueData: (n) => data[n] });
  const brief = renderShipBrief({ tag: 'v1.80.0-beta.1', candidate: sha('e'), base: null, ship });
  const section = (n) => brief.split('\n### ').find((part) => part.startsWith(`#${n} `)) ?? '';
  assert.match(section(701), /Риск по участкам \(трек подтверждён владельцем, не повышен\): touch: src\/pointer-modality\.ts:3 · участок pointer-modality, токен pointerType/);
  assert.doesNotMatch(section(702), /Риск по участкам/);
  assert.equal(ship.find((i) => i.number === 702).risk, undefined);
});

// ---------- #727: ночное пакетное ревью ship и переиспользование по патч-набору ----------

const PID = (c) => c.repeat(40);
const NIGHT = (sha12 = '108427dc1234', base = 'v1.79.0-beta.1') => `SHIP-REVIEW-${base}-dev-${sha12}.md`;
const shipDoc = (name, fields) => ({
  name,
  text: `# Ночное ревью\nИтог: …\n\n${anchorBlock({ tag: 'nightly', candidate: sha('e'), base: 'v1.79.0-beta.1', mode: 'nightly', ...fields })}`,
});

/** Временный git-репозиторий без конфига и хуков пользователя (#496, #633). */
function tempRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-727-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  };
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8', env });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git('init', '-q', '-b', 'dev');
  git('config', 'core.hooksPath', '/dev/null');
  const commit = (files, message) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    git('add', '-A');
    git('commit', '-q', '-m', message);
    return { sha: git('rev-parse', 'HEAD'), message: `${message}\n` };
  };
  return { dir, git, commit };
}

test('#727 AC1 К1: патч-набор — patch-id коммитов задачи; Release: и только docs/reviews/** не входят; cherry-pick тот же', (t) => {
  const repo = tempRepo(t);
  repo.commit({ 'src/a.txt': 'a\n', 'src/b.txt': 'b\n', 'src/c.txt': 'c\n' }, 'base');
  const base = repo.git('rev-parse', 'HEAD');
  const one = repo.commit({ 'src/a.txt': 'a\nA\n' }, 'fix: a\n\nIssue: #701\nUser-Visible: no');
  const two = repo.commit({ 'src/b.txt': 'b\nB\n' }, 'fix: b\n\nIssue: #701\nUser-Visible: no');
  const release = repo.commit({ 'src/c.txt': 'c\nversion\n' }, 'Release v1.80.0-beta.1 candidate\n\nIssue: #701\nIssue: #702\nUser-Visible: yes\nRelease: v1.80.0-beta.1');
  const docsOnly = repo.commit({ 'docs/reviews/CODE-REVIEW-701-r1.md': '# r1\n', 'docs/reviews/INDEX.md': 'x\n' }, 'docs: review document for #701\n\nIssue: #701\nUser-Visible: no');
  const mixed = repo.commit({ 'docs/reviews/INDEX.md': 'y\n', 'src/c.txt': 'c\nversion\nC\n' }, 'fix: c\n\nIssue: #702\nUser-Visible: no');
  const commits = [mixed, docsOnly, release, two, one];
  const sets = issuePatchSets({ commits, numbers: [701, 702], cwd: repo.dir });
  const ids = commitPatchIds([one.sha, two.sha, release.sha, docsOnly.sha, mixed.sha], { cwd: repo.dir });
  assert.equal(new Set(ids.values()).size, 5, 'у каждого коммита свой patch-id');
  assert.deepEqual(sets.get(701), [ids.get(one.sha), ids.get(two.sha)].sort(), 'два коммита задачи → два patch-id');
  assert.ok(!sets.get(701).includes(ids.get(release.sha)), 'Release:-коммит с трейлером задачи не входит');
  assert.ok(!sets.get(701).includes(ids.get(docsOnly.sha)), 'коммит только в docs/reviews/** не входит');
  assert.deepEqual(sets.get(702), [ids.get(mixed.sha)], 'коммит кода и docs/reviews/** входит');
  assert.deepEqual(issuePatchSets({ commits: [...commits].reverse(), numbers: [701, 702], cwd: repo.dir }), sets, 'порядок не влияет');
  // Ночь до Release-коммита и бета на нём читают один набор: Release: исключён.
  assert.deepEqual(issuePatchSets({ commits: [two, one], numbers: [701], cwd: repo.dir }).get(701), sets.get(701));
  // Тот же дифф в другом коммите (cherry-pick в обратном порядке) — тот же patch-id.
  repo.git('checkout', '-q', '-b', 'other', base);
  repo.git('cherry-pick', two.sha);
  const pickedTwo = { sha: repo.git('rev-parse', 'HEAD'), message: two.message };
  repo.git('cherry-pick', one.sha);
  const pickedOne = { sha: repo.git('rev-parse', 'HEAD'), message: one.message };
  assert.notEqual(pickedOne.sha, one.sha);
  assert.deepEqual(issuePatchSets({ commits: [pickedOne, pickedTwo], numbers: [701], cwd: repo.dir }).get(701), sets.get(701));
  assert.equal(countsForPatchSet({ message: 'x\n\nRelease: v1.80.0', files: ['src/a.ts'] }), false);
  assert.equal(countsForPatchSet({ message: 'x', files: ['docs/reviews/INDEX.md'] }), false);
  assert.equal(countsForPatchSet({ message: 'x', files: ['docs/reviews/INDEX.md', 'src/a.ts'] }), true);
  assert.equal(countsForPatchSet({ message: 'Release v1 candidate (упоминание Release: в теме не трейлер)', files: ['a'] }), true);
});

test('#727 AC2 К2: ночной режим — кандидат обязателен, имя по базе и SHA, блок несёт mode и patches', () => {
  assert.throws(() => shipReviewMode({ tag: 'nightly', candidate: '' }), /tag=nightly требует candidate/);
  assert.equal(shipReviewMode({ tag: 'nightly', candidate: sha('a') }), 'nightly');
  assert.equal(shipReviewMode({ tag: 'v1.79.0-beta.2' }), 'beta');
  assert.throws(() => shipReviewMode({ tag: 'v1.79' }), /not a release tag/);
  const candidate = `108427dc1234${'f'.repeat(28)}`;
  assert.equal(nightlyDocPath({ base: 'v1.79.0-beta.1', candidate }), `docs/reviews/${NIGHT()}`);
  assert.equal(shipDocPath({ tag: 'nightly', candidate, base: 'v1.78.0' }), 'docs/reviews/SHIP-REVIEW-v1.78.0-dev-108427dc1234.md');
  assert.equal(shipDocPath({ tag: 'v1.79.0-beta.2', candidate, base: 'v1.79.0-beta.1' }), 'docs/reviews/SHIP-REVIEW-v1.79.0-beta.2.md');
  assert.throws(() => nightlyDocPath({ base: null, candidate }), /ночной документ без базы/);
  // Блок: прежние строки на месте, mode и patches — в конце; parseAnchorBlock их читает.
  const patches = new Map([[702, [PID('b')]], [701, [PID('c'), PID('a')]]]);
  const block = anchorBlock({ tag: 'nightly', candidate, base: 'v1.79.0-beta.1', issues: [701, 702], high: 0, mode: 'nightly', patches });
  assert.match(block, new RegExp(`\`\`\`\\ntag nightly\\ncandidate ${candidate}\\nbase v1\\.79\\.0-beta\\.1\\nissues 701,702\\nhigh 0\\nmedium 0\\nlow 0\\nrun —\\nmode nightly\\npatches 701:${PID('a')}\\+${PID('c')},702:${PID('b')}\\n\`\`\``));
  assert.deepEqual(parseAnchorBlock(block), {
    tag: 'nightly', candidate, issues: [701, 702], high: 0, medium: 0, low: 0, base: 'v1.79.0-beta.1', mode: 'nightly',
    patches: new Map([[701, [PID('a'), PID('c')]], [702, [PID('b')]]]),
  });
  assert.deepEqual(parsePatches(formatPatches(patches)), new Map([[701, [PID('a'), PID('c')]], [702, [PID('b')]]]));
  assert.deepEqual(parsePatches('693:'), new Map([[693, []]]), 'задача без своих коммитов — пустой набор');
  assert.deepEqual(parsePatches('701:zz,702:' + PID('b')), new Map([[702, [PID('b')]]]), 'испорченная запись пропускается');
  // Все задачи clean → читать нечего: proceed=false, issues пусто.
  const ship = [{ number: 701, patches: [PID('a')] }, { number: 702, patches: [PID('b')] }];
  const docs = [shipDoc(NIGHT('aaaaaaaaaaaa'), { issues: [701, 702], high: 0, patches: new Map([[701, [PID('a')]], [702, [PID('b')]]]) })];
  const plan = planShipReview({ tag: 'nightly', ship, docs, base: 'v1.79.0-beta.1' });
  assert.equal(plan.mode, 'nightly');
  assert.deepEqual(plan.read, []);
  assert.match(plan.note, /^все ship-задачи покрыты: SHIP-REVIEW-v1\.79\.0-beta\.1-dev-aaaaaaaaaaaa\.md/);
  assert.equal(reviewSubject('nightly'), 'Ночное пакетное ревью: кандидат — голова `dev` после ночного полного Validate.');
  assert.equal(reviewSubject('v1.79.0-beta.2'), 'Бета: v1.79.0-beta.2.');
});

test('#727 AC3 К3: покрытие — четыре статуса, последний документ главнее, чужая база не в счёт, старый документ — по номеру', () => {
  const base = 'v1.79.0-beta.1';
  const ship = [
    { number: 701, patches: [PID('a')] }, { number: 702, patches: [PID('b')] },
    { number: 703, patches: [PID('c'), PID('d')] }, { number: 704, patches: [PID('e')] },
  ];
  const docs = [
    shipDoc(NIGHT('111111111111'), { issues: [701, 703], high: 0, patches: new Map([[701, [PID('a')]], [703, [PID('c')]]]) }),
    shipDoc(NIGHT('222222222222'), { issues: [702], high: 1, patches: new Map([[702, [PID('b')]]]) }),
  ];
  const status = (list, opts = {}) => Object.fromEntries(shipCoverage({ ship, docs: list, base, ...opts }).map((c) => [c.number, `${c.status}:${c.doc}`]));
  assert.deepEqual(status(docs), {
    701: `clean:${NIGHT('111111111111')}`, 702: `high:${NIGHT('222222222222')}`,
    703: `stale:${NIGHT('111111111111')}`, 704: 'none:null',
  });
  // Последний главнее: clean, затем high на том же наборе → high; и наоборот → clean.
  const clean = shipDoc(NIGHT('333333333333'), { issues: [701], high: 0, patches: new Map([[701, [PID('a')]]]) });
  const high = shipDoc(NIGHT('444444444444'), { issues: [701], high: 2, patches: new Map([[701, [PID('a')]]]) });
  assert.equal(status([clean, high])[701], `high:${NIGHT('444444444444')}`, 'позже опубликованный high отменяет ранний clean');
  assert.equal(status([high, clean])[701], `clean:${NIGHT('333333333333')}`);
  // Документ другой базы не покрывает.
  const foreign = { name: 'SHIP-REVIEW-v1.79.0-beta.1.md', text: anchorBlock({ tag: 'v1.79.0-beta.1', candidate: sha('e'), base: 'v1.78.0', issues: [704], high: 0 }) };
  assert.equal(status([foreign])[704], 'none:null', 'база v1.78.0 ≠ v1.79.0-beta.1');
  // Старый документ без patches (#696) покрывает по номеру — тот же номер, любой код.
  const legacy = { name: 'SHIP-REVIEW-v1.79.0-beta.2.md', text: anchorBlock({ tag: 'v1.79.0-beta.2', candidate: sha('e'), base, issues: [704], high: 0 }) };
  assert.equal(status([legacy])[704], 'clean:SHIP-REVIEW-v1.79.0-beta.2.md');
  // Документ с patches без записи о задаче, число High не записано — не clean.
  const partial = shipDoc(NIGHT('555555555555'), { issues: [704], high: 0, patches: new Map() });
  assert.equal(status([partial])[704], `stale:${NIGHT('555555555555')}`);
  const noHigh = { name: NIGHT('666666666666'), text: shipDoc('x', { issues: [704], patches: new Map([[704, [PID('e')]]]) }).text.replace('\nhigh 0\n', '\nhigh —\n') };
  assert.equal(status([noHigh])[704], `high:${NIGHT('666666666666')}`);
});

test('#727 AC4 К4: гейт по покрытию — clean без документа тега проходит; stale, none, high — отказ', () => {
  const tag = 'v1.79.0-beta.2';
  const base = 'v1.79.0-beta.1';
  const ship = [{ number: 701, patches: [PID('a')] }, { number: 702, patches: [PID('b')] }];
  const night = shipDoc(NIGHT(), { issues: [701, 702], high: 0, patches: new Map([[701, [PID('a')]], [702, [PID('b')]]]) });
  assert.deepEqual(shipReviewProblems({ tag, ship, docs: [night], base }), [], 'всё clean без документа тега');
  assert.deepEqual(shipReviewProblems({ tag, ship: [], docs: [], base }), [], 'без ship-задач документ не нужен');
  // stale: код задачи изменился после ночного ревью.
  const changed = [{ number: 701, patches: [PID('a'), PID('f')] }, ship[1]];
  const stale = shipReviewProblems({ tag, ship: changed, docs: [night], base });
  assert.equal(stale.length, 1);
  assert.match(stale[0], new RegExp(`ship-задача #701 изменилась после ревью docs/reviews/${NIGHT().replace(/\./g, '\\.')}`));
  assert.match(stale[0], /gh workflow run ship-review\.yml --ref dev -f tag=v1\.79\.0-beta\.2$/, 'документа тега нет — дельта без force');
  // none: задача слита после ночи.
  const none = shipReviewProblems({ tag, ship: [...ship, { number: 709, patches: [PID('9')] }], docs: [night], base });
  assert.equal(none.length, 1);
  assert.match(none[0], /не покрывает ship-задачи #709 — они не прочитаны/);
  assert.match(none[0], /Запустить: gh workflow run ship-review\.yml --ref dev -f tag=v1\.79\.0-beta\.2$/);
  // Документ тега уже лежит: без force его не переснять — команда с force=true.
  const own = { name: 'SHIP-REVIEW-v1.79.0-beta.2.md', text: anchorBlock({ tag, candidate: sha('e'), base, issues: [701], high: 0, mode: 'beta', patches: new Map([[701, [PID('a')]]]) }) };
  assert.match(shipReviewProblems({ tag, ship, docs: [own], base })[0], /не покрывает ship-задачи #702[\s\S]*-f force=true$/);
  // high: прежний отказ, с документом и командой пересъёмки.
  const red = shipDoc(NIGHT('777777777777'), { issues: [702], high: 1, patches: new Map([[702, [PID('b')]]]) });
  const high = shipReviewProblems({ tag, ship, docs: [night, red], base });
  assert.equal(high.length, 1);
  assert.match(high[0], new RegExp(`docs/reviews/${NIGHT('777777777777').replace(/\./g, '\\.')} \\(задачи #702\\): High 1 — бета ждёт починки`));
  assert.match(high[0], /-f force=true$/);
  // Документ тега записан для чужой базы — названо явно.
  const shifted = { ...own, text: own.text.replace(`base ${base}`, 'base v1.78.0') };
  assert.ok(shipReviewProblems({ tag, ship, docs: [night, shifted], base }).some((p) => /записан для базы v1\.78\.0, а диапазон кандидата — от v1\.79\.0-beta\.1/.test(p)));
});

test('#727 AC5 К5: бета читает дельту — бриф только none/stale и «прочитаны ночью»; force — все; пустая дельта — «все покрыты»', () => {
  const tag = 'v1.79.0-beta.2';
  const base = 'v1.79.0-beta.1';
  const issue = (number, patches) => ({ number, title: `Задача ${number}`, spec: '## ТЗ\n\nстрока', patches, commits: [{ sha: sha(String(number % 10)), subject: `fix: ${number}` }] });
  const ship = [issue(701, [PID('a')]), issue(702, [PID('b'), PID('f')]), issue(703, [PID('c')]), issue(704, [PID('d')])];
  const docs = [
    shipDoc(NIGHT('111111111111'), { issues: [701, 702], high: 0, patches: new Map([[701, [PID('a')]], [702, [PID('b')]]]) }),
    shipDoc(NIGHT('222222222222'), { issues: [704], high: 1, patches: new Map([[704, [PID('d')]]]) }),
  ];
  const plan = planShipReview({ tag, ship, docs, base });
  assert.equal(plan.mode, 'beta');
  assert.deepEqual(plan.read.map((i) => i.number), [702, 703], 'stale и none; high не перечитывается без force');
  assert.deepEqual(plan.covered, [{ number: 701, doc: NIGHT('111111111111') }]);
  assert.deepEqual(plan.held, [{ number: 704, doc: NIGHT('222222222222') }]);
  const brief = renderShipBrief({ tag, candidate: sha('e'), base: { tag: base, sha: sha('f') }, ship: plan.read, doc: shipReviewDocPath(tag), covered: plan.covered, held: plan.held });
  assert.match(brief, /^## Задачи ship \(2\)/m);
  assert.match(brief, /### #702 · /);
  assert.match(brief, /### #703 · /);
  assert.doesNotMatch(brief, /### #701 |### #704 /, 'прочитанные и High в бриф как задачи не входят');
  assert.match(brief, new RegExp(`^- Прочитаны ночью: #701 — \`docs/reviews/${NIGHT('111111111111').replace(/\./g, '\\.')}\``, 'm'));
  assert.match(brief, /^- High ждёт починки: #704 — `docs\/reviews\/SHIP-REVIEW-v1\.79\.0-beta\.1-dev-222222222222\.md`/m);
  // force=true — все ship-задачи, на ночные документы не смотрит.
  const forced = planShipReview({ tag, ship, docs, base, force: true });
  assert.deepEqual(forced.read.map((i) => i.number), [701, 702, 703, 704]);
  assert.deepEqual([forced.covered, forced.held], [[], []]);
  // Пустая дельта: модели нет, сводка «все ship-задачи покрыты: <документы>».
  const empty = planShipReview({ tag, ship: [ship[0]], docs, base });
  assert.deepEqual(empty.read, []);
  assert.equal(empty.note, `все ship-задачи покрыты: ${NIGHT('111111111111')} — модель не запускается`);
  assert.match(planShipReview({ tag, ship: [ship[3]], docs, base }).note, /^читать нечего: #704 — High в .*force=true/);
  assert.equal(planShipReview({ tag, ship: [], docs, base }).note, 'ship-задач в диапазоне нет — ревью не нужно');
  // Ночной бриф называет кандидата головой dev и пишет в ночной документ.
  const nightly = renderShipBrief({ tag: 'nightly', candidate: sha('e'), base: { tag: base, sha: sha('f') }, ship: plan.read, doc: `docs/reviews/${NIGHT()}` });
  assert.match(nightly, /^# Вход ночного пакетного ревью ship$/m);
  assert.match(nightly, /- Кандидат: `e{40}` — голова `dev` после ночного полного Validate/);
  assert.match(nightly, new RegExp(`- Документ: \`docs/reviews/${NIGHT().replace(/\./g, '\\.')}\``));
});

test('#727 AC7 К7: индекс и архив знают ночной документ; база-бета — её линия, стабильная база — ближайшая новее', () => {
  assert.deepEqual(parseDocName(NIGHT()), { stage: 'ship', issue: null, round: null, suffix: null, tag: 'v1.79.0-beta.1', nightly: true });
  assert.deepEqual(parseDocName('SHIP-REVIEW-v1.78.0-dev-0123456789ab.md'), { stage: 'ship', issue: null, round: null, suffix: null, tag: 'v1.78.0', nightly: true });
  assert.equal(parseDocName('SHIP-REVIEW-v1.78.0-dev-0123.md'), null, 'SHA — ровно 12 знаков');
  assert.equal(parseDocName('SHIP-REVIEW-nightly.md'), null);
  const entry = (name, tag, extra = {}) => ({ name, stage: 'ship', issue: null, tag, verdict: '—', high: 0, medium: 0, findings: [], files: [], ...extra });
  const md = renderIndex({ entries: [
    entry('SHIP-REVIEW-v1.79.0-beta.1.md', 'v1.79.0-beta.1'),
    entry(NIGHT(), 'v1.79.0-beta.1', { nightly: true, high: 1 }),
    entry('SHIP-REVIEW-v1.79.0-beta.2.md', 'v1.79.0-beta.2'),
  ] });
  const rows = md.split('\n').filter((line) => /^\| (бета|ночь)/.test(line));
  assert.deepEqual(rows.map((r) => r.split('|')[1].trim()), ['бета v1.79.0-beta.2', 'ночь после v1.79.0-beta.1', 'бета v1.79.0-beta.1']);
  assert.match(rows[1], new RegExp(`\\[${NIGHT().replace(/\./g, '\\.')}\\]\\(${NIGHT().replace(/\./g, '\\.')}\\) \\| ночное пакетное ревью ship · — \\| ⚪ — \\| 1 \\|`));
  const plan = (names, lines, through) => archivePlan({ names, lines: lines.map((tag) => ({ tag, issues: [] })), open: [], through });
  const night = 'SHIP-REVIEW-v1.78.0-dev-0123456789ab.md';
  // (а) база-бета → каталог её стабильной линии
  assert.deepEqual(plan([NIGHT()], ['v1.79.0'], 'v1.79.0').moves.map((m) => m.to), [`legacy/reviews/v1.79.0/${NIGHT()}`]);
  // (б) стабильная база → линия новее базы, не каталог самой базы
  const later = plan([night], ['v1.78.0', 'v1.79.0'], 'v1.79.0');
  assert.deepEqual(later.moves.map((m) => m.to), [`legacy/reviews/v1.79.0/${night}`]);
  assert.ok(!later.moves.some((m) => m.to.startsWith('legacy/reviews/v1.78.0/')));
  // (в) несколько линий новее — ближайшая, не последняя
  assert.deepEqual(plan([night], ['v1.78.0', 'v1.78.1', 'v1.79.0'], 'v1.79.0').moves.map((m) => m.to), [`legacy/reviews/v1.78.1/${night}`]);
  // (г) линии новее нет — остаётся на месте с причиной
  const none = plan([night], ['v1.77.0', 'v1.78.0'], 'v1.78.0');
  assert.deepEqual(none.moves, []);
  assert.deepEqual(none.kept, [{ name: night, reason: 'ночное ревью после v1.78.0: архивируемой линии новее базы нет' }]);
});

test('#727 AC8 К8: строка о High ночью — с меткой документа, повтор на тот же документ не пишется', () => {
  const doc = `docs/reviews/${NIGHT()}`;
  const body = highCommentBody(doc);
  assert.equal(body.split('\n').length, 1, 'одна строка');
  assert.ok(body.startsWith(`Ночное пакетное ревью ship нашло High: \`${doc}\`. Бета не выйдет, пока находка не починена отдельной задачей и ревью не переснято (§11.7)`));
  assert.match(body, new RegExp(`<!-- hp:ship-review-high doc=${NIGHT().replace(/\./g, '\\.')} -->$`));
  assert.equal(highCommentBody(NIGHT()), body, 'имя и путь дают одну строку');
  const issues = [
    { number: 701, comments: [{ body: 'обсуждение' }] },
    { number: 702, comments: [{ body: body }] },
    { number: 703, comments: [{ body: highCommentBody(NIGHT('999999999999')) }] },
  ];
  assert.deepEqual(highCommentTargets({ doc, issues }), [701, 703], 'метка того же документа — повтора нет; другой документ — пишется');
});

// #737 К5: расход модели — строкой сразу после закрывающего ``` машинного
// блока; содержимое блока, которое читают гейт беты и покрытие, не меняется.
test('#737 AC4: anchorBlock пишет строку расхода после блока, parseAnchorBlock её отдаёт; без usage — как прежде', () => {
  const usage = '<!-- hp:usage input_tokens=97209 output_tokens=55524 cache_creation_input_tokens=149047 cache_read_input_tokens=1135731 num_turns=42 -->';
  const fields = { tag: 'nightly', candidate: sha('e'), base: 'v1.79.0-beta.1', issues: [701, 702], high: 1, medium: 2, low: 3,
    runUrl: 'https://github.com/o/r/actions/runs/9', mode: 'nightly', patches: new Map([[701, [PID('a')]], [702, [PID('b')]]]) };
  const plain = anchorBlock(fields);
  const withUsage = anchorBlock({ ...fields, usage });
  assert.equal(withUsage, `${plain}${usage}\n`, 'строка — сразу после закрывающего ```, блок тот же');
  assert.ok(plain.endsWith('```\n'));
  const fenced = (text) => /```\n([\s\S]*?)\n```/.exec(text)[1];
  assert.equal(fenced(withUsage), fenced(plain), 'содержимое между ``` то же');
  assert.equal(anchorBlock({ ...fields, usage: '' }), `${plain}<!-- hp:usage-none reason=missing -->\n`, 'пусто — missing');
  assert.equal(anchorBlock({ ...fields, usage: `x ${sha('f')} -->` }), `${plain}<!-- hp:usage-none reason=invalid -->\n`, 'мусор — invalid');
  assert.doesNotMatch(plain, /hp:usage/, 'вызов до #737 — строки нет');
  const doc = (block) => `# Ночное ревью\nИтог: High 1 · Medium 2 · Low 3\n\n${block}`;
  const before = parseAnchorBlock(doc(plain));
  assert.equal('usage' in before, false, 'документ без строки — без usage');
  assert.deepEqual(parseAnchorBlock(doc(withUsage)), {
    ...before,
    usage: { input_tokens: 97209, output_tokens: 55524, cache_creation_input_tokens: 149047, cache_read_input_tokens: 1135731, num_turns: 42 },
  });
  assert.deepEqual(parseAnchorBlock(doc(anchorBlock({ ...fields, usage: '<!-- hp:usage-none reason=no-result -->' }))).usage, { reason: 'no-result' });
  // Строка в прозе модели до маркера — не строка блока.
  assert.equal('usage' in parseAnchorBlock(`# Ревью\n${usage}\n\n${plain}`), false);
  // Покрытие и гейт читают документ со строкой так же, как без неё.
  const ship = [{ number: 701, patches: [PID('a')] }, { number: 702, patches: [PID('b')] }];
  const named = (block) => [{ name: NIGHT(), text: doc(block) }];
  assert.deepEqual(shipCoverage({ ship, docs: named(withUsage), base: 'v1.79.0-beta.1' }), shipCoverage({ ship, docs: named(plain), base: 'v1.79.0-beta.1' }));
});

// ---------- #727: шаги _ship-review.yml на настоящем bash и git ----------
//
// Шаги исполняются как есть, из файла workflow: подготовка (prepare),
// публикация документа и строка о High. Подменены транспорт push (github.com →
// локальный origin) и `gh` (issue из файлов песочницы, комментарии — в журнал).
// Патч-набор, база, документы диапазона и покрытие — настоящий git.

const SCRIPTS = fileURLToPath(new URL('../scripts', import.meta.url));
const SHIP_WORKFLOW = fileURLToPath(new URL('../.github/workflows/_ship-review.yml', import.meta.url));
const hasTools = () => process.platform !== 'win32'
  && ['bash', 'jq', 'sha256sum'].every((tool) => spawnSync(tool, ['--version']).status === 0);
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'init.defaultBranch', GIT_CONFIG_VALUE_0: 'dev',
};

/** Тело `run:` шага, как его прочтёт YAML (блок кончается на строке с отступом меньше десяти). */
function stepRun(name) {
  const text = readFileSync(SHIP_WORKFLOW, 'utf8');
  const start = text.indexOf(`      - name: ${name}\n`);
  assert.ok(start >= 0, `шаг «${name}»`);
  const lines = text.slice(start).split('\n');
  const from = lines.indexOf('        run: |');
  assert.ok(from > 0, `у шага «${name}» есть run: |`);
  const body = [];
  for (const line of lines.slice(from + 1)) {
    if (line.trim() && !/^ {10}/.test(line)) break;
    body.push(line.replace(/^ {10}/, ''));
  }
  return body.join('\n').replace(/\$\{\{ github\.repository \}\}/g, 'o/r');
}

/** Замыкание относительных импортов скрипта. */
function importClosure(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  for (const m of readFileSync(entry, 'utf8').matchAll(/^import[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) {
    importClosure(join(dirname(entry), m[1]), seen);
  }
  return seen;
}

function shipSandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-727-wf-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  const temp = join(root, 'runner');
  const fake = join(root, 'fake');
  const bin = join(root, 'bin');
  for (const dir of [temp, fake, bin]) mkdirSync(dir);
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  mkdirSync(join(work, 'scripts'));
  const scripts = ['ship-review.mjs', 'reviews-index.mjs', 'review-doc-guard.mjs']
    .reduce((seen, name) => importClosure(join(SCRIPTS, name), seen), new Set());
  for (const file of scripts) writeFileSync(join(work, 'scripts', file.slice(SCRIPTS.length + 1)), readFileSync(file));
  mkdirSync(join(work, 'docs', 'reviews'), { recursive: true });
  writeFileSync(join(work, 'docs', 'reviews', 'INDEX.md'), '# Индекс ревью\n');
  for (const name of ['a', 'b', 'c']) writeFileSync(join(work, `${name}.mjs`), `export const ${name} = 0;\n`);
  const commit = (files, message) => {
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(work, path)), { recursive: true });
      writeFileSync(join(work, path), text);
    }
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', message);
    return git(work, 'rev-parse', 'HEAD');
  };
  commit({}, 'base');
  git(work, 'tag', 'v1.0.0');
  const realGit = spawnSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' }).stdout.trim();
  writeFileSync(join(bin, 'git'), [
    '#!/usr/bin/env bash',
    'if [ "$1" = push ]; then',
    '  args=(); for a in "$@"; do case "$a" in https://*) args+=("$FAKE_ORIGIN") ;; *) args+=("$a") ;; esac; done',
    '  exec "$REAL_GIT" "${args[@]}"',
    'fi',
    'exec "$REAL_GIT" "$@"',
    '',
  ].join('\n'), { mode: 0o755 });
  // gh: `issue view N … --json …` — файл issue-N.json; `issue comment N … --body X` — в журнал.
  writeFileSync(join(bin, 'gh'), [
    '#!/usr/bin/env bash',
    'echo "$*" >> "$FAKE_DIR/gh-calls"',
    'if [ "$1 $2" = "issue view" ]; then cat "$FAKE_DIR/issue-$3.json"; exit 0; fi',
    'if [ "$1 $2" = "issue comment" ]; then',
    '  while [ $# -gt 0 ]; do if [ "$1" = --body ]; then printf "%s\\t%s\\n" "$NUM" "$2" >> "$FAKE_DIR/comments"; fi; NUM=${NUM:-$3}; shift; done',
    '  exit 0',
    'fi',
    'echo "unexpected gh $*" >&2; exit 1',
    '',
  ].join('\n'), { mode: 0o755 });
  // Коммит публикации документа несёт `Issue: #696` (бета) или `Issue: #727`
  // (ночь, #748) — задачи не ship.
  writeFileSync(join(fake, 'issue-696.json'), JSON.stringify({ number: 696, title: 'Пакетное ревью ship', body: '', labels: [], comments: [] }));
  writeFileSync(join(fake, 'issue-727.json'), JSON.stringify({ number: 727, title: 'Ночное пакетное ревью ship', body: '', labels: [], comments: [] }));
  const box = {
    root, origin, work, temp, fake, git, commit,
    push() { git(work, 'push', '-q', '--tags', 'origin', 'HEAD:dev'); git(work, 'fetch', '-q', 'origin'); },
    issue(number, { comments = [{ body: `Слияние без ревью модели\n\n${MARKER}` }], labels = [] } = {}) {
      writeFileSync(join(fake, `issue-${number}.json`), JSON.stringify({
        number, title: `Задача ${number}`, body: '## ТЗ\n\nстрока', labels, comments,
      }));
    },
    run(script, env) {
      for (const file of ['output', 'summary.md']) rmSync(join(temp, file), { force: true });
      const r = spawnSync('bash', ['--noprofile', '--norc', '-e', '-c', script], {
        cwd: work, encoding: 'utf8',
        env: {
          ...GIT_ENV, ...env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: temp, GH_TOKEN: 'x', TOKEN: 'x',
          GITHUB_OUTPUT: join(temp, 'output'), GITHUB_STEP_SUMMARY: join(temp, 'summary.md'),
          FAKE_DIR: fake, FAKE_ORIGIN: origin, REAL_GIT: realGit,
        },
      });
      const read = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
      const output = {};
      for (const line of read(join(temp, 'output')).split('\n')) {
        const at = line.indexOf('=');
        if (at > 0) output[line.slice(0, at)] = line.slice(at + 1);
      }
      return { status: r.status, stdout: r.stdout, stderr: r.stderr, output, summary: read(join(temp, 'summary.md')) };
    },
    prepare(env) {
      return box.run(stepRun('Кандидат, база и ship-задачи'), {
        FORCE: 'false', CANDIDATE: '', RUN_URL: 'https://github.com/o/r/actions/runs/1', ...env,
      });
    },
    /** Публикация так, как её видит job publish: выходы prepare и запечатанный результат модели. */
    publish(prepared, result, extra = {}) {
      const dir = join(temp, 'ship-review-result');
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir);
      writeFileSync(join(dir, 'ship-review.md'), `# Пакетное ревью ship\n\nИтог: High ${result.high} · Medium ${result.medium} · Low ${result.low}\n`);
      writeFileSync(join(dir, 'result.json'), JSON.stringify(result));
      spawnSync('bash', ['-c', 'sha256sum ship-review.md result.json > manifest.sha256'], { cwd: dir });
      const o = prepared.output;
      const env = {
        TAG: extra.TAG, DOC: o.doc, CANDIDATE: o.candidate, BASE: o.base, ISSUES: o.issues, MODE: o.mode, PATCHES: o.patches,
        RUN_URL: 'https://github.com/o/r/actions/runs/2',
      };
      const published = box.run(stepRun('Опубликовать документ'), env);
      git(work, 'fetch', '-q', 'origin');
      return published;
    },
    check(tag, candidate) {
      return spawnSync(process.execPath, ['scripts/ship-review.mjs', 'check', `--tag=${tag}`, `--candidate=${candidate}`, '--repo=o/r'], {
        cwd: work, encoding: 'utf8', env: { ...GIT_ENV, PATH: `${bin}:${process.env.PATH}`, FAKE_DIR: fake, REAL_GIT: realGit },
      });
    },
  };
  return box;
}

test('#727 AC2/AC5 _ship-review.yml на настоящем bash: ночь читает непокрытое, бета — дельту, гейт принимает ночной документ', (t) => {
  if (!hasTools()) { t.skip('bash/jq/sha256sum недоступны'); return; }
  const box = shipSandbox(t);
  box.issue(701);
  box.issue(702);
  box.issue(703, { comments: [] }); // show: в пакет не входит
  box.commit({ 'a.mjs': 'export const a = 1;\n' }, 'fix: a (#701)\n\nIssue: #701\nUser-Visible: no');
  box.commit({ 'b.mjs': 'export const b = 1;\n' }, 'fix: b (#702)\n\nIssue: #702\nUser-Visible: no');
  box.commit({ 'c.mjs': 'export const c = 1;\n' }, 'feat: c (#703)\n\nIssue: #703\nUser-Visible: no');
  box.push();
  const head = box.git(box.work, 'rev-parse', 'HEAD');

  // tag=nightly без candidate — отказ до подстановки вершины dev.
  const refused = box.prepare({ TAG: 'nightly' });
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /tag=nightly требует candidate/);
  assert.equal(refused.output.proceed, undefined);

  // Первая ночь: читать обе ship-задачи, документ по базе и SHA.
  const first = box.prepare({ TAG: 'nightly', CANDIDATE: head });
  assert.equal(first.status, 0, first.stderr);
  const nightDoc = `docs/reviews/SHIP-REVIEW-v1.0.0-dev-${head.slice(0, 12)}.md`;
  assert.deepEqual([first.output.proceed, first.output.mode, first.output.doc, first.output.base, first.output.issues],
    ['true', 'nightly', nightDoc, 'v1.0.0', '701,702']);
  assert.match(first.output.patches, /^701:[0-9a-f]{40},702:[0-9a-f]{40}$/);
  assert.equal(first.output.subject, 'Ночное пакетное ревью: кандидат — голова `dev` после ночного полного Validate.');
  assert.match(readFileSync(join(box.temp, 'ship-review-input', 'brief.md'), 'utf8'), /^# Вход ночного пакетного ревью ship$/m);

  // Публикация: mode и patches — из prepare; поле patches в результате модели не читается.
  const bogus = { high: 0, medium: 1, low: 0, summary: 'ok', patches: '701:' + 'd'.repeat(40) };
  const published = box.publish(first, bogus, { TAG: 'nightly' });
  assert.equal(published.status, 0, published.stderr + published.stdout);
  assert.match(published.summary, /^### Ночное пакетное ревью ship$/m);
  assert.doesNotMatch(published.summary, /Предрелизное|Пакетное ревью ship nightly/);
  const text = box.git(box.work, 'show', `origin/dev:${nightDoc}`);
  const block = parseAnchorBlock(text);
  assert.equal(block.mode, 'nightly');
  assert.equal(block.base, 'v1.0.0');
  assert.deepEqual(block.issues, [701, 702]);
  assert.equal(formatPatches(block.patches), first.output.patches, 'patches — ровно из prepare');
  assert.match(box.git(box.work, 'show', 'origin/dev:docs/reviews/INDEX.md'), /ночь после v1\.0\.0/);

  // Документ на этот SHA уже в dev — ночь ничего не делает.
  const again = box.prepare({ TAG: 'nightly', CANDIDATE: head });
  assert.equal(again.status, 0, again.stderr);
  assert.equal(again.output.proceed, 'false');
  assert.match(again.stdout, /уже есть в dev — повторное ревью не запускается/);

  // Кандидат беты — Release:-коммит поверх ночной головы: гейт принимает ночной документ, документа тега нет.
  box.git(box.work, 'reset', '-q', '--hard', 'origin/dev');
  const release = box.commit({ 'package.json': '{"version":"1.1.0-beta.1"}\n' },
    'Release v1.1.0-beta.1 candidate\n\nIssue: #701\nIssue: #702\nIssue: #703\nUser-Visible: yes\nRelease: v1.1.0-beta.1');
  const pass = box.check('v1.1.0-beta.1', release);
  assert.equal(pass.status, 0, pass.stderr);
  assert.match(pass.stdout, new RegExp(`#701 — ${nightDoc.replace(/\./g, '\\.')}, #702 — ${nightDoc.replace(/\./g, '\\.')}`));
  box.git(box.work, 'reset', '-q', '--hard', 'origin/dev');

  // Пустая дельта беты — модели нет, сводка «все ship-задачи покрыты».
  const covered = box.prepare({ TAG: 'v1.1.0-beta.1' });
  assert.equal(covered.status, 0, covered.stderr);
  assert.equal(covered.output.proceed, 'false');
  assert.equal(covered.output.issues, '');
  assert.match(covered.summary, new RegExp(`^- все ship-задачи покрыты: SHIP-REVIEW-v1\\.0\\.0-dev-${head.slice(0, 12)}\\.md — модель не запускается$`, 'm'));

  // Документ только в docs/reviews/** с трейлером задачи — покрытие держится.
  box.commit({ 'docs/reviews/CODE-REVIEW-702-r1.md': '# r1\nВердикт: **зелёный** · High: 0 · Medium: 0\n' }, 'docs: review document for #702\n\nIssue: #702\nUser-Visible: no');
  // #701 получила коммит после ночи → stale; гейт отказывает, бета читает только её.
  box.commit({ 'a.mjs': 'export const a = 2;\n' }, 'fix: a again (#701)\n\nIssue: #701\nUser-Visible: no');
  box.push();
  const tip = box.git(box.work, 'rev-parse', 'HEAD');
  const stale = box.check('v1.1.0-beta.1', tip);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, new RegExp(`::error::ship-задача #701 изменилась после ревью ${nightDoc.replace(/\./g, '\\.')}`));
  assert.doesNotMatch(stale.stderr, /#702/, 'коммит только в docs/reviews/** покрытие не снимает');
  const delta = box.prepare({ TAG: 'v1.1.0-beta.1' });
  assert.equal(delta.status, 0, delta.stderr);
  assert.deepEqual([delta.output.proceed, delta.output.mode, delta.output.doc, delta.output.issues],
    ['true', 'beta', 'docs/reviews/SHIP-REVIEW-v1.1.0-beta.1.md', '701']);
  assert.match(delta.output.patches, /^701:[0-9a-f]{40}\+[0-9a-f]{40}$/);
  const brief = readFileSync(join(box.temp, 'ship-review-input', 'brief.md'), 'utf8');
  assert.match(brief, new RegExp(`^- Прочитаны ночью: #702 — \`${nightDoc.replace(/\./g, '\\.')}\``, 'm'));
  assert.doesNotMatch(brief, /### #702 /);
  // force=true — все ship-задачи, ночные документы не в счёт.
  const forced = box.prepare({ TAG: 'v1.1.0-beta.1', FORCE: 'true' });
  assert.equal(forced.output.issues, '701,702');

  // Ночь после: High на #701 → задача держится, следующие ночи её не читают, гейт стоит.
  const night2 = box.prepare({ TAG: 'nightly', CANDIDATE: tip });
  assert.equal(night2.output.issues, '701');
  assert.equal(box.publish(night2, { high: 1, medium: 0, low: 0, summary: 'x' }, { TAG: 'nightly' }).status, 0);
  box.git(box.work, 'reset', '-q', '--hard', 'origin/dev');
  box.commit({ 'c.mjs': 'export const c = 2;\n' }, 'feat: c again (#703)\n\nIssue: #703\nUser-Visible: no');
  box.push();
  const night3 = box.prepare({ TAG: 'nightly', CANDIDATE: box.git(box.work, 'rev-parse', 'HEAD') });
  assert.equal(night3.status, 0, night3.stderr);
  assert.equal(night3.output.proceed, 'false', 'High не перечитывается без force');
  assert.match(night3.summary, /читать нечего: #701 — High в SHIP-REVIEW-v1\.0\.0-dev-[0-9a-f]{12}\.md/);
  const high = box.check('v1.1.0-beta.1', box.git(box.work, 'rev-parse', 'HEAD'));
  assert.equal(high.status, 1);
  assert.match(high.stderr, /\(задачи #701\): High 1 — бета ждёт починки[^\n]*-f force=true/);

  // Кандидат не предок dev — отказ prepare.
  box.git(box.work, 'checkout', '-q', '-b', 'side', 'HEAD~1');
  const side = box.commit({ 'b.mjs': 'export const b = 9;\n' }, 'fix: side (#702)\n\nIssue: #702\nUser-Visible: no');
  const foreign = box.prepare({ TAG: 'nightly', CANDIDATE: side });
  assert.notEqual(foreign.status, 0);
  assert.match(foreign.stderr, /не предок origin\/dev/);
});

test('#767: публикация предрелизного ship-ревью называет режим и тег в сводке', (t) => {
  if (!hasTools()) { t.skip('bash/jq/sha256sum недоступны'); return; }
  const box = shipSandbox(t);
  box.issue(701);
  box.commit({ 'a.mjs': 'export const a = 1;\n' }, 'fix: a (#701)\n\nIssue: #701\nUser-Visible: no');
  box.push();
  const prepared = box.prepare({ TAG: 'v1.1.0-beta.1' });
  assert.equal(prepared.status, 0, prepared.stderr);
  const published = box.publish(prepared, { high: 0, medium: 0, low: 0, summary: 'ok' }, { TAG: 'v1.1.0-beta.1' });
  assert.equal(published.status, 0, published.stderr + published.stdout);
  assert.match(published.summary, /^### Предрелизное пакетное ревью ship v1\.1\.0-beta\.1$/m);
  assert.doesNotMatch(published.summary, /Ночное|nightly/);
});

test('#727 AC8 _ship-review.yml на настоящем bash: строка о High — только ночью и только при High > 0, без повтора', (t) => {
  if (!hasTools()) { t.skip('bash/jq/sha256sum недоступны'); return; }
  const box = shipSandbox(t);
  const doc = 'docs/reviews/SHIP-REVIEW-v1.0.0-dev-0123456789ab.md';
  const step = stepRun('High ночью — строка в задачи документа');
  const run = (mode, high) => {
    const dir = join(box.temp, 'ship-review-result');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ high, medium: 3, low: 1, summary: 'x' }));
    rmSync(join(box.fake, 'comments'), { force: true });
    const r = box.run(step, { MODE: mode, DOC: doc, ISSUES: '701,702' });
    assert.equal(r.status, 0, r.stderr);
    let comments = '';
    try { comments = readFileSync(join(box.fake, 'comments'), 'utf8'); } catch { /* нет комментариев */ }
    return comments.split('\n').filter(Boolean);
  };
  box.issue(701, { comments: [] });
  box.issue(702, { comments: [{ body: highCommentBody(doc) }] });
  assert.deepEqual(run('beta', 2), [], 'бета: High держит гейт, строки в задачи нет');
  assert.deepEqual(run('nightly', 0), [], 'ночь без High: Medium и Low в issue не пишутся');
  assert.deepEqual(run('nightly', 2), [`701\t${highCommentBody(doc)}`], 'в #702 строка о том же документе уже есть');
  const workflow = readFileSync(SHIP_WORKFLOW, 'utf8');
  const at = workflow.indexOf('      - name: High ночью — строка в задачи документа');
  assert.match(workflow.slice(at, workflow.indexOf('run: |', at)), /if: needs\.prepare\.outputs\.mode == 'nightly'\n[\s\S]*GH_TOKEN: \$\{\{ secrets\.HP_PROCESS_TOKEN \}\}/);
});

test('#727 AC2 _ship-review.yml: ночной режим в теле, patches — не из результата модели, run без heredoc в новых шагах', () => {
  const workflow = readFileSync(SHIP_WORKFLOW, 'utf8');
  const prepare = stepRun('Кандидат, база и ship-задачи');
  // nightly без candidate отказывает до подстановки вершины dev
  assert.ok(prepare.indexOf('ship-review.mjs mode --tag="$TAG" --candidate="$CANDIDATE"') < prepare.indexOf('CANDIDATE=$(git rev-parse origin/dev)'));
  assert.match(prepare, /doc=\$\(node scripts\/ship-review\.mjs doc --tag="\$TAG" --candidate="\$CANDIDATE"\)/);
  assert.match(prepare, /--force="\$FORCE"/);
  assert.match(prepare, /^set -o pipefail$/m, 'отказ prepare за | tee — не «ship-задач нет»');
  for (const output of ['mode', 'patches', 'subject']) {
    assert.match(workflow, new RegExp(`\\n      ${output}: \\$\\{\\{ steps\\.range\\.outputs\\.${output} \\}\\}`));
  }
  const model = workflow.slice(workflow.indexOf('\n  model_review:'), workflow.indexOf('\n  publish:'));
  assert.match(model, /\$\{\{ needs\.prepare\.outputs\.subject \}\}/, 'промпт называет кандидата по режиму');
  assert.doesNotMatch(model, /Бета: \$\{\{ inputs\.tag \}\}/);
  const publish = stepRun('Опубликовать документ');
  assert.match(publish, /mode: process\.env\.MODE, patches: m\.parsePatches\(process\.env\.PATCHES\)/);
  assert.match(workflow, /\n {10}PATCHES: \$\{\{ needs\.prepare\.outputs\.patches \}\}\n/);
  assert.deepEqual([...publish.matchAll(/jq -r '([^']+)'/g)].map((m) => m[1]), ['.high', '.medium', '.low'], 'из результата модели — только счёт');
  assert.match(publish, /doc --tag="\$TAG" --candidate="\$CANDIDATE"/);
  for (const body of [prepare, stepRun('High ночью — строка в задачи документа')]) {
    assert.doesNotMatch(body, /<<-?\s*['"]?[A-Za-z_]/, 'heredoc в run');
    assert.equal(spawnSync('bash', ['-n', '-c', body]).status, 0, 'bash -n');
  }
  assert.equal(spawnSync('bash', ['-n', '-c', publish]).status, 0, 'bash -n публикации');
});
