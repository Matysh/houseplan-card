// Owner 2026-08-04: «углы границ комнат всё ещё с зубцами». A miter join on a
// sharp corner shoots a spike far past the walls that meet there; past the
// miter limit it flips to a flat bevel. Room borders now join round, like the
// decor lines already did. Two rooms make the defect obvious: an L (a concave
// 90° corner plus the convex ones) and a wedge with a ~45° apex — the angle
// where the miter spike is longest before the miter limit clips it to a bevel.
// Usage: node demo/shot_room_joins.mjs <outdir> <name>
import { launch } from './serve.mjs';
const outDir = process.argv[2] || '/tmp';
const name = process.argv[3] || 'room_joins';
const { page, browser } = await launch({ width: 900, height: 820 }, 6);
await page.emulateMedia({ reducedMotion: 'reduce' });

await page.evaluate(async () => {
  const c = window.__card;
  const sp = c._serverCfg.spaces.find((s) => s.id === 'f1');
  delete sp.plan_url;
  sp.rooms = [
    { id: 'rL', name: '', area: 'living_room',
      poly: [[0.06, 0.04], [0.52, 0.04], [0.52, 0.14], [0.94, 0.14], [0.94, 0.26], [0.06, 0.26]] },
    { id: 'rW', name: '', area: 'kitchen',
      poly: [[0.20, 0.318], [0.90, 0.55], [0.20, 0.782]] },
  ];
  sp.settings = { ...(sp.settings || {}), show_borders: true, show_names: false,
    fill_mode: 'none', room_color: '#3ea6ff', room_opacity: 1 };
  c._cfgEpoch = (c._cfgEpoch || 0) + 1;
  c.requestUpdate();
  await c.updateComplete;
});
await page.waitForTimeout(300);
// crop tight around the wedge's ~28° apex: at plan scale the whole stage hides
// a 5-unit spike, and the spike is the entire point of the shot
const box = await page.evaluate(() => {
  const c = window.__card;
  const svg = c.shadowRoot.querySelector('.stage svg');
  const poly = [...svg.querySelectorAll('polygon.room')].pop();
  const pts = poly.getAttribute('points').split(' ').map((s) => s.split(',').map(Number));
  const apex = pts.reduce((m, p) => (p[0] > m[0] ? p : m), pts[0]);
  const m = svg.getScreenCTM();
  return { x: m.a * apex[0] + m.c * apex[1] + m.e, y: m.b * apex[0] + m.d * apex[1] + m.f };
});
await page.screenshot({ path: `${outDir}/${name}.png`,
  clip: { x: box.x - 62, y: box.y - 30, width: 72, height: 60 } });
await browser.close();
console.log('shot written to ' + outDir + '/' + name + '.png');
