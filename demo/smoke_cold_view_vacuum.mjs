// #358: a vacuum with REAL telemetry (position/map — Tasshack, XCME…) must not
// kill a cold View. The #337 stub _vacMapId threw inside willUpdate on a tab
// that never loaded the editor runtime, and the exception took the whole Lit
// update cycle with it: the card froze on its first frame. The demo fixture's
// mower has no position attributes, so telemetry was null and every existing
// smoke (warm AND cold) sailed past this branch.
import { launchColdView, checkAll, finish } from './serve.mjs';

const { page, browser } = await launchColdView();
const requested = [];
page.on('request', (request) => requested.push(new URL(request.url()).pathname));
let pageErrors = 0;
page.on('pageerror', (error) => { pageErrors++; console.log('EXC', error.message); });

const out = await page.evaluate(async () => {
  const card = window.__card;
  const space = card._model[0];
  const room = space.rooms.find((candidate) => candidate.id && candidate.area);
  const vacState = (x, y) => ({
    entity_id: 'vacuum.real',
    state: 'cleaning',
    attributes: {
      friendly_name: 'Робот',
      vacuum_position: { x, y, a: 90 },
      // no map_name/current_map in telemetry — the entity's selected_map: 0
      // must win as the map id (HP-1541-01: zero is a real map, not falsy)
      selected_map: 0,
    },
  });
  const makeHass = (x, y) => ({
    ...card.hass,
    states: { ...card.hass.states, 'vacuum.real': vacState(x, y) },
    entities: {
      ...card.hass.entities,
      'vacuum.real': {
        entity_id: 'vacuum.real', device_id: 'd_realvac',
        platform: 'tasshack', disabled_by: null,
      },
    },
    devices: {
      ...card.hass.devices,
      d_realvac: { id: 'd_realvac', name: 'Робот', area_id: room.area },
    },
  });
  const cfg = structuredClone(card._serverCfg);
  cfg.markers = [...(cfg.markers || []), {
    id: 'd_realvac', binding: 'device:d_realvac', name: 'Робот',
    space: space.id, area: room.area, room_id: room.id,
  }];
  // The decor guard (#358 К2): one shape rendered in View must be a quiet
  // no-op on pointerdown, not an exception behind CSS pointer-events.
  const sp = cfg.spaces.find((s) => s.id === space.id) || cfg.spaces[0];
  sp.decor = [...(sp.decor || []), { id: 'dc_cold', kind: 'line', a: [200, 200], b: [400, 300] }];
  const baseWS = card.hass.callWS.bind(card.hass);
  const hass = makeHass(120, 340);
  hass.callWS = async (message) => message.type === 'houseplan/config/get'
    ? {
      config: cfg, rev: card._cfgRev, can_write: true,
      virtual_lights: { rev: 0, config_rev: card._cfgRev, off: [] },
    }
    : baseWS(message);
  card.hass = hass;
  await card._reloadConfigOnly(true);
  card._regSignature = '';
  card._maybeRebuildDevices();
  card.requestUpdate();
  await card.updateComplete;

  const waitFor = async (predicate, timeout = 6000) => {
    const started = Date.now();
    while (!predicate() && Date.now() - started < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !!predicate();
  };
  const out = { runtimeColdBefore: !card._editorRuntime };
  out.vacuumDeviceBuilt = await waitFor(() =>
    card._devices.some((device) => device.id === 'd_realvac'));
  out.firstFrameAlive = await waitFor(() =>
    !!card.renderRoot.querySelector('.dev[data-id="d_realvac"]'));

  // The proof that willUpdate SURVIVES telemetry: push fresh robot positions
  // and require the card to keep committing frames, not just the first one.
  const snapshotOf = () => card._renderDeviceSnapshot?.facts.get('vacuum:d_realvac');
  const before = snapshotOf();
  card.hass = { ...makeHass(500, 700), callWS: hass.callWS };
  await card.updateComplete;
  out.secondFrameCommitted = await waitFor(() => {
    const fact = snapshotOf();
    return !!fact && fact !== before && fact.telemetry?.pos?.x === 500;
  });
  // HP-1541-01 preserved through the move: selected_map 0 resolves to '0'.
  out.mapIdResolved = snapshotOf()?.mapId === '0';
  card.hass = { ...makeHass(800, 200), callWS: hass.callWS };
  await card.updateComplete;
  out.thirdFrameCommitted = await waitFor(() =>
    snapshotOf()?.telemetry?.pos?.x === 800);

  // К2: decor shape pointerdown on a cold tab is a quiet no-op.
  const shape = card.renderRoot.querySelector('.dshape');
  out.decorShapeRendered = !!shape;
  shape?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await card.updateComplete;
  out.runtimeColdAfter = !card._editorRuntime;
  return out;
});

out.noEditorRuntimeRequest = requested.every((path) => !/houseplan-editor-runtime-/.test(path));
out.noPageErrors = pageErrors === 0;
checkAll(out);
await finish(browser, out);
