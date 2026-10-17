// #892: actual settings/cleanup/Apply input, held public HA responses and
// independent foreign config/layout pairs. No action/private-state injection.
import { launch, check, finish } from './serve.mjs';

const out = {};
const settings = page => page.locator('hp-dialog[data-kind="settings"][icon="mdi:cog-outline"]');
const optimize = page => page.locator('hp-dialog[data-kind="settings"][icon="mdi:broom"]');
async function open(page) {
  if (!await settings(page).count()) await page.locator('[data-hp="settings"]').click();
  await settings(page).locator('[data-section-target="data"]').click();
  await settings(page).locator('button:has(ha-icon[icon="mdi:broom"])').click();
  await optimize(page).waitFor();
  await page.evaluate(() => window.__hpTest.settled());
}
async function seed(page, positions) {
  await open(page);
  const pair = await page.evaluate(() => ({ config: structuredClone(window.__card._alignDialog.config),
    layout: structuredClone(window.__card._alignDialog.layout) }));
  await optimize(page).locator('.btn[data-hp="dialog-cancel"]').click();
  await page.evaluate(async ({ pair, positions }) => {
    const hp = window.__hpTest;
    await hp.waitForWrites(); await hp.setServerConfig(pair.config);
    await hp.setLayout({ ...pair.layout, ...positions }); await hp.waitForWrites();
  }, { pair, positions });
  return pair;
}

// Retained-only is a discoverable disabled action, not an absent action.
{
  const { page, browser } = await launch({ width: 1100, height: 900 });
  try {
    await seed(page, { future_widget: { s: 'deleted', x: 0.25, y: 0.5, future: true } });
    await open(page);
    const button = optimize(page).locator('.optimize-invalid-cleanup');
    const count = await button.count();
    check('retainedOnly:disabledCleanupControlRemainsDiscoverable', count === 1 && await button.isDisabled());
    check('retainedOnly:reasonAndRecordsRemainHonest',
      /no records.*safely|нет записей.*безопасно/i.test(await optimize(page).innerText())
      && await page.evaluate(() => !!window.__card._alignDialog.layout.future_widget
        && window.__card._alignDialog.report.invalidPositionsRetained.length > 0));
  } finally { await browser.close(); }
}

for (const kind of ['state', 'connection', 'user']) {
  const { page, browser } = await launch({ width: 1100, height: 900 });
  try {
    const positions = { grp_context: { s: 'deleted', x: 0.25, y: 0.5, k: 1.6 } };
    const original = await seed(page, positions);
    await open(page); await optimize(page).locator('.optimize-invalid-cleanup').click();
    await page.evaluate(() => {
      const card = window.__card, base = card.hass;
      window.__892Hold = { writes: [], adopted: [], entered: false };
      card.hass = { ...base, callWS: async message => {
        if (message.type !== 'houseplan/plan/optimize') return base.callWS(message);
        window.__892Hold.writes.push(structuredClone(message));
        const reply = await base.callWS(message);
        window.__892Hold.entered = true;
        await new Promise(resolve => { window.__892Hold.release = resolve; });
        return reply;
      } };
    });
    await optimize(page).locator('[data-hp="dialog-confirm"]').click();
    await page.waitForFunction(() => window.__892Hold.entered);
    check(`${kind}:onlyOneExplicitApplyWasSent`, await page.evaluate(() => window.__892Hold.writes.length), 1);
    await page.evaluate(async ({ kind, original, positions }) => {
      const card = window.__card, base = card.hass;
      if (kind === 'state') {
        card.hass = { ...base, states: { ...base.states, 'sensor.context_tick': {
          entity_id: 'sensor.context_tick', state: '1', attributes: {} } } };
      } else {
        const { createFixtureStore } = await import('/fixture-state.js');
        const config = structuredClone(original.config);
        config.spaces[0].title = `Independent ${kind} authority`;
        const listeners = new Map();
        const server = createFixtureStore(config, { ...original.layout, ...positions }, (event, rev) => {
          for (const callback of listeners.get(event) || []) callback({ event_type: event, data: { rev } });
        });
        const connection = kind === 'connection' ? {
          subscribeEvents: async (callback, event) => {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(callback);
            return () => listeners.get(event).delete(callback);
          }, subscribeMessage: async () => () => {},
        } : base.connection;
        window.__892Hold.bReads = [];
        card.hass = { ...base, connection,
          user: kind === 'user' ? { ...base.user, id: `${base.user.id}-foreign892` } : base.user,
          callWS: async message => {
            window.__892Hold.bReads.push(message.type);
            if (message.type === 'config/device_registry/list') return Object.values(base.devices);
            if (message.type === 'config/entity_registry/list') return Object.values(base.entities);
            if (message.type === 'config_entries/get') return [{ entry_id: 'ce_demo', domain: 'demo', title: 'Synthetic Home' }];
            return server.handle(message) ?? { ok: true };
          },
        };
      }
      await window.__hpTest.settled();
      card.hass = { ...card.hass }; // ordinary next HA frame, not requestUpdate.
    }, { kind, original, positions });
    if (kind !== 'state') {
      await page.waitForFunction(kind => {
        const card = window.__card;
        return card._loadOk && card._cfgRev === 1 && card._layoutRev === 1
          && card._serverCfg?.spaces?.[0]?.title === `Independent ${kind} authority`;
      }, kind);
      check(`${kind}:foreignPairActuallyAcceptedBeforeRelease`, await page.evaluate(() =>
        window.__892Hold.bReads.includes('houseplan/config/get')
          && window.__892Hold.bReads.includes('houseplan/layout/get')));
    }
    await page.evaluate(async () => { window.__892Hold.release(); await window.__hpTest.settled(); });
    const snapshot = await page.evaluate(() => ({ title: window.__card._serverCfg?.spaces?.[0]?.title,
      position: structuredClone(window.__card._layout.grp_context), cfgRev: window.__card._cfgRev,
      layoutRev: window.__card._layoutRev, canUndo: window.__card._canOptimizeUndo }));
    out[kind] = snapshot;
    if (kind === 'state') {
      check('state:ordinaryFrameStillAdoptsItsOwnConfirmedCleanup',
        !snapshot.position && snapshot.canUndo && snapshot.cfgRev > 1 && snapshot.layoutRev > 1);
    } else {
      check(`${kind}:retiredReplyCannotReplaceCurrentPair`, snapshot,
        { title: `Independent ${kind} authority`, position: positions.grp_context,
          cfgRev: 1, layoutRev: 1, canUndo: false });
    }
  } finally { await browser.close(); }
}

// A real General settings Save owns _writeChain; Apply must wait for it and
// reject its old consent after that write and a public HA owner arrival.
{
  const { page, browser } = await launch({ width: 1100, height: 900 });
  try {
    const owner = 'bb892000000000000000000000000000';
    const positions = { [owner]: { s: 'deleted', x: 0.25, y: 0.5 },
      grp_pending: { s: 'deleted', x: 0.5, y: 0.5 } };
    await seed(page, positions);
    await page.evaluate(() => {
      const card = window.__card, base = card.hass;
      window.__892Pending = { entered: false, writes: [] };
      card.hass = { ...base, callWS: async message => {
        if (message.type === 'houseplan/config/set' && !window.__892Pending.entered) {
          window.__892Pending.entered = true;
          await new Promise(resolve => { window.__892Pending.release = resolve; });
        }
        if (message.type === 'houseplan/plan/optimize') window.__892Pending.writes.push(structuredClone(message));
        return base.callWS(message);
      } };
    });
    await settings(page).locator('[data-section-target="display"]').click();
    await settings(page).locator('#gs-room-tooltip').click();
    await settings(page).locator('.btn[data-hp="dialog-confirm"]').click();
    await page.waitForFunction(() => window.__892Pending.entered);
    await open(page); await optimize(page).locator('.optimize-invalid-cleanup').click();
    await optimize(page).locator('[data-hp="dialog-confirm"]').click();
    await page.evaluate(() => window.__hpTest.settled());
    check('pending:realSettingsWriteBlocksApplyTransport', await page.evaluate(() =>
      window.__card._writesPending > 0 && window.__card._alignDialog.busy
        && window.__892Pending.writes.length === 0));
    await page.evaluate(async owner => {
      const card = window.__card;
      card.hass = { ...card.hass, devices: { ...card.hass.devices,
        [owner]: { id: owner, name: 'New current HA owner', area_id: 'a1', config_entries: ['ce_demo'] } } };
      await window.__hpTest.settled();
    }, owner);
    await page.waitForFunction(owner => !!window.__card._haRegistry.devices[owner], owner);
    await page.evaluate(() => window.__892Pending.release());
    await page.waitForFunction(() => window.__card._alignDialog && !window.__card._alignDialog.busy);
    check('pending:acceptedWriteAndOwnerArrivalRequireFreshConsent', await page.evaluate(owner => {
      const card = window.__card, d = card._alignDialog;
      return window.__892Pending.writes.length === 0 && !d.removeInvalidMissingPositions
        && d.report.liveMissingPositions.some(item => item.id === owner)
        && !!card._layout[owner] && !!card._layout.grp_pending;
    }, owner));
  } finally { await browser.close(); }
}

for (const direction of ['full-to-partial', 'partial-to-full']) {
  const { page, browser } = await launch({ width: 1100, height: 900 });
  try {
    await seed(page, { grp_proof: { s: 'deleted', x: 0.25, y: 0.5 } });
    await page.evaluate(() => {
      const card = window.__card, base = card.hass;
      window.__892Roster = { writes: [] };
      card.hass = { ...base, callWS: async message => {
        if (message.type === 'houseplan/plan/optimize') window.__892Roster.writes.push(structuredClone(message));
        return base.callWS(message);
      } };
    });
    const registryAccess = async allowed => {
      await page.evaluate(async allowed => {
        const card = window.__card;
        window.__setRegistryAccess(allowed ? 'full' : 'limited');
        // Existing public HA-fixture event: preserve the actual Area value,
        // but deliver a real device-registry update to its subscriptions.
        window.__setRegistryArea('device', 'd_light1', card.hass.devices.d_light1.area_id);
        await window.__hpTest.settled();
      }, allowed);
      await page.waitForFunction(allowed => window.__card._haRegistry.authoritative === allowed, allowed);
    };
    if (direction === 'partial-to-full') await registryAccess(false);
    await open(page); await optimize(page).locator('.optimize-invalid-cleanup').click();
    await registryAccess(direction === 'partial-to-full');
    await optimize(page).locator('[data-hp="dialog-confirm"]').click();
    await page.evaluate(() => window.__hpTest.settled());
    check(`${direction}:changedActualRegistryProofClearsConsentWithoutWrite`, await page.evaluate(() =>
      window.__892Roster.writes.length === 0 && !window.__card._alignDialog.removeInvalidMissingPositions
        && !!window.__card._layout.grp_proof));
  } finally { await browser.close(); }
}

// GUI Undo and cold card instances share one canonical fixture store. This
// small paired wire adapter is synthetic persistence, not an HA implementation
// or validator: real authenticated backend tests own storage/ACL/recovery.
{
  const { page, browser } = await launch({ width: 1100, height: 900 });
  try {
    const position = { s: 'deleted', x: 0.25, y: 0.5, k: 1.6 };
    await seed(page, { grp_persistence: position });
    await page.evaluate(async () => {
      const { createFixtureStore } = await import('/fixture-state.js');
      const card = window.__card, original = card.hass;
      const listeners = new Map();
      const store = createFixtureStore(card._serverCfg, card._layout, (event, rev) => {
        for (const callback of listeners.get(event) || []) callback({ event_type: event, data: { rev } });
      });
      let backup = null;
      window.__892Persistence = { writes: [], reads: [] };
      const connection = {
        subscribeEvents: async (callback, event) => {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event).add(callback);
          return () => listeners.get(event).delete(callback);
        }, subscribeMessage: async () => () => {},
      };
      const wire = { ...original, connection, callWS: async message => {
        const observation = window.__892Persistence;
        if (message.type === 'houseplan/plan/optimize' || message.type === 'houseplan/plan/optimize_undo') {
          if (message.expected_config_rev !== store.configRev || message.expected_layout_rev !== store.layoutRev)
            throw Object.assign(new Error('synthetic paired CAS conflict'), { code: 'conflict' });
          observation.writes.push(structuredClone(message));
          if (message.type === 'houseplan/plan/optimize') {
            backup = { config: store.handle({ type: 'houseplan/config/get' }).config,
              layout: store.handle({ type: 'houseplan/layout/get' }).layout };
            store.pushConfig(message.config); store.pushLayout(message.layout);
          } else {
            if (!backup) throw Object.assign(new Error('synthetic undo unavailable'), { code: 'conflict' });
            store.pushConfig(backup.config); store.pushLayout(backup.layout); backup = null;
          }
          return { ok: true, config_rev: store.configRev, layout_rev: store.layoutRev, can_undo: !!backup };
        }
        if (message.type === 'houseplan/config/get') {
          observation.reads.push(message.type);
          return { ...store.handle(message), can_optimize_undo: !!backup, undo_kind: backup ? 'optimize' : null };
        }
        if (message.type === 'houseplan/layout/get') observation.reads.push(message.type);
        if (message.type === 'config/device_registry/list') return Object.values(original.devices);
        if (message.type === 'config/entity_registry/list') return Object.values(original.entities);
        if (message.type === 'config_entries/get') return [{ entry_id: 'ce_demo', domain: 'demo', title: 'Synthetic Home' }];
        return store.handle(message) ?? original.callWS(message);
      } };
      window.__892Persistence.wire = wire;
      window.__892Persistence.cardOptions = { ...card._config };
      card.hass = wire;
      await window.__hpTest.settled(); card.hass = { ...wire };
    });
    await page.waitForFunction(() => window.__card._loadOk
      && window.__card._cfgRev === 1 && window.__card._layoutRev === 1);
    await open(page); await optimize(page).locator('.optimize-invalid-cleanup').click();
    await optimize(page).locator('[data-hp="dialog-confirm"]').click();
    await page.waitForFunction(() => window.__card._canOptimizeUndo && !window.__card._layout.grp_persistence);
    const remount = async revision => {
      const before = await page.evaluate(() => window.__892Persistence.reads.length);
      await page.evaluate(() => {
        const state = window.__892Persistence, old = window.__card;
        const parent = old.parentElement; old.remove();
        const card = document.createElement('houseplan-card');
        card.setConfig(state.cardOptions); parent.appendChild(card);
        window.__card = card; card.hass = state.wire;
      });
      await page.waitForFunction(({ before, revision }) => {
        const card = window.__card, reads = window.__892Persistence.reads.slice(before);
        return card._loadOk && card._cfgRev === revision && card._layoutRev === revision
          && reads.includes('houseplan/config/get') && reads.includes('houseplan/layout/get');
      }, { before, revision });
    };
    await remount(2);
    check('persistence:coldInstanceReadsDeletedRecordAndLiveUndo', await page.evaluate(() =>
      !window.__card._layout.grp_persistence && window.__card._canOptimizeUndo));
    await page.locator('[data-hp="settings"]').click();
    await settings(page).locator('[data-section-target="data"]').click();
    await settings(page).locator('button:has(ha-icon[icon="mdi:undo-variant"])').click();
    await page.waitForFunction(() => !window.__card._optimizeUndoBusy && !!window.__card._layout.grp_persistence);
    check('persistence:actualGuiUndoRestoresWholeRecord', await page.evaluate(() =>
      structuredClone(window.__card._layout.grp_persistence)), position);
    await remount(3);
    check('persistence:secondColdInstanceReadsRestoredRecord', await page.evaluate(() =>
      ({ position: structuredClone(window.__card._layout.grp_persistence), canUndo: window.__card._canOptimizeUndo })),
    { position, canUndo: false });
    await open(page);
    check('persistence:undoRestoresDiagnosticWithoutImplicitSecondCleanup', await page.evaluate(() =>
      window.__card._alignDialog.report.invalidPositionsEligible.some(item => item.id === 'grp_persistence')
        && !window.__card._alignDialog.removeInvalidMissingPositions
        && window.__892Persistence.writes.length === 2));
    out.persistence = await page.evaluate(() => window.__892Persistence.writes.map(message => message.type));
  } finally { await browser.close(); }
}
await finish(null, out);
