// Backdrop image (docs/BACKDROP.md) — two shots for the owner:
//   backdrop_frame — the transform frame mid-gesture: dashed outline, four
//                    finger-sized corner handles, and the live "W × H" badge
//                    stating the picture's real size through cell_cm;
//   backdrop_paper — the new paper rule on an image plan: the opaque sheet is
//                    the ROOM CONTOURS, so the scene colour is visible around
//                    them and under the parts of the picture nobody has drawn
//                    over. The picture is scaled down here so both are obvious.
// Usage: node demo/shot_backdrop.mjs <outdir>
import { launch } from './serve.mjs';
const outDir = process.argv[2] || '/tmp';
const { page, browser } = await launch({ width: 900, height: 820 }, 2);
await page.emulateMedia({ reducedMotion: 'reduce' });

const settle = () => page.waitForTimeout(260);

// ---- 1) the frame, mid-drag ---------------------------------------------
await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('decor');
  c._decorTool = 'backdrop';
  c.requestUpdate();
  await c.updateComplete;
});
await settle();
const screenPt = (x, y) => page.evaluate(([x, y]) => {
  const stage = window.__card.renderRoot.querySelector('.stage');
  const r = stage.getBoundingClientRect();
  const [vx, vy, vw, vh] = stage.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
  return [r.left + ((x - vx) / vw) * r.width, r.top + ((y - vy) / vh) * r.height];
}, [x, y]);
{
  // grab the bottom-right handle and hold it mid-gesture, so the shot carries
  // the frame AND the live badge at once
  const [ax, ay] = await screenPt(1000, 900);
  const [bx, by] = await screenPt(820, 760);
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 });
  await settle();
  await page.screenshot({ path: `${outDir}/backdrop_frame.png` });
  await page.mouse.up();
}
await settle();

// ---- 2) the paper is the rooms ------------------------------------------
await page.evaluate(async () => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  // a picture pulled well inside the plan and an acid scene colour: what shows
  // through around the rooms is the SCENE, which is the whole new rule
  sp.plan_x = 0.16; sp.plan_y = 0.10; sp.plan_scale = 0.62;
  c._serverCfg.settings = { ...(c._serverCfg.settings || {}), bg_color: '#7bd389' };
  c._cfgEpoch++; c._frame = null;
  c._setMode('view');
  c.requestUpdate();
  await c.updateComplete;
  c._fitAll();
  c.requestUpdate();
  await c.updateComplete;
});
await settle();
await settle();
await page.screenshot({ path: `${outDir}/backdrop_paper.png` });

await browser.close();
console.log('shots written to ' + outDir + '/backdrop_frame.png, ' + outDir + '/backdrop_paper.png');
