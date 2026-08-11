// Native HA controls in dialogs (ha-switch / ha-slider) + the fallback.
// The demo env has no HA frontend, so every OTHER smoke already runs the
// fallback branch (plain input[type=checkbox|range]). Here we check both:
// 1) fallback: without ha-* the dialogs render the classic inputs;
// 2) ha branch: after registering lightweight ha-switch/ha-slider stubs
//    (checked/value + `change`/`input`, the real contract of the HA ones)
//    a re-opened dialog renders them, values flow BOTH ways.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;

  // --- 1) fallback branch: no ha-* registered -> classic inputs ----------
  c._openMarkerDialog(c._devices[0]); await c.updateComplete;
  out.fallbackCheckbox = !!sr().querySelector('hp-dialog .srcrow input[type=checkbox]');
  out.fallbackRange = !!sr().querySelector('hp-dialog input[type=range]');
  out.fallbackNoHaSwitch = !sr().querySelector('hp-dialog ha-switch');
  c._markerDialog = null; await c.updateComplete;

  // --- 2) register stubs mimicking the HA contract -----------------------
  customElements.define('ha-switch', class extends HTMLElement {
    #on = false;
    get checked() { return this.#on; }
    set checked(v) { this.#on = !!v; }
    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
  });
  customElements.define('ha-slider', class extends HTMLElement {
    #v = 0;
    get value() { return this.#v; }
    set value(v) { this.#v = Number(v); }
    set min(_) {} set max(_) {} set step(_) {}
  });

  c._openMarkerDialog(c._devices[0]); await c.updateComplete;
  const switches = [...sr().querySelectorAll('hp-dialog ha-switch')];
  out.haSwitchRendered = switches.length >= 2; // confirmation + hide-from-plan at minimum
  out.haNoPlainCheckbox = !sr().querySelector('hp-dialog .srcrow input[type=checkbox]');
  out.lightRoleRadios = sr().querySelectorAll('hp-dialog input[name="marker-light-role"]').length === 3;
  out.glowModeRadios = sr().querySelectorAll('hp-dialog input[name="marker-glow-mode"]').length === 3;
  const sliders = [...sr().querySelectorAll('hp-dialog ha-slider')];
  out.haSliderRendered = sliders.length >= 2; // size + angle

  // --- 3) card -> control: state is pushed into the element --------------
  c._markerDialog = { ...c._markerDialog, tapConfirm: true, hideFromPlan: false };
  await c.updateComplete;
  out.downstreamChecked = [...sr().querySelectorAll('hp-dialog ha-switch')].some((el) => el.checked === true);

  // --- 4) control -> card: change with .checked lands in the dialog ------
  const before = c._markerDialog.hideFromPlan;
  const sw = [...sr().querySelectorAll('hp-dialog ha-switch')].find((el) => el.checked === before);
  sw.checked = !before;
  sw.dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;
  out.upstreamChecked = c._markerDialog.hideFromPlan === !before
    || c._markerDialog.useClimateTemp === !before || c._markerDialog.tapConfirm === !before;

  // --- 5) slider both ways ----------------------------------------------
  const sizeBefore = c._markerDialog.size;
  const sl = [...sr().querySelectorAll('hp-dialog ha-slider')].find((el) => Number(el.value) === Number(sizeBefore));
  out.downstreamValue = !!sl;
  sl.value = 2;
  sl.dispatchEvent(new Event('input', { bubbles: true }));
  await c.updateComplete;
  out.upstreamValue = c._markerDialog.size === 2;
  // `change` (fired on release, HA-version dependent) reaches the same handler
  sl.value = 2.5;
  sl.dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;
  out.upstreamValueChangeEvt = c._markerDialog.size === 2.5;

  c._markerDialog = null; await c.updateComplete;

  // --- 6) #88: the leading-entity selector is contextual ---------------
  // Give one demo device a second controllable channel in the same registry
  // shape that Home Assistant provides for real multi-channel relays.
  const extra = 'switch.ceiling_aux';
  c.hass = { ...c.hass, states: { ...c.hass.states,
    [extra]: { entity_id: extra, state: 'on', attributes: { friendly_name: 'Ceiling auxiliary' } } } };
  const multi = c._devices.find((device) => device.id === 'd_light1');
  // The production registry adapter is covered by unit/backend tests. Stub
  // only the transactional projection here so the smoke owns no shared
  // registry singleton state and remains deterministic.
  const realPreview = c._markerPreviewDevice.bind(c);
  c._markerPreviewDevice = (draft) => draft.devId === multi.id ? {
    ...multi,
    entities: [multi.primary, extra],
    marker: {
      ...(multi.marker || {}), id: multi.id, binding: `device:${multi.id}`,
      is_light: draft.lightRole === 'always' ? true : null,
      light_entity: draft.lightEntity || null,
    },
  } : realPreview(draft);
  c._openMarkerDialog(multi); await c.updateComplete;
  c._setMarkerLightRole('always'); await c.updateComplete;
  out.leadingDraftIsAlways = c._markerDialog.lightRole === 'always';
  out.leadingPreviewHasExtra = c._markerPreviewDevice(c._markerDialog)?.entities?.includes(extra) === true;
  const leading = sr().querySelector('hp-dialog #marker-light-entity');
  out.leadingSelectorForMultiple = !!leading && leading.options.length === 3;
  if (leading) {
    leading.value = extra;
    leading.dispatchEvent(new Event('change', { bubbles: true }));
    await c.updateComplete;
    out.leadingUpdatesPreview = c._markerDialog.lightEntity === extra
      && c._markerSpatialSource(c._markerDialog)?.eid === extra;
  } else {
    out.leadingUpdatesPreview = false;
  }
  c._markerDialog = null; await c.updateComplete;
  c._markerPreviewDevice = realPreview;

  const single = c._devices.find((device) => device.id === 'd_lamp');
  c._openMarkerDialog(single); await c.updateComplete;
  c._setMarkerLightRole('always'); await c.updateComplete;
  out.noLeadingSelectorForSingle = !sr().querySelector('hp-dialog #marker-light-entity');
  c._markerDialog = null; await c.updateComplete;

  // --- 7) Rebinding keeps lossless marker:* links -----------------------
  const rebindDevice = c._devices.find((item) => item.bindingKind !== 'virtual');
  c._openMarkerDialog(rebindDevice); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, controls: ['marker:future-passive-lamp'] };
  await c.updateComplete;
  sr().querySelector('hp-dialog input[name="bmode"]')?.click();
  await c.updateComplete;
  out.rebindKeepsMarkerLink = c._markerDialog.controls.includes('marker:future-passive-lamp');
  c._markerDialog = null; await c.updateComplete;

  // --- 8) #84: passive Always keeps and persists manual Glow -----------
  c._openMarkerDialog(); await c.updateComplete;
  c._markerDialog = { ...c._markerDialog, name: 'Passive lamp', bindingMode: 'virtual',
    binding: 'virtual', lightRole: 'always', lightRoleTouched: true };
  await c.updateComplete;
  const glowRadios = [...sr().querySelectorAll('hp-dialog input[name="marker-glow-mode"]')];
  out.passiveLiveModeDisabled = glowRadios.find((radio) => radio.value === 'auto')?.disabled === true;
  out.passiveManualModesEnabled = glowRadios.filter((radio) => radio.value !== 'auto')
    .every((radio) => radio.disabled === false);
  out.passiveRadiusEnabled = sr().querySelector('hp-dialog #marker-glow-radius')?.disabled === false;
  const brightness = sr().querySelector('hp-dialog .markerglowvalue ha-slider');
  brightness.value = 42;
  brightness.dispatchEvent(new Event('input', { bubbles: true }));
  await c.updateComplete;
  const passiveFields = c._markerLightFields(c._markerDialog);
  out.passiveManualGlowPersists = c._markerDialog.glowMode === 'fixed'
    && passiveFields.glow_color?.bri === 0.42;
  c._markerDialog = null; await c.updateComplete;

  // --- 9) general settings: opacity sliders take the ha branch too -------
  c._openSettingsDialog(); await c.updateComplete;
  out.gsHaSliders = sr().querySelectorAll('hp-dialog ha-slider').length >= 9;
  const gsl = sr().querySelector('hp-dialog ha-slider');
  gsl.value = 55;
  gsl.dispatchEvent(new Event('input', { bubbles: true }));
  await c.updateComplete;
  out.gsUpstream = Math.round((Object.values(c._settingsDialog.colors)[0].a) * 100) === 55;
  c._settingsDialog = null; await c.updateComplete;
  return out;
});
checkAll(res, {});
await finish(browser, res);
