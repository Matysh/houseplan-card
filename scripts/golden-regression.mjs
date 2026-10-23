#!/usr/bin/env node
// Full dev diagnostics may contain declared pending changes. Release proof may not.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { selectedGoldenPassed } from './browser-selected.mjs';
import { readPendingVisualIntents } from './task-visual-intent.mjs';
import { isMainModule } from './spawn-portable.mjs';

export function pendingVisualAllowed(env = process.env) {
  return env.REF_NAME === 'dev' && String(env.CANDIDATE_INPUT) !== 'true'
    && !/^Release:\s*\S+/m.test(env.HEAD_MESSAGE || '');
}

export function judgePendingGolden(report, pending, sceneIds = GOLDEN_SCENARIOS.map(s => s.id)) {
  const results = report?.results;
  if (!Array.isArray(results) || results.length !== sceneIds.length
    || new Set(results.map(r => r.id)).size !== sceneIds.length
    || results.some(r => !sceneIds.includes(r.id)))
    return { success: false, pendingVisual: false, reason: 'incomplete full golden matrix' };
  const invalid = results.filter(result => !selectedGoldenPassed({ ...report, results: [result] }, result.id, pending.golden));
  if (invalid.length) return { success: false, pendingVisual: false,
    reason: `undeclared or invalid golden changes: ${invalid.map(r => r.id).join(', ')}` };
  return { success: true, pendingVisual: report.baselineManifest?.valid !== true || results.some(r => r.status !== 'passed'),
    reason: 'complete dev matrix; declared pending images still require beta acceptance' };
}

export function runGoldenRegression({ root = process.cwd(), env = process.env,
  run = args => spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' }),
  pending = () => readPendingVisualIntents({ root }),
  report = () => JSON.parse(readFileSync(join(root, 'artifacts/golden/golden-report.json'), 'utf8')),
  sceneIds = GOLDEN_SCENARIOS.map(s => s.id) } = {}) {
  const intent = pendingVisualAllowed(env) ? pending() : null;
  const hasBaselines = existsSync(join(root, 'demo/golden/baselines/baselines-index.json'));
  const diagnostic = Boolean(intent?.golden.length);
  const child = run(['demo/golden/run.mjs', `--mode=${diagnostic || !hasBaselines ? 'capture' : 'verify'}`]);
  if (child.status !== 0 || child.error || child.signal)
    return { success: false, pendingVisual: false, hasBaselines, reason: 'golden runner failed' };
  if (!diagnostic) return { success: true, pendingVisual: false, hasBaselines, reason: 'strict golden execution' };
  return { ...judgePendingGolden(report(), intent, sceneIds), hasBaselines };
}

if (isMainModule(import.meta.url)) {
  const result = runGoldenRegression();
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `has_baselines=${result.hasBaselines}\npending_visual=${result.pendingVisual}\n`);
  console.log(JSON.stringify(result));
  process.exitCode = result.success ? 0 : 1;
}
