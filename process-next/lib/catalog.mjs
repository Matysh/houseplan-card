import {createHash} from 'node:crypto';
import {dependencyReader} from './source-dependencies.mjs';
import {selectTaskTests,FIXTURE_ARTIFACTS} from './task-selection.mjs';
import { readFile, access } from 'node:fs/promises';
import {existsSync} from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { CRITICAL_NODE, BETA_SMOKES, BETA_GOLDEN, BETA_PANEL_GOLDEN, BETA_LOVELACE_GOLDEN, BETA_STATIC_GOLDEN, BETA_E2E } from '../catalog/selections.mjs';
import { makeE2ESteps } from './e2e.mjs';
import { makeConverterStep } from './converters.mjs';
import { walk, matchesInputs } from './storage.mjs';
import { GOLDEN_CAPTURE_INPUTS } from '../../scripts/source-fingerprint.mjs';
import { demoIconSourceFiles } from '../../demo/helpers/icon-sources.mjs';

export { CRITICAL_NODE, BETA_SMOKES, BETA_GOLDEN, BETA_E2E };
const here = fileURLToPath(new URL('../catalog/', import.meta.url));
export const inventory = JSON.parse(await readFile(resolve(here, 'inventory.json'), 'utf8'));
const productInputs = ['src/**', 'assets/**', 'package.json', 'package-lock.json', 'tsconfig.json', 'rollup.config.mjs'];
// Rollup embeds these capture inputs. Generated assets/caches are not sources.
const buildSourceInputs = [...productInputs, 'demo/fixtures/**/*.mjs', 'demo/golden/**/*.mjs', 'demo/fixtures/sun-transparent.json',
  'demo/helpers/vacuum-history.mjs', 'test/fixtures/vacuum-history/dreame-tasshack-2.0.2.json', 'demo/docs/browser-args.mjs',
  'scripts/source-fingerprint.mjs', 'scripts/css-template-minifier.mjs', 'scripts/bundle-manifest.mjs', 'scripts/coverage-maps.mjs'];
const buildInputs = [...buildSourceInputs, ...GOLDEN_CAPTURE_INPUTS];
// Public CI describes the tested product, not the current test/process sources.
// Keep its identity tied to these build/package inputs; package.json is compared
// by build/dependency fields so renamed test commands do not erase prior facts.
export const PUBLIC_PRODUCT_INPUTS = [...buildSourceInputs.filter(path => path !== 'package.json'),
  'custom_components/houseplan/**', 'docs/data-hp-contract.json', '.nvmrc', '.python-version'];
const browserInputs = [...buildInputs, 'demo/**/*.mjs', 'demo/fixtures/**/*.json', 'demo/srv/demo.html', 'demo/srv/assets/*.svg',
  'scripts/browser-attestation.mjs', 'scripts/toolchain-pins.mjs', 'scripts/capture-environment.mjs'];
const testBuildInputs = [...productInputs, 'tsconfig.test.json', 'scripts/fix-test-build.mjs', 'scripts/coverage-maps.mjs'];
export const PRODUCT_PREPARATION_INPUTS = [...new Set([...buildInputs, ...testBuildInputs])];
const pythonInputs = ['custom_components/houseplan/**/*.py', 'custom_components/houseplan/manifest.json', 'tests_backend/**/*.py', 'tests_backend/requirements.txt', 'pytest.ini', 'pyproject.toml'];
const pythonBackedTests = new Set(['demo/smoke_wall_node_python_roundtrip.mjs',
  'demo/smoke_wall_node_merge.mjs', 'demo/smoke_wall_node_attach.mjs', 'test/wall-node-attach.test.mjs',
  'demo/smoke_wall_face_lineage.mjs', 'demo/smoke_wall_face_room_split.mjs', 'test/room-write-python.test.mjs']);
export function discoverReleaseTests(root) {
  const known = new Map(inventory.entries.map(row => [row.path, row]));
  const candidates = [
    ...walk(root, resolve(root, 'test')).filter(file => file.endsWith('.test.mjs')).map(path => ({ path, kind: 'product' })),
    ...walk(root, resolve(root, 'tests_backend')).filter(file => /\/test_[^/]+\.py$/.test(file)).map(path => ({ path, kind: 'backend' })),
    ...walk(root, resolve(root, 'demo')).filter(file => /^demo\/smoke[^/]*\.mjs$/.test(file)).map(path => ({ path, kind: 'browser' })),
  ];
  return candidates.flatMap(row => {
    const old = known.get(row.path);
    if (old && (old.decision !== 'keep' || old.automaticReleaseRun === false || !['product', 'backend', 'browser'].includes(old.kind))) return [];
    return [{ ...row, kind: old?.kind ?? row.kind, group: old?.group ?? 'new-product', groupLabel: old?.groupLabel ?? 'Новые продуктовые проверки' }];
  });
}
const fileStepId=(prefix,file)=>prefix+':'+createHash('sha256').update(file).digest('hex').slice(0,24);
const step = (id, name, command, inputs, requires = [], extra = {}) => ({
  id, name, command, cwd: 'root', inputs: [...new Set(inputs)], requires, diagnostic: false, ...extra,
});
const unavailable = (id, name, reason, diagnostic = false, extra = {}) =>
  step(id, name, null, [], [], { unavailable: reason, diagnostic, ...extra });
const helper = (name, ...args) => ['node', `process-next/catalog/${name}.mjs`, ...args];
const safeRelative = value => typeof value === 'string' && value && !value.startsWith('-')
  && !value.includes('\\') && !value.split('/').includes('..') && !value.startsWith('/') && !value.includes(':');

// Follow ordinary relative module/data references without importing the old
// process classifier. This includes a test helper's dependencies in reuse.
async function finalize(root, plan) {
  const direct=dependencyReader(root);
  for (const check of plan.steps.filter(item => item.cwd === 'root' && item.command)) {
    // Use the generator's exact source closure. A broad demo/**/*.json would
    // treat the generated bundle manifest as source and invalidate preparation.
    const iconInputs = check.id === 'demo-assets' || check.requires.includes('demo-assets')
      ? demoIconSourceFiles(root) : [];
    // Changed infra files are hashed data, not automatically executed modules.
    // Syntax reads its argv as text; behavior executes only its selected tests.
    const sourceRoots = (check.id==='infra-syntax'||check.id.startsWith('infra-behavior')) ? [] : check.inputs;
    const commandRoots = check.id === 'infra-syntax' ? check.command.slice(1, 2) : check.command.slice(1);
    const seeds = [...sourceRoots, ...commandRoots].filter(path => safeRelative(path) && !/[?*]/.test(path) && /\.(?:mjs|cjs|js|ts|json|py)$/.test(path));
    const visited = new Set(), found = new Set(), artifactPreparations = new Set(); let pending = seeds;
    while (pending.length) {
      pending = pending.filter(file => {
        if (file === 'dist' || file.startsWith('dist/')) { artifactPreparations.add('product-build'); return false; }
        if ((file === 'demo/srv/assets' || file.startsWith('demo/srv/assets/')) && !file.endsWith('.svg')) {
          artifactPreparations.add('demo-assets'); return false;
        }
        // Output reports are not source inputs. Their producing step must be
        // declared explicitly by the profile, never inferred as source files.
        if (file === 'artifacts' || file.startsWith('artifacts/') || file.includes('/__pycache__/')) return false;
        return true;
      });
      for (const file of pending.filter(file => file.includes('*'))) found.add(file);
      const current = [...new Set(pending)].filter(file => !visited.has(file) && !file.includes('*')); pending = [];
      for (const file of current) visited.add(file);
      const edges = await Promise.all(current.map(file => direct(file)));
      for (let index = 0; index < current.length; index++) if (edges[index] !== null) { found.add(current[index]); pending.push(...edges[index]); }
    }
    // Icon scanning reads source as text. Its imports are not executed by the
    // generator, so do not turn their artifact strings into new build edges.
    check.inputs = [...new Set([...check.inputs, ...found, ...iconInputs])].sort();
    for (const id of artifactPreparations) {
      if (id === check.id||check.fixtureArtifacts) continue;
      if (!plan.steps.some(item => item.id === id)) throw Error(`Selected check ${check.id} reads prepared product artifacts (${id}); an infrastructure-only profile cannot silently build the product`);
      check.requires = [...new Set([...check.requires, id])];
    }
    if (/^(?:product-node:|product-backend$|smoke:|golden-)/.test(check.id) && !(check.id.startsWith('product-node:') && artifactPreparations.size)) {
      check.reuseReleaseVersion = true;
      check.preparationOnlyRequires = [...new Set([...(check.preparationOnlyRequires ?? []), ...check.requires.filter(id => ['product-build', 'test-build', 'demo-assets'].includes(id))])];
    }
  }
  // Behavioral consumers need the preparation implementation/configuration,
  // but Node groups keep their own source closure instead of depending on all src.
  const byId = new Map(plan.steps.map(item => [item.id, item]));
  for (const check of plan.steps) {
    const seen = new Set(), inputs = new Set(), commands = [];
    function preparation(id) {
      if (seen.has(id)) return;
      seen.add(id); const producer = byId.get(id); if (!producer) return;
      const env = { ...producer.env }; delete env.HP_PROCESS_SOURCE_SHA; // package provenance, not behavior
      commands.push({ id, command: producer.command, env });
      for (const file of producer.inputs) if (/^(?:process-next\/|scripts\/|package(?:-lock)?\.json$|tsconfig[^/]*\.json$|rollup\.config\.mjs$)/.test(file)) inputs.add(file);
      for (const required of producer.requires) preparation(required);
    }
    for (const id of check.preparationOnlyRequires ?? []) preparation(id);
    if (commands.length) {
      check.preparationCommands = commands;
      const key = check.cwd === 'e2e' ? 'rootInputs' : 'inputs';
      check[key] = [...new Set([...(check[key] ?? []), ...inputs])].sort();
    }
  }
  return plan;
}

async function checkedPaths(root, paths, tests = false) {
  const unique = [...new Set(paths)];
  for (const path of unique) {
    if (!safeRelative(path)) throw Error(`Expected a literal repository-relative path: ${path}`);
    if (tests && !/^(?:test\/.*\.test\.mjs|tests_backend\/test_.*\.py|demo\/smoke[^/]*\.mjs|process-next\/test\/.*\.test\.mjs)$/.test(path)) {
      throw Error(`Unsupported affected test: ${path}`);
    }
    if(tests)await access(resolve(root,path)); // changed sources may be deleted/renamed
  }
  return unique;
}

function preparations(steps, { build = false, tests = false, browser = false } = {}) {
  if (build) steps.push(step('product-build', 'Сборка и типы продукта', helper('prepare', 'build'), buildInputs, [], { outputs: ['dist'] }));
  if (tests) steps.push(step('test-build', 'Подготовка модулей для тестов', helper('prepare', 'tests'), testBuildInputs, [], { outputs: ['test-build'] }));
  if (browser) steps.push(step('demo-assets', 'Подготовка карточки для браузера', ['node', 'scripts/bundle-sync.mjs'], [...buildInputs, 'demo/gen_icons.mjs', 'scripts/bundle-sync.mjs', 'scripts/bundle-tree.mjs'], ['product-build'], { outputs: ['demo/srv/assets/houseplan-assets.json', 'demo/srv/assets/houseplan-card.js', 'demo/srv/assets/houseplan-assets', 'demo/srv/assets/houseplan-encoded', 'demo/srv/assets/icons.js'] }));
}

function nodeStep(id, name, files, requires = []) {
  return step(id, name, ['node', '--test', '--test-reporter=tap', ...files],
    ['package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.test.json', 'scripts/fix-test-build.mjs',
      'scripts/coverage-maps.mjs', 'test/fixtures/**', 'demo/fixtures/**', 'demo/srv/demo.html', ...files,
      ...(files.some(file => pythonBackedTests.has(file)) ? [...pythonInputs, '.python-version'] : [])],
    requires, { expectedNonempty: true, preparationOnlyRequires: requires.filter(id => id === 'test-build') });
}
// These profiles report diagnostic wall-clock/long-task budgets on one browser series.
// Do not change their budgets or serialize ordinary behavioral smoke checks.
const exclusiveSmokes = new Set([
  'demo/smoke_selective_invalidation_history0.mjs',
  'demo/smoke_selective_invalidation_history320.mjs',
  'demo/smoke_selective_invalidation_inactive.mjs',
  'demo/smoke_selective_invalidation_visible.mjs',
  'demo/smoke_wall_node_connected.mjs',
]);
function smokeStep(smoke) {
  const pythonBacked = pythonBackedTests.has(smoke.file);
  return step(`smoke:${smoke.file.replace(/^demo\//, '').replace(/\.mjs$/, '')}`, `Браузер: ${smoke.name || smoke.file.replace('demo/smoke_', '').replace('.mjs', '').replaceAll('_', ' ')}`,
    ['node', smoke.file, ...smoke.args, ...(exclusiveSmokes.has(smoke.file)?['--diagnostic-timing']:[])], pythonBacked ? [...browserInputs, ...pythonInputs, '.python-version'] : browserInputs,
    ['demo-assets', 'test-build'], { timeoutMs: 600000,
      ...(exclusiveSmokes.has(smoke.file) ? { exclusive: true } : {}),
      ...(smoke.file.endsWith('smoke_editor_draft_exit.mjs') ? { env: { HP_SMOKE_WIDTH: '1100' } } : {}) });
}
/** Pure planning: never installs dependencies, starts HA, builds, or executes a test. */
export async function planProfile({ root, event = 'task', issue, track = 'show', layer = 'product', areaTests = [], changedFiles = [], version, e2eRoot, phase, mutationShard,
  metricsRequest, candidateRoot, expectedVersion, upgradeFrom, haVersion, e2eWorkRoot, workRoot = e2eWorkRoot, targetRef } = {}) {
  if (!root) throw Error('root is required');
  if (event === 'fix') { event = 'task'; phase = 'after-review'; }
  if (!['task', 'hotfix', 'beta', 'stable', 'mutation', 'converters'].includes(event)) throw Error(`Unknown event: ${event}`);
  if (!['product', 'infrastructure', 'infra', 'docs', 'documentation'].includes(layer)) throw Error(`Unknown layer: ${layer}`);
  const docs = ['docs', 'documentation'].includes(layer);
  const infra = ['infrastructure', 'infra'].includes(layer);
  const release = event === 'beta' || event === 'stable';
  const name = release ? `Тест-сет перед ${version || event}` : event === 'converters' ? 'Диагностика внешних конвертеров'
    : event === 'mutation' ? 'Фоновая проверка чувствительности тестов'
    : `Тесты для задачи #${issue ?? '—'} (${phase === 'after-review' ? 'правки после ревью' : phase === 'before-merge' || track === 'ship' ? 'перед слиянием' : 'перед ревью'})`;
  const steps = [];
  const scope = { event, layer, track, issue: issue ?? null, version: version ?? null, phase: phase ?? 'before-review',
    inventorySourceCommit: inventory.sourceCommit, caseCount: null, countUnit: 'steps; runtime case counts reported separately' };
  const result = { name, event, issue: issue ?? null, layer, steps, scope, limitations: [], prerequisites: [] };
  if (docs && !release) { scope.reason = 'Чистая документация: только ревью, проверки не требуются'; return result; }
  if (event === 'converters') {
    steps.push(makeConverterStep({ e2eRoot, workRoot, haVersion, candidateRoot, targetRef, expectedVersion }));
    return finalize(root, result);
  }
  if (event === 'mutation') {
    const shard = typeof mutationShard === 'string' ? mutationShard.match(/^(\d+)\/(\d+)$/) : null;
    if (!shard || Number(shard[1]) < 1 || Number(shard[1]) > Number(shard[2])) {
      steps.push(unavailable('mutation-selection', 'Фоновая мутационная выборка', 'Supply explicit mutationShard i/n, e.g. 1/5, from the configured background rotation. No implicit rotation or full run.'));
    } else {
      preparations(steps, { build: true, tests: true, browser: true });
      steps.push(step('mutation-shard', `Фоновые мутации: часть ${mutationShard}`,
        ['node', 'scripts/mutation-gate.mjs', `--shard=${mutationShard}`, '--execute-nightly'],
        [...browserInputs, ...pythonInputs, 'scripts/mutation-*.mjs', 'scripts/mutations/**/*.mjs', 'test/**/*.mjs'],
        ['demo-assets', 'test-build'], { timeoutMs: 14400000, diagnostic: true }));
    }
    result.limitations.push('No mutation run is part of task/beta/stable/hotfix.'); return finalize(root, result);
  }
  const requested = await checkedPaths(root, areaTests, true);
  const changed = await checkedPaths(root, changedFiles);
  const selection=!release&&event!=='hotfix'?await selectTaskTests({root,inventory,track,layer:infra?'infra':'product',changedFiles:changed,areaTests:requested,productSourceInputs:changed.filter(file=>matchesInputs(file,PRODUCT_PREPARATION_INPUTS))}):null;
  const affected=selection?.files??requested;if(selection)result.selection=selection.explanation;
  if (infra && !release) {
    const syntax = changed.filter(path => existsSync(resolve(root,path))&&['.mjs', '.cjs', '.js', '.json', '.yml', '.yaml', '.py', '.ts'].includes(extname(path)));
    if (syntax.length) steps.push(step('infra-syntax', 'Синтаксис и типы изменённых инструментов', helper('syntax', ...syntax), [...syntax, 'package.json', 'package-lock.json']));
    const node = affected.filter(path => path.endsWith('.mjs') && !path.startsWith('demo/'));
    const py = affected.filter(path => path.endsWith('.py'));
    if (affected.some(path => path.startsWith('demo/'))) throw Error('Infrastructure profile cannot silently include browser product checks');
    for(const file of node)steps.push(step(fileStepId('infra-behavior',file),'Поведение механизма: '+file,['node','--test','--test-reporter=tap',file],[file,'package.json','package-lock.json'],[],{expectedNonempty:true,fixtureArtifacts:FIXTURE_ARTIFACTS.has(file)}));
    for(const file of py)steps.push(step(fileStepId('infra-python',file),'Python: '+file,['python3','-m','pytest','-q',file],[file,'tests_backend/conftest.py','tests_backend/pure_imports.py']));
    if (!affected.length) result.limitations.push('No affected mechanism tests supplied. This is not a passed behavior test; the task author selects relevant tests.');
    return finalize(root, result);
  }
  result.prerequisites.push('Node dependencies from package-lock.json already installed; pinned Chromium available for browser checks.');
  preparations(steps, { build: true, tests: true, browser: true });
  if (!release) {
    const tools=changed.filter(file=>/^(?:process-next\/|scripts\/|\.github\/)/.test(file)&&existsSync(resolve(root,file))&&/\.(?:mjs|cjs|js|json|yml|yaml|py|ts)$/.test(file));
    if(tools.length)steps.push(step('infra-syntax','Синтаксис изменённых инструментов',helper('syntax',...tools),[...tools,'package.json','package-lock.json']));
    steps.push(nodeStep('critical-data-rights', 'Критичные данные, сохранение и права', CRITICAL_NODE, ['test-build']));
    steps.push(step('startup-view', 'Открытие сохранённого плана в View', helper('startup-smoke'), browserInputs, ['demo-assets'], { timeoutMs: 120000 }));
    const extraNode = affected.filter(path => path.endsWith('.test.mjs') && !CRITICAL_NODE.includes(path));
    for(const file of extraNode)steps.push(nodeStep(fileStepId('affected-node',file),'Поведение: '+file,[file],['test-build']));
    const extraPy = affected.filter(path => path.endsWith('.py'));
    for(const file of extraPy)steps.push(step(fileStepId('affected-backend',file),'Backend: '+file,helper('backend','--no-coverage',file),[...pythonInputs.filter(p=>p!=='tests_backend/**/*.py'),file,'tests_backend/conftest.py','tests_backend/pure_imports.py','tests_backend/fixtures/**']));
    for (const file of affected.filter(path => path.startsWith('demo/'))) steps.push(smokeStep({ file, args: [] }));
    return finalize(root, result);
  }
  const discovered = discoverReleaseTests(root), retained = kind => discovered.filter(row => row.kind === kind).map(row => row.path);
  for (const group of [...new Set(discovered.filter(row => row.kind === 'product').map(row => row.group))]) {
    const rows = discovered.filter(row => row.kind === 'product' && row.group === group);
    steps.push(nodeStep(`product-node:${group}`, `Поведение: ${rows[0].groupLabel}`, rows.map(row => row.path), ['test-build']));
  }
  steps.push(step('product-backend', 'Backend и сбор покрытия', helper('backend', ...retained('backend')), pythonInputs, [], { outputs: ['artifacts/process-next/backend-coverage.xml'], reusableReports: ['artifacts/process-next/backend-coverage.xml'] }));
  result.prerequisites.push('Python environment with tests_backend/requirements.txt and pytest-cov installed; all HA harness dependencies required.');
  const packageSources = execFileSync('git', ['ls-files', '-z', '--', 'custom_components/houseplan', 'docs/data-hp-contract.json'],
    { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(path => path && !path.startsWith('custom_components/houseplan/frontend/'));
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  scope.sourceCommit = sourceSha;
  steps.push(step('release-package', 'Подготовка проверяемого ZIP и кандидата', helper('release-package'),
    [...packageSources, 'package.json'], ['product-build'],
    { env: { HP_PROCESS_SOURCE_SHA: sourceSha }, outputs: ['artifacts/process-next/package.json', 'artifacts/process-next/houseplan.zip', 'artifacts/process-next/houseplan-card.js', 'artifacts/process-next/candidate'],
      evidenceOutputs: ['artifacts/process-next/houseplan.zip', 'artifacts/process-next/houseplan-card.js', 'artifacts/process-next/candidate'] }));
  let measurementInputs = [];
  if (metricsRequest) {
    await checkedPaths(root, [metricsRequest]);
    const request = JSON.parse(await readFile(resolve(root, metricsRequest), 'utf8'));
    if (request.latestStable && !safeRelative(request.latestStable)) throw Error('metricsRequest.latestStable must be a repository-relative measurement file');
    measurementInputs = [metricsRequest, ...(request.latestStable ? [request.latestStable] : [])];
  }
  steps.push(step('release-measurements', event === 'stable' ? 'Сохранение замера stable для следующей беты' : 'Размеры и время относительно последнего stable', helper('measure', ...metricsRequest ? [metricsRequest] : []),
    [...browserInputs, ...measurementInputs, 'process-next/baselines/v1.83.1.json'], ['release-package', 'demo-assets'],
    { diagnostic: true, alwaysRun: true, outputs: ['artifacts/process-next/measurement.json', 'artifacts/process-next/metrics.json', 'artifacts/process-next/metrics.md'], timeoutMs: 3600000 }));
  for (const smoke of BETA_SMOKES) steps.push(smokeStep(smoke));
  steps.push(step('golden-beta', `${BETA_GOLDEN.length} визуальных кадров: панель ${BETA_PANEL_GOLDEN.length}, Lovelace ${BETA_LOVELACE_GOLDEN.length}, Static ${BETA_STATIC_GOLDEN.length}`, helper('golden-runner', '--selection=beta'),
    [...browserInputs, ...BETA_GOLDEN.map(id => `demo/golden/baselines/${id}.png`), 'demo/golden/baselines/baselines-index.json'],
    ['demo-assets', 'test-build'], { outputs: ['artifacts/process-next/golden-beta/golden-report.json'], reusableReports: ['artifacts/process-next/golden-beta/golden-report.json'], timeoutMs: 1800000 }));
  const e2eOptions = { e2eRoot, version, targetRef,
    candidateRoot: candidateRoot || resolve(root, 'artifacts/process-next/candidate'),
    expectedVersion: expectedVersion || JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version,
    upgradeFrom, haVersion, workRoot };
  const addE2E = selection => {
    const external = makeE2ESteps({ ...e2eOptions, selection });
    for (const item of external.steps) { item.requires.push('release-package'); item.dependencyOutputOnlyRequires = ['release-package']; }
    // The runner hashes these in the main checkout even though cwd is E2E.
    for (const item of external.steps) {
      item.rootInputs = ['process-next/lib/e2e.mjs', 'process-next/catalog/selections.mjs'];
      if (item.command && !item.id.endsWith('-upgrade') && (!candidateRoot || resolve(candidateRoot) === resolve(root, 'artifacts/process-next/candidate'))) {
        item.reuseReleaseVersion = true;
        item.preparationOnlyRequires = ['release-package'];
        item.rootInputs.push(...buildInputs, 'custom_components/houseplan/**', 'docs/data-hp-contract.json', 'scripts/bundle-sync.mjs');
        // Packaged frontend is generated; source/build inputs above describe its behavior.
        item.rootInputs = item.rootInputs.filter(path => path !== 'custom_components/houseplan/**');
        item.rootInputs.push(...packageSources);
      }
    }
    steps.push(...external.steps); result.prerequisites.push(...external.prerequisites); result.limitations.push(...external.limitations);
  };
  addE2E('beta');
  if (event === 'stable') {
    const selected = new Set(BETA_SMOKES.map(item => item.file));
    for (const file of retained('browser').filter(file => !selected.has(file))) steps.push(smokeStep({ file, args: [] }));
    // The beta permission selection is intentionally narrow; stable also covers the rest.
    steps.push({ ...smokeStep({ file: 'demo/smoke_view_edit_permissions.mjs', args: [] }), id: 'smoke:permissions-full' });
    steps.push(step('golden-rest', 'Остальные визуальные эталоны', helper('golden-runner', '--selection=rest'),
      [...browserInputs, 'demo/golden/baselines/*.png', 'demo/golden/baselines/baselines-index.json'], ['demo-assets', 'test-build'],
      { outputs: ['artifacts/process-next/golden-rest/golden-report.json'], reusableReports: ['artifacts/process-next/golden-rest/golden-report.json'], timeoutMs: 7200000 }));
    steps.push(step('backend-coverage-threshold', 'Порог backend coverage перед stable', ['python3', 'process-next/catalog/coverage-threshold.py'], ['scripts/backend-coverage-baseline.txt', 'process-next/catalog/coverage-threshold.py'], ['product-backend']));
    addE2E('remainder');
    const converters = makeConverterStep({ ...e2eOptions, targetRef: sourceSha, requires: ['release-package'] });
    converters.after = ['release-measurements', steps.filter(item => item.id.startsWith('e2e-')).at(-1).id];
    steps.push(converters);
  }
  scope.nodeFiles = retained('product').length; scope.backendFiles = retained('backend').length;
  scope.betaSmokeFiles = BETA_SMOKES.length; scope.betaGoldenFrames = BETA_GOLDEN.length; scope.betaE2EJourneys = BETA_E2E.length;
  result.limitations.push('Browser cases execute the complete card: their source identity is deliberately conservative, so a product source change can rerun all browser cases. Node groups use import/data closure; dynamic source readers conservatively include src/**. Planning executes no tests. Missing E2E/measurement prerequisites remain unavailable, never PASS.');
  const measurements = steps.find(item => item.id === 'release-measurements');
  // Keep timing samples out of concurrent browser/Node/HA workloads. Ordering
  // does not change their input identity or make an unrelated test a cache key.
  if (measurements?.command) measurements.after = steps.filter(item => item !== measurements && !item.diagnostic).map(item => item.id);
  return finalize(root, result);
}
