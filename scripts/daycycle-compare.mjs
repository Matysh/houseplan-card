#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { compareDaycycleReports } from '../demo/helpers/daycycle-analysis.mjs';

const readReport = path => {
  const bytes = readFileSync(path);
  const json = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  return JSON.parse(json.toString('utf8'));
};

export function compareDaycycleFiles(left, right, { summary = false } = {}) {
  if (!left || !right) throw new Error('usage: node scripts/daycycle-compare.mjs LEFT.json RIGHT.json');
  const comparison = compareDaycycleReports(readReport(left), readReport(right));
  if (!summary) return comparison;
  return { schema: comparison.schema, matching: comparison.matching,
    // A compact VIEW of every sample; complete evidence stays in the input files.
    reports: [comparison.left, comparison.right].map(report => ({
      materialSha: report.materialSha, materialTree: report.materialTree, verdict: report.originalVerdict,
      resources: report.diagnosticEnvironment?.resources ?? null,
      gpu: { status: report.diagnosticEnvironment?.gpu?.status ?? 'unavailable',
        renderer: report.diagnosticEnvironment?.gpu?.data?.auxAttributes?.glRenderer ?? null },
      samples: report.samples.map(sample => ({ mode: sample.mode, round: sample.round, status: sample.status,
        inputMedianMs: sample.inputIntervalMs?.median ?? null, rafCallbacks: sample.rafCallbacks ?? null,
        outlineViewBoxWrites: sample.outlineViewBoxWrites ?? null, planViewBoxWrites: sample.planViewBoxWrites ?? null,
        rasterTasks: sample.rasterTasks, rasterElapsedMs: sample.rasterElapsedMs ?? null,
        observationOverheadMs: sample.observationOverheadMs ?? null,
        clockAlignment: sample.clockAlignment ?? 'unavailable', rasterCpuClock: sample.rasterCpuClock ?? 'unavailable' })),
    })), limitations: comparison.left.limitations };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), paths = args.filter(arg => arg !== '--summary');
  if (paths.length !== 2 || paths.some(path => path.startsWith('--')))
    throw new Error('usage: node scripts/daycycle-compare.mjs [--summary] LEFT.json[.gz] RIGHT.json[.gz]');
  console.log(JSON.stringify(compareDaycycleFiles(...paths, { summary: args.includes('--summary') }), null, 2));
}
