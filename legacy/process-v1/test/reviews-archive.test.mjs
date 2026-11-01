// #682: архив документов ревью выпущенных линий — кому куда, решают трейлеры.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ARCHIVE_DIR, LIVE_DIR, archivePlan, brokenLinks, renderPlan, repairLinks, stableTagsThrough } from '../scripts/reviews-archive.mjs';

const lines = [
  { tag: 'v1.76.0', issues: [500, 510, 520] },
  { tag: 'v1.77.0', issues: [520, 530, 540] },
];
const names = [
  'INDEX.md',
  'SPEC-REVIEW-500-r1.md', 'CODE-REVIEW-500-r1.md', 'CODE-REVIEW-500-r2.md',
  'SPEC-REVIEW-520-r1.md', 'CODE-REVIEW-520-r1.md',
  'CODE-REVIEW-540-r1.md', 'CODE-REVIEW-540-r2.md',
  'CODE-REVIEW-600-r1.md',
  'CODE-REVIEW-issue-068-2026-08-12.md',
  'RELEASE-REVIEW-v1.77.0.md', 'RELEASE-REVIEW-v1.78.0.md',
  'notes.md',
];
const where = (plan, name) => plan.moves.find((m) => m.name === name)?.to
  ?? plan.kept.find((k) => k.name === name)?.reason;

test('#682 архив: задача уходит в каталог последней своей линии, документы не разъезжаются', () => {
  const plan = archivePlan({ names, lines, open: [600], through: 'v1.77.0' });
  assert.equal(where(plan, 'CODE-REVIEW-500-r2.md'), `${ARCHIVE_DIR}/v1.76.0/CODE-REVIEW-500-r2.md`);
  // #520 — трейлеры в обеих линиях: все раунды в последней.
  assert.equal(where(plan, 'SPEC-REVIEW-520-r1.md'), `${ARCHIVE_DIR}/v1.77.0/SPEC-REVIEW-520-r1.md`);
  assert.equal(where(plan, 'CODE-REVIEW-520-r1.md'), `${ARCHIVE_DIR}/v1.77.0/CODE-REVIEW-520-r1.md`);
  assert.equal(where(plan, 'RELEASE-REVIEW-v1.77.0.md'), `${ARCHIVE_DIR}/v1.77.0/RELEASE-REVIEW-v1.77.0.md`);
  assert.ok(plan.moves.every((m) => m.from === `${LIVE_DIR}/${m.name}`));
  assert.ok(!plan.moves.some((m) => m.name === 'INDEX.md') && !plan.kept.some((k) => k.name === 'INDEX.md'));
});

test('#682 архив: задача из открытой линии остаётся целиком — её раунды ссылаются на прошлые', () => {
  // #540 выпущена в v1.77.0, но у неё есть трейлер и после тега.
  const plan = archivePlan({ names, lines, open: [540, 600], through: 'v1.77.0' });
  assert.equal(where(plan, 'CODE-REVIEW-540-r1.md'), 'задача есть в открытой линии');
  assert.equal(where(plan, 'CODE-REVIEW-540-r2.md'), 'задача есть в открытой линии');
  assert.equal(where(plan, 'CODE-REVIEW-600-r1.md'), 'задача есть в открытой линии');
  assert.equal(where(plan, 'RELEASE-REVIEW-v1.78.0.md'), 'ревью линии v1.78.0 не входит в архивируемые линии');
});

test('#682 архив: без трейлера — по линии добавления документа, иначе остаётся; чужое имя не трогается', () => {
  const bare = archivePlan({ names, lines, open: [600], through: 'v1.77.0' });
  assert.equal(where(bare, 'CODE-REVIEW-issue-068-2026-08-12.md'), 'нет трейлера ни в одной линии');
  assert.equal(where(bare, 'notes.md'), 'вне схемы имён');
  const resolved = archivePlan({
    names, lines, open: [600], through: 'v1.77.0',
    addedIn: new Map([['CODE-REVIEW-issue-068-2026-08-12.md', 'v1.76.0'], ['notes.md', 'v1.76.0']]),
  });
  assert.equal(where(resolved, 'CODE-REVIEW-issue-068-2026-08-12.md'), `${ARCHIVE_DIR}/v1.76.0/CODE-REVIEW-issue-068-2026-08-12.md`);
  assert.equal(where(resolved, 'notes.md'), 'вне схемы имён');
  // Тег добавления вне архивируемых линий (бета, будущая линия) — не повод переносить.
  const future = archivePlan({ names, lines, open: [600], through: 'v1.77.0', addedIn: new Map([['CODE-REVIEW-issue-068-2026-08-12.md', 'v1.78.0']]) });
  assert.equal(where(future, 'CODE-REVIEW-issue-068-2026-08-12.md'), 'нет трейлера ни в одной линии');
  const report = renderPlan({ ...bare, through: 'v1.77.0' });
  assert.match(report, /переносится 8 \(задач 3\), остаётся 4/);
  assert.match(report, /CODE-REVIEW-issue-068-2026-08-12\.md — нет трейлера/);
});

test('#682 архив: линии — только стабильные теги не новее границы', () => {
  assert.deepEqual(
    stableTagsThrough(['v1.78.0-beta.1', 'v1.77.0', 'v1.76.0', 'v1.10.0', 'v1.9.0', 'v1.78.0', 'x'], 'v1.77.0'),
    ['v1.9.0', 'v1.10.0', 'v1.76.0', 'v1.77.0'],
  );
  assert.throws(() => stableTagsThrough([], 'v1.78.0-beta.1'), /not a stable release tag/);
  assert.throws(() => archivePlan({ names: [], lines: [{ tag: 'v1.78.0', issues: [] }], open: [], through: 'v1.77.0' }), /newer than/);
});

// Ревью #682 r1 (Medium): перенос добавляет уровень вложенности, и относительные
// ссылки внутри перенесённых документов и в соседях, которые на них ссылаются,
// ломались молча — ни один гейт не смотрит в архив.
const tree = new Set([
  'docs/specs/089-stage1.md',
  'docs/reviews/CODE-REVIEW-635-r1.md',
  'legacy/reviews/v1.77.0/CODE-REVIEW-594-r1.md',
  'legacy/reviews/v1.77.0/CODE-REVIEW-594-r2.md',
  'legacy/reviews/v1.68.0/SPEC-REVIEW-262-r1.md',
  'legacy/specs/262-readd.md',
]);
const exists = (path) => tree.has(path);
const moved = new Map([
  ['docs/reviews/CODE-REVIEW-594-r1.md', 'legacy/reviews/v1.77.0/CODE-REVIEW-594-r1.md'],
  ['docs/reviews/CODE-REVIEW-594-r2.md', 'legacy/reviews/v1.77.0/CODE-REVIEW-594-r2.md'],
  ['docs/reviews/SPEC-REVIEW-262-r1.md', 'legacy/reviews/v1.68.0/SPEC-REVIEW-262-r1.md'],
  ['docs/specs/262-readd.md', 'legacy/specs/262-readd.md'],
]);

test('#682 r1 ссылки: перенесённый документ пересчитывает свои ссылки от нового места', () => {
  const result = repairLinks({
    text: 'ТЗ: [s](../specs/089-stage1.md#ac2); прошлый раунд: [r1](CODE-REVIEW-594-r1.md); сайт: [x](https://example.org/a.md)',
    path: 'legacy/reviews/v1.77.0/CODE-REVIEW-594-r2.md',
    oldPath: 'docs/reviews/CODE-REVIEW-594-r2.md',
    moved, exists,
  });
  assert.equal(result.text, 'ТЗ: [s](../../../docs/specs/089-stage1.md#ac2); прошлый раунд: [r1](CODE-REVIEW-594-r1.md); сайт: [x](https://example.org/a.md)');
  assert.equal(result.fixed, 1);
});

test('#682 r1 ссылки: сосед, ссылавшийся на перенесённый документ, ведёт в архив', () => {
  const live = repairLinks({ text: '[r1](CODE-REVIEW-594-r1.md)', path: 'docs/reviews/CODE-REVIEW-635-r1.md', moved, exists });
  assert.equal(live.text, '[r1](../../legacy/reviews/v1.77.0/CODE-REVIEW-594-r1.md)');
  // Ссылка, уже переписанная прошлым переносом (ТЗ ушло в legacy/specs раньше документа ревью).
  const spec = repairLinks({
    text: '[r](../../docs/reviews/SPEC-REVIEW-262-r1.md)', path: 'legacy/specs/262-readd.md', oldPath: 'docs/specs/262-readd.md', moved, exists,
  });
  assert.equal(spec.text, '[r](../reviews/v1.68.0/SPEC-REVIEW-262-r1.md)');
});

test('#682 r1 ссылки: битая и до переноса ссылка не «чинится» наугад', () => {
  const result = repairLinks({ text: '[x](...), [y](nowhere.md)', path: 'legacy/reviews/v1.72.0/CODE-REVIEW-448-r2.md', oldPath: 'docs/reviews/CODE-REVIEW-448-r2.md', moved, exists });
  assert.equal(result.fixed, 0);
  assert.equal(result.text, '[x](...), [y](nowhere.md)');
});

test('#682 r1 архив legacy/: относительные ссылки резолвятся (кроме известных «...»-заглушек)', () => {
  const broken = brokenLinks({ roots: ['legacy/reviews', 'legacy/specs'] }).filter((item) => item.target !== '...');
  assert.deepEqual(broken, []);
});

test('#839 link audit ignores literal code but still reports real missing links, even in quotations', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'hp-review-links-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', cwd]);
  mkdirSync(join(cwd, 'legacy/reviews/v1.80.1'), { recursive: true });
  const path = 'legacy/reviews/v1.80.1/CODE-REVIEW-839-r1.md';
  const text = [
    '`[inline](inline-missing.md)` and ``a ` tick [code](double-missing.md)``',
    '```md', '[fenced](fenced-missing.md)', '```',
    '~~~~markdown', '[tilde](tilde-missing.md)', '~~~', '[still fenced](still-missing.md)', '~~~~',
    '[exists](../../../present.md)',
    '[real](real-missing.md#anchor)',
    '> [quoted but clickable](quoted-missing.md)',
    '`unclosed paragraph', '', '[between paragraphs](paragraph-missing.md)', '', 'another `unclosed paragraph',
    '`unclosed tick [real too](unclosed-missing.md)',
  ].join('\n');
  writeFileSync(join(cwd, path), text);
  writeFileSync(join(cwd, 'present.md'), '# Present');
  execFileSync('git', ['-C', cwd, 'add', '.']);
  assert.deepEqual(brokenLinks({ cwd, roots: ['legacy/reviews'] }), [
    { path, target: 'real-missing.md#anchor' }, { path, target: 'quoted-missing.md' },
    { path, target: 'paragraph-missing.md' }, { path, target: 'unclosed-missing.md' },
  ]);
});

test('#839 archive repair preserves examples verbatim while repairing neighbouring real links', () => {
  const example = '`[example](CODE-REVIEW-594-r1.md)`\n~~~md\n[fenced](CODE-REVIEW-594-r1.md)\n~~~\n';
  const source = example + '[actual `code` label](CODE-REVIEW-594-r1.md)';
  const result = repairLinks({ text: source, path: 'docs/reviews/CODE-REVIEW-635-r1.md', moved, exists });
  assert.equal(result.text, example + '[actual `code` label](../../legacy/reviews/v1.77.0/CODE-REVIEW-594-r1.md)');
  assert.equal(result.fixed, 1);
});
