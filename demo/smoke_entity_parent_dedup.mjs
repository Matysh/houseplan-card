// #226: an entity marker owns its HA channel, while an automatic parent may
// render only the visible unclaimed residual. Proves full/touch-kiosk DOM,
// exact tap target, editor preview and the static space card from one fixture.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 390, height: 760 }, 1);
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const paint = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };

  const marker = {
    id: 'switch-as-x-light',
    binding: 'entity:light.ceiling',
    space: 'f1',
    area: 'living_room',
    tap_action: 'toggle',
  };
  card._serverCfg = {
    ...card._serverCfg,
    markers: [
      ...(card._serverCfg.markers || []).filter((item) =>
        item.binding !== 'device:d_light1' && item.binding !== 'entity:light.ceiling'),
      marker,
    ],
  };
  card._layout = {
    ...card._layout,
    [marker.id]: { s: 'f1', x: 0.22, y: 0.22 },
  };
  card._config = { ...card._config, kiosk: true };
  card._cfgEpoch++;
  card._regSignature = '';
  card._visibleDeviceSnapshot = null;
  card._candidateDeviceSnapshot = null;
  card._maybeRebuildDevices();
  card._setMode('view');
  await paint();

  const exact = card._devices.find((item) => item.id === marker.id);
  const configBeforeAction = JSON.stringify(card._serverCfg);
  const calls = [];
  const originalCallService = card.hass.callService.bind(card.hass);
  card.hass = {
    ...card.hass,
    callService: async (domain, service, data) => {
      calls.push({ domain, service, data });
      return originalCallService(domain, service, data);
    },
  };
  root().querySelector(`.dev[data-id="${marker.id}"]`)?.click();
  await wait(180);
  await paint();

  const planFacts = {
    exactOnlyInProjection: !!exact
      && !card._devices.some((item) => item.id === 'd_light1')
      && card._devices.filter((item) => item.entities.includes('light.ceiling')).length === 1,
    exactOnlyInTouchKioskDom: innerWidth === 390
      && !!root().querySelector(`.dev[data-id="${marker.id}"]`)
      && !root().querySelector('.dev[data-id="d_light1"]'),
    exactToggleTarget: calls.length === 1
      && calls[0].domain === 'light'
      && calls[0].service === 'turn_off'
      && calls[0].data?.entity_id === 'light.ceiling',
    actionDoesNotRewriteConfig: JSON.stringify(card._serverCfg) === configBeforeAction,
  };

  card._setMode('devices');
  card._openMarkerDialog(card._devices.find((item) => item.id === marker.id));
  await paint();
  const preview = root().querySelector('hp-device-preview');
  await preview?.updateComplete;
  const previewFacts = {
    editorKeepsExactBinding: card._markerDialog?.binding === 'entity:light.ceiling',
    editorPreviewHasOneFace: preview?.renderRoot?.querySelectorAll('.dev').length === 1,
  };
  card._markerDialog = null;
  card._setMode('view');
  await paint();

  await customElements.whenDefined('houseplan-space-card');
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  const baseCallWS = card.hass.callWS.bind(card.hass);
  staticCard.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/config/get') {
        return { config: card._serverCfg, rev: 226, can_write: false };
      }
      if (message.type === 'houseplan/layout/get') {
        return { layout: card._layout, rev: 226 };
      }
      return baseCallWS(message);
    },
  };
  document.body.appendChild(staticCard);
  const started = Date.now();
  while (!staticCard.renderRoot?.querySelector(`.dev[data-id="${marker.id}"]`)
      && Date.now() - started < 6000) {
    await wait(60);
  }
  await staticCard.updateComplete;
  const staticFacts = {
    staticCardHasExactEntity: !!staticCard.renderRoot?.querySelector(
      `.dev[data-id="${marker.id}"]`,
    ),
    staticCardHasNoParent: !staticCard.renderRoot?.querySelector('.dev[data-id="d_light1"]'),
  };

  return { ...planFacts, ...previewFacts, ...staticFacts };
});

await finish(browser, checkAll(out));
