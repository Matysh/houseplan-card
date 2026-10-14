import test from 'node:test';
import assert from 'node:assert/strict';

import { cardVersionReloadSafetySnapshot } from '../test-build/version-recovery-card.js';
import { PhysicalBodyGestureRuntime } from '../test-build/physical-body-gesture.js';
import { BackdropFrameGestureRuntime } from '../test-build/backdrop-frame-gesture.js';

const pending = (size = 0) => ({ size });
const debounce = (value = false) => ({ pending: () => value });

function safeHost(overrides = {}) {
  return {
    ownerDocument: { defaultView: null },
    isConnected: true,
    _config: { kiosk: true },
    _hasFixedFloor: false,
    _model: [{ id: 'f1' }, { id: 'f2' }],
    _mode: 'view',
    _editing: false,
    _loadOk: true,
    _loading: false,
    _continuityDataReady: true,
    _resumeSettling: false,
    _connectionWasLost: false,
    _booting: false,
    _bootFading: false,
    _bootSettling: false,
    _bootSoft: false,
    _continuity: {
      hasCompleteFrame: true,
      state: 'steady',
      overlayBlocksInteraction: false,
    },
    _stageEl: { clientWidth: 800, clientHeight: 600 },
    _pointers: pending(),
    _touchContacts: pending(),
    _touchSequenceMultitouch: false,
    _roomPointer: null,
    _panStart: null,
    _panLock: null,
    _pinchStart: null,
    _swipeStart: null,
    _tabDrag: null,
    _tabDragRelease: null,
    _drag: null,
    _deviceDrag: null,
    _rlResize: null,
    _resize: null,
    _editorRuntime: null,
    _opDrag: null,
    _decorDraft: null,
    _decorMove: null,
    _dtDrag: null,
    _furnTouchPending: null,
    _compassDrag: null,
    _viewportGestureDirty: false,
    _devicePositionBusy: false,
    _modeTransitionBusy: false,
    _cameraTransition: { active: false },
    _slide: '',
    _warmModeRequest: 0,
    _writesPending: 0,
    _saveConfigDebounced: debounce(),
    _pendingPhysicalWrites: pending(),
    _persistLayout: debounce(),
    _dirtyPos: pending(),
    _sentPos: pending(),
    _cyclePausedUntil: 0,
    _zoom: 1,
    _editorSecondaryDialogBlocked: false,
    _partitionDeleteDialog: null,
    _roomDeleteDialog: null,
    _backdropGuard: null,
    _vacFit: null,
    _editorSecondary: null,
    _furnPalette: null,
    _decorImagePalette: null,
    ...overrides,
  };
}

test('card adapter baseline is safe only after the full rendered card settles', () => {
  assert.deepEqual(cardVersionReloadSafetySnapshot(safeHost()), {
    connected: true,
    initialFrameSettled: true,
    viewOnly: true,
    surfacesIdle: true,
    configWritesIdle: true,
    physicalWritesIdle: true,
    layoutWritesIdle: true,
    gesturesIdle: true,
    interactionPauseElapsed: true,
    baseZoom: true,
  });
});

test('#861 version reload safety sees both actual gesture owners until their state-only reset', () => {
  const plan = { plan_url: '/plan.svg', plan_aspect: 1 }, partition = { id: 'p', a: [0, 0], b: [100, 0], cm: 10 };
  const common = { queueTarget: {}, point: () => [0, 0], snap: p => p, snapshot: () => null,
    publish() {}, toast() {} };
  const physicalGesture = new PhysicalBodyGestureRuntime({ ...common,
    space: () => ({ partitions: [partition], wall_columns: [] }), storedGeometry: () => null,
    units: () => ({ cellCm: 1, gridPitch: 25 }), commit() {}, select() {}, openDialog() {}, now: () => 0 });
  const backdropGesture = new BackdropFrameGestureRuntime({ ...common, plan: () => plan,
    mode: () => 'decor', tool: () => 'backdrop', gridPitch: () => 25, record() {}, save() {},
    configChanged() {}, formatLength: () => '1 m' });
  const host = safeHost({ _editorRuntime: { physicalGesture, backdropGesture } });
  const pointer = { pointerId: 1, clientX: 0, clientY: 0, stopPropagation() {}, target: null };
  assert.equal(cardVersionReloadSafetySnapshot(host).gesturesIdle, true);
  physicalGesture.begin(pointer, 'partition', 'p');
  assert.equal(cardVersionReloadSafetySnapshot(host).gesturesIdle, false);
  physicalGesture.reset();
  assert.equal(cardVersionReloadSafetySnapshot(host).gesturesIdle, true);
  backdropGesture.begin(pointer);
  assert.equal(cardVersionReloadSafetySnapshot(host).gesturesIdle, false);
  backdropGesture.reset();
  assert.equal(cardVersionReloadSafetySnapshot(host).gesturesIdle, true);
});

test('card adapter maps editor state into the kiosk reload guard', () => {
  for (const overrides of [
    { _config: { kiosk: false } },
    { _mode: 'plan' },
    { _editing: true },
  ]) {
    assert.equal(cardVersionReloadSafetySnapshot(safeHost(overrides)).viewOnly, false);
  }
});

test('card adapter maps blocking surfaces into the kiosk reload guard', () => {
  for (const overrides of [
    { _editorSecondaryDialogBlocked: true },
    { _partitionDeleteDialog: {} },
    { _roomDeleteDialog: {} },
    { _backdropGuard: {} },
    { _vacFit: {} },
    { _editorSecondary: { hasOpenGroup: true } },
    { _furnPalette: {} },
    { _decorImagePalette: {} },
  ]) {
    assert.equal(cardVersionReloadSafetySnapshot(safeHost(overrides)).surfacesIdle, false);
  }
});

test('card adapter maps config writes into the kiosk reload guard', () => {
  assert.equal(cardVersionReloadSafetySnapshot(safeHost({ _writesPending: 1 })).configWritesIdle,
    false);
  assert.equal(cardVersionReloadSafetySnapshot(safeHost({
    _saveConfigDebounced: debounce(true),
  })).configWritesIdle, false);
});

test('card adapter maps interaction pause into the kiosk reload guard', () => {
  assert.equal(cardVersionReloadSafetySnapshot(safeHost({
    _cyclePausedUntil: Date.now() + 60_000,
  })).interactionPauseElapsed, false);
});

test('#894 enlarged non-carousel recovery changes only the zoom predicate', () => {
  const enlarged = { _zoom: 2.4, _config: { kiosk: true, cycle: 0 } };
  assert.equal(cardVersionReloadSafetySnapshot(safeHost(enlarged)).baseZoom, true);
  assert.equal(cardVersionReloadSafetySnapshot(safeHost({ ...enlarged, _config: { kiosk: true, cycle: 10 } })).baseZoom, false);
  assert.equal(cardVersionReloadSafetySnapshot(safeHost({ ...enlarged, _config: { kiosk: false, cycle: 0 } })).viewOnly, false);
  for (const [field, overrides] of [
    ['connected', { isConnected: false }], ['initialFrameSettled', { _loading: true }],
    ['gesturesIdle', { _pointers: pending(1) }], ['surfacesIdle', { _editorSecondaryDialogBlocked: true }],
    ['configWritesIdle', { _writesPending: 1 }], ['physicalWritesIdle', { _pendingPhysicalWrites: pending(1) }],
    ['layoutWritesIdle', { _dirtyPos: pending(1) }], ['interactionPauseElapsed', { _cyclePausedUntil: Date.now() + 60000 }],
  ]) assert.equal(cardVersionReloadSafetySnapshot(safeHost({ ...enlarged, ...overrides }))[field], false, field);
});
