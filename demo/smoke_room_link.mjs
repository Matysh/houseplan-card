import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // включить имена комнат
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== c._space ? s : ({
    ...s, settings: { ...(s.settings || {}), show_names: true } })) };
  c._setMode('view'); c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250));
  // 1) комната не кликабельна: cursor default, обработчика клика нет
  const room = sr().querySelector('.room');
  out.roomCursor = getComputedStyle(room).cursor === 'default';
  // 2) значок ссылки у комнат с зоной, кликабелен, ведёт в зону
  const links = sr().querySelectorAll('.rlgo');
  out.linksShown = links.length > 0;
  const withArea = c._spaceModel().rooms.filter((r) => r.name && r.area).length;
  out.linkPerArearoom = links.length === withArea;
  const icon = links[0];
  out.linkCursor = getComputedStyle(icon).cursor === 'pointer';
  out.linkClickable = getComputedStyle(icon).pointerEvents === 'auto';
  // навигация: перехват history
  let navTo = null;
  const orig = history.pushState.bind(history);
  history.pushState = (a, b, url) => { navTo = url; };
  icon.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await c.updateComplete;
  history.pushState = orig;
  out.navigates = typeof navTo === 'string' && navTo.includes('/config/areas/area/');
  // 3) комнаты без зоны — без значка (проверено соотношением выше); в разметке значков нет
  c._setMode('plan'); await c.updateComplete;
  out.noneInPlan = sr().querySelectorAll('.rlgo').length === 0;
  c._setMode('view'); await c.updateComplete;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
