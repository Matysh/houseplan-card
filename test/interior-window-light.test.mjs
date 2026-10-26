import test from 'node:test';
import assert from 'node:assert/strict';
import { interiorWindowLightPassages } from '../test-build/interior-window-light.js';
import { buildLightBarrierScene, resolveLightBarrierRevision, glowSourceInOpaqueBody } from '../test-build/glow-scene.js';
import { openingWallIndex, wallKey, wallBodiesGeometry } from '../test-build/wall-thickness.js';
import { geometryOpenings } from '../test-build/plan-geometry-preflight.js';
import { physicalBodyParts } from '../test-build/physical-geometry.js';
import { visibilityPolygon } from '../test-build/light-visibility.js';
import { pointInPolygon } from '../test-build/logic.js';

const room = (id, x0, y0, x1, y1) => ({ id, poly: [[x0,y0],[x1,y0],[x1,y1],[x0,y1]] });
const pair = () => [room('a',0,0,100,100),room('b',100,0,200,100)];
const glass = extra => ({ id:'glass',type:'window',rx:100,ry:50,rlen:40,angle:90,...extra });
function arrange(rooms = pair(), opening = glass(), { cm = 20, partitions = [], columns = [] } = {}) {
  const walls = [...new Map(rooms.flatMap(r => r.poly.map((a,i) => {
    const b = r.poly[(i+1)%r.poly.length], key = wallKey(a,b,1);
    return [key,{key,a,b,cm}];
  }))).values()];
  const space = { id:'s',rooms,partitions,wall_columns:columns,
    wall_segments:walls.map((w,i)=>({id:`wall-${i}`,a:w.a,b:w.b,cm:w.cm})) };
  const index = openingWallIndex(rooms,walls,[],1,5,5,1);
  const rawSpaceConfig = { ...space,walls,openings:[opening] };
  const revisionFor = amount => resolveLightBarrierRevision({
    rawSpaceConfig,space,openings:[opening],cellCm:5,gridPitch:5,openingAmount:()=>amount,
  });
  const sceneFor = (amount, sharedWallGeometry) => buildLightBarrierScene({
    space,revision:revisionFor(amount),walls,
    sharedWallGeometry,
    zeroWalls:{contour:[],barriers:[],transmissive:[]},wallKeyPitch:1,cellCm:5,gridPitch:5,coordScale:1,
    physicalBodies:cuts=>physicalBodyParts(space,5,5,0.001,cuts).all,
  });
  return { space,index,walls,opening,revisionFor,sceneFor };
}
const seen = (scene, point, source = [50,50], radius = 500) =>
  pointInPolygon(point,visibilityPolygon(source,radius,scene.occluders,96));

test('closed internal glass passes real light; contact changes cannot close it', () => {
  const f = arrange();
  const before = JSON.stringify(f.space),closed = f.sceneFor(0),open = f.sceneFor(1);
  assert.equal(seen(closed,[130,50]),true);
  assert.equal(seen(closed,[130,5]),false,'the physical jamb still casts a shadow');
  assert.equal(seen(closed,[190,50],[50,50],100),false,'the lamp radius still applies');
  assert.equal(glowSourceInOpaqueBody({x:100,y:50},closed),false,'internal glass tunnel accepts source');
  assert.equal(f.revisionFor(0).fingerprint,f.revisionFor(1).fingerprint,'glass contact is not transport state');
  assert.deepEqual(open,closed);
  assert.equal(JSON.stringify(f.space),before);
});

test('static retained masonry without a permanent passage receives the same window cuts', () => {
  const f=arrange(),revision=f.revisionFor(0);
  const shared=wallBodiesGeometry(f.space.rooms,f.walls,[],[],1,5,5,1,[]);
  assert.equal(shared.openingIndex,null,'the real static drawing does not need a passage index');
  Object.defineProperty(shared,'sourceFingerprint',{value:revision.geometryFingerprint});
  const scene=f.sceneFor(0,shared);
  assert.equal(seen(scene,[130,50]),true,'recut must not silently skip new glass slots');
  assert.equal(seen(scene,[130,5]),false);
});

test('thick and oblique glass retains jambs and distant column shadows', () => {
  const f = arrange(pair(),glass(),{cm:40,columns:[{id:'column',shape:'square',center:[150,50],cm:20}]});
  assert.equal(seen(f.sceneFor(0),[180,50]),false,'column shadow is not a whole-room fill');
  assert.equal(seen(f.sceneFor(0),[125,50]),true);
  const angle = 27*Math.PI/180;
  const rotate = ([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)];
  const [rx,ry]=rotate([100,50]);
  const oblique = arrange(pair().map(r=>({...r,poly:r.poly.map(rotate)})),glass({rx,ry,angle:117}),{cm:40});
  assert.equal(seen(oblique.sceneFor(0),rotate([130,50]),rotate([50,50])),true);
  assert.equal(seen(oblique.sceneFor(0),rotate([130,5]),rotate([50,50])),false);
});

test('a partially interior window cuts only the real shared interval, even with its centre outside', () => {
  const rooms=[room('a',0,0,100,200),room('b',100,0,200,100)];
  const f=arrange(rooms,glass({ry:115,rlen:80}));
  const cuts=interiorWindowLightPassages(f.opening,f.space,f.index);
  assert.equal(cuts.length,1);
  assert.ok(Math.abs(cuts[0].ry-87.5)<1e-8);
  assert.ok(Math.abs(cuts[0].rlen-25)<1e-8);
  const scene=f.sceneFor(0);
  assert.equal(glowSourceInOpaqueBody({x:100,y:90},scene),false);
  assert.equal(glowSourceInOpaqueBody({x:100,y:130},scene),true,'exterior remainder stays masonry');
});

test('a window spanning two adjacent room-side records keeps every proven portion', () => {
  const f=arrange([room('a',0,0,100,100),room('b',100,0,200,50),room('c',100,50,200,100)],glass({rlen:60}));
  const cuts=interiorWindowLightPassages(f.opening,f.space,f.index);
  assert.ok(Math.abs(cuts.reduce((n,o)=>n+o.rlen,0)-60)<1e-8);
});

for (const [name,rooms,opening] of [
  ['exterior',pair(),glass({rx:0})],
  ['no second floor',[room('a',0,0,100,100)],glass()],
  ['vertex only',[room('a',0,0,100,100),room('b',100,100,200,200)],glass({ry:100})],
  ['unknown opening',pair(),glass({type:'future-glass'})],
  ['missing explicit wall',pair(),glass({host:{kind:'wall',id:'missing',t:.5}})],
  ['unknown host',pair(),glass({host:{kind:'future-wall',id:'missing',t:.5}})],
  ['overlapping ambiguous room', [...pair(),room('c',100,0,200,100)],glass()],
]) test(`${name} stays opaque instead of trusting an opening-shaped gap`, () => {
  const f=arrange(rooms,opening);
  assert.deepEqual(interiorWindowLightPassages(opening,f.space,f.index),[]);
  assert.equal(glowSourceInOpaqueBody({x:opening.rx,y:opening.ry},f.sceneFor(0)),true);
});

test('explicit wall authority checks identity, position and positive masonry', () => {
  const f=arrange();
  const wall=f.space.wall_segments.find(w=>w.a[0]===100&&w.b[0]===100);
  const hosted=glass({host:{kind:'wall',id:wall.id,t:.5}});
  assert.equal(interiorWindowLightPassages(hosted,f.space,f.index).length,1);
  for(const invalid of [
    {...hosted,host:{...hosted.host,t:NaN}},
    {...hosted,host:{...hosted.host,t:1.1}},
    {...hosted,rx:101},
  ]) assert.deepEqual(interiorWindowLightPassages(invalid,f.space,f.index),[]);
  const duplicate={...f.space,wall_segments:[...f.space.wall_segments,{...wall}]};
  assert.deepEqual(interiorWindowLightPassages(hosted,duplicate,f.index),[]);
  const zero={...f.space,wall_segments:f.space.wall_segments.map(w=>w.id===wall.id?{...w,cm:0}:w)};
  assert.deepEqual(interiorWindowLightPassages(hosted,zero,f.index),[]);
});

test('partition windows use only sliced hosted cuts and keep the exterior remainder dark', () => {
  const rooms=[room('a',0,0,100,200),room('b',100,0,200,100)];
  const partition={id:'partition',a:[100,0],b:[100,200],cm:20};
  const base=arrange(rooms,glass(),{partitions:[partition]});
  const stored={id:'glass',type:'window',x:100,y:115,length:80,angle:90,
    host:{kind:'partition',id:'partition',t:115/200}};
  const [projected]=geometryOpenings({openings:[stored]},base.space,5,5,1);
  const f=arrange(rooms,projected,{partitions:[partition]});
  const cut=interiorWindowLightPassages(projected,f.space,f.index)[0];
  assert.equal(cut.partitionHost.center[1],87.5);
  assert.ok(Math.abs(cut.partitionHost.length-25)<1e-10);
  assert.ok(Math.abs(cut.partitionHost.t-87.5/200)<1e-12);
  const scene=f.sceneFor(0);
  assert.equal(glowSourceInOpaqueBody({x:100,y:90},scene),false);
  assert.equal(glowSourceInOpaqueBody({x:100,y:130},scene),true);
});

test('floor and host edits change the structural key; camera is absent from it', () => {
  const f=arrange(),first=f.revisionFor(0).fingerprint;
  f.space.rooms[1].poly[0][0]=101;
  assert.notEqual(f.revisionFor(0).fingerprint,first);
  assert.equal(f.revisionFor(0).fingerprint,f.revisionFor(0).fingerprint);
});
