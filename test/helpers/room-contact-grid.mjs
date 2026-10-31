import {commitWallSegmentModel} from '../../test-build/wall-segment-model.js';
import {wallKey} from '../../test-build/wall-thickness.js';
import {normalizeRoomAppearance} from '../../test-build/room-appearance.js';

export const inheritedY=0.312345678;
export function roomSource(height=inheritedY){
  const config=commitWallSegmentModel({model_version:10,settings:{},
    markers:[{id:'unrelated',binding:'virtual',is_light:true}],spaces:[{
    id:'floor',title:'Synthetic',view_box:[0,0,1,1],cell_cm:5,rooms:[{id:'old',name:'Old',area:null,
      poly:[[0,0],[0.25,0],[0.25,height],[0,height]]}],
    walls:[{key:wallKey([0,0],[0.25,0],1/240),a:[0,0],b:[0.25,0],cm:20}],
    partitions:[
      {id:'north',a:[0.25,0],b:[0.75,0],cm:20},
      {id:'south',a:[0.25,height],b:[0.75,height],cm:20},
      {id:'middle',a:[0.5,0],b:[0.5,height],cm:20},
      {id:'east',a:[0.75,0],b:[0.75,height],cm:20},
    ],
  },{id:'remote',title:'Other floor',view_box:[0,0,1,1],cell_cm:5,rooms:[],
    partitions:[{id:'remote-wall',a:[0.1,0.1],b:[0.2,0.1],cm:20}]}]}).config;
  const space=config.spaces[0];
  space.rooms[0].future_room={retain:true};
  space.wall_segments[0].future_wall={retain:true};
  space.openings=[{id:'old-window',type:'window',x:0.125,y:0,angle:0,length:0.05,
    host:{kind:'wall',id:space.rooms[0].wall_ids[0],t:0.5},future_opening:{retain:true}}];
  return normalizeRoomAppearance(commitWallSegmentModel(config).config);
}
export function graphSources(space){
  return [...space.wall_segments,...space.partitions].map(p=>({key:p.id,
    a:p.a.map(n=>n*1000),b:p.b.map(n=>n*1000)}));
}

/** Compare generated IDs bijectively; retain identity across every state of each recipe. */
export function stableRoomReceiptIds(records,{preserveSourceIdentities=false}={}){
  const result=structuredClone(records),ids=new Map();
  const configs=row=>preserveSourceIdentities?[row.original,row.source,...row.candidates].filter(Boolean):[row.source,...row.candidates];
  if(preserveSourceIdentities)for(const row of result)for(const config of configs(row))
    for(const space of config.spaces)for(const p of space.partitions||[])ids.set(p.id,p.id);
  for(const row of result)for(const config of configs(row)){
    for(const space of config.spaces)for(const wall of space.wall_segments||[])
      if(!ids.has(wall.id))ids.set(wall.id,`wall-ordinal-${ids.size}`);
  }
  const ref=id=>{if(!ids.has(id))throw new Error(`Missing allocated wall reference: ${id}`);return ids.get(id);};
  for(const row of result)for(const config of configs(row))for(const space of config.spaces){
    for(const wall of space.wall_segments||[])wall.id=ref(wall.id);
    for(const room of space.rooms||[])if(room.wall_ids)room.wall_ids=room.wall_ids.map(ref);
    for(const opening of space.openings||[])if(opening.host?.kind==='wall')opening.host.id=ref(opening.host.id);
  }
  for(const row of result){
    const inherited=new Set(row.source.spaces.flatMap(space=>(space.rooms||[]).map(room=>room.id)));
    const created=new Map();
    for(const config of [row.source,...row.candidates])for(const space of config.spaces)
      for(const room of space.rooms||[])if(!inherited.has(room.id)){
        if(!created.has(room.id))created.set(room.id,`created-room-${created.size}`);
        room.id=created.get(room.id);
      }
  }
  return result;
}
