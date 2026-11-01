import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, sep } from 'node:path';
import { cpus, release } from 'node:os';
import { digest, readJson, writeJson } from '../lib/storage.mjs';
import { collectMeasurement, compareMeasurements, renderMetrics } from '../lib/metrics.mjs';

const requestPath = process.argv[2];
if (!requestPath) throw Error('Measurement request JSON required (latestStable, host/power_scheme)');
const request = readJson(resolve(requestPath)), root = process.cwd(), output = join(root, 'artifacts', 'process-next');
if (!request?.latestStable || !request?.host?.power_scheme) throw Error('Latest stable measurement and power scheme required');
const latestPath = resolve(root, request.latestStable);
if (latestPath === output || latestPath.startsWith(output + sep)) throw Error('Keep the stable reference outside current candidate outputs');
const latestStable = readJson(latestPath);
if (!latestStable) throw Error('Latest stable reference is missing');
const packageInfo = readJson(join(output, 'package.json'));
if (!packageInfo) throw Error('Prepare the actual release package first');
const performancePath = join(output, 'performance.json');
execFileSync(process.execPath, ['demo/benchmark_large_house.mjs', '--profile=large-house-v1', '--warmups=1', '--samples=7', `--output=${performancePath}`], { cwd: root, stdio: 'inherit' });
const host = { cpu: cpus()[0]?.model, linux: `${process.platform} ${release()}`, ...request.host };
const measurement = collectMeasurement({ zip: packageInfo.zip, performance: readJson(performancePath), host,
  runnerHash: digest(readFileSync(join(root, 'demo', 'benchmark_large_house.mjs'))), release: packageInfo.version, sourceSha: packageInfo.sourceSha });
writeJson(join(output, 'measurement.json'), measurement);
const comparison = compareMeasurements(measurement, latestStable);
writeJson(join(output, 'metrics.json'), comparison); writeFileSync(join(output, 'metrics.md'), renderMetrics(comparison));
console.log(renderMetrics(comparison));
// Measuring is successful even if policy requires a decision. Publication consumes the report.
// Missing/incomparable/noisy data is explicitly incomplete, never a valid green report.
if (comparison.needsMeasurement) process.exitCode = 2;
