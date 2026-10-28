import {harness,fixture,scenarios,clone} from './geometry-commit-harness.mjs';
import {captureMarkerRoomReferences,rewriteMarkerRoomReferences} from '../../test-build/room-reference-transaction.js';
function characterizeInput(name, freezeGuards){
 const cfg=fixture();
 if(name.includes('pre-v9')){delete cfg.model_version;for(const s of cfg.spaces){delete s.wall_segments;for(const r of s.rooms)delete r.wall_ids;}}
 if(name==='inherited')cfg.spaces[0].partitions=[{id:'short',a:[.5,.5],b:[.51,.5],cm:10}];
 if(name.startsWith('marker-'))cfg.markers=[{id:'m',space:'f',room_id:'f-r',vacuum:{segment_map:{one:'f-r'}}}];
 const h=harness(cfg),{runtime,host}=h;const before=runtime._geometrySnapshot('f');
 if(name.startsWith('marker-')){
  before.roomReferences=captureMarkerRoomReferences(host._serverCfg.markers);
  const deletion=name.includes('delete');
  host._serverCfg.markers=rewriteMarkerRoomReferences(host._serverCfg.markers,deletion?{kind:'delete',roomId:'f-r'}:{kind:'merge',dropId:'f-r',keepId:'merged'}).markers;
  if(deletion)host._serverCfg.spaces[0].rooms=[];else scenarios.merge(host._serverCfg.spaces[0]);
 }else (scenarios[name]||scenarios.thickness)(host._serverCfg.spaces[0]);
 if(name==='unsafe')host._serverCfg.spaces[0].wall_columns=[{id:'broken',shape:'rect',center:[NaN,0],cm:30,angle:0}];
 if(name==='introduced')host._serverCfg.spaces[0].partitions=[{id:'short',a:[.5,.5],b:[.51,.5],cm:10}];
 if(name==='migration-blocker')host._serverCfg.spaces[0].wall_segments.push(clone(host._serverCfg.spaces[0].wall_segments[0]));
 if(name.endsWith('-safe-refusal'))host._checkSpacePhysicalGeometry=()=>({ok:false});
 if(name.endsWith('-junction-refusal')){let calls=0;host._junctionLimitViolations=()=>++calls===2?[{rule:'length',subject:'short',actual:1,limit:20}]:[];}
 if(freezeGuards){
  const deepFreeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;};
  deepFreeze(host._serverCfg.markers);
  const restore=runtime._restoreGeometryStateLocal;
  // A rollback is an intentional marker writer; end the construction-only freeze at that boundary.
  runtime._restoreGeometryStateLocal=function(state){host._serverCfg.markers=clone(host._serverCfg.markers);return restore.call(this,state);};
 }
 const ok=runtime._commitPhysicalGeometry(name,before);
 return {ok,toasts:h.toasts,config:host._serverCfg,history:h.history};
}
export const characterizationCases=['thickness','split','merge','column','unsafe','introduced','inherited','pre-v9','migration-blocker',
 ...['merge','delete'].flatMap(k=>['','-safe-refusal','-junction-refusal'].map(t=>'marker-'+k+t)),
 ...['merge','delete'].flatMap(k=>['-safe-refusal','-junction-refusal'].map(t=>'marker-pre-v9-'+k+t))];
/** Entropy is an input boundary: compare the exact document under the same UUID stream. */
export function characterize(name, {freezeGuards=false}={}){
 const original=globalThis.crypto.randomUUID;let id=0;
 globalThis.crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`;
 try{return characterizeInput(name,freezeGuards);}finally{globalThis.crypto.randomUUID=original;}
}