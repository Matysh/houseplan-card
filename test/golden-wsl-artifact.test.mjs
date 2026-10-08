import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAPTURE_PROVENANCE_SCHEMA } from '../scripts/capture-environment.mjs';
import {
  WSL_ATTESTATION_FILE, WSL_ATTESTATION_SCHEMA, createWslAttestation, environmentRefusal, localAttestationRecord,
  objectSha256, repositoryRefusal, toolchainRefusal, toolchainSnapshot, verifyWslAttestation, withoutBundlePaths,
} from '../scripts/golden-wsl-artifact.mjs';
import { BrowserEnvironmentError, expectedBrowser } from '../scripts/browser-attestation.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { pinsFromSources } from '../scripts/toolchain-pins.mjs';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const BASELINES = resolve(ROOT, 'demo/golden/baselines');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = Object.freeze({
  repository: 'Matysh/houseplan-card', branch: 'issue/641-wsl-golden-attestation',
  commit: 'a'.repeat(40), tree: 'b'.repeat(40), remoteSha: 'a'.repeat(40),
  clean: true, status: '',
});
const environment = Object.freeze({
  platform: 'linux', arch: 'x64', kernel: '6.6.0-microsoft-standard-WSL2',
  wsl: true, distro: 'Ubuntu', filesystem: 'ext2/ext3',
});

/** Пиновый headless shell, как его записывает паспорт v2 (#833). */
const shellOf = (pins) => `/home/test/.cache/ms-playwright/chromium_headless_shell-${expectedBrowser(pins).revision}`
  + '/chrome-headless-shell-linux64/chrome-headless-shell';
const toolchain = () => {
  const pins = pinsFromSources();
  const expected = expectedBrowser(pins);
  return {
    pins,
    node: `${pins.node}.0.0`,
    npm: '10.9.0',
    playwright: pins.playwright,
    browser: {
      expected, version: expected.version, product: `HeadlessChrome/${expected.version}`, mode: 'headless-shell',
      selectedExecutable: shellOf(pins), resolvedExecutable: shellOf(pins), executableSha256: 'c'.repeat(64),
    },
  };
};

/** Matrix scenarios whose first capture still awaits acceptance (declared as new). */
const PENDING_NEW = Object.freeze(GOLDEN_SCENARIOS.map((scenario) => scenario.id)
  .filter((id) => !existsSync(resolve(BASELINES, `${id}.png`))));
const ACCEPTED = GOLDEN_SCENARIOS.map((scenario) => scenario.id).filter((id) => !PENDING_NEW.includes(id));

function artifact() {
  const dir = mkdtempSync(resolve(tmpdir(), 'hp-golden-wsl-'));
  const actualRoot = resolve(dir, 'actual');
  mkdirSync(actualRoot, { recursive: true });
  const index = JSON.parse(readFileSync(resolve(BASELINES, 'baselines-index.json'), 'utf8'));
  const results = GOLDEN_SCENARIOS.map((scenario) => {
    const actual = resolve(actualRoot, `${scenario.id}.png`);
    // #661: a scenario added to the matrix has no reviewed baseline until its
    // first Linux capture is accepted — exactly what a real run reports then.
    if (PENDING_NEW.includes(scenario.id)) {
      copyFileSync(resolve(BASELINES, `${ACCEPTED[0]}.png`), actual);
      return { id: scenario.id, status: 'missing-baseline', actualSha256: digest(readFileSync(actual)) };
    }
    const baseline = resolve(BASELINES, `${scenario.id}.png`);
    copyFileSync(baseline, actual);
    const sha = digest(readFileSync(actual));
    return { id: scenario.id, status: 'passed', actualSha256: sha, baselineSha256: sha };
  });
  const report = {
    schema: CAPTURE_PROVENANCE_SCHEMA,
    mode: 'capture',
    capture: {
      platform: 'linux', arch: 'x64', chromium: index.chromium,
      buildFingerprint: sourceFingerprint(ROOT), ci: null,
    },
    generatedAt: '2026-09-23T00:00:00.000Z',
    matrixVersion: GOLDEN_MATRIX_VERSION,
    buildFingerprint: sourceFingerprint(ROOT),
    chromium: index.chromium,
    results,
  };
  writeFileSync(resolve(dir, 'golden-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return dir;
}

const intent = Object.freeze({ expectChange: [], expectNew: PENDING_NEW, noWitnesses: false, reason: '' });

test('#641: repository and WSL/ext4 preconditions fail closed', () => {
  assert.equal(repositoryRefusal(source), null);
  assert.match(repositoryRefusal({ ...source, repository: '' }), /repository/);
  assert.match(repositoryRefusal({ ...source, clean: false, status: ' M src/x.ts' }), /чистое/);
  assert.match(repositoryRefusal({ ...source, remoteSha: 'd'.repeat(40) }), /не совпадает/);
  assert.equal(environmentRefusal(environment), null);
  assert.match(environmentRefusal({ ...environment, platform: 'win32', wsl: false }), /только внутри WSL/);
  assert.match(environmentRefusal({ ...environment, filesystem: '9p' }), /ext4/);
  assert.match(environmentRefusal({ ...environment, distro: null }), /distro/);
});

test('#641: complete WSL artifact is self-hashed and can be verified before acceptance', async () => {
  const dir = artifact();
  try {
    const tc = toolchain();
    const attestation = await createWslAttestation({
      root: ROOT, artifactRoot: dir, intent, source, environment, toolchain: tc,
      createdAt: '2026-09-23T00:00:01.000Z',
    });
    assert.match(attestation.sha256, /^[0-9a-f]{64}$/);
    assert.equal(attestation.command, 'npm run golden:wsl:capture');
    assert.equal(attestation.frames.length, GOLDEN_SCENARIOS.length);
    assert.ok(attestation.witnesses.count >= attestation.witnesses.floor);
    writeFileSync(resolve(dir, WSL_ATTESTATION_FILE), `${JSON.stringify(attestation, null, 2)}\n`);
    const verified = await verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      currentSource: source, currentEnvironment: environment, currentToolchain: tc,
    });
    assert.equal(verified.sha256, attestation.sha256);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: tampered intent, source, toolchain and PNG are rejected', async () => {
  const dir = artifact();
  try {
    const tc = toolchain();
    const attestation = await createWslAttestation({
      root: ROOT, artifactRoot: dir, intent, source, environment, toolchain: tc,
    });
    writeFileSync(resolve(dir, WSL_ATTESTATION_FILE), `${JSON.stringify(attestation, null, 2)}\n`);
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir,
      intent: { ...intent, expectChange: [GOLDEN_SCENARIOS[0].id] },
      currentSource: source, currentEnvironment: environment, currentToolchain: tc,
    }), /intent differs/);
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      currentSource: { ...source, commit: 'd'.repeat(40), remoteSha: 'd'.repeat(40) },
      currentEnvironment: environment, currentToolchain: tc,
    }), /another repository, branch, commit or tree/);
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent, currentSource: source,
      currentEnvironment: environment, currentToolchain: { ...tc, npm: '11.0.0' },
    }), /toolchain changed/);
    const victim = resolve(dir, 'actual', `${GOLDEN_SCENARIOS[0].id}.png`);
    writeFileSync(victim, Buffer.concat([readFileSync(victim), Buffer.from([0])]));
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      currentSource: source, currentEnvironment: environment, currentToolchain: tc,
    }), /candidate changed after capture/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: incomplete matrix cannot be attested', async () => {
  const dir = artifact();
  try {
    rmSync(resolve(dir, 'actual', `${GOLDEN_SCENARIOS[0].id}.png`));
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      source, environment, toolchain: toolchain(),
    }), /complete current golden matrix/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: duplicate result rows are not a complete matrix', async () => {
  const dir = artifact();
  try {
    const reportPath = resolve(dir, 'golden-report.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.results.push({ ...report.results[0] });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      source, environment, toolchain: toolchain(),
    }), /complete current golden matrix/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: stale fingerprints, toolchain drift and undeclared diffs cannot be attested', async () => {
  const stale = artifact();
  const drifted = artifact();
  const unexpected = artifact();
  try {
    const staleReportPath = resolve(stale, 'golden-report.json');
    const staleReport = JSON.parse(readFileSync(staleReportPath, 'utf8'));
    staleReport.buildFingerprint = 'd'.repeat(64);
    writeFileSync(staleReportPath, `${JSON.stringify(staleReport, null, 2)}\n`);
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: stale, intent,
      source, environment, toolchain: toolchain(),
    }), /current frontend source/);

    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: drifted, intent,
      source, environment,
      toolchain: { ...toolchain(), playwright: '0.0.0' },
    }), /toolchain расходится/);

    const reportPath = resolve(unexpected, 'golden-report.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.results[0].status = 'different';
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: unexpected, intent,
      source, environment, toolchain: toolchain(),
    }), /менять не собирались/);
  } finally {
    rmSync(stale, { recursive: true, force: true });
    rmSync(drifted, { recursive: true, force: true });
    rmSync(unexpected, { recursive: true, force: true });
  }
});

test('#657 WSL golden: пересобранный бандл не считается правкой источника, остальное — считается', () => {
  // Первая строка приходит обрезанной (`command` делает trim) — без ведущего пробела.
  const status = [
    'M dist/houseplan-card.js',
    '?? dist/houseplan-assets/houseplan-view-runtime-abc123.js',
    ' M custom_components/houseplan/frontend/houseplan-card.js',
    ' M src/editor-panel.ts',
    '?? demo/golden/notes.txt',
  ].join('\n');
  assert.equal(withoutBundlePaths(status), [' M src/editor-panel.ts', '?? demo/golden/notes.txt'].join('\n'));
  assert.equal(withoutBundlePaths('M dist/houseplan-card.js'), '');
});

// ---------- #833: паспорт описывает фактически запущенный headless shell ----------

/** Браузер без Chromium: версия, CDP и pid процесса для `/proc`. */
const fakeBrowser = (version, pid) => ({
  version: () => version,
  newBrowserCDPSession: async () => ({
    send: async (method) => (method === 'Browser.getVersion'
      ? { product: `HeadlessChrome/${version}` }
      : { processInfo: [{ type: 'browser', id: pid }] }),
    detach: async () => {},
  }),
  close: async () => {},
});

test('#833 AC1: паспорт хеширует запущенный headless shell, а не chromium.executablePath()', {
  skip: process.platform !== 'linux' && 'путь процесса читается через /proc (WSL — Linux)',
}, async (t) => {
  const dir = mkdtempSync(resolve(tmpdir(), 'hp-833-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const full = resolve(dir, 'chrome');
  writeFileSync(full, 'full Chromium, которым кадры не снимаются');
  const pins = pinsFromSources();
  const expected = expectedBrowser(pins);
  // Стандартный запуск подменён: «браузер» — этот процесс Node, его бинарник и есть фактически исполняемый.
  const launches = [];
  const launcher = {
    executablePath: () => full,
    launch: async (options) => { launches.push(options); return fakeBrowser(expected.version, process.pid); },
  };
  const snapshot = await toolchainSnapshot(ROOT, { pins, launcher, npm: '10.9.0', platform: 'linux' });
  assert.equal(launches.length, 1, 'стандартный запуск — один');
  assert.equal(launches[0], undefined, 'без executablePath: тот запуск, что у serve.mjs и golden');
  const running = readlinkSync(`/proc/${process.pid}/exe`);
  assert.equal(snapshot.browser.resolvedExecutable, running);
  assert.equal(snapshot.browser.executableSha256, digest(readFileSync(running)));
  assert.notEqual(snapshot.browser.executableSha256, digest(readFileSync(full)));
  assert.deepEqual(snapshot.browser.expected, expected);
  assert.equal(snapshot.browser.version, expected.version);
  assert.match(snapshot.browser.selectedExecutable, /\S/);
  assert.equal('chromiumExecutableSha256' in snapshot, false, 'полный Chromium паспорт больше не описывает');
  assert.equal(toolchainRefusal(snapshot), null);
});

test('#833 AC1: F33, чужая версия, отсутствие и неопрашиваемость — отказ среды, паспорта нет', async () => {
  const pins = pinsFromSources();
  const expected = expectedBrowser(pins);
  const shell = shellOf(pins);
  const hashed = [];
  const snap = (probe) => toolchainSnapshot(ROOT, {
    pins, npm: '10.9.0', platform: 'linux', probe: async () => probe,
    hashFile: async (path) => { hashed.push(path); return 'e'.repeat(64); },
  });
  const failure = (pattern) => (error) => error instanceof BrowserEnvironmentError
    && /^environment failure \(browser-attestation\) \[WSL golden passport\]: /.test(error.message)
    && pattern.test(error.message);
  // F33: каталог назван пиновой ревизией, исполняется чужая сборка.
  await assert.rejects(snap({
    version: '1.0.0.0', product: 'HeadlessChrome/1.0.0.0', pid: 7, mode: 'headless-shell',
    selectedExecutable: shell, resolvedExecutable: '/opt/other/chromium_headless_shell-1/headless_shell',
  }), failure(new RegExp(`запущен Chromium 1\\.0\\.0\\.0, пин chromium-headless-shell ${expected.version.replaceAll('.', '\\.')}.*\\(F33\\)`)));
  await assert.rejects(snap({ launchError: "browserType.launch: Executable doesn't exist at /x" }),
    failure(/стандартный запуск Playwright не поднял браузер/));
  await assert.rejects(snap({ version: null, error: 'Target closed' }), failure(/версия запущенного браузера не прочитана: Target closed/));
  await assert.rejects(snap({ version: expected.version, product: `HeadlessChrome/${expected.version}`, pid: 7, selectedExecutable: shell, resolvedExecutable: null }),
    failure(/путь запущенного исполняемого не прочитан/));
  assert.deepEqual(hashed, [], 'непригодная среда ничего не хеширует');
  // Совпавший headless shell — хеш от фактически исполняемого пути, не от выбранного.
  const ok = await snap({ version: expected.version, product: `HeadlessChrome/${expected.version}`, pid: 7, selectedExecutable: shell, resolvedExecutable: '/real/headless_shell' });
  assert.deepEqual(hashed, ['/real/headless_shell']);
  assert.equal(ok.browser.executableSha256, 'e'.repeat(64));
  assert.equal(ok.browser.selectedExecutable, shell);
});

test('#833 AC1: toolchain без фактического headless shell паспорт не создаёт', async () => {
  const dir = artifact();
  try {
    const { browser, ...legacy } = toolchain();
    for (const [name, tc, pattern] of [
      ['v1: только полный Chromium', { ...legacy, chromiumExecutable: '/home/test/chromium', chromiumExecutableSha256: 'c'.repeat(64) },
        /toolchain расходится с CI: Chromium headless shell, Chromium executable/],
      ['чужая версия headless shell', { ...legacy, browser: { ...browser, version: '1.0.0.0' } }, /Chromium headless shell/],
      ['хеш не записан', { ...legacy, browser: { ...browser, executableSha256: null } }, /Chromium executable/],
    ]) {
      await assert.rejects(() => createWslAttestation({
        root: ROOT, artifactRoot: dir, intent, source, environment, toolchain: tc,
      }), pattern, name);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#833 AC2: подмена headless shell после съёмки и паспорт прежней схемы отвергаются', async () => {
  const dir = artifact();
  try {
    const tc = toolchain();
    const attestation = await createWslAttestation({
      root: ROOT, artifactRoot: dir, intent, source, environment, toolchain: tc,
    });
    assert.equal(attestation.schema, WSL_ATTESTATION_SCHEMA);
    assert.equal(WSL_ATTESTATION_SCHEMA, 'houseplan-golden-wsl/v2');
    assert.deepEqual(attestation.toolchain.browser, tc.browser);
    writeFileSync(resolve(dir, WSL_ATTESTATION_FILE), `${JSON.stringify(attestation, null, 2)}\n`);
    const verify = (currentToolchain) => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent, currentSource: source, currentEnvironment: environment, currentToolchain,
    });
    assert.equal((await verify(tc)).sha256, attestation.sha256);
    // Бинарник заменён на месте или symlink переставлен на другую сборку того же номера.
    await assert.rejects(() => verify({ ...tc, browser: { ...tc.browser, executableSha256: 'd'.repeat(64) } }),
      /toolchain changed after WSL golden capture: browser\.executableSha256/);
    await assert.rejects(() => verify({ ...tc, browser: { ...tc.browser, resolvedExecutable: '/opt/other/headless_shell' } }),
      /toolchain changed after WSL golden capture: browser\.resolvedExecutable/);
    // Запись приёмки — хеш того же фактического бинарника, полного Chromium в ней нет.
    const record = localAttestationRecord(attestation);
    assert.deepEqual(record.toolchain.browser, {
      version: tc.browser.version, resolvedExecutable: tc.browser.resolvedExecutable, executableSha256: tc.browser.executableSha256,
    });
    assert.equal(record.sha256, attestation.sha256);
    assert.doesNotMatch(JSON.stringify(record), /chromiumExecutable/);
    assert.equal(localAttestationRecord(null), null);
    // Паспорт v1 (хеш полного Chromium) — отказ с причиной, до запуска браузера.
    const { sha256: _, ...payload } = attestation;
    const { browser, ...legacyToolchain } = tc;
    const v1 = {
      ...payload, schema: 'houseplan-golden-wsl/v1',
      toolchain: { ...legacyToolchain, chromiumExecutable: '/home/test/chromium', chromiumExecutableSha256: 'c'.repeat(64) },
    };
    writeFileSync(resolve(dir, WSL_ATTESTATION_FILE), `${JSON.stringify({ ...v1, sha256: objectSha256(v1) }, null, 2)}\n`);
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent, currentSource: source, currentEnvironment: environment,
    }), /houseplan-golden-wsl\/v1 attests chromium\.executablePath\(\) \(full Chromium\), not the headless shell that captured the frames \(#833\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
