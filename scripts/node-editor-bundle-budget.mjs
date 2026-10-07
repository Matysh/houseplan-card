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
const extra = [...seen].filter(path => !loaded.has(path));
const gzip = extra.reduce((sum, path) => sum + byPath.get(path).gzipBytes, 0);
assert.ok(gzip <= 14 * 1024, `${gzip} B gzip exceeds the new Select-only 14 KiB budget`);
console.log(`Select-only node graph: ${gzip} B gzip, budget ${14 * 1024}; existing bundle ceilings unchanged`);
