import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertOpeningFeatures, clearOpeningBindings, openingTransmissionIntervals,
  reparameterizeOpeningFeatures, resolveOpeningPosition,
} from '../test-build/opening-features.js';
import {transportOpeningOrientations} from '../test-build/opening-orientation.js';

test('#1024 orientation adapter leaves malformed imported records to the existing validator',()=>{
  for(const openings of [null,[null,3,{}],[{id:'bad',type:'window',opening_features:{version:1}}]]){
    const source={openings},after=structuredClone(source);
    assert.doesNotThrow(()=>transportOpeningOrientations(source,after));
    assert.deepEqual(after,source);
  }
});

const window = (count = 2) => ({ id: 'window', type: 'window', x: 0.5, y: 0, length: 0.2, angle: 0,
  opening_features: { version: 1, side: 'negative', leaves: Array.from({ length: count }, (_, i) => ({
    id: `leaf-${i}`, hinge: i % 2 ? 'end' : 'start', manual: 'closed',
    contact: `binary_sensor.leaf_${i}`, shade: { enabled: true, manual: 'open', contact: `cover.shade_${i}` },
  })) } });
const noState = () => null;

test('#1024 v1 accepts 1–4 equal leaves and rejects mixed/future forms without mutation', () => {
  for (const count of [1, 2, 3, 4]) assert.doesNotThrow(() => assertOpeningFeatures(window(count)));
  for (const patch of [{ contact: null }, { invert: false }, { flip_h: false }, { flip_v: false }]) {
    const input = { ...window(), ...patch }, before = structuredClone(input);
    assert.throws(() => assertOpeningFeatures(input), /invalid_opening_features/);
    assert.deepEqual(input, before);
  }
  for (const value of [null, { version: 2 }, { ...window().opening_features, leaves: [] },
    { ...window().opening_features, leaves: window(5).opening_features.leaves },
    { ...window().opening_features, unexpected: true }]) {
    assert.throws(() => assertOpeningFeatures({ ...window(), opening_features: value }));
  }
  const duplicate = window(); duplicate.opening_features.leaves[1].id = 'leaf-0';
  assert.throws(() => assertOpeningFeatures(duplicate));
  for (const type of ['door', 'gate']) {
    assert.doesNotThrow(() => assertOpeningFeatures({ type, opening_features: { version: 1, mechanism: 'slide', manual: 'open', slide_direction: 'end' } }));
    assert.throws(() => assertOpeningFeatures({ ...window(), type }));
  }
  assert.throws(() => assertOpeningFeatures({ ...window(), type: 'passage' }));
});

test('#1024 entity is authoritative; unknown never returns manual or inverted fallback', () => {
  assert.deepEqual(resolveOpeningPosition({ manual: 'closed' }, 'open', noState), { source: 'manual', amount: 0 });
  for (const state of [null, { state: 'unknown' }, { state: 'unavailable', attributes: { current_position: 80 } }]) {
    assert.deepEqual(resolveOpeningPosition({ contact: 'cover.test', manual: 'open', invert: true }, 'open', () => state),
      { source: 'entity', amount: null });
  }
  assert.equal(resolveOpeningPosition({ contact: 'cover.test', invert: true }, 'closed',
    () => ({ state: 'open', attributes: { current_position: '25' } })).amount, 0.75);
  assert.equal(resolveOpeningPosition({ contact: 'binary_sensor.test' }, 'closed', () => ({ state: 'on' })).amount, 1);
  assert.equal(resolveOpeningPosition({}, 'closed', noState).amount, 0);
  assert.equal(resolveOpeningPosition({}, 'open', noState).amount, 1);
});

test('#1024 shades mask only confirmed closed shares; neighbours merge before optical geometry', () => {
  const input = window(4);
  assert.deepEqual(openingTransmissionIntervals(input, noState), [[0, 1]]);
  const read = entity => ({ state: entity.endsWith('_1') ? 'closed' : 'open' });
  assert.deepEqual(openingTransmissionIntervals(input, read), [[0, 0.25], [0.5, 1]]);
  input.opening_features.leaves[1].shade.enabled = false;
  assert.deepEqual(openingTransmissionIntervals(input, read), [[0, 1]]);
  for (const leaf of input.opening_features.leaves) {
    leaf.shade.enabled = true; delete leaf.shade.contact; leaf.shade.manual = 'closed';
  }
  assert.deepEqual(openingTransmissionIntervals(input, noState), []);
  assert.deepEqual(openingTransmissionIntervals({ ...input, opening_features: undefined }, noState), [[0, 1]]);
});

test('#1024 half-turn carries whole leaves/disabled shades once; top and source identity remain', () => {
  const input = window(3), before = structuredClone(input);
  input.opening_features.leaves[1].hinge = 'top';
  input.opening_features.leaves[2].shade.enabled = false;
  const transformed = reparameterizeOpeningFeatures(input, 91);
  assert.equal(transformed.angle, -89);
  assert.equal(transformed.opening_features.side, 'positive');
  assert.deepEqual(transformed.opening_features.leaves.map(x => [x.id, x.hinge]),
    [['leaf-2', 'end'], ['leaf-1', 'top'], ['leaf-0', 'end']]);
  assert.equal(transformed.opening_features.leaves[0].shade.contact, 'cover.shade_2');
  assert.equal(transformed.opening_features.leaves[0].shade.enabled, false);
  assert.deepEqual(reparameterizeOpeningFeatures(transformed, transformed.angle), transformed);
  const restored = reparameterizeOpeningFeatures(transformed, -91);
  assert.deepEqual(restored.opening_features, input.opening_features);
  assert.equal(input.angle, before.angle);
  assert.equal(reparameterizeOpeningFeatures(input, -90).opening_features.side, 'negative');
  assert.equal(reparameterizeOpeningFeatures(input, 90).opening_features.side, 'positive');
  assert.equal(reparameterizeOpeningFeatures(input, 450).opening_features.side, 'positive');
});

test('#1024 copy clears all bindings including disabled shades without changing the source', () => {
  const input = window(), before = structuredClone(input);
  input.opening_features.leaves[0].shade.enabled = false;
  const copy = clearOpeningBindings(input);
  for (const leaf of copy.opening_features.leaves) {
    assert.equal('contact' in leaf, false); assert.equal('contact' in leaf.shade, false);
  }
  assert.equal(copy.opening_features.leaves[0].shade.enabled, false);
  assert.equal(copy.opening_features.leaves[0].manual, 'closed');
  assert.equal(input.opening_features.leaves[0].contact, before.opening_features.leaves[0].contact);
});

test('#1024 an absent active slide direction defaults to end and transfers on a half-turn', () => {
  const input={id:'door',type:'door',angle:89,opening_features:{version:1,mechanism:'slide'}};
  const transformed=reparameterizeOpeningFeatures(input,91);
  assert.equal(transformed.opening_features.slide_direction,'start');
  assert.equal('slide_direction' in input.opening_features,false);
});
