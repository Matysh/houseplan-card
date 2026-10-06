/** #804: partial partition promotion through the real room dialog and config/set. */
import { launch, check, finish } from './serve.mjs';

const point = (x, y) => [x / 240, y / 240];
const partition = (id, x1, y1, x2, y2, cm) => ({
  id, a: point(x1, y1), b: point(x2, y2), cm,
});
const room = (id, x1, y1, x2, y2) => ({
  id, name: id, area: null,
  poly: [point(x1, y1), point(x2, y1), point(x2, y2), point(x1, y2)],
});

// Only the reported lattice geometry survives here; no private export or HA data.
// In particular there is NO short overlay carrier on x=74, y=112..133.
function garderoba({ opening = null, duplicate = false } = {}) {
  const rooms = [room('neighbour', 102, 112, 130, 133)];
  rooms[0].wall_ids = ['neighbour-top', 'neighbour-right', 'neighbour-bottom', 'neighbour-left'];
  const wallSegments = [
    partition('neighbour-left', 102, 112, 102, 133, 15),
    partition('neighbour-top', 102, 112, 130, 112, 15),
    partition('neighbour-bottom', 102, 133, 130, 133, 15),
    partition('neighbour-right', 130, 112, 130, 133, 15),
  ];
  // Explicit current-model seed: standalone browser/mutation runs do not need
  // an unrelated test-build compilation just to construct this rectangle.
  const keys = ['0.425000,0.512500@1.5706', '0.483333,0.466667@0.0000',
    '0.483333,0.554167@0.0000', '0.541667,0.512500@1.5706'];
  const config = {
    model_version: 10, markers: [], settings: {},
    spaces: [{
      id: 'lineage', title: 'Lineage', cell_cm: 8, view_box: [0.24, 0.34, 0.36, 0.52],
      rooms, wall_segments: wallSegments,
      walls: wallSegments.map(({ a, b, cm }, index) => ({ key: keys[index], cm, a, b })),
      openings: [],
      partitions: [
        partition('long-source', 74, 90, 74, 200, 25),
        partition('upper-source', 74, 112, 102, 112, 15),
        partition('lower-source', 102, 133, 74, 133, 15),
      ],
    }, {
      id: 'other-floor', title: 'Other floor', cell_cm: 8,
      view_box: [0, 0, 1, 1], rooms: [], wall_segments: [],
      partitions: [partition('untouched-wall', 10, 10, 30, 10, 15)],
    }],
  };
  const space = config.spaces[0];
  if (opening) {
    const y = opening === 'same-residual' ? 101 : opening === 'absorbed' ? 122 : 160;
    space.openings = [{
      id: 'retained-opening', type: 'window', x: 74 / 240, y: y / 240,
      angle: 90, length: 6 / 240, cm: 48,
      host: { kind: 'partition', id: 'long-source', t: (y - 90) / 110 },
      contact: 'binary_sensor.synthetic_window', future_field: { keep: true },
    }];
  }
  if (duplicate) space.wall_segments.push(structuredClone(space.wall_segments[0]));
  return config;
}

function batchConfig() {
  return {
    model_version: 10, markers: [], settings: {},
    spaces: [{
      id: 'lineage', title: 'Lineage', cell_cm: 8, view_box: [0.24, 0.34, 0.30, 0.36],
      rooms: [], wall_segments: [], openings: [],
      partitions: [
        partition('batch-source', 74, 90, 74, 160, 25),
        partition('batch-top', 74, 112, 102, 112, 15),
        partition('batch-divider', 74, 126, 102, 126, 15),
        partition('batch-bottom', 74, 140, 102, 140, 15),
      ],
    }],
  };
}

const results = {};
let lastBrowser;
async function scenario(name, config, body) {
  if (process.env.HP_LINEAGE_SCENARIO && !name.includes(process.env.HP_LINEAGE_SCENARIO)) return;
  console.log(`SCENARIO ${name}`);
  const { page, browser } = await launch({ width: 1280, height: 960 });
  page.setDefaultTimeout(10000);
  lastBrowser = browser;
  try {
    await page.evaluate(async (config) => {
      await window.__hpTest.setServerConfig(config);
      await window.__hpTest.setLayout({});
      await window.__hpTest.switchSpace('lineage');
      await window.__hpTest.setMode('plan');
      await window.__hpTest.setTool('draw');
      // Mode transition owns the stage briefly after the toolbar settles.
      await new Promise((resolve) => setTimeout(resolve, 500));
      await window.__hpTest.settled();
      const card = window.__card;
      const fallback = card.hass.callWS.bind(card.hass);
      const state = {
        saved: structuredClone(card._serverCfg), revision: card._cfgRev,
        attempts: [], accepted: [], rejected: [], reads: 0,
      };
      // A public HA boundary, not a private editor override. The mock actually
      // persists accepted writes and enforces the existing host-kind/id rule.
      card.hass = { ...card.hass, callWS: async (message) => {
        if (message.type === 'houseplan/config/get') {
          state.reads++;
          return { config: structuredClone(state.saved), rev: state.revision, can_write: true };
        }
        if (message.type !== 'houseplan/config/set') return fallback(message);
        const candidate = structuredClone(message.config);
        state.attempts.push(candidate);
        for (const oldSpace of state.saved.spaces || []) {
          const nextSpace = candidate.spaces.find((item) => item.id === oldSpace.id);
          for (const oldOpening of oldSpace.openings || []) {
            if (oldOpening.host?.kind !== 'partition') continue;
            const next = nextSpace?.openings?.find((item) => item.id === oldOpening.id);
            if (next && (next.host?.kind !== 'partition' || next.host.id !== oldOpening.host.id)) {
              state.rejected.push({ opening: oldOpening.id, code: 'invalid_format' });
              throw Object.assign(new Error('surviving partition opening cannot change its host'), {
                code: 'invalid_format',
              });
            }
          }
        }
        state.saved = candidate;
        state.accepted.push(candidate);
        return { ok: true, rev: ++state.revision };
      } };
      window.__lineageSmoke = state;
    }, config);
    const output = await body(page);
    results[name] = output;
    for (const [key, value] of Object.entries(output)) check(`${name}: ${key}`, value);
  } catch (error) {
    console.error(`${name}: ${error.stack || error.message}`);
    console.error('UI state', await page.evaluate(() => ({
      mode: window.__card._mode, tool: window.__card._tool, space: window.__card._space,
      path: window.__card._path, toast: window.__card._toast,
      roomDialog: window.__card._roomDialog, view: window.__card._view,
      dialogs: [...window.__card.renderRoot.querySelectorAll('[data-hp="dialog"]')].map((item) => item.outerHTML.slice(0, 400)),
    })));
    results[name] = { exception: error.message };
    check(`${name}: scenario completed`, false);
  } finally {
    await browser.close();
  }
}

async function clickPoint(page, x, y) {
  const screen = await page.evaluate(([x, y]) => {
    const rect = window.__card.renderRoot.querySelector('.stage').getBoundingClientRect();
    const view = window.__card._view;
    return {
      x: rect.left + (x / 240 * 1000 - view.x) / view.w * rect.width,
      y: rect.top + (y / 240 * 1000 - view.y) / view.h * rect.height,
    };
  }, [x, y]);
  await page.mouse.click(screen.x, screen.y);
  await page.evaluate(() => window.__hpTest.settled());
}

async function decide(page, name, keep = false) {
  const dialog = page.locator('[data-hp="dialog"][data-kind="room"]');
  await dialog.waitFor({ state: 'visible' });
  if (keep) {
    await dialog.locator('[data-hp="dialog-confirm"]').filter({ hasText: 'Keep as walls' }).click();
  } else {
    await dialog.locator('#room-name').fill(name);
    await dialog.locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
  }
  await page.evaluate(() => window.__hpTest.settled());
}

async function settleWrites(page) {
  // The public save path is debounced. Waiting also proves a rejected gesture
  // did not merely postpone a write until after an immediate assertion.
  await page.waitForTimeout(800);
  await page.waitForFunction(() => window.__card._writesPending === 0);
  await page.evaluate(() => window.__hpTest.settled());
}

async function snapshot(page) {
  return page.evaluate(() => ({
    config: structuredClone(window.__card._serverCfg),
    history: window.__card._geometryHistory.size,
    toast: window.__card._toast,
    server: structuredClone(window.__lineageSmoke),
    pendingRooms: window.__card._wallFaceBatch?.candidates.length || 0,
  }));
}

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const geometry = (config) => config.spaces.map((space) => ({
  id: space.id, rooms: space.rooms || [], wall_segments: space.wall_segments || [],
  walls: space.walls || [], partitions: space.partitions || [], openings: space.openings || [],
}));
const uniqueIds = (space) => {
  const segments = [...space.wall_segments || [], ...space.partitions || []];
  const ids = segments.map((item) => item.id);
  const catalog = new Set((space.wall_segments || []).map((item) => item.id));
  return new Set(ids).size === ids.length
    && (space.rooms || []).every((item) => item.wall_ids?.length === item.poly.length
      && item.wall_ids.every((id) => catalog.has(id)));
};

await scenario('Garderoba without workaround', garderoba(), async (page) => {
  const before = await snapshot(page);
  await clickPoint(page, 88, 122);
  await decide(page, 'Garderoba');
  await settleWrites(page);
  const after = await snapshot(page);
  const space = after.config.spaces[0];
  const created = space.rooms.find((item) => item.name === 'Garderoba');
  const residuals = (space.partitions || []).filter((item) => (
    Math.abs(item.a[0] * 240 - 74) < 1e-6 && Math.abs(item.b[0] * 240 - 74) < 1e-6
  ));
  const out = {
    roomCreated: !!created && space.rooms.length === before.config.spaces[0].rooms.length + 1,
    actualConfigSaved: after.server.accepted.length === before.server.accepted.length + 1
      && !!created && equal(geometry(after.server.saved), geometry(after.config)),
    twoOriginalContinuations: residuals.length === 2
      && residuals.every((item) => item.cm === 25)
      && equal(residuals.map((item) => [item.a[1] * 240, item.b[1] * 240].map(Math.round)).sort((a, b) => a[0] - b[0]), [[90, 112], [133, 200]]),
    roomThicknessPreserved: !!created && equal(created.wall_ids.map((id) => space.wall_segments.find((item) => item.id === id).cm).sort((a, b) => a - b), [15, 15, 15, 25]),
    neighboursAndOtherFloorUnchanged: equal(space.rooms.find((item) => item.id === 'neighbour'), before.config.spaces[0].rooms[0])
      && equal(after.config.spaces[1], before.config.spaces[1]),
    identitiesValid: uniqueIds(space),
    oneHistoryCommand: after.history === before.history + 1,
    noMigrationError: !String(after.toast).includes('wall identifiers'),
  };
  if (!created) return out;
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await settleWrites(page);
  const undone = await snapshot(page);
  out.undoRestoresSource = equal(geometry(undone.config), geometry(before.config));
  await page.keyboard.press('Control+Shift+z');
  await settleWrites(page);
  const redone = await snapshot(page);
  out.redoRestoresExactIds = equal(geometry(redone.config), geometry(after.config));
  // A distinct card reads the mock server via the real config/get lifecycle.
  await page.evaluate(async () => {
    const old = window.__card;
    const next = document.createElement('houseplan-card');
    next.setConfig({ type: 'custom:houseplan-card' });
    next.hass = old.hass;
    old.replaceWith(next);
    window.__card = next;
  });
  await page.waitForFunction(() => window.__card._serverCfg?.spaces?.[0]?.rooms?.length === 2);
  const reloaded = await snapshot(page);
  out.reloadReadsDurableIdentity = reloaded.server.reads > 0
    && equal(geometry(reloaded.config), geometry(after.config));
  return out;
});

for (const ending of ['save', 'keep', 'cancel', 'escape']) {
  await scenario(`batch ${ending}`, batchConfig(), async (page) => {
    await clickPoint(page, 102, 112);
    await clickPoint(page, 102, 140);
    await settleWrites(page);
    const before = await snapshot(page);
    await decide(page, 'First');
    const pending = await snapshot(page);
    const out = {
      twoFacesOffered: before.pendingRooms === 2,
      firstDecisionDoesNotWritePartialRoom: pending.config.spaces[0].rooms.length === 0
        && pending.server.accepted.length === before.server.accepted.length,
    };
    if (ending === 'save') await decide(page, 'Second');
    else if (ending === 'keep') await decide(page, '', true);
    else {
      await page.evaluate(async (via) => {
        const dialog = window.__card.renderRoot.querySelector('[data-hp="dialog"][data-kind="room"]');
        const outcome = await window.__hpTest.close(dialog, { via });
        if (outcome.confirm) outcome.confirm.querySelector('[data-hp="dialog-confirm"]').click();
      }, ending === 'escape' ? 'escape' : 'cancel');
    }
    await settleWrites(page);
    const after = await snapshot(page);
    const space = after.config.spaces[0];
    if (ending === 'save' || ending === 'keep') {
      const expected = ending === 'save' ? 2 : 1;
      out.onlyAcceptedRoomsCreated = space.rooms.length === expected;
      out.oneAtomicHistoryAndSave = after.history === before.history + 1
        && after.server.accepted.length === before.server.accepted.length + 1;
      out.identitiesValid = uniqueIds(space);
      if (ending === 'save' && space.rooms.length === 2) {
        const shared = space.rooms[0].wall_ids.filter((id) => space.rooms[1].wall_ids.includes(id));
        out.oneSharedPhysicalAtom = shared.length === 1
          && space.wall_segments.filter((item) => item.id === shared[0]).length === 1;
      }
    } else {
      out.cancelDiscardsEarlierDecision = equal(geometry(after.config), geometry(before.config))
        && after.history === before.history
        && after.server.accepted.length === before.server.accepted.length;
    }
    return out;
  });
}

await scenario('true duplicate rollback', garderoba({ duplicate: true }), async (page) => {
  const before = await snapshot(page);
  await clickPoint(page, 88, 122);
  await decide(page, 'Must not exist');
  await settleWrites(page);
  const after = await snapshot(page);
  return {
    duplicateStillRejected: String(after.toast).includes('wall identifiers'),
    noPartialMutation: equal(geometry(after.config), geometry(before.config)),
    noHistoryOrServerWrite: after.history === before.history && after.server.attempts.length === 0,
  };
});

for (const opening of ['same-residual', 'absorbed', 'new-residual']) {
  await scenario(`opening ${opening}`, garderoba({ opening }), async (page) => {
    const before = await snapshot(page);
    await clickPoint(page, 88, 122);
    await decide(page, 'Opening room');
    await settleWrites(page);
    const after = await snapshot(page);
    if (opening !== 'same-residual') return {
      actualBackendRejection: after.server.attempts.length === 1 && after.server.rejected.length === 1,
      serverRetainsOriginal: after.server.accepted.length === 0 && equal(after.server.saved, before.server.saved),
      optimisticGeometryRolledBack: equal(geometry(after.config), geometry(before.config)),
      noRejectedHistory: after.history === before.history,
    };
    const oldOpening = before.config.spaces[0].openings[0];
    const newOpening = after.config.spaces[0].openings[0];
    const { host: _oldHost, ...oldFields } = oldOpening;
    const { host: _newHost, ...newFields } = newOpening;
    return {
      sameResidualAccepted: after.server.accepted.length === 1 && after.server.rejected.length === 0,
      openingGeometryAndMetadataPreserved: equal(oldFields, newFields),
      originalPartitionHostRetained: newOpening.host.kind === 'partition'
        && newOpening.host.id === oldOpening.host.id && newOpening.host.t !== oldOpening.host.t,
    };
  });
}

await finish(lastBrowser, results);
