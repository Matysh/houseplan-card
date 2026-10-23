import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contactPositionExceptions } from '../test-build/device-contact-maintenance.js';
import { canonicalizeLayoutGeometry, canonicalizePosition } from '../test-build/coordinate-canonicalization.js';
import { deriveContactShape, CONTACT_EPS } from '../test-build/device-contact-geometry.js';
import { optimizePlans, PLAN_MODEL_VERSION } from '../test-build/plan-optimizer.js';
import { deviceContactFloor } from '../test-build/device-contact-floor.js';
import { DeviceContactScene } from '../test-build/device-contact-scene.js';
import { DeviceContactMagnet } from '../test-build/device-contact-snap.js';
import {makeContactBasis} from '../test-build/device-contact-basis.js';
import { spaceModels } from '../test-build/space-geometry.js';
import { wallKey } from '../test-build/wall-thickness.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/866-device-contacts.json',import.meta.url),'utf8'));
const box = {left:-.634375,right:.634375,top:-.634375,bottom:.634375};
const faces = ['a','b','unrelated'].map(id=>({id,space:'floor',diameterRatio:.08,box}));
const space = {id:'floor',title:'Floor',view_box:[0,0,1,1],rooms:[]};
const config = () => ({model_version:PLAN_MODEL_VERSION, spaces:[structuredClone(space)], settings:{},
  markers:faces.map(f=>({id:f.id,binding:'virtual',space:'floor',name:f.id}))});

test('#1003 Optimize proves materialised reference contacts despite a wider live face',()=>{
  const cfg=config(),layout=structuredClone(fixture.layout);
  for(const id of ['a','b']){
    const p=layout[id];
    p.contact_basis=makeContactBasis({id,x:p.x*1000,y:p.y*1000,diameter:80,
      box:{left:-50.75,right:50.75,top:-50.75,bottom:50.75}},'floor');
  }
  const wide=faces.map(f=>({...f,box:f.id==='a'?{...f.box,right:2}:f.box}));
  const result=optimizePlans(cfg,layout,{deviceContactFaces:wide});
  assert.deepEqual(result.layout.a,layout.a);assert.deepEqual(result.layout.b,layout.b);
  assert.deepEqual(optimizePlans(result.config,result.layout,{deviceContactFaces:wide}).layout,result.layout);
});

test('#866 Optimize protects proved contacts only, including exact future siblings and other floors', () => {
  const cfg = config(), input = structuredClone(fixture.layout), before = structuredClone(input);
  assert.deepEqual([...contactPositionExceptions(cfg.spaces,input,faces)].sort(),['a','b']);
  const result = optimizePlans(cfg,input,{deviceContactFaces:faces});
  assert.deepEqual(result.layout.a,input.a); assert.deepEqual(result.layout.b,input.b);
  assert.notEqual(result.layout.unrelated.x,input.unrelated.x);
  assert.notEqual(result.layout.rl_label.x,input.rl_label.x);
  assert.deepEqual(input,before);
  const again = optimizePlans(result.config,result.layout,{deviceContactFaces:faces});
  assert.deepEqual(again.layout,result.layout);
  const foreign = {...input,a:{...input.a,s:'gone'}};
  assert.equal(contactPositionExceptions(cfg.spaces,foreign,faces).size,0);
  const next = config(); next.spaces.push({...space,id:'upper'});
  const upstairs = {a:{...input.a,s:'upper'},b:{...input.b,s:'upper'}};
  assert.deepEqual([...contactPositionExceptions(next.spaces,upstairs,faces.map(f=>({...f,space:'upper'})))].sort(),['a','b']);
});

test('#866 valid physical wall contacts survive Optimize; removed/moved hosts do not get exemptions', () => {
  const cfg = config(); cfg.spaces[0].partitions=[{id:'wall',a:[.1,.1],b:[.9,.1],cm:20}];
  const layout={a:{s:'floor',x:.4,y:+((100+20/5*(1000/240)/2+80*.64375)/1000).toFixed(9)}};
  assert.equal(contactPositionExceptions(cfg.spaces,layout,faces).has('a'),true);
  assert.deepEqual(optimizePlans(cfg,layout,{deviceContactFaces:faces}).layout.a,layout.a);
  cfg.spaces[0].partitions=[];
  assert.equal(contactPositionExceptions(cfg.spaces,layout,faces).size,0);
  cfg.spaces[0].partitions=[{id:'wall',a:[.1,.2],b:[.9,.2],cm:20}];
  assert.equal(contactPositionExceptions(cfg.spaces,layout,faces).size,0);
});

test('#866 actual canonicalizer round trip: off-grid stays exact, near-node tails use fixed storage epsilon', () => {
  assert.deepEqual(canonicalizeLayoutGeometry(fixture.layout),fixture.layout);
  const p = canonicalizePosition({s:'floor',x:.4,y:.0499999,future:{kept:true}});
  assert.equal(p.y,.05); assert.deepEqual(p.future,{kept:true});
  const diameter=80, yFace=49.9999-diameter*.64375;
  const shape=deriveContactShape({id:'a',x:p.x*1000,y:p.y*1000,diameter,
    box:Object.fromEntries(Object.entries(box).map(([k,v])=>[k,v*diameter]))},
    [{id:'wall',a:[0,yFace],b:[1000,yFace],normal:[0,1]}]);
  assert.equal(Object.keys(shape.walls).length,1);
  assert.ok(CONTACT_EPS<.0005 && CONTACT_EPS>.0001);
});

test("#866 all canonical opening types cut snap faces, including static's door/window holes",()=>{
  const poly=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]];
  for(const type of ['door','window','passage']){
    const cfg={spaces:[{...space,rooms:[{id:'r',poly}],walls:poly.map((a,i)=>({a,b:poly[(i+1)%4],key:wallKey(a,poly[(i+1)%4],1/240),cm:20})),
      openings:[{id:'opening',type,x:.5,y:.1,angle:0,length:.3}]}],settings:{},markers:[]};
    const model=spaceModels(cfg)[0],floor=deviceContactFloor(cfg.spaces[0],model);
    assert.equal(floor.safe,true);
    const m={id:'m',x:0,y:0,diameter:80,box:{left:-50.75,right:50.75,top:-50.75,bottom:50.75}};
    const scene=new DeviceContactScene([],floor.walls,floor.masonry);
    const canonical=(x,y)=>({x:canonicalizePosition({x:x/1000,y:y/1000}).x*1000,y:canonicalizePosition({x:x/1000,y:y/1000}).y*1000});
    const targetY=100+20/5*(1000/240)/2+80*.64375;
    assert.equal(new DeviceContactMagnet(scene,m,canonical).resolve(500,targetY,1,1),null,`${type}: no attachment across opening`);
    assert.equal(new DeviceContactMagnet(scene,m,canonical).resolve(200,targetY,1,1)?.kind,'wall',`${type}: solid neighbour remains available`);
  }
});
