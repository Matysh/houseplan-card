import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lqiColor, snapToGrid, segKey, samePoint, pointInPolygon, markerIdForBinding, averageLqi,
  fitView, declump, safeUrl, resolveTapAction, floorsOf, subst, spaceDisplayOf, roomFillColor,
  splitRoomPath, polyContainsPoly, islandsOf,
  kelvinToRgb, glowColorOf, doorSector, hasRoomBehind,
  controlsAction, isControllable,
  sharedBoundary, openZoneOf, distToSegment,
  outlineWithout,
  alignGuides, segmentAngle, is45,
  swipeTarget, clampScale,
  segmentCm, formatLength, roomEdges, roomPoly, pointOnBoundary, pointStrictlyInside, roomsOverlap,
  mergeRooms, splitRoom, polygonArea, closestPointOnBoundary, isActiveState, snapToWall, openingAmount, fillColorsOf, lerpColor, roomFillStyle, stateIcon, lightColorOf, isAlarmState, parseRoomRef, diffNewDevices,
} from '../test-build/logic.js';
import {
  iconFor, compileIconRules, isValidPattern, iconFromDeviceClasses,
} from '../test-build/rules.js';

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
  assert.equal(resolveTapAction(null, 'toggle', 'cover'), 'info');   // garage stays shut
  assert.equal(resolveTapAction(null, 'toggle', 'valve'), 'info');
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
  const noPlan = spaceDisplayOf({ plan_url: null });
  assert.equal(noPlan.showBorders, true);
  assert.equal(noPlan.showNames, true);
  const s = spaceDisplayOf({ plan_url: null, settings: { show_borders: false, room_color: '#ff0000', room_opacity: 2, fill_mode: 'lqi' } });
  assert.equal(s.showBorders, false);
  assert.equal(s.color, '#ff0000');
  assert.equal(s.opacity, 1);
  assert.equal(s.fill, 'lqi');
  const g = spaceDisplayOf({ settings: { room_color: 'javascript:alert(1)', fill_mode: 'weird' } });
  assert.equal(g.color, '#3ea6ff');
  assert.equal(g.fill, 'none');
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

test('openingAmount: doors default open, windows closed; outages freeze the default', () => {
  assert.equal(openingAmount('door', null), 1);
  assert.equal(openingAmount('window', null), 0);
  assert.equal(openingAmount('door', 'unavailable'), 1);
  assert.equal(openingAmount('window', 'unknown'), 0);
  assert.equal(openingAmount('door', 'on'), 1);
  assert.equal(openingAmount('door', 'off'), 0);
  assert.equal(openingAmount('window', 'open'), 1);
  // invert flips on/off but never the outage default
  assert.equal(openingAmount('door', 'on', true), 0);
  assert.equal(openingAmount('door', 'off', true), 1);
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
  const o = fillColorsOf({ fill_colors: { light_on: { c: '#ff0000', a: 0.5 }, temp_hot: { c: 'javascript:x', a: 9 } } });
  assert.equal(o.light_on.c, '#ff0000');
  assert.equal(o.light_on.a, 0.5);
  assert.equal(o.temp_hot.c, '#ffd45c'); // malformed hex → default
  assert.equal(o.temp_hot.a, 1);         // clamped
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

test('lightColorOf: rgb of an on light; off/unavailable/no-color → null', () => {
  assert.equal(lightColorOf({ state: 'on', attributes: { rgb_color: [255, 20, 40] } }), 'rgb(255, 20, 40)');
  assert.equal(lightColorOf({ state: 'off', attributes: { rgb_color: [255, 20, 40] } }), null);
  assert.equal(lightColorOf({ state: 'on', attributes: {} }), null);
  assert.equal(lightColorOf({ state: 'unavailable', attributes: { rgb_color: [1, 2, 3] } }), null);
  assert.equal(lightColorOf(undefined), null);
});

test('isAlarmState: leak/smoke/gas/siren fire; doors and outages do not', () => {
  assert.ok(isAlarmState('binary_sensor', 'moisture', 'on'));
  assert.ok(isAlarmState('binary_sensor', 'smoke', 'on'));
  assert.ok(isAlarmState('siren', undefined, 'on'));
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
