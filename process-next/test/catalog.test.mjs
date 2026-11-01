import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planProfile, inventory, CRITICAL_NODE, BETA_SMOKES, BETA_GOLDEN, BETA_E2E } from '../lib/catalog.mjs';
import { selectExact, BETA_PANEL_GOLDEN, BETA_LOVELACE_GOLDEN } from '../catalog/selections.mjs';
import { prepareGoldenSelection } from '../catalog/golden-selection.mjs';
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

test('beta uses approved files, one narrowed permission run and panel-first visual selection', async () => {
  const plan = await planProfile({ root, event: 'beta', version: '1.85.0-beta.1' });
  assert.equal(BETA_SMOKES.length, 13); assert.equal(BETA_GOLDEN.length, 25); assert.equal(BETA_E2E.length, 13);
  assert.equal(plan.steps.filter(item => item.id.startsWith('smoke:')).length, 13);
  assert.deepEqual(BETA_SMOKES.find(item => item.file.includes('view_edit_permissions')).args, ['--only=late']);
  const { beta } = prepareGoldenSelection(GOLDEN_SCENARIOS);
  assert.equal(beta.filter(scene => scene.panelHost).length, 22);
  assert.equal(beta.filter(scene => !scene.panelHost).length, 3);
  const golden = plan.steps.find(item => item.id === 'golden-beta');
  assert.ok(golden.inputs.includes('process-next/catalog/golden-selection.mjs'));
  assert.ok(golden.inputs.includes('process-next/catalog/selections.mjs'));
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
  assert.deepEqual(beta.filter(scene => !scene.panelHost).map(scene => scene.id), BETA_LOVELACE_GOLDEN);
  assert.ok(beta.some(scene => scene.panelHost && scene.viewport.width === 390 && !scene.panelKioskUrl));
  for (const mode of ['plan', 'devices', 'decor']) assert.ok(beta.some(scene => scene.panelHost && scene.mode === mode));
  for (const variant of beta.filter(scene => scene.sourceSceneId)) {
    const source = GOLDEN_SCENARIOS.find(scene => scene.id === variant.sourceSceneId);
    assert.deepEqual(variant, { ...source, id: `panel-${source.id}`, panelHost: true, sourceSceneId: source.id });
    assert.ok(!all.some(scene => scene.id === source.id), 'no duplicate full Lovelace matrix');
    assert.ok(!GOLDEN_SCENARIOS.some(scene => scene.id === variant.id), 'never silently reuse a card PNG');
    assert.ok(!source.panelHost, 'active matrix not mutated');
  }
});

test('exact selectors reject renamed, duplicated and file/title cross-product journeys', () => {
  const chosen = [{ file: 'a', title: 'Save' }, { file: 'b', title: 'Copy' }];
  assert.deepEqual(selectExact([...chosen, { file: 'a', title: 'Save later' }], chosen), chosen);
  assert.throws(() => selectExact([{ file: 'a', title: 'Copy' }, { file: 'b', title: 'Save' }], chosen), /exactly one/);
  assert.throws(() => selectExact([chosen[0], chosen[0]], [chosen[0]]), /found 2/);
  assert.throws(() => selectExact(chosen, []), /nonempty/);
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

test('migration inventory accounts for every existing Node test, without deleting originals or running tooling on releases', async () => {
  const actual = (await readdir(resolve(root, 'test'))).filter(name => name.endsWith('.test.mjs')).map(name => `test/${name}`).sort();
  assert.deepEqual(inventory.entries.filter(row => row.path.startsWith('test/')).map(row => row.path).sort(), actual);
  const rows = inventory.entries.filter(row => row.kind === 'infrastructure');
  assert.ok(rows.some(row => row.decision === 'retire'));
  assert.ok(rows.every(row => row.automaticReleaseRun === false));
  assert.equal(inventory.entries.find(row => row.path === 'test/plan-converter.test.mjs').kind, 'product');
  assert.equal(inventory.entries.find(row => row.path === 'test/converter-consumers.test.mjs').kind, 'converter');
});
