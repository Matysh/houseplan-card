import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
import {corpusPassport,identityProjection,loadWallIdentityCorpus,withCorpusIds}
  from './helpers/wall-identity-corpus.mjs';

const expected=JSON.parse(readFileSync(new URL('./fixtures/845-wall-corpus-identities.json',import.meta.url),'utf8'));
const compare=(actual,baseline)=>assert.deepEqual(actual,baseline,'wall corpus identity/order/input membership changed');

test('#845 complete persisted fixture/demo corpus retains baseline identities and byte idempotence',async t=>{
  const corpus=await loadWallIdentityCorpus();
  compare(corpusPassport(commitWallSegmentModel,corpus),expected);
  for(const {label,input} of corpus.entries)withCorpusIds(()=>{
    const frozen=structuredClone(input),first=commitWallSegmentModel(input).config;
    assert.deepEqual(input,frozen,label+': read-only');
    assert.equal(JSON.stringify(commitWallSegmentModel(first).config),JSON.stringify(first),label);
    if(Number(input.model_version)>=10)for(const old of input.spaces||[]){
      const current=first.spaces.find(s=>s.id===old.id);
      // Complete v10 documents preserve each stored atom, not merely reference validity.
      if((old.wall_segments||[]).length&&(old.rooms||[]).every(r=>r.poly?.length===r.wall_ids?.length)){
        assert.deepEqual([...current.wall_segments.map(w=>w.id)].sort(),[...old.wall_segments.map(w=>w.id)].sort(),label);
        assert.deepEqual(current.rooms.map(r=>r.wall_ids),old.rooms.map(r=>r.wall_ids),label);
      }
    }
  });
  t.diagnostic('wall corpus: '+corpus.entries.length+' documents from '+corpus.inventory.length+' files; '
    +corpus.inventory.filter(f=>!f.configs).length+' non-config sources explicitly inventoried');
});

test('#845 corpus guard rejects catalogue reorder, renamed id and room/opening relink',()=>{
  const input={spaces:[{id:'f',rooms:[{id:'r',poly:[[0,0],[1,0],[1,1],[0,1]]}],
    walls:[{key:'legacy',a:[0,0],b:[1,0],cm:10}],
    openings:[{id:'door',type:'door',x:.5,y:0,angle:0,length:.1}]}],markers:[],settings:{}};
  const before=commitWallSegmentModel(input).config,identity=identityProjection(before);
  for(const damage of [
    s=>s.wall_segments.reverse(),
    s=>{s.wall_segments[0].id='renamed';},
    s=>{s.rooms[0].wall_ids[0]=s.rooms[0].wall_ids[1];},
    s=>{s.openings[0].host.id='foreign';},
  ]){
    const after=structuredClone(before);damage(after.spaces[0]);
    assert.throws(()=>compare(identityProjection(after),identity));
  }
  const unsigned=structuredClone(expected);unsigned.documents.push({label:'new-config'});
  assert.throws(()=>compare(unsigned,expected),'new config cannot silently escape the passport');
});

test('#845 missing corpus root fails instead of reporting empty success',async()=>{
  await assert.rejects(loadWallIdentityCorpus('/houseplan-missing-corpus-845'),/ENOENT/);
});
