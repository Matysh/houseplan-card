import {commitWallSegmentModel} from '../../test-build/wall-segment-model.js';

export const inheritedY=0.312345678;
export function roomSource(){
  return commitWallSegmentModel({model_version:10,settings:{},markers:[],spaces:[{
    id:'floor',title:'Synthetic',view_box:[0,0,1,1],cell_cm:5,rooms:[{id:'old',name:'Old',area:null,
      poly:[[0,0],[0.25,0],[0.25,inheritedY],[0,inheritedY]]}],
    partitions:[
      {id:'north',a:[0.25,0],b:[0.75,0],cm:20},
      {id:'south',a:[0.25,inheritedY],b:[0.75,inheritedY],cm:20},
      {id:'middle',a:[0.5,0],b:[0.5,inheritedY],cm:20},
      {id:'east',a:[0.75,0],b:[0.75,inheritedY],cm:20},
    ],
  }]}).config;
}
export function graphSources(space){
  return [...space.wall_segments,...space.partitions].map(p=>({key:p.id,
    a:p.a.map(n=>n*1000),b:p.b.map(n=>n*1000)}));
}
