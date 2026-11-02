import test from 'node:test';
import assert from 'node:assert/strict';
import {annotateGraphOpeningRuns,graphOpeningRunTarget,graphOpeningRun} from '../test-build/graph-opening-run.js';
import {projectGraphSpace} from '../test-build/plan-graph.js';
import {nudgePlan} from '../test-build/editors/plan-nudge.js';
import {partitionPlacementIntervals,resolvePartitionOpeningStrict,partitionOpeningCut} from '../test-build/partition-openings.js';
import {resolveOpeningPlacement,openingPlacementPreset} from '../test-build/opening-placement.js';
import {physicalBodyParts,unionBodies,pointInPhysicalGeometry} from '../test-build/physical-geometry.js';
const clone=v=>JSON.parse(JSON.stringify(v));
function fixture(kind='partition') {
  const graph={version:1,nodes:[{id:'a',p:['l','0','120']},{id:'m',p:['l','120','120']},{id:'b',p:['l','240','120']}],
    edges:[{kind,id:'left',from:'a',to:'m',cm:15},{kind,id:'right',from:'b',to:'m',cm:15}],rooms:[],dependencies:[]};
  return projectGraphSpace({id:'s',cell_cm:5,rooms:[],openings:[{id:'o',type:'window',x:.5,y:.5,angle:0,length:.2,
    host:{kind,id:'left',t:1,tq:['1','1']},future:{keep:true}}]},graph).space;
}
const parts=(s,scale=1)=>{const p=s.partitions.map(p=>({...p,a:p.a.map(n=>n*scale),b:p.b.map(n=>n*scale)}));annotateGraphOpeningRuns(s.plan_graph,p,'partition',scale);return p;};
test('explicit target crosses child in either direction, preserves anchor at boundary and clamps only full extent',()=>{
  const s=fixture(),p=parts(s,1000),before=clone(s);
  const t=graphOpeningRunTarget(p,'left',[750,700]);
  assert.deepEqual(t,{host:{kind:'partition',id:'right',tq:['1','2'],t:.5},center:[750,500],normalized:[.75,.5]});
  assert.equal(graphOpeningRunTarget(p,'left',[500,500]).host.id,'left');
  assert.equal(graphOpeningRunTarget(p,'right',[500,500]).host.id,'right');
  assert.deepEqual(graphOpeningRunTarget(p,'right',[250,500]).host,{kind:'partition',id:'left',tq:['1','2'],t:.5});
  assert.deepEqual(graphOpeningRunTarget(p,'left',[1500,500]).center,[1000,500]);
  assert.equal(graphOpeningRunTarget(p.slice(0,1),'left',[750,500]),undefined);
  assert.deepEqual(s,before);
});
test('placement resolves full known run, writes correct child tq and preserves foreign-host ambiguity',()=>{
  const s=fixture(),p=parts(s,1000),intervals=partitionPlacementIntervals(p,5,1000/240);
  const input={pointer:[500,500],preset:openingPlacementPreset('window',1),geometryRevision:1,renderedLength:200,intervals,baseTolerance:5,bodyPointerPadding:2,gridStep:1000/240};
  const result=resolveOpeningPlacement(input);
  assert.ok(result);assert.equal(result.x,500);assert.equal(result.target.b[0]-result.target.a[0],1000);
  const opening={...s.openings[0],host:result.host,x:result.x/1000,y:result.y/1000};
  assert.ok(resolvePartitionOpeningStrict(opening,p,1000,5,1000/240).resolved);
  const foreign={...intervals[0],partitionHost:{kind:'partition',id:'foreign'}};
  // JSON-cloned foreign interval intentionally has no proven run metadata.
  assert.equal(resolveOpeningPlacement({...input,intervals:[...intervals,clone(foreign)]}),null);
});
test('graph opening nudge crosses atomic seam, replaces stale tq and cuts both children',()=>{
  for(const kind of ['partition','wall']) {
    const s=fixture(kind);s.openings[0]={...s.openings[0],x:7/16,length:.2,host:{kind,id:'left',t:7/8,tq:['7','8'],future:{kept:true}}};
    const before=clone(s),m=nudgePlan(s,{kind:'opening',id:'o'},1/8,0,5);
    assert.ok(m,kind);assert.deepEqual(s,before);assert.equal(m.openings[0].x,9/16);
    assert.deepEqual(m.openings[0].host,{kind,id:'right',t:7/8,tq:['7','8'],future:{kept:true}});
    assert.deepEqual(m.plan_graph,s.plan_graph);assert.deepEqual(m.openings[0].future,{keep:true});
    const back=nudgePlan(m,{kind:'opening',id:'o'},-1/8,0,5);assert.equal(back.openings[0].x,7/16);assert.equal(back.openings[0].host.id,'left');
    if(kind==='partition') {
      const p=parts(m,1000),r=resolvePartitionOpeningStrict(m.openings[0],p,1000,5,1000/240).resolved;
      assert.ok(r);assert.equal(r.axis.length,500);assert.equal(r.t,7/8);
      const geometry=unionBodies(physicalBodyParts({partitions:p,wall_columns:[]},5,1000/240,1e-6,[partitionOpeningCut(r)]).all);
      for(const x of [475,550,625]) assert.equal(pointInPhysicalGeometry([x,500],geometry),false);
      assert.equal(pointInPhysicalGeometry([700,500],geometry),true);
    }
  }
});
test('full step respects real run jamb/end and cross-child overlap; detached and changed props do not bridge',()=>{
  const s=fixture();
  assert.equal(nudgePlan(s,{kind:'opening',id:'o'},.5,0,5),null);
  const m=clone(s);m.openings.push({...m.openings[0],id:'other',length:.05,x:.7,host:{kind:'partition',id:'right',t:.6,tq:['3','5']}});
  assert.equal(nudgePlan(m,{kind:'opening',id:'o'},.125,0,5),null);
  const g=clone(s.plan_graph);g.edges[1].props={separate:true};
  const different=projectGraphSpace(s,g).space;
  assert.equal(nudgePlan(different,{kind:'opening',id:'o'},.125,0,5),null);
  const detached=clone(s.plan_graph);detached.nodes.push({id:'detached',p:['l','120','120']});detached.edges[1].to='detached';
  assert.equal(nudgePlan(projectGraphSpace(s,detached).space,{kind:'opening',id:'o'},.125,0,5),null);
});
