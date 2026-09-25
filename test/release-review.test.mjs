// #638, PROCESS.md §11.5: независимое ревью линии перед стабильным релизом.
// Вход — issue, доказанные трейлерами в диапазоне «прошлый стабильный..кандидат»;
// модель без права записи; документ в dev публикует детерминированный шаг.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildLineMembership, previousStableTag, productFiles, releaseReviewDocPath, renderBrief,
} from '../scripts/release-review.mjs';

const WORKFLOW = readFileSync(fileURLToPath(new URL('../.github/workflows/release-review.yml', import.meta.url)), 'utf8');
const jobBlock = (name) => {
  const start = WORKFLOW.indexOf(`\n  ${name}:\n`);
  assert.ok(start > 0, `нет job ${name}`);
  const rest = WORKFLOW.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z_-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};
const sha = (c) => c.repeat(40);

test('#638 документ — только для стабильного тега, имя фиксировано', () => {
  assert.equal(releaseReviewDocPath('v1.78.0'), 'docs/reviews/RELEASE-REVIEW-v1.78.0.md');
  for (const bad of ['v1.78.0-beta.2', '1.78.0', 'v1.78', 'v01.2.3', '', 'v1.78.0/../x']) {
    assert.throws(() => releaseReviewDocPath(bad), /not a stable release tag/, bad);
  }
});

test('#638 база линии — прошлый СТАБИЛЬНЫЙ тег: беты, сам тег и более новые не годятся', () => {
  const tags = ['v1.76.0', 'v1.77.0-beta.1', 'v1.77.0-beta.5', 'v1.77.0', 'v1.78.0-beta.1', 'v1.78.0-beta.2', 'v1.78.0', 'v1.9.0', 'v2.0.0'];
  assert.equal(previousStableTag(tags, 'v1.78.0'), 'v1.77.0', 'бета линии не сжимает диапазон до хвоста');
  assert.equal(previousStableTag(tags, 'v1.77.0'), 'v1.76.0');
  assert.equal(previousStableTag(['v1.9.0', 'v1.10.0'], 'v1.11.0'), 'v1.10.0', 'сравнение числовое, не строковое');
  assert.equal(previousStableTag(['v1.78.0-beta.1'], 'v1.78.0'), null, 'первая стабильная — база не выдумывается');
  assert.equal(previousStableTag(['v1.77.1'], 'v1.77.2'), 'v1.77.1', 'патч-релиз судит свой патч-диапазон');
});

test('#638 AC1: issue линии — только доказанные трейлерами, в схеме RELEASE-MEMBERSHIP.json', () => {
  const commits = [
    { sha: sha('a'), message: 'fix: x\n\nIssue: #607\nUser-Visible: yes' },
    { sha: sha('b'), message: 'docs: review document for #607\n\nIssue: #607\nUser-Visible: no' },
    { sha: sha('c'), message: 'feat: y\n\nIssue: #611\nUser-Visible: yes' },
    { sha: sha('d'), message: 'chore: упоминание #999 в тексте — не трейлер' },
  ];
  const m = buildLineMembership({ tag: 'v1.78.0', candidate: sha('e'), base: { tag: 'v1.77.0', sha: sha('f') }, commits });
  assert.equal(m.schema, 1);
  assert.deepEqual(m.issues.map((row) => row.number), [607, 611]);
  assert.deepEqual(m.issues[0].commits, [sha('a'), sha('b')]);
  assert.throws(() => buildLineMembership({ tag: 'v1.78.0-beta.3', candidate: sha('e'), base: null, commits }), /stable/);
});

test('#638 поверхности — продуктовые файлы (класс A), без бандла и документов', () => {
  assert.deepEqual(productFiles([
    'src/room-cards.ts', 'src\\i18n\\ru.json', 'dist/houseplan-card.js',
    'custom_components/houseplan/frontend/houseplan-card.js', 'custom_components/houseplan/api.py',
    'docs/USER-GUIDE.ru.md', 'scripts/release-review.mjs', 'src/room-cards.ts',
  ]), ['custom_components/houseplan/api.py', 'src/i18n/ru.json', 'src/room-cards.ts']);
});

test('#638 бриф: вход без ТЗ и документов раундов, путь документа и база названы', () => {
  const membership = { schema: 1, tag: 'v1.78.0', candidate: sha('e'), base: { tag: 'v1.77.0', sha: sha('f') }, issues: [{ number: 607, commits: [sha('a')] }] };
  const brief = renderBrief({ membership, files: ['src/a.ts', 'docs/x.md'], runUrl: 'https://example.test/run/1' });
  assert.match(brief, /RELEASE-REVIEW-v1\.78\.0\.md/);
  assert.match(brief, /`v1\.77\.0`/);
  assert.match(brief, /- #607 · коммитов: 1/);
  assert.match(brief, /- `src\/a\.ts`/);
  assert.ok(!/docs\/x\.md/.test(brief), 'не-продуктовые файлы в перечень поверхностей не входят');
  assert.ok(!/\n\n\n/.test(brief), 'без пустых дыр');
});

test('#638: только ручной/вызванный запуск на dev, модель без права записи, документ пишет publish', () => {
  const on = WORKFLOW.slice(WORKFLOW.indexOf('\non:'), WORKFLOW.indexOf('\npermissions:'));
  assert.match(on, /^ {2}workflow_dispatch:/m);
  assert.ok(!/^ {2}(?:push|schedule|workflow_run|issues|release):/m.test(on), 'не событие ветки по умолчанию — зеркало в main не нужно');
  assert.match(WORKFLOW, /\npermissions:\n {2}contents: read\n/, 'потолок прав workflow — чтение');
  assert.ok(!/: write/.test(WORKFLOW), 'ни одного права на запись: документ пушится токеном процесса, а не GITHUB_TOKEN');
  const model = jobBlock('model_review');
  assert.match(model, /github_token: \$\{\{ secrets\.GITHUB_TOKEN \}\}/, '#556: без него action выдаст App-токен с записью');
  assert.match(model, /--allowedTools Read,Write,Grep,Glob,Bash\n/, 'модели не даны инструменты GitHub');
  assert.ok(!/HP_PROCESS_TOKEN/.test(model), 'токен процесса модели недоступен');
  assert.match(model, /ref: \$\{\{ needs\.prepare\.outputs\.candidate \}\}/, 'судится ровно кандидат');
  assert.match(model, /Не читай ТЗ задач/, 'независимость: без ТЗ');
  assert.match(model, /документы раундов \(docs\/reviews\/\*\*\)/, 'независимость: без раундов');
  const publish = jobBlock('publish');
  assert.match(publish, /secrets\.HP_PROCESS_TOKEN/);
  assert.match(publish, /review-doc-guard\.mjs/, 'в dev уходит только docs\/reviews');
  assert.match(publish, /reviews-index\.mjs --dir=docs\/reviews/, 'индекс тем же коммитом');
  assert.match(publish, /Issue: #638\n\s+User-Visible: no/, 'трейлеры провенанса');
});

test('#638: повтор на тот же тег не тратит модель, если документ уже в dev', () => {
  const prepare = jobBlock('prepare');
  assert.match(prepare, /if \[ "\$FORCE" != "true" \] && git cat-file -e "origin\/dev:\$doc"/);
  assert.match(prepare, /echo "proceed=false"/);
  assert.match(jobBlock('model_review'), /if: needs\.prepare\.outputs\.proceed == 'true'/);
});
