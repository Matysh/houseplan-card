import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceContactScene, contactBounds } from '../test-build/device-contact-scene.js';
import { contactContains } from '../test-build/device-contact-geometry.js';
import { screenContactScene, projectedContactHit } from '../test-build/device-contact-screen.js';
import { DeviceContactLayout } from '../test-build/device-contact-layout.js';
import { isoFloorMatrix } from '../test-build/iso-projection.js';

test('#1451 floor-aligned contact hit uses the inverse projection, preserving member ownership', () => {
  const normalized={marker:{id:'a',x:0,y:0,diameter:1},angle:0,radius:.5,
    box:{left:-.5,right:.5,top:-.5,bottom:.5},walls:{}};
  const contact={bounds:contactBounds(normalized),contains:(x,y)=>contactContains(normalized,[x,y])};
  for(const yaw of [35,125,215,305]) for(const size of [18,44,120]) {
    const plane=isoFloorMatrix({rotDeg:yaw,tiltDeg:55,xyScale:1,zScale:1,origin:[500,500],floorScaleY:Math.sin(35*Math.PI/180)});
    const [a,b,c,d]=plane, candidate={id:'a',center:{x:300,y:400},painted:{},floorRadius:22};
    const point=([u,v])=>({x:300+(a*u+c*v)*size,y:400+(b*u+d*v)*size});
    projectedContactHit(candidate,contact,size*(Math.abs(a)+Math.abs(c)),size*(Math.abs(b)+Math.abs(d)),plane);
    assert.equal(candidate.contains(point([0,0])),true);
    assert.equal(candidate.contains(point([.49,0])),true);
    assert.equal(candidate.contains(point([.49,.49])),false,'empty corners do not steal a neighbouring marker');
    assert.equal(candidate.contains(point([1.125,0])),false,'the other stack member keeps its hit');
    assert.equal(candidate.floorRadius,22,'44px minimum stays screen-facing');
  }
});

test('#1119 asymmetric screen-facing badge boxes are re-derived rather than rotated old contours', () => {
  const marker = { id: 'a', x: 400, y: 500, diameter: 20, box: { left: -10, right: 40, top: -10, bottom: 10 } };
  const source = new DeviceContactScene([marker], []), before = JSON.stringify([...source.shapes]);
  const points = [[400,500], [500,400], [600,500], [500,600]];
  for (const [i, rotation] of [0,90,180,270].entries()) {
    const view = screenContactScene(source, rotation), shape = view.shapes.get('a'), b = contactBounds(shape);
    assert.deepEqual([shape.marker.x,shape.marker.y], points[i]);
    assert.deepEqual(shape.marker.box, marker.box);
    assert.equal(b.right-b.left, 50); assert.equal(b.bottom-b.top, 20, 'badge remains upright in every quarter');
    assert.equal(contactContains(shape, [points[i][0]+20,points[i][1]]), true);
    assert.equal(contactContains(shape, [points[i][0],points[i][1]+20]), false, 'old rotated tall envelope is not clickable');
  }
  assert.equal(JSON.stringify([...source.shapes]), before, 'authored scene and placement remain unchanged');
});

test('#1119 wall faces, normals and masonry share the exact quarter-turn frame', () => {
  // Native contact adds 0.009375D of empty shell padding; use its actual face.
  const source = new DeviceContactScene([{ id:'a',x:400.1875,y:500,diameter:20,box:{left:-10,right:10,top:-10,bottom:10} }],
    [{id:'wall',a:[390,450],b:[390,550],normal:[1,0]}], [[[[390,450],[390,550],[380,550],[380,450],[390,450]]]], true);
  const before = JSON.stringify({walls:source.walls,masonry:source.masonry});
  assert.ok(Object.values(source.shapes.get('a').walls).includes('wall'), 'fixture is a real native wall contact');
  const view = screenContactScene(source, 90);
  assert.deepEqual([view.walls[0].id,view.walls[0].a,view.walls[0].b], ['wall',[550,390],[450,390]]);
  assert.equal(Math.abs(view.walls[0].normal[0]),0); assert.equal(view.walls[0].normal[1],1);
  assert.deepEqual(view.masonry[0][0][0], [550,390]);
  assert.ok(Object.values(view.shapes.get('a').walls).includes('wall'));
  assert.equal(JSON.stringify({walls:source.walls,masonry:source.masonry}), before);
});

test('#1517 flat half-turn preserves a live middle badge in a row and a column', () => {
  const body = (id, x, y) => ({id,x,y,diameter:40,box:{left:-25.375,right:25.375,top:-25.375,bottom:25.375}});
  const withBadge = (marker, extra) => ({...marker,box:{...marker.box,right:marker.box.right+extra}});
  for (const [orientation, authored] of [
    ['row', [body('a',200,400),withBadge(body('b',245,400),60),body('c',350,400)]],
    ['column', [body('a',600,300),withBadge(body('b',600,345),60),body('c',600,390)]],
  ]) {
    const [a,b,c] = authored;
    const restore = JSON.stringify(authored);
    for (const turned of [false, true]) {
      // Construct cold at either angle: the durable basis and native face
      // remain the same even if this is the first frame of an external screen.
      const layout = new DeviceContactLayout();
      const measure = (width) => {
        const input = [a,withBadge(body('b',b.x,b.y),width),c];
        const shapes = layout.resolve(input,[],[],new Map(authored.map(m=>[m.id,m])),
          'floor',new Map(),turned);
        const scene=screenContactScene(new DeviceContactScene(shapes,[]),turned?180:0,turned);
        assert.deepEqual([...scene.edges.get('b')].sort(),['a','c'],orientation);
        const ordered=['a','b','c'].map(id=>scene.shapes.get(id).marker);
        if (orientation==='column') assert.ok(ordered.every(m=>m.x===ordered[0].x),'keeps the uprights aligned');
        assert.equal(ordered[1].box.left,b.box.left,'badge remains on the right on screen');
        const bounds=ordered.map(m=>[m.x+m.box.left,m.x+m.box.right]);
        if (orientation==='row') {
          const neighbour=turned?bounds[0]:bounds[2];
          assert.ok(bounds[1][1] <= neighbour[0] + 6,'only the normal shell join may overlap');
        }
        return {extent:Math.max(...bounds.map(([,right])=>right))-Math.min(...bounds.map(([left])=>left)),ordered};
      };
      const base = measure(60);
      const wide = measure(150);
      assert.ok(wide.extent > base.extent + 80,'the group widens with the middle value');
      assert.deepEqual(measure(60),base,'returning to the small badge does not drift');
      assert.equal(JSON.stringify(authored),restore);
    }
  }
});
