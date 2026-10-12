#!/usr/bin/env node
// Native evidence is not owner field acceptance. No helper/private gesture calls here.
import { spawnSync } from 'node:child_process';
import { attestStandardLaunch, requirePinnedBrowser } from './browser-attestation.mjs';
import { candidateInputs, digest, NATIVE_PROFILES } from './candidate-readiness.mjs';
import { isMainModule } from './spawn-portable.mjs';
export function judgeNativeOutput(script, result) {
  const text = result.stdout || '';
  if (result.error || result.status !== 0 || !/^OK\s*$/m.test(text)) return { pass: false, reason: 'failed/incomplete/timeout native process' };
  if (script.endsWith('smoke_wall_node_topology.mjs')) {
    if (!/"cycles":\s*100/.test(text) || !/"scenarios":\s*[1-9]\d*/.test(text)) return { pass: false, reason: 'topology cycle oracle missing' };
    return { pass: true, observed: 'native T/X scenarios and 100 Esc/Undo cycles completed' };
  }
  const line = text.split('\n').find(l => l.startsWith('HP_SMOKE_CHECKS '));
  let checks;
  try { checks = JSON.parse(line?.slice(16)); } catch { return { pass: false, reason: 'observable check inventory missing' }; }
  const ordinary = script.endsWith('smoke_wall_node_move.mjs')
    ? ['committed geometry equals the visible preview', 'Undo restores exact starting catalogue/openings']
    : ['flatMouseRightEdge', 'kioskTouchRightEdge', 'isoTouchZoomOut'];
  if (!Array.isArray(checks) || ordinary.some(name => !checks.some(c => c.includes(name)))) return { pass: false, reason: 'ordinary/risky-neighbour oracle missing' };
  return { pass: true, observed: checks.join('; ') };
}
export async function runCandidateNative({ input = candidateInputs(), profiles = ['geometry', 'view'], execute = spawnSync,
  attest = attestStandardLaunch, root = process.cwd() } = {}) {
  if (!profiles.length || profiles.some(p => !NATIVE_PROFILES[p])) throw Error('known native profiles required');
  const environment = await attest({ reason: '#858 candidate-native' });
  const scripts = [...new Set(profiles.flatMap(p => NATIVE_PROFILES[p].map(c => c.script)))];
  const outputs = new Map(scripts.map(script => {
    const result = execute(process.execPath, ['scripts/candidate-native.mjs', `--script=${script}`], { cwd: root, env: { ...process.env, HP_SMOKE_CHECKS: '1' },
      encoding: 'utf8', timeout: 180_000, maxBuffer: 2 * 1024 * 1024 });
    return [script, { ...judgeNativeOutput(script, result), script, scriptHash: input.scripts[script],
      nativeOutput: digest((result.stdout || '') + (result.stderr || '')), stdout: result.stdout, stderr: result.stderr }];
  }));
  const cases = profiles.flatMap(p => NATIVE_PROFILES[p]).map(c => ({ id: c.id, oracle: c.oracle, ...outputs.get(c.script) }));
  return { schema: 1, sha: input.sha, tree: input.tree, bundle: input.manifest, pins: input.pins,
    environment: { node: process.version, platform: process.platform, arch: process.arch, browser: environment.actual },
    cases, pass: cases.every(c => c.pass), ownerAcceptance: false };
}
if (isMainModule(import.meta.url)) {
  try {
    const script = process.argv.find(a => a.startsWith('--script='))?.slice(9);
    if (script) {
      if (!Object.values(NATIVE_PROFILES).flat().some(c => c.script === script)) throw Error('unknown native script');
      requirePinnedBrowser('#858 candidate native scene');
      await import(new URL(`../${script}`, import.meta.url));
    } else {
    const profiles = process.argv.find(a => a.startsWith('--profiles='))?.slice(11).split(',');
    const result = await runCandidateNative({ ...(profiles ? { profiles } : {}) });
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
    }
  } catch (error) { console.error(String(error?.message || error)); process.exitCode = 1; }
}
