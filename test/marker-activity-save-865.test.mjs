import test, { after } from 'node:test';
import assert from 'node:assert/strict';

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
globalThis.window = { customCards: [] };
after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else delete globalThis.window; });
const { HouseplanEditorRuntime } = await import('../test-build/houseplan-editor-runtime.js');

// Execute the production save/draft methods. The port substitutes only the
// server transport, unrelated geometry preparation and post-save UI teardown.
function fixture(display = 'badge', save = async () => {}) {
  const marker = { id: 'v_865', binding: 'virtual', name: 'Presence', space: 'f1', area: null,
    display, ripple_color: '#123456', ripple_size: 3 };
  const space = { id: 'f1', vb: [0, 0, 100, 100], rooms: [] };
  const cfg = { version: 8, spaces: [space], markers: [marker] };
  const draft = { devId: marker.id, binding: 'virtual', bindingMode: 'virtual', room: '',
    name: marker.name, icon: '', display, rippleColor: marker.ripple_color, rippleSize: 3,
    size: 1, angle: 0, tapAction: 'info', controls: [], pdfs: [], glowRadius: '',
    model: '', link: '', description: '', busy: false };
  let closed = 0, payload;
  const toasts = [];
  const host = { _markerDialog: draft, _serverCfg: cfg, _cfgRev: 1,
    _markers: cfg.markers, _devices: [{ id: marker.id, space: 'f1', marker }],
    _layout: { v_865: { s: 'f1', x: 10, y: 10 } }, _space: 'f1', _defPos: {},
    _spaceModelById: () => space, _spaceModel: () => space, _bindingEntities: () => [],
    _adoption: { beginOptimistic: (base, candidate) => ({ base, candidate }) },
    _saveConfigDebounced: { pending: () => false }, _maybeRebuildDevices: () => {},
    requestUpdate: () => {}, _showToast: text => toasts.push(text), _t: (key, values) => values ? `${key}: ${values.err}` : key, _errText: String,
    _rollbackOptimistic: attempt => { host._serverCfg = attempt.base; },
    _cancelDeviceDrag: () => {}, _devicePositionHistory: { clear: () => {} },
    hass: { callWS: async () => ({ rev: 2 }) }, _noteLayoutRev: () => {},
  };
  const runtime = Object.create(HouseplanEditorRuntime.prototype);
  Object.assign(runtime, { host, _effectiveMarkerTapAction: () => 'info', _effectiveStoredTapAction: () => 'info',
    _prepareConfigCandidate: candidate => candidate,
    _saveConfigNow: async attempt => { payload = attempt.candidate; await save(); },
    _closeMarkerDialog: () => { closed++; host._markerDialog = null; },
  });
  return { runtime, host, draft, payload: () => payload, closed: () => closed, toasts };
}

test('#865 actual draft/save payload retains activity settings in every display', async () => {
  for (const display of ['badge', 'icon_ripple', 'value', 'static_icon', 'value_static_icon']) {
    const f = fixture(display);
    const draftMarker = f.runtime._markerDraft(f.draft);
    assert.equal(draftMarker.ripple_color, '#123456', `${display} preview draft`);
    assert.equal(draftMarker.ripple_size, 3, `${display} preview draft`);
    await f.runtime._saveMarker();
    const saved = f.payload()?.markers.find(m => m.id === 'v_865');
    assert.equal(saved?.ripple_color, '#123456', `${display} save`);
    assert.equal(saved?.ripple_size, 3, `${display} save`);
    assert.equal(f.closed(), 1);
  }
});

test('#865 failed Save retains editable color/size and rolls back the candidate', async () => {
  const f = fixture('icon_ripple', async () => { throw new Error('synthetic save failure'); });
  const before = f.host._serverCfg;
  await f.runtime._saveMarker();
  assert.ok(f.payload(), 'failure is after the real save transport was called');
  assert.equal(f.host._serverCfg, before);
  assert.equal(f.host._markerDialog.rippleColor, '#123456');
  assert.equal(f.host._markerDialog.rippleSize, 3);
  assert.equal(f.host._markerDialog.busy, false);
  assert.equal(f.closed(), 0);
});

test('#865 LED presentation keeps dormant activity settings and the unchanged shape', async () => {
  const f = fixture('static_icon');
  const strip = { id: 'led865', points: [[0.1, 0.1], [0.3, 0.1]], marker: 'v_865', active: true };
  f.host._serverCfg.spaces[0].led_strips = [strip];
  await f.runtime._saveMarker();
  assert.deepEqual(f.payload().spaces[0].led_strips, [strip]);
  assert.equal(f.payload().markers[0].ripple_color, '#123456');
  assert.equal(f.payload().markers[0].ripple_size, 3);
});

test('#865 late success/failure does not close or rewrite the next dialog', async () => {
  for (const failed of [false, true]) {
    let release, entered;
    const pending = new Promise(resolve => { entered = resolve; });
    const f = fixture('icon_ripple', () => { entered(); return new Promise((resolve, reject) => {
      release = () => failed ? reject(new Error('late failure')) : resolve();
    }); });
    const saving = f.runtime._saveMarker(); await pending;
    // Even reopening the SAME marker is a new transaction, not the old owner.
    const next = { ...f.draft, rippleColor: '#abcdef', rippleSize: 4, busy: true };
    f.host._markerDialog = next;
    release(); await saving;
    if (!failed) assert.deepEqual(f.toasts, ['toast.marker_saved']);
    assert.equal(f.host._markerDialog, next, failed ? 'late failure' : 'late success');
    assert.equal(f.closed(), 0);
  }
});
