// #638, PROCESS.md §11.5: независимое ревью линии перед стабильным релизом.
// Вход — issue, доказанные трейлерами в диапазоне «прошлый стабильный..кандидат»;
// модель без права записи; документ в dev публикует детерминированный шаг.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    { sha: sha('b'), message: 'docs: review document for #607\n\nIssue: #607\nUser-Visible: no',
      files: ['docs/reviews/CODE-REVIEW-607-r1.md'] },
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
  assert.match(model, /run: node "\$RUNNER_TEMP\/review-policy-tools\/scripts\/review-native-runner\.mjs"/);
  assert.doesNotMatch(model, /uses: anthropics\/claude-code-action|github_token:|additional_permissions|mcp__github/,
    '#556: direct native не выполняет App-обмен и не открывает business GitHub tools');
  assert.ok(!/HP_PROCESS_TOKEN/.test(model), 'токен процесса модели недоступен');
  assert.match(model, /ref: \$\{\{ needs\.prepare\.outputs\.candidate \}\}/, 'судится ровно кандидат');
  assert.match(model, /Не читай ТЗ задач/, 'независимость: без ТЗ');
  assert.match(model, /документы раундов \(docs\/reviews\/\*\*\)/, 'независимость: без раундов');
  const publish = jobBlock('publish');
  assert.match(publish, /secrets\.HP_PROCESS_TOKEN/);
  assert.match(publish, /review-doc-guard\.mjs/, 'в dev уходит только docs\/reviews');
  assert.match(publish, /reviews-index\.mjs --dir=docs\/reviews --strict/, 'индекс тем же коммитом и неизвестное имя сразу блокирует публикацию');
  // #723: сообщение — построчно в файл, без heredoc в run; точный текст
  // коммита судит исполнение шага (test/publish-push-refusal.test.mjs).
  assert.match(publish, /echo "Issue: #638"\n\s+echo "User-Visible: no"/, 'трейлеры провенанса');
});

test('#638: повтор на тот же тег не тратит модель, если документ уже в dev', () => {
  const prepare = jobBlock('prepare');
  assert.match(prepare, /if \[ "\$FORCE" != "true" \] && git cat-file -e "origin\/dev:\$doc"/);
  assert.match(prepare, /echo "proceed=false"/);
  assert.match(jobBlock('model_review'), /if: needs\.prepare\.outputs\.proceed == 'true'/);
});

// #704: прежний action отвергал dispatch от github-actions[bot]. Native
// transport не имеет этого event/actor parser; сам dispatch остаётся прежним.
function nativeReviewStep() {
  const model = jobBlock('model_review');
  const start = model.indexOf('      - name: Review\n');
  assert.ok(start > 0, 'шаг Review найден');
  const rest = model.slice(start + 1);
  const next = rest.search(/\n {6}- name: /);
  const step = next < 0 ? rest : rest.slice(0, next + 1);
  return step;
}

test('#704 AC1/AC3: native review accepts the existing trusted dispatch without an action actor override', () => {
  const step = nativeReviewStep();
  assert.match(step, /run: node "\$RUNNER_TEMP\/review-policy-tools\/scripts\/review-native-runner\.mjs"/);
  assert.doesNotMatch(step, /uses:|allowed_bots:|github_token:|additional_permissions/,
    'no action actor wildcard, token exchange or alternate transport');
  // Ожидаемое имя держится за то, как release.yml ставит ревью в очередь: dispatch
  // токеном GITHUB_TOKEN — это и есть github-actions[bot].
  const release = readFileSync(fileURLToPath(new URL('../.github/workflows/release.yml', import.meta.url)), 'utf8');
  const review = release.slice(release.indexOf('\n  independent-review:\n'), release.indexOf('\n  gate:\n'));
  assert.match(review, /GH_TOKEN: \$\{\{ github\.token \}\}\n/, 'dispatch идёт токеном GITHUB_TOKEN');
  assert.match(review, /gh workflow run release-review\.yml/);
});

test("#704: ни один workflow не пускает к action всех ботов ('*')", () => {
  const dir = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
  for (const name of readdirSync(dir).filter((file) => /\.ya?ml$/.test(file))) {
    const text = readFileSync(join(dir, name), 'utf8');
    for (const m of text.matchAll(/^\s+allowed_bots:\s*(.*)$/gm)) {
      assert.doesNotMatch(m[1], /^['"]?\s*\*\s*['"]?$|(^|,)\s*\*\s*(,|$)/, `${name}: allowed_bots '*'`);
    }
  }
});
