import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSunAccess, sunBarrierLines } from '../test-build/sun-access.js';
import { computeSunRays, windowWallInfo } from '../test-build/sun.js';
import { computeIsoSunBeams } from '../test-build/iso-sun.js';
import { directionalOccluders, floorMinusBodies, geometryOuterRings, geometryArea } from '../test-build/physical-geometry.js';

const rect = (id, x, y, w, h, sunTransparent = false) => ({ id, sunTransparent,
  poly: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]] });
const win = {id:'W', x:0, y:50, angle:90, length:30};
const chain = () => [rect('R',0,0,100,100), rect('T2',-40,0,40,100,true), rect('T1',-80,0,40,100,true),
  rect('N',-80,-40,180,40), rect('S',-80,100,180,40)];
const beams = rooms => [computeSunRays(rooms,[win],270,30,0), computeIsoSunBeams({rooms,windows:[win],
  azimuth:270,elevation:30,northDeg:0,wallHeight:30})];
const ids = rays => rays.map(r => [r.openingId,r.roomId]);

test('AC3: thin ordinary neighbours and almost-axis boundaries cannot manufacture exterior access', () => {
  for (const width of [.001, .0001, .00001]) for (const angle of [0, .0001]) {
    const rooms=[rect('T',0,0,100,100,true),rect('W',-width,-width,width,100+2*width),
      rect('N',0,-width,100,width),rect('E',100,-width,width,100+2*width),rect('S',0,100,100,width)];
    const rotated=rooms.map(r=>({...r,poly:r.poly.map(([x,y])=>[
      x*Math.cos(angle)-y*Math.sin(angle), x*Math.sin(angle)+y*Math.cos(angle)])}));
    for (const order of [rotated,[...rotated].reverse()]) {
      assert.deepEqual([...resolveSunAccess(order).outside],[],`closed thin ring ${width}/${angle}`);
    }
  }
});

test('AC3/4: internal cycles stay sealed; oblique windows share the same Flat/2.5D receivers', () => {
  const cycle=[rect('building',-100,-100,300,300),rect('A',0,0,50,50,true),
    rect('B',50,0,50,50,true),rect('C',50,50,50,50,true),rect('D',0,50,50,50,true)];
  assert.equal(resolveSunAccess(cycle).outside.size,0);
  const rotate=([x,y])=>[(x-y)/Math.SQRT2,(x+y)/Math.SQRT2];
  const rooms=chain().map(r=>({...r,poly:r.poly.map(rotate)}));
  const [x,y]=rotate([win.x,win.y]);
  const windows=[{...win,x,y,angle:135}];
  assert.deepEqual(ids(computeSunRays(rooms,windows,315,30,0)),[['W','R']]);
  assert.deepEqual(ids(computeIsoSunBeams({rooms,windows,azimuth:315,elevation:30,northDeg:0,wallHeight:30})),[['W','R']]);
  const transparentWindows=[win,{...win,id:'between-flags',x:-40},{...win,id:'exterior-flag',x:-80}];
  assert.deepEqual(ids(computeSunRays(chain(),transparentWindows,270,30,0)),[['W','R']]);
  assert.deepEqual(ids(computeIsoSunBeams({rooms:chain(),windows:transparentWindows,
    azimuth:270,elevation:30,northDeg:0,wallHeight:30})),[['W','R']]);
});

test('AC7: exterior access crosses flagged chains in Flat and 2.5D, never an ordinary room', () => {
  const rooms = chain();
  assert.deepEqual([...resolveSunAccess(rooms).outside].sort(), ['T1','T2']);
  for (const rays of beams(rooms)) { assert.deepEqual(ids(rays), [['W','R']]); assert.ok(rays[0].polys.length); }
  for (const flag of ['T1','T2']) {
    const changed = structuredClone(rooms); changed.find(r=>r.id===flag).sunTransparent=false;
    for (const rays of beams(changed)) assert.deepEqual(rays, []);
  }
  const sealed = [...rooms, rect('W0',-120,0,40,100)];
  assert.equal(resolveSunAccess(sealed).outside.size, 0);
  for (const rays of beams(sealed)) assert.deepEqual(rays, []);
  for (const rays of beams([...rooms].reverse())) assert.deepEqual(ids(rays), [['W','R']]);
});

test('AC7: partial common boundaries propagate transitively; a point contact does not', () => {
  const rooms = chain().filter(r=>r.id!=='T2');
  rooms.push(rect('T2',-40,0,20,100,true),rect('T3',-20,0,20,100,true));
  assert.deepEqual([...resolveSunAccess(rooms).outside].sort(),['T1','T2','T3']);
  for (const rays of beams(rooms)) assert.deepEqual(ids(rays), [['W','R']]);
  const corner = [rect('R',0,0,100,100),rect('T2',-40,0,40,100,true),rect('T1',-80,-40,40,40,true),
    rect('W0',-80,0,40,100),rect('N',-40,-40,140,40),rect('S',-80,100,180,40)];
  assert.deepEqual([...resolveSunAccess(corner).outside],['T1']);
  for (const rays of beams(corner)) assert.deepEqual(rays, []);
});

test('AC2/3: nested islands use the innermost room, without creating an internal street', () => {
  const terrace = rect('terrace',-60,-60,220,220,true), receiving = rect('R',0,0,100,100);
  for (const rooms of [[terrace,receiving],[receiving,terrace]]) {
    for (const rays of beams(rooms)) assert.deepEqual(ids(rays), [['W','R']]);
    assert.equal(windowWallInfo({x:-60,y:50,angle:90},rooms),null);
  }
  const internal = [rect('building',-100,-100,300,300),rect('internal',-40,0,40,100,true)];
  assert.equal(resolveSunAccess(internal).outside.size,0);
  for (const rays of beams(internal)) assert.deepEqual(rays,[]);
});

test('AC4: flagged rooms never receive rays; direction, night and aperture rules remain', () => {
  const rooms = chain();
  const exterior = {id:'outside',x:-80,y:50,angle:90,length:30};
  assert.deepEqual(computeSunRays(rooms,[exterior],270,30,0),[]);
  assert.deepEqual(computeSunRays(rooms,[win],90,30,0),[]);
  assert.deepEqual(computeSunRays(rooms,[win],270,-1,0),[]);
  for (const origin of ['inner','outer']) assert.ok(computeSunRays(rooms,[win],270,30,0,
    {R:[[8,8],[92,8],[92,92],[8,92]]},{W:16},origin).length);
  const old = rooms.map(({sunTransparent,...r})=>r);
  assert.deepEqual(beams(old),[[],[]]);
});

test('AC5/7: excluded contour shadows cannot erase a narrow terrace ray; independent obstacles remain', () => {
  const rooms = [rect('R',0,0,100,100),rect('T',-10,0,10,100,true)];
  const outer = [-10,0,-10,100], independent = [15,0,15,100], shared=[0,0,0,100];
  const access=resolveSunAccess(rooms);
  const retained=sunBarrierLines(rooms,access,[outer,independent,shared],[outer,shared]);
  assert.deepEqual(retained,[independent,shared]);
  const rays=computeSunRays(rooms,[win],270,30,0);
  const clip = lines => geometryOuterRings(floorMinusBodies(rays[0].polys[0],
    directionalOccluders(lines.map(l=>[l.slice(0,2),l.slice(2,4)]),rays[0].dir,rays[0].len)));
  const ringArea = rings => geometryArea(rings.map(r=>[[...r,r[0]]]));
  assert.ok(ringArea(clip([outer])) < ringArea(rays[0].polys));
  assert.ok(clip(sunBarrierLines(rooms,access,[outer],[outer])).length);
  const iso=computeIsoSunBeams({rooms,windows:[win],azimuth:270,elevation:30,northDeg:0,wallHeight:30,
    access,occluders:[]});
  assert.deepEqual(ids(iso),[['W','R']]);
  assert.deepEqual(rooms,[rect('R',0,0,100,100),rect('T',-10,0,10,100,true)]);
});
