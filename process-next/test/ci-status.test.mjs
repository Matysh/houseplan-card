import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { productIdentity, buildCiStatus, publishCiStatus } from '../lib/ci-status.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-ci-status-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const run = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args],
    { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (path, body) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), body); };
  const commit = () => { run(['add', '.']); run(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']); return run(['rev-parse', 'HEAD']); };
  run(['init', '-q']);
  const pkg = { version: '1.0.0', type: 'module', scripts: { build: 'rollup -c', test: 'old test command' }, dependencies: { lit: '3.0.0' } };
  write('package.json', JSON.stringify(pkg)); write('src/card.ts', 'original product'); write('scripts/source-fingerprint.mjs', 'old metadata');
  const source = commit(), git = { git: async args => run(args), ensureCommit: async sha => run(['cat-file', '-e', `${sha}^{commit}`]) };
  let main = source;
  const published = { sha: source, tag: 'v1.0.0', runner: { id: 'original-run', sha: source, event: 'stable', status: 'passed',
    ready: true, materialClean: true, digest: 'd'.repeat(64), finishedAt: '2026-11-01T00:00:00Z', required: 2, failed: [], reused: 1,
    path: 'C:/private/secret/report.json', checks: [{ id: 'units', name: 'Product units', status: 'passed', counts: { tests: 5, passed: 5 } },
      { id: 'backend', name: 'Backend', status: 'reused', sourceRun: 'earlier-run' }] } };
  const api = { owner: 'owner', repo: 'repo', root: '/repos/owner/repo', activated: true,
    getRef: async branch => { assert.equal(branch, 'main'); return { object: { sha: main } }; } };
  return { run, write, commit, pkg, source, git, published, api, get main() { return main; }, set main(value) { main = value; } };
}
function legacy(f) {
  const evidence = { schema: 1, tag: f.published.tag, sha: f.source, runHeadSha: f.source, profile: 'hotfix', runId: 42, runAttempt: 1,
    finishedAt: '2026-11-01T00:00:00Z', jobs: [{ id: 51, name: 'Product tests', steps: ['Build', 'Unit tests'] }] };
  const run = { id: 42, head_sha: f.source, status: 'completed', conclusion: 'success', run_attempt: 1, updated_at: evidence.finishedAt };
  const job = { id: 51, run_id: 42, name: 'Product tests', status: 'completed', conclusion: 'success',
    steps: ['Build', 'Unit tests'].map(name => ({ name, status: 'completed', conclusion: 'success' })) };
  f.api.request = async (_method, path) => { if (path.endsWith('/actions/runs/42')) return run;
    if (path.endsWith('/actions/jobs/51')) return job; throw Error(path); };
  return { evidence, run, job, published: { sha: f.source, tag: f.published.tag } };
}

test('product identity survives docs, tests and renamed test scripts; code, dependencies and build hooks invalidate it', async t => {
  const f = fixture(t), original = await productIdentity(f.git, f.source);
  f.write('README.md', 'documentation'); f.write('test/new.test.mjs', 'new test'); f.write('process-next/lib/queue.mjs', 'new process');
  f.pkg.scripts.test = 'new test command'; f.write('package.json', JSON.stringify(f.pkg, null, 2));
  assert.equal(await productIdentity(f.git, f.commit()), original);
  for (const [path, body] of [['src/card.ts', 'changed product'], ['package.json', JSON.stringify({ ...f.pkg, dependencies: { lit: '4.0.0' } })],
    ['package.json', JSON.stringify({ ...f.pkg, scripts: { ...f.pkg.scripts, prebuild: 'generate runtime sources' } })]]) {
    f.run(['checkout', '-q', '--detach', f.source]); f.write(path, body);
    assert.notEqual(await productIdentity(f.git, f.commit()), original);
  }
});

test('native published receipt identifies its actual checks without leaking local paths and remains deterministic', async t => {
  const f = fixture(t); f.write('README.md', 'documentation after stable'); f.main = f.commit();
  const options = { api: f.api, git: f.git, published: f.published };
  const value = await buildCiStatus(options);
  assert.equal(value.badge.message, 'passing'); assert.equal(value.mainSha, f.main);
  assert.match(value.report, /original-run/); assert.match(value.report, /tests: 5, passed: 5/); assert.match(value.report, /earlier-run/);
  assert.doesNotMatch(value.report, /C:|private|secret/); assert.deepEqual(await buildCiStatus(options), value);
  for (const runner of [{ ...f.published.runner, ready: false }, { ...f.published.runner, status: 'failed' },
    { ...f.published.runner, materialClean: false }, { ...f.published.runner, sha: 'f'.repeat(40) }, { ...f.published.runner, event: 'beta' }])
    assert.equal((await buildCiStatus({ ...options, published: { ...f.published, runner } })).badge.message, 'not tested');
  f.write('src/card.ts', 'different product'); f.main = f.commit();
  assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
});

test('legacy proof requires live successful run, job and every mandatory step, never merely a green workflow', async t => {
  const f = fixture(t), l = legacy(f), options = { api: f.api, git: f.git, published: l.published, legacyEvidence: l.evidence };
  assert.equal((await buildCiStatus(options)).badge.message, 'passing');
  l.job.steps[1].conclusion = 'skipped'; assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
  l.job.steps[1].conclusion = 'success'; l.job.conclusion = 'failure'; assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
  l.job.conclusion = 'success'; l.run.head_sha = 'f'.repeat(40); assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
  l.run.head_sha = f.source; l.run.run_attempt = 2; assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
});

test('historical equivalence is one exact audited tree bridge; future changes and extra source changes are not excused', async t => {
  const f = fixture(t), l = legacy(f), path = 'scripts/source-fingerprint.mjs';
  f.write(path, 'new capture metadata'); const anchor = f.commit();
  l.evidence.equivalentProductSha = anchor;
  l.evidence.equivalence = { explanation: 'Reviewed metadata migration only', allowedChanges: [{ path,
    before: f.run(['rev-parse', `${f.source}:${path}`]), after: f.run(['rev-parse', `${anchor}:${path}`]) }] };
  f.write('README.md', 'later docs'); f.main = f.commit();
  const options = { api: f.api, git: f.git, published: l.published, legacyEvidence: l.evidence };
  const value = await buildCiStatus(options); assert.equal(value.badge.message, 'passing'); assert.match(value.report, new RegExp(anchor));
  f.write(path, 'yet another helper implementation'); f.main = f.commit();
  assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
  l.evidence.equivalentProductSha = f.main; // The unchanged allowlist cannot approve this later helper edit.
  assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
  f.write('src/card.ts', 'unreviewed product change'); l.evidence.equivalentProductSha = f.main = f.commit();
  assert.equal((await buildCiStatus(options)).badge.message, 'not tested');
});

function publicationApi(f, { conflict = false, moveMain } = {}) {
  let counter = 0, head, patches = 0, mainReads = 0;
  const id = () => (++counter).toString(16).padStart(40, '0'), blobs = new Map(), trees = new Map(), commits = new Map();
  const blob = content => { const oid = createHash('sha1').update(content).digest('hex'); blobs.set(oid, content); return oid; };
  const tree = files => { const key = id(); trees.set(key, files); return key; };
  head = id(); commits.set(head, { tree: { sha: tree([{ path: 'releases.json', type: 'blob', mode: '100644', sha: blob('original release state') }]) } });
  const files = () => Object.fromEntries(trees.get(commits.get(head).tree.sha).map(entry => [entry.path, blobs.get(entry.sha)]));
  const api = { ...f.api, getRef: async branch => {
    if (branch === 'main') { mainReads++; if (moveMain && mainReads === 2) f.main = moveMain; return { object: { sha: f.main } }; }
    assert.equal(branch, 'process-release-state'); return { object: { sha: head } };
  }, request: async (method, path, body) => {
    const suffix = path.slice(api.root.length);
    if (method === 'GET' && suffix.startsWith('/git/commits/')) return commits.get(suffix.split('/').at(-1));
    if (method === 'GET' && suffix.startsWith('/git/trees/')) return { tree: trees.get(suffix.split('/').at(-1)) };
    if (method === 'GET' && suffix.startsWith('/git/blobs/')) return { encoding: 'base64', content: Buffer.from(blobs.get(suffix.split('/').at(-1))).toString('base64') };
    if (method === 'POST' && suffix === '/git/trees') {
      const entries = new Map(trees.get(body.base_tree).map(entry => [entry.path, entry]));
      for (const entry of body.tree) entries.set(entry.path, { path: entry.path, type: entry.type, mode: entry.mode, sha: blob(entry.content) });
      return { sha: tree([...entries.values()]) };
    }
    if (method === 'POST' && suffix === '/git/commits') { const key = id(); commits.set(key, { tree: { sha: body.tree }, parents: body.parents }); return { sha: key }; }
    if (method === 'PATCH') {
      patches++; assert.equal(suffix, '/git/refs/heads/process-release-state'); assert.equal(body.force, false);
      if (conflict) {
        conflict = false; const current = trees.get(commits.get(head).tree.sha).map(entry => entry.path === 'releases.json' ? { ...entry, sha: blob('concurrent release state') } : entry);
        head = id(); commits.set(head, { tree: { sha: tree(current) } }); throw Object.assign(Error('conflict'), { status: 409 });
      }
      assert.deepEqual(commits.get(body.sha).parents, [head]); head = body.sha; return { object: { sha: head } };
    }
    throw Error(`${method} ${suffix}`);
  } };
  return { api, files, patches: () => patches };
}

test('public files update atomically, preserve concurrent release writes and produce no new commit on repeat', async t => {
  const f = fixture(t), remote = publicationApi(f, { conflict: true });
  const options = { api: remote.api, git: f.git, published: f.published };
  const first = await publishCiStatus(options);
  assert.equal(first.updated, true); assert.equal(remote.patches(), 2);
  assert.equal(remote.files()['releases.json'], 'concurrent release state');
  assert.equal(JSON.parse(remote.files()['ci.json']).message, 'passing'); assert.equal(remote.files()['CI.md'], first.report);
  const repeated = await publishCiStatus(options); assert.equal(repeated.updated, false); assert.equal(remote.patches(), 2);
});

test('a main change observed before publication recomputes neutral status instead of publishing obsolete green', async t => {
  const f = fixture(t); f.write('src/card.ts', 'new untested main product'); const changed = f.commit();
  const remote = publicationApi(f, { moveMain: changed });
  const result = await publishCiStatus({ api: remote.api, git: f.git, published: f.published });
  assert.equal(result.badge.message, 'not tested'); assert.equal(result.mainSha, changed);
  assert.equal(JSON.parse(remote.files()['ci.json']).message, 'not tested'); assert.equal(remote.patches(), 1);
});
