import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lqiColor, snapToGrid, snapSegment45, segKey, samePoint, pointInPolygon, markerIdForBinding, averageLqi,
  fitView, declump, safeUrl, resolveTapAction, floorsOf, subst, spaceDisplayOf, roomFillColor,
  splitRoomPath, polyContainsPoly, islandsOf,
  kelvinToRgb, glowColorOf, doorSector, hasRoomBehind,
  controlsAction, isControllable,
  sharedBoundary, openZoneOf, distToSegment,
  outlineWithout,
  alignGuides, segmentAngle, is45,
  swipeTarget, clampScale,
  migratePdfUrls,
  roomFillModeOf, roomGlowOf, customFillOf, roomCustomFillOf,
  contentUrl, chunk, referencedContentUrls, MAX_SIGN_PATHS,
  interiorPoint,
  segmentCm, formatLength, roomEdges, roomPoly, paperRoomShapes, pointOnBoundary, pointStrictlyInside, roomsOverlap,
  mergeRooms, splitRoom, polygonArea, closestPointOnBoundary, isActiveState, snapToWall, openingAmount, openingShoulders, fillColorsOf, lerpColor, roomFillStyle, resolveEffectiveRoomFill, stateIcon, lightColorOf, isAlarmState, parseRoomRef, diffNewDevices, poleOfInaccessibility, runServiceFor, TOGGLE_SAFE_DOMAINS, coverService, coverMoving, coverEntityOf,
  normalizeDeviceDisplay, isAlarmCapable,
  liveText, liveTextValue, liveTextReference, liveTextToken,
  hassValue, valueWithUnit, decorTextScale, decorTextLines,
  LIVE_TEXT_DASH, LIVE_TEXT_VALUE_MAX, DECOR_TEXT_SCALE_MIN, DECOR_TEXT_SCALE_MAX } from '../test-build/logic.js';
import {
  iconFor, compileIconRules, isValidPattern, iconFromDeviceClasses,
} from '../test-build/rules.js';

test('display normalization and alarm-capable metadata share one contract', () => {
  assert.equal(normalizeDeviceDisplay(undefined), 'badge');
  assert.equal(normalizeDeviceDisplay('ripple'), 'icon_ripple');
  assert.equal(normalizeDeviceDisplay('static_icon'), 'static_icon');
  assert.equal(normalizeDeviceDisplay('not-a-mode'), 'badge');
  assert.equal(isAlarmCapable('alarm_control_panel', ''), true);
  assert.equal(isAlarmCapable('siren', ''), true);
  assert.equal(isAlarmCapable('binary_sensor', 'smoke'), true);
  assert.equal(isAlarmCapable('binary_sensor', 'motion'), false);
});

test('lqiColor: boundaries and midpoint', () => {
  assert.equal(lqiColor(40), 'hsl(0, 85%, 55%)');
  assert.equal(lqiColor(180), 'hsl(120, 85%, 55%)');
  assert.equal(lqiColor(110), 'hsl(60, 85%, 55%)');
  assert.equal(lqiColor(0), 'hsl(0, 85%, 55%)');
  assert.equal(lqiColor(255), 'hsl(120, 85%, 55%)');
});

test('snapToGrid', () => {
  assert.equal(snapToGrid(0, 10), 0);
  assert.equal(snapToGrid(14, 10), 10);
  assert.equal(snapToGrid(16, 10), 20);
});

test('snapSegment45: nearest octant stays on grid and keeps the exact angle', () => {
  assert.deepEqual(snapSegment45([100, 100], [104, 156], 10), [100, 160]);
  assert.deepEqual(snapSegment45([100, 100], [151, 142], 10), [150, 150]);
  assert.deepEqual(snapSegment45([100, 100], [48, 57], 10), [50, 50]);
  assert.deepEqual(snapSegment45([100, 100], [100, 100], 10), [100, 100]);
  assert.deepEqual(snapSegment45([90, 90], [200, 200], 10, 100), [100, 100]);
});

test('segKey: direction does not matter', () => {
  assert.equal(segKey([0, 0], [10, 5]), segKey([10, 5], [0, 0]));
  assert.notEqual(segKey([0, 0], [10, 5]), segKey([0, 0], [10, 6]));
});

test('samePoint with tolerance', () => {
  assert.ok(samePoint([1, 1], [1.0005, 0.9995]));
  assert.ok(!samePoint([1, 1], [1.5, 1]));
});

test('pointInPolygon: square', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.ok(pointInPolygon([5, 5], sq));
  assert.ok(!pointInPolygon([15, 5], sq));
  assert.ok(!pointInPolygon([-1, -1], sq));
});

test('pointInPolygon: L-shaped polygon', () => {
  const L = [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]];
  assert.ok(pointInPolygon([1, 5], L));
  assert.ok(pointInPolygon([5, 1], L));
  assert.ok(!pointInPolygon([5, 5], L));
});

test('markerIdForBinding', () => {
  let n = 0; const nid = () => 'v_new' + n++;
  assert.equal(markerIdForBinding('device:abc', undefined, nid), 'abc');
  assert.equal(markerIdForBinding('entity:light.x', undefined, nid), 'lg_light.x');
  assert.equal(markerIdForBinding('virtual', 'v_existing', nid), 'v_existing');
  assert.equal(markerIdForBinding('virtual', undefined, nid), 'v_new0');
  assert.equal(markerIdForBinding('virtual', 'abc', nid), 'v_new1');
});

test('averageLqi', () => {
  assert.equal(averageLqi([]), null);
  assert.equal(averageLqi([100]), 100);
  assert.equal(averageLqi([100, 200]), 150);
  assert.equal(averageLqi([1, 2, 2]), 2);
});

test('iconFor: key rules', () => {
  // Russian device names below are intentional: iconFor rules match Russian names (see src/rules.ts).
  assert.equal(iconFor('Датчик протечки кухня', 'HOBEIAN'), 'mdi:water-alert');
  assert.equal(iconFor('Замок Терраса', 'TTLock'), 'mdi:lock');
  assert.equal(iconFor('Настенная лампа 1', 'Yandex Bulb'), 'mdi:lightbulb');
  assert.equal(iconFor('Ворота', 'Tuya Garage'), 'mdi:garage-variant');
  assert.equal(iconFor('Термоголовка', 'Aqara'), 'mdi:radiator');
  assert.equal(iconFor('Unknown gadget', 'XYZ'), 'mdi:chip');
});

test('fitView: portrait plan in a wide scene — margins on the sides, whole plan inside', () => {
  // vb 100x200 (aspect 0.5), scene aspect 2 → view wider than the plan, height = 200
  const v = fitView([0, 0, 100, 200], 2);
  assert.equal(v.h, 200);
  assert.equal(v.w, 400); // 200*2
  assert.equal(v.x, -150); // (100-400)/2 centering
  assert.equal(v.y, 0);
  // the whole plan is inside the view
  assert.ok(v.x <= 0 && v.x + v.w >= 100 && v.y <= 0 && v.y + v.h >= 200);
});

test('fitView: scene aspect matches the plan — view == vb', () => {
  const v = fitView([10, 20, 300, 150], 2); // plan aspect = 2 == scene aspect
  assert.equal(v.x, 10); assert.equal(v.y, 20); assert.equal(v.w, 300); assert.equal(v.h, 150);
});

test('declump: close points spread apart no closer than minDist and stay within bounds', () => {
  const b = { x: 0, y: 0, w: 100, h: 100 };
  const pts = [ { x: 50, y: 50 }, { x: 51, y: 50 }, { x: 50, y: 51 } ];
  declump(pts, b, 20, 5);
  // all pairs no closer than ~minDist (with tolerance for clamping to the bounds)
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      assert.ok(d > 12, `pair ${i},${j} too close: ${d}`);
    }
  // within the bounds [5..95]
  for (const q of pts) {
    assert.ok(q.x >= 5 && q.x <= 95 && q.y >= 5 && q.y <= 95);
  }
});

test('declump: a single point does not move', () => {
  const pts = [{ x: 30, y: 40 }];
  declump(pts, { x: 0, y: 0, w: 100, h: 100 }, 20, 5);
  assert.deepEqual(pts, [{ x: 30, y: 40 }]);
});

test('averageLqi: empty → null, otherwise the rounded average', () => {
  assert.equal(averageLqi([]), null);
  assert.equal(averageLqi([100, 200]), 150);
  assert.equal(averageLqi([1, 2, 2]), 2);
});

test('safeUrl: allows http(s) and relative paths, cuts dangerous schemes', () => {
  assert.equal(safeUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
  assert.equal(safeUrl('http://x.ru'), 'http://x.ru');
  assert.equal(safeUrl('//cdn.x.ru/f.pdf'), '//cdn.x.ru/f.pdf');
  assert.equal(safeUrl('/houseplan_files/files/m1/doc.pdf?v=1'), '/houseplan_files/files/m1/doc.pdf?v=1');
  assert.equal(safeUrl('docs/manual.pdf'), 'docs/manual.pdf');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,<script>'), null);
  assert.equal(safeUrl('vbscript:x'), null);
  assert.equal(safeUrl(''), null);
  assert.equal(safeUrl(null), null);
  assert.equal(safeUrl(undefined), null);
  assert.equal(safeUrl('  https://x.ru  '), 'https://x.ru');
});

test('icon rules: custom rules override defaults, first match wins', () => {
  const custom = compileIconRules([
    { pattern: 'plug|socket', icon: 'mdi:custom-plug' },
    { pattern: 'plug deluxe', icon: 'mdi:never-reached' },
  ]);
  assert.equal(iconFor('Smart Plug deluxe', '', custom), 'mdi:custom-plug');
  // defaults are NOT consulted when custom rules are provided
  assert.equal(iconFor('Датчик протечки', '', custom), 'mdi:chip');
});

test('icon rules: invalid regex is skipped, the rest still work', () => {
  const compiled = compileIconRules([
    { pattern: '[unclosed', icon: 'mdi:broken' },
    { pattern: 'camera', icon: 'mdi:cctv' },
  ]);
  assert.equal(compiled.length, 1);
  assert.equal(iconFor('Backyard camera', '', compiled), 'mdi:cctv');
});

test('icon rules: isValidPattern flags bad regexes', () => {
  assert.equal(isValidPattern('plug|socket'), true);
  assert.equal(isValidPattern('[unclosed'), false);
});

test('icon rules: defaults are bilingual', () => {
  assert.equal(iconFor('Water leak sensor'), 'mdi:water-alert');
  assert.equal(iconFor('Датчик протечки кухня'), 'mdi:water-alert');
  assert.equal(iconFor('Umidifier presence sensor'), 'mdi:motion-sensor');
});

test('icon rules: device_class fallback', () => {
  assert.equal(iconFromDeviceClasses(['temperature']), 'mdi:thermometer');
  assert.equal(iconFromDeviceClasses(['unknown', 'motion']), 'mdi:motion-sensor');
  assert.equal(iconFromDeviceClasses(['presence']), 'mdi:motion-sensor');
  assert.equal(iconFromDeviceClasses(['unknown']), null);
  assert.equal(iconFromDeviceClasses([]), null);
});

test('tap action: defaults — info everywhere except pure lights (v1.39.0)', () => {
  assert.equal(resolveTapAction(undefined, undefined, 'light'), 'toggle'); // лампы кликабельны из коробки
  assert.equal(resolveTapAction(undefined, undefined, 'switch'), 'info');
  assert.equal(resolveTapAction(null, 'info', 'switch'), 'info');
  assert.equal(resolveTapAction(null, 'more-info', 'sensor'), 'more-info');
});

test('tap action: card-wide toggle only touches safe domains', () => {
  assert.equal(resolveTapAction(null, 'toggle', 'light'), 'toggle');
  assert.equal(resolveTapAction(null, 'toggle', 'switch'), 'toggle');
  // covers/valves joined the safe set for curtains (owner, 2026-07-29)…
  assert.equal(resolveTapAction(null, 'toggle', 'cover', 'curtain'), 'toggle');
  assert.equal(resolveTapAction(null, 'toggle', 'valve'), 'toggle');
  // …but the garage door is a cover too, and it STAYS SHUT on a default tap
  assert.equal(resolveTapAction(null, 'toggle', 'cover', 'garage'), 'info');
  assert.equal(resolveTapAction(null, 'toggle', 'cover', 'gate'), 'info');
  assert.equal(resolveTapAction('toggle', null, 'cover', 'garage'), 'toggle', 'explicit stays a conscious choice');
  assert.equal(resolveTapAction(null, 'toggle', 'sensor'), 'info');
});

test('tap action: explicit per-device toggle works for cover but never for lock/alarm', () => {
  assert.equal(resolveTapAction('toggle', 'info', 'cover'), 'toggle'); // conscious choice
  assert.equal(resolveTapAction('toggle', 'toggle', 'lock'), 'info'); // hard security block
  assert.equal(resolveTapAction('toggle', 'toggle', 'alarm_control_panel'), 'info');
  assert.equal(resolveTapAction('toggle', 'info', undefined), 'info'); // no entity → nothing to toggle
});

test('tap action: per-device override beats the card default', () => {
  assert.equal(resolveTapAction('info', 'toggle', 'light'), 'info');
  assert.equal(resolveTapAction('more-info', 'toggle', 'light'), 'more-info');
});

test('floorsOf: sorts by level, tolerates missing registry and odd entries', () => {
  assert.deepEqual(floorsOf({}), []);
  assert.deepEqual(floorsOf({ floors: null }), []);
  const hass = { floors: {
    a: { floor_id: 'attic', name: 'Attic', level: 2 },
    g: { floor_id: 'ground', name: 'Ground', level: 0 },
    x: { floor_id: 'x', name: 'No level' },
    bad: null,
  }};
  const res = floorsOf(hass);
  assert.deepEqual(res.map((f) => f.id), ['ground', 'attic', 'x']);
});

test('subst: replaces every occurrence of a placeholder, ignores unknown', () => {
  assert.equal(subst('{n} of {n} ({x})', { n: 2, x: 'y' }), '2 of 2 (y)');
  assert.equal(subst('no vars'), 'no vars');
  assert.equal(subst('keep {unknown}', { n: 1 }), 'keep {unknown}');
});

test('spaceDisplayOf: defaults differ for spaces with and without a plan', () => {
  const withPlan = spaceDisplayOf({ plan_url: '/x.svg' });
  assert.equal(withPlan.showBorders, false);
  assert.equal(withPlan.showNames, false);
  assert.equal(withPlan.fill, 'none');
  assert.equal(withPlan.glow, false);
  const noPlan = spaceDisplayOf({ plan_url: null });
  assert.equal(noPlan.showBorders, true);
  assert.equal(noPlan.showNames, true);
  const s = spaceDisplayOf({ plan_url: null, settings: { show_borders: false, room_color: '#ff0000', room_opacity: 2, fill_mode: 'lqi' } });
  assert.equal(s.showBorders, false);
  assert.equal(s.color, '#ff0000');
  assert.equal(s.opacity, 1);
  assert.equal(s.fill, 'lqi');
  const g = spaceDisplayOf({ settings: { room_color: 'javascript:alert(1)', fill_mode: 'weird' } });
  assert.equal(g.color, '#55606c'); // dark-grey default since 2026-08-03
  assert.equal(g.fill, 'none');
  assert.equal(g.glow, false);
  const legacyGlow = spaceDisplayOf({ settings: { fill_mode: 'glow' } });
  assert.deepEqual({ fill: legacyGlow.fill, glow: legacyGlow.glow }, { fill: 'none', glow: true });
  const explicitOff = spaceDisplayOf({ settings: { fill_mode: 'glow', glow_enabled: false } });
  assert.deepEqual({ fill: explicitOff.fill, glow: explicitOff.glow }, { fill: 'none', glow: false });
  const custom = spaceDisplayOf({ settings: { fill_mode: 'custom', custom_fill: { c: '#123456', a: 0.37 } } });
  assert.deepEqual({ fill: custom.fill, customFill: custom.customFill }, {
    fill: 'custom', customFill: { c: '#123456', a: 0.37 },
  });
});

test('spaceDisplayOf: the two hide switches are opt-in and strictly boolean', () => {
  // absent = today's rendering, so no stored plan changes by being read
  const off = spaceDisplayOf({ plan_url: '/x.svg' });
  assert.equal(off.hideDecor, false);
  assert.equal(off.hideOpenings, false);
  const on = spaceDisplayOf({ settings: { hide_decor: true, hide_openings: true } });
  assert.equal(on.hideDecor, true);
  assert.equal(on.hideOpenings, true);
  // only a real `true` hides: a stray string must not blank the plan
  const junk = spaceDisplayOf({ settings: { hide_decor: 'yes', hide_openings: 1 } });
  assert.equal(junk.hideDecor, false);
  assert.equal(junk.hideOpenings, false);
});

test('roomFillColor: lqi gradient, light tri-state, none', () => {
  assert.equal(roomFillColor('none', 200, 'on'), null);
  assert.equal(roomFillColor('lqi', null, 'on'), null);
  assert.equal(roomFillColor('lqi', 180, 'none'), 'hsl(120, 85%, 55%)');
  assert.equal(roomFillColor('light', null, 'on'), '#ffd45c');
  assert.equal(roomFillColor('light', null, 'off'), '#9aa0a6');
  assert.equal(roomFillColor('light', null, 'none'), null);
});

test('roomFillColor temp: blue/green/yellow bands, swapped bounds tolerated, no reading → no fill', () => {
  assert.equal(roomFillColor('temp', null, 'none', 18, 20, 25), '#4fc3f7');  // cold
  assert.equal(roomFillColor('temp', null, 'none', 20, 20, 25), '#66d17a');  // lower bound inclusive
  assert.equal(roomFillColor('temp', null, 'none', 25, 20, 25), '#66d17a');  // upper bound inclusive
  assert.equal(roomFillColor('temp', null, 'none', 26.5, 20, 25), '#ffd45c'); // hot
  assert.equal(roomFillColor('temp', null, 'none', 18, 25, 20), '#4fc3f7');  // swapped bounds
  assert.equal(roomFillColor('temp', null, 'none', null, 20, 25), null);
  assert.equal(roomFillColor('temp', null, 'none', undefined, 20, 25), null);
});

test('spaceDisplayOf: temp bounds default to 20..25 and accept overrides', () => {
  const d = spaceDisplayOf({ plan_url: '/x.svg' });
  assert.equal(d.tempMin, 20);
  assert.equal(d.tempMax, 25);
  const o = spaceDisplayOf({ settings: { temp_min: 18.5, temp_max: 23 } });
  assert.equal(o.tempMin, 18.5);
  assert.equal(o.tempMax, 23);
});

test('segmentCm: cells scaled by cm-per-cell', () => {
  assert.equal(segmentCm([0, 0], [30, 40], 10, 5), 25); // 50 units / pitch 10 = 5 cells * 5cm
  assert.ok(Math.abs(segmentCm([0, 0], [240, 0], 1000 / 240, 5) - 288) < 1e-9);
});

test('formatLength: metric metres with 2 decimals', () => {
  assert.equal(formatLength(25, false), '0.25 m');
  assert.equal(formatLength(125, false), '1.25 m');
  assert.equal(formatLength(0, false), '0.00 m');
});

test('formatLength: imperial feet + inches, with inch rollover', () => {
  assert.equal(formatLength(124.46, true), '4′ 1″');
  assert.equal(formatLength(30.48, true), '1′ 0″');
  assert.equal(formatLength(29.464, true), '1′ 0″');
});

test('roomEdges: a line exists only as a room edge; polygons and rects both yield walls', () => {
  const sq = { poly: [[0, 0], [1, 0], [1, 1], [0, 1]] };
  assert.equal(roomEdges([sq]).length, 4);          // closed outline → 4 walls
  assert.equal(roomEdges([{ x: 0, y: 0, w: 1, h: 1 }]).length, 4); // legacy rect room
  assert.equal(roomEdges([]).length, 0);            // no rooms → no lines at all
  assert.equal(roomEdges([{ poly: [[0, 0], [1, 1]] }]).length, 0); // not a closed room → nothing
});

test('roomEdges: a wall shared by two rooms is emitted once, and survives deleting either room', () => {
  const left = { id: 'a', poly: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]] };
  const right = { id: 'b', poly: [[0.5, 0], [1, 0], [1, 1], [0.5, 1]] }; // shares x=0.5 wall
  const both = roomEdges([left, right]);
  assert.equal(both.length, 7); // 4 + 4 - 1 shared, deduped regardless of direction
  const shared = (segs) => segs.some((s) => s[0] === 0.5 && s[2] === 0.5);
  assert.ok(shared(both));
  // deleting 'left' → the shared wall stays, because 'right' still contributes it
  assert.ok(shared(roomEdges([right])));
  // deleting both → no lines remain
  assert.equal(roomEdges([]).length, 0);
});

const SQ = [[0, 0], [2, 0], [2, 2], [0, 2]];

test('pointStrictlyInside: a point on a wall is NOT inside (shared walls are normal)', () => {
  assert.ok(pointStrictlyInside([1, 1], SQ));        // middle
  assert.ok(!pointStrictlyInside([2, 1], SQ));       // on a wall mid-span (T-junction vertex)
  assert.ok(!pointStrictlyInside([0, 0], SQ));       // on a corner
  assert.ok(!pointStrictlyInside([3, 1], SQ));       // outside
  assert.ok(pointOnBoundary([2, 1], SQ));
  assert.ok(!pointOnBoundary([1, 1], SQ));
});

test('roomsOverlap: sharing a wall or a corner is legal; real overlap is not', () => {
  const right = [[2, 0], [4, 0], [4, 2], [2, 2]];       // shares the whole x=2 wall
  assert.ok(!roomsOverlap(SQ, right));
  // neighbour's wall is LONGER than ours — the real dacha case (collinear partial overlap)
  const tall = [[2, -1], [4, -1], [4, 3], [2, 3]];
  assert.ok(!roomsOverlap(SQ, tall));
  // touching only at a corner
  assert.ok(!roomsOverlap(SQ, [[2, 2], [3, 2], [3, 3], [2, 3]]));
  // apart
  assert.ok(!roomsOverlap(SQ, [[5, 5], [6, 5], [6, 6], [5, 6]]));
  // genuine partial overlap
  assert.ok(roomsOverlap(SQ, [[1, 1], [3, 1], [3, 3], [1, 3]]));
});

test('roomsOverlap v1.34: nesting is legal (islands), duplicates and crossings are not', () => {
  // nested & enclosing — legal since island rooms
  assert.ok(!roomsOverlap(SQ, [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]]));
  assert.ok(!roomsOverlap([[-1, -1], [3, -1], [3, 3], [-1, 3]], SQ));
  // a duplicate outline is still an overlap
  assert.ok(roomsOverlap(SQ, SQ));
  // a cross: no vertex of either lies inside the other, but the edges cross
  assert.ok(roomsOverlap([[0, 0.5], [3, 0.5], [3, 1.5], [0, 1.5]],
                         [[0.5, -1], [1.5, -1], [1.5, 3], [0.5, 3]]));
  // genuine partial overlap is still rejected
  assert.ok(roomsOverlap(SQ, [[1, 1], [3, 1], [3, 3], [1, 3]]));
});

test('polyContainsPoly & islandsOf', () => {
  const outer = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const col = [[4, 4], [6, 4], [6, 6], [4, 6]];
  const tiny = [[4.5, 4.5], [5, 4.5], [5, 5], [4.5, 5]]; // внутри col
  const partial = [[8, 8], [12, 8], [12, 12], [8, 12]];
  assert.ok(polyContainsPoly(outer, col));
  assert.ok(!polyContainsPoly(col, outer));
  assert.ok(!polyContainsPoly(outer, outer));    // дубликат — не вложенность
  assert.ok(!polyContainsPoly(outer, partial));
  // прямые острова: col — да; tiny — нет (он остров col, не outer)
  const isl = islandsOf(outer, [col, tiny, partial]);
  assert.deepEqual(isl, [col]);
  assert.deepEqual(islandsOf(col, [tiny]), [tiny]);
});

test('roomPoly: polygon rooms as-is, legacy rect rooms as four corners', () => {
  assert.equal(roomPoly({ poly: SQ }), SQ);
  assert.deepEqual(roomPoly({ x: 0, y: 0, w: 2, h: 2 }), SQ);
  assert.equal(roomPoly({}), null);
});

test('polygonArea: shoelace, orientation-independent', () => {
  assert.equal(polygonArea([[0, 0], [2, 0], [2, 2], [0, 2]]), 4);
  assert.equal(polygonArea([[0, 0], [0, 2], [2, 2], [2, 0]]), 4); // reversed winding
  assert.equal(polygonArea([[0, 0], [1, 1]]), 0);
});

test('mergeRooms: only rooms sharing a wall merge; the union is one simple outline', () => {
  const a = [[0, 0], [2, 0], [2, 2], [0, 2]];
  const full = mergeRooms(a, [[2, 0], [4, 0], [4, 2], [2, 2]]);   // whole wall shared
  assert.equal(polygonArea(full), 8);
  assert.equal(full.length, 4);                                    // collapses to one rectangle
  // the neighbour's wall is LONGER than ours — the real dacha case
  const partial = mergeRooms(a, [[2, -1], [4, -1], [4, 3], [2, 3]]);
  assert.equal(polygonArea(partial), 4 + 8);
  assert.ok(partial.length >= 6);                                  // an L/T-shaped outline
});

test('mergeRooms: refuses a corner touch, rooms apart, and a union with a hole', () => {
  const a = [[0, 0], [2, 0], [2, 2], [0, 2]];
  assert.equal(mergeRooms(a, [[2, 2], [4, 2], [4, 4], [2, 4]]), null); // corner only
  assert.equal(mergeRooms(a, [[5, 5], [6, 5], [6, 6], [5, 6]]), null); // apart
  const u = [[0, 0], [6, 0], [6, 2], [4, 2], [4, 6], [6, 6], [6, 8], [0, 8]];
  assert.equal(mergeRooms(u, [[6, 2], [8, 2], [8, 6], [6, 6]]), null); // would enclose a hole
});

test('splitRoom: a wall-to-wall chord cuts the room in two, areas are preserved', () => {
  const sq = [[0, 0], [4, 0], [4, 4], [0, 4]];
  const parts = splitRoom(sq, [0, 2], [4, 2]);            // straight across
  assert.ok(parts);
  assert.equal(polygonArea(parts[0]) + polygonArea(parts[1]), polygonArea(sq));
  assert.equal(polygonArea(parts[0]), 8);
  assert.equal(polygonArea(parts[1]), 8);
  // an off-centre cut → a bigger and a smaller part (the bigger one keeps the room)
  const off = splitRoom(sq, [0, 1], [4, 1]);
  const areas = [polygonArea(off[0]), polygonArea(off[1])].sort((x, y) => x - y);
  assert.deepEqual(areas, [4, 12]);
});

test('splitRoom: refuses cuts that are not clean wall-to-wall chords', () => {
  const sq = [[0, 0], [4, 0], [4, 4], [0, 4]];
  assert.equal(splitRoom(sq, [1, 1], [3, 3]), null);   // ends not on a wall
  assert.equal(splitRoom(sq, [0, 2], [0, 2]), null);   // same point
  assert.equal(splitRoom(sq, [0, 0], [4, 0]), null);   // along a wall → zero-area sliver
  // an L-shaped room: a chord that would leave the room is refused
  const L = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]];
  assert.equal(splitRoom(L, [4, 1], [1, 4]), null);
});

test('closestPointOnBoundary: projects a click onto the nearest wall', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.deepEqual(closestPointOnBoundary([5, -3], sq), [5, 0]);   // above the bottom edge
  assert.deepEqual(closestPointOnBoundary([13, 5], sq), [10, 5]);  // right of the right edge
  assert.deepEqual(closestPointOnBoundary([5, 4], sq), [5, 0]);    // inside → nearest edge (bottom)
  assert.equal(closestPointOnBoundary([0, 0], [[0, 0]]), null);    // no edges
});

test('isActiveState: a sensor outage calms the plan down, it never pulses forever', () => {
  assert.ok(isActiveState('on'));
  assert.ok(isActiveState('open'));
  assert.ok(isActiveState('home'));
  assert.ok(isActiveState('detected'));
  assert.ok(!isActiveState('off'));
  assert.ok(!isActiveState('unavailable'));
  assert.ok(!isActiveState('unknown'));
  assert.ok(!isActiveState(undefined));
  assert.ok(!isActiveState(null));
});

test('snapToWall: projects onto the nearest derived wall with its angle; misses return null', () => {
  const rooms = [{ poly: [[0, 0], [10, 0], [10, 10], [0, 10]] }];
  const s = snapToWall([4, 0.6], rooms, 1);        // near the top wall
  assert.deepEqual([s.x, s.y], [4, 0]);
  assert.equal(Math.abs(s.angle) % 180, 0);         // horizontal wall
  const v = snapToWall([10.4, 7], rooms, 1);        // near the right wall
  assert.deepEqual([v.x, v.y], [10, 7]);
  assert.equal(Math.abs(v.angle), 90);
  assert.equal(snapToWall([5, 5], rooms, 1), null); // middle of the room: no wall within reach
});

test('openingAmount: door-like openings default open, windows closed; outages freeze the default', () => {
  assert.equal(openingAmount('door', null), 1);
  assert.equal(openingAmount('gate', null), 1);
  assert.equal(openingAmount('window', null), 0);
  assert.equal(openingAmount('door', 'unavailable'), 1);
  assert.equal(openingAmount('gate', 'unknown'), 1);
  assert.equal(openingAmount('window', 'unknown'), 0);
  assert.equal(openingAmount('door', 'on'), 1);
  assert.equal(openingAmount('gate', 'off'), 0);
  assert.equal(openingAmount('gate', 'open'), 1);
  assert.equal(openingAmount('door', 'off'), 0);
  assert.equal(openingAmount('window', 'open'), 1);
  // invert flips on/off but never the outage default
  assert.equal(openingAmount('door', 'on', true), 0);
  assert.equal(openingAmount('door', 'off', true), 1);
  assert.equal(openingAmount('gate', 'off', true), 1);
  assert.equal(openingAmount('door', 'unavailable', true), 1);
});

test('snapToWall: the angle is normalized to [-90, 90) so opposite edge directions cannot flip a dragged opening', () => {
  // the same wall as seen from two neighbouring rooms (opposite winding)
  const a = [{ poly: [[0, 0], [10, 0], [10, 10], [0, 10]] }];
  const b = [{ poly: [[10, 0], [0, 0], [0, 10], [10, 10]] }]; // reversed
  const sa = snapToWall([5, 0.4], a, 1);
  const sb = snapToWall([5, 0.4], b, 1);
  assert.equal(sa.angle, sb.angle);
  assert.ok(sa.angle >= -90 && sa.angle < 90);
  const v = snapToWall([10.3, 5], a, 1); // vertical wall
  assert.ok(v.angle >= -90 && v.angle < 90);
});

test('fillColorsOf: defaults, merge, malformed entries dropped', () => {
  const d = fillColorsOf({});
  assert.equal(d.light_on.c, '#ffd45c');
  assert.equal(d.wall_fill.c, '#ffffff');
  assert.equal(d.wall_fill.a, 1);
  const o = fillColorsOf({ fill_colors: { light_on: { c: '#ff0000', a: 0.5 }, temp_hot: { c: 'javascript:x', a: 9 }, wall_fill: { c: '#abcdef', a: 0.4 } } });
  assert.equal(o.light_on.c, '#ff0000');
  assert.equal(o.light_on.a, 0.5);
  assert.equal(o.temp_hot.c, '#ffd45c'); // malformed hex → default
  assert.equal(o.temp_hot.a, 1);         // clamped
  assert.equal(o.wall_fill.c, '#abcdef');
  assert.equal(o.wall_fill.a, 0.4);
});

test('lerpColor: endpoints and midpoint', () => {
  assert.equal(lerpColor('#000000', '#ffffff', 0), '#000000');
  assert.equal(lerpColor('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(lerpColor('#000000', '#ffffff', 0.5), '#808080');
  assert.equal(lerpColor('#000000', '#ffffff', -5), '#000000'); // clamped
});

test('roomFillStyle: palette-driven fills, lqi gradient between custom endpoints', () => {
  const colors = fillColorsOf({ fill_colors: { lqi_low: { c: '#000000', a: 0.1 }, lqi_high: { c: '#ffffff', a: 0.3 } } });
  assert.equal(roomFillStyle('lqi', 110, 'none', null, 20, 25, colors).c, '#808080'); // mid of 40..180
  assert.equal(roomFillStyle('lqi', null, 'none', null, 20, 25, colors), null);
  assert.deepEqual(roomFillStyle('light', null, 'on', null, 20, 25, colors), colors.light_on);
  assert.deepEqual(roomFillStyle('temp', 18, 'none', 18, 20, 25, colors), colors.temp_cold);
  assert.equal(roomFillStyle('none', 100, 'on', 22, 20, 25, colors), null);
  assert.deepEqual(roomFillStyle('custom', null, 'none', null, 20, 25, colors, { c: '#123456', a: 0.42 }),
    { c: '#123456', a: 0.42 });
});

test('custom fill projection is safe and follows room -> space -> default inheritance', () => {
  assert.deepEqual(customFillOf(null), { c: '#607d8b', a: 0.18 });
  assert.deepEqual(customFillOf({ c: 'url(javascript:x)', a: Infinity }), { c: '#607d8b', a: 0.18 });
  assert.deepEqual(customFillOf({ c: '#abcdef', a: -2 }), { c: '#abcdef', a: 0 });
  const space = { c: '#112233', a: 0.25 };
  assert.deepEqual(roomCustomFillOf(space, {}), space);
  assert.deepEqual(roomCustomFillOf(space, { settings: { custom_fill: null } }), space);
  assert.deepEqual(roomCustomFillOf(space, { settings: { custom_fill: { c: '#445566', a: 0.7 } } }),
    { c: '#445566', a: 0.7 });
});

test('spaceDisplayOf: show_lqi tri-state (null = follow the card option)', () => {
  assert.equal(spaceDisplayOf({}).showLqi, null);
  assert.equal(spaceDisplayOf({ settings: { show_lqi: false } }).showLqi, false);
  assert.equal(spaceDisplayOf({ settings: { show_lqi: true } }).showLqi, true);
});

test('roomFillStyle light_none: alpha 0 keeps no-fill; a custom color fills lightless rooms', () => {
  const def = fillColorsOf({});
  assert.equal(roomFillStyle('light', null, 'none', null, 20, 25, def), null); // default: unchanged
  const c = fillColorsOf({ fill_colors: { light_none: { c: '#123456', a: 0.2 } } });
  assert.deepEqual(roomFillStyle('light', null, 'none', null, 20, 25, c), { c: '#123456', a: 0.2 });
});

test('resolveEffectiveRoomFill preserves the existing palette contract for room shapes and tunnels', () => {
  const colors = fillColorsOf({ fill_colors: {
    light_on: { c: '#111111', a: 0.11 },
    light_off: { c: '#222222', a: 0.22 },
    temp_cold: { c: '#333333', a: 0.33 },
    temp_ok: { c: '#444444', a: 0.44 },
    temp_hot: { c: '#555555', a: 0.55 },
    lqi_low: { c: '#000000', a: 0.1 },
    lqi_high: { c: '#ffffff', a: 0.3 },
    glow_base: { c: '#666666', a: 0.66 },
  } });
  const cases = [
    ['none', null, 'none', null, null],
    ['lqi', 110, 'none', null, { color: '#808080', opacity: 0.2, mode: 'lqi' }],
    ['lqi', null, 'none', null, null],
    ['light', null, 'on', null, { color: '#111111', opacity: 0.11, mode: 'light' }],
    ['light', null, 'off', null, { color: '#222222', opacity: 0.22, mode: 'light' }],
    ['temp', null, 'none', 18, { color: '#333333', opacity: 0.33, mode: 'temp' }],
    ['temp', null, 'none', 22, { color: '#444444', opacity: 0.44, mode: 'temp' }],
    ['temp', null, 'none', 27, { color: '#555555', opacity: 0.55, mode: 'temp' }],
    ['temp', null, 'none', null, null],
    ['custom', null, 'none', null, { color: '#123456', opacity: 0.42, mode: 'custom' }],
  ];
  for (const [mode, lqi, lights, temp, expected] of cases) {
    assert.deepEqual(resolveEffectiveRoomFill(
      mode, lqi, lights, temp, 20, 25, colors, { c: '#123456', a: 0.42 },
    ), expected);
  }
});

test('stateIcon: doors/locks/bulbs reflect state; custom icons and outages never morph', () => {
  assert.equal(stateIcon('mdi:door', 'binary_sensor', 'door', 'on', false), 'mdi:door-open');
  assert.equal(stateIcon('mdi:door', 'binary_sensor', 'door', 'off', false), 'mdi:door-closed');
  assert.equal(stateIcon('mdi:window-closed', 'binary_sensor', 'window', 'on', false), 'mdi:window-open');
  assert.equal(stateIcon('mdi:garage-variant', 'binary_sensor', 'garage_door', 'on', false), 'mdi:garage-open-variant');
  assert.equal(stateIcon('mdi:lock', 'lock', undefined, 'unlocked', false), 'mdi:lock-open-variant');
  assert.equal(stateIcon('mdi:lightbulb', 'light', undefined, 'on', false), 'mdi:lightbulb-on');
  assert.equal(stateIcon('mdi:lightbulb', 'light', undefined, 'off', false), 'mdi:lightbulb');
  assert.equal(stateIcon('mdi:door', 'binary_sensor', 'door', 'unavailable', false), 'mdi:door');
  assert.equal(stateIcon('mdi:custom', 'lock', undefined, 'unlocked', true), 'mdi:custom'); // user icon wins
  assert.equal(stateIcon('mdi:cctv', 'camera', undefined, 'recording', false), 'mdi:cctv'); // unknown pair
});

test('stateIcon: covers morph by device_class (owner 2026-08-03)', () => {
  assert.equal(stateIcon('mdi:blinds', 'cover', 'blind', 'closed', false), 'mdi:blinds');
  assert.equal(stateIcon('mdi:blinds', 'cover', 'blind', 'open', false), 'mdi:blinds-open');
  assert.equal(stateIcon('mdi:window-shutter', 'cover', 'shutter', 'open', false), 'mdi:window-shutter-open');
  assert.equal(stateIcon('mdi:window-shutter', 'cover', 'shutter', 'closed', false), 'mdi:window-shutter');
  assert.equal(stateIcon('mdi:curtains', 'cover', 'curtain', 'closed', false), 'mdi:curtains-closed');
  assert.equal(stateIcon('mdi:curtains', 'cover', 'curtain', 'open', false), 'mdi:curtains');
  // travelling covers show where they are HEADED: closing keeps the open art
  assert.equal(stateIcon('mdi:blinds', 'cover', 'blind', 'opening', false), 'mdi:blinds-open');
  assert.equal(stateIcon('mdi:blinds', 'cover', 'blind', 'closing', false), 'mdi:blinds-open');
  // no state at all — never morph, never guess
  assert.equal(stateIcon('mdi:blinds', 'cover', 'blind', 'unknown', false), 'mdi:blinds');
  assert.equal(stateIcon('mdi:blinds', 'cover', 'blind', 'unavailable', false), 'mdi:blinds');
  assert.equal(stateIcon('mdi:custom', 'cover', 'blind', 'open', true), 'mdi:custom'); // user icon wins
  // no device_class: only a known base icon morphs, an unrelated one stays
  assert.equal(stateIcon('mdi:blinds', 'cover', undefined, 'open', false), 'mdi:blinds-open');
  assert.equal(stateIcon('mdi:window-shutter', 'cover', null, 'closed', false), 'mdi:window-shutter');
  assert.equal(stateIcon('mdi:sofa', 'cover', undefined, 'open', false), 'mdi:sofa');
});

test('stateIcon: a cover morphs for EVERY class, both ways (owner 2026-08-04)', () => {
  // With the «открыто» plate gone from covers, the morph is the only signal —
  // so no class may map both states to the same glyph, and the icons the card
  // itself hands out (rules.ts) have to morph even without a device_class.
  const CLASSES = ['blind', 'shade', 'shutter', 'curtain', 'window', 'awning',
    'door', 'garage', 'gate', 'damper'];
  for (const dc of CLASSES) {
    const closed = stateIcon('mdi:chip', 'cover', dc, 'closed', false);
    const open = stateIcon('mdi:chip', 'cover', dc, 'open', false);
    assert.notEqual(closed, open, `${dc}: closed and open share one icon`);
    // ajar and travelling all read as OPEN (HA reports a positioned cover 'open')
    assert.equal(stateIcon('mdi:chip', 'cover', dc, 'opening', false), open);
    assert.equal(stateIcon('mdi:chip', 'cover', dc, 'closing', false), open);
  }
  assert.equal(stateIcon('mdi:chip', 'cover', 'awning', 'closed', false), 'mdi:awning-outline');
  assert.equal(stateIcon('mdi:chip', 'cover', 'awning', 'open', false), 'mdi:awning');
  // no device_class: the auto icons of rules.ts morph within their own family
  assert.equal(stateIcon('mdi:roller-shade', 'cover', undefined, 'closed', false), 'mdi:roller-shade-closed');
  assert.equal(stateIcon('mdi:roller-shade-closed', 'cover', undefined, 'open', false), 'mdi:roller-shade');
  assert.equal(stateIcon('mdi:garage-variant', 'cover', undefined, 'open', false), 'mdi:garage-open-variant');
  assert.equal(stateIcon('mdi:blinds-horizontal', 'cover', null, 'closed', false), 'mdi:blinds-horizontal-closed');
  // a HAND-PICKED icon morphs only inside the pair it was picked from — never
  // traded for another family, never touched outside the cover domain
  assert.equal(stateIcon('mdi:curtains', 'cover', 'blind', 'closed', true), 'mdi:curtains-closed');
  assert.equal(stateIcon('mdi:curtains-closed', 'cover', undefined, 'open', true), 'mdi:curtains');
  assert.equal(stateIcon('mdi:sofa', 'cover', 'blind', 'open', true), 'mdi:sofa');
  assert.equal(stateIcon('mdi:door-closed', 'binary_sensor', 'door', 'on', true), 'mdi:door-closed');
  assert.equal(stateIcon('mdi:lock', 'lock', undefined, 'unlocked', true), 'mdi:lock');
});

test('coverService: closed→open, open→close, travelling→stop (owner 2026-08-03)', () => {
  assert.equal(coverService('closed'), 'open_cover');
  assert.equal(coverService('open'), 'close_cover');       // incl. ajar: HA reports 'open'
  assert.equal(coverService('opening'), 'stop_cover');     // a tap during travel STOPS
  assert.equal(coverService('closing'), 'stop_cover');
  assert.equal(coverService('unknown'), 'toggle');         // no readable state → plain toggle
  assert.equal(coverService('unavailable'), 'toggle');
  assert.equal(coverService(null), 'toggle');
  assert.equal(coverService(undefined), 'toggle');
});

test('coverEntityOf: the cover among ALL entities, primary or not (owner 2026-08-04)', () => {
  // the owner's Aqara E1 curtain driver, entity for entity: the cover is
  // hidden by the integration and sits BEHIND the service switch, so
  // primaryEntity picks the switch — the tap has to look wider than that
  const aqara = [
    'cover.office_curtain', 'sensor.office_curtain_battery',
    'switch.office_curtain_reverse', 'sensor.office_curtain_motor_state',
  ];
  assert.equal(coverEntityOf(aqara), 'cover.office_curtain');
  assert.equal(coverEntityOf(['switch.a', 'cover.b']), 'cover.b'); // order does not matter
  assert.equal(coverEntityOf(['cover.first', 'cover.second']), 'cover.first');
  assert.equal(coverEntityOf(['light.only']), null);
  assert.equal(coverEntityOf([]), null);
  assert.equal(coverEntityOf(null), null);
  assert.equal(coverEntityOf(undefined), null);
  // a `cover_something` sensor is not a cover
  assert.equal(coverEntityOf(['sensor.cover_position']), null);
});

test('coverMoving: only opening/closing breathe', () => {
  assert.equal(coverMoving('opening'), true);
  assert.equal(coverMoving('closing'), true);
  assert.equal(coverMoving('open'), false);
  assert.equal(coverMoving('closed'), false);
  assert.equal(coverMoving('unknown'), false);
  assert.equal(coverMoving(null), false);
});

test("tap action 'cover': explicit-only, cover-only, never a guarded class", () => {
  assert.equal(resolveTapAction('cover', null, 'cover', 'curtain'), 'cover');
  assert.equal(resolveTapAction('cover', null, 'cover', 'blind'), 'cover');
  assert.equal(resolveTapAction('cover', null, 'cover', null), 'cover'); // no class = a plain cover
  // the guarded classes degrade to the info card even if the value was saved
  assert.equal(resolveTapAction('cover', null, 'cover', 'garage'), 'info');
  assert.equal(resolveTapAction('cover', null, 'cover', 'door'), 'info');
  assert.equal(resolveTapAction('cover', null, 'cover', 'gate'), 'info');
  // and it is meaningless anywhere but the cover domain
  assert.equal(resolveTapAction('cover', null, 'light'), 'info');
  assert.equal(resolveTapAction('cover', null, 'lock'), 'info');
  // never a card-wide default (like 'run'): it needs a conscious per-marker choice
  assert.equal(resolveTapAction(null, 'cover', 'cover', 'curtain'), 'info');
});

test('lightColorOf: rgb of an on light; off/unavailable/no-color → null', () => {
  assert.equal(lightColorOf({ state: 'on', attributes: { rgb_color: [255, 20, 40] } }), 'rgb(255, 20, 40)');
  assert.equal(lightColorOf({ state: 'off', attributes: { rgb_color: [255, 20, 40] } }), null);
  assert.equal(lightColorOf({ state: 'on', attributes: {} }), null);
  assert.equal(lightColorOf({ state: 'unavailable', attributes: { rgb_color: [1, 2, 3] } }), null);
  assert.equal(lightColorOf(undefined), null);
});

test('isAlarmState: safety sensors, siren and triggered alarm panel fire; doors and outages do not', () => {
  assert.ok(isAlarmState('binary_sensor', 'moisture', 'on'));
  assert.ok(isAlarmState('binary_sensor', 'smoke', 'on'));
  assert.ok(isAlarmState('siren', undefined, 'on'));
  assert.ok(isAlarmState('alarm_control_panel', undefined, 'triggered'));
  assert.ok(!isAlarmState('alarm_control_panel', undefined, 'armed_away'));
  assert.ok(!isAlarmState('binary_sensor', 'door', 'on'));
  assert.ok(!isAlarmState('binary_sensor', 'smoke', 'off'));
  assert.ok(!isAlarmState('binary_sensor', 'smoke', 'unavailable'));
});

test('parseRoomRef: area rooms, sub-area rooms by id, malformed refs', () => {
  assert.deepEqual(parseRoomRef('f1#kitchen'), { space: 'f1', area: 'kitchen', roomId: null });
  assert.deepEqual(parseRoomRef('f1#@r7'), { space: 'f1', area: null, roomId: 'r7' });
  assert.equal(parseRoomRef(''), null);
  assert.equal(parseRoomRef('f1#'), null);
  assert.equal(parseRoomRef('f1#@'), null);
  assert.equal(parseRoomRef('#kitchen'), null);
  assert.equal(parseRoomRef(null), null);
});

test('diffNewDevices: first run seeds the baseline silently; later additions are fresh', () => {
  const first = diffNewDevices(['a', 'b'], undefined);
  assert.deepEqual(first, { fresh: [], known: ['a', 'b'] });
  const none = diffNewDevices(['a', 'b'], ['a', 'b']);
  assert.deepEqual(none.fresh, []);
  assert.equal(none.known.length, 2);
  const added = diffNewDevices(['a', 'b', 'c'], ['a', 'b']);
  assert.deepEqual(added.fresh, ['c']);
  assert.deepEqual(added.known, ['a', 'b', 'c']);
  // removed devices stay in known (harmless, keeps the list append-only)
  const removed = diffNewDevices(['a'], ['a', 'b']);
  assert.deepEqual(removed.fresh, []);
});

test('spaceDisplayOf: room-card metric flags default to off', () => {
  const d0 = spaceDisplayOf({ plan_url: 'x', settings: {} });
  assert.deepEqual([d0.labelTemp, d0.labelHum, d0.labelLqi, d0.labelLight], [false, false, false, false]);
  const d1 = spaceDisplayOf({ plan_url: 'x', settings: { label_temp: true, label_light: true } });
  assert.deepEqual([d1.labelTemp, d1.labelHum, d1.labelLqi, d1.labelLight], [true, false, false, true]);
});

test('splitRoomPath: polyline cut of a square', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  // Г-образный разрез: верхняя стена (4,0) → внутрь (4,6) → правая стена (10,6)
  const parts = splitRoomPath(sq, [[4, 0], [4, 6], [10, 6]], 1e-6);
  assert.ok(parts);
  const [p1, p2] = parts;
  const area = (p) => Math.abs(p.reduce((a, _, i) => {
    const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length];
    return a + x1 * y2 - x2 * y1;
  }, 0)) / 2;
  assert.ok(Math.abs(area(p1) + area(p2) - 100) < 1e-6);
  // меньшая часть — прямоугольник 6x6 минус... фактически площадь 4*6+... проверим что обе > 0
  assert.ok(area(p1) > 0 && area(p2) > 0);
});

test('splitRoomPath: two points == classic straight chord', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const parts = splitRoomPath(sq, [[5, 0], [5, 10]], 1e-6);
  assert.ok(parts);
});

test('splitRoomPath rejects bad paths', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  // промежуточная точка снаружи
  assert.equal(splitRoomPath(sq, [[4, 0], [4, -3], [10, 6]], 1e-6), null);
  // сегмент пересекает стену (выходит и возвращается)
  assert.equal(splitRoomPath(sq, [[4, 0], [14, 5], [10, 6]], 1e-6), null);
  // конец не на стене
  assert.equal(splitRoomPath(sq, [[4, 0], [5, 5]], 1e-6), null);
  // самопересечение пути
  assert.equal(splitRoomPath(sq, [[2, 0], [8, 8], [8, 2], [2, 8], [0, 4]], 1e-6), null);
  // менее двух точек
  assert.equal(splitRoomPath(sq, [[4, 0]], 1e-6), null);
});

test('kelvinToRgb: warm is orange-ish, cool is blue-ish white', () => {
  const warm = kelvinToRgb(2700);
  assert.equal(warm[0], 255);
  assert.ok(warm[2] < 200 && warm[1] < 230);
  const cool = kelvinToRgb(6600);
  assert.ok(cool[0] > 245 && cool[1] > 240 && cool[2] > 245);
  // clamps
  assert.ok(kelvinToRgb(100)[0] === 255);
});

test('glowColorOf: rgb wins, then color temp, then fallback; off = null', () => {
  assert.equal(glowColorOf({ state: 'off', attributes: {} }, '#fff'), null);
  assert.equal(glowColorOf(null, '#fff'), null);
  const rgb = glowColorOf({ state: 'on', attributes: { rgb_color: [10, 20, 30], brightness: 128 } }, '#fff');
  assert.equal(rgb.c, 'rgb(10, 20, 30)');
  assert.ok(Math.abs(rgb.bri - 0.5) < 0.01);
  const ct = glowColorOf({ state: 'on', attributes: { color_temp_kelvin: 2700 } }, '#fff');
  assert.ok(ct.c.startsWith('rgb(255'));
  const mireds = glowColorOf({ state: 'on', attributes: { color_temp: 370 } }, '#fff'); // ~2700K
  assert.ok(mireds.c.startsWith('rgb(255'));
  const fb = glowColorOf({ state: 'on', attributes: {} }, '#abcdef');
  assert.equal(fb.c, '#abcdef');
  assert.equal(fb.bri, 1);
});

test('doorSector: sector through a door, clamped and guarded', () => {
  const s = [0, 0];
  const sec = doorSector(s, [10, -2], [10, 2], 50);
  assert.ok(sec && sec.length === 10 + 0); // вершина + 9 точек дуги
  assert.deepEqual(sec[0], [0, 0]);
  for (const p of sec.slice(1)) {
    const d = Math.hypot(p[0], p[1]);
    assert.ok(Math.abs(d - 50) < 1e-6);
    assert.ok(p[0] > 0); // сектор смотрит в сторону двери
  }
  // дверь за радиусом
  assert.equal(doorSector(s, [60, -2], [60, 2], 50), null);
  // источник на краю двери
  assert.equal(doorSector(s, [0, 0], [10, 2], 50), null);
});

test('doorSector: thick doorway is clipped by both tunnel jamb faces', () => {
  const src = [0, 3];
  const a = [10, -2];
  const b = [10, 2];
  const thin = doorSector(src, a, b, 50);
  const thick = doorSector(src, a, b, 50, 170, 4);
  assert.ok(thin && thick);
  assert.deepEqual(doorSector(src, a, b, 50, 170, 0), thin);

  // The vertical wall occupies x=8..12. Every limiting ray must remain inside
  // the clear opening y=-2..2 at BOTH faces, not only at the centreline.
  const yAtX = (p, x) => src[1] + (p[1] - src[1]) * ((x - src[0]) / (p[0] - src[0]));
  for (const p of [thick[1], thick.at(-1)]) {
    for (const x of [8, 12]) assert.ok(Math.abs(yAtX(p, x)) <= 2 + 1e-9);
  }

  const spreadAtFarFace = (sector) => Math.abs(yAtX(sector[1], 12) - yAtX(sector.at(-1), 12));
  assert.ok(spreadAtFarFace(thick) < spreadAtFarFace(thin));
});

test('hasRoomBehind: neighbour room yes, street no', () => {
  const neighbour = [[10, -5], [20, -5], [20, 5], [10, 5]];
  // дверь в стене x=10 (стена вертикальна: угол 90°), источник слева в (5,0)
  assert.ok(hasRoomBehind([10, 0], 90, [5, 0], [neighbour], 1));
  // за дверью пусто
  assert.ok(!hasRoomBehind([10, 0], 90, [5, 0], [], 1));
  assert.ok(!hasRoomBehind([10, 0], 90, [5, 0], [[[30, 30], [40, 30], [40, 40], [30, 40]]], 1));
});

test('controlsAction: HA-group semantics', () => {
  assert.equal(controlsAction(['off', 'off']), 'turn_on');
  assert.equal(controlsAction(['off', 'on']), 'turn_off');
  assert.equal(controlsAction(['on', 'on']), 'turn_off');
  assert.equal(controlsAction([undefined, 'off']), 'turn_on');
  assert.equal(controlsAction([]), 'turn_on');
});

test('isControllable: lights and switches only', () => {
  assert.ok(isControllable('light.kitchen'));
  assert.ok(isControllable('switch.pump'));
  assert.ok(!isControllable('lock.front'));
  assert.ok(!isControllable('cover.gate'));
  assert.ok(!isControllable('alarm_control_panel.home'));
});

test('sharedBoundary: exact, partial-collinear and none', () => {
  const A = [[0, 0], [2, 0], [2, 2], [0, 2]];
  // точное общее ребро x=2
  const B = [[2, 0], [4, 0], [4, 2], [2, 2]];
  const s1 = sharedBoundary(A, B);
  assert.equal(s1.length >= 1, true);
  const len = (s) => Math.hypot(s[2] - s[0], s[3] - s[1]);
  assert.ok(Math.abs(Math.max(...s1.map(len)) - 2) < 1e-6);
  // частичное коллинеарное наложение (дачный случай): стена соседа длиннее
  const C = [[2, -1], [4, -1], [4, 3], [2, 3]];
  const s2 = sharedBoundary(A, C);
  assert.ok(Math.abs(Math.max(...s2.map(len)) - 2) < 1e-6); // перекрытие = наша стена
  // нет наложения
  assert.equal(sharedBoundary(A, [[5, 5], [6, 5], [6, 6], [5, 6]]).length, 0);
  // перпендикулярное касание — не граница
  assert.equal(sharedBoundary(A, [[2, 2], [3, 2], [3, 3], [2, 3]]).filter((s) => len(s) > 1e-6).length, 0);
});

test('openZoneOf: transitive, either-direction links', () => {
  const rooms = [
    { id: 'a', open_to: ['b'] },
    { id: 'b' },                    // связь только со стороны a
    { id: 'c', open_to: ['b'] },    // b↔c со стороны c
    { id: 'd' },                    // не связан
  ];
  const z = openZoneOf('a', rooms);
  assert.deepEqual([...z].sort(), ['a', 'b', 'c']);
  assert.deepEqual([...openZoneOf('d', rooms)], ['d']);
});

test('distToSegment', () => {
  assert.equal(distToSegment([0, 5], [0, 0, 0, 10]), 0);
  assert.equal(distToSegment([3, 5], [0, 0, 0, 10]), 3);
  assert.ok(Math.abs(distToSegment([-3, -4], [0, 0, 0, 10]) - 5) < 1e-9);
});

test('outlineWithout: removes the cut stretch, keeps the rest', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  // вырез середины нижней стены: 3..7
  const pieces = outlineWithout(sq, [[3, 0, 7, 0]]);
  const len = (s) => Math.hypot(s[2] - s[0], s[3] - s[1]);
  const total = pieces.reduce((a, s) => a + len(s), 0);
  assert.ok(Math.abs(total - (40 - 4)) < 1e-6);
  // куски нижней стены: 0..3 и 7..10
  const bottom = pieces.filter((s) => s[1] === 0 && s[3] === 0);
  assert.equal(bottom.length, 2);
  // вырез целого ребра
  const p2 = outlineWithout(sq, [[0, 0, 10, 0]]);
  assert.ok(Math.abs(p2.reduce((a, s) => a + len(s), 0) - 30) < 1e-6);
  // без вырезов — весь периметр
  assert.ok(Math.abs(outlineWithout(sq, []).reduce((a, s) => a + len(s), 0) - 40) < 1e-6);
});

test('resolveTapAction: pure lights toggle by default (v1.39.0)', () => {
  assert.equal(resolveTapAction(null, null, 'light'), 'toggle');
  assert.equal(resolveTapAction('', undefined, 'light'), 'toggle');
  // явный выбор пользователя сильнее дефолта
  assert.equal(resolveTapAction('info', null, 'light'), 'info');
  // не-световые домены не трогаем
  assert.equal(resolveTapAction(null, null, 'switch'), 'info');
  assert.equal(resolveTapAction(null, null, 'sensor'), 'info');
  // замок никогда
  assert.equal(resolveTapAction('toggle', null, 'lock'), 'info');
});

test('alignGuides: nearest per axis, indication only', () => {
  const cands = [[10, 50], [10, 90], [70, 20], [40, 40]];
  const g = alignGuides([10, 60], cands, 0.5);
  const gx = g.find((x) => x.axis === 'x');
  assert.ok(gx && gx.at === 10 && gx.from[1] === 50); // ближайший по Y из выровненных по X
  // выравнивание по Y
  const g2 = alignGuides([30, 20], cands, 0.5);
  const gy = g2.find((x) => x.axis === 'y');
  assert.ok(gy && gy.at === 20 && gy.from[0] === 70);
  // вне допуска — пусто
  assert.equal(alignGuides([11, 60], cands, 0.5).length, 0);
  // совпадающая точка не гид сама себе
  assert.equal(alignGuides([10, 50], [[10, 50]], 0.5).length, 0);
  // максимум два гида
  const g3 = alignGuides([10, 20], cands, 0.5);
  assert.ok(g3.length <= 2);
});

test('segmentAngle & is45', () => {
  assert.equal(segmentAngle([0, 0], [10, 0]), 0);
  assert.equal(segmentAngle([0, 0], [0, 10]), 90);
  assert.equal(segmentAngle([0, 0], [10, 10]), 45);
  assert.equal(segmentAngle([0, 0], [-10, 0]), 180);
  assert.ok(is45(45) && is45(90) && is45(315) && is45(0));
  assert.ok(is45(44.8) && is45(45.3));
  assert.ok(!is45(30) && !is45(52));
});

test('swipeTarget: kiosk swipe rules', () => {
  const ids = ['f1', 'f2', 'garden'];
  // влево → следующее, вправо → предыдущее, по кругу
  assert.equal(swipeTarget(-100, 5, 1, ids, 'f1'), 'f2');
  assert.equal(swipeTarget(100, 5, 1, ids, 'f1'), 'garden');
  assert.equal(swipeTarget(-100, 0, 1, ids, 'garden'), 'f1');
  // при зуме — не свайп
  assert.equal(swipeTarget(-100, 0, 2, ids, 'f1'), null);
  // короткий или диагональный жест — не свайп
  assert.equal(swipeTarget(-30, 0, 1, ids, 'f1'), null);
  assert.equal(swipeTarget(-80, 70, 1, ids, 'f1'), null);
  // одно пространство — некуда
  assert.equal(swipeTarget(-100, 0, 1, ['f1'], 'f1'), null);
});

test('clampScale', () => {
  assert.equal(clampScale(2), 2);
  assert.equal(clampScale(9), 3);
  assert.equal(clampScale(0.1), 0.5);
  assert.equal(clampScale('x'), 1);
  assert.equal(clampScale(undefined, 1.5), 1.5);
});

test('migratePdfUrls: only confirmed copies are rewritten (review CR-3)', () => {
  const pdfs = [
    { name: 'a.pdf', url: '/houseplan_files/files/v_old1/a.pdf?v=1' },
    { name: 'b.pdf', url: '/houseplan_files/files/v_old1/b.pdf?v=2' },
  ];
  // сервер скопировал только a.pdf, причём переименовал из-за коллизии
  // collision names use only characters the content view accepts back in a
  // request: ' (2)' was sanitised to '_2_' server-side and 404'd (v1.46.0)
  const out = migratePdfUrls(pdfs, 'v_old1', 'dev99', { 'a.pdf': 'a-2.pdf' });
  assert.equal(out[0].url, '/houseplan_files/files/dev99/a-2.pdf?v=1');
  assert.equal(out[1].url, pdfs[1].url, 'нескопированный файл ссылается на старую папку');
  // пустой маппинг = ничего не переносим
  assert.deepEqual(migratePdfUrls(pdfs, 'v_old1', 'dev99', {}).map((p) => p.url),
    pdfs.map((p) => p.url));
});

test('migratePdfUrls: rebinding rewrites file urls', () => {
  const pdfs = [
    { name: 'a.pdf', url: '/houseplan_files/files/v_old1/a.pdf?v=1' },
    { name: 'b.pdf', url: '/houseplan_files/files/other/b.pdf?v=2' },
  ];
  const out = migratePdfUrls(pdfs, 'v_old1', 'dev99');
  assert.equal(out[0].url, '/houseplan_files/files/dev99/a.pdf?v=1');
  assert.equal(out[1].url, pdfs[1].url); // чужие пути не трогаем
  // без смены id — как есть
  assert.equal(migratePdfUrls(pdfs, 'x', 'x'), pdfs);
});

test('roomFillModeOf: tier-3 override beats the space, junk inherits', () => {
  assert.equal(roomFillModeOf('temp', { settings: { fill_mode: 'light' } }), 'light');
  assert.equal(roomFillModeOf('temp', { settings: { fill_mode: 'custom' } }), 'custom');
  assert.equal(roomFillModeOf('temp', {}), 'temp');
  assert.equal(roomFillModeOf('temp', null), 'temp');
  assert.equal(roomFillModeOf('temp', { settings: { fill_mode: 'glow' } }), 'temp'); // legacy glow is projected separately
});

test('roomGlowOf: explicit room data wins legacy and space fallbacks', () => {
  assert.equal(roomGlowOf(false, { settings: { fill_mode: 'glow' } }), true);
  assert.equal(roomGlowOf(true, { settings: { fill_mode: 'glow', glow: false } }), false);
  assert.equal(roomGlowOf(false, { settings: { glow: true } }), true);
  assert.equal(roomGlowOf(true, { settings: { fill_mode: 'temp' } }), true);
});

test('splitRoomPath: both ends on the SAME edge carve a niche (audit G1)', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const A = (p) => Math.round(polygonArea(p) * 1000) / 1000;
  // ИНВАРИАНТ разреза: части в сумме дают исходную площадь
  const invariant = (pts, label) => {
    const r = splitRoomPath(sq, pts);
    assert.ok(r, label + ': разрез должен приниматься');
    assert.ok(Math.abs(A(r[0]) + A(r[1]) - A(sq)) < 1e-6,
      label + ': сумма частей ' + (A(r[0]) + A(r[1])) + ' != ' + A(sq));
    return r;
  };
  const niche = invariant([[2, 0], [2, 3], [8, 3], [8, 0]], 'ниша снизу');
  assert.deepEqual([A(niche[0]), A(niche[1])].sort((x, y) => x - y), [18, 82]);
  invariant([[2, 10], [2, 7], [8, 7], [8, 10]], 'ниша сверху');
  invariant([[0, 2], [3, 2], [3, 8], [0, 8]], 'ниша слева');
  invariant([[8, 0], [8, 3], [2, 3], [2, 0]], 'обратный порядок точек');
  invariant([[1, 0], [3, 4], [5, 1], [7, 4], [9, 0]], 'зигзаг');
  // вырожденная ниша нулевой площади — отказ
  assert.equal(splitRoomPath(sq, [[2, 0], [2, 1e-9], [8, 0]]), null);
  // старые формы разрезов сохраняют инвариант
  invariant([[5, 0], [5, 10]], 'прямая хорда');
  invariant([[4, 0], [4, 6], [10, 6]], 'Г-образный');
});

test('contentUrl: legacy static paths become authenticated ones (audit B1)', () => {
  assert.equal(contentUrl('/houseplan_files/plans/f1.svg?v=1'), '/api/houseplan/content/plans/_/f1.svg?v=1');
  assert.equal(contentUrl('/houseplan_files/files/dev1/a.pdf?v=2'), '/api/houseplan/content/files/dev1/a.pdf?v=2');
  // новые и внешние адреса не трогаем
  assert.equal(contentUrl('/api/houseplan/content/files/x/y.pdf'), '/api/houseplan/content/files/x/y.pdf');
  assert.equal(contentUrl('https://example.com/a.pdf'), 'https://example.com/a.pdf');
  assert.equal(contentUrl(''), '');
  assert.equal(contentUrl(null), '');
});

test('interiorPoint / polyContainsPoly on concave rooms (audit G2)', () => {
  // U-образная комната: среднее вершин лежит СНАРУЖИ
  const u = [[0, 0], [10, 0], [10, 10], [9, 10], [9, 2], [1, 2], [1, 10], [0, 10]];
  const mean = [u.reduce((s, p) => s + p[0], 0) / u.length, u.reduce((s, p) => s + p[1], 0) / u.length];
  assert.equal(pointStrictlyInside(mean, u), false, 'предпосылка: среднее снаружи');
  const ip = interiorPoint(u);
  assert.ok(ip && pointStrictlyInside(ip, u), 'interiorPoint обязана быть внутри');
  // вложенность вогнутых теперь распознаётся
  const outer = [[-1, -1], [11, -1], [11, 11], [8.5, 11], [8.5, 2.5], [1.5, 2.5], [1.5, 11], [-1, 11]];
  assert.equal(polyContainsPoly(outer, u), true);
  assert.equal(roomsOverlap(outer, u), false);
  // дубликат по-прежнему НЕ вложенность
  assert.equal(polyContainsPoly(u, u), false);
});

test('segKey: one wall, one key at any precision (audit G3)', () => {
  assert.equal(segKey([1.000001, 1], [1.000002, 2]), segKey([1.000002, 1], [1.000001, 2]));
  assert.equal(segKey([0, 0], [1, 1], 3), segKey([1, 1], [0, 0], 3));
  // разные стены — разные ключи
  assert.notEqual(segKey([0, 0], [1, 1]), segKey([0, 0], [2, 2]));
});

test('chunk / referencedContentUrls: signing batches and cache pruning (review R2-2)', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 200), []);
  assert.equal(chunk(new Array(201).fill(0), MAX_SIGN_PATHS).length, 2);
  assert.deepEqual(chunk([1, 2, 3], 0), [[1], [2], [3]]); // never an infinite loop

  const cfg = {
    spaces: [
      { id: 'f1', plan_url: '/houseplan_files/plans/f1.svg' },   // legacy, rewritten on read
      { id: 'f2', plan_url: '/api/houseplan/content/plans/_/f2.abc.png' },
      { id: 'f3', plan_url: null },
      { id: 'f4', plan_url: '/local/not-ours.png' },             // not our endpoint
    ],
    markers: [
      { id: 'm1', pdfs: [{ url: '/houseplan_files/files/m1/manual.pdf' }, { url: '' }] },
      { id: 'm2' },
    ],
  };
  assert.deepEqual([...referencedContentUrls(cfg)].sort(), [
    '/api/houseplan/content/files/m1/manual.pdf',
    '/api/houseplan/content/plans/_/f1.svg',
    '/api/houseplan/content/plans/_/f2.abc.png',
  ]);
  assert.equal(referencedContentUrls(null).size, 0);
  assert.equal(referencedContentUrls({}).size, 0);
});


test('poleOfInaccessibility: the VISUAL centre, not just any interior point', () => {
  // a square: the pole is the centre
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const p = poleOfInaccessibility(sq);
  assert.ok(Math.abs(p[0] - 5) < 0.6 && Math.abs(p[1] - 5) < 0.6);

  // an ELONGATED rectangle: clearance is a plateau along the midline, and a
  // plain argmax used to take its first point — left of centre on the
  // owner's kitchen, above centre in the sauna. The centroid pull centres it.
  const wide = [[0, 0], [30, 0], [30, 10], [0, 10]];
  const w = poleOfInaccessibility(wide);
  assert.ok(Math.abs(w[0] - 15) < 1.2 && Math.abs(w[1] - 5) < 1.2, 'centred both axes: ' + w);
  const tall = [[0, 0], [8, 0], [8, 28], [0, 28]];
  const tl = poleOfInaccessibility(tall);
  assert.ok(Math.abs(tl[0] - 4) < 1 && Math.abs(tl[1] - 14) < 1.2, 'sauna case, centred vertically: ' + tl);

  // the owner's kitchen-living room shape: a THICK top slab with a narrower
  // column hanging off the right side. The button belongs near the middle of
  // the slab — pulled toward the area centroid, never down the thin column.
  const L = [[0, 0], [20, 0], [20, 16], [16, 16], [16, 8], [0, 8]];
  const q = poleOfInaccessibility(L);
  assert.ok(pointInPolygon(q, L), 'inside, always');
  assert.ok(q[1] < 8, 'in the thick slab (y < 8), not down the column: ' + q);
  assert.ok(Math.abs(q[0] - 11.3) < 2.5, 'near the centroid x within the slab: ' + q);
});


test('tap action run: explicit-only, with runnable targets (owner spec 2026-07-29)', () => {
  // 'run' resolves only as an explicit per-marker action
  assert.equal(resolveTapAction('run', undefined, 'switch'), 'run');
  assert.equal(resolveTapAction(null, 'run', 'switch'), 'info', 'never a card-wide default');
  // runnable domains map to their services; anything else is not runnable
  assert.deepEqual(runServiceFor('automation.morning'), { domain: 'automation', service: 'trigger' });
  assert.deepEqual(runServiceFor('script.curtains'), { domain: 'script', service: 'turn_on' });
  assert.deepEqual(runServiceFor('scene.movie'), { domain: 'scene', service: 'turn_on' });
  assert.equal(runServiceFor('light.lamp'), null);
  assert.equal(runServiceFor(''), null);
  // covers and valves joined the card-wide toggle domains
  assert.ok(TOGGLE_SAFE_DOMAINS.has('cover') && TOGGLE_SAFE_DOMAINS.has('valve'));
  assert.equal(resolveTapAction(null, 'toggle', 'cover', 'shutter'), 'toggle');
  // locks and alarms stay forbidden, run or not
  assert.equal(resolveTapAction('toggle', undefined, 'lock'), 'info');
});


test('paperRoomShapes: paper follows room contours, one shape per room (owner 2026-08-03)', () => {
  const L = [[100, 100], [600, 100], [600, 350], [350, 350], [350, 600], [100, 600]];
  const rooms = [
    { id: 'L', poly: L },                            // L-shaped: polygon, verbatim
    { id: 'q', x: 650, y: 650, w: 200, h: 100 },     // legacy rect: same rounded rect the room draws
    { id: 'bad' },                                   // no geometry -> no paper
  ];
  const shapes = paperRoomShapes(rooms);
  assert.equal(shapes.length, 2, 'one shape per room WITH geometry');
  // the polygon uses exactly the room's own points string — same coordinates,
  // so the paper can never peek past a wall
  assert.deepEqual(shapes[0], { poly: L.map((p) => p.join(',')).join(' ') });
  // the rect mirrors the room shape incl. its corner rounding rx
  assert.deepEqual(shapes[1], { rect: { x: 650, y: 650, w: 200, h: 100, rx: 100 * 0.03 } });
  // degenerate inputs never throw and produce no paper
  assert.deepEqual(paperRoomShapes([]), []);
  assert.deepEqual(paperRoomShapes(null), []);
  assert.deepEqual(paperRoomShapes([{ poly: [[0, 0], [1, 1]] }]), [], 'a 2-point poly is not a surface');
});

// ---------------- opening drag: shoulder rulers + "centered on the wall" ----------------
// (owner 2026-08-03) render units; demo-like geometry ×1000
test('openingShoulders: distances from the opening edges to the wall ends', () => {
  const rooms = [{ id: 'r1', poly: [[40, 140], [550, 140], [550, 580], [40, 580]] }];
  // 80-long opening centered at x=200 on the top wall (40..550)
  const sh = openingShoulders([200, 140], 0, 80, rooms, 2);
  assert.ok(sh);
  assert.deepEqual(sh.wallA, [40, 140]);
  assert.deepEqual(sh.wallB, [550, 140]);
  assert.equal(sh.sideA, 120, 'left: 160 - 40');
  assert.equal(sh.sideB, 310, 'right: 550 - 240');
  // badges sit on the middle of each shoulder
  assert.deepEqual(sh.midA, [100, 140]);
  assert.deepEqual(sh.midB, [395, 140]);
  assert.deepEqual(sh.wallCenter, [295, 140]);
  assert.equal(sh.centered, false);
  // at the wall end one shoulder collapses to zero, never negative
  const end = openingShoulders([80, 140], 0, 80, rooms, 2);
  assert.equal(end.sideA, 0);
  assert.equal(end.sideB, 430);
  // off every wall -> null
  assert.equal(openingShoulders([300, 300], 0, 80, rooms, 2), null);
});

test('openingShoulders: centered flag obeys the tolerance', () => {
  const rooms = [{ id: 'r1', poly: [[40, 140], [550, 140], [550, 580], [40, 580]] }];
  const mid = openingShoulders([295, 140], 0, 80, rooms, 2);
  assert.equal(mid.centered, true);
  assert.equal(mid.sideA, mid.sideB);
  assert.equal(mid.sideA, 215, '(510 - 80) / 2');
  assert.equal(openingShoulders([296.5, 140], 0, 80, rooms, 2).centered, true, 'inside tol');
  assert.equal(openingShoulders([298, 140], 0, 80, rooms, 2).centered, false, 'outside tol');
});

test('openingShoulders: only the OWN room edge counts, no merging with a neighbour', () => {
  // two rooms side by side: the top edges 40..550 (r1) and 550..960 (r2) are
  // collinear and touch at x=550, but they belong to DIFFERENT rooms — the
  // ruler measures ONLY the edge the opening sits on (owner 2026-08-03:
  // «only the wall of one room»)
  const rooms = [
    { id: 'r1', poly: [[40, 140], [550, 140], [550, 580], [40, 580]] },
    { id: 'r2', poly: [[550, 140], [960, 140], [960, 580], [550, 580]] },
  ];
  const sh = openingShoulders([200, 140], 0, 80, rooms, 2);
  assert.deepEqual(sh.wallA, [40, 140]);
  assert.deepEqual(sh.wallB, [550, 140], 'stops at the own corner, never runs into r2');
  assert.equal(sh.sideB, 550 - 240);
  // the middle of r1's OWN edge: (40+550)/2 = 295
  assert.equal(openingShoulders([295, 140], 0, 80, rooms, 2).centered, true,
    'centered on the own edge');
  assert.equal(openingShoulders([500, 140], 0, 80, rooms, 2).centered, false,
    'the center of the old merged run means nothing now');
  // an opening on r2's fragment measures r2's edge
  const far = openingShoulders([700, 140], 0, 80, rooms, 2);
  assert.deepEqual(far.wallA, [550, 140]);
  assert.deepEqual(far.wallB, [960, 140]);
  assert.equal(openingShoulders([755, 140], 0, 80, rooms, 2).centered, true);
  // the interior shared wall x=550 is ONE deduped edge shared by both rooms
  const v = openingShoulders([550, 300], 90, 80, rooms, 2);
  assert.deepEqual(v.wallA, [550, 140]);
  assert.deepEqual(v.wallB, [550, 580]);
  assert.equal(v.centered, false);
  assert.equal(openingShoulders([550, 360], 90, 80, rooms, 2).centered, true);
});

test('openingShoulders: shared wall of two rooms uses the snapped room edge', () => {
  // staggered fragments on the shared line x=550: r1's right edge 140..400,
  // r2's left edge 300..580. The snap tie-break (nearest edge, first in
  // roomEdges order on a tie — exactly what snapToWall picks during the
  // drag) resolves to r1's edge, so shoulders and center come from 140..400,
  // never from the merged 140..580 union
  const rooms = [
    { id: 'r1', poly: [[40, 140], [550, 140], [550, 400], [40, 400]] },
    { id: 'r2', poly: [[550, 300], [960, 300], [960, 580], [550, 580]] },
  ];
  const sh = openingShoulders([550, 350], 90, 80, rooms, 2);
  assert.deepEqual(sh.wallA, [550, 140]);
  assert.deepEqual(sh.wallB, [550, 400], "r1's own end, not r2's 580");
  assert.equal(sh.sideA, 310 - 140);
  assert.equal(sh.sideB, 400 - 390);
  assert.deepEqual(sh.wallCenter, [550, 270]);
  assert.equal(sh.centered, false);
  // below r1's edge the same line belongs to r2 alone
  const low = openingShoulders([550, 500], 90, 80, rooms, 2);
  assert.deepEqual(low.wallA, [550, 300]);
  assert.deepEqual(low.wallB, [550, 580]);
  assert.equal(openingShoulders([550, 440], 90, 80, rooms, 2).centered, true,
    'centered on r2 own edge (300+580)/2');
});

test('openingShoulders: angled wall measures along the wall direction', () => {
  // 3-4-5 triangle: hypotenuse-ish edge (0,0)->(300,400), length 500, angle 53.13°
  const rooms = [{ id: 't', poly: [[0, 0], [300, 400], [0, 400]] }];
  const ang = (Math.atan2(400, 300) * 180) / Math.PI;
  const mid = openingShoulders([150, 200], ang, 100, rooms, 2);
  assert.ok(mid);
  assert.ok(Math.abs(mid.sideA - 200) < 1e-9 && Math.abs(mid.sideB - 200) < 1e-9);
  assert.equal(mid.centered, true);
  // slide 30 units towards the far end (dir = [0.6, 0.8])
  const off = openingShoulders([150 + 30 * 0.6, 200 + 30 * 0.8], ang, 100, rooms, 2);
  assert.ok(Math.abs(off.sideA - 230) < 1e-9, 'near shoulder grows by 30');
  assert.ok(Math.abs(off.sideB - 170) < 1e-9, 'far shoulder shrinks by 30');
  assert.equal(off.centered, false);
  assert.ok(Math.abs(off.wallCenter[0] - 150) < 1e-9 && Math.abs(off.wallCenter[1] - 200) < 1e-9);
});


// ---------------- live text on a decor label (docs/LIVE-TEXT.md) ------------

const hassLive = {
  states: {
    'sensor.tank': { state: '68', attributes: { unit_of_measurement: '%' } },
    'sensor.plain': { state: '17.4', attributes: {} },
    'climate.hall': { state: 'heat', attributes: { current_temperature: 21.5, unit_of_measurement: '°C', preset_modes: ['home', 'away'] } },
    'sensor.dead': { state: 'unavailable', attributes: { unit_of_measurement: '%' } },
    'sensor.unknown': { state: 'unknown', attributes: {} },
    'sensor.blob': { state: 'ok', attributes: { payload: { a: 1 }, zero: 0, no: false, empty: '' } },
  },
};

test('liveText: no entity = the text is untouched, byte for byte', () => {
  assert.equal(liveText('Кухня', null, hassLive), 'Кухня');
  assert.equal(liveText('Бак {}', {}, hassLive), 'Бак {}');
  assert.equal(liveText('Бак {}', { entity: '  ' }, hassLive), 'Бак {}');
  assert.equal(liveText('', null, hassLive), '');
});

test('liveText: inline variables resolve every state and attribute in the text', () => {
  assert.equal(
    liveText('Бак {sensor.tank}; климат {climate.hall:current_temperature}', null, hassLive),
    'Бак 68 %; климат 21.5',
  );
  assert.equal(
    liveText('{sensor.plain} / {sensor.tank} / {sensor.plain}', null, hassLive),
    '17.4 / 68 % / 17.4',
  );
});

test('liveText: unavailable plan bindings render as a dash without changing the template', () => {
  const available = (eid) => eid !== 'sensor.tank';
  assert.equal(
    liveText('Tank {sensor.tank}; climate {climate.hall:current_temperature}', null, hassLive, available),
    'Tank —; climate 21.5',
  );
  assert.equal(liveText('Tank {}', { entity: 'sensor.tank' }, hassLive, available), 'Tank —');
});

test('liveText: hand-written dotted attributes work; invalid braces stay literal', () => {
  assert.equal(liveText('{climate.hall.current_temperature}', null, hassLive), '21.5');
  assert.equal(liveText('Обычный {текст}', null, hassLive), 'Обычный {текст}');
  assert.equal(liveText('{sensor.nope}', null, hassLive), LIVE_TEXT_DASH);
});

test('liveTextToken writes the canonical editor syntax', () => {
  assert.deepEqual(liveTextReference('climate.hall.current_temperature'), {
    entity: 'climate.hall', attr: 'current_temperature',
  });
  assert.equal(liveTextToken('sensor.tank'), '{sensor.tank}');
  assert.equal(liveTextToken('climate.hall', 'current_temperature'),
    '{climate.hall:current_temperature}');
  assert.equal(liveTextToken('not-an-entity'), '');
});

test('liveText: the placeholder is where the value lands', () => {
  assert.equal(liveText('Бак {}', { entity: 'sensor.tank' }, hassLive), 'Бак 68 %');
  assert.equal(liveText('{} в баке', { entity: 'sensor.tank' }, hassLive), '68 % в баке');
});

test('liveText: no placeholder = the value is appended after a space', () => {
  assert.equal(liveText('Бак', { entity: 'sensor.tank' }, hassLive), 'Бак 68 %');
  assert.equal(liveText('', { entity: 'sensor.tank' }, hassLive), '68 %', 'empty template = the bare value, no leading space');
});

test('liveText: only the FIRST placeholder is replaced — one label, one value', () => {
  assert.equal(liveText('{} и {}', { entity: 'sensor.tank' }, hassLive), '68 % и {}');
});

test('liveText: the placeholder may sit on any line of a multi-line label', () => {
  assert.equal(liveText('Бак\n{}', { entity: 'sensor.tank' }, hassLive), 'Бак\n68 %');
});

test('liveTextValue: unit comes from the entity, an explicit one wins', () => {
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.tank' }), '68 %');
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.tank', unit: 'проц.' }), '68 проц.');
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.tank', unit: '  ' }), '68 %', 'blank = inherit');
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.plain' }), '17.4', 'no unit on the entity, none added');
});

test('liveTextValue: an attribute never inherits the STATE unit', () => {
  assert.equal(liveTextValue(hassLive, { entity: 'climate.hall', attr: 'current_temperature' }), '21.5',
    'the entity °C describes the state, not the attribute');
  assert.equal(liveTextValue(hassLive, { entity: 'climate.hall', attr: 'current_temperature', unit: '°C' }), '21.5 °C');
  assert.equal(liveTextValue(hassLive, { entity: 'climate.hall' }), 'heat °C', 'the state keeps the entity unit');
});

test('liveTextValue: values are shown as HA reports them — no rounding', () => {
  const hass = { states: { 'sensor.x': { state: '17.40000', attributes: { unit_of_measurement: '°C' } } } };
  assert.equal(liveTextValue(hass, { entity: 'sensor.x' }), '17.40000 °C');
});

test('liveTextValue: a dead or missing entity is a dash, and the dash has no unit', () => {
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.dead' }), LIVE_TEXT_DASH);
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.unknown' }), LIVE_TEXT_DASH);
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.nope' }), LIVE_TEXT_DASH);
  assert.equal(liveTextValue({}, { entity: 'sensor.tank' }), LIVE_TEXT_DASH);
  assert.equal(liveText('Бак {}', { entity: 'sensor.dead' }, hassLive), 'Бак —', 'the rest of the template stays');
});

test('liveTextValue: a missing attribute on a live entity is a dash too', () => {
  assert.equal(liveTextValue(hassLive, { entity: 'climate.hall', attr: 'nope' }), LIVE_TEXT_DASH);
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.blob', attr: 'payload' }), LIVE_TEXT_DASH, 'a dict is not a caption');
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.blob', attr: 'empty' }), LIVE_TEXT_DASH);
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.blob', attr: 'zero' }), '0', '0 is a value, not an absence');
  assert.equal(liveTextValue(hassLive, { entity: 'sensor.blob', attr: 'no' }), 'false');
  assert.equal(liveTextValue(hassLive, { entity: 'climate.hall', attr: 'preset_modes' }), 'home, away');
});

test('liveTextValue: a runaway value is clipped, so a caption stays a caption', () => {
  const hass = { states: { 'sensor.big': { state: 'x'.repeat(500), attributes: {} } } };
  const v = liveTextValue(hass, { entity: 'sensor.big' });
  assert.equal(v.length, LIVE_TEXT_VALUE_MAX);
  assert.ok(liveText('Log: {}', { entity: 'sensor.big' }, hass).length <= 'Log: '.length + LIVE_TEXT_VALUE_MAX);
});

test('decorTextScale: legacy size renders exactly as it used to', () => {
  assert.equal(decorTextScale({ size: 's' }), 0.7, '14px against the base 20');
  assert.equal(decorTextScale({ size: 'm' }), 1);
  assert.equal(decorTextScale({ size: 'l' }), 1.5, '30px against the base 20');
  assert.equal(decorTextScale({}), 1, 'a shape with neither is the medium it has always been');
  assert.equal(decorTextScale(null), 1);
});

test('decorTextScale: an explicit scale wins over the legacy size and is bounded', () => {
  assert.equal(decorTextScale({ size: 's', scale: 2 }), 2);
  assert.equal(decorTextScale({ scale: 0 }), 1, '0 is not a scale — fall back');
  assert.equal(decorTextScale({ scale: -3 }), 1);
  assert.equal(decorTextScale({ scale: 'x' }), 1);
  assert.equal(decorTextScale({ scale: 1e9 }), DECOR_TEXT_SCALE_MAX);
  assert.equal(decorTextScale({ scale: 1e-9 }), DECOR_TEXT_SCALE_MIN);
});

test('decorTextLines: explicit newlines only, never an automatic wrap', () => {
  assert.deepEqual(decorTextLines('a\nb'), ['a', 'b']);
  assert.deepEqual(decorTextLines('a\r\nb'), ['a', 'b'], 'CRLF from a pasted text');
  assert.deepEqual(decorTextLines('one'), ['one']);
  assert.deepEqual(decorTextLines(''), ['']);
  assert.deepEqual(decorTextLines('a\n\nb'), ['a', '', 'b'], 'a blank line is a line');
  const long = 'x'.repeat(300);
  assert.deepEqual(decorTextLines(long), [long], '300 chars stay one line — no auto wrap');
});

// ---------------- hassValue: HA formats the value (docs/STYLING-HOOKS.md §6) ----

/** The same states, plus the formatters a modern HA puts on `hass`. */
const hassFmt = {
  states: hassLive.states,
  // display_precision 1 + ru locale + state translations, exactly what HA does
  formatEntityState: (st) => {
    if (st.state === 'heat') return 'Нагрев';
    if (st.state === 'on') return 'Включено';
    const n = Number(st.state);
    if (!Number.isFinite(n)) return st.state;
    const u = st.attributes?.unit_of_measurement;
    const txt = n.toFixed(1).replace('.', ',');
    return u ? `${txt} ${u}` : txt;
  },
  formatEntityAttributeValue: (st, attr) => {
    const v = st.attributes?.[attr];
    return typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  },
};

test('hassValue: with a formatter the value is HOME ASSISTANT\'s, unit included', () => {
  const v = hassValue(hassFmt, 'sensor.tank');
  assert.deepEqual(v, { text: '68,0 %', formatted: true },
    'display_precision, the ru separator and the unit all come from HA');
  assert.deepEqual(hassValue(hassFmt, 'climate.hall'), { text: 'Нагрев', formatted: true },
    'a state is translated, not printed raw');
});

test('hassValue: without a formatter it is the raw state — an older HA still works', () => {
  assert.deepEqual(hassValue(hassLive, 'sensor.tank'), { text: '68', formatted: false },
    'no unit here: `formatted:false` tells the caller the unit is still its own job');
  assert.deepEqual(hassValue(hassLive, 'climate.hall'), { text: 'heat', formatted: false });
  assert.deepEqual(hassValue({ states: hassLive.states, formatEntityState: 'nope' }, 'sensor.plain'),
    { text: '17.4', formatted: false }, 'a non-function is not a formatter');
  assert.deepEqual(hassValue({ states: hassLive.states, formatEntityState: () => '' }, 'sensor.plain'),
    { text: '17.4', formatted: false }, 'an empty string is not a value');
  assert.deepEqual(hassValue({ states: hassLive.states, formatEntityState: () => { throw new Error('x'); } }, 'sensor.plain'),
    { text: '17.4', formatted: false }, 'a formatter that throws is a formatter we do not have');
});

test('hassValue: an ATTRIBUTE goes through the attribute formatter, not the state one', () => {
  assert.deepEqual(hassValue(hassFmt, 'climate.hall', 'current_temperature'),
    { text: '21,5', formatted: true });
  assert.deepEqual(hassValue(hassLive, 'climate.hall', 'current_temperature'),
    { text: '21.5', formatted: false }, 'no attribute formatter = the raw attribute');
  assert.deepEqual(hassValue({ states: hassLive.states, formatEntityState: hassFmt.formatEntityState },
    'climate.hall', 'current_temperature'),
    { text: '21.5', formatted: false },
    'formatEntityState must NEVER be used on an attribute — it would print «Нагрев»');
  assert.deepEqual(hassValue(hassFmt, 'climate.hall', 'preset_modes'),
    { text: 'home,away', formatted: true }, 'the attribute formatter owns lists too');
});

test('hassValue: nothing to print returns null, never a placeholder string', () => {
  assert.equal(hassValue(hassFmt, ''), null);
  assert.equal(hassValue(hassFmt, null), null);
  assert.equal(hassValue(hassFmt, 'sensor.nope'), null, 'the entity is not in this HA');
  assert.equal(hassValue(undefined, 'sensor.tank'), null, 'no hass at all');
  assert.equal(hassValue(hassFmt, 'sensor.blob', 'nosuch'), null, 'the attribute is not on it');
  assert.equal(hassValue(hassFmt, 'sensor.blob', 'payload'), null, 'a dict is not a caption');
  assert.equal(hassValue(hassFmt, 'sensor.blob', 'empty'), null, 'an empty string is nothing to show');
  assert.deepEqual(hassValue(hassLive, 'sensor.blob', 'zero'), { text: '0', formatted: false },
    '0 is a value, not an absence');
  assert.deepEqual(hassValue(hassLive, 'sensor.blob', 'no'), { text: 'false', formatted: false });
});

test('liveTextValue: the formatter\'s unit is not doubled, an explicit one replaces it', () => {
  assert.equal(liveTextValue(hassFmt, { entity: 'sensor.tank' }), '68,0 %',
    'the unit is already in the formatted text — we do not add a second one');
  assert.equal(liveTextValue(hassFmt, { entity: 'sensor.tank', unit: 'проц.' }), '68,0 проц.',
    'the entity unit comes off, the user unit goes on');
  assert.equal(liveTextValue(hassFmt, { entity: 'sensor.plain' }), '17,4',
    'no unit on the entity, none invented');
  assert.equal(liveTextValue(hassFmt, { entity: 'sensor.plain', unit: 'кВт' }), '17,4 кВт');
  assert.equal(liveTextValue(hassFmt, { entity: 'climate.hall', attr: 'current_temperature' }), '21,5',
    'an attribute never inherits the entity unit — «21,5 °C» would be a lie about a °C sensor');
  assert.equal(liveTextValue(hassFmt, { entity: 'climate.hall', attr: 'current_temperature', unit: '°C' }), '21,5 °C');
  assert.equal(liveTextValue(hassFmt, { entity: 'sensor.dead' }), '—', 'a dead sensor still shows the dash');
  assert.equal(liveTextValue(hassFmt, { entity: 'sensor.unknown' }), '—');
  assert.equal(liveTextValue(hassFmt, { entity: 'sensor.nope' }), '—');
});

test('liveTextValue: a state is translated by HA — «on» is not what the user reads', () => {
  const h = { states: { 'switch.pump': { state: 'on', attributes: {} } }, formatEntityState: hassFmt.formatEntityState };
  assert.equal(liveText('Насос: {}', { entity: 'switch.pump' }, h), 'Насос: Включено');
  assert.equal(liveText('Насос: {}', { entity: 'switch.pump' },
    { states: h.states }), 'Насос: on', 'without a formatter — the raw state, as before');
});

test('valueWithUnit: the unit lands exactly once, whoever put it there', () => {
  const F = (text) => ({ text, formatted: true });
  const R = (text) => ({ text, formatted: false });
  assert.equal(valueWithUnit(F('68,4 %'), '%'), '68,4 %', 'HA already appended it — not twice');
  assert.equal(valueWithUnit(F('68,4'), '%'), '68,4 %', 'a formatter that omits the unit does not lose it');
  assert.equal(valueWithUnit(R('68'), '%'), '68 %', 'no formatter at all — we append as before');
  assert.equal(valueWithUnit(F('68,4 %'), '%', 'проц.'), '68,4 проц.', 'the user unit replaces the entity one');
  assert.equal(valueWithUnit(R('68'), '%', 'проц.'), '68 проц.');
  assert.equal(valueWithUnit(F('Включено'), ''), 'Включено', 'a translated state grows no suffix');
  assert.equal(valueWithUnit(F('21,5'), '', '°C'), '21,5 °C', 'an attribute takes only an explicit unit');
  assert.equal(valueWithUnit(F('17,4'), '   '), '17,4', 'a blank unit is no unit');
});

test('liveTextValue: a formatter that omits the unit still gets one (the demo stub does)', () => {
  const h = { states: hassLive.states, formatEntityState: (st) => st.state };
  assert.equal(liveTextValue(h, { entity: 'sensor.tank' }), '68 %',
    'formatEntityState returning a bare state must not cost the label its unit');
});
