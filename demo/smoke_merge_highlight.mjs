import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('plan'); c._tool = 'merge'; await c.updateComplete;
  const room = c._spaceModel().rooms.find((r) => r.name);
  c._mergeSel = room.id; c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250)); // дождаться transition 0.12s
  const el = [...sr().querySelectorAll('.room')].find((e) => e.classList.contains('picked'));
  out.pickedRendered = !!el;
  const cs = el ? getComputedStyle(el) : null;
  out.amberStroke = cs ? cs.stroke.includes('255, 193, 77') : null;
  out.amberFill = cs ? cs.fill.includes('255, 193, 77') : null;
  // split-выбор подсвечивается так же
  c._mergeSel = null; c._tool = 'split'; c._splitSel = { roomId: room.id }; c.requestUpdate(); await c.updateComplete;
  await new Promise((r) => setTimeout(r, 250));
  const el2 = [...sr().querySelectorAll('.room')].find((e) => e.classList.contains('picked'));
  out.splitPicked = !!el2 && getComputedStyle(el2).stroke.includes('255, 193, 77');
  return out;
});
console.log(JSON.stringify(res));
await browser.close();
