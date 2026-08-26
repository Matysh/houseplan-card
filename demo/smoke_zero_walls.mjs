/** #306: one zero-thickness wall model, one visual/light policy. */
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const sp = () => c._serverCfg.spaces.find((space) => space.id === c._space);
  const update = async () => {
    c._cfgEpoch++;
    c.requestUpdate();
    await c.updateComplete;
  };
  const setThickness = async (point, value) => {
    c._setMode('plan');
    c._tool = 'wallthick';
    await update();
    c._wallThickClick(point);
    await c.updateComplete;
    if (!c._wallDialog) return false;
    c._wallDialog = { ...c._wallDialog, value: String(value) };
    c._wallThickApply(false);
    await c.updateComplete;
    return true;
  };
  const contains = (segment, point) => {
    const a = segment.a.map((value) => value * 1000);
    const b = segment.b.map((value) => value * 1000);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len2;
    const q = [a[0] + dx * t, a[1] + dy * t];
    return t >= -1e-8 && t <= 1 + 1e-8
      && Math.hypot(point[0] - q[0], point[1] - q[1]) < 1e-5;
  };

  delete sp().openings;
  delete sp().open_spans;
  for (const room of sp().rooms || []) delete room.open_to;
  sp().settings = { ...(sp().settings || {}), show_borders: true, fill_mode: 'glow' };

  // First materialise the legacy demo plan through the production structural
  // barrier, then turn exactly the shared r1/r2 carrier into a zero wall.
  out.materialized = await setThickness([550, 250], 15);
  out.modelV9 = c._serverCfg.model_version === 9
    && Array.isArray(sp().wall_segments)
    && sp().rooms.every((room) => Array.isArray(room.wall_ids));
  out.zeroApplied = await setThickness([550, 250], 0);
  const target = sp().wall_segments.find((segment) => contains(segment, [550, 250]));
  out.canonicalZero = target?.cm === 0;
  out.noLegacyFields = !('open_spans' in sp())
    && sp().rooms.every((room) => !('open_to' in room));
  out.noBoundaryTool = ![...sr().querySelectorAll('.editbar button')]
    .some((button) => /Boundary|Граница/.test(button.textContent || ''));
  out.zeroLineInEditor = sr().querySelectorAll('.zero-wall').length > 0;

  const litLight = c._devices.find((device) => device.space === c._space
    && device.entities.some((entity) => entity.startsWith('light.')
      && c.hass.states[entity]?.state === 'on'));
  const r1 = c._spaceModel().rooms.find((room) => room.id === 'r1');
  const r2 = c._spaceModel().rooms.find((room) => room.id === 'r2');
  const centre1 = c._roomCenter(r1);
  const centre2 = c._roomCenter(r2);
  c._layout = {
    ...c._layout,
    [litLight.id]: { s: c._space, x: centre1[0] / 1000, y: centre1[1] / 1000 },
  };
  c._serverCfg = {
    ...c._serverCfg,
    settings: { ...(c._serverCfg.settings || {}), glow_radius_cm: 900 },
  };

  const litRings = () => [...sr().querySelectorAll(
    'defs clipPath[id^="hp-glowclip"] path.glow-lit',
  )].flatMap((path) => (path.getAttribute('d') || '').split('M').filter(Boolean).map((part) => {
    const numbers = (part.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const ring = [];
    for (let index = 0; index + 1 < numbers.length; index += 2)
      ring.push([numbers[index], numbers[index + 1]]);
    return ring;
  }));
  const isLit = (point) => litRings().some((ring) => {
    let inside = false;
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const [x1, y1] = ring[index];
      const [x2, y2] = ring[previous];
      if ((y1 > point[1]) !== (y2 > point[1])
          && point[0] < ((x2 - x1) * (point[1] - y1)) / ((y2 - y1) || 1e-12) + x1)
        inside = !inside;
    }
    return inside;
  });

  sp().zero_wall_style = 'dashed';
  c._setMode('view');
  await update();
  out.dashedPaint = !!sr().querySelector('.zero-walls.dashed .zero-wall');
  out.dashedTransmits = isLit(centre2);

  sp().zero_wall_style = 'solid';
  await update();
  out.solidPaint = !!sr().querySelector('.zero-walls.solid .zero-wall');
  out.solidBlocks = !isLit(centre2);

  sp().settings.show_borders = false;
  await update();
  out.hiddenInView = sr().querySelectorAll('.zero-wall').length === 0;
  c._setMode('plan');
  await update();
  out.visibleInEditor = sr().querySelectorAll('.zero-wall').length > 0;

  // A hosted opening blocks positive→zero atomically.
  sp().settings.show_borders = true;
  out.positiveRestored = await setThickness([550, 250], 15);
  const hosted = sp().wall_segments.find((segment) => contains(segment, [550, 250]));
  sp().openings = [{
    id: 'zero-wall-door', type: 'door', x: 0.55, y: 0.25,
    angle: 90, length: 0.09, host: { kind: 'wall', id: hosted.id, t: 0.5 },
  }];
  c._toast = null;
  await update();
  out.zeroAttemptFoundTarget = await setThickness([550, 250], 0);
  const afterBlocked = sp().wall_segments.find((segment) => segment.id === hosted.id);
  out.openingBlocksZero = afterBlocked?.cm === 15 && !!c._toast;

  return out;
});

checkAll(res);
await finish(browser, res);
