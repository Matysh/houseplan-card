import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = dirname(fileURLToPath(import.meta.url));
const digest = path => createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex');
const manifest = JSON.parse(readFileSync(resolve(root, 'MANIFEST.json')));
for (const file of manifest.files) {
  if (digest(file.path) !== file.sha256) throw Error(`Package hash mismatch: ${file.path}`);
}
const source = JSON.parse(readFileSync(resolve(root, 'SOURCE-MANIFEST.json')));
for (const copy of manifest.acceptedCopies) {
  const original = source.files.find(file => file.path === copy.sourcePath);
  if (!original || digest(copy.path) !== original.sha256) throw Error(`Accepted-source mismatch: ${copy.path}`);
}
console.log(`Verified ${manifest.files.length} package files and ${manifest.acceptedCopies.length} byte-identical accepted source files.`);
