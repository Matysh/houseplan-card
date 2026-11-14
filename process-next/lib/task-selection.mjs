import { createHash } from 'node:crypto';
import { CONVERTER_CASES } from '../converters/cases.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { walk, matchesInputs } from './storage.mjs';
import { dependencyReader } from './source-dependencies.mjs';
import { BETA_E2E, CRITICAL_NODE } from '../catalog/selections.mjs';
/** Behaviour taxonomy shared by inventory, task selection and its explanation.
 * Labels inherit from files; no per-test quota or title filtering is applied. */
export const FIXTURE_ARTIFACTS = new Map([['process-next/test/metrics.test.mjs', 'All ZIP/frontend/benchmark paths are created in measurementFixture mkdtemp; the test consumes no prepared product artifact.'], ['process-next/test/runner.test.mjs', 'dist/report.json occurs only in rejected output-path metadata; the runner test never reads product dist.'], ['test/coverage-diagnostic.test.mjs', 'All generated artifacts belong to its mkdtemp fixtures; it never needs the product checkout dist.']]);
export const DOMAINS = [
    ['geometry', 'Геометрия, стены и комнаты', /(?:wall|junction|masonry|physical|plan-graph|plan-exact|render-exact|polygon|polyclip|contour|coordinate|optimiz|room-face|space-geometry|geometry|graph|grid|canvas|floor|room|node|column|partition|apex|near-axis|open-span|model-invariant|plan-entry|plan-rotation|zero-divider|merge|split|align|contact-basis|plan-drawing|open-passage|range-line|size-angle|active-chain|edit-walk|plan-signed)/, ['storage', 'history', 'openings', 'lighting', 'isometry', 'pdf'], ['direct_wall_geometry', 'geometry_history_refusal']],
    ['storage', 'Хранение, импорт и полномочия', /(?:plan-host|plan-capabilit|config|storage|store|layout|migration|upload|durab|backup|import|serializ|canonical|validation|rights|permiss|access|revision|conflict|write|transport|late-context|binding-status|legacy-draft|previous-data|discard|save-|saved-plan|copy|signing|sign-cap|converter|plan-signed|houseplan\/(?:const|plans|http-api)\.py|houseplan\/core\/(?:constants|ports|file-usage)\.py|core-boundary|sh3d-convert)/, ['geometry', 'history', 'devices'], ['geometry_history_refusal', 'view_edit_permissions']],
    ['history', 'История и атомарные операции', /(?:history|undo|command-stack|adoption)/, ['storage', 'geometry', 'editors'], ['geometry_history_refusal']],
    ['openings', 'Двери, окна и проёмы', /(?:opening|door|window)/, ['geometry', 'lighting'], ['static_wall_openings']],
    ['editors', 'Редакторы и жесты', /(?:editor|gesture|pointer|drag|selection|resize|keyboard|nudge|snap|touch)/, ['history', 'presentation', 'navigation'], ['editor_gestures', 'editor_draft_exit']],
    ['presentation', 'Отображение и интерфейс', /(?:view|render|style|theme|color|appearance|label|display|ui-kit|form-kit|popover|tooltip|dialog|toolbar|chrome|ui[_-]|standalone-presentation|properties|surface|header|menu|tray|hover|tip|toast|modal|confirm|settings|palette|visual|volumetric|mode-transition|support|help|ux-fixes|yellow-principle|feedback|font|gear|gs-always|hidden|hide-layer|picker|motion|mode|css|styling|approved-ui|tap-ctx|tap-run)/, ['navigation', 'i18n'], ['view_recovery']],
    ['navigation', 'Пространства, камера, киоск и профили', /(?:panel|route|nav|space-switch|space-create|space-delete|kiosk|screen|profile|viewport|camera|panzoom|fit-view|space[-_]|zoom|first-space|pan[-_]|deeplink|plan-picker)/, ['presentation', 'editors'], ['space_switch_transitions', 'kiosk_space_navigation']],
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
    ['isometry', '2.5D и проекции', /(?:isometric|isometry|iso-)/, ['geometry', 'presentation', 'devices'], ['isometric_live_touch']],
    ['pdf', 'Печать и векторный экспорт', /(?:pdf|svg-export|export-svg|print)/, ['geometry', 'presentation'], ['pdf_export']],
    ['i18n', 'Локализация', /(?:i18n|locale|translation|language|unit|format)/, ['presentation'], ['i18n_live']],
    ['performance', 'Производительность и кеши', /(?:performance|benchmark|latency|cache|invalidation|memory|warm|measurement|budget|demand|identity|epoch|deferred|frame)/, ['presentation', 'navigation'], ['selective_invalidation']],
];
const companionInventory = JSON.parse(readFileSync(new URL('../catalog/companion-inventory.json', import.meta.url), 'utf8'));
const observedCosts = JSON.parse(readFileSync(new URL('../catalog/costs.json', import.meta.url), 'utf8'));
const ids = new Map(DOMAINS.map(row => [row[0], row]));
const isInfra = p => /^(?:process-next\/|scripts\/|\.github\/)/.test(p);
export function domainsOf(path) { return DOMAINS.filter(row => row[2].test(path.toLowerCase().replaceAll('_', '-'))).map(row => row[0]); }
const fast = row => ['node', 'backend', 'browser'].includes(row.type);
const unique = xs => [...new Set(xs)];
// Runtime shell/stand loaders intentionally aggregate the whole product. That
// build dependency remains in execution fingerprints, but is not evidence that
// every consumer tests each nested behaviour. Dedicated readers and domain
// witnesses still select the component's actual contracts.
const AGGREGATION_BOUNDARIES = new Set(['demo/serve.mjs', 'demo/bundle-freshness.mjs', 'scripts/source-fingerprint.mjs', 'src/houseplan-card.ts', 'src/houseplan-panel.ts']);
const originalSourceFile = p => /^(?:src\/|custom_components\/houseplan\/|assets\/)/.test(p) || /^(?:package(?:-lock)?\.json|tsconfig.*\.json|rollup\.config\.mjs)$/.test(p);
const isDocument = p => /\.md$/i.test(p) || /^(?:LICENSE|NOTICE)(?:\.[^/]+)?$/.test(p) || /^docs\/.*\.(?:png|jpe?g|webp|svg|gif|pdf)$/i.test(p);
// Shared helpers, fixtures and contracts are real selection inputs as well as
// production modules. A new unrecognised input must remain visibly conservative.
const sourceFile = p => originalSourceFile(p) || !isInfra(p) && !isDocument(p);
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
/** Static import/data reachability; wildcard source readers remain classified
 * by their behaviour rather than turning every change into every meta-test. */
/** Budget governs optional related witnesses only. Unknown mandatory cost
 * never masquerades as spare time; mandatory units are never removed. */
export function chooseOptionalChecks(candidates, { budgetMs, mandatoryMs, mandatoryUnknown }) {
    const selected = [], deferred = [], seen = new Set();
    let used = mandatoryMs;
    for (const candidate of [...candidates].sort((a, b) => a.priority - b.priority || a.path.localeCompare(b.path))) {
        if (seen.has(candidate.path))
            continue;
        seen.add(candidate.path);
        const reason = mandatoryUnknown ? 'Неизвестна стоимость обязательной части' : !Number.isFinite(candidate.durationMs) ? 'Неизвестна стоимость дополнения' : used + candidate.durationMs > budgetMs ? 'Не помещается в гипотезу бюджета' : null;
        if (reason)
            deferred.push({ path: candidate.path, reason });
        else {
            selected.push(candidate.path);
            used += candidate.durationMs;
        }
    }
    return { selected, deferred };
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
    const product = layer === 'product', productChanges = product ? changedFiles.filter(p => !isDocument(p) && (sourceFile(p) || productSourceInputs.includes(p))) : [],
        infraChanges = changedFiles.filter(p => !isDocument(p) && (!product || isInfra(p)));
    if (product)
        for (const file of CRITICAL_NODE)
            add(file, 'Общее критичное ядро');
    const own = unique(productChanges.flatMap(domainsOf)), unknown = productChanges.filter(path => !domainsOf(path).length);
    const related = unique(own.flatMap(id => ids.get(id)[3]));
    const wide = own.includes('shared') ? DOMAINS.filter(row => !['process', 'toolchain'].includes(row[0])).map(row => row[0]) : track === 'ask' ? unique([...own, ...related]) : track === 'show' ? unique([...own, ...related.filter(id => ['storage', 'history', 'geometry'].includes(id))]) : own.filter(id => ['geometry', 'storage', 'history'].includes(id));
    const direct = dependencyReader(root), memo = new Map(), readerMatches = new Set(), mappingGaps = [];
    async function closure(path) {
        if (memo.has(path))
            return memo.get(path);
        const result = new Set(), pending = [path], visited = new Set();
        while (pending.length) {
            const file = pending.pop();
            if (visited.has(file) || /^(?:dist|artifacts|demo\/srv\/assets)\//.test(file))
                continue;
            visited.add(file);
            if (/[?*]/.test(file)) { result.add(file); continue; }
            const refs = await direct(file);
            if (refs === null)
                continue;
            result.add(file);
            if (AGGREGATION_BOUNDARIES.has(file))
                continue;
            pending.push(...refs);
        }
        memo.set(path, result);
        return result;
    }
    for (const row of rows) {
        const eligible = product || row.layer === 'infra';
        if (!eligible)
            continue;
        const relevant = row.layer === 'infra' ? unique([...infraChanges, ...(product ? productChanges : [])]) : productChanges;
        if (changedFiles.includes(row.path))
            add(row.path, 'Изменён сам исполняемый файл');
        if (relevant.length) {
            const inputs = await closure(row.path);
            for (const file of relevant)
                if (inputs.has(file) || [...inputs].some(pattern => /[?*]/.test(pattern) && matchesInputs(file, [pattern]))) {
                    add(row.path, `Читает изменённый модуль/данные: ${file}`);
                    readerMatches.add(file);
                }
        }
        if (row.layer === 'product' && productChanges.length) {
            if (track === 'show' && row.type !== 'browser' && ['critical', 'boundary'].includes(row.importance) && row.domains.some(id => related.includes(id)))
                add(row.path, 'Контракт непосредственной связи компонента (show)');
            if (row.type !== 'browser' && ['critical', 'boundary'].includes(row.importance) && row.domains.some(id => own.includes(id)))
                add(row.path, 'Критичный/пограничный контракт изменённого поведения');
            if (unknown.length && (row.type === 'node' || unknown.some(p => p.startsWith('custom_components/')) && row.type === 'backend'))
                add(row.path, 'Безопасный fallback: неразмеченный исходник');
            if (row.domains.some(id => wide.includes(id)) && row.type !== 'browser')
                add(row.path, `Обязательная область/связь (${track}): ${row.domains.filter(id => wide.includes(id)).join(', ')}`);
        }
    }
    for (const path of productChanges.filter(path => domainsOf(path).length && !readerMatches.has(path))) {
        const domains = domainsOf(path);
        mappingGaps.push({ path, reason: 'Нет статически подтверждённого читателя: выбран полный быстрый набор ближайших областей.' });
        const nearest = rows.filter(row => row.layer === 'product' && row.type !== 'browser' && row.domains.some(id => domains.includes(id)));
        const fallback = nearest.length ? nearest : rows.filter(row => row.layer === 'product' && row.type === 'node');
        for (const row of fallback)
            add(row.path, nearest.length ? 'Полный быстрый набор области при неполной карте связей' : 'Нет набора ближайшей области: полный быстрый Node fallback');
    }
    if (product && productChanges.length) {
        const smokeDomains = track === 'ship' ? own : unique([...own, ...related]);
        for (const domain of smokeDomains)
            for (const name of (own.includes(domain) || track === 'ask' ? ids.get(domain)?.[4] || [] : (ids.get(domain)?.[4] || []).slice(0, 1)))
                add(`demo/smoke_${name}.mjs`, `Сквозной native-контракт области ${domain}`);
    }
    // An unclassified infra mechanism still gets all statically related tests.
    // If it has no reader, keep the gap visible instead of inventing a passing test.
    const files = [...selected.keys()].sort(), gaps = [...unknown.map(path => ({ path, reason: 'Неизвестная область: выбран полный быстрый Node fallback.' })), ...mappingGaps, ...catalog.gaps.filter(row => selected.has(row.id))];
    for (const path of infraChanges)
        if (!files.some(file => selected.get(file).some(reason => reason.includes(path))))
            gaps.push({ path, reason: 'Нет статически подтверждённого теста механизма; проверить дополнение исполнителя.' });
    const measured = files.filter(file => !CRITICAL_NODE.includes(file)).map(file => observedCosts.units[file]);
    const preparation = product ? ['product-build', 'test-build', 'demo-assets'].map(id => observedCosts.units[id]) : [];
    const cost = { knownMs: [...preparation, ...measured].reduce((sum, row) => sum + (row?.durationMs || 0), 0), unknownUnits: measured.filter(row => !row).length, expectedTotalMs: null, sourceRun: observedCosts.sourceRun, environment: observedCosts.environment, wholeS6BaselineMs: product ? observedCosts.baseline.totalMs : null, hypothesisSeconds: observedCosts.hypothesisSeconds[track], note: 'Исторические наблюдения подготовленной WSL, не норматив. Сумма последовательных затрат, без обещания параллельного времени; неизвестное не заменено квотой.' };
    const candidates = related.flatMap((id, priority) => (ids.get(id)?.[4] || []).map(name => ({ path: `demo/smoke_${name}.mjs`, priority, durationMs: observedCosts.units[`demo/smoke_${name}.mjs`]?.durationMs })))
        .filter(row => existsSync(resolve(root, row.path)) && !selected.has(row.path));
    const optional = chooseOptionalChecks(candidates, { budgetMs: observedCosts.hypothesisSeconds[track] * 1000, mandatoryMs: cost.knownMs, mandatoryUnknown: cost.unknownUnits + (product && !observedCosts.units['startup-view'] ? 1 : 0) });
    for (const path of unique(optional.selected)) {
        add(path, 'Дополнительный связанный native-контракт по приоритету и известной стоимости');
        files.push(path);
        cost.knownMs += observedCosts.units[path].durationMs;
    }
    files.sort();
    return { files, explanation: { track, layer, domains: own, relatedDomains: related, cost, optional, reasons: Object.fromEntries(selected), gaps, files: files.length, executedCases: null, catalog: { ...catalog.counts, unclassified: catalog.gaps.length }, baseline: product ? 'Критичные данные/права и стартовый View' : 'Адресные проверки механизма', excludedLifecycles: ['golden', 'ha-e2e', 'converter', 'background'] } };
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
    if (selection.cost)
        lines.push(`Оценка всего S6: неизвестна; исторический минимум ${selection.cost.wholeS6BaselineMs === null ? 'не применим' : (selection.cost.wholeS6BaselineMs / 1000) + ' с'}; гипотеза ${selection.cost.hypothesisSeconds} с, без нижней границы и гейта.`);
    if (selection.cost)
        lines.push(`Стоимость: известная часть ${Math.round(selection.cost.knownMs / 1000)} с; неизвестных единиц ${selection.cost.unknownUnits}. ${selection.cost.note}`);
    for (const [file, reasons] of Object.entries(selection.reasons))
        lines.push(`  ${file}: ${reasons.join('; ')}`);
    for (const gap of selection.gaps)
        lines.push(`  Пробел ${gap.path || gap.id}: ${gap.reason}`);
    if (report) {
        const counted = report.results.filter(r => r.counts?.tests !== undefined), cases = counted.reduce((sum, r) => sum + r.counts.tests, 0);
        lines.push(`Итог: ${report.status}; известные кейсы ${cases}; зачтено шагов ${report.results.filter(r => r.status === 'reused').length}; шагов без счётчика ${report.results.length - counted.length}.`);
    }
    return lines.join('\n');
}
