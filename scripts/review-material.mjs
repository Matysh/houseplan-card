#!/usr/bin/env node
// #957: retain original Git objects, never substitute a rebased tree or verdict.
import { execFileSync } from 'node:child_process';
import { isMainModule } from './spawn-portable.mjs';

const HEX = /^[0-9a-f]{40}$/;
const PREFIX = 'refs/heads/review-material/';
const git = args => execFileSync('git', args, {
  encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
}).trim();

export function reviewMaterialRef(tree) {
  if (!HEX.test(tree || '')) throw Error('SPEC material needs an exact tree SHA');
  return `${PREFIX}spec-${tree}`;
}

function remoteRefs(pattern, run) {
  const raw = run(['ls-remote', 'origin', pattern]).trim();
  if (!raw) return [];
  return raw.split('\n').map(line => {
    const [sha, ref, extra] = line.trim().split(/\s+/);
    if (!HEX.test(sha) || !ref?.startsWith(PREFIX) || extra
      || (!pattern.endsWith('*') && ref !== pattern)) throw Error('Malformed retained-material ref');
    return { sha, ref };
  });
}

function fetchRef({ sha, ref }, tree, run) {
  const local = ref.replace('refs/heads/', 'refs/remotes/origin/');
  run(['fetch', '--no-tags', '--no-recurse-submodules', 'origin', `${ref}:${local}`]);
  // Check the live advertised commit, not a stale local ref or another tree
  // incidentally included in the fetched history. A ref name is not proof.
  if (run(['cat-file', '-t', sha]).trim() !== 'commit'
    || run(['rev-parse', `${sha}^{tree}`]).trim() !== tree
    || run(['rev-parse', local]).trim() !== sha)
    throw Error('Retained-material ref does not match the exact SPEC tree');
  return sha;
}

/** Called with sealed prepare outputs BEFORE publishing the SPEC document. */
export function retainReviewMaterial({ sha, tree, gitRunner = git, pushRemote = 'origin' }) {
  const ref = reviewMaterialRef(tree);
  if (!HEX.test(sha || '')) throw Error('SPEC material needs an exact commit SHA');
  if (gitRunner(['cat-file', '-t', sha]).trim() !== 'commit'
    || gitRunner(['rev-parse', `${sha}^{tree}`]).trim() !== tree)
    throw Error('SPEC material commit/tree mismatch');
  try {
    const existing = remoteRefs(ref, gitRunner);
    if (existing.length) { fetchRef(existing[0], tree, gitRunner); return ref; }
    try {
      // Create-only CAS: never move an existing public retention ref, even by
      // fast-forward. Concurrent publication of the same tree is idempotent.
      gitRunner(['push', '-q', `--force-with-lease=${ref}:`, pushRemote, `${sha}:${ref}`]);
    } catch {
      const raced = remoteRefs(ref, gitRunner);
      if (raced.length !== 1) throw Error('SPEC material ref was not published');
      fetchRef(raced[0], tree, gitRunner);
    }
    const published = remoteRefs(ref, gitRunner);
    if (published.length !== 1) throw Error('SPEC material ref was not published');
    fetchRef(published[0], tree, gitRunner);
    return ref;
  } catch {
    // The writer may use a credential-bearing push URL. Never echo git's raw
    // exception/argv; no retention failure permits the SPEC publication.
    throw Error(`Could not retain SPEC material ${tree} at ${ref}; publication must stop`);
  }
}

/** Object-only hydration; it neither accepts a SPEC nor changes task history. */
export function reviewMaterialTreeType(tree, gitRunner) {
  const ref = reviewMaterialRef(tree);
  try { return gitRunner(['cat-file', '-t', tree]).trim(); } catch { /* fresh object store */ }
  try {
    const exact = remoteRefs(ref, gitRunner);
    if (exact.length) fetchRef(exact[0], tree, gitRunner);
    else {
      // Historical #931/#946 were rescued under differently named refs. Only
      // live origin refs with this exact root tree qualify, never local orphans.
      const legacy = remoteRefs(`${PREFIX}*`, gitRunner);
      if (!legacy.length) throw Error('No retained SPEC material');
      gitRunner(['fetch', '--no-tags', '--no-recurse-submodules', 'origin',
        `${PREFIX}*:refs/remotes/origin/review-material/*`]);
      if (!legacy.some(({ sha }) => gitRunner(['cat-file', '-t', sha]).trim() === 'commit'
        && gitRunner(['rev-parse', `${sha}^{tree}`]).trim() === tree))
        throw Error('No retained commit matches the SPEC tree');
    }
    const type = gitRunner(['cat-file', '-t', tree]).trim();
    if (type !== 'tree') throw Error('SPEC material is not a tree');
    return type;
  } catch {
    throw Error(`SPEC material tree ${tree} is unavailable from origin review-material refs; exact objects required`);
  }
}

if (isMainModule(import.meta.url)) {
  try {
    const value = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
    if (process.argv[2] !== 'retain') throw Error('usage: review-material.mjs retain --sha=<commit> --tree=<tree>');
    console.log(retainReviewMaterial({ sha: value('sha'), tree: value('tree'),
      pushRemote: process.env.REVIEW_MATERIAL_PUSH_URL || 'origin' }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
