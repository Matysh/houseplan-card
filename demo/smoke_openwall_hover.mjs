import { launch } from './serve.mjs';
const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const stage = () => sr().querySelector('.stage');
  c._setMode('plan'); c._tool = 'openwall'; await c.updateComplete;
  const H = 1000 / (c._curSpaceCfg.aspect || 1);
  // 1) без наведения: курсор default, превью нет
  c._cursorPt = null; c.requestUpdate(); await c.updateComplete;
  out.idleCursor = getComputedStyle(stage()).cursor === 'default';
  out.noPreview = !sr().querySelector('.openwall-preview');
  // 2) наведение на общую стену r1|r2 (x=550): pointer + янтарное превью
  c._cursorPt = [550, 0.25 * H]; c.requestUpdate(); await c.updateComplete;
  out.hotCursor = getComputedStyle(stage()).cursor === 'pointer';
  const prev = sr().querySelectorAll('.openwall-preview');
  out.previewShown = prev.length > 0;
  out.previewAmber = prev.length ? !prev[0].classList.contains('willclose') : null;
  // превью лежит на стене x=550
  out.previewOnWall = prev.length ? Math.abs(Number(prev[0].getAttribute('x1')) - 550) < 0.5 : null;
  // 3) наведение в центр комнаты: снова default, превью исчезло
  c._cursorPt = [300, 150]; c.requestUpdate(); await c.updateComplete;
  out.missCursor = getComputedStyle(stage()).cursor === 'default';
  out.missNoPreview = !sr().querySelector('.openwall-preview');
  // 4) открыть границу → навести снова: превью красное сплошное (клик закроет)
  c._openWallClick([550, 0.25 * H]); await c.updateComplete;
  c._cursorPt = [550, 0.25 * H]; c.requestUpdate(); await c.updateComplete;
  const prev2 = sr().querySelector('.openwall-preview');
  out.willclose = prev2?.classList.contains('willclose') === true;
  // прибрать
  c._openWallClick([550, 0.25 * H]); await c.updateComplete;
  return out;
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
