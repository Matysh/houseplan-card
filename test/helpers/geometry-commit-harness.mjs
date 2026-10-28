import {checkSpacePhysicalGeometry} from '../../test-build/plan-geometry-preflight.js';
import {wallBodiesGeometry} from '../../test-build/wall-thickness.js';
import {junctionLimitViolations} from '../../test-build/junction-limits.js';
import {commitWallSegmentModel} from '../../test-build/wall-segment-model.js';
globalThis.window ??= {customCards:[]};
const {HouseplanEditorRuntime}=await import(process.env.HP_GEOMETRY_RUNTIME || '../../test-build/houseplan-editor-runtime.js');
export const clone=x=>JSON.parse(JSON.stringify(x));
export function square(id,x=0,y=0){const poly=[[x,y],[x+2,y],[x+2,y+2],[x,y+2]];const walls=poly.map((a,i)=>({id:id+'-w'+i,a,b:poly[(i+1)%4],cm:10}));return {id,title:id,cell_cm:1,rooms:[{id:id+'-r',name:'Room',poly,wall_ids:walls.map(w=>w.id)}],wall_segments:walls};}
export function fixture(){return commitWallSegmentModel({model_version:10,spaces:[square('f'),square('g',4),square('h',8)],markers:[],settings:{}}).config;}
export function harness(config=fixture()){
 const counts={preflight:0,junction:0,baseline:0,candidate:0},toasts=[],history=[];
 const host={_serverCfg:clone(config),_space:'f',_path:[],_pendingPhysicalWrites:new Map(),_cfgEpoch:0,requestUpdate(){},_t:k=>k,_showToast:m=>toasts.push(m),_saveConfigDebounced(){},_canEdit:true,_readOnly:false};
 const runtime=Object.assign(Object.create(HouseplanEditorRuntime.prototype),{host,_junctionBaselineCache:new Map(),_clearGeometryGesture(){},_recordGeometry:(name,before)=>history.push({name,before:clone(before)}),_saveConfig(){}});
 host._checkSpacePhysicalGeometry=(c,id,capture)=>checkSpacePhysicalGeometry(c,id,{wallPass:(...args)=>{counts.preflight++;counts.candidate++;return wallBodiesGeometry(...args);},captureWallGeometry:(_input,g)=>capture?.(g)});
 host._junctionLimitViolations=(c,id,shared,rooms)=>{if(!shared){counts.junction++;if(c===host._serverCfg)counts.candidate++;else counts.baseline++;}return runtime._junctionLimitViolations(c,id,shared,rooms);};
 return {runtime,host,counts,toasts,history};
}
export const scenarios={
 thickness(sp){for(const w of sp.wall_segments||[])w.cm=20;for(const w of sp.walls||[])w.cm=20;},
 column(sp){sp.wall_columns=[{id:'col',shape:'square',center:[1,1],cm:20,angle:0}];},
 split(sp){sp.rooms=[{id:'left',poly:[[0,0],[1,0],[1,2],[0,2]]},{id:'right',poly:[[1,0],[2,0],[2,2],[1,2]]}];},
 merge(sp){sp.rooms=[{id:'merged',poly:[[0,0],[4,0],[4,2],[0,2]]}];}
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
 thickness(sp){const ids=new Set(sp.rooms[0].wall_ids);for(const w of sp.wall_segments)if(ids.has(w.id))w.cm=20;for(const w of sp.walls||[])if(sp.rooms[0].poly.some(p=>p[0]===w.a[0]&&p[1]===w.a[1]))w.cm=20;},
 split(sp){sp.rooms.splice(0,1,{id:'split-a',poly:[[0,0],[1,0],[1,2],[0,2]]},{id:'split-b',poly:[[1,0],[2,0],[2,2],[1,2]]});},
 merge(sp){sp.rooms.splice(0,2,{id:'merged',poly:[[0,0],[4,0],[4,2],[0,2]]});},
 column:scenarios.column,
};