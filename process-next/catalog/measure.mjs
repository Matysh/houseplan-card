import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { cpus, release } from 'node:os';
import { digest, readJson, writeJson } from '../lib/storage.mjs';
import { collectMeasurement, compareMeasurements, renderMetrics } from '../lib/metrics.mjs';

const benchmark = ({ root, performancePath }) => execFileSync(process.execPath,
  ['demo/benchmark_large_house.mjs', '--profile=large-house-v1', '--warmups=1', '--samples=7', `--output=${performancePath}`], { cwd: root, stdio: 'inherit' });

/** A measurement problem remains a diagnostic result, not a missing beta report.
 * Invalid candidate evidence never becomes a stored reference measurement.
 */
export function runMeasurements({ root = process.cwd(), requestPath, executeBenchmark = benchmark } = {}) {
  const request = requestPath ? readJson(resolve(root, requestPath), {}) : {}, output = join(root, 'artifacts', 'process-next');
  const latestPath = request.latestStable ? resolve(root, request.latestStable) : null;
  if (latestPath && (latestPath === output || latestPath.startsWith(output + sep))) throw Error('Keep the stable reference outside current candidate outputs');
  const latestStable = latestPath ? readJson(latestPath) : null;
  const packageInfo = readJson(join(output, 'package.json'));
  if (!packageInfo?.sourceSha) throw Error('Prepare the identified release package first');
  const performancePath = join(output, 'performance.json'), measurementPath = join(output, 'measurement.json');
  // Never pick up an earlier candidate's outputs after a failed fresh attempt.
  for (const file of [performancePath, measurementPath, join(output, 'metrics.json'), join(output, 'metrics.md')]) rmSync(file, { force: true });
  const diagnostics = []; let performance = null, measurement = null, evidenceStatus;
  try {
    executeBenchmark({ root, performancePath });
    performance = readJson(performancePath);
    if (!performance) diagnostics.push('Браузерный замер не создал отчёт');
  } catch (error) { diagnostics.push(`Браузерный замер недоступен: ${error.message}`); }
  const host = { ...request.host, power_scheme: request.host?.power_scheme || 'unrecorded', cpu: cpus()[0]?.model, linux: `${process.platform} ${release()}` };
  try {
    measurement = collectMeasurement({ zip: packageInfo.zip, performance, host,
      runnerHash: digest(readFileSync(join(root, 'demo', 'benchmark_large_house.mjs'))), release: packageInfo.version, sourceSha: packageInfo.sourceSha });
    diagnostics.push(...measurement.diagnostics);
    evidenceStatus = diagnostics.length ? 'incomplete' : measurement.measurement_status;
    measurement = { ...measurement, measurement_status: evidenceStatus, diagnostics };
    writeJson(measurementPath, measurement); // Partial snapshots explicitly retain only available factual measurements.
  } catch (error) {
    evidenceStatus = 'invalid';
    diagnostics.push(`Недействительные данные замера: ${error.message}`);
  }
  const comparison = { ...compareMeasurements(measurement ?? { source_sha: packageInfo.sourceSha }, latestStable), evidenceStatus, diagnostics };
  writeJson(join(output, 'metrics.json'), comparison);
  writeFileSync(join(output, 'metrics.md'), renderMetrics(comparison));
  return { measurement, comparison, evidenceStatus };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = runMeasurements({ requestPath: process.argv[2] });
    console.log(renderMetrics(result.comparison));
    // The step is diagnostic. Missing evidence is visible as a failed/incomplete measurement,
    // while its saved report lets release policy distinguish it from confirmed regression.
    if (result.evidenceStatus !== 'complete') process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
