import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { makeLargeHouseFixture } from '../demo/fixtures/large-house.mjs';
import { prepareFloorGeometry, isFloorGeometryFrame } from '../test-build/floor-geometry-frame.js';
import { physicalFloorFingerprint, cleanFloorFingerprint } from '../test-build/floor-geometry-key.js';
import { decodeGeometryText } from '../test-build/floor-cache-codec.js';
import { restoreIsoCache, resolveIsoScene } from '../test-build/iso-scene-geometry.js';
import { isoCameraFor } from '../test-build/iso-projection.js';

test('#1451 worker preparation and main hydration share the accepted camera at all four stored quarter turns', async () => {
  const raw = makeLargeHouseFixture({floors:1,roomsPerFloor:1,devices:0,openings:2,
    partitions:0,columns:1,decor:0,stairs:0}).config.spaces[0];
  const input = {raw,floorKey:raw.id+'|'+physicalFloorFingerprint(raw),
    cleanKey:raw.id+'|'+cleanFloorFingerprint(raw),projection:'iso'};
  const before = structuredClone(raw);
  const main = await prepareFloorGeometry(input);
  const prepareUrl = new URL('../test-build/floor-geometry-frame.js',import.meta.url).href;
  const codecUrl = new URL('../test-build/floor-cache-codec.js',import.meta.url).href;
  const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');
    if(typeof document!=='undefined'||typeof location!=='undefined') throw Error('expected a genuine worker environment');
    (async()=>{const {prepareFloorGeometry}=await import(${JSON.stringify(prepareUrl)});
      const {encodeGeometryText}=await import(${JSON.stringify(codecUrl)});
      parentPort.postMessage(encodeGeometryText(await prepareFloorGeometry(workerData)));})();`,
  {eval:true,workerData:input});
  try {
    const text = await new Promise((resolve,reject)=>{
      worker.once('message',resolve);worker.once('error',reject);
      worker.once('exit',code=>{if(code)reject(Error('worker exited '+code));});
    });
    const restored = decodeGeometryText(text);
    assert.ok(isFloorGeometryFrame(restored,input));
    assert.equal(restored.iso.key,main.iso.key,'worker and main identify the same structural producer');
    assert.deepEqual(restored.iso.value.physical.roundColumnRings,main.iso.value.physical.roundColumnRings);
    const entry = restoreIsoCache(restored.iso.value);
    const cache = new Map([[restored.iso.key,entry]]);
    const source = {key:restored.iso.key,build(){throw Error('hydration must not repeat physical geometry')}};
    for (const rotation of [0,90,180,270]) {
      const scene = resolveIsoScene({source,cache,cellCm:5,liveFrame:{x:0,y:0,w:1000,h:1000},rotation});
      assert.equal(scene.camera,isoCameraFor(rotation));
      assert.equal(scene.camera.rotDeg,35+rotation);
      assert.equal(scene.camera.floorScaleY,Math.sin(40*Math.PI/180));
      assert.deepEqual(scene.openings,main.iso.value.physical.openings);
      const expected = rotation ? restored.iso.value.projections.get(rotation) : restored.iso.value.entry;
      assert.equal(scene.geometry,expected.geometry,'the projected variant is reused, not rebuilt');
    }
    assert.deepEqual(raw,before,'preparation and navigation never migrate saved geometry');
  } finally { await worker.terminate(); }
});
