import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { digest, inputIdentity, outputIdentity, matchesInputs, defaultStateDir, ResultStore, stepIdentity, writeJson } from './storage.mjs';

const implementation = digest(readFileSync(new URL('./runner.mjs', import.meta.url)) + readFileSync(new URL('./storage.mjs', import.meta.url)));

const successful = result => ['passed', 'reused', 'not-required'].includes(result?.status);
function materialIdentity(root, inputs) {
  try {
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const materialSha = git(['rev-parse', 'HEAD']).trim();
    const changed = new Set((git(['diff', '--name-only', '-z', 'HEAD']) + git(['ls-files', '--others', '--exclude-standard', '-z'])).split('\0').filter(Boolean));
    return { materialSha, materialClean: ![...changed].some(file => matchesInputs(file, inputs)) };
  } catch { return { materialSha: null, materialClean: false }; }
}
export function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.steps)) throw new Error('Plan requires steps');
  const ids = new Set();
  for (const step of plan.steps) {
    if (typeof step.id !== 'string' || !/^[A-Za-z0-9_.:-]+$/.test(step.id) || ids.has(step.id)) throw new Error('Duplicate/invalid step id');
    ids.add(step.id);
    if (step.command !== null && (!Array.isArray(step.command) || !step.command.length || step.command.some(x => typeof x !== 'string' || x.includes('\0')))) throw new Error(`Invalid command: ${step.id}`);
    if (step.command === null && !step.unavailable) throw new Error(`Missing command reason: ${step.id}`);
    if (!['root', 'e2e', undefined].includes(step.cwd)) throw new Error(`Invalid cwd: ${step.id}`);
    if (step.reusableReports !== undefined) {
      const reports = step.reusableReports;
      if (!Array.isArray(reports) || !reports.length || new Set(reports).size !== reports.length
        || reports.some(name => typeof name !== 'string' || !/^artifacts\/process-next\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:json|xml)$/.test(name))
        || JSON.stringify([...reports].sort()) !== JSON.stringify([...(step.outputs ?? [])].sort())) throw Error(`Only named report outputs may be reused: ${step.id}`);
    }
  }
  const seen = new Set(), active = new Set(), byId = new Map(plan.steps.map(s => [s.id, s]));
  function visit(id) {
    if (!byId.has(id)) throw new Error(`Unknown dependency: ${id}`);
    if (active.has(id)) throw new Error(`Cyclic dependency: ${id}`);
    if (seen.has(id)) return;
    active.add(id); for (const dependency of [...byId.get(id).requires ?? [], ...byId.get(id).after ?? []]) visit(dependency);
    active.delete(id); seen.add(id);
  }
  for (const id of ids) visit(id);
}
export function classifyRun(results) {
  const required = results.filter(r => !r.diagnostic);
  return required.some(r => !successful(r)) ? 'failed' : required.length ? 'passed' : results.length ? 'diagnostic' : 'not-required';
}
export function parseCounts(text) {
  const result = {};
  for (const [key, pattern] of Object.entries({ tests: /^# tests (\d+)$/gm, passed: /^# pass (\d+)$/gm, failed: /^# fail (\d+)$/gm, skipped: /^# skipped (\d+)$/gm, cancelled: /^# cancelled (\d+)$/gm, todo: /^# todo (\d+)$/gm })) {
    const hits = [...text.matchAll(pattern)]; if (hits.length) result[key] = Number(hits.at(-1)[1]);
  }
  const pytest = text.match(/(?:^|\n).*?(\d+) passed(?:, (\d+) skipped)?[^\n]* in [\d.]+s/m);
  if (!Object.keys(result).length && pytest) { result.passed = Number(pytest[1]); result.skipped = Number(pytest[2] ?? 0); }
  return result;
}
export async function executeStep(step, { cwd, logPath, signal, onOutput = () => {}, environment = {} }) {
  const log = createWriteStream(logPath, { flags: 'w', mode: 0o600 });
  const start = Date.now(); let tail = '', launchError = null, timedOut = false;
  const [program, ...args] = step.command;
  const resolvedProgram = program === 'node' ? process.execPath : program;
  const child = spawn(resolvedProgram, args, { cwd, shell: false, windowsHide: true,
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...environment, ...step.env, FORCE_COLOR: '0', NO_COLOR: '1' } });
  const stop = () => {
    if (!child.pid) return;
    try {
      if (process.platform === 'win32') { const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); killer.on('error', () => child.kill()); }
      else process.kill(-child.pid, 'SIGTERM');
    } catch { child.kill(); }
  };
  signal?.addEventListener('abort', stop, { once: true });
  let killTimer;
  const timer = setTimeout(() => { timedOut = true; stop(); killTimer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }, 3000); killTimer.unref(); }, step.timeoutMs ?? 15 * 60_000);
  timer.unref();
  for (const stream of [child.stdout, child.stderr]) stream.on('data', bytes => {
    const text = bytes.toString(); log.write(bytes); tail = (tail + text).slice(-512 * 1024);
    const progress = [...tail.matchAll(/^PROCESS_NEXT_PROGRESS (.+)$/gm)].at(-1);
    let actual;
    try { actual = progress ? JSON.parse(progress[1]) : undefined; } catch { /* A partial line completes in the next chunk. */ }
    onOutput(text, actual);
  });
  child.on('error', error => { launchError = error.message; });
  const outcome = await new Promise(resolve => child.once('close', (code, exitSignal) => resolve({ code, signal: exitSignal })));
  clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', stop);
  await new Promise(resolve => log.end(resolve));
  const counts = parseCounts(tail);
  let status = signal?.aborted ? 'cancelled' : timedOut ? 'timed-out' : launchError ? 'unavailable' : outcome.code === 0 ? 'passed' : 'failed';
  if (status === 'passed' && counts.failed > 0) status = 'failed';
  const structured = [...tail.matchAll(/^PROCESS_NEXT_RESULT (.+)$/gm)].at(-1);
  if (structured) {
    try {
      const result = JSON.parse(structured[1]);
      if (result.counts) Object.assign(counts, result.counts);
      else if (Number.isFinite(result.tests)) for (const key of ['tests','passed','failed','skipped']) if (Number.isFinite(result[key])) counts[key] = result[key];
      if (status === 'passed' && result.status === 'not-required') status = step.allowEmpty ? 'not-required' : 'failed';
      if (status === 'passed' && result.status === 'failed') status = 'failed';
    } catch { status = 'failed'; }
  }
  if (status === 'passed' && step.expectedNonempty && (!(counts.tests > 0) || !Number.isFinite(counts.passed) || !Number.isFinite(counts.failed)
    || counts.passed + counts.failed + (counts.skipped ?? 0) + (counts.cancelled ?? 0) + (counts.todo ?? 0) !== counts.tests)) status = 'failed';
  return { ...outcome, status, counts, durationMs: Date.now() - start, error: launchError, logPath };
}
export async function runPlan(plan, { root, e2eRoot, stateDir, jobs = 2,
  reuse = true, signal, execute = executeStep, onProgress = () => {}, environment = {} } = {}) {
  validatePlan(plan); root = resolve(root);
  if (!Number.isInteger(jobs) || jobs < 1 || jobs > 16) throw new Error('jobs must be 1..16');
  const store = new ResultStore(stateDir ?? defaultStateDir(root)), id = `${new Date().toISOString().replace(/[^0-9T]/g, '')}-${randomUUID().slice(0, 8)}`;
  const directory = join(store.directory, 'runs', id); mkdirSync(directory, { recursive: true });
  const identityEnvironment = { node: process.version, platform: process.platform, arch: process.arch, ...environment, runner: implementation };
  const report = { schema: 1, id, name: plan.name, event: plan.event, issue: plan.issue, startedAt: new Date().toISOString(), status: 'running', results: [], environment: identityEnvironment };
  writeJson(join(directory, 'plan.json'), plan); store.save(report);
  const results = new Map(), running = new Map(), pending = new Map(plan.steps.map(s => [s.id, s]));
  const roots = { root, e2e: e2eRoot && resolve(e2eRoot) };
  const inputsFor = key => [...plan.steps.filter(s => (s.cwd ?? 'root') === key).flatMap(s => s.inputs ?? []), ...(key === 'root' ? plan.steps.flatMap(s => s.rootInputs ?? []) : [])];
  Object.assign(report, plan.steps.length ? materialIdentity(root, inputsFor('root')) : { materialSha: null, materialClean: false });
  const sourceInputs = Object.fromEntries(Object.entries(roots).filter(([, dir]) => dir).map(([key, dir]) => [key, inputIdentity(dir, inputsFor(key)).hash]));
  function notify(step, state) {
    onProgress({ run: report.name, id, total: plan.steps.length, completed: results.size, percent: plan.steps.length ? Math.floor(results.size * 100 / plan.steps.length) : null,
      active: [...running.keys()], elapsedMs: Date.now() - Date.parse(report.startedAt), reused: [...results.values()].filter(r => r.status === 'reused').length,
      failed: [...results.values()].filter(r => !successful(r)).length, step, state });
  }
  async function perform(step) {
    const cwd = roots[step.cwd ?? 'root'];
    const common = { id: step.id, name: step.name, diagnostic: !!step.diagnostic, startedAt: new Date().toISOString() };
    if (!cwd || !step.command) return { ...common, status: 'unavailable', reason: step.unavailable ?? 'Не указан каталог houseplan-e2e', durationMs: 0 };
    const dependencies = (step.requires ?? []).filter(id => !(step.preparationOnlyRequires ?? []).includes(id)).map(id => {
      const r = results.get(id); return (step.dependencyOutputOnlyRequires ?? []).includes(id) ? [id, r.outputHash] : [id, r.fingerprint, r.outputHash];
    });
    const rootIdentity = () => inputIdentity(root, step.rootInputs ?? [], { behavior: step.reuseReleaseVersion === true }).hash;
    const stepEnvironment = { ...identityEnvironment, rootInputs: rootIdentity() };
    const identity = stepIdentity(cwd, step, stepEnvironment, dependencies);
    let output = outputIdentity(cwd, step.outputs);
    const prior = reuse && !step.alwaysRun && store.find(identity.hash);
    if (prior && !output.complete && store.restoreReports(prior, cwd, step.reusableReports)) output = outputIdentity(cwd, step.outputs);
    if (prior?.status === 'passed' && output.complete && (!step.outputs?.length || prior.cacheOutputHash === output.hash))
      return { ...common, status: 'reused', fingerprint: identity.hash, outputHash: prior.outputHash, cacheOutputHash: prior.cacheOutputHash, sourceRun: prior.runId, counts: prior.counts, durationMs: 0 };
    const logPath = join(directory, `${step.id.replace(/:/g, '_')}.log`);
    const value = await execute(step, { cwd, logPath, signal, environment, onOutput: (text, progress) => notify(step.id, { output: text.slice(-500), progress }) });
    const after = stepIdentity(cwd, step, { ...identityEnvironment, rootInputs: rootIdentity() }, dependencies), generated = outputIdentity(cwd, step.outputs);
    if (after.hash !== identity.hash) { value.status = 'invalidated'; value.reason = 'Входы проверки изменились во время выполнения'; }
    if (value.status === 'passed' && !generated.complete) { value.status = 'failed'; value.reason = 'Не получен ожидаемый артефакт подготовки'; }
    return { ...common, ...value, fingerprint: identity.hash, inputFileCount: identity.files.length, cacheOutputHash: generated.hash,
      outputHash: step.evidenceOutputs ? outputIdentity(cwd, step.evidenceOutputs).hash : generated.hash, runId: id };
  }
  notify(null, 'started');
  while (pending.size || running.size) {
    let advanced = false;
    for (const [stepId, step] of [...pending]) {
      const dependencies = step.requires ?? [];
      if ([...dependencies, ...step.after ?? []].some(key => !results.has(key))) continue;
      if (signal?.aborted || dependencies.some(key => !successful(results.get(key)))) {
        pending.delete(stepId); advanced = true; results.set(stepId, { id: stepId, name: step.name, diagnostic: !!step.diagnostic, status: signal?.aborted ? 'cancelled' : 'blocked', reason: 'Подготовка не завершена успешно', durationMs: 0 }); continue;
      }
      if (running.size >= jobs) break;
      pending.delete(stepId);
      const promise = perform(step).catch(error => ({ id: stepId, name: step.name, diagnostic: !!step.diagnostic, status: 'error', error: error.message }))
        .then(result => { results.set(stepId, result); running.delete(stepId); report.results = plan.steps.filter(s => results.has(s.id)).map(s => results.get(s.id)); store.save(report); notify(stepId, result.status); });
      running.set(stepId, promise); notify(stepId, 'running');
    }
    if (running.size) await Promise.race(running.values());
    else if (pending.size && !advanced) throw new Error('Unresolvable plan dependencies');
  }
  report.results = plan.steps.map(s => results.get(s.id));
  report.status = classifyRun(report.results);
  const finalMaterial = plan.steps.length ? materialIdentity(root, inputsFor('root')) : { materialSha: null, materialClean: false };
  if (report.materialSha !== finalMaterial.materialSha) { report.status = 'invalidated'; report.error = 'Коммит кандидата изменился во время набора'; }
  report.materialClean &&= finalMaterial.materialClean;
  for (const [key, expected] of Object.entries(sourceInputs)) {
    const now = inputIdentity(roots[key], inputsFor(key)).hash;
    if (now !== expected) { report.status = 'invalidated'; report.error = 'Материал кандидата изменился во время набора'; }
  }
  report.finishedAt = new Date().toISOString(); report.durationMs = Date.parse(report.finishedAt) - Date.parse(report.startedAt);
  report.reportPath = join(directory, 'report.json');
  if (report.status !== 'invalidated') for (const result of report.results) {
    const step = plan.steps.find(item => item.id === result.id);
    store.remember(result, { root: roots[step.cwd ?? 'root'], step });
  }
  store.save(report); notify(null, report.status); return report;
}
