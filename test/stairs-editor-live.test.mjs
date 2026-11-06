import test from 'node:test';
import assert from 'node:assert/strict';
import { StairEditorRuntime } from '../test-build/stairs-editor.js';
import { MAX_STAIRS_PER_SPACE } from '../test-build/stairs.js';
import { canonicalizeConfigGeometry } from '../test-build/coordinate-canonicalization.js';
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
const hoverEvent=(x=600,y=500,extra={})=>({...ev(x,y),pointerType:'mouse',isPrimary:true,buttons:0,button:-1,...extra});
const arm=(host,editor,kind)=>{
 host._activateMarkupTool=tool=>{host._tool=tool;};
 host._showToast=()=>{};
 editor.activatePlacement(kind);
};
for(const kind of ['straight','spiral']){
 test(`#1253 ${kind} hover is transient and exactly matches the next click`,()=>{
  const {host,editor,counts}=setup();arm(host,editor,kind);
  const before=structuredClone(host._curSpaceCfg);
  for(let i=0;i<30;i++)assert.equal(editor.pointerMove(hoverEvent(600+i,500)),true);
  assert.deepEqual(host._curSpaceCfg,before);assert.equal(host._cfgEpoch,1);
  assert.equal(counts().saves,0);assert.equal(counts().history,0);assert.equal(editor.dragging,false);
  const preview=structuredClone(editor.hoverStair);
  assert.equal(preview.kind,kind);assert.equal(editor.live,true);
  assert.equal(editor.stagePointerDown(hoverEvent(629,500,{button:0,buttons:1})),true);
  assert.equal(editor.hoverStair,null,'down transfers ownership to the existing draft');
  assert.equal(editor.dragging,true);
  editor.pointerUp(hoverEvent(629,500));
  const added=host._curSpaceCfg.stairs.at(-1);
  assert.deepEqual(canonicalizeConfigGeometry({spaces:[{stairs:[{...preview,id:added.id}]}]}).spaces[0].stairs[0],added,
    'preview agrees with the existing persisted scalar precision');
  assert.equal(counts().saves,1);assert.equal(counts().history,1);assert.equal(host._cfgEpoch,2);
 });
 test(`#1253 ${kind} hover follows style/context changes and clears without writes`,()=>{
  const {host,editor,counts}=setup();arm(host,editor,kind);
  editor.pointerMove(hoverEvent());
  host._decorStyle={color:'#ff0000',opacity:.45};host._cfgEpoch++;
  assert.equal(editor.hoverStair.color,'#ff0000');assert.equal(editor.hoverStair.opacity,.45);
  editor.clearPlacementPreview();assert.equal(editor.live,false);
  editor.pointerMove(hoverEvent());host._space='B';assert.equal(editor.hoverStair,null);
  editor.pointerMove(hoverEvent());host._tool='draw';assert.equal(editor.hoverStair,null);
  host._tool='stairs';assert.equal(editor.hoverStair,null,'old point cannot reappear after tool change');
  editor.pointerMove(hoverEvent());editor.beforeModeChange('view');host._mode='view';assert.equal(editor.live,false);
  assert.equal(counts().saves,0);assert.equal(counts().history,0);
 });
}
test('#1253 non-hover input keeps gesture placement; Esc consumes a cancelled draft tail',()=>{
 const {host,editor,counts}=setup();arm(host,editor,'straight');
 assert.equal(editor.pointerMove(hoverEvent(600,500,{pointerType:'touch'})),false);
 assert.equal(editor.hoverStair,null);
 assert.equal(editor.stagePointerDown(hoverEvent(600,500,{pointerType:'touch',button:0,buttons:1})),true);
 editor.pointerMove(hoverEvent(650,550,{pointerType:'touch',buttons:1}));
 assert.equal(editor.escape(),true);
 assert.equal(editor.pointerUp(hoverEvent(650,550,{pointerType:'touch'})),true);
 assert.equal(host._suppressClick,true);
 assert.equal(host._curSpaceCfg.stairs.length,1);assert.equal(host._cfgEpoch,1);
 assert.equal(counts().saves,0);assert.equal(counts().history,0);
 editor.stagePointerDown(hoverEvent(600,500,{pointerType:'touch',button:0,buttons:1}));
 editor.pointerUp(hoverEvent(600,500,{pointerType:'touch'}));
 assert.equal(host._curSpaceCfg.stairs.length,2);assert.equal(counts().saves,1);
});
test('#1253 hover clears on secondary navigation, kind switch, cancel and limit',()=>{
 const {host,editor,counts}=setup();arm(host,editor,'straight');
 editor.pointerMove(hoverEvent());editor.pointerMove(hoverEvent(600,500,{buttons:2}));assert.equal(editor.live,false);
 editor.pointerMove(hoverEvent());editor.activatePlacement('spiral');assert.equal(editor.hoverStair,null);
 editor.pointerMove(hoverEvent());assert.equal(editor.hoverStair.kind,'spiral');editor.pointerCancel(hoverEvent());assert.equal(editor.live,false);
 editor.pointerMove(hoverEvent());assert.equal(editor.escape(),true);editor.pointerUp(hoverEvent());
 editor.pointerMove(hoverEvent());host._curSpaceCfg.stairs=Array.from({length:MAX_STAIRS_PER_SPACE},(_,i)=>({...stair,id:`s${i}`}));
 assert.equal(editor.hoverStair,null);assert.equal(counts().saves,0);assert.equal(counts().history,0);
});for(const [kind,x] of [['straight',610],['spiral',590]]){
 test(`#1253 ${kind} hover includes a positive stair magnet`,()=>{
  const {host,editor}=setup();arm(host,editor,kind);
  editor.pointerMove(hoverEvent(x,400));
  const preview=structuredClone(editor.hoverStair);
  assert.notEqual(preview.x,x/1000,'fixture really engages a footprint magnet');
  editor.stagePointerDown(hoverEvent(x,400,{button:0,buttons:1}));editor.pointerUp(hoverEvent(x,400));
  const added=host._curSpaceCfg.stairs.at(-1);
  assert.deepEqual(canonicalizeConfigGeometry({spaces:[{stairs:[{...preview,id:added.id}]}]}).spaces[0].stairs[0],added);
 });
}