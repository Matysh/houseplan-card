import test from 'node:test';
import assert from 'node:assert/strict';
import { createWallNodeEditor } from '../test-build/wall-node-card-adapter.js';
import { nodeFloorFingerprint } from '../test-build/wall-node-write.js';

test('#1246 retained canvas callbacks never infer a later modal; history captures at invocation',async t=>{
  const messages=[],view=new EventTarget();let captures=0;
  const host={
    _mode:'plan',_tool:'select',_canEdit:true,_kiosk:false,isConnected:true,
    _config:{language:'en'},hass:{},_t:key=>key,
    renderRoot:{ownerDocument:{defaultView:view}},
    _geometryHistory:{peekUndo:()=>null},
    _showToast:(message,id,context)=>messages.push({message,id,context}),
    _captureToast:()=>{captures++;return ()=>{};},
  };
  const editor=createWallNodeEditor(host,{canShow:()=>true,show:()=>{}});t.after(()=>editor.dispose());
  await Promise.resolve().then(()=>editor.port.toast('late canvas refusal','node_move_invalid'));
  assert.deepEqual(messages,[{message:'late canvas refusal',id:'node_move_invalid',context:{owner:null}}]);
  assert.equal(captures,0,'constructing the adapter does not capture a future action');
  await editor.port.history('undo');
  assert.equal(captures,1,'each history invocation captures its own surface before writing');
});

test('#1246 a real pending node-history refusal retains its starting action, not a later dialog',async t=>{
  const space={id:'f',rooms:[],partitions:[]},messages=[],view=new EventTarget();
  let surface='canvas',release,sent=0;
  const gate=new Promise(resolve=>{release=resolve;});
  const command={name:'Delete node',before:{nodeMove:{kind:'delete',beforeSpace:space,
    intent:{point:[0,0]},direction:'undo',floor:nodeFloorFingerprint(space)}},after:{}};
  const host={
    _mode:'plan',_tool:'select',_canEdit:true,_kiosk:false,isConnected:true,
    _space:'f',_cfgRev:1,_haWallNodeDeleteApi:1,_config:{language:'en'},_t:key=>key,
    _serverCfg:{spaces:[space],markers:[],settings:{}},_adoption:{adoptionEpoch:0},
    _writeChain:Promise.resolve(),_saveConfigDebounced:{pending:()=>false},
    _configWriteGuard:()=>()=>true,_reloadRejectedPhysicalWrite:async()=>{},
    renderRoot:{ownerDocument:{defaultView:view}},
    _geometryHistory:{peekUndo:()=>command},
    hass:{callWS:async()=>{sent++;await gate;throw Object.assign(new Error('refused'),{code:'node_delete_unsafe'});}},
    _showToast:()=>assert.fail('history must not infer the current modal at delivery'),
    _captureToast:()=>{const owner=surface;return (text,id)=>messages.push({owner,text,id});},
  };
  const editor=createWallNodeEditor(host,{canShow:()=>true,show:()=>{}});t.after(()=>editor.dispose());
  const pending=editor.port.history('undo');
  for(let turn=0;turn<15&&!sent;turn++)await Promise.resolve();
  assert.equal(sent,1,'the request is genuinely in flight before the surface changes');
  surface='new-dialog';release();await pending;
  assert.equal(messages.length,1);assert.equal(messages[0].owner,'canvas');
  assert.match(messages[0].id,/^node_delete_/);
  assert.equal(host._geometryHistory.peekUndo(),command,'toast routing does not retire refused history');
});
