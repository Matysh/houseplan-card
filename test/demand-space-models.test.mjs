import test from 'node:test';
import assert from 'node:assert/strict';
import {DemandSpaceModels} from '../test-build/demand-space-models.js';
import {spaceModels} from '../test-build/space-geometry.js';
test('floor metadata stays cheap, physical reads are lazy and paint keeps scaled geometry',()=>{
  const config={spaces:['A','B'].map(id=>({id,title:id,cell_cm:5,rooms:[{id:`${id}r`,name:'Room',area:'area',poly:[[0,0],[.2,0],[.2,.2]]}],wall_segments:[]}))};
  const cache=new DemandSpaceModels();let models=cache.read(config);
  assert.deepEqual(models.map(s=>[s.id,s.title,s.rooms[0].area]),[['A','A','area'],['B','B','area']]);
  assert.equal(cache.work.builds,0);
  const first=models[0].rooms[0].poly;assert.deepEqual(first,spaceModels(config)[0].rooms[0].poly);assert.equal(cache.work.builds,1);
  config.spaces[0].title='Paint';config.spaces[0].rooms[0].settings={fill_mode:'custom'};
  config.spaces[1].rooms[0].poly[0][0]=.07;
  models=cache.read(structuredClone(config));assert.equal(models[0].title,'Paint');
  assert.equal(models[0].rooms[0].poly,first);assert.equal(cache.work.builds,1,'A retained, hidden B not built');
  assert.deepEqual(models[1].rooms[0].poly,spaceModels(config)[1].rooms[0].poly);assert.equal(cache.work.builds,2);
  cache.clear();cache.read(config)[0].rooms[0].poly;assert.equal(cache.work.builds,3);
});

test('#1098 presentation edits reuse physical model while raw stairs and backdrop stay fresh',()=>{
  const config={spaces:[{id:'A',cell_cm:5,rooms:[{id:'r',poly:[[0,0],[.9,0],[.9,.9],[0,.9]]}],
    stairs:[{id:'stair',kind:'straight',x:.4,y:.4,angle:0,direction:'forward',length:.2,width:.1}],
    plan_url:'/plan.svg',plan_aspect:2,plan_x:.1,led_strips:[]}]};
  const cache=new DemandSpaceModels();
  const warm=cache.read(config)[0]; void warm.rooms[0].poly; assert.equal(cache.work.builds,1);
  for(const patch of [{stairs:[{...config.spaces[0].stairs[0],x:.65}]},{plan_x:.25,plan_y:.3,plan_scale:1.5,plan_angle:35},
    {led_strips:[{id:'led',points:[[.1,.1],[.2,.2]],active:true}]}]) {
    Object.assign(config.spaces[0],patch);
    const current=cache.read(structuredClone(config))[0],fresh=spaceModels(config)[0];
    assert.deepEqual(current.stairs,fresh.stairs);assert.equal(current.stairs,current.stairs);
    assert.deepEqual(current.bg,fresh.bg);assert.equal(current.bg,current.bg);
    assert.deepEqual(current.rooms[0].poly,fresh.rooms[0].poly);
    assert.equal(cache.work.builds,1,'presentation data does not rebuild physical model');
  }
  let builds=1;
  for(const patch of [{plan_url:'/changed.svg'},{plan_aspect:3},{future_physics:1},{settings:{future_physics:2}},
    {rooms:[{id:'r',poly:[[0,0],[.8,0],[.8,.8],[0,.8]]}]}]) {
    Object.assign(config.spaces[0],patch);const current=cache.read(structuredClone(config))[0];void current.rooms[0].poly;
    assert.equal(cache.work.builds,++builds,'unknown and structural inputs stay significant');
  }
  delete config.spaces[0].plan_url;assert.equal(cache.read(config)[0].bg,null);
});