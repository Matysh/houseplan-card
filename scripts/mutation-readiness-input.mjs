// Read-only identities for changed static readiness. No mutation execution.
import { spawnSync } from 'node:child_process';
import { MUTATION_REGISTRY_FILES } from './mutation-selection.mjs';

export function freezeMutationRange(requested, root, git = (args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' })) {
  const refs = requested.split('..');
  if (refs.length !== 2 || refs.some((ref) => !ref)) throw new Error('immutable --changed requires base..material');
  const commit = (ref) => git(['rev-parse', '--verify', ref + '^{commit}']);
  const base = commit(refs[0]), material = commit(refs[1]), checkout = commit('HEAD');
  if ([base, material, checkout].some((result) => result.status !== 0))
    throw new Error(`immutable --changed base/material could not be read: ${requested}`);
  const sha = material.stdout.trim();
  if (sha !== checkout.stdout.trim()) throw new Error('checkout is not the requested immutable material');
  if (git(['diff', '--quiet', sha, '--', ...MUTATION_REGISTRY_FILES]).status !== 0)
    throw new Error('registry differs from immutable material; commit it or use full --check');
  if (git(['diff', '--quiet', sha, '--']).status !== 0)
    throw new Error('tracked inputs differ from immutable material; commit them or use full --check');
  return { range: base.stdout.trim() + '..' + sha, materialSha: sha };
}

export function materialReader(sha, root) {
  return (file) => {
    const result = spawnSync('git', ['-C', root, 'show', sha + ':' + file], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    return result.status === 0 ? result.stdout : null;
  };
}
