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
