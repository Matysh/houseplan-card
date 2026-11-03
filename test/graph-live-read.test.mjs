import test from 'node:test';
import assert from 'node:assert/strict';
import {directWallScenes} from '../demo/fixtures/direct-wall-geometry.mjs';
import {migrateGraphSpace,validateGraph} from '../test-build/plan-graph.js';
import {graphViewSpace} from '../test-build/plan-graph-view.js';
import {resizeLiveCandidateSpace} from '../test-build/resize-live-preflight.js';
import {wallChainLiveCandidateSpace} from '../test-build/draft-live-preflight.js';
import {spaceModels} from '../test-build/space-geometry.js';
import {wallGraphSource} from '../test-build/wall-graph-source.js';
import {prepareSpacePhysicalGeometryInputs} from '../test-build/plan-geometry-preflight.js';
import {wallBodiesGeometry} from '../test-build/wall-thickness.js';
import {junctionLimitViolations} from '../test-build/junction-limits.js';

test('resize and draft physical projections retain accepted graph closure and bypass legacy joins',()=>{
 const raw=directWallScenes().find(s=>s.id==='mixed-junctions');
 const accepted=migrateGraphSpace(raw,{sourceModelVersion:10});
 const space=graphViewSpace({...raw,plan_graph:accepted.graph});
 const original=JSON.stringify(space.plan_graph);
 const seed=space.partitions.find(p=>p.id==='horizontal') || space.partitions[0];
 const candidates=[resizeLiveCandidateSpace(space,['room']),
  wallChainLiveCandidateSpace(space,{partitionId:seed.id,a:seed.a,b:seed.b,cm:seed.cm})?.space];
 for(const candidate of candidates){
  assert.ok(candidate?.plan_graph);assert.equal(validateGraph(candidate.plan_graph).ok,true);
  assert.ok(candidate.plan_graph.edges.length>0);
  for(const node of candidate.plan_graph.nodes)
   assert.strictEqual(node,space.plan_graph.nodes.find(n=>n.id===node.id),'exact immutable source node retained');
  const model=spaceModels({model_version:11,spaces:[candidate]})[0];
  assert.strictEqual(wallGraphSource(model.rooms).graph,candidate.plan_graph);
  const i=prepareSpacePhysicalGeometryInputs(candidate,model);
  const geometry=wallBodiesGeometry(model.rooms,i.walls,i.openCuts,i.roomOpenings,
   i.wallKeyPitch,i.cellCm,i.gridPitch,i.coordScale,i.physicalBodies,
   {mergeExtra(){throw Error('legacy union entered a model11 live candidate');}});
  assert.equal(geometry.status,'ok');assert.ok(geometry.multiWallNodes);
 }
 assert.equal(JSON.stringify(space.plan_graph),original);
});

test('shared Resize physical proof retains normalized clearance, including an actually undersized room',()=>{
 const raw={id:'s',cell_cm:5,rooms:[{id:'tiny',poly:[[.1,.1],[.115,.1],[.115,.115],[.1,.115]]}]};
 raw.rooms[0].wall_ids=['a','b','c','d'];
 raw.wall_segments=raw.rooms[0].poly.map((a,i)=>({id:raw.rooms[0].wall_ids[i],a,b:raw.rooms[0].poly[(i+1)%4],cm:15}));
 const space=graphViewSpace({...raw,plan_graph:migrateGraphSpace(raw,{sourceModelVersion:10}).graph});
 const candidate=resizeLiveCandidateSpace(space,['tiny']);
 const model=spaceModels({model_version:11,spaces:[candidate]})[0],i=prepareSpacePhysicalGeometryInputs(candidate,model);
 const geometry=wallBodiesGeometry(model.rooms,i.walls,i.openCuts,i.roomOpenings,
  i.wallKeyPitch,i.cellCm,i.gridPitch,i.coordScale,i.physicalBodies);
 const config={model_version:11,spaces:[candidate]},segments=candidate.wall_segments;
 const fresh=junctionLimitViolations(config,'s',segments);
 const shared=junctionLimitViolations(config,'s',segments,geometry);
 const p5=shared.find(v=>v.rule==='clearance');assert.ok(p5,'the room really violates P5');
 assert.ok(Math.abs(p5.actual-9)<1e-8,'9 cm2, not render units squared');
 assert.deepEqual(shared.map(v=>[v.rule,v.subject]),fresh.map(v=>[v.rule,v.subject]));
});

