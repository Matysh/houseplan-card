import {checkSpacePhysicalGeometry,prepareSpacePhysicalGeometryInputs} from '../../test-build/plan-geometry-preflight.js';
import {spaceModels} from '../../test-build/space-geometry.js';
import {wallBodiesGeometry} from '../../test-build/wall-thickness.js';
import {commitWallSegmentModel} from '../../test-build/wall-segment-model.js';
import {floorGeometryKeyReader} from '../../test-build/floor-geometry-key.js';
import {CommandStack} from '../../test-build/command-stack.js';
import {PhysicalWriteHistory} from '../../test-build/physical-write-history.js';
globalThis.window ??= {customCards:[]};
globalThis.location ??= {pathname:'/'};
const {HouseplanCard}=await import('../../test-build/houseplan-card.js');
const {HouseplanEditorRuntime}=await import('../../test-build/houseplan-editor-runtime.js');
export const clone=value=>JSON.parse(JSON.stringify(value));
const square=(id,x,y,size)=>({id,poly:[[x,y],[x+size,y],[x+size,y+size],[x,y+size]]});
export function historyFixture({large=false,stairsCase=false}={}){
 const rooms=[square('left',.01,.01,.03),square('right',.04,.01,.03)];
 if(large)for(let x=0;x<12;x++)for(let y=0;y<12;y++)rooms.push(square('grid-'+x+'-'+y,.12+x*.06,.12+y*.06,.04));
 if(stairsCase)rooms.push(square('stair-room',.3,.3,.3));
 const floor=(id,list)=>({id,title:id,cell_cm:5,rooms:list,walls:list.flatMap(r=>r.poly.map((a,i)=>({a,b:r.poly[(i+1)%4],cm:10})))});
 const config=commitWallSegmentModel({spaces:[floor('a',rooms),floor('b',[square('b-room',.1,.1,.2)]),floor('c',[square('c-room',.1,.1,.2)])],markers:[],settings:{}}).config;
 if(stairsCase)config.spaces[0].stairs=[{id:'stair',x:.45,y:.45,width:.1,length:.2,angle:0,direction:'forward',kind:'straight'}];
 return config;
}
export function historyHarness(config=historyFixture(),{diagnostics=true}={}){
 const counts={preflight:0,union:0,save:0,deviceRebuild:0},checks=[],toasts=[],wallArguments=[],wallResults=[];
 const host={_serverCfg:clone(config),_space:'a',_loadOk:true,_cfgEpoch:0,_cfgRev:1,_pendingPhysicalWrites:new Map(),
  _geometryHistory:new CommandStack(50),_modelCache:null,_frame:null,_regSignature:'warm',_activeWallChainId:null,
  _wallUnionPool:new Map(),_physicalBodiesPool:new Map(),_wallUnionCacheValue:null,_physicalBodiesEntry:null,
  _floorCacheBuilds:{wallUnion:0,physicalBodies:0},requestUpdate(){},_canCommitSpace:()=>true,
  _t:(key,params)=>key+(params?JSON.stringify(params):''),_showToast:text=>toasts.push(text),
  _maybeRebuildDevices(){counts.deviceRebuild++;},_saveConfigDebounced(){counts.save++;}};
 let remembered;
 const input=()=>{
  const raw=host._serverCfg.spaces.find(s=>s.id===host._space);
  if(!remembered||remembered.raw!==raw||remembered.epoch!==host._cfgEpoch){
   const model=spaceModels({...host._serverCfg,spaces:[raw]})[0];
   remembered={raw,epoch:host._cfgEpoch,value:prepareSpacePhysicalGeometryInputs(raw,model)};
  }return remembered.value;
 };
 Object.defineProperties(host,{
  _renderCfg:{get:()=>host._serverCfg},_curSpaceCfg:{get:()=>host._serverCfg.spaces.find(s=>s.id===host._space)},
  _cellCm:{get:()=>input().cellCm},_gridPitch:{get:()=>input().gridPitch},_wallKeyPitch:{get:()=>input().wallKeyPitch},
  _spaceWalls:{get:()=>input().walls},
  _wallUnionCache:Object.getOwnPropertyDescriptor(HouseplanCard.prototype,'_wallUnionCache'),
  _physicalBodiesCache:Object.getOwnPropertyDescriptor(HouseplanCard.prototype,'_physicalBodiesCache'),
 });
 host._floorKey=floorGeometryKeyReader(host);
 host._spaceModel=()=>input().space;host._openCuts=()=>input().openCuts;
 host._partitionOpeningCuts=()=>input().partitionCuts;host._roomWallOpeningInputs=()=>input().roomOpenings;
 host._physicalBodiesR=HouseplanCard.prototype._physicalBodiesR;host._wallUnionGeometry=HouseplanCard.prototype._wallUnionGeometry;
 host._checkSpacePhysicalGeometry=(candidate,id,capture)=>{
  counts.preflight++;if(diagnostics)checks.push(clone(candidate));
  return checkSpacePhysicalGeometry(candidate,id,{wallPass:(...args)=>{counts.union++;if(diagnostics)wallArguments.push(clone(args));const geometry=wallBodiesGeometry(...args);if(diagnostics)wallResults.push(clone(geometry));return geometry;},captureWallGeometry:(_inputs,g)=>capture?.(g)});
 };
 const runtime=Object.assign(Object.create(HouseplanEditorRuntime.prototype),{host,physicalWriteHistory:new PhysicalWriteHistory(),
  decorLine:{snapshot:null,reset(){},restore(){}},_clearGeometryGesture(){},_showGeometrySpace(id){host._space=id;}});
 const warm=id=>{host._space=id;return host._wallUnionGeometry();};
 const command=(name,change)=>{
  const before=runtime._geometrySnapshot('a');change(host._serverCfg.spaces[0]);
  host._serverCfg=commitWallSegmentModel(host._serverCfg).config;host._cfgEpoch++;
  runtime._recordGeometry(name,before);
  // The fixture starts after the initial command's accepted-write boundary.
  runtime.physicalWriteHistory.accept(before,runtime.physicalWriteHistory.capture(before));
  return host._geometryHistory.peekUndo();
 };
 return{host,runtime,counts,checks,toasts,wallArguments,wallResults,warm,command};
}
export const historyChanges={
 thickness(space){for(const w of space.wall_segments||[])w.cm=20;for(const w of space.walls||[])w.cm=20;},
 transform(space){space.plan_x=.2;space.plan_scale=1.25;},
 stairs(space){space.stairs[0].x+=.05;space.stairs[0].y+=.02;},
};
