import assert from 'node:assert/strict';
import test from 'node:test';
const fresh = (name) => import(new URL(`../test-build/config-store.js?1112=${name}-${Date.now()}`, import.meta.url));
const settle = () => new Promise(resolve => setImmediate(resolve));
function server() {
  const callbacks = new Map(), calls=[];
  let configRev=5, layoutRev=5;
  const hass={connection:{subscribeEvents:async(cb,type)=>{callbacks.set(type,cb);return()=>callbacks.delete(type);}},
    callWS:async({type})=>{calls.push(type);return type==='houseplan/config/get'
      ?{config:{spaces:[{id:'f1'}]},rev:configRev,summary_panel_api:1}
      :{layout:{m:{x:layoutRev,y:0}},rev:layoutRev};}};
  return {hass,calls,event:(kind,rev,extra={})=>callbacks.get(`houseplan_${kind}_updated`)({data:rev===undefined?extra:{rev,...extra}}),
    config:(rev)=>configRev=rev,layout:(rev)=>layoutRev=rev};
}
test('#1112 stale revisions do not wake cards; a config change wakes once after 200ms',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const s=server(), store=await fresh('config'); await store.getConfig(s.hass); s.calls.length=0;
  let wakes=0; const off=store.onConfigChange(()=>{wakes++;void store.getConfig(s.hass);});
  s.event('config',5);s.event('config',4);t.mock.timers.tick(200);await settle();
  assert.equal(wakes,0);assert.deepEqual(s.calls,[]);
  s.config(6);s.event('config',6);t.mock.timers.tick(199);assert.equal(wakes,0);
  t.mock.timers.tick(1);await settle();assert.equal(wakes,1);
  assert.deepEqual(s.calls,['houseplan/config/get']);assert.equal((await store.getConfig(s.hass)).rev,6);off();
});
test('#1112 a layout burst reads only layout once for all listeners, including legacy events',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const s=server(), store=await fresh('layout'); const first=await store.getConfig(s.hass);s.calls.length=0;
  let wakes=0;const load=()=>{wakes++;void store.getConfig(s.hass);};const offA=store.onConfigChange(load),offB=store.onConfigChange(()=>load());
  for(let rev=7;rev<=16;rev++){s.layout(rev);s.event('layout',rev);t.mock.timers.tick(5);}
  assert.equal(wakes,0);t.mock.timers.tick(200);await settle();
  assert.equal(wakes,2);assert.deepEqual(s.calls,['houseplan/layout/get']);
  const next=await store.getConfig(s.hass);assert.equal(next.config,first.config);assert.equal(next.layoutRev,16);assert.equal(next.summaryPanelApi,1);
  s.calls.length=0;s.event('layout',16);s.event('layout',15);t.mock.timers.tick(200);await settle();assert.deepEqual(s.calls,[]);
  s.layout(17);s.event('layout');t.mock.timers.tick(200);await settle();assert.equal((await store.getConfig(s.hass)).layoutRev,17);
  assert.deepEqual(s.calls,['houseplan/layout/get']);offA();offB();
});
test('#1112 an event during a held read fences its stale response and preserves a fresh layout',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const s=server(),store=await fresh('race');await store.getConfig(s.hass);
  const original=s.hass.callWS;let release,hold=true;
  s.hass.callWS=async message=>{
    const response=await original(message);
    if(message.type==='houseplan/layout/get'&&hold){hold=false;return new Promise(resolve=>{release=()=>resolve(response);});}
    return response;
  };
  s.layout(6);s.event('layout',6);t.mock.timers.tick(200);
  const old=store.getConfig(s.hass);await settle();
  s.layout(7);s.event('layout',7);t.mock.timers.tick(200);
  const latest=store.getConfig(s.hass);release();await old;
  assert.equal((await latest).layoutRev,7);assert.equal(store.cachedSnapshot().layoutRev,7);
});
test('#1112 virtual-light events retain their immediate path and survive a layout-only refresh',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const s=server(),store=await fresh('virtual');await store.getConfig(s.hass);s.calls.length=0;
  let wakes=0;const off=store.onConfigChange(()=>{wakes++;});
  s.event('virtual_light',1,{marker_id:'lamp',on:false});
  assert.equal(wakes,1);assert.equal(store.cachedSnapshot().virtualLights.off.has('lamp'),true);
  assert.deepEqual(s.calls,[]);s.layout(6);s.event('layout',6);t.mock.timers.tick(200);
  assert.equal((await store.getConfig(s.hass)).virtualLights.off.has('lamp'),true);
  assert.deepEqual(s.calls,['houseplan/layout/get']);off();
});
test('#1112 forced connection change retires old revision high-water despite a held old event',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const store=await fresh('connection'),callbacksA=new Map(),callbacksB=new Map();
  const connection=callbacks=>({subscribeEvents:async(fn,type)=>{callbacks.set(type,fn);return()=>callbacks.delete(type);}});
  let revB=5,release,hold=true;const held=new Promise(resolve=>{release=resolve;});
  const a={connection:connection(callbacksA),callWS:async({type})=>type==='houseplan/config/get'
    ?{config:{spaces:[{id:'old'}]},rev:100}:{layout:{},rev:100}};
  const b={connection:connection(callbacksB),callWS:async({type})=>{
    if(hold)await held;return type==='houseplan/config/get'
      ?{config:{spaces:[{id:'new'}]},rev:revB}:{layout:{},rev:5};
  }};
  await store.getConfig(a);let wakes=0;
  const off=store.onConfigChange(()=>{wakes++;void store.getConfig(b);});
  const pending=store.getConfig(b,true);await settle();
  callbacksA.get('houseplan_config_updated')({data:{rev:101}});
  hold=false;release();assert.equal((await pending).rev,5);
  revB=6;callbacksB.get('houseplan_config_updated')({data:{rev:6}});
  t.mock.timers.tick(200);await settle();
  assert.equal(wakes,1);assert.equal(store.cachedSnapshot().rev,6);
  assert.equal(store.cachedSnapshot().config.spaces[0].id,'new');off();
});
test('#1112 force supersedes a held layout-only fetch without breaking its original caller',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const s=server(),store=await fresh('force-partial');await store.getConfig(s.hass);
  const original=s.hass.callWS;let hold=true,release;
  s.hass.callWS=async message=>{
    const response=await original(message);
    if(message.type==='houseplan/layout/get'&&hold){hold=false;return new Promise(resolve=>{release=()=>resolve(response);});}
    return response;
  };
  s.layout(6);s.event('layout',6);t.mock.timers.tick(200);
  const previous=store.getConfig(s.hass);await settle();
  const forced=store.getConfig(s.hass,true);release();
  assert.equal((await previous).layoutRev,6);assert.equal((await forced).layoutRev,6);
  assert.equal(store.cachedSnapshot().rev,5);
});