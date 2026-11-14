import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, copyFile } from 'node:fs/promises';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testCatalog, selectTaskTests, planRequirements, selectionText, chooseOptionalChecks, domainsOf } from '../lib/task-selection.mjs';
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
test('#1395 explicit input policies select critical security ingress regressions', async () => fixture({
    'custom_components/houseplan/core/input_policy.py': 'STRICT=True',
    'tests_backend/test_input_policy.py': '',
    'tests_backend/test_input_archive_security.py': '',
    'tests_backend/test_ha_input_security.py': '',
}, async dir => {
    const catalog = await testCatalog(dir, inventory);
    const selection = await select(dir, { track: 'ask', changedFiles: ['custom_components/houseplan/core/input_policy.py'] });
    for (const path of ['tests_backend/test_input_policy.py', 'tests_backend/test_input_archive_security.py', 'tests_backend/test_ha_input_security.py']) {
        const row = catalog.rows.find(row => row.path === path);
        assert.ok(row.domains.includes('security'), path);
        assert.equal(row.importance, 'critical', path);
        assert.ok(JSON.stringify(selection).includes(path), path);
    }
}));
test('#1391 extracted core owners and its addressed readers have inherited domains', () => {
    for (const file of ['custom_components/houseplan/core/constants.py',
        'custom_components/houseplan/core/ports.py', 'custom_components/houseplan/core/file_usage.py',
        'tests_backend/test_core_boundary.py', 'tests_backend/test_sh3d_import_preview.py'])
        assert.ok(domainsOf(file).includes('storage'), file);
    for (const file of ['test/core-source-readers.test.mjs', 'test/backend-test-hygiene.test.mjs',
        'tests_backend/test_backend_quality.py', 'pyproject.toml'])
        assert.ok(domainsOf(file).includes('toolchain'), file);
    assert.deepEqual(domainsOf('custom_components/houseplan/core/unmapped-feature.py'), []);
});
test('#1024 opening writer/basis checks are critical and optical checks belong to lighting', async () => fixture({
    'src/opening-features.ts': 'export const version=1;',
    'test/opening-features.test.mjs': '',
    'tests_backend/test_opening_orientation.py': '',
    'test/opening-optics.test.mjs': '',
}, async dir => {
    const catalog = await testCatalog(dir, inventory);
    for (const path of ['test/opening-features.test.mjs', 'tests_backend/test_opening_orientation.py']) {
        const row = catalog.rows.find(row => row.path === path);
        assert.equal(row.importance, 'critical');
        assert.ok(row.domains.includes('openings'));
    }
    assert.ok(catalog.rows.find(row => row.path === 'test/opening-optics.test.mjs').domains.includes('lighting'));
    const selected = await select(dir, { track:'ask', changedFiles:['src/opening-features.ts'] });
    for (const path of ['test/opening-features.test.mjs', 'tests_backend/test_opening_orientation.py', 'test/opening-optics.test.mjs'])
        assert.ok(selected.files.includes(path), path);
}));
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
test('static readers include both sides of import cycles and actual directory scopes', async () => fixture({
    'src/light-a.ts': "import './light-b'; export const a=1;", 'src/light-b.ts': "import './light-a.js'; export const b=2;",
    'test/plain-a.test.mjs': "import '../test-build/light-a.js';", 'test/plain-b.test.mjs': "import '../test-build/light-b.js';",
    'test/tree-reader.test.mjs': "import {readdirSync} from 'node:fs'; readdirSync('src');",
}, async (dir) => {
    const result = await select(dir, { changedFiles: ['src/light-a.ts'] });
    assert.ok(result.files.includes('test/plain-a.test.mjs'));
    assert.ok(result.files.includes('test/plain-b.test.mjs'));
    assert.ok(result.files.includes('test/tree-reader.test.mjs'), 'a real source-directory reader is affected by every changed source in that scope');
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
    // The child is a standalone test run, not a nested child-v8 IPC worker.
    const report = await runPlan(plan, { root: dir, stateDir: resolve(dir, 'state'), environment: { NODE_TEST_CONTEXT: undefined } });
    assert.equal(report.status, 'passed');
    assert.equal(report.results[0].counts.tests, 5);
    assert.equal(plan.selection.files, 1);
}));

test('shared application/stand aggregation does not make every scenario a reader of every feature', async () => fixture({
    'src/chrome-tooltip.ts': 'export const tip=1;',
    'src/houseplan-card.ts': "import './chrome-tooltip';",
    'demo/serve.mjs': "import '../src/houseplan-card.ts';",
    'demo/smoke_vacuum_unrelated.mjs': "import './serve.mjs';",
    'test/plain-shell.test.mjs': "import '../src/houseplan-card.ts';",
    'test/tooltip-reader.test.mjs': "import '../src/chrome-tooltip.ts';",
}, async (dir) => {
    const changed = await select(dir, {changedFiles: ['src/chrome-tooltip.ts']});
    assert.ok(changed.files.includes('test/tooltip-reader.test.mjs'));
    assert.ok(!changed.files.includes('demo/smoke_vacuum_unrelated.mjs'));
    assert.ok(!changed.files.includes('test/plain-shell.test.mjs'));
    const shell = await select(dir, {changedFiles: ['src/houseplan-card.ts']});
    assert.ok(shell.files.includes('test/plain-shell.test.mjs'));
    // Application changes retain the broad fallback; shell barriers narrow only
    // transitive scenario relevance, never execution fingerprints in finalize.
    assert.ok(shell.files.includes('test/tooltip-reader.test.mjs'));
}));
test('shared test inputs and product-contract readers participate in product changes', async () => fixture({
    'test/helpers/geometry-commit.mjs': 'export const x=1;',
    'test/fixtures/wall-model.json': '{}',
    'demo/helpers/local-view.mjs': 'export const x=1;',
    'demo/fixtures/wall-model.json': '{}',
    'docs/data-hp-contract.json': '{}',
    'src/houseplan-card.ts': 'export const x=1;',
    'test/reader.test.mjs': "import './helpers/geometry-commit.mjs'; import './fixtures/wall-model.json'; import '../demo/helpers/local-view.mjs'; import '../demo/fixtures/wall-model.json'; import '../docs/data-hp-contract.json';",
    'test/unified-wall-tool-source.test.mjs': "import '../src/houseplan-card.ts';",
}, async (dir) => {
    for(const path of ['test/helpers/geometry-commit.mjs','test/fixtures/wall-model.json','demo/helpers/local-view.mjs','demo/fixtures/wall-model.json','docs/data-hp-contract.json']) {
        const p=await select(dir,{changedFiles:[path]});
        assert.ok(p.files.includes('test/reader.test.mjs'),path);
        assert.ok(p.explanation.reasons['test/reader.test.mjs'].some(r=>r.includes(path)),path);
    }
    const contract=await select(dir,{changedFiles:['src/houseplan-card.ts']});
    assert.ok(contract.files.includes('test/unified-wall-tool-source.test.mjs'));
    const missing=await select(dir,{changedFiles:['demo/helpers/unknown-new.mjs']});
    assert.ok(missing.explanation.gaps.some(g=>g.path==='demo/helpers/unknown-new.mjs'));
    assert.ok(missing.files.includes('test/reader.test.mjs'));
}));
test('spawned script edits invalidate the actual prior PASS and auto-select its reader', async () => fixture({
    'scripts/generate-pdf-font.mjs': 'console.log(1);',
    'test/pdf-font-assets.test.mjs': "import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';test('generated asset',()=>{const r=spawnSync(process.execPath,['scripts/generate-pdf-font.mjs'],{encoding:'utf8'});assert.equal(r.status,0);assert.equal(r.stdout.trim(),'1');});",
}, async dir=>{
    const request={root:dir,layer:'infra',changedFiles:['scripts/generate-pdf-font.mjs']};
    const plan=await planProfile(request);
    const check=plan.steps.find(s=>s.command.includes('test/pdf-font-assets.test.mjs'));
    assert.ok(check,'spawn reader is selected without areaTests');
    assert.ok(check.inputs.includes('scripts/generate-pdf-font.mjs'));
    const options={root:dir,stateDir:resolve(dir,'state'),environment:{NODE_TEST_CONTEXT:undefined}};
    // Syntax belongs to the real repository; this fixture executes the actual test/target pair.
    const runnable=p=>({...p,steps:p.steps.filter(s=>s.id!=='infra-syntax')});
    const first=await runPlan(runnable(plan),options);
    assert.equal(first.status,'passed');
    const reused=await runPlan(runnable(plan),options);
    assert.equal(reused.results.find(r=>r.id===check.id).status,'reused');
    await writeFile(resolve(dir,'scripts/generate-pdf-font.mjs'),'console.log(2);');
    const second=await runPlan(runnable(await planProfile(request)),options);
    assert.equal(second.results.find(r=>r.id===check.id).status,'failed','changed spawn target must rerun and expose real failure');
}));
test('release hotfix retains the addressed profile without automatic task expansion', async () => fixture({
    'src/wall-change.ts':'', 'test/wall-related.test.mjs':'', 'test/explicit.test.mjs':'',
},async dir=>{
    const p=await planProfile({root:dir,event:'hotfix',changedFiles:['src/wall-change.ts'],areaTests:['test/explicit.test.mjs']});
    assert.equal(p.selection,undefined);
    assert.ok(p.steps.some(s=>s.command?.includes('test/explicit.test.mjs')));
    assert.ok(!p.steps.some(s=>s.command?.includes('test/wall-related.test.mjs')));
}));
test('build-input tools inherit product scope from the existing preparation inputs', async () => fixture({
    'scripts/coverage-maps.mjs':'export const x=1;',
    'test/unrelated-fast.test.mjs':'',
},async dir=>{
    const p=await planProfile({root:dir,layer:'product',changedFiles:['scripts/coverage-maps.mjs']});
    assert.ok(p.steps.some(s=>s.id==='product-build'));
    assert.ok(p.steps.some(s=>s.command?.includes('test/unrelated-fast.test.mjs')),'unmapped build tool uses the conservative quick fallback');
    assert.ok(p.selection.gaps.some(g=>g.path==='scripts/coverage-maps.mjs'));
}));
test('coordinator module graph loads within its deployed sparse checkout', async () => fixture({}, async dir=>{
    // Cone-mode checkout includes the chosen directories and root-level files.
    // Copy tracked inputs only: no auth, node_modules, artifacts or private state.
    const workflow=await readFile(resolve(root,'.github/workflows/process-next-coordinator.yml'),'utf8');
    const lines=workflow.split('\n'), selections=[];
    for(let i=0;i<lines.length;i++){
        const m=lines[i].match(/^(\s*)sparse-checkout:\s*\|/);
        if(!m)continue;
        const roots=[];
        while(i+1<lines.length && lines[i+1].startsWith(m[1]+'  ')) roots.push(lines[++i].trim());
        selections.push(roots);
    }
    assert.ok(selections.length>=2,'deployed public-ci and progress sparse definitions are present');
    assert.ok(selections.every(x=>JSON.stringify(x)===JSON.stringify(selections[0])),'both coordinator jobs share the verified source closure');
    const paths=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(p=>p && (!p.includes('/') || selections[0].some(prefix=>p.startsWith(prefix+'/'))));
    for(const path of paths){
        await mkdir(dirname(resolve(dir,path)),{recursive:true});
        await copyFile(resolve(root,path),resolve(dir,path));
    }
    const code="try{await import('./process-next/templates/coordinator-job.mjs');throw Error('activation guard was skipped');}catch(e){if(e.message!=='New process is not activated')throw e;}";
    const result=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:dir,encoding:'utf8',env:{...process.env,PROCESS_NEXT_ENABLED:undefined,NODE_TEST_CONTEXT:undefined}});
    assert.equal(result.status,0,result.stderr||result.stdout);
}));
// #1331: test metadata must not invent a product-component fallback in infra.
test('infra contract data selects its actual reader without product build fallback', async () => fixture({
 'docs/contract.json': '{}',
 'test/infra-contract.test.mjs': "import {readFileSync} from 'node:fs'; readFileSync(new URL('../docs/contract.json',import.meta.url));",
 'test/view-contract-product.test.mjs': "import '../dist/render.mjs';",
}, async dir => {
 const localInventory={entries:[{path:'test/infra-contract.test.mjs',kind:'infrastructure',decision:'keep'}]};
 const result=await selectTaskTests({root:dir,inventory:localInventory,layer:'infra',track:'show',changedFiles:['docs/contract.json']});
 assert.deepEqual(result.files,['test/infra-contract.test.mjs']);
 assert.ok(result.explanation.reasons['test/infra-contract.test.mjs'].some(x=>x.includes('Читает')));
 assert.equal(result.explanation.gaps.some(g=>g.reason?.includes('полный быстрый')),false);
}));
test('compatibility scanner selects and fingerprints both frontend and backend source scopes', async () => fixture({
 'src/new-source.ts': '', 'custom_components/houseplan/new_source.py':'',
 'scripts/config-compatibility-inventory.mjs': 'export function scanCompatibility(){}',
 'test/config-lifecycle.test.mjs': "import '../scripts/config-compatibility-inventory.mjs';",
}, async dir => {
 for(const file of ['src/new-source.ts','custom_components/houseplan/new_source.py']){
  const result=await select(dir,{changedFiles:[file]});
  assert.ok(result.files.includes('test/config-lifecycle.test.mjs'));
  assert.ok(result.explanation.reasons['test/config-lifecycle.test.mjs'].some(x=>x.includes('Читает')));
 }
 const plan=await planProfile({root:dir,changedFiles:['src/new-source.ts']});
 const consumer=plan.steps.find(s=>s.command?.includes('test/config-lifecycle.test.mjs'));
 assert.ok(consumer.inputs.includes('src/**/*.ts'));assert.ok(consumer.inputs.includes('custom_components/houseplan/**/*.py'));
}));

test('a source-scanner success is invalidated by changed frontend or backend directory contents', async () => fixture({
 'src/new-source.ts':'good','custom_components/houseplan/new_source.py':'good',
 'scripts/config-compatibility-inventory.mjs':`import {readdirSync,readFileSync} from 'node:fs';
 export const scanCompatibility=()=>['src','custom_components/houseplan'].flatMap(dir=>readdirSync(dir).sort().map(name=>readFileSync(dir+'/'+name,'utf8'))).join(',');`,
 'test/config-lifecycle.test.mjs':`import test from 'node:test';import assert from 'node:assert/strict';import {scanCompatibility} from '../scripts/config-compatibility-inventory.mjs';test('scanner',()=>assert.equal(scanCompatibility(),'good,good'));`,
},async dir=>{
 const plan=await planProfile({root:dir,changedFiles:['src/new-source.ts']});
 const consumer=plan.steps.find(s=>s.command?.includes('test/config-lifecycle.test.mjs'));
 const runnable={...plan,steps:[{...consumer,requires:[]}]};
 const options={root:dir,stateDir:resolve(dir,'.state'),environment:{NODE_TEST_CONTEXT:undefined}};
 const firstReceipt=await runPlan(runnable,options);
 assert.equal(firstReceipt.results[0].status,'passed',await readFile(firstReceipt.results[0].logPath,'utf8'));
 assert.equal((await runPlan(runnable,options)).results[0].status,'reused');
 for(const file of ['src/new-source.ts','custom_components/houseplan/new_source.py']){
  await writeFile(resolve(dir,file),'broken');
  assert.equal((await runPlan(runnable,options)).results[0].status,'failed',file+' must invalidate the prior scanner success');
  await writeFile(resolve(dir,file),'good');
 }
}));
test('header retirement native witness is selected for its actual runtime owner', async()=>fixture({
 'src/houseplan-card.ts':'','demo/smoke_header_observer_retirement.mjs':'',
},async dir=>{
 const result=await select(dir,{changedFiles:['src/houseplan-card.ts']});
 assert.ok(result.files.includes('demo/smoke_header_observer_retirement.mjs'));
 assert.ok(result.explanation.reasons['demo/smoke_header_observer_retirement.mjs'].some(x=>x.includes('Читает')));
 const catalog=await testCatalog(dir,inventory),row=catalog.rows.find(r=>r.path==='demo/smoke_header_observer_retirement.mjs');
 assert.equal(row.layer,'product');assert.ok(row.domains.includes('presentation'));assert.equal(row.lifecycle,'task-release');
}));
test('converter freshness reads its module-local artifact and canonical build inputs', async () => fixture({
 'scripts/sh3d-convert/build-page.mjs':await readFile(resolve(root,'scripts/sh3d-convert/build-page.mjs'),'utf8'),
 'scripts/sh3d-convert/build-runtime.mjs':await readFile(resolve(root,'scripts/sh3d-convert/build-runtime.mjs'),'utf8'),
 'scripts/sh3d-convert/geometry-entry.ts':"export {graph} from '../../src/plan-graph';",
 'scripts/sh3d-convert/tsconfig.json':'{}',
 'scripts/sh3d-convert/dist/index.html':'owned converter page',
 'src/plan-graph.ts':'export const graph=1;',
 'custom_components/houseplan/core/validation.py':'LIMIT=1',
 'custom_components/houseplan/core/led_strips.py':'LIMIT=1',
 'test/sh3d-convert-page.test.mjs':"import '../scripts/sh3d-convert/build-page.mjs';",
},async dir=>{
 const file='test/sh3d-convert-page.test.mjs',artifact='scripts/sh3d-convert/dist/index.html';
 const local=await planProfile({root:dir,event:'task',layer:'infra',track:'ship',changedFiles:[artifact],areaTests:[file]});
 const consumer=local.steps.find(s=>s.command?.includes(file));
 assert.ok(consumer,'the actual converter artifact reader must be selected');
 assert.ok(consumer.inputs.includes(artifact));
 assert.ok(!local.steps.some(s=>s.id==='product-build'),'converter bundle is not the card dist');
 for(const changed of ['src/plan-graph.ts','custom_components/houseplan/core/validation.py','custom_components/houseplan/core/led_strips.py']){
  assert.ok(consumer.inputs.includes(changed),'real compiler inputs invalidate artifact freshness: '+changed);
 }
}));
