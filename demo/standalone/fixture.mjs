import { currentGraphFixture } from '../helpers/graph-fixture.mjs';
export function standaloneFixture(){
  const poly=[[.1,.1],[.85,.1],[.85,.75],[.1,.75]];
  return currentGraphFixture({spaces:[{id:'local',title:'Local plan',cell_cm:5,view_box:[0,0,1,1],
    settings:{name_color:{c:'#485d6e',a:1},room_color:'#dce9ea',room_opacity:.4,bg_mode:'static'},
    rooms:[{id:'room',name:'Room',poly,settings:{fill_mode:'custom',custom_fill:{c:'#ddeeee',a:.4},name_scale:1.2}}],walls:poly.map((a,i)=>({a,b:poly[(i+1)%poly.length],cm:20})),wall_segments:[],
    partitions:[{id:'wall',a:[.2,.85],b:[.8,.85],cm:12}],
    openings:[{id:'door',type:'door',x:.4,y:.85,angle:0,length:.075,host:{kind:'partition',id:'wall',t:1/3},contact:'binary_sensor.door',lock:'lock.door',
      opening_features:{version:1,mechanism:'slide',manual:'closed',slide_direction:'end'}},
      {id:'window',type:'window',x:.6,y:.85,angle:0,length:.075,host:{kind:'partition',id:'wall',t:2/3},
        opening_features:{version:1,side:'negative',leaves:[
          {id:'leaf-a',hinge:'start',manual:'closed',contact:'binary_sensor.window_a',shade:{enabled:true,manual:'open',contact:'cover.shade_a'}},
          {id:'leaf-b',hinge:'end',manual:'closed',contact:'binary_sensor.window_b'}]}}],
    decor:[{id:'rect',kind:'rect',x:.2,y:.3,w:.2,h:.1,color:'#718b82',opacity:1,width_cm:2},
      {id:'text',kind:'text',x:.35,y:.4,text:'Value {sensor.private}',size:'m',color:'#718b82',opacity:1}],
    stairs:[{id:'stairs',kind:'straight',x:.6,y:.5,width:.15,length:.2,angle:0,direction:'forward',target_space_id:'upper'}],
    wall_columns:[{id:'column',shape:'square',center:[.7,.3],cm:50,angle:0}]},
    {id:'upper',title:'Upper',view_box:[0,0,1,1],rooms:[],walls:[],wall_segments:[],partitions:[],openings:[],decor:[],stairs:[]}],
    markers:[{id:'hidden',binding:'entity:light.kept',space:'local',room_id:'room'}],settings:{filter_seeded:true}});
}
