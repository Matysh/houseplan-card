// #649 (2.5D stage 6): the pure parts — wall colours from the user's data,
// light-floor luma, tile edge/shadow numbers from the designer lab, soft window
// light geometry. Browser behaviour is proven by demo/smoke_iso_*.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  colorLuma, compositeFloor, isLightFloor, isoLightFloorRooms, isoWallMaterial, isoWallMaterialVars,
  parseCssColor, parseHexColor,
} from '../test-build/iso-materials.js';
import {
  ISO_ICON_SCALE, ISO_STATE_BODIES, ISO_TILE, isoEdgeColor, isoTileShadow, isoTileStateCss,
} from '../test-build/iso-tiles.js';
import { computeIsoSunBeams, isoSunDepth, ISO_SUN_STOPS_DARK_FLOOR, ISO_SUN_STOPS_LIGHT_FLOOR } from '../test-build/iso-sun.js';
import { volumetricViewOf } from '../test-build/logic.js';

test('#649 п.4 volumetric_view: only an explicit true enables 2.5D', () => {
  assert.equal(volumetricViewOf({ volumetric_view: true }), true);
  for (const s of [undefined, null, {}, { volumetric_view: false }, { volumetric_view: 'true' }, { volumetric_view: 1 }]) {
    assert.equal(volumetricViewOf(s), false, JSON.stringify(s));
  }
});

test('#649 3b walls: top = user colour, sides darker per channel; default white = lab matte', () => {
  assert.deepEqual(isoWallMaterial('#ffffff'), {
    topHi: '#ffffff', topLo: '#ededed', sideHi: '#c4c4c4', sideMid: '#adadad', sideLo: '#999999',
  });
  const user = isoWallMaterial('#d9c8b4');
  assert.equal(user.topHi, '#d9c8b4');
  assert.equal(user.sideLo, '#82786c');
  assert.equal(isoWallMaterial('nonsense').topHi, '#ffffff', 'a malformed colour falls back to white');
  assert.match(isoWallMaterialVars('#d9c8b4'), /^--iso-top-hi:#d9c8b4;--iso-top-lo:#[0-9a-f]{6};--iso-side-hi:/);
  assert.doesNotMatch(isoWallMaterialVars('#d9c8b4'), /dark|theme/);
});

test('#649 light floor: lab luma > 0.55 on the fill composited over the paper', () => {
  assert.deepEqual(parseHexColor('#abc'), [170, 187, 204]);
  assert.deepEqual(parseCssColor('rgb(238, 232, 222)'), [238, 232, 222]);
  assert.equal(isLightFloor([0xee, 0xe8, 0xde]), true, 'lab warm floor');
  assert.equal(isLightFloor([0x73, 0x77, 0x77]), false, 'lab dark floor');
  assert.equal(Math.round(colorLuma([255, 255, 255]) * 100), 100);
  assert.deepEqual(compositeFloor(null, 1, [1, 2, 3]), [1, 2, 3], 'no fill = paper');
  assert.deepEqual(compositeFloor([0, 0, 0], 0.5, [200, 200, 200]), [100, 100, 100]);
  const rooms = isoLightFloorRooms(new Map([
    ['light', null], ['dark', { color: '#0d1b2a', opacity: 0.5 }], ['half', { color: '#486a8f', opacity: 0.42 }],
  ]), [255, 255, 255]);
  assert.deepEqual([...rooms].sort(), ['half', 'light']);
});

test('#649 п.1 tile numbers are the lab units / 80 and the scale 1.12', () => {
  assert.equal(ISO_ICON_SCALE, 1.12);
  assert.deepEqual({ ...ISO_TILE }, {
    depth: 0.1, radius: 0.275, radiusOfHeight: 0.3, lift: 0.075, badgeGap: 0.075,
    shadowInset: 0.0375, frameWidth: 0.0625, frameOutset: 0.075,
  });
});

test('#649 п.1 edge colours: brightness/saturate of the body, dark bodies fixed, light floor lighter', () => {
  assert.equal(isoEdgeColor('#ffffff', 'light', false), '#b3b3b3');
  assert.equal(isoEdgeColor('#ffffff', 'light', true), '#d1d1d1');
  assert.equal(isoEdgeColor('#F0A00C', 'light', false), '#a07119');
  assert.equal(isoEdgeColor('#000000', 'light', false), '#5b5e5a', 'black body (luma < 70)');
  assert.equal(isoEdgeColor('#252525', 'dark', false), '#4a4a4a', 'dark core');
  assert.equal(isoEdgeColor('#252525', 'dark', true), '#4a4a4a', 'the floor does not lighten a dark edge');
  const css = isoTileStateCss();
  for (const [state, body] of Object.entries(ISO_STATE_BODIES)) {
    assert.match(css, new RegExp(`\\.dev\\.${state} \\{ --iso-body: ${body}; [^}]*--iso-edge: ${isoEdgeColor(body, 'light', false)};`));
    assert.match(css, new RegExp(`\\.dev\\.${state}\\.iso-floor-light \\{ --iso-edge: ${isoEdgeColor(body, 'light', true)}; \\}`));
    // CODE-REVIEW-649-r1 L3: the dark theme computes its own state edge.
    assert.match(css, new RegExp(`\\.dev\\.theme-dark\\.${state} \\{ [^}]*--iso-edge: ${isoEdgeColor(body, 'dark', false)}; \\}`));
    assert.match(css, new RegExp(`\\.dev\\.theme-dark\\.${state}\\.iso-floor-light \\{ --iso-edge: ${isoEdgeColor(body, 'dark', true)}; \\}`));
  }
});

test('#649 п.1 shadow table: all four theme × floor combinations (SPEC-REVIEW-649-r1 M1)', () => {
  const row = (t, f) => { const s = isoTileShadow(t, f); return [s.dy * 80, s.sigma * 80, s.opacityWhite, s.opacityTinted]; };
  assert.deepEqual(row('light', false), [30, 22, 0.34, 0.5]);
  assert.deepEqual(row('light', true), [34, 11, 0.3, 0.42]);
  assert.deepEqual(row('dark', false), [30, 22, 0.4, 0.4]);
  assert.deepEqual(row('dark', true), [34, 11, 0.4, 0.4]);
  const css = isoTileStateCss();
  const dark = css.indexOf('.iso-tile-shadow.theme-dark.theme-dark {');
  const floorTinted = css.indexOf('.iso-tile-shadow.iso-floor-light:is(');
  assert.ok(floorTinted > 0 && dark > floorTinted, 'the dark-theme opacity rule comes after the floor rules');
});

test('#649 п.2 light depth: lab length curve in wall heights, low sun = long', () => {
  const H = 84;
  assert.ok(Math.abs(isoSunDepth(90, H) - 408 * 0.55 / 218.8 * H) < 1e-9, 'noon: the lab base × 0.55');
  assert.ok(isoSunDepth(90, 1) >= 215 / 218.8 - 1e-12, 'never below the lab minimum');
  assert.ok(isoSunDepth(10, H) > isoSunDepth(40, H), 'low sun reaches further');
  assert.ok(isoSunDepth(0, H) <= 910 / 218.8 * H + 1e-9);
  const e = 30;
  const lab = Math.min(910, Math.max(215, 408 * (0.55 + 1.4 * Math.pow(1 - e / 90, 1.6))));
  assert.ok(Math.abs(isoSunDepth(e, H) - lab / 218.8 * H) < 1e-9);
  assert.equal(ISO_SUN_STOPS_DARK_FLOOR[0][1], '#ffe9b4');
  assert.equal(ISO_SUN_STOPS_LIGHT_FLOOR[0][1], '#e2b95e');
});

test('#649 п.2 beams: same exterior windows as Flat, parallelogram along the sun, room clip, light floor', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [400, 0], [400, 400], [0, 400]] }, { id: 'n', poly: [[400, 0], [800, 0], [800, 400], [400, 400]] }];
  // A south window (bottom wall, y = 400) and an interior window between the rooms.
  const windows = [
    { id: 'south', x: 200, y: 400, angle: 0, length: 80 },
    { id: 'interior', x: 400, y: 200, angle: 90, length: 80 },
  ];
  const base = { rooms, windows, azimuth: 200, elevation: 30, northDeg: 0, wallHeight: 84 };
  const beams = computeIsoSunBeams(base);
  assert.deepEqual(beams.map((b) => b.openingId), ['south'], 'interior windows never light');
  const [beam] = beams;
  assert.deepEqual(beam.normal.map((v) => Math.round(v)), [0, -1], 'light enters the room');
  assert.ok(Math.abs(beam.depth - isoSunDepth(30, 84)) < 1e-9);
  const lateral = beam.shift[0] / -beam.shift[1];
  assert.ok(Math.abs(lateral - Math.tan(20 * Math.PI / 180)) < 1e-6, 'oblique along the real sun, not the normal');
  assert.ok(beam.polys.every((poly) => poly.every(([x, y]) => x >= -1e-6 && x <= 400 + 1e-6 && y >= -1e-6 && y <= 400 + 1e-6)),
    'clipped to the room');
  assert.equal(beam.lightFloor, false);
  assert.equal(computeIsoSunBeams({ ...base, lightFloorRooms: new Set(['r']) })[0].lightFloor, true);
  assert.deepEqual(computeIsoSunBeams({ ...base, elevation: -1 }), [], 'night');
  assert.deepEqual(computeIsoSunBeams({ ...base, azimuth: 20 }), [], 'the sun behind the wall');
  // A wall face moves the base to the inner face (half the wall depth inward).
  const faced = computeIsoSunBeams({ ...base, wallDepthByOpening: { south: 20 } })[0];
  assert.equal(Math.round(faced.a[1]), 390);
});

test('#649 AC3 layout and collisions see the 2.5D tile size (× ISO_ICON_SCALE)', async () => {
  const { buildIsoOverlayRenderScene, isoRaisedOverlayHalfSize } = await import('../test-build/iso-scene-render.js');
  const { iconUnit } = await import('../test-build/space-geometry.js');
  const presentation = { scale: 1, pulse: { animated: false }, classes: [], supplemental: [] };
  const space = {
    id: 'floor', title: 'Floor', cellCm: 5, vb: [0, 0, 1000, 1000], bg: null,
    rooms: [{ id: 'r', poly: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]] }],
    wall_segments: [], room_drafts: [], partitions: [], wall_columns: [],
  };
  const scene = buildIsoOverlayRenderScene({
    space, devices: [{ id: 'd1' }], openings: [], view: { x: 0, y: 0, w: 1000, h: 1000 },
    display: { showNames: false, cardFontScale: 1 }, layers: { shadows: true }, wallSilhouettes: [],
    iconPct: 3, deviceBasePct: 3, showLqi: false, cellCm: 5, kioskIconScale: 1, kioskFontScale: 1,
    stageSize: { width: 1000, height: 1000 }, positionOf: () => ({ x: 500, y: 500 }),
    presentationOf: () => presentation, labelPositionOf: () => ({ x: 0, y: 0 }), labelScaleOf: () => 1,
    openingEntityAvailable: () => true, openingWallIndex: () => ({ adjacencyEps: 0.1, edges: [] }),
  });
  const footprint = scene.devices.get('d1').footprint;
  const half = (Math.max(...footprint.map((p) => p[0])) - Math.min(...footprint.map((p) => p[0]))) / 2;
  const base = 3 * iconUnit(space) / 100;
  const scaled = isoRaisedOverlayHalfSize({ kind: 'device', core: base * ISO_ICON_SCALE, presentation })[0];
  const flat = isoRaisedOverlayHalfSize({ kind: 'device', core: base, presentation })[0];
  assert.ok(Math.abs(half - scaled) < 1e-6, `footprint half ${half} = the 1.12 tile ${scaled}`);
  assert.ok(half > flat * 1.1, 'the Flat size would let 2.5D tiles overlap');
});

test('#649 AC7 the 2.5D beam is cut by the same physical bodies as Flat, on the far side of the body', () => {
  const rooms = [{ id: 'r', poly: [[0, 0], [400, 0], [400, 400], [0, 400]] }];
  const windows = [{ id: 'south', x: 200, y: 400, angle: 0, length: 80 }];
  // Sun due south: the light goes straight north (−y) from the south window.
  const base = { rooms, windows, azimuth: 180, elevation: 30, northDeg: 0, wallHeight: 84 };
  const inside = (p, poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  };
  const lit = (beam, p) => beam.polys.some((poly) => inside(p, poly));
  const area = (beam) => beam.polys.reduce((sum, poly) => sum + Math.abs(poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2, 0);
  const [open] = computeIsoSunBeams(base);
  assert.ok(open.depth > 150, 'the beam reaches past the body');
  for (const p of [[200, 360], [200, 250], [170, 250]]) assert.ok(lit(open, p), `lit without a body at ${p}`);
  // A column in the middle of the beam, 80–100 units into the room.
  const column = [[190, 300], [210, 300], [210, 320], [190, 320]];
  const [cut] = computeIsoSunBeams({ ...base, occluders: [column] });
  assert.ok(lit(cut, [200, 360]), 'between the window and the body the floor stays lit');
  assert.ok(!lit(cut, [200, 250]), 'behind the body, away from the sun, the floor is in shadow');
  assert.ok(lit(cut, [170, 250]), 'beside the shadow the beam goes on');
  assert.ok(area(cut) < area(open) - 20 * 50, 'the shadow runs along the whole remaining beam');
});
