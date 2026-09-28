// Issue #685: a settled zoom must be a fresh vector frame, and the hatch must
// not be a bitmap pattern which a WebView can keep resampling after the live
// compositor transform is gone. This production-bundle witness owns both the
// analytic SVG paint server and its live-viewport wiring.
import { createHash } from 'node:crypto';
import { launch, checkAll, finish } from './serve.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';

const scenario = GOLDEN_SCENARIOS.find((item) => item.id === 'opening-symbol-room-wall-light');
if (!scenario) throw new Error('opening-symbol-room-wall-light fixture is missing');
const sharpnessScenario = { ...scenario, extraOpenings: [{
  id: 'sharpness-passage', type: 'passage', x: 0.62, y: 0.5, angle: 0, length: 0.06,
}] };

const { page, browser } = await launch({ width: 1000, height: 900 }, 1);
await prepareGoldenScenario(page, sharpnessScenario);

const settle = async () => {
  await page.waitForFunction(() => !window.__goldenCard?._cameraTransition?.active);
  await page.evaluate(async () => {
    const card = window.__goldenCard;
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
};

const setZoom = async (zoom) => {
  await page.evaluate((value) => {
    const card = window.__goldenCard;
    const vb = card._baseVb();
    card._applyView(value, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
    card.requestUpdate();
  }, zoom);
  await settle();
};

const state = () => page.evaluate(() => {
  const card = window.__goldenCard;
  const root = card.renderRoot;
  const scene = root.querySelector('.plan-svg');
  const view = card._viewOr(card._baseVb());
  const exact = `${view.x} ${view.y} ${view.w} ${view.h}`;
  const scenes = [...root.querySelectorAll('[data-hp-live-viewbox]')];
  const layers = [...root.querySelectorAll('[data-hp-live-layer="camera"]')];
  const gradient = root.querySelector('linearGradient#hp-wall-hatch');
  const stops = [...(gradient?.querySelectorAll('stop') || [])];
  const kinds = new Set([...root.querySelectorAll('.opening[data-kind]')]
    .map((node) => node.getAttribute('data-kind')));
  const modelKinds = new Set((card._openingsR || []).map((opening) => opening.type));
  return {
    zoom: card._zoom,
    exactViewBox: scene?.getAttribute('viewBox') === exact,
    noSceneTransform: scenes.every((node) => ['', 'none'].includes(getComputedStyle(node).transform)),
    noSceneWillChange: scenes.every((node) => !getComputedStyle(node).willChange
      || getComputedStyle(node).willChange === 'auto'),
    noLayerTransform: layers.every((node) => ['', 'none'].includes(getComputedStyle(node).transform)),
    analyticHatch: !!gradient
      && gradient.getAttribute('gradientUnits') === 'userSpaceOnUse'
      && gradient.getAttribute('spreadMethod') === 'repeat'
      && stops.length === 4
      && stops[1].getAttribute('stop-opacity') === '0'
      && stops[2].getAttribute('stop-opacity') === '0',
    openingKinds: ['door', 'window', 'gate'].every((kind) => kinds.has(kind))
      && modelKinds.has('passage'),
  };
});

const clip = await page.locator('houseplan-card').evaluate((card) => {
  const rect = card.renderRoot.querySelector('.stage').getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
});
const shotHash = async () => createHash('sha256')
  .update(await page.screenshot({ clip, animations: 'disabled', scale: 'css' }))
  .digest('hex');

// Button: 100 -> 140%.
await setZoom(1);
await page.locator('houseplan-card').evaluate((card) =>
  card.renderRoot.querySelector('[data-hp="zoom-in"]').click());
await settle();
const button = await state();
const buttonHash = await shotHash();

// A different route to the exact same target: 196 -> 140%.
await setZoom(1.96);
await page.locator('houseplan-card').evaluate((card) =>
  card.renderRoot.querySelector('[data-hp="zoom-out"]').click());
await settle();
const buttonReverse = await state();
const reverseHash = await shotHash();

// Wheel: one centred notch, 100 -> 115%.
await setZoom(1);
await page.locator('houseplan-card').evaluate((card) => {
  const stage = card.renderRoot.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  stage.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, deltaY: -100,
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  }));
});
await settle();
const wheel = await state();

// Pinch: 100 -> 132%, then release both fingers and wait for the terminal Lit
// frame. The intermediate promoted transform is allowed; the returned state is
// deliberately sampled only after the two full settled frames above.
await setZoom(1);
await page.locator('houseplan-card').evaluate((card) => {
  const stage = card.renderRoot.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const emit = (type, id, x, y) => stage.dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, cancelable: true,
    pointerId: id, pointerType: 'touch', isPrimary: id === 71,
    button: 0, buttons: type === 'pointerup' ? 0 : 1,
    clientX: rect.left + x, clientY: rect.top + y,
  }));
  const cx = rect.width / 2, cy = rect.height / 2;
  emit('pointerdown', 71, cx - 100, cy);
  emit('pointerdown', 72, cx + 100, cy);
  emit('pointermove', 71, cx - 132, cy);
  emit('pointermove', 72, cx + 132, cy);
  emit('pointerup', 71, cx - 132, cy);
  emit('pointerup', 72, cx + 132, cy);
});
await settle();
const pinch = await state();

// The same architectural SVG is shared by View and all three editors.
const modes = [];
for (const mode of ['view', 'plan', 'devices', 'decor']) {
  await page.evaluate((value) => window.__hpTest.setMode(value), mode);
  await page.waitForTimeout(350);
  await settle();
  await setZoom(1.32);
  modes.push(await state());
}

const terminal = (sample) => sample.exactViewBox && sample.noSceneTransform
  && sample.noSceneWillChange && sample.noLayerTransform && sample.analyticHatch
  && sample.openingKinds;
const out = {
  buttonSettlesAt140: Math.abs(button.zoom - 1.4) < 1e-9 && terminal(button),
  reverseButtonSettlesAt140: Math.abs(buttonReverse.zoom - 1.4) < 1e-9
    && terminal(buttonReverse),
  sameScaleIsDeterministic: buttonHash === reverseHash,
  wheelSettlesAt115: Math.abs(wheel.zoom - 1.15) < 1e-9 && terminal(wheel),
  pinchSettlesAt132: Math.abs(pinch.zoom - 1.32) < 1e-9 && terminal(pinch),
  allModesUseSettledAnalyticHatch: modes.length === 4 && modes.every(terminal),
};

checkAll(out);
await finish(browser, { ...out, buttonHash, reverseHash, button, buttonReverse, wheel, pinch, modes });
