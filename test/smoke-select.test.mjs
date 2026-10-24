import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectSmokes, selectSmokeConnections, parseDiff, symbolTable, VISUAL_MINIMUM,
  requiredSmokeEntries, requiredSmokeIds, MAX_SYMBOL_SMOKES, MAX_RARE_SMOKES, MAX_INFERRED_SMOKES } from '../scripts/smoke-select.mjs';
import { smokesToRun } from '../scripts/gate-small.mjs';
import { SMOKE_LINKS, registeredSmokes } from '../scripts/smoke-links.mjs';
import historical from './data/smoke-selection-history.json' with { type: 'json' };

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixture = (name) =>
  readFileSync(join(repoRoot, 'test/fixtures/smoke-select', name), 'utf8');

// Выборка считается по настоящему корпусу смоков и настоящей таблице символов:
// фикстура — только дифф. Тест поэтому краснеет и когда ломается инструмент, и
// когда контракт переименовали, не обновив связи. Второе — тоже дефект.
const names = (selection) => selection.direct.map((entry) => entry.smoke);
const strongNames = (selection) => selection.direct
  .filter((entry) => entry.strong).map((entry) => entry.smoke);

const connectionInput = symbols => ({ files: ['src/subject.ts'], executable: ['src/subject.ts'], symbols, callees: [] });
const unrelatedCorpus = count => new Map(Array.from({ length: count }, (_, i) => [`smoke_unrelated_${i}.mjs`, '']));

test('#1060 corpus growth cannot promote broad or weak names to mandatory task checks', () => {
  const original = unrelatedCorpus(0);
  for (let i = 0; i <= MAX_SYMBOL_SMOKES; i++) original.set(`smoke_broad_${i}.mjs`, '_commonField');
  for (let i = 0; i <= MAX_RARE_SMOKES; i++) original.set(`smoke_weak_${i}.mjs`, '_sharedField');
  original.set('smoke_precise.mjs', '_specificContract');
  const parsed = connectionInput(['_commonField', '_sharedField', '_specificContract']);
  const options = { registry: [] };
  const before = selectSmokeConnections(parsed, original, options);
  const after = selectSmokeConnections(parsed, new Map([...original, ...unrelatedCorpus(1500)]), options);
  assert.deepEqual(requiredSmokeIds(before), ['smoke_precise.mjs']);
  assert.deepEqual(requiredSmokeIds(after), requiredSmokeIds(before));
  assert.equal(after.broadLimit, MAX_SYMBOL_SMOKES);
  assert.equal(after.rareLimit, MAX_RARE_SMOKES);
  assert.ok(after.broad.includes('_commonField'));
  assert.equal(after.deferred.smokes.length, MAX_RARE_SMOKES + 1);
  assert.equal(after.deferred.until, 'beta/night');
});

test('#1060 overflow defers the whole inferred set and preserves every explicit route', () => {
  const corpus = unrelatedCorpus(200), symbols = [];
  for (let i = 0; i <= MAX_INFERRED_SMOKES; i++) {
    const symbol = `_specificContract${i}`;
    symbols.push(symbol); corpus.set(`smoke_contract_${i}.mjs`, symbol);
  }
  const parsed = connectionInput(symbols);
  parsed.files.push('demo/smoke_contract_0.mjs');
  const registry = [{ smoke: 'smoke_contract_1.mjs', symbols: [symbols[1]], because: ['Explicit AC witness'] }];
  const options = { registry, declaredSmokes: ['smoke_contract_2.mjs'] };
  const selection = selectSmokeConnections(parsed, corpus, options);
  assert.deepEqual(requiredSmokeEntries(selection), [], 'no first-N truncation');
  assert.equal(selection.inference.deferred, true);
  assert.deepEqual(selection.registered, registry, 'deferred matches cannot hide registered evidence');
  assert.deepEqual(requiredSmokeIds(selection), [...VISUAL_MINIMUM, 'smoke_contract_0.mjs',
    'smoke_contract_1.mjs', 'smoke_contract_2.mjs'].sort());
  assert.equal(selection.deferred.smokes.length, MAX_INFERRED_SMOKES - 2);
  assert.deepEqual(requiredSmokeIds(selectSmokeConnections(parsed, new Map([...corpus].reverse()), options)),
    requiredSmokeIds(selection), 'selection is independent of corpus order');
  assert.deepEqual(smokesToRun(selection), requiredSmokeIds(selection), 'the local gate uses the same mandatory scope');
});

test('#1060 weak lexical coincidence cannot suppress an authoritative registry link', () => {
  const corpus = unrelatedCorpus(200);
  for (let i = 0; i <= MAX_RARE_SMOKES; i++) corpus.set(`smoke_shared_${i}.mjs`, '_sharedField');
  const registry = [{ smoke: 'smoke_shared_0.mjs', symbols: ['_sharedField'], because: ['Explicit contract'] }];
  const selection = selectSmokeConnections(connectionInput(['_sharedField']), corpus, { registry });
  assert.deepEqual(selection.registered, registry);
  assert.deepEqual(requiredSmokeIds(selection), ['smoke_shared_0.mjs']);
  assert.ok(!selection.deferred.smokes.includes('smoke_shared_0.mjs'));
});

test('#1060 smoke-only edits and declared AC survive no executable source diff', () => {
  const corpus = new Map([['smoke_changed.mjs', ''], ['smoke_declared.mjs', '']]);
  const selection = selectSmokes('diff --git a/demo/smoke_changed.mjs b/demo/smoke_changed.mjs\n+assert(actual);',
    { table: new Set(), corpus, declaredSmokes: ['smoke_declared.mjs'] });
  assert.equal(selection.noExecutableDiff, true);
  assert.deepEqual(smokesToRun(selection), ['smoke_changed.mjs', 'smoke_declared.mjs']);
});

test('#1060 historical task plans shrink without losing their explicit contracts', () => {
  for (const sample of historical.cases) {
    const corpus = new Map(sample.corpus.map(([name, symbols]) => [name, symbols.join(' ')]));
    const selection = selectSmokeConnections(sample.parsed, corpus,
      { registry: sample.registry, declaredSmokes: sample.declaredSmokes });
    const actual = [...new Set([...requiredSmokeIds(selection), ...(sample.harnessChanged ? VISUAL_MINIMUM : [])])].sort();
    assert.deepEqual(actual, sample.afterIds, `#${sample.issue} immutable task plan`);
    assert.ok(actual.length < sample.beforeIds.length / 2, `#${sample.issue}: ${actual.length} vs ${sample.beforeIds.length}`);
    const mandatory = [...sample.registry.map(entry => entry.smoke), ...sample.declaredSmokes,
      ...sample.parsed.files.filter(file => /^demo\/smoke_[\w-]+\.mjs$/.test(file)).map(file => file.slice(5)).filter(name => corpus.has(name))];
    for (const smoke of mandatory) assert.ok(actual.includes(smoke), `#${sample.issue} lost ${smoke}`);
    const grown = selectSmokeConnections(sample.parsed, new Map([...corpus, ...unrelatedCorpus(2000)]),
      { registry: sample.registry, declaredSmokes: sample.declaredSmokes });
    assert.deepEqual(requiredSmokeIds(grown), requiredSmokeIds(selection), `#${sample.issue} corpus growth inflated scope`);
  }
});

test('#234: выборка находит все четыре смока контрольного случая (#241)', () => {
  const selection = selectSmokes(fixture('234-chain-thickness.diff'), { root: repoRoot });
  const recommended = new Set([
    ...strongNames(selection),
    ...selection.registered.map((entry) => entry.smoke),
  ]);
  for (const smoke of [
    'smoke_wall_chain_thickness.mjs',
    'smoke_draw_wall_thickness.mjs',
    'smoke_wall_thickness_transition.mjs',
    'smoke_wall_junctions.mjs',
  ]) {
    assert.ok(recommended.has(smoke), `${smoke} не попал в выборку по диффу #234`);
  }
  // Именно тот смок, на котором #234 потерял регресс, и именно по имени поля:
  // если связь начнёт находиться «вообще как-нибудь», проверка обесценится.
  const junctions = selection.direct.find((e) => e.smoke === 'smoke_wall_junctions.mjs');
  assert.ok(junctions.symbols.includes('_wallChainSegmentCms'));
  // И не превращается в полный прогон: смысл выборки в том, что она меньше матрицы.
  assert.ok(recommended.size < selection.smokeCount / 4,
    `выборка ${recommended.size} из ${selection.smokeCount} — это уже полная матрица`);
});

test('#234: переход толщин держится на зарегистрированной связи, а не на совпадении', () => {
  const selection = selectSmokes(fixture('234-chain-thickness.diff'), { root: repoRoot });
  // Смок не называет ни одного изменённого символа — если он вдруг окажется в
  // прямых совпадениях, значит реестр перестал быть нагруженным, и мутант его
  // удаления ничего не докажет.
  assert.ok(!names(selection).includes('smoke_wall_thickness_transition.mjs'),
    'смок перехода нашёлся по совпадению — реестр надо пересобрать заново');
  const entry = selection.registered.find(
    (candidate) => candidate.smoke === 'smoke_wall_thickness_transition.mjs',
  );
  assert.ok(entry, 'зарегистрированная связь #234 пропала');
  assert.ok(entry.symbols.includes('chainSegmentCms'));
  assert.ok(entry.because.join(' ').length > 40, 'связь без объяснения — суеверие');
});

test('только документация: выборка пуста и говорит почему (#241)', () => {
  const selection = selectSmokes(fixture('docs-only.diff'), { root: repoRoot });
  assert.equal(selection.noExecutableDiff, true);
  assert.deepEqual(selection.direct, []);
  assert.deepEqual(selection.registered, []);
  // «Нечего выбирать» и «неопределённость» — разные ответы, и путать их нельзя.
  assert.equal(selection.unproven, false);
  assert.ok(selection.files.length > 0, 'файлы в диффе всё же были');
});

test('связь не доказана — это неопределённость, а не «проверок не нужно» (#241)', () => {
  const selection = selectSmokes(fixture('unproven.diff'), { root: repoRoot });
  assert.equal(selection.noExecutableDiff, false);
  assert.equal(selection.unproven, true);
  assert.equal(strongNames(selection).length, 0);
  assert.ok(selection.unseen.includes('openingInnerFaceOffsetFromIndex'),
    'символ без смока обязан быть назван');
});

test('#690 п.1′: неопределённость выдаёт визуальный минимум, доказанная связь и docs — нет', () => {
  const unproven = selectSmokes(fixture('unproven.diff'), { root: repoRoot });
  assert.deepEqual(unproven.visualMinimum, [...VISUAL_MINIMUM]);
  for (const smoke of VISUAL_MINIMUM) {
    assert.ok(smokesToRun(unproven).includes(smoke), `gate:small -- --smokes не гоняет ${smoke}`);
  }
  assert.deepEqual(selectSmokes(fixture('234-chain-thickness.diff'), { root: repoRoot }).visualMinimum, [],
    'при доказанной связи минимум не нужен — выборка остаётся меньше матрицы');
  const docs = selectSmokes(fixture('docs-only.diff'), { root: repoRoot });
  assert.deepEqual(docs.visualMinimum, []);
  assert.deepEqual(smokesToRun(docs), [], 'без исполняемого диффа смоков нет');
});

test('#690 п.1′: визуальный минимум — 5–9 существующих смоков, и CLI его печатает', () => {
  // #898, решение владельца 14.10.2026: потолок без запаса поднят на 10 % с округлением вверх (8 → 9).
  assert.ok(VISUAL_MINIMUM.length >= 5 && VISUAL_MINIMUM.length <= 9, `в минимуме ${VISUAL_MINIMUM.length}`);
  for (const smoke of VISUAL_MINIMUM) assert.ok(existsSync(join(repoRoot, 'demo', smoke)), `нет demo/${smoke}`);
  assert.ok(VISUAL_MINIMUM.includes('smoke_modes.mjs'), 'смок, которого не хватило #687');
  const cli = spawnSync(process.execPath, ['scripts/smoke-select.mjs', '--diff', 'test/fixtures/smoke-select/unproven.diff'],
    { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /Визуальный минимум \(\d\) — прогнать до S7/);
  for (const smoke of VISUAL_MINIMUM) assert.ok(cli.stdout.includes(`demo/${smoke}`), smoke);
});

test('#754 AC1: правка аргументов многострочного вызова выбирает смоки вызываемой функции', () => {
  // Дифф #741 с контекстом 3: обе изменённые строки карточки —
  // аргументы `runtime.resolveIsoOverlayFitEnvelope({` строкой выше. Имя
  // вызываемой есть только в контексте, а за ним в реестре стоят ровно те два
  // смока, которые автор #741 гонял вручную.
  const selection = selectSmokes(fixture('741-call-arguments.diff'), { root: repoRoot });
  assert.deepEqual(selection.callees, ['resolveIsoOverlayFitEnvelope']);
  assert.ok(selection.symbols.includes('resolveIsoOverlayFitEnvelope'));
  const recommended = new Set([...strongNames(selection), ...selection.registered.map((entry) => entry.smoke)]);
  for (const smoke of ['smoke_iso_flat_parity.mjs', 'smoke_isometric_contract.mjs']) {
    assert.ok(recommended.has(smoke), `${smoke} не выбран по вызову resolveIsoOverlayFitEnvelope`);
  }
  assert.equal(selection.unproven, false);
  assert.deepEqual(selection.visualMinimum, []);
  const cli = spawnSync(process.execPath, ['scripts/smoke-select.mjs', '--diff', 'test/fixtures/smoke-select/741-call-arguments.diff'],
    { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /← resolveIsoOverlayFitEnvelope \(вызов\)/, 'символ по вызову назван как вызов');
});

test('#754 AC1: без строк контекста та же правка — неопределённость, как до #754', () => {
  // Защита снята: тот же дифф без контекста (`--unified=0`, как выборка брала
  // его раньше) не видит вызова, и ответ возвращается к визуальному минимуму.
  const bare = fixture('741-call-arguments.diff').split('\n').filter((line) => !line.startsWith(' ')).join('\n');
  const selection = selectSmokes(bare, { root: repoRoot });
  assert.deepEqual(selection.callees, []);
  assert.equal(selection.unproven, true);
  assert.deepEqual(selection.visualMinimum, [...VISUAL_MINIMUM]);
});

test('#754 AC1: вызов ищется сквозь литерал-аргумент, но не за `;` и не из тела блока', () => {
  const table = new Set(['resolveThing', 'otherThing']);
  const hunk = (...lines) => parseDiff(['diff --git a/src/a.ts b/src/a.ts', '--- a/src/a.ts', '+++ b/src/a.ts',
    '@@ -1,5 +1,5 @@', ...lines].join('\n'), table);
  const argument = hunk(
    "   const v = host.resolveThing(first, 'a (b', {",
    '     keep: 1,',
    '-    drop: 2,',
    '+    drop: 3,',
    '   });',
  );
  assert.deepEqual(argument.callees, ['resolveThing'], 'аргумент-литерал приписан вызову');
  assert.deepEqual(argument.symbols, ['resolveThing']);
  const nested = hunk(
    '   resolveThing([',
    '     [1,',
    '-      2],',
    '+      3],',
    '   ]);',
  );
  assert.deepEqual(nested.callees, ['resolveThing'], 'массив в массиве-аргументе — тоже аргумент');
  const closed = hunk(
    '   resolveThing({',
    '     a: 1,',
    '   });',
    '-  next = 1;',
    '+  next = 2;',
  );
  assert.deepEqual(closed.callees, [], 'строка после закрытого `;` вызова — не его аргумент');
  assert.deepEqual(closed.symbols, []);
  const block = hunk(
    '   resolveThing(items, () => {',
    '-    count = 1;',
    '+    count = 2;',
    '   });',
  );
  assert.deepEqual(block.callees, [], 'тело функции-аргумента — блок, а не аргумент');
  const assigned = hunk(
    '   otherThing(a);',
    '   const options = {',
    '-    a: 1,',
    '+    a: 2,',
    '   };',
  );
  assert.deepEqual(assigned.callees, [], 'литерал в присваивании — не аргумент вызова');
  const named = hunk(
    '   resolveThing({',
    '-    a: 1,',
    '+    a: resolveThing.default,',
    '   });',
  );
  assert.deepEqual(named.callees, [], 'символ на изменённой строке — прямой, не вызов');
  assert.deepEqual(named.symbols, ['resolveThing']);
});

test('#772: вложенные свойства аргумента сохраняют вызов, но не пересекают тело функции', () => {
  const hunk = (...lines) => parseDiff([
    'diff --git a/src/a.ts b/src/a.ts', '--- a/src/a.ts', '+++ b/src/a.ts',
    '@@ -1,5 +1,5 @@', ...lines,
  ].join('\n'), new Set(['resolveThing']));
  for (const property of ['key: {', 'key: [', "'key': {", '[key]: {']) {
    const result = hunk('   resolveThing({', `     ${property}`, '-      enabled: false,', '+      enabled: true,');
    assert.deepEqual(result.callees, ['resolveThing'], property);
  }
  for (const boundary of [
    '   resolveThing(items, () => {',
    '   resolveThing(items, function callback() {',
    '   resolveThing({ method() {',
    '   resolveThing(items); const options = {',
  ]) {
    const result = hunk(boundary, '     key: {', '-      enabled: false,', '+      enabled: true,');
    assert.deepEqual(result.symbols, [], boundary);
  }
  const selection = selectSmokes([
    'diff --git a/src/a.ts b/src/a.ts', '--- a/src/a.ts', '+++ b/src/a.ts',
    '@@ -1,5 +1,5 @@', '   resolveIsoOverlayFitEnvelope({', '     stageSize: {',
    '-      width: 100,', '+      width: 200,', '     },', '   });',
  ].join('\n'), { root: repoRoot });
  assert.deepEqual(selection.callees, ['resolveIsoOverlayFitEnvelope']);
  assert.ok(smokesToRun(selection).includes('smoke_iso_flat_parity.mjs'));
});

test('#772: CSS комнаты выбирает room-fill smoke без символов и сохраняет визуальный минимум', () => {
  const diff = [
    'diff --git a/src/styles/plan.styles.ts b/src/styles/plan.styles.ts',
    '--- a/src/styles/plan.styles.ts', '+++ b/src/styles/plan.styles.ts',
    '@@ -1,3 +1,3 @@', '     .room {', '-      transition: none;',
    '+      transition: fill 180ms;', '     }',
  ].join('\n');
  const selection = selectSmokes(diff, { root: repoRoot });
  assert.deepEqual(selection.symbols, []);
  const link = selection.registered.find((entry) => entry.smoke === 'smoke_room_fill_transitions.mjs');
  assert.deepEqual(link?.files, ['src/styles/plan.styles.ts']);
  assert.ok(smokesToRun(selection).includes('smoke_room_fill_transitions.mjs'));
  // Привязка всего файла — широкая: она не отменяет прежние безопасные проверки.
  assert.deepEqual(selection.visualMinimum, [...VISUAL_MINIMUM]);
  assert.ok(!smokesToRun(selectSmokes(diff.replaceAll('plan.styles.ts', 'dialogs.styles.ts'), { root: repoRoot }))
    .includes('smoke_room_fill_transitions.mjs'), 'чужая таблица стилей не выбирает room-fill');
  const cli = spawnSync(process.execPath, [join(repoRoot, 'scripts/smoke-select.mjs'), '--diff', '-'],
    { input: diff, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert.match(cli.stdout, /smoke_room_fill_transitions\.mjs[\s\S]*src\/styles\/plan\.styles\.ts \(файл\)/);
});

test('#812 AC5: space-render selects baseline and identity without clearing uncertainty', () => {
  const diff = [
    'diff --git a/src/space-render.ts b/src/space-render.ts',
    '--- a/src/space-render.ts', '+++ b/src/space-render.ts',
    '@@ -1 +1 @@', '-  opacity: 0.5,', '+  opacity: 0.8,',
  ].join('\n');
  const selection = selectSmokes(diff, { root: repoRoot });
  assert.deepEqual(selection.symbols, []);
  for (const smoke of ['smoke_space_card.mjs', 'smoke_space_card_identity.mjs']) {
    const link = selection.registered.find((entry) => entry.smoke === smoke);
    assert.deepEqual(link?.files, ['src/space-render.ts'], smoke);
    assert.ok(smokesToRun(selection).includes(smoke), smoke);
  }
  assert.equal(selection.unproven, true, 'a broad file link is not a proven symbol link');
  assert.deepEqual(selection.visualMinimum, [...VISUAL_MINIMUM]);
  const foreign = selectSmokes(diff.replaceAll('space-render.ts', 'unrelated.ts'), { root: repoRoot });
  assert.ok(!foreign.registered.some((entry) => entry.smoke === 'smoke_space_card.mjs'));
});

test('таблица символов не берёт одиночные английские слова (#241)', () => {
  const table = symbolTable(repoRoot);
  for (const noise of ['floor', 'value', 'index', 'return', 'length', 'edit']) {
    assert.ok(!table.has(noise), `«${noise}» попал в таблицу символов и вернёт шум`);
  }
  for (const real of ['chainSegmentCms', '_wallChainSegmentCms', 'innerEdgeSpan']) {
    assert.ok(table.has(real), `${real} не распознан как символ проекта`);
  }
});

test('parseDiff читает только исполняемый frontend (#241)', () => {
  const table = new Set(['chainSegmentCms']);
  const parsed = parseDiff([
    'diff --git a/docs/CHANGELOG.md b/docs/CHANGELOG.md',
    '+chainSegmentCms упомянут в документации',
    'diff --git a/src/wall-face-graph.ts b/src/wall-face-graph.ts',
    '+export function chainSegmentCms(',
  ].join('\n'), table);
  assert.deepEqual(parsed.executable, ['src/wall-face-graph.ts']);
  assert.deepEqual(parsed.symbols, ['chainSegmentCms'], 'упоминание в docs не символ диффа');
});

test('каждая запись реестра объясняет себя и указывает на существующий смок (#241)', () => {
  for (const link of SMOKE_LINKS) {
    assert.ok(link.symbols?.length || link.files?.length, 'связь без символов или файлов не сработает никогда');
    for (const file of link.files || []) {
      assert.match(file, /^src\/.*\.ts$/);
      assert.ok(readFileSync(join(repoRoot, file), 'utf8').length, `${file} в реестре, но файла нет`);
    }
    assert.ok(link.because && link.because.length > 40, 'связь без объяснения — суеверие');
    for (const smoke of link.smokes) {
      assert.match(smoke, /^smoke_.*\.mjs$/);
      assert.ok(
        readFileSync(join(repoRoot, 'demo', smoke), 'utf8').length > 0,
        `${smoke} в реестре, но файла нет`,
      );
    }
  }
  // Пустой набор изменённых символов не должен давать связей.
  assert.deepEqual(registeredSmokes([]), []);
});
