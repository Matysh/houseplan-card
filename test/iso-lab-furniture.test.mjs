import test from 'node:test';
import assert from 'node:assert/strict';
import { furnitureParts, furniturePlanPoint, furnitureFootprint, furnitureMesh, furnitureViewDepth, FURNITURE_HEIGHT_SCALE } from '../test-build/iso-lab-furniture.js';
import { projectPlanPoint } from '../test-build/iso-projection.js';
import {FURNITURE_VOLUME_RUNTIME} from '../test-build/furniture-volume-runtime.js';
await FURNITURE_VOLUME_RUNTIME.ensure();

const camera={rotDeg:35,tiltDeg:50,xyScale:1,zScale:1,origin:[500,500],floorScaleY:Math.sin(40*Math.PI/180)};
const box={symbol:'sofa',x:.15,y:.27,w:.23,h:.12};
const points=d=>[...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m=>[Number(m[1]),Number(m[2])]);
const close=(a,b)=>assert.ok(Math.abs(a-b)<.0002,`${a} != ${b}`);

test('Furniture has meaningful separate heights and all components fit the saved footprint',()=>{
  const sofa=furnitureParts('sofa'),table=furnitureParts('coffee_table'),bed=furnitureParts('bed_double');
  const height=(parts,name)=>parts.find(p=>p.name===name).top;
  assert.ok(height(table,'tabletop')<height(sofa,'seat-left'));
  assert.ok(height(sofa,'seat-left')<height(sofa,'arm-left'));
  assert.ok(height(sofa,'arm-left')<height(sofa,'back-left'));
  assert.ok(height(bed,'mattress')<height(bed,'pillow-left'));
  assert.ok(height(bed,'pillow-left')<height(bed,'headboard'));
  for(const p of [...sofa,...table,...bed]){
    assert.ok(p.bottom>=0&&p.top>p.bottom);
    for(const [x,y] of furnitureFootprint(p,230,120)) assert.ok(x>=0&&x<=1&&y>=0&&y<=1);
  }
});

test('Native furniture anchor, centered rotation and mirror contract is preserved',()=>{
  const original=structuredClone(box);
  assert.deepEqual(furniturePlanPoint(box,[0,0],1000,800),[150,216]);
  assert.deepEqual(furniturePlanPoint({...box,flip_h:true,flip_v:true},[0,0],1000,800),[380,312]);
  for(const angle of [0,35,90,180,270]){
    const center=furniturePlanPoint({...box,angle,flip_h:true},[.5,.5],1000,800);
    close(center[0],265); close(center[1],264);
  }
  assert.deepEqual(box,original);
});

test('Each mesh top projects directly above its unchanged footprint at every camera turn and flip',()=>{
  for(const symbol of ['sofa','coffee_table','bed_double']) for(const turn of [0,90,180,270])
    for(const flip_h of [false,true]) for(const flip_v of [false,true]){
      const shape={...box,symbol,angle:23,flip_h,flip_v},c={...camera,rotDeg:35+turn};
      const mesh=furnitureMesh(shape,1000,800,c);
      for(const p of furnitureParts(symbol)){
        let footprint=furnitureFootprint(p,230,96).map(v=>furniturePlanPoint(shape,v,1000,800));
        if(flip_h!==flip_v)footprint.reverse();
        const rendered=points(mesh.parts.find(m=>m.name===p.name).top);
        assert.equal(rendered.length,footprint.length);
        for(let i=0;i<rendered.length;i++){
          const actual=projectPlanPoint(rendered[i],0,c);
          const expected=projectPlanPoint(footprint[i],p.top*FURNITURE_HEIGHT_SCALE,c);
          close(actual[0],expected[0]);close(actual[1],expected[1]);
        }
        assert.ok(mesh.parts.find(m=>m.name===p.name).side.length>0);
      }
    }
});

test('Unsupported or invalid furniture uses the original flat fallback',()=>{
  assert.equal(furnitureMesh({...box,symbol:'future_symbol'},1000,1000,camera),null);
  assert.equal(furnitureMesh({...box,w:0},1000,1000,camera),null);
  assert.equal(furnitureMesh({...box,x:NaN},1000,1000,camera),null);
});

test('A farther table paints before the sofa; turning around reverses the order',()=>{
  const sofa={...box,x:.1458,y:.2667},table={...box,x:.2,y:.1875,w:.12,h:.07};
  assert.ok(furnitureViewDepth(table,1000,1000,camera)<furnitureViewDepth(sofa,1000,1000,camera));
  const reverse={...camera,rotDeg:camera.rotDeg+180};
  assert.ok(furnitureViewDepth(table,1000,1000,reverse)>furnitureViewDepth(sofa,1000,1000,reverse));
});

test('Mattress and tabletop never cover their raised details or paint under their supports',()=>{
  for(const turn of [0,90,180,270]){
    const c={...camera,rotDeg:35+turn};
    const bed=furnitureMesh({...box,symbol:'bed_double'},1000,1000,c).parts.map(p=>p.name);
    assert.ok(bed.indexOf('frame')<bed.indexOf('mattress'));
    for(const name of ['pillow-left','pillow-right','duvet'])assert.ok(bed.indexOf('mattress')<bed.indexOf(name));
    const table=furnitureMesh({...box,symbol:'coffee_table'},1000,1000,c).parts.map(p=>p.name);
    for(let i=0;i<4;i++)assert.ok(table.indexOf('leg-'+i)<table.indexOf('tabletop'));
  }
});
