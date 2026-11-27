import { createHash } from 'node:crypto';
import { CONVERTER_CASES } from '../converters/cases.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { walk, matchesInputs } from './storage.mjs';
import { dependencyReader, declaredSourceInputs } from './source-dependencies.mjs';
import { BETA_E2E, CRITICAL_NODE } from '../catalog/selections.mjs';
/** Behaviour taxonomy shared by inventory, task selection and its explanation.
 * Labels inherit from files; no per-test quota or title filtering is applied. */
export const FIXTURE_ARTIFACTS = new Map([['test/bundle-policy.test.mjs', 'All dist/frontend trees and Git commits are created in its mkdtemp fixtures; no prepared checkout bundle is read.'], ['test/bundle-sync.test.mjs', 'All dist/frontend/demo payloads are created under its mkdtemp root; only source tools and installed MDI icons are read from the checkout.'], ['test/dev-build.test.mjs', 'Every dist tree and Git remote/stand is created in its mkdtemp fixtures; no prepared checkout frontend is consumed.'], ['test/ui-lab-server.test.mjs', 'Every product dist/manifest and HA cache is created inside fixture(t) mkdtemp and passed via repoRoot/labRoot; no built product is consumed.'], ['process-next/test/metrics.test.mjs', 'All ZIP/frontend/benchmark paths are created in measurementFixture mkdtemp; the test consumes no prepared product artifact.'], ['process-next/test/package.test.mjs', 'All dist/ZIP paths are created under fixture(t) mkdtemp and passed via that fixture root; the test consumes no prepared product artifact.'], ['process-next/test/runner.test.mjs', 'dist/report.json occurs only in rejected output-path metadata; the runner test never reads product dist.'], ['test/coverage-diagnostic.test.mjs', 'All generated artifacts belong to its mkdtemp fixtures; it never needs the product checkout dist.']]);
export const DOMAINS = [
    ['geometry', 'Геометрия, стены и комнаты', /(?:wall|junction|masonry|physical|plan-graph|plan-exact|render-exact|polygon|polyclip|contour|coordinate|optimiz|room-face|space-geometry|geometry|graph|grid|canvas|floor|room|node|column|partition|apex|near-axis|open-span|model-invariant|plan-entry|plan-rotation|zero-divider|merge|split|align|contact-basis|plan-drawing|open-passage|range-line|size-angle|active-chain|edit-walk|plan-signed)/, ['storage', 'history', 'openings', 'lighting', 'isometry', 'pdf'], ['direct_wall_geometry', 'geometry_history_refusal']],
    ['storage', 'Хранение, импорт и полномочия', /(?:(?:furniture|iso-lab)-workstation|house-(?:document|archive|prefix|files|commands|resources|http|transfer)|archive-conformance|core-archive-compatibility|demo\/standalone\/(?:core-process\.py|host\.js)|plan-host|plan-capabilit|plan-commands|command-(?:adapter|legacy|ports|execution|effects|state)|(?:content|portable|staging)-commands|content-(?:files|index)|memory-host|reference-host|core-(?:conformance|distribution|package)|config|storage|store|layout|migration|upload|durab|backup|import|serializ|canonical|validation|rights|permiss|access|revision|conflict|write|transport|late-context|binding-status|legacy-draft|previous-data|discard|save-|saved-plan|copy|signing|sign-cap|converter|plan-signed|houseplan\/(?:const|plans|http-api)\.py|houseplan\/core\/(?:constants|ports|file-usage|conformance(?:-example)?)\.py|core-boundary|sh3d-convert)/, ['geometry', 'history', 'devices'], ['geometry_history_refusal', 'view_edit_permissions']],
    ['history', 'История и атомарные операции', /(?:history|undo|command-stack|adoption)/, ['storage', 'geometry', 'editors'], ['geometry_history_refusal']],
    ['openings', 'Двери, окна и проёмы', /(?:opening|door|window)/, ['geometry', 'lighting'], ['static_wall_openings']],
    ['editors', 'Редакторы и жесты', /(?:editor|gesture|pointer|drag|selection|resize|keyboard|nudge|snap|touch)/, ['history', 'presentation', 'navigation'], ['editor_gestures', 'editor_draft_exit']],
    ['presentation', 'Отображение и интерфейс', /(?:card-rotation-preference|native-card-presentation|view|render|style|theme|color|appearance|label|display|ui-kit|form-kit|popover|tooltip|dialog|toolbar|chrome|ui[_-]|standalone-presentation|properties|surface|header|menu|tray|hover|tip|toast|modal|confirm|settings|palette|visual|volumetric|mode-transition|support|help|ux-fixes|yellow-principle|feedback|font|gear|gs-always|hidden|hide-layer|picker|motion|mode|css|styling|approved-ui|tap-ctx|tap-run)/, ['navigation', 'i18n'], ['view_recovery']],
    ['navigation', 'Пространства, камера, киоск и профили', /(?:panel|route|nav|space-switch|space-create|space-delete|kiosk|screen|profile|viewport|camera|panzoom|fit-view|space[-_]|zoom|first-space|onboarding|pan[-_]|deeplink|plan-picker)/, ['presentation', 'editors'], ['space_switch_transitions', 'kiosk_space_navigation']],
    ['devices', 'Устройства и действия', /(?:device|marker|toggle|entity|battery|offline|alert|pin-action|value|state|washer|wireless-controller|danger-confirm|control|icon|cover|sensor|signal|discovery|subarea|area-relocation|rgb-alarm|binding)/, ['storage', 'presentation', 'climate'], ['cold_view_toggle', 'toggle_confirmation']],
    ['runtime', 'Загрузка, жизненный цикл и соединение', /(?:plan-host|plan-capabilit|activity|lifecycle|registration|initial|startup|bootstrap|loader|entry|card-version|version|hass|resilience|live-read|card-read|sync|connect|recovery|init|setup|websocket|ha-|readonly|detached|mounted)/, ['storage', 'presentation', 'navigation'], ['readonly_cold_start', 'view_recovery']],
    ['toolchain', 'Инструменты, fixtures и лаборатории', /(?:fixture|facade|labs?|golden|bundle|capture|probe|contract|audit|conftest|backend-test-hygiene|backend-quality|core-source-readers|(?:^|\/)pyproject\.toml$)/, [], []],
    ['security', 'Авторизация, подпись и защищённые действия', /(?:signing|sign-cap|readonly|authority|lock|sandbox|permission|protected|input-policy|input-archive-security|ha-input-security)/, ['storage', 'devices'], ['view_edit_permissions']],
    ['integration', 'Сквозные контракты и обвязка', /(?:journey|parity|edge-case|e2e|harness|projection)/, ['storage', 'presentation'], ['household_journeys']],
    ['shared', 'Общие функции и типы', /(?:^|\/)(?:logic|types)\.(?:test\.)?(?:ts|mjs)$/, ['geometry', 'storage', 'history', 'editors', 'devices', 'presentation', 'lighting', 'navigation'], ['editor_gestures']],
    ['process', 'Очередь, ревью, релизы и исполнение проверок', /(?:process-next|workflow|process-state|coordinator|runner|toolchain)/, [], []],
    ['lighting', 'Свет, солнце и окружение', /(?:sun|light|glow|moon|day-cycle|daycycle|shadow|visibility|led|dimming|optics)/, ['geometry', 'openings', 'presentation'], ['light', 'sun']],
    ['climate', 'Климат и значения комнат', /(?:temp|humidity|co2|climate|room-card|state-value)/, ['devices', 'presentation'], ['room_co2']],
    ['decor', 'Декор, мебель, изображения и текст', /(?:decor|furniture|backdrop|rotation-angle|live-text|asset|text)/, ['editors', 'history', 'presentation'], ['decor_creation_selection', 'decor_rotation_shift']],
    ['summary', 'Сводная панель и погода', /(?:summary|weather|forecast)/, ['presentation', 'navigation', 'devices'], ['summary_panel', 'summary_weather']],
    ['vacuum', 'Пылесосы и маршруты', /(?:vacuum|dreame|roborock|tasshack|trail)/, ['presentation', 'storage'], ['vacuum']],
    ['zigbee', 'Zigbee и LQI', /(?:zigbee|lqi|mesh|neighbour)/, ['devices', 'presentation'], ['zigbee_enable_recovery']],
    ['radar', 'Радары и присутствие', /(?:radar|presence|occupancy|heatmap)/, ['devices', 'storage'], ['radar']],
    ['stairs', 'Лестницы', /stair/, ['geometry', 'editors', 'isometry'], ['stairs']],
    ['isometry', 'Объёмный вид и проекции', /(?:isometric|isometry|iso-|plan-3d|projection-view-camera)/, ['geometry', 'presentation', 'devices'], ['isometric_live_touch', 'iso_label_bounds', 'iso_device_contours']],
    ['pdf', 'Печать и векторный экспорт', /(?:pdf|svg-export|export-svg|print)/, ['geometry', 'presentation'], ['pdf_export']],
    ['i18n', 'Локализация', /(?:i18n|locale|translation|language|unit|format)/, ['presentation'], ['i18n_live']],
    ['performance', 'Производительность и кеши', /(?:performance|benchmark|latency|cache|invalidation|memory|warm|measurement|budget|demand|identity|epoch|deferred|frame)/, ['presentation', 'navigation'], ['selective_invalidation']],
];
const companionInventory = JSON.parse(readFileSync(new URL('../catalog/companion-inventory.json', import.meta.url), 'utf8'));
const ids = new Map(DOMAINS.map(row => [row[0], row]));
const isInfra = p => p === '.gitignore' || /^(?:process-next\/|scripts\/|\.github\/|demo\/stand\/|docs\/release-ledger\/)/.test(p);
export function domainsOf(path) { return AGGREGATION_BOUNDARIES.get(path)?.domains ?? DOMAINS.filter(row => row[2].test(path.toLowerCase().replace('/helpers/', '/').replaceAll('_', '-'))).map(row => row[0]); }
const fast = row => ['node', 'backend', 'browser'].includes(row.type);
const unique = xs => [...new Set(xs)];
// Runtime shell/stand loaders intentionally aggregate the whole product. That
// build dependency remains in execution fingerprints, but is not evidence that
// every consumer tests each nested behaviour. Dedicated readers and domain
// witnesses still select the component's actual contracts.
// Coverage witnesses are narrower than invalidation inputs. The latter still
// include complete runtime shells; a wrapper import cannot prove a scenario.
const AGGREGATION_BOUNDARIES = new Map([
    ['demo/serve.mjs', { domains: ['toolchain'], ship: ['test/smoke-harness-contract.test.mjs','demo/smoke_readonly_cold_start.mjs'],
        show: ['demo/smoke_standalone_entry.mjs'], ask: ['demo/smoke_view_recovery.mjs'] }],
    ['demo/bundle-freshness.mjs', { domains: ['toolchain'], ship: ['test/bundle-assets.test.mjs'], show: ['demo/smoke_readonly_cold_start.mjs'] }],
    ['scripts/coverage-maps.mjs', { domains: ['toolchain'], ship: ['test/bundle-assets.test.mjs'] }],
    ['scripts/source-fingerprint.mjs', { domains: ['toolchain'], ship: ['test/bundle-assets.test.mjs'] }],
    ['src/houseplan-card.ts', { domains: ['runtime','presentation'], ship: ['demo/smoke_readonly_cold_start.mjs','demo/smoke_view_edit_permissions.mjs','test/unified-wall-tool-source.test.mjs','test/write-authority-snapshot.test.mjs'],
        show: ['demo/smoke_lazy_editor_chunk.mjs','test/bundle-assets.test.mjs'], ask: ['demo/smoke_view_recovery.mjs'] }],
    ['src/houseplan-panel.ts', { domains: ['navigation'], ship: ['demo/smoke_kiosk_space_navigation.mjs'],
        show: ['demo/smoke_native_card_presentation.mjs'], ask: ['demo/smoke_space_switch_transitions.mjs'] }],
]);
const ADDRESS = [
    [/^custom_components\/houseplan\/websocket_api\.py$/, ['tests_backend/test_ha_websocket.py']],
    [/^custom_components\/houseplan\/core\/furniture_workstation\.py$/, ['tests_backend/test_furniture_workstation.py','test/furniture-workstation.test.mjs'], ['test/furniture-volume-generator.test.mjs']],
    [/^src\/editors\/hp-icon-picker\.ts$/, ['demo/smoke_device_icon_picker.mjs'], ['demo/smoke_standalone_entry.mjs']],
    [/^src\/editors\/space-dialog-draft\.ts$/, ['test/space-settings-945.test.mjs'], ['demo/smoke_space_settings_form.mjs']],
    [/^src\/standalone-icon-catalog\.ts$/, ['test/bundle-assets.test.mjs','demo/smoke_standalone_entry.mjs']],
    [/^src\/standalone-presentation\.ts$/, ['test/standalone-presentation-boundary.test.mjs'], ['demo/smoke_standalone_presentation.mjs']],
    [/^src\/plan-graph\.ts$/, ['test/plan-graph-core.test.mjs','test/geometry-corpus.test.mjs','demo/smoke_direct_wall_geometry.mjs'],
        ['test/plan-graph-optimize.test.mjs'], ['demo/smoke_wall_node_move.mjs']],
    [/^src\/(?:custom_)?(?:space-settings|room-utilities|layout-write|config-write)(?:[-\/][\w\/]+)?\.ts$/,
        ['test/layout-write-reload.test.mjs','test/config-write-conflict.test.mjs']],
    [/^src\/.*(?:room[-_]write|room[-_]commit|room[-_]save)[^\/]*\.ts$/,
        ['test/config-write-context.test.mjs','demo/smoke_room_save_retry_946.mjs']],
    [/^src\/(?:geometry-history-(?:state|step)|physical-write-history|wall-node-history|geometry-transaction)\.ts$/,
        ['test/geometry-history-refusal.test.mjs','test/geometry-history-restore.test.mjs','demo/smoke_geometry_history_refusal.mjs']],
    [/^src\/.*(?:editor-runtime|lazy-editor)[^\/]*\.ts$/, ['test/editor-runtime-loader.test.mjs','test/bundle-assets.test.mjs','demo/smoke_lazy_editor_chunk.mjs']],
    [/^src\/.*(?:permission|plan-capabilit|device-editor-access)[^\/]*\.ts$/, ['test/plan-capability-permissions.test.mjs','demo/smoke_view_edit_permissions.mjs']],
    [/^custom_components\/houseplan\/(?:config_write|__init__|websocket_api|(?:core\/)?storage|core\/plan_commands)\.py$/,
        ['tests_backend/test_ha_config_set_scoped.py']],
    [/^(?:src\/.*|custom_components\/houseplan\/.*)(?:graph[-_]write|graph[-_]node|wall[-_]node|geometry[-_]write)[^\/]*\.(?:py|ts)$/,
        ['tests_backend/test_graph_write.py','tests_backend/test_graph_node_write.py','demo/smoke_geometry_history_refusal.mjs']],
    [/^src\/(?:styles\/)?iso-(?:overlays|lab-markers\.styles)\.ts$/,
        ['test/iso-overlays.test.mjs','demo/smoke_iso_device_contours.mjs','demo/smoke_iso_label_bounds.mjs'], ['demo/smoke_isometric_live_touch.mjs']],
    [/^src\/projection-view-camera\.ts$/, ['test/projection-view-camera.test.mjs'], ['test/iso-worker-cache-profile.test.mjs']],
    [/^src\/pdf\/pdf-scene\.ts$/, ['test/pdf-workstation.test.mjs']],
    [/^src\/iso-lab-workstation\.ts$/, ['test/furniture-workstation.test.mjs'], ['test/furniture-volume-generator.test.mjs']],
    [/^src\/opening-features\.ts$/, ['test/opening-features.test.mjs','tests_backend/test_opening_orientation.py'], ['test/opening-optics.test.mjs']],
    [/^custom_components\/houseplan\/core\/input_policy\.py$/,
        ['tests_backend/test_input_policy.py','tests_backend/test_input_archive_security.py','tests_backend/test_ha_input_security.py']],
    [/^custom_components\/houseplan\/core\/house_commands\.py$/, ['tests_backend/test_house_commands.py','tests_backend/test_house_document.py'],
        ['tests_backend/test_house_files.py','tests_backend/test_ha_house_transfer.py'],
        ['tests_backend/test_house_prefix.py','tests_backend/test_house_archive.py','test/house-transfer-prefix.test.mjs']],
    [/^custom_components\/houseplan\/core\/plan_commands\.py$/, ['tests_backend/test_plan_commands.py'],
        ['tests_backend/test_content_commands.py'], ['tests_backend/test_core_conformance.py','tests_backend/test_core_distribution.py']],
];
const installedOutput = path => path.startsWith('custom_components/houseplan/frontend/') || path === 'custom_components/houseplan/BUILD.json';
const productMetadata = path => path === '.gitignore' || /^docs\/release-ledger\//.test(path);
const mixedSourceScanner = 'process-next/lib/source-dependencies.mjs';
const scannerWitnesses = ['process-next/test/task-selection.test.mjs','process-next/test/catalog.test.mjs','process-next/test/standalone-source-scope.test.mjs'];
const isTestCase = path => /\.test\.mjs$|\/test_[^\/]+\.py$|^demo\/smoke[^\/]*\.mjs$/.test(path);
const typeRank = { node: 0, backend: 0, browser: 1 };
const importanceRank = { critical: 0, boundary: 1, regression: 2 };
const orderWitnesses = (a,b) => a.proof - b.proof || typeRank[a.row.type] - typeRank[b.row.type]
    || importanceRank[a.row.importance] - importanceRank[b.row.importance] || a.row.path.localeCompare(b.row.path);
const depth = { ship: 0, show: 1, ask: 2 };
const moduleName = path => basename(path,extname(path)).replace(/.test$/,'').replace(/^test_(ha_)?/,'').replaceAll('_','-');
const sameModule = (row, source) => row.type !== 'browser' && moduleName(row.path) === moduleName(source);

const originalSourceFile = p => /^(?:src\/|custom_components\/houseplan\/|assets\/)/.test(p) || /^(?:package(?:-lock)?\.json|tsconfig.*\.json|rollup\.config\.mjs)$/.test(p);
const isDocument = p => /\.md$/i.test(p) || /^(?:LICENSE|NOTICE)(?:\.[^/]+)?$/.test(p) || /^docs\/.*\.(?:png|jpe?g|webp|svg|gif|pdf)$/i.test(p);
// Shared helpers, fixtures and contracts are real selection inputs as well as
// production modules. A new unrecognised input must remain visibly conservative.
const sourceFile = p => !p.startsWith('custom_components/houseplan/frontend/')
    && (originalSourceFile(p) || !isInfra(p) && !isDocument(p));
export async function testCatalog(root, inventory, { e2eRoot } = {}) {
    // Queue and public-CI workers import this module from their sparse checkout.
    // Only actual catalog/task planning requires the full golden fixture tree.
    const [{ GOLDEN_SCENARIOS }, { prepareGoldenSelection }] = await Promise.all([
        import('../../demo/golden/matrix.mjs'), import('../catalog/golden-selection.mjs'),
    ]);
    const known = new Map(inventory.entries.map(row => [row.path, row])), rows = [], excluded = [];
    for (const directory of ['test', 'tests_backend', 'demo', 'process-next/test', 'scripts/converters'])
        for (const path of walk(root, resolve(root, directory))) {
            const type = directory !== 'demo' && directory !== 'tests_backend' && /\.test\.mjs$/.test(path) ? 'node' : /\/test_[^/]+\.py$/.test(path) ? 'backend' : /^demo\/smoke[^/]*\.mjs$/.test(path) ? 'browser' : null;
            if (!type)
                continue;
            const old = known.get(path);
            if (old?.decision === 'retire') {
                excluded.push({ path, reason: old.reason });
                continue;
            }
            const infrastructure = path.startsWith('process-next/') || old?.kind === 'infrastructure' || old?.kind === 'product-contract' || old?.kind === 'product-meta';
            const converter = path.startsWith('scripts/converters/') || old?.kind === 'converter';
            const domains = domainsOf(path);
            if (!domains.length && infrastructure)
                domains.push('toolchain');
            if (!domains.length && converter)
                domains.push('storage');
            const importance = /(?:conflict|authority|rights|permission|invalid|reject|safety|atomic|graph|exact|input_(?:policy|archive_security|security)|opening[_-](?:features|orientation))/.test(path) ? 'critical' : /(?:edge|corner|boundary|degenerate|refusal|recovery|regress)/.test(path) ? 'boundary' : 'regression';
            rows.push({ id: path, path, type, layer: converter ? 'converter' : infrastructure ? 'infra' : 'product', domains, scenario: basename(path).replace(/(?:\.test)?\.(?:mjs|py)$/, '').replace(/^smoke_|^test_/, '').replaceAll(/[-_]/g, ' '), importance, lifecycle: converter ? 'diagnostic' : infrastructure || old?.decision === 'addressed' || old?.automaticReleaseRun === false ? 'addressed' : 'task-release', classified: domains.length > 0 || infrastructure || converter, executedCases: null });
        }
    for (const scene of prepareGoldenSelection(GOLDEN_SCENARIOS).all)
        rows.push({ id: 'golden:' + scene.id, path: 'demo/golden/matrix.mjs', type: 'golden', layer: 'product', domains: domainsOf(scene.id), scenario: scene.id, importance: 'regression', lifecycle: 'beta-stable', classified: domainsOf(scene.id).length > 0, declaredFrames: 1, executedCases: null });
    const external = { sourceRun: companionInventory.sourceRun, companionCommit: companionInventory.companionCommit, verified: !!e2eRoot, changedFiles: [], note: e2eRoot ? 'Сверка публичных файлов тестов с закреплённым HA roster' : 'Снимок закреплённого companion; текущее внешнее дерево не предоставлено.' };
    for (const item of companionInventory.rows) {
        const beta = BETA_E2E.some(x => x.file === item.file && x.title === item.title);
        rows.push({ id: 'e2e:' + item.id, path: item.file, type: item.setup ? 'ha-setup' : 'ha-e2e', layer: item.setup ? 'infra' : 'product', domains: unique(['integration', ...domainsOf(item.file + ' ' + item.title)]), scenario: item.title, project: item.project, importance: item.setup ? 'preparation' : beta ? 'critical' : 'regression', lifecycle: item.setup ? 'ha-preparation' : beta ? 'beta-stable' : 'stable', classified: true, declaredVariants: 1, executedCases: null, sourceCommit: companionInventory.companionCommit });
    }
    if (e2eRoot) {
        const files = ['tests', 'fixtures', 'contract'].flatMap(dir => walk(e2eRoot, resolve(e2eRoot, dir))).filter(p => !p.startsWith('tests/legacy/'));
        for (const path of unique([...files, ...Object.keys(companionInventory.discoveryInputs || companionInventory.files)])) {
            const present = existsSync(resolve(e2eRoot, path)), hash = present ? createHash('sha256').update(readFileSync(resolve(e2eRoot, path))).digest('hex') : null;
            if (hash !== (companionInventory.discoveryInputs || companionInventory.files)[path]) {
                external.changedFiles.push(path);
                rows.push({ id: 'e2e-source:' + path, path, type: 'ha-e2e-source', layer: 'product', domains: unique(['integration', ...domainsOf(path)]), scenario: 'Новый/изменённый внешний файл: roster кейсов требует штатного Playwright discovery', importance: 'regression', lifecycle: 'beta-stable', classified: false, gapReason: 'Новый/изменённый companion input требует штатного discovery списка кейсов.', executedCases: null });
            }
        }
    }
    for (const item of CONVERTER_CASES)
        rows.push({ id: 'converter:' + item.id, path: 'process-next/converters/cases.mjs', type: 'converter', layer: 'infra', domains: ['storage', 'integration'], scenario: item.title, importance: 'diagnostic', lifecycle: 'diagnostic-stable', classified: true, declaredVariants: 1, executedCases: null });
    for (const [id, path] of [['mutations', 'process-next/lib/background.mjs'], ['coverage', 'scripts/coverage-diagnostic.mjs']])
        rows.push({ id, path, type: 'background', layer: 'infra', domains: ['toolchain'], scenario: id, importance: 'diagnostic', lifecycle: 'background', classified: true, executedCases: null });
    return { schema: 1, rows, excluded, external, gaps: rows.filter(row => !row.classified).map(row => ({ id: row.id, reason: row.gapReason || 'Не размечено: добавить наследуемую область в центральную taxonomy.' })), components: DOMAINS.map(([id, label, , links]) => ({ id, label, links })), counts: { files: rows.filter(fast).length, scenes: rows.filter(row => row.type === 'golden').length, checks: rows.length, executedCases: null } };
}
export async function selectTaskTests({ root, inventory, track, layer, changedFiles = [], areaTests = [], productSourceInputs = [] }) {
    const catalog = await testCatalog(root, inventory), rows = catalog.rows.filter(fast);
    const selected = new Map(), add = (path, reason) => {
        if (!existsSync(resolve(root, path)))
            return;
        const reasons = selected.get(path) || [];
        if (!reasons.includes(reason))
            reasons.push(reason);
        selected.set(path, reasons);
    };
    for (const path of areaTests)
        add(path, 'Дополнение исполнителя');
    // These are runtime file reads, not import edges. Keep the backend witnesses
    // when packaging output disappears, including infrastructure-only tasks.
    if (changedFiles.some(installedOutput)) {
        for (const file of ['tests_backend/test_ha_build_identity.py', 'tests_backend/test_frontend_assets.py',
            'tests_backend/test_ha_frontend_assets.py', 'tests_backend/test_ha_frontend_registration.py'])
            add(file, 'Читает установочные frontend/BUILD.json');
    }
    const product = layer === 'product';
    const productChanges = product ? changedFiles.filter(path => !productMetadata(path) && !isDocument(path)
        && !isTestCase(path) && !installedOutput(path) && (sourceFile(path) || productSourceInputs.includes(path))) : [];
    const infraChanges = changedFiles.filter(path => !isDocument(path) && (!product || isInfra(path) || productMetadata(path) || isTestCase(path)));
    const own = unique(productChanges.flatMap(domainsOf));
    const related = unique(own.flatMap(id => ids.get(id)[3]));
    const unknown = productChanges.filter(path => !domainsOf(path).length);
    const gaps = [], uncovered = [], alternatives = [], direct = dependencyReader(root);
    const rowsByPath = new Map(rows.map(row => [row.path, row]));
    const traversed = new Map();

    async function closure(path) {
        if (traversed.has(path)) return traversed.get(path);
        const result = new Set(), pending = [path];
        while (pending.length) {
            const file = pending.pop();
            if (result.has(file) || /^(?:dist|artifacts|demo\/srv\/assets)\//.test(file)) continue;
            if (/[?*]/.test(file)) { result.add(file); continue; }
            const refs = await direct(file);
            if (refs === null) continue;
            result.add(file);
            if (!AGGREGATION_BOUNDARIES.has(file)) pending.push(...refs);
        }
        traversed.set(path, result);
        return result;
    }

    const reads = (set, file) => set.has(file) || [...set].some(pattern => /[?*]/.test(pattern) && matchesInputs(file, [pattern]));
    const branchRows = rows.filter(row => row.layer === 'product');
    for (const row of rows) {
        if (changedFiles.includes(row.path) && (product || row.layer === 'infra')) add(row.path, 'Изменён сам исполняемый файл');
        if (!infraChanges.length || row.layer !== 'infra') continue;
        const inputs = await closure(row.path);
        for (const file of infraChanges) {
            if (product && file === mixedSourceScanner) {
                if (scannerWitnesses.includes(row.path)) add(row.path, 'Адресная проверка карты зависимостей: ' + file);
            } else if (reads(inputs, file)) add(row.path, 'Читает изменённый модуль/данные: ' + file);
        }
    }

    if (product) {
        for (const file of CRITICAL_NODE) add(file, 'Общее критичное ядро');
        const exact = new Map();
        if (productChanges.length) for (const row of branchRows) {
            const links = new Set(await direct(row.path) ?? []);
            for (const path of productChanges) if (reads(links, path)) {
                const declared = declaredSourceInputs(row.path).includes(path);
                const witnesses = exact.get(path) ?? [];
                witnesses.push({ row, proof: declared ? 0 : links.has(path) ? 1 : 2 });
                exact.set(path, witnesses);
            }
        }
        for (const file of productChanges) {
            const domains = domainsOf(file), directWitnesses = (exact.get(file) ?? []).sort(orderWitnesses);
            const boundary = AGGREGATION_BOUNDARIES.get(file);
            const mapped = boundary ? [[boundary.ship, boundary.show, boundary.ask]]
                : ADDRESS.filter(([match]) => match.test(file)).map(([, ...byTrack]) => byTrack);
            const explicit = mapped.flatMap(byTrack => byTrack.slice(0, depth[track]+1).flatMap(paths => paths ?? []));
            const named = unique(explicit).filter(path => rowsByPath.has(path));
            for (const path of named) add(path, 'Адресный контракт: ' + file);

            if (unknown.includes(file)) {
                for (const row of branchRows)
                    if (row.type === 'node' || row.type === 'backend' && file.startsWith('custom_components/'))
                        add(row.path, 'Безопасный fallback: неразмеченный исходник');
                gaps.push({ path: file, reason: 'Неизвестная область: сохранён полный быстрый fallback.' });
            }
            // Whole-tree readers are relevant to fingerprints. They only select
            // a check when it is the actual repository-data contract.
            const witnesses = directWitnesses.filter(({ row, proof }) => proof < 2
                && (!boundary || row.type !== 'browser' && proof === 1));
            const peers = witnesses.filter(({row}) => sameModule(row,file));
            for (const {row} of peers) add(row.path,'Прямой тест изменённого модуля: ' + file);
            const primary = (mapped.length
                ? witnesses.find(({row,proof}) => proof === 1 && row.type !== 'browser')
                : witnesses[0]);
            const addressedByArea = async () => {
                for (const path of areaTests)
                    if ((await closure(path)).has(file)) return true;
                return false;
            };
            if (file.startsWith('custom_components/') && primary?.row.type !== 'backend') {
                const backend = witnesses.find(({row}) => row.type === 'backend');
                if (backend) add(backend.row.path, 'Адресная серверная граница: ' + file);
            }
            if (primary) add(primary.row.path, 'Адресный читатель изменённого поведения: ' + file);
            if (!boundary && !mapped.length && track !== 'ship') {
                const seen = new Set(primary?.row.domains ?? []);
                const independent = new Set();
                for (const { row } of witnesses.slice(1)) {
                    const relation = row.domains.find(domain => related.includes(domain) && !seen.has(domain));
                    if (relation) {
                        seen.add(relation);
                        add(row.path, 'Адресная смежная граница (' + relation + '): ' + file);
                    } else if (track === 'ask' && row.importance !== 'regression') {
                        const domain = row.domains.find(id => domains.includes(id) && !independent.has(id));
                        if (!domain) continue;
                        independent.add(domain);
                        add(row.path, 'Независимый пограничный контракт (' + domain + '): ' + file);
                    }
                }
            }
            if (!named.length && !primary && !unknown.includes(file)) {
                const namedDomain = domains.flatMap(id => (ids.get(id)?.[4] ?? []).map(name => 'demo/smoke_' + name + '.mjs'))
                    .find(path => rowsByPath.has(path));
                if (namedDomain) add(namedDomain, 'Именованный свидетель ближайшего контракта: ' + file);
                else if (originalSourceFile(file) && !await addressedByArea()) uncovered.push(file);
                gaps.push({ path: file, reason: 'Нет прямого читателя. Используется именованный или явно заданный адресный свидетель.' });
            }
            if (unknown.includes(file) && originalSourceFile(file) && !primary && !named.length && !await addressedByArea()) uncovered.push(file);
            if (unknown.includes(file) && primary) add(primary.row.path, 'Адресное дополнение к консервативному fallback: ' + file);
            for (const { row, proof } of witnesses) if (proof === 0 && row.type === 'browser' && !boundary && !mapped.length && !selected.has(row.path)) {
                alternatives.push(row.path);
            }
        }
        // The compatibility scanner validates the actual source inventory. Its
        // declared dynamic scope is the contract itself, not a proxy import.
        if (rowsByPath.has('test/config-lifecycle.test.mjs')) for (const file of productChanges) {
            if (declaredSourceInputs('scripts/config-compatibility-inventory.mjs').some(pattern => matchesInputs(file,[pattern])))
                add('test/config-lifecycle.test.mjs','Читает область совместимости: ' + file);
        }
        // Shared build/data contracts have their own explicit readers, including
        // mechanics outside the ordinary product behavior taxonomy.
        for (const row of rows.filter(row => row.layer === 'infra' && row.type !== 'browser')) {
            if (!productChanges.length) break;
            const links = new Set(await direct(row.path) ?? []);
            for (const file of productChanges)
                if (!AGGREGATION_BOUNDARIES.has(file) && ((!row.path.startsWith('process-next/test/') && links.has(file))
                    || declaredSourceInputs(row.path).some(pattern => matchesInputs(file, [pattern]))))
                    add(row.path, 'Адресный контракт обвязки: ' + file);
        }
    }
    for (const path of infraChanges)
        if (!productMetadata(path) && !selected.has(path) && ![...selected.values()].some(reasons => reasons.some(reason => reason.includes(path))))
            gaps.push({ path, reason: 'Нет статически подтверждённого теста механизма; проверить дополнение исполнителя.' });
    for (const row of catalog.gaps) if (selected.has(row.id)) gaps.push(row);
    const files = [...selected.keys()].sort();
    return { files, explanation: { track, layer, domains: own, relatedDomains: related,
        candidateOptional: unique(alternatives).sort(), uncovered: unique(uncovered),
        optional: { selected: [], deferred: [] }, reasons: Object.fromEntries(selected), gaps,
        files: files.length, executedCases: null, catalog: { ...catalog.counts, unclassified: catalog.gaps.length },
        baseline: product ? 'Критичные данные/права и стартовый View' : 'Адресные проверки механизма',
        excludedLifecycles: ['golden', 'ha-e2e', 'converter', 'background'] } };
}
export function planRequirements(plan) {
    const steps = plan.steps || [], commands = steps.flatMap(s => s.command || []);
    const needsBackend = steps.some(s => /backend/.test(s.id) || s.command?.includes('pytest'));
    return { needsBrowser: steps.some(s => s.id === 'demo-assets' || /^smoke:|^golden-|^e2e-/.test(s.id)), needsBackend, needsPython: needsBackend || commands.some(x => /^python/.test(x)) || steps.some(s => s.inputs?.includes('.python-version') || s.id === 'infra-syntax' && s.command?.some(x => x.endsWith('.py'))), needsE2E: steps.some(s => /^e2e-|^converters-/.test(s.id)) };
}
export function selectionText(selection, report) {
    if (!selection)
        return '';
    const lines = [`S6 ${selection.track}/${selection.layer}: области ${selection.domains.join(', ') || 'не определены'}; выбрано ${selection.files} файлов.`, `Связи: ${selection.relatedDomains.join(', ') || 'нет'}. Кейсы до исполнения неизвестны; файлы не выдаются за кейсы.`];
    if (selection.optional)
        lines.push(`Дополнения: ${selection.optional.selected.length}; отложено ${selection.optional.deferred.length} (обязательные проверки не сокращаются).`);
    if (selection.optional?.deferred.length)
        lines.push('Причины отсрочки: ' + unique(selection.optional.deferred.map(row => row.reason)).join('; '));
    if (selection.budget) {
        const { limit, estimate, reasons, mode } = selection.budget;
        const groups = Object.entries(estimate.groups).map(([name,n]) => name + ' ' + n).join(', ');
        lines.push('План S6 ' + mode + ': ' + estimate.steps + '/' + limit.steps + ' новых шагов (' + groups + '), '
            + estimate.reused + ' зачтено.' + (mode === 'wsl' ? ' Прогноз ' + Math.ceil(estimate.ms / 1000) + ' с, '
            + estimate.unknown + ' шагов оценено по типу. Предел ' + limit.ms / 1000 + ' с.' : ' Таймер WSL не применяется.'));
        if (reasons.length) lines.push('Требуется расширение: ' + reasons.join(', '));
    }
    if (selection.uncovered?.length) lines.push('Нужно адресное покрытие: ' + selection.uncovered.join(', '));
    for (const [file, reasons] of Object.entries(selection.reasons))
        lines.push(`  ${file}: ${reasons.join('; ')}`);
    for (const gap of selection.gaps)
        lines.push(`  Пробел ${gap.path || gap.id}: ${gap.reason}`);
    if (report) {
        const counted = report.results.filter(r => r.counts?.tests !== undefined), cases = counted.reduce((sum, r) => sum + r.counts.tests, 0);
        if (report.s6Timing) {
            const t=report.s6Timing, seconds=ms=>Math.round(ms/1000)+' с';
            lines.push('Ожидание слота: '+(t.queueWaitMs===null?'вне замера':seconds(t.queueWaitMs))
                +'; подготовка: '+seconds(t.preparationMs)+'; исполнение: '+seconds(t.executionMs)
                +'; отчёт прогона: '+seconds(report.durationMs)+'. Подготовка и исполнение могут пересекаться.');
        }
        lines.push(`Итог: ${report.status}; известные кейсы ${cases}; зачтено шагов ${report.results.filter(r => r.status === 'reused').length}; шагов без счётчика ${report.results.length - counted.length}.`);
    }
    return lines.join('\n');
}
