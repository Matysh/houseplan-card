import assert from 'node:assert/strict';
import test from 'node:test';

import { SUMMARY_PANEL_API_VERSION } from '../test-build/summary-panel-api.js';
import { summaryLocalKey } from '../test-build/summary-panel.js';
import { LoadedSummaryPanelRuntime } from '../test-build/summary-panel-runtime-loaded.js';

const installBrowserGlobals = () => {
  const previous = {
    location: Object.getOwnPropertyDescriptor(globalThis, 'location'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  };
  const values = new Map();
  Object.defineProperty(globalThis, 'location', {
    configurable: true, value: { pathname: '/dashboard/home' },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
  return {
    values,
    restore() {
      for (const [key, descriptor] of Object.entries(previous)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
};

const hostFixture = () => {
  const root = {
    adoptedStyleSheets: [], firstChild: null,
    querySelector: () => null,
    querySelectorAll: () => [],
    insertBefore: () => undefined,
  };
  return {
    localName: 'houseplan-card', parentNode: null,
    hass: { user: { id: 'alice', name: 'Alice', is_admin: true }, states: {}, config: {} },
    panelHost: true, narrow: false, renderRoot: root,
    ownerDocument: {
      defaultView: undefined, visibilityState: 'visible',
      createElement: () => ({ dataset: {}, textContent: '' }),
    },
    isConnected: true, updateComplete: Promise.resolve(), requestUpdate: () => undefined,
    _mode: 'view', _space: '', _settings: {}, _config: {}, _model: [], _markers: [],
    _serverCfg: { spaces: [], markers: [], settings: {} }, _cfgRev: 0, _cfgEpoch: 0,
    _layoutRev: 0, _cfgContentFingerprint: '', _regSignature: '',
    _signer: { prepareImage: async () => true },
    _continuity: { hasCompleteFrame: false, state: 'steady', note: () => undefined },
    _writesPending: 0, _writeChain: Promise.resolve(), _kiosk: false,
    _kioskScale: { icon: 1, font: 1 }, _haSummaryPanelApi: SUMMARY_PANEL_API_VERSION,
    _canManageConfiguration: true,
    _haRegistry: { authoritative: true, revision: 0, devices: {}, entities: {} },
    _areaToSpace: {}, _stageEl: null,
    _t: (key) => key, _errText: (error) => String(error),
    _confirmDanger: async () => true, _sendConfigCandidate: async () => undefined,
    _getAuthoritativeConfig: async () => ({ config: { spaces: [], markers: [], settings: {} }, rev: 0 }),
    _candidateBackdrop: () => '', _scheduleLoadRetry: () => undefined,
    _beginContinuityCandidate: () => 0, _adoptStructuralResponses: () => ({ configChanged: false }),
    _syncDecorAssets: async () => undefined, _adoptInitialSpace: () => undefined,
    _maybeRebuildDevices: () => undefined, _resumePendingNavMode: () => false,
    _restoreZoom: () => undefined, _reloadConfigOnly: async () => undefined,
    _cacheSnapshot: () => undefined,
  };
};

test('#493 same-key scale remains authoritative and identity changes discard the dialog', async () => {
  const browser = installBrowserGlobals();
  try {
    const host = hostFixture();
    const key = summaryLocalKey({
      userId: 'alice', path: '/dashboard/home', host: 'panel', slot: 'houseplan-card',
    });
    browser.values.set(key, JSON.stringify({
      version: 1, show: true, icon_scale: 2, font_scale: 1.5,
    }));
    const runtime = new LoadedSummaryPanelRuntime(host);
    assert.equal(runtime.applyLocalScaleForCurrentIdentity(), true);
    assert.deepEqual(host._kioskScale, { icon: 2, font: 1.5 });
    host._kioskScale = { icon: 1, font: 1 };
    assert.equal(runtime.applyLocalScaleForCurrentIdentity(), true);
    assert.deepEqual(host._kioskScale, { icon: 2, font: 1.5 });

    runtime.connect();
    await runtime.openDialog();
    assert.equal(runtime.dialogOpen, true);
    host.hass.user = { id: 'bob', name: 'Bob', is_admin: false };
    host._canManageConfiguration = false;
    runtime.updated();
    assert.equal(runtime.dialogOpen, false);
    assert.deepEqual(host._kioskScale, { icon: 1, font: 1 });

    await runtime.openDialog();
    assert.equal(runtime.dialogOpen, true);
    host._kiosk = true;
    runtime.updated();
    assert.equal(runtime.dialogOpen, false, 'kiosk capability change discards the shared draft');
    host._kiosk = false;
    await runtime.openDialog();
    runtime.leaveRoute();
    assert.equal(runtime.dialogOpen, false, 'route leave discards the draft');

    await runtime.openDialog();
    runtime.disconnect();
    assert.equal(runtime.dialogOpen, false);
    runtime.connect();
    await runtime.openDialog();
    assert.equal(runtime.dialogOpen, true, 'reconnect starts a fresh dialog');
  } finally {
    browser.restore();
  }
});

test('#493 active picker keeps stable value ownership across reorder and closes on delete', async () => {
  const browser = installBrowserGlobals();
  try {
    const host = hostFixture();
    const runtime = new LoadedSummaryPanelRuntime(host);
    runtime.connect();
    await runtime.openDialog();
    const block = runtime.dialog.draft.blocks[0];
    const targetId = block.values[0].id;
    const otherId = block.values[1].id;
    runtime.openSource(block.id, targetId);
    runtime.mutate((draft) => { draft.blocks[0].values.reverse(); });
    runtime.setSource(block.id, targetId, 'entity:sensor.target');
    const target = runtime.dialog.draft.blocks[0].values.find((value) => value.id === targetId);
    assert.deepEqual(target.source, { type: 'entity', entity_id: 'sensor.target' });
    assert.equal(runtime.dialog.draft.blocks[0].values.at(-1).id, targetId,
      'the active owner must follow the stable id after reorder');

    runtime.openSource(block.id, otherId);
    runtime.mutate((draft) => {
      draft.blocks[0].values = draft.blocks[0].values.filter((value) => value.id !== otherId);
    });
    assert.equal(runtime.dialog.activeSource, null);
  } finally {
    browser.restore();
  }
});

test('#493 a late save completion cannot adopt UI state into a new user generation', async () => {
  const browser = installBrowserGlobals();
  try {
    const host = hostFixture();
    let releaseWrite;
    let noteSent;
    const sent = new Promise((resolve) => { noteSent = resolve; });
    host._sendConfigCandidate = async () => {
      noteSent();
      await new Promise((resolve) => { releaseWrite = resolve; });
    };
    const runtime = new LoadedSummaryPanelRuntime(host);
    runtime.connect();
    await runtime.openDialog();
    runtime.dialog.draft.title = 'Old user draft';
    const saving = runtime.saveDialog();
    await sent;

    host.hass.user = { id: 'bob', name: 'Bob', is_admin: false };
    host._canManageConfiguration = false;
    runtime.updated();
    releaseWrite();
    await saving;

    assert.equal(runtime.dialogOpen, false);
    assert.equal(host._serverCfg.settings.summary_panel, undefined,
      'the server may accept an in-flight write, but the new UI must reload authority');
    assert.equal(host._writesPending, 0);
  } finally {
    browser.restore();
  }
});

test('#493 late reload and confirmation completions stay outside a new lifecycle', async () => {
  const browser = installBrowserGlobals();
  try {
    const host = hostFixture();
    let releaseReload;
    let reloadStarted;
    host._reloadConfigOnly = async () => {
      reloadStarted();
      await new Promise((resolve) => { releaseReload = resolve; });
    };
    const runtime = new LoadedSummaryPanelRuntime(host);
    runtime.connect();
    await runtime.openDialog();
    const started = new Promise((resolve) => { reloadStarted = resolve; });
    const reloading = runtime.reloadDialog();
    await started;
    host._canManageConfiguration = false;
    runtime.updated();
    releaseReload();
    await reloading;
    assert.equal(runtime.dialogOpen, false);

    host._canManageConfiguration = true;
    runtime.updated();
    await runtime.openDialog();
    let releaseConfirm;
    let confirmationStarted;
    host._confirmDanger = async () => {
      confirmationStarted();
      return new Promise((resolve) => { releaseConfirm = resolve; });
    };
    const confirming = new Promise((resolve) => { confirmationStarted = resolve; });
    const deleting = runtime.deleteBlock(0);
    await confirming;
    host.hass.user = { id: 'bob', name: 'Bob', is_admin: false };
    host._canManageConfiguration = false;
    runtime.updated();
    releaseConfirm(true);
    await deleting;
    assert.equal(runtime.dialogOpen, false);
  } finally {
    browser.restore();
  }
});
