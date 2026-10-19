import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propertiesCatalog, resolvePropertiesTarget } from '../test-build/editors/properties/catalog.js';
import { propertiesT } from '../test-build/editors/properties/strings.js';
const space = { id: 'one', title: 'Floor', plan_url: '/plan.png', plan_aspect: 1,
  partitions: [{ id: 'p', a: [.1,.1], b: [.8,.1], cm: 12 }],
  wall_segments: [{ id: 'c', a: [.1,.2], b: [.8,.2], cm: 15 }],
  wall_columns: [{ id: 'column', shape: 'square', center: [.5,.5], cm: 30, angle: 15 }],
  openings: [{ id: 'opening', type: 'door', x: .4, y: .1, angle: 0, length: .1, host: { kind: 'partition', id: 'p', t: 3/7 } }],
  stairs: [{ id: 'stair', kind: 'straight', x: .5, y: .6, length: .2, width: .1, angle: 90, direction: 'forward', target_space_id: 'two' }],
  decor: [{ id: 'text', kind: 'text', x: .2, y: .3, text: 'Label', size_cm: 10 }],
  led_strips: [{ id: 'led', points: [[.1,.1],[.2,.1],[.2,.3]], marker: 'marker' }],
};
const marker = { id: 'marker', binding: 'virtual', space: 'one', angle: 356, size: 1.5 };
const device = { id: 'marker', name: 'My lamp', space: 'one', marker, bindingKind: 'virtual', entities: [], icon: 'mdi:lamp' };
const context = { space, cellCm: 5, t: (key,values) => propertiesT('en',key,values),
  position: () => ({ x: .4, y: .2 }), textBox: () => ({ w:.2,h:.02 }), fontCm: () => 10,
  imageName: () => 'Picture.png', openingReference: { distance: 100, source: 'host-end' },
  openingSides: ['A', 'B'], ratioLocked: true };
const model = (target) => propertiesCatalog(target, context);
const fields = m => Object.fromEntries(m.groups.flatMap(g=>g.fields).map(f=>[f.key,f]));

test('#931 r1 metadata names only owning contour rooms and resolved opening sides without inflecting custom names',()=>{
  const local={...context,space:{...space,rooms:[
    {name:'Детская Элины',wall_ids:['c']},{name:'Кухня',wall_ids:['other']} ]},
    t:(key,vars)=>propertiesT('ru',key,vars),openingRooms:['Гостиная','Кухня']};
  assert.equal(propertiesCatalog({kind:'contour',value:space.wall_segments[0]},local).meta,'Контур «Детская Элины» · Floor');
  assert.equal(propertiesCatalog({kind:'opening',value:space.openings[0]},local).meta,'Floor · Гостиная — Кухня');
  assert.equal(propertiesCatalog({kind:'opening',value:space.openings[0]},{...local,openingRooms:[]}).meta,'Дверной проём · Floor');
  assert.equal(propertiesCatalog({kind:'contour',value:space.wall_segments[0]}, {...local,space:{...space,rooms:[
    {name:'Legacy',poly:[[.1,.2],[.8,.2],[.8,.5],[.1,.5]]},
    {name:'Not an owner',poly:[[.1,.3],[.8,.3],[.8,.6],[.1,.6]]} ]}}).meta,'Контур «Legacy» · Floor');
  assert.equal(fields(propertiesCatalog({kind:'backdrop',value:space},local)).reset.icon,'reset');
  assert.equal(propertiesT('ru','backdrop_delete_reason').replace(/\s+/g,' '),'Чтобы убрать картинку, измените вид подложки в настройках пространства.');
});

test('#931 stable selection rejects another floor, deleted ID, rebinding and a retired strip binding', () => {
  const id = { spaceId:'one',editor:'devices',kind:'device',objectId:'marker',binding:'virtual' };
  assert.equal(resolvePropertiesTarget(id,space,[device],[marker]).value,device);
  for (const change of [{ spaceId:'two' },{ objectId:'missing' },{ binding:'device:foreign' }]) assert.equal(resolvePropertiesTarget({...id,...change},space,[device],[marker]),null);
  assert.equal(resolvePropertiesTarget(id,space,[],[marker]),null);
  assert.equal(resolvePropertiesTarget({...id,kind:'led',objectId:'led',binding:'foreign'},space,[device],[marker]),null);
});

test('#931 empty selection has exactly three common groups, inapplicable dashes and disabled Delete', () => {
  const m=model(null);
  assert.deepEqual(m.groups.map(g=>g.key),['position','geometry','appearance']);
  assert.ok(m.groups.flatMap(g=>g.fields).every(f=>f.mode==='disabled'&&f.value===null));
  assert.ok(m.actions[0].disabled); assert.equal(m.title,'Nothing selected');
});

test('#931 every contour coordinate is readonly and independent free ends use structural eligibility', () => {
  const contour=model({kind:'contour',value:space.wall_segments[0]});
  assert.ok(contour.groups[0].fields.every(f=>f.mode==='readonly'));
  assert.equal(fields(contour).cm.mode,undefined); assert.equal(contour.actions[0].disabled,'contour_delete_reason');
  assert.equal(contour.groups.length,3,'#963 shared-node note must not leave an empty fourth section');
  assert.equal(contour.groups[0].hint,'contour_context');
  const wall=model({kind:'partition',value:space.partitions[0]});
  assert.ok(wall.groups[0].fields.every(f=>!f.mode)); assert.equal(fields(wall).length.mode,'readonly');
  assert.equal(wall.groups.length,3,'no empty type/features group');
});

test('#931 column, stair and all opening variants expose only applicable controls', () => {
  let f=fields(model({kind:'column',value:space.wall_columns[0]}));
  assert.equal(f.cm.label,'side'); assert.equal(f.h.mode,'disabled'); assert.equal(f.shape.control,'choices');
  f=fields(model({kind:'column',value:{...space.wall_columns[0],shape:'circle'}}));
  assert.equal(f.cm.label,'diameter'); assert.equal(f.angle.mode,'disabled');
  for(const type of ['door','window','gate','passage']) {
    const m=model({kind:'opening',value:{...space.openings[0],type}}), f=fields(m);
    assert.equal(f.x.mode,'readonly'); assert.equal(f.gap.label,'wall_end_gap'); assert.equal(f.length.max,600);
    assert.equal(f.angle.mode,'readonly'); assert.equal(f.invert,undefined);
    if(type==='passage') assert.equal(m.groups.length,3);
    else if(type==='gate'||type==='window') {
      assert.equal(f.flip_h,undefined);
      assert.equal(f.flip_v.control,'choices');
      assert.equal(f.flip_v.label,'opening_side');
      assert.deepEqual(f.flip_v.options,[{value:'false',label:'A'},{value:'true',label:'B'}]);
    }
    else assert.ok(f.flip_h);
  }
  const straight=fields(model({kind:'stair',value:space.stairs[0]}));
  assert.equal(straight.length.min,30); assert.equal(straight.length.max,10000); assert.equal(straight.stroke_width.mode,'disabled');
  const spiral=fields(model({kind:'stair',value:{...space.stairs[0],kind:'spiral',radius:.1,direction:'clockwise'}}));
  assert.equal(spiral.radius.value,120); assert.equal(spiral.h.mode,'disabled');
});

test('#931 device legacy angle stays visible; disabled HA device has no editable geometry and no new colour fields', () => {
  const f=fields(model({kind:'device',value:device,marker}));
  assert.equal(f.angle.value,356); assert.equal(f.angle.step,5); assert.equal(f.size.value,150);
  assert.equal(f.stroke.mode,'disabled'); assert.equal(f.w.mode,'disabled');
  const ghost=fields(model({kind:'device',value:{...device,bindingStatus:{kind:'ha_disabled'}},marker}));
  assert.equal(ghost.x.mode,'readonly'); assert.equal(ghost.size.mode,'readonly'); assert.equal(ghost.w.mode,'disabled');
});

test('#931 bound and orphan strips keep geometry readonly and contextual actions honest', () => {
  const bound=model({kind:'led',value:space.led_strips[0],device});
  assert.equal(fields(bound).length.mode,'readonly'); assert.equal(fields(bound).length.value,360);
  assert.deepEqual(bound.actions.map(a=>a.key),['copy','display_device']);
  const orphan=model({kind:'led',value:{...space.led_strips[0],marker:null}});
  assert.ok(orphan.actions.every(a=>a.disabled==='orphan_strip_reason'));
  assert.equal(fields(orphan).settings.mode,'disabled');
});

test('#931 decor family matrix, local image ratio and transformed backdrop centre', () => {
  const common={id:'d',x:.1,y:.2,w:.3,h:.4,angle:15};
  for(const kind of ['rect','ellipse','furniture','image']) {
    const f=fields(model({kind:'decor',value:{...common,kind,symbol:'sofa',asset_id:'asset'}}));
    assert.equal(f.x.value,300); assert.equal(f.y.value,480); assert.equal(f.w.mode,undefined);
    if(kind==='image') { assert.ok(f.ratio); assert.equal(f.opacity.value,100); assert.equal(f.stroke.mode,'disabled'); }
    if(kind==='furniture') { assert.ok(f.flip_h); assert.equal(f.fill.mode,'disabled'); }
    if(kind==='rect'||kind==='ellipse') assert.equal(f.fill.value.noFill,true);
  }
  const text=fields(model({kind:'decor',value:space.decor[0]}));
  assert.equal(text.w.mode,'readonly'); assert.equal(text.text.control,'text'); assert.equal(text.size_cm.max,2000);
  const line=fields(model({kind:'decor',value:{id:'line',kind:'line',x1:0,y1:0,x2:.2,y2:0}}));
  assert.equal(line.length.value,240); assert.equal(line.h.mode,'disabled'); assert.equal(line.line_style.control,'select');
  const backdrop=model({kind:'backdrop',value:{...space,plan_x:.1,plan_scale_x:2,plan_opacity:0}});
  assert.equal(fields(backdrop).x.value,1320); assert.equal(fields(backdrop).opacity.value,0);
  assert.equal(backdrop.actions[0].disabled,'backdrop_delete_reason');
});
