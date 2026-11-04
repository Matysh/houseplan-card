import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {characterize} from './helpers/geometry-commit-characterization.mjs';
import {historyCharacterization} from './helpers/geometry-history-characterization.mjs';

// Frozen pre-#1279 full outputs, authenticated by the original exact passports.
// Expected current bytes are derived here without invoking a graph writer.
const before=JSON.parse(readFileSync(new URL('../docs/testing/issue1281-split-before-1279.json',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
assert.equal(hash(before.commit.config),'cf110a0f2a0ae870f4dd3e09052f0e0b7a03d397a72115005feef6c079ec9aa9');
assert.equal(hash(before.history.afterEdit),'d8062de0ac5876e4f3e7498a29af2fcdf7e26f8f881199943f53a5a5ea63e84c');
assert.equal(hash(before.history.steps[1].config),'d8062de0ac5876e4f3e7498a29af2fcdf7e26f8f881199943f53a5a5ea63e84c');

function shareDivider(config,spaceId,roomId,keepId,dropId) {
  const expected=structuredClone(config),space=expected.spaces.find(s=>s.id===spaceId);
  const keep=space.plan_graph.edges.find(e=>e.id===keepId),drop=space.plan_graph.edges.find(e=>e.id===dropId);
  assert.equal(keep.from,drop.to);assert.equal(keep.to,drop.from);assert.equal(keep.cm,drop.cm);
  assert.equal(space.wall_segments.filter(w=>w.id===dropId).length,1);
  space.wall_segments=space.wall_segments.filter(w=>w.id!==dropId);
  space.plan_graph.edges=space.plan_graph.edges.filter(e=>e.id!==dropId);
  const room=space.rooms.find(r=>r.id===roomId),cycle=space.plan_graph.rooms.find(r=>r.room===roomId);
  assert.equal(room.wall_ids.filter(id=>id===dropId).length,1);
  assert.equal(cycle.edges.filter(e=>e.id===dropId).length,1);
  room.wall_ids=room.wall_ids.map(id=>id===dropId?keepId:id);
  for(const edge of cycle.edges)if(edge.id===dropId){edge.id=keepId;edge.reverse=!edge.reverse;}
  return expected;
}

test('#1281 Split commit differs from its authenticated old document only by one shared divider',()=>{
  const expected=structuredClone(before.commit);
  expected.config=shareDivider(expected.config,'f','right','ge-6449b68f5f0c8a9e','ge-7e267159770eedb9');
  assert.equal(JSON.stringify(characterize('split')),JSON.stringify(expected));
});

test('#1281 Split history preserves exact Undo and changes only the shared divider in edit and Redo',()=>{
  const expected=structuredClone(before.history);
  for(const holder of [{object:expected,key:'afterEdit'},{object:expected.steps[1],key:'config'}])
    holder.object[holder.key]=shareDivider(holder.object[holder.key],'a','split-b','ge-2755a2d6e28827ff','ge-a02016f0df5f15a0');
  assert.equal(JSON.stringify(historyCharacterization('split')),JSON.stringify(expected));
});
