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
  Object.assign(card,{_floorPreparation:runtime,_floorPublishing:false,_loadOk:true,_mode:'view',_floorPendingMode:'plan',
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
