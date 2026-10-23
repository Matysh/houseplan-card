import test from 'node:test';
import assert from 'node:assert/strict';
import { PropertiesEditor } from '../test-build/editors/properties/editor.js';
import { ConfigWriteContext } from '../test-build/config-write-context.js';
import { createConfigAdoption } from '../test-build/config-adoption.js';
import { CommandStack } from '../test-build/command-stack.js';
import { applyDevicePlacement } from '../test-build/device-position-history.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function harness(kind='rect') {
  const config={model_version:10,spaces:[{id:'floor',title:'Floor',rooms:[],decor:[
    {id:'shape',kind:'rect',x:.1,y:.2,w:.3,h:.2,color:'#ABCDEF',opacity:1,future:null}]}],
    markers:[{id:'light',binding:'virtual',space:'floor',name:'Light',size:null,angle:0,future:{keep:true}}],settings:{}};
  const state={writes:[],records:[],toasts:[],prepareError:false,hold:null,saveError:null};
  const adoption=createConfigAdoption(), context=new ConfigWriteContext();
  adoption.adoptResponses({config:structuredClone(config),rev:1},undefined,()=>{},()=>{});
  const host={hass:{connection:{},user:{id:'owner'},callWS:async()=>({}),states:{}},
    isConnected:true,_canEdit:true,_kiosk:false,_norm:true,_loadOk:true,_mode:kind==='device'?'devices':'decor',_space:'floor',
    get _serverCfg(){return adoption.config;},set _serverCfg(value){adoption.stageLocalConfig(value);},
    get _curSpaceCfg(){return adoption.config.spaces[0];},get _markers(){return adoption.config.markers;},
    get _devices(){return [{id:'light',space:'floor',name:'Light',bindingKind:'virtual',marker:adoption.config.markers[0]}];},
    _config:{language:'en'},_cfgEpoch:0,_adoption:adoption,_configWriteContext:context,_writeChain:Promise.resolve(),_writesPending:false,
    _configWriteGuard:()=>()=>true,_saveConfigDebounced:{pending:()=>false,flush(){},cancel(){}},
    _cellCm:5,_imperial:false,_decorStyle:{color:'#010203',opacity:1},_decorAssets:new Map(),
    _devicePositionHistory:new CommandStack(),_layout:{light:{x:.4,y:.222222222,k:1.7,s:'floor'}},
    _livePos(){return {x:400,y:222.222222};},_spaceModel:()=>null,_decorTextSizeCm:()=>12,
    _persistDevicePlacement:async(id,pos)=>{host._layout=applyDevicePlacement(host._layout,id,pos);},
    _previewDevicePlacement(id,pos){host._layout=applyDevicePlacement(host._layout,id,pos);},
    _rollbackOptimistic:attempt=>adoption.rollbackOptimistic(attempt),_t:key=>key,
    _showToast:message=>state.toasts.push(message),_commitSpace:id=>{host._space=id;},_restoreZoom(){},requestUpdate(){},
    updateComplete:Promise.resolve(),renderRoot:{querySelectorAll:()=>[]},
  };
  context.observe(host.hass);
  const runtime={host,stairs:{select(){}},_geometrySnapshot:()=>structuredClone(host._curSpaceCfg),
    _recordGeometry:(name,before)=>state.records.push({name,before,after:structuredClone(host._curSpaceCfg)}),
    _prepareConfigCandidate:candidate=>{if(state.prepareError)throw Error('preflight');return candidate;},
    _stageOptimisticConfig:(previous,candidate)=>{const attempt=adoption.beginOptimistic(previous,candidate);adoption.stageLocalConfig(candidate);return attempt;},
    _saveConfigNow:async(attempt,current)=>{
      if(current&&!current())throw Object.assign(Error('stale'),{code:'conflict'});
      state.writes.push(structuredClone(host._serverCfg));
      if(state.hold)await state.hold.promise;
      if(state.saveError)throw state.saveError;
      adoption.acceptConfigWrite(host._serverCfg,{rev:adoption.configRev+1});
    },
    _updateDecorStyle:(style)=>{host._decorStyle={...host._decorStyle,...style};},
  };
  const editor=new PropertiesEditor(runtime);editor.width=1200;
  editor.select(kind,kind==='device'?'light':'shape',kind==='device'?'virtual':undefined);
  const set=async(key,raw)=>{assert.equal(editor.fields.edit(key,raw),true);return editor.fields.finish();};
  return {host,state,editor,adoption,context,set,config:structuredClone(config)};
}

test('#1047 native decor selection follows a new object, preserving a dirty field until completion',async()=>{
  const h=harness();
  Object.defineProperty(h.host,'_decorList',{get:()=>h.host._curSpaceCfg.decor});
  h.host._curSpaceCfg.decor.push({id:'new',kind:'rect',x:.4,y:.4,w:.1,h:.1,color:'#123456'});
  assert.equal(h.editor.fields.edit('w','invalid'),true);
  h.host._decorSel='new';h.editor.syncNative();
  assert.equal(h.editor.identity.objectId,'shape');
  assert.equal(await h.editor.fields.finish(),false);
  h.editor.syncNative();assert.equal(h.editor.identity.objectId,'shape');
  assert.equal(h.state.writes.length,0);
  h.editor.fields.invalidate();h.editor.syncNative();
  assert.equal(h.editor.identity.objectId,'new');assert.equal(h.host._decorSel,'new');
  assert.equal(await h.set('w','240'),true);
  assert.equal(h.host._curSpaceCfg.decor[0].w,.3);
  assert.equal(h.host._curSpaceCfg.decor[1].w,.2);
});

test('#1047 Properties yields Escape to the active native drawing gesture',()=>{
  const h=harness();h.host._decorDraft={kind:'rect',a:[10,10],b:[50,50],pid:1};
  let prevented=false;
  assert.equal(h.editor.escape({key:'Escape',preventDefault(){prevented=true;}}),false);
  assert.equal(prevented,false);assert.equal(h.editor.identity.objectId,'shape');
});

test('#1047 only the current wide text owner supplies a Properties text measurement',()=>{
  const h=harness();
  Object.defineProperty(h.host,'_decorList',{get:()=>h.host._curSpaceCfg.decor});
  h.host._curSpaceCfg.decor.push({id:'label',kind:'text',x:.4,y:.4,text:'New label',color:'#123456'});
  assert.equal(h.editor.selectedTextId,null);
  h.host._decorSel='label';h.editor.syncNative();assert.equal(h.editor.selectedTextId,'label');
  h.editor.width=850;assert.equal(h.editor.selectedTextId,null);
  h.editor.width=1200;h.host._space='other';assert.equal(h.editor.selectedTextId,null);
});

test('#931 runtime preparer refusal restores the entire local candidate, with no writer/history/default-style residue',async()=>{
  const h=harness();h.state.prepareError=true;
  assert.equal(await h.set('stroke',JSON.stringify({color:'#123456',opacity:.5})),false);
  assert.deepEqual(h.host._serverCfg,h.config);assert.equal(h.state.writes.length,0);assert.equal(h.state.records.length,0);
  assert.deepEqual(h.host._decorStyle,{color:'#010203',opacity:1});assert.equal(h.editor.fields.draft.error.key,'geometry_error');
});

test('#931 failed accepted-writer attempt rolls back only its owned candidate, retaining draft and all unknown siblings',async()=>{
  const h=harness();h.state.saveError=Error('refused');
  assert.equal(await h.set('w','480'),false);assert.deepEqual(h.host._serverCfg,h.config);
  assert.equal(h.state.records.length,0);assert.equal(h.editor.fields.draft.raw,'480');assert.equal(h.editor.fields.draft.error.key,'save_error');
  h.state.saveError=null;assert.equal(await h.editor.fields.finish(),true);assert.equal(h.state.records.length,1);
  assert.equal(h.host._curSpaceCfg.decor[0].future,null);
});

test('#931 colour normalization is a no-op, completed field edits do not rewrite untouched coordinates',async()=>{
  const h=harness();
  assert.equal(await h.set('stroke',JSON.stringify({color:'#abcdef',opacity:1})),true);
  assert.equal(h.state.writes.length,0);assert.equal(h.host._curSpaceCfg.decor[0].color,'#ABCDEF');
  assert.equal(await h.set('w','480'),true);assert.equal(h.state.writes.length,1);assert.equal(h.state.records.length,1);
  assert.equal(h.host._curSpaceCfg.decor[0].y,.2);assert.equal(h.host._curSpaceCfg.decor[0].future,null);
});

test('#931 marker visual writes use changed-key history, and refusal preserves null/presence plus siblings',async()=>{
  const h=harness('device');
  assert.equal(await h.set('angle','15'),true);const command=h.host._devicePositionHistory.peekUndo();
  assert.deepEqual(command.before.fields,[{key:'angle',present:true,value:0}]);
  h.host._serverCfg.markers[0].name='Remote sibling';
  const position=h.host._devicePositionHistory.positionOf(command);h.host._devicePositionHistory.undo();
  await h.editor.restoreVisual('undo',command,position);
  assert.equal(h.host._markers[0].angle,0);assert.equal(h.host._markers[0].size,null);assert.equal(h.host._markers[0].name,'Remote sibling');
  assert.deepEqual(h.host._markers[0].future,{keep:true});
});

test('#931 visual history conflict restores the exact cursor identity, never undoing a newer command',async()=>{
  const h=harness('device');assert.equal(await h.set('angle','15'),true);
  const command=h.host._devicePositionHistory.peekUndo(),position=h.host._devicePositionHistory.positionOf(command);
  h.host._devicePositionHistory.undo();h.host._markers[0].angle=25;
  const newer={name:'Newer',before:{deviceId:'other'},after:{deviceId:'other'}};h.host._devicePositionHistory.push(newer);
  await h.editor.restoreVisual('undo',command,position);
  assert.equal(h.host._markers[0].angle,25);assert.equal(h.host._devicePositionHistory.peekUndo(),newer);
  assert.equal(h.host._devicePositionHistory.size,2);assert.equal(h.state.writes.length,1);
});

test('#931 point writer preserves the untouched legacy coordinate, scale and floor',async()=>{
  const h=harness('device');assert.equal(await h.set('x','600'),true);
  assert.deepEqual(h.host._layout.light,{x:.5,y:.222222222,k:1.7,s:'floor'});
  assert.equal(h.host._devicePositionHistory.size,1);assert.equal(h.state.writes.length,0);
});
