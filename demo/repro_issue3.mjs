// Репро №3: пользовательский путь — открыть диалог, выставить «комфорт от 25», сохранить
import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // living room: единственный термометр 22.4 → подменим на 24.0 как у пользователя
  const h = window.__mkHass();
  h.states = { ...h.states, 'sensor.living_temp': { ...h.states['sensor.living_temp'], state: '24.0' } };
  c.hass = h; c._regSignature=''; c._maybeRebuildDevices(); await c.updateComplete;
  // путь пользователя: диалог → режим temp, min=25 (макс не трогаем) → сохранить
  c._openSpaceDialog('edit', 'f1'); await c.updateComplete;
  out.dialogInit = { min: c._spaceDialog.tempMin, max: c._spaceDialog.tempMax, fill: c._spaceDialog.fillMode };
  c._spaceDialog = { ...c._spaceDialog, fillMode: 'temp', tempMin: 25 };
  await c._saveSpaceDialog(); await c.updateComplete;
  const sp = c._serverCfg.spaces.find(s=>s.id==='f1');
  out.savedSettings = sp.settings;
  const styles = [...sr().querySelectorAll('.room.styled')].map(r => (r.getAttribute('style')||'').match(/--room-fill:([^;]+)/)?.[1]);
  out.livingFill = styles[0];
  out.expected = '#4fc3f7 (blue: 24 < 25)';
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
