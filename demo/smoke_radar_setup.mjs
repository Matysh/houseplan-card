// #485 Stage 1: eligibility, manual entry and session-local on-plan setup.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  card._setMode('devices');
  await update();
  const ordinary = card._devices.find((device) => device.bindingKind !== 'virtual'
    && !device.marker?.radar && device.id === 'd_lamp')
    || card._devices.find((device) => device.bindingKind !== 'virtual' && !device.marker?.radar);
  card._openMarkerDialog(ordinary);
  await update();
  const noAutomaticSection = !root().querySelector('.radargroup');
  const manualToggle = root().querySelector('#marker-radar-presence');
  manualToggle?.click();
  await update();
  const declared = !!card._markerDialog?.radar && !!root().querySelector('.radargroup');

  const room = card._spaceModelById(ordinary.space)?.rooms?.[0];
  const binary = Object.keys(card._planHass.states || {}).find((id) => id.startsWith('binary_sensor.'));
  card._markerDialog = {
    ...card._markerDialog,
    radar: {
      ...card._markerDialog.radar,
      profile: 'presence_v1', roomId: room?.id || '', occupancyEntity: binary || '',
    },
  };
  await update();
  root().querySelector('.radargroup button ha-icon[icon="mdi:map-marker-radius"]')
    ?.closest('button')?.click();
  await update();
  const setup = root().querySelector('.radarsetup');
  const setupOpened = !!setup;
  const planSvg = setup?.querySelector('svg');
  const press = (x, y) => planSvg?.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: x, clientY: y, pointerId: 1,
  }));
  if (planSvg) {
    planSvg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000,
      right: 1000, bottom: 1000, x: 0, y: 0, toJSON() {} });
    press(250, 400);
    press(250, 100);
  }
  await update();
  const installationDrafted = card._editorRuntime?._radarSetup?.isActive() === true;
  const persistedBeforeSave = card._serverCfg.markers.find((marker) => marker.id === ordinary.id)?.radar;
  root().querySelector('.radarsetup .iconbtn')?.click();
  await update();
  const cancelReleased = !root().querySelector('.radarsetup')
    && card._serverCfg.markers.find((marker) => marker.id === ordinary.id)?.radar === persistedBeforeSave;

  card._closeMarkerDialog();
  // #602: a radar saved in an earlier session reopens as an enabled toggle in
  // Details, regardless of whether it was once manual or auto-recognized.
  const savedRadar = {
    version: 1, enabled: true, show_live: true, profile: 'presence_v1',
    sources: { occupancy_entity: binary || '' },
    mount: { installation_id: 'saved-radar-smoke', x: 50, y: 50, heading_deg: 0, range_cm: 500, fov_deg: 120 },
    room_id: room?.id || '',
    calibration: { method: 'not_required', mirror: false, cell_cm: card._spaceModelById(ordinary.space)?.cellCm || 5 },
  };
  const originalMarker = ordinary.marker;
  ordinary.marker = { ...(ordinary.marker || {}), id: ordinary.id, binding: `device:${ordinary.bindingRef}`, radar: savedRadar };
  card._openMarkerDialog(ordinary);
  await update();
  const savedToggle = root().querySelector('#marker-radar-presence');
  const savedReopensInline = savedToggle?.checked === true
    && !!savedToggle.closest('.hpf-card[data-card="details"] .radaradditional')?.querySelector('.radargroup')
    && !root().querySelector('.hpf-card[data-card="basics"] .radargroup');
  savedToggle?.click(); await update();
  const savedOffKeepsOriginal = card._markerDialog?.radarRemove === true
    && card._markerDialog?.radar?.original?.mount?.installation_id === 'saved-radar-smoke';
  root().querySelector('#marker-radar-presence')?.click(); await update();
  const savedOnRestoresOriginal = card._markerDialog?.radarRemove === false
    && card._markerDialog?.radar?.original?.mount?.installation_id === 'saved-radar-smoke';
  card._closeMarkerDialog();
  ordinary.marker = originalMarker;
  const virtual = card._devices.find((device) => device.bindingKind === 'virtual');
  if (virtual) card._openMarkerDialog(virtual);
  await update();
  const virtualHasNoEntry = !virtual || (!root().querySelector('.radargroup')
    && !root().querySelector('.radaradditional'));
  card._closeMarkerDialog();
  card._setMode('view');
  return {
    noAutomaticSection, manualToggleVisible: !!manualToggle, declared, setupOpened,
    installationDrafted, cancelReleased, savedReopensInline, savedOffKeepsOriginal,
    savedOnRestoresOriginal, virtualHasNoEntry,
  };
});

await finish(browser, checkAll(out));
