// #624: заморозка текстовых якорей монолита.
//
// 54 тест-файла читают `src/houseplan-card.ts` / `src/houseplan-editor-runtime.ts`
// как текст (напрямую или через `test/houseplan-source.mjs`). Каждый такой
// тест красится на переносе метода из карточки в модуль без единой регрессии
// — и это главная причина, по которой монолит не разбирается: перенос стоит
// дороже, чем оставить как есть. Новые утверждения о монолите доказываются
// экспортом и `test-build` (PROCESS.md §2.7), поэтому список ниже может
// только уменьшаться. Новое имя здесь — не «добавьте в список», а вопрос
// «почему контракт нельзя проверить исполнением».
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/** Признак якоря: имя монолита или общий хелпер-реконструктор в тексте теста. */
export const MONOLITH_ANCHOR_RE = /houseplan-source\.mjs|houseplan-(?:card|editor-runtime)\.ts/;

/** Замороженный список — 2026-09-23, #624. Уменьшать свободно. */
export const FROZEN_TEXT_ANCHOR_TESTS = [
  'bundle-assets.test.mjs', 'card-version.test.mjs', 'check-inputs.test.mjs', 'classify-changes.test.mjs',
  'coincident-partitions.test.mjs', 'color-picker.test.mjs', 'config-adoption-ownership.test.mjs',
  'coordinate-canonicalization.test.mjs', 'coordinate-write-barrier-guard.test.mjs', 'core-file-budget.test.mjs',
  'danger-confirmation.test.mjs', 'data-hp-contract.test.mjs', 'device-hit-owner-contract.test.mjs',
  'device-marker-polish-contract.test.mjs', 'device-position-echo.test.mjs', 'device-presentation-policy.test.mjs',
  'device-presentation.test.mjs', 'devices.test.mjs', 'draft-live-preflight.test.mjs', 'editor-dialog-modules.test.mjs',
  'editor-runtime-loader.test.mjs', 'fixed-floor-contract.test.mjs', 'furniture-assets.test.mjs',
  'furniture-stroke-contract.test.mjs', 'furniture-transform-contract.test.mjs', 'golden-matrix.test.mjs',
  'houseplan-panel.test.mjs', 'hp-dialog-contract.test.mjs', 'i18n.test.mjs', 'isometric-contract.test.mjs',
  'junction-limits.test.mjs', 'mutation-gate.test.mjs', 'native-select-contract.test.mjs', 'near-axis.test.mjs',
  'open-passage-contract.test.mjs', 'optional-space-model-contract.test.mjs', 'paper-scene-contract.test.mjs',
  'performance-contract.test.mjs', 'process-gate.test.mjs', 'rebase-on-dev.test.mjs', 'release-contract.test.mjs',
  'render-device-snapshot.test.mjs', 'resize-production-path.test.mjs', 'review-doc-guard.test.mjs',
  'room-temperature-renderers.test.mjs', 'source-fingerprint.test.mjs', 'summary-panel.test.mjs',
  'support-feedback.test.mjs', 'unified-wall-tool-source.test.mjs', 'version-recovery-card-contract.test.mjs',
  'view-accessibility.test.mjs', 'wall-segment-model.test.mjs', 'wall-union-isolation.test.mjs',
  'writer-fixed-point.test.mjs',
];

/** Файлы, которых нет в замороженном списке, но которые читают монолит текстом. */
export function newTextAnchors(actual, frozen = FROZEN_TEXT_ANCHOR_TESTS) {
  const allowed = new Set(frozen);
  return actual.filter((name) => !allowed.has(name)).sort();
}

export function textAnchorTests(dir) {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.test.mjs') && name !== 'monolith-text-anchors.test.mjs')
    .filter((name) => MONOLITH_ANCHOR_RE.test(readFileSync(join(dir, name), 'utf8')))
    .sort();
}

test('#624 AC4: ни одного нового теста, читающего монолит как текст', () => {
  const dir = fileURLToPath(new URL('./', import.meta.url));
  const actual = textAnchorTests(dir);
  assert.deepEqual(newTextAnchors(actual), [],
    'новый контракт по монолиту доказывается экспортом и test-build, не regex по src/houseplan-card.ts (PROCESS.md §2.7, #624)');
  // Список — верхняя граница, не инвентарь: ушедшие имена не возвращаются.
  assert.ok(actual.length <= FROZEN_TEXT_ANCHOR_TESTS.length);
});

test('#624 AC4: подмена имени и новый файл видны как новые якоря, а не как «столько же»', () => {
  const frozen = ['a.test.mjs', 'b.test.mjs'];
  assert.deepEqual(newTextAnchors(['a.test.mjs', 'b.test.mjs'], frozen), []);
  assert.deepEqual(newTextAnchors(['a.test.mjs'], frozen), [], 'уменьшение свободно');
  // Та же длина, другое имя: сравнение по множеству, не по числу.
  assert.deepEqual(newTextAnchors(['a.test.mjs', 'c.test.mjs'], frozen), ['c.test.mjs']);
  assert.deepEqual(newTextAnchors(['a.test.mjs', 'b.test.mjs', 'c.test.mjs'], frozen), ['c.test.mjs']);
});
