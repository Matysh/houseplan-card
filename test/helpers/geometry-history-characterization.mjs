import {historyFixture,historyHarness,historyChanges,clone} from './geometry-history-harness.mjs';
const extra={
 room(s){const r={id:'new-room',poly:[[.6,.6],[.7,.6],[.7,.7],[.6,.7]]};s.rooms.push(r);for(let i=0;i<4;i++)s.walls.push({a:r.poly[i],b:r.poly[(i+1)%4],cm:10});},
 wall(s){s.partitions=[{id:'new-wall',a:[.02,.025],b:[.03,.025],cm:5}];},
 opening(s){s.openings=[{id:'door',type:'door',x:.025,y:.01,angle:0,length:.01}];},
 column(s){s.wall_columns=[{id:'column',shape:'square',center:[.025,.025],cm:5,angle:0}];},
 split(s){s.rooms.splice(0,1,{id:'split-a',poly:[[.01,.01],[.025,.01],[.025,.04],[.01,.04]]},{id:'split-b',poly:[[.025,.01],[.04,.01],[.04,.04],[.025,.04]]});},
 merge(s){s.rooms.splice(0,2,{id:'merged',poly:[[.01,.01],[.07,.01],[.07,.04],[.01,.04]]});},
};
export const historyCases=[...Object.keys(historyChanges),...Object.keys(extra),'pre-v9','v9'];
export function historyCaseHarness(name){
 const config=historyFixture({stairsCase:name==='stairs'});
 if(name==='pre-v9'){delete config.model_version;for(const s of config.spaces){delete s.wall_segments;for(const r of s.rooms)delete r.wall_ids;}}
 if(name==='v9')config.model_version=9;
 const h=historyHarness(config),command=h.command(name,historyChanges[name]||extra[name]||historyChanges.thickness);
 if(!command)throw Error('No canonical history command '+name);
 return {h,command};
}
export function historyCharacterization(name){
 const original=crypto.randomUUID;let serial=0;crypto.randomUUID=()=>`00000000-0000-4000-8000-${String(++serial).padStart(12,'0')}`;
 try{
  const {h,command}=historyCaseHarness(name);
  const result={afterEdit:clone(h.host._serverCfg),steps:[]};
  for(const direction of ['undo','redo']){
   for(const id of ['a','b','c'])h.warm(id);h.host._space='a';
   const saves=h.counts.save,outcome=h.runtime._stepGeometryHistory(direction);h.warm('b');
   result.steps.push({direction,outcome,config:clone(h.host._serverCfg),toasts:[...h.toasts],
    stack:{size:h.host._geometryHistory.size,canUndo:h.host._geometryHistory.canUndo,canRedo:h.host._geometryHistory.canRedo,
     undoName:h.host._geometryHistory.undoName,redoName:h.host._geometryHistory.redoName,
     undoIdentity:h.host._geometryHistory.peekUndo()===command,redoIdentity:h.host._geometryHistory.peekRedo()===command},save:h.counts.save-saves});
  }return result;
 }finally{crypto.randomUUID=original;}
}
