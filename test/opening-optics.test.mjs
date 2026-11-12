import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSunRays, rayRimEdges } from '../test-build/sun.js';
import { maskProvenWindowPassages, opticalOpeningPosition } from '../test-build/opening-optics.js';
import { openingTransmissionIntervals } from '../test-build/opening-features.js';
import { pointInPolygon } from '../test-build/logic.js';
import { wallKey } from '../test-build/wall-thickness.js';
import { buildLightBarrierScene, resolveLightBarrierRevision } from '../test-build/glow-scene.js';
import { visibilityPolygon } from '../test-build/light-visibility.js';

const opening = { id: 'glass', type: 'window', x: 0, y: .5, angle: 90, length: .1,
  rx: 0, ry: 200, rlen: 100 };
const rooms = [{ id: 'room', poly: [[0, 0], [400, 0], [400, 400], [0, 400]] }];
const window = { id: 'glass', x: 0, y: 200, angle: 90, length: 100 };
const inner = { room: [[10, 10], [390, 10], [390, 390], [10, 390]] };

for (const origin of ['inner', 'outer']) {
  test(`#1024 ${origin}: masking retains parent reach/depth and no new neighbour seams`, () => {
    const [full] = computeSunRays(rooms, [window], 270, 30, 0, inner, { glass: 20 }, origin);
    assert.ok(full);
    const rays = computeSunRays(rooms, [{ ...window, mask: [[0, .25], [.5, 1]] }],
      270, 30, 0, inner, { glass: 20 }, origin);
    assert.equal(rays.length, 2);
    for (const ray of rays) {
      assert.equal(ray.openingId, full.openingId);
      assert.equal(ray.len, full.len);
      assert.equal(ray.depth, full.depth);
      assert.deepEqual(ray.normal, full.normal);
      assert.ok(rayRimEdges(ray).length >= 2);
    }
    assert.deepEqual(computeSunRays(rooms, [{ ...window, mask: [[0, 1]] }],
      270, 30, 0, inner, { glass: 20 }, origin), [full]);
    assert.deepEqual(computeSunRays(rooms, [{ ...window, mask: [] }],
      270, 30, 0, inner, { glass: 20 }, origin), []);
    const explicit = { ...opening, opening_features: { version: 1, side: 'negative', leaves: [0, 1, 2, 3]
      .map(i => ({ id: String(i), hinge: 'top', shade: { enabled: true, manual: 'open' } })) } };
    assert.deepEqual(openingTransmissionIntervals(explicit, () => null), [[0, 1]]);
    const allowed = computeSunRays(rooms, [{...window,mask:[[0,.25]]}],270,30,0,inner,{glass:20},origin);
    const lit = point => allowed.some(ray => ray.polys.some(poly=>pointInPolygon(point,poly)));
    assert.equal(lit([30,160]),true,'an open share lights a real floor control point');
    assert.equal(lit([30,200]),false,'a closed share leaves its floor control point dark');
  });
}

test('#1024 Glow intersects allowed fractions with the already proven floor-to-floor interval', () => {
  const parent = { ...opening, angle: 0, rx: 200, ry: 0 };
  const proven = [{ ...parent, rx: 212.5, rlen: 75 }]; // -25..50 relative to parent
  const masked = maskProvenWindowPassages(parent, proven, [[0, .5]]);
  assert.equal(masked.length, 1);
  assert.equal(masked[0].rx, 187.5);
  assert.equal(masked[0].rlen, 25);
  assert.deepEqual(maskProvenWindowPassages(parent, [], [[0, 1]]), []);
  assert.deepEqual(maskProvenWindowPassages(parent, proven, []), []);
});

test('#1024 slide aperture starts opposite the translated panel; swing remains centred', () => {
  const door = { ...opening, type: 'door', angle: 0, rx: 200, ry: 0,
    opening_features: { version: 1, mechanism: 'slide', slide_direction: 'end' } };
  assert.equal(opticalOpeningPosition(door, .5).rx, 175);
  assert.equal(opticalOpeningPosition({ ...door, opening_features: {
    ...door.opening_features, slide_direction: 'start' } }, .5).rx, 225);
  assert.equal(opticalOpeningPosition(door, 1).rx, 200);
  const swing = { ...door, opening_features: { version: 1, mechanism: 'swing' } };
  assert.equal(opticalOpeningPosition(swing, .5), swing);
});

test('#1024 live shade mask changes Glow control points, not the structural fingerprint', () => {
  const space={id:'s',rooms:[
    {id:'left',poly:[[0,0],[100,0],[100,100],[0,100]]},
    {id:'right',poly:[[100,0],[200,0],[200,100],[100,100]]},
  ],partitions:[],wall_columns:[],room_drafts:[]};
  const walls=[...new Map(space.rooms.flatMap(room=>room.poly.map((a,i)=>{
    const b=room.poly[(i+1)%4],key=wallKey(a,b,1);return[key,{a,b,key,cm:10}];
  }))).values()];
  const glass={id:'w',type:'window',x:100,y:50,rx:100,ry:50,length:40,rlen:40,angle:90,
    opening_features:{version:1,side:'negative',leaves:[{id:'a',hinge:'start'},
      {id:'b',hinge:'end',shade:{enabled:true,manual:'open',contact:'cover.shade'}}]}};
  const raw={...space,walls,openings:[glass]};
  const revision=state=>resolveLightBarrierRevision({rawSpaceConfig:raw,space,openings:[glass],
    cellCm:5,gridPitch:5,openingAmount:()=>0,
    openingIntervals:o=>openingTransmissionIntervals(o,()=>({state}))});
  const open=revision('open'),closed=revision('closed');
  assert.equal(open.geometryFingerprint,closed.geometryFingerprint);
  assert.notEqual(open.fingerprint,closed.fingerprint);
  assert.equal(revision('unavailable').fingerprint,open.fingerprint,'unknown does not create a speculative blocker');
  glass.opening_features.leaves[0].hinge='top';
  glass.opening_features.leaves[0].manual='open';
  assert.equal(revision('open').fingerprint,open.fingerprint,'glass pose is not an optical invalidation');
  const lit=revision=>{
    const scene=buildLightBarrierScene({space,revision,walls,zeroWalls:{contour:[],barriers:[],transmissive:[]},
      wallKeyPitch:1,cellCm:5,gridPitch:5,coordScale:1,physicalBodies:()=>[]});
    return visibilityPolygon([50,50],200,scene.occluders,96);
  };
  const unmasked=lit(open),masked=lit(closed);
  const contains=(poly,point)=>pointInPolygon(point,poly);
  assert.equal(contains(unmasked,[150,30]),true);
  assert.equal(contains(unmasked,[150,70]),true);
  assert.equal(contains(masked,[150,30]),true,'the first leaf still passes artificial light');
  assert.equal(contains(masked,[150,70]),false,'the closed second leaf blocks artificial light');
});
