// #1100: synchronous production history CPU, with real geometry/cache owners.
// This does not measure browser paint, debounce, transport, or the owner's HA.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {historyFixture,historyHarness,historyChanges} from '../test/helpers/geometry-history-harness.mjs';

const output=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
const iterations=7,rows=[],violations=[];
const foreignKeys=h=>[h.host._wallUnionPool,h.host._physicalBodiesPool]
 .map(pool=>[...pool.keys()].filter(key=>key.startsWith('b|')||key.startsWith('c|')).sort());
function prepared(kind){
 const h=historyHarness(historyFixture({large:true,stairsCase:kind==='stairs'}),{diagnostics:false});
 const before=JSON.stringify(h.host._serverCfg);
 assert.ok(h.command(kind,historyChanges[kind]),'ordinary canonical edit must record an actual command');
 return {h,before,after:JSON.stringify(h.host._serverCfg)};
}
function warm(context,active){
 for(const id of active?['b','c','a']:['b','c'])assert.ok(context.h.warm(id));
 context.h.host._space='a';
}
function sample(context,kind,phase,index,direction){
 const {h}=context,keys=foreignKeys(h),before={...h.counts};
 const started=performance.now(),outcome=h.runtime._stepGeometryHistory(direction),elapsedMs=performance.now()-started;
 assert.equal(outcome,true);assert.equal(JSON.stringify(h.host._serverCfg),context[direction==='undo'?'before':'after'],'exact full document outside the timed interval');
 assert.equal(h.counts.save-before.save,1,'existing save scheduling');
 const retained=JSON.stringify(foreignKeys(h))===JSON.stringify(keys),switchBefore=h.host._floorCacheBuilds.wallUnion;
 assert.ok(h.warm('b'));const neighborUnionBuilds=h.host._floorCacheBuilds.wallUnion-switchBefore;
 const row={kind,phase,index,direction,elapsedMs,roomCount:h.host._serverCfg.spaces[0].rooms.length,
  preflights:h.counts.preflight-before.preflight,unions:h.counts.union-before.union,foreignPoolsRetained:retained,neighborUnionBuilds};
 rows.push(row);
 if(!retained||neighborUnionBuilds!==0||row.unions>(kind==='thickness'?1:0)||row.preflights>(kind==='thickness'?1:0))violations.push({kind,phase,index,direction,...row});
}
for(const kind of ['thickness','transform','stairs']){
 // Cold means the card's A pools are empty, while foreign B/C stay warm.
 // Module/process-level boolean caches are deliberately not patched or reset.
 for(let index=0;index<iterations;index++)for(const direction of ['undo','redo']){
  const context=prepared(kind);
  if(direction==='redo')assert.equal(context.h.runtime._stepGeometryHistory('undo'),true);
  warm(context,false);sample(context,kind,'cold-active-floor',index,direction);
 }
 const context=prepared(kind);
 for(let index=0;index<iterations;index++)for(const direction of ['undo','redo']){
  warm(context,true);sample(context,kind,'warm-active-floor',index,direction);
 }
}
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const sourceFiles=git('ls-files','src').split('\n').filter(Boolean).sort();
const hash=createHash('sha256');for(const file of sourceFiles){hash.update(file+'\0');hash.update(readFileSync(file));hash.update('\0');}
const result={schema:1,issue:1100,head:git('rev-parse','HEAD'),sourceDigest:hash.digest('hex'),dirty:!!git('status','--porcelain'),
 node:process.version,iterations,boundary:'synchronous _stepGeometryHistory; real canonical model/preflight/wall pass/Card pools; UI/storage shell; no diagnostic geometry cloning',
 coldBoundary:'new card history harness, active-floor pools empty, foreign floors warm; process-level geometry caches unchanged',
 timingThreshold:null,counterVerdict:violations.length?'RED':'GREEN',rows,violations};
if(output){mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
if(violations.length)process.exitCode=1;
