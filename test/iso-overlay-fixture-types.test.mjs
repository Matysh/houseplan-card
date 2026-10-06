import test from 'node:test';
import assert from 'node:assert/strict';
import nodePath from 'node:path';
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
//
// #754: так же судится вход окна оверлеев `resolveIsoOverlayFitEnvelope` —
// тип `OverlayFitFixture`, хелпер `overlayFit`. До этого литерал шёл прямо в
// функцию из `test-build`, и возвращённый `stageSize: null` (поле удалила #741)
// оставлял проверку зелёной.
//
// #777: имена файлов хост сравнивает ключом TypeScript, а не строкой.
// Компилятор нормализует корневые имена (`C:\…\test\x.mjs` → `C:/…/test/x.mjs`)
// и только потом спрашивает хост, а `node:path` на Windows строит имена через
// `\`. Строковое сравнение не узнавало виртуальный зонд — на Windows его не
// было в программе, и тест падал `TypeError` на `probe.text`; тем же сравнением
// фильтр разрешения модулей пропускал `../test-build/*` в программу.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURE_NAMES = ['iso-scene-render.test.mjs', 'iso-stage6.test.mjs'];
const PROBE_NAME = '__iso-overlay-fixture-probe.mjs';
/** «Object literal may only specify known properties…» — с подсказкой и без. */
const EXCESS_PROPERTY = new Set([2353, 2561]);
/** Входы сцены и поле записи, которых у боевых типов нет (#714, #724, #732). */
const DEAD_SCENE_FIELDS = ['view', 'referenceView', 'stageSize', 'layers', 'selectedDeviceId'];
const DEAD_ENTRY_FIELDS = ['groundRadius'];
/** Поле входа окна оверлеев, которого у боевого типа нет (#741). */
const DEAD_FIT_FIELDS = ['stageSize'];
/** Вызов → тип, которым обязан проверяться его аргумент-фикстура. */
const CHECKED_CALLS = new Map([
  ['buildIsoOverlayRenderScene', 'OverlaySceneFixture'],
  ['overlayScene', 'OverlaySceneFixture'],
  ['resolveIsoOverlayFitEnvelope', 'OverlayFitFixture'],
  ['overlayFit', 'OverlayFitFixture'],
]);
const tagOf = (name) => name.replace(/\W/g, '_');

/** Файлы программы в форме путей `path`: `node:path` платформы или `path.win32` (#777). */
function fixtureLayout(path, root) {
  const testDir = path.join(root, 'test');
  return {
    path,
    root,
    testDir,
    config: path.join(root, 'tsconfig.json'),
    fixtureFiles: FIXTURE_NAMES.map((name) => path.join(testDir, name)),
    probe: path.join(testDir, PROBE_NAME),
  };
}

/** Зонд: каждое мёртвое поле — отдельный литерал (TypeScript называет одно лишнее поле на литерал). */
function probeSource() {
  const lines = [];
  const typed = (type, name, body) => lines.push(`/** @type {${type}} */`, `export const ${name} = { ${body} };`);
  for (const name of FIXTURE_NAMES) {
    const scene = `import('./${name}').OverlaySceneFixture`;
    const tag = tagOf(name);
    typed(scene, `${tag}_known`, 'space: null, structure: null, positionOf: null');
    DEAD_SCENE_FIELDS.forEach((field, index) => typed(scene, `${tag}_scene${index}`, `${field}: null`));
  }
  const entry = "import('./iso-scene-render.test.mjs').OverlayEntryFixture";
  typed(entry, 'entry_known', 'id: null, placement: null, screenHalfSize: null');
  DEAD_ENTRY_FIELDS.forEach((field, index) => typed(entry, `entry${index}`, `${field}: null`));
  const fit = "import('./iso-scene-render.test.mjs').OverlayFitFixture";
  typed(fit, 'fit_known', 'baseBounds: null, entries: null, targetView: null, ownerId: null');
  DEAD_FIT_FIELDS.forEach((field, index) => typed(fit, `fit${index}`, `${field}: null`));
  return `${lines.join('\n')}\n`;
}

/** Хост компилятора поверх `sys` — те члены, которые `ts.createCompilerHost` берёт из `ts.sys`. */
function compilerHost(options, sys) {
  const host = ts.createCompilerHost(options, true);
  if (sys === ts.sys) return host;
  return Object.assign(host, {
    getCurrentDirectory: () => sys.getCurrentDirectory(),
    useCaseSensitiveFileNames: () => sys.useCaseSensitiveFileNames,
    getCanonicalFileName: sys.useCaseSensitiveFileNames ? (name) => name : (name) => name.toLowerCase(),
    fileExists: (name) => sys.fileExists(name),
    readFile: (name) => sys.readFile(name),
    directoryExists: (name) => sys.directoryExists(name),
    getDirectories: (name) => sys.getDirectories(name),
    realpath: (name) => sys.realpath(name),
  });
}

/**
 * Программа фикстур и зонда. `path` и `root` — форма путей checkout'а, `sys` —
 * его файловая система; по умолчанию — эта платформа. Свидетель #777 передаёт
 * тот же репозиторий в форме Windows.
 */
function fixtureProgram({ path = nodePath, root = ROOT, sys = ts.sys } = {}) {
  const at = fixtureLayout(path, root);
  const config = ts.readConfigFile(at.config, sys.readFile).config;
  const { options: base } = ts.parseJsonConfigFileContent(config, sys, root);
  const options = {
    ...base, allowJs: true, checkJs: true, noEmit: true, incremental: false, types: [],
  };
  const host = compilerHost(options, sys);
  // #777: ключ имени — как у самого компилятора: разделитель `/` и
  // `getCanonicalFileName` хоста (без учёта регистра там, где ФС его не учитывает).
  const key = (name) => host.getCanonicalFileName(path.normalize(name).replaceAll(path.sep, '/'));
  const probeKey = key(at.probe);
  const isProbe = (name) => key(name) === probeKey;
  const probe = probeSource();
  const { getSourceFile, fileExists, readFile } = host;
  host.getSourceFile = (name, languageVersion, ...rest) => (isProbe(name)
    ? ts.createSourceFile(name, probe, languageVersion, true)
    : getSourceFile.call(host, name, languageVersion, ...rest));
  host.fileExists = (name) => isProbe(name) || fileExists.call(host, name);
  host.readFile = (name) => (isProbe(name) ? probe : readFile.call(host, name));
  // Тесты исполняют `../test-build/*.js` и `node:*`; для типов фикстур нужны
  // только JSDoc-импорты `../src/*` и файлы фикстур для зонда. Остальное не
  // разрешается — компилятор не тянет test-build и @types/node.
  const testDirKey = key(at.testDir);
  host.resolveModuleNameLiterals = (literals, containing, _redirect, opts) => literals.map((literal) => {
    const spec = literal.text;
    if (key(path.dirname(containing)) === testDirKey && !spec.startsWith('../src/') && !spec.startsWith('./')) {
      return { resolvedModule: undefined };
    }
    return ts.resolveModuleName(spec, containing, opts, host);
  });
  const program = ts.createProgram([...at.fixtureFiles, at.probe], options, host);
  return { program, checker: program.getTypeChecker(), at };
}

/** Путь для сообщения — от корня checkout'а, через `/`. */
const relative = (at, name) => at.path.relative(at.root, name).replaceAll(at.path.sep, '/');
const where = (at, diagnostic) => {
  const { line } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
  return `${relative(at, diagnostic.file.fileName)}:${line + 1}`;
};
const message = (diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');

/**
 * #777 AC2: файл, без которого проверка теряет смысл. Нет в программе — ошибка
 * с его именем, словами компилятора и файлами, которые программа знает, а не
 * `undefined` дальше по коду.
 */
function sourceFileOf({ program, at }, name) {
  const source = program.getSourceFile(name);
  if (source) return source;
  // Сначала корни программы, затем файлы checkout'а, затем зависимости.
  const roots = new Set(program.getRootFileNames().map((root) => program.getSourceFile(root)));
  const rank = (file) => (roots.has(file) ? 0 : relative(at, file.fileName).startsWith('..') ? 2 : 1);
  const known = program.getSourceFiles()
    .filter((file) => !program.isSourceFileDefaultLibrary(file))
    .sort((a, b) => rank(a) - rank(b))
    .map((file) => relative(at, file.fileName));
  const LIMIT = 12;
  const listed = known.slice(0, LIMIT).join(', ') + (known.length > LIMIT ? `, … и ещё ${known.length - LIMIT}` : '');
  const compiler = program.getOptionsDiagnostics()
    .map(message).filter((text) => text.includes(at.path.basename(name))).slice(0, 2);
  throw new Error(`файла ${name} нет в программе TypeScript — хост не узнал имя, которым его спросил компилятор`
    + `${compiler.length ? ` (${compiler.join('; ')})` : ''}. Программа знает ${known.length} файлов, кроме `
    + `библиотек: ${listed || '—'}`);
}

/** #732 AC2: лишние поля в файлах фикстур. */
function fixtureExcess(env) {
  return env.at.fixtureFiles.flatMap((file) => env.program.getSemanticDiagnostics(sourceFileOf(env, file)))
    .filter((diagnostic) => EXCESS_PROPERTY.has(diagnostic.code))
    .map((diagnostic) => `${where(env.at, diagnostic)} ${message(diagnostic)}`);
}

/** #732 AC2, #754: зонд принимает поля боевых входов и отвергает каждое мёртвое поле. */
function assertProbeVerdict(env) {
  const probe = sourceFileOf(env, env.at.probe);
  const rejected = new Map();
  for (const diagnostic of env.program.getSemanticDiagnostics(probe)) {
    const name = probe.text.slice(0, diagnostic.start).match(/export const (\w+) = [^\n]*$/)?.[1];
    assert.ok(EXCESS_PROPERTY.has(diagnostic.code), `${where(env.at, diagnostic)} ${message(diagnostic)}`);
    rejected.set(name, message(diagnostic));
  }
  for (const fixture of FIXTURE_NAMES) {
    const tag = tagOf(fixture);
    assert.ok(!rejected.has(`${tag}_known`), `${tag}: поля боевого входа принимаются`);
    DEAD_SCENE_FIELDS.forEach((field, index) => {
      assert.match(rejected.get(`${tag}_scene${index}`) || '', new RegExp(`'${field}' does not exist in type`),
        `test/${fixture}: OverlaySceneFixture отвергает ${field} — тип разрешился в боевой вход, а не в any`);
    });
  }
  assert.ok(!rejected.has('entry_known'), 'поля записи принимаются');
  DEAD_ENTRY_FIELDS.forEach((field, index) => {
    assert.match(rejected.get(`entry${index}`) || '', new RegExp(`'${field}' does not exist in type`));
  });
  // #754: вход окна оверлеев — тот же приём; размер сцены у него не вход с #741.
  assert.ok(!rejected.has('fit_known'), 'поля входа окна оверлеев принимаются');
  DEAD_FIT_FIELDS.forEach((field, index) => {
    assert.match(rejected.get(`fit${index}`) || '', new RegExp(`'${field}' does not exist in type 'OverlayFitFixture'`),
      `OverlayFitFixture отвергает ${field} — тип разрешился в боевой вход, а не в any`);
  });
  return rejected;
}

/** #732 AC2: вызовы построителя сцены и окна оверлеев и те из них, чей аргумент не проверен типом фикстуры. */
function fixtureCalls(env) {
  const aliasOf = (type) => type?.aliasSymbol?.name ?? null;
  const unchecked = [];
  const calls = new Map();
  for (const file of env.at.fixtureFiles) {
    const source = sourceFileOf(env, file);
    const visit = (node) => {
      const expected = ts.isCallExpression(node) && ts.isIdentifier(node.expression)
        && CHECKED_CALLS.get(node.expression.text);
      if (expected) {
        calls.set(expected, (calls.get(expected) || 0) + 1);
        const [arg] = node.arguments;
        // Литерал проверяется типом параметра (`overlayScene`, `overlayFit`),
        // прочее — своим объявленным типом; литерал прямо в функцию из
        // test-build не проверяется ничем.
        const type = arg && ts.isObjectLiteralExpression(arg)
          ? env.checker.getContextualType(arg) : arg && env.checker.getTypeAtLocation(arg);
        if (aliasOf(type) !== expected) {
          const { line } = source.getLineAndCharacterOfPosition(node.getStart());
          unchecked.push(`${relative(env.at, file)}:${line + 1} ${node.getText().slice(0, 80)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return { calls, unchecked };
}

/**
 * #777: этот же репозиторий, каким его видит Windows: корень `C:\houseplan-card\`
 * в форме `path.win32`, имена файлов без учёта регистра. Читает настоящий диск;
 * что вне корня (библиотеки TypeScript, цели симлинков), идёт как есть. Помнит
 * каждое имя, о котором спросили, — так видно, куда ходило разрешение модулей.
 */
function windowsCheckout(disk = ROOT) {
  const root = 'C:\\houseplan-card\\';
  const prefix = 'c:/houseplan-card/';
  const lookups = [];
  const toDisk = (name) => {
    lookups.push(name);
    const slashed = name.replaceAll('\\', '/');
    return slashed.toLowerCase().startsWith(prefix) ? disk + slashed.slice(prefix.length) : name;
  };
  const fromDisk = (name) => (name.startsWith(disk) ? root + name.slice(disk.length).replaceAll('/', '\\') : name);
  const sys = {
    ...ts.sys,
    useCaseSensitiveFileNames: false,
    getCurrentDirectory: () => root,
    fileExists: (name) => ts.sys.fileExists(toDisk(name)),
    readFile: (name, encoding) => ts.sys.readFile(toDisk(name), encoding),
    directoryExists: (name) => ts.sys.directoryExists(toDisk(name)),
    getDirectories: (name) => ts.sys.getDirectories(toDisk(name)),
    realpath: (name) => fromDisk(ts.sys.realpath(toDisk(name))),
    readDirectory: (name, ...rest) => ts.sys.readDirectory(toDisk(name), ...rest).map(fromDisk),
  };
  return { path: nodePath.win32, root, sys, lookups };
}

const native = fixtureProgram();

test('#732 AC2: фикстуры оверлеев не передают полей, которых нет у боевых типов', () => {
  assert.deepEqual(fixtureExcess(native), [], 'поле, которого никто не читает, фикстура не передаёт');
});

test('#732 AC2: тип фикстуры — ключи боевого входа; зум, размер сцены, слои, выделение и радиус земли — не входы', () => {
  assertProbeVerdict(native);
});

test('#732 AC2: каждая фикстура сцены и окна оверлеев доходит до своей функции через проверяемый тип', () => {
  const { calls, unchecked } = fixtureCalls(native);
  assert.ok(calls.get('OverlaySceneFixture') >= 20, `нашлись вызовы построителя сцены (${calls.get('OverlaySceneFixture')})`);
  assert.ok(calls.get('OverlayFitFixture') >= 4, `нашлись вызовы окна оверлеев (${calls.get('OverlayFitFixture')})`);
  assert.deepEqual(unchecked, [], 'фикстура сцены — литерал в overlayScene или объявление OverlaySceneFixture, '
    + 'фикстура окна оверлеев — литерал в overlayFit или объявление OverlayFitFixture');
});

test('#777: на путях Windows (C:\\…, имена без учёта регистра) зонд находится и судит так же, а test-build не разрешается', () => {
  const checkout = windowsCheckout();
  const windows = fixtureProgram(checkout);
  assert.equal(sourceFileOf(windows, windows.at.probe).text, probeSource(), 'зонд — виртуальный файл хоста, а не файл с диска');
  assert.deepEqual(assertProbeVerdict(windows), assertProbeVerdict(native), 'мёртвые поля отвергаются теми же словами');
  assert.deepEqual(checkout.lookups.filter((name) => /[\\/]test-build(?:[\\/]|$)/i.test(name)), [],
    'импорты test-build из файлов фикстур не разрешаются и на Windows');
});

test('#777 AC2: зонда нет в программе — ошибка с именем файла и файлами программы, а не TypeError', () => {
  const absent = nodePath.join(native.at.testDir, '__absent-overlay-probe.mjs');
  assert.throws(() => assertProbeVerdict({ ...native, at: { ...native.at, probe: absent } }), (error) => {
    assert.ok(!(error instanceof TypeError), `${error.name}: ${error.message}`);
    assert.ok(error.message.includes(absent), error.message);
    assert.match(error.message, /test\/iso-scene-render\.test\.mjs/);
    assert.match(error.message, /Программа знает \d+ файлов/);
    return true;
  });
});
