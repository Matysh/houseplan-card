import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');

test('#361 saved furniture and placement preview share the physical screen resolver', () => {
  const preview = card.slice(
    card.indexOf('private _renderFurniturePlacementPreview('),
    card.indexOf('private _renderDecorLayer('),
  );
  const layer = card.slice(
    card.indexOf('private _renderDecorLayer('),
    card.indexOf('// ================= shared editor secondary surface'),
  );

  assert.match(preview, /furnitureStrokePx\([\s\S]*decorCmToUnits\([\s\S]*furnitureScreenScale/);
  assert.match(preview, /stroke-width=\$\{strokeWidth\}/);
  assert.doesNotMatch(
    preview,
    /stroke-width=\$\{decorCmToUnits/,
    'preview must not bypass the camera-aware furniture resolver',
  );

  assert.match(layer, /const furnitureScreenScale = furniturePlanScreenScale\(/);
  assert.match(layer, /stroke-width="\$\{furnitureStrokePx\(strokeWidth, furnitureScreenScale\)\}"/);
  assert.match(layer, /_renderFurniturePlacementPreview\(furnitureScreenScale\)/);
  assert.equal(
    (layer.match(/const furnitureScreenScale = furniturePlanScreenScale\(/g) || []).length,
    1,
    'the viewport scale is resolved once for the whole decor layer',
  );
});

test('#361 keeps local anisotropic protection and screen-oriented erase hit separate', () => {
  const layer = card.slice(
    card.indexOf('private _renderDecorLayer('),
    card.indexOf('// ================= shared editor secondary surface'),
  );
  assert.ok(
    (layer.match(/vector-effect="non-scaling-stroke"/g) || []).length >= 2,
    'saved and erase paths must keep rejecting the local artwork scale',
  );
  assert.match(layer, /class="dshape derasehit"[\s\S]*vector-effect="non-scaling-stroke"/);
  assert.match(layer, /data-hp="decor"[\s\S]*data-kind="\$\{sh\.kind\}"[\s\S]*data-symbol="\$\{sh\.symbol\}"/);
});
