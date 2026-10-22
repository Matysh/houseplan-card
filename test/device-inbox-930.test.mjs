import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDeviceInbox, filterDeviceInbox, applyInboxVisibility, INBOX_NO_SPACE } from '../test-build/device-inbox.js';
import { markerDeletionCandidate, deleteInboxSelection } from '../test-build/marker-deletion.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';

const spaces = [
  { id: 'a', title: 'A', rooms: [{ id: 'ra', area: 'shared' }, { id: 'ra2', area: 'unique' }] },
  { id: 'b', title: 'B', rooms: [{ id: 'rb', area: 'shared' }] },
];
const base = { devices: [], markers: [], candidates: [], statuses: new Map(), newDeviceIds: new Set(),
  showHiddenOnPlan: false, spaces, spaceNames: { a: 'A', b: 'B' }, spaceByArea: { shared: 'b' } };
const candidate = (id, areaId) => ({ value: `device:${id}`, label: id, kind: 'device', ref: id, areaId, model: '', sub: '' });
test('930 filter: ambiguous/absent Area is unassigned; explicit placement wins and deleted space is not guessed', () => {
  const rows = buildDeviceInbox({ ...base, candidates: [candidate('ambiguous', 'shared'), candidate('single', 'unique'), candidate('none', '')],
    markers: [{ id: 'v1', binding: 'virtual', space: 'a', area: 'shared', name: 'Virtual one' },
      { id: 'v2', binding: 'virtual', space: 'gone', area: 'unique' },
      { id: 'old', binding: 'device:old', removed: true, space: 'a' }],
  });
  assert.equal(rows.find(r => r.key === 'device:ambiguous').spaceId, '');
  assert.equal(rows.find(r => r.key === 'device:single').spaceId, 'a');
  assert.equal(rows.find(r => r.key === 'virtual:v1').spaceId, 'a');
  assert.equal(rows.find(r => r.key === 'virtual:v2').spaceId, '');
  assert.deepEqual(filterDeviceInbox(rows, 'available', '', false, 'space:a').map(r => r.key), ['device:single']);
  assert.equal(filterDeviceInbox(rows, 'available', '', false, INBOX_NO_SPACE).length, 2);
  assert.equal(filterDeviceInbox(rows, 'on_plan', 'one', false, 'space:b').length, 0);
  assert.equal(filterDeviceInbox(rows, 'on_plan', 'one', false, 'space:a').length, 1);
});
test('930 virtual Hide/Show is ID-scoped and a missing virtual target creates nothing', () => {
  const markers = [{ id: 'v1', binding: 'virtual', hidden: false }, { id: 'v2', binding: 'virtual', hidden: true }];
  const rows = buildDeviceInbox({ ...base, markers });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => r.key).sort(), ['virtual:v1', 'virtual:v2']);
  const result = applyInboxVisibility(markers, [rows.find(r => r.key === 'virtual:v1')], true, () => { throw Error('no ID allocation'); });
  assert.equal(result.changed, 1);
  assert.deepEqual(result.markers.find(m => m.id === 'v2'), markers[1]);
  assert.equal(result.markers.length, 2);
  assert.equal(applyInboxVisibility(markers, [{ binding: 'virtual', markerId: 'absent' }], true, () => 'bad').changed, 0);
  assert.equal(markers[0].hidden, false);
  const rebound = [{ id: 'v1', binding: 'device:new', hidden: false }];
  assert.deepEqual(applyInboxVisibility(rebound, [{ binding: 'virtual', markerId: 'v1' }], true, () => 'bad'),
    { markers: rebound, changed: 0 });
});
test('930 newer tombstone refuses deletion even while the prior runtime snapshot is retained', () => {
  const input = { ...base, devices: [{ id: 'old', bindingKind: 'device', bindingRef: 'old', name: 'Old', space: 'a' }],
    markers: [{ id: 'old', binding: 'device:old', removed: true, hidden: true }] };
  assert.deepEqual(buildDeviceInbox(input), []);
  const [row] = buildDeviceInbox({ ...input, candidates: [candidate('old', 'unique')] });
  assert.equal(row.category, 'readd');
  assert.equal(row.canDelete, false);
  assert.equal(row.canFind, false);
});
test('930 Area index is built once for 2000 rows, including duplicate rooms of one space', () => {
  let areaReads = 0;
  const rooms = Array.from({ length: 20 }, (_, id) => ({ id: `r${id}`, get area() { areaReads++; return 'unique'; } }));
  const rows = buildDeviceInbox({ ...base, spaces: [{ id: 'a', rooms }],
    candidates: Array.from({ length: 2000 }, (_, id) => candidate(`bulk_${id}`, 'unique')) });
  assert.equal(rows.length, 2000);
  assert.ok(rows.every(row => row.spaceId === 'a'));
  assert.equal(areaReads, rooms.length, 'room membership is indexed once, never scanned per candidate');
});
const config = () => ({ spaces: [{ ...structuredClone(spaces[0]), led_strips: [{ id: 'led', marker: 'v1', active: false, points: [[0, 0], [1, 1]] }] }],
  markers: [{ id: 'v1', binding: 'virtual' }, { id: 'v2', binding: 'virtual', controls: ['marker:v1', 'light.retained'] },
    { id: 'ha', binding: 'device:d', name: 'HA' }, { id: 'child', binding: 'entity:sensor.child' }],
  settings: { unknown_compatible: { nested: 1 } } });
test('930 deletion candidate is immutable, leaves exact HA tombstone and retains virtual/child/LED neighbours', () => {
  const cfg = config(), before = structuredClone(cfg);
  const targets = [{ id: 'v1', binding: 'virtual' }, { id: 'ha', binding: 'device:d' }];
  const { candidate: next, cleanupIds } = markerDeletionCandidate(cfg, targets);
  assert.deepEqual(cfg, before);
  assert.deepEqual([...cleanupIds].sort(), ['ha', 'v1']);
  assert.equal(next.markers.some(m => m.id === 'v1'), false);
  assert.deepEqual(next.markers.find(m => m.id === 'v2').controls, ['light.retained']);
  assert.deepEqual(next.markers.find(m => m.id === 'ha'), { id: 'ha', binding: 'device:d', hidden: true, removed: true });
  assert.deepEqual(next.markers.find(m => m.id === 'child'), before.markers[3]);
  assert.deepEqual(next.spaces[0].led_strips[0], { ...before.spaces[0].led_strips[0], marker: null, active: true });
  const one = markerDeletionCandidate(cfg, [targets[0]]).candidate;
  assert.deepEqual(markerDeletionCandidate(one, [targets[1]]).candidate, next);
  next.settings.unknown_compatible.nested = 2;
  assert.equal(cfg.settings.unknown_compatible.nested, 1);
});

function harness() {
  let resolve;
  const calls = [], toasts = [], toastIds = [];
  const host = { _serverCfg: config(), _canEdit: true, _kiosk: false, isConnected: true,
    _deviceInbox: { tab: 'on_plan', search: '', onlyNew: false, limit: 100, selected: ['virtual:v1'] },
    hass: { connection: {}, user: { id: 'owner' }, callWS: async msg => { calls.push(msg.type); return {}; } },
    _configWriteContext: new ConfigWriteContext(), _regSignature: '', _deviceInboxMemo: null,
    _layout: { v1: { x: .2, y: .2, s: 'a' } }, _defPos: {}, _dirtyPos: new Set(), _sentPos: new Map(),
    _activityRt: new Map(), _vacRt: new Map(), _vacSrvTrails: {}, _infoCard: null,
    _devicePositionHistory: { clear() {} }, _cancelDeviceDrag() {}, _maybeRebuildDevices() {},
    _showToast: (text,id) => {toasts.push(text);toastIds.push(id);}, _t: key => key, _errText: error => error.message,
    _noteLayoutRev() {}, _saveConfigDebounced: { pending: () => false, cancel() {} },
    _confirmDanger: () => new Promise(done => { resolve = done; }),
    _rollbackOptimistic(attempt) {
      if (host._serverCfg !== attempt.next) return false;
      host._serverCfg = attempt.before; return true;
    },
  };
  host._configWriteContext.observe(host.hass);
  const runtime = { host, navigationIntent: 0,
    _prepareConfigCandidate: cfg => cfg,
    _stageOptimisticConfig: (before, next) => { host._serverCfg = next; return { before, next }; },
    _saveConfigNow: async () => { calls.push('config/set'); },
  };
  let rows = buildDeviceInbox({ ...base, markers: host._serverCfg.markers }).filter(r => r.key === 'virtual:v1');
  return { runtime, host, calls, toasts, toastIds, accept: () => resolve(true), cancel: () => resolve(false),
    rows: () => rows, setRows: value => { rows = value; } };
}
test('930 Cancel/replaced dialog/moved target/lost rights/foreign HA write nothing', async () => {
  for (const scenario of ['cancel', 'reopen', 'move', 'rights', 'foreign']) {
    const h = harness(), before = structuredClone(h.host._serverCfg);
    const pending = deleteInboxSelection(h.runtime, h.rows, 'All');
    if (scenario === 'cancel') h.cancel();
    else {
      if (scenario === 'reopen') h.host._deviceInbox = { ...h.host._deviceInbox, busy: undefined };
      if (scenario === 'move') h.setRows(h.rows().map(row => ({ ...row, spaceId: 'b' })));
      if (scenario === 'rights') h.host._canEdit = false;
      if (scenario === 'foreign') { h.host.hass = { ...h.host.hass, connection: {} }; h.host._configWriteContext.observe(h.host.hass); }
      h.accept();
    }
    await pending;
    assert.deepEqual(h.calls, [], scenario);
    assert.deepEqual(h.host._serverCfg, before, scenario);
    if (scenario==='move'||scenario==='rights') assert.deepEqual(h.toastIds,['device_inbox.selection_changed']);
  }
});
test('930 config refusal restores entire LED/control graph, preserves selection and cleans no files/position', async () => {
  const h = harness(), before = structuredClone(h.host._serverCfg);
  h.runtime._saveConfigNow = async () => { throw Error('refused'); };
  const pending = deleteInboxSelection(h.runtime, h.rows, 'A'); h.accept(); await pending;
  assert.deepEqual(h.host._serverCfg, before);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.host._deviceInbox.selected, ['virtual:v1']);
  assert.ok(h.host._layout.v1);
});
test('930 success writes once before cleanup and removes only target', async () => {
  const h = harness();
  const pending = deleteInboxSelection(h.runtime, h.rows, 'A'); h.accept(); await pending;
  assert.deepEqual(h.calls, ['config/set', 'houseplan/layout/delete', 'houseplan/files/cleanup', 'houseplan/trail/delete']);
  assert.deepEqual(h.host._deviceInbox.selected, []);
  assert.equal(h.host._layout.v1, undefined);
  assert.ok(h.host._serverCfg.markers.find(m => m.id === 'v2'));
  assert.deepEqual(h.toastIds,['device_inbox.batch_deleted']);
});

test('930 late success never closes or clears a replacement catalog', async () => {
  const h = harness();
  let finishWrite;
  h.runtime._saveConfigNow = () => new Promise(resolve => { finishWrite = resolve; });
  const pending = deleteInboxSelection(h.runtime, h.rows, 'A'); h.accept();
  await Promise.resolve();
  const replacement = { tab: 'hidden', search: 'new search', selected: ['virtual:v2'] };
  h.host._deviceInbox = replacement;
  finishWrite(); await pending;
  assert.equal(h.host._deviceInbox, replacement);
  assert.deepEqual(replacement.selected, ['virtual:v2']);
});

test('930 refused write cannot roll back a newer authoritative configuration', async () => {
  const h = harness();
  const fresh = { ...config(), settings: { fromAnotherClient: true } };
  h.runtime._saveConfigNow = async () => { h.host._serverCfg = fresh; throw Error('conflict'); };
  const pending = deleteInboxSelection(h.runtime, h.rows, 'A'); h.accept(); await pending;
  assert.equal(h.host._serverCfg, fresh);
  assert.deepEqual(h.calls, []);
  assert.ok(h.host._layout.v1);
});
