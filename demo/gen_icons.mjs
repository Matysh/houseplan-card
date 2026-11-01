// Generate demo/srv/assets/icons.js: an { "mdi:name": "<svg path>" } map for every
// mdi: icon referenced in src/ and demo/ (the demo host stubs <ha-icon> with it).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../scripts/spawn-portable.mjs';
import * as mdi from '@mdi/js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Capture output and optional private labs are not fixture source. A local
// stale capture must not add icons absent from a clean CI checkout.
const GENERATED = new Set(['demo/out', 'demo/ui-lab/.cache', 'demo/ui-lab/private',
  'demo/ui-lab/exports', 'demo/ui-lab/evidence']);

export function generateDemoIcons(root = ROOT) {
  const names = new Set();
  const scan = (dir) => {
    for (const f of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      const name = `${dir}/${f.name}`;
      if (f.isDirectory()) { if (!GENERATED.has(name)) scan(name); continue; }
      if (!f.isFile() || !/\.(ts|json|html|mjs)$/.test(f.name)) continue;
      const txt = readFileSync(resolve(root, name), 'utf8');
      for (const m of txt.matchAll(/mdi:([a-z0-9-]+)/g)) names.add(m[1]);
    }
  };
  scan('src'); scan('demo');
  const map = {};
  for (const n of [...names].sort()) {
    const camel = 'mdi' + n.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
    if (mdi[camel]) map['mdi:' + n] = mdi[camel];
  }
  const output = resolve(root, 'demo/srv/assets/icons.js');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, 'window.__ICONS=' + JSON.stringify(map) + ';\n');
  return { icons: Object.keys(map).length, references: names.size };
}

if (isMainModule(import.meta.url)) {
  const { icons, references } = generateDemoIcons();
  console.log('icons:', icons, 'of', references, 'referenced');
}
