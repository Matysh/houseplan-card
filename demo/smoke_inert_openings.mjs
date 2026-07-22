import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  // добавить открывание на f1
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s) => s.id !== 'f1' ? s : ({
    ...s, openings: [{ id: 'op1', type: 'door', rx: 550, ry: 200, angle: 90, len_cm: 90 }] })) };
  c.requestUpdate(); await c.updateComplete;
  const hit = sr().querySelector('.op-hit');
  out.hasOpening = !!hit;
  const cs = hit ? getComputedStyle(hit) : null;
  out.viewInert = cs ? cs.pointerEvents === 'none' && cs.cursor === 'default' : null;
  out.lockBadgeInert = (() => { const l = sr().querySelector('.oplock'); return l ? getComputedStyle(l).pointerEvents === 'none' : 'no-badge'; })();
  // View: клик по открыванию ничего не открывает
  c._opClick({ stopPropagation(){} }, { id: 'op1', rx: 550, ry: 200, rlen: 90 });
  out.viewClickNoop = !c._openingInfo && !c._openingDialog;
  // курсор устройств в Просмотре — pointer, в Устройствах — grab
  const dev = sr().querySelector('.dev');
  out.viewDevCursor = getComputedStyle(dev).cursor;
  // бейдж замка: замок привязан → бейдж кликабелен и открывает инфо
  c._serverCfg = { ...c._serverCfg, spaces: c._serverCfg.spaces.map((s2) => s2.id !== 'f1' ? s2 : ({
    ...s2, openings: [{ id: 'op1', type: 'door', rx: 550, ry: 200, angle: 90, len_cm: 90, lock: 'lock.front_door' }] })) };
  c.requestUpdate(); await c.updateComplete;
  const badge = sr().querySelector('.oplock');
  out.badgeShown = !!badge;
  const bcs = badge ? getComputedStyle(badge) : null;
  out.badgeClickableInView = bcs ? bcs.pointerEvents === 'auto' && bcs.cursor === 'pointer' : null;
  badge?.click(); await c.updateComplete;
  out.badgeOpensInfo = !!c._openingInfo;
  c._openingInfo = null;
  // Plan: op-hit интерактивен, клик редактирует
  c._setMode('devices'); await c.updateComplete;
  out.devModeCursor = getComputedStyle(sr().querySelector('.dev')).cursor;
  c._setMode('plan'); await c.updateComplete;
  out.badgeInertInPlan = (() => { const b = sr().querySelector('.oplock'); return b ? getComputedStyle(b).pointerEvents === 'none' : 'no-badge'; })();
  const cs2 = getComputedStyle(sr().querySelector('.op-hit'));
  out.planInteractive = cs2.pointerEvents === 'auto' && cs2.cursor === 'grab';
  const op = c._spaceModel().openings?.[0] || { id: 'op1', rx: 550, ry: 200, rlen: 90 };
  c._opClick({ stopPropagation(){} }, op);
  out.planClickEdits = !!c._openingDialog;
  c._openingDialog = null; c._setMode('view');
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
