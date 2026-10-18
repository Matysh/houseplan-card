import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchPropertiesTarget } from '../test-build/editors/properties/patch.js';
import { applyDeviceVisualFields, deviceVisualFields } from '../test-build/device-position-history.js';
const context={cellCm:5,ratio:null,openingReference:null};
test('#931 narrow decor colour, font and text adapters preserve every unrelated/legacy key',()=>{
  const text={id:'t',kind:'text',x:.2,y:.3,text:'Legacy {}',entity:'sensor.t',attr:'non canonical',unit:'custom',size:'s',scale:1.7,future:null};
  const space={id:'s',title:'S',decor:[text,{id:'other',kind:'rect',x:0,y:0,w:1,h:1}]};
  assert.equal(patchPropertiesTarget(space,{kind:'decor',value:text},'stroke',{color:'#123456',opacity:.7},context),true);
  assert.deepEqual(space.decor[0],{...text,color:'#123456',opacity:.7});
  assert.equal(patchPropertiesTarget(space,{kind:'decor',value:space.decor[0]},'size_cm',12,context),true);
  assert.equal('scale' in space.decor[0],false); assert.equal('size' in space.decor[0],false);
  assert.equal(space.decor[0].entity,text.entity); assert.equal(space.decor[0].unit,'custom'); assert.equal(space.decor[0].future,null);
  const before=structuredClone(space);
  for(const [field,value] of [['text',''],['text','x'.repeat(201)],['width_cm',1],['target_space_id','other'],['size_cm',Infinity]]) {
    assert.equal(patchPropertiesTarget(space,{kind:'decor',value:space.decor[0]},field,value,context),false);
    assert.deepEqual(space,before);
  }
});
test('#931 fill absence is distinct from transparent fill, and furniture never acquires a fill',()=>{
  const rect={id:'r',kind:'rect',x:0,y:0,w:.2,h:.1,fill:true,fill_color:'#abcdef',fill_opacity:0};
  const space={id:'s',title:'S',decor:[rect]};
  assert.equal(patchPropertiesTarget(space,{kind:'decor',value:rect},'fill',{color:'#abcdef',opacity:0,noFill:true},context),true);
  assert.equal(space.decor[0].fill,false); assert.equal(space.decor[0].fill_opacity,0);
  assert.equal(patchPropertiesTarget(space,{kind:'decor',value:space.decor[0]},'fill',{color:'#abcdef',opacity:0,noFill:false},context),true);
  assert.equal(space.decor[0].fill,true);
  const furniture={...rect,kind:'furniture',symbol:'sofa'};
  assert.equal(patchPropertiesTarget(space,{kind:'decor',value:furniture},'fill',{color:'#123456',opacity:1},context),false);
});
test('#931 non-decor adapters reject unexposed fields and retain topology/routing siblings',()=>{
  const column={id:'column',shape:'square',center:[.2,.333333333],cm:20,angle:5,future:{keep:true}};
  const stair={id:'stair',kind:'spiral',x:.2,y:.3,radius:.1,angle:12,direction:'clockwise',target_space_id:'two',future:null};
  const space={id:'s',title:'S',wall_columns:[column],stairs:[stair]};
  assert.equal(patchPropertiesTarget(space,{kind:'column',value:column},'x',300,context),true);
  assert.equal(space.wall_columns[0].center[1],column.center[1]); assert.deepEqual(space.wall_columns[0].future,column.future);
  assert.equal(patchPropertiesTarget(space,{kind:'column',value:space.wall_columns[0]},'angle',95,context),true);
  assert.equal(space.wall_columns[0].angle,5);
  assert.equal(patchPropertiesTarget(space,{kind:'stair',value:stair},'radius',120.123,context),true);
  assert.equal(space.stairs[0].target_space_id,'two'); assert.equal(space.stairs[0].future,null);
  assert.equal(patchPropertiesTarget(space,{kind:'stair',value:stair},'target_space_id','foreign',context),false);
});
test('#931 visual history records absence/null only for changed keys and restores no siblings',()=>{
  const original={id:'m',binding:'virtual',size:null,name:'Old',future:{keep:true}};
  const before=deviceVisualFields(original,['angle']);
  assert.deepEqual(before,[{key:'angle',present:false}]);
  const after={...original,angle:15};
  const newer={...after,name:'New',size:2,future:{keep:'new'}};
  assert.deepEqual(applyDeviceVisualFields(newer,before),{id:'m',binding:'virtual',size:2,name:'New',future:{keep:'new'}});
  const size=deviceVisualFields(original,['size']);
  assert.deepEqual(size,[{key:'size',present:true,value:null}]);
  assert.equal(applyDeviceVisualFields(newer,size).size,null);
  assert.equal(newer.size,2);
});
