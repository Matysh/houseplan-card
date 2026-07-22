import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const gs = () => !!sr().querySelector('.head .btn[title="' + c._t('title.general_settings') + '"]');
  out.view = gs();
  c._setMode('plan'); await c.updateComplete; out.plan = gs();
  c._setMode('devices'); await c.updateComplete; out.devices = gs();
  c._setMode('view'); await c.updateComplete;
  sr().querySelector('.head .btn[title="' + c._t('title.general_settings') + '"]').click();
  await c.updateComplete;
  out.opensInView = !!c._settingsDialog;
  return out;
});
console.log(JSON.stringify(res));
await browser.close();
