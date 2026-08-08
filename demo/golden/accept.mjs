#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../../scripts/source-fingerprint.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from './matrix.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reviewed = process.argv.includes('--reviewed');
const fromArg = process.argv.find((arg) => arg.startsWith('--from='));
const from = resolve(fromArg ? fromArg.slice('--from='.length) : resolve(ROOT, 'artifacts/golden'));
if (!reviewed) throw new Error('refusing to replace baselines without explicit --reviewed');

const reportPath = resolve(from, 'golden-report.json');
if (!existsSync(reportPath)) throw new Error(`candidate report not found: ${reportPath}`);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (report.matrixVersion !== GOLDEN_MATRIX_VERSION)
  throw new Error(`candidate matrix ${report.matrixVersion} != current ${GOLDEN_MATRIX_VERSION}`);
if (report.buildFingerprint !== sourceFingerprint(ROOT))
  throw new Error('candidate screenshots were not captured from the current frontend source');
if (typeof report.chromium !== 'string' || !report.chromium)
  throw new Error('candidate report does not identify its Chromium build');
if (!Array.isArray(report.results)) throw new Error('candidate report has no scenario results');

const byId = new Map(report.results.map((result) => [result.id, result]));
const baselineRoot = resolve(ROOT, 'demo/golden/baselines');
mkdirSync(baselineRoot, { recursive: true });
const hashes = {};
const candidates = [];
for (const scenario of GOLDEN_SCENARIOS) {
  const result = byId.get(scenario.id);
  const candidate = resolve(from, 'actual', `${scenario.id}.png`);
  if (result?.error || !['missing-baseline', 'passed', 'different'].includes(result?.status))
    throw new Error(`review candidate has an invalid run status: ${scenario.id} (${result?.status || 'missing'})`);
  if (!result?.actualSha256 || !existsSync(candidate))
    throw new Error(`review candidate missing: ${scenario.id}`);
  const bytes = readFileSync(candidate);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== result.actualSha256) throw new Error(`candidate changed after capture: ${scenario.id}`);
  candidates.push({ scenario, candidate });
  hashes[scenario.id] = digest;
}
// Validate the complete set first: a broken report must never leave a half-
// updated baseline directory behind.
for (const { scenario, candidate } of candidates)
  copyFileSync(candidate, resolve(baselineRoot, `${scenario.id}.png`));
writeFileSync(resolve(baselineRoot, 'manifest.json'), `${JSON.stringify({
  schema: 1,
  matrixVersion: GOLDEN_MATRIX_VERSION,
  acceptedAt: new Date().toISOString(),
  sourceFingerprint: report.buildFingerprint,
  chromium: report.chromium,
  scenarios: hashes,
}, null, 2)}\n`, 'utf8');
console.log(`Accepted ${GOLDEN_SCENARIOS.length} reviewed golden baselines.`);
