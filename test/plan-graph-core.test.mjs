import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as Q from '../test-build/plan-exact.js';
import * as G from '../test-build/plan-graph.js';
const corpus=JSON.parse(readFileSync(new URL('./fixtures/plan-graph-corpus.json',import.meta.url),'utf8'));
const hex=n=>{const b=Buffer.alloc(8);b.writeDoubleBE(n);return b.toString('hex');};
const node=(id,x,y)=>({id,p:Q.encodePoint(Q.readSourcePoint([x,y]))});
const edge=(id,from,to,kind='wall')=>({id,from,to,kind,cm:10});
const simple=()=>({version:1,nodes:[node('a',0,0),node('b',1,0)],edges:[edge('w','a','b')],rooms:[],dependencies:[]});
for(const row of corpus.exact)test('IEEE754 correctly rounded '+row.id,()=>{
  assert.equal(hex(Q.toNumber(Q.decodeRational(row.q))),row.hex);
});
test('exact parsing/arithmetic/lattice canonical shape and explicit resource bounds',()=>{
  for(const row of corpus.points)assert.deepEqual(Q.encodePoint(Q.readSourcePoint(row.source)),row.wire);
  assert.deepEqual(Q.parseDecimal('1e-7'),Q.parseDecimal('0.0000001'));
  assert.deepEqual(Q.parseDecimal(-0),Q.ZERO);
  assert.deepEqual(Q.encodeRational(Q.add(Q.exact(1n,3n),Q.exact(2n,3n))),['1','1']);
  assert.throws(()=>Q.decodePoint(['q','1','240','0','1']),/noncanonical-point/);
  assert.throws(()=>Q.decodeRational(['2','6']),/noncanonical/);
  assert.throws(()=>Q.exact(1n<<4096n),/resource/);
  assert.throws(()=>Q.readSourcePoint([5001,0]),/range/);
  assert.equal(Q.withinRadius(Q.readSourcePoint([0,0]),Q.readSourcePoint([8e-7,8e-7]),Q.microRadius(5)),false);
});
for(const row of corpus.migrations)test('migration corpus '+row.id,()=>{
  const original=structuredClone(row.space), result=G.migrateGraphSpace(row.space);
  assert.deepEqual(row.space,original,'pure input');
  assert.equal(G.validateGraph(result.graph).ok,true);
  for(const key of ['nodes','edges','rooms'])assert.equal(result.graph[key].length,row.expected[key],key);
  assert.deepEqual(G.projectGraphSpace(result.space,result.graph).space,result.space);
  assert.deepEqual(G.applyGraphOperation(result.graph,{kind:'normalize-current'}).graph,result.graph);
  let graph=result.graph;
  for(let i=0;i<100;i++){graph=JSON.parse(JSON.stringify(graph));assert.equal(G.validateGraph(graph).ok,true);}
  assert.deepEqual(graph,result.graph);
  const reversed=structuredClone(row.space);
  reversed.rooms?.reverse();
  for(const key of ['wall_segments','partitions']) {
    reversed[key]?.reverse();
    for(const e of reversed[key]||[]){[e.a,e.b]=[e.b,e.a];}
  }
  // Room cycle orientation is a semantic input. Segment array/direction is not.
  const again=G.migrateGraphSpace(reversed);
  assert.deepEqual(again.graph,result.graph,'edge permutation/reversal');
});
test('shared move, split/dependency propagation, exact host remap, and no-op',()=>{
  const before=simple();
  const split=G.applyGraphOperation(before,{kind:'insert-on-edge',edge:{kind:'wall',id:'w'},t:['1','3'],node:'c',newEdgeId:'w2'},
    {hosts:[{id:'door',host:{kind:'wall',id:'w',t:0.75}}]});
  assert.equal(split.graph.edges.length,2);
  assert.deepEqual(split.graph.nodes.find(n=>n.id==='c').p,['l','80','0']);
  assert.deepEqual(split.mapping.hosts.door,{kind:'wall',id:'w2',t:0.625,tq:['5','8']});
  const moved=G.applyGraphOperation(split.graph,{kind:'move-node',node:'b',target:['l','480','0']});
  assert.deepEqual(moved.graph.nodes.find(n=>n.id==='c').p,['l','160','0']);
  assert.throws(()=>G.applyGraphOperation(moved.graph,{kind:'move-node',node:'c',target:['l','160','1']}),/dependent-move/);
  const free=G.applyGraphOperation(moved.graph,{kind:'move-node',node:'c',target:['l','160','1'],detachDependency:true});
  assert.equal(free.graph.dependencies.length,0);
  assert.equal(G.applyGraphOperation(free.graph,{kind:'normalize-current'}).changed,false);
  assert.deepEqual(before,simple());
});
test('intersection support survives edge splits and follows both support lines',()=>{
  const graph={version:1,nodes:[node('a',0,0),node('b',1,1),node('c',0,1),node('d',1,0)],
    edges:[edge('u','a','b','partition'),edge('v','c','d','partition')],rooms:[],dependencies:[]};
  assert.equal(G.validateGraph(graph).ok,false,'unsplit proper crossing is not current canonical data');
  const source={...graph,edges:[graph.edges[0]]};
  const result=G.applyGraphOperation(source,{kind:'batch',operations:[{kind:'create-edge',edge:graph.edges[1]},
    {kind:'insert-intersection',refs:[{kind:'partition',id:'u'},{kind:'partition',id:'v'}],node:'i',newEdgeIds:['u2','v2']}]});
  assert.deepEqual(result.graph.nodes.find(n=>n.id==='i').p,['l','120','120']);
  assert.deepEqual(result.graph.dependencies[0].refs,[{from:'a',to:'b'},{from:'c',to:'d'}]);
  const moved=G.applyGraphOperation(result.graph,{kind:'move-node',node:'b',target:['l','240','480']});
  assert.deepEqual(moved.graph.nodes.find(n=>n.id==='i').p,['l','80','160']);
});
test('invalid graph/patch/operation is atomic and stale projections are refused',()=>{
  const graph=simple(),original=structuredClone(graph);
  assert.throws(()=>G.applyGraphOperation(graph,{kind:'move-node',node:'b',target:['l','0','0']}),/zero-length/);
  const bad={...graph,dependencies:[{node:'a',kind:'on-edge',refs:[{from:'a',to:'b'}],parameters:[['0','1']]}]};
  assert.equal(G.validateGraph(bad).ok,false,'DAG cycle');
  assert.deepEqual(graph,original);
  const space=G.projectGraphSpace({id:'s',rooms:[]},graph).space;
  space.wall_segments[0].a[0]=9;
  assert.throws(()=>G.verifyGraphProjection(space,graph),/projection/);
  const patch={nodes:{set:[node('b',2,0)],remove:[]},edges:{set:[],remove:[]},rooms:{set:[],remove:[]},dependencies:{set:[],remove:[]}};
  assert.equal(G.applyGraphPatch(graph,patch).graph.nodes.find(n=>n.id==='b').p[1],'480');
});
test('replace room cycle retains metadata and resize-detach keeps the neighbouring owner',()=>{
  const source=corpus.migrations.find(r=>r.id==='shared-room-only').space;
  const migrated=G.migrateGraphSpace(source),graph=migrated.graph;
  const shared=graph.edges.find(e=>graph.rooms.every(r=>r.edges.some(ref=>G.edgeKey(ref)===G.edgeKey(e))));
  const selected=graph.rooms.find(r=>r.room==='a');
  const moved=shared.from,otherEdge=selected.edges.map(ref=>graph.edges.find(e=>G.edgeKey(e)===G.edgeKey(ref)))
    .find(e=>e.id!==shared.id&&[e.from,e.to].includes(moved));
  const originalNeighbour=structuredClone(graph.rooms.find(r=>r.room==='b'));
  const target=Q.encodePoint(Q.pointAdd(Q.decodePoint(graph.nodes.find(n=>n.id===moved).p),Q.readSourcePoint([-0.1,0])));
  const result=G.applyGraphOperation(graph,{kind:'detach-node',node:moved,newId:'detached',target,edges:[shared,otherEdge],rooms:['a'],edgeIds:{[G.edgeKey(shared)]:'detached-edge'}});
  assert.deepEqual(result.graph.rooms.find(r=>r.room==='b'),originalNeighbour);
  assert.deepEqual(result.graph.nodes.find(n=>n.id===moved),graph.nodes.find(n=>n.id===moved));
  assert.equal(result.graph.edges.find(e=>e.id==='detached-edge').props,shared.props);
  assert.equal(G.applyGraphOperation(result.graph,{kind:'normalize-current'}).changed,false);
});

test('legacy open spans/open_to, key thickness, partial zero run and opening exception',()=>{
  const base=structuredClone(corpus.migrations.find(r=>r.id==='shared-room-only').space);
  base.walls=[{a:[1,0],b:[1,1],key:'1.000000,0.500000@1.5711',cm:15}];
  base.open_spans=[{a:[1,0.25],b:[1,0.75]}];
  const result=G.migrateGraphSpace(base);
  const middle=result.graph.edges.filter(e=>e.kind==='wall').filter(e=>{
    const a=Q.pointToNumbers(Q.decodePoint(result.graph.nodes.find(n=>n.id===e.from).p));
    const b=Q.pointToNumbers(Q.decodePoint(result.graph.nodes.find(n=>n.id===e.to).p));
    return a[0]===1&&b[0]===1;
  });
  assert.deepEqual(middle.map(e=>e.cm).sort((a,b)=>a-b),[0,15,15]);
  assert.equal('open_spans' in result.space,false);
  const openTo=structuredClone(base);delete openTo.open_spans;openTo.rooms[0].open_to=['b'];
  const virtual=G.migrateGraphSpace(openTo);
  const wall=virtual.graph.edges.find(e=>virtual.graph.rooms.every(r=>r.edges.some(x=>G.edgeKey(x)===G.edgeKey(e))));
  assert.equal(wall.cm,0);
  const withDoor=structuredClone(base);
  withDoor.openings=[{id:'door',type:'door',x:1,y:0.5,length:0.1,angle:90}];
  const door=G.migrateGraphSpace(withDoor);
  assert.ok(door.space.openings[0].host?.tq);
  const carrier=door.graph.edges.find(e=>e.id===door.space.openings[0].host.id);
  assert.equal(carrier.cm,15,'real masonry under the opening survives legacy zero run');
});
test('legacy room wall IDs are lineage when catalogue is absent; props and host exact projection survive',()=>{
  const space={id:'old',rooms:[{id:'r',poly:[[0,0],[1,0],[1,1],[0,1]],wall_ids:['a','b','c','d']}],
    walls:[{key:'0.500000,0.000000@0.0000',cm:15}]};
  const result=G.migrateGraphSpace(space);
  assert.deepEqual(new Set(result.graph.edges.map(e=>e.id)),new Set(['a','b','c','d']));
  assert.equal(result.graph.edges.find(e=>e.id==='a').cm,15);
  const hosted=G.migrateGraphSpace(corpus.migrations.find(r=>r.id==='hosted-negative').space);
  assert.deepEqual(hosted.space.openings[0].host.tq,['1','4']);
  assert.equal(hosted.space.openings[0].host.t,0.25);
});

test('prepared DAG move matches full validation and keeps the source immutable',()=>{
  const split=G.applyGraphOperation(simple(),{kind:'insert-on-edge',edge:{kind:'wall',id:'w'},t:['1','3'],node:'c',newEdgeId:'child'}).graph;
  const prepared=G.prepareGraph(split);
  const op={kind:'move-node',node:'b',target:['l','720','0']};
  const expected=G.applyGraphOperation(split,op),actual=G.applyGraphOperation(prepared.graph,op);
  assert.deepEqual(actual.graph,expected.graph);
  assert.equal(G.validateGraph(actual.graph).ok,true);
  assert.deepEqual(split.nodes.find(n=>n.id==='c').p,['l','80','0']);
  assert.ok(Object.isFrozen(prepared.graph.nodes[0]));
});
test('bounded legacy source movement never chains proximity into extra displacement',()=>{
  const r=1/1200000;
  const space={id:'chain',rooms:[],partitions:[0,.75*r,1.5*r].map((x,i)=>({id:'p'+i,a:[x,0],b:[i+1,1],cm:10}))};
  const result=G.migrateGraphSpace(space);
  for(const part of space.partitions) {
    const a=Q.readSourcePoint(part.a),b=Q.readSourcePoint(part.b),flip=Q.pointCmp(a,b)>0;
    for(const side of [0,1]){
      const ref=JSON.stringify(['partition',part.id,side]),id=result.mapping.nodes[ref][0];
      const raw=side===(flip?1:0)?a:b;
      assert.ok(Q.withinRadius(raw,Q.decodePoint(result.graph.nodes.find(n=>n.id===id).p),Q.microRadius(5)));
    }
  }
});
test('convert-edge remaps exact opening hosts and preserves opaque source properties',()=>{
  const graph={version:1,nodes:[node('a',0,0),node('b',1,0)],
    edges:[{...edge('wall','a','b'),cm:0,props:{wall:'keep'}},{...edge('part','b','a','partition'),props:{partition:'keep'}}],rooms:[],dependencies:[]};
  const result=G.applyGraphOperation(graph,{kind:'convert-edge',edge:{kind:'partition',id:'part'},target:{kind:'wall',id:'wall'},cm:15},
    {hosts:[{id:'o',host:{kind:'partition',id:'part',t:0.25,tq:['1','4']}}]});
  assert.equal(result.graph.edges.length,1);
  assert.equal(result.graph.edges[0].cm,15);
  assert.deepEqual(result.graph.edges[0].props,{partition:'keep',wall:'keep'});
  assert.deepEqual(result.mapping.hosts.o,{kind:'wall',id:'wall',tq:['3','4'],t:0.75});
});
test('current authoritative cm ignores stale legacy open spans; source version is explicit',()=>{
  const initial=G.migrateGraphSpace(corpus.migrations.find(r=>r.id==='shared-room-only').space);
  const source=structuredClone(initial.space);
  source.wall_segments.forEach(e=>e.cm=15);
  source.open_spans=[{a:[1,0],b:[1,1]}];source.rooms[0].open_to=['b'];
  const current=G.migrateGraphSpace({...source,plan_graph:undefined},{sourceModelVersion:10});
  assert.ok(current.graph.edges.every(e=>e.cm===15));
  assert.throws(()=>G.migrateGraphSpace({...source,plan_graph:undefined},{sourceModelVersion:11}),/source-version/);
});
test('projection t is derived from canonical tq and stale scalar echo is refused',()=>{
  const space=G.migrateGraphSpace(corpus.migrations.find(r=>r.id==='hosted-negative').space).space;
  const modified=structuredClone(space);modified.openings[0].host.t=0.75;
  assert.equal(G.validateGraph(space.plan_graph,{hosts:modified.openings}).ok,false);
  assert.throws(()=>G.verifyGraphProjection(modified,space.plan_graph),/projection/);
});

test('collapse of a support node requires explicit dependent retirement; keeps its evaluated value',()=>{
  const graph={version:1,nodes:[node('a',0,0),node('b',1,0),node('c',2,0),node('d',1.5,0),node('e',2,1)],
    edges:[edge('u','a','b','partition'),edge('v','b','c','partition'),edge('w','d','e','partition')],rooms:[],
    dependencies:[{node:'d',kind:'on-edge',refs:[{from:'b',to:'c'}],parameters:[['1','2']]}]};
  const command={kind:'collapse-node',node:'b',retained:{kind:'partition',id:'u'},removed:{kind:'partition',id:'v'}};
  assert.throws(()=>G.applyGraphOperation(graph,command),/dependency-support/);
  const result=G.applyGraphOperation(graph,{...command,retireDependencies:['d']});
  assert.equal(result.graph.dependencies.length,0);
  assert.deepEqual(result.graph.nodes.find(n=>n.id==='d'),graph.nodes.find(n=>n.id==='d'));
});
test('opaque property conflict does not create two canonical shared wall edges',()=>{
  const source={id:'conflict',rooms:[],wall_segments:[
    {id:'a',a:[0,0],b:[1,0],cm:10,custom:'one'},{id:'b',a:[0,0],b:[1,0],cm:10,custom:'two'}]};
  assert.throws(()=>G.migrateGraphSpace(source),/props-conflict/);
});

test('supported minimized legacy plan has finite contact anchors instead of cyclic dependencies',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/real-plan-first-floor.json',import.meta.url),'utf8'));
  const result=G.migrateGraphSpace(fixture.space,{sourceModelVersion:10});
  assert.equal(G.validateGraph(result.graph).ok,true);
  assert.equal(G.applyGraphOperation(result.graph,{kind:'normalize-current'}).changed,false);
  assert.ok(result.migrationReport.maxDisplacementCm<=0.001000000001);
});
test('legacy opening migration retains the existing occupancy contract (#1033)',()=>{
  const cases=JSON.parse(readFileSync(new URL('./fixtures/1033-opening-overlap-guard.json',import.meta.url),'utf8')).cases;
  for(const row of cases){
    const result=G.migrateGraphSpace(row.input.spaces[0],{sourceModelVersion:row.input.model_version});
    const index=G.graphIndex(result.graph);
    const observed=Object.fromEntries(result.space.openings.map(o=>{
      const host=o.host,e=host&&index.edges.get(G.edgeKey(host));
      return[o.id,host?{a:Q.pointToNumbers(index.points.get(e.from)),b:Q.pointToNumbers(index.points.get(e.to)),t:host.t}:null];
    }));
    assert.deepEqual(observed,row.expect,row.name);
  }
});

test('connected legacy contacts use frozen chosen supports without arithmetic feedback (#834)',()=>{
  const fixture=JSON.parse(readFileSync(new URL('./fixtures/834-node-connected.json',import.meta.url),'utf8'));
  for(const space of fixture.spaces){
    const original=structuredClone(space),result=G.migrateGraphSpace(space,{sourceModelVersion:fixture.model_version});
    assert.equal(G.validateGraph(result.graph).ok,true);
    assert.deepEqual(space,original);
    assert.equal(G.applyGraphOperation(result.graph,{kind:'normalize-current'}).changed,false);
  }
});


test('exact tree leaf bounds preserve crossings and R-expanded contacts under source permutations',()=>{
  const input={id:'tree-leaves',rooms:[],partitions:[
    ...Array.from({length:20},(_,i)=>({id:'line-'+String(i).padStart(2,'0'),a:[i/8,0],b:[i/8,1],cm:10})),
    {id:'cross',a:[-.125,.5],b:[2.5,.5],cm:10},
    {id:'near-T',a:[1/8+2e-7,.75],b:[.175,1.5],cm:10}]};
  const first=G.migrateGraphSpace(input,{sourceModelVersion:10});
  const reversed=structuredClone(input);reversed.partitions.reverse();
  for(const edge of reversed.partitions)[edge.a,edge.b]=[edge.b,edge.a];
  const again=G.migrateGraphSpace(reversed,{sourceModelVersion:10});
  assert.deepEqual(again.graph,first.graph);
  assert.equal(first.graph.edges.length,63);
  const line=first.graph.edges.find(e=>e.id==='line-01'),near=first.graph.edges.find(e=>e.id==='near-T');
  const linePieces=first.graph.edges.filter(e=>e.id==='line-01'||e.id.startsWith('line-01~'));
  const touching=linePieces.some(e=>[e.from,e.to].some(n=>n===near.from||n===near.to));
  assert.ok(line&&touching,'the near T endpoint is still joined through the expanded exact query');
  assert.equal(G.validateGraph(first.graph).ok,true);
});
