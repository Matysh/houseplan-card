import test from 'node:test';
import assert from 'node:assert/strict';
import {getDocument, OPS} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {writePdf} from '../test-build/pdf/pdf-writer.js';
import {buildPdfPage} from '../test-build/pdf/pdf-scene.js';
import {pdfCommandBounds, rotatePdfCommands, translatePdfCommands, centerPdfScene} from '../test-build/pdf/pdf-layout.js';
import {spaceModels} from '../test-build/space-geometry.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
const clipped={kind:'vector',width:2,stroke:[0,0,0],ops:[{op:'M',x:-100,y:-100},
  {op:'L',x:200,y:200}],clip:[[[10,20],[30,20],[30,40],[10,40]]]};

test('#1451 vector crop follows rotation and centering; discarded art cannot enlarge fit',()=>{
  assert.deepEqual(pdfCommandBounds([clipped]),{minX:10,minY:20,maxX:30,maxY:40});
  const rotated=rotatePdfCommands([clipped],90);
  assert.deepEqual(pdfCommandBounds(rotated),{minX:-40,minY:10,maxX:-20,maxY:30});
  const shifted=translatePdfCommands(rotated,7,-4);
  assert.deepEqual(pdfCommandBounds(shifted),{minX:-33,minY:6,maxX:-13,maxY:26});
  assert.deepEqual(shifted[0].clip[0],[[-13,6],[-13,26],[-33,26],[-33,6]]);
  const centered=centerPdfScene([clipped],{minX:0,minY:0,maxX:100,maxY:100});
  assert.deepEqual(centered.bounds,{minX:40,minY:40,maxX:60,maxY:60});
  assert.deepEqual(centered.commands[0].clip[0],[[40,40],[60,40],[60,60],[40,60]]);
});

test('#1451 PDF writer scopes the even-odd crop to its vector only',async()=>{
  const next={kind:'vector',width:1,stroke:[0,0,0],ops:[{op:'M',x:80,y:80},{op:'L',x:120,y:80}]};
  const page={width:200,height:200,now:new Date('2026-11-18T00:00:00Z'),commands:[clipped,next]};
  const bytes=writePdf(page),raw=new TextDecoder('latin1').decode(bytes);
  assert.equal((raw.match(/W\*\nn/g)||[]).length,1);
  assert.match(raw,/S\nQ\nq\n0 0 0 RG 1 w/,'crop restores before the ordinary vector');
  const task=getDocument({data:bytes,useWorkerFetch:false,isEvalSupported:false});
  try{
    const document=await task.promise,operators=await(await document.getPage(1)).getOperatorList();
    assert.equal(operators.fnArray.filter(op=>op===OPS.eoClip).length,1);
    const index=operators.fnArray.indexOf(OPS.eoClip);
    assert.ok(operators.fnArray.slice(index+1).includes(OPS.restore),'a PDF restore ends this crop');
  }finally{await task.destroy();}
});

test('#1451 empty crop paints nothing and ordinary vectors retain exact bounds',()=>{
  const next={kind:'vector',width:2,stroke:[0,0,0],ops:[{op:'M',x:80,y:80},{op:'L',x:120,y:80}]};
  const commands=[{...clipped,clip:[]},next];
  assert.deepEqual(pdfCommandBounds(commands),pdfCommandBounds([next]));
  const page={width:200,height:200,commands,now:new Date('2026-11-18T00:00:00Z')};
  assert.deepEqual(writePdf(page),writePdf({...page,commands:[next]}));
});

const shapes=(angle=0,flip_h=false,flip_v=false)=>[
  {id:'desk',kind:'furniture',symbol:'desk',x:.2,y:.2,w:.28,h:.14,angle,flip_h,flip_v,
    workstation:'mounted',workstation_tower_id:'tower'},
  {id:'tower',kind:'furniture',symbol:'computer',x:.65,y:.65,w:.025,h:.06,angle,flip_h,flip_v,
    workstation:'tower'},
];

function page(decor,rotation=0){
  const raw={id:'floor',title:'Floor',view_box:[0,0,1,1],cell_cm:5,
    rooms:[{id:'room',name:'Room',poly:[[0,0],[1,0],[1,1],[0,1]],wall_ids:['a','b','c','d']}],
    wall_segments:[{id:'a',a:[0,0],b:[1,0],cm:0},{id:'b',a:[1,0],b:[1,1],cm:0},
      {id:'c',a:[1,1],b:[0,1],cm:0},{id:'d',a:[0,1],b:[0,0],cm:0}],
    walls:[],partitions:[],wall_columns:[],openings:[],decor,settings:{}};
  const config={model_version:10,spaces:[raw],markers:[],settings:{}},frozen=structuredClone(config);
  const result=buildPdfPage({config,rawSpace:raw,space:spaceModels(config)[0],layout:{},rotation,
    options:{dimensions:false,decor:true,roomNames:false,backdrop:false},imperial:false,
    cardTitle:'House',version:'test',now:new Date('2026-11-18T00:00:00Z'),t:key=>key});
  assert.deepEqual(config,frozen,'printing must not rewrite the plan');
  return result;
}

test('#1451 PDF uses real desktop and tower crops at the current angle and mirror',()=>{
  for(const angle of [0,37,90])for(const flip_h of [false,true])for(const flip_v of [false,true]){
    const result=page(shapes(angle,flip_h,flip_v),90);
    const crop=result.commands.filter(command=>command.kind==='vector'&&command.clip);
    assert.equal(crop.length,2,'mounted equipment plus one independent tower');
    const ratio=ring=>Math.hypot(ring[1][0]-ring[0][0],ring[1][1]-ring[0][1])/
      Math.hypot(ring[2][0]-ring[1][0],ring[2][1]-ring[1][1]);
    near(ratio(crop[0].clip[0]),80/60,'equipment occupies its source 80×60 crop');
    near(ratio(crop[1].clip[0]),.025/.06,'tower has its own footprint, not the 120×60 full artwork');
    for(const command of crop){
      const visible=pdfCommandBounds([command]);
      const ring=command.clip[0];
      assert.ok(visible.minX>=Math.min(...ring.map(p=>p[0]))-1e-9);
      assert.ok(visible.maxX<=Math.max(...ring.map(p=>p[0]))+1e-9);
      assert.ok(visible.minY>=Math.min(...ring.map(p=>p[1]))-1e-9);
      assert.ok(visible.maxY<=Math.max(...ring.map(p=>p[1]))+1e-9);
    }
    assert.ok(result.sceneBounds.minX>=result.planField.minX-.01);
    assert.ok(result.sceneBounds.maxX<=result.planField.maxX+.01);
  }
});

test('#1451 ordinary furniture keeps its old vector representation without clip',()=>{
  const decor=shapes().map(({workstation,workstation_tower_id,...shape})=>shape);
  assert.equal(page(decor).commands.filter(command=>command.kind==='vector'&&command.clip).length,0);
});
