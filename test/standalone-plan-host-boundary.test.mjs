import test from 'node:test';
import assert from 'node:assert/strict';
import { createStandaloneHost, validateStandaloneHost, validateStandaloneHandshake, STANDALONE_REQUIRED_APIS } from '../test-build/standalone-plan-host.js';
import { PLAN_ONLY_CAPABILITIES, HA_CAPABILITIES } from '../test-build/plan-capabilities.js';
import { createCorePlanHost } from '../demo/standalone/host.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
test('#1423 synthetic transport refuses HTTP writes as well as commands after write revocation',async()=>{
  const lab=createCorePlanHost(PLAN_ONLY_CAPABILITIES);
  lab.permissions({read:true,write:false,admin:false});
  await assert.rejects(lab.host.http.postJson('/api/houseplan/structural/upload',{type:'houseplan/config/set'}),{code:'unauthorized'});
  await assert.rejects(lab.host.request({type:'houseplan/config/set',config:{}}),{code:'unauthorized'});
});
test('#1423 handshake requires actual source facts and every API used by the plan-only editor',()=>{
  const fingerprint='a'.repeat(64),version='1.85.2',reply={integration_version:version,frontend_fingerprint:fingerprint,rev:1,can_write:true,config:{},...STANDALONE_REQUIRED_APIS};
  assert.doesNotThrow(()=>validateStandaloneHandshake(reply,fingerprint,version));
  for(const patch of [{integration_version:''},{integration_version:'1.85.1'},{frontend_fingerprint:'b'.repeat(64)},{rev:-1},{can_write:undefined},
    ...Object.keys(STANDALONE_REQUIRED_APIS).map(key=>({[key]:undefined}))])
    assert.throws(()=>validateStandaloneHandshake({...reply,...patch},fingerprint,version),{code:'standalone_host_incompatible'});
});
function fixture(){
  let key={},epoch=1,revision=1,pending,subscription;
  const listeners=new Set(),events=new Set();
  const environment={ready:true,connected:true,permissions:{read:true,write:true,admin:true},
    units:{},states:{'sensor.private':{}},registry:{revision:1,authoritative:false,access:'limited',devices:{},entities:{},areas:{},lastSuccess:0},presentation:{language:'en'}};
  const source={capabilities:PLAN_ONLY_CAPABILITIES,get authorityKey(){return key;},get writeAuthorityRevision(){return epoch;},
    get environmentRevision(){return revision;},get environment(){return environment;},
    async request(){return pending?await pending.promise:{ok:true};},
    async subscribe(event,receive){events.add(receive);if(subscription)await subscription.promise;return ()=>events.delete(receive);},
    subscribeEnvironment(receive){listeners.add(receive);return ()=>listeners.delete(receive);},
    http:{async request(){return new Response('ok');},async postJson(){return {ok:true};}},
    content:{async resolve(){return {};},async resolveAssets(){return {assets:[]};}}};
  return {source,listeners,events,environment,
    replace(){key={};epoch++;revision++;for(const receive of [...listeners])receive();},
    pending(value){pending=value;},subscription(value){subscription=value;}};
}
test('#1423 only a frozen complete plan-only contract can be mounted',()=>{
  const f=fixture();assert.doesNotThrow(()=>validateStandaloneHost(f.source));
  for(const source of [undefined,{}, {...f.source,capabilities:HA_CAPABILITIES},
    {...f.source,capabilities:{...PLAN_ONLY_CAPABILITIES}}, {...f.source,http:{}}, {...f.source,subscribeEnvironment:null}])
    assert.throws(()=>validateStandaloneHost(source));
});
test('#1423 every config read validates the host and a later mismatch retires only its mount',async()=>{
  for(const patch of [{frontend_fingerprint:'b'.repeat(64)},{integration_version:'1.85.1'},{plan_graph_api:0}]){
    const f=fixture(),fingerprint='a'.repeat(64),version='1.85.2';let rejected=0;
    const local=createStandaloneHost(f.source,{}, {fingerprint,version,onIncompatible:()=>rejected++});
    const other=createStandaloneHost(f.source,{});
    await local.host.subscribe('houseplan_config_updated',()=>assert.fail('retired event'));
    const good={integration_version:version,frontend_fingerprint:fingerprint,rev:1,can_write:true,config:{},...STANDALONE_REQUIRED_APIS};
    const first=deferred();f.pending(first);first.resolve(good);
    assert.deepEqual(await local.host.request({type:'houseplan/config/get'}),good);
    const next=deferred();f.pending(next);next.resolve({...good,...patch});
    await assert.rejects(local.host.request({type:'houseplan/config/get'}),{code:'standalone_host_incompatible'});
    assert.equal(rejected,1);assert.equal(local.host.environment.ready,false);
    assert.equal(local.host.environment.permissions.write,false);assert.equal(f.events.size,0);
    await assert.rejects(local.host.request({type:'houseplan/config/set',config:{}}),{code:'context-changed'});
    assert.equal(rejected,1);assert.equal(other.host.environment.ready,true);
    assert.deepEqual(await other.host.request({type:'houseplan/config/get'}),{...good,...patch});
    local.dispose();other.dispose();assert.equal(f.listeners.size,0);
  }
});
test('#1423 presentation publication changes the environment, not write authority or the raw host',()=>{
  const f=fixture(),first=Object.freeze({language:'fr'}),local=createStandaloneHost(f.source,first);
  let calls=0;local.host.subscribeEnvironment(()=>calls++);
  assert.equal(local.host.environment.presentation,first);assert.deepEqual(local.host.environment.states,{});
  const key=local.host.authorityKey,epoch=local.host.writeAuthorityRevision,rev=local.host.environmentRevision;
  const next=Object.freeze({language:'de',themes:{darkMode:true}});local.publish(next);
  assert.equal(local.host.environment.presentation,next);assert.equal(f.environment.presentation.language,'en');
  assert.equal(local.host.authorityKey,key);assert.equal(local.host.writeAuthorityRevision,epoch);
  assert.ok(local.host.environmentRevision>rev);assert.equal(calls,1);local.dispose();
});
test('#1423 pending result cannot commit into a replaced authority',async()=>{
  const f=fixture(),local=createStandaloneHost(f.source,{}),wait=deferred();f.pending(wait);
  const result=local.host.request({type:'houseplan/config/get'});f.replace();wait.resolve({ok:true});
  await assert.rejects(result,{code:'context-changed'});local.dispose();
});
test('#1423 pending subscription is released if the mount is disposed before it resolves',async()=>{
  const f=fixture(),local=createStandaloneHost(f.source,{}),wait=deferred();f.subscription(wait);
  const result=local.host.subscribe('houseplan_config_updated',()=>assert.fail('retired event'));
  local.dispose();wait.resolve();await assert.rejects(result,{code:'context-changed'});
  assert.equal(f.listeners.size,0);assert.equal(f.events.size,0);
});
test('#1423 pending subscription is also released across an authority replacement',async()=>{
  const f=fixture(),local=createStandaloneHost(f.source,{}),wait=deferred();f.subscription(wait);
  const result=local.host.subscribe('houseplan_config_updated',()=>assert.fail('old-authority event'));
  f.replace();for(const receive of f.events)receive({data:{rev:2}});
  wait.resolve();await assert.rejects(result,{code:'context-changed'});
  assert.equal(f.events.size,0);local.dispose();
});
test('#1423 dispose revokes commands and all own leases immediately without retiring another mount',async()=>{
  const f=fixture(),a=createStandaloneHost(f.source,{}),b=createStandaloneHost(f.source,{});
  const release=await a.host.subscribe('houseplan_config_updated',()=>{});
  await b.host.subscribe('houseplan_config_updated',()=>{});
  assert.equal(f.listeners.size,2);assert.equal(f.events.size,2);
  a.dispose();a.dispose();release();assert.equal(f.listeners.size,1);assert.equal(f.events.size,1);
  assert.equal(a.host.environment.ready,false);assert.equal(a.host.environment.permissions.write,false);
  await assert.rejects(a.host.request({type:'houseplan/config/set',config:{}}),{code:'context-changed'});
  assert.throws(()=>a.publish({}));assert.deepEqual(await b.host.request({type:'houseplan/config/get'}),{ok:true});
  b.dispose();assert.equal(f.events.size,0);assert.equal(f.listeners.size,0);
});
test('#1423 plan-only dispatch refuses hidden device and full-backup commands before the source',async()=>{
  const f=fixture(),local=createStandaloneHost(f.source,{});
  for(const type of ['houseplan/zigbee_scan','houseplan/marker/delete','houseplan/backup/export'])
    await assert.rejects(local.host.request({type}),{code:'not_ready'});
  await assert.rejects(local.host.http.request('/api/houseplan/structural/upload'),{code:'not_ready'});
  local.dispose();
});
