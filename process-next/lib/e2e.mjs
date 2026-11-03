import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BETA_E2E, selectExact } from '../catalog/selections.mjs';
import { CONVERTER_CASES } from '../converters/cases.mjs';
import { prepareConverterSuite } from '../converters/prepare.mjs';

const SUITES = {
  journeys: { projects: ['admin', 'viewer', 'mobile'], variant: 'house' },
  'first-run': { projects: ['first-run-viewer', 'first-run-admin'], variant: 'empty' },
  upgrade: { projects: ['upgrade'], variant: 'house' },
  converters: { projects: ['converters'], variant: 'house' },
};
const ROOT_FILES = ['scripts', 'tests', 'seed', 'contract', 'fixtures', 'package.json', 'package-lock.json', 'playwright.config.mjs'];
const SETUPS = new Set(['setup', 'plan-model']);
const key = t => `${t.project}\0${t.file}\0${t.title}`;
const literal = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (file, value) => writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
const immutableRef = value => typeof value === 'string' && (/^[a-f0-9]{40}$/.test(value) || /^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(value));

/** Translate Playwright JSON, preserving file/title/project identity (not a grep cross-product). */
export function listedTests(report) {
  if (report.errors?.length) throw Error('Playwright discovery/report contains load errors');
  const result = [];
  function walk(suite, parents = [], fileSuite = false) {
    const nested = fileSuite ? [] : [...parents, suite.title].filter(Boolean);
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      const file = (spec.file ?? suite.file ?? '').replaceAll('\\', '/');
      if (!file || file.startsWith('/') || file.split('/').includes('..')) throw Error('Unexpected Playwright test path');
      result.push({ file: file.startsWith('tests/') ? file : `tests/${file}`, listFile: file, title: spec.title,
        titlePath: [...nested, spec.title], project: test.projectName, results: test.results ?? [], status: test.status });
    }
    for (const child of suite.suites ?? []) walk(child, nested);
  }
  for (const suite of report.suites ?? []) walk(suite, [], true);
  return result;
}

export function chooseE2ETests(candidates, { suite, selection = 'beta' }) {
  if (!SUITES[suite] || !['beta', 'remainder'].includes(selection)) throw Error('Unknown E2E suite/selection');
  const business = candidates.filter(t => SUITES[suite].projects.includes(t.project));
  if (suite === 'converters') return selectExact(business, CONVERTER_CASES.map(row => ({
    project: 'converters', file: 'tests/process-next-converters.spec.mjs', title: row.title,
  })));
  const beta = selectExact(business, BETA_E2E.filter(t => t.suite === suite));
  return selection === 'beta' ? beta : business.filter(t => !beta.some(b => key(b) === key(t)));
}

export function verifyE2ESelection(actual, selected) {
  const business = actual.filter(t => !SETUPS.has(t.project));
  selectExact(business, selected, key);
  if (business.length !== selected.length) throw Error('Playwright selected extra business scenarios');
  return business;
}

/** A dependency failure leaves business cases skipped, not failed. Keep the
 * business selection count stable, with setup outcomes reported separately. */
export function summarizeE2EResults(actual, selected, exitCode) {
  const tally = rows => {
    const counts = { tests: rows.length, passed: 0, failed: 0, skipped: 0, unexecuted: 0 };
    for (const row of rows) {
      const status = row.results.at(-1)?.status ?? row.status;
      if (status === 'passed') counts.passed++;
      else if (status === 'failed' || status === 'timedOut') counts.failed++;
      else if (status === 'skipped') counts.skipped++;
      else counts.unexecuted++;
    }
    return counts;
  };
  const business = tally(verifyE2ESelection(actual, selected));
  const setup = tally(actual.filter(row => SETUPS.has(row.project)));
  const passed = exitCode === 0 && business.passed === selected.length && setup.passed === setup.tests;
  return { status: passed ? 'passed' : 'failed', ...business, setup, exitCode,
    counts: { ...business, setupTests: setup.tests, setupPassed: setup.passed,
      setupFailed: setup.failed, setupSkipped: setup.skipped, setupUnexecuted: setup.unexecuted } };
}

export function testListText(tests) {
  return tests.map(t => {
    const file = t.listFile ?? t.file;
    const pieces = [t.project, file, ...t.titlePath];
    if (pieces.some(p => typeof p !== 'string' || /[\r\n›>]/.test(p))) throw Error('Test title cannot be represented unambiguously in --test-list');
    return `[${t.project}] › ${file} › ${t.titlePath.join(' › ')}`;
  }).join('\n') + '\n';
}

export function makeE2ESteps({ e2eRoot, selection = 'beta', version, targetRef = version, candidateRoot,
  expectedVersion = version?.replace(/^v/, ''), upgradeFrom, haVersion, workRoot } = {}) {
  const missing = [];
  if (!e2eRoot) missing.push('--e2e-root (prepared houseplan-e2e checkout with npm dependencies/Chromium)');
  if (!candidateRoot && !immutableRef(targetRef)) missing.push('exact --target-ref tag/SHA or --candidate-root with prepared release bytes');
  if (!haVersion || !/^\d+\.\d+\.\d+(?:b\d+)?$/.test(haVersion)) missing.push('--ha-version pinned numeric HA version');
  if (!workRoot) missing.push('--e2e-work-root for private disposable labs/artifacts');
  const steps = [];
  for (const suite of ['journeys', 'first-run', 'upgrade']) {
    const extraMissing = suite === 'upgrade' && !immutableRef(upgradeFrom) ? ['exact --upgrade-from previous stable tag/SHA'] : [];
    const reasons = [...missing, ...extraMissing];
    const args = [fileURLToPath(import.meta.url), `--suite=${suite}`, `--selection=${selection}`];
    for (const [name, value] of Object.entries({ 'e2e-root': e2eRoot, 'target-ref': targetRef, 'candidate-root': candidateRoot,
      'expected-version': expectedVersion, 'upgrade-from': upgradeFrom, 'ha-version': haVersion, 'work-root': workRoot })) {
      if (value) args.push(`--${name}=${value}`);
    }
    const id = `e2e-${selection}-${suite}`;
    steps.push({ id, name: `HA E2E ${selection}: ${suite}`, cwd: 'e2e',
      command: reasons.length ? null : ['node', ...args, '--execute'], unavailable: reasons.length ? `E2E prerequisites: ${reasons.join('; ')}` : undefined,
      inputs: ['tests/**', 'scripts/**', 'seed/**', 'contract/**', 'fixtures/**', 'package.json', 'package-lock.json', 'playwright.config.mjs'],
      requires: [], after: steps.length ? [steps.at(-1).id] : [], allowEmpty: selection === 'remainder', diagnostic: false, timeoutMs: 45 * 60_000 });
  }
  return { steps, prerequisites: ['Prepared Ubuntu WSL: Node, E2E npm dependencies + pinned Chromium, Docker, tar/unzip; only private generated labs are used.', ...new Set(missing)],
    limitations: ['A SHA install uses upstream source build; candidate-root installs already prepared bytes. No external/user HA_URL is accepted.'] };
}

function validateOptions(options) {
  const { suite, selection = 'beta', targetRef, candidateRoot, upgradeFrom, haVersion, workRoot, e2eRoot } = options;
  if (!SUITES[suite] || !['beta', 'remainder'].includes(selection)) throw Error('Unknown E2E suite/selection');
  if (!e2eRoot || !workRoot || !path.isAbsolute(workRoot)) throw Error('e2eRoot and absolute private workRoot are required');
  if (!candidateRoot && !immutableRef(targetRef)) throw Error('Use an exact target tag/SHA or prepared candidateRoot, not a moving branch/latest');
  if (suite === 'upgrade' && (!immutableRef(upgradeFrom) || upgradeFrom === targetRef)) throw Error('Upgrade needs a different exact previous stable ref');
  if (!/^\d+\.\d+\.\d+(?:b\d+)?$/.test(haVersion ?? '')) throw Error('Pin the numeric Home Assistant version');
  const source = realpathSync(e2eRoot);
  for (const file of ['scripts/prepare-seed.mjs', 'scripts/install-houseplan.mjs', 'scripts/ha.mjs', 'playwright.config.mjs', 'node_modules/playwright/cli.js']) {
    if (!existsSync(path.join(source, file))) throw Error(`Missing E2E prerequisite: ${file}`);
  }
  const work = path.resolve(workRoot);
  if (work === source || work.startsWith(source + path.sep)) throw Error('Private labs must be outside the E2E checkout');
  if (candidateRoot) for (const file of ['custom_components/houseplan/manifest.json', 'custom_components/houseplan/frontend/houseplan-card.js', 'docs/data-hp-contract.json']) {
    if (!existsSync(path.join(candidateRoot, file))) throw Error(`Prepared candidate lacks ${file}`);
  }
  return { ...options, source, selection, workRoot: work };
}

export async function executeE2ECommand(command, { cwd, env, signal, onOutput = () => {} } = {}) {
  return new Promise(resolve => {
    const child = spawn(command[0] === 'node' ? process.execPath : command[0], command.slice(1), {
      cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', error;
    const abort = () => child.kill('SIGTERM');
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', bytes => { stdout = (stdout + bytes).slice(-8 * 1024 * 1024); onOutput(bytes.toString()); });
    child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-64 * 1024); onOutput(bytes.toString()); });
    child.on('error', e => { error = e.message; });
    child.on('close', (code, exitSignal) => { signal?.removeEventListener('abort', abort); resolve({ code, signal: exitSignal, stdout, stderr, error }); });
  });
}

/** Find a loopback port, then publish that explicit number for the whole lab.
 * Docker's anonymous HostPort is reallocated by restart. Closing this temporary
 * socket leaves a bind race; only a confirmed Docker bind collision is retried.
 */
export async function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(error => {
        if (error) reject(error);
        else if (!address || typeof address !== 'object') reject(Error('Missing loopback port reservation'));
        else resolve(address.port);
      });
    });
  });
}

function isPortBindCollision(result) {
  return result.code !== 0 && /(?:\bbind\b[\s\S]*\baddress already in use\b|\bport is already allocated\b)/i.test(result.stderr ?? '');
}

function privateEnvironment(base, workspace, container, options) {
  const env = { ...base };
  for (const name of Object.keys(env)) if (/^(HA_|E2E_|HOUSEPLAN_|PLAYWRIGHT_JSON_|PLAYWRIGHT_HTML_|PW_TEST)/.test(name)) delete env[name];
  Object.assign(env, { CI: '1', NO_COLOR: '1', HA_CONTAINER: container, HA_URL: 'http://127.0.0.1:1',
    E2E_RUN_DIR: path.join(workspace, 'run'), E2E_EVIDENCE_DIR: path.join(workspace, 'artifacts', 'evidence'),
    E2E_ADMIN_PASSWORD: randomUUID(), E2E_VIEWER_PASSWORD: randomUUID(), HOUSEPLAN_REF: options.targetRef ?? '',
    PLAYWRIGHT_HTML_OPEN: 'never', PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(workspace, 'artifacts', 'html') });
  if (options.expectedVersion) env.HOUSEPLAN_EXPECTED_VERSION = options.expectedVersion.replace(/^v/, '');
  return env;
}

function selectedConfig(selected, baseConfig = './playwright.config.mjs') {
  // Dependency projects bypass CLI filters in Playwright. Limit them too, while preserving login/plan preparation.
  const groups = Object.fromEntries([...new Set(selected.map(t => t.project))].map(name => [name, selected.filter(t => t.project === name)]));
  const setups = Object.keys(groups).every(name => name === 'converters') ? ['setup'] : [...SETUPS];
  return `import original from '${baseConfig}';\nconst selected = ${JSON.stringify(groups)};\nconst setups = new Set(${JSON.stringify(setups)});\nconst escape = ${literal.toString()};\nexport default { ...original, retries: 0, workers: 1, fullyParallel: false,\n projects: original.projects.filter(p => setups.has(p.name) || selected[p.name]).map(p => ({ ...p, retries: 0,\n ...(selected[p.name] ? { testMatch: selected[p.name].map(t => new RegExp(escape(t.file) + '$')), grep: new RegExp('(?:^| )(' + selected[p.name].map(t => escape(t.title)).join('|') + ')$') } : {}),\n dependencies: (p.dependencies || []).filter(n => setups.has(n) || selected[n]) })) };\n`;
}

/** Actual execution is opt-in. No HA_URL input: this owns its generated seed, container and copied checkout. */
export async function runE2E(options, { execute = executeE2ECommand, environment = process.env, signal, onProgress = () => {}, choosePort = reserveLoopbackPort } = {}) {
  const opts = validateOptions(options);
  mkdirSync(opts.workRoot, { recursive: true, mode: 0o700 });
  const workspace = mkdtempSync(path.join(opts.workRoot, `hp-e2e-${opts.suite}-`));
  const owner = randomUUID(), container = `hp-next-${owner}`;
  const artifacts = path.join(workspace, 'artifacts'); mkdirSync(artifacts, { mode: 0o700 });
  for (const entry of ROOT_FILES) if (existsSync(path.join(opts.source, entry))) cpSync(path.join(opts.source, entry), path.join(workspace, entry), { recursive: true });
  symlinkSync(path.join(opts.source, 'node_modules'), path.join(workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const baseConfig = opts.suite === 'converters' ? prepareConverterSuite(workspace) : './playwright.config.mjs';
  const env = privateEnvironment(environment, workspace, container, opts);
  if (opts.suite === 'converters') env.HP_CONVERTER_REPORT_DIR = path.join(artifacts, 'converters');
  const cli = path.join(workspace, 'node_modules/playwright/cli.js');
  const projects = SUITES[opts.suite].projects.map(p => `--project=${p}`);
  const call = async (command, extraEnv = {}, allowFailure = false, cleanup = false) => {
    if (signal?.aborted && !cleanup) throw Error('E2E run cancelled');
    const result = await execute(command, { cwd: workspace, env: { ...env, ...extraEnv }, signal: cleanup ? undefined : signal });
    if (result.code !== 0 && !allowFailure) throw Error(`${path.basename(command[0])} ${command[1] ?? ''} failed (${result.code ?? result.signal ?? result.error ?? 'unknown'})`);
    return result;
  };
  let containerStarted = false, endpoint = null;
  const cleanupContainer = async (recordLogs = false) => {
    // One cleanup attempt per owned start; a failed inspection/removal remains
    // visible and retains the workspace rather than retrying an unsafe delete.
    containerStarted = false;
    const ownership = await call(['docker', 'inspect', '--format', '{{ index .Config.Labels "houseplan.process-next.owner" }}', container], {}, true, true);
    if (ownership.code === 0 && ownership.stdout.trim() === owner) {
      try {
        if (recordLogs) {
          const mapping = await call(['docker', 'port', container, '8123/tcp'], {}, true, true);
          save(path.join(artifacts, 'endpoint.json'), { ...endpoint, finalMapping: mapping.code === 0 ? mapping.stdout.trim() : null, finalMappingCode: mapping.code });
          const logs = await call(['docker', 'logs', container], {}, true, true);
          writeFileSync(path.join(artifacts, 'docker.log'), (logs.stdout ?? '') + (logs.stderr ?? ''), { mode: 0o600 });
        }
      } finally {
        const removed = await call(['docker', 'rm', '-f', container], {}, true, true);
        if (removed.code !== 0) throw Error('Could not remove owned E2E container ' + container + '; workspace retained');
      }
    } else if (ownership.code === 0 || !/No such (?:object|container)/i.test(ownership.stderr ?? '')) {
      throw Error('E2E container ownership could not be confirmed: ' + container + '; not removed');
    }
  };
  try {
    onProgress({ phase: 'discover', suite: opts.suite });
    const discoveryFile = path.join(artifacts, 'discovery.json');
    await call(['node', cli, 'test', `--config=${baseConfig}`, '--list', '--reporter=json', ...projects], { PLAYWRIGHT_JSON_OUTPUT_FILE: discoveryFile });
    const candidates = listedTests(json(discoveryFile));
    const selected = chooseE2ETests(candidates, opts);
    if (!selected.length) {
      const result = { status: 'not-required', suite: opts.suite, selection: opts.selection, tests: 0,
        counts: { tests: 0, passed: 0, failed: 0, skipped: 0 }, workspace };
      save(path.join(artifacts, 'summary.json'), result); return result;
    }
    const listFile = path.join(workspace, 'selected-tests.txt');
    writeFileSync(listFile, testListText(selected));
    writeFileSync(path.join(workspace, 'process-next.config.mjs'), selectedConfig(selected, baseConfig));
    const testArgs = ['node', cli, 'test', '--config=process-next.config.mjs', `--test-list=${listFile}`, '--workers=1', '--retries=0', ...projects.filter(p => selected.some(t => p === `--project=${t.project}`))];
    const selectedFile = path.join(artifacts, 'selected.json');
    await call([...testArgs, '--list', '--reporter=json'], { PLAYWRIGHT_JSON_OUTPUT_FILE: selectedFile });
    verifyE2ESelection(listedTests(json(selectedFile)), selected);
    if (options.listOnly) return { status: 'listed', suite: opts.suite, tests: selected.length, selected: selected.map(({ results, status, ...t }) => t), workspace };

    let target = opts.targetRef;
    if (opts.candidateRoot) {
      const candidate = path.join(workspace, 'candidate');
      mkdirSync(path.join(candidate, 'custom_components'), { recursive: true }); mkdirSync(path.join(candidate, 'docs'));
      cpSync(path.join(opts.candidateRoot, 'custom_components/houseplan'), path.join(candidate, 'custom_components/houseplan'), { recursive: true });
      cpSync(path.join(opts.candidateRoot, 'docs/data-hp-contract.json'), path.join(candidate, 'docs/data-hp-contract.json'));
      target = candidate;
    }
    env.HOUSEPLAN_REF = target;
    onProgress({ phase: 'prepare', suite: opts.suite, tests: selected.length });
    await call(['node', 'scripts/prepare-seed.mjs', `--out=${env.E2E_RUN_DIR}`, `--variant=${SUITES[opts.suite].variant}`]);
    const initial = opts.suite === 'upgrade' ? opts.upgradeFrom : target;
    const initialArgs = ['node', 'scripts/install-houseplan.mjs', `--ref=${initial}`, `--out=${env.E2E_RUN_DIR}`];
    if (opts.suite !== 'upgrade' && opts.expectedVersion) initialArgs.push(`--expect-version=${opts.expectedVersion.replace(/^v/, '')}`);
    await call(initialArgs);
    const installed = json(path.join(env.E2E_RUN_DIR, '.e2e-houseplan.json'));
    if (opts.suite === 'upgrade' && opts.expectedVersion?.replace(/^v/, '') === installed.version) throw Error('Upgrade source and target versions are equal');

    // Never call upstream ha.mjs up: it removes an existing named container first.
    let port;
    for (let attempt = 1; attempt <= 3; attempt++) {
      port = await choosePort();
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid explicit loopback port');
      containerStarted = true; // A failed run may still leave our created container.
      const started = await call(['docker', 'run', '-d', '--name', container, '--label', 'houseplan.process-next.owner=' + owner,
        '-p', '127.0.0.1:' + port + ':8123', '-v', env.E2E_RUN_DIR + ':/config', '-e', 'TZ=Europe/Moscow',
        'ghcr.io/home-assistant/home-assistant:' + opts.haVersion], {}, true);
      if (started.code === 0) break;
      await cleanupContainer();
      const detail = started.stderr?.trim() || started.error || String(started.code ?? started.signal);
      if (!isPortBindCollision(started)) throw Error('Owned E2E Docker start failed: ' + detail);
      if (attempt === 3) throw Error('Loopback port bind collision after 3 attempts: ' + detail);
    }
    const mapping = (await call(['docker', 'port', container, '8123/tcp'])).stdout.trim();
    endpoint = { requestedPort: port, initialMapping: mapping };
    save(path.join(artifacts, 'endpoint.json'), endpoint);
    if (mapping !== '127.0.0.1:' + port) throw Error('Docker loopback mapping differs from requested fixed port');
    env.HA_URL = 'http://' + mapping;
    await call(['node', 'scripts/ha.mjs', 'wait', '--timeout=480', '--url=' + env.HA_URL, '--dir=' + env.E2E_RUN_DIR]);
    const reportFile = path.join(artifacts, 'results.json');
    onProgress({ phase: 'tests', suite: opts.suite, selected: selected.length });
    const execution = await call([...testArgs, '--reporter=list,json', `--output=${path.join(artifacts, 'test-results')}`], { PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile }, true);
    if (!existsSync(reportFile)) throw Error('E2E did not produce a complete test report');
    const actual = listedTests(json(reportFile));
    const result = { ...summarizeE2EResults(actual, selected, execution.code), suite: opts.suite, selection: opts.selection,
      reportFile, workspace, targetRef: opts.targetRef ?? null, preparedCandidate: !!opts.candidateRoot, haVersion: opts.haVersion };
    save(path.join(artifacts, 'summary.json'), result);
    return result;
  } catch (error) {
    error.workspace = workspace;
    throw error;
  } finally {
    if (containerStarted) await cleanupContainer(true);
    // Keep only our generated workspace as evidence. Never recursively delete caller paths or the source checkout.
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = {};
  const mapping = { 'e2e-root': 'e2eRoot', 'target-ref': 'targetRef', 'candidate-root': 'candidateRoot', 'expected-version': 'expectedVersion',
    'upgrade-from': 'upgradeFrom', 'ha-version': 'haVersion', 'work-root': 'workRoot', suite: 'suite', selection: 'selection' };
  let execute = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === '--execute') execute = true;
    else if (arg === '--list') options.listOnly = true;
    else { const match = arg.match(/^--([^=]+)=(.+)$/); if (!match || !mapping[match[1]]) throw Error(`Unknown E2E argument ${arg}`); options[mapping[match[1]]] = match[2]; }
  }
  if (!execute && !options.listOnly) throw Error('Use --list (discovery only) or --execute (own disposable HA lab)');
  const controller = new AbortController();
  for (const event of ['SIGINT', 'SIGTERM']) process.once(event, () => controller.abort());
  try {
    const result = await runE2E(options, { signal: controller.signal, onProgress: event => console.log(JSON.stringify(event)) });
    console.log('PROCESS_NEXT_RESULT ' + JSON.stringify(result)); process.exitCode = ['passed', 'not-required', 'listed'].includes(result.status) ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
