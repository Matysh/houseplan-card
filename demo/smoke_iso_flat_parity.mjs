// #713: the 2.5D floor is the Flat plane. Switching projection keeps the
// floor, the decor and the room names on the same CSS pixels, lifts every
// device tile and lock badge by one straight-up wall-top rise, and keeps the
// camera when the previous projection was on screen (setting, editor entry,
// warm remount); a cold 2.5D start still opens the 2.5D home.
// FAILS on the build before #713: the floor was foreshortened by cos 20°
// (15–23 px at the edges), tiles moved by per-cluster vectors and the scalar
// zoom was carried instead of the camera.
import { launch, check, finish } from './serve.mjs';
import { makeLargeHouseFixture } from './fixtures/large-house.mjs';

const LIFT_UNITS = 84 * Math.sin(20 * Math.PI / 180);
// The facade waits for `.stage.projection-iso`, i.e. for the lazy 2.5D runtime.
const setIso = (page, on) => page.evaluate(async (value) => {
  await window.__hpTest.setVolumetricView(value);
}, on);
const out = {};

const decorate = () => window.__hpTest.setServerConfig((cfg) => {
  const space = cfg.spaces.find((item) => item.id === 'f1');
  space.settings = { ...(space.settings || {}), show_borders: true, show_names: true };
  space.partitions = [{ id: 'p713-wall', a: [0.15, 0.12], b: [0.85, 0.12], cm: 15 }];
  space.openings = [
    { id: 'p713-door', type: 'door', x: 0.55, y: 0.36, angle: 90, length: 0.12,
      contact: 'binary_sensor.window', lock: 'lock.front_door' },
  ];
  space.decor = [
    { id: 'nw', kind: 'furniture', symbol: 'sofa', x: 0.10, y: 0.10, w: 0.12, h: 0.06, width_cm: 2 },
    { id: 'ne', kind: 'furniture', symbol: 'sofa', x: 0.78, y: 0.10, w: 0.12, h: 0.06, width_cm: 2 },
    { id: 'c', kind: 'furniture', symbol: 'bed', x: 0.44, y: 0.47, w: 0.12, h: 0.10, width_cm: 2 },
    { id: 'sw', kind: 'furniture', symbol: 'sofa', x: 0.10, y: 0.84, w: 0.12, h: 0.06, width_cm: 2 },
    { id: 'se', kind: 'furniture', symbol: 'sofa', x: 0.78, y: 0.84, w: 0.12, h: 0.06, width_cm: 2 },
    { id: 'line', kind: 'line', x1: 0.12, y1: 0.7, x2: 0.45, y2: 0.7, width_cm: 1 },
    { id: 'box', kind: 'rect', x: 0.6, y: 0.6, w: 0.1, h: 0.08, angle: 30, width_cm: 1 },
  ];
  cfg.settings = { ...(cfg.settings || {}), volumetric_view: false };
  return cfg;
});

/** Everything the owner watches, in stage CSS px, plus the camera. */
const snapshot = () => window.__hpSnap713();
const installSnapshot = () => {
  window.__hpSnap713 = () => {
    const card = window.__card;
    const root = card.renderRoot;
    const stage = root.querySelector('.stage');
    const s = stage.getBoundingClientRect();
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left - s.left, r.top - s.top, r.width, r.height];
    };
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return [r.left - s.left + r.width / 2, r.top - s.top + r.height / 2];
    };
    // Screen-facing roots are positioned by their anchor (left/top in % of the
    // stage); the tile's own #649 lift and edge are styling on top of it.
    const anchor = (el) => [parseFloat(el.style.left) / 100 * s.width,
      parseFloat(el.style.top) / 100 * s.height];
    const byId = (selector, fn) => Object.fromEntries([...root.querySelectorAll(selector)]
      .filter((el) => el.dataset.id).map((el) => [el.dataset.id, fn(el)]));
    const view = card._view ? { ...card._view } : null;
    return {
      iso: stage.classList.contains('projection-iso'),
      stage: [stage.clientWidth, stage.clientHeight],
      rooms: byId('[data-hp="room"]', box),
      decor: byId('.decorlayer [data-hp="decor"]:not(.dselecthit):not(.derasehit):not(.dfurniturehit)', box),
      labels: byId('.roomlabel', centre),
      devices: byId('[data-hp="device"]', anchor),
      // Lock badges carry no id of their own; the opening order is stable.
      locks: Object.fromEntries([...root.querySelectorAll('.oplock:not(.iso-tile-shadow)')]
        .map((el, index) => [`lock${index}`, anchor(el)])),
      backdrop: [...root.querySelectorAll('.hp-backdrop')].map(box),
      view,
      zoom: card._zoom,
      pxPerUnit: view ? stage.clientWidth / view.w : NaN,
    };
  };
  window.__hpFitW713 = () => {
    const card = window.__card;
    const vb = card._baseVb();
    const v = card._view;
    const aspect = v.w / v.h;
    return aspect > vb[2] / vb[3] ? vb[3] * aspect : vb[2];
  };
};

const maxDelta = (a, b) => {
  let worst = 0, missing = 0;
  for (const [key, value] of Object.entries(a)) {
    const other = b[key];
    if (!other) { missing++; continue; }
    for (let i = 0; i < value.length; i++) worst = Math.max(worst, Math.abs(value[i] - other[i]));
  }
  return { worst, missing, count: Object.keys(a).length };
};
const sameView = (a, b, eps = 0.01) => !!a && !!b
  && ['x', 'y', 'w', 'h'].every((key) => Math.abs(a[key] - b[key]) <= eps);

// ---- AC2 / AC3 / AC4 / AC5 on two stage shapes ----
for (const [label, width, height] of [['wide', 1280, 900], ['tall', 1800, 700]]) {
  const { page, browser } = await launch({ width, height });
  await page.evaluate(installSnapshot);
  await page.evaluate(decorate);
  const flat = await page.evaluate(snapshot);
  await setIso(page, true);
  const iso = await page.evaluate(snapshot);
  const floor = ['rooms', 'decor', 'labels'].map((key) => [key, maxDelta(flat[key], iso[key])]);
  const backdrop = maxDelta(Object.assign({}, flat.backdrop), Object.assign({}, iso.backdrop));
  out[`${label}AC2FloorDecorLabelsKeepPixels`] = iso.iso && !flat.iso
    && floor.every(([, d]) => d.count > 0 && d.missing === 0 && d.worst <= 0.5)
    && backdrop.missing === 0 && backdrop.worst <= 0.5;
  out[`${label}AC2Detail`] = JSON.stringify(Object.fromEntries(floor.map(([k, d]) => [k, +d.worst.toFixed(2)])));

  const lift = LIFT_UNITS * (5 / await page.evaluate(() => window.__card._cellCm)) * iso.pxPerUnit;
  const shifts = [...Object.entries(iso.devices), ...Object.entries(iso.locks)].map(([id, point]) => {
    const before = flat.devices[id] || flat.locks[id];
    return before ? [point[0] - before[0], point[1] - before[1]] : [NaN, NaN];
  });
  out[`${label}AC3OneStraightUpShift`] = shifts.length >= 5
    && Object.keys(iso.locks).length >= 1
    && shifts.every(([dx, dy]) => Math.abs(dx) <= 0.5 && Math.abs(dy + lift) <= 0.5);
  out[`${label}AC3Detail`] = JSON.stringify({ lift: +lift.toFixed(2),
    shifts: shifts.map(([dx, dy]) => [+dx.toFixed(2), +dy.toFixed(2)]) });

  if (label === 'wide') {
    // AC5 (a): a moved, zoomed camera survives the switch in both directions.
    await page.evaluate(async () => {
      const card = window.__card;
      card._applyView(1.7, 620, 380);
      await window.__hpTest.settled();
    });
    const isoCam = await page.evaluate(snapshot);
    await setIso(page, false);
    const flatCam = await page.evaluate(snapshot);
    const flatFitW = await page.evaluate(() => window.__hpFitW713());
    out.AC5SettingOffKeepsCamera = Math.abs(isoCam.zoom - 1.7) < 1e-9
      && sameView(flatCam.view, isoCam.view)
      && Math.abs(flatCam.zoom - flatFitW / flatCam.view.w) < 1e-6
      && maxDelta(isoCam.rooms, flatCam.rooms).worst <= 0.5;
    await setIso(page, true);
    const isoBack = await page.evaluate(snapshot);
    const isoFitW = await page.evaluate(() => window.__hpFitW713());
    out.AC5SettingOnKeepsCamera = sameView(isoBack.view, flatCam.view)
      && Math.abs(isoBack.zoom - isoFitW / isoBack.view.w) < 1e-6
      && maxDelta(flatCam.rooms, isoBack.rooms).worst <= 0.5;

    // AC5 (b): entering the Plan editor from 2.5D equals entering it from a
    // Flat View that shows the same floor picture; leaving restores the View.
    const settleMode = async (mode) => page.evaluate(async (next) => {
      await window.__hpTest.setMode(next);
      const card = window.__card;
      for (let i = 0; i < 90 && (card._modeTransitionBusy || card._modeTransition?.state); i++)
        await new Promise((done) => requestAnimationFrame(done));
      await window.__hpTest.settled();
      return card._view ? { ...card._view } : null;
    }, mode);
    const viewIso = isoBack.view;
    const editorFromIso = await settleMode('plan');
    const backToIso = await settleMode('view');
    await setIso(page, false);
    const flatSame = await page.evaluate(snapshot);
    const editorFromFlat = await settleMode('plan');
    await settleMode('view');
    out.AC5EditorEntryMatchesFlat = sameView(flatSame.view, viewIso)
      && sameView(editorFromIso, editorFromFlat);
    out.AC5LeavingEditorRestoresView = sameView(backToIso, viewIso);
    out.AC5Detail = JSON.stringify({ editorFromIso, editorFromFlat });

    // AC6: a floor point hits the same room at the same client point.
    await setIso(page, false);
    const hit = () => page.evaluate(() => {
      const root = window.__card.renderRoot;
      const s = root.querySelector('.stage').getBoundingClientRect();
      return [[0.3, 0.55], [0.7, 0.4], [0.2, 0.3]].map(([fx, fy]) => {
        const stack = root.elementsFromPoint(s.left + s.width * fx, s.top + s.height * fy);
        return stack.find((el) => el.dataset?.hp === 'room')?.dataset.id ?? null;
      });
    });
    const flatHits = await hit();
    await setIso(page, true);
    const isoHits = await hit();
    out.AC6FloorHitSameRoom = flatHits.some(Boolean)
      && JSON.stringify(flatHits) === JSON.stringify(isoHits);

    // AC4: without borders the whole 2.5D scene is the Flat geometry.
    await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
      const space = cfg.spaces.find((item) => item.id === 'f1');
      space.settings = { ...space.settings, show_borders: false };
      cfg.settings = { ...cfg.settings, volumetric_view: false };
      return cfg;
    }));
    await page.evaluate(async () => {
      const card = window.__card;
      card._fitAll();
      for (let i = 0; i < 120 && card._cameraTransition.active; i++)
        await new Promise((done) => requestAnimationFrame(done));
      await window.__hpTest.settled();
    });
    const flatNoBorders = await page.evaluate(snapshot);
    await setIso(page, true);
    const isoNoBorders = await page.evaluate(snapshot);
    const noBorders = ['rooms', 'decor', 'labels', 'devices', 'locks']
      .map((key) => [key, maxDelta(flatNoBorders[key], isoNoBorders[key])]);
    out.AC4NoBordersIsFlatGeometry = isoNoBorders.iso
      && noBorders.every(([, d]) => d.count > 0 && d.missing === 0 && d.worst <= 0.5);
    out.AC4Detail = JSON.stringify(Object.fromEntries(noBorders));
  }
  await finish(browser);
}

// ---- AC11: warm remount across a projection change, and the cold 2.5D start ----
{
  const { page, browser } = await launch({ width: 1280, height: 900 });
  await page.evaluate(installSnapshot);
  await page.evaluate(decorate);
  const result = await page.evaluate(async () => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    const host = document.getElementById('host');
    const remount = async (volumetric) => {
      const cfg = structuredClone(window.__card._serverCfg);
      cfg.settings = { ...(cfg.settings || {}), volumetric_view: volumetric };
      window.__card.remove();
      window.__pushServerConfig(cfg);
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card' });
      host.replaceChildren(card);
      card.hass = window.__mkHass();
      window.__card = card;
      const started = performance.now();
      while ((!card._loadOk || card._booting) && performance.now() - started < 9000) await wait(30);
      if (volumetric) await card._ensureIsoSceneRuntime();
      const stage = () => card.renderRoot.querySelector('.stage');
      while (stage()?.classList.contains('projection-iso') !== volumetric
          && performance.now() - started < 9000) await wait(30);
      await window.__hpTest.settled();
      return card;
    };
    const res = {};
    // The memo belongs to this card configuration: mount it once cold first.
    await remount(false);
    // Flat memo → 2.5D after remount.
    window.__card._applyView(1.6, 540, 460);
    await window.__hpTest.settled();
    const flatView = { ...window.__card._view };
    let card = await remount(true);
    res.warmFlatToIso = !card._booting && card.renderRoot.querySelector('.stage.projection-iso')
      && ['x', 'y', 'w', 'h'].every((k) => Math.abs(card._view[k] - flatView[k]) <= 0.01)
      && Math.abs(card._zoom - window.__hpFitW713() / card._view.w) < 1e-6;
    res.warmFlatToIsoDetail = JSON.stringify({ flatView, view: card._view, zoom: card._zoom });
    // 2.5D memo → Flat after remount.
    card._applyView(1.4, 470, 520);
    await window.__hpTest.settled();
    const isoView = { ...card._view };
    card = await remount(false);
    res.warmIsoToFlat = !card._booting && !card.renderRoot.querySelector('.stage.projection-iso')
      && ['x', 'y', 'w', 'h'].every((k) => Math.abs(card._view[k] - isoView[k]) <= 0.01)
      && Math.abs(card._zoom - window.__hpFitW713() / card._view.w) < 1e-6;
    res.warmIsoToFlatDetail = JSON.stringify({ isoView, view: card._view, zoom: card._zoom });
    // Cold 2.5D start: no memo, home frame at zoom 1.
    customElements.get('houseplan-card')?._warmBootReset?.();
    card = await remount(true);
    const vb = card._baseVb();
    const v = card._viewOr(vb);
    const aspect = v.w / v.h;
    const homeW = aspect > vb[2] / vb[3] ? vb[3] * aspect : vb[2];
    res.coldIsoStartsAtHome = Math.abs(card._zoom - 1) < 1e-9 && Math.abs(v.w - homeW) < 0.01
      && !!card.renderRoot.querySelector('.stage.projection-iso');
    return res;
  });
  out.AC11WarmFlatToIsoKeepsCamera = !!result.warmFlatToIso;
  out.AC11WarmIsoToFlatKeepsCamera = !!result.warmIsoToFlat;
  out.AC11ColdIsoStartsAtHome = !!result.coldIsoStartsAtHome;
  out.AC11Detail = `${result.warmFlatToIsoDetail} ${result.warmIsoToFlatDetail}`;
  await finish(browser);
}

// ---- AC3 on large-house floor 1 (80 devices): one rise for every tile ----
{
  const { page, browser } = await launch({ width: 1280, height: 900 });
  const fixture = makeLargeHouseFixture();
  fixture.config.settings = { ...(fixture.config.settings || {}), volumetric_view: true };
  for (const space of fixture.config.spaces) space.settings = { ...(space.settings || {}), show_borders: true };
  const res = await page.evaluate(async (fixture) => {
    const wait = (ms) => new Promise((done) => setTimeout(done, ms));
    window.__card?.remove?.();
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title: 'p713', icon_size: 3.4 });
    const hass = { language: 'en', locale: { language: 'en' }, user: { id: 'p', name: 'p', is_admin: true },
      devices: fixture.devices, entities: fixture.entities, areas: fixture.areas, states: fixture.states,
      floors: { one: { floor_id: 'one', name: 'One', level: 0 } },
      callWS: async (m) => m.type === 'houseplan/config/get' ? { config: structuredClone(fixture.config), rev: 1, can_write: true }
        : m.type === 'houseplan/layout/get' ? { layout: structuredClone(fixture.layout), rev: 1 }
        : m.type === 'config/device_registry/list' ? Object.values(fixture.devices)
        : m.type === 'config/entity_registry/list' ? Object.values(fixture.entities) : { ok: true },
      callService: async () => undefined,
      connection: { subscribeEvents: async () => () => undefined, subscribeMessage: async () => () => undefined },
      localize: () => null, formatEntityState: (s) => s.state, config: { unit_system: { length: 'km' } } };
    document.getElementById('host').replaceChildren(card);
    card.hass = hass;
    await card._ensureIsoSceneRuntime();
    const started = performance.now();
    while (!(card._loadOk && card._model?.length) && performance.now() - started < 15000) await wait(30);
    while (!card.renderRoot.querySelector('.stage.projection-iso') && performance.now() - started < 15000) await wait(30);
    await card.updateComplete;
    await wait(300);
    const lift = 84 * (5 / card._cellCm) * Math.sin(20 * Math.PI / 180);
    const roots = [...card.renderRoot.querySelectorAll('[data-hp-iso-raised="true"][data-hp-iso-floor]')]
      .filter((el) => el.dataset.hpIsoOverlayKind !== 'room-label');
    const bad = roots.filter((el) => {
      const [fx, fy] = el.dataset.hpIsoFloor.split(',').map(Number);
      const [vx, vy] = el.dataset.hpIsoVisual.split(',').map(Number);
      return Math.abs(vx - fx) > 1e-6 || Math.abs(fy - vy - lift) > 1e-6
        || el.dataset.hpIsoNudged !== 'false';
    });
    const labels = [...card.renderRoot.querySelectorAll('[data-hp-iso-overlay-kind="room-label"]')];
    const movedLabels = labels.filter((el) => el.dataset.hpIsoFloor !== el.dataset.hpIsoVisual);
    return { devices: roots.filter((el) => el.dataset.hpIsoOverlayKind === 'device').length,
      bad: bad.length, labels: labels.length, movedLabels: movedLabels.length };
  }, fixture);
  out.AC3LargeHouseOneRise = res.devices >= 80 && res.bad === 0;
  out.AC3LargeHouseNamesOnFloor = res.labels > 0 && res.movedLabels === 0;
  out.AC3LargeHouseDetail = JSON.stringify(res);
  await finish(browser);
}

for (const [key, value] of Object.entries(out)) {
  if (key.endsWith('Detail')) continue;
  check(key, value, true);
}
console.log(JSON.stringify(out, null, 1));
await finish(null);
