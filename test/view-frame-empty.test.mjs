import test from 'node:test';
import assert from 'node:assert/strict';
import {nothing} from 'lit';
import {renderHomeArrow} from '../test-build/view-frame-view.js';
import {contentFrame} from '../test-build/space-geometry.js';

const base=[0,0,1000,1000],outside={x:1500,y:0,w:1000,h:1000};
test('#1329 empty content never points to its fallback or editor-grown frame',()=>{
  const frame=contentFrame([]);
  assert.equal(frame.all,null);
  for(const rotation of [0,90,180,270])
    assert.equal(renderHomeArrow(base,outside,rotation,'Home',()=>assert.fail('no action'),frame.all!==null),nothing);
});
test('#1329 genuine roomless content keeps its offscreen arrow, but not inside the view',()=>{
  for(const item of [{minX:0,minY:0,maxX:1000,maxY:0},{minX:100,minY:100,maxX:100,maxY:100}]){
    const frame=contentFrame([item]);
    assert.ok(frame.all);
    for(const rotation of [0,90,180,270]){
      assert.notEqual(renderHomeArrow(base,outside,rotation,'Home',()=>{},frame.all!==null),nothing);
      assert.equal(renderHomeArrow(base,{x:0,y:0,w:1000,h:1000},rotation,'Home',()=>{},true),nothing);
    }
  }
});
