import {fixtureWallKey} from './wall-key.mjs';
const rect=(id,x,y,w,h)=>({id,name:id,poly:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]});
function space(id,rooms,partitions=[]){
 const walls=new Map();
 for(const room of rooms)room.wall_ids=room.poly.map((a,i)=>{
  const b=room.poly[(i+1)%room.poly.length],key=fixtureWallKey(a,b),old=walls.get(key);
  if(old)return old.id;const wall={id:'w'+walls.size,a,b,cm:15,key};walls.set(key,wall);return wall.id;
 });
 return{id,title:id,cell_cm:5,view_box:[0,0,1,1],rooms,partitions,
  wall_segments:[...walls.values()].map(({key,...wall})=>wall),walls:[...walls.values()].map(({id,...wall})=>wall),
  wall_columns:[],openings:[],settings:{show_borders:true,fill_mode:'none'}};
}
export function directWallScenes(){return[
 space('shared-rooms',[rect('a',.1,.1,.4,.8),rect('b',.5,.1,.4,.8)]),
 space('diagonal',[{id:'triangle',poly:[[.1,.85],[.9,.85],[.4,.12]]}]),
 space('acute-inherited',[{id:'acute',poly:[[.49,.9],[.51,.9],[.5,.1]]}]),
 space('courtyard',[rect('top',.1,.1,.8,.2),rect('bottom',.1,.7,.8,.2),rect('left',.1,.3,.2,.4),rect('right',.7,.3,.2,.4)]),
 space('mixed-junctions',[rect('room',.1,.1,.8,.8)],[
  {id:'horizontal',a:[.2,.45],b:[.8,.45],cm:15},
  {id:'vertical',a:[.5,.2],b:[.5,.8],cm:25},
  {id:'diagonal',a:[.2,.65],b:[.35,.8],cm:10},
  {id:'diagonal-arm',a:[.35,.8],b:[.6,.65],cm:20},
 ]),
 space('short-support',[rect('room',.1,.1,.8,.8)],[
  {id:'thick',a:[.45,.45],b:[.455,.45],cm:30},
  {id:'thin',a:[.45,.45],b:[.45,.8],cm:8},
 ]),
 space('two-ray-acute',[],[
  {id:'one',a:[.25,.5],b:[.85,.5],cm:12},
  {id:'two',a:[.25,.5],b:[.25+.6*Math.cos(Math.PI/9),.5+.6*Math.sin(Math.PI/9)],cm:20},
 ]),
 space('corner-partition',[rect('room',.1,.1,.8,.8)],[
  {id:'corner',a:[.1,.1],b:[.55,.55],cm:25},
 ]),
 space('concave',[{id:'room',poly:[[.1,.1],[.9,.1],[.9,.4],[.45,.4],[.45,.9],[.1,.9]]}]),
];}
