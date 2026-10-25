import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalReviewDiff, counterOnlyTaskRebase, reviewTaskDelta } from '../scripts/review-task-delta.mjs';
import { STATUS_COUNTER_BEGIN, STATUS_COUNTER_END, STATUS_COUNTER_POLICY_PATHS } from '../scripts/status-counter-equivalence.mjs';
import { anchorRebaseCertificateFrom, reviewDocumentDigest, reusableCounterGreenVerdict } from '../scripts/review-doc-guard.mjs';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const snapshot = n => [STATUS_COUNTER_BEGIN, '| Item | State |', '|---|---|',
  '| Generated | 2026-10-25 — rerun `node scripts/status-snapshot.mjs` for the current tree |',
  '| Version | **1.83.0-beta.2** in all 7 version sources (`scripts/release-contract.mjs`) |',
  '| Latest stable tag | `v1.82.0` |', '| Latest prerelease tag | `v1.83.0-beta.2` |',
  `| Tests | Node unit ${n} · pure backend 0 · HA-harness backend 0 · browser smokes 0 (\`npm run inventory\`) |`,
  STATUS_COUNTER_END, '', 'Human status text stays significant.', ''].join('\n');
function fixture(t) {
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
  put('docs/STATUS.md', snapshot(0)); put('src/fixture.mjs', 'export const value = 1;\n');
  const oldBase = commit();
  const task = () => { put('test/task.test.mjs', "test('task', () => {});\n"); put('src/fixture.mjs', 'export const value = 2;\n'); };
  task(); put('docs/STATUS.md', snapshot(1)); const oldMaterial = commit();
  git('checkout', '-q', '--detach', oldBase);
  put('test/upstream.test.mjs', "test('upstream', () => {});\n");
  put('test/fixtures/upstream.json', '{"realRuntimeInput":true}\n');
  put('docs/STATUS.md', snapshot(1)); const newBase = commit();
  task(); put('docs/STATUS.md', snapshot(2)); const newMaterial = commit();
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

test('#1068 canonical diff preserves bytes and binary identity while ignoring only text blob IDs and hunk coordinates', () => {
  const diff = 'diff --git a/a b/a\nindex aabb..ccdd 100644\n--- a/a\n+++ b/a\n@@ -1 +1 @@ context\n-a\n+b\n';
  assert.equal(canonicalReviewDiff(diff), canonicalReviewDiff(diff.replace('aabb..ccdd', 'eeee..ffff').replace('-1 +1', '-8 +9')));
  assert.notEqual(canonicalReviewDiff(diff), canonicalReviewDiff(diff.replace('+b', '+ b')));
  const binary = diff.split('@@')[0] + 'Binary files a/a and b/a differ\n';
  assert.notEqual(canonicalReviewDiff(binary), canonicalReviewDiff(binary.replace('aabb..ccdd', 'eeee..ffff')));
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
