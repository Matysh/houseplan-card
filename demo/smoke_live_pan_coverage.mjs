// #544: `setLayerProjection` must expose scene pixels beyond the old SVG
// viewport while the compositor transform is live. The outer `.stage` still
// clips the card. DOM strings and a screenshot after pointerup cannot prove
// this contract, so the oracle compares held and forced-settled pixels for the
// same camera target and counts scene pixels replaced by stage background.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch(
  { width: 1100, height: 760 }, 1, [], { hasTouch: true },
);

const checks = {};
const diagnostics = {};
const frame = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(done)));
const settle = async () => {
  await page.evaluate(async () => {
    const card = document.querySelector('houseplan-card');
    await card.updateComplete;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
};
const stage = () => page.locator('houseplan-card').locator('.stage');

const resetCamera = async () => {
  await page.evaluate(async () => {
    const card = document.querySelector('houseplan-card');
    const stage = card.renderRoot.querySelector('.stage');
    const width = 300;
    card._view = {
      x: 350,
      y: 350,
      w: width,
      h: width * stage.clientHeight / stage.clientWidth,
    };
    card._zoom = 3;
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
};

const liveState = () => page.evaluate(() => {
  const card = document.querySelector('houseplan-card');
  const root = card.renderRoot;
  const scenes = [...root.querySelectorAll('[data-hp-live-viewbox]')];
  const centre = (node) => {
    const rect = node?.getBoundingClientRect();
    return rect ? [rect.left + rect.width / 2, rect.top + rect.height / 2] : null;
  };
  return {
    view: structuredClone(card._view),
    transformed: scenes.filter((node) => node.style.transform).length,
    sceneCount: scenes.length,
    allSceneOverflowOpen: scenes.length > 0
      && scenes.every((node) => node.style.overflow === 'visible'),
    allTemporaryStylesCleared: scenes.every((node) => !node.style.overflow && !node.style.transform),
    marker: centre(root.querySelector('[data-hp="device"]')),
    room: centre(root.querySelector('[data-hp="room"]')),
  };
});

const backgroundRgb = async () => page.evaluate(() => {
  const stage = document.querySelector('houseplan-card').renderRoot.querySelector('.stage');
  return (getComputedStyle(stage).backgroundColor.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
});

const compareCoverage = async (actual, reference, edge, background) => page.evaluate(async (input) => {
  const decode = async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return {
      width: image.width,
      height: image.height,
      data: context.getImageData(0, 0, image.width, image.height).data,
    };
  };
  const [left, right] = await Promise.all([decode(input.actual), decode(input.reference)]);
  if (left.width !== right.width || left.height !== right.height) {
    return { sameSize: false, missing: Number.POSITIVE_INFINITY, referenceScenePixels: 0 };
  }
  const nearBackground = (data, index) => input.background.every(
    (channel, offset) => Math.abs(data[index + offset] - channel) <= 5,
  );
  const inBand = (x, y) => {
    if (input.edge === 'left') return x < left.width * 0.14;
    if (input.edge === 'right') return x >= left.width * 0.86;
    if (input.edge === 'top') return y < left.height * 0.14;
    if (input.edge === 'bottom') return y >= left.height * 0.86;
    return true;
  };
  let missing = 0;
  let referenceScenePixels = 0;
  for (let y = 0; y < left.height; y += 1) {
    for (let x = 0; x < left.width; x += 1) {
      if (!inBand(x, y)) continue;
      const index = (y * left.width + x) * 4;
      const referenceIsScene = !nearBackground(right.data, index);
      if (!referenceIsScene) continue;
      referenceScenePixels += 1;
      if (nearBackground(left.data, index)) missing += 1;
    }
  }
  return { sameSize: true, missing, referenceScenePixels };
}, {
  actual: actual.toString('base64'),
  reference: reference.toString('base64'),
  edge,
  background,
});

const pointerCentre = async () => {
  const rect = await stage().boundingBox();
  if (!rect) throw new Error('stage has no bounding box');
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
};

const preparePointerCapture = () => page.evaluate(() => {
  const stage = document.querySelector('houseplan-card').renderRoot.querySelector('.stage');
  stage.setPointerCapture = () => {};
  stage.releasePointerCapture = () => {};
});

const dispatchTouch = (type, id, x, y, buttons = type === 'pointerup' ? 0 : 1) => page.evaluate(
  ({ type, id, x, y, buttons }) => {
    const stage = document.querySelector('houseplan-card').renderRoot.querySelector('.stage');
    stage.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      composed: true,
      cancelable: true,
      pointerId: id,
      isPrimary: id % 2 === 1,
      pointerType: 'touch',
      button: type === 'pointerdown' ? 0 : -1,
      buttons,
      clientX: x,
      clientY: y,
    }));
  },
  { type, id, x, y, buttons },
);

const runPan = async ({ name, kind, dx, dy, edge, parity = false }) => {
  await resetCamera();
  await preparePointerCapture();
  const origin = await pointerCentre();
  const before = parity ? await liveState() : null;
  if (kind === 'mouse') {
    await page.mouse.move(origin.x, origin.y);
    await page.mouse.down();
    await page.mouse.move(origin.x + dx * 0.18, origin.y + dy * 0.18);
    await frame();
    await page.mouse.move(origin.x + dx, origin.y + dy);
  } else {
    await dispatchTouch('pointerdown', 701, origin.x, origin.y);
    await dispatchTouch('pointermove', 701, origin.x + dx * 0.18, origin.y + dy * 0.18);
    await frame();
    await dispatchTouch('pointermove', 701, origin.x + dx, origin.y + dy);
  }
  await frame();
  const immediateState = await liveState();
  const immediate = await stage().screenshot({ animations: 'disabled' });
  await page.waitForTimeout(160);
  const heldState = await liveState();
  const held = await stage().screenshot({ animations: 'disabled' });
  if (kind === 'mouse') await page.mouse.up();
  else await dispatchTouch('pointerup', 701, origin.x + dx, origin.y + dy, 0);
  await settle();
  const settledState = await liveState();
  const reference = await stage().screenshot({ animations: 'disabled' });
  const background = await backgroundRgb();
  const immediateCoverage = await compareCoverage(immediate, reference, edge, background);
  const heldCoverage = await compareCoverage(held, reference, edge, background);
  const parityPx = parity && before?.marker && before?.room
    && immediateState.marker && immediateState.room
    ? Math.max(
      Math.abs((immediateState.marker[0] - before.marker[0])
        - (immediateState.room[0] - before.room[0])),
      Math.abs((immediateState.marker[1] - before.marker[1])
        - (immediateState.room[1] - before.room[1])),
    )
    : null;
  diagnostics[name] = {
    immediateCoverage,
    heldCoverage,
    transformed: immediateState.transformed,
    heldTransformed: heldState.transformed,
    sceneCount: immediateState.sceneCount,
    overflowImmediate: immediateState.allSceneOverflowOpen,
    overflowHeld: heldState.allSceneOverflowOpen,
    targetStableWhileHeld: JSON.stringify(immediateState.view) === JSON.stringify(heldState.view),
    temporaryStylesCleared: settledState.allTemporaryStylesCleared,
    parityPx,
  };
  checks[`${name}ImmediateCoverage`] = immediateCoverage.sameSize
    && immediateCoverage.referenceScenePixels > 500 && immediateCoverage.missing === 0;
  checks[`${name}HeldCoverage`] = heldCoverage.sameSize
    && heldCoverage.referenceScenePixels > 500 && heldCoverage.missing === 0;
  checks[`${name}UsesTemporaryOverflow`] = (immediateState.transformed === 0
      || immediateState.allSceneOverflowOpen)
    && (heldState.transformed === 0 || heldState.allSceneOverflowOpen)
    && settledState.allTemporaryStylesCleared;
  checks[`${name}TargetStableWhileHeld`] = diagnostics[name].targetStableWhileHeld;
  if (parity) checks[`${name}MarkerParity`] = parityPx !== null && parityPx <= 1;
};

const runTouchZoomOut = async ({ name }) => {
  await resetCamera();
  await preparePointerCapture();
  const origin = await pointerCentre();
  const beforeZoom = await page.evaluate(() => document.querySelector('houseplan-card')._zoom);
  await dispatchTouch('pointerdown', 711, origin.x - 80, origin.y);
  await dispatchTouch('pointerdown', 712, origin.x + 80, origin.y);
  await dispatchTouch('pointermove', 711, origin.x - 76, origin.y);
  await dispatchTouch('pointermove', 712, origin.x + 76, origin.y);
  await frame();
  await dispatchTouch('pointermove', 711, origin.x - 68, origin.y);
  await dispatchTouch('pointermove', 712, origin.x + 68, origin.y);
  await frame();
  const immediateState = await liveState();
  const immediate = await stage().screenshot({ animations: 'disabled' });
  await page.waitForTimeout(160);
  const heldState = await liveState();
  const held = await stage().screenshot({ animations: 'disabled' });
  await dispatchTouch('pointerup', 711, origin.x - 68, origin.y, 0);
  await dispatchTouch('pointerup', 712, origin.x + 68, origin.y, 0);
  await settle();
  const settledState = await liveState();
  const reference = await stage().screenshot({ animations: 'disabled' });
  const background = await backgroundRgb();
  const immediateCoverage = await compareCoverage(immediate, reference, 'all', background);
  const heldCoverage = await compareCoverage(held, reference, 'all', background);
  const afterZoom = await page.evaluate(() => document.querySelector('houseplan-card')._zoom);
  diagnostics[name] = {
    beforeZoom,
    afterZoom,
    immediateCoverage,
    heldCoverage,
    transformed: immediateState.transformed,
    heldTransformed: heldState.transformed,
    overflowImmediate: immediateState.allSceneOverflowOpen,
    overflowHeld: heldState.allSceneOverflowOpen,
    targetStableWhileHeld: JSON.stringify(immediateState.view) === JSON.stringify(heldState.view),
    temporaryStylesCleared: settledState.allTemporaryStylesCleared,
  };
  checks[`${name}ActuallyZoomsOut`] = afterZoom < beforeZoom;
  checks[`${name}ImmediateCoverage`] = immediateCoverage.sameSize
    && immediateCoverage.referenceScenePixels > 5000 && immediateCoverage.missing === 0;
  checks[`${name}HeldCoverage`] = heldCoverage.sameSize
    && heldCoverage.referenceScenePixels > 5000 && heldCoverage.missing === 0;
  checks[`${name}UsesTemporaryOverflow`] = (immediateState.transformed === 0
      || immediateState.allSceneOverflowOpen)
    && (heldState.transformed === 0 || heldState.allSceneOverflowOpen)
    && settledState.allTemporaryStylesCleared;
  checks[`${name}TargetStableWhileHeld`] = diagnostics[name].targetStableWhileHeld;
};

await page.evaluate(async () => {
  const card = window.__card;
  const config = structuredClone(card._serverCfg);
  const space = config.spaces.find((item) => item.id === card._space) || config.spaces[0];
  space.rooms = [{
    id: 'coverage-room',
    name: 'Coverage room',
    poly: [[0, 0], [1, 0], [1, 1], [0, 1]],
    fill_mode: 'custom',
    fill_color: '#d02020',
    fill_opacity: 1,
  }];
  space.settings = { ...(space.settings || {}), show_borders: true };
  card._serverCfg = config;
  card._space = space.id;
  card.requestUpdate();
  await card.updateComplete;
});
await settle();

await runPan({ name: 'flatMouseRightEdge', kind: 'mouse', dx: -65, dy: 0, edge: 'right' });
await runPan({ name: 'flatMouseLeftEdge', kind: 'mouse', dx: 65, dy: 0, edge: 'left' });
await runPan({ name: 'flatMouseBottomEdge', kind: 'mouse', dx: 0, dy: -48, edge: 'bottom' });
await runPan({ name: 'flatMouseTopEdge', kind: 'mouse', dx: 0, dy: 48, edge: 'top' });
await runPan({ name: 'flatTouchRightEdge', kind: 'touch', dx: -65, dy: 0, edge: 'right' });
await runTouchZoomOut({ name: 'flatTouchZoomOut' });

await page.evaluate(async () => {
  history.replaceState(null, '', '?hp_alpha=1#space=f1');
  dispatchEvent(new HashChangeEvent('hashchange'));
  const card = document.querySelector('houseplan-card');
  await card.updateComplete;
  await window.__hpEnsureHarnessIsoRuntime(card);
  card._setProjection('iso');
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
});
checks.alphaIsoEnabled = await page.evaluate(() => {
  const card = document.querySelector('houseplan-card');
  return card._effectiveProjection() === 'iso'
    && card.renderRoot.querySelector('.stage')?.getAttribute('data-hp-iso-stage') === '3';
});
await runPan({ name: 'isoMouseRightEdge', kind: 'mouse', dx: -65, dy: 0, edge: 'right', parity: true });
await runTouchZoomOut({ name: 'isoTouchZoomOut' });

await page.evaluate(async () => {
  const card = document.querySelector('houseplan-card');
  card._setProjection('flat');
  card.setConfig({ type: 'custom:houseplan-card', kiosk: true });
  await card.updateComplete;
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
});
checks.kioskEnabled = await page.evaluate(() => document.querySelector('houseplan-card')._kiosk === true);
await runPan({ name: 'kioskTouchRightEdge', kind: 'touch', dx: -65, dy: 0, edge: 'right' });

checkAll(checks);
await finish(browser, { checks, diagnostics });
