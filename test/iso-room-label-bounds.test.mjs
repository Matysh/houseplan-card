import test from 'node:test';
import assert from 'node:assert/strict';
import { isoRoomLabelBounds } from '../test-build/iso-room-label-bounds.js';
import { isoFloorMatrix, isoCameraFor } from '../test-build/iso-projection.js';
import { renderIsoLabFurniture } from '../test-build/iso-lab-furniture-render.js';

test('#1470 bounds preserve the anchor and normalized mask coordinates at all turns',()=>{
  for(const turn of [0,90,180,270]) for(const width of [1920,3840]) for(const zoom of [1,2.18]) {
    const height=width*.55,view={x:-70,y:110,w:1200/zoom,h:660/zoom},anchor=[420,360];
    const [a,b,c,d]=isoFloorMatrix(isoCameraFor(turn));
    const box=isoRoomLabelBounds(anchor,view,[width,height],[310,70],[a,b,c,d,-155,-35],[155,35]);
    assert.ok(box.width>64&&box.height>64);
    const close=(x,y)=>assert.ok(Math.abs(x-y)<1e-9,`${x} != ${y}`);
    close(box.left+box.labelX,(anchor[0]-view.x)/view.w*width);
    close(box.top+box.labelY,(anchor[1]-view.y)/view.h*height);
    // A silhouette point has exactly the same camera pixel before and after
    // changing the mask from full viewport to this local object bounding box.
    for(const p of [[400,300],[500,420],[-50,600]]) {
      close(box.left+(p[0]-box.scene.x)/box.scene.w*box.width,(p[0]-view.x)/view.w*width);
      close(box.top+(p[1]-box.scene.y)/box.scene.h*box.height,(p[1]-view.y)/view.h*height);
    }
    assert.ok(box.width*box.height<width*height*.15,'paint allocation is label-sized');
  }
});

test('#1470 absent/zero or non-finite geometry cannot allocate an invalid surface',()=>{
  const args=[[2,3],{x:0,y:0,w:10,h:10},[100,100],[20,10],[1,0,0,1,-10,-5],[10,5]];
  assert.ok(isoRoomLabelBounds(...args));
  for(const index of [0,2,3,4,5]) {
    const invalid=structuredClone(args);invalid[index][0]=NaN;
    assert.equal(isoRoomLabelBounds(...invalid),undefined);
  }
  for(const key of ['x','y','w','h']) {const invalid=structuredClone(args);invalid[1][key]=NaN;assert.equal(isoRoomLabelBounds(...invalid),undefined);}
  for(const index of [2,3]) {const invalid=structuredClone(args);invalid[index][0]=0;assert.equal(isoRoomLabelBounds(...invalid),undefined);}
});

test('#1470 absolute metrics wider and lower than the name remain inside the mask',()=>{
  const args=[[500,500],{x:0,y:0,w:1000,h:1000},[1000,1000],[100,20],
    [1,0,0,1,-50,-10],[50,10]];
  const name=isoRoomLabelBounds(...args),metrics=isoRoomLabelBounds(...args,[-150,0,400,65]);
  assert.ok(metrics.width>name.width&&metrics.height>name.height);
  assert.ok(metrics.left<=300&&metrics.top<=490);
  assert.ok(metrics.left+metrics.width>=700&&metrics.top+metrics.height>=555);
});

test('#1470 furniture light is isolated and clipped to the same two part faces',()=>{
  const text=value=>Array.isArray(value)?value.map(text).join(''):value?.strings
    ? value.strings.reduce((out,part,i)=>out+part+(i<value.values.length?text(value.values[i]):''),'')
    : value===null||value===undefined?'':String(value);
  const mesh={shadow:'M0 0L1 1',lightBox:[-2,-3,10,20],parts:[
    {name:'test',side:'M1 2L3 4',top:'M5 6L7 8',depth:1,lightOffset:[11,-13]},
  ]};
  const lit=text(renderIsoLabFurniture(mesh,'fictional','desk','#123456',.7,1,false,4));
  assert.match(lit,/<clipPath id=hp-surface-light-4-0>/);
  assert.match(lit,/<path d=M1 2L3 4><\/path><path d=M5 6L7 8><\/path>/);
  assert.match(lit,/clip-path=url\(#hp-surface-light-4-0\)/);
  assert.match(lit,/opacity=".8" stroke="none" style="isolation:isolate"/);
  assert.match(lit,/<use href="#hp-room-light-pools" transform=translate\(11 -13\)>/);
  assert.doesNotMatch(lit,/<pattern/);
  assert.doesNotMatch(text(renderIsoLabFurniture(mesh,'fictional','desk','#123456',.7,1,false)),/hp-room-light-pools|clipPath/);
});
