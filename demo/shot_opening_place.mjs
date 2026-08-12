// Capture: the shoulder rulers + centre tick while PLACING a new opening
// (Opening tool, cursor hovering the wall centre) — owner 2026-08-03.
import { launch } from './serve.mjs';
const { page, browser } = await launch({ width: 900, height: 820 }, 2);
await page.evaluate(() => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  sp.openings = [];
  c._setMode('plan'); c._activateOpeningPlacement('door');
  c._cfgEpoch++; c.requestUpdate();
  return c.updateComplete && true;
});
await page.waitForTimeout(300);
const pt = await page.evaluate(() => {
  const c = window.__card;
  const stage = c.renderRoot.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const [vx, vy, vw, vh] = stage.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
  return { x: r.left + ((293.7 - vx) / vw) * r.width, y: r.top + ((141 - vy) / vh) * r.height,
    sx: r.left, sy: r.top, sw: r.width, sh: r.height };
});
await page.mouse.move(pt.x, pt.y, { steps: 4 });
await page.waitForTimeout(300);
await page.screenshot({ path: process.argv[2] || '/tmp/opening_place.png',
  clip: { x: pt.sx, y: pt.sy, width: pt.sw, height: Math.min(pt.sh, 420) } });
await browser.close();
console.log('shot ok');
