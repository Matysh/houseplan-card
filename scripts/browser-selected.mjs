#!/usr/bin/env node
// #983: run bounded progress checks without issuing a full-matrix receipt.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { isMainModule } from './spawn-portable.mjs';

export function validateSelectedPlan(plan, { sceneIds = GOLDEN_SCENARIOS.map(s => s.id), root = process.cwd() } = {}) {
  if (plan?.schema !== 1 || plan.scope !== 'push') throw Error('invalid selected browser plan');
  for (const kind of ['smoke', 'golden']) {
    const entry = plan[kind];
    if (!entry || !['none', 'selected', 'full'].includes(entry.mode) || !Array.isArray(entry.ids)
      || new Set(entry.ids).size !== entry.ids.length) throw Error(`invalid ${kind} selection`);
    if (entry.mode === 'selected' && !entry.ids.length) throw Error(`empty ${kind} selection`);
    for (const id of entry.ids) {
      if (typeof id !== 'string' || (kind === 'golden' ? !sceneIds.includes(id)
        : !/^smoke_[\w-]+\.mjs$/.test(id) || !existsSync(join(root, 'demo', id)))) throw Error(`unknown ${kind} input: ${id}`);
    }
  }
  return plan;
}

export function selectedGoldenPassed(report, id) {
  return report?.baselineManifest?.valid === true && report.results?.length === 1
    && report.results[0].id === id && report.results[0].status === 'passed';
}

export function runSelected(plan, { root = process.cwd(), run = (args) => spawnSync(process.execPath, args,
  { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 }),
  report = () => JSON.parse(readFileSync(join(root, 'artifacts/golden/golden-report.json'), 'utf8')),
  prepare = () => rmSync(join(root, 'artifacts/golden/golden-report.json'), { force: true }),
  log = console.log } = {}) {
  validateSelectedPlan(plan, { root });
  const results = [];
  for (const kind of ['smoke', 'golden']) {
    if (plan[kind].mode !== 'selected') continue;
    for (const id of plan[kind].ids) {
      // The capture runner keeps its canonical full verify guard. A selected
      // capture is judged here against the existing baseline, never accepted.
      const args = kind === 'smoke' ? [`demo/${id}`]
        : ['demo/golden/run.mjs', '--mode=capture', `--scenario=${id}`];
      if (kind === 'golden') prepare();
      const child = run(args);
      let passed = child.status === 0 && !child.signal && !child.error;
      let captured = null;
      if (passed && kind === 'golden') {
        try { captured = report(); passed = selectedGoldenPassed(captured, id); } catch { passed = false; }
      }
      const result = { kind, id, status: passed ? 'passed' : 'failed',
        ...(captured ? { evidence: { capture: captured.capture, chromium: captured.chromium,
          buildFingerprint: captured.buildFingerprint, matrixVersion: captured.matrixVersion,
          actualSha256: captured.results?.[0]?.actualSha256,
          differingPixels: captured.results?.[0]?.differingPixels, diffRatio: captured.results?.[0]?.diffRatio } } : {}) };
      results.push(result);
      log(`${result.status} ${kind} ${id}`);
      if (!passed) log(`${child.stdout || ''}${child.stderr || ''}${child.error || ''}`);
    }
  }
  return { schema: 1, scope: 'selected-progress', results, outcome: results.length
    && results.every(r => r.status === 'passed') ? 'success' : 'failure' };
}

if (isMainModule(import.meta.url)) {
  const plan = JSON.parse(process.env.BROWSER_PLAN || 'null');
  const result = runSelected(plan);
  mkdirSync('artifacts/browser-selected', { recursive: true });
  writeFileSync('artifacts/browser-selected/report.json', JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.outcome === 'success' ? 0 : 1;
}
