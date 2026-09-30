import test from 'node:test';
import assert from 'node:assert/strict';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// #732 AC2. Фикстуры тестов оверлеев 2.5D передавали поля, которых никто не
// читает: `view`, `referenceView`, `stageSize`, `layers`, `selectedDeviceId`
// у входа сцены и `groundRadius` у записи. Тесты оставались зелёными — и
// «проверяли», что зум, размер сцены или выделение не пересчитывают раскладку,
// хотя сигнатура их вообще не принимает.
//
// Здесь файлы с такими фикстурами проходят через компилятор TypeScript. Тип
// фикстуры (`OverlaySceneFixture`, `OverlayEntryFixture`) — ключи боевого типа
// входа с намеренно свободными значениями: фикстура частична, как и нужно
// тесту, но поле, которого у типа нет, — ошибка «лишнее свойство». Прочие
// диагностики этих файлов не судятся: сами тесты исполняют `test-build`, и
// частичность значений — их право.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const TEST_DIR = join(ROOT, 'test');
const FIXTURE_FILES = ['iso-scene-render.test.mjs', 'iso-stage6.test.mjs'].map((name) => join(TEST_DIR, name));
const PROBE = join(TEST_DIR, '__iso-overlay-fixture-probe.mjs');
/** «Object literal may only specify known properties…» — с подсказкой и без. */
const EXCESS_PROPERTY = new Set([2353, 2561]);
/** Входы сцены и поле записи, которых у боевых типов нет (#714, #724, #732). */
const DEAD_SCENE_FIELDS = ['view', 'referenceView', 'stageSize', 'layers', 'selectedDeviceId'];
const DEAD_ENTRY_FIELDS = ['groundRadius'];
const SCENE_BUILDERS = new Set(['buildIsoOverlayRenderScene', 'overlayScene']);
const tagOf = (file) => basename(file).replace(/\W/g, '_');

/** Зонд: каждое мёртвое поле — отдельный литерал (TypeScript называет одно лишнее поле на литерал). */
function probeSource() {
  const lines = [];
  const typed = (type, name, body) => lines.push(`/** @type {${type}} */`, `export const ${name} = { ${body} };`);
  for (const file of FIXTURE_FILES) {
    const scene = `import('./${basename(file)}').OverlaySceneFixture`;
    const tag = tagOf(file);
    typed(scene, `${tag}_known`, 'space: null, structure: null, positionOf: null');
    DEAD_SCENE_FIELDS.forEach((field, index) => typed(scene, `${tag}_scene${index}`, `${field}: null`));
  }
  const entry = "import('./iso-scene-render.test.mjs').OverlayEntryFixture";
  typed(entry, 'entry_known', 'id: null, placement: null, screenHalfSize: null');
  DEAD_ENTRY_FIELDS.forEach((field, index) => typed(entry, `entry${index}`, `${field}: null`));
  return `${lines.join('\n')}\n`;
}

function fixtureProgram() {
  const config = ts.readConfigFile(join(ROOT, 'tsconfig.json'), ts.sys.readFile).config;
  const { options: base } = ts.parseJsonConfigFileContent(config, ts.sys, ROOT);
  const options = {
    ...base, allowJs: true, checkJs: true, noEmit: true, incremental: false, types: [],
  };
  const host = ts.createCompilerHost(options, true);
  const probe = probeSource();
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, ...rest) => (name === PROBE
    ? ts.createSourceFile(name, probe, languageVersion, true)
    : getSourceFile(name, languageVersion, ...rest));
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name === PROBE || fileExists(name);
  // Тесты исполняют `../test-build/*.js` и `node:*`; для типов фикстур нужны
  // только JSDoc-импорты `../src/*` и файлы фикстур для зонда. Остальное не
  // разрешается — компилятор не тянет test-build и @types/node.
  host.resolveModuleNameLiterals = (literals, containing, _redirect, opts) => literals.map((literal) => {
    const spec = literal.text;
    if (dirname(containing) === TEST_DIR && !spec.startsWith('../src/') && !spec.startsWith('./')) {
      return { resolvedModule: undefined };
    }
    return ts.resolveModuleName(spec, containing, opts, host);
  });
  return ts.createProgram([...FIXTURE_FILES, PROBE], options, host);
}

const program = fixtureProgram();
const checker = program.getTypeChecker();
const where = (diagnostic) => {
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${diagnostic.file.fileName.slice(ROOT.length)}:${line + 1}`;
};
const message = (diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');

test('#732 AC2: фикстуры оверлеев не передают полей, которых нет у боевых типов', () => {
  const excess = FIXTURE_FILES.flatMap((file) => program.getSemanticDiagnostics(program.getSourceFile(file)))
    .filter((diagnostic) => EXCESS_PROPERTY.has(diagnostic.code))
    .map((diagnostic) => `${where(diagnostic)} ${message(diagnostic)}`);
  assert.deepEqual(excess, [], 'поле, которого никто не читает, фикстура не передаёт');
});

test('#732 AC2: тип фикстуры — ключи боевого входа; зум, размер сцены, слои, выделение и радиус земли — не входы', () => {
  const probe = program.getSourceFile(PROBE);
  const rejected = new Map();
  for (const diagnostic of program.getSemanticDiagnostics(probe)) {
    const name = probe.text.slice(0, diagnostic.start).match(/export const (\w+) = [^\n]*$/)?.[1];
    assert.ok(EXCESS_PROPERTY.has(diagnostic.code), `${where(diagnostic)} ${message(diagnostic)}`);
    rejected.set(name, message(diagnostic));
  }
  for (const file of FIXTURE_FILES) {
    const tag = tagOf(file);
    assert.ok(!rejected.has(`${tag}_known`), `${tag}: поля боевого входа принимаются`);
    DEAD_SCENE_FIELDS.forEach((field, index) => {
      assert.match(rejected.get(`${tag}_scene${index}`) || '', new RegExp(`'${field}' does not exist in type`),
        `${file.slice(ROOT.length)}: OverlaySceneFixture отвергает ${field} — тип разрешился в боевой вход, а не в any`);
    });
  }
  assert.ok(!rejected.has('entry_known'), 'поля записи принимаются');
  DEAD_ENTRY_FIELDS.forEach((field, index) => {
    assert.match(rejected.get(`entry${index}`) || '', new RegExp(`'${field}' does not exist in type`));
  });
});

test('#732 AC2: каждая фикстура сцены доходит до построителя через проверяемый тип', () => {
  const aliasOf = (type) => type?.aliasSymbol?.name ?? null;
  const unchecked = [];
  let calls = 0;
  for (const file of FIXTURE_FILES) {
    const source = program.getSourceFile(file);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && SCENE_BUILDERS.has(node.expression.text)) {
        calls += 1;
        const [arg] = node.arguments;
        // Литерал проверяется типом параметра (`overlayScene`), прочее — своим
        // объявленным типом; литерал прямо в построитель из test-build не
        // проверяется ничем.
        const type = arg && ts.isObjectLiteralExpression(arg)
          ? checker.getContextualType(arg) : arg && checker.getTypeAtLocation(arg);
        if (aliasOf(type) !== 'OverlaySceneFixture') {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          unchecked.push(`${file.slice(ROOT.length)}:${line + 1} ${node.getText().slice(0, 80)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.ok(calls >= 20, `нашлись вызовы построителя сцены (${calls})`);
  assert.deepEqual(unchecked, [], 'фикстура сцены — литерал в overlayScene или объявление типа OverlaySceneFixture');
});
