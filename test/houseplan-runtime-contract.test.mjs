import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cardSource = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const secondarySource = readFileSync(new URL('../src/editor-secondary.ts', import.meta.url), 'utf8');

test('split commit materialises the old wall profile before replacing room outlines', () => {
  const materialiseAt = cardSource.indexOf('const splitWalls = wasSplit');
  const mutateAt = cardSource.indexOf('main.poly = this._pendingSplit.mainPoly');
  const normaliseAt = cardSource.indexOf('this._normalizeWalls(splitWalls');
  assert.ok(materialiseAt >= 0 && mutateAt > materialiseAt && normaliseAt > mutateAt);
  assert.match(cardSource.slice(materialiseAt, mutateAt), /materializeWallIntervals\([\s\S]*pendingSplit/);
});

test('spatial glow rejects both wall masonry and independent physical bodies', () => {
  assert.match(
    cardSource,
    /pointInOpaquePlanBody\(sourcePoint, masonryGeometry, physical\)/,
  );
});

test('late editor permission is adopted through the mode state machine', () => {
  assert.doesNotMatch(cardSource, /this\._mode\s*=\s*this\._pendingNavMode/);
  assert.match(cardSource, /this\._pendingNavMode = null;\s*this\._setMode\(pendingMode, false\)/);
});

test('editor navigation stays actionable while transient editor surfaces dismiss', () => {
  assert.match(cardSource, /data-editor-navigation="view"/);
  assert.match(secondarySource, /hasAttribute\('data-editor-navigation'\)/);
  assert.match(secondarySource, /if \(onNavigation\)[\s\S]*return false;/);
});
