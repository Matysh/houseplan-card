// Shared byte inventory with no compiler/test-partition dependency.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
export function artifactTree(directory) {
  if (!existsSync(directory) || lstatSync(directory).isSymbolicLink()) throw Error('missing/unsafe artifact tree');
  const rows = [];
  const walk = (dir, prefix = '') => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name), rel = prefix + name, stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw Error('artifact symlink refused');
      if (stat.isDirectory()) walk(path, rel + '/');
      else if (stat.isFile()) rows.push([rel, stat.size, createHash('sha256').update(readFileSync(path)).digest('hex')]);
      else throw Error('non-file artifact refused');
      if (rows.length > 10000) throw Error('artifact inventory oversized');
    }
  };
  walk(directory);
  if (!rows.length) throw Error('empty producer artifact');
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
