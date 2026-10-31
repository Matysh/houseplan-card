// #803: additional Select-only code has its own budget; existing graphs keep
// their ceilings. Count shared loaded files once, not again as new traffic.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const root = manifest.files.find(f => /\/wall-node-card-adapter-[^/]+\.js$/.test(f.path));
assert.ok(root, 'Select-only node controller chunk exists');
const loaded = new Set([...manifest.initialViewFiles, ...manifest.lazyEditorFiles]);
assert.equal(loaded.has(root.path), false, 'node controller is not eager in View or other editors');
const byPath = new Map(manifest.files.map(f => [f.path, f])), seen = new Set();
const visit = path => { if (seen.has(path)) return; seen.add(path); for (const child of byPath.get(path).imports) visit(child); };
visit(root.path);
assert.equal([...seen].some(path => /\/houseplan-editor-runtime-[^/]+\.js$/.test(path)), false,
  'Select-only leaves must not import the editor runtime facade');
const extra = [...seen].filter(path => !loaded.has(path));
// #834: the cache implementation belongs to the Select-only graph, not the
// shared wrappers used by View. These retained runtime counters identify the
// implementation even after Rollup/Terser rename its class and local symbols.
const cacheMarker = /\bhits:\s*0,\s*misses:\s*0,\s*stored:\s*0\b/;
const hasBaselineCache = path => cacheMarker.test(readFileSync(`dist/${path}`, 'utf8'));
assert.equal([...loaded].some(hasBaselineCache), false, 'editor boolean baseline cache is not eager in View or other editors');
assert.equal(extra.some(hasBaselineCache), true, 'the Select-only graph owns its bounded boolean baseline cache');
const gzip = extra.reduce((sum, path) => sum + byPath.get(path).gzipBytes, 0);
// #834: exact local boundary, ownership and winding proofs replace repeated
// clipping. The owner permits an explicit ceiling increase, not byte golfing.
// This is still a hard Select-only cap; View/editor ceilings remain unchanged.
// #898, owner decision 2026-10-14: less than 10 % headroom -> +10 %, 18432 -> 20276 B.
// #1045: approved small byte increase to the measured Delete graph, no headroom.
// #1075 rebased onto accepted dev (2026-10-26) measures 21462 B. The same
// owner permission adds only the observed 4 B, without reserve or other changes.
// #1166: the stable-only build keeps the same Select sources and isolated graph.
// Shared geometry chunk/import allocation changes its gzip from 21444 to 21494 B.
// Record only that measured candidate, without spare capacity or byte golfing.
const budget = 21_494;
assert.ok(gzip <= budget, `${gzip} B gzip exceeds the Select-only ${budget} B budget`);
console.log(`Select-only node graph: ${gzip} B gzip, budget ${budget}; existing bundle ceilings unchanged`);
