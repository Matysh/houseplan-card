import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../src/editor.ts', import.meta.url), 'utf8');

test('active-space writes go through the fixed-floor mutation boundary', () => {
  const writes = card.match(/this\._space\s*=(?!=)/g) || [];
  assert.equal(writes.length, 1, 'only _commitSpace may assign the active space');
  assert.match(card, /private _commitSpace\(id: string, authority = false\): boolean/);
  assert.match(card, /if \(this\._hasFixedFloor\) return null;[\s\S]*private _saveNav/);
  assert.match(card, /private _saveNav\(\): void \{\s*if \(this\._hasFixedFloor\) return;/);
});

test('GUI clear deletes floor while an existing YAML index survives unrelated edits', () => {
  assert.match(editor, /if \(config\.floor === ''\) delete config\.floor;/);
  assert.match(editor, /else if \(config\.floor === this\._floorToken\) config\.floor = this\._config\?\.floor;/);
  assert.match(editor, /editor\.floor_none/);
  assert.match(editor, /editor\.floor_index/);
});

test('fixed View and kiosk remove every floor-changing affordance', () => {
  assert.match(card, /const navigationSpaces = fixed\.kind === 'valid' \? \[space\] : model;/);
  assert.match(card, /this\._canEdit && !this\._kiosk && !this\._hasFixedFloor/);
  assert.match(card, /!this\._hasFixedFloor && this\._kiosk && this\._zoom <= 1\.001/);
  assert.match(card, /this\._kiosk && !this\._hasFixedFloor && this\._kioskDots/);
});
