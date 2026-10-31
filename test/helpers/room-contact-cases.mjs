// Independent synthetic regressions. No support-report geometry is used here.
import {commitWallSegmentModel} from '../../test-build/wall-segment-model.js';

export function roomContactCases(){
  const base=space=>({model_version:10,spaces:[{id:'synthetic',title:'Synthetic',cell_cm:5,
    view_box:[0,0,1,1],rooms:[],...space}],markers:[],settings:{}});
  const partition=(id,a,b)=>({id,a,b,cm:15});
  const split=(gap=0)=>commitWallSegmentModel(base({partitions:[
    partition('top',[0,0],[1,0]),partition('right',[1,0],[1,1]),
    partition('bottom',[1,1],[0,1]),partition('left',[0,1],[0,0]),
    partition('divider',[.5,gap],[.5,1]),
  ],openings:[{id:'door',type:'door',x:gap?.5:.75,y:gap?.6:0,
    angle:gap?90:0,length:.1,host:{kind:'partition',id:gap?'divider':'top',t:gap?(.6-gap)/(1-gap):.75}}]})).config;
  const cavity=commitWallSegmentModel(base({rooms:[
    {id:'west',x:.1,y:.1,w:.2,h:.6},{id:'east',x:.5,y:.1,w:.2,h:.6},
    {id:'north',x:.3,y:.1,w:.2,h:.2},{id:'south',x:.3,y:.5,w:.2,h:.2},
  ].map(room=>({...room,name:room.id,area:null}))})).config;
  return [
    {name:'hosted-split',config:split(),clicks:[[250,500],[750,500]]},
    {name:'hosted-existing-t',config:split(1e-7),clicks:[[250,500],[750,500]]},
    {name:'existing-wall-cavity',config:cavity,clicks:[[400,400]]},
  ];
}
