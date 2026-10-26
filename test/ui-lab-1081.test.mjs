import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceFurniturePlacementPress } from '../test-build/furniture-placement-press.js';
import { loadSpacePlanList } from '../test-build/editors/space-plan-list.js';
import { newSpaceDialogDraft } from '../test-build/editors/space-dialog-draft.js';
import { spaceDialogDraftKey } from '../test-build/editors/space-form-state.js';
import { renderPropertiesSelection } from '../test-build/editors/properties/selection.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const flatten = v => v?.strings ? v.strings.map((part, i) => part + flatten(v.values[i])).join('')
  : Array.isArray(v) ? v.map(flatten).join('') : typeof v === 'symbol' ? '' : String(v ?? '');

test('#1081 furniture mouse threshold is 8 CSS pixels Manhattan and crossing is irreversible', () => {
  const press = { sx: 20, sy: 30, cancelled: false };
  advanceFurniturePlacementPress(press, 24, 34);
  assert.equal(press.cancelled, false, 'exact threshold remains a click');
  advanceFurniturePlacementPress(press, 24, 35);
  assert.equal(press.cancelled, true, 'diagonal sum crosses the threshold');
  advanceFurniturePlacementPress(press, 20, 30);
  assert.equal(press.cancelled, true, 'return to origin remains pan');
  const negative = { sx: 0, sy: 0, cancelled: false };
  advanceFurniturePlacementPress(negative, -9, 0);
  assert.equal(negative.cancelled, true);
});

test('#1081 new-space source is manual, list loading preserves edits and cannot dirty the draft', async () => {
  const response = deferred(), draft = newSpaceDialogDraft(false), before = spaceDialogDraftKey(draft);
  assert.equal(draft.source, 'draw'); assert.equal(draft.showBorders, true); assert.equal(draft.showNames, true);
  const host = { _spaceDialog: draft, hass: { callWS: () => response.promise } };
  loadSpacePlanList(host);
  assert.equal(host._spaceDialog.saved, null); assert.equal(host._spaceDialog.savedBusy, true);
  assert.equal(spaceDialogDraftKey(host._spaceDialog), before);
  host._spaceDialog = { ...host._spaceDialog, title: 'My draft', source: 'file' };
  response.resolve({ plans: [{ name: 'one.png', url: '/one.png' }] }); await tick();
  assert.equal(host._spaceDialog.title, 'My draft'); assert.equal(host._spaceDialog.source, 'file');
  assert.equal(host._spaceDialog.saved.length, 1); assert.equal(host._spaceDialog.savedBusy, false);
});

test('#1081 stale, failed and closed plan-list requests never populate another session', async () => {
  const old = deferred(), newer = deferred(), responses = [old, newer];
  const host = { _spaceDialog: newSpaceDialogDraft(false), hass: { callWS: () => responses.shift().promise } };
  loadSpacePlanList(host); host._spaceDialog = newSpaceDialogDraft(false); loadSpacePlanList(host);
  old.resolve({ plans: [{ name: 'stale.png' }] }); await tick();
  assert.equal(host._spaceDialog.saved, null);
  newer.reject(new Error('offline')); await tick();
  assert.deepEqual(host._spaceDialog.saved, []); assert.equal(host._spaceDialog.savedBusy, false);
  const closed = deferred(); host.hass.callWS = () => closed.promise; loadSpacePlanList(host);
  host._spaceDialog = null; closed.resolve({ plans: [{ name: 'late.png' }] }); await tick();
  assert.equal(host._spaceDialog, null);
});

test('#1081 every decor group member reuses exactly its singleton frame, including measured text and lines', () => {
  const members = [
    { id: 'line', kind: 'line', x1: .1, y1: .2, x2: .4, y2: .6 },
    ...['rect', 'ellipse', 'furniture', 'image'].map(kind => ({ id: kind, kind, x: .2, y: .3, w: .1, h: .2, angle: 17 })),
    { id: 'text', kind: 'text', x: .2, y: .4, text: 'Kitchen', angle: 23 },
  ];
  const textBox = { x: 198, y: 379, w: 87, h: 25 };
  const context = { unitPerPx: 1, cellCm: 5, textBox: null, reference: null,
    decorGroup: { text: shape => shape.kind === 'text' ? textBox : null } };
  const group = flatten(renderPropertiesSelection({ kind: 'decor-group', value: members }, context));
  for (const shape of members) {
    const single = flatten(renderPropertiesSelection({ kind: 'decor', value: shape }, { ...context, textBox: context.decorGroup.text(shape) }));
    assert.ok(group.includes(single), shape.kind);
  }
  assert.equal((group.match(/class="hp-prop-selection"/g) || []).length, members.length);
  assert.doesNotMatch(group, /<ellipse|symbol|@pointer/);
});
