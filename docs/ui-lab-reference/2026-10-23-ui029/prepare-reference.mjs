// Reproduce the published baseline; never rebuild it or replace a different dist.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
export const FINGERPRINT = 'ccc0f18f7f4a7aa1e5106e6db0ba6cc8add2ab84d5369edd7b8c88f9d6e12074';
export const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function prepareReference(repo) {
  const source = resolve(repo, 'custom_components/houseplan/frontend');
  const manifestBytes = readFileSync(resolve(source, 'houseplan-assets.json'));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.fingerprint !== FINGERPRINT) throw Error('Use the reference branch based on v1.83.0-beta.1, not a candidate checkout.');
  const files = manifest.files.map(entry => {
    if (!/^(?:houseplan-assets\/)?[\w.-]+\.js$/.test(entry.path)) throw Error('Unexpected manifest path');
    const bytes = readFileSync(resolve(source, entry.path));
    if (sha(bytes) !== entry.sha256) throw Error(`Corrupt baseline: ${entry.path}`);
    return { path: entry.path, bytes };
  });
  files.push({ path: 'houseplan-assets.json', bytes: manifestBytes });
  for (const file of files) {
    const target = resolve(repo, 'dist', file.path);
    if (existsSync(target) && sha(readFileSync(target)) !== sha(file.bytes)) {
      throw Error(`Different dist exists: ${file.path}. Use a separate reference clone; nothing was overwritten.`);
    }
  }
  for (const file of files) {
    const target = resolve(repo, 'dist', file.path);
    if (!existsSync(target)) { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, file.bytes, { flag: 'wx' }); }
  }
  return files.length;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { repo: { type: 'string' } } });
  console.log(`Verified published baseline: ${prepareReference(resolve(values.repo || DEFAULT_REPO))} files. No rebuild.`);
}
