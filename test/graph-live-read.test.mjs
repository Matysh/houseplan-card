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

