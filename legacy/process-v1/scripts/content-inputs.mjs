// #954: content identity is separate from the Git identity of its consumer.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { inputsOf } from './check-inputs.mjs';

export function inputReader(root, ref = null) {
  if (ref !== null && !/^[a-f0-9]{40}$/.test(ref)) throw Error('invalid input source SHA');
  const git = args => execFileSync('git', ['-C', root, ...args], { maxBuffer: 64 * 1024 * 1024 });
  const tracked = git(ref ? ['ls-tree', '-r', '--name-only', ref] : ['ls-files', '--cached', '--others', '--exclude-standard'])
    .toString().trim().split('\n').filter(Boolean);
  const symbolic = new Set(ref ? git(['ls-tree', '-r', ref]).toString().split('\n')
    .filter(row => row.startsWith('120000 ')).map(row => row.split('\t').slice(1).join('\t')) : []);
  const cache = new Map();
  const read = p => {
    if (symbolic.has(p) || !ref && lstatSync(join(root, p)).isSymbolicLink()) throw Error(`symbolic input refused: ${p}`);
    if (!cache.has(p)) cache.set(p, ref ? git(['show', `${ref}:${p}`]) : readFileSync(join(root, p)));
    return cache.get(p);
  };
  return { tracked: [...new Set(tracked)], read, text: p => read(p).toString('utf8') };
}

export function contentInputKey(root, check, { ref = null, environment = {}, extra = [], select = null } = {}) {
  const reader = inputReader(root, ref);
  const files = [...new Set([...(select ? select(reader) : inputsOf(check, root, { tracked: reader.tracked, read: reader.text })), ...extra])].sort();
  if (!files.length) throw Error('empty content inputs');
  const hash = createHash('sha256').update(`content-inputs-v1:${check}\0`).update(JSON.stringify(environment));
  for (const path of files) {
    const raw = reader.read(path);
    hash.update(path + '\0').update(raw.includes(0) ? raw : Buffer.from(raw.toString('utf8').replace(/\r\n?/g, '\n'))).update('\0');
  }
  return hash.digest('hex');
}
