// Computed diagnostic scope, deliberately independent of task/release gates.
import { readFileSync, readdirSync } from 'node:fs';
import { discoverReleaseTests } from '../process-next/lib/catalog.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { prepareGoldenSelection } from '../process-next/catalog/golden-selection.mjs';
import { digestBytes } from './coverage-identity.mjs';

export function coverageInventory(root = process.cwd()) {
  const smokeRunner = 'scripts/coverage-inventory.mjs';
  const smokeTimeoutMs = 120000;
  const product = discoverReleaseTests(root);
  const unit = product.filter(row => row.kind === 'product').map(({ path }) => ({ id: `unit:${path}`, family: 'unit', script: path,
    args: ['--test', path], timeoutMs: 120000 }));
  const smoke = product.filter(row => row.kind === 'browser').map(({ path }) => ({ id: `smoke:${path}`, family: 'smoke', script: path,
    args: [path], timeoutMs: smokeTimeoutMs }));
  const golden = prepareGoldenSelection(GOLDEN_SCENARIOS).all.map(scenario => ({ id: `golden:${scenario.id}`, family: 'golden',
    script: 'process-next/catalog/golden-runner.mjs', scenario: scenario.id, variant: scenario,
    args: ['process-next/catalog/golden-runner.mjs', '--mode=capture', `--scenario=${scenario.id}`], timeoutMs: 120000 }));
  const directOwners = readdirSync(`${root}/demo`).filter(p => p.endsWith('.mjs'))
    .filter(p => /chromium\.(?:launch|connect)|browser\.newPage|context\.newPage/.test(readFileSync(`${root}/demo/${p}`, 'utf8')))
    .map(p => `demo/${p}`);
  const cases = [...unit, ...smoke, ...golden];
  return { matrixVersion: GOLDEN_MATRIX_VERSION, cases, counts: { unit: unit.length, smoke: smoke.length, golden: golden.length },
    digest: digestBytes(JSON.stringify(cases)), directOwners,
    smokeTimeout: { source: smokeRunner, milliseconds: smokeTimeoutMs },
    excludedOwners: directOwners.filter(p => !smoke.some(c => c.script === p)),
    recorder: 'process preload wraps Chromium launch/connect, each context/page, navigation checkpoints and close; no serve-only hook' };
}
