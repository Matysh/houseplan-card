import test from 'node:test';
import { fixtureVersions as versions } from './helpers/ci-registry-version-fixture.mjs';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { registryInputs, registryReader, REGISTRY_JOBS, maskJsonScalars, versionNormalizer, jobRecipe, registryProtocolFiles, registryRemaining } from '../scripts/ci-registry-inputs.mjs';
import { profilePaths } from '../scripts/ci-profile-paths.mjs';
import { registryInventory } from '../scripts/ci-registry-inventory.mjs';
import { generatedProfiles } from '../scripts/ci-profiles.mjs';
import { producerRecipe } from '../scripts/ci-registry-cli.mjs';
import { verifyRegistryBuild, restoreRegistryBuild, runCandidateCommand } from '../scripts/ci-registry-build.mjs';
import { artifactTree } from '../scripts/artifact-inventory.mjs';
import { sourceEquivalenceCommon, sourceEquivalenceJob, snapshotEntries, validateSnapshotPolicy } from '../scripts/ci-registry-equivalence.mjs';
import { registryApi } from '../scripts/ci-proof-registry.mjs';
import { statusCounterFixture } from './helpers/status-counter-fixture.mjs';

const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const environment = { node: '22.23.3', platform: 'linux', arch: 'x64', python: '3.14.5', pins: '1'.repeat(64) };
function temporary(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-registry-inputs-'));
  assert.ok(root.startsWith(resolve(tmpdir()) + sep)); t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
const put = (root, path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
function repository(t) {
  const root = temporary(t); git(root, ['init', '-b', 'dev']);
  git(root, ['config', 'user.name', 'Fixture']); git(root, ['config', 'user.email', 'fixture@example.invalid']);
  versions(root, '1.82.0-beta.5');
  for (const name of ['ci-registry-inputs', 'ci-registry-cli', 'ci-registry-verify', 'ci-proof-registry']) put(root, 'scripts/' + name + '.mjs', 'export const protocol = 1;\n');
  put(root, 'scripts/harness.mjs', 'export const harness = 1;\n');
  put(root, 'scripts/unrelated.mjs', 'export const unrelated = 1;\n');
  put(root, 'src/runtime.ts', 'export const runtime = 1;\n');
  put(root, 'custom_components/houseplan/config.py', 'VALUE = 1\n');
  put(root, 'scripts/ci-profile-paths.json', JSON.stringify(profilePaths([])));
  put(root, 'scripts/ci-registry-inventory.json', JSON.stringify({ schema: 1,
    protocol: ['ci-registry-inputs', 'ci-registry-cli', 'ci-registry-verify', 'ci-proof-registry'].map(name => 'scripts/' + name + '.mjs'),
    jobs: Object.fromEntries(REGISTRY_JOBS.map(job => [job,
    job === 'frontend' ? ['src/runtime.ts', 'scripts/harness.mjs'] : ['custom_components/houseplan/config.py']])) }));
  const recipe = ['name: Fixture', 'on: workflow_dispatch', 'jobs:', ...[...REGISTRY_JOBS, 'bundle', 'smoke_done', 'proof', 'reuse', 'product_guards'].flatMap(job =>
    ['  ' + job + ':', '    name: ' + job, '    runs-on: ubuntu-24.04', '    steps:', '      - run: echo verify-' + job]), ''].join('\n');
  put(root, '.github/workflows/validate.yml', recipe);
  put(root, '.github/workflows/validate-product.yml', recipe);
  commit(root, 'initial'); return root;
}
function commit(root, message) { git(root, ['add', '.']); git(root, ['commit', '-m', message]); return git(root, ['rev-parse', 'HEAD']); }
const identity = (root, mode = 'exact', options = {}) => registryInputs(root, { toolchain: environment, mode, ...options });
test('content identities survive docs commits, unrelated tooling, branches and actual merges', t => {
  const root = repository(t), base = identity(root);
  put(root, 'docs/readme.md', 'new docs\n'); commit(root, 'docs');
  assert.deepEqual(identity(root).keys, base.keys);
  put(root, 'scripts/unrelated.mjs', 'export const unrelated = 2;\n'); commit(root, 'unrelated tooling');
  assert.deepEqual(identity(root).keys, base.keys);
  git(root, ['checkout', '-b', 'issue/981-fixture']);
  put(root, 'docs/branch.md', 'branch docs\n'); commit(root, 'branch documentation');
  const source = identity(root); git(root, ['checkout', 'dev']);
  git(root, ['merge', '--no-ff', 'issue/981-fixture', '-m', 'merge task']);
  const merged = identity(root);
  assert.equal(merged.treeId, source.treeId); assert.deepEqual(merged.keys, source.keys);
  assert.notEqual(git(root, ['rev-parse', 'HEAD']), git(root, ['rev-parse', 'issue/981-fixture']));
});
test('beta normalization masks every synchronized canonical mirror, preserves every other byte', t => {
  const root = repository(t), oldExact = identity(root), oldBeta = identity(root, 'candidate');
  versions(root, '1.82.0-beta.6'); commit(root, 'existing candidate version inputs');
  assert.notEqual(identity(root).treeId, oldExact.treeId);
  assert.deepEqual(identity(root, 'candidate').keys, oldBeta.keys);
  put(root, 'src/runtime.ts', 'export const runtime = 2;\n'); commit(root, 'real runtime change');
  assert.notEqual(identity(root, 'candidate').treeId, oldBeta.treeId);
  assert.notEqual(identity(root, 'candidate').keys.frontend, oldBeta.keys.frontend);
});
test('JSON mask cannot erase dependency versions, extra values, formatting or duplicate members', () => {
  const a = '{"version":"1.0.0-beta.1","nested":{"version":"keep"},"keep":42}';
  const masked = maskJsonScalars(a, [['version']], '1.0.0-beta.1');
  assert.equal(masked, '{"version":"<release-version>","nested":{"version":"keep"},"keep":42}');
  assert.notEqual(maskJsonScalars(a.replace('keep', 'other'), [['version']], '1.0.0-beta.1'), masked);
  assert.notEqual(maskJsonScalars(a.replace('42', '43'), [['version']], '1.0.0-beta.1'), masked);
  assert.notEqual(maskJsonScalars(a.replace(':{', ': {'), [['version']], '1.0.0-beta.1'), masked);
  assert.throws(() => maskJsonScalars('{"version":"x","version":"x"}', [['version']], 'x'));
  assert.throws(() => maskJsonScalars(a, [['missing']], '1.0.0-beta.1'));
});
test('unknown/stable or unsynchronized release mirror is never candidate equivalence', t => {
  const root = repository(t);
  put(root, 'custom_components/houseplan/const.py', 'VERSION = "different"\n'); commit(root, 'unsynchronized fixture');
  assert.throws(() => identity(root, 'candidate'), /unsynchronized/);
  versions(root, '1.82.0'); commit(root, 'stable fixture');
  assert.throws(() => identity(root, 'candidate'), /requires.*beta/);
});
test('job harness, toolchain, execution recipe, protocol imports and unknown product inputs change keys', t => {
  const root = repository(t), initial = identity(root);
  assert.notEqual(identity(root, 'exact', { perfSet: 'glow' }).keys.performance_smoke,
    identity(root, 'exact', { perfSet: 'glow-iso-interaction' }).keys.performance_smoke);
  put(root, 'scripts/harness.mjs', 'export const harness = 2;\n'); commit(root, 'harness input');
  const harness = identity(root);
  assert.equal(harness.treeId, initial.treeId); assert.notEqual(harness.keys.frontend, initial.keys.frontend);
  assert.equal(harness.keys.backend, initial.keys.backend);
  assert.notEqual(identity(root, 'exact', { toolchain: { ...environment, python: '3.14.6' } }).keys.backend, harness.keys.backend);
  put(root, '.github/workflows/validate.yml', readFileSync(join(root, '.github/workflows/validate.yml'), 'utf8').replace('echo verify-frontend', 'echo stricter-frontend'));
  put(root, '.github/workflows/validate-product.yml', readFileSync(join(root, '.github/workflows/validate-product.yml'), 'utf8').replace('echo verify-frontend', 'echo stricter-frontend'));
  commit(root, 'execution recipe changed'); const recipe = identity(root);
  assert.notEqual(recipe.keys.frontend, harness.keys.frontend); assert.equal(recipe.keys.backend, harness.keys.backend);
  put(root, 'scripts/ci-registry-cli.mjs', "import './new-protocol.mjs';\n");
  put(root, 'scripts/new-protocol.mjs', 'export const protocol = 1;\n'); commit(root, 'protocol import');
  const imported = identity(root); assert.notEqual(imported.keys.frontend, recipe.keys.frontend);
  put(root, 'scripts/new-protocol.mjs', 'export const protocol = 2;\n'); commit(root, 'transitive protocol change');
  assert.notEqual(identity(root).keys.frontend, imported.keys.frontend);
  put(root, 'unknown-product-input.bin', Buffer.from([0, 1, 2, 3])); commit(root, 'unknown product input');
  assert.notEqual(identity(root).treeId, imported.treeId);
});
test('producer fingerprints the workflow that actually executes, including generated product recipe', t => {
  const root = repository(t), reader = { text: p => readFileSync(join(root, p), 'utf8') };
  const actual = producerRecipe(root, 'frontend', { GITHUB_REPOSITORY: 'Matysh/houseplan-card',
    GITHUB_WORKFLOW_REF: 'Matysh/houseplan-card/.github/workflows/validate-product.yml@refs/heads/issue/981-fixture' });
  assert.equal(actual, jobRecipe(reader, 'frontend'));
  put(root, '.github/workflows/validate-product.yml', reader.text('.github/workflows/validate-product.yml').replace('echo verify-frontend', 'echo omitted-tests'));
  assert.notEqual(producerRecipe(root, 'frontend', { GITHUB_REPOSITORY: 'Matysh/houseplan-card',
    GITHUB_WORKFLOW_REF: 'Matysh/houseplan-card/.github/workflows/validate-product.yml@refs/heads/dev' }), actual);
  assert.throws(() => producerRecipe(root, 'frontend', { GITHUB_REPOSITORY: 'Matysh/houseplan-card',
    GITHUB_WORKFLOW_REF: 'Matysh/houseplan-card/.github/workflows/foreign.yml@refs/heads/dev' }));
});
test('exact Git blob identity tracks binary bytes without hydrating them and refuses symbolic inputs', t => {
  const root = repository(t), path = 'assets/large.bin';
  put(root, path, Buffer.alloc(1024 * 1024, 17)); commit(root, 'binary product input');
  const withoutBinaryReads = mode => {
    const reader = registryReader(root), read = reader.read;
    reader.read = name => { assert.notEqual(name, path, 'binary identity must use its actual Git content ID'); return read(name); };
    return registryInputs(root, { reader, mode, toolchain: environment });
  };
  const exact = withoutBinaryReads('exact'), candidate = withoutBinaryReads('candidate');
  put(root, path, Buffer.alloc(1024 * 1024, 18)); commit(root, 'same-size different binary bytes');
  assert.notEqual(withoutBinaryReads('exact').treeId, exact.treeId);
  assert.notEqual(withoutBinaryReads('candidate').keys.frontend, candidate.keys.frontend);
  const oid = git(root, ['rev-parse', 'HEAD:' + path]);
  git(root, ['update-index', '--cacheinfo', '120000,' + oid + ',' + path]);
  git(root, ['commit', '-m', 'unsafe symbolic input mode']);
  assert.throws(() => withoutBinaryReads('exact'), /symbolic input/);
});

test('computed inventory and generated profiles match the executable source', () => {
  const root = process.cwd();
  assert.deepEqual(JSON.parse(readFileSync('scripts/ci-registry-inventory.json', 'utf8')), registryInventory(root));
  for (const [path, expected] of generatedProfiles(root)) assert.equal(readFileSync(path, 'utf8').replace(/\r\n/g, '\n'), expected);
});
test('restoration verifies immutable byte inventories and refuses corruption before replacing artifacts', t => {
  const root = temporary(t), source = join(root, 'source'), consumer = join(root, 'consumer');
  put(source, 'dist/entry.js', 'fresh bundle\n'); put(source, 'test-build/model.js', 'fresh emitted model\n'); put(source, 'test-build/.tsbuildinfo', 'compiler state\n');
  put(consumer, 'dist/entry.js', 'previous bundle\n');
  const record = { run: 1234, inventory: { dist: artifactTree(join(source, 'dist')), testBuild: artifactTree(join(source, 'test-build')) } };
  const download = (run, name, dest) => {
    assert.equal(run, 1234);
    put(dest, name === 'producer-card-bundle' ? 'entry.js' : 'model.js', name === 'producer-card-bundle' ? 'fresh bundle\n' : 'fresh emitted model\n');
    if (name === 'producer-test-build') put(dest, '.tsbuildinfo', 'compiler state\n');
  };
  restoreRegistryBuild({ root: consumer, repo: 'Matysh/houseplan-card', record, download });
  verifyRegistryBuild(record.inventory, consumer);
  assert.throws(() => restoreRegistryBuild({ root: consumer, repo: 'Matysh/houseplan-card', record, download: (run, name, dest) => {
    put(dest, name === 'producer-card-bundle' ? 'entry.js' : 'model.js', name === 'producer-card-bundle' ? 'fresh bundle\n' : 'fresh emitted model\n');
  } }), /inventory mismatch/);
  assert.throws(() => restoreRegistryBuild({ root: consumer, repo: 'Matysh/houseplan-card',
    record: { ...record, inventory: { ...record.inventory, dist: '0'.repeat(64) } }, download }), /inventory mismatch/);
  assert.equal(readFileSync(join(consumer, 'dist/entry.js'), 'utf8'), 'fresh bundle\n');
});
test('candidate command executes the requested npm script and propagates a real failure', t => {
  const root = temporary(t);
  put(root, 'package.json', JSON.stringify({ scripts: { build: 'node build.mjs', broken: 'node broken.mjs' } }));
  put(root, 'build.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync('assembled.txt', 'candidate bytes');\n");
  put(root, 'broken.mjs', 'process.exitCode = 7;\n');
  runCandidateCommand(['run', 'build', '--silent'], root);
  assert.equal(readFileSync(join(root, 'assembled.txt'), 'utf8'), 'candidate bytes');
  assert.throws(() => runCandidateCommand(['run', 'broken', '--silent'], root), /candidate assembly failed/);
});

test('independent source Git objects authenticate docs inheritance and reject a counterfeit old key', async t => {
  const root = repository(t), original = identity(root), previous = original._snapshot;
  put(root, 'docs/new.md', 'documentation changes no runtime input\n'); commit(root, 'new material');
  let candidate = identity(root)._snapshot;
  const common = await sourceEquivalenceCommon(candidate, previous, 'exact');
  const verified = await sourceEquivalenceJob(candidate, previous, { job: 'frontend', workflow: '.github/workflows/validate.yml' }, common);
  assert.equal(verified.sourceEquivalent, true);
  assert.equal(verified.actualWorkflowRecipe, original.workflowRecipes['validate.yml'].frontend);
  put(root, 'src/runtime.ts', 'export const runtime = 99;\n'); commit(root, 'different actual bytes with old wire claim');
  candidate = identity(root)._snapshot;
  await assert.rejects(() => sourceEquivalenceCommon(candidate, previous, 'exact'), /actual Git input/);
});
test('#1068 registry consumers accept counter-only Git inputs for every job and refuse real upstream fixture changes', async t => {
  const root = repository(t);
  put(root, 'docs/STATUS.md', statusCounterFixture());
  put(root, 'demo/fixtures/one.mjs', 'export const fixture = 1;');
  const sourceSha = commit(root, 'source with counters and fixture'), original = identity(root);
  put(root, 'docs/STATUS.md', statusCounterFixture(11));
  commit(root, 'counter only');
  assert.equal(git(root, ['diff', '--name-only', sourceSha, 'HEAD']), 'docs/STATUS.md');
  const candidate = identity(root);
  assert.deepEqual(candidate.keys, original.keys);
  const common = await sourceEquivalenceCommon(candidate._snapshot, original._snapshot, 'exact');
  for (const job of REGISTRY_JOBS) {
    const verified = await sourceEquivalenceJob(candidate._snapshot, original._snapshot,
      { job, workflow: '.github/workflows/validate-product.yml' }, common);
    assert.equal(verified.sourceEquivalent, true, job);
    assert.equal(verified.actualWorkflowRecipe, original.workflowRecipes['validate-product.yml'][job]);
  }
  put(root, 'docs/STATUS.md', statusCounterFixture(12));
  put(root, 'demo/fixtures/one.mjs', 'export const fixture = 2;');
  commit(root, 'real upstream fixture and counters');
  const substantive = identity(root);
  assert.notDeepEqual(substantive.keys, original.keys);
  await assert.rejects(() => sourceEquivalenceCommon(substantive._snapshot, original._snapshot, 'exact'), /actual Git input/);
  // Unknown input must not inherit the PASS accepted for the counter-only commit.
  put(root, 'demo/fixtures/one.mjs', 'export const fixture = 1;');
  put(root, 'unknown-input.bin', Buffer.from([0, 1, 2]));
  commit(root, 'unknown actual input beside counters');
  await assert.rejects(() => sourceEquivalenceCommon(identity(root)._snapshot, original._snapshot, 'exact'), /missing\/unsafe source Git input: unknown-input\.bin/);
});

test('actual proof/lookup/producer recipes and trust code cannot lie behind identical metadata', async t => {
  const root = repository(t), previous = identity(root)._snapshot;
  const path = '.github/workflows/validate.yml', old = readFileSync(join(root, path), 'utf8');
  put(root, path, old.replace('echo verify-proof', 'echo counterfeit-proof')); commit(root, 'different executing proof writer');
  let candidate = identity(root)._snapshot, common = await sourceEquivalenceCommon(candidate, previous, 'exact');
  await assert.rejects(() => sourceEquivalenceJob(candidate, previous,
    { job: 'frontend', workflow: '.github/workflows/validate.yml' }, common), /actual workflow recipe/);
  put(root, path, old);
  put(root, 'scripts/ci-registry-cli.mjs', 'export const forgedKey = true;\n'); commit(root, 'different actual trust code');
  candidate = identity(root)._snapshot;
  await assert.rejects(() => sourceEquivalenceCommon(candidate, previous, 'exact'), /ci-registry-cli/);
});
test('source roots detect additions absent from a forged/old explicit job input list', async t => {
  const root = repository(t), previous = identity(root)._snapshot;
  put(root, 'scripts/support-relay/extra.py', 'VALUE = 99\n'); commit(root, 'additional actual backend root');
  const candidate = identity(root)._snapshot, common = await sourceEquivalenceCommon(candidate, previous, 'exact');
  await assert.rejects(() => sourceEquivalenceJob(candidate, previous,
    { job: 'backend', workflow: '.github/workflows/validate.yml' }, common), /source Git input/);
});
test('actual Git beta equivalence accepts only synchronized scalar version differences', async t => {
  const root = repository(t), previous = identity(root, 'candidate')._snapshot;
  versions(root, '1.82.0-beta.6'); commit(root, 'new candidate mirrors');
  let candidate = identity(root, 'candidate')._snapshot;
  const common = await sourceEquivalenceCommon(candidate, previous, 'candidate');
  assert.equal((await sourceEquivalenceJob(candidate, previous,
    { job: 'frontend', workflow: '.github/workflows/validate.yml' }, common)).sourceEquivalent, true);
  const path = 'custom_components/houseplan/const.py';
  put(root, path, readFileSync(join(root, path), 'utf8').replace('PRESERVED = 42', 'PRESERVED = 43'));
  commit(root, 'non-version change under a version mirror path');
  candidate = identity(root, 'candidate')._snapshot;
  await assert.rejects(() => sourceEquivalenceCommon(candidate, previous, 'candidate'), /non-version candidate bytes/);
});

test('#1060 actual generated Git policy authenticates reuse and rejects counterfeit dependency/exclusion lists', async () => {
  // Use the real committed generated policy and its immutable Git code, not
  // profilePaths([]) or a copy of the validator's expected synthetic table.
  const reader = registryReader(resolve('.'));
  const domains = JSON.parse(reader.text('scripts/ci-profile-paths.json'));
  const snapshot = () => ({ entries: snapshotEntries(reader.rows), read: reader.read, readMany: reader.readMany,
    inventory: JSON.parse(reader.text('scripts/ci-registry-inventory.json')), domains: structuredClone(domains) });
  const candidate = snapshot(), previous = snapshot();
  const helper = 'demo/helpers/clamped-wheel-lease.mjs';
  assert.ok(domains.tooling.includes(helper), 'real generated dependency must exercise the #1044 extension');
  const common = await sourceEquivalenceCommon(candidate, previous, 'exact');
  assert.equal((await sourceEquivalenceJob(candidate, previous,
    { job: 'frontend', workflow: '.github/workflows/validate.yml' }, common)).sourceEquivalent, true);

  const unrelated = reader.tracked.find(path => path.startsWith('src/') && !domains.tooling.includes(path));
  assert.ok(unrelated);
  const productTest = reader.tracked.find(path => /^test\/[^/]+\.test\.mjs$/.test(path) && !domains.product.includes('!' + path));
  assert.ok(productTest);
  for (const change of [
    table => { table.tooling.push(unrelated); },
    table => { table.tooling = table.tooling.filter(path => path !== helper); },
    table => { table.product.push('!' + helper); },
    table => { table.docs.push('src/**'); },
    table => { table.product.push('!' + productTest); if (!table.tooling.includes(productTest)) table.tooling.push(productTest); },
  ]) {
    const forged = snapshot(); change(forged.domains);
    await assert.rejects(() => validateSnapshotPolicy(forged), /computed policy differs from immutable Git input/);
  }
  const symbolic = snapshot();
  symbolic.entries.set(helper, { ...symbolic.entries.get(helper), mode: '120000' });
  await assert.rejects(() => validateSnapshotPolicy(symbolic), /missing\/unsafe source Git input/);
});

test('#1060 immutable dependency reads are memoized and reject a remote frontier before an API storm', async () => {
  const reader = registryReader(resolve('.'));
  let reads = 0;
  const candidate = { entries: snapshotEntries(reader.rows), read: path => { reads++; return reader.read(path); },
    readMany: paths => { reads += paths.length; return reader.readMany(paths); },
    inventory: JSON.parse(reader.text('scripts/ci-registry-inventory.json')),
    domains: JSON.parse(reader.text('scripts/ci-profile-paths.json')) };
  await Promise.all([validateSnapshotPolicy(candidate), validateSnapshotPolicy(candidate)]);
  assert.ok(reads > 32, 'real policy has a substantial closure');
  const firstReads = reads;
  await validateSnapshotPolicy(candidate);
  assert.equal(reads, firstReads + 2, 'only immutable parsed metadata is rechecked; dependency walk is memoized');
  const remote = { ...candidate, policyReadBudget: 32, read: path => {
    assert.ok(['scripts/ci-profile-paths.json', 'scripts/ci-registry-inventory.json'].includes(path));
    return reader.read(path);
  } };
  await assert.rejects(() => validateSnapshotPolicy(remote), /immutable read budget/);
});

test('#1060 registry API uses exact local Git policy rather than dirty files or remote per-file policy reads', async t => {
  const root = repository(t), sha = git(root, ['rev-parse', 'HEAD']), reader = registryReader(root, sha);
  put(root, 'scripts/ci-profile-paths.json', '{"product":["!**"]}');
  const calls = [], run = { id: 123, run_attempt: 1, status: 'completed', conclusion: 'success' };
  const source = registryApi({ repo: 'Matysh/houseplan-card', token: 'fixture', root, candidateSha: sha,
    fetchImpl: async url => {
      const path = String(url).split('/repos/Matysh/houseplan-card/')[1]; calls.push(path);
      const body = path.startsWith('git/trees/') ? { tree: reader.rows.map(row => ({ ...row, type: 'blob', sha: row.oid })) }
        : path.endsWith('/jobs?per_page=100') ? { jobs: [] }
          : path.endsWith('/artifacts?per_page=100') ? { artifacts: [] } : run;
      if (path.startsWith('contents/')) throw Error('policy must come from local immutable Git objects');
      return { ok: true, json: async () => body };
    } });
  // Reach the later independent artifact refusal: policy/equivalence passed,
  // but neither a cache hit nor local blobs can replace an actual CI artifact.
  await assert.rejects(() => source({ run: 123, attempt: 1, sha,
    job: 'frontend', workflow: '.github/workflows/validate.yml' }), /source immutable proof absent/);
  assert.equal(calls.some(path => path.startsWith('contents/')), false);
});

function partialRepository(t) {
  const source = repository(t), root = join(temporary(t), 'partial');
  const tests = Array.from({ length: 24 }, (_, index) => `test/cold-${index}.test.mjs`);
  for (const [index, path] of tests.entries()) put(source, path,
    `import '../demo/helpers/cold-helper.mjs';\nexport const caseId = ${index};\n`);
  put(source, 'demo/helpers/cold-helper.mjs', "import './cold-leaf.mjs';\nexport const helper = true;\n");
  put(source, 'demo/helpers/cold-leaf.mjs', 'export const leaf = true;\n');
  put(source, 'demo/golden/baselines/unrelated.png', Buffer.alloc(1024, 17));
  put(source, 'scripts/ci-profile-paths.json', JSON.stringify(profilePaths(tests,
    [...tests, 'demo/helpers/cold-helper.mjs', 'demo/helpers/cold-leaf.mjs'])));
  commit(source, 'cold tooling closure');
  git(source, ['config', 'uploadpack.allowFilter', 'true']);
  git(source, ['config', 'uploadpack.allowAnySHA1InWant', 'true']);
  git(source, ['clone', '--no-local', '--no-checkout', '--filter=blob:none', '--depth=1', pathToFileURL(source).href, root]);
  git(root, ['sparse-checkout', 'set', '--no-cone', '/scripts/', '/.github/workflows/', '/package.json',
    '/package-lock.json', '/.python-version', '/.nvmrc', '/pyproject.toml']);
  git(root, ['checkout', '--detach', 'HEAD']);
  assert.equal(git(root, ['config', 'remote.origin.promisor']), 'true');
  assert.equal(git(root, ['config', 'remote.origin.partialclonefilter']), 'blob:none');
  const localObjects = () => new Set(execFileSync('git', ['-C', root, 'cat-file', '--batch-all-objects',
    '--batch-check=%(objectname)'], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_NO_LAZY_FETCH: '1',
      GIT_ALLOW_PROTOCOL: '' } }).trim().split('\n'));
  const firstOid = git(source, ['rev-parse', 'HEAD:' + tests[0]]);
  assert.equal(localObjects().has(firstOid), false, 'fixture must really omit the promised test blob');
  assert.equal(existsSync(join(root, tests[0])), false, 'sparse checkout must omit the test');
  return { source, root, tests, localObjects };
}
async function traceGit(root, action) {
  const path = join(root, 'git-trace.json'), before = process.env.GIT_TRACE2_EVENT;
  process.env.GIT_TRACE2_EVENT = path;
  try { await action(); }
  finally { if (before === undefined) delete process.env.GIT_TRACE2_EVENT; else process.env.GIT_TRACE2_EVENT = before; }
  return readFileSync(path, 'utf8').trim().split('\n').map(line => JSON.parse(line))
    .filter(event => event.event === 'start' && event.argv.includes('fetch'));
}

test('#1062 actual sparse partial clone hydrates one immutable batch per dependency frontier', async t => {
  const { source, root, tests, localObjects } = partialRepository(t);
  const fetches = await traceGit(root, async () => {
    const reader = registryReader(root), candidate = { entries: snapshotEntries(reader.rows), read: reader.read,
      readMany: reader.readMany, domains: JSON.parse(reader.text('scripts/ci-profile-paths.json')),
      inventory: JSON.parse(reader.text('scripts/ci-registry-inventory.json')) };
    await validateSnapshotPolicy(candidate);
    await validateSnapshotPolicy(candidate);
    assert.equal(reader.text(tests[0]), readFileSync(join(source, tests[0]), 'utf8'));
    assert.deepEqual(identity(root, 'exact', { reader }).keys, identity(source).keys);
  });
  assert.equal(fetches.length, 3, '24 tests + helper + leaf are three batches, never 26 lazy fetches');
  assert.ok(fetches.every(event => event.argv.includes('--stdin') && event.argv.includes('--no-write-fetch-head')));
  const baselineOid = git(source, ['rev-parse', 'HEAD:demo/golden/baselines/unrelated.png']);
  assert.equal(localObjects().has(baselineOid), false, 'unrelated image bytes remain unhydrated');
});

test('#1062 offline partial clone refuses missing blobs after one bounded explicit fetch', async t => {
  const { root, tests, localObjects } = partialRepository(t);
  git(root, ['remote', 'set-url', 'origin', pathToFileURL(join(root, 'absent-origin')).href]);
  const reader = registryReader(root), before = localObjects().size;
  const fetches = await traceGit(root, () => {
    assert.throws(() => reader.readMany(tests));
    assert.throws(() => reader.readMany(['test/not-in-the-immutable-tree.mjs']), /missing\/symbolic input/);
  });
  assert.equal(fetches.length, 1, 'no hidden fetch per missing blob');
  assert.equal(localObjects().size, before);
});

test('#1062 immutable reader refuses unsafe modes, wrong blob bytes and an exhausted shared deadline', t => {
  const root = repository(t), path = 'test/unsafe.mjs';
  put(root, path, 'export const original = true;\n'); commit(root, 'unsafe fixture input');
  const oid = git(root, ['rev-parse', 'HEAD:' + path]);
  git(root, ['update-index', '--cacheinfo', `120000,${oid},${path}`]);
  git(root, ['commit', '-m', 'symbolic input mode']);
  assert.throws(() => registryReader(root).read(path), /missing\/symbolic input/);
  git(root, ['update-index', '--cacheinfo', `100644,${oid},${path}`]);
  git(root, ['commit', '-m', 'restore regular input mode']);
  const reader = registryReader(root), wrong = Buffer.from('counterfeit bytes\n');
  const objectFile = join(root, '.git', 'objects', oid.slice(0, 2), oid.slice(2));
  chmodSync(objectFile, 0o600);
  writeFileSync(objectFile, deflateSync(Buffer.concat([Buffer.from(`blob ${wrong.length}\0`), wrong])));
  assert.throws(() => reader.read(path), /bytes differ from immutable Git OID/);
  assert.throws(() => registryReader(root, 'HEAD', { deadline: Date.now() - 1 }), /deadline exceeded/);
  assert.throws(() => registryRemaining(NaN), /deadline exceeded/);
});

test('#1062 stalled explicit hydration is stopped by the remaining deadline', async t => {
  const { root, tests } = partialRepository(t);
  const script = join(root, 'slow-upload-pack.mjs'), pidPath = join(root, 'slow-upload-pack.pid');
  writeFileSync(script, `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(pidPath)}, String(process.pid));\nsetTimeout(() => {}, 5000);\n`);
  const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
  git(root, ['config', 'remote.origin.uploadpack', `${quote(process.execPath)} ${quote(script)}`]);
  const reader = registryReader(root, 'HEAD', { deadline: Date.now() + 800 });
  const started = Date.now();
  try {
    assert.throws(() => reader.readMany(tests), error => error.code === 'ETIMEDOUT');
    assert.ok(Date.now() - started < 2500, 'synchronous Git must not outlive the probe budget');
    assert.throws(() => reader.read(tests[0]), /deadline exceeded/);
  } finally {
    // The transport fixture is a grandchild of Git. Clean its explicit PID on
    // Windows too; the timing assertion above already measured the real return.
    if (existsSync(pidPath)) {
      try { process.kill(Number(readFileSync(pidPath, 'utf8')), 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
});
