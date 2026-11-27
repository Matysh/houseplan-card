import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpus, release, tmpdir } from 'node:os';
import { digest, readJson, writeJson } from '../lib/storage.mjs';
import { collectMeasurement, collectTiming, compareMeasurements, renderMetrics } from '../lib/metrics.mjs';

function prepareBaseline({ root, tag }) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw Error('Последний stable должен быть указан точным тегом');
  const directory = mkdtempSync(join(tmpdir(), 'houseplan-stable-benchmark-'));
  const run = (command, args, cwd = directory) => execFileSync(command, args, {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const ref = 'refs/tags/' + tag;
  const clean = () => rmSync(directory, { recursive: true, force: true });
  try {
    let repository = root;
    try { run('git', ['rev-parse', '--verify', ref + '^{commit}'], root); }
    catch { repository = run('git', ['remote', 'get-url', 'origin'], root); }
    run('git', ['init', '--quiet']);
    run('git', ['fetch', '--quiet', '--no-tags', '--depth=1', repository, ref]);
    run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD']);
    const sourceSha = run('git', ['rev-parse', 'HEAD']);
    if ('v' + readJson(join(directory, 'package.json')).version !== tag) throw Error('Версия исходников не совпадает с тегом stable');
    const npm = (...args) => execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npm',
      process.platform === 'win32' ? ['/d', '/c', 'npm', ...args] : args,
      { cwd: directory, stdio: 'inherit' });
    npm('ci', '--ignore-scripts', '--no-audit', '--no-fund');
    npm('run', 'build');
    execFileSync(process.execPath, ['scripts/bundle-sync.mjs'], { cwd: directory, stdio: 'inherit' });
    return { root: directory, sourceSha, buildFingerprint: readJson(join(directory, 'dist', 'houseplan-assets.json')).fingerprint, clean };
  } catch (error) {
    clean();
    throw error;
  }
}

const benchmark = ({ root, targetRoot, performancePath, diagnostics }) => {
  const run = (profile, output) => execFileSync(process.execPath, ['demo/benchmark_large_house.mjs',
    `--profile=${profile}`, '--warmups=1', '--samples=7', `--target-root=${targetRoot}`, `--output=${output}`],
  { cwd: root, stdio: 'inherit' });
  run('large-house-v1', performancePath);
  if (!diagnostics) return;
  const performance = readJson(performancePath), webglPath = performancePath + '.webgl.json';
  try {
    rmSync(webglPath, { force: true });
    run('large-house-isometric-v1', webglPath);
    const webgl = readJson(webglPath);
    if (!webgl || webgl.sourceSha !== performance.sourceSha || webgl.buildFingerprint !== performance.buildFingerprint) throw Error('WebGL report is from another candidate');
    performance.webglDiagnostics = { ...webgl, status: 'measured', diagnostic: true };
  } catch (error) {
    performance.webglDiagnostics = { status: 'unavailable', diagnostic: true, reason: error.message };
  }
  writeJson(performancePath, performance);
};

function measureHost(supplied) {
  let power = supplied?.power_scheme;
  if (process.platform === 'win32' || /microsoft/i.test(release())) {
    try {
      const observed = execFileSync('powercfg.exe', ['/getactivescheme'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
      const guid = observed.match(/[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}/i)?.[0];
      if (guid) power = guid;
    } catch { /* Keep the supplied host observation when powercfg is unavailable. */ }
  }
  return { ...supplied, power_scheme: power || 'unrecorded', cpu: cpus()[0]?.model, linux: `${process.platform} ${release()}` };
}

/** Invalid candidate evidence never becomes a stored reference measurement.
 * Failure to rebuild the previous release does not discard candidate sizes.
 */
export function runMeasurements({ root = process.cwd(), requestPath, executeBenchmark = benchmark,
  buildBaseline = prepareBaseline, readHost = measureHost } = {}) {
  const request = requestPath ? readJson(resolve(root, requestPath), {}) : {}, output = join(root, 'artifacts', 'process-next');
  const latestPath = request.latestStable ? resolve(root, request.latestStable) : null;
  if (latestPath && (latestPath === output || latestPath.startsWith(output + sep))) throw Error('Keep the stable reference outside current candidate outputs');
  const latestStable = latestPath ? readJson(latestPath, null) : null;
  const packageInfo = readJson(join(output, 'package.json'));
  if (!packageInfo?.sourceSha) throw Error('Prepare the identified release package first');
  const tag = readJson(join(root, 'docs', 'release-ledger', 'cycle.json'), {})?.baseStable;
  const performancePath = join(output, 'performance.json'), measurementPath = join(output, 'measurement.json');
  for (const file of [performancePath, measurementPath, join(output, 'metrics.json'), join(output, 'metrics.md')]) rmSync(file, { force: true });
  const runnerHash = digest(readFileSync(join(root, 'demo', 'benchmark_large_house.mjs')));
  const diagnostics = [];
  let timingBaseline = null, baseline, performance = null, measurement = null, evidenceStatus;
  try {
    if (!tag) throw Error('В текущем цикле выпуска не указан тег предыдущего stable');
    baseline = buildBaseline({ root, tag });
    const stablePath = join(baseline.root, 'paired-performance.json');
    const host = readHost(request.host);
    executeBenchmark({ root, targetRoot: baseline.root, performancePath: stablePath, diagnostics: false });
    timingBaseline = collectTiming({ performance: readJson(stablePath), host, runnerHash, release: tag,
      sourceSha: baseline.sourceSha, buildFingerprint: baseline.buildFingerprint });
    diagnostics.push(...timingBaseline.diagnostics.map(reason => tag + ': ' + reason));
  } catch (error) { diagnostics.push(`Парный замер stable недоступен: ${error.message}`); }
  finally { baseline?.clean(); }

  const host = readHost(request.host);
  try {
    executeBenchmark({ root, targetRoot: root, performancePath, diagnostics: true });
    performance = readJson(performancePath);
    if (!performance) diagnostics.push('Браузерный замер не создал отчёт');
  } catch (error) { diagnostics.push(`Браузерный замер недоступен: ${error.message}`); }
  try {
    measurement = collectMeasurement({ zip: packageInfo.zip, performance, host,
      runnerHash, release: packageInfo.version, sourceSha: packageInfo.sourceSha });
    diagnostics.push(...measurement.diagnostics);
    evidenceStatus = diagnostics.length ? 'incomplete' : measurement.measurement_status;
    measurement = { ...measurement, timing_baseline: timingBaseline, measurement_status: evidenceStatus, diagnostics };
    writeJson(measurementPath, measurement);
  } catch (error) {
    evidenceStatus = 'invalid';
    diagnostics.push(`Недействительные данные замера: ${error.message}`);
  }
  const sizeReference = !tag || ('v' + (latestStable?.release ?? '').replace(/^v/, '')) === tag
    ? latestStable : null;
  const comparison = { ...compareMeasurements(measurement ?? { source_sha: packageInfo.sourceSha }, sizeReference,
    undefined, { timingReference: timingBaseline }), evidenceStatus, diagnostics };
  writeJson(join(output, 'metrics.json'), comparison);
  writeFileSync(join(output, 'metrics.md'), renderMetrics(comparison));
  return { measurement, comparison, evidenceStatus };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = runMeasurements({ requestPath: process.argv[2] });
    console.log(renderMetrics(result.comparison));
    if (result.evidenceStatus !== 'complete') process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
