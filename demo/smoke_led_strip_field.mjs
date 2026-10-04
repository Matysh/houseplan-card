/** #788: test the painted light, not SVG node counts. The card renders each
 * synthetic strip through the ordinary config event. Rasterise its actual
 * field DOM at several pixel densities and compare unobstructed floor pixels
 * with the independently calculated distance to the stored polyline. This
 * catches missing end/vertex emitters, winding cancellation and hard rims.
 * Household exports are deliberately NOT fixtures in this public test.
 */
import { launch, check, finish } from './serve.mjs';
import { installLedZoomOracle } from './helpers/led-zoom-oracle.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
await page.evaluate(installLedZoomOracle);
const exactResults = [];
const outputDir = process.env.HP_LED_ZOOM_OUTPUT || 'artifacts/led-zoom-quality';
async function exact48(label, capture = false) {
  // This is a CSS/raster contract, not the input/controller witness. The latter
  // is exercised with trusted wheel/touch in smoke_led_zoom_quality.mjs.
  const result = await page.evaluate(async capture => {
    const card = window.__card, oracle = window.__ledZoomOracle;
    if (card.hasAttribute('data-led-zoom-quality')) throw new Error('exact48 requires a rested owner');
    const before = oracle.snapshot(card);
    const idle = await oracle.full48(card);
    let active, coarseRaster;
    try {
      card.setAttribute('data-led-zoom-quality', 'coarse');
      active = oracle.quality(card);
      if (capture) coarseRaster = await oracle.full48(card, { scales: [2], images: true });
    } finally { card.removeAttribute('data-led-zoom-quality'); }
    const restored = await oracle.full48(card);
    return { idle, active, restored, invariants: oracle.unchanged(card, before), coarseRaster };
  }, capture);
  for (const phase of ['idle', 'restored']) for (const row of result[phase]) {
    check(`#789 ${label} ${phase} full48 scale=${row.scale}: every pixel equals frozen pre-change48`, row.differentPixels, 0);
  }
  check(`#789 ${label}: coarse paints exactly even24 midpoint bands and keeps light visible`,
    result.active.fields.length > 0 && result.active.fields.every(f => f.retained === 48 && f.painted === 24 && f.correct24 && f.visible));
  check(`#789 ${label}: quality alone preserves all DOM, attributes and cache counters`,
    result.invariants.stable && result.invariants.cacheStable);
  if (capture) {
    await mkdir(outputDir, { recursive: true });
    for (const row of result.coarseRaster) {
      // Negative witness: a leaked coarse mode must not pass the full48 oracle.
      check(`#789 ${label}: full48 oracle rejects unrecovered24`, row.differentPixels > 0);
      for (const [kind, key] of [['active24', 'actualPng'], ['full48', 'expectedPng']]) {
        await writeFile(join(outputDir, `${label.replace(/[^a-z0-9-]/gi, '-')}-${kind}.png`), Buffer.from(row[key].split(',')[1], 'base64'));
      }
      delete row.actualPng; delete row.expectedPng;
    }
  }
  exactResults.push({ label, ...result });
}
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
    await exact48(`${scenario.name}-r${radiusCm}-${reversed ? 'reverse' : 'forward'}`,
      radiusCm === 60 && !reversed && ['acute outer turn', 'mixed free and blocked fans'].includes(scenario.name));
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
// Additional complete-pixel cases: colour/alpha are NOT overwritten to white,
// and overlap is composited over the same grey in reference and actual images.
for (const extra of ['closed-door', 'colour-alpha', 'overlap']) {
  await page.evaluate(async extra => {
    const points = extra === 'closed-door'
      ? [[.2, .22], [.55, .22], [.55, .5], [.2, .5], [.2, .22]]
      : [[.22, .3], [.5, .3], [.5, .45]];
    await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
      spaces: [{ id: 'led-oracle', title: 'Colour and door oracle', cell_cm: 5,
        rooms: [{ id: 'room', name: 'Room', poly: [[.08, .08], [.92, .08], [.92, .72], [.08, .72]] }],
        partitions: extra === 'closed-door' ? [{ id: 'barrier', a: [.6, .1], b: [.6, .7], cm: 12 }] : [],
        openings: extra === 'closed-door' ? [{ id: 'door', type: 'door', x: .6, y: .36, angle: 90, length: .14,
          host: { kind: 'partition', id: 'barrier', t: 13 / 30 } }] : [],
        wall_segments: [], decor: [], wall_columns: [], settings: { glow_enabled: true, fill_mode: 'none' },
        led_strips: [{ id: 'oracle', marker: 'oracle-light', points }, ...(extra === 'overlap'
          ? [{ id: 'overlap', marker: 'overlap-light', points: [[.3, .35], [.52, .35]] }] : [])] }],
      markers: [{ id: 'oracle-light', binding: 'virtual', is_light: true, space: 'led-oracle', room_id: 'room',
        glow_radius_cm: 120, glow_color: { c: '#75c52a', bri: .43 } },
      ...(extra === 'overlap' ? [{ id: 'overlap-light', binding: 'virtual', is_light: true, space: 'led-oracle',
        room_id: 'room', glow_radius_cm: 120, glow_color: { c: '#b552dd', bri: .37 } }] : [])],
    }));
  }, extra);
  await page.waitForTimeout(550);
  if (extra === 'closed-door') {
    const doorWitness = await page.evaluate(async () => {
      const read = () => {
        const field = window.__card.shadowRoot.querySelector('[data-led-field="oracle"]');
        return { closed: field.dataset.closed,
          clip: field.querySelector('clipPath path').getAttribute('d') };
      };
      const withDoor = read();
      await window.__hpTest.setServerConfig(cfg => { cfg.spaces[0].openings = []; return cfg; });
      const withoutDoor = read();
      await window.__hpTest.setServerConfig(cfg => {
        cfg.spaces[0].openings = [{ id: 'door', type: 'door', x: .6, y: .36, angle: 90, length: .14,
          host: { kind: 'partition', id: 'barrier', t: 13 / 30 } }];
        return cfg;
      });
      const restoredDoor = read();
      return { closed: withDoor.closed === 'true',
        openingActuallyChangesVisibility: withDoor.clip !== withoutDoor.clip,
        restoredVisibility: withDoor.clip === restoredDoor.clip };
    });
    for (const [key, value] of Object.entries(doorWitness)) check(`#789 closed rectangle/door fixture: ${key}`, value);
  }
  // Explicit alpha .43 is a raster-composition fixture, independent of the
  // product's brightness→alpha mapping (covered by the live HA smoke).
  await page.evaluate(() => {
    const pools = window.__card.shadowRoot.querySelectorAll('.led-pool');
    pools[0].setAttribute('fill', '#75c52a'); pools[0].setAttribute('fill-opacity', '0.43');
    if (pools[1]) pools[1].setAttribute('fill-opacity', '0.37');
  });
  await exact48(extra, true);
}
check('#789: original seven × three radii × two directions × three scales × two idle phases are covered',
  exactResults.slice(0, 42).reduce((n, r) => n + r.idle.length + r.restored.length, 0), 252);
await finish(browser, { distanceOracle: results, full48Oracle: exactResults });
