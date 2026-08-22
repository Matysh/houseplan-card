import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const sourceFiles = (directory) => {
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else files.push(path);
  }
  return files;
};

const BUILD_INPUTS = [
  'package.json',
  'package-lock.json',
  'rollup.config.mjs',
  'tsconfig.json',
  'scripts/source-fingerprint.mjs',
];

const fingerprintFiles = (root) => {
  const deterministicFixtureInputs = ['demo/fixtures', 'demo/golden']
    .map((name) => resolve(root, name))
    .filter(existsSync)
    .flatMap(sourceFiles)
    .filter((file) => file.endsWith('.mjs'));
  return [
    ...sourceFiles(resolve(root, 'src')),
    ...deterministicFixtureInputs,
    ...BUILD_INPUTS.map((name) => resolve(root, name)).filter(existsSync),
  ].sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
};

const digest = (root, files, normalize) => {
  const hash = createHash('sha256');
  for (const file of files) {
    const name = relative(root, file).replaceAll('\\', '/');
    hash.update(name);
    hash.update('\0');
    // Git-canonical text, independent of core.autocrlf. Otherwise the injected
    // hash would make an otherwise identical Windows/Linux bundle differ.
    hash.update(normalize(readFileSync(file, 'utf8').replace(/\r\n?/g, '\n'), name));
    hash.update('\0');
  }
  return hash.digest('hex');
};

/** Stable digest of frontend sources plus the files that control their build. */
export const sourceFingerprint = (root = process.cwd()) =>
  digest(root, fingerprintFiles(root), (text) => text);

/**
 * Поля `package.json`, способные изменить картинку. Всё остальное в этом файле —
 * имя, версия, описание, npm-скрипты — на рендер не влияет ни при каких
 * обстоятельствах, а требовать из-за них пересъёмки десяти PNG по 300 КБ
 * нечестно ровно так же, как из-за номера версии (#245, #246).
 */
const VISUAL_PACKAGE_FIELDS = ['dependencies', 'devDependencies', 'overrides', 'browserslist'];

const visualPackageProjection = (text) => {
  try {
    const parsed = JSON.parse(text);
    const projection = {};
    for (const field of VISUAL_PACKAGE_FIELDS) {
      if (parsed[field] !== undefined) projection[field] = parsed[field];
    }
    return JSON.stringify(projection);
  } catch {
    // Сломанный package.json — не повод молча считать отпечаток по проекции:
    // пусть он поедет, и пересъёмка потребуется.
    return text;
  }
};

/** Номер версии продукта, как его знает package.json. */
const productVersion = (root) => {
  const path = resolve(root, 'package.json');
  if (!existsSync(path)) return '';
  try {
    const version = JSON.parse(readFileSync(path, 'utf8')).version;
    return typeof version === 'string' ? version : '';
  } catch {
    return '';
  }
};

/**
 * Тот же корпус, но без номера версии продукта (#245).
 *
 * Зачем понадобился второй отпечаток. Релизный коммит бампает версию в трёх
 * местах разом: `package.json`, `package-lock.json` и `CARD_VERSION` в
 * `src/houseplan-card.ts`. Для бандла и для переиспользования гейтов это
 * настоящее изменение — бандл действительно другой, и его нельзя считать
 * свежим; отпечаток обязан ехать. А для скриншотов документации номер версии
 * не значит ничего: он на них не нарисован. Общий отпечаток на два разных
 * вопроса давал дефект, из-за которого КАЖДЫЙ релизный коммит оставлял job
 * `docs` красным: пересъёмка шла до бампа, и записанное значение не совпадало
 * с закоммиченным деревом.
 *
 * Нормализуется ровно строка версии продукта — не любое похожее число:
 * версия зависимости в `package-lock.json` остаётся частью отпечатка, иначе
 * обновление зависимости перестало бы требовать пересъёмки.
 */
export const visualFingerprint = (root = process.cwd()) => {
  const version = productVersion(root);
  const withoutVersion = version
    ? (text) => text.split(version).join('0.0.0-product-version')
    : (text) => text;
  return digest(root, fingerprintFiles(root), (text, name) => (
    name === 'package.json'
      ? visualPackageProjection(withoutVersion(text))
      : withoutVersion(text)
  ));
};
