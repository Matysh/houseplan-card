import test from 'node:test';
import assert from 'node:assert/strict';
import {persistContactPlacements,prepareContactMove,contactConfigPatch} from '../test-build/device-contact-write.js';
import {DeviceContactScene} from '../test-build/device-contact-scene.js';
import {LayoutWriteReload} from '../test-build/layout-write-reload.js';
import {sameDevicePlacement} from '../test-build/device-position-history.js';
const initial={a:{s:'floor',x:.2,y:.2,future:{keep:1}},b:{s:'floor',x:.245,y:.2},foreign:{s:'upstairs',x:.8,y:.9,opaque:42}};
const change={deviceId:'a',spaceId:'floor',placement:{s:'floor',x:.3,y:.3},
  related:[{deviceId:'b',spaceId:'floor',placement:{s:'floor',x:.345,y:.3}}]};
function fixture(){
  let saved=structuredClone(initial),active=true;
  const calls=[],accepted=structuredClone(initial);
  const host={_layout:structuredClone(initial),_layoutRev:7,_cfgRev:3,_space:'floor',_serverStorage:true,_loadOk:true,
    _sentPos:new Map(),_layoutIO:new LayoutWriteReload(()=>()=>active),
    _adoption:{snapshot:()=>({layout:accepted,config:{markers:[{id:'a',size:1}]}}),
      acceptLayoutPosition:(id,pos)=>{accepted[id]=structuredClone(pos);},refreshLayoutFingerprint:()=>{},
      stageLocalLayout:layout=>{host._layout=layout;}},
    _cacheSnapshot:()=>{},requestUpdate:()=>{},_persistLocalLayout:()=>{},hass:{callWS:async message=>{
      calls.push(structuredClone(message));
      if(message.type==='houseplan/layout/get')return {layout:structuredClone(saved),rev:7};
      if(message.type==='houseplan/layout/set'){saved=structuredClone(message.layout);return {rev:8};}
      if(message.type==='houseplan/config/get')return {rev:3,device_contact_api:1};
      throw new Error('unexpected message');
    }}};
  return {host,calls,saved:()=>saved,setSaved:v=>{saved=v;},retire:()=>{active=false;}};
}
test('#1003 complete fresh layout CAS preserves foreign floors and unknown siblings',async()=>{
  const f=fixture();f.setSaved({...initial,foreign:{...initial.foreign,x:.91},other:{x:.1,y:.1,s:'new-floor'}});
  await persistContactPlacements(f.host,change);
  assert.equal(f.calls.length,2);
  assert.deepEqual(f.saved().foreign,{...initial.foreign,x:.91});assert.ok(f.saved().other);
  assert.deepEqual(f.saved().a.future,{keep:1});
  assert.equal(f.calls[1].expected_rev,7);assert.equal(f.calls[1].expected_config_rev,3);
  assert.equal(f.host._sentPos.size,0);
});
test('#1003 affected position conflict refuses the whole group before sending',async()=>{
  const f=fixture();f.setSaved({...initial,b:{...initial.b,x:.246}});
  await assert.rejects(persistContactPlacements(f.host,change),e=>e.code==='conflict');
  assert.equal(f.calls.length,1);assert.equal(f.host._sentPos.size,0);
});

test('#1003 the group transport canonicalises only edited positions, not foreign data',async()=>{
  const f=fixture();
  const foreign={...initial.foreign,x:.100000000000001};
  f.setSaved({...initial,foreign});
  const input={...change,placement:{x:80/240+1e-12,y:.30000000000001,s:'floor'}};
  await persistContactPlacements(f.host,input);
  assert.equal(f.saved().a.x,80/240);assert.equal(f.saved().a.y,.3);
  assert.deepEqual(f.saved().foreign,foreign);
  assert.notEqual(input.placement.x,f.saved().a.x,'input is not mutated');
});
test('#1003 a config revision arriving during the fresh layout read refuses before sending',async()=>{
  const f=fixture(),transport=f.host.hass.callWS;
  f.host.hass.callWS=async m=>{const answer=await transport(m);if(m.type==='houseplan/layout/get')f.host._cfgRev++;return answer;};
  await assert.rejects(persistContactPlacements(f.host,change),e=>e.code==='conflict');
  assert.equal(f.calls.length,1);assert.deepEqual(f.saved(),initial);
});
test('#1003 late context and CAS refusal never promote attempted positions',async()=>{
  for(const mode of ['retired','conflict']){
    const f=fixture(),transport=f.host.hass.callWS;
    f.host.hass.callWS=async m=>{
      if(m.type==='houseplan/layout/set'){
        if(mode==='retired'){f.retire();return {rev:8};}
        throw Object.assign(new Error('conflict'),{code:'conflict'});
      }
      return transport(m);
    };
    await assert.rejects(persistContactPlacements(f.host,change));
    assert.deepEqual(f.host._layout,initial);
  }
});
test('#1003 lost acknowledgement reconciles a committed pair, never retries layout/set',async()=>{
  const f=fixture(),transport=f.host.hass.callWS;let attempts=0;
  f.host.hass.callWS=async m=>{const result=await transport(m);if(m.type==='houseplan/layout/set'){attempts++;throw new Error('connection lost');}return result;};
  await persistContactPlacements(f.host,change);
  assert.equal(attempts,1);assert.equal(f.host._layout.a.x,.3);assert.equal(f.host._layout.b.x,.345);
});
test('#1003 future bases remain opaque during explicit movement; history comparison ignores JSON key order',()=>{
  const f=fixture(),opaque={v:9,newConstraint:{a:1}};
  f.host._layout.a.contact_basis=opaque;
  const marker=(id,x)=>({id,x,y:200,diameter:40,box:{left:-25.375,right:25.375,top:-25.375,bottom:25.375}});
  f.host._deviceContacts={scene:new DeviceContactScene([marker('a',300),marker('b',345)],[])};
  const result=prepareContactMove(f.host,{id:'a',spaceId:'floor',before:initial.a,contactMembers:['a','b']},change.placement);
  assert.deepEqual(result.after.placement.contact_basis,opaque);
  assert.equal(result.after.related.length,1);assert.equal(result.after.related[0].placement.contact_basis.v,1);
  assert.ok(sameDevicePlacement({x:1,y:2,contact_basis:{v:9,a:1}},{x:1,y:2,contact_basis:{a:1,v:9}}));
});

test('#1003 terminal basis identity is exactly the canonical placement without a units round trip',()=>{
  const f=fixture(),marker={id:'a',x:.284425*1000,y:.2708333333333333*1000,diameter:40,
    box:{left:-25.375,right:25.375,top:-25.375,bottom:25.375}};
  f.host._deviceContacts={scene:new DeviceContactScene([marker],[])};
  const state=prepareContactMove(f.host,{id:'a',spaceId:'floor',before:initial.a},
    {x:.284425,y:.2708333333333333,s:'floor'}).after;
  assert.deepEqual(state.placement.contact_basis.at,
    {x:state.placement.x,y:state.placement.y,s:'floor'});
});
test('#1003 metric-only Save materialises only its legacy component and checks server capability',async()=>{
  const f=fixture(),marker=(id,x)=>({id,x,y:200,diameter:40,box:{left:-25.375,right:25.375,top:-25.375,bottom:25.375}});
  const scene=new DeviceContactScene([marker('a',200),marker('b',245),marker('foreign',800)],[],[],true);
  f.host._deviceContacts={scene,reference:id=>scene.shapes.get(id)?.marker};
  const patch=await contactConfigPatch(f.host,{markers:[{id:'a',size:2}]});
  assert.deepEqual(Object.keys(patch).sort(),['a','b']);assert.equal(patch.a.contact_basis.legacy,true);
  assert.deepEqual(patch.a.contact_basis.at,{x:.2,y:.2,s:'floor'});
  assert.equal(await contactConfigPatch(f.host,{markers:[{id:'a',size:1,name:'Renamed'}]}),undefined);
  f.host.hass.callWS=async()=>({rev:3});
  assert.equal(await contactConfigPatch(f.host,{markers:[{id:'a',size:2}]}),undefined,'old backend is not sent an unsupported extension');
});
