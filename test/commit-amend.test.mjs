import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateHistoricalCommit } from '../scripts/validate-commit-provenance.mjs';
import { AMEND_CONTEXT, consumeAmendBase } from '../scripts/commit-amend.mjs';
import { portableCommand } from '../scripts/spawn-portable.mjs';

const source = fileURLToPath(new URL('..', import.meta.url));
const message = 'Product change\n\nIssue: #923\nUser-Visible: yes';
function fixture(t, { rootCommit = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hp-923-amend-'));
  t.after(() => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const env = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(GIT_|HP_COMMIT_AMEND_)/i.test(key))),
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  };
  const run = (command, args, extraEnv = {}) => spawnSync(portableCommand(command).cmd, args, {
    cwd: root, env: { ...env, ...extraEnv }, encoding: 'utf8', shell: portableCommand(command).shell,
  });
  const git = (...args) => run('git', args);
  const ok = result => { assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  ok(git('init', '-q', '-b', 'dev'));
  ok(git('config', 'maintenance.auto', 'false'));
  ok(git('config', 'gc.auto', '0'));
  mkdirSync(join(root, '.githooks'));
  copyFileSync(join(source, '.githooks/commit-msg'), join(root, '.githooks/commit-msg'));
  chmodSync(join(root, '.githooks/commit-msg'), 0o755);
  mkdirSync(join(root, 'scripts'));
  for (const name of readdirSync(join(source, 'scripts')).filter(name => name.endsWith('.mjs'))) {
    copyFileSync(join(source, 'scripts', name), join(root, 'scripts', name));
  }
  writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module', scripts: {
    'commit:amend': 'node scripts/commit-amend.mjs',
  } }));
  ok(git('add', '.'));
  ok(git('update-index', '--chmod=+x', '.githooks/commit-msg'));
  if (!rootCommit) ok(git('commit', '-q', '-m', 'Tooling base\n\nIssue: #923\nUser-Visible: no'));
  ok(git('config', 'core.hooksPath', '.githooks'));
  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, 'src'));
  writeFileSync(join(root, 'docs/CHANGELOG.md'), 'Feature\n');
  writeFileSync(join(root, 'docs/CHANGELOG.ru.md'), 'Изменение\n');
  const stage = (value = '2') => {
    writeFileSync(join(root, 'src/a.ts'), `export const a = ${value};\n`);
    ok(git('add', '.'));
  };
  stage('1');
  ok(git('commit', '-q', '-m', message));
  const head = () => ok(git('rev-parse', 'HEAD'));
  const amend = (...args) => run(process.execPath, ['scripts/commit-amend.mjs', ...args]);
  return { root, env, run, git, ok, stage, head, amend };
}

test('#923: real hook accepts complete amended delta, not an unrelated new commit reusing its message', t => {
  const f = fixture(t);
  const parent = f.ok(f.git('rev-parse', 'HEAD^'));
  const previous = f.head();
  f.stage();
  const refused = f.git('commit', '--amend', '--no-edit');
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /user-visible commit must update docs\/CHANGELOG/);
  assert.equal(f.head(), previous);
  f.ok(f.amend('--no-edit'));
  assert.notEqual(f.head(), previous);
  assert.equal(f.ok(f.git('rev-parse', 'HEAD^')), parent, 'amend replaces, rather than appends');
  const files = f.ok(f.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')).split('\n');
  assert.deepEqual(validateHistoricalCommit(f.head(), message, files), [], 'actual final commit has both changelogs');
  f.stage('3');
  const beforeNew = f.head();
  for (const args of [['-C', 'HEAD'], ['-m', message]]) {
    const newCommit = f.git('commit', ...args);
    assert.notEqual(newCommit.status, 0);
    assert.match(newCommit.stderr, /user-visible commit must update docs\/CHANGELOG/);
    assert.equal(f.head(), beforeNew);
  }
  assert.match(validateHistoricalCommit('a'.repeat(40), message, ['src/a.ts']).join('\n'), /CHANGELOG/);
});

test('#923: actual npm command amends a root commit using the empty-tree base', t => {
  const f = fixture(t, { rootCommit: true });
  f.stage();
  const result = f.run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'commit:amend', '--', '--no-edit']);
  f.ok(result);
  assert.equal(f.ok(f.git('rev-list', '--count', 'HEAD')), '1');
});

test('#923: wrapper refuses option injection and missing hook without moving HEAD', t => {
  const f = fixture(t);
  f.stage();
  const before = f.head();
  for (const args of [['--no-verify'], ['--no-edit', '--no-amend'], ['-C', 'HEAD'], ['--only', 'src/a.ts']]) {
    assert.notEqual(f.amend(...args).status, 0, args.join(' '));
    assert.equal(f.head(), before);
  }
  f.ok(f.git('config', 'core.hooksPath', '.other-hooks'));
  assert.match(f.amend('--no-edit').stderr, /core.hooksPath/);
  assert.equal(f.head(), before);
});

test('#923: deleting an inherited changelog is still rejected and temporary context is cleaned', t => {
  const f = fixture(t);
  const before = f.head();
  f.ok(f.git('rm', 'docs/CHANGELOG.ru.md'));
  const result = f.amend('--no-edit');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must update docs\/CHANGELOG.ru.md/);
  assert.equal(f.head(), before);
  // The next ordinary commit cannot inherit the wrapper capability.
  assert.match(f.git('commit', '-C', 'HEAD').stderr, /must update docs\/CHANGELOG.md/);
  assert.deepEqual(readdirSync(join(f.root, '.git')).filter(name => name.startsWith('hp-amend-')), []);
});

test('#923: pre-commit index changes invalidate the pinned context before commit creation', t => {
  const f = fixture(t);
  f.stage();
  const before = f.head();
  writeFileSync(join(f.root, '.githooks/pre-commit'), '#!/bin/sh\nprintf changed > hook-extra\ngit add hook-extra\n');
  chmodSync(join(f.root, '.githooks/pre-commit'), 0o755);
  const result = f.amend('--no-edit');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /index changed/);
  assert.equal(f.head(), before);
  assert.ok(existsSync(join(f.root, 'hook-extra')), 'does not discard the hook edits');
  assert.deepEqual(readdirSync(join(f.root, '.git')).filter(name => name.startsWith('hp-amend-')), []);
});

test('#923: stale repository/HEAD/index contexts and a reused context fail closed', t => {
  const f = fixture(t);
  f.stage();
  const before = f.head();
  const snapshot = { version: 1, root: f.root, head: before,
    parents: f.ok(f.git('show', '-s', '--format=%P', 'HEAD')), tree: f.ok(f.git('write-tree')) };
  const context = join(f.root, '.git/negative-context.json');
  for (const patch of [{ head: 'a'.repeat(40) }, { root: join(f.root, 'other') },
    { tree: 'b'.repeat(40) }, { parents: 'c'.repeat(40) }, { version: 2 }, { extra: true }]) {
    writeFileSync(context, JSON.stringify({ ...snapshot, ...patch }));
    const refused = f.run('git', ['commit', '--amend', '--no-edit'], { [AMEND_CONTEXT]: context });
    assert.notEqual(refused.status, 0, JSON.stringify(patch));
    assert.equal(f.head(), before);
    assert.equal(existsSync(context), false, 'even rejected valid JSON is consumed once');
  }
  writeFileSync(context, JSON.stringify(snapshot));
  f.ok(f.run('git', ['commit', '--amend', '--no-edit'], { [AMEND_CONTEXT]: context }));
  f.stage('3');
  const after = f.head();
  const reused = f.run('git', ['commit', '-C', 'HEAD'], { [AMEND_CONTEXT]: context });
  assert.notEqual(reused.status, 0);
  assert.match(reused.stderr, /ENOENT/);
  assert.equal(f.head(), after);
  assert.equal(consumeAmendBase('not-a-message', ''), null, 'no context means ordinary mode');
});
