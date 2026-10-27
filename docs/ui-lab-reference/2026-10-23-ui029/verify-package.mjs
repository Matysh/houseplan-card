import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = dirname(fileURLToPath(import.meta.url));
const read = file => readFileSync(resolve(root, file));
const digest = file => createHash('sha256').update(read(file)).digest('hex');
const manifest = JSON.parse(read('MANIFEST.json'));
for (const file of manifest.files) if (digest(file.path) !== file.sha256) throw Error(`Package mismatch: ${file.path}`);
const source = JSON.parse(read('SOURCE-VERIFICATION.json'));
for (const name of manifest.acceptedFiles) {
  if (digest(`accepted/${name}`) !== source.files[name]) throw Error(`Accepted-source mismatch: ${name}`);
}
const css = read('accepted/houseplan-card.css').toString('utf8');
if (read('runtime/overrides/houseplan-card.css').toString('utf8') !== css.slice(css.indexOf('/* UI-029 accepted (#998):'))) throw Error('CSS excerpt mismatch');
const journal = read('JOURNAL-CYCLE.md').toString('utf8');
const start = journal.indexOf('### UI-029 '), end = journal.indexOf('### UI-030 ', start);
if (read('JOURNAL-UI029.md').toString('utf8') !== journal.slice(start, end)) throw Error('Journal excerpt mismatch');
console.log(`Verified ${manifest.files.length} package files, ${manifest.acceptedFiles.length} unchanged accepted sources, CSS and journal excerpts.`);
