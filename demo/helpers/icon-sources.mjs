import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Capture output and optional private labs are not fixture source. A local
// stale capture must not add icons absent from a clean CI checkout.
const GENERATED = new Set(['demo/srv/assets', 'demo/out', 'demo/ui-lab/.cache', 'demo/ui-lab/private',
  'demo/ui-lab/exports', 'demo/ui-lab/evidence']);

/** Shared by generation and preparation reuse; never includes generated assets. */
export function demoIconSourceFiles(root) {
  const files = [];
  const scan = (dir) => {
    if (!existsSync(resolve(root, dir))) return;
    for (const f of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      const name = `${dir}/${f.name}`;
      if (f.isDirectory()) { if (!GENERATED.has(name)) scan(name); continue; }
      if (f.isFile() && /\.(ts|json|html|mjs)$/.test(f.name)) files.push(name);
    }
  };
  scan('src'); scan('demo');
  return files.sort();
}
