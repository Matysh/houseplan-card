// #1171: independently authored fictional geometry, never a support export.
import { fixtureWallKey } from './wall-key.mjs';

export function makeStaticWallOpeningsFixture({ diagonal = false, linePlan = false } = {}) {
  const edges = [
    ['north', [.125,.1875], [.625,.1875], 30],
    ['north-east', [.625,.1875], [.975,.1875], 18],
    ['shared', [.625,.1875], [.625,.8125], 24],
    ['east', [.975,.1875], [.975,.8125], 18],
    ['south-east', [.625,.8125], [.975,.8125], 18],
    ['south', [.125,.8125], [.625,.8125], 30],
    ['west', [.125,.1875], [.125,.8125], 30],
  ];
  const turn = ([x,y]) => diagonal
    ? [.5 + (x-y)/Math.SQRT2, .5 + (x+y-1)/Math.SQRT2] : [x,y];
  const wall_segments = edges.map(([id,a,b,cm])=>({ id,a:turn(a),b:turn(b),cm }));
  const walls = wall_segments.map(({a,b,cm})=>({a,b,cm,key:fixtureWallKey(a,b)}));
  const room = (id, poly, wall_ids, color) => ({ id, name:id, area:null,
    poly:poly.map(turn), wall_ids,
    settings:{fill_mode:'custom',custom_fill:{c:color,a:.3}},
  });
  const openings = [
    {id:'wall-door',type:'door',x:.375,y:.1875,angle:0,length:.125,host:{kind:'wall',id:'north',t:.5}},
    {id:'shared-window',type:'window',x:.625,y:.4375,angle:90,length:.1,host:{kind:'wall',id:'shared',t:.4}},
    {id:'outer-gate',type:'gate',x:.8,y:.8125,angle:0,length:.15,host:{kind:'wall',id:'south-east',t:.5}},
    {id:'shared-passage',type:'passage',x:.625,y:.6875,angle:90,length:.08,host:{kind:'wall',id:'shared',t:.8}},
    {id:'legacy-window',type:'window',x:.975,y:.375,angle:90,length:.1},
    {id:'partition-door',type:'door',length:.075,host:{kind:'partition',id:'divider',t:.5}},
  ].map(o=>o.x == null ? o : ({...o, x:turn([o.x,o.y])[0],y:turn([o.x,o.y])[1],angle:o.angle+(diagonal?45:0)}));
  const config = {model_version:10, markers:[], settings:{volumetric_view:false}, spaces:[{
    id:'f1',title:'Synthetic openings',cell_cm:5,view_box:[0,0,1.1,1],
    rooms:[
      room('Alpha',[[.125,.1875],[.625,.1875],[.625,.8125],[.125,.8125]],['north','shared','south','west'],'#ccddff'),
      room('Beta',[[.625,.1875],[.975,.1875],[.975,.8125],[.625,.8125]],['north-east','east','south-east','shared'],'#ffddaa'),
    ], wall_segments,walls,
    partitions:[{id:'divider',a:turn([.25,.5625]),b:turn([.5,.5625]),cm:14}],
    openings,settings:{show_borders:true,hide_openings:false,show_names:false,fill_mode:'none',glow_enabled:false},
  }]};
  if(linePlan){
    const s=config.spaces[0];s.walls=[];delete s.wall_segments;
    for(const room of s.rooms)delete room.wall_ids;
  }
  return config;
}
