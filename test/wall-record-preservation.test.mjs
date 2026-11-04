import test from 'node:test';
import assert from 'node:assert/strict';

import { checkWallRecordsPreserved, graphWallRecordsPreserved } from '../test-build/wall-record-preservation.js';

const walls = (...cms) => cms.map((cm) => ({ cm }));

test('#1264 exact source material survives graph cuts and aliases, including zero and opaque properties',()=>{
  const e=(id,cm=0)=>({kind:'wall',id,cm,props:{custom:{a:1,b:2}}});
  const proof={before:[e('source')],after:[e('left'),e('right')],descendants:{'wall:source':['wall:left','wall:right']}};
  assert.equal(graphWallRecordsPreserved(proof),true,'a proven cut changes atom multiplicity');
  for(const corrupt of [
    p=>p.after[0].cm=20,
    p=>p.after[0].props.custom.b=3,
    p=>p.after.pop(),
    p=>p.after.push(e('foreign')),
    p=>p.descendants['wall:source']=[],
    p=>p.before.push(e('lost')),
  ]){const bad=structuredClone(proof);corrupt(bad);assert.equal(graphWallRecordsPreserved(bad),false);}
  proof.after[0].props.custom={b:2,a:1};
  assert.equal(graphWallRecordsPreserved(proof),true,'JSON key order does not change material');
  proof.before.push(e('alias'));proof.descendants['wall:alias']=['wall:left','wall:right'];
  assert.equal(graphWallRecordsPreserved(proof),true,'equal source aliases may share actual children');
  proof.before[1].cm=30;assert.equal(graphWallRecordsPreserved(proof),false,'conflicting sources cannot coalesce');
});

test('#264 broad audit preserves its historical presence semantics', () => {
  assert.deepEqual(checkWallRecordsPreserved(walls(15, 15, 30), walls(15, 30)), []);
  assert.equal(checkWallRecordsPreserved(walls(15, 30), walls(15))[0]?.kind, 'lost');
  assert.deepEqual(checkWallRecordsPreserved(walls(15), [], { allowClear: true }), []);
  assert.deepEqual(checkWallRecordsPreserved(walls(0, NaN, Infinity), []), []);
});

test('#264 exact fixed-topology profile includes zero and multiplicity', () => {
  assert.deepEqual(checkWallRecordsPreserved(
    walls(0, 15, 15), walls(15, 0, 15), { exactMultiplicity: true },
  ), []);
  assert.equal(checkWallRecordsPreserved(
    walls(0, 15, 15), walls(0, 15), { exactMultiplicity: true },
  )[0]?.kind, 'count');
  assert.equal(checkWallRecordsPreserved(
    walls(0, 15), walls(0, 15, 30), { exactMultiplicity: true },
  )[0]?.reference, 'было 0, стало 1');
});

