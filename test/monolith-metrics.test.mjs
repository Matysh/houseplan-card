// #624: шесть чисел связности монолита и гейт мёртвого кода — один модуль
// для `lint:unused` и `inventory`. Имена файлов монолита — через константы
// модуля: этот тест не читает монолит и не должен попадать в заморозку якорей. Фикстуры с известными числами: делегаты во
// всех формах, порт, `host.`, разбор диагностик, байты dist, храповик.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASELINE_FILE, BUNDLE_BYTES_BAND, CARD_FILE, METRIC_NAMES, RUNTIME_FILE, bundleBytes, classifyUnused, collectMetrics, compareWithBaseline, countDelegates,
  harnessMemberNames, hostReferences, portMemberNames, readBaseline,
} from '../scripts/monolith-metrics.mjs';
import { baselineFrom, decide } from '../scripts/unused-locals-gate.mjs';

const CARD = `
import { html } from 'lit';
class HouseplanCard {
  private _a = 1;
  // делегаты: return, async, без return, геттер, await
  private _saveMarker(): void { return this._editorRuntimeOrThrow()._saveMarker(); }
  private async _saveRoom(id: string): Promise<void> { return this._editorRuntimeOrThrow()._saveRoom(id); }
  private _open(): void { this._editorRuntimeOrThrow()._open(); }
  private get _tool(): string { return this._editorRuntimeOrThrow()._tool; }
  private async _apply(): Promise<void> { await this._editorRuntimeOrThrow()._apply(); }
  // не делегаты: два выражения, свой код, сам аксессор
  private _two(): void { this._a += 1; this._editorRuntimeOrThrow()._open(); }
  private _own(): number { return this._a * 2; }
  private _runtime() { return this._editorRuntimeOrThrow(); }
  private _editorRuntimeOrThrow(): any { return null; }
}
`;

const RUNTIME = `
export interface HouseplanEditorHostPort {
  _a: number;
  _tool: string;
  _saveRoom(id: string): Promise<void>;
  readonly _model: unknown[];
  'quoted-name'?: string;
}
class HouseplanEditorRuntime {
  constructor(public host: HouseplanEditorHostPort) {}
  run() { return this.host._a + this.host._tool.length; }
}
`;

test('#624 делегаты считаются по AST во всех формах, свой код — нет', () => {
  assert.equal(countDelegates(CARD), 5);
  assert.equal(countDelegates('class HouseplanCard { private _x() { return 1; } }'), 0);
  assert.throws(() => countDelegates('class Other {}'), /HouseplanCard/);
});

test('#624 члены порта и обращения host. считаются по именам', () => {
  const port = portMemberNames(RUNTIME);
  assert.deepEqual([...port].sort(), ['_a', '_model', '_saveRoom', '_tool', 'quoted-name']);
  const refs = hostReferences({
    [RUNTIME_FILE]: RUNTIME,
    'src/other.ts': 'const x = host._model; const y = port.host._a; ghost._z; hostile._q;',
    [CARD_FILE]: 'host._ignored; host._ignored2;', // карточка не считается
  });
  assert.equal(refs.count, 4, 'два в рантайме + два в other; ghost./hostile. — не host.');
  assert.deepEqual([...refs.names].sort(), ['_a', '_model', '_tool']);
});

test('#624 харнесс: имена, которых смоки касаются как свойств', () => {
  const names = harnessMemberNames({
    'demo/smoke_a.mjs': "card._saveMarker(); c._glowClipCache.clear(); Number(c._until || 0); el['_bracket'] = 1; card.publicName();",
  });
  assert.deepEqual([...names].sort(), ['_bracket', '_glowClipCache', '_saveMarker', '_until']);
});

test('#624 разбор диагностик: порт и харнесс разрешены и посчитаны, остальное — нарушение', () => {
  const cardText = [
    'class HouseplanCard {',
    '  private _portOnly = 1;',
    '  private _hostOnly(): void {}',
    '  private _harnessOnly = new Map();',
    '  private _dead = 2;',
    '  publicDead = 3;',
    '}',
  ].join('\n');
  const d = (line, name, file = CARD_FILE, code = 6133) => ({ file, line, code, message: `'${name}' is declared but its value is never read.` });
  const { allowed, violations } = classifyUnused([
    d(2, '_portOnly'), d(3, '_hostOnly'), d(4, '_harnessOnly'), d(5, '_dead'), d(6, 'publicDead'),
    d(1, '_portOnly', 'src/other.ts'), // не карточка — не разрешается, даже если имя из порта
    { file: 'src/x.ts', line: 1, code: 6192, message: 'All imports in import declaration are unused.' },
  ], {
    cardText, portNames: new Set(['_portOnly']), hostNames: new Set(['_hostOnly']), harnessNames: new Set(['_harnessOnly', '_dead_no']),
  });
  assert.deepEqual(allowed.port, ['_portOnly', '_hostOnly']);
  assert.deepEqual(allowed.harness, ['_harnessOnly']);
  assert.deepEqual(violations.map((v) => `${v.file}:${v.line}:${v.name}`), [
    `${CARD_FILE}:5:_dead`, `${CARD_FILE}:6:publicDead`, 'src/other.ts:1:_portOnly', 'src/x.ts:1:',
  ]);
});

test('#624 байты dist — сумма всех файлов, включая чанки; без сборки — null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-monolith-dist-'));
  try {
    mkdirSync(join(dir, 'dist', 'houseplan-assets'), { recursive: true });
    writeFileSync(join(dir, 'dist', 'houseplan-card.js'), 'a'.repeat(10));
    writeFileSync(join(dir, 'dist', 'houseplan-assets', 'chunk.js'), 'b'.repeat(1000));
    assert.equal(bundleBytes(join(dir, 'dist')), 1010);
    assert.equal(bundleBytes(join(dir, 'missing')), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#624 храповик: рост на 1 любого числа — красный, снижение без записи базы — тоже, равенство — зелёный', () => {
  const base = { delegates: 10, portMembers: 20, hostRefs: 30, portPrivates: 4, harnessPrivates: 5, bundleBytes: 1000 };
  assert.deepEqual(compareWithBaseline({ ...base }, base), { grown: [], shrunk: [] });
  for (const name of METRIC_NAMES.filter((n) => n !== 'bundleBytes')) {
    const grown = compareWithBaseline({ ...base, [name]: base[name] + 1 }, base).grown;
    assert.deepEqual(grown.map((g) => g.name), [name], `${name} +1 виден как рост`);
    const decision = decide({ metrics: { ...base, [name]: base[name] + 1 }, violations: [], baseline: base });
    assert.equal(decision.fail, true, `${name} +1 — красный гейт`);
    assert.match(decision.lines.join('\n'), new RegExp(`связность выросла: ${name} `));
  }
  // bundleBytes — с полосой, как gzip-потолок #438: чужой коммит в dev меняет
  // dist на сотни байт, и точное число красило бы каждую ветку после ребейза.
  assert.deepEqual(compareWithBaseline({ ...base, bundleBytes: base.bundleBytes + BUNDLE_BYTES_BAND }, base).grown, []);
  assert.deepEqual(compareWithBaseline({ ...base, bundleBytes: base.bundleBytes + BUNDLE_BYTES_BAND + 1 }, base).grown.map((g) => g.name), ['bundleBytes']);
  assert.deepEqual(compareWithBaseline({ ...base, bundleBytes: base.bundleBytes - BUNDLE_BYTES_BAND - 1 }, base).shrunk.map((g) => g.name), ['bundleBytes']);
  assert.equal(decide({ metrics: { ...base, bundleBytes: base.bundleBytes + BUNDLE_BYTES_BAND + 1 }, violations: [], baseline: base }).fail, true);
  const shrunk = decide({ metrics: { ...base, delegates: 9 }, violations: [], baseline: base });
  assert.equal(shrunk.fail, true);
  assert.match(shrunk.lines.join('\n'), /база не опущена: delegates 10 → 9/);
  assert.equal(decide({ metrics: base, violations: [], baseline: base }).fail, false);
  // Отсутствие числа в базе — рост (нельзя обнулить метрику, удалив ключ).
  const { portPrivates, ...withoutOne } = base;
  void portPrivates;
  assert.deepEqual(compareWithBaseline(base, withoutOne).grown.map((g) => g.name), ['portPrivates']);
});

test('#624 гейт: нарушения noUnusedLocals красят даже при равной базе; без dist — красный; без базы — красный', () => {
  const base = { delegates: 1, portMembers: 1, hostRefs: 1, portPrivates: 1, harnessPrivates: 1, bundleBytes: 1 };
  const violation = { file: 'src/x.ts', line: 3, code: 6133, message: "'y' is declared but its value is never read.", name: 'y' };
  const red = decide({ metrics: base, violations: [violation], baseline: base });
  assert.equal(red.fail, true);
  assert.match(red.lines.join('\n'), /src\/x\.ts:3 TS6133/);
  assert.equal(decide({ metrics: { ...base, bundleBytes: null }, violations: [], baseline: base }).fail, true);
  assert.equal(decide({ metrics: base, violations: [], baseline: null }).fail, true);
  assert.deepEqual(Object.keys(baselineFrom({ ...base, extra: 1 })), METRIC_NAMES);
});

test('#624 живое дерево: база равна текущим числам, нарушений нет (gate:small и Validate судят то же)', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const baseline = readBaseline(root);
  assert.ok(baseline, `${BASELINE_FILE} обязан существовать`);
  // Компилятор гоняет вся программа (~8 с): один раз здесь, как и в гейте.
  const { metrics, violations } = collectMetrics(root);
  assert.deepEqual(violations, [], 'мёртвый код по noUnusedLocals вне порта и харнесса');
  const { grown, shrunk } = compareWithBaseline(metrics, baseline);
  // bundleBytes судит гейт после сборки (Validate: Unit tests идут до Build,
  // локально dist может быть от другого дерева) — здесь пять чисел исходника.
  const source = (list) => list.filter((s) => s.name !== 'bundleBytes');
  assert.deepEqual(source(grown), [], 'связность выросла — вернуть или обосновать');
  assert.deepEqual(source(shrunk), [], 'связность упала — опустить базу: node scripts/unused-locals-gate.mjs --update');
  assert.equal(typeof readFileSync(join(root, BASELINE_FILE), 'utf8'), 'string');
});
