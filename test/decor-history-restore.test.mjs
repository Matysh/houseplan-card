import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreDecorOnlyHistory,restoreNonPhysicalHistory} from '../test-build/decor-history-restore.js';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';

function fixture(){
 const config=commitWallSegmentModel({spaces:[{id:'f',rooms:[{id:'r',poly:[[0,0],[1,0],[1,1],[0,1]]}],
  decor:[{id:'d',kind:'furniture',symbol:'sofa',x:.2,y:.2,w:.1,h:.1,future:{preserve:[true,1]}}]},
 {id:'other',rooms:[],decor:[{id:'other',kind:'text',text:'untouched'}]}],markers:[],settings:{future:true}}).config;
 const space=config.spaces[0],before={spaceId:'f',rooms:structuredClone(space.rooms),wall_segments:structuredClone(space.wall_segments),
  walls:structuredClone(space.walls),decor:structuredClone(space.decor),plan_transform:{}};
 const target=structuredClone(before);delete target.decor;
 return{config,before,target};
}
test('#1075 decor-only restore changes exactly decor while retaining physical record identities',()=>{
 const {config,before,target}=fixture(),original=structuredClone(config),source=config.spaces[0];
 const refs=[source.rooms,source.wall_segments,source.walls,config.spaces[1],config.markers,config.settings];
 assert.equal(restoreDecorOnlyHistory(config,before,target),true);
 const expected=structuredClone(original);delete expected.spaces[0].decor;assert.deepEqual(config,expected);
 assert.deepEqual([source.rooms,source.wall_segments,source.walls,config.spaces[1],config.markers,config.settings],refs);
 for(const [i,key]of['rooms','wall_segments','walls'].entries())assert.equal(source[key],refs[i]);
 const current={...before};delete current.decor;
 assert.equal(restoreDecorOnlyHistory(config,current,before),true);assert.deepEqual(config,original);
 config.spaces[0].decor[0].future.preserve.push('changed');assert.deepEqual(before.decor[0].future.preserve,[true,1]);
});
for(const kind of ['legacy','draft','open-to','mixed-catalogue','missing-wall-ids','node','chain','references','walls','stairs','transform','unknown','wrong-floor','invalid-decor'])
 test(`#1075 ${kind} keeps the strict history lane and leaves config untouched`,()=>{
  const {config,before,target}=fixture();
  if(kind==='legacy')config.model_version=9;
  if(kind==='draft')config.spaces[1].room_drafts=[];
  if(kind==='open-to')config.spaces[0].rooms[0].open_to=[['a']];
  if(kind==='mixed-catalogue')delete config.spaces[1].wall_segments;
  if(kind==='missing-wall-ids')delete config.spaces[0].rooms[0].wall_ids;
  if(kind==='node')target.nodeMove={kind:'delete'};
  if(kind==='chain')before.wallChainSeedIds=[];
  if(kind==='references')target.roomReferences=[];
  if(kind==='walls')target.wall_segments[0].cm++;
  if(kind==='stairs')target.stairs=[];
  if(kind==='transform')target.plan_transform.plan_scale=2;
  if(kind==='unknown')target.futurePhysical={enabled:true};
  if(kind==='wrong-floor')target.spaceId='other';
  if(kind==='invalid-decor')target.decor=null;
  const frozen=structuredClone(config);assert.equal(restoreDecorOnlyHistory(config,before,target),false);assert.deepEqual(config,frozen);
 });

for(const field of ['stairs','transform'])test('#1100 '+field+' restore preserves exact physical identities and foreign fields',()=>{
 const {config,before,target}=fixture(),source=config.spaces[0],original=structuredClone(config);
 const refs=[source.rooms,source.walls,source.wall_segments,config.spaces[1],config.markers,config.settings];
 if(field==='stairs')target.stairs=[{id:'stair',kind:'straight',direction:'forward',x:.5,y:.5,width:.1,length:.2,angle:0}];
 else target.plan_transform={plan_x:.2,plan_scale:1.25};
 assert.equal(restoreDecorOnlyHistory(config,before,target),false,'the existing decor-only API remains decor-only');
 assert.equal(restoreNonPhysicalHistory(config,before,target),true);
 const expected=structuredClone(original);delete expected.spaces[0].decor;
 if(field==='stairs')expected.spaces[0].stairs=structuredClone(target.stairs);else Object.assign(expected.spaces[0],target.plan_transform);
 assert.deepEqual(config,expected);
 [source.rooms,source.walls,source.wall_segments,config.spaces[1],config.markers,config.settings].forEach((value,i)=>assert.equal(value,refs[i]));
 const current=structuredClone(target);assert.equal(restoreNonPhysicalHistory(config,current,before),true);assert.deepEqual(config,original);
});
for(const kind of ['legacy','draft','open-to','mixed-catalogue','missing-wall-ids','node','chain','references','walls','unknown','wrong-floor','invalid-decor','invalid-stairs','invalid-plan','unknown-plan-key'])
 test('#1100 '+kind+' never gains nonphysical restoration authority',()=>{
  const {config,before,target}=fixture();target.plan_transform.plan_x=.2;
  if(kind==='legacy')config.model_version=9;
  if(kind==='draft')config.spaces[1].room_drafts=[];
  if(kind==='open-to')config.spaces[0].rooms[0].open_to=[['a']];
  if(kind==='mixed-catalogue')delete config.spaces[1].wall_segments;
  if(kind==='missing-wall-ids')delete config.spaces[0].rooms[0].wall_ids;
  if(kind==='node')target.nodeMove={kind:'delete'};
  if(kind==='chain')before.wallChainSeedIds=[];
  if(kind==='references')target.roomReferences=[];
  if(kind==='walls')target.wall_segments[0].cm++;
  if(kind==='unknown')target.futurePhysical={enabled:true};
  if(kind==='wrong-floor')target.spaceId='other';
  if(kind==='invalid-decor')target.decor=null;
  if(kind==='invalid-stairs')target.stairs=null;
  if(kind==='invalid-plan')target.plan_transform=[];
  if(kind==='unknown-plan-key')target.plan_transform.rooms=[];
  const original=structuredClone(config);assert.equal(restoreNonPhysicalHistory(config,before,target),false);assert.deepEqual(config,original);
 });
