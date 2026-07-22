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
  // Plan: op-hit интерактивен, клик редактирует
  c._setMode('plan'); await c.updateComplete;
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
