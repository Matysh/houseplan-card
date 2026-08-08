// v1.54.0 audit regressions (HP-1540-01/-04/-06): the FIRST-USE path.
// An auto-discovered vacuum has NO marker in the config — cfg.markers stays
// empty here, unlike smoke_vacuum.mjs which always pushes one by hand (the
// audit called that gap out explicitly). Every vacuum action must materialise
// the marker and actually persist; plan rooms are legacy RECTANGLES.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const out = await page.evaluate(async () => {
  const c = window.__card;
  const o = {};
  const sr = () => c.shadowRoot || c.renderRoot;
  const cfg = c._serverCfg;

  // legacy rectangle rooms (x/y/w/h, HP-1540-04) in the garden space where
  // the auto-discovered vacuum.mower already lives
  const g = cfg.spaces.find((s) => s.id === 'garden');
  g.rooms = [
    { id: 'ga', name: 'Кухня', area: 'garden', x: 0.05, y: 0.10, w: 0.25, h: 0.30 },
    { id: 'gb', name: 'Зал', x: 0.40, y: 0.10, w: 0.25, h: 0.30 },
    { id: 'gc', name: 'Спальня', x: 0.05, y: 0.50, w: 0.25, h: 0.30 },
  ];
  // robot rooms: same centres in "robot mm" (scale 4), map_index is a
  // NUMERIC ZERO — the cross-runtime zero-map contract (HP-1540-02)
  const robotRooms = {
    1: { name: 'Кухня', x0: 300, y0: 600, x1: 1100, y1: 1400 },
    2: { name: 'Зал', x0: 1700, y0: 600, x1: 2500, y1: 1400 },
    3: { name: 'Спальня', x0: 300, y0: 2200, x1: 1100, y1: 3000 },
  };
  const camAttrs = { vacuum_position: { x: 700, y: 1000, a: 0 }, map_index: 0, rooms: robotRooms };
  c.hass = { ...c.hass,
    entities: { ...c.hass.entities,
      'camera.mower_map': { entity_id: 'camera.mower_map', device_id: 'd_mower', platform: 'demo' } },
    states: { ...c.hass.states,
      'camera.mower_map': { state: 'idle', attributes: camAttrs } } };
  c._regSignature = '';
  c.requestUpdate(); await c.updateComplete;

  // spy on config writes: a success toast is only honest after one of these
  const writes = [];
  const realWS = c.hass.callWS;
  c.hass.callWS = async (m) => { if (m.type === 'houseplan/config/set') writes.push(m); return realWS(m); };

  const dev = c._devices.find((x) => x.id === 'd_mower');
  o.devFound = !!dev;
  o.freshNoMarker = (cfg.markers || []).length === 0 && !dev.marker;

  // ---- auto-calibration from scratch (HP-1540-01 + HP-1540-04) ----
  c._vacAutoCalibrate(dev);
  await c.updateComplete;
  const m1 = (cfg.markers || []).find((x) => x.id === 'd_mower');
  o.markerMaterialised = !!m1 && m1.binding === 'device:d_mower';
  const cal0 = m1?.vacuum?.calibration?.['0'];
  o.rectRoomsCalibrated = Array.isArray(cal0) && cal0.length === 6 && cal0.every(Number.isFinite);
  o.sourceStored = m1?.vacuum?.source === 'camera.mower_map';
  // the matrix really maps robot mm → canvas: centre of «Кухня» → (175, 250)
  const ap = (mm, x, y) => [mm[0] * x + mm[1] * y + mm[2], mm[3] * x + mm[4] * y + mm[5]];
  const hit = cal0 ? ap(cal0, 700, 1000) : [0, 0];
  o.matrixMapsRooms = Math.hypot(hit[0] - 175, hit[1] - 250) < 2;
  o.successToastShown = (c._toast || '').startsWith('Done: bound via 3 rooms');
  await new Promise((r) => setTimeout(r, 700)); // debounced _saveConfig
  o.configWritePersisted = writes.length >= 1
    && !!writes[writes.length - 1].config.markers.find((x) => x.id === 'd_mower')?.vacuum?.calibration?.['0'];

  // ---- manual fit from scratch (HP-1540-01) ----
  cfg.markers = [];
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const dev2 = c._devices.find((x) => x.id === 'd_mower');
  o.fitFreshNoMarker = !dev2.marker;
  c._vacStartFit(dev2); await c.updateComplete;
  c._vacFitSave(); await c.updateComplete;
  const m2 = (cfg.markers || []).find((x) => x.id === 'd_mower');
  const calFit = m2?.vacuum?.calibration?.['0'];
  o.fitMaterialises = !!m2 && Array.isArray(calFit) && calFit.length === 6;
  o.fitToastAfterSave = c._toast === c._t('vac.cal_done');

  // ---- live checkbox + trail select from scratch (HP-1540-01) ----
  cfg.markers = [];
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  c._setMode('devices'); await c.updateComplete;
  c._openMarkerDialog(c._devices.find((x) => x.id === 'd_mower')); await c.updateComplete;
  const liveBox = sr().querySelector('.vacbox input[type=checkbox]');
  o.vacSectionShown = !!liveBox;
  if (liveBox) { liveBox.click(); await c.updateComplete; }
  const m3 = (cfg.markers || []).find((x) => x.id === 'd_mower');
  o.liveToggleMaterialises = !!m3 && m3.vacuum?.live === false;
  const sel = sr().querySelector('.vacbox select');
  if (sel) { sel.value = 'always'; sel.dispatchEvent(new Event('change')); await c.updateComplete; }
  o.trailModePersists = m3?.vacuum?.trail_mode === 'always';
  c._markerDialog = null; c._setMode('view'); await c.updateComplete;

  // ---- error copy never points at the removed point calibration (HP-1540-06) ----
  const toasts = ['vac.autocal_no_rooms', 'vac.autocal_no_match', 'vac.autocal_res_warn']
    .map((k) => c._t(k)).join(' | ');
  o.noPointCalibrationCopy = !/point|точк/i.test(toasts);
  // and the real no-rooms path shows the reworded toast
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.mower_map': { state: 'idle', attributes: { vacuum_position: { x: 1, y: 2, a: 0 }, map_index: 0 } } } };
  await c.updateComplete;
  c._vacAutoCalibrate(c._devices.find((x) => x.id === 'd_mower'));
  o.noRoomsToastReworded = c._toast === c._t('vac.autocal_no_rooms') && !/point|точк/i.test(c._toast);

  c.hass.callWS = realWS;
  return o;
});

checkAll(out);
await finish(browser, out);
