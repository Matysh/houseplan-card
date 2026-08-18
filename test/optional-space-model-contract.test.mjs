import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');

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
    '_markerDialog = null', '_saveConfigDebounced.cancel()', "_space = ''",
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
});

test('empty render keeps create/import affordances without spatial layers', () => {
  const render = methodBody('render');
  const emptyAt = render.indexOf('if (!model.length)');
  const addAt = render.indexOf("_openSpaceDialog('create')");
  const spatialAt = render.indexOf('const space = this._spaceModel()');
  assert.ok(emptyAt >= 0 && emptyAt < addAt && addAt < spatialAt);
  assert.match(render, /if \(!space\) return nothing;/);
});
