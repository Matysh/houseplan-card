/** Local-only visual proof for #275; external backup contents are never printed. */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import { launch } from './serve.mjs';

const input = process.argv[2];
const outputDir = resolve(process.argv[3] || '.');
const mode = process.argv.includes('--optimized') ? 'optimized' : 'raw';
const nodesArg = process.argv.find((value) => value.startsWith('--nodes='))?.slice(8) || '';
const nodes = nodesArg.split(';').filter(Boolean).map((pair) => pair.split(',').map(Number));
if (!input) {
  console.error('usage: node demo/capture_wall_strip_backup.mjs <backup> <outdir> '
    + '[--optimized] [--nodes=x,y;x,y]');
  process.exit(2);
}

const backup = JSON.parse(readFileSync(input, 'utf8'));
const payload = backup?.payload && typeof backup.payload === 'object' ? backup.payload : backup;
const source = {
  config: payload?.config && typeof payload.config === 'object' ? payload.config : payload,
  layout: payload?.layout && typeof payload.layout === 'object' ? payload.layout : {},
};
const rendered = mode === 'optimized'
  ? optimizePlans(source.config, source.layout)
  : source;
const config = rendered.config;
const layout = rendered.layout;
if (!Array.isArray(config?.spaces) || !config.spaces.length) {
  throw new Error('backup has no spaces');
}

mkdirSync(outputDir, { recursive: true });
const { page, browser } = await launch({ width: 1800, height: 1250 }, 1);
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.evaluate(async ({ cfg, lay }) => {
  const card = window.__card;
  card._serverCfg = structuredClone(cfg);
  card._layout = structuredClone(lay);
  card._space = cfg.spaces[0].id;
  card._setMode('plan');
  card._tool = 'select';
  card._cfgEpoch++;
  card._modelCache = null;
  card._frame = null;
  card._wallUnionCache = null;
  card._physicalBodiesCache = null;
  card._lightBarrierCache = null;
  card._isoGeometryCache.clear();
  card.requestUpdate();
  await card.updateComplete;
  card._fitAll();
  card.requestUpdate();
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}, { cfg: config, lay: layout });

const fullPath = resolve(outputDir, `${mode}-full.png`);
await page.screenshot({ path: fullPath, animations: 'disabled' });
for (let index = 0; index < nodes.length; index++) {
  const center = await page.evaluate(([x, y]) => {
    const card = window.__card;
    const svg = (card.shadowRoot || card.renderRoot).querySelector('.stage svg');
    const matrix = svg?.getScreenCTM?.();
    if (!matrix) return null;
    const point = new DOMPoint(x * 1000, y * 1000).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }, nodes[index]);
  if (!center) continue;
  const width = 420, height = 360;
  const clip = {
    x: Math.max(0, Math.min(1800 - width, center.x - width / 2)),
    y: Math.max(0, Math.min(1250 - height, center.y - height / 2)),
    width,
    height,
  };
  await page.screenshot({
    path: resolve(outputDir, `${mode}-node-${index + 1}.png`),
    clip,
    animations: 'disabled',
  });
}
await browser.close();
console.log(JSON.stringify({ mode, full: fullPath, crops: nodes.length }));
