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
// Observe the real template's current-state value without a browser or source regex.
function currentHint(part) {
  if (!part || typeof part !== 'object') return undefined;
  if (Array.isArray(part.strings)) {
    const index = part.strings.findIndex(s => s.includes('<code>'));
    if (index >= 0) return part.values[index];
  }
  for (const child of Array.isArray(part) ? part : part.values || []) {
    const hint = currentHint(child);
    if (hint !== undefined) return hint;
  }
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
    assert.equal(currentHint(view), scenario.hiddenHint ? undefined : '—');
  });
}

test('#978 owned live states and exact entity binding without registry keep the real hint', () => {
  for (const [binding, registry] of [
    ['device:own', ownRegistry()],
    ['entity:sensor.anchor', ownRegistry()],
    [`entity:${eid}`, {}],
  ]) {
    for (const state of ['washing', 'off', 'unknown', 'unavailable']) {
      const states = { 'sensor.anchor': { state: 'idle' }, [eid]: { state } };
      assert.equal(currentHint(render(draft(binding), registry, states)), state);
    }
    assert.equal(currentHint(render(draft(binding), registry, {})), '—');
  }
});

test('#978 ownership and disable changes recheck the form despite cached candidate indexing', () => {
  for (const invalidate of [
    registry => { registry.entities[eid].device_id = 'other'; },
    registry => { registry.entities[eid].disabled_by = 'user'; },
  ]) {
    const registry = ownRegistry();
    assert.equal(currentHint(render(draft(), registry, { [eid]: { state: 'washing' } })), 'washing');
    invalidate(registry);
    let forbiddenReads = 0;
    const states = {};
    Object.defineProperty(states, eid, { get() { forbiddenReads++; throw new Error('stale authority'); } });
    assert.equal(currentHint(render(draft(), registry, states)), '—');
    assert.equal(forbiddenReads, 0);
  }
});

test('#978 Auto never looks up an empty saved source', () => {
  const states = { [eid]: { state: 'washing' }, 'sensor.anchor': { state: 'idle' } };
  Object.defineProperty(states, '', { get() { throw new Error('empty source read'); } });
  for (const stateSource of [undefined, null]) {
    const view = render(Object.freeze({ binding: 'device:own', stateSource }), ownRegistry(), states);
    assert.equal(currentHint(view), undefined);
  }
});
