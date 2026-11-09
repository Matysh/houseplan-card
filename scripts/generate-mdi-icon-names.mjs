// Canonical names come from the same pinned MDI release as the SVG paths.
import { readFileSync, writeFileSync } from 'node:fs';
const meta = JSON.parse(readFileSync(new URL('../node_modules/@mdi/svg/meta.json', import.meta.url)));
const names = meta.map(icon => icon.name).sort();
const target = new URL('../src/mdi-icon-names.json', import.meta.url);
const text = JSON.stringify(names) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== text) throw Error('Regenerate MDI names with node scripts/generate-mdi-icon-names.mjs');
} else writeFileSync(target, text);
console.log('MDI canonical names: ' + names.length);
