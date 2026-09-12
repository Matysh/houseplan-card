import assert from 'node:assert/strict';
import test from 'node:test';

import { SUMMARY_PANEL_API_VERSION } from '../test-build/summary-panel-api.js';
import { SUMMARY_PANEL_LEGACY_SCALE_KEY, summaryLocalKey } from '../test-build/summary-panel.js';
import { LoadedSummaryPanelRuntime } from '../test-build/summary-panel-runtime-loaded.js';

const installBrowserGlobals = () => {
  const previous = {
    location: Object.getOwnPropertyDescriptor(globalThis, 'location'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  };
  const values = new Map();
  const reads = [];
  const writes = [];
  Object.defineProperty(globalThis, 'location', {
    configurable: true, value: { pathname: '/dashboard/home' },
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => { reads.push(key); return values.get(key) ?? null; },
      setItem: (key, value) => { writes.push(key); values.set(key, value); },
    },
  });
  return {
    values, reads, writes,
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

test('#561 unresolved Masonry stays session-only and never imports an old DOM-path preference', () => {
  const browser = installBrowserGlobals();
  try {
    const host = hostFixture();
    host.panelHost = false;
    const masonry = { localName: 'hui-masonry-view', parentNode: null, children: [] };
    const column = { localName: 'div', parentNode: masonry, children: [host] };
    masonry.children = [column];
    host.parentNode = column;
    const oldKey = summaryLocalKey({
      userId: 'alice', path: '/dashboard/home', host: 'lovelace',
      slot: 'hui-view:0/hui-masonry-view:0/div:0/houseplan-card:1',
    });
    const canonicalKey = summaryLocalKey({
      userId: 'alice', path: '/dashboard/home', host: 'lovelace', slot: 'masonry-v2:0',
    });
    browser.values.set(oldKey, JSON.stringify({
      version: 1, show: true, icon_scale: 3, font_scale: 3,
    }));
    browser.values.set(SUMMARY_PANEL_LEGACY_SCALE_KEY, JSON.stringify({ icon: 1.2, font: 0.9 }));

    const runtime = new LoadedSummaryPanelRuntime(host);
    runtime.connect();
    assert.deepEqual(browser.reads, [], 'unresolved identity must not read any persistent fallback');
    runtime.saveLocal({ show: true, icon_scale: 1.5 });
    assert.equal(runtime.local.show, true, 'the preference remains effective for this session');
    assert.deepEqual(browser.writes, [], 'unresolved identity must not write any persistent fallback');

    masonry.cards = [host];
    runtime.willUpdate();
    runtime.loadLocal();
    assert.deepEqual(runtime.local, {
      version: 1, show: false, icon_scale: 1.2, font_scale: 0.9,
    }, 'a new canonical key starts from the normal defaults and legacy scale seed');
    assert.equal(browser.reads.includes(oldKey), false, 'the ambiguous legacy DOM key is not migrated');
    assert.equal(browser.values.has(oldKey), true, 'upgrade leaves the old key untouched');
    assert.deepEqual(browser.reads, [canonicalKey, SUMMARY_PANEL_LEGACY_SCALE_KEY]);

    runtime.saveLocal({ show: false });
    assert.deepEqual(browser.writes, [canonicalKey]);
    assert.equal(JSON.parse(browser.values.get(canonicalKey)).show, false);
    runtime.disconnect();
  } finally {
    browser.restore();
  }
});

test('#561 identical Masonry cards reload their own local preferences', () => {
  const browser = installBrowserGlobals();
  const runtimes = [];
  const mount = (columnIndexes) => {
    const hosts = columnIndexes.flat().map(() => {
      const host = hostFixture();
      host.panelHost = false;
      return host;
    });
    const masonry = { localName: 'hui-masonry-view', parentNode: null, children: [], cards: hosts };
    const columns = columnIndexes.map((indexes) => {
      const column = { localName: 'div', parentNode: masonry, children: [] };
      column.children = indexes.map((index) => {
        hosts[index].parentNode = column;
        return hosts[index];
      });
      return column;
    });
    masonry.children = columns;
    return hosts;
  };
  try {
    const values = [
      { version: 1, show: true, icon_scale: 1.25, font_scale: 0.8 },
      { version: 1, show: false, icon_scale: 2.4, font_scale: 1.6 },
    ];
    values.forEach((value, index) => browser.values.set(summaryLocalKey({
      userId: 'alice', path: '/dashboard/home', host: 'lovelace', slot: `masonry-v2:${index}`,
    }), JSON.stringify(value)));

    const wide = mount([[0], [1]]);
    const firstPass = wide.map((host) => {
      const runtime = new LoadedSummaryPanelRuntime(host);
      runtimes.push(runtime);
      runtime.connect();
      return runtime.local;
    });
    assert.deepEqual(firstPass, values);

    runtimes.splice(0).forEach((runtime) => runtime.disconnect());
    const narrow = mount([[0, 1]]);
    const secondPass = narrow.map((host) => {
      const runtime = new LoadedSummaryPanelRuntime(host);
      runtimes.push(runtime);
      runtime.connect();
      return runtime.local;
    });
    assert.deepEqual(secondPass, values, 'new card objects after reload must not exchange preferences');
  } finally {
    runtimes.forEach((runtime) => runtime.disconnect());
    browser.restore();
  }
});

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

test('#509 AC1/AC2/AC9: значение показывает скелет до готовности, ошибку — только для недоступного источника', () => {
  const browser = installBrowserGlobals();
  try {
    const host = hostFixture();
    host._cfgEpoch = 1;
    const runtime = new LoadedSummaryPanelRuntime(host);
    const state = (value) => runtime.valueState(value);
    const deviceCount = { id: 'v1', label: 'Devices', source: { type: 'system', key: 'device_count' } };
    const entity = { id: 'v2', label: 'Lamp', source: { type: 'entity', entity_id: 'light.a' } };

    // AC1: ленивый чанк ещё не пришёл — скелет, а не «источник недоступен».
    assert.deepEqual(state(deviceCount), { kind: 'pending' });
    assert.deepEqual(state(entity), { kind: 'pending' });

    // Модуль пришёл, агрегат ещё не посчитан — по-прежнему скелет.
    runtime.metricsModule = {
      summaryEntityValue: (hass, id) => (id === 'light.a' ? 'On' : null),
      summarySystemValue: (source, values) => (source.key === 'device_count'
        ? (values.deviceCount === null ? null : String(values.deviceCount)) : null),
      representedHaDeviceIds: () => new Set(['d1', 'd2']),
      totalCleanFloorAreaM2: () => 12.5,
      // Порционный расчёт площади (#509): генератор, отдающий управление
      // после каждой комнаты. Здесь — две порции, чтобы проверить и то, что
      // незавершённый расчёт не считается готовым.
      cleanFloorAreaSteps: function* steps() { yield; yield; return 12.5; },
    };
    assert.deepEqual(state(deviceCount), { kind: 'pending' });
    // AC2: живая сущность отвечает сразу; отсутствующая — честная ошибка.
    assert.deepEqual(state(entity), { kind: 'ready', text: 'On' });
    assert.deepEqual(state({ ...entity, source: { type: 'entity', entity_id: 'light.gone' } }), { kind: 'unavailable' });

    // Порция короче полного расчёта не делает значение готовым…
    assert.equal(runtime.advanceMetrics(-1), false, 'бюджет исчерпан — расчёт продолжится');
    assert.equal(runtime.metricsFresh(), false);
    // …а полный проход — делает.
    runtime.computeMetrics();
    assert.deepEqual(state(deviceCount), { kind: 'ready', text: '2' });

    // AC9: конфигурация изменилась — мемо устарело, но на экране остаётся
    // прежнее число, а не скелет; пересчёт запланирован.
    host._cfgEpoch = 2;
    assert.equal(runtime.metricsFresh(), false);
    assert.deepEqual(state(deviceCount), { kind: 'ready', text: '2' });
    runtime.computeMetrics();
    assert.equal(runtime.metricsFresh(), true);
  } finally {
    browser.restore();
  }
});
