import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planProfile, discoverReleaseTests, inventory, CRITICAL_NODE, BETA_SMOKES, BETA_GOLDEN, BETA_E2E } from '../lib/catalog.mjs';
import { selectExact, BETA_PANEL_GOLDEN, BETA_LOVELACE_GOLDEN, BETA_STATIC_GOLDEN, GOLDEN_ADDITIONS } from '../catalog/selections.mjs';
import { prepareGoldenSelection, goldenHarnessScenario, goldenRunSelection } from '../catalog/golden-selection.mjs';
import { GOLDEN_SCENARIOS } from '../../demo/golden/matrix.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('pure docs creates no preparation, test or unavailable gate, including after-review', async () => {
  const plan = await planProfile({ root, event: 'fix', layer: 'docs', issue: 1105, areaTests: ['not-a-file'] });
  assert.deepEqual(plan.steps, []);
  assert.match(plan.name, /правки после ревью/);
});

test('product minimum builds once, protects data/rights and opens one saved View', async () => {
  const plan = await planProfile({ root, issue: 1105 });
  assert.equal(plan.steps.filter(item => item.id === 'product-build').length, 1);
  const critical = plan.steps.find(item => item.id === 'critical-data-rights');
  assert.deepEqual(critical.command.slice(3), CRITICAL_NODE);
  assert.equal(CRITICAL_NODE.length, 8);
  assert.deepEqual(plan.steps.find(item => item.id === 'startup-view').requires, ['demo-assets']);
  assert.equal(plan.steps.filter(item => item.id.startsWith('smoke:')).length, 0);
  assert.ok(plan.steps.find(item => item.id === 'test-build').outputs.includes('test-build'));
  assert.ok(plan.steps.find(item => item.id === 'product-build').outputs.length);
  const demo = plan.steps.find(item => item.id === 'demo-assets');
  assert.ok(demo.outputs.includes('demo/srv/assets/icons.js'));
  for (const input of ['demo/gen_icons.mjs', ['src', 'houseplan-card.ts'].join('/'), 'demo/fixtures/sun-transparent.json', 'demo/srv/demo.html'])
    assert.ok(demo.inputs.includes(input), `icon fixture preparation must notice ${input}`);
  assert.ok(!demo.inputs.includes(['demo', 'srv', 'assets', 'houseplan-assets.json'].join('/')));
  assert.ok(!demo.inputs.includes(['demo', '**', '*.json'].join('/')));
});

test('infrastructure checks only changed syntax and selected mechanism, with no product preparation', async () => {
  const temp = await mkdtemp(resolve(tmpdir(), 'hp-catalog-'));
  try {
    await mkdir(resolve(temp, 'scripts')); await mkdir(resolve(temp, 'test'));
    await writeFile(resolve(temp, 'scripts/queue.mjs'), 'export const queue = 1;');
    await writeFile(resolve(temp, 'test/queue.test.mjs'), '');
    const plan = await planProfile({ root: temp, layer: 'infra', changedFiles: ['scripts/queue.mjs'], areaTests: ['test/queue.test.mjs'] });
    assert.deepEqual(plan.steps.map(item => item.id), ['infra-syntax', 'infra-behavior']);
    assert.deepEqual(plan.steps[1].command, ['node', '--test', '--test-reporter=tap', 'test/queue.test.mjs']);
    assert.ok(plan.steps.every(item => !item.inputs.some(path => path.startsWith('src/'))));
    await assert.rejects(planProfile({ root: temp, layer: 'infra', areaTests: ['../outside.test.mjs'] }), /relative path/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('infrastructure can check finish and its planner without consuming declared product outputs', async () => {
  const plan = await planProfile({ root, layer: 'infra',
    changedFiles: ['process-next/cli.mjs', 'process-next/remote.mjs', 'process-next/lib/catalog.mjs'],
    areaTests: ['process-next/test/remote.test.mjs', 'process-next/test/catalog.test.mjs'] });
  assert.deepEqual(plan.steps.map(item => item.id), ['infra-syntax', 'infra-behavior']);
  assert.ok(plan.steps.every(item => item.requires.length === 0));
  assert.ok(plan.steps[1].inputs.includes('process-next/lib/catalog.mjs'));
  assert.ok(plan.steps.every(item => !item.inputs.includes(['demo', '**', '*.json'].join('/'))),
    'negative metadata assertions must not include generated manifests in source identities');
  // Actual artifact consumers must still declare preparation; only catalog declarations are metadata.
  await assert.rejects(planProfile({ root, layer: 'infra', areaTests: ['test/bundle-assets.test.mjs'] }), /prepared product artifacts/);
});

test('#1196 a transitive built-manifest reader declares its producer even before dist exists', async () => {
  const temp = await mkdtemp(resolve(tmpdir(), 'hp-built-reader-'));
  try {
    await mkdir(resolve(temp, 'scripts')); await mkdir(resolve(temp, 'test'));
    const manifest = ['dist', 'houseplan-assets.json'].join('/');
    const helper = 'scripts/read-built.mjs', consumer = 'test/built-asset.test.mjs';
    await writeFile(resolve(temp, helper), `import { readFileSync } from 'node:fs';\nexport const read = () => readFileSync(${JSON.stringify(manifest)}, 'utf8');\n`);
    await writeFile(resolve(temp, consumer), "import { read } from '../scripts/read-built.mjs';\n");
    const plan = await planProfile({ root: temp, areaTests: [consumer] });
    const check = plan.steps.find(item => item.id === 'affected-node');
    assert.ok(check.inputs.includes(helper), 'the imported reader stays in the source identity');
    assert.ok(check.requires.includes('product-build'), 'built-manifest consumer waits for product-build');
    assert.ok(!check.inputs.includes(manifest), 'generated manifest is not a source/cache input');
    const metadataTest = 'test/metadata.test.mjs';
    await writeFile(resolve(temp, metadataTest), 'export {};\n');
    const infra = await planProfile({ root: temp, layer: 'infra', changedFiles: [helper], areaTests: [metadataTest] });
    assert.deepEqual(infra.steps.map(item => item.id), ['infra-syntax', 'infra-behavior']);
    assert.ok(infra.steps.every(item => item.inputs.includes(helper)), 'changed code remains a hashed input');
    assert.ok(infra.steps.every(item => item.requires.length === 0), 'hashing/syntax does not execute changed code');
    await assert.rejects(planProfile({ root: temp, layer: 'infra', areaTests: [consumer] }), /prepared product artifacts/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
test('beta uses approved files, one narrowed permission run and panel-first visual selection', async () => {
  const plan = await planProfile({ root, event: 'beta', version: '1.85.0-beta.1' });
  assert.equal(BETA_SMOKES.length, 13); assert.equal(BETA_GOLDEN.length, 75); assert.equal(BETA_E2E.length, 13);
  assert.equal(Object.values(GOLDEN_ADDITIONS).flat().length, 50);
  assert.equal(plan.steps.filter(item => item.id.startsWith('smoke:')).length, 13);
  assert.deepEqual(BETA_SMOKES.find(item => item.file.includes('view_edit_permissions')).args, ['--only=late']);
  const { beta } = prepareGoldenSelection(GOLDEN_SCENARIOS);
  assert.equal(beta.filter(scene => scene.panelHost).length, 61);
  assert.equal(beta.filter(scene => !scene.panelHost && !scene.staticWallOpenings).length, 13);
  assert.equal(beta.filter(scene => scene.staticWallOpenings).length, 1);
  const golden = plan.steps.find(item => item.id === 'golden-beta');
  assert.ok(golden.inputs.includes('process-next/catalog/golden-selection.mjs'));
  assert.ok(golden.inputs.includes('process-next/catalog/selections.mjs'));
  for (const check of plan.steps.filter(item => item.id.startsWith('smoke:') || item.id === 'golden-beta')) {
    assert.ok(check.inputs.includes('process-next/catalog/prepare.mjs'), `${check.id} must notice preparation implementation changes`);
    assert.ok(check.preparationCommands.some(item => item.id === 'product-build'));
  }
  assert.ok(!plan.steps.some(item => item.id === 'backend-coverage-threshold' || item.id === 'converters-stable'));
  assert.ok(plan.steps.filter(item => item.id.startsWith('e2e-')).every(item => item.command === null && item.unavailable && !item.diagnostic));
  assert.ok(plan.steps.every(item => item.inputs.every(path => !/^dist(?:\/|$)|^artifacts(?:\/|$)|__pycache__/.test(path))), 'generated artifacts must not invalidate source identities');
  const assetConsumer = plan.steps.find(item => item.command?.includes('test/bundle-assets.test.mjs'));
  assert.ok(assetConsumer.requires.includes('product-build'), 'tests reading built assets wait for the actual producer');
});

test('panel variants keep fixture contracts, own baseline IDs, and replace the old host in stable', () => {
  const { beta, rest, all } = prepareGoldenSelection(GOLDEN_SCENARIOS);
  assert.equal(all.length, GOLDEN_SCENARIOS.length);
  assert.equal(new Set([...beta, ...rest].map(scene => scene.id)).size, all.length);
  assert.deepEqual(beta.filter(scene => scene.panelHost).map(scene => scene.id), BETA_PANEL_GOLDEN);
  assert.deepEqual(beta.filter(scene => !scene.panelHost && !scene.staticWallOpenings).map(scene => scene.id), BETA_LOVELACE_GOLDEN);
  assert.deepEqual(beta.filter(scene => scene.staticWallOpenings).map(scene => scene.id), BETA_STATIC_GOLDEN);
  assert.ok(beta.some(scene => scene.panelHost && scene.viewport.width === 390 && !scene.panelKioskUrl));
  for (const mode of ['plan', 'devices', 'decor']) assert.ok(beta.some(scene => scene.panelHost && scene.mode === mode));
  for (const variant of beta.filter(scene => scene.sourceSceneId)) {
    const source = GOLDEN_SCENARIOS.find(scene => scene.id === variant.sourceSceneId);
    assert.deepEqual(variant, { ...source, id: `panel-${source.id}`, panelHost: true, sourceSceneId: source.id });
    assert.ok(!all.some(scene => scene.id === source.id), 'no duplicate full Lovelace matrix');
    assert.ok(!GOLDEN_SCENARIOS.some(scene => scene.id === variant.id), 'never silently reuse a card PNG');
    assert.ok(!source.panelHost, 'active matrix not mutated');
    assert.equal(variant.iconSize, undefined, 'panel must not silently drop public card configuration');
    assert.equal(variant.rotation, undefined);
    assert.ok(!variant.kiosk && !variant.firstSpace && !variant.batteryBoard);
    const runtime = goldenHarnessScenario(variant);
    assert.deepEqual(runtime, { ...variant, id: source.id });
    assert.equal(variant.id, `panel-${source.id}`, 'runtime alias must not change baseline identity');
  }
  const opening = beta.find(scene => scene.sourceSceneId === 'opening-placement-door-thick-wall-dark');
  assert.equal(goldenHarnessScenario(opening).id, 'opening-placement-door-thick-wall-dark', 'retain ID-keyed settle/repaint');
});

test('exact selectors reject renamed, duplicated and file/title cross-product journeys', () => {
  const chosen = [{ file: 'a', title: 'Save' }, { file: 'b', title: 'Copy' }];
  assert.deepEqual(selectExact([...chosen, { file: 'a', title: 'Save later' }], chosen), chosen);
  assert.throws(() => selectExact([{ file: 'a', title: 'Copy' }, { file: 'b', title: 'Save' }], chosen), /exactly one/);
  assert.throws(() => selectExact([chosen[0], chosen[0]], [chosen[0]]), /found 2/);
  assert.throws(() => selectExact(chosen, []), /nonempty/);
});

test('addressed golden verification uses the canonical panel identity without widening the run', () => {
  const { beta, rest } = prepareGoldenSelection(GOLDEN_SCENARIOS);
  const panel = beta.find(scene => scene.sourceSceneId);
  const selected = goldenRunSelection(GOLDEN_SCENARIOS, [`--scenario=${panel.id}`, '--mode=verify']);
  assert.deepEqual(selected.scenarios, [panel]);
  assert.throws(() => goldenRunSelection(GOLDEN_SCENARIOS, [`--scenario=${panel.sourceSceneId}`]), /Unknown or empty/);
  assert.throws(() => goldenRunSelection(GOLDEN_SCENARIOS, ['--selection=beta', `--scenario=${rest[0].id}`]), /Unknown or empty/);
  assert.deepEqual(goldenRunSelection(GOLDEN_SCENARIOS, ['--selection=beta', '--mode=capture']).scenarios, beta);
});

test('stable retains beta identities for reuse and separates converter failure from the core', async () => {
  const beta = await planProfile({ root, event: 'beta' });
  const stable = await planProfile({ root, event: 'stable' });
  for (const id of ['product-build', 'product-node:devices', 'product-backend', 'golden-beta']) {
    assert.deepEqual(stable.steps.find(item => item.id === id), beta.steps.find(item => item.id === id));
  }
  const diagnostic = stable.steps.find(item => item.id === 'converters-stable');
  assert.equal(diagnostic.command, null); assert.equal(diagnostic.diagnostic, true); assert.match(diagnostic.unavailable, /1179/);
  assert.ok(stable.steps.some(item => item.id === 'backend-coverage-threshold'));
  assert.ok(!stable.steps.some(item => item.id.startsWith('mutation') || item.id === 'infra-behavior'));
});

test('release discovery excludes the retired process and addressed infrastructure tests', () => {
  const rows = inventory.entries.filter(row => row.kind === 'infrastructure');
  assert.ok(rows.some(row => row.decision === 'retire'));
  assert.ok(rows.every(row => row.automaticReleaseRun === false));
  const discovered = new Set(discoverReleaseTests(root).map(row => row.path));
  assert.ok(rows.every(row => !discovered.has(row.path)));
  assert.equal(inventory.entries.find(row => row.path === 'test/plan-converter.test.mjs').kind, 'product');
  assert.equal(inventory.entries.find(row => row.path === 'test/converter-consumers.test.mjs').kind, 'converter');
});

test('new product/backend/browser tests are discovered without regenerating the migration snapshot', async t => {
  const temp = await mkdtemp(resolve(tmpdir(), 'hp-discovery-'));
  t.after(() => rm(temp, { recursive: true, force: true }));
  for (const dir of ['test', 'tests_backend', 'demo']) await mkdir(resolve(temp, dir));
  for (const file of ['test/future.test.mjs', 'tests_backend/test_future.py', 'demo/smoke_future.mjs', 'test/action-pins.test.mjs']) await writeFile(resolve(temp, file), '');
  const rows = discoverReleaseTests(temp);
  assert.deepEqual(rows.map(row => row.kind), ['product', 'backend', 'browser']);
  assert.ok(!rows.some(row => row.path.includes('action-pins')));
  const stable = await planProfile({ root, event: 'stable' });
  const metric = stable.steps.find(step => step.id === 'release-measurements');
  assert.ok(metric.command && metric.diagnostic && metric.alwaysRun);
  const ship = await planProfile({ root, track: 'ship', issue: 1105 });
  assert.match(ship.name, /перед слиянием/);
});
