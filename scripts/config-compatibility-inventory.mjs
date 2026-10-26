#!/usr/bin/env node
// The bounded query is reproduced without depending on platform rg formatting.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPATIBILITY_BRANCHES, COMPATIBILITY_EXCLUSIONS } from './config-compatibility-catalog.mjs';
import { isMainModule } from './spawn-portable.mjs';

export const INVENTORY_QUERY = 'legacy|deprecated|compat|fallback for old';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

export function scanCompatibility(base = root) {
  const files = [];
  function visit(path, extension) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) visit(child, extension);
      else if (entry.isFile() && entry.name.endsWith(extension)) files.push(child);
    }
  }
  visit(resolve(base, 'src'), '.ts');
  visit(resolve(base, 'custom_components/houseplan'), '.py');
  const hits = [];
  for (const file of files.sort(order)) {
    const path = relative(base, file).replaceAll('\\', '/');
    const occurrences = new Map();
    for (const [index, raw] of readFileSync(file, 'utf8').split(/\r?\n/).entries()) {
      if (!new RegExp(INVENTORY_QUERY, 'i').test(raw)) continue;
      const text = raw.trim();
      const occurrence = (occurrences.get(text) || 0) + 1;
      occurrences.set(text, occurrence);
      hits.push({ id: hash(`${path}\0${text}\0${occurrence}`).slice(0, 24), path, line: index + 1, text, occurrence });
    }
  }
  return hits.sort((a, b) => order(a.path, b.path) || a.line - b.line);
}

export function matchesDigest(hits) { return hash(hits.map((item) => item.id).sort(order).join('\n')); }

export function checkInventory(hits, inventory) {
  const errors = [];
  if (inventory.schema !== 1 || inventory.query !== INVENTORY_QUERY) errors.push('invalid inventory schema/query');
  const ids = new Map(hits.map((item) => [item.id, item]));
  const seen = new Set();
  const branches = new Set(COMPATIBILITY_BRANCHES.map((item) => item.id));
  const exclusions = new Set(Object.keys(COMPATIBILITY_EXCLUSIONS));
  for (const item of inventory.hits || []) {
    if (seen.has(item.id)) errors.push(`duplicate inventory hit ${item.id}`);
    seen.add(item.id);
    const actual = ids.get(item.id);
    if (!actual) errors.push(`stale inventory hit ${item.path}:${item.line}`);
    else if (actual.path !== item.path || actual.text !== item.text || actual.occurrence !== item.occurrence) errors.push(`mismatched source hit ${item.id}`);
    if (!(item.kind === 'branch' && branches.has(item.owner) || item.kind === 'exclusion' && exclusions.has(item.owner))) errors.push(`unclassified hit ${item.id}`);
    if (!item.reason) errors.push(`missing disposition reason ${item.id}`);
  }
  for (const item of hits) if (!seen.has(item.id)) errors.push(`orphan source hit ${item.path}:${item.line}: ${item.text}`);
  if (inventory.matchesSha256 !== matchesDigest(hits)) errors.push('source match digest changed');
  return errors;
}

export function inventoryCoverage(inventory) {
  const counts = new Map();
  for (const item of inventory.hits) {
    const key = `${item.path}\0${item.kind}\0${item.owner}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].sort(([a], [b]) => order(a, b)).map(([key, count]) => {
    const [path, kind, owner] = key.split('\0');
    return { path, kind, owner, count };
  });
}

if (isMainModule(import.meta.url)) {
  const hits = scanCompatibility();
  if (process.argv.includes('--scan')) console.log(JSON.stringify(hits, null, 2));
  else {
    const inventory = JSON.parse(readFileSync(resolve(root, 'scripts/config-compatibility-inventory.json'), 'utf8'));
    const errors = checkInventory(hits, inventory);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log(`Config compatibility inventory: ${hits.length} individually classified hits; sha256:${matchesDigest(hits)}; PASS`);
  }
}
