/**
 * Byte-level comparison of two directory trees: the installer uses it to
 * decide whether a from-source build reproduces the committed bundle
 * (scripts/install-houseplan.mjs, houseplan-card#1010).
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** sha256 of every file under a directory, by relative path. */
export function treeDigest(dir) {
  const out = {};
  const walk = (sub) => {
    for (const name of readdirSync(join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${name.name}` : name.name;
      if (name.isDirectory()) walk(rel);
      else out[rel] = createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex');
    }
  };
  if (existsSync(dir)) walk('');
  return out;
}

export const sameTree = (a, b) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
};

