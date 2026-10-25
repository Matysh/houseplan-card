import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rebaseRegenerating } from '../scripts/rebase-generated.mjs';
import { STATUS_COUNTER_PATH, STATUS_COUNTER_POLICY_PATHS, replaceStatusCounters, validateStatusCounters } from '../scripts/status-counter-equivalence.mjs';
import { statusCounterFixture } from './helpers/status-counter-fixture.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_AUTHOR_NAME: 'Counter fixture', GIT_AUTHOR_EMAIL: 'counter@example.invalid',
  GIT_COMMITTER_NAME: 'Counter fixture', GIT_COMMITTER_EMAIL: 'counter@example.invalid',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_COUNT: '2',
  GIT_CONFIG_KEY_0: 'core.autocrlf', GIT_CONFIG_VALUE_0: 'false',
  GIT_CONFIG_KEY_1: 'core.eol', GIT_CONFIG_VALUE_1: 'lf',
};
const git = (root, ...args) => execFileSync('git', args, {
  cwd: root, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000,
}).trim();
const put = (root, path, content) => {
  mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), content);
};
const commit = (root, message) => {
  git(root, 'add', '-A'); git(root, 'commit', '-qm', message); return git(root, 'rev-parse', 'HEAD');
};
const snapshot = count => replaceStatusCounters(statusCounterFixture(), { node: count, pure: 0, ha: 0, smokes: 0 });

function scenario(t, { sameIncrement = false, invalid = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hp-counter-rebase-'));
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q', '-b', 'dev');
  for (const path of STATUS_COUNTER_POLICY_PATHS) put(root, path, readFileSync(join(REPO, path), 'utf8').replace(/\r\n/g, '\n'));
  for (const dir of ['tests_backend', 'demo']) put(root, `${dir}/README.md`, 'Empty fixture inventory.\n');
  put(root, 'test/base.test.mjs', "test('base', () => {});\n");
  put(root, STATUS_COUNTER_PATH, snapshot(1));
  commit(root, 'base');
  git(root, 'checkout', '-qb', 'issue/1068-fixture');
  put(root, 'test/task.test.mjs', "test('task', () => {});\n");
  let taskText = snapshot(invalid === 'counter' ? 99 : 2);
  if (invalid === 'prose') taskText = taskText.replace('Handwritten state', 'Task handwritten state');
  if (invalid === 'version') taskText = taskText.replace('**1.0.0**', '**1.0.1**');
  if (invalid === 'format') taskText = taskText.replace('| Tests |', '| Test count |');
  if (invalid === 'generator') put(root, 'scripts/inventory.mjs', "throw Error('task generator must never execute');\n");
  put(root, STATUS_COUNTER_PATH, taskText);
  const before = commit(root, 'task');
  git(root, 'checkout', '-q', 'dev');
  put(root, 'test/upstream.test.mjs', "test('upstream', () => {});\n" + (sameIncrement ? '' : "test('second upstream', () => {});\n"));
  let upstreamText = snapshot(sameIncrement ? 2 : 3);
  if (invalid === 'prose') upstreamText = upstreamText.replace('Handwritten state', 'Upstream handwritten state');
  if (invalid === 'version') upstreamText = upstreamText.replace('**1.0.0**', '**1.0.2**');
  put(root, STATUS_COUNTER_PATH, upstreamText);
  commit(root, 'upstream');
  git(root, 'checkout', '-q', 'issue/1068-fixture');
  return { root, before };
}

test('#1068 real counter conflict rebases and counts the combined tree without executing task modules', t => {
  const { root } = scenario(t);
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV, refreshCi: false });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.stops, 1);
  assert.equal(readFileSync(join(root, STATUS_COUNTER_PATH), 'utf8'), snapshot(4));
  assert.equal(git(root, 'status', '--porcelain'), '');
  const checked = validateStatusCounters({ root, ref: git(root, 'rev-parse', 'HEAD') });
  assert.equal(checked.ok, true, checked.reason);
  assert.equal(checked.counts.node, 4);
  assert.equal(git(root, 'merge-base', 'HEAD', 'dev'), git(root, 'rev-parse', 'dev'));
});

test('#1068 equal increments merge cleanly and receive one counter-only correction commit', t => {
  const { root } = scenario(t, { sameIncrement: true });
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV, refreshCi: false });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.stops, 0);
  assert.equal(readFileSync(join(root, STATUS_COUNTER_PATH), 'utf8'), snapshot(3));
  assert.equal(git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'), STATUS_COUNTER_PATH);
  const head = git(root, 'rev-parse', 'HEAD');
  assert.equal(rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV, refreshCi: false }).ok, true);
  assert.equal(git(root, 'rev-parse', 'HEAD'), head, 'idempotent refresh');
});

test('#1068 author rebase entry preserves raw Git stage bytes for the same counter resolver', t => {
  const { root } = scenario(t);
  const entry = new URL('../scripts/rebase-on-dev.mjs', import.meta.url).href;
  execFileSync(process.execPath, ['--input-type=module', '-e',
    `import { rebaseOnDev } from ${JSON.stringify(entry)}; rebaseOnDev({ upstream: 'dev', fetch: false });`],
  { cwd: root, env: ENV, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(readFileSync(join(root, STATUS_COUNTER_PATH), 'utf8'), snapshot(4));
  assert.equal(git(root, 'status', '--porcelain'), '');
});

test('#1068 individually supported generator policies cannot be mixed across a rebase', t => {
  // The legacy source blobs remain reachable through the repository history.
  const legacy = ['19f51ce57b618120cfe13e3b826428009032c27d', 'dedd03ed752f74b4e81ad7ed809bfdacb466d82c'];
  let sources;
  try { sources = legacy.map(oid => git(REPO, 'cat-file', 'blob', oid) + '\n'); }
  catch { t.skip('historical generator blobs unavailable; no network fetch'); return; }
  const { root, before } = scenario(t);
  git(root, 'checkout', '-q', 'dev');
  for (const [index, path] of STATUS_COUNTER_POLICY_PATHS.slice(0, 2).entries())
    put(root, path, sources[index]);
  git(root, 'rm', '-q', '--', STATUS_COUNTER_POLICY_PATHS[2]);
  const upstream = commit(root, 'legacy supported generator');
  const verified = validateStatusCounters({ root, ref: upstream });
  assert.equal(verified.ok, true, verified.reason);
  git(root, 'checkout', '-q', 'issue/1068-fixture');
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV, refreshCi: false });
  assert.equal(result.ok, false, JSON.stringify(result));
  assert.deepEqual(result.manual, [STATUS_COUNTER_PATH]);
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
});

for (const invalid of ['counter', 'prose', 'version', 'format', 'generator']) {
  test(`#1068 ${invalid} conflict refuses automatic resolution and restores the task`, t => {
    const { root, before } = scenario(t, { invalid });
    put(root, 'local-note.txt', 'untracked owner data\n');
    const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV, refreshCi: false });
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.deepEqual(result.manual, [STATUS_COUNTER_PATH]);
    assert.equal(git(root, 'rev-parse', 'HEAD'), before);
    assert.equal(git(root, 'status', '--porcelain', '--untracked-files=no'), '');
    assert.equal(readFileSync(join(root, 'local-note.txt'), 'utf8'), 'untracked owner data\n');
  });
}

test('#1068 an unrelated clean rebase does not require a fresh historical status snapshot', t => {
  const { root } = scenario(t, { sameIncrement: true });
  // Both branches can carry an old informational snapshot. Ordinary clean
  // rebases keep working, but no counter-equivalence claim is made for it.
  put(root, STATUS_COUNTER_PATH, snapshot(90)); commit(root, 'stale informational snapshot');
  git(root, 'checkout', '-q', 'dev');
  put(root, STATUS_COUNTER_PATH, snapshot(90)); commit(root, 'same historical snapshot');
  git(root, 'checkout', '-q', 'issue/1068-fixture');
  // Squash fixture history so replay contains only the shared stale snapshot.
  git(root, 'reset', '--soft', git(root, 'merge-base', 'HEAD', 'dev'));
  commit(root, 'task with historical snapshot');
  const result = rebaseRegenerating({ onto: 'dev', cwd: root, env: ENV, refreshCi: false });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(readFileSync(join(root, STATUS_COUNTER_PATH), 'utf8'), snapshot(90));
});
