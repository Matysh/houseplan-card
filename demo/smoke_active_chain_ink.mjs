/**
 * Issue #307: the active wall-chain axis and nodes must stay visible on
 * already-placed segments. Every click persists the segment as an ordinary
 * partition,
 * whose opaque masonry paints above the markup layer; the chain ink therefore
 * lives in its own layer between the wall bodies and the snap overlay.
 */
import { launch, check, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => { card.requestUpdate(); await card.updateComplete; };
  const NORM_W = 1000;
  const chain = [[0.2, 0.3], [0.5, 0.3], [0.5, 0.55]];
  const partitionIds = ['partition-307-a', 'partition-307-b'];
  const cfg = {
    model_version: 10,
    spaces: [{
      id: 'ink', title: 'Ink', cell_cm: 5, view_box: [0, 0, 1, 0.7],
      rooms: [{ id: 'room', name: 'Room', area: null,
        poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.25], [0.1, 0.25]] }],
      wall_segments: [],
      partitions: chain.slice(1).map((b, index) => ({
        id: partitionIds[index], a: chain[index], b, cm: 20,
      })),
    }],
    markers: [], settings: {},
  };
  card._serverCfg = JSON.parse(JSON.stringify(cfg));
  card._layout = {};
  card._space = 'ink';
  card._modelCache = null;
  card._frame = null;
  card._cfgEpoch++;
  card._setMode('plan');
  card._tool = 'draw';
  card._path = chain.map((p) => [p[0] * NORM_W, p[1] * NORM_W]);
  card._activeWallChainId = 'chain-307';
  card._activeWallChainPartitionIds = partitionIds;
  card._wallChainSegmentCms = [20, 20];
  card._clearPlanSnapHover();
  await update();

  const stage = root().querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const view = card._viewOr(card._baseVb());
  stage.dispatchEvent(new PointerEvent('pointermove', {
    clientX: rect.left + ((0.75 * NORM_W - view.x) / view.w) * rect.width,
    clientY: rect.top + ((0.55 * NORM_W - view.y) / view.h) * rect.height,
    bubbles: true, pointerId: 71, pointerType: 'mouse',
  }));
  await update();

  const pathline = root().querySelector('polyline.pathline');
  const vertices = [...root().querySelectorAll('circle.vertex')];
  const bodies = [...root().querySelectorAll('.wallbody-fill')];
  const overlay = root().querySelector('[data-hp="plan-snap-overlay"]');
  result.pathlinePresent = !!pathline;
  result.vertexCount = vertices.length === 3;
  result.rubberBandAxis = !!root().querySelector('line.active-axis');
  result.rubberBandVertex = !!root().querySelector('circle.active-vertex');
  // AC2: document order — wall bodies → chain ink → snap overlay.
  const after = (a, b) => !!(a && b
    && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
  result.chainHasBody = bodies.length > 0;
  result.inkAboveBodies = bodies.every((body) => after(body, pathline));
  result.inkBelowSnapOverlay = after(pathline, overlay);
  // Pixel probes read the composited stage: the persisted segment's midpoint
  // must show the yellow axis, the shared chain node must show a node dot.
  return result;
});

// AC1: pixel colours at the persisted segment's axis midpoint and chain node.
// The probes are mapped to CSS right before the shot: the draw toolbar mounts
// above the stage and shifts the SVG after the first render.
const probeInfo = await page.evaluate(async () => {
  const card = window.__card;
  const root = card.shadowRoot || card.renderRoot;
  // The stage camera keeps animating after the first render; wait until the
  // screen matrix is stable so the probes match the screenshot that follows.
  const svgEl = root.querySelector('polyline.pathline').ownerSVGElement;
  let last = '';
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const m = svgEl.getScreenCTM();
    const key = [m.a, m.b, m.c, m.d, m.e, m.f].join(',');
    if (key === last) break;
    last = key;
  }
  const stage = root.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const pathline = root.querySelector('polyline.pathline');
  const svg = pathline.ownerSVGElement;
  const toCss = ([ux, uy]) => {
    const point = new DOMPoint(ux, uy).matrixTransform(svg.getScreenCTM());
    return [point.x - rect.left, point.y - rect.top];
  };
  return {
    probes: { axisMid: toCss([350, 300]), node: toCss([500, 300]) },
    rect: { width: rect.width, height: rect.height },
  };
});
const shot = await page.locator('.stage').first().screenshot({ animations: 'disabled' });
const pixels = await page.evaluate(async ([bytes, info]) => {
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const scaleX = bitmap.width / info.rect.width;
  const scaleY = bitmap.height / info.rect.height;
  const at = ([cx, cy]) => {
    const d = ctx.getImageData(Math.round(cx * scaleX), Math.round(cy * scaleY), 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const around = ([cx, cy], predicate, radius = 4) => {
    const px = Math.round(cx * scaleX);
    const py = Math.round(cy * scaleY);
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const d = ctx.getImageData(px + dx, py + dy, 1, 1).data;
      if (predicate([d[0], d[1], d[2]])) return true;
    }
    return false;
  };
  const yellowish = ([r, g, b]) => r > 200 && g > 130 && g < 220 && b < 120;
  // The node dot is tiny at this zoom: its centre may land on the dark rim
  // (#4a2800) instead of the yellow fill. Warm ink of either kind passes;
  // masonry (cold white) and the background (blue-tinted) do not.
  const warmInk = ([r, g, b]) => r > 110 && r > g && g > b && b < 130;
  return {
    axisMidYellow: around(info.probes.axisMid, yellowish),
    nodeYellow: around(info.probes.node, warmInk, 12),
    axisMidRgb: at(info.probes.axisMid),
    nodeRgb: at(info.probes.node),
  };
}, [[...shot], probeInfo]);

checkAll(out);
check('axisMidYellow', pixels.axisMidYellow, true);
check('nodeYellow', pixels.nodeYellow, true);
console.log('pixel probes:', JSON.stringify(pixels));
await finish(browser);
