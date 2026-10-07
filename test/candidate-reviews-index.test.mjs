// #811 AC5: accepted-tree generation is isolated; only the trusted controller commits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { candidateReviewsIndex, commitCandidateReviewsIndex } from '../scripts/candidate-reviews-index.mjs';

// A pre-push parent can export GIT_DIR/GIT_WORK_TREE; none may redirect these fixtures.
for (const key of Object.keys(process.env)) if (/^GIT_/i.test(key)) delete process.env[key];

const INDEX = 'docs/reviews/INDEX.md';
const GENERATOR = 'scripts/reviews-index.mjs';
const EXPECTED = 'accepted generator\nCODE-REVIEW-1-r1.md\n';

function generator({ before = '', check = '' } = {}) {
  return `import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
${before}
const output = 'docs/reviews/INDEX.md';
const text = 'accepted generator\\n' + readdirSync('docs/reviews').filter(n => n !== 'INDEX.md').sort().join('\\n') + '\\n';
if (process.argv.includes('--check')) {
  ${check}
  if (readFileSync(output, 'utf8') !== text) throw new Error('index mismatch');
} else writeFileSync(output, text);
`;
}

function fixture(t, { source = generator(), index = 'original index\n', withGenerator = true } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'hp-candidate-index-test-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();
  const write = (path, content) => writeFileSync(join(cwd, path), content);
  git('init', '-q');
  git('config', 'user.name', 'Untrusted local identity');
  git('config', 'user.email', 'local@example.test');
  git('config', 'core.hooksPath', join(cwd, 'disabled-hooks'));
  mkdirSync(join(cwd, 'scripts'), { recursive: true });
  mkdirSync(join(cwd, 'docs/reviews'), { recursive: true });
  if (withGenerator) write(GENERATOR, source);
  write('docs/reviews/CODE-REVIEW-1-r1.md', 'Verdict: green\n');
  if (index !== null) write(INDEX, index);
  write('notes.txt', 'tracked original\n');
  const commit = (message) => { git('add', '.'); git('commit', '-qm', message); };
  commit('accepted tree');
  const state = () => ({
    head: git('rev-parse', 'HEAD'),
    index: existsSync(join(cwd, INDEX)) ? readFileSync(join(cwd, INDEX), 'utf8') : null,
    status: git('status', '--porcelain'),
  });
  return { cwd, git, write, commit, state };
}

function refusesUnchanged(repo, pattern) {
  const before = repo.state();
  assert.throws(() => commitCandidateReviewsIndex({ cwd: repo.cwd, issue: 811 }), pattern);
  assert.deepEqual(repo.state(), before, 'refusal must preserve the original INDEX, HEAD and status');
}

test('#811 AC5: candidate selects committed generator/dependencies, ignoring dirty and untracked scripts', (t) => {
  const repo = fixture(t, { source: generator({ before: `
import { accepted } from './dependency.mjs';
if (accepted !== true || existsSync('scripts/untracked.mjs')) throw new Error('not the committed input');
` }) });
  repo.write('scripts/dependency.mjs', 'export const accepted = true;\n');
  repo.commit('accepted dependency');
  repo.write(GENERATOR, "throw new Error('dirty generator must not execute');\n");
  repo.write('scripts/dependency.mjs', 'export const accepted = false;\n');
  repo.write('scripts/untracked.mjs', "throw new Error('untracked dependency must not execute');\n");
  const before = repo.state();
  assert.equal(candidateReviewsIndex({ cwd: repo.cwd }), EXPECTED);
  assert.deepEqual(repo.state(), before, 'read-only generation leaves even dirty material untouched');
});

test('#811 AC5: candidate environment excludes secrets and NODE_OPTIONS', (t) => {
  const names = ['GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'HP811_SECRET', 'NODE_OPTIONS'];
  const repo = fixture(t, { source: generator({ before: `
const forbidden = ${JSON.stringify(names)};
if (forbidden.some(key => Object.hasOwn(process.env, key))) throw new Error('inherited secret or Node option');
if (Object.keys(process.env).some(key => key !== 'SystemRoot')) throw new Error('unexpected inherited environment');
` }) });
  const saved = new Map(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) process.env[name] = name === 'NODE_OPTIONS'
      ? '--require=/hp811-this-module-does-not-exist.cjs' : 'hp811-synthetic-secret';
    assert.equal(candidateReviewsIndex({ cwd: repo.cwd }), EXPECTED);
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('#811 AC5: inherited Git repository variables cannot redirect the accepted cwd', (t) => {
  const intended = fixture(t);
  const other = fixture(t, { source: generator().replace('accepted generator', 'other repository') });
  const before = [intended.state(), other.state()];
  const names = ['GIT_DIR', 'GIT_WORK_TREE'];
  const saved = new Map(names.map((name) => [name, process.env[name]]));
  let result;
  try {
    process.env.GIT_DIR = join(other.cwd, '.git');
    process.env.GIT_WORK_TREE = other.cwd;
    result = candidateReviewsIndex({ cwd: intended.cwd });
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
  assert.deepEqual([intended.state(), other.state()], before);
  assert.equal(result, EXPECTED, 'only HEAD of the explicit candidate cwd may supply the generator');
});

test('#811 AC5: child processes are denied before original INDEX or HEAD changes', (t) => {
  const repo = fixture(t, { source: generator({ before: `
import { spawnSync } from 'node:child_process';
spawnSync(process.execPath, ['-e', 'process.exit(0)']);
` }) });
  refusesUnchanged(repo, /ERR_ACCESS_DENIED/);
});

for (const operation of ['read', 'write']) test(`#811 AC5: outside filesystem ${operation} is denied`, (t) => {
  const repo = fixture(t);
  const sentinel = join(repo.cwd, 'outside-sentinel.txt');
  writeFileSync(sentinel, 'must remain intact\n');
  repo.write(GENERATOR, generator({ before: operation === 'read'
    ? `readFileSync(${JSON.stringify(sentinel)}, 'utf8');`
    : `writeFileSync(${JSON.stringify(sentinel)}, 'overwritten');` }));
  repo.commit(`accepted ${operation} probe`);
  refusesUnchanged(repo, /ERR_ACCESS_DENIED/);
  assert.equal(readFileSync(sentinel, 'utf8'), 'must remain intact\n');
});

test('#811 AC5: committed symlink input is refused even when the generator never imports it', (t) => {
  const repo = fixture(t);
  symlinkSync('../notes.txt', join(repo.cwd, 'scripts/indirect-input.mjs'));
  repo.commit('symlink dependency');
  refusesUnchanged(repo, /non-regular input/);
});

for (const untracked of [false, true]) test(`#811 AC5: ${untracked ? 'untracked-only' : 'missing'} generator cannot supply a candidate`, (t) => {
  const repo = fixture(t, { withGenerator: false });
  if (untracked) repo.write(GENERATOR, generator());
  refusesUnchanged(repo, /reviews-index\.mjs missing/);
});

for (const [name, source, error] of [
  ['generator exception', generator({ before: "throw new Error('generation failed');" }), /generation failed/],
  ['check failure', generator({ check: "throw new Error('independent check failed');" }), /independent check failed/],
  ['check rewrites output', generator({ check: "writeFileSync(output, text + 'changed by check'); process.exit(0);" }), /--check changed the output/],
]) test(`#811 AC5: ${name} leaves original INDEX and HEAD intact`, (t) => {
  const repo = fixture(t, { source });
  refusesUnchanged(repo, error);
});

test('#811 AC5: trusted controller commits only INDEX with its identity; second call is a no-op', (t) => {
  const repo = fixture(t);
  repo.write('untracked-user-file.txt', 'keep this file\n');
  const before = repo.state();
  const result = commitCandidateReviewsIndex({ cwd: repo.cwd, issue: 811 });
  assert.equal(result.changed, true);
  assert.equal(result.sha, repo.git('rev-parse', 'HEAD'));
  assert.equal(repo.git('rev-parse', 'HEAD^'), before.head);
  assert.equal(repo.state().index, EXPECTED);
  assert.deepEqual(repo.git('diff', '--name-only', 'HEAD^', 'HEAD').split('\n'), [INDEX]);
  const identity = 'claude[bot]|209825114+claude[bot]@users.noreply.github.com';
  assert.equal(repo.git('show', '-s', '--format=%an|%ae|%cn|%ce', 'HEAD'), `${identity}|${identity}`);
  assert.match(repo.git('show', '-s', '--format=%B', 'HEAD'), /Issue: #811\nUser-Visible: no$/);
  assert.equal(readFileSync(join(repo.cwd, 'untracked-user-file.txt'), 'utf8'), 'keep this file\n');
  const after = repo.state();
  assert.deepEqual(commitCandidateReviewsIndex({ cwd: repo.cwd, issue: 811 }), { changed: false, sha: null });
  assert.deepEqual(repo.state(), after, 'no-op must not add a commit or stage unrelated material');
});

for (const staged of [false, true]) test(`#811 AC5: ${staged ? 'staged' : 'unstaged'} tracked work refuses without replacing user changes`, (t) => {
  const repo = fixture(t);
  repo.write('notes.txt', 'user change\n');
  if (staged) repo.git('add', 'notes.txt');
  refusesUnchanged(repo, /tracked worktree must be clean/);
  assert.equal(readFileSync(join(repo.cwd, 'notes.txt'), 'utf8'), 'user change\n');
});

test('#811 AC5: untracked INDEX belongs to the caller and must never be overwritten', (t) => {
  const repo = fixture(t, { index: null });
  repo.write(INDEX, 'untracked user index\n');
  refusesUnchanged(repo, /untracked.*INDEX|INDEX.*untracked/i);
});

for (const index of ['original index\n', null]) test(`#811 AC5: failed commit restores ${index === null ? 'absent' : 'original'} INDEX and staging`, (t) => {
  const repo = fixture(t, { index });
  const hooks = join(repo.cwd, 'disabled-hooks');
  mkdirSync(hooks);
  const hook = join(hooks, 'pre-commit');
  writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  chmodSync(hook, 0o755);
  refusesUnchanged(repo, /git failed/);
  assert.equal(repo.git('diff', '--cached', '--name-only'), '', 'failed generated commit must leave no staged INDEX');
});
