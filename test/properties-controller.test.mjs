import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePropertiesNumber, samePropertiesValue, propertiesIdentityKey,
  PropertiesFieldController, PropertiesCommandLane,
} from '../test-build/editors/properties/controller.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const identity = id => ({ spaceId: 'f', editor: 'decor', kind: 'rect', objectId: id });
function setup() {
  const state = { identity: identity('a'), authority: {}, fields: { x: 10, y: 21 }, commits: [], focus: [], delay: null };
  const controller = new PropertiesFieldController({
    identity: () => state.identity, authority: () => state.authority,
    read: (_id, key) => state.fields[key], parse: (_key, raw) => parsePropertiesNumber(raw, { min: 0, max: 100 }),
    commit: async (id, key, value, before, current) => {
      if (state.delay) await state.delay.promise;
      if (!current()) return { ok: false, error: { key: 'external_change' } };
      state.commits.push({ id, key, value, before }); state.fields[key] = value;
      return { ok: true };
    }, changed() {}, focus: key => state.focus.push(key),
  });
  return { state, controller };
}

test('#931 complete numeric token, finite range and existing unit converter, without clamping', () => {
  for (const raw of ['', ' ', '12cm', '1,2,3', '0x10', 'Infinity', 'NaN', '1e999', '+']) {
    assert.equal(parsePropertiesNumber(raw).ok, false, raw);
  }
  assert.deepEqual(parsePropertiesNumber(' 12,5 ', { convert: n => n * 2.54 }), { ok: true, value: 31.75 });
  assert.equal(parsePropertiesNumber('-1', { min: 0 }).error.key, 'range');
  assert.equal(parsePropertiesNumber('101', { max: 100 }).error.key, 'range');
  assert.deepEqual(parsePropertiesNumber('0', { min: 0, max: 100 }), { ok: true, value: 0 });
  assert.equal(parsePropertiesNumber('1', { convert: () => NaN }).ok, false);
});

test('#931 field equality preserves absence/null and selection includes floor/editor/binding', () => {
  assert.equal(samePropertiesValue(undefined, null), false);
  assert.equal(samePropertiesValue({ c: '#123456', a: 0 }, { a: 0, c: '#123456' }), true);
  assert.equal(samePropertiesValue({ c: '#123456' }, { c: '#123456', a: undefined }), false);
  assert.notEqual(propertiesIdentityKey(identity('a')), propertiesIdentityKey({ ...identity('a'), spaceId: 'b' }));
  assert.notEqual(propertiesIdentityKey(identity('a')), propertiesIdentityKey({ ...identity('a'), binding: 'entity:light.b' }));
});

test('#931 Enter and subsequent blur share one commit; no-op, invalid and Esc write nothing', async () => {
  const { state, controller: c } = setup();
  state.delay = deferred(); c.edit('x', '20');
  const enter = c.finish(), blur = c.finish(); assert.equal(enter, blur);
  state.delay.resolve(); assert.equal(await enter, true);
  assert.equal(state.commits.length, 1); assert.equal(state.fields.y, 21); assert.equal(c.draft, null);
  c.edit('x', '20'); assert.equal(await c.finish(), true); assert.equal(state.commits.length, 1);
  c.edit('x', '101'); assert.equal(await c.finish(), false); assert.equal(state.commits.length, 1);
  assert.equal(c.draft.error.key, 'range'); assert.deepEqual(state.focus, ['x']);
  assert.equal(c.cancel(), true); assert.equal(c.draft, null); assert.equal(state.commits.length, 1);
});

test('#931 unrelated remote fields preserve draft; a changed edited field cannot silently rebase', async () => {
  const { state, controller: c } = setup(); c.edit('x', '30');
  state.fields.y = 99; c.sync(); assert.equal(c.draft.raw, '30'); assert.equal(c.draft.error, null);
  state.fields.x = 11; c.sync(); assert.equal(c.draft.error.key, 'external_change');
  assert.equal(await c.finish(), false); assert.equal(state.commits.length, 0);
  c.cancel(); c.edit('x', '30'); assert.equal(await c.finish(), true); assert.equal(state.fields.y, 99);
});

test('#931 queued and late replies cannot write or clear another object/user/binding', async () => {
  for (const retire of [s => { s.identity = identity('b'); }, s => { s.authority = {}; },
    s => { s.identity = { ...s.identity, binding: 'entity:light.other' }; }, s => { s.identity = null; }]) {
    const { state, controller: c } = setup(); state.delay = deferred(); c.edit('x', '30');
    const pending = c.finish(); await Promise.resolve(); retire(state); c.sync();
    if (state.identity) c.edit('y', '40');
    const replacement = c.draft; state.delay.resolve(); assert.equal(await pending, false);
    assert.equal(state.commits.length, 0); assert.equal(c.draft, replacement);
  }
});

test('#962 an observed same-field conflict stays rejected even after the remote value returns', async () => {
  const { state, controller: c } = setup(); c.edit('x', '30');
  state.fields.x = 11; c.sync();
  state.fields.x = 10; c.sync();
  assert.equal(await c.finish(), false);
  assert.equal(c.draft.error.key, 'external_change');
  assert.equal(c.draft.raw, '30');
  assert.equal(state.fields.x, 10); assert.deepEqual(state.commits, []);
  c.cancel(); c.edit('x', '30');
  assert.equal(await c.finish(), true); assert.equal(state.fields.x, 30);
});

test('#962 finishing a nominal no-op checks current external data before clearing the draft', async () => {
  const { state, controller: c } = setup(); c.edit('x', '10');
  state.fields.x = 11; // Finish must guard even before a read-side sync runs.
  assert.equal(await c.finish(), false);
  assert.equal(c.draft.error.key, 'external_change');
  assert.equal(state.fields.x, 11); assert.deepEqual(state.commits, []);
});

test('#931 draft invalidation revokes a queued callback even if the same identity reappears', async () => {
  const { state, controller: c } = setup(); state.delay = deferred(); c.edit('x', '30');
  const pending = c.finish(); await Promise.resolve(); c.invalidate(); c.edit('x', '40');
  const fresh = c.draft; state.delay.resolve(); assert.equal(await pending, false);
  assert.equal(c.draft, fresh); assert.equal(state.commits.length, 0);
});

test('#931 pending/error field blocks duplicate writes and modal handoff; success opens from fresh data', async () => {
  const { state, controller: c } = setup(); let opened = null;
  c.edit('x', 'bad'); assert.equal(await c.finishThen(() => { opened = state.fields.x; }), false);
  assert.equal(opened, null); c.cancel(); state.delay = deferred(); c.edit('x', '30');
  const openedLater = c.finishThen(() => { opened = state.fields.x; });
  assert.equal(c.edit('x', '40'), false); assert.equal(c.cancel(), false);
  state.delay.resolve(); assert.equal(await openedLater, true); assert.equal(opened, 30);
  assert.equal(state.commits.length, 1);
});

test('#931 one lane retains user order across different transports and survives a failure', async () => {
  const lane = new PropertiesCommandLane(), first = deferred(), result = [];
  const x = lane.run(async () => { await first.promise; result.push('position'); });
  const failed = lane.run(() => { throw Error('refused scale'); });
  const angle = lane.run(() => { result.push('angle'); });
  first.resolve(); await x; await assert.rejects(failed, /refused scale/); await angle;
  assert.deepEqual(result, ['position', 'angle']); await lane.settled();
});

test('#931 a retired transport does not delay or finish bookkeeping for a new owner', async () => {
  const lane = new PropertiesCommandLane(), old = deferred(), events = [];
  const pending = lane.run(async()=>{ events.push('old-start'); await old.promise; events.push('old-end'); });
  assert.deepEqual(events,['old-start'], 'first write begins synchronously like the native layout writer');
  lane.retire(); await lane.run(()=>events.push('new'));
  assert.deepEqual(events,['old-start','new']);
  old.resolve(); await pending; await lane.settled();
  assert.deepEqual(events,['old-start','new','old-end']);
});
