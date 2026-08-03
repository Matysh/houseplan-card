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
  out.fallbackCheckbox = !!sr().querySelector('.dialog .srcrow input[type=checkbox]');
  out.fallbackRange = !!sr().querySelector('.dialog input[type=range]');
  out.fallbackNoHaSwitch = !sr().querySelector('.dialog ha-switch');
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
  const switches = [...sr().querySelectorAll('.dialog ha-switch')];
  out.haSwitchRendered = switches.length >= 2; // is_light + hide-from-plan at minimum
  out.haNoPlainCheckbox = !sr().querySelector('.dialog .srcrow input[type=checkbox]');
  const sliders = [...sr().querySelectorAll('.dialog ha-slider')];
  out.haSliderRendered = sliders.length >= 2; // size + angle

  // --- 3) card -> control: state is pushed into the element --------------
  c._markerDialog = { ...c._markerDialog, isLight: true, hideFromPlan: false };
  await c.updateComplete;
  out.downstreamChecked = [...sr().querySelectorAll('.dialog ha-switch')].some((el) => el.checked === true);

  // --- 4) control -> card: change with .checked lands in the dialog ------
  const before = c._markerDialog.hideFromPlan;
  const sw = [...sr().querySelectorAll('.dialog ha-switch')].find((el) => el.checked === before);
  sw.checked = !before;
  sw.dispatchEvent(new Event('change', { bubbles: true }));
  await c.updateComplete;
  out.upstreamChecked = c._markerDialog.hideFromPlan === !before || c._markerDialog.isLight === !before
    || c._markerDialog.useClimateTemp === !before || c._markerDialog.tapConfirm === !before;

  // --- 5) slider both ways ----------------------------------------------
  const sizeBefore = c._markerDialog.size;
  const sl = [...sr().querySelectorAll('.dialog ha-slider')].find((el) => Number(el.value) === Number(sizeBefore));
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

  // --- 6) general settings: opacity sliders take the ha branch too -------
  c._openSettingsDialog(); await c.updateComplete;
  out.gsHaSliders = sr().querySelectorAll('.dialog ha-slider').length >= 9;
  const gsl = sr().querySelector('.dialog ha-slider');
  gsl.value = 55;
  gsl.dispatchEvent(new Event('input', { bubbles: true }));
  await c.updateComplete;
  out.gsUpstream = Math.round((Object.values(c._settingsDialog.colors)[0].a) * 100) === 55;
  c._settingsDialog = null; await c.updateComplete;
  return out;
});
checkAll(res, {});
await finish(browser, res);
