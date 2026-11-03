import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {ConfigReloadAuthority,reloadConfigOnly} from '../test-build/config-reload-authority.js';

const oldWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
globalThis.window={customCards:[]};
after(()=>{if(oldWindow)Object.defineProperty(globalThis,'window',oldWindow);else delete globalThis.window;});
const {HouseplanEditorRuntime}=await import('../test-build/houseplan-editor-runtime.js');

test('#1246 Save forwards its pre-upload callback through queued write and recovery reload',async()=>{
  for(const physical of [false,true]){
    const events=[],showToast=(message,id)=>events.push({owner:'space',message,id});
    const refusal=physical?{physicalGeometryRolledBack:true}:{code:'conflict'};
    const current=()=>true,acknowledgement=()=>true;
    const runtime=Object.create(HouseplanEditorRuntime.prototype);
    runtime.host={_cfgEpoch:0,_writeChain:Promise.resolve(),
      _captureToast:()=>assert.fail('an inner Save/reload must not recapture a new confirmation'),
      _reloadConfigOnly:async(_force,_revision,_afterApplied,toast)=>{
        assert.equal(toast,showToast);toast('reload failure','toast.cfg_reload_failed');
      },
    };
    runtime._writeConfig=async(attempt,guard,ack,toast)=>{
      assert.equal(attempt,null);assert.equal(guard,current);assert.equal(ack,acknowledgement);
      assert.equal(toast,showToast);await Promise.resolve();toast('write failure','toast.geometry_unsafe');throw refusal;
    };
    await assert.rejects(runtime._saveConfigNow(null,current,acknowledgement,showToast),error=>error===refusal);
    assert.deepEqual(events.map(event=>event.owner),['space','space']);
    assert.deepEqual(events.map(event=>event.id),['toast.geometry_unsafe','toast.cfg_reload_failed']);
    assert.equal(runtime.host._cfgEpoch,1);
  }
});

test('#1246 reload accepts the originating callback instead of the now-active dialog',async t=>{
  const oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname:'/houseplan'}});
  t.after(()=>{if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);else delete globalThis.location;});
  const messages=[],host={hass:{connection:{},user:{id:'writer'}},isConnected:true,panelHost:true,
    _configReloadAuthority:new ConfigReloadAuthority(),_adoption:{currentConfigFingerprint:()=> 'base'},_cfgRev:1,_cfgWriting:false,
    _saveConfigDebounced:{pending:()=>false,flush(){}},_continuityDataReady:false,
    _getAuthoritativeConfig:async()=>{throw Error('reload refused');},
    _captureToast:()=>assert.fail('the explicit operation context must survive reload'),
    _t:key=>key,_errText:String,requestUpdate(){},
  };
  await reloadConfigOnly(host,true,undefined,undefined,(message,id)=>messages.push({owner:'space',message,id}));
  assert.deepEqual(messages,[{owner:'space',message:'toast.cfg_reload_failed',id:'toast.cfg_reload_failed'}]);
});
