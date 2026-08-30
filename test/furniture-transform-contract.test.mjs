import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../src/houseplan-editor-runtime.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/plan.styles.ts', import.meta.url), 'utf8');

test('#383 furniture uses its continuous signed path without changing shared decor transforms', () => {
  const move = runtime.slice(runtime.indexOf('public _dtMove('), runtime.indexOf('public _dtUp('));
  assert.match(move, /d\.origShape\.kind === 'furniture'[\s\S]*resizeFurnitureTransform\(/);
  assert.match(move, /!ev\.shiftKey, decorCmToUnits\(0\.1/);
  assert.match(move, /furnitureRotationAngle\(d\.angle0, d\.a0, a, ev\.shiftKey\)/);
  assert.match(move, /Existing non-furniture contract: 5° normally, Shift = free/);
  assert.match(move, /resizeDecorBox\([\s\S]*this\.host\._gridPitch, this\.host\._gridPitch/);
});

test('#383 furniture frame alone has four middle handles and a local rotation cursor', () => {
  const frame = card.slice(card.indexOf('private _renderTextFrame('), card.indexOf('private get _furniturePreviewPlacement'));
  assert.match(frame, /const sides:[\s\S]*\[0, -1, 'ns'\][\s\S]*\[-1, 0, 'ew'\]/);
  assert.match(frame, /sh\.kind === 'furniture'/);
  assert.match(frame, /dtfurnitureframe/);
  assert.match(styles, /\.dtfurnitureframe \.dtrot[\s\S]*data:image\/svg\+xml/);
  assert.match(styles, /\.dtframe \.dt-ew \{ cursor: ew-resize; \}/);
});

test('#383 furniture selection halo follows the symbol path and adds 20 physical cm', () => {
  const layer = card.slice(card.indexOf('private _renderDecorLayer('), card.indexOf('// ================= shared editor secondary surface'));
  assert.match(layer, /class="dshape dfurniturehit"/);
  assert.match(layer, /strokeWidth \+ decorCmToUnits\(20, this\._cellCm, this\._gridPitch\)/);
  assert.match(layer, /data-symbol="\$\{sh\.symbol\}" d="\$\{art\.d\}" transform=\$\{tr\}/);
  assert.match(styles, /dtool-select \.decorlayer \.dshape\.dfurniturehit[\s\S]*pointer-events: stroke/);
  assert.doesNotMatch(layer, /dfurniturehit[\s\S]{0,200}bounding-box/);
});

test('#383 properties keep signed fields and checkboxes as one state', () => {
  const dialog = runtime.slice(runtime.indexOf('private _decorFurnitureSizeInput('), runtime.indexOf('public _renderBackdropDialog('));
  assert.match(dialog, /furnitureSignedFieldCm\(/);
  assert.match(dialog, /furnitureSignedFieldValue\(/);
  assert.match(dialog, /decor\.flip_h/);
  assert.match(dialog, /decor\.flip_v/);
  assert.match(dialog, /\?disabled=\$\{invalidFurnitureSize\}/);
});
