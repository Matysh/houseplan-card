import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const card = readFileSync(new URL('../src/houseplan-card.ts', import.meta.url), 'utf8');
const owner = readFileSync(new URL('../src/device-hit-owner.ts', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles/devices.styles.ts', import.meta.url), 'utf8');

test('#564 wires one semantic owner through pointer, click and hover paths', () => {
  assert.match(card, /private _deviceForPointerEvent[\s\S]*?_deviceHits\.pointer/);
  assert.match(card, /private _deviceForClickEvent[\s\S]*?_deviceHits\.click/);
  assert.match(card, /private _showDeviceTip[\s\S]*?_deviceHits\.hover/);
  assert.match(card, /private _pointerDown[\s\S]*?_deviceHits\.begin/);
  assert.match(card, /private _pointerCancel[\s\S]*?_deviceHits\.cancel/);
  assert.match(owner, /class DeviceHitController[\s\S]*?consumeClick/);
  assert.match(owner, /if \(!\(ev instanceof PointerEvent\)\) return fallback/);
  assert.match(owner, /hover\([\s\S]*?data-hp-device-hover/);
});

test('#564 keeps pointermove on cached screen geometry', () => {
  const move = card.match(/private _pointerMove\([\s\S]*?\n  }\n\n  private _pointerMoveNow/)?.[0] || '';
  assert.match(move, /_deviceForPointerEvent/);
  assert.doesNotMatch(move, /getBoundingClientRect|getComputedStyle|querySelector/);
  assert.match(owner, /private indexFor[\s\S]*?new DeviceHitIndex/);
});

test('#564 paints every real marker face above every invisible 44px floor', () => {
  const root = styles.match(/    \.dev \{[\s\S]*?\n    }/)?.[0] || '';
  const floor = styles.match(/    \.dev::before \{[\s\S]*?\n    }/)?.[0] || '';
  const shell = styles.match(/    \.device-shell \{[\s\S]*?\n    }/)?.[0] || '';
  assert.match(root, /pointer-events: none/);
  assert.match(floor, /pointer-events: auto/);
  assert.match(floor, /z-index: 1/);
  assert.match(shell, /z-index: 2/);
  assert.match(styles, /\.dev\[data-hp-device-hover\]/);
});
