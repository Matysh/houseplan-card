import test from 'node:test';
import assert from 'node:assert/strict';
import { nothing } from 'lit';
import { DeviceCopyEditor } from '../test-build/device-copy-editor.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';

globalThis.window = { innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {} };
const deferred = () => { let resolve, reject; const promise = new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; };
const turn = () => new Promise(resolve=>setImmediate(resolve));
async function done(editor) { for(let i=0;i<30&&editor.busy;i++)await turn();assert.equal(editor.busy,false,'command settles'); }

function fixture(pdfs=[]) {
  const messages=[],toasts=[],adoptions=[];
  const marker={id:'v_source',binding:'virtual',space:'f1',name:'Lamp',is_light:true,pdfs};
  const d={id:marker.id,name:marker.name,icon:'mdi:lamp',space:'f1',area:'',model:'',entities:[],bindingKind:'virtual',marker,pdfs};
  const h={ isConnected:true,_mode:'devices',_norm:true,_loadOk:true,_canEdit:true,_kiosk:false,_space:'f1',
    _serverCfg:{spaces:[{id:'f1',rooms:[]}],markers:[marker],settings:{}},_layout:{v_source:{s:'f1',x:.3,y:.3}},
    _cfgRev:5,_layoutRev:6,_devices:[d],_devicePositionBusy:false,_deviceDrag:null,
    _config:{language:'en'},_configWriteContext:new ConfigWriteContext(),_dirtyPos:new Set(),_sentPos:new Map(),
    _saveConfigDebounced:{pending:()=>false,flush(){}},_writeChain:Promise.resolve(),
    _planHass:{states:{}},_fillColors:{glow_light:{c:'#ffffff'}},_gridPitch:1000/240,
    _pos:()=>({x:300,y:300}),_devicePresentation:()=>({scale:1}),_spaceModelById:()=>({id:'f1',rooms:[]}),
    requestUpdate(){},_showToast:text=>toasts.push(text),_adoption:{acceptPairWrite:(...args)=>adoptions.push(args)},
    _maybeRebuildDevices(){},_cacheSnapshot(){},_reloadConfigOnly:async()=>{},_reloadLayoutOnly:async()=>{},_view:null,
  };
  h.hass={connection:{},user:{id:'owner'},callWS:async message=>{
    messages.push(structuredClone(message));
    return h.transport?.(message) ?? Promise.reject(new Error('unconfigured transport'));
  },callService:()=>{throw new Error('copy must never call a service');}};
  h._configWriteContext.observe(h.hass);
  const editor=new DeviceCopyEditor(h);
  const open=()=>editor.open({clientX:400,clientY:300,currentTarget:null,preventDefault(){},stopPropagation(){}},d);
  const action=()=>editor.render().values.filter(v=>typeof v==='function').at(-1);
  return {h,editor,messages,toasts,adoptions,open,action};
}

test('#935 menu rejects disallowed surfaces, kiosk and stale config/layout/context without a write',async()=>{
  for(const field of ['_mode','_kiosk','_canEdit','_loadOk','isConnected']) {
    const f=fixture();f.h[field]=field==='_mode'?'plan':field==='_kiosk'?true:false;
    f.open();assert.equal(f.editor.render(),nothing,field);assert.equal(f.messages.length,0);
  }
  for(const change of [h=>h._cfgRev++,h=>h._layoutRev++,h=>{h._mode='view';},
    h=>{h.hass={...h.hass,connection:{}};h._configWriteContext.observe(h.hass);}]) {
    const f=fixture();f.open();const click=f.action();change(f.h);click();await done(f.editor);
    assert.equal(f.messages.length,0);assert.equal(f.adoptions.length,0);assert.equal(f.editor.render(),nothing);
  }
});

test('#935 attachment failure or source retirement during copy preparation cannot submit a marker',async()=>{
  for(const retire of [false,true]) {
    const f=fixture([{name:'Manual',url:'/api/houseplan/content/files/v_source/manual.pdf'}]);
    const files=deferred();f.h.transport=()=>files.promise;
    f.open();f.action()();await turn();
    assert.equal(f.messages[0].type,'houseplan/files/migrate');
    if(retire)f.h._devices=[];
    files.resolve({mapping:retire?{'manual.pdf':'manual.pdf'}:{}});await done(f.editor);
    assert.deepEqual(f.messages.map(m=>m.type),['houseplan/files/migrate']);
    assert.equal(f.adoptions.length,0);assert.equal(f.h._serverCfg.markers.length,1);
    assert.match(f.toasts.at(-1),retire?/changed/:/Attachments/);
  }
});

test('#935 superseded HA reply cannot adopt or clear a newer copy operation',async()=>{
  const f=fixture(),old=deferred(),next=deferred();let calls=0;
  f.h.transport=()=>++calls===1?old.promise:next.promise;
  f.open();f.action()();await turn();assert.equal(f.messages.length,1);
  f.h.hass={...f.h.hass,connection:{}};f.h._configWriteContext.observe(f.h.hass);
  f.h._devicePositionBusy=false; // fake host implements its normal foreign-context retirement
  f.open();f.action()();await turn();assert.equal(f.messages.length,2);
  old.resolve({config:f.h._serverCfg,layout:f.h._layout,config_rev:6,layout_rev:7});await turn();
  assert.equal(f.adoptions.length,0);assert.equal(f.h._devicePositionBusy,true);
  assert.equal(f.editor.busy,true);assert.equal(f.toasts.length,0);
  next.reject(Object.assign(new Error('conflict'),{code:'conflict'}));await done(f.editor);
  assert.equal(f.h._devicePositionBusy,false);assert.equal(f.adoptions.length,0);
});

test('#935 delayed reply after floor change adopts no foreign viewport or success toast',async()=>{
  const f=fixture(),reply=deferred();f.h.transport=()=>reply.promise;
  f.open();f.action()();await turn();f.h._space='f2';
  reply.resolve({config:f.h._serverCfg,layout:f.h._layout,config_rev:6,layout_rev:7});await done(f.editor);
  assert.equal(f.adoptions.length,1,'same HA may adopt the already accepted global pair');
  assert.equal(f.h._space,'f2');assert.equal(f.toasts.length,0);
});

test('#935 invalid graph refusal tells the user to check links rather than blindly refresh',async()=>{
  for(const code of ['marker_control_cycle','marker_control_self','marker_control_missing','invalid_marker_control','duplicate_marker_control']) {
    const f=fixture();f.h.transport=()=>Promise.reject(Object.assign(new Error('private backend detail'),{code}));
    f.open();f.action()();await done(f.editor);
    assert.match(f.toasts.at(-1),/control links.*Check the original/);
    assert.equal(f.adoptions.length,0);assert.equal(f.h._serverCfg.markers.length,1);
    assert.equal(f.messages.length,1,'no automatic retry after graph refusal');
  }
});
