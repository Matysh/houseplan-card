import test from 'node:test';
import assert from 'node:assert/strict';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { spaceModels } from '../test-build/space-geometry.js';
import { innerContourForRoom, wallBodiesGeometry } from '../test-build/wall-thickness.js';
const raw = { model_version: 7, spaces: [{ id: 'wall-union-regression',
  title: 'Wall union regression', cell_cm: 1, view_box: [0, 0, 1, 1],
  rooms: [{ id: 'r1', poly: [
    [-1.670833333, 1.266666667], [-1.670833333, -0.208333333],
    [0.2875, -0.208333333], [0.2875, 1.266666667],
  ] }], walls: [{ key: '-0.691667,-0.208333@0.0000', cm: 30,
    a: [-1.670833333, -0.208333333], b: [0.2875, -0.208333333] }],
}], markers: [], settings: {} };
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;
function inputs(config) {
  const model=spaceModels(config)[0],walls=config.spaces[0].walls;
  const geometry=wallBodiesGeometry(model.rooms,walls,[],[],1/240,1,1000/240,1000);
  return {geometry,contour:()=>innerContourForRoom(model.rooms,'r1',walls,[],1/240,1,1000/240,1000,geometry.roomGeom,geometry.multiWallNodes)};
}
test('1232 original wall-union-regression/r1 survives model11 exact inner-floor subtraction',()=>{
  const source=JSON.stringify(raw),legacy=inputs(raw);
  assert.equal(legacy.geometry.status,'ok');assert.ok(legacy.contour().length>=3);
  const current=commitWallSegmentModel(raw).config,snapshot=JSON.stringify(current);
  assert.equal(current.model_version,11);
  for(const candidate of [current,JSON.parse(snapshot)]){
    const {geometry,contour}=inputs(candidate),saved=JSON.stringify(geometry);
    assert.equal(geometry.status,'ok');
    const floor=contour();assert.equal(floor.length,4);
    const bounds=[Math.min(...floor.map(p=>p[0])),Math.min(...floor.map(p=>p[1])),Math.max(...floor.map(p=>p[0])),Math.max(...floor.map(p=>p[1]))];
    const expected=[-1670.8333333333333,-145.83333333333334,287.5,1266.6666666666667];
    bounds.forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-6,`bound ${i}: ${value}`));
    assert.ok(Math.abs(area(floor)-(expected[2]-expected[0])*(expected[3]-expected[1]))<.002,'floor excludes exactly the 15cm inward half of the 30cm wall');
    assert.deepEqual(contour(),floor,'repeated render stable');
    assert.equal(JSON.stringify(geometry),saved,'shared physical masonry unchanged');
  }
  assert.equal(JSON.stringify(current),snapshot);assert.equal(JSON.stringify(raw),source);
});
