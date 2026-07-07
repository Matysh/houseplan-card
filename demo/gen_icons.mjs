// Generate demo/srv/assets/icons.js: an { "mdi:name": "<svg path>" } map for every
// mdi: icon referenced in src/ and demo/ (the demo host stubs <ha-icon> with it).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import * as mdi from '@mdi/js';

const names = new Set();
const scan = (dir) => {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isDirectory()) { scan(`${dir}/${f.name}`); continue; }
    if (!/\.(ts|json|html|mjs)$/.test(f.name) || f.name === 'icons.js') continue;
    const txt = readFileSync(`${dir}/${f.name}`, 'utf8');
    for (const m of txt.matchAll(/mdi:([a-z0-9-]+)/g)) names.add(m[1]);
  }
};
scan('src'); scan('demo');
const map = {};
for (const n of [...names].sort()) {
  const camel = 'mdi' + n.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  if (mdi[camel]) map['mdi:' + n] = mdi[camel];
}
writeFileSync('demo/srv/assets/icons.js', 'window.__ICONS=' + JSON.stringify(map) + ';\n');
console.log('icons:', Object.keys(map).length, 'of', names.size, 'referenced');
