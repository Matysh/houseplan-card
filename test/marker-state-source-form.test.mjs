import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkerStateSource } from '../test-build/editors/marker-state-source.js';

const eid = 'sensor.selected';
const ownRegistry = () => ({ entities: {
  'sensor.anchor': { device_id: 'own' },
  [eid]: { device_id: 'own' },
} });
const draft = (binding = 'device:own') => Object.freeze({ binding,
  stateSource: Object.freeze({ entity_id: eid, active_states: Object.freeze(['washing']), future: 'keep' }),
});
// Observe real option values, not source text. The removed manual hint must not
// be the only witness of the own-source read guard inherited from #978.
function* templates(part) {
  if (!part || typeof part !== 'object') return;
  if (Array.isArray(part.strings)) yield part;
  for (const child of Array.isArray(part) ? part : part.values || []) yield* templates(child);
}
function optionState(part, id = eid) {
  const option = [...templates(part)].find(p => p.strings[0].includes('<option value=') && p.values[0] === id);
  return option?.values.at(-1);
}
function render(d, registry, states) {
  let writes = 0;
  const before = structuredClone(d);
  const result = renderMarkerStateSource({ draft: d, registry, hass: { states },
    protectedFace: false, t: key => key, change() { writes++; },
  });
  assert.equal(writes, 0, 'render must not commit or replace a saved source');
  assert.deepEqual(d, before, 'render must preserve the saved block and future keys');
  return result;
}

for (const scenario of [
  { name: 'foreign device source', registry: { entities: { [eid]: { device_id: 'other' } } } },
  { name: 'foreign entity sibling', binding: 'entity:sensor.anchor',
    registry: { entities: { 'sensor.anchor': { device_id: 'own' }, [eid]: { device_id: 'other' } } } },
  { name: 'disabled entity', registry: { entities: { [eid]: { device_id: 'own', disabled_by: 'user' } } } },
  { name: 'disabled parent', registry: { ...ownRegistry(), devices: { own: { disabled_by: 'user' } } } },
  { name: 'pending registry', registry: {} },
  { name: 'sibling without registry evidence', binding: 'entity:sensor.anchor',
    registry: { entities: { 'sensor.anchor': { device_id: 'own' } } } },
  { name: 'entity without an owner', registry: { entities: { [eid]: {} } } },
  { name: 'virtual marker', binding: 'virtual', registry: ownRegistry(), hiddenHint: true },
]) {
  test(`#978 form never reads ${scenario.name}`, () => {
    let forbiddenReads = 0;
    const states = { 'sensor.anchor': { state: 'idle' } };
    Object.defineProperty(states, eid, { get() {
      forbiddenReads++;
      throw new Error(`forbidden state read: ${scenario.name}`);
    } });
    const view = render(draft(scenario.binding), scenario.registry, states);
    assert.equal(forbiddenReads, 0);
    assert.equal(optionState(view), undefined, 'ineligible saved ID must expose no state');
  });
}

test('#978 owned live states and exact entity binding without registry keep real option states', () => {
  for (const [binding, registry] of [
    ['device:own', ownRegistry()],
    ['entity:sensor.anchor', ownRegistry()],
    [`entity:${eid}`, {}],
  ]) {
    for (const state of ['washing', 'off', 'unknown', 'unavailable']) {
      const states = { 'sensor.anchor': { state: 'idle' }, [eid]: { state } };
      assert.equal(optionState(render(draft(binding), registry, states)), state);
    }
    assert.equal(optionState(render(draft(binding), registry, {})), '—');
  }
});

test('#978 ownership and disable changes recheck the form despite cached candidate indexing', () => {
  for (const invalidate of [
    registry => { registry.entities[eid].device_id = 'other'; },
    registry => { registry.entities[eid].disabled_by = 'user'; },
  ]) {
    const registry = ownRegistry();
    assert.equal(optionState(render(draft(), registry, { [eid]: { state: 'washing' } })), 'washing');
    invalidate(registry);
    let forbiddenReads = 0;
    const states = {};
    Object.defineProperty(states, eid, { get() { forbiddenReads++; throw new Error('stale authority'); } });
    assert.equal(optionState(render(draft(), registry, states)), undefined);
    assert.equal(forbiddenReads, 0);
  }
});

test('#978 Auto never looks up an empty saved source', () => {
  const states = { [eid]: { state: 'washing' }, 'sensor.anchor': { state: 'idle' } };
  Object.defineProperty(states, '', { get() { throw new Error('empty source read'); } });
  for (const stateSource of [undefined, null]) {
    const view = render(Object.freeze({ binding: 'device:own', stateSource }), ownRegistry(), states);
    assert.equal(optionState(view), 'washing');
  }
});

test('#979 manual input writes one exact state without changing entity or future fields', () => {
  const d = draft();
  let changed;
  const view = renderMarkerStateSource({ draft: d, registry: ownRegistry(), hass: { states: {} },
    protectedFace: false, t: key => key, change: value => { changed = value; },
  });
  const input = [...templates(view)].find(p => p.strings.join('').includes('@input='));
  assert.ok(input);
  const onInput = input.values.find(v => typeof v === 'function');
  for (const value of ['heating', '', 'unknown', 'ON']) {
    onInput({ target: { value } });
    assert.deepEqual(changed.stateSource, { entity_id: eid, active_states: [value], future: 'keep' });
    assert.equal(changed.stateSourceTouched, true);
    assert.deepEqual(d.stateSource.active_states, ['washing'], 'draft is immutable');
  }
});

test('#979 automatic clears only the condition and entity change clears the previous condition', () => {
  let changed;
  const view = renderMarkerStateSource({ draft: draft(), registry: ownRegistry(), hass: { states: {} },
    protectedFace: false, t: key => key, change: value => { changed = value; },
  });
  const modes = [...templates(view)].find(p => p.strings[0].includes('id="marker-state-source-mode"'));
  const selectMode = modes.values.find(v => typeof v === 'function');
  selectMode({ target: { value: 'standard' } });
  assert.deepEqual(changed.stateSource, { entity_id: eid, future: 'keep' });
  selectMode({ target: { value: 'states' } });
  assert.deepEqual(changed.stateSource.active_states, []);
  const source = [...templates(view)].find(p => p.strings[0].includes('id="marker-state-source"'));
  const selectSource = source.values.find(v => typeof v === 'function');
  selectSource({ target: { value: 'sensor.anchor' } });
  assert.deepEqual(changed.stateSource, { entity_id: 'sensor.anchor' });
  selectSource({ target: { value: '' } });
  assert.equal(changed.stateSource, null);
});
