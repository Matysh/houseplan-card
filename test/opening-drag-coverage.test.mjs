import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bundledProducers,callsFor} from '../demo/performance/opening-drag-coverage.mjs';

test('opening coverage retains discovery and counting of graph and legacy materializers',t=>{
 const root=mkdtempSync(join(tmpdir(),'hp-opening-producers-'));
 t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(join(root,'legacy.js'),'function oldBody(){return {partitions:[],columns:[],patches:[],all:[]};} export {oldBody as b};');
 writeFileSync(join(root,'graph.js'),'function graphBody(){return Object.defineProperty({partitions:[],columns:[],patches:[],all:[]},"rawPatches",{value:[]});}');
 writeFileSync(join(root,'card.js'),'import {b as producer} from "./legacy.js"; class Card {_physicalBodiesR(){return producer();}}');
 const targets=bundledProducers(root).allPhysical;
 assert.equal(targets.length,2);
 const coverage=targets.map((target,index)=>({url:`http://demo.local/assets/${target.relative}`,
  functions:[{functionName:target.name,ranges:[{startOffset:target.start,endOffset:target.end,count:index+1}]}]}));
 assert.equal(callsFor(coverage,targets),3,'complete materializer diagnostics count both sources');
 assert.equal(callsFor([],targets),0);
 rmSync(join(root,'legacy.js'));rmSync(join(root,'graph.js'));
 assert.throws(()=>bundledProducers(root),/missing physical body producers/);
});

test('1236 producer coverage follows the saved physical cache callsite across chunk aliases',()=>{
 const root=mkdtempSync(join(tmpdir(),'hp-opening-producer-'));
 try{
  writeFileSync(join(root,'geometry.js'),'function saved(){return {partitions:[],columns:[],patches:[],all:[]}} function analytic(){return {partitions:[],columns:[],patches:[],all:[]}} export {saved as p,analytic as a};');
  writeFileSync(join(root,'card.js'),'import {p as producer,a as helper} from "./geometry.js"; class Card {_physicalBodiesR(){return memo(()=>producer());} other(){return helper();}}');
  const target=bundledProducers(root).physical;
  assert.equal(target.relative,'geometry.js');assert.equal(target.name,'saved');
  const covered=count=>[{url:'http://fixture/assets/geometry.js',functions:[{functionName:'saved',ranges:[{startOffset:target.start,endOffset:target.end,count}]}]}];
  assert.equal(callsFor(covered(1),target),1,'cold direct producer is observable');
  assert.equal(callsFor(covered(0),target),0,'a held frame cannot invent a positive');
  assert.equal(callsFor([{url:'http://fixture/assets/geometry.js',functions:[{functionName:'analytic',ranges:[{startOffset:target.end+1,endOffset:target.end+20,count:1}]}]}],target),0,'same-shaped analytic helper is not the physical producer');
  writeFileSync(join(root,'card.js'),'class Card {_physicalBodiesR(){return unknown();}}');
  assert.throws(()=>bundledProducers(root),/ambiguous\/missing.*callsite/,'lost producer authority fails closed instead of disabling coverage');
 }finally{rmSync(root,{recursive:true,force:true});}
});
