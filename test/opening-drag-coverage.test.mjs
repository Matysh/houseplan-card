import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bundledProducers,callsFor} from '../demo/performance/opening-drag-coverage.mjs';

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
