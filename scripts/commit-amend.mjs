#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, constants, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export const AMEND_CONTEXT = 'HP_COMMIT_AMEND_CONTEXT';
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const root = () => realpathSync(git(['rev-parse', '--show-toplevel']));
const tree = () => git(['write-tree']);
const parents = () => git(['show', '-s', '--format=%P', 'HEAD']);

// This is a short-lived local invocation contract, not authority to bypass Git
// hooks or a security boundary against an author who controls their own repo.
// Only the wrapper emits it; it never attempts to infer native --amend from
// COMMIT_EDITMSG, editor metadata, reused messages or the parent process.
export function consumeAmendBase(messageFile, path = process.env[AMEND_CONTEXT]) {
  if (!path) return null;
  const snapshot = JSON.parse(readFileSync(path, 'utf8'));
  unlinkSync(path); // one use: a nested/new commit cannot inherit this mode
  if (Object.keys(snapshot).sort().join(',') !== 'head,parents,root,tree,version'
    || snapshot.version !== 1 || snapshot.root !== root()
    || snapshot.head !== git(['rev-parse', 'HEAD']) || snapshot.parents !== parents()) {
    throw new Error('amend context does not match this repository/HEAD');
  }
  if (realpathSync(messageFile) !== realpathSync(git(['rev-parse', '--git-path', 'COMMIT_EDITMSG']))) {
    throw new Error('amend context requires Git COMMIT_EDITMSG');
  }
  if (snapshot.tree !== tree()) throw new Error('amend index changed; inspect/stage it and retry');
  if (snapshot.parents.includes(' ')) throw new Error('amending merge commits is not supported');
  // Materialize the empty tree for the root-commit case; no ref is changed.
  return snapshot.parents || execFileSync('git', ['hash-object', '-w', '-t', 'tree', '--stdin'], {
    input: '', encoding: 'utf8',
  }).trim();
}

export function amend(argv) {
  // Deliberately narrow: no pathspecs, -a/-i/-o, editor, reuse source, no-verify
  // or negated options that could turn this into a different Git operation.
  if (argv.length !== 1 || argv[0] !== '--no-edit') {
    throw new Error('usage: npm run commit:amend -- --no-edit (stage changes first)');
  }
  if (process.env[AMEND_CONTEXT]) throw new Error('nested/stale amend context is not allowed');
  const repoRoot = root();
  if (git(['config', '--get', 'core.hooksPath']) !== '.githooks') {
    throw new Error('commit:amend requires core.hooksPath=.githooks; run npm run prepare');
  }
  accessSync(join(repoRoot, '.githooks/commit-msg'), constants.R_OK | constants.X_OK);
  const snapshot = { version: 1, root: repoRoot, head: git(['rev-parse', 'HEAD']), parents: parents(), tree: tree() };
  if (snapshot.parents.includes(' ')) throw new Error('amending merge commits is not supported');
  const directory = mkdtempSync(join(git(['rev-parse', '--absolute-git-dir']), 'hp-amend-'));
  const contextFile = join(directory, 'context.json');
  try {
    writeFileSync(contextFile, JSON.stringify(snapshot), { mode: 0o600, flag: 'wx' });
    const result = spawnSync('git', ['commit', '--amend', '--no-edit'], {
      stdio: 'inherit', env: { ...process.env, [AMEND_CONTEXT]: contextFile },
    });
    if (result.error) throw result.error;
    if (result.status !== 0) return result.status || 1;
    // A disabled/replaced hook is an error, never silently successful evidence.
    try { accessSync(contextFile); }
    catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
    throw new Error('commit-msg did not consume the amend context; inspect the resulting HEAD');
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
}

if (isMainModule(import.meta.url)) {
  try { process.exitCode = amend(process.argv.slice(2)); }
  catch (error) { console.error(`House Plan amend: ${error.message}`); process.exitCode = 1; }
}
