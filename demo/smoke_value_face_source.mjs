// Issue #378: an explicit Value + state source is selected in the real dialog,
// previewed, saved, reopened and projected by both renderers without changing
// the device action. Missing live data must keep the selection and render a dash.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const entityId = 'cover.value_face_awning';
  const deviceId = 'd_value_face_awning';
  const source = { kind: 'entity_attribute', entity_id: entityId, attribute: 'current_position' };
  const sourceKey = `attr:${entityId}:current_position`;
  const calls = [];
  const setState = async (state, position) => {
    c.hass = {
      ...c.hass,
      devices: {
        ...c.hass.devices,
        [deviceId]: {
          id: deviceId, name: 'Value face awning', model: 'Test cover', area_id: 'bedroom',
          identifiers: [['demo', deviceId]], entry_type: null, via_device_id: null,
        },
      },
      entities: {
        ...c.hass.entities,
        [entityId]: { entity_id: entityId, device_id: deviceId, platform: 'demo' },
      },
      states: {
        ...c.hass.states,
        [entityId]: {
          entity_id: entityId, state,
          attributes: {
            friendly_name: 'Value face awning', device_class: 'awning',
            supported_features: 15, current_position: position,
          },
        },
      },
      callService: async (domain, service, data) => {
        calls.push([domain, service, data]);
        return {};
      },
    };
    c._regSignature = '';
    c._maybeRebuildDevices();
    const item = c._devices.find((candidate) => candidate.bindingRef === deviceId);
    if (item) c._layout = { ...c._layout, [item.id]: { s: item.space, x: 0.12, y: 0.88 } };
    c.requestUpdate();
    await c.updateComplete;
  };
  const item = () => c._devices.find((candidate) => candidate.bindingRef === deviceId);
  const faceValue = (root, selector) => root.querySelector(selector)
    ?.querySelector('.valtext')?.textContent?.trim() || '';

  await setState('open', 42);
  c._setMode('devices');
  c._openMarkerDialog(item());
  await c.updateComplete;
  c._markerDialog = {
    ...c._markerDialog, display: 'value', tapAction: 'toggle', tapActionTouched: true,
  };
  c.requestUpdate();
  await c.updateComplete;

  const select = sr().querySelector('#marker-value-source');
  const candidateValues = [...(select?.options || [])].map((option) => option.value);
  select.value = sourceKey;
  select.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  await c.updateComplete;
  const preview = sr().querySelector('hp-device-preview');
  await preview?.updateComplete;
  const preview42 = faceValue(preview?.renderRoot, '.dev') === '42 %';
  const draftSourceExact = JSON.stringify(c._markerDialog?.valueSource) === JSON.stringify(source);

  await c._saveMarker();
  await c.updateComplete;
  let saved = (c._serverCfg.markers || []).find((marker) => marker.binding === `device:${deviceId}`);
  const savedExact = JSON.stringify(saved?.value_source) === JSON.stringify(source);
  const actionSaved = saved?.tap_action === 'toggle';

  c._openMarkerDialog(item());
  await c.updateComplete;
  const reopenedSelect = sr().querySelector('#marker-value-source');
  const reopenedExact = reopenedSelect?.value === sourceKey
    && reopenedSelect?.selectedOptions?.[0]?.value === sourceKey;

  // Cancel an unsaved switch to auto: the persisted source must survive.
  reopenedSelect.value = '';
  reopenedSelect.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  await c.updateComplete;
  c._closeMarkerDialog();
  await c.updateComplete;
  saved = (c._serverCfg.markers || []).find((marker) => marker.binding === `device:${deviceId}`);
  const cancelKeptSource = JSON.stringify(saved?.value_source) === JSON.stringify(source);

  c._setMode('view');
  c._regSignature = '';
  c._maybeRebuildDevices();
  c.requestUpdate();
  await c.updateComplete;
  const plan42 = faceValue(sr(), `.dev[data-id="${item().id}"]`) === '42 %';
  calls.length = 0;
  c._clickDevice({ stopPropagation() {} }, item());
  await wait(20);
  const actionUnchanged = JSON.stringify(calls.at(-1)) === JSON.stringify([
    'cover', 'close_cover', { entity_id: entityId },
  ]);

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: item().space });
  staticCard._snap = {
    config: structuredClone(c._serverCfg), rev: c._cfgRev,
    configFingerprint: `fixture-${c._cfgRev}`,
    layout: structuredClone(c._layout), layoutRev: c._layoutRev,
    layoutFingerprint: `fixture-${c._layoutRev}`,
  };
  staticCard._loadedOnce = true;
  staticCard.hass = c.hass;
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector('.hp-static-stage') && Date.now() - started < 6000) {
    await wait(60);
  }
  await staticCard.updateComplete;
  const static42 = faceValue(staticCard.renderRoot, `.dev[data-id="${item().id}"]`) === '42 %';

  await setState('unavailable', 42);
  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  await wait(120);
  await c.updateComplete;
  const unavailableDash = faceValue(sr(), `.dev[data-id="${item().id}"]`) === '—';
  const unavailableStillValue = sr().querySelector(`.dev[data-id="${item().id}"]`)?.classList
    .contains('valonly') === true;

  await setState('open', 55);
  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  const recovered55 = faceValue(sr(), `.dev[data-id="${item().id}"]`) === '55 %';

  // A real binding choice resets the old source to automatic before Save.
  c._setMode('devices');
  c._openMarkerDialog(item());
  await c.updateComplete;
  const virtualBinding = [...sr().querySelectorAll('input[name="bmode"]')]
    .find((node) => node.parentElement?.textContent?.includes(c._t('marker.virtual_option')));
  virtualBinding?.click();
  await c.updateComplete;
  const bindingResetToAuto = !!virtualBinding && c._markerDialog?.binding === 'virtual'
    && c._markerDialog?.valueSource === null
    && c._markerDialog?.valueSourceTouched === true;
  c._closeMarkerDialog();

  return {
    candidatePresent: candidateValues.includes(sourceKey),
    preview42, draftSourceExact, savedExact, actionSaved, reopenedExact,
    cancelKeptSource, plan42, static42, actionUnchanged,
    unavailableDash, unavailableStillValue, recovered55, bindingResetToAuto,
  };
});

checkAll(res);
await finish(browser, res);
