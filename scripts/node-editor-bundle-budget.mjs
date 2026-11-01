// #803: retain the Select-only graph boundaries. Count shared loaded files once.
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
// #1196: PROCESS measures release growth against the latest stable; module
// sizes are diagnostic. Keep the behavioral graph/ownership assertions above.
console.log(`Select-only node graph: ${gzip} B gzip (diagnostic; no absolute module-size gate)`);
