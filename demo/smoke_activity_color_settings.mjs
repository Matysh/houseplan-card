// #865: actual dialog/picker, not synthetic hp-color-opacity-change events.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });
const out = await page.evaluate(async () => {
  const c = window.__card, hp = window.__hpTest, eid = 'binary_sensor.hp865_presence';
  const root = () => c.shadowRoot;
  const dialog = () => root().querySelector('hp-dialog[data-kind="marker"]');
  const picker = () => dialog()?.querySelector('.ripple-colorrow hp-color-opacity');
  const preview = () => dialog()?.querySelector('hp-device-preview')?.presentation;
  window.__addRegistryEntity(eid, 'living_room', 'on');
  c.hass = { ...c.hass, states: { ...c.hass.states,
    [eid]: { entity_id: eid, state: 'on', attributes: { device_class: 'occupancy', friendly_name: 'Presence' } },
  } };
  await hp.setServerConfig(cfg => ({ ...cfg, markers: [...cfg.markers,
    { id: 'hp865', binding: `entity:${eid}`, space: 'f1', area: 'living_room', display: 'icon_ripple' },
  ] }));
  await hp.setLayout(layout => ({ ...layout, hp865: { s: 'f1', x: 0.4, y: 0.4 } }));
  await hp.setMode('devices'); await hp.openMarkerDialog('hp865');
  return {
    presenceProjectionIsGreen: preview()?.pulse.color === '#1DC21D',
    automaticFieldMatchesProjection: picker()?.color?.toLowerCase() === '#1dc21d'
      && dialog()?.querySelector('.ripple-colorrow .hpf-hex')?.textContent.trim().toLowerCase() === '#1dc21d',
    readDoesNotSetOverride: c._markerDialog.rippleColor === '',
  };
});
checkAll(out);
await finish(browser, out);
