import test from 'node:test';
import assert from 'node:assert/strict';
import { nudgePlan } from '../test-build/editors/plan-nudge.js';
import { KeyboardNudge, arrowControl } from '../test-build/editors/keyboard-nudge.js';
import { prepareContactMove, persistContactPlacements } from '../test-build/device-contact-write.js';
import { applyDevicePlacement } from '../test-build/device-position-history.js';
import { PropertiesCommandLane } from '../test-build/editors/properties/controller.js';
const step=1/240, near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} ~= ${b}`);
const wall=(id,a,b)=>({id,a,b,cm:10,future:{unchanged:[1,2]}});
const space=()=>({id:'floor',rooms:[],wall_segments:[],partitions:[wall('p',[.183,.3],[.683,.3])],openings:[]});

test('free whole-wall translation preserves offset, shape/id, hosted openings and unknown fields without aliasing',()=>{
  for(const vector of [[step,0],[-step,0],[0,step],[0,-step]]) for(const end of [[.683,.3],[.183,.8],[.683,.8]]){
    const source=space();source.partitions[0].b=end;
    source.openings=[{id:'o',type:'window',x:.433,y:.3,length:.04,angle:0,host:{kind:'partition',id:'p',t:.5},contact:'binary_sensor.x',future:{a:[1]}}];
    const frozen=structuredClone(source), result=nudgePlan(source,{kind:'partition',id:'p'},...vector,5);
    assert.ok(result); assert.deepEqual(source,frozen);
    for(const key of ['a','b'])for(let i=0;i<2;i++)near(result.partitions[0][key][i],source.partitions[0][key][i]+vector[i]);
    assert.deepEqual(result.openings[0].host,source.openings[0].host);
    assert.deepEqual(result.openings[0].future,{a:[1]}); assert.equal(result.openings[0].contact,'binary_sensor.x');
    result.partitions[0].future.unchanged[0]=99;assert.equal(source.partitions[0].future.unchanged[0],1);
  }
});

test('L/T/X/chain/interior/coincident and room walls do not move; new intersections/bounds are refused',()=>{
  for(const other of [wall('q',[.683,.3],[.8,.5]),wall('q',[.4,.3],[.4,.7]),wall('q',[.4,.1],[.4,.7]),wall('q',[.3,.3],[.5,.3]),wall('q',[.183,.3],[.683,.3])]){
    const source=space();source.partitions.push(other);
    for(const delta of [[step,0],[-step,0],[0,step],[0,-step]])assert.equal(nudgePlan(source,{kind:'partition',id:'p'},...delta,5),null);
  }
  const room=space();room.wall_segments=[wall('boundary',[.1,.1],[.8,.1])];room.rooms=[{id:'r',name:'',wall_ids:['boundary'],poly:[[.1,.1],[.8,.1],[.8,.8],[.1,.8]]}];
  assert.equal(nudgePlan(room,{kind:'contour',id:'boundary'},0,step,5),null);
  // The supported legacy room projection can predate explicit wall_ids.
  const legacy=structuredClone(room);delete legacy.rooms[0].wall_ids;
  for(const delta of [[step,0],[-step,0],[0,step],[0,-step]])assert.equal(nudgePlan(legacy,{kind:'contour',id:'boundary'},...delta,5),null);
  const collision=space();collision.partitions.push(wall('q',[.4,.3+step],[.4,.8]));
  assert.equal(nudgePlan(collision,{kind:'partition',id:'p'},0,step,5),null);
  const bound=space();bound.partitions[0]=wall('p',[4999.7,.3],[5000,.3]);
  assert.equal(nudgePlan(bound,{kind:'partition',id:'p'},step,0,5),null);
});

test('all opening types choose the dominant axis, exact 45 degrees Left/Right, independent of endpoint order/sign',()=>{
  for(const type of ['door','window','gate','passage'])for(const vector of [[.5,.2],[.5,.5],[.2,.5],[.5,-.5],[-.5,.2]])for(const reverse of [false,true]){
    const source=space(), a=[.2,.6],b=[a[0]+vector[0],a[1]+vector[1]];
    source.partitions=[wall('p',reverse?b:a,reverse?a:b)];
    source.openings=[{id:'o',type,x:(a[0]+b[0])/2,y:(a[1]+b[1])/2,length:.03,angle:0,host:{kind:'partition',id:'p',t:.5},lock:'lock.x',future:{opaque:true}}];
    const horizontal=Math.abs(vector[0])>=Math.abs(vector[1]), d=horizontal?[step,0]:[0,step];
    const result=nudgePlan(source,{kind:'opening',id:'o'},...d,5);assert.ok(result,`${type} ${vector} reverse=${reverse}`);
    const original=source.openings[0],moved=result.openings[0];
    near(Math.hypot(moved.x-original.x,moved.y-original.y),step);
    assert.ok(horizontal?moved.x>original.x:moved.y>original.y);
    assert.deepEqual(moved.future,original.future);assert.equal(moved.lock,original.lock);assert.equal(moved.host.id,'p');assert.equal(moved.length,original.length);
    assert.equal(nudgePlan(source,{kind:'opening',id:'o'},...(horizontal?[0,step]:[step,0]),5),null);
    const back=nudgePlan(result,{kind:'opening',id:'o'},...d.map(n=>-n),5);near(back.openings[0].x,original.x);near(back.openings[0].y,original.y);
  }
});

test('opening full-step end/jamb/overlap failures never clamp or change host; room and connected hosts remain usable',()=>{
  const source=space();source.openings=[{id:'o',type:'door',x:.3,y:.3,length:.08,angle:0,host:{kind:'partition',id:'p',t:.5}}];
  source.partitions.push(wall('q',[.683,.3],[.683,.6]));
  assert.ok(nudgePlan(source,{kind:'opening',id:'o'},step,0,5));
  source.openings[0].host.t=.99;
  assert.equal(nudgePlan(source,{kind:'opening',id:'o'},step,0,5),null);
  source.openings[0].host.t=.5;source.openings.push({...source.openings[0],id:'other',host:{kind:'partition',id:'p',t:.5+(.08/2+.08/2+step/2)/.5}});
  assert.equal(nudgePlan(source,{kind:'opening',id:'o'},step,0,5),null);
  const room=space();room.partitions=[];room.wall_segments=[wall('w',[.1,.1],[.9,.1])];
  room.openings=[{id:'o',type:'door',x:.5,y:.1,length:.08,angle:0,host:{kind:'wall',id:'w',t:.5,future:{keep:[1]}}}];
  const moved=nudgePlan(room,{kind:'opening',id:'o'},step,0,5);assert.ok(moved);near(moved.openings[0].x,.5+step);assert.equal(moved.openings[0].host.id,'w');
  assert.deepEqual(moved.openings[0].host.future,{keep:[1]});moved.openings[0].host.future.keep[0]=2;assert.equal(room.openings[0].host.future.keep[0],1);
  room.openings[0].host.id='missing';assert.equal(nudgePlan(room,{kind:'opening',id:'o'},step,0,5),null);
});

test('exact contact target does not reuse old rendered selected point or move the other member',()=>{
  const shapes=new Map(['a','b'].map((id,i)=>[id,{marker:{id,x:100+i*50,y:200,diameter:30,box:{left:0,right:0,top:0,bottom:0}},walls:{}}]));
  const host={_layout:{a:{x:.1,y:.2,s:'floor'},b:{x:.15,y:.2,s:'floor'}},_deviceContacts:{scene:{shapes,component:()=>['a','b']}}};
  const result=prepareContactMove(host,{id:'a',spaceId:'floor',before:host._layout.a},{x:.1+step,y:.2,s:'floor'},true);
  near(result.after.placement.x,.1+step);assert.equal(result.after.related[0].placement.x,.15);
  assert.equal(result.before.related[0].placement.x,.15);assert.equal(host._layout.a.x,.1);
});

function setup(options={}){
  let server={a:{x:.2,y:.3,s:'floor',future:{keep:true}},other:{x:.8,y:.7,s:'upstairs',future:[1,2]}},revision=1,held=null;
  let authority={};const calls=[],history=[],root={ownerDocument:{activeElement:null},querySelector:()=>null};
  const h={isConnected:true,_canEdit:true,_kiosk:false,_norm:true,_loadOk:true,_serverStorage:true,_space:'floor',_mode:'devices',_tool:'select',_selId:'a',
    _serverCfg:{spaces:[space()]},_cfgRev:1,_layoutRev:1,_layout:structuredClone(server),_pointers:new Map(),_path:[],_resize:{dragging:false},_devices:[{id:'a',space:'floor',name:'A'}],renderRoot:root,
    _configWriteGuard:()=>()=>true,_configWriteContext:{claim:()=>authority,current:a=>a===authority,owns:a=>a===authority},
    _t:k=>k,_errText:e=>String(e),_showToast:()=>{},requestUpdate:()=>{},_sentPos:new Map(),_cacheSnapshot:()=>{},_persistLocalLayout:()=>{},
    _layoutIO:{guard:()=>()=>true,begin:()=>()=>{}},_devicePositionHistory:{push:c=>history.push(c)}};
  let accepted=structuredClone(server);
  h._adoption={adoptionEpoch:1,snapshot:()=>({layout:accepted}),stageLocalLayout:v=>h._layout=v,
    acceptLayoutPosition:(id,pos,rev)=>{accepted={...accepted,[id]:structuredClone(pos)};h._layoutRev=rev;},refreshLayoutFingerprint:()=>{}};
  h._pos=()=>({x:h._layout.a.x*1000,y:h._layout.a.y*1000});h._devicePlacementForCanvas=(d,x,y)=>({x:x/1000,y:y/1000,s:'floor'});
  h._previewDevicePlacement=(id,p)=>h._layout=applyDevicePlacement(h._layout,id,p);
  h._reloadLayoutOnly=async()=>{h._layout=structuredClone(server);h._layoutRev=revision;accepted=structuredClone(server);};
  h.hass={callWS:async message=>{calls.push(structuredClone(message));if(message.type.endsWith('/get')){await options.beforeRead?.();return{layout:structuredClone(server),rev:revision};}
    assert.equal(message.expected_rev,revision);assert.equal(message.expected_config_rev,1);if(options.reject)throw Object.assign(new Error('refused'),{code:'conflict'});
    server=structuredClone(message.layout);const response={rev:++revision},wait=held;held=null;if(wait)await wait;if(options.transportLoss)throw new Error('connection lost after commit');return response;}};
  h._persistDevicePlacement=(id,placement,related,guard)=>persistContactPlacements(h,{deviceId:id,spaceId:'floor',placement,related},guard);
  const lane=new PropertiesCommandLane(),runtime={host:h,navigationIntent:0,properties:{identity:null,fields:{draft:null},command:run=>lane.run(run)},physicalGesture:{drag:null},stairs:{dragging:false}};
  const nudge=new KeyboardNudge(runtime);runtime.keyboardNudge=nudge;
  const key={composedPath:()=>[],defaultPrevented:false,ctrlKey:false,altKey:false,metaKey:false};
  return{h,runtime,nudge,key,calls,history,lane,drain:()=>lane.settled(),server:()=>server,serverRevision:value=>revision=value,
    newAuthority:()=>{authority={};nudge.retire();lane.retire();h._devicePositionBusy=false;h._layout=structuredClone(server);h._layoutRev=revision;accepted=structuredClone(server);},
    hold:()=>{let resolve;held=new Promise(r=>resolve=r);return resolve;}};
}

test('accepted repeats serialize exact steps with one fresh full CAS and history per key',async()=>{
  const x=setup();for(let i=0;i<3;i++)assert.equal(x.nudge.handle(x.key,1000*step,0),true);
  await x.drain();near(x.h._layout.a.x,.2+3*step);assert.equal(x.history.length,3);
  assert.equal(x.calls.filter(c=>c.type.endsWith('/set')).length,3);
  assert.deepEqual(x.calls.filter(c=>c.type.endsWith('/set')).map(c=>c.expected_rev),[1,2,3]);
  assert.deepEqual(x.server().other,{x:.8,y:.7,s:'upstairs',future:[1,2]});assert.deepEqual(x.server().a.future,{keep:true});
});

test('no-op bounds and input/authority/gesture guards do not enqueue or consume',async()=>{
  const x=setup();x.h._layout.a.x=5000;
  assert.equal(x.nudge.handle(x.key,1000*step,0),false);
  x.h._layout.a.x=.2;
  for(const change of [{_canEdit:false},{_kiosk:true},{_mode:'view'},{_pointers:new Map([[1,{}]])}]){
    const before={};for(const k of Object.keys(change)){before[k]=x.h[k];x.h[k]=change[k];}
    assert.equal(x.nudge.handle(x.key,1000*step,0),false);Object.assign(x.h,before);
  }
  assert.equal(x.nudge.handle({...x.key,defaultPrevented:true},1000*step,0),false);
  assert.equal(arrowControl([{matches:selector=>selector.includes('input')}]),true);
  await x.drain();assert.equal(x.calls.length,0);assert.equal(x.history.length,0);
});

test('foreign revision/selection retirement while queued cannot replay old steps or append history',async()=>{
  const x=setup(),release=x.hold();x.nudge.handle(x.key,1000*step,0);x.nudge.handle(x.key,1000*step,0);
  await new Promise(r=>setImmediate(r));assert.equal(x.calls.filter(c=>c.type.endsWith('/set')).length,1);
  x.h._layoutRev=99;x.h._layout={a:{x:.8,y:.9,s:'floor'}};x.nudge.retire();release();await x.drain();
  assert.deepEqual(x.h._layout.a,{x:.8,y:.9,s:'floor'});assert.equal(x.history.length,0);assert.equal(x.calls.filter(c=>c.type.endsWith('/set')).length,1);
});

test('retired pending command does not consume a new selection key while its wire is busy',async()=>{
  const x=setup(),release=x.hold();x.nudge.handle(x.key,1000*step,0);await new Promise(r=>setImmediate(r));
  x.nudge.retire();assert.equal(x.nudge.handle(x.key,0,1000*step),false);release();await x.drain();assert.equal(x.history.length,0);
});

test('reserved boundary steps and modifiers stay no-op before queued work begins',async()=>{
  const x=setup();x.h._layout.a.x=5000-step;
  let release;x.lane.run(()=>new Promise(r=>release=r));
  assert.equal(x.nudge.handle({...x.key,shiftKey:true},1000*step,0),true);
  assert.equal(x.nudge.handle(x.key,1000*step,0),false);
  for(const modifier of ['ctrlKey','metaKey','altKey'])assert.equal(x.nudge.handle({...x.key,[modifier]:true},0,1000*step),false);
  x.nudge.retire();release();await x.drain();assert.equal(x.calls.length,0);
});

test('fresh complete read revision mismatch refuses dispatch and restores only the owned preview',async()=>{
  const x=setup();x.serverRevision(2);x.nudge.handle(x.key,1000*step,0);await x.drain();
  near(x.h._layout.a.x,.2);assert.equal(x.history.length,0);assert.equal(x.calls.filter(c=>c.type.endsWith('/set')).length,0);
});

test('permission loss during read retires unsent work and removes its unchanged preview',async()=>{
  let release;const read=new Promise(r=>release=r),x=setup({beforeRead:()=>read});
  x.nudge.handle(x.key,1000*step,0);await new Promise(r=>setImmediate(r));
  x.h._canEdit=false;x.nudge.retire();release();await x.drain();
  near(x.h._layout.a.x,.2);assert.equal(x.history.length,0);assert.equal(x.calls.filter(c=>c.type.endsWith('/set')).length,0);
});

test('a rejected full CAS rolls back; a lost accepted reply reconciles without replaying set',async()=>{
  const rejected=setup({reject:true});rejected.nudge.handle(rejected.key,1000*step,0);await rejected.drain();
  near(rejected.h._layout.a.x,.2);assert.equal(rejected.history.length,0);
  const lost=setup({transportLoss:true});lost.nudge.handle(lost.key,1000*step,0);await lost.drain();
  near(lost.h._layout.a.x,.2+step);assert.equal(lost.history.length,1);assert.equal(lost.calls.filter(c=>c.type.endsWith('/set')).length,1);
});

test('own exact echo is accepted but newer foreign revision with the same point is not',async()=>{
  for(const foreign of [false,true]){
    const x=setup(),release=x.hold();x.nudge.handle(x.key,1000*step,0);await new Promise(r=>setImmediate(r));
    x.h._layoutRev=foreign?99:2;if(foreign)x.serverRevision(99);release();await x.drain();assert.equal(x.history.length,foreign?0:1);assert.equal(x.h._layoutRev,foreign?99:2);
  }
});

test('a held old HA receipt cannot block or retire a fresh authority command lane',async()=>{
  const x=setup(),release=x.hold();x.nudge.handle(x.key,1000*step,0);await new Promise(r=>setImmediate(r));
  x.newAuthority();assert.equal(x.nudge.handle(x.key,1000*step,0),true);await x.drain();
  near(x.h._layout.a.x,.2+2*step);assert.equal(x.history.length,1);
  release();await new Promise(r=>setImmediate(r));near(x.h._layout.a.x,.2+2*step);assert.equal(x.history.length,1);
});
