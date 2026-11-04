import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../test-build/plan-graph.js';
import * as Q from '../test-build/plan-exact.js';
import { commitGraphEdit, commitGraphEditResult } from '../test-build/graph-edit-intent.js';
import { optimizePlans } from '../test-build/plan-optimizer.js';
import { resolvePropertiesTarget } from '../test-build/editors/properties/catalog.js';

const copy=structuredClone;
const edge=(id,from,to,kind='wall',cm=10,props)=>({id,kind,from,to,cm,...props?{props}:{}});
function fixture({openings=[],differentThickness=false,differentProps=false,support=false,remote=false}={}) {
  const graph={version:1,
    nodes:[['a',0,0],['b',240,0],['c',240,240],['d',0,240],['seam',120,0],['end',120,120]]
      .map(([id,x,y])=>({id,p:['l',String(x),String(y)]})),
    edges:[edge('top-left','a','seam'),edge('top-right','seam','b','wall',differentThickness?20:10,differentProps?{paint:'blue'}:undefined),
      edge('right','b','c'),edge('bottom','c','d'),edge('left','d','a'),edge('p','seam','end','partition')],
    rooms:[{room:'r',edges:['top-left','top-right','right','bottom','left'].map(id=>({kind:'wall',id,reverse:false}))}],
    dependencies:[{node:'seam',kind:'on-edge',refs:[{from:'a',to:'b'}],parameters:[['1','2']]}]};
  if(support){
    graph.nodes.push({id:'dependent',p:['l','180','120']});
    graph.dependencies.push({node:'dependent',kind:'on-edge',refs:[{from:'seam',to:'c'}],parameters:[['1','2']]});
  }
  if(remote){
    graph.nodes.push(...[['ra',480,0],['rs',600,0],['rb',720,0]].map(([id,x,y])=>({id,p:['l',String(x),String(y)]})));
    graph.edges.push(edge('remote-a','ra','rs','partition'),edge('remote-b','rs','rb','partition'));
  }
  const space=G.projectGraphSpace({id:'s',cell_cm:5,rooms:[{id:'r',name:'Room',custom:{keep:1}}],openings,custom:{keep:'space'}},graph).space;
  assert.equal(G.validateGraph(space.plan_graph,{hosts:space.openings}).ok,true);
  return space;
}
function optimize(space){return optimizePlans({model_version:11,spaces:[space],markers:[],settings:{}},{positions:{}});}
function noWork(space){
  assert.equal(G.validateGraph(space.plan_graph,{hosts:space.openings}).ok,true);
  assert.doesNotThrow(()=>G.verifyGraphProjection(space,space.plan_graph));
  assert.equal(optimize(space).changed,false);
}
function removeT(before){const draft=copy(before);draft.partitions=draft.partitions.filter(p=>p.id!=='p');return commitGraphEditResult(before,draft,{kind:'partitions',ids:['p']});}

test('#1283 detaching a T endpoint compacts its old wall seam locally',()=>{
  const before=fixture(),snapshot=copy(before),draft=copy(before);
  draft.partitions.find(p=>p.id==='p').a=[.5,.1];draft.partitions.find(p=>p.id==='p').b=[.5,.6];
  const result=commitGraphEditResult(before,draft,{kind:'partitions',ids:['p']});
  assert.equal(result.graph.nodes.some(n=>n.id==='seam'),false);
  assert.equal(result.graph.edges.filter(e=>e.kind==='wall').length,4);
  assert.equal(result.operations.filter(op=>op.kind==='collapse-node').length,1);
  assert.deepEqual(result.space.partitions.map(p=>[p.a,p.b]),[[[.5,.1],[.5,.6]]]);
  assert.deepEqual(before,snapshot);noWork(result.space);
});

test('#1283 deleting a T partition compacts the abandoned seam',()=>{
  const before=fixture(),after=removeT(before);
  assert.equal(after.graph.nodes.some(n=>n.id==='seam'),false);
  assert.equal(after.graph.edges.length,4);assert.equal(after.space.partitions.length,0);
  assert.deepEqual(after.space.rooms[0].custom,{keep:1});assert.deepEqual(after.space.custom,before.custom);
  noWork(after.space);
});

test('#1283 a collinear click in a newly outlined room leaves no Optimize work',()=>{
  const before=G.projectGraphSpace({id:'s',cell_cm:5,rooms:[]},{version:1,nodes:[],edges:[],rooms:[],dependencies:[]}).space;
  const draft=copy(before);draft.rooms.push({id:'r',poly:[[0,0],[.5,0],[1,0],[1,1],[0,1]],custom:{keep:'room'}});
  const result=commitGraphEditResult(before,draft,{kind:'faces',rooms:['r']});
  assert.equal(result.graph.edges.length,4);assert.equal(result.graph.nodes.length,4);
  assert.deepEqual(result.space.rooms[0].custom,{keep:'room'});noWork(result.space);
});

test('#1283 a live Draw chain keeps its named endpoint until its own finish',()=>{
  let before=G.projectGraphSpace({id:'s',rooms:[]},{version:1,nodes:[],edges:[],rooms:[],dependencies:[]}).space;
  let draft=copy(before);draft.partitions=[{id:'p1',a:[0,0],b:[.5,0],cm:10}];
  before=commitGraphEdit(before,draft,{kind:'partitions',ids:['p1'],endpointRefs:{p1:[
    {kind:'independent',node:'a',p:['l','0','0']},{kind:'independent',node:'joint',p:['l','120','0']} ]}});
  draft=copy(before);draft.partitions.push({id:'p2',a:[.5,0],b:[1,0],cm:10});
  const result=commitGraphEdit(before,draft,{kind:'partitions',ids:['p2'],endpointRefs:{p2:[
    {kind:'existing-node',node:'joint'},{kind:'independent',node:'b',p:['l','240','0']} ]}});
  assert.ok(result.plan_graph.nodes.some(n=>n.id==='joint'),'the next native click can still name previous.to');
  assert.equal(result.partitions.length,2);
});

test('#1283 openings on both former wall atoms keep their literal position and exact host',()=>{
  const openings=[{id:'a',type:'door',x:.25,y:0,length:.1,angle:0,host:{kind:'wall',id:'top-left',t:.5,tq:['1','2']},flip:true,custom:{keep:'a'}},
    {id:'b',type:'window',x:.75,y:0,length:.1,angle:0,host:{kind:'wall',id:'top-right',t:.5,tq:['1','2']},custom:{keep:'b'}}];
  const before=fixture({openings}),result=removeT(before),index=G.graphIndex(result.graph);
  for(const opening of result.space.openings){
    const old=before.openings.find(o=>o.id===opening.id),host=index.edges.get(G.edgeKey(opening.host));
    assert.deepEqual({...opening,host:old.host},old);
    const center=Q.pointAt(index.points.get(host.from),index.points.get(host.to),Q.decodeRational(opening.host.tq));
    assert.deepEqual(Q.pointToNumbers(center),[old.x,old.y]);
  }
  assert.equal(new Set(result.space.openings.map(o=>o.host.id)).size,1);noWork(result.space);
});

for(const variant of ['differentThickness','differentProps','support'])test('#1283 retains a seam protected by '+variant,()=>{
  const before=fixture({[variant]:true}),result=removeT(before);
  assert.ok(result.graph.nodes.some(n=>n.id==='seam'));
  assert.equal(result.graph.edges.filter(e=>e.kind==='wall').length,5);
  assert.equal(result.operations.some(op=>op.kind==='collapse-node'),false);
  assert.equal(G.validateGraph(result.graph).ok,true);
});

for(const [x,t,tq]of[[.475,.95,['19','20']],[.5,1,['1','1']]])test('#1283 an opening footprint protects its wall seam from editor and Optimize, x='+x,()=>{
  const before=fixture({openings:[{id:'door',type:'door',x,y:0,length:.1,angle:0,
    host:{kind:'wall',id:'top-left',t,tq}}]});
  const result=removeT(before);
  assert.ok(result.graph.nodes.some(n=>n.id==='seam'));
  assert.deepEqual(result.space.openings,before.openings);
  noWork(result.space);
});

test('#1283 an opening footprint protects a partition seam from editor and Optimize',()=>{
  const graph={version:1,nodes:[['a',0,0],['seam',120,0],['b',240,0],['end',120,120]]
    .map(([id,x,y])=>({id,p:['l',String(x),String(y)]})),
    edges:[edge('left','a','seam','partition'),edge('right','seam','b','partition'),edge('p','seam','end','partition')],rooms:[],
    dependencies:[{node:'seam',kind:'on-edge',refs:[{from:'a',to:'b'}],parameters:[['1','2']]}]};
  const before=G.projectGraphSpace({id:'s',cell_cm:5,rooms:[],openings:[{id:'door',type:'door',x:.5,y:0,length:.1,angle:0,
    host:{kind:'partition',id:'left',t:1,tq:['1','1']}}]},graph).space;
  const result=removeT(before);assert.equal(result.graph.edges.length,2);
  assert.ok(result.graph.nodes.some(n=>n.id==='seam'));assert.deepEqual(result.space.openings,before.openings);noWork(result.space);
});

test('#1283 local cleanup leaves an unrelated collinear partition seam intact',()=>{
  const before=fixture({remote:true}),result=removeT(before);
  for(const id of ['ra','rs','rb'])assert.deepEqual(result.graph.nodes.find(n=>n.id===id),before.plan_graph.nodes.find(n=>n.id===id));
  for(const id of ['remote-a','remote-b'])assert.deepEqual(result.graph.edges.find(e=>e.id===id),before.plan_graph.edges.find(e=>e.id===id));
  assert.ok(!result.graph.nodes.some(n=>n.id==='seam'));
});

test('#1283 deletion of a room compacts safe seams in its retained walls',()=>{
  const source=fixture(),before=G.projectGraphSpace(source,G.applyGraphOperation(source.plan_graph,
    {kind:'delete-edge',edge:{kind:'partition',id:'p'}}).graph).space,draft=copy(before);draft.rooms=[];
  const broken=fixture({differentThickness:true}),without=removeT(broken).space,prepared=copy(without);
  prepared.rooms=[];
  const result=commitGraphEditResult(without,prepared,{kind:'delete-room',room:'r',keepWalls:true});
  assert.equal(result.graph.rooms.length,0);
  assert.equal(result.graph.edges.length,5,'unequal materials remain separate after conversion');
  const deleted=commitGraphEdit(before,draft,{kind:'delete-room',room:'r',keepWalls:true});
  assert.equal(deleted.plan_graph.rooms.length,0);assert.equal(deleted.partitions.length,4);
  assert.equal(deleted.plan_graph.nodes.some(n=>n.id==='seam'),false);noWork(deleted);
});

test('#1283 equalizing a touched material breakpoint removes only the safe seam',()=>{
  const before=removeT(fixture({differentThickness:true})).space;
  const result=commitGraphEdit(before,copy(before),{kind:'thickness',edges:[{kind:'wall',id:'top-right'}],cm:10});
  assert.equal(result.wall_segments.length,4);assert.equal(result.plan_graph.nodes.some(n=>n.id==='seam'),false);noWork(result);
  assert.ok(result.wall_segments.some(e=>e.id==='top-right'),'Properties can still resolve its explicitly selected later-sorting ID');
  assert.equal(resolvePropertiesTarget({editor:'plan',spaceId:'s',kind:'contour',objectId:'top-right'},result,[],[])?.value.cm,10);
});

test('#1283 Properties partition edits retain the selected ID when a material seam becomes uniform',()=>{
  const graph={version:1,nodes:[['a',0,0],['seam',120,0],['b',240,0]]
    .map(([id,x,y])=>({id,p:['l',String(x),String(y)]})),
    edges:[edge('a-neighbor','a','seam','partition',10),edge('z-selected','seam','b','partition',20)],rooms:[],dependencies:[]};
  const before=G.projectGraphSpace({id:'s',cell_cm:5,rooms:[]},graph).space,draft=copy(before);
  draft.partitions.find(p=>p.id==='z-selected').cm=10;
  const result=commitGraphEdit(before,draft,{kind:'partitions',ids:['z-selected']});
  assert.equal(result.partitions.length,1);assert.equal(result.partitions[0].id,'z-selected');
  assert.equal(result.partitions[0].cm,10);assert.deepEqual(result.partitions[0].a,[0,0]);assert.deepEqual(result.partitions[0].b,[1,0]);
  assert.equal(resolvePropertiesTarget({editor:'plan',spaceId:'s',kind:'partition',objectId:'z-selected'},result,[],[])?.value.cm,10);
  noWork(result);
});

test('#1283 equivalent opaque props compare by JSON value rather than insertion order',()=>{
  const before=fixture(),graph=copy(before.plan_graph);
  graph.edges.find(e=>e.id==='top-left').props={paint:'same',material:{x:1,y:2}};
  graph.edges.find(e=>e.id==='top-right').props={material:{y:2,x:1},paint:'same'};
  const result=removeT(G.projectGraphSpace(before,graph).space);
  assert.equal(result.graph.edges.filter(e=>e.kind==='wall').length,4);
  assert.deepEqual(result.graph.edges.find(e=>e.id==='top-left').props,{paint:'same',material:{x:1,y:2}});
});

for(const reverse of[false,true])test('#1283 split-then-collapse lineage references the retained live edge, reverse='+reverse,()=>{
  const graph={version:1,nodes:[{id:'a',p:['l','0','0']},{id:'b',p:['l','240','0']}],
    edges:[edge('p','a','b','partition')],rooms:[],dependencies:[]};
  const result=G.applyGraphOperation(graph,{kind:'batch',operations:[
    {kind:'insert-on-edge',edge:{kind:'partition',id:'p'},t:['1','2'],node:'s',newEdgeId:'piece'},
    ...(reverse?[{kind:'retarget-edge',edge:{kind:'partition',id:'piece'},from:'b',to:'s'}]:[]),
    {kind:'collapse-node',node:'s',retained:{kind:'partition',id:'p'},removed:{kind:'partition',id:'piece'}}]});
  const keys=new Set(result.graph.edges.map(G.edgeKey));
  for(const ranges of Object.values(result.mapping.edges))for(const range of ranges)assert.ok(keys.has(G.edgeKey(range.ref)));
  assert.equal(result.mapping.edges['partition:piece'][0].reverse,reverse);
  assert.deepEqual(result.graph.edges,graph.edges);
});
