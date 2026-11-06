import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testCatalog, selectTaskTests, planRequirements, selectionText, chooseOptionalChecks } from '../lib/task-selection.mjs';
import { planProfile, inventory, CRITICAL_NODE } from '../lib/catalog.mjs';
import { runPlan } from '../lib/runner.mjs';
import { normalizeFallbackRequest } from '../templates/prepare-fallback.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
async function fixture(files, run) {
    const dir = await mkdtemp(resolve(tmpdir(), 'hp-selection-'));
    try {
        for (const [path, text] of Object.entries(files)) {
            await mkdir(dirname(resolve(dir, path)), { recursive: true });
            await writeFile(resolve(dir, path), text);
        }
        return await run(dir);
    }
    finally {
        await rm(dir, { recursive: true, force: true });
    }
}
const select = (root, options = {}) => selectTaskTests({ root, inventory, track: 'ship', layer: 'product', ...options });
test('catalog covers current active files/scenes/lifecycles and preserves explicit unknowns', async () => {
    const c = await testCatalog(root, inventory);
    assert.equal(new Set(c.rows.map(r => r.id)).size, c.rows.length);
    for (const type of ['node', 'backend', 'browser', 'golden', 'ha-e2e', 'converter', 'background'])
        assert.ok(c.rows.some(r => r.type === type), type);
    assert.ok(c.components.length > 20);
    assert.equal(c.counts.executedCases, null);
    assert.ok(c.rows.every(r => !r.path.startsWith('legacy/')));
    assert.ok(c.rows.some(r => r.path === 'process-next/test/task-selection.test.mjs'));
    for (const row of c.rows)
        assert.ok(row.domains.length || c.gaps.some(g => g.id === row.id), 'unclassified is visible');
});
test('track depth follows components and relations; core geometry is broad even on Ship', async () => fixture({
    'src/wall-fixture.ts': 'export const x=1;',
    'test/wall-main.test.mjs': "import '../test-build/wall-fixture.js';",
    'test/history-case.test.mjs': '', 'test/pdf-example.test.mjs': '', 'test/render-view.test.mjs': '',
    'test/isometric-example.test.mjs': '', 'test/config-storage.test.mjs': '',
    'demo/smoke_direct_wall_geometry.mjs': '',
}, async (dir) => {
    const ship = await select(dir, { changedFiles: ['src/wall-fixture.ts'] }), show = await select(dir, { changedFiles: ['src/wall-fixture.ts'], track: 'show' }), ask = await select(dir, { changedFiles: ['src/wall-fixture.ts'], track: 'ask' });
    assert.ok(ship.files.includes('test/wall-main.test.mjs'));
    assert.ok(ship.files.includes('demo/smoke_direct_wall_geometry.mjs'));
    assert.ok(show.files.includes('test/history-case.test.mjs'));
    assert.ok(ask.files.includes('test/pdf-example.test.mjs'));
    assert.ok(ship.files.length < show.files.length);
    assert.ok(show.files.length <= ask.files.length);
    assert.ok(ask.explanation.reasons['test/pdf-example.test.mjs'].some(r => r.includes('ask')));
}));
test('unknown new product sources select all fast Node, flag the gap and never schedule release sets', async () => fixture({
    'src/unmapped-new-feature.ts': '', 'test/one.test.mjs': '', 'test/two.test.mjs': '', 'demo/smoke_one.mjs': '',
}, async (dir) => {
    const result = await select(dir, { changedFiles: ['src/unmapped-new-feature.ts'] });
    assert.deepEqual(result.files, ['test/one.test.mjs', 'test/two.test.mjs']);
    assert.ok(result.explanation.gaps.some(g => g.path === 'src/unmapped-new-feature.ts'));
    assert.equal(result.explanation.executedCases, null);
    assert.equal(result.explanation.cost.expectedTotalMs, null);
    const plan = await planProfile({ root: dir, changedFiles: ['src/unmapped-new-feature.ts'] });
    assert.equal(plan.steps.some(s => /golden|e2e|mutation|converter/.test(s.id)), false);
}));
test('static readers include both sides of import cycles without wildcard fanout', async () => fixture({
    'src/light-a.ts': "import './light-b'; export const a=1;", 'src/light-b.ts': "import './light-a.js'; export const b=2;",
    'test/plain-a.test.mjs': "import '../test-build/light-a.js';", 'test/plain-b.test.mjs': "import '../test-build/light-b.js';",
    'test/tree-reader.test.mjs': "import {readdirSync} from 'node:fs'; readdirSync('src');",
}, async (dir) => {
    const result = await select(dir, { changedFiles: ['src/light-a.ts'] });
    assert.ok(result.files.includes('test/plain-a.test.mjs'));
    assert.ok(result.files.includes('test/plain-b.test.mjs'));
    assert.ok(!result.files.includes('test/tree-reader.test.mjs'));
    assert.ok(result.explanation.reasons['test/plain-b.test.mjs'].some(r => r.includes('Читает')));
}));
test('deleted and renamed source paths still contribute their old domain', async () => fixture({
    'src/decor-new.ts': '', 'test/wall-existing.test.mjs': '', 'test/decor-new.test.mjs': '',
}, async (dir) => {
    const plan = await planProfile({ root: dir, track: 'show', changedFiles: ['src/wall-deleted.ts', 'src/decor-new.ts'] });
    assert.ok(plan.selection.domains.includes('geometry'));
    assert.ok(plan.selection.domains.includes('decor'));
    assert.ok(plan.steps.some(s => s.command?.includes('test/wall-existing.test.mjs')));
    await assert.rejects(planProfile({ root: dir, areaTests: ['test/missing.test.mjs'] }), /ENOENT/);
}));
test('changed tests are automatically included even when no product source changed', async () => fixture({
    'test/decor-new.test.mjs': '',
}, async (dir) => assert.ok((await select(dir, { changedFiles: ['test/decor-new.test.mjs'] })).files.includes('test/decor-new.test.mjs'))));
test('automatically selected backend controls fallback preparation from the actual plan', async () => fixture({
    'src/config-change.ts': '', 'tests_backend/test_storage.py': 'def test_x(): pass',
}, async (dir) => {
    const plan = await planProfile({ root: dir, changedFiles: ['src/config-change.ts'] });
    assert.ok(plan.steps.some(s => s.id.startsWith('affected-backend:')));
    const local = planRequirements(plan);
    assert.equal(local.needsBackend, true);
    assert.equal(local.needsPython, true);
    const hosted = normalizeFallbackRequest({ event: 'task', changedFiles: ['src/config-change.ts'] }, { workspace: dir, candidate: 'a'.repeat(40), plan });
    assert.equal(hosted.needsBackend, local.needsBackend);
    assert.equal(hosted.needsBrowser, local.needsBrowser);
}));
test('Python static imports provide reverse links without a TS build', async () => fixture({
    'custom_components/houseplan/vacuum_helper.py': 'def value(): return 1',
    'tests_backend/test_robot.py': 'from custom_components.houseplan.vacuum_helper import value',
}, async (dir) => assert.ok((await select(dir, { changedFiles: ['custom_components/houseplan/vacuum_helper.py'] })).files.includes('tests_backend/test_robot.py'))));
test('pure documentation remains empty for all tracks even with unusable inputs', async () => {
    for (const track of ['ship', 'show', 'ask']) {
        const p = await planProfile({ root: '/nonexistent-selection-root', layer: 'docs', track, areaTests: ['invalid'], changedFiles: ['invalid'] });
        assert.deepEqual(p.steps, []);
        assert.equal(p.selection, undefined);
    }
});
test('infra selection executes only a related mechanism; mixed changes include both parts', async () => fixture({
    'process-next/lib/queue-helper.mjs': 'export const x=1;', 'process-next/test/helper.test.mjs': "import '../lib/queue-helper.mjs';",
    'src/ui-view.ts': '', 'test/ui-view.test.mjs': '',
}, async (dir) => {
    const infra = await planProfile({ root: dir, layer: 'infra', changedFiles: ['process-next/lib/queue-helper.mjs'] });
    assert.ok(infra.steps.some(s => s.command?.includes('process-next/test/helper.test.mjs')));
    assert.ok(!infra.steps.some(s => s.id === 'product-build'));
    const mixed = await planProfile({ root: dir, layer: 'product', changedFiles: ['process-next/lib/queue-helper.mjs', 'src/ui-view.ts'] });
    assert.ok(mixed.steps.some(s => s.id === 'product-build'));
    assert.ok(mixed.steps.some(s => s.id === 'infra-syntax'));
    assert.ok(mixed.steps.some(s => s.command?.includes('process-next/test/helper.test.mjs')));
}));
test('expanding the same plan executes only missing units; metadata does not erase reuse or case counts', async () => fixture({
    'scripts/local-helper.mjs': 'export const x=1;', 'test/a.test.mjs': '', 'test/b.test.mjs': '',
}, async (dir) => {
    const request = { root: dir, layer: 'infra', changedFiles: ['scripts/local-helper.mjs'] }, stateDir = resolve(dir, 'state');
    let calls = [];
    const execute = async (s) => { calls.push(s.id); return { status: 'passed', code: 0, counts: s.id.startsWith('infra-behavior:') ? { tests: 5, passed: 5, failed: 0 } : {} }; };
    const first = await planProfile({ ...request, areaTests: ['test/a.test.mjs'] });
    const a = await runPlan(first, { root: dir, stateDir, execute });
    assert.equal(a.status, 'passed');
    assert.equal(a.results.find(r => r.id === first.steps.find(s => s.command.includes('test/a.test.mjs')).id).counts.tests, 5);
    calls = [];
    const next = await planProfile({ ...request, areaTests: ['test/a.test.mjs', 'test/b.test.mjs'] });
    const b = await runPlan(next, { root: dir, stateDir, execute });
    assert.deepEqual(calls, [next.steps.find(s => s.command.includes('test/b.test.mjs')).id]);
    assert.equal(b.results.find(r => r.id === next.steps.find(s => s.command.includes('test/a.test.mjs')).id).status, 'reused');
    calls = [];
    next.selection.domains = ['renamed metadata'];
    const c = await runPlan(next, { root: dir, stateDir, execute });
    assert.deepEqual(calls, []);
    assert.equal(c.selection.domains[0], 'renamed metadata');
    assert.match(selectionText(next.selection, c), /известные кейсы 10/);
    assert.equal(c.selection.executedCases, null, 'planning never invents runtime counts');
}));
test('fixture-owned generated files do not demand a product build; real consumers retain the guard', async () => fixture({
    'scripts/fake-reader.mjs': "import {readFileSync} from 'node:fs'; export const read=()=>readFileSync('dist/houseplan-assets.json');",
    'test/coverage-diagnostic.test.mjs': "import '../scripts/fake-reader.mjs';", 'test/real-consumer.test.mjs': "import '../scripts/fake-reader.mjs';",
}, async (dir) => {
    const p = await planProfile({ root: dir, layer: 'infra', areaTests: ['test/coverage-diagnostic.test.mjs'] });
    assert.equal(p.steps.length, 1);
    assert.equal(p.steps[0].fixtureArtifacts, true);
    await assert.rejects(planProfile({ root: dir, layer: 'infra', areaTests: ['test/real-consumer.test.mjs'] }), /prepared product artifacts/);
}));
test('optional budgets respect relevance priority and uncertainty, never trim mandatory units', () => {
    const candidates = [{ path: 'b', priority: 2, durationMs: 10 }, { path: 'a', priority: 1, durationMs: 20 }, { path: 'unknown', priority: 3 }];
    assert.deepEqual(chooseOptionalChecks(candidates, { budgetMs: 40, mandatoryMs: 20, mandatoryUnknown: 0 }).selected, ['a']);
    assert.deepEqual(chooseOptionalChecks(candidates, { budgetMs: 1000, mandatoryMs: 20, mandatoryUnknown: 1 }).selected, []);
    assert.deepEqual(chooseOptionalChecks([{ path: 'a', priority: 1, durationMs: 10 }, { path: 'a', priority: 2, durationMs: 10 }], { budgetMs: 100, mandatoryMs: 0, mandatoryUnknown: 0 }).selected, ['a'], 'one optional unit cannot consume the budget twice');
});
test('external inventory exposes new sources and ignores archived companion legacy', async () => fixture({
    'tests/brand-new.admin.spec.mjs': '', 'tests/legacy/ignored.admin.spec.mjs': '',
}, async (dir) => {
    const c = await testCatalog(root, inventory, { e2eRoot: dir });
    assert.equal(c.external.verified, true);
    assert.ok(c.gaps.some(g => g.id === 'e2e-source:tests/brand-new.admin.spec.mjs'));
    assert.ok(!c.external.changedFiles.some(p => p.startsWith('tests/legacy/')));
    assert.ok(c.rows.some(r => r.type === 'ha-setup'));
    assert.equal(c.rows.filter(r => r.type === 'ha-e2e').length, 93);
}));
test('recognized sources with incomplete static links receive the full nearest fast component', async () => fixture({
    'src/vacuum-new.ts': '', 'test/vacuum-unreferenced.test.mjs': '',
}, async (dir) => {
    const p = await select(dir, { changedFiles: ['src/vacuum-new.ts'] });
    assert.ok(p.files.includes('test/vacuum-unreferenced.test.mjs'));
    assert.ok(p.explanation.gaps.some(g => g.path === 'src/vacuum-new.ts' && g.reason.includes('ближайших')));
}));
test('Show checks every immediate relation contract; Ask adds full related fast sets', async () => fixture({
    'src/device-options.ts': '', 'test/device-options.test.mjs': "import '../test-build/device-options.js';",
    'test/climate-refusal.test.mjs': '', 'test/climate-normal.test.mjs': '', 'demo/smoke_room_co2.mjs': '',
}, async (dir) => {
    const show = await select(dir, { track: 'show', changedFiles: ['src/device-options.ts'] }), ask = await select(dir, { track: 'ask', changedFiles: ['src/device-options.ts'] });
    assert.ok(show.files.includes('test/climate-refusal.test.mjs'));
    assert.ok(show.files.includes('demo/smoke_room_co2.mjs'));
    assert.ok(!show.files.includes('test/climate-normal.test.mjs'));
    assert.ok(ask.files.includes('test/climate-normal.test.mjs'));
}));
test('one parameterized Node file reports five executed cases, not one file or declaration', async () => fixture({
    'test/parameters.test.mjs': "import test from 'node:test'; import assert from 'node:assert/strict'; for(let i=0;i<5;i++)test('variant '+i,()=>assert.ok(i>=0));",
}, async (dir) => {
    const plan = await planProfile({ root: dir, layer: 'infra', areaTests: ['test/parameters.test.mjs'] });
    const report = await runPlan(plan, { root: dir, stateDir: resolve(dir, 'state') });
    assert.equal(report.status, 'passed');
    assert.equal(report.results[0].counts.tests, 5);
    assert.equal(plan.selection.files, 1);
}));
