// #811: the reviewed tree owns the index format; the dev snapshot still owns
// all Git operations and merge policy. Run only the generator, without its
// --commit-if-stale mode, on an exported, credential-free copy of the tree.
// Node permissions are a guard against accidental side effects, NOT a sandbox
// for hostile code. This entry point belongs to integration AFTER code review.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONVEYOR_IDENTITY } from './reviews-index.mjs';

const INDEX = 'docs/reviews/INDEX.md';
const GENERATOR = 'scripts/reviews-index.mjs';
const MAX_BYTES = 64 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

// The explicit cwd is the repository authority. Hooks may inherit GIT_DIR,
// GIT_WORK_TREE or GIT_INDEX_FILE; none may redirect reads/writes to a neighbour.
const localGitEnv = () => Object.fromEntries(Object.entries(process.env)
  .filter(([key]) => !/^GIT_/i.test(key)));

function checked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: MAX_BYTES, timeout: TIMEOUT_MS, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(`candidate reviews index: ${command} failed: ${result.error?.message || result.stderr || result.stdout}`);
  }
  return result.stdout;
}

/** Generate from committed HEAD, never from an untracked or modified script. */
export function candidateReviewsIndex({ cwd = process.cwd() } = {}) {
  const env = localGitEnv();
  const git = (...args) => checked('git', args, { cwd, env });
  const head = git('rev-parse', 'HEAD').trim();
  const entries = git('ls-tree', '-rz', head, '--', 'scripts', 'docs/reviews').split('\0').filter(Boolean);
  if (!entries.some((entry) => entry.endsWith(`\t${GENERATOR}`))) {
    throw new Error(`candidate reviews index: ${GENERATOR} missing from ${head}`);
  }
  // Permission paths follow symlinks: do not export any, including indirect
  // script dependencies. No submodules, special files, or .git in the copy.
  for (const entry of entries) {
    if (!/^100(?:644|755) blob [a-f0-9]+\t(?:scripts|docs\/reviews)\//.test(entry)) {
      throw new Error(`candidate reviews index: non-regular input: ${entry}`);
    }
  }
  const archive = checked('git', ['archive', '--format=tar', head, 'scripts', 'docs/reviews'], { cwd, env, encoding: null });
  const temp = mkdtempSync(join(tmpdir(), 'hp-candidate-index-'));
  try {
    checked('tar', ['-x', '-f', '-', '-C', temp], { input: archive });
    const output = join(temp, INDEX);
    const env = process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot } : {};
    const run = (extra = []) => checked(process.execPath, [
      '--permission', `--allow-fs-read=${temp}`, `--allow-fs-write=${output}`,
      join(temp, GENERATOR), '--dir=docs/reviews', ...extra,
    ], { cwd: temp, env, maxBuffer: 1024 * 1024 });
    run();
    if (!existsSync(output) || !lstatSync(output).isFile() || lstatSync(output).size > MAX_BYTES) {
      throw new Error('candidate reviews index: generator did not produce a bounded regular INDEX.md');
    }
    const markdown = readFileSync(output, 'utf8');
    run(['--check']);
    if (readFileSync(output, 'utf8') !== markdown) throw new Error('candidate reviews index: --check changed the output');
    if (git('rev-parse', 'HEAD').trim() !== head) throw new Error('candidate reviews index: HEAD moved during generation');
    return markdown;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/** Only the trusted controller may stage/commit the generated output. */
export function commitCandidateReviewsIndex({ cwd = process.cwd(), issue = '' } = {}) {
  const env = localGitEnv();
  const git = (...args) => checked('git', args, { cwd, env });
  // Never replace a caller's uncommitted file or include somebody else's index.
  if (git('status', '--porcelain', '--untracked-files=no').trim()) {
    throw new Error('candidate reviews index: tracked worktree must be clean');
  }
  const files = git('ls-tree', '-r', '--name-only', 'HEAD', '--', 'docs/reviews').trim();
  if (!files) return { changed: false, sha: null };
  const output = join(cwd, INDEX);
  if (existsSync(output) && !lstatSync(output).isFile()) throw new Error('candidate reviews index: output is not a regular file');
  if (existsSync(output) && !files.split('\n').includes(INDEX)) {
    throw new Error('candidate reviews index: refusing to replace an untracked INDEX.md');
  }
  const current = existsSync(output) ? readFileSync(output, 'utf8') : null;
  const head = git('rev-parse', 'HEAD').trim();
  const markdown = candidateReviewsIndex({ cwd });
  if (current === markdown) return { changed: false, sha: null };
  if (git('rev-parse', 'HEAD').trim() !== head || git('status', '--porcelain', '--untracked-files=no').trim()) {
    throw new Error('candidate reviews index: worktree changed during generation');
  }
  try {
    writeFileSync(output, markdown, 'utf8');
    git('add', '--', INDEX);
    const trailer = issue ? `\n\nIssue: #${issue}\nUser-Visible: no\n` : '\n\nUser-Visible: no\n';
    git(...CONVEYOR_IDENTITY, 'commit', '-q', '--only', '-m',
      `docs(reviews): индекс после сдвига каталога${issue ? ` (#${issue})` : ''}${trailer}`, '--', INDEX);
  } catch (error) {
    // A failed hook/commit must not leave our staged file behind. Do not
    // undo a concurrent HEAD move or replace another writer's new bytes.
    if (git('rev-parse', 'HEAD').trim() === head && existsSync(output)
      && readFileSync(output, 'utf8') === markdown) {
      git('reset', '-q', head, '--', INDEX);
      if (current === null) rmSync(output);
      else writeFileSync(output, current, 'utf8');
    }
    throw error;
  }
  return { changed: true, sha: git('rev-parse', 'HEAD').trim() };
}
