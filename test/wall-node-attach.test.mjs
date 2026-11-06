import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { projectGraphSpace, graphIndex, validateGraph } from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';
import { structuralWallNodes, prepareNodeMove, applyNodeMove } from '../test-build/wall-node-move.js';
import { applyNodeAttach, prepareNodeAttach } from '../test-build/wall-node-attach.js';
import { pickNodeMergeTarget } from '../test-build/wall-node-merge.js';
import { graphDrawTargetRef } from '../test-build/graph-draw-binding.js';
import { quantizedPoint } from '../test-build/plan-snap-overlay.js';

const cases = JSON.parse(readFileSync(new URL('./fixtures/1330-node-attach.json', import.meta.url)));
const id='node-attach-00000000-0000-4000-8000-000000000001';
function space(c) { return projectGraphSpace({id:'f',title:'Attach',rooms:c.rooms,openings:c.openings,cell_cm:5,future:{keep:true}},c.graph).space; }
function plan(s) { const nodes=structuralWallNodes(s);return prepareNodeMove(s,nodes.find(n=>n.nodeId==='s'),nodes); }
const attach=c=>({kind:c.graph.edges.find(e=>e.id==='host').kind,id:'host',tq:c.tq,new_edge_id:id});

for(const c of cases)test('1330 '+c.name,()=>{
  const s=space(c),frozen=structuredClone(s),p=plan(s),result=applyNodeAttach(p,attach(c));
  assert.equal(result.ok,c.ok,JSON.stringify(result));assert.deepEqual(s,frozen);
  if(!result.ok){assert.equal(result.reason,c.reason);return;}
  const g=result.space.plan_graph,index=graphIndex(g),old=graphIndex(c.graph),host=c.graph.edges.find(e=>e.id==='host');
  assert.equal(validateGraph(g).ok,true);assert.equal(index.incident.get('s').length,3);
  assert.equal(index.edges.get(host.kind+':host').to,'s');assert.equal(index.edges.get(host.kind+':'+id).from,'s');
  assert.deepEqual(index.edges.get(host.kind+':'+id).props,host.props);
  assert.deepEqual(index.points.get('s'),Q.pointAt(old.points.get(host.from),old.points.get(host.to),Q.decodeRational(c.tq)));
  for(const n of c.graph.nodes.filter(n=>n.id!=='s'))assert.deepEqual(g.nodes.find(m=>m.id===n.id),n);
  assert.deepEqual(result.space.future,{keep:true});
  if(c.name==='remote split dependency reparameterizes fixed point')assert.deepEqual(g.dependencies.find(d=>d.node==='k').parameters,[['2','3']]);
  if(c.name==='remote split dependency retires at bend')assert.equal(g.dependencies.some(d=>d.node==='k'),false);
  for(const opening of s.openings){const after=result.space.openings.find(o=>o.id===opening.id);
    if(c.name==='bent branch opening retains fixed-far distance'){
      assert.ok(Math.abs(Math.hypot(after.x-.5,after.y-.75)-.15)<1e-9);
      assert.equal(after.length,opening.length);
    } else assert.deepEqual([after.x,after.y,after.length,after.flip_h,after.flip_v],[opening.x,opening.y,opening.length,opening.flip_h,opening.flip_v]);}
  for(const room of g.rooms){assert.equal(room.edges.length,5);const orig=s.rooms.find(r=>r.id===room.room),next=result.space.rooms.find(r=>r.id===room.room);
    const area=poly=>Math.abs(poly.reduce((sum,p,i)=>sum+p[0]*poly[(i+1)%poly.length][1]-p[1]*poly[(i+1)%poly.length][0],0));assert.equal(area(next.poly),area(orig.poly));}
});

test('1330 picker uses the Draw quantization and exact final projection in either direction',()=>{
  for(const name of ['horizontal wall','vertical reversed host','diagonal exact q','diagonal reverse exact q']){
    const c=cases.find(c=>c.name===name),s=space(c),p=plan(s),host=c.graph.edges.find(e=>e.id==='host'),index=graphIndex(c.graph),a=Q.pointToNumbers(index.points.get(host.from)),b=Q.pointToNumbers(index.points.get(host.to));
    const raw=[a[0]*.5+b[0]*.5+.001,a[1]*.5+b[1]*.5+.001];
    const pick=prepareNodeAttach(p,id).pick(raw,.001,p.node.point);assert.equal(pick?.kind,'target');
    const segment={a:a.map(v=>v*1000),b:b.map(v=>v*1000),graphEdge:{kind:host.kind,id:host.id},key:'host',sourceKind:'room',sourceId:'host'};
    const point=quantizedPoint(segment,raw.map(v=>v*1000),1000/240);
    const ref=graphDrawTargetRef(c.graph,{kind:'line',point,segment,key:'host',distance:0},id);
    assert.equal(ref.kind,'on-edge');assert.deepEqual(pick.target.edge.tq,ref.t);
    assert.deepEqual(pick.target.p,Q.encodePoint(Q.pointAt(index.points.get(host.from),index.points.get(host.to),Q.decodeRational(ref.t))));
  }
});

test('1330 click, endpoints, finite bounds, radius and source degree retain Move/merge ownership',()=>{
  const c=cases[0],s=space(c),p=plan(s),picker=prepareNodeAttach(p,id);
  assert.equal(picker.pick(p.node.point,.001,p.node.point),null);
  assert.equal(picker.pick([-.01,0],.001,p.node.point),null);
  assert.equal(picker.pick([.5,.013],.001,p.node.point),null);
  assert.equal(picker.pick([0,0],.001,p.node.point),null);
  assert.ok(pickNodeMergeTarget(p,[0,0],.001,null,p.node.point));
  assert.equal(applyNodeMove(p,[.5,0],null).ok,false,'ordinary Move still forbids this new contact');
  assert.equal(applyNodeMove(p,[.5,.2],null).ok,true,'ordinary detached move still works');
  for(const name of ['corner source is excluded','passing source is excluded','positive collinear overlap']){
    const s=space(cases.find(c=>c.name===name)),p=plan(s);assert.equal(prepareNodeAttach(p,id).pick([.5,0],.001,p.node.point),null);
  }
  const after=applyNodeAttach(p,attach(c)).space,nodes=structuralWallNodes(after),junction=nodes.find(n=>n.nodeId==='s');
  assert.equal(junction.supported,true);assert.equal(junction.passing,1);assert.equal(junction.branches,1);
  assert.equal(applyNodeMove(prepareNodeMove(after,junction,nodes),[.6,0],junction.axes.find(a=>a.passing).key).ok,true,'result remains an ordinary movable T');
});

test('1330 distinct eligible carriers within 1px are ambiguous without fallback',()=>{
  const c=structuredClone(cases[0]);c.graph.nodes.push({id:'x',p:['l','0','-2']},{id:'y',p:['l','240','-2']});
  c.graph.edges.push({kind:'partition',id:'other',from:'x',to:'y',cm:0});
  const s=space(c),p=plan(s),picker=prepareNodeAttach(p,id);
  assert.deepEqual(picker.pick([.5,-1/240],.01,p.node.point),{kind:'ambiguous'});
  assert.equal(picker.pick([.5,.009],.001,p.node.point)?.kind,'target','ineligible distant carrier cannot create ambiguity');
});

test('1330 refuses source/far hosts, zero displacement and colliding or malformed split IDs',()=>{
  const c=cases[0],s=space(c),p=plan(s);
  for(const change of [{id:'branch'},{tq:['0','1']},{tq:['1','1']},{tq:['2','4']},{new_edge_id:'branch'}])assert.equal(applyNodeAttach(p,{...attach(c),...change}).ok,false);
  const zero=structuredClone(c);zero.graph.nodes.find(n=>n.id==='s').p=['l','120','0'];
  assert.equal(applyNodeAttach(plan(space(zero)),attach(c)).ok,false);
});

test('1330 full TS/Python space parity for accepted and refused shared fixtures',()=>{
  const input=cases.map(c=>({space:space(c),attach:attach(c)}));
  const script=`import json,sys,types\nfrom pathlib import Path\nroot=Path.cwd()\nfor name,path in [('custom_components',root/'custom_components'),('custom_components.houseplan',root/'custom_components/houseplan')]:\n m=types.ModuleType(name);m.__path__=[str(path)];sys.modules[name]=m\nfrom custom_components.houseplan.wall_node_attach import attach_graph_node_space\nfrom custom_components.houseplan.wall_node_move import NodeMoveError\nfrom custom_components.houseplan.plan_graph import validate_graph\nfrom custom_components.houseplan.plan_graph_exact import point_at,decode_rational,encode_point,to_numbers\nout=[]\nfor row in json.load(sys.stdin):\n s=row['space'];a=row['attach'];i=validate_graph(s['plan_graph']);e=i.edges[(a['kind'],a['id'])];p=point_at(i.points[e['from']],i.points[e['to']],decode_rational(a['tq']))\n try:\n  out.append({'ok':True,'space':attach_graph_node_space(s,{'point':to_numbers(i.points['s']),'target':to_numbers(p),'target_p':encode_point(p),'node_id':'s','axis':None,'split_ids':{},'attach_edge':a})})\n except NodeMoveError as e:out.append({'ok':False,'reason':e.code.removeprefix('node_move_')})\nprint(json.dumps(out))`;
  const results=JSON.parse(execFileSync(process.env.PYTHON||'python3',['-c',script],{input:JSON.stringify(input),encoding:'utf8',maxBuffer:4e6}));
  for(const [i,c]of cases.entries()){
    const ts=applyNodeAttach(plan(input[i].space),input[i].attach),py=results[i];assert.equal(py.ok,ts.ok,c.name);
    if(ts.ok)assert.deepEqual(py.space,ts.space,c.name);else assert.equal(py.reason,ts.reason,c.name);
  }
});


test('1330 radius is tested after along-host quantization, not on raw projection',()=>{
  const p=plan(space(cases[0])),picker=prepareNodeAttach(p,id);
  assert.equal(picker.pick([.50208,.0119],.001,p.node.point),null,'raw line is within 12px but final quantized point is outside');
  assert.equal(picker.pick([.5,.0119],.001,p.node.point)?.kind,'target');
});
