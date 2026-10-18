import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('devices'); await c.updateComplete;
  // устройство без явной иконки (marker.icon пуст)
  const dev = c._devices.find((d) => !d.marker?.icon && d.icon);
  out.hasAutoDev = !!dev;
  c._openMarkerDialog(dev); await c.updateComplete;
  sr().querySelector('[data-section-target="appearance"]').click(); await c.updateComplete;
  out.autoIconStored = c._markerDialog.autoIcon === dev.icon;
  out.iconEmpty = c._markerDialog.icon === '';
  // #947: the effective automatic icon is in the picker, without a second
  // technical hint or a reset button. The fallback renders the same glyph.
  const effectiveIcon = () => sr().querySelector('ha-icon-picker')?.value
    || sr().querySelector('.hpf-iconpreview ha-icon')?.getAttribute('icon');
  out.autoIconRendered = effectiveIcon() === dev.icon;
  out.noDuplicateAutoHint = !sr().querySelector('.iconauto');
  // пикер (или фолбэк-инпут) получил placeholder
  const picker = sr().querySelector('ha-icon-picker');
  const inputs = [...sr().querySelectorAll('hp-dialog input')];
  out.placeholderSet = picker
    ? picker.placeholder === dev.icon
    : inputs.some((i) => i.placeholder === dev.icon);
  // при явной иконке подсказки нет
  c._markerDialog = { ...c._markerDialog, icon: 'mdi:star' }; await c.updateComplete;
  out.explicitIconRendered = effectiveIcon() === 'mdi:star';
  out.noHintWhenExplicit = !sr().querySelector('.iconauto');
  c._markerDialog = null; await c.updateComplete;
  return out;
});
checkAll(res);
await finish(browser, res);
