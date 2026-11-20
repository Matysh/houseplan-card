import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {html, nothing} from 'lit';

// Exercise the real pending-floor template; geometry/HA ports are intentionally
// absent, so a loading-screen fix cannot start a canonical scene pull.
const source=ts.createSourceFile('card.ts',readFileSync(new URL('../src/houseplan-card.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true);
const methods=[];
function visit(node){if(ts.isMethodDeclaration(node)&&['_renderPendingFloor','_renderStageEnvironment'].includes(node.name.getText(source)))methods.push(node.getText(source));ts.forEachChild(node,visit);}
visit(source);assert.equal(methods.length,2);
const code=ts.transpileModule(`export class Fixture { ${methods.join('\n')} }`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function harness(projection,dayCycle,hasPreview=true){
  const exports={},calls={environment:[],preview:0},moon={kind:'moon'},global={moon:true};
  new Function('exports','html','nothing','styleMap','NORM_W','renderFloorPreview','renderDayCycleEnvironment','moonLayer',code)(
    exports,html,nothing,x=>x,1000,()=>{calls.preview++;return html`<path></path>`;},
    (...args)=>{calls.environment.push(args);return nothing;},(owner,settings)=>{assert.equal(settings,global);return moon;});
  const card=new exports.Fixture();
  Object.assign(card,{_desiredProjection:projection,_mode:'view',_modeTransitionVisual:null,_containerOwnedHeight:false,_kiosk:false,_hdrH:80,
    _floorPreparation:{preview:hasPreview?{fit:{base:[0,0,1000,1000],projection}}:null},
    _presentedViewPlane:p=>p,_adoptViewPlane(){},_viewOr:()=>({x:0,y:0,w:1000,h:1000}),
    _spaceDisplayForRender:()=>({wallFill:{c:'#fff'}}),_stageBg:()=>'#1b2d50',
    _dayCycleState:()=>dayCycle,_sunGlobal:()=>global,_moonSkyState:()=>null,_t:x=>x,_renderPreparedFloorFrame:x=>x,
    planHost:{capabilities:{summary:false}}});
  return{card,calls,moon};
}
test('#1490 pending floors use the same day/night environment, without geometry work',()=>{
  for(const phase of ['day','night'])for(const projection of ['flat','iso'])for(const cached of [false,true]){
    const state={phase},h=harness(projection,state,cached);h.card._renderPendingFloor();
    assert.equal(h.calls.environment.length,1);
    assert.deepEqual(h.calls.environment[0],[state,1,h.moon]);
    assert.equal(h.card._floorPassive,true);
  }
});
test('#1490 ISO fit data stays available but its simplified silhouette never paints',()=>{
  const h=harness('iso',null);const fit=h.card._floorPreparation.preview.fit;
  h.card._renderPendingFloor();assert.equal(h.calls.preview,0);
  assert.equal(h.card._floorPreparation.preview.fit,fit);
});
test('#1490 Flat keeps its passive preview; static background stays a stage style',()=>{
  const h=harness('flat',null);const result=h.card._renderPendingFloor();
  assert.equal(h.calls.preview,1);
  assert.ok(result.values.some(value=>value?.background==='#1b2d50'));
});
