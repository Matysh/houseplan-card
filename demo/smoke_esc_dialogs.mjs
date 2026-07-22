import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const esc = async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await c.updateComplete; };
  // общие настройки
  c._openSettingsDialog(); await c.updateComplete;
  await esc(); out.settings = !c._settingsDialog;
  // правила иконок
  c._openRulesDialog(); await c.updateComplete;
  await esc(); out.rules = !c._rulesDialog;
  // диалог устройства
  c._setMode('devices'); c._openMarkerDialog(); await c.updateComplete;
  await esc(); out.marker = !c._markerDialog;
  // диалог пространства (+ очистка очереди импорта)
  c._openSpaceDialog('edit', c._space); c._importQueue = ['x']; c._importTotal = 1; await c.updateComplete;
  await esc(); out.space = !c._spaceDialog && c._importQueue.length === 0;
  // инфо-карточка устройства
  c._setMode('view'); c._infoCard = c._devices[0]; await c.updateComplete;
  await esc(); out.info = !c._infoCard;
  // инфо двери/замка
  c._openingInfo = { id: 'op1', type: 'door', rx: 550, ry: 200, len_cm: 90, lock: 'lock.front_door' }; await c.updateComplete;
  await esc(); out.openingInfo = !c._openingInfo;
  // приоритет: инфо поверх настроек — Esc закрывает только инфо
  c._openSettingsDialog(); c._infoCard = c._devices[0]; await c.updateComplete;
  await esc(); out.stacked = !c._infoCard && !!c._settingsDialog;
  await esc(); out.stacked2 = !c._settingsDialog;
  // Esc в разметке по-прежнему откатывает точку, а не только диалоги
  c._setMode('plan'); c._tool = 'draw'; c._path = [[1, 2], [3, 4]]; await c.updateComplete;
  await esc(); out.undoPointStillWorks = c._path.length === 1;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
