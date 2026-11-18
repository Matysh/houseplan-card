import test from 'node:test';
import assert from 'node:assert/strict';
import {testSurfaceReady, renderedIsoReady, floorAlignedIsoOverlaysReady} from '../demo/helpers/test-surface-ready.mjs';

function fixture() {
  const attrs = new Map([['data-hp-state','ready']]);
  const stageAttrs = new Map([['data-hp-iso-stage','4'],['data-hp-iso-readiness','ready'],['data-hp-iso-structural-builds','0']]);
  const stage = {inert:false,getAttribute:name=>stageAttrs.get(name)??null};
  let pending=false,empty=false,faces=[{getAttribute:()=> 'M0 0L10 0L10 10Z'}];
  let bounds={width:10,height:10},fingerprint='floor|mesh',queuePresent=true;
  const queue={querySelectorAll:()=>faces,getBBox:()=>bounds};
  const walls={getAttribute:()=>fingerprint,querySelector:()=>queuePresent?queue:null};
  const root={hasAttribute:name=>attrs.has(name),getAttribute:name=>attrs.get(name)??null,
    querySelector:selector=>selector==='[data-hp-floor-cache]'?pending:
      selector==='[data-hp="empty"]'?empty:selector==='.stage.mode-view'?stage:null};
  const card={_mode:'view',_model:[{}],_loadOk:true,_booting:false,
    renderRoot:{querySelector:selector=>selector==='ha-card'?root:selector==='.stage'?stage:
      selector==='[data-hp="iso-walls"][data-fingerprint]'?walls:null}};
  return {card,attrs,stage,stageAttrs,empty:value=>empty=value,pending:value=>pending=value,
    faces:value=>faces=value,bounds:value=>bounds=value,fingerprint:value=>fingerprint=value,queue:value=>queuePresent=value};
}

test('#1467 ready surfaces reject every deferred, passive and inert phase',()=>{
  const good=fixture();assert.equal(testSurfaceReady(good.card),true);
  for(const [key,value] of [['_booting',true],['_mode','plan'],['_loadOk',false],
    ['_floorPreparation',{pending:true}],['_floorPendingMode',{mode:'view'}],
    ['_modeTransitionBusy',true],['_modeTransitionPreparing',true]]){
    const h=fixture();h.card[key]=value;assert.equal(testSurfaceReady(h.card),false,key);
  }
  for(const prepare of [h=>h.pending(true),h=>h.attrs.set('data-hp-floor-cache','pending'),
    h=>h.attrs.set('data-hp-state','booting'),h=>h.stage.inert=true]){
    const h=fixture();prepare(h);assert.equal(testSurfaceReady(h.card),false);
  }
});

test('#1467 empty surfaces need an explicit fixture and an actual ready empty screen',()=>{
  const h=fixture();h.card._model=[];h.empty(true);
  h.card.renderRoot.querySelector('ha-card').querySelector=selector=>selector==='[data-hp="empty"]';
  assert.equal(testSurfaceReady(h.card),false,'a missing ordinary stage cannot pass');
  assert.equal(testSurfaceReady(h.card,'view',true),true);
  h.card._loadOk=false;assert.equal(testSurfaceReady(h.card,'view',true),true,'explicit no-storage screen');
  h.card._model=[{}];assert.equal(testSurfaceReady(h.card,'view',true),false,'nonempty model never becomes empty');
  h.card._model=[];h.card._floorPendingMode={mode:'view'};
  assert.equal(testSurfaceReady(h.card,'view',true),false,'empty does not bypass pending intent');
});

test('#1467 zero main-thread ISO builds require actual nonempty ready masonry',()=>{
  const h=fixture();assert.equal(renderedIsoReady(h.card),true,'worker/cache restore');
  h.stageAttrs.set('data-hp-iso-structural-builds','2');assert.equal(renderedIsoReady(h.card),true,'main-thread build');
  for(const mutate of [
    h=>h.stageAttrs.delete('data-hp-iso-structural-builds'),
    h=>h.stageAttrs.set('data-hp-iso-structural-builds','NaN'),
    h=>h.stageAttrs.set('data-hp-iso-structural-builds','-1'),
    h=>h.stageAttrs.set('data-hp-iso-structural-builds','.5'),
    h=>h.stageAttrs.set('data-hp-iso-stage','3'),
    h=>h.stageAttrs.set('data-hp-iso-readiness','pending'),
    h=>h.fingerprint(''),h=>h.queue(false),h=>h.faces([]),
    h=>h.faces([{getAttribute:()=>''}]),h=>h.bounds({width:0,height:20}),
    h=>h.bounds({width:20,height:NaN}),
  ]){const h=fixture();mutate(h);assert.equal(renderedIsoReady(h.card),false);}
});

test('#1467 browser injection executes the identical standalone contracts',()=>{
  const surface=new Function(`return (${testSurfaceReady.toString()});`)();
  const iso=new Function(`return (${renderedIsoReady.toString()});`)();
  const h=fixture();assert.equal(surface(h.card),true);assert.equal(iso(h.card),true);
  h.card._floorPendingMode={mode:'view'};assert.equal(surface(h.card),false);
  h.faces([]);assert.equal(iso(h.card),false);
});

test('#1451 golden overlay placement rejects the old lift, nudging and absent metadata',()=>{
  const attrs=new Map([['data-hp-iso-floor','24.5,31.25'],['data-hp-iso-visual','24.5,31.25'],['data-hp-iso-nudged','false']]);
  let enabled='true',nodes=[{getAttribute:name=>attrs.get(name)??null}];
  const card={renderRoot:{querySelector:()=>({getAttribute:()=>enabled}),querySelectorAll:()=>nodes}};
  const injected=new Function(`return (${floorAlignedIsoOverlaysReady.toString()});`)();
  assert.equal(injected(card),true);
  attrs.set('data-hp-iso-visual',`24.5,${31.25-84*Math.sin(20*Math.PI/180)}`);
  assert.equal(injected(card),false,'the retired wall-top lift cannot pass');
  attrs.set('data-hp-iso-visual','25.5,31.25');assert.equal(injected(card),false,'no horizontal nudge');
  attrs.set('data-hp-iso-visual','NaN,31.25');assert.equal(injected(card),false);
  attrs.set('data-hp-iso-visual','24.5,31.25');attrs.set('data-hp-iso-nudged','true');assert.equal(injected(card),false);
  attrs.set('data-hp-iso-nudged','false');enabled='false';assert.equal(injected(card),false,'floor plane must be declared');
  enabled='true';attrs.delete('data-hp-iso-floor');assert.equal(injected(card),false);
  nodes=[];assert.equal(injected(card),false,'an absent overlay is not correct placement');
});
