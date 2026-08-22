import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectSmokes, parseDiff, symbolTable } from '../scripts/smoke-select.mjs';
import { SMOKE_LINKS, registeredSmokes } from '../scripts/smoke-links.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const fixture = (name) =>
  readFileSync(join(repoRoot, 'test/fixtures/smoke-select', name), 'utf8');

// Выборка считается по настоящему корпусу смоков и настоящей таблице символов:
// фикстура — только дифф. Тест поэтому краснеет и когда ломается инструмент, и
// когда контракт переименовали, не обновив связи. Второе — тоже дефект.
const names = (selection) => selection.direct.map((entry) => entry.smoke);
const strongNames = (selection) => selection.direct
  .filter((entry) => entry.strong).map((entry) => entry.smoke);

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
  assert.ok(junctions.symbols.includes('_draftSegmentCms'));
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

test('таблица символов не берёт одиночные английские слова (#241)', () => {
  const table = symbolTable(repoRoot);
  for (const noise of ['floor', 'value', 'index', 'return', 'length', 'edit']) {
    assert.ok(!table.has(noise), `«${noise}» попал в таблицу символов и вернёт шум`);
  }
  for (const real of ['chainSegmentCms', '_draftSegmentCms', 'innerEdgeSpan']) {
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
    assert.ok(link.symbols.length, 'связь без символов не сработает никогда');
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
