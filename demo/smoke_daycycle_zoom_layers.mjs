// #689: with the day/night background the plan layers must stay stage-sized at
// any zoom, and the scene must not keep a will-change: transform hint (its explicit layer is
// an opacity hint). Before
// the fix, CDP LayerTree measured (~460 %, DPR 2) plan-svg at 15.9× and the
// filtered outline at 13.2× the stage during a gesture, the outline at 12.8×
// at rest; at 800 % that is hundreds of MB of GPU memory and navigation
// flashed white. The same will-change: transform hint froze the raster scale:
// zooming from 100 % showed the 100 % raster stretched. Headless Chromium can
// see neither the blur nor the flashes (owner-verified in real Chrome), so this
// witness measures the state that causes them: layer sizes and the hint.
import { launch, checkAll, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';

const { page, browser } = await launch({ width: 820, height: 760 }, 2);
const cdp = await page.context().newCDPSession(page);
let latestLayers = [];
cdp.on('LayerTree.layerTreeDidChange', ({ layers }) => { latestLayers = layers; });
await cdp.send('LayerTree.enable');
const frames = [];
cdp.on('Page.screencastFrame', (event) => {
  if (frames.length < 120) frames.push(event.data);
  void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
});

const settle = async () => {
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    await window.__card.updateComplete;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
};

const dayNight = async () => {
  // A dark custom room fill keeps the near-white frame sample meaningful at
  // 800 %, where the demo's own light paper would otherwise fill the stage.
  await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => ({
    ...cfg,
    settings: { ...(cfg.settings || {}), bg_mode: 'daynight', glow_enabled: false },
    spaces: cfg.spaces.map((space) => ({
      ...space, settings: { ...(space.settings || {}), fill_mode: 'custom', custom_fill: '#435468' },
    })),
  })));
  await page.evaluate(async () => {
    const card = window.__card;
    card.hass = { ...card.hass, states: { ...card.hass.states, 'sun.sun': {
      entity_id: 'sun.sun', state: 'above_horizon',
      attributes: { azimuth: 180, elevation: 40, rising: false },
    } } };
    await card.updateComplete;
  });
  await settle();
};

const stageBox = () => page.evaluate(() => {
  const rect = window.__card.renderRoot.querySelector('.stage').getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
});

const snapshot = async () => {
  await page.waitForTimeout(80);
  const state = await page.evaluate(() => {
    const root = window.__card.renderRoot;
    const stage = root.querySelector('.stage');
    const plan = root.querySelector('.plan-svg');
    const outline = root.querySelector('.hp-paper-outline-svg');
    return {
      zoom: window.__card._zoom,
      daycycle: stage.classList.contains('daycycle'),
      safe: stage.classList.contains('hp-safe-daycycle-outline'),
      planWillChange: getComputedStyle(plan).willChange,
      planTransform: getComputedStyle(plan).transform,
      outlineOverflow: outline ? getComputedStyle(outline).overflow : null,
      outlineInline: outline ? `${outline.style.overflow}|${outline.style.clipPath}` : null,
      sceneClips: [...root.querySelectorAll('[data-hp-live-viewbox]')].map((node) => node.style.clipPath || ''),
    };
  });
  const layers = [];
  for (const layer of latestLayers.filter((item) => item.drawsContent)) {
    let name = '';
    if (layer.backendNodeId) {
      try {
        const { node } = await cdp.send('DOM.describeNode', { backendNodeId: layer.backendNodeId });
        const attrs = node.attributes || [];
        const index = attrs.indexOf('class');
        name = index >= 0 ? attrs[index + 1] : node.nodeName;
      } catch { /* detached between the event and inspection */ }
    }
    let reasons = [];
    try {
      ({ compositingReasons: reasons } = await cdp.send('LayerTree.compositingReasons', {
        layerId: layer.layerId,
      }));
    } catch { /* retired layers may have no reason record */ }
    layers.push({ name, width: layer.width, height: layer.height, reasons });
  }
  return { state, layers };
};

// Everything the card paints; the page root and the sticky header are not plan.
const planLayers = (snap) => snap.layers.filter((layer) => layer.name
  && layer.name !== '#document' && !/\bhdr\b/.test(layer.name));
const within = (snap, stage, factor) => planLayers(snap).every((layer) =>
  layer.width <= stage.width * factor + 240 && layer.height <= stage.height * factor + 240);
const largest = (snap) => planLayers(snap).reduce((max, layer) =>
  Math.max(max, layer.width * layer.height), 0);

const wheelAt = async (stage, deltaY, count) => {
  // Near a corner: the hover tooltip stays out of the central frame sample.
  await page.mouse.move(stage.x + 40, stage.y + 40);
  for (let i = 0; i < count; i++) {
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(24);
  }
};

await dayNight();
const stage = await stageBox();
await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 2, maxWidth: 820, maxHeight: 760 });

// A: page loaded at 100 %, zoomed to 800 % with the wheel (owner's blur path).
await wheelAt(stage, -240, 30);
const zoomingIn = await snapshot();
await settle();
const zoomedIn = await snapshot();

// The buttons and a pinch settle into the same hint-free scene (AC1).
const clickZoom = (hook) => page.evaluate((hook) =>
  window.__card.renderRoot.querySelector(`[data-hp="${hook}"]`).click(), hook);
await clickZoom('zoom-out'); await settle();
await clickZoom('zoom-in'); await settle();
const buttons = await snapshot();
await page.evaluate(() => {
  const stage = window.__card.renderRoot.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  stage.setPointerCapture = () => {};
  stage.releasePointerCapture = () => {};
  const emit = (type, id, x) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true, pointerId: id, pointerType: 'touch',
    isPrimary: id === 6891, button: type === 'pointerdown' ? 0 : -1,
    buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: rect.top + rect.height / 2,
  }));
  const cx = rect.left + rect.width / 2;
  emit('pointerdown', 6891, cx - 120); emit('pointerdown', 6892, cx + 120);
  emit('pointermove', 6891, cx - 90); emit('pointermove', 6892, cx + 90);
  emit('pointerup', 6891, cx - 90); emit('pointerup', 6892, cx + 90);
});
await settle();
const pinched = await snapshot();
await wheelAt(stage, -240, 12);
await settle();

// B: reload at 800 % (the camera is restored), day/night again, then navigate
// (owner's white-flash path).
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__card?._model?.length > 0, { timeout: 9000 });
await installHpTestOnPage(page);
await dayNight();
const reloaded = await snapshot();
await wheelAt(stage, 240, 3);
const navigating = await snapshot();
await wheelAt(stage, -240, 6);
await settle();
const navigated = await snapshot();
await cdp.send('Page.stopScreencast');

const nearWhite = await page.evaluate(async ({ encoded, stage }) => {
  const out = [];
  for (const data of encoded) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/png;base64,${data}`;
    });
    const sx = image.width / innerWidth, sy = image.height / innerHeight;
    const w = Math.max(1, Math.floor(stage.width * sx)), h = Math.max(1, Math.floor(stage.height * sy));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, Math.floor(stage.x * sx), Math.floor(stage.y * sy), w, h, 0, 0, w, h);
    const px = context.getImageData(0, 0, w, h).data;
    let sampled = 0, white = 0;
    for (let y = Math.floor(h * 0.25); y < h * 0.75; y += 3) {
      for (let x = Math.floor(w * 0.25); x < w * 0.75; x += 3) {
        const o = (y * w + x) * 4;
        sampled++;
        if (px[o] >= 250 && px[o + 1] >= 250 && px[o + 2] >= 250) white++;
      }
    }
    out.push(white / Math.max(1, sampled));
  }
  return out;
}, { encoded: frames, stage });

const planReasons = (snap) => planLayers(snap).find((layer) => /\bplan-svg\b/.test(layer.name))?.reasons || [];
const out = {
  dayNightSafeAt800: zoomedIn.state.daycycle && zoomedIn.state.safe && zoomedIn.state.zoom === 8,
  reloadRestores800Untouched: reloaded.state.daycycle && !reloaded.state.safe && reloaded.state.zoom === 8,
  // K1: no frozen raster — the explicit layer is a trivial 3D transform.
  settledSceneHasNoWillChangeHint: [zoomedIn, buttons, pinched, navigated]
    .every((snap) => snap.state.planWillChange === 'opacity'),
  buttonAndPinchChangedTheCamera: buttons.state.safe && pinched.state.zoom < 8,
  // The scene stays an explicit layer (#582), but no reason is the hint that
  // freezes the raster scale, and it is never an implicit overlap layer.
  settledSceneLayerIsExplicitWithoutHint: planReasons(zoomedIn).some((reason) => /will-change: opacity/.test(reason))
    && planReasons(zoomedIn).every((reason) => !/will-change: transform/.test(reason)
      && !/Overlaps other composited content/.test(reason)),
  // K3: layers stay stage-sized at 800 %.
  gestureLayersWithinBudget: within(zoomingIn, stage, 1.5) && within(navigating, stage, 1.5),
  settledLayersWithinBudget: [zoomedIn, buttons, pinched, reloaded, navigated]
    .every((snap) => within(snap, stage, 1)),
  outlineClippedToItsBox: zoomedIn.state.outlineOverflow === 'hidden'
    && navigating.state.outlineInline === '|' && navigated.state.outlineInline === '|',
  idleScenesKeepNoClip: [zoomedIn, buttons, pinched, reloaded, navigated].every((snap) => snap.state.sceneClips.every((clip) => clip === '')),
  capturedFrames: nearWhite.length >= 3,
  // A white/transparent frame covers the stage; white glyphs of 800 % device
  // markers stay a few per cent of the central sample.
  noWhiteFrames: nearWhite.every((ratio) => ratio < 0.25),
};

console.log(JSON.stringify({
  stage,
  largest: {
    zoomingIn: largest(zoomingIn), zoomedIn: largest(zoomedIn), reloaded: largest(reloaded),
    navigating: largest(navigating), navigated: largest(navigated),
  },
  layers: { zoomingIn: planLayers(zoomingIn), zoomedIn: planLayers(zoomedIn), navigating: planLayers(navigating) },
  states: {
    zoomingIn: zoomingIn.state, zoomedIn: zoomedIn.state, buttons: buttons.state,
    pinched: pinched.state, reloaded: reloaded.state, navigated: navigated.state,
  },
  whiteMax: Math.max(0, ...nearWhite),
}, null, 1));
checkAll(out);
await cdp.send('LayerTree.disable');
await finish(browser, out);
