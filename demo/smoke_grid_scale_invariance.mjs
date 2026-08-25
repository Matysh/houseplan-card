// Issue #239: a finer coordinate grid changes precision, never the visible plan.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 860 }, 1, [], {
  reducedMotion: 'reduce',
});

await page.evaluate(async () => {
  const card = window.__card;
  const base = {
    id: 'f1', title: 'Grid invariant', plan_url: '/assets/f1.svg', plan_aspect: 1.25,
    view_box: [0, 0, 1, 1], cell_cm: 5,
    settings: {
      show_borders: true, show_names: true, fill_mode: 'custom',
      custom_fill: { c: '#d8e2e8', a: 0.22 }, room_color: '#2d8fce', room_opacity: 0.8,
      hide_decor: false, hide_openings: false, glow_enabled: true, sun_rays: false,
    },
    rooms: [{
      id: 'r1', name: 'Living room', area: 'living_room',
      poly: [[0.10, 0.12], [0.90, 0.12], [0.90, 0.88], [0.10, 0.88]],
    }],
    openings: [
      { id: 'grid-door', type: 'door', x: 0.50, y: 0.12, angle: 0, length: 0.16 },
      { id: 'grid-window', type: 'window', x: 0.90, y: 0.48, angle: 90, length: 0.14 },
      { id: 'grid-gate', type: 'gate', x: 0.38, y: 0.88, angle: 0, length: 0.22 },
    ],
    partitions: [{ id: 'grid-partition', a: [0.28, 0.34], b: [0.72, 0.34], cm: 15 }],
    wall_columns: [{ id: 'grid-column', shape: 'circle', center: [0.72, 0.68], cm: 32 }],
    decor: [{
      id: 'grid-decor', kind: 'line', x1: 0.20, y1: 0.72, x2: 0.58, y2: 0.72,
      color: '#6b4d32', opacity: 0.9, width_cm: 1.2, line_style: 'dashed',
    }],
  };
  const baseLayout = {
    d_light1: { s: 'f1', x: 0.24, y: 0.24 },
    d_lamp: { s: 'f1', x: 0.42, y: 0.54 },
    d_tv: { s: 'f1', x: 0.70, y: 0.54 },
    d_temp: { s: 'f1', x: 0.72, y: 0.24 },
  };
  const sharedLayout = card._layout;
  const originalGridLevels = card._gridLevels.bind(card);
  const scalePoint = (point, factor) => point.map((value) => value * factor);
  const scaledFixture = (cellCm) => {
    const factor = 5 / cellCm;
    const space = structuredClone(base);
    space.cell_cm = cellCm;
    space.view_box = [0, 0, factor, factor];
    space.plan_scale_x = factor;
    space.plan_scale_y = factor;
    // Keep an intentionally transformed backdrop in both fixtures. The 1.25
    // image starts at y=.1; both its offset and that origin scale physically.
    space.plan_x = 0.02 * factor;
    space.plan_y = 0.11 * factor - 0.1;
    space.rooms.forEach((room) => { room.poly = room.poly.map((point) => scalePoint(point, factor)); });
    space.openings.forEach((opening) => {
      opening.x *= factor; opening.y *= factor; opening.length *= factor;
    });
    space.partitions.forEach((partition) => {
      partition.a = scalePoint(partition.a, factor);
      partition.b = scalePoint(partition.b, factor);
    });
    space.wall_columns.forEach((column) => { column.center = scalePoint(column.center, factor); });
    space.decor.forEach((shape) => {
      for (const key of ['x1', 'y1', 'x2', 'y2']) shape[key] *= factor;
    });
    return { space, factor };
  };
  const settle = async () => {
    card.requestUpdate();
    await card.updateComplete;
    for (let index = 0; index < 3; index++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    // Room paths deliberately animate between View and Plan styles for 120 ms.
    // Compare settled render states, not two different interpolation frames.
    await new Promise((resolve) => setTimeout(resolve, 150));
  };
  window.__applyGridScaleFixture = async (cellCm, mode = 'view', projection = 'flat') => {
    const { space, factor } = scaledFixture(cellCm);
    card._serverCfg.spaces.splice(0, card._serverCfg.spaces.length, space);
    card._space = 'f1';
    for (const key of Object.keys(sharedLayout)) delete sharedLayout[key];
    Object.assign(sharedLayout, Object.fromEntries(Object.entries(baseLayout).map(([id, pos]) => [id, {
      ...pos, x: pos.x * factor, y: pos.y * factor,
    }])));
    card._layout = sharedLayout;
    card._cfgEpoch++;
    card._modelCache = null;
    card._frame = null;
    card._view = null;
    card._showFar = false;
    card._regSignature = '';
    card._maybeRebuildDevices();
    card._mode = mode;
    card._tool = mode === 'plan' ? 'draw' : null;
    card._decorTool = mode === 'decor' ? 'backdrop' : 'select';
    // Grid density is the one allowed difference. Mask it in every editor
    // raster pair and prove the precision ratio separately below.
    card._gridLevels = mode === 'view' ? originalGridLevels : () => null;
    card._labs = { ...card._labs, active: projection === 'iso' ? ['iso'] : [] };
    card._viewPreference = { ...card._viewPreference, f1: projection };
    card._isoFallback.clear();
    card._isoGeometryCache.clear();
    await settle();
    card._fitAll();
    await settle();
  };
  window.__gridScaleMetrics = () => {
    const root = card.renderRoot;
    const number = (value) => Number.parseFloat(value || '0');
    const style = (selector) => {
      const node = root.querySelector(selector);
      return node ? getComputedStyle(node) : null;
    };
    const rect = (selector) => {
      const node = root.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return [box.width, box.height];
    };
    const opening = root.querySelector('[data-id="grid-door"]');
    const outline = opening?.querySelector('.op-outline');
    const hit = opening?.querySelector('.op-hit');
    const leaf = opening?.querySelector('.op-leaf rect');
    return {
      factor: number(style('.stage')?.getPropertyValue('--hp-cell-visual-scale')),
      roomStroke: number(style('.room.styled')?.strokeWidth),
      wallStroke: number(style('.wallbody')?.strokeWidth),
      arcStroke: number(style('.op-arc')?.strokeWidth),
      openingLeafHeight: number(leaf?.getAttribute('height')),
      openingOutlineWidth: number(outline?.getAttribute('width')),
      openingHitWidth: number(hit?.getAttribute('width')),
      openingBox: rect('[data-id="grid-door"]'),
      wallBox: rect('.wallbody'),
      deviceBox: rect('[data-hp="device"]'),
      roomLabelBox: rect('[data-hp="room-label"]'),
      decorBox: rect('[data-hp="decor"][data-id="grid-decor"]'),
      glowBox: rect('.glow-spot'),
      snapNodeBox: rect('.plan-snap-node[data-kind="endpoint"]'),
      backdropHandleBox: rect('.bdhandle'),
      backdropKnobBox: rect('.bdknob'),
      backdropBox: rect('.bdbox'),
      backdropBoxStroke: number(style('.bdbox')?.strokeWidth),
      backdropBoxDash: style('.bdbox')?.strokeDasharray ?? '',
      isoWallBox: rect('[data-hp="iso-walls"]'),
      isoFloorBox: rect('[data-hp="iso-underlay"]'),
      planSnapLineStroke: number(style('.plan-snap-line')?.strokeWidth),
      snapIntervalsPerMeter: 100 / card._cellCm,
      projection: card._effectiveProjection(),
      projectionToggleCount: root.querySelectorAll('[data-hp="projection-toggle"]').length,
      visualScaleNodes: root.querySelectorAll('.room, .wallbody, .opening').length,
    };
  };
  window.__makeStaticGridCard = async () => {
    document.querySelector('#grid-static-host')?.remove();
    const host = document.createElement('div');
    host.id = 'grid-static-host';
    host.style.width = '780px';
    document.body.appendChild(host);
    const compact = document.createElement('houseplan-space-card');
    compact.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', show_button: false });
    compact.hass = card.hass;
    host.appendChild(compact);
    const deadline = Date.now() + 6000;
    while (!compact.renderRoot?.querySelector('.hp-static-stage') && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    await compact.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
});

const stage = page.locator('houseplan-card').first().locator('.stage');
const staticStage = () => page.locator('#grid-static-host houseplan-space-card .hp-static-stage');
const themeVars = {
  light: {
    '--primary-color': '#0b73b8', '--primary-text-color': '#202124',
    '--secondary-text-color': '#5f6368', '--card-background-color': '#ffffff',
    '--ha-card-background': '#ffffff', '--divider-color': '#d7d9de',
  },
  dark: {
    '--primary-color': '#3ea6ff', '--primary-text-color': '#e6e7eb',
    '--secondary-text-color': '#9aa4ad', '--card-background-color': '#202126',
    '--ha-card-background': '#202126', '--divider-color': '#3a3d45',
  },
};
const setTheme = async (theme) => {
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: theme });
  await page.evaluate(async ({ variables, dark }) => {
    for (const [name, value] of Object.entries(variables)) {
      document.documentElement.style.setProperty(name, value);
    }
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const card = window.__card;
    card.hass = { ...card.hass, themes: { ...(card.hass.themes || {}), darkMode: dark } };
    await card.updateComplete;
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { variables: themeVars[theme], dark: theme === 'dark' });
};
const stableScreenshot = async (locator) => {
  let previous = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.evaluate(async () => {
      await window.__card.updateComplete;
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const current = await locator.screenshot({ animations: 'disabled' });
    if (previous?.equals(current)) return current;
    previous = current;
  }
  throw new Error('grid scale fixture did not reach two identical consecutive paints');
};
const capture = async (cellCm, mode, {
  theme = 'light', projection = 'flat', staticCard = false, hide = [],
} = {}) => {
  await setTheme(theme);
  await page.evaluate(([cell, nextMode, nextProjection]) =>
    window.__applyGridScaleFixture(cell, nextMode, nextProjection), [cellCm, mode, projection]);
  const metrics = await page.evaluate(() => window.__gridScaleMetrics());
  if (mode === 'decor') {
    // The browser resamples the same SVG backdrop at two user-space sizes with
    // small raster differences. This pair is about Background chrome; the
    // backdrop geometry itself is proved by its shared frame and handle boxes.
    await page.evaluate(() => {
      const backdrop = window.__card.renderRoot.querySelector('.hp-backdrop');
      if (backdrop) backdrop.style.visibility = 'hidden';
    });
  }
  await page.evaluate((selectors) => {
    for (const selector of selectors) {
      for (const node of window.__card.renderRoot.querySelectorAll(selector)) node.style.visibility = 'hidden';
    }
  }, hide);
  await page.evaluate(() => window.scrollTo(0, 0));
  const pixels = await stableScreenshot(stage);
  let staticPixels = null;
  if (staticCard) {
    await page.evaluate(() => window.__makeStaticGridCard());
    staticPixels = await stableScreenshot(staticStage());
  }
  return { metrics, pixels, staticPixels };
};
const near = (left, right, tolerance = 0.35) => Math.abs(left - right) <= tolerance;
const worldUnitKeys = new Set([
  'roomStroke', 'wallStroke', 'arcStroke', 'openingLeafHeight',
  'openingOutlineWidth', 'openingHitWidth',
]);
const metricPairsNear = (left, right) => Object.keys(left).every((key) => {
  if (key === 'factor' || key === 'snapIntervalsPerMeter') return true;
  const a = left[key], b = right[key];
  if (Array.isArray(a) && Array.isArray(b)) return a.every((value, index) => near(value, b[index]));
  if (worldUnitKeys.has(key)) return near(a * (right.factor / left.factor), b, 0.01);
  return typeof a === 'number' && typeof b === 'number' ? near(a, b) : a === b;
});

const pixelDiff = async (left, right) => page.evaluate(async ([a, b]) => {
  const decode = async (base64) => createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
  const [first, second] = await Promise.all([decode(a), decode(b)]);
  if (first.width !== second.width || first.height !== second.height) {
    return { sameSize: false, changed: Infinity, maxDelta: Infinity, meanDelta: Infinity };
  }
  const canvas = document.createElement('canvas');
  canvas.width = first.width; canvas.height = first.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(first, 0, 0);
  const firstPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(second, 0, 0);
  const secondPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let changed = 0, maxDelta = 0, totalDelta = 0;
  let minX = first.width, minY = first.height, maxX = -1, maxY = -1;
  for (let index = 0; index < firstPixels.length; index += 4) {
    let delta = 0;
    for (let channel = 0; channel < 4; channel++) {
      delta = Math.max(delta, Math.abs(firstPixels[index + channel] - secondPixels[index + channel]));
    }
    if (delta > 2) {
      changed++;
      const pixel = index / 4;
      const x = pixel % first.width, y = Math.floor(pixel / first.width);
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    maxDelta = Math.max(maxDelta, delta);
    totalDelta += delta;
  }
  return {
    sameSize: true,
    changed,
    maxDelta,
    meanDelta: totalDelta / (firstPixels.length / 4),
    pixels: firstPixels.length / 4,
    changedBounds: changed ? [minX, minY, maxX, maxY] : null,
  };
}, [left.toString('base64'), right.toString('base64')]);

const pair = async (mode, options) => ({
  reference: await capture(5, mode, options),
  detailed: await capture(1, mode, options),
});
const referenceView = await capture(5, 'view', { staticCard: true });
const detailedView = await capture(1, 'view', { staticCard: true });
const referencePlan = await capture(5, 'plan');
const detailedPlan = await capture(1, 'plan');
const darkView = await pair('view', { theme: 'dark' });
const devices = await pair('devices');
// Chromium rasterises non-scaling dashed SVG rectangles differently under
// equivalent user-space transforms. Compare the rest of Background pixel for
// pixel; the masked box and openings are covered by critical metrics and by
// the View/Plan raster pairs respectively.
const background = await pair('decor', { hide: ['.bdbox', '.opening'] });
const isoLight = await pair('view', { projection: 'iso' });
const isoDark = await pair('view', { projection: 'iso', theme: 'dark' });

const openingEdgeAction = async (cellCm) => {
  await setTheme('light');
  await page.evaluate((cell) => window.__applyGridScaleFixture(cell, 'plan', 'flat'), cellCm);
  const point = await page.evaluate(() => {
    const hit = window.__card.renderRoot.querySelector('[data-id="grid-door"] .op-hit');
    const box = hit.getBoundingClientRect();
    return { x: box.right - 0.75, y: box.top + box.height / 2 };
  });
  const before = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
  await page.mouse.click(point.x, point.y);
  await page.evaluate(() => window.__card.updateComplete);
  return page.evaluate((snapshot) => {
    const card = window.__card;
    const opened = card._openingDialog?.id === 'grid-door';
    card._openingDialog = null;
    card.requestUpdate();
    return opened && JSON.stringify(card._serverCfg) === snapshot;
  }, before);
};

const backgroundCancel = async (cellCm) => {
  await setTheme('light');
  await page.evaluate((cell) => window.__applyGridScaleFixture(cell, 'decor', 'flat'), cellCm);
  return page.evaluate(async () => {
    const card = window.__card;
    const root = card.renderRoot;
    const handle = root.querySelector('.bdhandle[data-corner="1,1"]');
    const stageNode = root.querySelector('.stage');
    const box = handle?.getBoundingClientRect();
    if (!handle || !stageNode || !box) return false;
    const before = structuredClone(card._serverCfg);
    handle.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, composed: true, cancelable: true, pointerId: 239,
      pointerType: 'touch', clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
    }));
    const startedPid = card._bdDrag?.pid ?? null;
    const cancelEvent = new PointerEvent('pointercancel', {
      pointerId: 239, pointerType: 'touch',
    });
    card._stagePointerCancel(cancelEvent);
    await card.updateComplete;
    const after = structuredClone(card._serverCfg);
    const canonical = (value) => {
      if (Array.isArray(value)) return value.map(canonical);
      if (value && typeof value === 'object') return Object.fromEntries(
        Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
      );
      return value;
    };
    const changedKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((key) => JSON.stringify(canonical(before[key])) !== JSON.stringify(canonical(after[key])));
    return {
      ok: startedPid === 239 && cancelEvent.pointerId === 239
        && !card._bdDrag && changedKeys.length === 0,
      startedPid, cancelPointerId: cancelEvent.pointerId,
      dragEnded: !card._bdDrag,
      configSame: changedKeys.length === 0,
      changedKeys,
    };
  });
};

const referenceOpeningEdgeActs = await openingEdgeAction(5);
const detailedOpeningEdgeActs = await openingEdgeAction(1);
const referenceBackgroundCancel = await backgroundCancel(5);
const detailedBackgroundCancel = await backgroundCancel(1);
const flatDiff = await pixelDiff(referenceView.pixels, detailedView.pixels);
const staticDiff = await pixelDiff(referenceView.staticPixels, detailedView.staticPixels);
const planDiff = await pixelDiff(referencePlan.pixels, detailedPlan.pixels);
const darkViewDiff = await pixelDiff(darkView.reference.pixels, darkView.detailed.pixels);
const devicesDiff = await pixelDiff(devices.reference.pixels, devices.detailed.pixels);
const backgroundDiff = await pixelDiff(background.reference.pixels, background.detailed.pixels);
const isoLightDiff = await pixelDiff(isoLight.reference.pixels, isoLight.detailed.pixels);
const isoDarkDiff = await pixelDiff(isoDark.reference.pixels, isoDark.detailed.pixels);
const pixelEquivalent = (diff) => diff.sameSize
  && diff.changed <= 150 && diff.maxDelta <= 40 && diff.meanDelta <= 0.05;

// Diagnostic only: the raw diff numbers behind every pixel verdict, so a CI
// failure reports HOW FAR a pair drifted instead of a bare boolean (#302).
console.error('pixel-diffs', JSON.stringify({
  flat: flatDiff, static: staticDiff, plan: planDiff, darkView: darkViewDiff,
  devices: devicesDiff, background: backgroundDiff,
  isoLight: isoLightDiff, isoDark: isoDarkDiff,
}));
const out = {
  referenceFactorIsOne: referenceView.metrics.factor === 1,
  detailedFactorIsFive: detailedView.metrics.factor === 5,
  flatCriticalMetricsMatch: metricPairsNear(referenceView.metrics, detailedView.metrics),
  flatPixelsMatch: pixelEquivalent(flatDiff),
  staticPixelsMatch: pixelEquivalent(staticDiff),
  planCriticalMetricsMatch: metricPairsNear(referencePlan.metrics, detailedPlan.metrics),
  planPixelsMatchWithEquivalentGridHidden: pixelEquivalent(planDiff),
  snapPrecisionIsFiveTimesFiner: detailedPlan.metrics.snapIntervalsPerMeter
    === referencePlan.metrics.snapIntervalsPerMeter * 5,
  screenFixedPlanSnapStrokeIsNotDoubleScaled: referencePlan.metrics.planSnapLineStroke === 1
    && detailedPlan.metrics.planSnapLineStroke === 1,
  openingEdgeHitAndActionMatch: referenceOpeningEdgeActs && detailedOpeningEdgeActs,
  darkViewCriticalMetricsMatch: metricPairsNear(darkView.reference.metrics, darkView.detailed.metrics),
  darkViewPixelsMatch: pixelEquivalent(darkViewDiff),
  devicesCriticalMetricsMatch: metricPairsNear(devices.reference.metrics, devices.detailed.metrics),
  devicesPixelsMatch: pixelEquivalent(devicesDiff),
  backgroundCriticalMetricsMatch: metricPairsNear(background.reference.metrics, background.detailed.metrics),
  backgroundPixelsMatch: pixelEquivalent(backgroundDiff),
  backgroundPointerCancelIsMutationFree: referenceBackgroundCancel.ok && detailedBackgroundCancel.ok,
  isoLightCriticalMetricsMatch: metricPairsNear(isoLight.reference.metrics, isoLight.detailed.metrics),
  isoLightPixelsMatch: pixelEquivalent(isoLightDiff),
  isoDarkCriticalMetricsMatch: metricPairsNear(isoDark.reference.metrics, isoDark.detailed.metrics),
  isoDarkPixelsMatch: pixelEquivalent(isoDarkDiff),
  isoRemainsLabsOnly: referenceView.metrics.projectionToggleCount === 0
    && isoLight.reference.metrics.projection === 'iso'
    && isoLight.reference.metrics.projectionToggleCount === 1,
};

if (Object.values(out).some((value) => !value)) {
  console.error('grid scale evidence:', JSON.stringify({
    referenceView: referenceView.metrics,
    detailedView: detailedView.metrics,
    referencePlan: referencePlan.metrics,
    detailedPlan: detailedPlan.metrics,
    darkView: { reference: darkView.reference.metrics, detailed: darkView.detailed.metrics },
    devices: { reference: devices.reference.metrics, detailed: devices.detailed.metrics },
    background: { reference: background.reference.metrics, detailed: background.detailed.metrics },
    isoLight: { reference: isoLight.reference.metrics, detailed: isoLight.detailed.metrics },
    isoDark: { reference: isoDark.reference.metrics, detailed: isoDark.detailed.metrics },
    flatDiff, staticDiff, planDiff, darkViewDiff, devicesDiff, backgroundDiff,
    isoLightDiff, isoDarkDiff,
    referenceBackgroundCancel, detailedBackgroundCancel,
  }, null, 2));
}

checkAll(out);
await finish(browser, out);
