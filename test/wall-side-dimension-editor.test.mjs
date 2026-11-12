import test from 'node:test';
import assert from 'node:assert/strict';
import {nothing} from 'lit';
import {WallSideDimensionEditor} from '../test-build/wall-side-dimension-editor.js';

function harness(){
  const space={id:'floor',cell_cm:5,rooms:[],partitions:[{id:'w',a:[.2,.3],b:[.5,.3],cm:20}]};
  const host={isConnected:true,_mode:'plan',_canEdit:true,_kiosk:false,_modeTransitionBusy:false,
    _space:'floor',_serverCfg:{spaces:[space],settings:{}},_tool:'select',_config:{language:'en'},hass:{states:{}},
    _path:[],_cursorPt:null,_contourClosed:false,_cellCm:5,_drawWallCm:15,_markup:false,
    _resize:{dragging:false,liveLabels:null},_lastValidStageSize:[600,400],_imperial:false,
    _framePercent:(p,view)=>[(p[0]-view.x)/view.w*100,(p[1]-view.y)/view.h*100],_spaceModel:()=>space,
    requestUpdate(){},ownerDocument:{createElement:()=>({getContext:()=>({measureText:()=>({width:7})})})}};
  const runtime={host,properties:{dimensionTarget:{kind:'partition',id:'w'}},physicalGesture:{active:false},nodeMove:null};
  return{host,runtime,editor:new WallSideDimensionEditor(runtime),view:{x:0,y:0,w:1000,h:1000},space};
}

test('#1381 selection is retired for every disconnected/blocked/wrong-surface context',()=>{
  for(const patch of [{isConnected:false},{_mode:'view'},{_mode:'devices'},{_canEdit:false},{_kiosk:true},
    {_modeTransitionBusy:true},{_openingDialog:{}},{_roomDialog:true},{_space:'missing'},{_tool:'column'}]){
    const h=harness();assert.notEqual(h.editor.render(h.view),nothing);
    Object.assign(h.host,patch);assert.equal(h.editor.render(h.view),nothing,JSON.stringify(patch));h.editor.dispose();
  }
});

test('#1381 no stale selection faces during body/invalid-node preview; accepted adoption is read afresh',()=>{
  const h=harness();let result=h.editor.render(h.view);assert.notEqual(result,nothing);
  h.runtime.physicalGesture.active=true;assert.equal(h.editor.render(h.view),nothing);
  h.runtime.physicalGesture.active=false;
  h.runtime.nodeMove={dimensionContext:{before:h.space,candidate:null,moved:true}};
  assert.equal(h.editor.render(h.view),nothing,'a refused outline must not inherit the last valid faces');
  h.runtime.nodeMove=null;
  const next={...h.space,partitions:[{...h.space.partitions[0],b:[.6,.3]}]};
  h.host._serverCfg={...h.host._serverCfg,spaces:[next]};
  h.editor.retire();result=h.editor.render(h.view);assert.notEqual(result,nothing);
  assert.ok(h.editor.geometry.read(next,['partition:w']).intervals.every(i=>i.lengthCm===480));
  h.editor.dispose();
});

test('#1381 draw adds only the active edge to confirmed material and never edits its baseline',()=>{
  const h=harness();h.host._tool='draw';h.host._path=[[200,300],[500,300]];h.host._cursorPt=[500,450];
  const original=JSON.stringify(h.host._serverCfg),reads=[];
  const read=h.editor.geometry.read.bind(h.editor.geometry);
  h.editor.geometry.read=(space,ids)=>{reads.push(space);return read(space,ids);};
  assert.notEqual(h.editor.render(h.view),nothing);
  const candidate=reads.find(space=>space!==h.space);
  assert.equal(candidate.partitions.length,2,'confirmed wall plus one rubber band, not a duplicate of the path');
  assert.equal(candidate.partitions[0].id,'w');
  assert.deepEqual(candidate.partitions[1].a,[.5,.3]);assert.deepEqual(candidate.partitions[1].b,[.5,.45]);
  assert.equal(JSON.stringify(h.host._serverCfg),original);
  h.host._path=[];assert.equal(h.editor.render(h.view),nothing);h.editor.dispose();
});

test('#1381 basis refreshes only its mounted hint, never the host, held frame or disposed surface',async()=>{
  const h=harness(),updates=[];
  await Promise.resolve();
  h.host.requestUpdate=()=>assert.fail('basis must not hand native ink to a full host render');
  h.editor.subscribeHint(()=>updates.push(h.editor.sourceHint));
  h.editor.render(h.view);await Promise.resolve();
  assert.deepEqual(updates,['axis']);
  h.editor.render(h.view);h.editor.render({...h.view,w:900});await Promise.resolve();
  assert.deepEqual(updates,['axis']);
  assert.equal(h.editor.sourceFallback,true);
  h.runtime.physicalGesture.active=true;h.editor.render(h.view);
  h.editor.dispose();await Promise.resolve();
  assert.deepEqual(updates,['axis'],'late hint callback cannot revive a retired editor');
});

test('#1381 the displayed source distinguishes proved zero-thickness boundaries from axis fallback',async()=>{
  const h=harness(),updates=[];
  await Promise.resolve();h.host.requestUpdate=()=>assert.fail('basis never requests a host render');
  const unsubscribe=h.editor.subscribeHint(()=>updates.push(h.editor.sourceHint));
  let source='boundary';
  h.editor.geometry.read=()=>({intervals:[{id:'zero',carrier:'partition:w',side:1,order:0,
    source,from:[200,300],to:[500,300],normal:[0,1],low:0,high:300,lengthCm:360}],epsilonCm:1e-6});
  h.editor.render(h.view);await Promise.resolve();
  assert.equal(h.editor.sourceHint,'boundary');assert.equal(h.editor.sourceFallback,false);
  assert.deepEqual(updates,['boundary']);
  source='axis';h.editor.render(h.view);await Promise.resolve();
  assert.equal(h.editor.sourceHint,'axis');assert.equal(h.editor.sourceFallback,true);
  assert.deepEqual(updates,['boundary','axis']);
  unsubscribe();h.runtime.physicalGesture.active=true;h.editor.render(h.view);await Promise.resolve();
  assert.equal(updates.length,2,'an unmounted hint is not refreshed');
  h.editor.retire();h.editor.dispose();
});
