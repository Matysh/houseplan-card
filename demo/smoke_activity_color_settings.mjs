// #865: actual dialog/picker, not synthetic hp-color-opacity-change events.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 900 });
const out = await page.evaluate(async () => {
  const c = window.__card, hp = window.__hpTest, eid = 'binary_sensor.hp865_presence', id = `lg_${eid}`;
  const out = {};
  const root = () => c.shadowRoot;
  const dialog = () => root().querySelector('hp-dialog[data-kind="marker"]');
  const picker = () => dialog()?.querySelector('.ripple-colorrow hp-color-opacity');
  const preview = () => dialog()?.querySelector('hp-device-preview')?.presentation;
  const stored = () => c._serverCfg.markers.find(m => m.id === id);
  const settle = () => hp.settled();
  const waitFor = async fn => {
    const end = performance.now() + 5000;
    while (!fn()) { if (performance.now() > end) throw new Error('#865 timed out waiting for UI save'); await new Promise(r => setTimeout(r, 20)); }
    await settle();
  };
  const setState = async (value, attributes = { device_class: 'occupancy' }) => {
    c.hass = { ...c.hass, states: { ...c.hass.states, [eid]: { entity_id: eid, state: value, attributes } } };
    await settle();
  };
  const save = async () => {
    dialog().querySelector('.dialog-action-commit [data-hp="dialog-confirm"]').click();
    await waitFor(() => !dialog());
  };
  window.__addRegistryEntity(eid, 'living_room', 'on');
  c.hass = { ...c.hass, states: { ...c.hass.states,
    [eid]: { entity_id: eid, state: 'on', attributes: { device_class: 'occupancy', friendly_name: 'Presence' } },
  } };
  await hp.setServerConfig(cfg => ({ ...cfg, markers: [...cfg.markers,
    { id, binding: `entity:${eid}`, space: 'f1', area: 'living_room', display: 'icon_ripple' },
  ] }));
  await hp.setLayout(layout => ({ ...layout, [id]: { s: 'f1', x: 0.4, y: 0.4 } }));
  await hp.setMode('devices'); await hp.openMarkerDialog(id);
  out.presenceProjectionIsGreen = preview()?.pulse.color === '#1DC21D';
  out.automaticFieldMatchesProjection = picker()?.color?.toLowerCase() === '#1dc21d'
    && dialog()?.querySelector('.ripple-colorrow .hpf-hex')?.textContent.trim().toLowerCase() === '#1dc21d';
  out.readDoesNotSetOverride = c._markerDialog.rippleColor === '';

  picker().shadowRoot.querySelector('.trigger').click(); await settle();
  picker().shadowRoot.querySelector('.confirm').click(); await settle();
  out.unchangedConfirmDoesNotMaterializeAuto = c._markerDialog.rippleColor === '';
  await hp.input(dialog().querySelector('#marker-name'), 'Automatic activity');
  await save();
  out.saveOtherFieldKeepsAutomatic = stored().ripple_color == null;
  await hp.openMarkerDialog(id);
  picker().shadowRoot.querySelector('.trigger').click(); await settle();
  await hp.input(picker().shadowRoot.querySelector('input[type="text"]'), 'x');
  await setState('off');
  out.liveUpdateDoesNotOverwriteOpenPicker = picker().shadowRoot.querySelector('input[type="text"]').value === 'x'
    && picker().color.toLowerCase() === '#1dc21d' && c._markerDialog.rippleColor === '';
  // Close via the original trigger, retaining the existing picker mechanics.
  picker().shadowRoot.querySelector('.trigger').click(); await settle();
  await setState('on'); await setState('off');
  out.idleFieldUsesOrdinaryDemo = preview().pulse.kind === 'none'
    && picker().color.toLowerCase() === preview().pulse.color.toLowerCase();
  await setState('on');
  picker().shadowRoot.querySelector('.trigger').click(); await settle();
  await hp.input(picker().shadowRoot.querySelector('input[type="text"]'), '#123456');
  picker().shadowRoot.querySelector('.confirm').click(); await settle();
  out.nativePickerChangesPreview = c._markerDialog.rippleColor === '#123456' && preview().pulse.color === '#123456';
  await hp.input(dialog().querySelector('#marker-ripple-size'), '3');
  await save();
  out.nativePickerSavesOverride = stored().ripple_color === '#123456';

  for (const display of ['badge', 'value', 'static_icon', 'value_static_icon', 'icon_ripple']) {
    await hp.openMarkerDialog(id);
    const select = dialog().querySelector('#marker-display');
    select.value = display; select.dispatchEvent(new Event('change', { bubbles: true })); await settle();
    // All transitions change Display; the final active mode can edit size.
    if (display === 'icon_ripple') await hp.input(dialog().querySelector('#marker-ripple-size'), '3');
    await save();
    out[`save_${display}_retainsColor`] = stored().ripple_color === '#123456';
    out[`save_${display}_retainsSize`] = stored().ripple_size === 3;
  }
  await hp.openMarkerDialog(id);
  out.reopenMatchesSaved = picker().color === '#123456' && c._markerDialog.rippleSize === 3;
  picker().shadowRoot.querySelector('.trigger').click(); await settle();
  await hp.input(picker().shadowRoot.querySelector('input[type="text"]'), '#abcdef');
  picker().shadowRoot.querySelector('.confirm').click(); await settle();
  const closed = await hp.close(dialog(), { via: 'cancel' });
  if (closed.confirm) { closed.confirm.querySelector('[data-hp="dialog-confirm"]').click(); await waitFor(() => !dialog()); }
  out.cancelDoesNotSave = stored().ripple_color === '#123456';

  await hp.setMode('view');
  const pulse = () => root().querySelector(`[data-id="${id}"] .device-pulse`);
  const paintedColor = () => pulse() && getComputedStyle(pulse()).getPropertyValue('--ripple-color').trim();
  out.flatUsesSavedColor = paintedColor() === '#123456';
  await hp.setVolumetricView(true);
  out.isoUsesSavedColor = paintedColor() === '#123456';
  await hp.setVolumetricView(false);
  // Alarm is an independent safety projection, not the saved activity colour.
  await setState('on', { device_class: 'smoke' });
  out.alarmRemainsRed = pulse()?.classList.contains('alarm') && paintedColor() === '#F0410C';
  await setState('on');
  c.setConfig({ ...c._config, kiosk: true, cycle: 0 }); await settle();
  out.kioskUsesSavedColor = paintedColor() === '#123456';

  const config = structuredClone(c._serverCfg), layout = structuredClone(c._layout), writes = [];
  const baseHass = c.hass, baseCall = baseHass.callWS;
  const readonly = document.createElement('houseplan-space-card');
  readonly.setConfig({ type: 'custom:houseplan-space-card', space: 'f1' });
  readonly.hass = { ...baseHass, callWS: async message => {
    if (message.type === 'houseplan/config/get') return { config, rev: 100, can_write: false };
    if (message.type === 'houseplan/layout/get') return { layout, rev: 100 };
    if (/\/set$|\/update$|\/delete$/.test(message.type)) writes.push(message.type);
    return baseCall(message);
  } };
  document.body.append(readonly);
  await waitFor(() => readonly.shadowRoot?.querySelector(`[data-id="${id}"] .device-pulse`));
  out.readonlyUsesSavedColorWithoutWrites = getComputedStyle(readonly.shadowRoot.querySelector(`[data-id="${id}"] .device-pulse`))
    .getPropertyValue('--ripple-color').trim() === '#123456' && writes.length === 0;
  readonly.remove();
  return out;
});
checkAll(out);
await finish(browser, out);
