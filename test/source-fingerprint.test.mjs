import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  fingerprintCorpus, postCaptureInputs, sourceFingerprint, visualFingerprint,
} from '../scripts/source-fingerprint.mjs';

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
  for (const name of ['matrix', 'harness', 'run', 'accept', 'policy']) {
    writeFileSync(resolve(directory, `demo/golden/${name}.mjs`),
      `export const ${name} = 1;\n`, 'utf8');
  }
  return directory;
};

const editGolden = (directory, name, value) => writeFileSync(
  resolve(directory, `demo/golden/${name}.mjs`), `export const ${name} = ${value};\n`, 'utf8',
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
    for (const name of ['matrix', 'harness', 'run']) {
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

test('в корпусе настоящего репозитория из demo/golden ровно три файла (#344)', () => {
  const corpus = fingerprintCorpus(fileURLToPath(new URL('..', import.meta.url)));
  const golden = corpus.filter((file) => file.startsWith('demo/golden/')).sort();
  assert.deepEqual(golden, ['demo/golden/harness.mjs', 'demo/golden/matrix.mjs', 'demo/golden/run.mjs']);
  assert.ok(corpus.includes('scripts/source-fingerprint.mjs'), 'сам отпечаток остаётся входом сборки');
  assert.ok(corpus.some((file) => file.startsWith('src/')), 'корпус без src был бы пуст по смыслу');
});
