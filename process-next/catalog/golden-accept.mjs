#!/usr/bin/env node
// Explicit selected-frame acceptance; never called by a test/release profile.
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GOLDEN_SCENARIOS } from '../../demo/golden/matrix.mjs';
import { prepareGoldenSelection } from './golden-selection.mjs';
import { digest, readJson, within, writeJson } from '../lib/storage.mjs';

const INDEX = 'demo/golden/baselines/baselines-index.json';
const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const hostFor = scene => scene.staticWallOpenings ? 'static' : scene.panelHost ? 'panel' : 'lovelace';
const regular = file => { if (existsSync(file) && !lstatSync(file).isFile()) throw Error(`Expected a regular file: ${file}`); return file; };

/** decision is a reference to the owner's actual review, not a generated approval.
 * Dry-run reads/compares only. No screenshot is regenerated and no unrelated baseline is refreshed.
 */
export function acceptGolden({ root = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), scenes = [],
  report, decision = '', execute = false } = {}) {
  if (!Array.isArray(scenes) || !scenes.length || scenes.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)))
    throw Error('Select explicit scene IDs with --scenes=id,id; no all/wildcard acceptance');
  if (new Set(scenes).size !== scenes.length) throw Error('Duplicate scene IDs');
  if (typeof report !== 'string' || !report.trim()) throw Error('Capture report path required');
  if (typeof decision !== 'string' || /[\x00-\x1f]/.test(decision) || decision.length > 2048) throw Error('Expected an owner decision reference');
  if (execute && !decision.trim()) throw Error('Execution requires --decision=reference to the owner review');
  const rootPath = resolve(root), reportPath = resolve(rootPath, report), reportBytes = readFileSync(reportPath);
  const captured = JSON.parse(reportBytes), known = new Map(prepareGoldenSelection(GOLDEN_SCENARIOS).all.map(scene => [scene.id, scene]));
  if (!Array.isArray(captured.results)) throw Error('Capture report has no results');
  if (!captured.capture?.platform || typeof captured.chromium !== 'string' || !captured.chromium)
    throw Error('Capture report must identify its platform and Chromium');
  if (captured.capture.chromium && captured.capture.chromium !== captured.chromium) throw Error('Capture Chromium identity disagrees with report');
  const sourceSha = captured.sourceSha ?? captured.candidateSha ?? captured.capture.sourceSha ?? captured.capture.ci?.sha ?? null;
  if (sourceSha) {
    if (typeof sourceSha !== 'string' || !/^[a-f0-9]{40,64}$/.test(sourceSha)) throw Error('Invalid captured candidate SHA');
    const currentSha = execFileSync('git', ['-c', 'core.fsmonitor=false', 'rev-parse', '--verify', 'HEAD'], {
      cwd: rootPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' },
    }).trim();
    if (currentSha !== sourceSha) throw Error('Captured candidate differs from current checkout; review the intended candidate first');
  }
  const indexPath = regular(within(rootPath, INDEX)), previous = readJson(indexPath, { schema: 3, scenarios: {} });
  if (!previous.scenarios || typeof previous.scenarios !== 'object' || Array.isArray(previous.scenarios)) throw Error('Invalid baseline index');
  const selected = scenes.map(id => {
    const scenario = known.get(id);
    if (!scenario) throw Error(`Unknown current scene: ${id}`);
    const matches = captured.results.filter(result => result.id === id);
    if (matches.length !== 1) throw Error(`Expected one captured result for ${id}`);
    const result = matches[0], host = hostFor(scenario);
    if (result.error || !['passed', 'different', 'missing-baseline'].includes(result.status)) throw Error(`Cannot accept errored capture: ${id} (${result.status})`);
    if (result.host !== host || result.actualHost !== host) throw Error(`Capture host does not match ${host}: ${id}`);
    if ((result.sourceSceneId ?? id) !== (scenario.sourceSceneId ?? id)) throw Error(`Capture scene source does not match: ${id}`);
    // Locate portable artifact siblings, not the absolute path of the machine that captured them.
    const actualPath = regular(within(dirname(reportPath), `actual/${id}.png`));
    const bytes = readFileSync(actualPath);
    if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw Error(`Not a captured PNG: ${id}`);
    const sha256 = digest(bytes);
    if (sha256 !== result.actualSha256) throw Error(`PNG changed after capture: ${id}`);
    const baselinePath = regular(within(rootPath, `demo/golden/baselines/${id}.png`));
    return { id, host, sourceSceneId: scenario.sourceSceneId ?? id, sha256, previousSha256: previous.scenarios[id] ?? null,
      actualPath, baselinePath, bytes };
  });
  const plan = { dryRun: !execute, decision: decision.trim() || null, report: reportPath, reportSha256: digest(reportBytes), sourceSha,
    selected: selected.map(({ bytes, ...item }) => item),
    warnings: sourceSha ? [] : ['Report has no candidate SHA; no commit identity was inferred.'],
    unchanged: Object.keys(previous.scenarios).filter(id => !scenes.includes(id)).length };
  if (!execute) return plan;
  const acceptedAt = new Date().toISOString();
  const next = { ...previous, scenarios: { ...previous.scenarios }, scenarioProvenance: { ...previous.scenarioProvenance } };
  // All selected captures have been read and verified before the first write.
  for (const item of selected) {
    mkdirSync(dirname(item.baselinePath), { recursive: true });
    writeFileSync(item.baselinePath, item.bytes);
    next.scenarios[item.id] = item.sha256;
    next.scenarioProvenance[item.id] = { acceptedAt, decision: plan.decision, reportSha256: plan.reportSha256,
      sourceSha, sourceFingerprint: captured.buildFingerprint ?? null, matrixVersion: captured.matrixVersion ?? null,
      chromium: captured.chromium, capture: captured.capture, host: item.host, sourceSceneId: item.sourceSceneId };
  }
  // Global fields describe the previous bulk acceptance. Updating them would falsely refresh untouched frames.
  writeJson(indexPath, next);
  return { ...plan, acceptedAt };
}

export function goldenAcceptArguments(argv) {
  const allowed = ['--root=', '--scenes=', '--report=', '--decision='];
  for (const arg of argv) if (arg !== '--execute' && !allowed.some(prefix => arg.startsWith(prefix))) throw Error(`Unknown golden acceptance argument: ${arg}`);
  const value = flag => argv.find(arg => arg.startsWith(`--${flag}=`))?.slice(flag.length + 3);
  return { root: value('root'), scenes: value('scenes')?.split(',').map(id => id.trim()) ?? [], report: value('report'),
    decision: value('decision') ?? '', execute: argv.includes('--execute') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(acceptGolden(goldenAcceptArguments(process.argv.slice(2))), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
