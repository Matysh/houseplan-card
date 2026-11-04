import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {commitWallSegmentModel,decodeLegacyWallSegmentModel} from '../test-build/wall-segment-model.js';
import {identityProjection,loadWallIdentityCorpus,loadCompleteWallIdentityCorpus,loadHistoricalWallIdentityCorpus,withCorpusIds,extractCorpusConfigs,corpusPassport,fullConfigSha256}
  from './helpers/wall-identity-corpus.mjs';

const historical=JSON.parse(readFileSync(new URL('./fixtures/845-wall-corpus-identities.json',import.meta.url),'utf8'));
// #1290: reviewed current migration coordinate deltas are documented in
// docs/testing/beta5-wall-passports; the frozen v10 source/oracle stays separate.
const expected=JSON.parse(readFileSync(new URL('./fixtures/845-wall-corpus-current-identities.json',import.meta.url),'utf8'));
const compare=(actual,baseline)=>assert.deepEqual(actual,baseline,
  'wall corpus current identities/outcomes differ; full source membership and the original legacy oracle are retained');

const promotionFixture=JSON.parse(readFileSync(new URL('./fixtures/room-host-promotion.json',import.meta.url),'utf8'));
for(const [suffix,input] of [['previous',promotionFixture.previous],['message/config',promotionFixture.message.config]])
test('#1281 room-host promotion corpus passport preserves the complete stored '+suffix,()=>{
  const row=expected.documents.find(row=>row.label==='test/fixtures/room-host-promotion.json/'+suffix);
  assert.equal(input.model_version,11);
  assert.deepEqual(row,{label:'test/fixtures/room-host-promotion.json/'+suffix,
    fingerprint:createHash('sha256').update(JSON.stringify(input)).digest('hex'),ok:true,
    identity:identityProjection(input),fullConfigSha256:fullConfigSha256(input)});
  const frozen=structuredClone(input);
  assert.deepEqual(commitWallSegmentModel(input).config,frozen,'the independent persisted document is the entire expected output');
  assert.deepEqual(input,frozen);
});

test('#845 complete persisted fixture/demo corpus retains baseline identities and byte idempotence',async t=>{
  const corpus=await loadCompleteWallIdentityCorpus(),documents=[],guardFailures=[];
  const reached={inputs:0,readOnly:0,successfulMigrations:0,declines:0,unexpectedErrors:0,
    idempotence:0,readOnlyRereads:0,storedAtomSets:0,roomIdSets:0,orderedRoomCycles:0,failedChecks:0};
  for(const {label,input} of corpus.entries){
    try{withCorpusIds(()=>{
    reached.inputs++;
    const frozen=structuredClone(input),failures=[];
    const check=(name,assertion)=>{
      try{assertion();}catch(error){reached.failedChecks++;failures.push(new Error(label+': '+name,{cause:error}));}
    };
    let first,error;
    try{first=commitWallSegmentModel(input).config;}catch(caught){error=caught;}
    // A refusal must not mutate the source either. Never let an earlier
    // membership/identity difference prevent this guard from running.
    reached.readOnly++;check('read-only source',()=>assert.deepEqual(input,frozen));
    const fingerprint=createHash('sha256').update(JSON.stringify(frozen)).digest('hex');
    if(error){
      if(error.reason){reached.declines++;documents.push({label,fingerprint,ok:false,reason:error.reason});}
      else{
        reached.unexpectedErrors++;documents.push({label,fingerprint,unexpectedError:String(error)});
        check('unexpected migration exception',()=>{throw error;});
      }
    }else{
      reached.successfulMigrations++;
      documents.push({label,fingerprint,ok:true,identity:structuredClone(identityProjection(first)),fullConfigSha256:fullConfigSha256(first)});
      const firstFrozen=structuredClone(first),firstBytes=JSON.stringify(firstFrozen);
      reached.idempotence++;check('byte idempotence',()=>
        assert.equal(JSON.stringify(commitWallSegmentModel(first).config),firstBytes));
      reached.readOnlyRereads++;check('read-only successful re-read',()=>assert.deepEqual(first,firstFrozen));
      if(Number(frozen.model_version)>=10)for(const old of frozen.spaces||[]){
        // Complete v10 documents preserve each stored atom, not merely reference validity.
        if((old.wall_segments||[]).length&&(old.rooms||[]).every(r=>r.poly?.length===r.wall_ids?.length)){
          const current=firstFrozen.spaces.find(s=>s.id===old.id);
          reached.storedAtomSets++;check('stored atom IDs in '+old.id,()=>{
            assert.ok(current,'the stored space survives');
            const ids=rows=>rows.reduce((counts,wall)=>counts.set(wall.id,(counts.get(wall.id)||0)+1),new Map());
            assert.deepEqual(ids(current.wall_segments),ids(old.wall_segments));
          });
          reached.roomIdSets++;check('complete room ID multiset in '+old.id,()=>{
            const ids=rows=>rows.reduce((counts,room)=>counts.set(room.id,(counts.get(room.id)||0)+1),new Map());
            assert.deepEqual(ids(current?.rooms||[]),ids(old.rooms||[]));
          });
          const currentRooms=new Map((current?.rooms||[]).map(room=>[room.id,room]));
          for(const room of old.rooms||[]){
            reached.orderedRoomCycles++;check('ordered cycle of room '+room.id,()=>{
              assert.ok(currentRooms.has(room.id),'the same room ID survives canonical table ordering');
              assert.deepEqual(currentRooms.get(room.id).wall_ids,room.wall_ids);
            });
          }
        }
      }
    }
    guardFailures.push(...failures);
    });}catch(error){reached.failedChecks++;guardFailures.push(error);}
  }
  t.diagnostic('wall corpus guards reached: '+JSON.stringify(reached));
  t.diagnostic('wall corpus: '+corpus.entries.length+' documents from '+corpus.inventory.length+' files; '
    +corpus.inventory.filter(f=>!f.configs).length+' non-config sources explicitly inventoried');
  assert.equal(reached.inputs,corpus.entries.length,'every selected full input reaches its guard');
  assert.equal(reached.readOnly,reached.inputs,'successful and refused sources both reach immutability checks');
  assert.equal(reached.successfulMigrations+reached.declines+reached.unexpectedErrors,reached.inputs);
  assert.equal(reached.roomIdSets,reached.storedAtomSets,'every stored-atom space also checks the complete room ID multiset');
  assert.equal(reached.idempotence,reached.successfulMigrations,'every successful migration reaches byte idempotence');
  assert.equal(reached.readOnlyRereads,reached.successfulMigrations,'every successful re-read reaches source immutability');
  assert.equal(guardFailures.length,0,guardFailures.map(f=>f.message+': '+String(f.cause)).join('\n'));
  // Outcome comparison is deliberately LAST: the retained #478 positive and
  // any identity differences must never turn executable invariants into dead code.
  compare({schema:1,baseline:historical.baseline,inventory:corpus.inventory,documents},expected);
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
  const opaque=structuredClone(before);opaque.settings.futureOpaque={keep:['one','two'],value:1.0000000001};
  const retained=structuredClone(opaque);delete retained.settings.futureOpaque;
  assert.deepEqual(identityProjection(retained),identityProjection(opaque),'opaque loss does not change identity IDs');
  assert.throws(()=>compare(
    {identity:identityProjection(retained),fullConfigSha256:fullConfigSha256(retained)},
    {identity:identityProjection(opaque),fullConfigSha256:fullConfigSha256(opaque)}),
  'complete config hash detects unknown metadata loss at unchanged IDs');
  const keyReordered=Object.fromEntries(Object.entries(opaque).reverse());
  assert.equal(fullConfigSha256(keyReordered),fullConfigSha256(opaque),'only object key order is ignored');
  const arrayChanged=structuredClone(opaque);arrayChanged.settings.futureOpaque.keep.reverse();
  assert.notEqual(fullConfigSha256(arrayChanged),fullConfigSha256(opaque),'array order is never canonicalized');
  const numberChanged=structuredClone(opaque);numberChanged.settings.futureOpaque.value=1;
  assert.notEqual(fullConfigSha256(numberChanged),fullConfigSha256(opaque),'numeric precision is never normalized');
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
  assert.deepEqual(complete.historicalInventory,historical.inventory,'all historical source files stay inventoried');
  assert.equal(new Set(complete.entries.map(row=>row.label)).size,complete.entries.length,'labels never alias changed inputs');
});
test('#845 frozen compatibility preserves all original229 rows without reordering expectations',()=>{
  const corpus=loadHistoricalWallIdentityCorpus(),source=structuredClone(corpus);
  assert.deepEqual(corpusPassport(decodeLegacyWallSegmentModel,corpus),historical);
  assert.deepEqual(corpus,source,'all full historical inputs and provenance remain immutable');
});
