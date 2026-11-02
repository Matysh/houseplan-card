import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPlanSnapGeometry,resolvePlanSnapResult,resolveStrictPlanSnap} from '../test-build/plan-snap-overlay.js';
import {graphDrawTargetRef} from '../test-build/graph-draw-binding.js';
const point=(id,p)=>({id,p});
const graph=(nodes,edges)=>({version:1,nodes,edges,rooms:[],dependencies:[]});
const part=(id,from,to)=>({kind:'partition',id,from,to,cm:10});
const simple=()=>graph([point('a',['l','0','0']),point('b',['l','240','0'])],[part('p','a','b')]);
const space=plan_graph=>({rooms:[],partitions:[],plan_graph});
test('current snap axes come from graph coordinates and retain exact edge/node identity',()=>{
  const before=graph([point('a',['l','80','0']),point('b',['l','240','0'])],[part('p','a','b')]);
  const model={...space(before),partitions:[{id:'p',a:[9999,9999],b:[10000,9999],cm:10}]};
  const geometry=buildPlanSnapGeometry({space:model});
  assert.deepEqual(geometry.segments[0].graphEdge,{kind:'partition',id:'p'});
  assert.equal(geometry.segments[0].a[0],1000/3);
  assert.equal(geometry.endpoints.find(e=>e.node==='a').point[0],1000/3);
});
test('shared nodes deduplicate by ID, detached equal-position nodes remain separate and ambiguous',()=>{
  const current=graph([point('a',['l','0','0']),point('b',['l','240','0']),point('c',['l','0','240'])],
    [part('p','a','b'),part('q','a','c')]);
  assert.equal(buildPlanSnapGeometry({space:space(current)}).endpoints.length,3);
  const detached=structuredClone(current);detached.nodes.push(point('different',['l','0','0']));detached.edges[1].from='different';
  const geometry=buildPlanSnapGeometry({space:space(detached)});
  assert.equal(geometry.endpoints.length,4);
  const result=resolvePlanSnapResult(geometry,[0,0],{tolerance:2,gridStep:1,distinguishTolerance:2});
  assert.equal(result.kind,'ambiguous');
  assert.deepEqual(new Set(result.conflicts.map(e=>e.node)),new Set(['a','different']));
});
test('normal and strict endpoint candidates forward known IDs through chain decoration aliases',()=>{
  const current=simple(),geometry=buildPlanSnapGeometry({space:space(current)});
  const options={tolerance:1,gridStep:1,distinguishTolerance:2,extraEndpoints:[{point:[0,0],key:'chain-start'}]};
  const resolved=resolvePlanSnapResult(geometry,[0,0],options);
  assert.equal(resolved.kind,'resolved');assert.equal(resolved.candidate.node,'a');
  assert.deepEqual(graphDrawTargetRef(current,resolved.candidate),{kind:'existing-node',node:'a'});
  const strict=resolveStrictPlanSnap(geometry,[0,0],{...options,anchor:[-10,0]});
  assert.equal(strict.kind,'resolved');assert.equal(strict.candidate.node,'a');
});
test('opening cut boundaries do not become nodes; reversed segment binding uses the canonical full edge direction',()=>{
  const current=graph([point('a',['l','240','0']),point('b',['l','0','0'])],[part('p','a','b')]);
  const geometry=buildPlanSnapGeometry({space:space(current),partitionCuts:[{hostId:'p',a:[400,0],b:[600,0]}]});
  assert.equal(geometry.segments.length,2);
  assert.deepEqual(new Set(geometry.endpoints.map(e=>e.point[0])),new Set([0,1000]));
  assert.ok(geometry.segments.every(s=>s.graphEdge.id==='p'));
  const snap=resolvePlanSnapResult(geometry,[250,1],{tolerance:2,gridStep:1});
  assert.equal(snap.kind,'resolved');assert.equal(snap.candidate.kind,'line');
  const ref=graphDrawTargetRef(current,snap.candidate,'draw-one');
  assert.equal(ref.kind,'on-edge');assert.deepEqual(ref.t,['3','4']);
  assert.deepEqual(ref.edge,{kind:'partition',id:'p'});
  assert.equal(resolvePlanSnapResult(geometry,[500,0],{tolerance:1,gridStep:1}).kind,'none');
});
test('line target at one third uses lattice decoding and retained IDs are stable for one operation namespace',()=>{
  const current=simple(),geometry=buildPlanSnapGeometry({space:space(current)});
  const candidate={kind:'line',point:[1000/3,0],key:'presentation-key',distance:0,segment:geometry.segments[0]};
  const one=graphDrawTargetRef(current,candidate,'segment-1');
  assert.deepEqual(one.t,['1','3']);
  assert.deepEqual(graphDrawTargetRef(current,candidate,'segment-1'),one);
  assert.notEqual(graphDrawTargetRef(current,candidate,'segment-2').node,one.node);
  assert.ok(one.splitIds[0].length<=64);
});
test('line ends reuse existing nodes; unknown keys and stale geometry never manufacture graph references',()=>{
  const current=simple(),segment=buildPlanSnapGeometry({space:space(current)}).segments[0];
  const endpointLine={kind:'line',point:[0,0],key:'fake',distance:0,segment};
  assert.deepEqual(graphDrawTargetRef(current,endpointLine),{kind:'existing-node',node:'a'});
  assert.equal(graphDrawTargetRef(current,{kind:'endpoint',point:[0,0],key:'room-edge-0',distance:0}),undefined);
  assert.equal(graphDrawTargetRef(undefined,endpointLine),undefined);
  assert.equal(graphDrawTargetRef(current,{...endpointLine,point:[500,100]}),undefined);
  assert.equal(graphDrawTargetRef(current,{kind:'endpoint',node:'a',point:[20,0],key:'fake',distance:0}),undefined);
  assert.equal(graphDrawTargetRef(current,{...endpointLine,segment:{...segment,graphEdge:{kind:'wall',id:'p'}}}),undefined);
});
test('zero contour edges keep full snap axes and source objects remain unchanged',()=>{
  const current=graph([point('a',['l','0','0']),point('b',['l','240','0'])],[{...part('zero','a','b'),kind:'wall',cm:0}]);
  const original=structuredClone(current);
  const geometry=buildPlanSnapGeometry({space:space(current),roomCuts:[[400,0,600,0]]});
  assert.equal(geometry.segments.length,1);
  assert.deepEqual(geometry.segments[0].graphEdge,{kind:'wall',id:'zero'});
  graphDrawTargetRef(current,{kind:'line',point:[250,0],key:'ui',distance:0,segment:geometry.segments[0]},'zero-draw');
  assert.deepEqual(current,original);
});
