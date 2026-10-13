import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverConfigWriteConflict } from '../test-build/config-write-conflict.js';

test('#612 AC1: a View conflict reloads without an editor runtime or exception', async () => {
  const events = [];

  assert.doesNotThrow(() => recoverConfigWriteConflict(null, () => {
    events.push('reload');
  }));

  assert.deepEqual(events, ['reload']);
});

test('#612: an editor conflict cancels its draft before reloading', () => {
  const events = [];
  recoverConfigWriteConflict(
    { _cancelPath: () => events.push('cancel') },
    () => { events.push('reload'); },
  );

  assert.deepEqual(events, ['cancel', 'reload']);
});

// #842 К4/К5: the marker Save cancels a pending deferred write whose content
// its candidate carries. A rolled-back rejection re-arms that write once; a
// conflict, a newer edit or reload, and an accepted config never do.
const { editorWriteHarness, markerDraft, settle } = await import('./helpers/editor-write-host.mjs');

function markerWithPendingEdit(t, reject, { pending = true } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const marker = { id: 'v_842', binding: 'virtual', name: 'Lamp', space: 'f1', area: null, room_id: null, hidden: false };
  const h = editorWriteHarness({
    config: { spaces: [{ id: 'f1', title: 'Floor', rooms: [] }], markers: [marker], settings: {} },
    reject, marker,
  });
  if (pending) {
    // An independent edit waiting for its deferred write (e.g. a decor gesture).
    h.host._serverCfg.settings.show_room_tooltip = false;
    h.runtime._saveConfig();
  }
  h.host._markerDialog = markerDraft(marker, { name: 'Lamp renamed' });
  return h;
}

test('#842 AC4 marker: a rejected Save re-arms the pending edit once; it is then written by one config/set', async (t) => {
  const h = markerWithPendingEdit(t, (_config, n) => (n === 1 ? new Error('offline') : null));
  await h.runtime._saveMarker();
  await settle();
  assert.deepEqual(h.rollbacks, [true]);
  assert.equal(h.host._saveConfigDebounced.pending(), true, 'the cancelled deferred write is armed again');
  t.mock.timers.tick(500);
  await settle();
  assert.equal(h.server.sets.length, 2, 'the rejected Save, then exactly one restored write');
  assert.equal(h.server.sets[1].settings.show_room_tooltip, false, 'the independent edit is saved');
  assert.equal(h.server.sets[1].markers[0].name, 'Lamp', 'the dialog draft is not');
  assert.equal(h.host._markerDialog?.name, 'Lamp renamed');
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(h.server.sets.length, 2, 'no further write');
});

test('#842 AC4 marker: without a pending edit a rejection arms nothing', async (t) => {
  const h = markerWithPendingEdit(t, () => new Error('offline'), { pending: false });
  await h.runtime._saveMarker();
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(h.server.sets.length, 1);
  assert.equal(h.host._saveConfigDebounced.arms, 0);
});

test('#842 AC4 marker: a revision conflict restores nothing — the reload policy owns the config', async (t) => {
  const h = markerWithPendingEdit(t, (_config, n) => (n === 1
    ? Object.assign(new Error('changed elsewhere'), { code: 'conflict' }) : null));
  h.server.config.settings = { theirs: true };
  h.server.rev = 5;
  await h.runtime._saveMarker();
  await settle();
  assert.deepEqual(h.rollbacks, [false], 'the reload replaced the attempt');
  assert.equal(h.host._serverCfg.settings.theirs, true, 'the authoritative config is adopted');
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(h.server.sets.length, 1, 'no restored write over the newer config');
});

test('#842 AC5: a late rejection after a newer local edit rolls nothing back and restores nothing', async (t) => {
  let release;
  const h = markerWithPendingEdit(t, null);
  h.server.reject = (_config, n) => (n === 1 ? new Error('late') : null);
  const send = h.host._sendConfigCandidate.bind(h.host);
  h.host._sendConfigCandidate = async (candidate) => {
    await new Promise((resolve) => { release = resolve; });
    return send(candidate);
  };
  const saving = h.runtime._saveMarker();
  await settle();
  h.host._serverCfg.settings.newer = 'local'; // a newer edit lands while Save is in flight
  release();
  await saving;
  await settle();
  assert.deepEqual(h.rollbacks, [false]);
  assert.equal(h.host._serverCfg.settings.newer, 'local', 'the newer edit is not rolled back');
  assert.equal(h.host._saveConfigDebounced.pending(), false, 'and no older deferred write is restored over it');
});

test('#842 AC5: the restored write sends the live config of its own moment, and teardown sends it once', async (t) => {
  const h = markerWithPendingEdit(t, (_config, n) => (n === 1 ? new Error('offline') : null));
  await h.runtime._saveMarker();
  await settle();
  h.host._serverCfg.settings.later = 'edit after the rejection';
  h.host._saveConfigDebounced.flush(); // disconnectedCallback → flush()
  await settle();
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(h.server.sets.length, 2, 'teardown sends the restored write exactly once');
  assert.equal(h.server.sets[1].settings.later, 'edit after the rejection', 'live config of that moment');
  assert.equal(h.server.sets[1].settings.show_room_tooltip, false);
});

test('#842 AC5: a layout/update failure after the accepted config keeps the marker and restores nothing', async (t) => {
  const marker = { id: 'v_new', binding: 'virtual', name: '', space: 'f1', area: null, room_id: null, hidden: false };
  const h = markerWithPendingEdit(t, null);
  // A new virtual marker places its icon by layout/update after config/set.
  h.host._markerDialog = markerDraft(marker, { devId: null, name: 'New icon', room: '' });
  h.host._normPos = (space, x, y) => ({ s: space, x, y });
  h.host._roomCenter = () => [0, 0];
  h.host.hass = { callWS: async (message) => {
    if (message.type === 'houseplan/layout/update') throw new Error('layout unavailable');
    return { rev: 1 };
  } };
  await h.runtime._saveMarker();
  await settle();
  assert.equal(h.server.sets.length, 1);
  assert.ok(h.host._serverCfg.markers.some((item) => item.name === 'New icon'), 'the accepted marker stays');
  assert.deepEqual(h.rollbacks, [], 'no rollback after acceptance');
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(h.server.sets.length, 1, 'the pending edit travelled with the accepted config — nothing restored');
  assert.equal(h.server.sets[0].settings.show_room_tooltip, false);
});
