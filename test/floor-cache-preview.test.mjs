import test from 'node:test';
import assert from 'node:assert/strict';
import { validFloorPreview, captureFloorPreview, renderFloorPreview } from '../test-build/floor-cache-preview.js';
const rectangle={x:0,y:0,w:100,h:100};
const fit={frame:{rect:rectangle,all:rectangle,outliers:0,hasContent:true},base:[0,0,100,100],display:rectangle,projection:'flat',rotation:0};
const sample=()=>({version:1,fitKey:'a'.repeat(64),fit:structuredClone(fit),shapes:[{tag:'path',attributes:{d:'M0 0 L1 1 Z'},transforms:['matrix(1 0 0 1 0 0)'],role:'wall'}]});
test('#1454 passive SVG only accepts the bounded geometry vocabulary',()=>{
  assert.equal(validFloorPreview(sample()),true);assert.notEqual(renderFloorPreview(sample()),undefined);
  for(const mutate of [
    p=>p.shapes[0].tag='foreignObject',p=>p.shapes[0].attributes.href='https://private.invalid',
    p=>p.shapes[0].attributes.onclick='alert(1)',p=>p.shapes[0].attributes.style='fill:url(https://private.invalid)',
    p=>p.shapes[0].attributes.d='M0 1e999 L2 3',p=>p.shapes[0].transforms=['url(https://private.invalid)'],
    p=>p.shapes[0].transforms=['matrix(1 0 0 1 1e999 0)'],p=>p.fit.frame.rect.w=NaN,
    p=>p.shapes.push(...Array(20001).fill(p.shapes[0])),p=>p.fit.frame.devs=['private-device'],
    p=>p.liveStates={private:true},p=>p.fit.base[2]=0,p=>p.shapes[0].role='device',
  ]){const value=sample();mutate(value);assert.equal(validFloorPreview(value),false);}
  assert.equal(validFloorPreview(sample(),'b'.repeat(64)),false);
});
test('#1454 capture picks anonymous calculated extents, not the structurally typed runtime frame',()=>{
  let reads=0;const frame={...fit.frame,get model(){reads++;throw Error('private model read')},devs:['private-device'],layout:{private:1}};
  const captured=captureFloorPreview({querySelectorAll(){return[]}}, {...fit,frame},'a'.repeat(64));
  assert.ok(captured);assert.equal(reads,0);assert.equal(JSON.stringify(captured).includes('private'),false);
  assert.deepEqual(captured.fit.frame,fit.frame);
});
