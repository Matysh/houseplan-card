// Issue #317: a real sensor explicitly placed into a House Plan room owns the
// automatic room-climate vote, including when that room has no HA Area. The
// same frame feeds label, tooltip, temperature fill and hosted Static.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const baseHass = window.__mkHass();
  const localRoom = {
    id: 'local-climate', name: 'Local climate', area: null,
    poly: [[0.08, 0.62], [0.38, 0.62], [0.38, 0.82], [0.08, 0.82]],
  };
  const config = JSON.parse(JSON.stringify(card._serverCfg));
  const floor = config.spaces.find((space) => space.id === 'f1');
  floor.rooms.push(localRoom);
  floor.settings = {
    ...(floor.settings || {}), show_names: true, label_temp: true,
    label_hum: true, fill_mode: 'temp',
  };
  config.markers = [
    ...(config.markers || []).filter((marker) => marker.binding !== 'device:d_temp'),
    {
      id: 'd_temp', binding: 'device:d_temp', space: 'f1', area: null,
      room_id: localRoom.id, hidden: true,
    },
  ];

  card._serverCfg = config;
  card._cfgEpoch++;
  card._regSignature = '';
  card._maybeRebuildDevices();
  card.hass = { ...baseHass };
  card.requestUpdate();
  await card.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const localKey = '@room/f1/local-climate';
  result.localAutomatic = card._climate().get(localKey)?.temp === 22.4;
  result.registryRoomReleased = card._climate().get('living_room')?.temp == null;
  const localLabel = root().querySelector('[data-hp="room-label"][data-id="local-climate"]');
  result.labelShowsAutomatic = localLabel?.textContent.includes('22.4°') === true;
  result.oldLabelDropsMovedValue = root()
    .querySelector('[data-hp="room-label"][data-id="r1"]')?.textContent.includes('22.4°') === false;
  const localShape = root().querySelector('[data-hp="room"][data-id="local-climate"]');
  const oldShape = root().querySelector('[data-hp="room"][data-id="r1"]');
  result.localTempFill = localShape?.classList.contains('filled') === true;
  result.oldTempFillRemoved = oldShape?.classList.contains('filled') === false;

  localShape?.dispatchEvent(new PointerEvent('pointermove', {
    bubbles: true, pointerType: 'mouse', clientX: 120, clientY: 180,
  }));
  await card.updateComplete;
  result.tooltipSharesAutomatic = card._tip?.title === 'Local climate'
    && card._tip?.temp === 22.4;

  // Hosted Static receives the same config and active HA snapshot. It has no
  // tooltip/metric row by design, but its temperature fill must use the same
  // room target rather than the old visible-device/HA-Area helper.
  await customElements.whenDefined('houseplan-space-card');
  const staticHass = {
    ...baseHass,
    callWS: async (message) => {
      if (message.type === 'houseplan/config/get') return { config, rev: 317, can_write: true };
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 317 };
      return baseHass.callWS(message);
    },
  };
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
  staticCard.hass = staticHass;
  document.body.appendChild(staticCard);
  const deadline = Date.now() + 6000;
  while (!staticCard.renderRoot?.querySelector('[data-hp="room"][data-id="local-climate"]')
      && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 60));
  await staticCard.updateComplete;
  const staticRoot = staticCard.shadowRoot || staticCard.renderRoot;
  result.staticLocalTempFill = staticRoot
    ?.querySelector('[data-hp="room"][data-id="local-climate"]')
    ?.classList.contains('filled') === true;
  result.staticOldFillRemoved = staticRoot
    ?.querySelector('[data-hp="room"][data-id="r1"]')
    ?.classList.contains('filled') === false;
  staticCard.remove();

  // A configured source remains an override, not another vote or a fallback.
  const configuredRoom = floor.rooms.find((room) => room.id === localRoom.id);
  configuredRoom.settings = { temp_source: 'entity:sensor.override_temperature' };
  card._serverCfg = { ...config, spaces: [...config.spaces] };
  card._cfgEpoch++;
  card.hass = {
    ...baseHass,
    states: {
      ...baseHass.states,
      'sensor.override_temperature': {
        entity_id: 'sensor.override_temperature', state: '17',
        attributes: { device_class: 'temperature', unit_of_measurement: '°C' },
      },
    },
  };
  card.requestUpdate();
  await card.updateComplete;
  result.explicitSourceWins = card._roomTemp(card._spaceModel().rooms
    .find((room) => room.id === localRoom.id)) === 17;

  return result;
});

checkAll(out);
await finish(browser, out);
