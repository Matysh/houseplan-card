// Independently authored rooms for #1383, not a support export.
import { migrateGraphSpace } from '../../test-build/plan-graph.js';
import { commitGraphEdit } from '../../test-build/graph-edit-intent.js';

export function makeResizeJunctionFixture(kind='tee') {
  const rect=(id,x0,y0,x1,y1)=>({id,name:id,area:null,poly:[[x0,y0],[x1,y0],[x1,y1],[x0,y1]]});
  let space=migrateGraphSpace({id:'resize-junctions',title:'Resize junctions',cell_cm:5,view_box:[0,0,1,1],
    rooms:[rect('left',.1,.1,.5,.5),rect('right',.5,.1,.9,.5),
      ...(kind==='cross'?[rect('lower-left',.1,.5,.5,.9),rect('lower-right',.5,.5,.9,.9)]
        :kind==='partition'?[]:[rect('lower',.1,.5,.9,.9)])],
    ...(kind==='partition'?{partitions:[{id:'outside',a:[.5,.5],b:[.5,.9],cm:24}]}:{}),
    settings:{show_borders:true,show_names:true,fill_mode:'none',glow_enabled:false},
  }).space;
  space=commitGraphEdit(space,structuredClone(space),{kind:'thickness',rooms:space.rooms.map(r=>r.id),cm:24});
  const openings=[
    {id:'moving-door',type:'door',x:.5,y:.3,angle:-90,length:.12},
    {id:'side-window',type:'window',x:.3,y:.1,angle:0,length:.1},
    {id:'bottom-door',type:'door',x:.73,y:.5,angle:0,length:.1},
  ].map(o=>{
    const edge=space.wall_segments.find(e=>o.angle===0?e.a[1]===o.y&&e.b[1]===o.y
      &&Math.min(e.a[0],e.b[0])<o.x&&Math.max(e.a[0],e.b[0])>o.x
      :e.a[0]===o.x&&e.b[0]===o.x&&Math.min(e.a[1],e.b[1])<o.y&&Math.max(e.a[1],e.b[1])>o.y);
    const axis=o.angle===0?0:1;
    return {...o,host:{kind:'wall',id:edge.id,t:((axis?o.y:o.x)-edge.a[axis])/(edge.b[axis]-edge.a[axis])}};
  });
  space=commitGraphEdit(space,{...space,openings},{kind:'openings',ids:openings.map(o=>o.id)});
  return {config:{model_version:11,spaces:[space],markers:[],settings:{volumetric_view:false}},
    layout:{},devices:{},entities:{},states:{},areas:{}};
}
