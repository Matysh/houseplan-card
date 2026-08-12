import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  // выбрать f2 и редактор устройств
  c._space = 'garden'; c._setMode('devices'); await c.updateComplete;
  const nav = JSON.parse(localStorage.getItem('houseplan_card_nav_v1'));
  out.saved = nav.space === 'garden' && !Object.hasOwn(nav, 'mode');
  c._setMode('devices'); await c.updateComplete;
  // пересоздать карточку (эмуляция закрытия вкладки; кэш конфига в LS уже есть)
  const c2 = document.createElement('houseplan-card');
  c2.setConfig({ type: 'custom:houseplan-card' });
  c2.hass = c.hass;
  document.body.appendChild(c2);
  await new Promise((r) => setTimeout(r, 300));
  c2.hass = { ...c.hass };
  await c2.updateComplete;
  out.spaceRestored = c2._space === 'garden';
  out.modeResetToView = c2._mode === 'view';
  // A legacy record may still contain the old mode field. It is ignored.
  localStorage.setItem('houseplan_card_nav_v1', JSON.stringify({ space: 'garden', mode: 'decor' }));
  const legacy = document.createElement('houseplan-card');
  legacy.setConfig({ type: 'custom:houseplan-card' });
  legacy.hass = c.hass;
  document.body.appendChild(legacy);
  await new Promise((r) => setTimeout(r, 300));
  out.legacySpaceOnly = legacy._space === 'garden' && legacy._mode === 'view';
  legacy._setMode('devices'); await legacy.updateComplete;
  const migrated = JSON.parse(localStorage.getItem('houseplan_card_nav_v1'));
  out.legacyRewrittenOnNextNav = migrated.space === 'garden'
    && !Object.hasOwn(migrated, 'mode');
  // хэш приоритетнее сохранённого
  location.hash = '#space=f1';
  const c3 = document.createElement('houseplan-card');
  c3.setConfig({ type: 'custom:houseplan-card' });
  c3.hass = c.hass;
  document.body.appendChild(c3);
  await new Promise((r) => setTimeout(r, 300));
  out.hashWins = c3._space === 'f1' && c3._mode === 'view';
  location.hash = '';
  c2.remove(); c3.remove(); legacy.remove();
  // вернуть исходное
  c._setMode('view'); c._space = 'f1'; c._saveNav(); await c.updateComplete;
  return out;
});
checkAll(res);
await finish(browser, res);
