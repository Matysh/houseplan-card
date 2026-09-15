// #582: a day-cycle outline on a physically ordinary plan stored at
// 1 cm/grid-point must allocate in screen pixels, not in the 4700×4200 local
// SVG coordinate range. HA Companion loses fixed tiles when Chromium creates
// that oversized filter/overlap graph during pinch.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch(
  { width: 820, height: 760 }, 1, [], { hasTouch: true },
);
const cdp = await page.context().newCDPSession(page);
let latestLayers = [];
cdp.on('LayerTree.layerTreeDidChange', ({ layers }) => { latestLayers = layers; });
await cdp.send('LayerTree.enable');
const presentedFrames = [];
cdp.on('Page.screencastFrame', (event) => {
  if (presentedFrames.length < 90) presentedFrames.push(event.data);
  void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
});

const settle = () => page.evaluate(async () => {
  const card = window.__card;
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
});

await page.evaluate(async () => {
  const card = window.__card;
  const large = {
    id: 'hp582-large-daycycle',
    title: 'Synthetic large-coordinate floor',
    plan_url: null,
    view_box: [0, 0, 5, 4.5],
    cell_cm: 1,
    settings: { show_borders: true, fill_mode: 'custom', custom_fill: '#435468' },
    rooms: [{
      id: 'hp582-room', name: 'Large room', area: null,
      poly: [[0.1, 0.1], [4.7, 0.1], [4.7, 4.2], [0.1, 4.2]],
    }],
    wall_segments: [], walls: [], partitions: [], wall_columns: [], openings: [], decor: [],
  };
  card._serverCfg = {
    ...card._serverCfg,
    settings: { ...(card._serverCfg.settings || {}), bg_mode: 'daynight', glow_enabled: false },
    spaces: [large],
  };
  card._space = large.id;
  card._view = null;
  card._zoom = 1;
  card._cfgRev = (card._cfgRev || 0) + 1;
  card.hass = { ...card.hass, states: { ...card.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'above_horizon',
    attributes: { azimuth: 180, elevation: 40, rising: false },
  } } };
  card.requestUpdate();
  await card.updateComplete;
});
await settle();
await cdp.send('Page.startScreencast', {
  format: 'png', everyNthFrame: 1, maxWidth: 820, maxHeight: 760,
});
await page.waitForTimeout(80);

const describeContentLayers = async () => {
  const content = latestLayers.filter((layer) => layer.drawsContent);
  const described = [];
  for (const layer of content) {
    let className = '';
    if (layer.backendNodeId) {
      try {
        const { node } = await cdp.send('DOM.describeNode', { backendNodeId: layer.backendNodeId });
        const attrs = node.attributes || [];
        const classIndex = attrs.indexOf('class');
        className = classIndex >= 0 ? attrs[classIndex + 1] : '';
      } catch { /* detached between LayerTree event and inspection */ }
    }
    let reasons = [];
    try {
      ({ compositingReasons: reasons } = await cdp.send('LayerTree.compositingReasons', {
        layerId: layer.layerId,
      }));
    } catch { /* root/retired layers may have no reason record */ }
    described.push({
      className, width: layer.width, height: layer.height,
      pixels: layer.width * layer.height, reasons,
    });
  }
  return described;
};

const layerSnapshot = async () => {
  await page.waitForTimeout(80);
  const stage = await page.evaluate(() => {
    const root = window.__card.renderRoot;
    const rect = root.querySelector('.stage').getBoundingClientRect();
    const outline = root.querySelector('.hp-paper-outline-svg');
    const paper = root.querySelector('.hp-paperg');
    return {
      width: rect.width,
      height: rect.height,
      safe: root.querySelector('.stage').classList.contains('hp-safe-daycycle-outline'),
      outline: outline ? {
        viewBox: outline.getAttribute('viewBox'),
        filter: getComputedStyle(outline).filter,
        willChange: getComputedStyle(outline).willChange,
        pointerEvents: getComputedStyle(outline).pointerEvents,
        visibility: getComputedStyle(outline).visibility,
      } : null,
      paper: paper ? {
        bbox: (() => { const box = paper.getBBox(); return [box.width, box.height]; })(),
        filter: getComputedStyle(paper).filter,
        willChange: getComputedStyle(paper).willChange,
      } : null,
    };
  });
  return { stage, layers: await describeContentLayers() };
};

await page.evaluate(() => {
  const stage = window.__card.renderRoot.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const y = rect.top + rect.height / 2;
  const cx = rect.left + rect.width / 2;
  stage.setPointerCapture = () => {};
  stage.releasePointerCapture = () => {};
  window.__hp582Touch = (type, pointerId, x, buttons = 1) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, pointerId, pointerType: 'touch',
    isPrimary: pointerId === 5821, button: type === 'pointerdown' ? 0 : -1,
    buttons, clientX: x, clientY: y,
  }));
  window.__hp582Pinch = { cx };
  window.__hp582Touch('pointerdown', 5821, cx - 70);
  window.__hp582Touch('pointerdown', 5822, cx + 70);
});

for (const distance of [78, 92, 66, 104, 72, 98]) {
  await page.evaluate((distance) => {
    const { cx } = window.__hp582Pinch;
    window.__hp582Touch('pointermove', 5821, cx - distance);
    window.__hp582Touch('pointermove', 5822, cx + distance);
  }, distance);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await page.waitForTimeout(25);
}

const active = await layerSnapshot();
await page.evaluate(() => {
  const { cx } = window.__hp582Pinch;
  window.__hp582Touch('pointerup', 5821, cx - 98, 0);
  window.__hp582Touch('pointerup', 5822, cx + 98, 0);
  delete window.__hp582Touch;
  delete window.__hp582Pinch;
});
await settle();
await page.waitForTimeout(100);
await cdp.send('Page.stopScreencast');
const settled = await layerSnapshot();

const frameMetrics = await page.evaluate(async ({ encoded, stage }) => {
  const decode = (data) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:image/png;base64,${data}`;
  });
  const out = [];
  for (const data of encoded) {
    const image = await decode(data);
    const scaleX = image.width / innerWidth;
    const scaleY = image.height / innerHeight;
    const sx = Math.floor(stage.x * scaleX);
    const sy = Math.floor(stage.y * scaleY);
    const sw = Math.max(1, Math.floor(stage.width * scaleX));
    const sh = Math.max(1, Math.floor(stage.height * scaleY));
    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    const pixels = context.getImageData(0, 0, sw, sh).data;
    let sampled = 0;
    let nearWhite = 0;
    for (let y = Math.floor(sh * 0.25); y < sh * 0.75; y += 3) {
      for (let x = Math.floor(sw * 0.25); x < sw * 0.75; x += 3) {
        const offset = (y * sw + x) * 4;
        sampled++;
        if (pixels[offset] >= 245 && pixels[offset + 1] >= 245 && pixels[offset + 2] >= 245) {
          nearWhite++;
        }
      }
    }
    out.push({ nearWhiteRatio: nearWhite / Math.max(1, sampled) });
  }
  return out;
}, {
  encoded: presentedFrames,
  stage: await page.evaluate(() => {
    const rect = window.__card.renderRoot.querySelector('.stage').getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }),
});

// Contract item 6: the non-interactive houseplan-space-card never needs a
// gesture to become safe. Its day-cycle silhouette is stage-bounded from its
// first frame, while the visible paper group owns no filter layer.
const staticStage = await page.evaluate(async () => {
  await customElements.whenDefined('houseplan-space-card');
  const full = window.__card;
  const fallbackCallWS = full.hass.callWS?.bind(full.hass);
  const hass = { ...full.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/get') {
      return { config: full._serverCfg, rev: full._cfgRev || 1 };
    }
    if (message.type === 'houseplan/layout/get') return { layout: {} };
    return fallbackCallWS ? fallbackCallWS(message) : {};
  } };
  const host = document.createElement('div');
  host.style.cssText = 'width:820px';
  document.body.appendChild(host);
  const card = document.createElement('houseplan-space-card');
  card.setConfig({
    type: 'custom:houseplan-space-card', space: 'hp582-large-daycycle',
    title: '', show_button: false,
  });
  card.hass = hass;
  host.appendChild(card);
  const deadline = Date.now() + 6000;
  while (!card.renderRoot?.querySelector('.hp-static-stage') && Date.now() < deadline) {
    await new Promise((done) => setTimeout(done, 60));
  }
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  full.style.display = 'none';
  const stage = card.renderRoot?.querySelector('.hp-static-stage');
  const outline = stage?.querySelector(':scope > .hp-paper-outline-svg');
  const plan = stage?.querySelector(':scope > .hp-static-plan-svg');
  const paper = plan?.querySelector('.hp-paperg');
  const rect = stage?.getBoundingClientRect();
  return {
    width: rect?.width || 0,
    height: rect?.height || 0,
    outlinePresent: !!outline,
    outlineFilter: outline ? getComputedStyle(outline).filter : 'none',
    outlineWillChange: outline ? getComputedStyle(outline).willChange : 'auto',
    outlineVisibility: outline ? getComputedStyle(outline).visibility : 'hidden',
    outlineZ: outline ? getComputedStyle(outline).zIndex : 'auto',
    planZ: plan ? getComputedStyle(plan).zIndex : 'auto',
    paperFilter: paper ? getComputedStyle(paper).filter : 'missing',
    paperWillChange: paper ? getComputedStyle(paper).willChange : 'missing',
  };
});
await page.waitForTimeout(180);
const staticLayers = await describeContentLayers();

const checks = {};
const outlineLayers = active.layers.filter((layer) => layer.className.includes('hp-paper-outline-svg'));
const outlineLayer = outlineLayers[0];
const settledPlanLayer = settled.layers.find((layer) => layer.className.includes('plan-svg'));
const oversized = active.layers.filter((layer) => layer.width > 4096 || layer.height > 4096);
const activePixels = active.layers.reduce((sum, layer) => sum + layer.pixels, 0);
const screenPixels = active.stage.width * active.stage.height;
const staticOutlineLayers = staticLayers.filter(
  (layer) => layer.className.includes('hp-paper-outline-svg'),
);
const staticOutlineLayer = staticOutlineLayers[0];
const staticOversized = staticLayers.filter(
  (layer) => layer.width > 4096 || layer.height > 4096,
);

checks.largeCoordinateFixture = active.stage.paper?.bbox?.[0] > 4096
  && active.stage.paper?.bbox?.[1] > 4000;
checks.separateFilteredOutline = !!active.stage.outline
  && /drop-shadow/.test(active.stage.outline.filter)
  && active.stage.outline.pointerEvents === 'none'
  && active.stage.outline.visibility === 'visible';
checks.cameraActivatesSafeFallback = active.stage.safe === true;
checks.oneOutlineLayerOnly = outlineLayers.length === 1;
checks.visiblePaperUnfiltered = active.stage.paper?.filter === 'none'
  && !/filter/.test(active.stage.paper?.willChange || '');
checks.outlineLayerIsStageBounded = !!outlineLayer
  && outlineLayer.width <= active.stage.width * 1.5 + 64
  && outlineLayer.height <= active.stage.height * 1.5 + 64;
checks.no4096ContentLayer = oversized.length === 0;
// Browser chrome/root layers add a small constant. The broken graph measured
// 78.7M px against a ~0.6M px stage; the fixed graph must stay screen-order.
checks.totalContentLayerAreaIsScreenOrder = activePixels <= screenPixels * 16;
checks.terminalFrameKeepsBudget = settled.layers.every(
  (layer) => layer.width <= 4096 && layer.height <= 4096,
);
checks.settledPlanLayerIsExplicitAndBounded = !!settledPlanLayer
  && settledPlanLayer.width <= active.stage.width * 1.5 + 64
  && settledPlanLayer.height <= active.stage.height * 1.5 + 64
  && settledPlanLayer.reasons.some((reason) => reason.includes('will-change: transform'))
  && settledPlanLayer.reasons.every((reason) => !reason.includes('Overlaps other composited content'));
checks.capturedPresentedPinchFrames = frameMetrics.length >= 3;
checks.presentedFramesHaveNoWhiteTile = frameMetrics.every(
  (frame) => frame.nearWhiteRatio < 0.01,
);
checks.staticCardUsesSeparateFilteredOutline = staticStage.outlinePresent
  && staticStage.outlineVisibility === 'visible'
  && /drop-shadow/.test(staticStage.outlineFilter)
  && /filter/.test(staticStage.outlineWillChange)
  && staticStage.outlineZ === '0'
  && staticStage.planZ === '1';
checks.staticCardPaperStaysUnfiltered = staticStage.paperFilter === 'none'
  && !/filter/.test(staticStage.paperWillChange);
checks.staticCardHasOneOutlineLayer = staticOutlineLayers.length === 1;
checks.staticCardOutlineLayerIsStageBounded = !!staticOutlineLayer
  && staticOutlineLayer.width <= staticStage.width * 1.5 + 64
  && staticOutlineLayer.height <= staticStage.height * 1.5 + 64;
checks.staticCardHasNo4096ContentLayer = staticOversized.length === 0;

console.log(JSON.stringify({
  stage: active.stage,
  activePixels,
  screenPixels,
  ratio: Number((activePixels / screenPixels).toFixed(2)),
  oversized,
  activeLayers: active.layers,
  settledLayers: settled.layers,
  presentedFrameMetrics: frameMetrics,
  staticStage,
  staticLayers,
  staticOversized,
}, null, 2));
checkAll(checks);
await cdp.send('LayerTree.disable');
await finish(browser, checks);
