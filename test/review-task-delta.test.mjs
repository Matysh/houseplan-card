import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { counterOnlyTaskRebase, registryInventoryReviewDelta, reviewTaskDelta } from '../scripts/review-task-delta.mjs';
import { STATUS_COUNTER_BEGIN, STATUS_COUNTER_END, STATUS_COUNTER_POLICY_PATHS } from '../scripts/status-counter-equivalence.mjs';
import { anchorRebaseCertificateFrom, reviewDocumentDigest, reusableCounterGreenVerdict } from '../scripts/review-doc-guard.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const snapshot = n => [STATUS_COUNTER_BEGIN, '| Item | State |', '|---|---|',
  '| Generated | 2026-10-25 — rerun `node scripts/status-snapshot.mjs` for the current tree |',
  '| Version | **1.83.0-beta.2** in all 7 version sources (`scripts/release-contract.mjs`) |',
  '| Latest stable tag | `v1.82.0` |', '| Latest prerelease tag | `v1.83.0-beta.2` |',
  `| Tests | Node unit ${n} · pure backend 0 · HA-harness backend 0 · browser smokes 0 (\`npm run inventory\`) |`,
  STATUS_COUNTER_END, '', 'Human status text stays significant.', ''].join('\n');
function fixture(t, { baseSource = 'export const value = 1;\n', taskSource = 'export const value = 2;\n',
  statusText = '', taskStatusText = statusText } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hp-review-delta-test-'));
  assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'user.name=t', '-c', 'user.email=t@x', ...args],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const put = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  const commit = () => { git('add', '-A'); git('commit', '-qm', 'fixture'); return git('rev-parse', 'HEAD'); };
  git('init', '-q'); git('config', 'core.autocrlf', 'false');
  for (const path of STATUS_COUNTER_POLICY_PATHS) put(path, readFileSync(join(REPO, path), 'utf8').replace(/\r\n/g, '\n'));
  for (const path of ['test/.keep', 'tests_backend/.keep', 'demo/.keep']) put(path, 'fixture\n');
  put('docs/STATUS.md', snapshot(0) + statusText); put('src/fixture.mjs', baseSource);
  const oldBase = commit();
  const task = () => { put('test/task.test.mjs', "test('task', () => {});\n"); put('src/fixture.mjs', taskSource); };
  task(); put('docs/STATUS.md', snapshot(1) + taskStatusText); const oldMaterial = commit();
  git('checkout', '-q', '--detach', oldBase);
  put('test/upstream.test.mjs', "test('upstream', () => {});\n");
  put('test/fixtures/upstream.json', '{"realRuntimeInput":true}\n');
  put('docs/STATUS.md', snapshot(1) + statusText); const newBase = commit();
  task(); put('docs/STATUS.md', snapshot(2) + taskStatusText); const newMaterial = commit();
  return { root, git, put, commit, oldBase, oldMaterial, newBase, newMaterial,
    old: () => reviewTaskDelta({ root, base: oldBase, material: oldMaterial }),
    current: () => reviewTaskDelta({ root, base: newBase, material: 'HEAD' }) };
}

test('#1068 task delta survives only verified counter drift while accepted upstream fixtures stay in the candidate', t => {
  const f = fixture(t), before = f.old(), after = f.current();
  assert.notEqual(before.raw_delta, after.raw_delta);
  assert.equal(before.normalized_delta, after.normalized_delta);
  assert.equal(counterOnlyTaskRebase(before, after), true);
  assert.equal(f.git('show', `${after.material}:test/fixtures/upstream.json`), '{"realRuntimeInput":true}');
  assert.notEqual(before.tree, after.tree, 'review equivalence never claims equal CI inputs');
});

test('#1068 semantic task edits, whitespace, prose and version changes cannot hide behind counter normalization', t => {
  const f = fixture(t), before = f.old();
  for (const [path, text] of [
    ['src/fixture.mjs', 'export const value = 3;\n'],
    ['src/fixture.mjs', 'export const value =  2;\n'],
    ['docs/STATUS.md', snapshot(2).replace('Human status', 'Changed status')],
    ['docs/STATUS.md', snapshot(2).replaceAll('1.83.0-beta.2', '1.83.0-beta.3')],
    ['docs/CHANGELOG.md', 'Unreviewed release notes\n'],
    ['scripts/monolith-baseline.json', '{"unreviewed":true}\n'],
  ]) {
    f.git('checkout', '-q', '--detach', f.newMaterial); f.put(path, text); f.commit();
    assert.equal(counterOnlyTaskRebase(before, f.current()), false, path + ': ' + text);
  }
});

test('#1068 forged counts, changed generator, STATUS deletion and symlink fail closed', t => {
  const f = fixture(t);
  for (const [path, text] of [
    ['docs/STATUS.md', snapshot(999)], ['scripts/inventory.mjs', '// changed generator\n'],
  ]) {
    f.git('checkout', '-q', '--detach', f.newMaterial); f.put(path, text); f.commit();
    assert.throws(f.current, /Unverified STATUS counters/);
  }
  f.git('checkout', '-q', '--detach', f.newMaterial); f.git('rm', '-q', 'docs/STATUS.md'); f.commit();
  assert.throws(f.current, /Unverified STATUS counters/);
  f.git('checkout', '-q', '--detach', f.newMaterial);
  const oid = f.git('rev-parse', 'HEAD:docs/STATUS.md');
  f.git('update-index', '--cacheinfo', `120000,${oid},docs/STATUS.md`); f.git('commit', '-qm', 'bad mode');
  assert.throws(f.current, /Unverified STATUS counters/);
});

test('#1068 unchanged raw task delta and changed generator policy do not gain a general manual-rebase exception', () => {
  const source = { base: 'old', policy: 'policy', normalized_delta: 'norm', raw_delta: 'raw' };
  assert.equal(counterOnlyTaskRebase(source, { ...source, base: 'new' }), false);
  assert.equal(counterOnlyTaskRebase(source, { ...source, base: 'new', raw_delta: 'other', policy: 'new' }), false);
  assert.equal(counterOnlyTaskRebase(source, { ...source, raw_delta: 'other' }), false);
});

test('#1068 immutable delta reads ignore inherited Git repository, index and object-store redirects', t => {
  const f = fixture(t), expected = f.old();
  const values = { GIT_DIR: join(f.root, 'absent.git'), GIT_INDEX_FILE: join(f.root, 'foreign-index'),
    GIT_OBJECT_DIRECTORY: join(f.root, 'absent-objects') };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, values);
    assert.deepEqual(f.old(), expected);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('#1068 equal edit bytes cannot relocate between functions or between duplicate blocks inside one function', t => {
  const cases = [
    'export function alpha() {\n  const value = 1;\n  return value;\n}\n\nexport function beta() {\n  const value = 1;\n  return value;\n}\n',
    'export function choose(branch) {\n  if (branch === 1) {\n    const value = 1;\n    return value;\n  }\n  if (branch === 2) {\n    const value = 1;\n    return value;\n  }\n}\n',
  ];
  for (const baseSource of cases) {
    const taskSource = baseSource.replace('const value = 1', 'const value = 2');
    const second = baseSource.lastIndexOf('const value = 1');
    const relocated = baseSource.slice(0, second) + baseSource.slice(second).replace('const value = 1', 'const value = 2');
    const f = fixture(t, { baseSource, taskSource }), reviewed = f.old();
    assert.equal(counterOnlyTaskRebase(reviewed, f.current()), true, 'same location with counter drift stays reusable');
    f.put('src/fixture.mjs', relocated); f.commit();
    const current = f.current();
    assert.notEqual(reviewed.normalized_delta, current.normalized_delta, 'location is bound to both full file identities');
    assert.equal(counterOnlyTaskRebase(reviewed, current), false);
  }
});

test('#1068 handwritten STATUS edits retain location identity after counter normalization', t => {
  const statusText = '## First workflow\nEnabled: no\n\n## Second workflow\nEnabled: no\n';
  const taskStatusText = statusText.replace('Enabled: no', 'Enabled: yes');
  const f = fixture(t, { statusText, taskStatusText }), reviewed = f.old();
  assert.equal(counterOnlyTaskRebase(reviewed, f.current()), true);
  const second = statusText.lastIndexOf('Enabled: no');
  f.put('docs/STATUS.md', snapshot(2) + statusText.slice(0, second) + statusText.slice(second).replace('Enabled: no', 'Enabled: yes'));
  f.commit();
  assert.equal(counterOnlyTaskRebase(reviewed, f.current()), false);
});

test('#1068 upstream edits inside a task-touched ordinary file conservatively require fresh review', t => {
  const f = fixture(t), reviewed = f.old();
  f.git('checkout', '-q', '--detach', f.newBase);
  f.put('src/fixture.mjs', '// accepted upstream context\nexport const value = 1;\n');
  const base = f.commit();
  f.put('src/fixture.mjs', '// accepted upstream context\nexport const value = 2;\n');
  f.put('test/task.test.mjs', "test('task', () => {});\n"); f.put('docs/STATUS.md', snapshot(2));
  const material = f.commit();
  assert.equal(counterOnlyTaskRebase(reviewed, reviewTaskDelta({ root: f.root, base, material })), false);
});

test('#1068 upstream STATUS prose drift with unchanged counter edit cannot create a general rebase exception', t => {
  const f = fixture(t), reviewed = f.old();
  f.git('checkout', '-q', '--detach', f.oldBase);
  f.put('test/fixtures/other.json', '{"accepted":true}\n');
  f.put('docs/STATUS.md', snapshot(0) + 'Accepted upstream note.\n'); const base = f.commit();
  f.put('src/fixture.mjs', 'export const value = 2;\n');
  f.put('test/task.test.mjs', "test('task', () => {});\n");
  f.put('docs/STATUS.md', snapshot(1) + 'Accepted upstream note.\n'); const material = f.commit();
  const current = reviewTaskDelta({ root: f.root, base, material });
  assert.equal(reviewed.raw_delta, current.raw_delta, 'metadata drift alone is not a changed counter edit');
  assert.equal(counterOnlyTaskRebase(reviewed, current), false);
});

test('#1068 canonical inventory binds each path edit to its job despite unrelated upstream array offsets', () => {
  const blob = (changes = {}) => ({ mode: '100644', text: JSON.stringify({ schema: 1,
    jobs: Object.fromEntries(['frontend', 'backend', 'geometry_parity', 'smoke', 'golden', 'performance_smoke']
      .map(job => [job, changes[job] || []])), protocol: changes.protocol || [] }, null, 2) + '\n' });
  const before = blob({ frontend: ['src/a.ts'], smoke: ['src/a.ts'] });
  const after = blob({ frontend: ['src/a.ts', 'test/task.test.mjs'], smoke: ['src/a.ts'] });
  const upstream = blob({ frontend: ['src/a.ts', 'test/accepted.test.mjs'], smoke: ['src/a.ts'] });
  const same = blob({ frontend: ['src/a.ts', 'test/accepted.test.mjs', 'test/task.test.mjs'], smoke: ['src/a.ts'] });
  const relocated = blob({ frontend: ['src/a.ts', 'test/accepted.test.mjs'], smoke: ['src/a.ts', 'test/task.test.mjs'] });
  assert.equal(registryInventoryReviewDelta(before, after), registryInventoryReviewDelta(upstream, same));
  assert.notEqual(registryInventoryReviewDelta(before, after), registryInventoryReviewDelta(upstream, relocated));
  assert.notEqual(registryInventoryReviewDelta(before, after), registryInventoryReviewDelta(before, { ...after, mode: '100755' }));
  for (const value of [
    blob({ frontend: ['src/a.ts', 'src/a.ts'] }),
    blob({ frontend: ['src/z.ts', 'src/a.ts'] }),
    blob({ frontend: ['../escape.ts'] }),
    { ...after, text: after.text.replace('"schema": 1,', '"schema": 1,\n  "schema": 1,') },
    { ...after, text: after.text.replace('"schema": 1', '"schema": 2') },
    { ...after, text: after.text.replace('"jobs": {', '"extra": true,\n  "jobs": {') },
    { ...after, text: after.text.replace('"frontend": [', '"unknownJob": [') },
    { ...after, text: after.text.trim() },
    { ...after, mode: '120000' }, null,
  ]) assert.throws(() => registryInventoryReviewDelta(before, value), /inventory|JSON|Registry/);
});

test('#1068 trusted publisher CLI binds its actual report and immutable delta for a later manual rebase', async t => {
  const f = fixture(t), doc = 'docs/reviews/CODE-REVIEW-1068-r1.md', body = 'a'.repeat(64);
  f.put(doc, '# Independent report\n\nGreen review with actual findings.\n');
  const certificatePath = join(f.root, 'certificate.json');
  execFileSync(process.execPath, [join(REPO, 'scripts/review-doc-guard.mjs'), `--anchor=${doc}`,
    `--sha=${f.oldMaterial}`, `--tree=${f.git('rev-parse', f.oldMaterial + '^{tree}')}`,
    '--branch=issue/1068-fixture', '--verdict=green', '--high=0', `--issue-body=${body}`,
    `--base=${f.oldBase}`, '--repo=owner/repo', '--num=1068', `--rebase-certificate=${certificatePath}`],
  { cwd: f.root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1' } });
  const certificate = JSON.parse(readFileSync(certificatePath, 'utf8'));
  const report = readFileSync(join(f.root, doc), 'utf8');
  const { certificateDigest } = await import('../scripts/review-rebase-certificate.mjs');
  assert.equal(certificate.document_digest, reviewDocumentDigest(report));
  assert.equal(certificate.base, f.oldBase); assert.equal(certificate.material, f.oldMaterial);
  assert.equal(anchorRebaseCertificateFrom(report).digest, certificateDigest(certificate));
  f.git('update-ref', 'refs/remotes/origin/dev', f.newBase);
  const result = await reusableCounterGreenVerdict([{ name: doc.split('/').at(-1), text: report }], {
    repo: 'owner/repo', issue: 1068, body, root: f.root,
    loadCertificate: async () => certificate,
  });
  assert.equal(result?.validation_required, true);
  assert.equal(result?.role, 'rebase');
});
