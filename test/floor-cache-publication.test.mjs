import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Execute the real small publication/intent boundary without bootstrapping
// Lit or HA in Node. Only its external paint/host ports are supplied here.
const source=ts.createSourceFile('houseplan-card.ts',readFileSync(new URL('../src/houseplan-card.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
let method;
const visit=node=>{if(ts.isMethodDeclaration(node)&&node.name.getText(source)==='_publishFloorCacheAfterPaint')method=node.getText(source);ts.forEachChild(node,visit);};
visit(source);assert.ok(method);
const code=ts.transpileModule(`export class Fixture { ${method} }`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function harness(){
  const frames=[],exports={};let publications=0;
  new Function('exports','requestAnimationFrame','captureFloorPreview',code)(exports,callback=>{frames.push(callback);return frames.length;},()=>{publications++;return{};});
  const card=new exports.Fixture(),authority={},raw={},runtime={pending:false,publicationNeeded:true,paintToken:'same',publish(){publications++;}};
  Object.assign(card,{_floorPreparation:runtime,_floorPublishing:false,_loadOk:true,_mode:'view',_floorPendingMode:{mode:'plan',animate:false,warm:true},
    _booting:false,_bootFading:false,_modeTransitionBusy:false,_continuity:{state:'steady',hasCompleteFrame:true},
    _continuityAssetsReady:()=>true,_curSpaceCfg:raw,_space:'floor',planHost:{authorityKey:authority},isConnected:true,
    _floorCacheSelection:()=>({fitKey:'key'}),_rotationMotion:{running:false},_floorSourceAccepted:()=>false,
    updateComplete:Promise.resolve(),requestUpdate(){},_setMode(mode){this.entered=mode;}});
  const paint=async()=>{for(let i=0;i<8;i++){await Promise.resolve();frames.splice(0).forEach(callback=>callback(0));}};
  return{card,runtime,paint,publications:()=>publications};
}
test('#1454 an accepted painted admin View can consume its editor intent while optimistic data cannot publish',async()=>{
  const h=harness();h.card._publishFloorCacheAfterPaint();await h.paint();
  assert.equal(h.card.entered,'plan');assert.equal(h.card._floorPendingMode,null);
  assert.equal(h.publications(),0,'unaccepted config/layout never enters IDB capture/publication');
});
test('#1454 retired authority cannot consume an editor intent after the paint await',async()=>{
  const h=harness();h.card._publishFloorCacheAfterPaint();h.card.planHost={authorityKey:{}};await h.paint();
  assert.equal(h.card.entered,undefined);assert.equal(h.publications(),0);
});
test('#1454 a changed fit/paint token cannot capture or consume an intent under the old fit',async()=>{
  const h=harness();h.card._publishFloorCacheAfterPaint();h.runtime.paintToken='new-fit';await h.paint();
  assert.equal(h.card.entered,undefined);assert.equal(h.publications(),0);
});

function modeHarness(){
  let declaration;
  const find=node=>{if(ts.isMethodDeclaration(node)&&node.name.getText(source)==='_requestMode')declaration=node.getText(source);ts.forEachChild(node,find);};
  find(source);assert.ok(declaration);
  const output=ts.transpileModule(`export class Fixture { ${declaration} }`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};new Function('exports',output)(exports);
  const card=new exports.Fixture();let commits=0;
  Object.assign(card,{_editorModeRequest:0,isConnected:true,_canEdit:true,_kiosk:false,_loadOk:true,
    _holdWarmRefit(){},_releaseWarmRefit(){},_ensureEditorRuntime:async()=>true,
    _ensureFloorPreparation:()=>false,
    _editorRuntime:{resumeWarmMode(mode){commits++;card._mode=mode;card._tool='wall';}}});
  return{card,commits:()=>commits};
}
test('#1454 warm resume defers the whole synchronous tool transaction until geometry is ready',async()=>{
  const h=modeHarness();await h.card._requestMode('plan',false,'resume');
  assert.equal(h.commits(),0);assert.equal(h.card._floorPendingMode.mode,'plan');
  h.card._floorPendingMode.resume();
  assert.equal(h.commits(),1);assert.equal(h.card._mode,'plan');assert.equal(h.card._tool,'wall');
});
test('#1454 a newer navigation retires the deferred warm transaction',async()=>{
  const h=modeHarness();await h.card._requestMode('plan',false,'resume');
  h.card._editorModeRequest++;h.card._floorPendingMode.resume();assert.equal(h.commits(),0);
});
test('#1454 an explicit mode supersedes warm restoration before waiting for floor work',()=>{
  let declaration;
  const find=node=>{if(ts.isMethodDeclaration(node)&&node.name.getText(source)==='_setMode')declaration=node.getText(source);ts.forEachChild(node,find);};
  find(source);const output=ts.transpileModule(`export class Fixture { ${declaration} }`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};new Function('exports',output)(exports);const card=new exports.Fixture();
  Object.assign(card,{_pendingNavMode:'devices',_loadOk:false,_ensureFloorPreparation:()=>false,
    _cancelPendingWarmMode(){this._pendingNavMode=null;}});
  card._setMode('plan',false);assert.equal(card._pendingNavMode,null);
  assert.deepEqual(card._floorPendingMode,{mode:'plan',animate:false,warm:false});
});
test('#1454 passive SVG follows an adopted camera without refitting, live writes or an update loop',()=>{
  let declaration;
  const find=node=>{if(ts.isMethodDeclaration(node)&&node.name.getText(source)==='_syncFloorPreviewCamera')declaration=node.getText(source);ts.forEachChild(node,find);};
  find(source);const output=ts.transpileModule(`export class Fixture { ${declaration} }`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};new Function('exports',output)(exports);const card=new exports.Fixture();
  let value='0 0 1000 1000',writes=0;const svg={getAttribute:()=>value,setAttribute(name,next){assert.equal(name,'viewBox');value=next;writes++;}};
  Object.assign(card,{renderRoot:{querySelector(selector){assert.equal(selector,'[data-hp-cache-preview]');return svg;}},
    _baseVb:()=>[0,0,1000,1000],_viewOr:()=>({x:491,y:-104,w:777,h:924})});
  card._syncFloorPreviewCamera();assert.equal(value,'491 -104 777 924');assert.equal(writes,1);
  card._syncFloorPreviewCamera();assert.equal(writes,1,'same camera does not schedule/write again');
});

function scopedHintHarness(previous){
  let declaration;
  const find=node=>{if(ts.isMethodDeclaration(node)&&node.name.getText(source)==='_restoreScopedFloorHint')declaration=node.getText(source);ts.forEachChild(node,find);};
  find(source);assert.ok(declaration);
  const output=ts.transpileModule(`export class Fixture { ${declaration} }`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={},authority={},scope='synthetic-origin/user',snapshot={virtual_lights:null};
  let reads=0,restores=0;
  new Function('exports','localStorage','cacheSha256','virtualLightSnapshot',output)(exports,
    {getItem(){reads++;return JSON.stringify({version:1,scope,snapshot});}},()=> 'synthetic-key',()=>null);
  const card=new exports.Fixture();
  Object.assign(card,{planHost:{cacheScope:scope,authorityKey:authority,environment:{ready:true,permissions:{read:true}}},
    _floorCompleteAuthority:previous==='same'?authority:previous==='foreign'?{}:undefined,
    _serverCfg:null,_serverStorage:false,_cfgEpoch:0,_cfgRev:1,_model:[],
    _adoption:{restoreCached(){restores++;card._serverCfg={spaces:[]};return true;}},
    _seedDecorStyle(){},_adoptInitialSpace(_model,authoritative){card.hintAdopted=authoritative===false;}});
  return{card,reads:()=>reads,restores:()=>restores};
}
test('#1454 a first instance restores its scoped early View without waiting for a fresh pair',()=>{
  const h=scopedHintHarness();h.card._restoreScopedFloorHint();
  assert.equal(h.restores(),1);assert.equal(h.card.hintAdopted,true);
  assert.equal(h.card._serverStorage,true);assert.equal(h.card._cfgEpoch,1);
});
test('#1454 a previously complete foreign owner cannot re-seed quarantined targets from its scoped hint',()=>{
  const h=scopedHintHarness('foreign');h.card._restoreScopedFloorHint();
  assert.equal(h.reads(),0);assert.equal(h.restores(),0);
  assert.equal(h.card._serverCfg,null);assert.equal(h.card._serverStorage,false);assert.equal(h.card._cfgEpoch,0);
});
test('#1454 the same complete owner retains scoped-hint restoration rather than a blanket loaded gate',()=>{
  const h=scopedHintHarness('same');h.card._restoreScopedFloorHint();assert.equal(h.restores(),1);
});
