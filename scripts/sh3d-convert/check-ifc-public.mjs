#!/usr/bin/env node
/** Explicit local diagnostic of pinned public exports; never fetches input. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { platform, release, cpus } from 'node:os';
import assert from 'node:assert/strict';
import { convertIfc } from './ifc.mjs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const samples=[{name:'AC20-FZK-Haus.ifc',sha256:'70cc8ff245fc0894201d96496c031005a5cbd7a96b22d8a1b87c5a883fb77994',counts:{floor:2,wall:13,room:7,door:5,window:11}},
 {name:'duplex.ifc',sha256:'b347a2c8aa8fff6db896a4417a9c50c22ac0ccd7c5cfc22b99b8d29336c606ed',counts:{floor:4,wall:57,room:21,door:14,window:24}}];
if(process.argv[2]==='--one') {
 const sample=samples.find(s=>s.name===process.argv[3]);assert.ok(sample);
 const bytes=new Uint8Array(readFileSync(resolve(process.argv[4],sample.name)));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),sample.sha256);
 const start=performance.now(),result=await convertIfc(bytes,{now:'1970-01-01T00:00:00Z'}),elapsedMs=performance.now()-start;
 assert.deepEqual(result.report.sourceCounts,sample.counts);assert.ok(result.documents.length>0);
 assert.ok(result.report.outcomes.transferred.wall>0);assert.ok(result.report.outcomes.transferred.room>0);
 assert.ok(result.report.entities.every(e=>['transferred','partial','skipped'].includes(e.outcome)));
 console.log(JSON.stringify({file:sample.name,sha256:sample.sha256,inputBytes:bytes.length,elapsedMs,
   peakNodeRssBytes:process.resourceUsage().maxRSS*1024,report:result.report}));
} else {
 const dir=process.argv[2];if(!dir)throw Error('Usage: check-ifc-public.mjs <local-sample-directory> [report.json]');
 const rows=samples.map(sample=>{
  const child=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--one',sample.name,resolve(dir)],{encoding:'utf8',maxBuffer:16*1024*1024});
  if(child.status!==0)throw Error(child.stderr||child.stdout);return JSON.parse(child.stdout);
 });
 const html=readFileSync(new URL('./dist/index.html',import.meta.url));
 const report={environment:{platform:platform(),release:release(),cpu:cpus()[0].model,node:process.version},html:{rawBytes:html.length,gzipBytes:gzipSync(html).length},samples:rows};
 if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({environment:report.environment,html:report.html,samples:rows.map(r=>({file:r.file,elapsedMs:r.elapsedMs,peakNodeRssBytes:r.peakNodeRssBytes,
  wasmLinearBytes:r.report.measurements.wasmLinearBytes,outcomes:r.report.outcomes}))},null,2));
}
