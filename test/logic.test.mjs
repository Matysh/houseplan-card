import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lqiColor, snapToGrid, segKey, samePoint, pointInPolygon, markerIdForBinding, averageLqi,
  fitView, declump, safeUrl, resolveTapAction, floorsOf, subst, spaceDisplayOf, roomFillColor,
  segmentCm, formatLength, roomEdges, roomPoly, pointOnBoundary, pointStrictlyInside, roomsOverlap,
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

test('tap action: defaults to info', () => {
  assert.equal(resolveTapAction(undefined, undefined, 'light'), 'info');
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

test('roomsOverlap: nested, identical and enclosing outlines all count as overlap', () => {
  assert.ok(roomsOverlap(SQ, [[0.5, 0.5], [1.5, 0.5], [1.5, 1.5], [0.5, 1.5]])); // nested
  assert.ok(roomsOverlap(SQ, SQ));                                                // duplicate
  // drawn AROUND an existing room: every vertex outside, no vertex of ours inside it
  assert.ok(roomsOverlap([[-1, -1], [3, -1], [3, 3], [-1, 3]], SQ));
  // a cross: no vertex of either lies inside the other, but the edges cross
  assert.ok(roomsOverlap([[0, 0.5], [3, 0.5], [3, 1.5], [0, 1.5]],
                         [[0.5, -1], [1.5, -1], [1.5, 3], [0.5, 3]]));
});

test('roomPoly: polygon rooms as-is, legacy rect rooms as four corners', () => {
  assert.equal(roomPoly({ poly: SQ }), SQ);
  assert.deepEqual(roomPoly({ x: 0, y: 0, w: 2, h: 2 }), SQ);
  assert.equal(roomPoly({}), null);
});
