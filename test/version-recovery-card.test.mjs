import test from 'node:test';
import assert from 'node:assert/strict';

import { cardVersionReloadSafetySnapshot } from '../test-build/version-recovery-card.js';

const pending = (size = 0) => ({ size });
const debounce = (value = false) => ({ pending: () => value });

function safeHost(overrides = {}) {
  return {
    ownerDocument: { defaultView: null },
    isConnected: true,
    _config: { kiosk: true },
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
    _physicalDrag: null,
    _physicalRotate: null,
    _opDrag: null,
    _decorDraft: null,
    _decorMove: null,
    _dtDrag: null,
    _bdDrag: null,
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
