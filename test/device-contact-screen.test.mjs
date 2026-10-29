import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceContactScene, contactBounds } from '../test-build/device-contact-scene.js';
import { contactContains } from '../test-build/device-contact-geometry.js';
import { screenContactScene } from '../test-build/device-contact-screen.js';

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
