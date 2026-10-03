/** #788: test the painted light, not SVG node counts. The card renders each
 * synthetic strip through the ordinary config event. Rasterise its actual
 * field DOM at several pixel densities and compare unobstructed floor pixels
 * with the independently calculated distance to the stored polyline. This
 * catches missing end/vertex emitters, winding cancellation and hard rims.
 * Household exports are deliberately NOT fixtures in this public test.
 */
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
const cases = [
  { name: 'short residual end', points: [[0.25, 0.35], [0.36225, 0.35]] },
  { name: 'diagonal residual end', points: [[0.25, 0.3], [0.341, 0.365625]] },
  { name: 'acute outer turn', points: [[0.3, 0.25], [0.32, 0.38], [0.35, 0.25]] },
  { name: 'reflected acute turn', points: [[0.3, 0.48], [0.32, 0.35], [0.35, 0.48]] },
  { name: 'decimal closed loop', points: [[0.2301, 0.2202], [0.3803, 0.2202], [0.3803, 0.4204], [0.2301, 0.4204], [0.2301, 0.2202]] },
  { name: 'intersecting path', points: [[0.3, 0.25], [0.4, 0.45], [0.3, 0.45], [0.4, 0.25]] },
  { name: 'mixed free and blocked fans', points: [[0.35, 0.35], [0.585, 0.45]], wall: true },
];
const results = [];
for (const scenario of cases) {
  for (const radiusCm of [30, 60, 120]) {
  for (const reversed of [false, true]) {
    const points = reversed ? [...scenario.points].reverse() : scenario.points;
    await page.evaluate(async ({ points, wall, radiusCm }) => {
      await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
        spaces: [{ id: 'led-oracle', title: 'LED field oracle', cell_cm: 5,
          rooms: [{ id: 'room', name: 'Room', poly: [[0.08, 0.08], [0.92, 0.08], [0.92, 0.72], [0.08, 0.72]] }],
          partitions: wall ? [{ id: 'barrier', a: [0.6, 0.1], b: [0.6, 0.7], cm: 12 }] : [],
          wall_segments: [], openings: [], decor: [], wall_columns: [],
          settings: { glow_enabled: true, fill_mode: 'none' },
          led_strips: [{ id: 'oracle', marker: 'oracle-light', points }] }],
        markers: [{ id: 'oracle-light', binding: 'virtual', is_light: true,
          space: 'led-oracle', room_id: 'room', glow_radius_cm: radiusCm,
          glow_color: { c: '#ffffff', bri: 1 } }],
      }));
    }, { points, wall: scenario.wall, radiusCm });
    await page.waitForFunction(() => window.__card.shadowRoot.querySelector('[data-led-field="oracle"]'));
    await page.waitForTimeout(550);
    const raster = await page.evaluate(async ({ points, wall, radiusCm }) => {
      const source = window.__card.shadowRoot.querySelector('.led-fields').cloneNode(true);
      // Isolate geometry/falloff from colour/brightness/animation, whose
      // user-facing lifecycle is independently covered by smoke_led_strip_glow.
      source.querySelectorAll('.led-pool').forEach(el => {
        el.setAttribute('fill', '#ffffff'); el.setAttribute('fill-opacity', '1');
      });
      const path = points.map(p => p.map(v => v * 1000));
      const r = radiusCm / 5 * (1000 / 240); // documented physical scale, not read from implementation.
      const minX = Math.floor(Math.min(...path.map(p => p[0])) - r - 2);
      const minY = Math.floor(Math.min(...path.map(p => p[1])) - r - 2);
      const w = Math.ceil(Math.max(...path.map(p => p[0])) + r + 2 - minX);
      const h = Math.ceil(Math.max(...path.map(p => p[1])) + r + 2 - minY);
      const distance = (x, y) => Math.min(...path.slice(1).map((b, i) => {
        const a = path[i], dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
      }));
      // The documented shared five-stop brightness contract, not a source import.
      const stops = [[0, 1], [0.45, 0.88], [0.70, 0.62], [0.86, 0.32], [1, 0]];
      const expectedAt = d => {
        const f = d / r;
        if (f >= 1) return 0;
        for (let i = 1; i < stops.length; i++) {
          if (f <= stops[i][0]) {
            const [x0, y0] = stops[i - 1], [x1, y1] = stops[i];
            return y0 + (y1 - y0) * (f - x0) / (x1 - x0);
          }
        }
        return 0;
      };
      const output = [];
      for (const scale of [1, 2, 4]) {
        const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="${minX} ${minY} ${w} ${h}"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="black"/>${new XMLSerializer().serializeToString(source)}</svg>`;
        const image = new Image();
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
        await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = w * scale; canvas.height = h * scale;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let worst = 0, bad = 0, checked = 0, witness = null;
        for (let py = 2; py < canvas.height - 2; py += 3) {
          for (let px = 2; px < canvas.width - 2; px += 3) {
            const x = minX + (px + 0.5) / scale, y = minY + (py + 0.5) / scale;
            // Left of the long opaque wall every source has clear sight. On
            // the far side every source is occluded (no wall ends in this ROI).
            if (wall && Math.abs(x - 595) < 2) continue;
            const expected = wall && x > 595 ? 0 : expectedAt(distance(x, y));
            const actual = data[(py * canvas.width + px) * 4] / 255;
            const error = Math.abs(expected - actual);
            checked++;
            if (error > worst) { worst = error; witness = [x, y, expected, actual]; }
            if (error > 0.06) bad++;
          }
        }
        output.push({ scale, checked, bad, worst, witness });
      }
      return output;
    }, { points, wall: scenario.wall, radiusCm });
    for (const row of raster) check(`${scenario.name}, radius=${radiusCm}cm, reverse=${reversed}, raster=${row.scale}: smooth field and opaque wall`, row.bad, 0);
    results.push({ name: scenario.name, radiusCm, reversed, raster });
  }
  }
}
await finish(browser, results);
