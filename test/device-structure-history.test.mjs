import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandStack } from '../test-build/command-stack.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';
import { DeviceStructureHistory } from '../test-build/device-structure-history.js';
import { retireDeviceBaseline } from '../test-build/device-position-history.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  const calls=[],toasts=[],adopted=[];
  const h={ isConnected:true,_mode:'devices',_space:'f1',_canEdit:true,_kiosk:false,_haDeviceHistoryApi:1,
    _config:{language:'en'},_configWriteContext:new ConfigWriteContext(),_cfgRev:1,_layoutRev:2,
    _devicePositionBusy:false,_dirtyPos:new Set(),_sentPos:new Map(),_writeChain:Promise.resolve(),
    _saveConfigDebounced:{pending:()=>false,flush(){}},_serverCfg:{markers:[],spaces:[{id:'f1'}]},
    requestUpdate(){},_showToast:(text,key)=>toasts.push({text,key}),_t:(key,{name}={})=>key+':'+name,
    _adoption:{acceptPairWrite:(...args)=>adopted.push(args)},_maybeRebuildDevices(){},_cacheSnapshot(){},
    _selId:'new',_modelCache:null,_frame:null,_regSignature:'',_cfgEpoch:0,_deviceInboxMemo:null,
  };
  h.hass={connection:{},user:{id:'owner'},callWS:async request=>{
    calls.push(structuredClone(request));
    if(request.type.endsWith('/retain'))return {ok:true};
    return h.transport(request);
  }};
  h._configWriteContext.observe(h.hass);
  const history=new DeviceStructureHistory(h);
  h._devicePositionHistory=new CommandStack(50,()=>history.prune());
  const fields=history.fields();
  const reply={config:{markers:[{id:'new'}],spaces:[{id:'f1'}]},layout:{new:{x:.2,y:.3}},config_rev:2,layout_rev:3,history_token:fields.operation_id};
  const record=()=>history.record(reply,'Copy Lamp','new','f1');
  return {h,history,calls,toasts,adopted,reply,record};
}

test('#1073 structural Undo keeps cursor until ACK; repeat action is ignored and success moves one cursor',async()=>{
  const f=fixture();f.record();const command=f.h._devicePositionHistory.peekUndo(),reply=deferred();
  f.h.transport=()=>reply.promise;
  const pending=f.history.restore('undo',command);await turn();
  assert.equal(f.h._devicePositionHistory.peekUndo(),command);
  assert.equal(f.h._devicePositionHistory.peekRedo(),null);
  assert.equal(f.h._devicePositionBusy,true);
  assert.match(f.history.pending,/Undoing: Copy Lamp/);
  await f.history.restore('undo',command);
  assert.equal(f.calls.filter(c=>c.type==='houseplan/marker/history').length,1);
  reply.resolve({...f.reply,config:{markers:[],spaces:[{id:'f1'}]}});await pending;
  assert.equal(f.h._devicePositionHistory.peekUndo(),null);
  assert.equal(f.h._devicePositionHistory.peekRedo(),command);
  assert.equal(f.h._devicePositionBusy,false);assert.equal(f.history.pending,null);
  assert.equal(f.h._selId,null);assert.equal(f.adopted.length,1);
  f.history.retire();
});

test('#1073 ordinary backend refusal keeps cursor; unfit target removes only its command',async()=>{
  for(const code of ['commit_failed','device_history_conflict','device_history_unavailable']) {
    const f=fixture();f.h._devicePositionHistory.push({name:'Move independent',before:{deviceId:'other',spaceId:'f1',placement:null},after:{deviceId:'other',spaceId:'f1',placement:null}});
    f.record();const command=f.h._devicePositionHistory.peekUndo();
    f.h.transport=()=>Promise.reject({code});
    await f.history.restore('undo',command);
    assert.equal(f.h._devicePositionHistory.size,code==='commit_failed'?2:1);
    assert.equal(f.h._devicePositionHistory.canRedo,false);
    assert.equal(f.adopted.length,0);assert.equal(f.h._devicePositionBusy,false);
    assert.equal(f.toasts.at(-1).key,code==='device_history_unavailable'?'history.device_restore_unavailable':'history.device_structure_conflict');
    f.history.retire();
  }
});

test('#1073 a lost transport response reuses the exact action ID and payload, never another Copy',async()=>{
  const f=fixture();let count=0,accepted=0;
  f.h.transport=()=>++count===1?Promise.reject(new Error('lost transport')):Promise.resolve(f.reply);
  const request={type:'houseplan/marker/copy',...f.history.fields(),marker:{id:'same'}};
  await f.history.request(request,()=>accepted++);
  assert.equal(accepted,1);assert.equal(count,2);
  assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(f.history.unresolved,null);
  f.history.retire();
});

test('#1073 a twice-lost result remains unresolved and an explicit check recovers the same operation',async()=>{
  const f=fixture();let count=0,accepted=0;
  f.h.transport=()=>++count<=2?Promise.reject(new Error('lost transport')):Promise.resolve(f.reply);
  const request={type:'houseplan/marker/copy',...f.history.fields(),marker:{id:'same'}};
  await assert.rejects(f.history.request(request,()=>accepted++));
  assert.equal(f.history.needsResolution,true);assert.equal(accepted,0);
  assert.match(f.history.pending,/not confirmed/);
  await f.history.recover();
  assert.equal(accepted,1);assert.equal(f.history.needsResolution,false);assert.equal(f.history.pending,null);
  assert.deepEqual(f.calls.filter(c=>c.type==='houseplan/marker/copy'),[request,request,request]);
  f.history.retire();
});

test('#1073 a definitive replay refusal resolves unknown outcome and retires only its unavailable token',async()=>{
  for(const lostReplies of [1,2]) {
    const f=fixture();f.record();const token=f.reply.history_token;let count=0;
    f.h._devicePositionHistory.push({name:'Independent',before:{deviceId:'other',spaceId:'f1',placement:null},after:{deviceId:'other',spaceId:'f1',placement:null}});
    f.h.transport=()=>Promise.reject(++count<=lostReplies?new Error('lost transport'):Object.assign(new Error('expired'),{code:'device_history_unavailable'}));
    const request={type:'houseplan/marker/history',...f.history.fields(),action:'undo',token};
    await assert.rejects(f.history.request(request,()=>assert.fail('refused operation accepted')));
    assert.equal(f.history.needsResolution,lostReplies===2);
    if(lostReplies===2){f.h._devicePositionBusy=true;await f.history.recover();
      assert.equal(f.h._devicePositionBusy,false);assert.equal(f.history.pending,null);
      assert.equal(f.h._devicePositionHistory.size,1);assert.equal(f.h._devicePositionHistory.peekUndo().name,'Independent');}
    assert.equal(f.history.needsResolution,false);
    const replays=f.calls.filter(call=>call.type==='houseplan/marker/history');
    assert.equal(replays.length,lostReplies+1);assert.ok(replays.every(call=>JSON.stringify(call)===JSON.stringify(request)));
    f.history.retire();
  }
});

test('#1073 a twice-lost structural Undo retains only its unknown status, without a false conflict toast',async()=>{
  const f=fixture();f.record();const command=f.h._devicePositionHistory.peekUndo();
  f.h.transport=()=>Promise.reject(new Error('wire reply lost'));
  await f.history.restore('undo',command);
  assert.equal(f.history.needsResolution,true);assert.match(f.history.pending,/not confirmed/);
  assert.equal(f.h._devicePositionBusy,true);assert.deepEqual(f.toasts,[]);
  assert.equal(f.h._devicePositionHistory.peekUndo(),command);
  f.history.retire();
});

test('#1073 user/connection/mode changes during structural confirmation cannot adopt or consume history',async()=>{
  for(const change of [h=>h._mode='view',h=>h._canEdit=false,h=>{h.hass={...h.hass,connection:{}};h._configWriteContext.observe(h.hass);}]) {
    const f=fixture();f.record();const command=f.h._devicePositionHistory.peekUndo(),reply=deferred();
    f.h.transport=()=>reply.promise;
    const pending=f.history.restore('undo',command);await turn();change(f.h);
    reply.resolve(f.reply);await pending;
    assert.equal(f.adopted.length,0);assert.equal(f.toasts.length,0);
    assert.equal(f.h._devicePositionHistory.peekUndo(),command);
    f.history.retire();
  }
});

test('#1073 mixed history keeps optimistic placement cursor behavior; structural confirmations are separate',async()=>{
  const f=fixture();f.record();const structural=f.h._devicePositionHistory.peekUndo();
  const move={name:'Move',before:{deviceId:'new',spaceId:'f1',placement:{x:.1,y:.2}},after:{deviceId:'new',spaceId:'f1',placement:{x:.3,y:.4}}};
  f.h._devicePositionHistory.push(move);
  const oldPosition=f.h._devicePositionHistory.positionOf(move);
  assert.equal(f.h._devicePositionHistory.undo(),move,'existing optimistic cursor moves immediately');
  assert.equal(f.h._devicePositionHistory.peekUndo(),structural);
  f.h._devicePositionHistory.restorePosition(move,oldPosition);
  assert.equal(f.h._devicePositionHistory.peekUndo(),move,'refused optimistic write restores the same next step');
  assert.equal(f.history.pending,null);
  f.history.retire();
});

test('#1073 51st command, redo branching, clear and foreign baseline retain/release only correct pins',()=>{
  const f=fixture();
  for(let i=0;i<51;i++)f.history.record({...f.reply,history_token:'token_'+i},'Copy '+i,'new_'+i,'f1');
  assert.equal(f.h._devicePositionHistory.size,50);
  assert.equal(f.calls.at(-1).tokens.length,50);assert.equal(f.calls.at(-1).tokens.includes('token_0'),false);
  f.h._devicePositionHistory.undo();
  f.h._devicePositionHistory.push({name:'Move',before:{deviceId:'other',spaceId:'f1',placement:null},after:{deviceId:'other',spaceId:'f1',placement:null}});
  assert.equal(f.calls.at(-1).tokens.includes('token_50'),false);
  retireDeviceBaseline(f.h._devicePositionHistory);
  assert.equal(f.h._devicePositionHistory.size,49);
  assert.ok(f.h._devicePositionHistory.commands().every(c=>c.before.kind==='structure'));
  f.h._devicePositionHistory.clear();assert.deepEqual(f.calls.at(-1).tokens,[]);
  f.history.retire();
});

test('#1073 guarded mixed stack preserves independent steps through its own paired baseline; placement-only stacks retain old reset',()=>{
  const stack=new CommandStack(50,undefined,true);
  const move={name:'Move',before:{deviceId:'a',spaceId:'f1',placement:null},after:{deviceId:'a',spaceId:'f1',placement:{x:.1,y:.2}}};
  stack.push(move);
  const unpin=stack.pinBaseline();retireDeviceBaseline(stack);assert.equal(stack.size,1);
  const state={kind:'structure',deviceId:'b',spaceId:'f1',token:'token'};
  stack.push({name:'Copy',before:state,after:state});unpin();
  retireDeviceBaseline(stack);assert.equal(stack.size,2);
  stack.removeWhere(command=>command.before.kind==='structure');
  retireDeviceBaseline(stack);assert.equal(stack.size,0);
});

test('#1073 a stale paired reply cannot replace a newer config or layout; completion awaits coherent readback',async()=>{
  const f=fixture(),config=deferred(),layout=deferred();let reads=0;
  f.h._cfgRev=f.reply.config_rev+1;
  f.h._reloadConfigOnly=()=>{reads++;return config.promise;};
  f.h._reloadLayoutOnly=()=>{reads++;return layout.promise;};
  let complete=false;const pending=f.history.adopt(f.reply).then(()=>complete=true);await turn();
  assert.equal(reads,2);assert.equal(f.adopted.length,0);assert.equal(complete,false);
  config.resolve();layout.resolve();await pending;
  assert.equal(complete,true);assert.equal(f.adopted.length,0);
  f.history.retire();
});

test('#1073 unchanged retained commands send one housekeeping RPC; explicit heartbeat still renews the lease',()=>{
  const f=fixture();f.record();f.history.prune();f.history.prune();
  assert.equal(f.calls.filter(row=>row.type.endsWith('/retain')).length,1);
  f.history.prune(true);
  assert.equal(f.calls.filter(row=>row.type.endsWith('/retain')).length,2);
  f.history.retire();
});
