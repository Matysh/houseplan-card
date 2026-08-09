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
    { id: 'gd', name: 'Кабинет', x: 0.40, y: 0.50, w: 0.25, h: 0.30 },
  ];
  // Robot rooms expose only bounding boxes. Their centres match the plan in
  // "robot mm" (scale 4), exercising the owner-approved F6 anchor fallback.
  // map_index is a NUMERIC ZERO — the cross-runtime zero-map contract.
  const robotRooms = {
    1: { name: 'Кухня', x0: 300, y0: 600, x1: 1100, y1: 1400 },
    2: { name: 'Зал', x0: 1700, y0: 600, x1: 2500, y1: 1400 },
    3: { name: 'Спальня', x0: 300, y0: 2200, x1: 1100, y1: 3000 },
    4: { name: 'Кабинет', x0: 1700, y0: 2200, x1: 2500, y1: 3000 },
  };
  const camAttrs = { vacuum_position: { x: 700, y: 1000, a: 0 }, map_index: 0, rooms: robotRooms };
  c.hass = { ...c.hass,
    entities: { ...c.hass.entities,
      'camera.mower_map': { entity_id: 'camera.mower_map', device_id: 'd_mower', platform: 'demo' },
      'camera.mower_xcme_incomplete': {
        entity_id: 'camera.mower_xcme_incomplete', device_id: 'd_mower',
        platform: 'xiaomi_cloud_map_extractor',
      } },
    states: { ...c.hass.states,
      'camera.mower_map': { state: 'idle', attributes: camAttrs },
      'camera.mower_xcme_incomplete': { state: 'idle', attributes: { friendly_name: 'Incomplete XCME' } },
      'camera.external_map': { state: 'idle', attributes: {
        friendly_name: 'External XCME', vacuum_position: { x: 10, y: 20 }, map_name: 'external',
      } },
    } };
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
  o.successToastShown = (c._toast || '').startsWith('Done: bound via 4 rooms');
  await new Promise((r) => setTimeout(r, 700)); // debounced _saveConfig
  o.configWritePersisted = writes.length >= 1
    && !!writes[writes.length - 1].config.markers.find((x) => x.id === 'd_mower')?.vacuum?.calibration?.['0'];

  // High residual is a proposal, never an implicit write. Cover Cancel,
  // explicit Apply and manual-fit Apply from the same deterministic fixture.
  const lowMatrix = [...cal0];
  robotRooms[4].x0 = 20600;
  robotRooms[4].x1 = 21400;
  c._vacAutoCalibrate(dev); await c.updateComplete;
  o.highResidualDialog = !!c._vacCalConfirm;
  o.highResidualNoImplicitSave = JSON.stringify(m1.vacuum.calibration['0']) === JSON.stringify(lowMatrix);
  c._vacCalConfirm = null; await c.updateComplete;
  o.highResidualCancelUntouched = JSON.stringify(m1.vacuum.calibration['0']) === JSON.stringify(lowMatrix);
  c._vacAutoCalibrate(dev); await c.updateComplete;
  c._vacApplyCalibrationProposal(false); await c.updateComplete;
  const appliedProposal = [...m1.vacuum.calibration['0']];
  o.highResidualApplySaved = JSON.stringify(appliedProposal) !== JSON.stringify(lowMatrix);
  c._vacAutoCalibrate(dev); await c.updateComplete;
  c._vacApplyCalibrationProposal(true); await c.updateComplete;
  o.highResidualManualOpened = !!c._vacFit && c._vacFit.markerId === 'd_mower';
  c._vacFitSave(); await c.updateComplete;
  o.highResidualManualApplied = !c._vacFit && Array.isArray(m1.vacuum.calibration['0'])
    && c._toast === c._t('vac.cal_done');
  robotRooms[4].x0 = 1700;
  robotRooms[4].x1 = 2500;

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
  const vacPicker = sr().querySelector('.vacpicker');
  o.sourcePickerPresent = !!vacPicker;
  const diagnostics = sr().querySelector('.vacdiag')?.textContent || '';
  o.sourceDiagnostics = ['camera.mower_map', c._t('vac.diag_position'), c._t('vac.diag_rooms'),
    c._t('vac.diag_path'), c._t('vac.diag_map'), c._t('vac.autocal_ready')]
    .every((text) => diagnostics.includes(text));
  o.sameDeviceIncompleteXcmeHint = !!sr().querySelector('.vacxcme');
  o.globalCameraLazy = !vacPicker?.textContent.includes('camera.external_map');
  const allCameras = vacPicker?.querySelector('.vacsource-list > details');
  if (allCameras) { allCameras.open = true; await new Promise((r) => setTimeout(r, 0)); await c.updateComplete; }
  o.globalCameraFoundOnOpen = !!vacPicker?.textContent.includes('camera.external_map');
  const sourceButtons = () => [...(vacPicker?.querySelectorAll('button.vacsource') || [])];
  sourceButtons().find((button) => button.textContent.includes('camera.external_map'))?.click();
  await c.updateComplete;
  o.globalCameraPinned = c._vacSourceResolution(c._devices.find((x) => x.id === 'd_mower')).entityId
    === 'camera.external_map';
  sourceButtons().find((button) => button.textContent.includes(c._t('vac.source_auto')))?.click();
  await c.updateComplete;
  sourceButtons().find((button) => button.textContent.includes('camera.mower_map'))?.click();
  await c.updateComplete;
  const pinnedResolution = c._vacSourceResolution(c._devices.find((x) => x.id === 'd_mower'));
  o.sameDeviceSourcePinned = pinnedResolution.pinned && pinnedResolution.entityId === 'camera.mower_map';
  const liveBox = sr().querySelector('.vacbox input[type=checkbox]');
  o.vacSectionShown = !!liveBox;
  if (liveBox) { liveBox.click(); await c.updateComplete; }
  const m3 = (cfg.markers || []).find((x) => x.id === 'd_mower');
  o.liveToggleMaterialises = !!m3 && m3.vacuum?.live === false;
  const sel = sr().querySelector('.vacbox select');
  if (sel) { sel.value = 'always'; sel.dispatchEvent(new Event('change')); await c.updateComplete; }
  o.trailModePersists = m3?.vacuum?.trail_mode === 'always';
  m3.vacuum.source = 'camera.missing';
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); await c.updateComplete;
  const sourceWarning = sr().querySelector('.vacsource-warning');
  const warningPickerButton = sourceWarning?.querySelector('button');
  warningPickerButton?.click(); await c.updateComplete;
  o.missingSourceActions = !!warningPickerButton
    && !!sr().querySelector('details.vacpicker[open]')
    && !!sr().querySelector('.vacbtns a[href*="VACUUM.md"]');
  c._markerDialog = null; c._setMode('view'); await c.updateComplete;

  // ---- error copy never points at the removed point calibration (HP-1540-06) ----
  const toasts = ['vac.autocal_no_rooms', 'vac.autocal_no_match', 'vac.residual_message']
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
