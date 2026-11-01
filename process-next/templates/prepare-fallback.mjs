import { appendFileSync, mkdirSync, readFileSync, realpathSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { cpus, release } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fullSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fields = new Set(['event', 'issue', 'track', 'layer', 'areaTests', 'changedFiles', 'version', 'phase', 'e2eRoot', 'workRoot',
  'e2eWorkRoot', 'candidateRoot', 'expectedVersion', 'targetRef', 'upgradeFrom', 'haVersion', 'metricsRequest', 'mutationShard',
  'e2eCommit', 'measurementsCommit', 'port']);

function relativeFile(value, name) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f\\:*?]/.test(value) || value.startsWith('/')
    || value.split('/').some(part => !part || part === '.' || part === '..')) throw Error(`${name} must be a literal repository-relative file`);
  return value;
}

/** Request remains data: it never supplies a shell program, checkout repository or output filename. */
export function normalizeFallbackRequest(input, { workspace, candidate }) {
  if (!object(input)) throw Error('Fallback request must be an object');
  if (!fullSha(candidate)) throw Error('Candidate must be a full 40-character commit SHA');
  if (!workspace || !path.isAbsolute(workspace)) throw Error('Absolute CI workspace required');
  for (const name of Object.keys(input)) if (!fields.has(name)) throw Error(`Unsupported fallback request field: ${name}`);
  const request = { ...input, event: input.event ?? 'task', layer: input.layer ?? 'product' };
  if (!['task', 'hotfix', 'beta', 'stable', 'mutation', 'converters'].includes(request.event)) throw Error('Unknown fallback event');
  if (!['product', 'infra', 'infrastructure', 'docs', 'documentation'].includes(request.layer)) throw Error('Unknown fallback layer');
  if (request.track !== undefined && !['ship', 'show', 'ask'].includes(request.track)) throw Error('Unknown track');
  if (request.issue !== undefined && (!Number.isSafeInteger(request.issue) || request.issue < 1)) throw Error('Positive issue required');
  for (const key of ['areaTests', 'changedFiles']) if (request[key] !== undefined) {
    if (!Array.isArray(request[key])) throw Error(`${key} must be an array`);
    request[key].forEach(file => relativeFile(file, key));
  }
  const releaseEvent = ['beta', 'stable'].includes(request.event);
  const docsOnly = ['docs', 'documentation'].includes(request.layer) && !releaseEvent;
  if (docsOnly) throw Error('Pure documentation has no fallback execution, dependencies or validation run');
  const needsE2E = releaseEvent;
  const needsMetrics = releaseEvent;
  if (needsE2E && !fullSha(request.e2eCommit)) throw Error('beta/stable require e2eCommit: full pinned SHA of Matysh/houseplan-e2e');
  if (request.measurementsCommit !== undefined && !fullSha(request.measurementsCommit)) throw Error('measurementsCommit must be a full SHA of Matysh/houseplan-card');
  if (releaseEvent) {
    if (request.metricsRequest !== undefined) relativeFile(request.metricsRequest, 'metricsRequest');
    if (!/^\d+\.\d+\.\d+(?:b\d+)?$/.test(request.haVersion ?? '')) throw Error('Pin haVersion, for example 2026.10.4');
    if (!(/^v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(request.upgradeFrom ?? '') || fullSha(request.upgradeFrom))) throw Error('Exact upgradeFrom tag/SHA required');
  }
  const infra = ['infra', 'infrastructure'].includes(request.layer);
  const needsBrowser = releaseEvent || request.event === 'mutation' || ['task', 'hotfix'].includes(request.event) && !infra;
  const needsBackend = releaseEvent || request.event === 'mutation' || (request.areaTests ?? []).some(file => file.startsWith('tests_backend/'));
  const needsPython = needsBackend || (request.changedFiles ?? []).some(file => file.endsWith('.py'));
  // Host-specific WSL locations are deliberately replaced, not interpreted in a shell.
  request.e2eRoot = path.join(workspace, 'process-next', '.state', 'fallback-e2e');
  request.workRoot = path.join(workspace, 'artifacts', 'process-next-e2e-labs');
  request.candidateRoot = path.join(workspace, 'artifacts', 'process-next', 'candidate');
  delete request.e2eWorkRoot;
  delete request.port; // The private CI container gets a Docker-allocated loopback port.
  delete request.targetRef; // release-package supplies the tested bytes of this fixed checkout.
  return { request, candidate, needsE2E, needsMetrics, needsBrowser, needsBackend, needsPython,
    e2eCommit: needsE2E ? request.e2eCommit : '', measurementsCommit: needsMetrics ? request.measurementsCommit ?? '' : '' };
}

function readSupplied(root, relative) {
  relativeFile(relative, 'Measurement path');
  const directory = realpathSync(root), file = realpathSync(path.join(directory, relative));
  const rest = path.relative(directory, file);
  if (rest.startsWith('..' + path.sep) || rest === '..' || path.isAbsolute(rest)) throw Error('Measurement file leaves its fixed checkout');
  return JSON.parse(readFileSync(file, 'utf8'));
}
const save = (file, value) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); };

/** Artifact extraction stays isolated; only known inert result files enter the checkout. */
export function restoreFallbackResults(workspace) {
  const prior = path.join(workspace, 'process-next', '.state', 'fallback-prior');
  const files = [];
  const cache = path.join(prior, 'process-next', '.state', 'cache');
  if (existsSync(cache)) for (const entry of readdirSync(cache, { withFileTypes: true })) {
    if (entry.isFile() && /^[a-f0-9]{64}\.json$/.test(entry.name)) {
      const relative = `process-next/.state/cache/${entry.name}`, value = readSupplied(prior, relative);
      if (value.status === 'passed' && value.fingerprint === entry.name.slice(0, -5)) { save(path.join(workspace, relative), value); files.push(relative); }
    }
  }
  for (const relative of ['artifacts/process-next/backend-coverage.xml', 'artifacts/process-next/golden-beta/golden-report.json', 'artifacts/process-next/golden-rest/golden-report.json']) {
    const source = path.join(prior, relative);
    if (!existsSync(source)) continue;
    const real = realpathSync(source);
    if (!real.startsWith(realpathSync(prior) + path.sep)) throw Error('Restored result leaves its artifact');
    mkdirSync(path.dirname(path.join(workspace, relative)), { recursive: true }); copyFileSync(real, path.join(workspace, relative)); files.push(relative);
  }
  return files;
}

export function materializeFallback({ input, workspace, candidate, measurementRoot = workspace, host }) {
  const prepared = normalizeFallbackRequest(input, { workspace, candidate });
  const request = prepared.request;
  if (prepared.needsE2E) {
    const version = readSupplied(workspace, 'package.json').version;
    if (request.expectedVersion && request.expectedVersion.replace(/^v/, '') !== version) throw Error('expectedVersion differs from the candidate package');
    request.expectedVersion = version;
  }
  if (prepared.needsMetrics) {
    const supplied = request.metricsRequest ? readSupplied(measurementRoot, request.metricsRequest) : {};
    if (!object(supplied)) throw Error('metricsRequest must be an object');
    let stable = null;
    if (supplied.latestStable) {
      try { stable = readSupplied(measurementRoot, supplied.latestStable); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (stable && !stable.source_sha) throw Error('latestStable must be an actual recorded measurement');
    }
    if (!host?.cpu || !host.linux || host.execution_environment !== 'github-actions') throw Error('Actual GitHub Actions host facts required');
    const directory = path.join(workspace, 'process-next', '.state', 'fallback-inputs');
    const latest = path.join(directory, 'latest-stable.json'), metrics = path.join(directory, 'metrics-request.json');
    if (stable) save(latest, stable);
    // Never take CPU/kernel/power claims from a WSL request to make CI look comparable.
    save(metrics, { ...(stable ? { latestStable: path.relative(workspace, latest).split(path.sep).join('/') } : {}), host,
      note: 'CI host; comparator decides comparability. Frozen v1.83.1 remains diagnostic only.' });
    request.metricsRequest = path.relative(workspace, metrics).split(path.sep).join('/');
  }
  delete request.e2eCommit; delete request.measurementsCommit;
  const file = path.join(workspace, 'process-next', '.state', 'fallback-request.json');
  save(file, request);
  return { ...prepared, request, file };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const phase = process.argv[2];
    if (!['plan', 'materialize', 'restore'].includes(phase)) throw Error('Expected plan, materialize or restore');
    const workspace = process.env.GITHUB_WORKSPACE, candidate = process.env.HP_CANDIDATE;
    const input = JSON.parse(process.env.HP_REQUEST ?? 'null');
    if (phase === 'restore') console.log(`Restored ${restoreFallbackResults(workspace).length} result files; applicability is decided by the runner.`);
    else if (phase === 'plan') {
      const prepared = normalizeFallbackRequest(input, { workspace, candidate });
      const outputs = { needs_e2e: prepared.needsE2E, needs_browser: prepared.needsBrowser, needs_backend: prepared.needsBackend,
        needs_python: prepared.needsPython, e2e_commit: prepared.e2eCommit, measurements_commit: prepared.measurementsCommit };
      if (!process.env.GITHUB_OUTPUT) throw Error('GITHUB_OUTPUT required');
      appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''));
      console.log(`Fallback preparation: ${prepared.request.event}; E2E ${prepared.needsE2E}; candidate ${candidate}`);
    } else {
      if (process.env.GITHUB_ACTIONS !== 'true') throw Error('This entry point captures CI host facts only inside GitHub Actions');
      const host = { cpu: cpus()[0]?.model, linux: `linux ${release()}`, power_scheme: 'github-hosted-unmanaged',
        execution_environment: 'github-actions', runner_image: process.env.ImageOS ?? null, runner_image_version: process.env.ImageVersion ?? null };
      const result = materializeFallback({ input, workspace, candidate,
        measurementRoot: input.measurementsCommit ? path.join(workspace, 'process-next', '.state', 'fallback-measurements') : workspace, host });
      console.log(`Prepared request: ${result.file}. CI and WSL timings are not interchangeable.`);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
