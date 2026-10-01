import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { optimizePlans } from '../test-build/plan-optimizer.js';
import {
  cachedStairMarkup,
  cachedStairRenderGeometry,
  floorAreaMinusStairs,
  geometryAreaMinusStairs,
  geometryMinusStairsSteps,
  isStair,
  stairFootprintGeometry,
  stairFootprintsTouching,
  stairIntervalCount,
  stairRenderGeometry,
  STAIR_STROKE_CM,
  stairStrokePrintMm,
  stairStrokeUnits,
  stairStyleVars,
  stairTreadPath,
  stairVisualFields,
  stairVisualStyle,
} from '../test-build/stairs.js';
import { geometryArea } from '../test-build/physical-geometry.js';
import { difference } from 'polyclip-ts';
import {
  convertStairKind,
  defaultStair,
  snapStairToStairs,
  stairPhysicalSizeCm,
  stairTargetState,
} from '../test-build/stairs-editor-model.js';
import { StairViewRuntime } from '../test-build/stairs-view.js';

const straight = (extra = {}) => ({
  id: 'straight', kind: 'straight', x: 0.5, y: 0.5, angle: 0,
  direction: 'forward', length: 0.24, width: 0.1,
  target_space_id: 'upper', ...extra,
});

const spiral = (extra = {}) => ({
  id: 'spiral', kind: 'spiral', x: 0.5, y: 0.5, angle: 0,
  direction: 'clockwise', radius: 0.1,
  target_space_id: 'upper', ...extra,
});

test('#688 all stair linework shares one physical 3.6 cm contract', () => {
  assert.equal(STAIR_STROKE_CM, 3.6);
  assert.equal(stairStrokeUnits(5), 3, '3.6 cm is 3 plan units on the reference grid');
  assert.ok(Math.abs(stairStrokeUnits(1) - 15) < 1e-12,
    'a finer grid needs more plan units for the same 3.6 cm');
  assert.ok(Math.abs(stairStrokeUnits(5, 10) - 7.2) < 1e-12,
    'custom grid pitch keeps the physical conversion');
  assert.equal(stairStrokeUnits(NaN), 3, 'invalid transient layout uses the finite reference fallback');
  assert.equal(stairStrokePrintMm(50), 0.72);
  assert.equal(stairStrokePrintMm(100), 0.36);

  const vars = stairStyleVars(
    straight(), 5, 1000 / 240, { color: '#112233', opacity: 0.6 },
  );
  assert.match(vars, /--hp-stair-stroke:3(?:;|$)/);
  assert.match(vars, /--hp-stair-line:#112233/);
  assert.equal(Object.hasOwn(straight(), 'width_cm'), false,
    'the fixed physical weight never becomes persisted stair data');
});

test('#688 base stair CSS uses the physical variable while UI accents remain screen-space', () => {
  const styles = readFileSync(new URL('../src/styles/plan.styles.ts', import.meta.url), 'utf8');
  const block = styles.slice(styles.indexOf('.hp-stair-outline'), styles.indexOf('.alignmsg'));
  assert.match(block, /stroke-width: var\(--hp-stair-stroke, 3\)/);
  assert.doesNotMatch(block, /calc\((?:2|2\.5)px \/ var\(--hp-plan-screen-scale/);
  assert.doesNotMatch(block, /\.hp-stair-arrow\s*\{\s*stroke-width/,
    'the arrow has no independent line weight');
  assert.match(block, /\.hp-stair\.selected \.hp-stair-outline[\s\S]*vector-effect: non-scaling-stroke/,
    'selection remains a separate screen-space affordance');
});

test('#663 validates the discriminated stair model and preserves future fields', () => {
  assert.equal(isStair({ ...straight(), future: { keep: true } }), true);
  assert.equal(isStair({ ...straight(), direction: 'clockwise' }), false);
  assert.equal(isStair({ ...straight(), width: 0 }), false);
  assert.equal(isStair({ ...spiral(), direction: 'backward' }), false);
  assert.equal(isStair({ ...spiral(), radius: Number.NaN }), false);
  assert.equal(isStair({ ...spiral(), radius: 5001 }), false);
  assert.equal(isStair({ ...straight(), angle: 361 }), false);
});

test('#663 default physical sizes and type conversion are predictable', () => {
  const first = defaultStair('straight', 500, 400, 5, 'a', {
    color: '#123456', opacity: 0.75, fillColor: '#abcdef', fillOpacity: 0.2,
  });
  assert.equal(first.kind, 'straight');
  assert.deepEqual(stairPhysicalSizeCm(first, 5).map(Math.round), [240, 100]);
  first.target_space_id = 'upper';
  const round = convertStairKind(first, 'spiral');
  assert.equal(round.kind, 'spiral');
  assert.equal(Math.round(stairPhysicalSizeCm(round, 5)[0]), 120);
  const restored = convertStairKind(round, 'straight');
  assert.equal(restored.kind, 'straight');
  assert.deepEqual(stairPhysicalSizeCm(restored, 5).map(Math.round), [240, 240]);
  assert.equal(restored.target_space_id, 'upper');
  assert.deepEqual(
    { color: restored.color, opacity: restored.opacity,
      fill_color: restored.fill_color, fill_opacity: restored.fill_opacity },
    { color: '#123456', opacity: 0.75, fill_color: '#abcdef', fill_opacity: 0.2 },
    'kind conversion preserves the independent visual style',
  );
});

test('#683 legacy stairs resolve style without mutation and new fields stay optional', () => {
  const legacy = straight();
  const before = structuredClone(legacy);
  assert.deepEqual(stairVisualStyle(legacy, { color: '#112233', opacity: 0.6 }), {
    color: '#112233', opacity: 0.6, fillColor: '#112233', fillOpacity: 0,
  });
  assert.deepEqual(legacy, before, 'render fallback never materializes fields');
  assert.deepEqual(stairVisualStyle({
    ...legacy, color: 'red', opacity: 3, fill_color: '#aabbcc', fill_opacity: -1,
  }, { color: '#112233', opacity: 0.6 }), {
    color: '#112233', opacity: 1, fillColor: '#aabbcc', fillOpacity: 0,
  });
  assert.equal(isStair({ ...legacy, color: '#abcdef', opacity: 0.4 }), true);
  assert.deepEqual(stairVisualFields({
    color: '#123456', opacity: 0.7, fillColor: '#abcdef', fillOpacity: 0.25,
  }), {
    color: '#123456', opacity: 0.7, fill_color: '#abcdef', fill_opacity: 0.25,
  }, 'an explicit Save can materialize the complete visual quartet');
});

test('#683 active target cursor is pointer-only', () => {
  const styles = readFileSync(new URL('../src/styles/plan.styles.ts', import.meta.url), 'utf8');
  assert.match(styles, /\.hp-stair\.navigable \{ cursor: pointer; \}/,
    'only the active-link class advertises navigation');
  assert.doesNotMatch(styles, /\.hp-stair(?:\.input-enabled)? \{ cursor: pointer; \}/,
    'ordinary and broken stairs stay visually inert');
});

test('#683 interval count minimizes distance from 30 cm and resolves ties upward', () => {
  assert.equal(stairIntervalCount(288), 10);
  assert.equal(stairIntervalCount(40), 2, '20 cm and 40 cm are tied; more intervals win');
  assert.equal(stairIntervalCount(0), 1);
});

test('#683 straight stair divides the trapezoid into equal near-30 cm intervals', () => {
  const geometry = stairRenderGeometry(straight(), 5);
  assert.equal(geometry.treads.length, 9);
  assert.equal(geometry.trapezoid.length, 3, 'the shared 100% base is not drawn twice');
  for (let index = 1; index < geometry.treads.length; index++) {
    assert.equal(geometry.treads[index].a[0] - geometry.treads[index - 1].a[0], 24);
  }
  assert.equal(geometry.treads[0].a[0], 404);
  assert.equal(geometry.treads.at(-1).a[0], 596);
  assert.deepEqual(
    geometry.treads.map((line) => line.b[1] - line.a[1]),
    [82, 84, 86, 88, 90, 92, 94, 96, 98],
    'treads stop at the sloped trapezoid sides',
  );
  const zoomed = stairRenderGeometry(straight(), 5, 500);
  assert.equal(zoomed.treads.length, geometry.treads.length,
    'zoom changes only pixels, never the physical tread count');
  assert.equal(zoomed.treads[1].a[0] - zoomed.treads[0].a[0], 12,
    'the same equal interval scales with the symbol, not with viewport zoom');

  const backward = stairRenderGeometry(straight({ direction: 'backward' }), 5);
  assert.equal(backward.treads.length, geometry.treads.length);
  for (let index = 1; index < backward.treads.length; index++) {
    assert.equal(backward.treads[index].a[0] - backward.treads[index - 1].a[0], 24);
  }
  assert.deepEqual(
    backward.treads.map((line) => line.b[1] - line.a[1]),
    [98, 96, 94, 92, 90, 88, 86, 84, 82],
    'Down flips only the trapezoid taper',
  );
  assert.equal(backward.arrowPath, geometry.arrowPath,
    'direction never flips the canonical arrow');
});

test('#683 spiral stair divides the full turn into equal near-30 cm sectors', () => {
  const geometry = stairRenderGeometry(spiral({ angle: 30 }), 5);
  assert.equal(geometry.treads.length, 17);
  assert.deepEqual(geometry.trapezoid, []);
  const center = geometry.center;
  const angles = geometry.treads.map((line) => Math.atan2(
    line.b[1] - center[1], line.b[0] - center[0],
  ));
  const unwrapped = angles.reduce((result, angle) => {
    let value = angle;
    while (result.length && value <= result.at(-1)) value += Math.PI * 2;
    result.push(value);
    return result;
  }, []);
  const expected = Math.PI * 2 / 17;
  for (let index = 1; index < unwrapped.length; index++) {
    assert.ok(Math.abs((unwrapped[index] - unwrapped[index - 1]) - expected) < 1e-10);
  }
  const reverse = stairRenderGeometry(spiral({ direction: 'counterclockwise' }), 5);
  assert.ok(reverse.treads[1].b[1] < reverse.treads[0].b[1]);
});

test('#663 cached render geometry survives live repaints and invalidates only on geometry', () => {
  const item = straight();
  const first = cachedStairRenderGeometry(item, 5);
  const second = cachedStairRenderGeometry(item, 5);
  assert.equal(second, first, 'unchanged stair reuses the dense render geometry');
  item.color = '#123456';
  item.opacity = 0.4;
  item.fill_color = '#abcdef';
  item.fill_opacity = 0.25;
  assert.equal(cachedStairRenderGeometry(item, 5), first,
    'visual-only edits do not invalidate the geometry cache');
  item.angle = 45;
  const changed = cachedStairRenderGeometry(item, 5);
  assert.notEqual(changed, first, 'in-place edits cannot leave a stale cache entry');
});

test('#740 AC1 all treads of a stair are one path with the separate lines\' numbers', () => {
  const joined = (treads) => treads
    .map((line) => `M ${line.a[0]} ${line.a[1]} L ${line.b[0]} ${line.b[1]}`).join(' ');
  const cases = [
    ['straight forward', straight({ angle: 17 })],
    ['straight backward', straight({ direction: 'backward', angle: -33 })],
    ['spiral clockwise', spiral({ angle: 30 })],
    ['spiral counterclockwise', spiral({ direction: 'counterclockwise' })],
  ];
  for (const [label, stair] of cases) {
    const geometry = stairRenderGeometry(stair, 5);
    assert.ok(geometry.treads.length > 1, `${label}: the fixture has treads`);
    assert.equal(stairTreadPath(geometry.treads), joined(geometry.treads), label);
    const markup = cachedStairMarkup(geometry);
    assert.equal(markup.treads, joined(geometry.treads), `${label}: treads in geometry order`);
    assert.equal(markup.treads.match(/M /g).length, geometry.treads.length,
      `${label}: one subpath per tread`);
    assert.equal(markup.treads.match(/L /g).length, geometry.treads.length, label);
    assert.equal(markup.outline, geometry.outline.map((point) => point.join(',')).join(' '),
      `${label}: the outline points are the polygon's former string`);
  }
  const short = stairRenderGeometry(straight({ length: 35 / 1200 }), 5);
  assert.equal(short.treads.length, 0, 'a straight stair shorter than 40 cm has one interval');
  assert.equal(stairTreadPath(short.treads), '');
  assert.equal(cachedStairMarkup(short).treads, '', 'no treads, no path data');
});

test('#740 AC1 tread and outline strings are built once per geometry object', () => {
  const item = straight();
  const geometry = cachedStairRenderGeometry(item, 5);
  const first = cachedStairMarkup(geometry);
  assert.equal(cachedStairMarkup(geometry), first, 'the same geometry reuses the built strings');
  assert.equal(cachedStairMarkup(cachedStairRenderGeometry(item, 5)), first,
    'a repaint of an unchanged stair reuses them through the geometry cache');
  item.angle = 45;
  const moved = cachedStairMarkup(cachedStairRenderGeometry(item, 5));
  assert.notEqual(moved, first, 'a geometry change builds new strings');
  assert.notEqual(moved.treads, first.treads);
  const copy = stairRenderGeometry(item, 5);
  assert.notEqual(cachedStairMarkup(copy), moved, 'the cache key is the geometry object');
  assert.deepEqual(cachedStairMarkup(copy), moved, 'equal geometry yields equal strings');
});

test('#663 stair magnet covers rectangle/rectangle, rectangle/circle and circle/circle footprints', () => {
  const rect = straight({ id: 'rect', x: 0.5, y: 0.5, length: 0.2, width: 0.1 });
  const circle = spiral({ id: 'circle', x: 0.5, y: 0.5, radius: 0.08 });
  const movingRect = straight({ id: 'moving-rect', length: 0.2, width: 0.1 });
  const movingCircle = spiral({ id: 'moving-circle', radius: 0.08 });

  assert.deepEqual(snapStairToStairs(movingRect, [704, 500], [rect], 10), [700, 500]);
  assert.deepEqual(snapStairToStairs(movingCircle, [686, 500], [rect], 10), [680, 500]);
  assert.deepEqual(snapStairToStairs(movingRect, [686, 500], [circle], 10), [680, 500]);
  assert.deepEqual(snapStairToStairs(movingCircle, [664, 500], [circle], 10), [660, 500]);
  assert.deepEqual(snapStairToStairs(movingCircle, [700, 500], [circle], 10), [700, 500]);
  assert.deepEqual(circle, spiral({ id: 'circle', x: 0.5, y: 0.5, radius: 0.08 }));
});

test('#663 area removes only stair overlap and never becomes negative', () => {
  const floor = [[0, 0], [1000, 0], [1000, 1000], [0, 1000]];
  assert.equal(floorAreaMinusStairs(floor, [straight()]), 976_000);
  assert.equal(floorAreaMinusStairs(floor, [straight({ x: 0.95, length: 0.2, width: 0.2 })]), 970_000);
  const circular = floorAreaMinusStairs(floor, [spiral()]);
  assert.ok(Math.abs(circular - (1_000_000 - Math.PI * 10_000)) < 60,
    '64-segment circle remains physically accurate');
  const source = [[[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]]];
  assert.equal(geometryAreaMinusStairs(source, [straight({ length: 2, width: 2 })]), 0);
});

test('#663 dense stair subtraction yields between bounded polygon batches', () => {
  const source = [[[[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]]];
  const stairs = Array.from({ length: 5 }, (_, index) => straight({
    id: `stair-${index}`, x: 0.15 + index * 0.16, length: 0.1, width: 0.1,
  }));
  const steps = geometryMinusStairsSteps(source, stairs, 1000, 2);
  assert.equal(steps.next().done, false);
  assert.equal(steps.next().done, false);
  assert.equal(steps.next().done, false);
  const finished = steps.next();
  assert.equal(finished.done, true);
  assert.equal(geometryAreaMinusStairs(finished.value, []), 950_000);

  const denseSteps = geometryMinusStairsSteps(source, Array.from({ length: 49 }, (_, index) => (
    straight({ id: `dense-${index}` })
  )));
  let slices = 0;
  let denseStep = denseSteps.next();
  while (!denseStep.done) {
    slices += 1;
    denseStep = denseSteps.next();
  }
  assert.equal(slices, 3, 'the default keeps a 49-stair calculation out of one main-thread task');
});

test('#663 target states distinguish active, missing, self, deleted and fixed', () => {
  const spaces = new Set(['ground', 'upper']);
  assert.equal(stairTargetState(straight(), 'ground', spaces, false), 'active');
  assert.equal(stairTargetState(straight({ target_space_id: null }), 'ground', spaces, false), 'missing');
  assert.equal(stairTargetState(straight({ target_space_id: 'ground' }), 'ground', spaces, false), 'self');
  assert.equal(stairTargetState(straight({ target_space_id: 'gone' }), 'ground', spaces, false), 'deleted');
  assert.equal(stairTargetState(straight(), 'ground', spaces, true), 'fixed');
});

test('#663 Optimize preserves continuous authored stair transforms exactly', () => {
  const authored = straight({
    x: 0.123456789, y: -0.287654321, angle: 17.123456789,
    length: 0.234567891, width: 0.087654319,
  });
  const config = {
    model_version: 10,
    spaces: [{
      id: 'ground', title: 'Ground', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [], wall_segments: [], stairs: [authored],
    }, {
      id: 'upper', title: 'Upper', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [], wall_segments: [],
    }],
    markers: [], settings: {},
  };
  const result = optimizePlans(config, {});
  assert.deepEqual(result.config.spaces[0].stairs[0], authored);
});

test('#663 legacy-no-stairs-config never materializes an empty stair collection', () => {
  const legacy = {
    model_version: 10,
    spaces: [{
      id: 'legacy', title: 'Legacy', cell_cm: 5, view_box: [0, 0, 1, 1],
      rooms: [], wall_segments: [],
    }],
    markers: [], settings: {},
  };
  const before = structuredClone(legacy);
  const result = optimizePlans(legacy, {});
  assert.equal(Object.hasOwn(result.config.spaces[0], 'stairs'), false);
  assert.deepEqual(legacy, before, 'Optimize remains immutable for the caller');
});

// #669 AC2: the bounds filter must not change the subtraction it shortens.
const unfilteredArea = (source, stairs) => {
  const footprints = stairs.map((stair) => stairFootprintGeometry(stair));
  return Math.max(0, geometryArea(footprints.length ? difference(source, ...footprints) : source));
};

test('#669 AC2 stair area with the bounds filter equals the unfiltered subtraction', () => {
  const room = [[[[200, 200], [600, 200], [600, 600], [200, 600], [200, 200]]]];
  const stairs = [
    straight({ id: 'inside', x: 0.3, y: 0.3, length: 0.1, width: 0.05 }),
    straight({ id: 'rotated', x: 0.45, y: 0.45, angle: 45, length: 0.12, width: 0.04 }),
    straight({ id: 'edge', x: 0.6, y: 0.4, angle: 90, length: 0.1, width: 0.05 }),
    straight({ id: 'corner', x: 0.2, y: 0.2, angle: 135, length: 0.08, width: 0.05 }),
    spiral({ id: 'spiral-inside', x: 0.5, y: 0.3, radius: 0.04 }),
    spiral({ id: 'spiral-edge', x: 0.4, y: 0.6, radius: 0.05 }),
    straight({ id: 'overlap-a', x: 0.35, y: 0.5, length: 0.1, width: 0.06 }),
    straight({ id: 'overlap-b', x: 0.36, y: 0.52, angle: 90, length: 0.1, width: 0.06 }),
    straight({ id: 'far-a', x: 0.9, y: 0.9, length: 0.1, width: 0.05 }),
    spiral({ id: 'far-b', x: 0.05, y: 0.9, radius: 0.03 }),
  ];
  const expected = unfilteredArea(room, stairs);
  const actual = geometryAreaMinusStairs(room, stairs);
  assert.ok(Math.abs(actual - expected) <= expected * 1e-9, `${actual} vs ${expected}`);
  assert.ok(actual < 160_000, 'the touching stairs are subtracted');
});

test('#669 AC2 stairs whose bounds miss the room never reach polyclip', () => {
  const room = [[[[200, 200], [600, 200], [600, 600], [200, 600], [200, 200]]]];
  const stairs = [
    straight({ id: 'inside', x: 0.3, y: 0.3, length: 0.1, width: 0.05 }),
    spiral({ id: 'edge', x: 0.4, y: 0.6, radius: 0.05 }),
    straight({ id: 'far-a', x: 0.9, y: 0.9, length: 0.1, width: 0.05 }),
    spiral({ id: 'far-b', x: 0.05, y: 0.9, radius: 0.03 }),
  ];
  const touching = stairFootprintsTouching(room, stairs);
  assert.equal(touching.length, 2, 'only the inside and the edge stair are passed on');
  assert.deepEqual(stairFootprintsTouching([], stairs), [], 'an empty subject touches nothing');
});

test('#669 AC2 a maximum stair collection keeps the room area and passes a bounded subset', () => {
  const stairs = Array.from({ length: 250 }, (_, index) => {
    const common = { id: `grid-${index}`, x: 0.025 + (index % 25) * 0.039, y: 0.03 + Math.floor(index / 25) * 0.1,
      angle: (index % 8) * 45 };
    return index % 2 ? spiral({ ...common, radius: 0.05 }) : straight({ ...common, length: 0.12, width: 0.045 });
  });
  const room = [[[[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]]]];
  const touching = stairFootprintsTouching(room, stairs);
  assert.ok(touching.length > 0 && touching.length < 50, `${touching.length} of 250 touch the room bounds`);
  const expected = unfilteredArea(room, stairs);
  const actual = geometryAreaMinusStairs(room, stairs);
  assert.ok(Math.abs(actual - expected) <= Math.max(expected, 1) * 1e-9, `${actual} vs ${expected}`);
});

// #693: в View над лестницей был курсор `move` — редакторское правило для
// `.hp-stair-hit` задевало и слой View, который ставит `input-enabled` только
// ради попадания. Браузерное доказательство — demo/smoke_stairs.mjs; здесь
// каскад закреплён без Chromium.
test('#693 курсор move над телом лестницы — только в редакторе плана', async () => {
  const { planStyles } = await import('../test-build/styles.js');
  const css = planStyles.cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selectors, body]) => [selectors.trim().split(/\s*,\s*/), body]);
  const cursorOf = (body) => /(?:^|;)\s*cursor\s*:\s*([^;]+)/.exec(body)?.[1].trim() ?? null;
  // Селектор вида «<составной селектор группы> .hp-stair-hit»; иная форма —
  // повод расширить тест, а не молча её пропустить.
  const matchesGroup = (compound, classes) => {
    const parts = compound.match(/:not\(\.[\w-]+\)|\.[\w-]+|[^.:]+|:[\w-]+/g) ?? [];
    return parts.every((part) => {
      if (part.startsWith(':not(.')) return !classes.includes(part.slice(6, -1));
      if (part.startsWith('.')) return classes.includes(part.slice(1));
      throw new Error(`#693: неразобранная часть селектора «${part}» в «${compound}»`);
    });
  };
  const hitCursor = (classes) => rules
    .flatMap(([selectors, body]) => selectors
      .filter((selector) => /\s\.hp-stair-hit$/.test(selector) && cursorOf(body))
      .map((selector) => [selector.replace(/\s+\.hp-stair-hit$/, '').trim(), cursorOf(body)]))
    .filter(([compound]) => {
      assert.ok(!/\s/.test(compound), `#693: предок с потомком в «${compound}» — расширить тест`);
      return matchesGroup(compound, classes);
    })
    .map(([, cursor]) => cursor);
  assert.deepEqual(hitCursor(['hp-stair', 'input-enabled']), ['move'], 'редактор плана тащит лестницу за тело');
  assert.deepEqual(hitCursor(['hp-stair', 'hp-stair-view', 'navigable', 'input-enabled']), [],
    'в View у области попадания своего курсора нет — виден pointer ссылки');
  assert.deepEqual(hitCursor(['hp-stair', 'hp-stair-view', 'input-enabled']), [],
    'лестница без цели в View — курсор сцены, не move');
  assert.ok(rules.some(([selectors, body]) => selectors.includes('.hp-stair.navigable') && cursorOf(body) === 'pointer'),
    'ссылка несёт pointer на группе');
  const view = readFileSync(new URL('../src/stairs-view.ts', import.meta.url), 'utf8');
  assert.match(view, /<g class="hp-stair hp-stair-view /, 'слой View помечает свои лестницы');
});

// #694: a View-layer host whose `_model` getter counts its reads, as the card's
// getter fingerprints the whole config on each one.
const FLOORS = [
  { id: 'ground', title: 'Ground floor' },
  { id: 'upper', title: 'Upper floor' },
  { id: 'attic', title: 'Attic' },
];
const stairViewHost = (stairs, { mode = 'view', fixedFloor = false } = {}) => ({
  reads: 0,
  tips: [],
  get _model() { this.reads += 1; return FLOORS; },
  _mode: mode,
  _curSpaceCfg: { stairs },
  _space: 'ground',
  _hasFixedFloor: fixedFloor,
  _suppressClick: false,
  _cellCm: 5,
  _gridPitch: 1,
  _decorStyle: { color: '#607d8b', opacity: 1 },
  _tabClick() {},
  _t: (key, vars) => (vars ? `${key}:${vars.title}` : key),
  _showTip(event, title, meta) { this.tips.push([title, meta]); },
  _clearPointerHover() {},
});
/** The value bound right after `attribute=` in a lit template. */
const boundValue = (template, attribute) => {
  const index = template.strings.findIndex((part) => part.trimEnd().endsWith(`${attribute}=`));
  assert.ok(index >= 0, `the stair template binds ${attribute}`);
  return template.values[index];
};

test('#694 AC2 the View stair layer reads the card model once per render at any stair count', () => {
  const targets = ['upper', 'attic', 'ground', null, 'gone'];
  const titles = { upper: 'Upper floor', attic: 'Attic' };
  for (const count of [0, 1, 2, 7, 40]) {
    const stairs = Array.from({ length: count }, (_, index) => straight({
      id: `stair-${index}`, x: 0.1 + index * 0.02, target_space_id: targets[index % targets.length],
    }));
    const host = stairViewHost(stairs);
    const layer = new StairViewRuntime(host).renderLayer();
    assert.equal(host.reads, 1, `${count} stairs: one read of _model per render`);
    const items = layer.values[0];
    assert.equal(items.length, count);
    for (const item of items) boundValue(item, '@pointerenter')({});
    assert.deepEqual(host.tips, stairs.flatMap((stair) => (
      titles[stair.target_space_id] ? [[`stairs.tooltip_navigate:${titles[stair.target_space_id]}`, '']] : []
    )), `${count} stairs: each link still names its target floor, the rest name none`);
    assert.deepEqual(items.map((item) => boundValue(item, 'data-target-state')),
      stairs.map((stair) => ({ upper: 'active', attic: 'active', ground: 'self', gone: 'deleted' })[
        stair.target_space_id] ?? 'missing'));
  }
  for (const options of [{ fixedFloor: true }, { mode: 'plan' }]) {
    const host = stairViewHost([straight({ id: 'a' }), straight({ id: 'b', target_space_id: 'attic' })], options);
    const layer = new StairViewRuntime(host).renderLayer();
    for (const item of layer.values[0]) boundValue(item, '@pointerenter')({});
    assert.equal(host.reads, 1, `${JSON.stringify(options)}: one read`);
    assert.deepEqual(host.tips, [], `${JSON.stringify(options)}: no stair is a link, none announces a floor`);
  }
});
