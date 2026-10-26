import { makeVisualMatrixFixture, fixtureWallKey } from './visual-matrix.mjs';

/** Shared fictional light, exterior window and column; no private floor data. */
export function makeInteriorWindowFixture({ partition = false, oblique = false, led = false } = {}) {
  const fixture = makeVisualMatrixFixture();
  const angle = oblique ? 20 : 0, rad = angle*Math.PI/180;
  const rotate = ([x,y]) => [0.5+(x-.5)*Math.cos(rad)-(y-.5)*Math.sin(rad),
    0.5+(x-.5)*Math.sin(rad)+(y-.5)*Math.cos(rad)];
  const rooms = [
    {id:'left',name:'Source',area:'living_room',poly:[[.08,.12],[.5,.12],[.5,.88],[.08,.88]]},
    {id:'right',name:'Receiving room',area:'kitchen',poly:[[.5,.12],[.92,.12],[.92,.88],[.5,.88]]},
  ].map(room=>({...room,poly:room.poly.map(rotate)}));
  const walls=[...new Map(rooms.flatMap(room=>room.poly.map((a,i)=>{
    const b=room.poly[(i+1)%room.poly.length],key=fixtureWallKey(a,b);
    return [key,{key,a,b,cm:partition?40:30}];
  }))).values()];
  const [ex,ey]=rotate([.08,.5]);
  fixture.config.spaces=[{
    id:'f1',title:'Interior glass',cell_cm:5,view_box:[0,0,1,1],plan_url:null,rooms,walls,
    wall_segments:[],partitions:partition?[{id:'glass-host',a:rotate([.5,.12]),b:rotate([.5,.88]),cm:40}]:[],
    wall_columns:[{id:'shadow-column',shape:'square',center:rotate([.72,.5]),cm:80,angle}],
    openings:[
      {id:'inner-glass',type:'window',x:.5,y:.5,angle:90+angle,length:.18,contact:'binary_sensor.window',
        ...(partition?{host:{kind:'partition',id:'glass-host',t:.5}}:{})},
      {id:'outer-glass',type:'window',x:ex,y:ey,angle:90+angle,length:.18},
    ],
    decor:[],settings:{fill_mode:'none',show_borders:true,show_names:true,glow_enabled:true,
      sun_rays:false,wall_fill:{c:'#8b9197',a:1}},
    led_strips:led?[{id:'glass-led',marker:'d_light1',points:[rotate([.28,.44]),rotate([.28,.56])]}]:[],
  }];
  fixture.config.markers=[{id:'d_light1',binding:'device:d_light1',space:'f1',room_id:'left',glow_radius_cm:1500}];
  fixture.config.settings={...fixture.config.settings,glow_enabled:true,glow_radius_cm:1500,
    sun_rays:false,moon_enabled:false,filter_seeded:true,known_devices:['d_light1'],new_device_ids:[]};
  fixture.devices={d_light1:{id:'d_light1',name:'Indoor lamp',area_id:'living_room',config_entries:['fixture'],
    manufacturer:'Fixture',model:'Light',disabled_by:null}};
  fixture.entities={
    'light.ceiling':{entity_id:'light.ceiling',device_id:'d_light1',platform:'demo',disabled_by:null},
    'binary_sensor.window':{entity_id:'binary_sensor.window',device_id:'d_light1',platform:'demo',disabled_by:null},
  };
  fixture.states={
    'light.ceiling':{entity_id:'light.ceiling',state:'on',attributes:{friendly_name:'Indoor lamp',brightness:255,
      supported_color_modes:['rgb'],color_mode:'rgb',rgb_color:[255,210,120]}},
    'binary_sensor.window':{entity_id:'binary_sensor.window',state:'off',attributes:{device_class:'window'}},
  };
  fixture.areas={living_room:{area_id:'living_room',name:'Source'},kitchen:{area_id:'kitchen',name:'Receiving room'}};
  const [x,y]=rotate([.28,.5]);
  fixture.layout={d_light1:{s:'f1',x,y}};
  fixture.windowLightProbes={target:rotate([.6,.5]),shadow:rotate([.85,.5])};
  return fixture;
}
