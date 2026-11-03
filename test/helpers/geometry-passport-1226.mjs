// Reproduce the approved model11 representation port from immutable v10
// passports. Default is verification; --write is an explicit fixture edit,
// never part of a test/release run and not authorization for future rebaselining.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { characterizationCases, characterize } from './geometry-commit-characterization.mjs';
import { fixture } from './geometry-commit-harness.mjs';
import { historyCases, historyCharacterization } from './geometry-history-characterization.mjs';
import { validateGraph } from '../../test-build/plan-graph.js';

const BASE='cb1431ea65055b5d327e574c4fe2d567ba0a0d52';
const hash=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const source=file=>execFileSync('git',['show',`${BASE}:${file}`],{encoding:'utf8'});
const commitFile='test/fixtures/1099-commit-characterization.json',oldCommitBytes=source(commitFile),oldCommit=JSON.parse(oldCommitBytes);
const historyFile='test/fixtures/1100-history-characterization.json',oldHistoryBytes=source(historyFile),oldHistory=JSON.parse(oldHistoryBytes);
const commit={source:'cb1431ea model11 explicit prepared graph; old outcome/toast oracles retained',previousBaselineSha256:hash(oldCommitBytes),results:{},
 encoding:'config and history.before: SHA256 of UTF-8 JSON.stringify(complete document), preserving every field and order'};
const fullCommit={};
for(const name of characterizationCases){
 const actual=characterize(name),expected=oldCommit.results[name];
 const doc={...actual,ok:expected.ok,toasts:expected.toasts};
 // The accepted graph commit boundary reports a failed physical preflight
 // through its wall-model refusal owner. Preserve refusal/rollback/history;
 // only these named diagnostic strings changed, not an arbitrary red result.
 if(name.startsWith('marker-')&&name.endsWith('-safe-refusal')){
  assert.deepEqual(expected.toasts,['toast.geometry_unsafe']);
  assert.deepEqual(actual.toasts,['toast.wall_model_migration_blocked']);
  doc.toasts=actual.toasts;
 }
 if(actual.ok!==expected.ok){
  assert.equal(name,'unsafe','an unexplained outcome change cannot become a new passport');
  doc.config=fixture();doc.history=[]; // retain refusal, rollback and empty history, even while product is red
 }
 assert.equal(doc.history.length,expected.history.length,name);
 fullCommit[name]=doc;
 commit.results[name]={...doc,config:hash(doc.config),history:doc.history.map(item=>({...item,before:hash(item.before)}))};
}
const history={schema:2,base:'cb1431ea model11 explicit graph fixture port; original outcomes retained',entropy:oldHistory.entropy,
 previousBaselineSha256:hash(oldHistoryBytes),results:{},encoding:'afterEdit and steps.document: SHA256 of UTF-8 JSON.stringify(complete config), preserving every field and order'};
const fullHistory={};
for(const name of historyCases){
 const actual=historyCharacterization(name),expected=oldHistory.results[name];
 const metadata=rows=>rows.map(({config,document,...item})=>item);
 assert.deepEqual(metadata(actual.steps),metadata(expected.steps),name+': preserve every old outcome/toast/stack/save/command-identity');
 assert.deepEqual(actual.steps[1].config,actual.afterEdit,name+': Redo restores the whole accepted document');
 for(const config of [actual.afterEdit,...actual.steps.map(step=>step.config)]){
  assert.equal(config.model_version,11);
  for(const space of config.spaces)assert.equal(validateGraph(space.plan_graph).ok,true,name);
 }
 fullHistory[name]=actual;
 history.results[name]={afterEdit:hash(actual.afterEdit),steps:actual.steps.map(({config,...metadata})=>({...metadata,document:hash(config)}))};
}
mkdirSync('output/issue1226/passport-generation',{recursive:true});
writeFileSync('output/issue1226/passport-generation/commit-full.json',JSON.stringify(fullCommit,null,2)+'\n');
writeFileSync('output/issue1226/passport-generation/history-full.json',JSON.stringify(fullHistory,null,2)+'\n');
for(const [file,value]of[[commitFile,commit],[historyFile,history]]){
 if(process.argv.includes('--write'))writeFileSync(file,JSON.stringify(value,null,2)+'\n');
 else assert.deepEqual(JSON.parse(readFileSync(file,'utf8')),value,file+': exact approved passport differs');
}
console.log('Reproduced #1226 passports with all original user outcomes and known red refusal oracles retained. Full review documents: output/issue1226/passport-generation/.');
