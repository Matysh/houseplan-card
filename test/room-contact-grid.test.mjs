import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWallFaceGraph,findWallFaceAtPoint} from '../test-build/wall-face-graph.js';
import {commitWallSegmentModel,wallModelOffGridValueCount} from '../test-build/wall-segment-model.js';
import {inheritedY,roomSource,graphSources} from './helpers/room-contact-grid.mjs';
import fs from 'node:fs';
import {optimizePlans} from '../test-build/plan-optimizer.js';

for(const x of [0.375,0.625])test(`#1061 existing face ${x} keeps the inherited scalar through materialization`,()=>{
  const before=roomSource(),space=before.spaces[0];
  assert.equal(wallModelOffGridValueCount(space),1);
  const snapshot=structuredClone(before);
  const face=findWallFaceAtPoint(buildWallFaceGraph(graphSources(space),1000/240*0.0002),[x*1000,150]);
  assert.ok(face);
  const after=structuredClone(before);
  after.spaces[0].rooms.push({id:'new',name:'New',area:null,poly:face.ring.map(p=>p.map(n=>n/1000))});
  const committed=commitWallSegmentModel(after).config;
  assert.equal(wallModelOffGridValueCount(committed.spaces[0]),1,'no rounded new off-grid debt');
  assert.ok(committed.spaces[0].rooms.find(r=>r.id==='new').poly.some(p=>p[1]===inheritedY));
  assert.deepEqual(before,snapshot);
});

test('#1061 exact persisted rings ignore source order/direction and keep inherited lineage',()=>{
  const config=roomSource(),sources=graphSources(config.spaces[0]);
  const original=buildWallFaceGraph(sources,1000/240*0.0002);
  const reversed=buildWallFaceGraph(sources.toReversed().map(p=>({...p,a:p.b,b:p.a})),1000/240*0.0002);
  assert.deepEqual(reversed.faces,original.faces);
  assert.equal(original.faces.length,3);
  let current=structuredClone(config);
  for(const [i,x]of [0.375,0.625].entries()){
    const face=findWallFaceAtPoint(original,[x*1000,150]);
    current.spaces[0].rooms.push({id:`new${i}`,name:'New',area:null,poly:face.ring.map(p=>p.map(n=>n/1000))});
    current=commitWallSegmentModel(current).config;
    assert.equal(wallModelOffGridValueCount(current.spaces[0]),1);
    assert.deepEqual(current.spaces[0].rooms.find(r=>r.id==='old'),config.spaces[0].rooms[0]);
    for(const old of config.spaces[0].wall_segments)
      assert.deepEqual(current.spaces[0].wall_segments.find(w=>w.id===old.id),old);
  }
  assert.equal(current.spaces[0].rooms.length,3);
});

test('#1061 a topology-close conflicting authored endpoint is not moved into a closed face',()=>{
  const s=[{key:'top',a:[0,0],b:[100,0]},
    {key:'right',a:[100,0],b:[100,100]},
    {key:'bottom',a:[100,100],b:[0,100]},
    {key:'left',a:[0,100],b:[0,0.0004]}];
  assert.equal(buildWallFaceGraph(s,0.001).faces.length,0);
  assert.equal(buildWallFaceGraph(s.toReversed(),0.001).faces.length,0);
});

test('#1061 T/overlap cuts keep the exact incident endpoint rather than topology-rounded y',()=>{
  const space=roomSource().spaces[0],s=graphSources(space);
  s.push({key:'overlap',a:[300,inheritedY*1000],b:[700,inheritedY*1000]});
  const graph=buildWallFaceGraph(s,1000/240*0.0002);
  assert.equal(graph.faces.length,3);
  for(const face of graph.faces)for(const point of face.ring)
    assert.ok(point[1]===0||point[1]===inheritedY*1000);
});

test('#1061 HA Align fixtures are exact current optimizer outputs and a second Optimize is a no-op',()=>{
  const cases=JSON.parse(fs.readFileSync(new URL('./fixtures/1061-align-carrier.json',import.meta.url),'utf8'));
  for(const item of cases){
    const result=optimizePlans(item.source,item.layout);
    assert.equal(result.changed,true);
    assert.deepEqual(result.config,item.candidate);
    assert.deepEqual(result.layout,item.candidateLayout);
    assert.equal(optimizePlans(result.config,result.layout).changed,false);
  }
  const source=structuredClone(cases[1].source);
  source.spaces[0].openings[0].length=0.5001;
  const skipped=optimizePlans(source,{});
  assert.deepEqual(skipped.config.spaces[0].partitions,source.spaces[0].partitions,
    'pre-existing hostedFit decides whether Align may move this carrier');
  const canonicalBlocked=structuredClone(cases[1].candidate);
  canonicalBlocked.spaces[0].partitions=structuredClone(source.spaces[0].partitions);
  canonicalBlocked.spaces[0].openings[0].length=0.5001;
  assert.equal(optimizePlans(canonicalBlocked,{}).changed,false,
    'an already canonical source with a blocked carrier is a genuine Optimize no-op');
  source.spaces[0].openings[0].length=0.50000000834;
  assert.deepEqual(optimizePlans(source,{}).config.spaces[0].partitions,cases[1].candidate.spaces[0].partitions,
    'hostedFit consumes the existing scalar-canonicalized input');
});


// Cross-runtime join: the existing real _applyWallFaceBatch producer pins each
// creation input; these explicit synthetic DTO edits pin full Optimize output.
// The HA test must first persist EXACTLY the same input through config/set.
const roomOptimizeFixture = JSON.parse(fs.readFileSync(
  new URL('./fixtures/1061-room-optimize-deltas.json', import.meta.url), 'utf8'));
const roomCandidatesBytes = fs.readFileSync(new URL('./fixtures/1061-room-candidates.json', import.meta.url));
const roomCandidates = JSON.parse(roomCandidatesBytes.toString('utf8'));
const {createHash} = await import('node:crypto');
const {
  checkReferences, checkWallKeys, checkMixedRoleRecords, checkHiddenObstacles, checkPhysicalGeometry,
} = await import('../scripts/model-invariants.mjs');
assert.equal(roomOptimizeFixture.schema, 1);
assert.equal(createHash('sha256').update(roomCandidatesBytes).digest('hex'),
  roomOptimizeFixture.sourceFixtureSha256, 'the real batch input fixture changed; re-produce the join explicitly');
assert.deepEqual(roomOptimizeFixture.rows.map(row => row.name), [
  'first-face-step1', 'second-face-step1', 'sequential-faces-step1',
  'sequential-faces-step2', 'on-grid-control-step1',
]);

function expectedRoomOptimizePair(input, edits) {
  const target = structuredClone(input);
  for (const edit of edits) {
    let owner = target;
    for (const key of edit.path.slice(0, -1)) {
      assert.ok(Object.hasOwn(owner, key), `missing DTO input path: ${edit.path}`);
      owner = owner[key];
    }
    const key = edit.path.at(-1);
    assert.ok(Object.hasOwn(owner, key), `missing DTO input value: ${edit.path}`);
    assert.deepEqual(owner[key], edit.before, `stale Optimize DTO: ${edit.path}`);
    if (edit.remove) delete owner[key];
    else owner[key] = structuredClone(edit.after);
  }
  return target;
}

const roomOptimizeViolations = ({config, layout}) => {
  const notes = [];
  return [
    ...checkReferences({config, layout}, {notes}), ...checkWallKeys(config, {notes}),
    ...checkMixedRoleRecords(config), ...checkHiddenObstacles(config), ...checkPhysicalGeometry(config),
  ];
};

for (const row of roomOptimizeFixture.rows) {
  test(`#1061 ${row.name}: real creation -> full Optimize -> shared invariants -> exact no-op`, () => {
    const input = {config: structuredClone(roomCandidates[row.caseIndex].candidates[row.candidateIndex]),
      layout: structuredClone(roomOptimizeFixture.layout)};
    const original = structuredClone(input);
    const expected = expectedRoomOptimizePair(input, row.edits);
    assert.deepEqual(roomOptimizeViolations(input), [], 'all five pre-Optimize invariant families');
    const result = optimizePlans(input.config, input.layout);
    assert.deepEqual(input, original, 'Optimize cannot mutate the persisted input');
    assert.equal(result.changed, row.changed);
    assert.deepEqual({config: result.config, layout: result.layout}, expected,
      'the DTO is the full current TS Optimize output, not a Python optimizer');
    assert.deepEqual(roomOptimizeViolations(expected), [], 'all five post-Optimize invariant families');
    const again = optimizePlans(expected.config, expected.layout);
    assert.equal(again.changed, false);
    assert.deepEqual({config: again.config, layout: again.layout}, expected,
      'the EXACT pair subsequently persisted by HA is an Optimize fixed point');
  });
}
