// Generate demo/srv/assets/icons.js: an { "mdi:name": "<svg path>" } map for every
// mdi: icon referenced in src/ and demo/ (the demo host stubs <ha-icon> with it).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../scripts/spawn-portable.mjs';
import { demoIconSourceFiles } from './helpers/icon-sources.mjs';
import * as mdi from '@mdi/js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export { demoIconSourceFiles };

export function generateDemoIcons(root = ROOT) {
  const names = new Set();
  for (const file of demoIconSourceFiles(root)) {
    const txt = readFileSync(resolve(root, file), 'utf8');
    for (const m of txt.matchAll(/mdi:([a-z0-9-]+)/g)) names.add(m[1]);
  }
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
