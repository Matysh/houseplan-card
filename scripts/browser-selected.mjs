#!/usr/bin/env node
// #983: run bounded progress checks without issuing a full-matrix receipt.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { isMainModule } from './spawn-portable.mjs';
import { browserPlanExecution } from './browser-plan-proof.mjs';

export function validateSelectedPlan(plan, { sceneIds = GOLDEN_SCENARIOS.map(s => s.id), root = process.cwd() } = {}) {
  if (plan?.schema !== 1 || !['push', 'task'].includes(plan.scope)) throw Error('invalid selected browser plan');
  browserPlanExecution(plan, {});
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

export function selectedGoldenPassed(report, id, intent = []) {
  if (report?.results?.length !== 1 || report.results[0].id !== id || report.results[0].error
    || !/^[a-f0-9]{64}$/.test(report.results[0].actualSha256 || '') || !report.chromium || !report.buildFingerprint) return false;
  if (!Array.isArray(intent)) return false;
  const result = report.results[0], expectations = new Set(intent.filter(item => item?.id === id).map(item => item.expectation));
  if (expectations.size > 1 || [...expectations].some(value => !['change', 'new', 'unchanged'].includes(value))) return false;
  const expectation = [...expectations][0];
  if (result.status === 'missing-baseline') return expectation === 'new';
  if (expectation === 'new') return false;
  // A new, pending scene can make the complete index stale. The capture runner
  // still validates this selected existing PNG's hash before comparing it.
  if (!report.baselineManifest?.present || report.baselineManifest.chromium !== report.chromium
    || !/^[a-f0-9]{64}$/.test(result.baselineSha256 || '')) return false;
  if (expectation === 'unchanged') return result.status === 'passed'
    && result.actualSha256 === result.baselineSha256 && result.differingPixels === 0 && result.diffRatio === 0;
  return result.status === 'passed' || result.status === 'different' && expectation === 'change';
}

export function preserveSelectedGolden(root, id, report) {
  const directory = join(root, 'artifacts/browser-selected/golden');
  mkdirSync(join(directory, 'actual'), { recursive: true });
  const source = join(root, 'artifacts/golden/actual', `${id}.png`);
  if (createHash('sha256').update(readFileSync(source)).digest('hex') !== report.results[0].actualSha256)
    throw Error(`Selected golden artifact changed: ${id}`);
  copyFileSync(source, join(directory, 'actual', `${id}.png`));
  const diff = join(root, 'artifacts/golden/diff', `${id}.png`);
  if (report.results[0].diff && existsSync(diff)) {
    mkdirSync(join(directory, 'diff'), { recursive: true });
    copyFileSync(diff, join(directory, 'diff', `${id}.png`));
  }
  writeFileSync(join(directory, `${id}.json`), JSON.stringify(report, null, 2) + '\n');
}

export function runSelected(plan, { root = process.cwd(), run = (args) => spawnSync(process.execPath, args,
  { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 16 * 1024 * 1024 }),
  report = () => JSON.parse(readFileSync(join(root, 'artifacts/golden/golden-report.json'), 'utf8')),
  prepare = () => rmSync(join(root, 'artifacts/golden/golden-report.json'), { force: true }),
  preserve = (id, captured) => preserveSelectedGolden(root, id, captured),
  log = console.log } = {}) {
  validateSelectedPlan(plan, { root });
  const results = [];
  for (const kind of ['smoke', 'golden']) {
    if (plan[kind].mode !== 'selected') continue;
    for (const id of plan[kind].ids) {
      // The canonical runner retains every scene's semantic assertions. Only
      // declared pixel deltas/new frames may pass task scope; no baseline writes.
      const args = kind === 'smoke' ? [`demo/${id}`]
        : ['demo/golden/run.mjs', '--mode=capture', `--scenario=${id}`];
      if (kind === 'golden') prepare();
      const child = run(args);
      let passed = child.status === 0 && !child.signal && !child.error;
      let captured = null, captureError = null;
      if (kind === 'golden') {
        try {
          captured = report();
          passed = passed && selectedGoldenPassed(captured, id, plan.golden.intent);
          if (captured.results?.[0]?.actualSha256) preserve(id, captured);
        } catch (error) { passed = false; captureError = String(error); }
      }
      const result = { kind, id, status: passed ? 'passed' : 'failed',
        ...(captureError ? { error: captureError } : {}),
        ...(captured ? { evidence: { capture: captured.capture, chromium: captured.chromium,
          buildFingerprint: captured.buildFingerprint, matrixVersion: captured.matrixVersion,
          actualSha256: captured.results?.[0]?.actualSha256,
          baselineStatus: captured.results?.[0]?.status,
          intent: plan.golden.intent?.filter(item => item.id === id) || [],
          differingPixels: captured.results?.[0]?.differingPixels, diffRatio: captured.results?.[0]?.diffRatio } } : {}) };
      results.push(result);
      log(`${result.status} ${kind} ${id}`);
      if (!passed) log(`${child.stdout || ''}${child.stderr || ''}${child.error || ''}${captureError || ''}`);
    }
  }
  return { schema: 1, scope: plan.scope === 'task' ? 'task' : 'selected-progress', results, outcome: results.length
    && results.every(r => r.status === 'passed') ? 'success' : 'failure' };
}

if (isMainModule(import.meta.url)) {
  const plan = JSON.parse(process.env.BROWSER_PLAN || 'null');
  rmSync('artifacts/browser-selected', { recursive: true, force: true });
  const result = runSelected(plan);
  mkdirSync('artifacts/browser-selected', { recursive: true });
  writeFileSync('artifacts/browser-selected/report.json', JSON.stringify(result, null, 2) + '\n');
  process.exitCode = result.outcome === 'success' ? 0 : 1;
}
