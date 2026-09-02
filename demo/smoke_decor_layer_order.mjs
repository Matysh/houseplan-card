/**
 * #231: decor is one composition layer above every floor treatment and below
 * live light, sun, physical geometry, opening symbols and HTML overlays.
 *
 * The raster probes are intentional. A DOM-only assertion used to pass while
 * an opaque room fill still erased decor from the rendered plan.
 */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });
const stage = page.locator('houseplan-card').locator('.stage').first();

const fixture = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.shadowRoot || c.renderRoot;
  const sp = c._serverCfg.spaces.find((space) => space.id === c._space);
  const pitch = 1 / 240;
  const wallKey = (a, b) => {
    const q = (value) => Math.round(value / pitch) * pitch;
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const length = Math.hypot(dx, dy) || 1;
    dx /= length; dy /= length;
    if (dx < -1e-12 || (Math.abs(dx) <= 1e-12 && dy < 0)) { dx = -dx; dy = -dy; }
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;
    angle = Math.round(angle * 1800) / 1800;
    return `${q((a[0] + b[0]) / 2).toFixed(6)},${q((a[1] + b[1]) / 2).toFixed(6)}@${angle.toFixed(4)}`;
  };
  const wall = (a, b) => ({ key: wallKey(a, b), a, b, cm: 30 });
  const update = async () => {
    c._cfgEpoch++;
    c.requestUpdate();
    await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const roomPoly = [[0.1, 0.15], [0.9, 0.15], [0.9, 0.85], [0.1, 0.85]];
  const imageAssetId = '7'.repeat(64);
  c._decorAssets = new Map([[imageAssetId, {
    asset_id: imageAssetId, name: 'layer-order.svg', mime: 'image/svg+xml',
    width: 2, height: 1, bytes: 100,
    url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 1"%3E%3Cpath fill="%23ff0033" d="M0 0h2v1H0z"/%3E%3C/svg%3E',
    used_by: [],
  }]]);
  sp.plan_url = null;
  sp.view_box = [0, 0, 1, 1];
  sp.cell_cm = 5;
  sp.rooms = [{
    id: 'decor-order-room', name: 'Decor room', area: 'decor_order_area', poly: roomPoly,
    settings: {},
  }];
  sp.walls = roomPoly.map((a, index) => wall(a, roomPoly[(index + 1) % roomPoly.length]));
  sp.openings = [
    { id: 'decor-order-window', type: 'window', x: 0.5, y: 0.15, angle: 0, length: 0.24 },
  ];
  sp.decor = [
    { id: 'decor-order-line', kind: 'line', x1: 0.5, y1: 0.04, x2: 0.5, y2: 0.96,
      color: '#ff0033', opacity: 1, width_cm: 8 },
    { id: 'decor-order-rect', kind: 'rect', x: 0.18, y: 0.27, w: 0.18, h: 0.12,
      color: '#ff0033', opacity: 1, width_cm: 2, fill: true,
      fill_color: '#ff6680', fill_opacity: 1 },
    { id: 'decor-order-ellipse', kind: 'ellipse', x: 0.64, y: 0.27, w: 0.18, h: 0.12,
      color: '#ff0033', opacity: 1, width_cm: 2, fill: true,
      fill_color: '#ff6680', fill_opacity: 1 },
    { id: 'decor-order-text', kind: 'text', x: 0.27, y: 0.68, text: 'DECOR',
      color: '#ff0033', opacity: 1, size_cm: 14 },
    { id: 'decor-order-furniture', kind: 'furniture', symbol: 'sofa',
      x: 0.64, y: 0.61, w: 0.18, h: 0.13, color: '#ff0033', opacity: 1, width_cm: 2 },
    { id: 'decor-order-image', kind: 'image', asset_id: imageAssetId,
      x: 0.76, y: 0.72, w: 0.08, h: 0.04, opacity: 1 },
  ];
  sp.settings = {
    ...(sp.settings || {}), fill_mode: 'custom', custom_fill: { c: '#2255cc', a: 1 },
    show_borders: false, show_names: false, hide_openings: true,
    hide_decor: false, glow_enabled: false, sun_rays: false,
  };
  c._setMode('view');
  await update();

  const svg = root().querySelector('.stage .zoomwrap > svg');
  const stageRect = root().querySelector('.stage').getBoundingClientRect();
  const ctm = svg.getScreenCTM();
  const toStage = (x, y) => {
    const point = svg.createSVGPoint(); point.x = x; point.y = y;
    const screen = point.matrixTransform(ctm);
    return [screen.x - stageRect.left, screen.y - stageRect.top];
  };
  const decor = root().querySelector('.decorlayer');
  const room = root().querySelector('[data-hp="room"][data-id="decor-order-room"]');
  const dataTunnel = root().querySelector(
    '.opening-tunnels[data-layer="data"] [data-id="decor-order-window"]',
  );
  const follows = (lower, upper) => !!lower && !!upper
    && !!(lower.compareDocumentPosition(upper) & Node.DOCUMENT_POSITION_FOLLOWING);
  const kinds = new Set([...root().querySelectorAll('.decorlayer [data-hp="decor"]')]
    .map((node) => node.dataset.kind));
  return {
    before: {
      allDecorKindsRender: ['line', 'rect', 'ellipse', 'text', 'furniture', 'image']
        .every((kind) => kinds.has(kind)),
      oneDecorLayer: root().querySelectorAll('.decorlayer').length === 1,
      dataFloorBeforeDecor: follows(room, decor) && follows(dataTunnel, decor),
      dataTunnelExists: !!dataTunnel,
    },
    probes: { room: toStage(500, 500), tunnel: toStage(500, 150) },
    stored: JSON.stringify(sp.decor),
  };
});

const customShot = await stage.screenshot({ animations: 'disabled' });

const hover = await page.evaluate(async () => {
  const c = window.__card;
  const root = c.shadowRoot || c.renderRoot;
  const room = root.querySelector('[data-hp="room"][data-id="decor-order-room"]');
  room?.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
  await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const hoverFill = root.querySelector('.room-hover-fill-layer');
  const decor = root.querySelector('.decorlayer');
  return {
    hoverFillExists: !!hoverFill,
    hoverBeforeDecor: !!hoverFill && !!decor
      && !!(hoverFill.compareDocumentPosition(decor) & Node.DOCUMENT_POSITION_FOLLOWING),
  };
});
const hoverShot = await stage.screenshot({ animations: 'disabled' });

const glow = await page.evaluate(async () => {
  const c = window.__card;
  const root = c.shadowRoot || c.renderRoot;
  const sp = c._serverCfg.spaces.find((space) => space.id === c._space);
  root.querySelector('[data-hp="room"][data-id="decor-order-room"]')?.dispatchEvent(
    new PointerEvent('pointerleave', { pointerType: 'mouse' }),
  );
  sp.rooms[0].settings = {};
  sp.settings = {
    ...sp.settings, fill_mode: 'glow', glow_enabled: true,
    show_borders: false, hide_openings: true, sun_rays: false,
  };
  c._serverCfg.settings = {
    ...(c._serverCfg.settings || {}),
    fill_colors: {
      ...(c._serverCfg.settings?.fill_colors || {}),
      glow_base: { c: '#2255cc', a: 1 },
    },
  };
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const base = root.querySelector('.glow-base-layer');
  const tunnel = root.querySelector(
    '.opening-tunnels[data-layer="glow-base"] [data-id="decor-order-window"]',
  );
  const decor = root.querySelector('.decorlayer');
  const liveGlow = root.querySelector('.glow-pools-frame');
  const follows = (lower, upper) => !!lower && !!upper
    && !!(lower.compareDocumentPosition(upper) & Node.DOCUMENT_POSITION_FOLLOWING);
  return {
    glowBaseExists: !!base,
    glowTunnelExists: !!tunnel,
    glowBaseBeforeDecor: follows(base, decor) && follows(tunnel, decor),
    decorBeforeLiveGlow: follows(decor, liveGlow),
  };
});
const glowShot = await stage.screenshot({ animations: 'disabled' });

const decodePixels = await page.evaluate(async ({ shots, probes }) => {
  const decode = async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return { width: image.width, height: image.height,
      pixels: context.getImageData(0, 0, image.width, image.height).data };
  };
  const images = await Promise.all(shots.map(decode));
  const isDecorRed = ({ width, height, pixels }, [rawX, rawY]) => {
    let red = 0; let samples = 0;
    const cx = Math.round(rawX), cy = Math.round(rawY);
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const offset = (y * width + x) * 4;
      const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
      if (r > 180 && r > g * 1.8 && r > b * 1.35) red++;
      samples++;
    }
    return samples > 0 && red / samples >= 0.6;
  };
  const verdict = (image) => ({
    room: isDecorRed(image, probes.room),
    tunnel: isDecorRed(image, probes.tunnel),
  });
  return images.map(verdict);
}, {
  shots: [customShot, hoverShot, glowShot].map((shot) => shot.toString('base64')),
  probes: fixture.probes,
});

const parity = await page.evaluate(async (stored) => {
  const c = window.__card;
  const root = c.shadowRoot || c.renderRoot;
  const sp = c._serverCfg.spaces.find((space) => space.id === c._space);
  const update = async () => {
    c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  sp.settings = {
    ...sp.settings, show_borders: true, hide_openings: false,
    sun_rays: true, north_deg: 0,
  };
  c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'above_horizon',
    attributes: { azimuth: 0, elevation: 25, rising: true },
  } } };
  await update();
  const decor = root.querySelector('.decorlayer');
  const follows = (lower, upper) => !!lower && !!upper
    && !!(lower.compareDocumentPosition(upper) & Node.DOCUMENT_POSITION_FOLLOWING);
  const liveGlow = root.querySelector('.glow-pools-frame');
  const sun = root.querySelector('.sunlayer');
  const walls = root.querySelector('.wallbodies');
  const opening = root.querySelector('[data-hp="opening"][data-id="decor-order-window"]');
  const devLayer = root.querySelector('.devlayer');
  const paper = root.querySelector('.hp-paperg');
  const out = {
    backdropBeforeDecor: follows(paper, decor),
    liveGlowAfterDecor: follows(decor, liveGlow),
    sunAfterDecor: follows(decor, sun),
    wallsAfterDecor: follows(decor, walls),
    openingSymbolsAfterDecor: follows(decor, opening),
    htmlDevicesAndLabelsAfterDecor: follows(decor, devLayer),
    renderDoesNotRewriteDecor: JSON.stringify(sp.decor) === stored,
  };

  sp.settings.hide_decor = true;
  c._setMode('view'); await update();
  out.hideDecorStillHidesView = !root.querySelector('.decorlayer');
  c._setMode('decor'); await update();
  out.ownEditorOverridesHide = !!root.querySelector('.decorlayer')
    && root.querySelectorAll('.decorlayer [data-hp="decor"]').length >= 6;
  return out;
}, fixture.stored);

const result = {
  ...fixture.before,
  ...hover,
  ...glow,
  customFillKeepsDecorPixels: decodePixels[0].room,
  customTunnelKeepsDecorPixels: decodePixels[0].tunnel,
  hoverDoesNotTintDecorPixels: decodePixels[1].room,
  hoverTunnelKeepsDecorPixels: decodePixels[1].tunnel,
  glowBaseKeepsDecorPixels: decodePixels[2].room,
  glowTunnelKeepsDecorPixels: decodePixels[2].tunnel,
  ...parity,
};

checkAll(result);
await finish(browser, result);
