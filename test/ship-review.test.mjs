// #696, PROCESS.md §11.7: задачи track:ship сливаются без ревью модели; их код
// читает пакетное ревью диапазона перед бетой, и гейт беты требует документ.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  anchorBlock, isShipIssue, parseAnchorBlock, renderShipBrief, shipIssuesInRange, shipReviewDocPath,
  shipReviewProblems, specSection,
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

test('#696 ship-review.yml: модель без права записи, документ с машинным блоком в dev', () => {
  const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/ship-review.yml', import.meta.url)), 'utf8');
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
