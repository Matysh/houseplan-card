import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLightBarrierRevision, buildLightBarrierScene, glowSourceInOpaqueBody } from '../test-build/glow-scene.js';
import { geometryOpenings } from '../test-build/plan-geometry-preflight.js';
import { physicalBodyParts } from '../test-build/physical-geometry.js';
import { wallKey } from '../test-build/wall-thickness.js';
import { pointInPolygon } from '../test-build/logic.js';
import { visibilityPolygon } from '../test-build/light-visibility.js';

const rect = (id, y0, y1) => ({ id, poly: [[0,y0],[100,y0],[100,y1],[0,y1]] });
function fixture({ partition = false, exterior = false, angle = 0, flipH = false, flipV = false,
  mechanism = 'swing', direction = 'start', glass = false, host, features } = {}) {
  const rad = angle * Math.PI / 180;
  const point = ([x,y]) => [x*Math.cos(rad)-y*Math.sin(rad), x*Math.sin(rad)+y*Math.cos(rad)];
  const rooms = (partition ? [rect('one',0,200)] : exterior ? [rect('a',0,100)] : [rect('a',0,100),rect('b',100,200)])
    .map(r => ({ ...r, poly: r.poly.map(point) }));
  const walls = [...new Map(rooms.flatMap(r => r.poly.map((a,i) => {
    const b = r.poly[(i+1)%r.poly.length], key = wallKey(a,b,1);
    return [key,{key,a,b,cm:20}];
  }))).values()];
  const partitions = partition ? [{ id:'p', a:point([0,100]), b:point([100,100]), cm:20 }] : [];
  const space = { id:'s',rooms,partitions,wall_columns:[],
    wall_segments:walls.map((w,i) => ({id:`w${i}`,a:w.a,b:w.b,cm:w.cm})) };
  const [x,y] = point([50,100]);
  const door = { id:'d',type:'door',x,y,length:40,angle,flip_h:flipH,flip_v:flipV,
    ...(partition ? {host:{kind:'partition',id:'p',t:.5}} : {}), ...(host ? {host} : {}),
    ...(mechanism === 'slide' ? {opening_features:{version:1,mechanism:'slide',slide_direction:direction,manual:'closed'}} : {}),
    ...(features ? {opening_features:features} : {}), ...(glass ? {light_transparent:true} : {}) };
  const raw = { ...space, walls, openings:[door] };
  const openings = geometryOpenings(raw,space,5,5,1);
  const revision = amount => resolveLightBarrierRevision({rawSpaceConfig:raw,space,openings,
    cellCm:5,gridPitch:5,openingAmount:()=>amount});
  const scene = amount => buildLightBarrierScene({space,revision:revision(amount),walls,
    zeroWalls:{contour:[],barriers:[],transmissive:[]},wallKeyPitch:1,cellCm:5,gridPitch:5,coordScale:1,
    physicalBodies:cuts=>physicalBodyParts(space,5,5,.001,cuts).all});
  const lit = (s, target, source) => {
    const p = point(target), origin = point(source);
    return s.floor.some(poly => pointInPolygon(p,poly))
      && pointInPolygon(p,visibilityPolygon(origin,500,s.occluders,96));
  };
  return {space,raw,door,revision,scene,point,lit};
}

for (const partition of [false,true]) for (const angle of [0,27,90,180])
  for (const flipH of [false,true]) for (const flipV of [false,true]) for (const mechanism of ['swing','slide']) {
    test(`#1421 closed ${mechanism} leaf seals its slot: partition=${partition}, angle=${angle}, flips=${flipH}/${flipV}`, () => {
      const f = fixture({partition,angle,flipH,flipV,mechanism}), before = JSON.stringify(f.raw), s = f.scene(0);
      const plane = mechanism === 'swing' ? 100 : flipV ? 110 : 90;
      for (const side of [-1,1]) {
        const source = [50,side < 0 ? 50 : 150];
        assert.equal(f.lit(s,[50,plane + side*2],source),true,'source-side pocket reaches the drawn panel');
        assert.equal(f.lit(s,[50,plane - side*2],source),false,'opaque leaf seals the opposite side');
      }
      assert.equal(glowSourceInOpaqueBody({x:f.point([50,100])[0],y:f.point([50,100])[1]},s),false,
        'the full wall volume is no longer the false occluder');
      assert.equal(JSON.stringify(f.raw),before,'derived optics never writes the plan');
    });
  }

for (const flipV of [false,true]) for (const mechanism of ['swing','slide']) test(`#1421 exterior ${mechanism}/${flipV} lights only the bounded pocket before the panel`, () => {
  const f = fixture({exterior:true,flipV,mechanism}), s = f.scene(0), plane = mechanism === 'swing' ? 100 : flipV ? 110 : 90;
  assert.equal(f.lit(s,[50,plane-2],[50,50]),true);
  assert.equal(f.lit(s,[50,plane+2],[50,50]),false);
  assert.equal(f.lit(s,[50,125],[50,50]),false,'no outdoor floor or light fan is invented');
});

test('#1421 partial opening, transparent doors and actual closure retain distinct optics/cache ownership', () => {
  const f = fixture();
  assert.equal(f.lit(f.scene(0),[50,95],[50,50]),true);
  assert.equal(f.lit(f.scene(.01),[50,95],[50,50]),false,'unchanged 5% optical quantisation for partial openings');
  assert.notEqual(f.revision(0).fingerprint,f.revision(.01).fingerprint,'actual closure must not share a zero-rounded partial cache');
  assert.equal(f.lit(f.scene(1),[50,150],[50,50]),true);
  assert.equal(f.lit(f.scene(0),[50,150],[50,50]),false,'closing again cannot retain the open mask');
  const glass = fixture({glass:true});
  assert.equal(glass.lit(glass.scene(0),[50,150],[50,50]),true);
  const slide = fixture({mechanism:'slide'});
  assert.equal(f.revision(0).geometryFingerprint,slide.revision(0).geometryFingerprint);
  assert.notEqual(f.revision(0).fingerprint,slide.revision(0).fingerprint,'closed slide placement is an optical cache input');
});

test('#1421 invalid explicit host and future feature data fail dark instead of carving a slot', () => {
  for (const options of [{host:{kind:'wall',id:'missing',t:.5}},{features:{version:9,mechanism:'slide'}}]) {
    const f = fixture(options);
    assert.equal(f.lit(f.scene(0),[50,95],[50,50]),false);
    assert.equal(f.lit(f.scene(0),[50,150],[50,50]),false);
  }
});

test('#1421 explicit wall carrier must contain the door at its declared position', () => {
  // The horizontal shared wall is the second edge of the first room.
  const f = fixture({ host: { kind: 'wall', id: 'w2', t: .5 } });
  const wall = f.space.wall_segments.find(w => w.id === 'w2');
  assert.equal(wall.a[1], 100); assert.equal(wall.b[1], 100);
  assert.equal(f.lit(f.scene(0), [50,95], [50,50]), true);
  const wrong = fixture({ host: { kind: 'wall', id: 'w2', t: .1 } });
  assert.equal(wrong.lit(wrong.scene(0), [50,95], [50,50]), false);
});

test('#1421 source exactly on the closed leaf fails dark; slide direction cannot move a closed leaf', () => {
  for (const mechanism of ['swing','slide']) {
    const f = fixture({ mechanism }), plane = mechanism === 'swing' ? 100 : 90;
    assert.equal(f.lit(f.scene(0), [50,80], [50,plane]), false);
  }
  const a = fixture({ mechanism:'slide', direction:'start' });
  const b = fixture({ mechanism:'slide', direction:'end' });
  assert.deepEqual(a.scene(0).occluders,b.scene(0).occluders);
});
