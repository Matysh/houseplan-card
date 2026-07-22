import { launch } from './serve.mjs';
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
  out.autoIconStored = c._markerDialog.autoIcon === dev.icon;
  out.iconEmpty = c._markerDialog.icon === '';
  // подсказка с авто-иконкой видна
  const hint = sr().querySelector('.iconauto');
  out.hintShown = !!hint && hint.textContent.includes(dev.icon);
  out.hintIcon = hint?.querySelector('ha-icon')?.getAttribute('icon') === dev.icon;
  // пикер (или фолбэк-инпут) получил placeholder
  const picker = sr().querySelector('ha-icon-picker');
  const inputs = [...sr().querySelectorAll('.dialog input')];
  out.placeholderSet = picker
    ? picker.placeholder === dev.icon
    : inputs.some((i) => i.placeholder === dev.icon);
  // при явной иконке подсказки нет
  c._markerDialog = { ...c._markerDialog, icon: 'mdi:star' }; await c.updateComplete;
  out.noHintWhenExplicit = !sr().querySelector('.iconauto');
  c._markerDialog = null; await c.updateComplete;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
