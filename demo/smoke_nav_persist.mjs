import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  // выбрать f2 и редактор устройств
  c._space = 'garden'; c._setMode('devices'); await c.updateComplete;
  const nav = JSON.parse(localStorage.getItem('houseplan_card_nav_v1'));
  out.saved = nav.space === 'garden' && nav.mode === 'devices';
  // пересоздать карточку (эмуляция закрытия вкладки; кэш конфига в LS уже есть)
  const c2 = document.createElement('houseplan-card');
  c2.setConfig({ type: 'custom:houseplan-card' });
  c2.hass = c.hass;
  document.body.appendChild(c2);
  await new Promise((r) => setTimeout(r, 300));
  c2.hass = { ...c.hass };
  await c2.updateComplete;
  out.spaceRestored = c2._space === 'garden';
  out.modeRestored = c2._mode === 'devices';
  // хэш приоритетнее сохранённого
  location.hash = '#space=f1';
  const c3 = document.createElement('houseplan-card');
  c3.setConfig({ type: 'custom:houseplan-card' });
  c3.hass = c.hass;
  document.body.appendChild(c3);
  await new Promise((r) => setTimeout(r, 300));
  out.hashWins = c3._space === 'f1';
  location.hash = '';
  c2.remove(); c3.remove();
  // вернуть исходное
  c._setMode('view'); c._space = 'f1'; c._saveNav(); await c.updateComplete;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
