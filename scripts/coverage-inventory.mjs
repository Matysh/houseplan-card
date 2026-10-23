// Computed diagnostic scope, deliberately independent of task/release gates.
import { readFileSync, readdirSync } from 'node:fs';
import { unitGroups } from './unit-groups.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { digestBytes } from './coverage-identity.mjs';

export function coverageInventory(root = process.cwd()) {
  const unit = unitGroups(root).product.map(path => ({ id: `unit:${path}`, family: 'unit', script: path,
    args: ['--test', path], timeoutMs: 120000 }));
  const smoke = readdirSync(`${root}/demo`).filter(p => /^smoke_.*\.mjs$/.test(p)).sort()
    .map(path => ({ id: `smoke:demo/${path}`, family: 'smoke', script: `demo/${path}`,
      args: [`demo/${path}`], timeoutMs: 120000 }));
  const golden = GOLDEN_SCENARIOS.map(scenario => ({ id: `golden:${scenario.id}`, family: 'golden',
    script: 'demo/golden/run.mjs', scenario: scenario.id, variant: scenario,
    args: ['demo/golden/run.mjs', '--mode=capture', `--scenario=${scenario.id}`], timeoutMs: 120000 }));
  const directOwners = readdirSync(`${root}/demo`).filter(p => p.endsWith('.mjs'))
    .filter(p => /chromium\.(?:launch|connect)|browser\.newPage|context\.newPage/.test(readFileSync(`${root}/demo/${p}`, 'utf8')))
    .map(p => `demo/${p}`);
  const cases = [...unit, ...smoke, ...golden];
  return { matrixVersion: GOLDEN_MATRIX_VERSION, cases, counts: { unit: unit.length, smoke: smoke.length, golden: golden.length },
    digest: digestBytes(JSON.stringify(cases)), directOwners,
    excludedOwners: directOwners.filter(p => !smoke.some(c => c.script === p)),
    recorder: 'process preload wraps Chromium launch/connect, each context/page, navigation checkpoints and close; no serve-only hook' };
}
