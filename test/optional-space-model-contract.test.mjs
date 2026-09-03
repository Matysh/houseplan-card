import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readHouseplanProductionSource } from './houseplan-source.mjs';

const source = readHouseplanProductionSource();

const methodBody = (name) => {
  const start = source.search(new RegExp(`(?:private|protected)\\s+(?:get\\s+|async\\s+)?${name}(?:\\s*=)?(?:\\(|:)`));
  assert.notEqual(start, -1, `${name} exists`);
  const tail = source.slice(start + 1);
  const next = tail.search(/\n  (?:private|protected|public)\s/);
  return source.slice(start, next < 0 ? source.length : start + 1 + next);
};

test('_spaceModel exposes absence and no call site bypasses it', () => {
  assert.match(source, /private _spaceModel\(\): SpaceModel \| undefined/);
  assert.match(source, /private _spaceModelById\([^)]*\): SpaceModel \| undefined/);
  assert.doesNotMatch(source, /this\._spaceModel\(\s*[^)]/,
    'explicit ids belong to the exact selector');
  assert.doesNotMatch(source, /this\._spaceModel\(\)\s*!/,
    'absence must not be hidden behind a non-null assertion');
  assert.doesNotMatch(source, /this\._spaceModel\(\)\s*\./,
    'every dereference is guarded or uses an intentional empty fallback');
});

test('authoritative empty-space cleanup aborts every space-bound transaction', () => {
  const cleanup = methodBody('_syncEmptySpaceState');
  for (const fragment of [
    'releasePointerCapture', '_pointers.clear()', '_cancelModeTransition(false)',
    "_mode = 'view'", '_clearGeometryGesture()', '_geometryHistory.clear()',
    '_resumeDraftBySpace = {}', '_drag = null', '_vacFit = null',
    '_markerDialog = null', '_saveConfigDebounced.cancel()', "_commitSpace('', true)",
  ]) assert.ok(cleanup.includes(fragment), fragment);

  const willUpdate = methodBody('willUpdate');
  assert.ok(willUpdate.indexOf('_syncEmptySpaceState()')
    < willUpdate.indexOf('_captureRenderDeviceSnapshot()'),
  'cleanup happens before a new render snapshot is captured');
});

test('stable space ids use exact lookup and abort before side effects', () => {
  for (const name of [
    '_livePos', '_vacPlanRoomAnchors', '_vacStartFit', '_labelMove', '_rlResizeMove',
  ]) assert.match(methodBody(name), /_spaceModelById\(/, name);

  const saveMarker = methodBody('_saveMarker');
  const exactAt = saveMarker.indexOf('_spaceModelById(explicitSpaceId)');
  const guardAt = saveMarker.indexOf('if (!targetSpaceModel) return;');
  const busyAt = saveMarker.indexOf('busy: true');
  const migrateAt = saveMarker.indexOf("type: 'houseplan/files/migrate'");
  const configMutationAt = saveMarker.indexOf('cfg.markers = markers');
  assert.ok(exactAt >= 0 && exactAt < guardAt && guardAt < busyAt
    && busyAt < migrateAt && migrateAt < configMutationAt);

  const savePos = methodBody('_savePos');
  const positionExactAt = savePos.indexOf('_spaceModelById(d.space)');
  const layoutMutationAt = savePos.indexOf('this._layout =');
  const dirtyAt = savePos.indexOf('_dirtyPos.add');
  const persistAt = savePos.indexOf('_persistLayout()');
  assert.ok(positionExactAt >= 0 && positionExactAt < layoutMutationAt
    && layoutMutationAt < dirtyAt && dirtyAt < persistAt,
  'stale position writes abort before layout, dirty and persistence side effects');
});

test('empty render keeps create/import affordances without spatial layers', () => {
  // #402: цепочка веток переехала из `render` в `_renderBody`, а `render`
  // стал обёрткой — подтверждение опасного действия обязано жить снаружи
  // веток, иначе в онбординге его не существует вовсе.
  const render = methodBody('_renderBody');
  const emptyAt = render.indexOf('if (!model.length)');
  const addAt = render.indexOf("_openSpaceDialog('create')");
  const spatialAt = render.indexOf('const space = this._spaceModel()');
  assert.ok(emptyAt >= 0 && emptyAt < addAt && addAt < spatialAt);
  assert.match(render, /if \(!space\) return nothing;/);

  // Обёртка: настоящий `nothing` пробрасывается как есть. `noChange` вложен в
  // стабильный shell: так тело остаётся, а соседний confirm можно убрать.
  const wrapper = methodBody('render');
  assert.match(wrapper, /const body = this\._renderBody\(\);/);
  assert.match(wrapper, /if \(body === nothing\) return body;/);
  assert.match(wrapper, /return this\._renderRoot\(body\);/);
  const shell = methodBody('_renderRoot');
  assert.match(shell, /return html`\$\{body\}\$\{this\._renderDangerConfirm\(\)\}`;/);
  assert.equal(render.includes('_renderDangerConfirm'), false,
    'подтверждение не должно возвращаться внутрь ветки — это и есть дефект #402');
});
