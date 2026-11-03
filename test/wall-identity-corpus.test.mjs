import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {commitWallSegmentModel} from '../test-build/wall-segment-model.js';
import {compareCodePoints} from '../test-build/codepoint-order.js';
import {corpusPassport,identityProjection,loadWallIdentityCorpus,loadCompleteWallIdentityCorpus,loadHistoricalWallIdentityCorpus,withCorpusIds,extractCorpusConfigs}
  from './helpers/wall-identity-corpus.mjs';

const historical=JSON.parse(readFileSync(new URL('./fixtures/845-wall-corpus-identities.json',import.meta.url),'utf8'));
// #1216 canonical graph tables determine projection order. Port only EXPECTED
// table order; the immutable original passport/file, space order, opening order
// and each room's oriented edge cycle remain untouched. Semantic IDs/outcomes
// and the unreviewed current inventory still fail their complete comparison.
const expected={...historical,documents:historical.documents.map(row=>row.ok?{...row,
  identity:row.identity.map(space=>({...space,
    catalogue:[...space.catalogue].sort(compareCodePoints),
    partitions:[...space.partitions].sort(compareCodePoints),
    rooms:[...space.rooms].sort((a,b)=>compareCodePoints(a.id,b.id)),
  })),
}:row)};
const compare=(actual,baseline)=>assert.deepEqual(actual,baseline,
  'wall corpus needs explicit current inventory/semantic passport review; full source membership is retained');

test('#845 complete persisted fixture/demo corpus retains baseline identities and byte idempotence',async t=>{
  const corpus=await loadCompleteWallIdentityCorpus();
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

// Extractor-only contract; no new passport acceptance or product normalization.
test('#845 graph change receipts are not configs; full sources and opaque fields remain',()=>{
  const config={model_version:11,spaces:[{id:'floor',rooms:[],opaque:{space_id:'keep',patch:{unknown:true}}}],
    markers:[{id:'opaque-id',unknown:['x','y']}],settings:{unknown:'keep'}};
  for(const version of[1,2]){
    const receipt={version,spaces:[{space_id:'floor',base_digest:'opaque-base',patch:{nodes:[],edges:[],rooms:[],dependencies:[]}}]};
    assert.deepEqual(extractCorpusConfigs(receipt,'receipt'),[]);
    const complete={...config,opaque:{graph_change:receipt}};
    assert.deepEqual(extractCorpusConfigs(complete,'complete'),[{label:'complete',input:complete}]);
    assert.deepEqual(extractCorpusConfigs({source:complete,graph_change:receipt,candidate:config},'fixture'),[
      {label:'fixture/source',input:complete},{label:'fixture/candidate',input:config},
    ]);
  }
});

test('#845 all 229 original full inputs remain immutable and distinct from modified current sources',async()=>{
  const original=JSON.parse(gunzipSync(readFileSync(new URL('../docs/testing/issue1226/repros/845-historical-inputs.json.gz',import.meta.url))));
  const historical=loadHistoricalWallIdentityCorpus(), current=await loadWallIdentityCorpus();
  assert.deepEqual(historical.entries.map(({label,input})=>({label,input})),original.records.map(({label,input})=>({label,input})), 'independent original archive bytes');
  const complete=await loadCompleteWallIdentityCorpus();
  assert.equal(historical.entries.length,229);
  for(const entry of original.records){
    const retained=complete.entries.find(row=>row.label===entry.label);
    assert.deepEqual(retained.input,entry.input,entry.label+': complete historical input');
    assert.equal(retained.fingerprint,entry.fingerprint);
    assert.equal(createHash('sha256').update(JSON.stringify(retained.input)).digest('hex'),entry.expected.fingerprint);
    assert.equal(retained.provenance[0].commit,entry.source.commit);
    assert.equal(retained.provenance[0].kind,'historical');
  }
  for(const entry of current.entries){
    const retained=complete.entries.find(row=>row.provenance.some(source=>source.kind==='current'&&source.label===entry.label));
    assert.ok(retained,entry.label+': current source stays selected');
    assert.deepEqual(retained.input,entry.input,entry.label+': complete current input');
  }
  assert.deepEqual(complete.inventory,current.inventory,'zero-config files stay inventoried');
  assert.deepEqual(complete.historicalInventory,expected.inventory,'all historical source files stay inventoried');
  assert.equal(new Set(complete.entries.map(row=>row.label)).size,complete.entries.length,'labels never alias changed inputs');
});