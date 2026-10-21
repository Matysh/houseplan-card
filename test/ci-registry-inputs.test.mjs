import test from 'node:test';
import { fixtureVersions as versions } from './helpers/ci-registry-version-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { registryInputs, registryReader, REGISTRY_JOBS, maskJsonScalars, versionNormalizer, jobRecipe, registryProtocolFiles } from '../scripts/ci-registry-inputs.mjs';
import { profilePaths } from '../scripts/ci-profile-paths.mjs';
import { registryInventory } from '../scripts/ci-registry-inventory.mjs';
import { generatedProfiles } from '../scripts/ci-profiles.mjs';
import { producerRecipe } from '../scripts/ci-registry-cli.mjs';
import { verifyRegistryBuild, restoreRegistryBuild, runCandidateCommand } from '../scripts/ci-registry-build.mjs';
import { artifactTree } from '../scripts/artifact-inventory.mjs';
import { sourceEquivalenceCommon, sourceEquivalenceJob } from '../scripts/ci-registry-equivalence.mjs';

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
