// Explicit #1226 model11 receipt port. Default verifies, --write is a deliberate
// fixture edit and is never invoked by CI. The runtime test first proves every
// room/write/Undo/Redo and compares complete raw inputs to the retained v10
// Python adapter receipt; no current result can silently update this passport.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const hash=value=>createHash('sha256').update(value).digest('hex');
const base='cb1431ea65055b5d327e574c4fe2d567ba0a0d52';
const legacy='test/fixtures/1166-room-candidates.json';
assert.equal(hash(readFileSync(legacy)),hash(execFileSync('git',['show',`${base}:${legacy}`])),'retained legacy passport is immutable');
mkdirSync('output/issue1226',{recursive:true});
const full='output/issue1226/1166-current-full.json';
execFileSync(process.execPath,['--test','--test-name-pattern=#1166 both public contours','--test-reporter=junit','--test-reporter-destination=output/issue1226/1166-generation.xml','test/geometry-history-refusal.test.mjs'],{env:{...process.env,HP_1166_ROOM_RECEIPT:full}});
const rows=JSON.parse(readFileSync(full,'utf8'));
const expected={base,legacySha256:hash(readFileSync(legacy)),encoding:'SHA256 of UTF-8 JSON.stringify(complete stableRoomReceipt row); collection order and every graph/reference/metadata field included',rows:rows.map(row=>hash(JSON.stringify(row)))};
const target='test/fixtures/1166-room-graph-passports.json';
if(process.argv.includes('--write'))writeFileSync(target,JSON.stringify(expected,null,2)+'\n');
else assert.deepEqual(JSON.parse(readFileSync(target,'utf8')),expected);
console.log(`Verified ${rows.length} complete runtime graph receipts; full review JSON: ${full}`);
