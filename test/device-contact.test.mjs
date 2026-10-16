import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_EPS, contactAtWall, contactBoxIn, contactContains, contactJoinDepth, contactOutline,
  contactRotate, contactWallsNear, deriveContactShape, freeContactShape, joinedContactSide } from '../test-build/device-contact-geometry.js';
import { DeviceContactScene } from '../test-build/device-contact-scene.js';
import { DeviceContactMagnet } from '../test-build/device-contact-snap.js';
import { deviceContactWalls } from '../test-build/device-contact-walls.js';
import { contactIntersectsMasonry } from '../test-build/device-contact-collision.js';
import { resolveDeviceHitOwner } from '../test-build/device-hit-owner.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const marker = (id, x = 0, y = 0, diameter = 80, box) => ({ id, x, y, diameter,
  box: box || { left: -diameter * .634375, right: diameter * .634375, top: -diameter * .634375, bottom: diameter * .634375 } });
const canonical = (x, y) => ({ x: +((x / 1000).toFixed(9)) * 1000, y: +((y / 1000).toFixed(9)) * 1000 });
const shape = (m) => freeContactShape(m);
const wall = (angle = 0, side = 1) => {
  const t = [Math.cos(angle), Math.sin(angle)];
  return { id: `face-${angle}-${side}`, a: [-300 * t[0], -300 * t[1]], b: [300 * t[0], 300 * t[1]], normal: [-t[1] * side, t[0] * side] };
};

test('#866 free core and shell keep production size; reference row pitch has no accumulated drift', () => {
  for (const outer of [32, 56, 96]) {
    const core = 80 / 103 * outer, a = marker('a', 0, 0, core);
    close(a.diameter, core); close(a.box.right - a.box.left, 101.5 / 80 * core);
    assert.ok((outer - (a.box.right - a.box.left)) / 2 < 1);
    const pitch = core * 90 / 80;
    for (let i = 1; i < 10; i++) {
      const previous = marker(String(i - 1), (i - 1) * pitch, 0, core), next = marker(String(i), i * pitch, 0, core);
      assert.equal(joinedContactSide(shape(previous), shape(next)), 'right');
      close(next.x, i * outer * 90 / 103);
    }
  }
});

test('#866 finite physical H/V and inclined faces, both sides, rotate shell only', () => {
  for (const degrees of [0, 90, 30, -30, 45, -45, 75, -75]) for (const side of [-1, 1]) {
    const w = wall(degrees * Math.PI / 180, side), m = marker('m');
    const [p] = contactAtWall(m, w);
    assert.ok(p); close(Math.hypot(p.line[2] - p.line[0], p.line[3] - p.line[1]), 103);
    const cross = (p.line[2] - p.line[0]) * (w.b[1] - w.a[1]) - (p.line[3] - p.line[1]) * (w.b[0] - w.a[0]);
    close(cross, 0); close((p.x * w.normal[0] + p.y * w.normal[1]), 51.5);
    const saved = canonical(p.x, p.y), derived = deriveContactShape({ ...m, ...saved }, [w]);
    assert.equal(Object.keys(derived.walls).length, 1);
    assert.ok(contactContains(derived, [saved.x, saved.y]));
  }
  assert.equal(contactAtWall(marker('m'), { ...wall(), a: [0, 0], b: [20, 0] }).length, 0);
  assert.equal(contactAtWall(marker('m', NaN), wall()).length, 0);
  assert.equal(contactAtWall(marker('m'), { ...wall(), a: [0, 0], b: [0, 0] }).length, 0);
});

test('#866 conservative wall broad phase keeps every exact/captured badge contact, not distant floor faces', () => {
  const far=Array.from({length:1000},(_,i)=>({id:`far-${i}`,a:[3000+i,3000],b:[3000+i,4000],normal:null}));
  for(const degrees of [0,90,30,-30,45,-45,75,-75]) for(const side of [-1,1])
    for(const box of [undefined,{left:-50.75,right:250,top:-50.75,bottom:50.75},
      {left:-50.75,right:50.75,top:-250,bottom:50.75}]) {
      const w=wall(degrees*Math.PI/180,side), m=marker('m',0,0,80,box), p=contactAtWall(m,w)[0];
      if(!p)continue;
      const saved={...m,...canonical(p.x,p.y)};
      const near=contactWallsNear(saved,[...far,w]);
      assert.deepEqual(near,[w]);
      const found=deriveContactShape(saved,near);
      assert.equal(Object.keys(found.walls).length,1);
      for(const zoom of [.35,.5,1,2]){
        const raw={...saved,x:saved.x+w.normal[0]*8.5/zoom,y:saved.y+w.normal[1]*8.5/zoom};
        assert.deepEqual(contactWallsNear(raw,[...far,w],9/zoom),[w]);
      }
    }
  assert.deepEqual(contactWallsNear(marker('m',NaN),far),[]);
  assert.deepEqual(contactWallsNear(marker('m'),far,Infinity),[]);
});

test('#866 wall shape contains the unchanged upright full badge capsule at an incline', () => {
  const m = marker('badge', 0, 0, 80, { left: -50.75, right: 150, top: -50.75, bottom: 50.75 });
  for (const deg of [-75, -45, -30, 30, 45, 75]) {
    const p = contactAtWall(m, wall(deg * Math.PI / 180))[0];
    // The old capsule consists of these two end circles; all their boundary points fit.
    for (const x of [0, 99.25]) for (let i = 0; i < 64; i++) {
      const point = [p.x + x + Math.cos(i * Math.PI / 32) * 40, p.y + Math.sin(i * Math.PI / 32) * 40];
      assert.ok(contactContains(p.shape, point), `${deg}: ${point}`);
    }
  }
});

test('#866 row, column, L, grid: one component, convex radius of one marker, no empty-L box', () => {
  const layouts = [ [[0,0],[90,0],[180,0]], [[0,0],[0,90],[0,180]], [[0,0],[90,0],[0,90]],
    Array.from({ length: 10 }, (_, i) => [i % 5 * 90, Math.floor(i / 5) * 90]) ];
  for (const positions of layouts) {
    const scene = new DeviceContactScene(positions.map(([x,y], i) => marker(String(i), x,y)), []);
    assert.equal(scene.components().length, 1);
    const d = contactOutline([...scene.shapes.values()]);
    assert.ok(d.includes('A50.75 50.75')); assert.equal((d.match(/ Z/g) || []).length, 1);
    if (positions.length === 3 && positions.some(([x,y]) => x === 90 && y === 0)
      && positions.some(([x,y]) => x === 0 && y === 90)) assert.ok(d.includes('L50.75 50.75'));
  }
});

test('#866 extracting middle of ten splits groups, moves one marker and updates only local pairs', () => {
  const scene = new DeviceContactScene(Array.from({ length: 200 }, (_, i) => marker(String(i), i * 90)), []);
  const initial = scene.work.pairs;
  const fixed = scene.shapes.get('99').marker;
  scene.move('100', 9000, 400);
  assert.equal(scene.components().length, 3);
  assert.equal(scene.shapes.get('99').marker, fixed);
  assert.ok(scene.work.pairs - initial < 15);
  assert.equal(scene.work.builds, 1); assert.equal(scene.work.moves, 1);
  assert.equal(joinedContactSide(shape(marker('a')), shape(marker('b',90,90))), null);
});

test('#866 capture/release CSS radii, deterministic input order, bypass and one canonical proposal', () => {
  for (const scale of [.35,.5,1,2]) {
    const a = marker('a'), b = marker('b', 400, 400);
    const scene = new DeviceContactScene([a,b], []), mover = marker('m');
    const m = new DeviceContactMagnet(scene, mover, canonical);
    close(m.resolve(90 + 13.9 / scale, 0, scale, scale).x, 90);
    close(m.resolve(90 + 21.9 / scale, 0, scale, scale).x, 90);
    assert.equal(m.resolve(90 + 22.1 / scale, 0, scale, scale), null);
    assert.equal(m.resolve(90,0,scale,scale,false), null); assert.equal(m.hint, null);
    const reversed = new DeviceContactMagnet(new DeviceContactScene([b,a], []), mover, canonical);
    assert.deepEqual(m.resolve(90,0,scale,scale), reversed.resolve(90,0,scale,scale));
    const wm = new DeviceContactMagnet(new DeviceContactScene([], [wall()]), mover, canonical);
    assert.equal(wm.resolve(0,51.5 + 5.9 / scale,scale,scale)?.kind, 'wall');
    assert.equal(wm.resolve(0,51.5 + 8.9 / scale,scale,scale)?.kind, 'wall');
    assert.equal(wm.resolve(0,51.5 + 9.1 / scale,scale,scale), null);
  }
});

test('#866 canonical masonry surfaces are actual outer/hole boundaries, no invented thick-wall axis', () => {
  const walls = deviceContactWalls([[[[0,0],[300,0],[300,20],[0,20],[0,0]]]], [[350,0,500,0]]);
  assert.equal(walls.length,5);
  const top = walls.find(w => w.a[1] === 0 && w.b[1] === 0 && w.normal);
  assert.deepEqual(top.normal,[0,-1]);
  const bottom = walls.find(w => w.a[1] === 20 && w.b[1] === 20);
  const p = contactAtWall(marker('m',150,71.5), bottom)[0]; close(p.y,71.5);
  assert.equal(walls.filter(w=>w.normal===null).length,1);
});

test('#866 ordinary negative inputs never become wall/device candidates or poison the spatial index', () => {
  for (const m of [marker('nan',NaN),marker('inf',0,Infinity),marker('zero',0,0,0)]) {
    assert.equal(contactAtWall(m,wall()).length,0);
    assert.equal(new DeviceContactScene([m],[]).shapes.size,0);
  }
  assert.equal(contactAtWall(marker('m'),{...wall(),normal:[NaN,1]}).length,0);
  assert.equal(contactAtWall(marker('m'),{...wall(),normal:[1,0]}).length,0);
  const magnet=new DeviceContactMagnet(new DeviceContactScene([marker('n')],[]),marker('m'),()=>({x:NaN,y:Infinity}));
  assert.equal(magnet.resolve(90,0,1,1),null);
});

test('#866 vertical wall/free neighbour and mixed-size contacts are symmetric and never overlap cores', () => {
  const w={id:'v',a:[0,-300],b:[0,300],normal:[1,0]};
  const attached=deriveContactShape(marker('wall',51.5,0),[w]);
  assert.equal(attached.angle,0); assert.equal(attached.walls.left,'v');
  const free=shape(marker('free',141.5,0));
  assert.equal(joinedContactSide(attached,free),'right'); assert.equal(joinedContactSide(free,attached),'left');
  const a=marker('large',0,0,80), b=marker('small',0,0,40);
  b.x=(a.box.right-b.box.left)-contactJoinDepth(a,b);
  assert.equal(joinedContactSide(shape(a),shape(b)),'right'); assert.equal(joinedContactSide(shape(b),shape(a)),'left');
});

test('#866 masonry collision rejects a normal-looking snap through another physical wall/corner', () => {
  const masonry=[[[[-300,-20],[300,-20],[300,0],[-300,0],[-300,-20]]],
    [[[25,10],[80,10],[80,100],[25,100],[25,10]]]];
  const s=contactAtWall(marker('m'),wall())[0].shape;
  assert.equal(contactIntersectsMasonry(s,masonry),true);
  const clean=masonry.slice(0,1);
  assert.equal(contactIntersectsMasonry(s,clean),false);
  const magnet=new DeviceContactMagnet(new DeviceContactScene([],deviceContactWalls(masonry),masonry),marker('m'),canonical);
  const p=magnet.resolve(0,51.5,1,1);
  assert.equal(p,null);
});

test('#866 shaped painted ownership beats an overlapping 44px floor; L void is not a group target', () => {
  const a=marker('a',0,0,24),b=marker('b',27,0,24),c=marker('c',0,27,24);
  const scene=new DeviceContactScene([a,b,c],[]);
  const candidates=[...scene.shapes.values()].map(s=>{
    const sides={...s.walls};for(const id of scene.edges.get(s.marker.id)){const side=joinedContactSide(s,scene.shapes.get(id));if(side)sides[side]='device';}
    return{id:s.marker.id,center:{x:s.marker.x,y:s.marker.y},painted:{left:s.marker.x+s.box.left,right:s.marker.x+s.box.right,
      top:s.marker.y+s.box.top,bottom:s.marker.y+s.box.bottom},floorRadius:22,contains:p=>contactContains(s,[p.x,p.y],sides)};
  });
  for(const m of [a,b,c])assert.equal(resolveDeviceHitOwner(candidates,{x:m.x,y:m.y}).id,m.id);
  assert.equal(resolveDeviceHitOwner(candidates,{x:30,y:30}),null);
  assert.equal(resolveDeviceHitOwner([...candidates].reverse(),{x:13.5,y:0}).id,'a');
});
