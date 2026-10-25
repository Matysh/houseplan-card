import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STATUS_COUNTER_BEGIN, STATUS_COUNTER_END, STATUS_COUNTER_PATH, STATUS_COUNTER_POLICY_PATHS,
  countStatusCounterEntries, normalizeStatusCounters, replaceStatusCounters, statusCounterInventory,
  validateStatusCounters, refreshStatusCounterText,
} from '../scripts/status-counter-equivalence.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const counts = { node: 2, pure: 1, ha: 1, smokes: 2 };
const snapshot = (values = counts) => [
  '# Status', '', STATUS_COUNTER_BEGIN, '| Item | State |', '|---|---|',
  '| Generated | 2026-10-25 — rerun `node scripts/status-snapshot.mjs` for the current tree |',
  '| Version | **1.83.0-beta.1** in all 7 version sources (`scripts/release-contract.mjs`) |',
  '| Latest stable tag | `v1.82.0` |',
  '| Latest prerelease tag | `v1.83.0-beta.1` |',
  '| Tests | Node unit ' + values.node + ' · pure backend ' + values.pure + ' · HA-harness backend ' + values.ha
    + ' · browser smokes ' + values.smokes + ' (`npm run inventory`) |',
  STATUS_COUNTER_END, '', 'Handwritten count 123 stays significant.', '',
].join('\n');
const git = (root, args, options = {}) => execFileSync('git', ['-C', root, ...args], {
  encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 10000, ...options,
  env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_NO_LAZY_FETCH: '1', GIT_ALLOW_PROTOCOL: '' },
}).trim();
const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text);
};
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-status-counter-'));
  assert.ok(root.startsWith(resolve(tmpdir()) + sep));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'Counter fixture']);
  git(root, ['config', 'user.email', 'counter@example.invalid']);
  git(root, ['config', 'core.autocrlf', 'false']);
  for (const path of STATUS_COUNTER_POLICY_PATHS)
    put(root, path, readFileSync(join(REPO, path), 'utf8').replace(/\r\n/g, '\n'));
  put(root, 'test/a.test.mjs', "throw Error('must never execute fixture code');\ntest('one', () => {});\n  it('two', () => {});\n");
  put(root, 'test/nested/not-counted.test.mjs', "test('nested', () => {});\n");
  put(root, 'tests_backend/test_pure.py', 'class Group:\n  def test_one(self): pass\n');
  put(root, 'tests_backend/test_ha_a.py', 'async def test_ha(): pass\n');
  put(root, 'demo/smoke_a.mjs', "throw Error('browser must not start');\n");
  put(root, 'demo/smoke_b.mjs', '');
  put(root, STATUS_COUNTER_PATH, snapshot());
  commit(root);
  return root;
}
const commit = root => { git(root, ['add', '-A']); git(root, ['commit', '-qm', 'fixture']); return git(root, ['rev-parse', 'HEAD']); };

test('#1068 canonical counter normalization changes only four digits, preserving prose and line endings', () => {
  for (const ending of ['\n', '\r\n']) {
    const text = snapshot().replaceAll('\n', ending);
    const expected = snapshot({ node: 0, pure: 0, ha: 0, smokes: 0 }).replaceAll('\n', ending);
    assert.equal(normalizeStatusCounters(text), expected);
    assert.equal(replaceStatusCounters(text, counts), text);
    for (const [before, after] of [['2026-10-25', '2026-10-24'], ['1.83.0-beta.1', '1.83.0-beta.2'],
      ['123 stays', '124 stays'], ['# Status', '# Changed status']])
      assert.notEqual(normalizeStatusCounters(text.replace(before, after)), expected);
  }
});

test('#1068 unknown block/row structures and unsafe numbers never receive normalization', () => {
  const text = snapshot();
  const invalid = [
    text.replace(STATUS_COUNTER_BEGIN, '<!-- generated -->'),
    text.replace(STATUS_COUNTER_END, ''),
    text + STATUS_COUNTER_BEGIN + '\n' + STATUS_COUNTER_END,
    text.replace('| Tests |', '| Test count |'),
    text.replace('Node unit 2', 'Node unit 02'),
    text.replace('Node unit 2', 'Node unit -1'),
    text.replace('Node unit 2', 'Node unit 9007199254740992'),
    text.replace('Node unit 2', 'Node unit 2.0'),
    text.replace('| Tests |', '| Extra | 0 |\n| Tests |'),
    text.replace('|---|---|', '|---|'),
    text.replace('2026-10-25', '2026-02-31'),
    text.replace('version sources', 'version mirrors'),
  ];
  for (const value of invalid) assert.throws(() => normalizeStatusCounters(value), /status counters:/);
  assert.throws(() => replaceStatusCounters(text, { ...counts, extra: 1 }), /replacement/);
});

test('#1068 trusted counting matches original direct-file rules, without executing modules', () => {
  const files = new Map([
    ['test/.test.mjs', "test('a', () => {});\n  it('b', () => {});\n"],
    ['test/nested/a.test.mjs', "test('not counted', () => {});\n"],
    ['tests_backend/test_.py', '  def test_a(): pass\n'],
    ['tests_backend/test_ha_.py', 'async def test_a(): pass\n'],
    ['demo/smoke_.mjs', "throw Error('not executed or read');"],
  ]);
  const result = countStatusCounterEntries({ paths: [...files.keys()], read: path => {
    assert.ok(!path.startsWith('demo/')); return files.get(path);
  } });
  assert.deepEqual(result, { node: 2, pure: 1, ha: 1, smokes: 1 });
});

test('#1068 immutable validation ignores dirty/untracked worktree data and rejects forged or stale counters', t => {
  const root = fixture(t), material = git(root, ['rev-parse', 'HEAD']);
  const valid = validateStatusCounters({ root, ref: material });
  assert.equal(valid.ok, true, valid.reason); assert.deepEqual(valid.counts, counts);
  assert.match(valid.policy, /^[a-f0-9]{64}$/);
  put(root, 'test/a.test.mjs', "test('dirty', () => {});\n");
  put(root, 'test/untracked.test.mjs', "test('extra', () => {});\n");
  put(root, STATUS_COUNTER_PATH, snapshot({ ...counts, node: 999 }));
  assert.deepEqual(validateStatusCounters({ root, ref: material }), valid, 'immutable blobs, not checkout bytes');
  const forged = commit(root);
  assert.equal(validateStatusCounters({ root, ref: forged }).ok, false);
  git(root, ['checkout', '-q', '--detach', material]);
  put(root, 'test/new.test.mjs', "test('new', () => {});\n"); commit(root);
  const stale = validateStatusCounters({ root, ref: 'HEAD' });
  assert.equal(stale.ok, false); assert.match(stale.reason, /do not match immutable inputs/);
});

test('#1068 unsupported generator data cannot execute or authorize normalization', t => {
  const root = fixture(t), initial = git(root, ['rev-parse', 'HEAD']);
  for (const path of STATUS_COUNTER_POLICY_PATHS) {
    git(root, ['checkout', '-q', '--detach', initial]);
    put(root, path, "throw Error('candidate generator must not execute');\n");
    commit(root);
    const result = validateStatusCounters({ root, ref: 'HEAD' });
    assert.equal(result.ok, false); assert.match(result.reason, /unsupported generator sources/);
  }
});

test('#1068 inherited Git repository/index variables cannot redirect immutable or combined-tree reads', t => {
  const root = fixture(t), foreign = fixture(t);
  put(foreign, 'test/a.test.mjs', "test('foreign', () => {});\n");
  put(foreign, STATUS_COUNTER_PATH, snapshot({ ...counts, node: 1 })); commit(foreign);
  const names = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'], before = names.map(name => process.env[name]);
  try {
    process.env.GIT_DIR = join(foreign, '.git'); process.env.GIT_WORK_TREE = foreign;
    process.env.GIT_INDEX_FILE = join(foreign, '.git', 'index');
    const result = validateStatusCounters({ root, ref: 'HEAD' });
    assert.equal(result.ok, true, result.reason); assert.deepEqual(result.counts, counts);
    assert.equal(refreshStatusCounterText({ root, text: snapshot() }).text, snapshot());
  } finally {
    names.forEach((name, i) => { if (before[i] === undefined) delete process.env[name]; else process.env[name] = before[i]; });
  }
});

test('#1068 immutable symbolic inputs, missing snapshots and exhausted read budgets refuse', t => {
  const root = fixture(t), initial = git(root, ['rev-parse', 'HEAD']);
  for (const path of [STATUS_COUNTER_PATH, 'test/a.test.mjs', 'demo/smoke_a.mjs']) {
    git(root, ['checkout', '-q', '--detach', initial]);
    const oid = git(root, ['rev-parse', 'HEAD:' + path]);
    git(root, ['update-index', '--cacheinfo', '120000,' + oid + ',' + path]);
    git(root, ['commit', '-qm', 'symbolic mode fixture']);
    const result = validateStatusCounters({ root, ref: 'HEAD' });
    assert.equal(result.ok, false); assert.match(result.reason, /nonregular/);
  }
  git(root, ['checkout', '-q', '--detach', initial]);
  git(root, ['rm', '-qr', 'demo']);
  put(root, STATUS_COUNTER_PATH, snapshot({ ...counts, smokes: 0 })); commit(root);
  assert.match(validateStatusCounters({ root, ref: 'HEAD' }).reason, /missing counter input directory/);
  git(root, ['checkout', '-q', '--detach', initial]);
  git(root, ['rm', '-q', STATUS_COUNTER_PATH]); git(root, ['commit', '-qm', 'missing snapshot']);
  assert.equal(validateStatusCounters({ root, ref: 'HEAD' }).ok, false);
  assert.match(validateStatusCounters({ root, ref: initial, deadline: Date.now() - 1 }).reason, /deadline/);
  assert.equal(validateStatusCounters({ root, ref: '--all' }).ok, false);
});

test('#1068 combined worktree refresh changes counters only and refuses untracked/mismatched generator inputs', t => {
  const root = fixture(t), text = snapshot(), normalized = normalizeStatusCounters(text);
  assert.deepEqual(statusCounterInventory(root).map(row => row.count), [2, 1, 1, 2]);
  assert.equal(refreshStatusCounterText({ root, text }).text, text);
  put(root, 'test/a.test.mjs', "test('one', () => {});\nit('two', () => {});\ntest('third', () => {});\n");
  assert.throws(() => refreshStatusCounterText({ root, text: normalized }), /modified counter input/);
  git(root, ['add', 'test/a.test.mjs']);
  const result = refreshStatusCounterText({ root, text: normalized });
  assert.deepEqual(result.counts, { ...counts, node: 3 });
  assert.equal(result.text, snapshot({ ...counts, node: 3 }));
  put(root, 'test/untracked.test.mjs', "test('untracked', () => {});\n");
  assert.throws(() => refreshStatusCounterText({ root, text }), /untracked counter input/);
  git(root, ['add', 'test/untracked.test.mjs']);
  assert.equal(refreshStatusCounterText({ root, text }).counts.node, 4);
  put(root, 'scripts/inventory.mjs', 'throw Error("not a trusted counter generator");\n');
  assert.throws(() => refreshStatusCounterText({ root, text }), /modified generator source/);
});

const historical = ['9995a8339265754a72fdb0e566f7d3001d73305f', '13f5eeb1ade97103e2f72eb2fe49e3617fe612f9',
  'e39a4d87f4dea6b75ead080094ac69c23ce2e902', '085af2f78790e20f215732243de5b74207c92fd5'];
const historyAvailable = historical.every(ref => {
  try { git(REPO, ['cat-file', '-e', ref + '^{commit}']); return true; } catch { return false; }
});
test('#1068 real #1063 original/rebased material and bases authenticate their exact counter rows',
  { skip: historyAvailable ? false : 'optional original force-pushed Git objects absent; synthetic immutable fixtures remain mandatory' }, () => {
    const results = historical.map(ref => validateStatusCounters({ root: REPO, ref }));
    for (const result of results) assert.equal(result.ok, true, result.reason);
    assert.deepEqual(results.map(value => value.counts.node), [5390, 5392, 5391, 5393]);
    assert.deepEqual(results.map(value => value.counts.ha), [554, 554, 555, 555]);
    assert.equal(new Set(results.map(value => value.policy)).size, 1);
    assert.equal(results[1].normalized, results[3].normalized);
  });
