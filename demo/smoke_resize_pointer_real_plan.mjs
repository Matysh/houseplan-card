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
  return [a.poly[2][0], a.poly[3][0], b.poly[2][0], b.poly[3][0]];
});
const domHasSharedX = (x) => page.evaluate((wanted) =>
  [...window.__card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="false"]')]
    .some((entry) => Math.abs(Number(entry.getAttribute('cx')) - wanted) < 1), x);

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
  const beforeWalls = await page.evaluate(() => {
    const walls = window.__card._serverCfg.spaces[0].walls || [];
    return { count: walls.length, cms: walls.map((wall) => wall.cm).sort((a, b) => a - b) };
  });
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
  check('resize_pointer.wall_metadata_preserved', await page.evaluate(() => {
    const walls = window.__card._serverCfg.spaces[0].walls || [];
    return { count: walls.length, cms: walls.map((wall) => wall.cm).sort((a, b) => a - b) };
  }), beforeWalls);

  await page.keyboard.press('Control+z');
  await settle();
  check('resize_pointer.undo_byte_exact', await persistedGeometry(), before);

  // The second gesture leaves the circle by much more than its hit radius.
  // Pointer capture must keep the real browser stream alive; Esc then cancels
  // the already-visible overlay without a second persistence write.
  const outsideDistance = Math.max(120, target.hitWidth * 2);
  await page.mouse.move(...target.start);
  await page.mouse.down();
  await page.mouse.move(target.start[0] + outsideDistance, target.start[1], { steps: 12 });
  await settle();
  check('resize_pointer.capture_beyond_handle', await domHasSharedX(400), false);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await settle();
  check('resize_pointer.escape_restores_config', await persistedGeometry(), before);
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
  check('resize_pointer.capture_loss_restores_config', await persistedGeometry(), before);
  await page.waitForTimeout(650);
  check('resize_pointer.capture_loss_zero_extra_write', await page.evaluate(() => window.__resizeWrites.length), writesBefore + 2);
}

await finish(browser, { done: true });
