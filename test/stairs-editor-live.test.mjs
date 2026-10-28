import test from 'node:test';
import assert from 'node:assert/strict';
import { StairEditorRuntime } from '../test-build/stairs-editor.js';
const stair={id:'s',kind:'straight',x:.4,y:.4,angle:0,direction:'forward',length:.2,width:.1};
const ev=(x,y)=>({pointerId:1,clientX:x,clientY:y,shiftKey:false,preventDefault(){},stopPropagation(){},currentTarget:{setPointerCapture(){}}});
function setup(){
  let saves=0,history=0,updates=0;
  const host={_curSpaceCfg:{stairs:[structuredClone(stair)]},_mode:'plan',_tool:'select',_cfgEpoch:1,_modelCache:null,
    _gridPitch:4,_cellCm:5,_wallKeyPitch:4,_spaceWalls:[],_model:[],_space:'A',_decorStyle:{color:'#000',opacity:1},
    _spaceModel:()=>undefined,_rawPhysicalBodiesR:()=>[],_openCuts:()=>[],_svgPoint:e=>[e.clientX,e.clientY],
    _geometrySnapshot:()=>structuredClone(host._curSpaceCfg),_recordGeometry:()=>history++,_saveConfigDebounced:()=>saves++,
    _t:k=>k,requestUpdate:()=>updates++};
  return {host,editor:new StairEditorRuntime(host),counts:()=>({saves,history,updates})};
}
test('#1098 thirty stair moves are transient and commit only once',()=>{
 const {host,editor,counts}=setup();editor.pointerDown(ev(400,400),stair,'move');
 for(let i=1;i<=30;i++)editor.pointerMove(ev(400+i,400+i));
 assert.deepEqual(host._curSpaceCfg.stairs,[stair],'the raw record is untouched before pointerup');
 assert.equal(host._cfgEpoch,1);assert.equal(counts().saves,0);assert.equal(counts().history,0);
 editor.pointerUp(ev(430,430));assert.equal(host._cfgEpoch,2);assert.equal(counts().saves,1);assert.equal(counts().history,1);
 assert.equal(host._curSpaceCfg.stairs[0].x,.43);assert.equal(host._curSpaceCfg.stairs[0].y,.43);
});
test('#1098 stair cancel and Escape never write or bump the epoch',()=>{
 for(const finish of [(e)=>e.pointerCancel(ev(430,430)),(e)=>e.escape()]){
  const {host,editor,counts}=setup();editor.pointerDown(ev(400,400),stair,'move');editor.pointerMove(ev(430,430));finish(editor);
  assert.deepEqual(host._curSpaceCfg.stairs,[stair]);assert.equal(host._cfgEpoch,1);assert.equal(counts().saves,0);assert.equal(counts().history,0);
 }
});
test('#1098 stair commit preserves future fields and uses existing persisted scalar precision',()=>{
 const {host,editor}=setup(),raw=host._curSpaceCfg.stairs[0];raw.future={keep:[1,2]};
 editor.pointerDown(ev(400,400),raw,'move');editor.pointerMove(ev(430.33333333333,400));editor.pointerUp(ev(430.33333333333,400));
 assert.deepEqual(host._curSpaceCfg.stairs[0].future,{keep:[1,2]});
 assert.equal(host._curSpaceCfg.stairs[0].x,.430333333);
});