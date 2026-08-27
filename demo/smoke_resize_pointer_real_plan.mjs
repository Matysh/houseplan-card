// #293: exercise the real browser pointer pipeline on the tracked second-floor
// fixture. The card is recreated so the fixture enters through config/get,
// exactly as it does in Home Assistant; no private Resize method is invoked.
import { readFileSync } from 'node:fs';
import { launch, check, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/real-plan-second-floor.json', import.meta.url),
  'utf8',
));
const { page, browser } = await launch({ width: 1180, height: 920 });

await page.evaluate(async (space) => {
  const previous = window.__card;
  const hass = window.__mkHass();
  const callWS = hass.callWS.bind(hass);
  window.__resizeWrites = [];
  hass.callWS = async (message) => {
    if (message.type === 'houseplan/config/get') {
      return { config: { spaces: [structuredClone(space)], markers: [], settings: {} }, rev: 1, can_write: true };
    }
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/config/set') {
      window.__resizeWrites.push(structuredClone(message));
      return { ok: true, rev: 2 };
    }
    return callWS(message);
  };
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan' });
  previous.remove();
  document.getElementById('host').appendChild(card);
  window.__card = card;
  card.hass = hass;
}, fixture.space);

await page.waitForFunction(() => {
  const card = window.__card;
  return card?._booting === false
    && card._serverCfg?.spaces?.[0]?.id === 'real-second-floor'
    && card._space === 'real-second-floor';
}, { timeout: 9000 });

await page.evaluate(async () => {
  const card = window.__card;
  card._setMode('plan');
  await card.updateComplete;
  const button = [...card.renderRoot.querySelectorAll('button')]
    .find((entry) => entry.textContent?.trim() === 'Resize');
  button?.click();
  await card.updateComplete;
});
await page.waitForFunction(() => window.__card.renderRoot.querySelectorAll('.rszhandle').length > 0);
// Entering Plan animates the editor chrome and stage for 220 ms. Reading a
// handle's screen CTM while that transition is still moving makes the real
// mouse click land at a stale coordinate and turns this pointer smoke flaky.
await page.waitForFunction(() => !window.__card._modeTransitionBusy);
await page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

await page.evaluate(() => {
  window.__resizePointerId = null;
  window.__card.renderRoot.addEventListener('pointerdown', (event) => {
    if (event.target?.classList?.contains('rszhandle')) window.__resizePointerId = event.pointerId;
  }, true);
});

const target = await page.evaluate(() => {
  const card = window.__card;
  const handles = [...card.renderRoot.querySelectorAll('.rszhandle')];
  const handle = handles.find((entry) => entry.getAttribute('aria-disabled') === 'false'
    && Math.abs(Number(entry.getAttribute('cx')) - 400) < 1
    && Math.abs(Number(entry.getAttribute('cy')) - 529.166667) < 2);
  if (!handle) return null;
  const svg = handle.ownerSVGElement;
  const screen = (x, y) => {
    const point = svg.createSVGPoint();
    point.x = x; point.y = y;
    const mapped = point.matrixTransform(handle.getScreenCTM());
    return [mapped.x, mapped.y];
  };
  const cx = Number(handle.getAttribute('cx'));
  const cy = Number(handle.getAttribute('cy'));
  const rect = handle.getBoundingClientRect();
  return {
    start: [rect.left + rect.width / 2, rect.top + rect.height / 2],
    end: screen(cx + 10 * (1000 / 240), cy),
    mappedStart: screen(cx, cy),
    hitWidth: rect.width,
    hitRadiusSvg: Number(handle.getAttribute('r')),
    count: handles.length,
  };
});

const settle = () => page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));
const persistedGeometry = () => page.evaluate(() => {
  const space = window.__card._serverCfg.spaces.find((entry) => entry.id === 'real-second-floor');
  return JSON.stringify({
    rooms: space.rooms,
    openings: space.openings || [],
    walls: space.walls || [],
    open_spans: space.open_spans || [],
  });
});
const sharedX = () => page.evaluate(() => {
  const space = window.__card._serverCfg.spaces.find((entry) => entry.id === 'real-second-floor');
  const a = space.rooms.find((room) => room.id === 'room-a');
  const b = space.rooms.find((room) => room.id === 'room-b');
  // v8 may add owner-role breakpoints to either contour. Locate the two
  // physical shared endpoints instead of relying on their legacy ordinals.
  return a.poly.filter((point) => b.poly.some((other) => (
    Math.abs(point[0] - other[0]) < 1e-9 && Math.abs(point[1] - other[1]) < 1e-9
  ))).map((point) => point[0]);
});
const domHasSharedX = (x) => page.evaluate((wanted) =>
  [...window.__card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="false"]')]
    .some((entry) => Math.abs(Number(entry.getAttribute('cx')) - wanted) < 1), x);
const sharedHandleX = () => page.evaluate(() => {
  const candidates = [...window.__card.renderRoot.querySelectorAll(
    '.rszhandle[aria-disabled="false"]',
  )].filter((entry) => Math.abs(Number(entry.getAttribute('cy')) - 529.166667) < 2);
  return candidates
    .map((entry) => Number(entry.getAttribute('cx')))
    .sort((left, right) => Math.abs(left - 400) - Math.abs(right - 400))[0] ?? null;
});

check('resize_pointer.fixture_loaded', await page.evaluate(() =>
  window.__card._serverCfg.spaces[0].id), 'real-second-floor');
check('resize_pointer.fixture_is_current_server_space', await page.evaluate(() => {
  const card = window.__card;
  const current = card._serverCfg.spaces.find((space) => space.id === card._space);
  return current?.rooms?.length === 8
    && current.rooms.find((room) => room.id === 'room-a')?.poly?.[2]?.[0] === 0.4;
}), true);
check('resize_pointer.target_enabled', !!target, true);
if (target) {
  const before = await persistedGeometry();
  const writesBefore = await page.evaluate(() => window.__resizeWrites.length);
  await page.mouse.move(...target.start);
  await page.mouse.down();
  await page.mouse.move(...target.end, { steps: 8 });
  await settle();
  check('resize_pointer.dom_preview_ten_steps', await domHasSharedX(400 + 10 * (1000 / 240)), true);
  check('resize_pointer.preview_not_persisted', await persistedGeometry(), before);
  await page.mouse.up();
  await settle();
  const expected = 0.4 + 10 / 240;
  check('resize_pointer.both_rooms_commit_ten_steps',
    (await sharedX()).every((value) => Math.abs(value - expected) < 1e-9), true);
  check('resize_pointer.one_history_command', await page.evaluate(() =>
    window.__card._geometryHistory.size), 1);
  await page.waitForTimeout(650);
  check('resize_pointer.one_atomic_write', await page.evaluate(() => window.__resizeWrites.length), writesBefore + 1);
  check('resize_pointer.undo_ready_after_write_ack', await page.evaluate(() => {
    const card = window.__card;
    return {
      history: card._geometryHistory.size,
      mode: card._mode,
      tool: card._tool,
      canCommit: card._canCommitSpace('real-second-floor'),
    };
  }), { history: 1, mode: 'plan', tool: 'resize', canCommit: true });
  check('resize_pointer.wall_metadata_preserved', await page.evaluate(() => {
    const beforeSegments = window.__card._geometryHistory._undo.at(-1)?.before?.wall_segments || [];
    const afterSegments = window.__card._serverCfg.spaces[0].wall_segments || [];
    const beforeById = new Map(beforeSegments.map((segment) => [segment.id, segment]));
    return beforeSegments.length === afterSegments.length
      && afterSegments.every((segment) => beforeById.get(segment.id)?.cm === segment.cm);
  }), true);

  const migratedBefore = await page.evaluate(() => {
    const command = window.__card._geometryHistory._undo.at(-1);
    const state = command?.before;
    return JSON.stringify({
      rooms: state?.rooms || [], openings: state?.openings || [],
      walls: state?.walls || [], open_spans: state?.open_spans || [],
    });
  });
  check('resize_pointer.first_edit_materializes_identity', await page.evaluate(() => {
    const space = window.__card._serverCfg.spaces[0];
    return window.__card._serverCfg.model_version === 9
      && space.rooms.every((room) => room.wall_ids?.length === room.poly.length)
      && space.wall_segments?.length > 0;
  }), true);

  await page.keyboard.press('Control+z');
  await settle();
  check('resize_pointer.undo_keyboard_consumed_history', await page.evaluate(() => ({
    history: window.__card._geometryHistory.size,
    canRedo: window.__card._geometryHistory.canRedo,
  })), { history: 0, canRedo: true });
  check('resize_pointer.undo_byte_exact', await persistedGeometry(), migratedBefore);
  await page.waitForTimeout(650);
  check('resize_pointer.undo_one_atomic_write', await page.evaluate(() =>
    window.__resizeWrites.length), writesBefore + 2);
  const stableAfterUndo = await persistedGeometry();

  // The second gesture leaves the circle by much more than its hit radius.
  // Pointer capture must keep the real browser stream alive; Esc then cancels
  // the already-visible overlay without a second persistence write.
  const outsideDistance = Math.max(120, target.hitWidth * 2);
  await page.mouse.move(...target.start);
  await page.mouse.down();
  await page.mouse.move(target.start[0] + outsideDistance, target.start[1], { steps: 12 });
  await settle();
  check('resize_pointer.capture_beyond_handle', await domHasSharedX(400), false);
  check('resize_pointer.capture_travels_past_hit_area',
    Math.abs((await sharedHandleX()) - 400) > target.hitRadiusSvg * 1.5, true);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await settle();
  check('resize_pointer.escape_restores_config', await persistedGeometry(), stableAfterUndo);
  await page.waitForTimeout(650);
  check('resize_pointer.escape_zero_extra_write', await page.evaluate(() => window.__resizeWrites.length), writesBefore + 2);

  // A different pointer cannot take over an active drag. Losing capture for
  // the owning pointer is an abort, never a commit of the visible preview.
  await page.mouse.move(...target.start);
  await page.mouse.down();
  await page.evaluate(({ x, y }) => {
    const card = window.__card;
    const handle = [...card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="false"]')]
      .find((entry) => Math.abs(Number(entry.getAttribute('cx')) - 400) < 1);
    handle?.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: Number(window.__resizePointerId) + 100,
      clientX: x + 100,
      clientY: y,
    }));
  }, { x: target.start[0], y: target.start[1] });
  await settle();
  check('resize_pointer.unrelated_pointer_ignored', await domHasSharedX(400), true);
  await page.mouse.move(target.start[0] + 30, target.start[1], { steps: 6 });
  await settle();
  check('resize_pointer.preview_before_capture_loss', await domHasSharedX(400), false);
  await page.evaluate(() => {
    const card = window.__card;
    const handle = [...card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="false"]')][0];
    handle?.dispatchEvent(new PointerEvent('lostpointercapture', {
      bubbles: true,
      pointerId: Number(window.__resizePointerId),
    }));
  });
  await page.mouse.up();
  await settle();
  check('resize_pointer.capture_loss_restores_dom', await domHasSharedX(400), true);
  check('resize_pointer.capture_loss_restores_config', await persistedGeometry(), stableAfterUndo);
  await page.waitForTimeout(650);
  check('resize_pointer.capture_loss_zero_extra_write', await page.evaluate(() => window.__resizeWrites.length), writesBefore + 2);
}

await finish(browser, { done: true });
