// #293: exercise the real browser pointer pipeline on the tracked second-floor
// fixture. The card is recreated so the fixture enters through config/get,
// exactly as it does in Home Assistant; no private Resize method is invoked.
import { readFileSync, writeFileSync } from 'node:fs';
import { launch, check, finish } from './serve.mjs';

const fixture = JSON.parse(readFileSync(
  new URL('../test/fixtures/real-plan-second-floor.json', import.meta.url),
  'utf8',
));
const { page, browser } = await launch({ width: 1180, height: 920 });
const aliasOwnership = process.argv.includes('--alias-ownership');
let sourceConfig = { spaces: [fixture.space], markers: [], settings: {} };
sourceConfig.extension = { resize_probe: 'preserve unknown config fields' };
sourceConfig.spaces[0].rooms.forEach(room => { room.extension = { resize_probe: room.id }; });
// An actual opening on a fixed far wall makes host/width preservation non-vacuous.
sourceConfig.spaces[0].openings.push({ id: '832-fixed-window', type: 'window',
  x: -1.6708333333333334, y: 3.3, length: .25, angle: 90, extension: { untouched: true } });
{
  sourceConfig.spaces.push({ id: 'alias-floor', title: 'Untouched floor', cell_cm: fixture.space.cell_cm,
    rooms: [
      { id: 'alias-large', name: 'Large', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
      { id: 'alias-small', name: 'Small', poly: [[1, .5], [2, .5], [2, 1], [1, 1]] },
    ] });
}

await page.evaluate(async (sourceConfig) => {
  const previous = window.__card;
  const hass = window.__mkHass();
  const callWS = hass.callWS.bind(hass);
  let serverConfig = sourceConfig, revision = 1;
  window.__resizeWrites = [];
  hass.callWS = async (message) => {
    if (message.type === 'houseplan/config/get') {
      return { config: structuredClone(serverConfig), rev: revision, can_write: true };
    }
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/config/set') {
      window.__resizeWrites.push(structuredClone(message));
      serverConfig = structuredClone(message.config);
      return { ok: true, rev: ++revision };
    }
    return callWS(message);
  };
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan' });
  previous.remove();
  document.getElementById('host').appendChild(card);
  window.__card = card;
  card.hass = hass;
}, sourceConfig);

await page.waitForFunction(() => {
  const card = window.__card;
  return card?._booting === false
    && card._serverCfg?.spaces?.[0]?.id === 'real-second-floor'
    && card._space === 'real-second-floor';
}, { timeout: 9000 });

await page.locator('[data-hp="mode-tab"][data-mode="plan"]').click();
await page.waitForFunction(() => window.__card._editorRuntime && !window.__card._modeTransitionBusy);
await page.evaluate(async () => {
  const card = window.__card;
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

if (aliasOwnership) {
  check('resize_pointer.alias_setup_preserves_equal_geometry', await page.evaluate(() => {
    const card = window.__card, other = card._serverCfg.spaces.find(space => space.id === 'alias-floor');
    const point = other.rooms[0].poly[2];
    const before = JSON.stringify(other.rooms);
    // private-ok: #826 fixture changes ownership only, not point values. A JSON
    // copy here would erase the regression; the real commit must separate it.
    other.rooms[1].poly[3] = point;
    window.__aliasSpaceRef = other; window.__aliasRoomRefs = [...other.rooms];
    const runtime = card._editorRuntime;
    const introduced = runtime._junctionLimitsIntroduced.bind(runtime);
    // private-ok: #826 read-only pre-adoption observer; delegates the real guard, never replaces its result.
    runtime._junctionLimitsIntroduced = (candidate, ...args) => { // private-ok: #826 observes validated candidate and delegates the original guard unchanged.
      window.__aliasExpected = JSON.stringify(candidate.spaces.find(space => space.id === 'alias-floor').rooms);
      return introduced(candidate, ...args);
    };
    return JSON.stringify(other.rooms) === before && other.rooms[1].poly[3] === point;
  }));
}

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
  [...(window.__card.renderRoot.querySelector('[data-hp-live-editor] .hp-live-resize')
    || window.__card.renderRoot).querySelectorAll('.rszhandle[aria-disabled="false"]')]
    .some((entry) => Math.abs(Number(entry.getAttribute('cx')) - wanted) < 1), x);
const sharedHandleX = () => page.evaluate(() => {
  const activeRoot = window.__card.renderRoot.querySelector('[data-hp-live-editor] .hp-live-resize')
    || window.__card.renderRoot;
  const candidates = [...activeRoot.querySelectorAll(
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

  if (aliasOwnership) {
    const exact = await page.evaluate(() => {
      const other = window.__card._serverCfg.spaces.find(space => space.id === 'alias-floor');
      return JSON.stringify(other.rooms) === window.__aliasExpected
        && other === window.__aliasSpaceRef && other.rooms.every((room, index) => room === window.__aliasRoomRefs[index]);
    });
    check('resize_pointer.alias_unrelated_floor_and_refs_unchanged', exact);
    check('resize_pointer.alias_adoption_equals_validated_write', await page.evaluate(() => {
      const card = window.__card, written = window.__resizeWrites.at(-1)?.config;
      return !!written && JSON.stringify(card._serverCfg.spaces) === JSON.stringify(written.spaces);
    }));
    if (process.argv.includes('--alias-red-witness')) {
      await finish(browser, { aliasOwnership: true }); process.exit(process.exitCode || 0);
    }
  }

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
    return window.__card._serverCfg.model_version === 10
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
  await page.evaluate(() => {
    window.__resizeWallUnionBefore = window.__card._wallUnionGeometry();
  });
  const outsideDistance = Math.max(120, target.hitWidth * 2);
  await page.mouse.move(...target.start);
  await page.mouse.down();
  await page.mouse.move(target.start[0] + outsideDistance, target.start[1], { steps: 12 });
  await settle();
  check('resize_pointer.capture_beyond_handle', await domHasSharedX(400), false);
  check('resize_pointer.capture_travels_past_hit_area',
    Math.abs((await sharedHandleX()) - 400) > target.hitRadiusSvg * 1.5, true);
  // #837: the live handle copy is hittable (`.rszhandle` sets pointer-events)
  // and chases the cursor, so without capture the first steps still land and
  // the preview passes the two checks above before it freezes. Capture is what
  // keeps the moving handle under the pointer for the whole 120 px gesture.
  check('resize_pointer.capture_preview_stays_under_pointer', await page.waitForFunction(({ x, y, radius }) => {
    const root = window.__card.renderRoot;
    const live = root.querySelector('[data-hp-live-editor] .hp-live-resize');
    const handle = root.querySelector('.rszhandle');
    if (!live || !handle) return false;
    const point = handle.ownerSVGElement.createSVGPoint();
    point.x = x; point.y = y;
    const pointerX = point.matrixTransform(handle.getScreenCTM().inverse()).x;
    return [...live.querySelectorAll('.rszhandle[aria-disabled="false"]')].some((entry) =>
      Math.abs(Number(entry.getAttribute('cy')) - 529.166667) < 2
      && Math.abs(Number(entry.getAttribute('cx')) - pointerX) <= radius);
  }, { x: target.start[0] + outsideDistance, y: target.start[1], radius: target.hitRadiusSvg },
  { timeout: 3000 }).then(() => true, () => false), true);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await settle();
  check('resize_pointer.escape_restores_config', await persistedGeometry(), stableAfterUndo);
  check('resize_pointer.escape_reuses_pre_drag_wall_union', await page.evaluate(() =>
    window.__card._wallUnionGeometry() === window.__resizeWallUnionBefore), true);
  await page.waitForTimeout(650);
  check('resize_pointer.escape_zero_extra_write', await page.evaluate(() => window.__resizeWrites.length), writesBefore + 2);

  // A different pointer cannot take over an active drag. Losing capture for
  // the owning pointer is an abort, never a commit of the visible preview.
  await page.evaluate(() => {
    window.__resizeWallUnionBefore = window.__card._wallUnionGeometry();
  });
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
  check('resize_pointer.capture_loss_reuses_pre_drag_wall_union', await page.evaluate(() =>
    window.__card._wallUnionGeometry() === window.__resizeWallUnionBefore), true);
  await page.waitForTimeout(650);
  check('resize_pointer.capture_loss_zero_extra_write', await page.evaluate(() => window.__resizeWrites.length), writesBefore + 2);

}

// #832: the old checks leave the materialized pre-edit plan after cancellation.
// Now repeat a real Resize, across history/adoption, on the SAME card/live layer.
if (target) {
  const complete = () => page.evaluate(() => structuredClone(window.__card._serverCfg));
  const moveAgain = async (from, steps) => {
    const hit = await page.evaluate(({ from, steps }) => {
      const card = window.__card, root = card.renderRoot.querySelector('[data-hp-live-editor] .hp-live-resize') || card.renderRoot;
      const h = [...root.querySelectorAll('.rszhandle[aria-disabled="false"]')].find(h =>
        Math.abs(Number(h.getAttribute('cx')) - from) < 1 && Math.abs(Number(h.getAttribute('cy')) - 529.166667) < 2);
      if (!h) return null;
      const rect = h.getBoundingClientRect(), point = h.ownerSVGElement.createSVGPoint();
      point.x = from + steps * card._gridPitch; point.y = Number(h.getAttribute('cy'));
      const end = point.matrixTransform(h.getScreenCTM());
      return { start: [rect.left + rect.width / 2, rect.top + rect.height / 2], end: [end.x, end.y] };
    }, { from, steps });
    if (!hit) throw new Error(`current live enabled Resize handle ${from} absent`);
    const prior = await complete(), count = await page.evaluate(() => window.__resizeWrites.length);
    await page.mouse.move(...hit.start); await page.mouse.down(); await page.mouse.move(...hit.end, { steps: 8 });
    await settle();
    check(`resize_repeat.preview_${from}_${steps}_does_not_write`, await complete(), prior);
    await page.mouse.up(); await settle(); await page.waitForTimeout(650);
    return { config: await complete(), extraWrites: await page.evaluate(() => window.__resizeWrites.length) - count };
  };
  const history = async (key, expected, name) => {
    await page.keyboard.press(key); await settle(); await page.waitForTimeout(650);
    check(`resize_repeat.${name}_byte_exact_catalog`, await complete(), expected);
  };
  const first = await moveAgain(400, 10), x = 400 + 10 * 1000 / 240;
  check('resize_repeat.first_setup_commit', first.extraWrites, 1);
  if (!process.argv.includes('--repeat-no-history')) {
    await page.keyboard.press('Control+z'); await settle(); await page.waitForTimeout(650);
    await history('Control+Shift+z', first.config, 'first_redo');
  }
  const second = await moveAgain(x, 2);
  const secondWorks = second.extraWrites === 1 && await page.evaluate(() => window.__card._geometryHistory.size === 2);
  check('resize_repeat.valid_second_native_commit', secondWorks);
  if (!secondWorks) { await finish(browser, { repeat: 'second refused' }); process.exit(process.exitCode || 1); }
  if (process.argv.includes('--record-repeat')) writeFileSync('artifacts/826/832-accepted-config.json', JSON.stringify(second.config, null, 2));
  check('resize_repeat.shared_seam_moves_exactly_two_grid_steps', await sharedX(), [0.45, 0.45]);
  check('resize_repeat.opening_hosts_widths_and_unknown_fields', await page.evaluate(({ first, next }) => {
    const a = first.spaces[0], b = next.spaces[0];
    const fields = r => Object.fromEntries(Object.entries(r).filter(([key]) => key !== 'poly'));
    return a.openings.length > 0 && a.openings.every(o => o.host?.kind === 'wall' && o.length > 0)
      && JSON.stringify(a.openings) === JSON.stringify(b.openings)
      && JSON.stringify(first.extension) === JSON.stringify(next.extension)
      && b.rooms.every(r => JSON.stringify(fields(r)) === JSON.stringify(fields(a.rooms.find(x => x.id === r.id))));
  }, { first: first.config, next: second.config }));
  check('resize_repeat.ids_widths_counts_and_foreign_floor', await page.evaluate(({ first, next }) => {
    const a = first.spaces[0], b = next.spaces[0];
    const old = new Map(a.wall_segments.map(s => [s.id, s]));
    return b.wall_segments.length === a.wall_segments.length
      && b.wall_segments.every(s => old.get(s.id)?.cm === s.cm)
      && b.rooms.every(r => r.poly.length === r.wall_ids.length
        && JSON.stringify(r.wall_ids) === JSON.stringify(a.rooms.find(x => x.id === r.id).wall_ids))
      && first.spaces.length > 1 && JSON.stringify(first.spaces.slice(1)) === JSON.stringify(next.spaces.slice(1));
  }, { first: first.config, next: second.config }));
  check('resize_repeat.fixed_owner_shape_and_fields', await page.evaluate(({ first, next }) => {
    const old = first.spaces[0].rooms.find(r => r.id === 'room-h'), now = next.spaces[0].rooms.find(r => r.id === 'room-h');
    const withoutPoly = r => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'poly'));
    const oldChanged = old.poly.filter(p => Math.abs(p[0] - (0.4 + 10 / 240)) < 1e-9);
    return JSON.stringify(withoutPoly(old)) === JSON.stringify(withoutPoly(now)) && oldChanged.length === 1
      && old.poly.every((p, i) => Math.abs(p[0] - (0.4 + 10 / 240)) < 1e-9
        ? Math.abs(now.poly[i][0] - .45) < 1e-9 && now.poly[i][1] === p[1]
        : JSON.stringify(now.poly[i]) === JSON.stringify(p));
  }, { first: first.config, next: second.config }));
  const third = await moveAgain(450, -2);
  check('resize_repeat.third_native_commit', third.extraWrites, 1);
  check('resize_repeat.third_returns_exact_first_catalog', third.config, first.config);
  await history('Control+z', second.config, 'third_undo');
  await history('Control+Shift+z', third.config, 'third_redo');
  await history('Control+z', second.config, 'third_undo_again');
  await history('Control+z', first.config, 'second_undo');
  await history('Control+Shift+z', second.config, 'second_redo');
  check('resize_repeat.latest_write_equals_saved_catalog', await page.evaluate(() =>
    JSON.stringify(window.__resizeWrites.at(-1).config) === JSON.stringify(window.__card._serverCfg)));

  // #837: #293 lets Undo/Redo restore a baseline that predates write-time wall
  // degradation (`wall-degraded-extra`). Since the #834 geometry repairs no
  // history baseline of this plan is degraded (every boundary preflight is ok),
  // so the branch went unexercised. Supply exactly that verdict at the history
  // boundary; every other caller, the outbound write barrier included, keeps
  // the strict check. The other failure reason proves the substitute is read.
  await page.evaluate(() => {
    const card = window.__card, strict = card._checkSpacePhysicalGeometry;
    window.__historyBoundaryReason = null;
    card._checkSpacePhysicalGeometry = function (...args) { // private-ok: #837 substitutes only the Undo/Redo boundary verdict; all other callers get the original strict result
      const verdict = strict.apply(this, args), reason = window.__historyBoundaryReason;
      return reason && /_applyGeometryState/.test(new Error().stack || '')
        ? { ...verdict, ok: false, status: 'failed', reason } : verdict;
    };
  });
  const boundaryUndo = async (reason) => {
    const count = await page.evaluate((value) => {
      window.__historyBoundaryReason = value;
      return window.__resizeWrites.length;
    }, reason);
    await page.keyboard.press('Control+z'); await settle(); await page.waitForTimeout(650);
    const history = await page.evaluate(() => {
      window.__historyBoundaryReason = null;
      return { size: window.__card._geometryHistory.size, canRedo: window.__card._geometryHistory.canRedo };
    });
    const config = await complete();
    return { ...history, restored: JSON.stringify(config) === JSON.stringify(first.config),
      writes: await page.evaluate(() => window.__resizeWrites.length) - count };
  };
  check('resize_history.degraded_baseline_undo_restores', await boundaryUndo('wall-degraded-extra'),
    { size: 1, canRedo: true, restored: true, writes: 1 });
  check('resize_history.other_boundary_failure_fails_closed', await boundaryUndo('wall-failed-core'),
    { size: 0, canRedo: false, restored: true, writes: 0 });
}

await finish(browser, { done: true });
