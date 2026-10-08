import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENVIRONMENT_FAILURE, BrowserEnvironmentError, attestLaunchedBrowser, attestationLines, browserMode,
  enforcePinnedBrowser, expectedBrowser, judgeBrowser, pinnedBrowserRequirement, probeLaunchedBrowser,
  readLinuxProcess,
} from '../scripts/browser-attestation.mjs';
import { pinsFromSources } from '../scripts/toolchain-pins.mjs';

// #827 (F33): визуальное доказательство требует фактически запущенный
// пиновый Chromium. Версии в тестах — фикстуры или чтение пинов, не живые
// «151/141»: тест обязан пережить следующий ролл браузера.

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const REV = '9001';
const PINNED = '300.0.1.2';
const FOREIGN = '299.0.9.9';
const PINS = {
  playwright: '9.9.9',
  chromium: { revision: REV, version: PINNED },
  chromiumHeadlessShell: { revision: REV, version: PINNED },
};
const SHELL = `/pw/chromium_headless_shell-${REV}/chrome-headless-shell-linux64/chrome-headless-shell`;
const probeOf = (over = {}) => ({
  version: PINNED, product: `HeadlessChrome/${PINNED}`, pid: 42,
  selectedExecutable: SHELL, resolvedExecutable: SHELL, mode: 'headless-shell', error: null, ...over,
});

/** Браузер без Chromium: версия, CDP-сессия и счётчик закрытия. */
function fakeBrowser({ version = PINNED, product = `HeadlessChrome/${version}`, pid = 42, cdpFails = false, versionThrows = false } = {}) {
  const calls = [];
  return {
    calls,
    version() {
      if (versionThrows) throw new Error('Target closed');
      return version;
    },
    async newBrowserCDPSession() {
      if (cdpFails) throw new Error('CDP недоступен');
      return {
        async send(method) {
          calls.push(method);
          if (method === 'Browser.getVersion') return { product };
          if (method === 'SystemInfo.getProcessInfo') return { processInfo: [{ type: 'GPU', id: 7 }, { type: 'browser', id: pid }] };
          throw new Error(`unexpected ${method}`);
        },
        async detach() { calls.push('detach'); },
      };
    },
  };
}

test('#827 AC1: ожидание — пин headless shell из browsers.json, не отдельный список версий', () => {
  const browsers = { browsers: [
    { name: 'chromium', revision: '77', browserVersion: '400.1.2.3' },
    { name: 'chromium-headless-shell', revision: '78', browserVersion: '400.1.2.4' },
  ] };
  const pins = pinsFromSources({
    validateYml: 'node-version: 22\npython-version: "3.14"\n',
    requirements: 'homeassistant==2026.8.3\npytest-homeassistant-custom-component==0.13.357\n',
    packageLock: { packages: { 'node_modules/playwright': { version: '1.2.3' } } },
    browsers,
  });
  assert.deepEqual(pins.chromium, { revision: '77', version: '400.1.2.3' });
  assert.deepEqual(pins.chromiumHeadlessShell, { revision: '78', version: '400.1.2.4' });
  assert.deepEqual(expectedBrowser(pins), { name: 'chromium-headless-shell', revision: '78', version: '400.1.2.4' },
    'стандартный headless-запуск поднимает headless shell — его пин и судится');
  assert.deepEqual(expectedBrowser({ chromium: { revision: '5', version: '1.0' } }),
    { name: 'chromium', revision: '5', version: '1.0' }, 'без записи headless shell — пин chromium');
  // Живые пины читаются тем же кодом, что у toolchain:check.
  const live = pinsFromSources();
  assert.match(expectedBrowser(live).version, /^\d+\.\d+\.\d+\.\d+$/);
  assert.equal(expectedBrowser(live).name, 'chromium-headless-shell');
});

test('#827 AC1: совпавший запущенный Chromium проходит; отчёт различает ожидание, факт и путь', () => {
  const verdict = judgeBrowser({ pins: PINS, probe: probeOf(), playwright: '9.9.9', platform: 'linux' });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.status, 'ok');
  assert.deepEqual(verdict.problems, []);
  const [line] = attestationLines(verdict, 'unit');
  assert.match(line, /^browser-attestation ok \(ok\) \[unit\]/);
  assert.match(line, new RegExp(`ожидается chromium-headless-shell ${PINNED.replaceAll('.', '\\.')} rev ${REV}`));
  assert.match(line, new RegExp(`запущен ${PINNED.replaceAll('.', '\\.')} \\(HeadlessChrome/`));
  assert.match(line, /режим headless-shell/);
  assert.ok(line.includes(`путь ${SHELL} → ${SHELL}`), line);
  assert.match(line, /Playwright пин 9\.9\.9, установлен 9\.9\.9/);
});

test('#827 AC1 F33 regressesOldCheck: каталог с пиновым именем, чужая фактическая версия — exists-проверка пропускала, проверка версии отказывает', () => {
  // Старый критерий toolchain:check — «путь существует» — этой фикстуре
  // выполнен: каталог назван пиновой ревизией, файл по нему есть.
  const symlinked = probeOf({
    version: FOREIGN, product: `HeadlessChrome/${FOREIGN}`,
    selectedExecutable: SHELL, resolvedExecutable: '/opt/other/chromium_headless_shell-1/headless_shell',
  });
  assert.ok(symlinked.selectedExecutable.includes(`chromium_headless_shell-${REV}/`), 'имя каталога — пиновое');
  const verdict = judgeBrowser({ pins: PINS, probe: symlinked, playwright: '9.9.9', platform: 'linux' });
  assert.equal(verdict.ok, false, 'новая проверка обязана краснеть');
  assert.equal(verdict.status, 'mismatch');
  assert.match(verdict.problems[0], new RegExp(`запущен Chromium ${FOREIGN.replaceAll('.', '\\.')}, пин chromium-headless-shell ${PINNED.replaceAll('.', '\\.')}`));
  assert.match(verdict.problems[1], /каталог назван пиновой ревизией 9001, а исполняется \/opt\/other\/.*имя каталога и symlink версию не доказывают \(F33\)/);
});

test('#827 AC1: отсутствующий и неопрашиваемый браузер — непригодная среда, а не «в порядке»', () => {
  const missing = judgeBrowser({ pins: PINS, probe: { launchError: "browserType.launch: Executable doesn't exist at /x" }, playwright: '9.9.9' });
  assert.equal(missing.status, 'missing');
  assert.match(missing.problems[0], /стандартный запуск Playwright не поднял браузер: browserType\.launch: Executable doesn't exist/);
  for (const probe of [{ error: 'проба не выполнилась' }, probeOf({ version: null, error: 'Target closed' })]) {
    const verdict = judgeBrowser({ pins: PINS, probe, playwright: '9.9.9', platform: 'linux' });
    assert.equal(verdict.status, 'unprobeable', JSON.stringify(probe));
    assert.equal(verdict.ok, false);
  }
  // Linux — канон съёмки: путь процесса обязан читаться через /proc.
  const pathless = probeOf({ selectedExecutable: null, resolvedExecutable: null });
  assert.equal(judgeBrowser({ pins: PINS, probe: pathless, playwright: '9.9.9', platform: 'linux' }).status, 'unprobeable');
  // Вне Linux /proc нет: путь «недоступен», вердикт — по версии процесса.
  const windows = judgeBrowser({ pins: PINS, probe: pathless, playwright: '9.9.9', platform: 'win32' });
  assert.equal(windows.ok, true);
  assert.match(attestationLines(windows)[0], /путь недоступен/);
  assert.equal(judgeBrowser({ pins: {}, probe: probeOf(), playwright: '9.9.9' }).status, 'unprobeable', 'без пина судить нечем');
});

test('#827 AC1: Playwright не по пину — расхождение; toolchain:check судит его своей строкой', () => {
  const verdict = judgeBrowser({ pins: PINS, probe: probeOf(), playwright: '9.9.8', platform: 'linux' });
  assert.equal(verdict.status, 'mismatch');
  assert.match(verdict.problems.join('\n'), /Playwright 9\.9\.8 при пине 9\.9\.9/);
  assert.equal(judgeBrowser({ pins: PINS, probe: probeOf(), playwright: '9.9.8', platform: 'linux', checkPlaywright: false }).ok, true);
  // Отсутствие браузера важнее расхождения Playwright.
  assert.equal(judgeBrowser({ pins: PINS, probe: { launchError: 'x' }, playwright: '9.9.8' }).status, 'missing');
});

test('#827 AC1: проба читает версию у запущенного процесса и путь у ядра, без нового процесса', async () => {
  const browser = fakeBrowser({ version: FOREIGN, pid: 4242 });
  const seen = [];
  const probe = await probeLaunchedBrowser(browser, {
    platform: 'linux',
    readProcess: (pid) => { seen.push(pid); return { selectedExecutable: SHELL, resolvedExecutable: '/real/headless_shell' }; },
  });
  assert.deepEqual(seen, [4242], 'путь — процесса браузера из SystemInfo.getProcessInfo');
  assert.deepEqual(probe, {
    version: FOREIGN, product: `HeadlessChrome/${FOREIGN}`, pid: 4242,
    selectedExecutable: SHELL, resolvedExecutable: '/real/headless_shell', mode: 'headless-shell', error: null,
  });
  assert.deepEqual(browser.calls, ['Browser.getVersion', 'SystemInfo.getProcessInfo', 'detach']);
  // CDP недоступен: версия процесса есть, путь и продукт — нет, ошибка названа.
  const noCdp = await probeLaunchedBrowser(fakeBrowser({ cdpFails: true }), { platform: 'linux', readProcess: () => assert.fail('pid неизвестен') });
  assert.equal(noCdp.version, PINNED);
  assert.equal(noCdp.pid, null);
  assert.match(noCdp.error, /CDP недоступен/);
  const dead = await probeLaunchedBrowser(fakeBrowser({ versionThrows: true }), { platform: 'win32' });
  assert.equal(dead.version, null);
  assert.match(dead.error, /Target closed/);
  // /proc: argv[0] — выбранный Playwright путь, exe — фактический бинарник.
  const files = { '/proc/7/cmdline': `${SHELL}\0--headless\0` };
  assert.deepEqual(readLinuxProcess(7, { readFile: (path) => files[path], readLink: () => '/real/bin' }),
    { selectedExecutable: SHELL, resolvedExecutable: '/real/bin' });
  assert.deepEqual(readLinuxProcess(7, { readFile: () => { throw new Error('ENOENT'); }, readLink: () => { throw new Error('ENOENT'); } }),
    { selectedExecutable: null, resolvedExecutable: null });
  assert.equal(browserMode({ product: 'HeadlessChrome/1', selectedExecutable: '/x/chrome' }), 'headless');
  assert.equal(browserMode({ product: 'Chrome/1' }), 'headed');
});

test('#827 AC2: отказ среды — свой класс и текст; совпадение печатает отчёт и проходит', async () => {
  const out = []; const err = [];
  const log = (text) => out.push(text); const logError = (text) => err.push(text);
  const readProcess = () => ({ selectedExecutable: SHELL, resolvedExecutable: SHELL });
  const probe = (browser, options) => probeLaunchedBrowser(browser, { ...options, readProcess });
  const verdict = await attestLaunchedBrowser(fakeBrowser(), { pins: PINS, playwright: '9.9.9', reason: 'unit', platform: 'linux', probe, log, logError });
  assert.equal(verdict.ok, true);
  assert.match(out.join('\n'), /^browser-attestation ok \(ok\) \[unit\]/);
  await assert.rejects(
    attestLaunchedBrowser(fakeBrowser({ version: FOREIGN }), { pins: PINS, playwright: '9.9.9', reason: 'unit', platform: 'linux', probe, log, logError }),
    (error) => error instanceof BrowserEnvironmentError
      && error.message.startsWith(`${ENVIRONMENT_FAILURE} [unit]: запущен Chromium ${FOREIGN}`)
      && /отказ среды, не продукта/.test(error.message)
      && error.verdict.status === 'mismatch'
      && !Object.keys(error).includes('verdict'),
  );
  assert.match(err.join('\n'), /^browser-attestation FAIL \(mismatch\) \[unit\]/);
});

test('#827 AC2: без объявленного требования общий launch ничего не судит', async () => {
  // Модуль загружен в этом процессе, но требование здесь не объявлялось.
  assert.equal(pinnedBrowserRequirement(), null);
  assert.equal(await enforcePinnedBrowser(fakeBrowser({ version: FOREIGN })), null);
});

const SERVE_URL = new URL('../demo/serve.mjs', import.meta.url).href;

/** Общий `launch()` в отдельном процессе с подменённым `chromium.launch`: без Chromium. */
function serveLaunch({ require: reason, version }) {
  const script = `
    import { chromium } from 'playwright';
    import { pinsFromSources } from ${JSON.stringify(new URL('../scripts/toolchain-pins.mjs', import.meta.url).href)};
    import { launch, requirePinnedBrowser } from ${JSON.stringify(SERVE_URL)};
    const version = ${JSON.stringify(version)} === 'pinned' ? pinsFromSources().chromiumHeadlessShell.version : ${JSON.stringify(version)};
    const state = { contexts: 0, closed: 0 };
    chromium.launch = async () => ({
      version: () => version,
      newBrowserCDPSession: async () => ({
        send: async (method) => (method === 'Browser.getVersion'
          ? { product: 'HeadlessChrome/' + version }
          : { processInfo: [{ type: 'browser', id: process.pid }] }),
        detach: async () => {},
      }),
      newContext: async () => { state.contexts += 1; throw new Error('CONTEXT_REACHED'); },
      close: async () => { state.closed += 1; },
    });
    ${reason ? `requirePinnedBrowser(${JSON.stringify(reason)});` : ''}
    try { await launch(); } catch (error) { console.log('REJECTED ' + error.message.split('\\n')[0]); }
    console.log('STATE ' + JSON.stringify(state));
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: ROOT, encoding: 'utf8', timeout: 30_000 });
  const output = `${child.stdout || ''}${child.stderr || ''}`;
  assert.equal(child.status, 0, output);
  return { output, state: JSON.parse(/^STATE (.+)$/m.exec(child.stdout)?.[1] || 'null') };
}

test('#827 AC2: общий launch судит уже запущенный браузер до первой страницы и закрывает его при отказе', () => {
  const foreign = serveLaunch({ require: 'smoke_unit', version: '0.0.0.1' });
  assert.match(foreign.output, /REJECTED environment failure \(browser-attestation\) \[smoke_unit\]: запущен Chromium 0\.0\.0\.1/);
  assert.deepEqual(foreign.state, { contexts: 0, closed: 1 }, 'ни одной страницы, браузер закрыт');
  const pinned = serveLaunch({ require: 'smoke_unit', version: 'pinned' });
  assert.match(pinned.output, /browser-attestation ok \(ok\) \[smoke_unit\]/);
  assert.match(pinned.output, /REJECTED CONTEXT_REACHED/, 'совпавший браузер идёт дальше, к странице');
  assert.deepEqual(pinned.state, { contexts: 1, closed: 0 });
  // Без объявления — прежнее поведение: смоки вне задачи не судятся.
  const plain = serveLaunch({ require: null, version: '0.0.0.1' });
  assert.doesNotMatch(plain.output, /browser-attestation/);
  assert.deepEqual(plain.state, { contexts: 1, closed: 0 });
});

test('#827 AC2: helper — в трёх названных смоках, обхода через окружение нет', () => {
  const declaring = readdirSync(new URL('../demo/', import.meta.url))
    .filter((name) => /^smoke_.*\.mjs$/.test(name))
    .filter((name) => /requirePinnedBrowser\('smoke_/.test(readFileSync(new URL(`../demo/${name}`, import.meta.url), 'utf8')))
    .sort();
  assert.deepEqual(declaring, ['smoke_editor_styles_lazy.mjs', 'smoke_support_feedback.mjs', 'smoke_zigbee_tooltip_layout.mjs']);
  for (const name of declaring) {
    const source = readFileSync(new URL(`../demo/${name}`, import.meta.url), 'utf8');
    assert.ok(source.indexOf("requirePinnedBrowser('") < source.search(/await launch(?:ColdView)?\(/),
      `${name}: требование объявляется до первого запуска`);
  }
  const attestation = readFileSync(new URL('../scripts/browser-attestation.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(attestation, /process\.env/, 'переменной обхода у проверки нет');
});

/** CLI с пустым каталогом браузеров: стандартный запуск Playwright падает сразу, Chromium не нужен. */
function cliWithoutBrowsers(t, args) {
  const empty = mkdtempSync(join(tmpdir(), 'hp-827-no-browsers-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  const child = spawnSync(process.execPath, args, {
    cwd: ROOT, encoding: 'utf8', timeout: 60_000, env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: empty },
  });
  return { status: child.status, output: `${child.stdout || ''}${child.stderr || ''}` };
}

test('#827 AC1/AC2 CLI: отсутствующий браузер — ненулевой код и отказ среды в каждой точке входа', (t) => {
  const attest = cliWithoutBrowsers(t, ['scripts/browser-attestation.mjs']);
  assert.equal(attest.status, 1, attest.output);
  assert.match(attest.output, /^browser-attestation FAIL \(missing\) \[browser-attestation\]/m);
  assert.match(attest.output, /environment failure \(browser-attestation\) \[browser-attestation\]: стандартный запуск Playwright не поднял браузер: browserType\.launch: Executable doesn't exist at .*chrome-headless-shell/);
  const check = cliWithoutBrowsers(t, ['scripts/toolchain-pins.mjs', '--check']);
  assert.equal(check.status, 1, check.output);
  assert.match(check.output, /^FAIL +chromium .*локально missing +\(chromium-headless-shell;/m);
  assert.match(check.output, /toolchain расходится с CI: .*chromium/);
  if (process.platform !== 'linux') { t.skip('съёмка документации разрешена только в Linux/WSL (#455)'); return; }
  const docs = cliWithoutBrowsers(t, ['scripts/assert-capture-env.mjs', 'docs']);
  assert.equal(docs.status, 1, docs.output);
  assert.match(docs.output, /environment failure \(browser-attestation\) \[docs capture\]/);
  const accept = cliWithoutBrowsers(t, ['scripts/assert-capture-env.mjs', 'docs', '--stage=accept']);
  assert.equal(accept.status, 0, `приёмка браузер не запускает: ${accept.output}`);
  assert.doesNotMatch(accept.output, /browser-attestation/);
  // Съёмка документации в CI идёт через capture-determinism мимо docs:capture:
  // отказ среды — до первого прогона съёмки, ни одного кадра (CODE-REVIEW-827-r1).
  const determinism = cliWithoutBrowsers(t, ['scripts/capture-determinism.mjs']);
  assert.equal(determinism.status, 1, determinism.output);
  assert.match(determinism.output, /environment failure \(browser-attestation\) \[docs capture\]/);
  assert.doesNotMatch(determinism.output, /съёмка \(|съёмка воспроизводима|недетерминирована/);
});
