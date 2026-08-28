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
  'scripts/css-template-minifier.mjs',
  'scripts/bundle-manifest.mjs',
];

/**
 * Файлы, которые исполняются ПОСЛЕ того, как картинка снята (#344).
 *
 * Критерий один и проверяется чтением: может ли правка этого файла изменить
 * хотя бы один пиксель в кадре. `accept.mjs` копирует уже снятые PNG в каталог
 * эталонов и пишет манифест; `policy.mjs` — чистые предикаты, вызываемые до и
 * после съёмки. Ни тот, ни другой в момент рендера не исполняется вовсе.
 *
 * Почему это не косметика. Пока они входили в корпус, правка инструмента
 * приёмки объявляла устаревшими сразу три вещи: закоммиченный бандл, манифест
 * скриншотов документации и манифест эталонов. То есть каждая правка `accept.mjs`
 * стоила пересборки и пересъёмки. В #334 из-за этого правило приёмки пришлось
 * вынести в `scripts/` и вызывать обёрткой вместо того, чтобы положить его туда,
 * где ему место.
 *
 * Список именно список, а не фильтр по имени: «всё, что похоже на инструмент» —
 * правило, которое расползётся. Каждый пункт добавляется вручную и обязан
 * выдерживать вопрос «а как эта правка попадёт в кадр».
 *
 * НЕ входят в этот список и входят в корпус: `matrix.mjs` (сцены, вьюпорт,
 * тема, кадрирование), `harness.mjs` (состояние карточки перед съёмкой),
 * `run.mjs` (аргументы браузера, опции скриншота, DPR) и все фикстуры
 * (геометрия снимаемого плана).
 *
 * Возражение, которое здесь стоит снять заранее: `run.mjs` импортирует
 * `policy.mjs`, а `run.mjs` в корпусе — значит ли это, что исключение протекает?
 * Нет. Из `policy.mjs` он берёт `assertGoldenInvocation` (проверка аргументов,
 * умеет только бросить), `goldenScenarioSetsMatch` и `goldenRunFailed`
 * (действительность манифеста и код возврата) и имя файла манифеста. Ни одно из
 * них не участвует в рендере: байты кадра определяются аргументами браузера и
 * подготовкой сцены. Если в `policy.mjs` когда-нибудь появится что-то,
 * влияющее на кадр, файл обязан вернуться в корпус.
 */
const POST_CAPTURE_INPUTS = new Set([
  'demo/golden/accept.mjs',
  'demo/golden/policy.mjs',
]);

const repoRelative = (root, file) => relative(root, file).replaceAll('\\', '/');

const fingerprintFiles = (root) => {
  const deterministicFixtureInputs = ['demo/fixtures', 'demo/golden']
    .map((name) => resolve(root, name))
    .filter(existsSync)
    .flatMap(sourceFiles)
    .filter((file) => file.endsWith('.mjs'))
    .filter((file) => !POST_CAPTURE_INPUTS.has(repoRelative(root, file)));
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

/** Пути, исключённые из корпуса как исполняемые после съёмки (#344). */
export const postCaptureInputs = () => [...POST_CAPTURE_INPUTS].sort();

/** Файлы корпуса отпечатка относительно корня — для тестов и диагностики. */
export const fingerprintCorpus = (root = process.cwd()) =>
  fingerprintFiles(root).map((file) => repoRelative(root, file));

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
