import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freePartitionEnds, patchPartitionEndpoint, openingPropertiesCore, selectOpeningReference, refreshOpeningReference, patchOpeningProperties, propertiesOpeningSides } from '../test-build/editors/properties/physical.js';
import { buildOpeningDimensionContext } from '../test-build/opening-dimensions.js';
const wall = { id: 'wall', a: [0, 0], b: [1, 0], cm: 12 };
const opening = { id: 'door', type: 'door', x: .3, y: 0, length: .1, angle: 0, host: { kind: 'partition', id: 'wall', t: .3 }, contact: 'binary_sensor.door', invert: true, future: null };

test('#931 independent endpoints use topology, including interior T/X and an endpoint inside a wall', () => {
  assert.deepEqual(freePartitionEnds(wall, [wall]), [true, true]);
  assert.deepEqual(freePartitionEnds(wall, [wall, { id: 't', a: [0,-1], b: [0,1] }]), [false, true]);
  assert.deepEqual(freePartitionEnds(wall, [wall, { id: 'x', a: [.5,-1], b: [.5,1] }]), [false, false]);
});

test('#931 changing one free end keeps fixed-end opening distance; not-fit and new intersections reject the whole candidate', () => {
  const result = patchPartitionEndpoint(wall, 'b', 0, 1.5, [wall], [opening], 5);
  assert.equal(result.wall.b[0], 1.5);
  assert.ok(Math.abs(result.openings[0].x - .3) < 1e-12);
  assert.equal(result.openings[0].contact, opening.contact); assert.equal(result.openings[0].future, null);
  const fromB = patchPartitionEndpoint(wall, 'a', 0, -.5, [wall], [opening], 5);
  assert.ok(Math.abs(1 - fromB.openings[0].x - .7) < 1e-12);
  assert.equal(patchPartitionEndpoint(wall, 'b', 0, .2, [wall], [opening], 5), null);
  const other = { id: 'new', a: [1.2,-1], b: [1.2,1] };
  assert.equal(patchPartitionEndpoint(wall, 'b', 0, 1.5, [wall, other], [], 5), null);
  assert.equal(wall.b[0], 1); assert.equal(opening.x, .3);
});

test('#931 gap uses the physical resolver reference, remains fixed across the midpoint, and width keeps centre', () => {
  const context = buildOpeningDimensionContext({ rooms: [], walls: [], openCuts: [], partitions: [{ ...wall, a: [0,0], b: [1000,0] }], pitch: 1/240, cellCm: 5, gridPitch: 1000/240, coordScale: 1000 });
  const core = openingPropertiesCore(opening, [wall], [], 5);
  const ref = selectOpeningReference(core, context);
  assert.equal(ref.source, 'host-end'); assert.equal(ref.to[0], 0); assert.equal(ref.distance, 250);
  const moved = patchOpeningProperties(opening, 'gap', 780, core, ref, [wall], [], 5);
  assert.ok(Math.abs(moved.x - .7) < 1e-12, 'gap is 650 render units + half-width 50, not centre distance');
  const afterCore = openingPropertiesCore(moved, [wall], [], 5);
  const sameRef = refreshOpeningReference(afterCore, context, ref);
  assert.equal(sameRef.to[0], 0); assert.ok(Math.abs(sameRef.distance - 650) < 1e-9);
  const resized = patchOpeningProperties(moved, 'length', 240, afterCore, sameRef, [wall], [], 5);
  assert.equal(resized.x, moved.x); assert.equal(resized.length, .2);
  assert.equal(resized.contact, opening.contact); assert.equal(resized.invert, true);
  assert.equal(patchOpeningProperties(moved, 'length', 601, afterCore, sameRef, [wall], [], 5), null);
  assert.equal(patchOpeningProperties(moved, 'gap', 1200, afterCore, sameRef, [wall], [], 5), null);
});

test('#931 opening side labels use containing rooms, outside or explicit A/B, never guessed names',()=>{
  const core={x:50,y:50,angle:0,target:{physicalHalfWidth:2}};
  const upper={id:'u',name:'Upstairs',poly:[[0,0],[100,0],[100,50],[0,50]]};
  const lower={id:'l',name:'Kitchen',poly:[[0,50],[100,50],[100,100],[0,100]]};
  assert.deepEqual(propertiesOpeningSides(core,[upper,lower]),[{kind:'room',name:'Upstairs'},{kind:'room',name:'Kitchen'}]);
  assert.deepEqual(propertiesOpeningSides(core,[upper,lower],[1,-1]),[{kind:'room',name:'Kitchen'},{kind:'room',name:'Upstairs'}]);
  assert.deepEqual(propertiesOpeningSides(core,[lower]),[{kind:'outside'},{kind:'room',name:'Kitchen'}]);
  for(const rooms of [[],[upper,lower,{...lower,id:'duplicate'}],[{...upper,name:''},lower],[upper,{...lower,name:upper.name}]])
    assert.deepEqual(propertiesOpeningSides(core,rooms),[{kind:'fallback',side:'A'},{kind:'fallback',side:'B'}]);
});
