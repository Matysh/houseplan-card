import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreProcess } from '../demo/standalone/core-process.mjs';
import { standaloneFixture } from '../demo/standalone/fixture.mjs';

const initial=()=>({config:standaloneFixture(),fingerprint:'a'.repeat(64),version:'1.85.2'});
const request=async(core,command)=>(await core.rpc({op:'request',command})).result;
function equivalentProjection(source,target){
  const map=new Map([[target.id,source.id]]);
  const selectors={rooms:['poly','name'],wall_segments:['a','b'],partitions:['a','b'],wall_columns:['center','shape'],
    openings:['type','x','y'],decor:['kind','x','y'],stairs:['kind','x','y']};
  for(const [collection,keys] of Object.entries(selectors))for(const item of source[collection]||[]){
    const matches=(target[collection]||[]).filter(other=>keys.every(key=>JSON.stringify(item[key])===JSON.stringify(other[key])));
    assert.equal(matches.length,1,`${collection}: unambiguous fixture identity correspondence`);map.set(matches[0].id,item.id);
  }
  for(const node of source.plan_graph.nodes){
    const matches=target.plan_graph.nodes.filter(other=>JSON.stringify(other.p)===JSON.stringify(node.p));
    assert.equal(matches.length,1);map.set(matches[0].id,node.id);
  }
  const rename=value=>typeof value==='string'?(map.get(value)||value):Array.isArray(value)?value.map(rename)
    :value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,rename(v)])):value;
  const normalized=space=>{
    const result=structuredClone(space);result.title=source.title;
    for(const stair of result.stairs||[])stair.target_space_id=null;
    for(const collection of Object.keys(selectors))result[collection]?.sort((a,b)=>a.id.localeCompare(b.id));
    result.walls?.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
    for(const [collection,key] of [['nodes','id'],['edges','id'],['rooms','room'],['dependencies','node']])
      result.plan_graph[collection]?.sort((a,b)=>String(a[key]).localeCompare(String(b[key])));
    return result;
  };
  assert.deepEqual(normalized(rename(target)),normalized(source),'all projected geometry, graph dependencies, features, decor and appearance survive ID remapping');
  return map;
}
test('#1423 genuine core validates Save/CAS and preserves hidden bindings without importing HA',async t=>{
  const core=await createCoreProcess(initial());t.after(()=>core.close());
  const read=await request(core,{type:'houseplan/config/get'});
  const candidate=structuredClone(read.config);candidate.spaces[0].rooms[0].name='Renamed';
  const result=await request(core,{type:'houseplan/config/set',expected_rev:read.rev,config:candidate,opening_features_api:1});
  assert.equal(result.config.spaces[0].rooms[0].name,'Renamed');
  assert.deepEqual(result.config.markers,read.config.markers);
  assert.equal(result.config.spaces[0].openings[0].contact,'binary_sensor.door');
  await assert.rejects(request(core,{type:'houseplan/config/set',expected_rev:read.rev,config:candidate,opening_features_api:1}),{code:'conflict'});
  const malformed=structuredClone(result.config);malformed.spaces[0].cell_cm=-10;
  await assert.rejects(request(core,{type:'houseplan/config/set',expected_rev:result.rev,config:malformed,opening_features_api:1}));
  const state=(await core.rpc({op:'snapshot'})).result;
  assert.equal(state.config.spaces[0].rooms[0].name,'Renamed');assert.equal(state.haImported,false);
});
test('#1423 portable core projects HA links, imports/remaps one space and clears cross-floor stairs on apply',async t=>{
  const core=await createCoreProcess(initial());t.after(()=>core.close());
  await request(core,{type:'houseplan/layout/set',expected_rev:1,expected_config_rev:1,layout:{rl_room:{x:.3,y:.35,s:'local',k:1.25}}});
  const {document}=await request(core,{type:'houseplan/export/create',kind:'space',space_id:'local',plan_only:true});
  const payload=document.payload.config;
  assert.deepEqual(payload.markers,[]);assert.equal(payload.spaces.length,1);
  assert.equal(payload.spaces[0].openings[0].contact,undefined);assert.equal(payload.spaces[0].openings[0].lock,undefined);
  assert.equal(payload.spaces[0].stairs[0].target_space_id,'upper','projection preserves it; the importer clears it');
  assert.ok(!payload.spaces[0].decor.find(d=>d.id==='text').text.includes('sensor.private'));
  const preview=(await core.rpc({op:'post',path:'/api/houseplan/import/preview',value:{bytes:Buffer.from(JSON.stringify(document)).toString('base64')}})).result;
  const result=await request(core,{type:'houseplan/import/apply',token:preview.token,expected_config_rev:preview.expected_config_rev,
    expected_layout_rev:preview.expected_layout_rev,confirm_missing_content:true});
  assert.equal(result.kind,'space');const state=(await core.rpc({op:'snapshot'})).result;
  const added=state.config.spaces.find(space=>!['local','upper'].includes(space.id));assert.ok(added);
  assert.notEqual(added.title,'Local plan');assert.equal(added.stairs[0].target_space_id,null);
  assert.equal(added.openings[0].length,payload.spaces[0].openings[0].length);
  assert.equal(added.decor.length,payload.spaces[0].decor.length);assert.deepEqual(state.config.markers,initial().config.markers);
  const again=(await request(core,{type:'houseplan/export/create',kind:'space',space_id:added.id,plan_only:true})).document;
  const mapping=equivalentProjection(payload.spaces[0],again.payload.config.spaces[0]);
  const remappedLayout=Object.fromEntries(Object.entries(again.payload.layout).map(([key,value])=>[
    key.startsWith('rl_')?'rl_'+mapping.get(key.slice(3)):key,{...value,s:mapping.get(value.s)||value.s}]));
  assert.deepEqual(remappedLayout,document.payload.layout,'room-label positions and scale survive the same identity remap');
  assert.equal(state.haImported,false);
  const future=structuredClone(document);future.model_version=1000;
  await assert.rejects(core.rpc({op:'post',path:'/api/houseplan/import/preview',value:{bytes:Buffer.from(JSON.stringify(future)).toString('base64')}}),{code:'future_model'});
});
test('#1423 actual structural staging, paired Optimize and one-deep Undo use core rules and revisions',async t=>{
  const core=await createCoreProcess(initial());t.after(()=>core.close());
  const read=await request(core,{type:'houseplan/config/get'}),layout=await request(core,{type:'houseplan/layout/get'});
  const changed=structuredClone(read.config);changed.spaces[0].title='Through staged core';
  const message={type:'houseplan/config/set',expected_rev:read.rev,config:changed,opening_features_api:1};
  const staged=(await core.rpc({op:'post',path:'/api/houseplan/structural/upload',value:message})).result;
  assert.equal(staged.purpose,message.type);
  const result=await request(core,{type:message.type,expected_rev:read.rev,upload_token:staged.token,upload_sha256:staged.sha256});
  assert.equal(result.config.spaces[0].title,'Through staged core');
  const optimized=await request(core,{type:'houseplan/plan/optimize',config:result.config,layout:layout.layout,
    expected_config_rev:result.rev,expected_layout_rev:layout.rev,opening_features_api:1});
  assert.equal(optimized.can_undo,true);
  const undone=await request(core,{type:'houseplan/plan/optimize_undo',expected_config_rev:optimized.config_rev,expected_layout_rev:optimized.layout_rev});
  assert.equal(undone.can_undo,false);assert.deepEqual(undone.config,result.config);
});
test('#1423 ordinary legacy space is repaired by portable core; full installation JSON never applies in plan-only transport',async t=>{
  const core=await createCoreProcess(initial());t.after(()=>core.close());
  const {document}=await request(core,{type:'houseplan/export/create',kind:'space',space_id:'local',plan_only:true});
  const legacy=structuredClone(document);delete legacy.transfer;legacy.model_version=10;
  for(const space of legacy.payload.config.spaces)delete space.plan_graph;
  legacy.payload.config.markers=[{id:'legacy-marker',binding:'entity:light.old',space:'local',room_id:'room'}];
  const preview=(await core.rpc({op:'post',path:'/api/houseplan/import/preview',value:{bytes:Buffer.from(JSON.stringify(legacy)).toString('base64')}})).result;
  await request(core,{type:'houseplan/import/apply',token:preview.token,expected_config_rev:preview.expected_config_rev,
    expected_layout_rev:preview.expected_layout_rev,confirm_missing_content:true});
  const repaired=(await core.rpc({op:'snapshot'})).result;
  assert.equal(repaired.config.model_version,11);assert.equal(repaired.haImported,false);
  const marker=repaired.config.markers.find(m=>m.binding==='entity:light.old');assert.ok(marker);
  assert.ok(repaired.config.spaces.flatMap(space=>space.rooms||[]).some(room=>room.id===marker.room_id),'legacy room binding follows the core identity remap');
  const full=structuredClone(document);delete full.transfer;full.kind='full';
  const fullPreview=(await core.rpc({op:'post',path:'/api/houseplan/import/preview',value:{bytes:Buffer.from(JSON.stringify(full)).toString('base64')}})).result;
  await assert.rejects(request(core,{type:'houseplan/import/apply',token:fullPreview.token,expected_config_rev:fullPreview.expected_config_rev,
    expected_layout_rev:fullPreview.expected_layout_rev,confirm_missing_content:true}),{code:'not_ready'});
  assert.deepEqual((await core.rpc({op:'snapshot'})).result.config,repaired.config);
});
