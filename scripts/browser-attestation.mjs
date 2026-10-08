#!/usr/bin/env node
/**
 * Фактически запущенный Chromium как условие визуального доказательства (#827, F33).
 *
 * До этой задачи `toolchain:check` подтверждал Chromium так: путь
 * `chromium.executablePath()` существует. Это не версия и даже не тот бинарник:
 * стандартный `chromium.launch()` в headless-режиме поднимает отдельный
 * headless shell (`chromium-headless-shell` в `playwright-core/browsers.json`),
 * а каталог с именем пиновой ревизии может оказаться symlink'ом на чужую сборку.
 * Так песочница называла каталог «1234/151», а запускала 141 — и давала иной
 * первый кадр, который читался как дефект продукта.
 *
 * Здесь судится браузер, который уже запущен: версия — у самого процесса
 * (`browser.version()`, CDP `Browser.getVersion`), путь — у ядра
 * (`/proc/<pid>/cmdline` — что выбрал Playwright, `/proc/<pid>/exe` — что
 * исполняется на самом деле, symlink разрешён). Ожидание — пины toolchain:
 * их браузерная часть (`browserPinsFromSources`: package-lock и установленный
 * browsers.json) читается здесь и входит в `pinsFromSources` toolchain-pins.mjs
 * как есть — второго словаря версий нет. Отдельно она нужна затем, чтобы суд
 * браузера в смоках и golden не делал входом браузерных job пины Python/HA
 * (`tests_backend/requirements.txt`, граф входов #492).
 *
 * Где проверка стоит:
 *  - `npm run toolchain:check` и предпроверка съёмки документации
 *    (`scripts/assert-capture-env.mjs`) поднимают стандартный headless Chromium
 *    один раз и судят его (`probeStandardLaunch`);
 *  - golden (`demo/golden/policy.mjs`) и целевые смоки объявляют
 *    `requirePinnedBrowser()`, после чего общий `demo/serve.mjs` судит каждый
 *    уже запущенный браузер — без нового процесса на запуск (`enforcePinnedBrowser`).
 *
 * Расхождение, отсутствие браузера или невозможность его опросить — отказ
 * СРЕДЫ (`environment failure`), а не продукта: визуальное доказательство в
 * такой среде непригодно. Обхода нет; чужая платформа, разрешённая
 * `HP_ALLOW_FOREIGN_CAPTURE`, версию браузера не обходит. Глобальную установку
 * и symlink пользователя проверка не чинит — только называет.
 *
 *   node scripts/browser-attestation.mjs               # стандартный запуск против пинов, код 1 — среда непригодна
 *   node scripts/browser-attestation.mjs --probe-json  # только проба (для toolchain-pins), код 0
 */
import { readFileSync, readlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './spawn-portable.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel) => readFileSync(resolve(ROOT, rel), 'utf8');

/**
 * Пины Playwright и браузеров — из тех же файлов, что у всех пинов toolchain
 * (#496): Playwright из package-lock.json, Chromium из browsers.json
 * установленного Playwright. `chromium-headless-shell` — то, что поднимает
 * стандартный headless-запуск.
 */
export function browserPinsFromSources({
  packageLock = JSON.parse(read('package-lock.json')),
  browsers = JSON.parse(read('node_modules/playwright-core/browsers.json')),
} = {}) {
  const pin = (name) => {
    const entry = browsers.browsers.find((b) => b.name === name);
    return entry ? { revision: entry.revision, version: entry.browserVersion } : null;
  };
  return {
    playwright: packageLock.packages['node_modules/playwright'].version,
    chromium: pin('chromium'),
    chromiumHeadlessShell: pin('chromium-headless-shell'),
  };
}

/** Начало сообщения отказа: по нему его отличают от падения продукта. */
export const ENVIRONMENT_FAILURE = 'environment failure (browser-attestation)';
/** Пин браузера стандартного headless-запуска в `browsers.json`. */
export const HEADLESS_SHELL = 'chromium-headless-shell';

/** Отказ среды — отдельный класс, чтобы вызывающий не путал его с провалом проверки. */
export class BrowserEnvironmentError extends Error {
  constructor(message, verdict) {
    super(message);
    this.name = 'BrowserEnvironmentError';
    // Неперечисляемо: необработанный отказ печатает сообщение, а не дамп
    // вердикта на двадцать строк — `tail -20` шарда смоков иначе его срежет.
    Object.defineProperty(this, 'verdict', { value: verdict, enumerable: false });
  }
}

const firstLine = (error) => String(error?.message ?? error ?? '').split('\n').map((line) => line.trim())
  .find(Boolean) || 'неизвестная ошибка';

/**
 * Что обязан запустить стандартный headless-запуск: пин headless shell из тех
 * же пинов toolchain; у старого Playwright без отдельной записи — пин chromium.
 */
export function expectedBrowser(pins) {
  const pin = pins?.chromiumHeadlessShell || pins?.chromium || null;
  if (!pin) return null;
  return {
    name: pins?.chromiumHeadlessShell ? HEADLESS_SHELL : 'chromium',
    revision: String(pin.revision ?? ''),
    version: String(pin.version ?? ''),
  };
}

/** Режим запуска по продукту CDP и имени исполняемого. */
export function browserMode({ product = null, selectedExecutable = null, resolvedExecutable = null } = {}) {
  if (!product) return null;
  if (!/^HeadlessChrome\//.test(product)) return 'headed';
  return /headless[-_]shell/.test(`${selectedExecutable || ''} ${resolvedExecutable || ''}`) ? 'headless-shell' : 'headless';
}

/** Путь процесса по `/proc` (Linux): выбранный Playwright и фактически исполняемый. */
export function readLinuxProcess(pid, { readFile = readFileSync, readLink = readlinkSync } = {}) {
  const out = { selectedExecutable: null, resolvedExecutable: null };
  try { out.selectedExecutable = String(readFile(`/proc/${pid}/cmdline`, 'utf8')).split('\0')[0] || null; } catch { /* нет /proc */ }
  try { out.resolvedExecutable = String(readLink(`/proc/${pid}/exe`)) || null; } catch { /* нет /proc */ }
  return out;
}

/**
 * Проба УЖЕ запущенного браузера: версия, продукт, pid, выбранный и
 * фактический исполняемый, режим. Нового процесса не создаёт.
 */
export async function probeLaunchedBrowser(browser, {
  platform = process.platform, readProcess = readLinuxProcess,
} = {}) {
  const probe = {
    version: null, product: null, pid: null, selectedExecutable: null, resolvedExecutable: null, mode: null, error: null,
  };
  try { probe.version = String(browser.version() || '') || null; } catch (error) { probe.error = firstLine(error); }
  let session = null;
  try {
    session = await browser.newBrowserCDPSession();
    probe.product = (await session.send('Browser.getVersion'))?.product || null;
    const info = await session.send('SystemInfo.getProcessInfo');
    probe.pid = info?.processInfo?.find((item) => item?.type === 'browser')?.id ?? null;
  } catch (error) {
    probe.error ||= firstLine(error);
  } finally {
    try { await session?.detach(); } catch { /* сессия уже закрыта */ }
  }
  if (probe.pid && platform === 'linux') Object.assign(probe, readProcess(probe.pid));
  probe.mode = browserMode(probe);
  return probe;
}

/** Каталог выбранного исполняемого назван пиновой ревизией: `chromium_headless_shell-1234/…`. */
const namedAsPin = (path, revision) => Boolean(path && revision
  && String(path).replaceAll('\\', '/').split('/').some((part) => part.endsWith(`-${revision}`)));

/**
 * Вердикт: `{ ok, status, expected, actual, playwright, problems }`.
 * `status`: `ok` | `missing` (стандартный запуск не поднял браузер) |
 * `unprobeable` (версия или, на Linux, путь не прочитаны) | `mismatch`.
 * `checkPlaywright: false` — версию Playwright судит вызывающий своей строкой.
 */
export function judgeBrowser({
  pins, probe, playwright = null, platform = process.platform, checkPlaywright = true,
} = {}) {
  const expected = expectedBrowser(pins);
  const problems = [];
  let status = 'ok';
  const fail = (next, text) => {
    if (status === 'ok' || (status === 'mismatch' && next !== 'mismatch')) status = next;
    problems.push(text);
  };
  if (!expected?.version) {
    fail('unprobeable', 'пин браузера не прочитан из playwright-core/browsers.json');
  } else if (probe?.launchError) {
    fail('missing', `стандартный запуск Playwright не поднял браузер: ${probe.launchError}`);
  } else if (!probe?.version) {
    fail('unprobeable', `версия запущенного браузера не прочитана${probe?.error ? `: ${probe.error}` : ''}`);
  } else if (platform === 'linux' && !probe.resolvedExecutable) {
    fail('unprobeable', `путь запущенного исполняемого не прочитан (/proc/${probe.pid ?? '<pid>'}/exe)${probe.error ? `: ${probe.error}` : ''}`);
  } else if (probe.version !== expected.version) {
    fail('mismatch', `запущен Chromium ${probe.version}, пин ${expected.name} ${expected.version} (rev ${expected.revision})`);
    if (namedAsPin(probe.selectedExecutable, expected.revision)) {
      fail('mismatch', `каталог назван пиновой ревизией ${expected.revision}, а исполняется ${probe.resolvedExecutable || probe.selectedExecutable}:`
        + ' имя каталога и symlink версию не доказывают (F33)');
    }
  }
  if (checkPlaywright && pins?.playwright && playwright !== pins.playwright) {
    fail('mismatch', `Playwright ${playwright ?? '—'} при пине ${pins.playwright} (package-lock.json)`);
  }
  return {
    ok: status === 'ok',
    status,
    expected,
    playwright: { pinned: pins?.playwright ?? null, installed: playwright },
    actual: {
      version: probe?.version ?? null,
      product: probe?.product ?? null,
      mode: probe?.mode ?? null,
      selectedExecutable: probe?.selectedExecutable ?? null,
      resolvedExecutable: probe?.resolvedExecutable ?? null,
    },
    problems,
  };
}

/** Строки отчёта: одна сводная и по строке на проблему. Без env, без секретов. */
export function attestationLines(verdict, reason = '') {
  const { expected, actual, playwright } = verdict;
  const path = actual.selectedExecutable || actual.resolvedExecutable
    ? `${actual.selectedExecutable || '—'} → ${actual.resolvedExecutable || '—'}`
    : 'недоступен';
  return [
    `browser-attestation ${verdict.ok ? 'ok' : 'FAIL'} (${verdict.status})${reason ? ` [${reason}]` : ''}`
      + ` · Playwright пин ${playwright.pinned ?? '—'}, установлен ${playwright.installed ?? '—'}`
      + ` · ожидается ${expected ? `${expected.name} ${expected.version} rev ${expected.revision}` : '—'}`
      + ` · запущен ${actual.version ?? '—'} (${actual.product ?? 'продукт неизвестен'}, режим ${actual.mode ?? '—'})`
      + ` · путь ${path}`,
    ...verdict.problems.map((problem) => `  - ${problem}`),
  ];
}

/** Текст отказа среды: причина, последствие и что делать — без обхода. */
export const environmentFailureMessage = (verdict, reason = '') => `${ENVIRONMENT_FAILURE}${reason ? ` [${reason}]` : ''}: `
  + `${verdict.problems.join('; ')}. Визуальное доказательство в этой среде непригодно — это отказ среды, не продукта.`
  + ' Пиновый браузер: `npx playwright install chromium` (docs/DEVELOPMENT.md); диагностика — `npm run toolchain:check`.';

/** Версия установленного Playwright (`node_modules/playwright/package.json`). */
export function installedPlaywright(root = ROOT, read = readFileSync) {
  try { return JSON.parse(read(resolve(root, 'node_modules/playwright/package.json'), 'utf8')).version || null; } catch { return null; }
}

let cachedContext = null;
/** Пины браузера и установленный Playwright — читаются один раз на процесс. */
function attestationContext() {
  cachedContext ||= { pins: browserPinsFromSources(), playwright: installedPlaywright() };
  return cachedContext;
}

/**
 * Судить уже запущенный браузер; печатает отчёт и бросает
 * `BrowserEnvironmentError`, если среда непригодна. `pins`/`playwright` —
 * фикстура для тестов и проб гарда; без них — пины toolchain.
 */
export async function attestLaunchedBrowser(browser, {
  reason = '', pins = null, playwright = null, platform = process.platform, probe = probeLaunchedBrowser,
  log = console.log, logError = console.error,
} = {}) {
  const context = pins ? { pins, playwright } : attestationContext();
  const verdict = judgeBrowser({ ...context, probe: await probe(browser, { platform }), platform });
  const lines = attestationLines(verdict, reason);
  (verdict.ok ? log : logError)(lines.join('\n'));
  if (!verdict.ok) throw new BrowserEnvironmentError(environmentFailureMessage(verdict, reason), verdict);
  return verdict;
}

let requirement = null;
/**
 * Объявить: браузеры этого процесса — визуальное доказательство. Дальше общий
 * `demo/serve.mjs` судит каждый запущенный браузер (`enforcePinnedBrowser`).
 */
export function requirePinnedBrowser(reason = 'visual proof') {
  requirement = String(reason || 'visual proof');
  return requirement;
}
/** Объявленное требование или `null`. */
export const pinnedBrowserRequirement = () => requirement;

/** Для общего launch: без требования — ничего, с ним — суд уже запущенного браузера. */
export async function enforcePinnedBrowser(browser, options = {}) {
  const reason = pinnedBrowserRequirement();
  if (!reason) return null;
  return attestLaunchedBrowser(browser, { ...options, reason });
}

/**
 * Проба стандартного запуска Playwright (`chromium.launch()`, headless по
 * умолчанию): один браузер на вызов, закрывается сразу. Не поднялся — `launchError`.
 */
export async function probeStandardLaunch({ launcher = null, platform = process.platform } = {}) {
  const chromium = launcher || (await import('playwright')).chromium;
  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    return { launchError: firstLine(error) };
  }
  try {
    return await probeLaunchedBrowser(browser, { platform });
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Предпроверка точек съёмки и CLI: стандартный запуск против пинов; бросает при непригодной среде. */
export async function attestStandardLaunch({ reason = 'preflight', launcher = null } = {}) {
  const context = attestationContext();
  const probe = await probeStandardLaunch({ launcher });
  const verdict = judgeBrowser({ ...context, probe });
  const lines = attestationLines(verdict, reason);
  (verdict.ok ? console.log : console.error)(lines.join('\n'));
  if (!verdict.ok) throw new BrowserEnvironmentError(environmentFailureMessage(verdict, reason), verdict);
  return verdict;
}

async function main(argv) {
  if (argv.includes('--probe-json')) {
    process.stdout.write(`${JSON.stringify(await probeStandardLaunch())}\n`);
    return;
  }
  try {
    await attestStandardLaunch({ reason: 'browser-attestation' });
  } catch (error) {
    console.error(error instanceof BrowserEnvironmentError ? error.message : error);
    process.exitCode = 1;
  }
}

// Без top-level await: toolchain-pins.mjs импортирует этот модуль, и CLI не
// должен держать вычисление модуля открытым ради запуска браузера.
if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
