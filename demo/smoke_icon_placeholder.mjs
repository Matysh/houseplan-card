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
  // The local picker paints its automatic fallback without a duplicate hint.
  const picker = sr().querySelector('hp-icon-picker');
  await picker.updateComplete;
  const effectiveIcon = () => picker.shadowRoot.querySelector('.trigger span')?.textContent.trim();
  out.autoIconRendered = effectiveIcon() === dev.icon
    && !!picker.shadowRoot.querySelector('.trigger > svg:not(.arrow) path');
  out.noDuplicateAutoHint = !sr().querySelector('.iconauto');
  out.automaticFallbackSet = picker.autoIcon === dev.icon && picker.value === '';
  // при явной иконке подсказки нет
  c._markerDialog = { ...c._markerDialog, icon: 'mdi:star' }; await c.updateComplete; await picker.updateComplete;
  out.explicitIconRendered = effectiveIcon() === 'mdi:star';
  out.noHintWhenExplicit = !sr().querySelector('.iconauto');
  c._markerDialog = null; await c.updateComplete;
  return out;
});
checkAll(res);
await finish(browser, res);
