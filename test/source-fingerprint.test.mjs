import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  browserArgumentCorpus, captureScriptFingerprint, fingerprintCorpus, postCaptureInputs, sourceFingerprint, visualFingerprint,
} from '../scripts/source-fingerprint.mjs';
import { verifyDocsCandidate } from '../scripts/docs-accept.mjs';

test('#999 edits to consumed history capture inputs retire source and visual identities', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'hp-history-capture-inputs-'));
  try {
    for (const name of ['src', 'demo/helpers', 'demo/golden', 'demo/fixtures', 'test/fixtures/vacuum-history'])
      mkdirSync(resolve(directory, name), { recursive: true });
    const put = (name, value) => writeFileSync(resolve(directory, name), value);
    put('src/example.ts', 'export const value=1;\n');
    put('demo/golden/vacuum-history.mjs', "import {record} from '../helpers/vacuum-history.mjs';\nexport const selected=record;\n");
    put('demo/helpers/vacuum-history.mjs', "export const record='a';\n");
    const fixture = 'test/fixtures/vacuum-history/dreame-tasshack-2.0.2.json';
    put(fixture, JSON.stringify({payload:{path:[[1,0,0,1000,0]]}}));
    const initial = [sourceFingerprint(directory), visualFingerprint(directory)];
    put(fixture, JSON.stringify({payload:{path:[[1,0,0,2000,0]]}}));
    const geometryChanged = [sourceFingerprint(directory), visualFingerprint(directory)];
    assert.notEqual(geometryChanged[0], initial[0], 'a different rendered history path needs a fresh source identity');
    assert.notEqual(geometryChanged[1], initial[1], 'old captures cannot prove the changed path');
    put('demo/helpers/vacuum-history.mjs', "export const record='b';\n");
    assert.notEqual(sourceFingerprint(directory), geometryChanged[0], 'the actual capture selection helper is an input');
    assert.notEqual(visualFingerprint(directory), geometryChanged[1], 'a changed selected record retires visual evidence');
    const saved='demo/fixtures/sun-transparent.json';
    put(saved,JSON.stringify({room:{settings:{sun_transparent:true}}}));
    const lit=[sourceFingerprint(directory),visualFingerprint(directory)];
    put(saved,JSON.stringify({room:{settings:{sun_transparent:false}}}));
    assert.notEqual(sourceFingerprint(directory),lit[0],'saved solar classification is an executable capture input');
    assert.notEqual(visualFingerprint(directory),lit[1],'old frames cannot prove a changed solar fixture');
  } finally { rmSync(directory, {recursive:true, force:true}); }
});

test('#896 capture identity follows browser flags and local helper dependencies, before candidate copying', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'hp-capture-identity-'));
  try {
    for (const dir of ['src', 'demo/docs', 'demo/golden']) mkdirSync(resolve(directory, dir), { recursive: true });
    const put = (file, text) => writeFileSync(resolve(directory, file), text);
    put('demo/docs/capture.mjs', 'capture();\n');
    put('demo/docs/browser-args.mjs', "export { args } from './flags.mjs';\n");
    put('demo/docs/flags.mjs', "export const args=['--force-color-profile=srgb'];\n");
    put('demo/golden/policy.mjs', 'export const policy=1;\n');
    const identity = captureScriptFingerprint(directory), source = sourceFingerprint(directory), visual = visualFingerprint(directory);
    assert.deepEqual(browserArgumentCorpus(directory), ['demo/docs/browser-args.mjs', 'demo/docs/flags.mjs']);
    put('demo/docs/flags.mjs', "export const args=['--force-color-profile=srgb'];\r\n");
    assert.equal(captureScriptFingerprint(directory), identity, 'line-ending canonical');
    put('demo/golden/policy.mjs', 'export const policy=2;\n');
    assert.equal(captureScriptFingerprint(directory), identity);
    assert.equal(sourceFingerprint(directory), source);
    put('demo/docs/flags.mjs', "export const args=['--force-color-profile=display-p3'];\n");
    assert.notEqual(captureScriptFingerprint(directory), identity);
    assert.notEqual(sourceFingerprint(directory), source);
    assert.notEqual(visualFingerprint(directory), visual);
    let reads = 0;
    const manifest = { version: 1, fixture: 'synthetic-only', sourceFingerprint: visual,
      captureScriptSha256: identity, chromium: 'pinned', scenarios: {} };
    assert.throws(() => verifyDocsCandidate({ root: directory, manifest, version: 1, scenarios: [],
      expectedFingerprint: visualFingerprint(directory), readBytes() { reads++; assert.fail('stale bytes read'); } }), /отпечаток/);
    assert.equal(reads, 0);
    assert.throws(() => verifyDocsCandidate({ root: directory, manifest, version: 1, scenarios: [],
      expectedFingerprint: visual, readBytes() { reads++; assert.fail('stale bytes read'); } }), /browser-args/);
    assert.equal(reads, 0);
    assert.throws(() => verifyDocsCandidate({ root: directory,
      manifest: { ...manifest, captureScriptSha256: undefined }, version: 1, scenarios: [], expectedFingerprint: visual }), /browser-args/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('source fingerprint is stable across LF and CRLF checkouts', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-fingerprint-'));
  const lf = resolve(directory, 'lf');
  const crlf = resolve(directory, 'crlf');
  try {
    mkdirSync(resolve(lf, 'src'), { recursive: true });
    mkdirSync(resolve(crlf, 'src'), { recursive: true });
    writeFileSync(resolve(lf, 'src/example.ts'), 'const a = 1;\nconst b = 2;\n', 'utf8');
    writeFileSync(resolve(crlf, 'src/example.ts'), 'const a = 1;\r\nconst b = 2;\r\n', 'utf8');
    assert.equal(sourceFingerprint(lf), sourceFingerprint(crlf));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('source fingerprint changes with source and build inputs', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-fingerprint-change-'));
  try {
    mkdirSync(resolve(directory, 'src'), { recursive: true });
    writeFileSync(resolve(directory, 'src/example.ts'), 'export const value = 1;\n', 'utf8');
    writeFileSync(resolve(directory, 'package.json'), '{"name":"fixture"}\n', 'utf8');
    const initial = sourceFingerprint(directory);
    writeFileSync(resolve(directory, 'src/example.ts'), 'export const value = 2;\n', 'utf8');
    const sourceChanged = sourceFingerprint(directory);
    assert.notEqual(sourceChanged, initial);
    writeFileSync(resolve(directory, 'package.json'), '{"name":"changed"}\n', 'utf8');
    assert.notEqual(sourceFingerprint(directory), sourceChanged);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('source fingerprint includes deterministic visual fixtures and golden code', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-fingerprint-fixture-'));
  try {
    mkdirSync(resolve(directory, 'src'), { recursive: true });
    mkdirSync(resolve(directory, 'demo/fixtures'), { recursive: true });
    mkdirSync(resolve(directory, 'demo/golden'), { recursive: true });
    writeFileSync(resolve(directory, 'src/example.ts'), 'export const value = 1;\n', 'utf8');
    writeFileSync(resolve(directory, 'demo/fixtures/plan.mjs'), 'export const fixture = 1;\n', 'utf8');
    writeFileSync(resolve(directory, 'demo/golden/matrix.mjs'), 'export const matrix = 1;\n', 'utf8');
    const initial = sourceFingerprint(directory);
    writeFileSync(resolve(directory, 'demo/fixtures/plan.mjs'), 'export const fixture = 2;\n', 'utf8');
    const fixtureChanged = sourceFingerprint(directory);
    assert.notEqual(fixtureChanged, initial);
    writeFileSync(resolve(directory, 'demo/golden/matrix.mjs'), 'export const matrix = 2;\n', 'utf8');
    assert.notEqual(sourceFingerprint(directory), fixtureChanged);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// #245: два отпечатка отвечают на два разных вопроса. «Тот же ли это бандл» —
// версия входит, потому что бандл действительно другой. «Те же ли это
// скриншоты» — версия не входит, потому что на картинках её нет. Раньше вопрос
// был один, и каждый релизный коммит оставлял job docs красным.

const releaseFixture = () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-fingerprint-release-'));
  mkdirSync(resolve(directory, 'src'), { recursive: true });
  writeFileSync(resolve(directory, 'src/houseplan-card.ts'),
    "const CARD_VERSION = '1.66.0';\nexport const paint = () => 1;\n", 'utf8');
  writeFileSync(resolve(directory, 'package.json'),
    '{"name":"fixture","version":"1.66.0","dependencies":{"lit":"3.1.0"}}\n', 'utf8');
  writeFileSync(resolve(directory, 'package-lock.json'),
    '{"name":"fixture","version":"1.66.0","packages":{"":{"version":"1.66.0"},'
    + '"node_modules/lit":{"version":"3.1.0"}}}\n', 'utf8');
  return directory;
};

const bumpVersion = (directory, from, to) => {
  for (const file of ['src/houseplan-card.ts', 'package.json', 'package-lock.json']) {
    const path = resolve(directory, file);
    writeFileSync(path, readFileSync(path, 'utf8').split(from).join(to), 'utf8');
  }
};

test('бамп версии продукта не трогает отпечаток скриншотов, но трогает отпечаток бандла (#245)', () => {
  const directory = releaseFixture();
  try {
    const before = { bundle: sourceFingerprint(directory), visual: visualFingerprint(directory) };
    bumpVersion(directory, '1.66.0', '1.67.0-beta.1');
    assert.notEqual(sourceFingerprint(directory), before.bundle,
      'бандл после бампа другой — отпечаток обязан измениться, иначе несвежий бандл сойдёт за свежий');
    assert.equal(visualFingerprint(directory), before.visual,
      'номер версии на скриншотах не нарисован: требовать пересъёмки из-за него нечестно');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('отпечаток скриншотов не слепнет к правкам src и версиям зависимостей (#245)', () => {
  const directory = releaseFixture();
  try {
    const initial = visualFingerprint(directory);
    const cardPath = resolve(directory, 'src/houseplan-card.ts');
    writeFileSync(cardPath, readFileSync(cardPath, 'utf8').replace('paint = () => 1', 'paint = () => 2'), 'utf8');
    const afterSource = visualFingerprint(directory);
    assert.notEqual(afterSource, initial, 'правка src обязана требовать пересъёмки');

    const lockPath = resolve(directory, 'package-lock.json');
    writeFileSync(lockPath, readFileSync(lockPath, 'utf8').replace('"3.1.0"', '"3.2.0"'), 'utf8');
    assert.notEqual(visualFingerprint(directory), afterSource,
      'версия зависимости меняет рендер и обязана менять отпечаток — нормализуется только версия продукта');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('npm-скрипт не требует пересъёмки, а версия зависимости требует (#246)', () => {
  const directory = releaseFixture();
  try {
    const before = { bundle: sourceFingerprint(directory), visual: visualFingerprint(directory) };
    const packagePath = resolve(directory, 'package.json');
    const parsed = JSON.parse(readFileSync(packagePath, 'utf8'));
    parsed.scripts = { 'docs:accept': 'node scripts/docs-accept.mjs' };
    writeFileSync(packagePath, `${JSON.stringify(parsed)}\n`, 'utf8');
    assert.notEqual(sourceFingerprint(directory), before.bundle,
      'сборка читает package.json целиком — её отпечаток обязан ехать');
    assert.equal(visualFingerprint(directory), before.visual,
      'добавление npm-скрипта не меняет ни одного пикселя');

    parsed.dependencies.lit = '3.2.0';
    writeFileSync(packagePath, `${JSON.stringify(parsed)}\n`, 'utf8');
    assert.notEqual(visualFingerprint(directory), before.visual,
      'версия зависимости рендер меняет и пересъёмку требует');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

// #344. Корпус отпечатка обязан состоять из файлов, способных изменить кадр.
// Пока в него входили `accept.mjs` и `policy.mjs`, правка инструмента приёмки
// объявляла устаревшими бандл и манифест скриншотов — и в #334 из-за этого
// правило приёмки пришлось вызывать обёрткой вместо того, чтобы положить его
// туда, где ему место.

const goldenFixture = () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-fingerprint-corpus-'));
  mkdirSync(resolve(directory, 'src'), { recursive: true });
  mkdirSync(resolve(directory, 'demo/fixtures'), { recursive: true });
  mkdirSync(resolve(directory, 'demo/golden'), { recursive: true });
  writeFileSync(resolve(directory, 'src/example.ts'), 'export const value = 1;\n', 'utf8');
  writeFileSync(resolve(directory, 'demo/fixtures/plan.mjs'), 'export const fixture = 1;\n', 'utf8');
  for (const name of ['matrix', 'harness', 'run', 'device-battery', 'accept', 'policy']) {
    writeFileSync(resolve(directory, `demo/golden/${name}.mjs`),
      `export const ${name.replaceAll('-', '_')} = 1;\n`, 'utf8');
  }
  return directory;
};

const editGolden = (directory, name, value) => writeFileSync(
  resolve(directory, `demo/golden/${name}.mjs`), `export const ${name.replaceAll('-', '_')} = ${value};\n`, 'utf8',
);

test('правка инструмента приёмки не требует ни пересборки, ни пересъёмки (#344)', () => {
  const directory = goldenFixture();
  try {
    const before = { bundle: sourceFingerprint(directory), visual: visualFingerprint(directory) };
    editGolden(directory, 'accept', 2);
    editGolden(directory, 'policy', 2);
    assert.equal(sourceFingerprint(directory), before.bundle,
      'accept.mjs и policy.mjs исполняются после съёмки: бандл от их правки не устаревает');
    assert.equal(visualFingerprint(directory), before.visual,
      'ни одного пикселя они изменить не могут — пересъёмка была бы нечестной');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('файлы, определяющие кадр, из корпуса не выпали (#344)', () => {
  const directory = goldenFixture();
  try {
    // Обратная сторона важнее прямой: исключение, расползшееся на matrix,
    // harness, run или фикстуры, сделает несвежий бандл неотличимым от свежего.
    for (const name of ['matrix', 'harness', 'run', 'device-battery']) {
      const before = { bundle: sourceFingerprint(directory), visual: visualFingerprint(directory) };
      editGolden(directory, name, 2);
      assert.notEqual(sourceFingerprint(directory), before.bundle, `${name}.mjs влияет на кадр`);
      assert.notEqual(visualFingerprint(directory), before.visual, `${name}.mjs требует пересъёмки`);
    }
    const before = sourceFingerprint(directory);
    writeFileSync(resolve(directory, 'demo/fixtures/plan.mjs'), 'export const fixture = 2;\n', 'utf8');
    assert.notEqual(sourceFingerprint(directory), before, 'фикстура — геометрия снимаемого плана');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('состав исключения объявлен списком, а не угадывается по имени (#344)', () => {
  assert.deepEqual(postCaptureInputs(), ['demo/golden/accept.mjs', 'demo/golden/policy.mjs']);
});

test('в корпусе настоящего репозитория все canonical golden capture inputs (#344, #792, #881, #896, #866, #1026, #1038, #999)', () => {
  const corpus = fingerprintCorpus(fileURLToPath(new URL('..', import.meta.url)));
  const golden = corpus.filter((file) => file.startsWith('demo/golden/')).sort();
  assert.deepEqual(golden, [
    'demo/golden/decor-multiselect.mjs',
    'demo/golden/device-battery.mjs', 'demo/golden/device-contacts.mjs',
    'demo/golden/device-offline.mjs', 'demo/golden/harness.mjs',
    'demo/golden/interior-window-light.mjs',
    'demo/golden/marker-alerts.mjs',
    'demo/golden/matrix.mjs', 'demo/golden/run.mjs',
    'demo/golden/scene-repaint.mjs',
    'demo/golden/static-stability.mjs',
    'demo/golden/sun-transparent.mjs',
    'demo/golden/ui-lab-1081.mjs',
    'demo/golden/vacuum-history.mjs',
    'demo/golden/zigbee-led.mjs',
  ]);
  assert.ok(corpus.includes('demo/helpers/vacuum-history.mjs'), 'history capture consumes the real UI helper');
  assert.ok(corpus.includes('test/fixtures/vacuum-history/dreame-tasshack-2.0.2.json'), 'history geometry comes from this original-producer fixture');
  assert.ok(corpus.includes('demo/fixtures/sun-transparent.json'),'saved canonical solar geometry is a capture input');
  assert.ok(corpus.includes('scripts/source-fingerprint.mjs'), 'сам отпечаток остаётся входом сборки');
  assert.ok(corpus.some((file) => file.startsWith('src/')), 'корпус без src был бы пуст по смыслу');
});
