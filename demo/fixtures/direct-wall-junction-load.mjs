/** Pinned synthetic small plan: diagonal/acute rooms and a mixed eight-ray node. */
import {makeSelectiveInvalidationFixture} from './selective-invalidation.mjs';
import {fixtureWallKey} from './wall-key.mjs';
export function directWallJunctionLoad(){
 const fixture=makeSelectiveInvalidationFixture(false);
 for(const space of fixture.config.spaces){
  const rooms=[{id:space.id+'-r0',name:'Diagonal',poly:[[.05,.1],[.4,.1],[.2,.65]]},
   {id:space.id+'-r1',name:'Junctions',poly:[[.45,.1],[.95,.1],[.95,.9],[.45,.9]]}];
  const segments=rooms.flatMap(room=>{
   room.wall_ids=room.poly.map((a,i)=>room.id+'-w'+i);
   return room.poly.map((a,i)=>({id:room.wall_ids[i],a,b:room.poly[(i+1)%room.poly.length],cm:i%2?20:15}));
  });
  const c=[.7,.5],ends=[[.88,.5],[.88,.68],[.7,.68],[.52,.68],[.52,.5],[.52,.32],[.7,.32],[.88,.32]];
  Object.assign(space,{rooms,wall_segments:segments,
   walls:segments.map(s=>({a:s.a,b:s.b,cm:s.cm,key:fixtureWallKey(s.a,s.b)})),
   partitions:[...ends.map((b,i)=>({id:space.id+'-ray'+i,a:c,b,cm:[15,10,25,12,15,10,25,12][i]})),
    {id:space.id+'-acute-a',a:[.1,.76],b:[.37,.76],cm:10},
    {id:space.id+'-acute-b',a:[.1,.76],b:[.37,.86],cm:15}],
   wall_columns:[{id:space.id+'-column',shape:'square',center:[.85,.8],cm:25,angle:15}],
   openings:[{id:space.id+'-door',type:'door',x:.7,y:.1,angle:0,length:.055,
    host:{kind:'wall',id:rooms[1].wall_ids[0],t:.5}},
    {id:space.id+'-junction-door',type:'door',x:.75,y:.5,angle:0,length:.025,
     host:{kind:'partition',id:space.id+'-ray0',t:5/18}}]});
 }
 return fixture;
}
