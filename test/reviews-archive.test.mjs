// #682: архив документов ревью выпущенных линий — кому куда, решают трейлеры.
import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCHIVE_DIR, LIVE_DIR, archivePlan, renderPlan, stableTagsThrough } from '../scripts/reviews-archive.mjs';

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
