import {checkSpacePhysicalGeometry} from '../../test-build/plan-geometry-preflight.js';
import {wallBodiesGeometry} from '../../test-build/wall-thickness.js';
import {junctionLimitViolations} from '../../test-build/junction-limits.js';
import {commitWallSegmentModel} from '../../test-build/wall-segment-model.js';
import {commitGraphEditResult} from '../../test-build/graph-edit-intent.js';
globalThis.window ??= {customCards:[]};
const {HouseplanEditorRuntime}=await import(process.env.HP_GEOMETRY_RUNTIME || '../../test-build/houseplan-editor-runtime.js');
export const clone=x=>JSON.parse(JSON.stringify(x));
const authored = new WeakMap();
const structure = space => JSON.stringify(['rooms','wall_segments','walls','partitions'].map(key=>space[key]||[]));
export function authoredChange(space, intent, change) {
 const draft=clone(space);change(draft);
 if(!space.plan_graph){Object.assign(space,draft);authored.set(space,{structure:structure(space),intent});return;}
 const result=commitGraphEditResult(space,draft,intent);
 for(const key of Object.keys(space))delete space[key];Object.assign(space,result.space);
 authored.set(space,{structure:structure(space),intent});
}
export function square(id,x=0,y=0){const poly=[[x,y],[x+2,y],[x+2,y+2],[x,y+2]];const walls=poly.map((a,i)=>({id:id+'-w'+i,a,b:poly[(i+1)%4],cm:10}));return {id,title:id,cell_cm:1,rooms:[{id:id+'-r',name:'Room',poly,wall_ids:walls.map(w=>w.id)}],wall_segments:walls};}
export function fixture(){return commitWallSegmentModel({model_version:10,spaces:[square('f'),square('g',4),square('h',8)],markers:[],settings:{}}).config;}
export function harness(config=fixture()){
 const counts={preflight:0,junction:0,baseline:0,candidate:0},toasts=[],history=[];
 const host={_serverCfg:clone(config),_space:'f',_path:[],_pendingPhysicalWrites:new Map(),_cfgEpoch:0,requestUpdate(){},_t:k=>k,_showToast:m=>toasts.push(m),_saveConfigDebounced(){},_canEdit:true,_readOnly:false};
 const runtime=Object.assign(Object.create(HouseplanEditorRuntime.prototype),{host,_junctionBaselineCache:new Map(),_clearGeometryGesture(){},_recordGeometry:(name,before)=>history.push({name,before:clone(before)}),_saveConfig(){}});
 const physicalCommit=runtime._commitPhysicalGeometry;
 runtime._commitPhysicalGeometry=function(name,before,points=[],record=true,intent){
  const live=host._serverCfg?.spaces.find(space=>space.id===before?.spaceId);
  const authoredEdit=live&&authored.get(live),matches=authoredEdit?.structure===structure(live||{});
  const scoped=matches?(before?.plan_graph?{kind:'prepared',base:before.plan_graph}:authoredEdit.intent):{kind:'metadata'};
  return physicalCommit.call(this,name,before,points,record,intent||scoped);
 };
 host._checkSpacePhysicalGeometry=(c,id,capture)=>checkSpacePhysicalGeometry(c,id,{wallPass:(...args)=>{counts.preflight++;counts.candidate++;return wallBodiesGeometry(...args);},captureWallGeometry:(_input,g)=>capture?.(g)});
 host._junctionLimitViolations=(c,id,shared,rooms)=>{if(!shared){counts.junction++;if(c===host._serverCfg)counts.candidate++;else counts.baseline++;}return runtime._junctionLimitViolations(c,id,shared,rooms);};
 return {runtime,host,counts,toasts,history};
}
export const scenarios={
 thickness(sp){authoredChange(sp,{kind:'thickness',cm:20,rooms:sp.rooms.map(room=>room.id),edges:(sp.plan_graph?.edges||[]).map(({kind,id})=>({kind,id}))},draft=>{for(const w of draft.wall_segments||[])w.cm=20;for(const w of draft.walls||[])w.cm=20;});},
 column(sp){sp.wall_columns=[{id:'col',shape:'square',center:[1,1],cm:20,angle:0}];},
 split(sp){authoredChange(sp,{kind:'faces',rooms:['left','right'],removeRooms:sp.rooms.map(room=>room.id)},draft=>{draft.rooms=[{id:'left',poly:[[0,0],[1,0],[1,2],[0,2]]},{id:'right',poly:[[1,0],[2,0],[2,2],[1,2]]}];});},
 merge(sp){authoredChange(sp,{kind:'faces',rooms:['merged'],removeRooms:sp.rooms.map(room=>room.id)},draft=>{draft.rooms=[{id:'merged',poly:[[0,0],[4,0],[4,2],[0,2]]}];});}
};
/** 146 real rooms (the 12x12 workload plus an adjacent merge/split pair), three floors. */
export function largeFixture(){
 const rooms=[square('left').rooms[0],square('right',2).rooms[0]],walls=[];
 for(let x=0;x<12;x++)for(let y=0;y<12;y++)rooms.push(square('grid-'+x+'-'+y,10+x*3,10+y*3).rooms[0]);
 for(const room of rooms)delete room.wall_ids;
 for(const room of rooms)for(let i=0;i<room.poly.length;i++)walls.push({a:room.poly[i],b:room.poly[(i+1)%room.poly.length],cm:10});
 return commitWallSegmentModel({spaces:[{id:'f',title:'Large',cell_cm:1,rooms,walls},square('g',60),square('h',64)],markers:[],settings:{}}).config;
}
export const largeScenarios={
 thickness(sp){authoredChange(sp,{kind:'thickness',rooms:[sp.rooms[0].id],cm:20},()=>{});},
 // The UI composite split retains the parent room identity and adds a child.
 split(sp){const parent=sp.rooms[0].id;authoredChange(sp,{kind:'faces',rooms:[parent,'split-b']},draft=>{draft.rooms.splice(0,1,{...draft.rooms[0],poly:[[0,0],[1,0],[1,2],[0,2]]},{id:'split-b',poly:[[1,0],[2,0],[2,2],[1,2]]});});},
 merge(sp){authoredChange(sp,{kind:'merge-rooms',keep:sp.rooms[0].id,drop:sp.rooms[1].id},draft=>{const keep=draft.rooms[0];draft.rooms.splice(0,2,{...keep,poly:[[0,0],[4,0],[4,2],[0,2]]});});},
 column:scenarios.column,
};
