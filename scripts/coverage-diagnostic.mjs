#!/usr/bin/env node
// #1018: standalone diagnostic, never imported by gate/CI-proof/release code.
import { spawn, execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { coverageInventory } from './coverage-inventory.mjs';
import { COVERAGE_SCHEMA, digestBytes, indexGeneratedFiles, inside, materialIdentity, slash, walkFiles } from './coverage-identity.mjs';
import { buildCoverageReport, coverageMarkdown } from './coverage-report.mjs';
import { pinsFromSources } from './toolchain-pins.mjs';
import { isMainModule } from './spawn-portable.mjs';
import { historicalCandidates, auditMarkdown } from './parallel-path-audit.mjs';

export async function runInvocation({ root, directory, args, env, timeoutMs, signal, script, id, family }) {
  mkdirSync(directory, { recursive: true });
  const output = openSync(resolve(directory, 'stdout.log'), 'w'), error = openSync(resolve(directory, 'stderr.log'), 'w');
  const record = { id, script, family, command: [process.execPath, ...args], started: Date.now(),
    status: 'running', issues: [], directory: slash(relative(env.HP_COVERAGE_ROOT || root, directory)) };
  try {
    await new Promise(done => {
      const child = spawn(process.execPath, args, { cwd: root, env, stdio: ['ignore', output, error],
        detached: process.platform !== 'win32', windowsHide: true });
      const stop = status => {
        if (record.status !== 'running') return;
        record.status = status;
        if (process.platform === 'win32') {
          // Numeric PID is emitted by spawn; no shell or path composition.
          try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } catch { child.kill(); }
        } else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
      };
      const timer = setTimeout(() => stop('timeout'), timeoutMs);
      const abort = () => stop('cancelled'); signal?.addEventListener('abort', abort, { once: true });
      child.on('error', failure => { record.status = 'failed'; record.issues.push({ reason: 'spawn-failed', detail: failure.message }); });
      child.on('close', (code, childSignal) => {
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        record.exitCode = code; record.signal = childSignal;
        if (record.status === 'running') record.status = code === 0 ? 'completed' : 'failed'; done();
      });
      if (signal?.aborted) abort();
    });
  } finally { closeSync(output); closeSync(error); record.ended = Date.now(); record.durationMs = record.ended - record.started; }
  return record;
}

export async function diagnosticRun({ root = process.cwd(), sha, out = 'artifacts/diagnostic-coverage', plan = false } = {}) {
  const inventory = coverageInventory(root), identity = materialIdentity(root);
  if (plan) return { identity, inventory };
  if (!/^[a-f0-9]{40}$/.test(sha || '') || sha !== identity.sha) throw Error('Pass --sha=<exact current 40-character candidate SHA>');
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim();
  if (dirty) throw Error('Diagnostic witness requires a clean candidate checkout; commit the material first');
  const artifactDir = inside(root, out);
  if (!slash(relative(root, artifactDir)).startsWith('artifacts/')) throw Error('Diagnostic output must be inside ignored artifacts/');
  if (existsSync(artifactDir)) throw Error('Use a fresh diagnostic output directory; do not overwrite a witness');
  mkdirSync(artifactDir, { recursive: true });
  const save = (name, value) => writeFileSync(inside(artifactDir, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  const state = { schema: COVERAGE_SCHEMA, authority: 'diagnostic-only', semanticApproval: false,
    identity, pins: pinsFromSources(), inventory, invocations: [], builds: [], issues: [], started: Date.now() };
  save('run.json', state); save('inventory.json', inventory);
  const controller = new AbortController(), cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  const totalTimer = setTimeout(cancel, 75 * 60 * 1000); totalTimer.unref();
  const env = { ...process.env, HP_DIAGNOSTIC_COVERAGE: '1' };
  const normal = { ...process.env }; delete normal.HP_DIAGNOSTIC_COVERAGE;
  let index = { identity, files: [], issues: [{ reason: 'build-not-complete' }] }, normalManifest;
  const invokeBuild = async (name, args, buildEnv, restoring = false) => {
    const result = await runInvocation({ root, directory: resolve(artifactDir, 'build-logs', name), args, env: buildEnv,
      timeoutMs: 180000, signal: restoring ? undefined : controller.signal, id: name, family: 'build', script: args[0] });
    state.builds.push(result); save('run.json', state);
    if (result.status !== 'completed') throw Error(`Diagnostic preparation ${name}: ${result.status}`);
  };
  try {
    const reviews = JSON.parse(readFileSync(resolve(root, 'docs/audits/parallel-paths-1018.json'), 'utf8'));
    const history = historicalCandidates({ root, candidate: sha, reviews });
    save('history.json', history); save('history.md', auditMarkdown(history));
    await invokeBuild('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit'], normal);
    await invokeBuild('normal-before', ['node_modules/rollup/dist/bin/rollup', '-c'], normal);
    normalManifest = readFileSync(resolve(root, 'dist/houseplan-assets.json'));
    save('normal-product-manifest.json', normalManifest.toString());
    await invokeBuild('diagnostic', ['node_modules/rollup/dist/bin/rollup', '-c'], env);
    const manifest = readFileSync(resolve(root, 'dist/houseplan-assets.json'));
    if (!manifest.equals(normalManifest)) throw Error('Diagnostic mode changed normal JS/manifest bytes');
    state.normalByteIdentity = { verified: true, manifestHash: digestBytes(manifest), files: JSON.parse(manifest).files.length };
    // This generated directory belongs solely to tsc. Resolve and check it
    // before recursive removal so a stale cross-branch module cannot enter maps.
    const generated = inside(root, 'test-build');
    if (generated !== resolve(root, 'test-build')) throw Error('Unexpected compiler output path');
    rmSync(generated, { recursive: true, force: true });
    await invokeBuild('compile-units', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json', '--sourceMap', '--inlineSources'], env);
    await invokeBuild('patch-unit-imports', ['scripts/fix-test-build.mjs'], env);
    const paths = [...JSON.parse(manifest).files.map(file => `dist/${file.path}`),
      ...walkFiles(generated).filter(p => p.endsWith('.js')).map(p => slash(relative(root, p)))];
    index = indexGeneratedFiles({ root, paths, artifactDir, identity, manifest }); save('build-index.json', index);
    if (!index.valid) throw Error('Invalid diagnostic source-map provenance');
    await invokeBuild('demo-materialization', ['scripts/bundle-sync.mjs'], env);
    const preload = pathToFileURL(resolve(root, 'scripts/coverage-preload.mjs')).href;
    let compressedBytes = 0;
    const execute = async expected => {
      if (controller.signal.aborted || compressedBytes > 512 * 1024 * 1024) {
        state.invocations.push({ ...expected, directory: '', status: 'skipped', issues: [{ reason: 'bounded-run-exhausted' }] }); return;
      }
      const number = inventory.cases.indexOf(expected), directory = resolve(artifactDir, 'cases', String(number).padStart(4, '0'));
      const caseEnv = { ...env, HP_COVERAGE_DIR: directory, HP_COVERAGE_ROOT: artifactDir,
        HP_COVERAGE_CASE: expected.id, NODE_V8_COVERAGE: directory,
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${preload}`.trim(),
        HP_ALLOW_FOREIGN_CAPTURE: '#1018 diagnostic coverage only; no baseline acceptance or visual approval' };
      const record = await runInvocation({ root, directory, args: expected.args, env: caseEnv,
        timeoutMs: expected.timeoutMs, signal: controller.signal, ...expected });
      state.invocations.push(record);
      if (expected.family === 'golden') {
        const path = resolve(root, 'artifacts/golden/golden-report.json');
        if (existsSync(path)) {
          const golden = JSON.parse(readFileSync(path, 'utf8'));
          save(`cases/${String(number).padStart(4, '0')}/golden-report.json`, golden);
          const actual = golden.results?.find(r => r.id === expected.scenario);
          if (!actual || actual.status === 'error') record.issues.push({ reason: 'golden-scenario-not-completed', scenario: expected.scenario });
        } else record.issues.push({ reason: 'missing-golden-report', scenario: expected.scenario });
      }
      // Preserve native payloads losslessly while bounding retained artifacts.
      for (const path of walkFiles(directory).filter(p => p.endsWith('.json'))) {
        if (statSync(path).size > 64 * 1024 * 1024) {
          record.issues.push({ reason: 'oversized-raw-payload', path: slash(relative(artifactDir, path)) });
          unlinkSync(inside(artifactDir, relative(artifactDir, path))); continue;
        }
        const buffer = readFileSync(path), packed = gzipSync(buffer);
        const metadata = /recorder-/.test(path);
        if (!metadata && compressedBytes + packed.length > 512 * 1024 * 1024) {
          record.issues.push({ reason: 'artifact-capacity', path: slash(relative(artifactDir, path)) });
          controller.abort();
        } else { writeFileSync(`${path}.gz`, packed); if (!metadata) compressedBytes += packed.length; }
        unlinkSync(inside(artifactDir, relative(artifactDir, path)));
      }
      console.log(`${state.invocations.length}/${inventory.cases.length} ${record.status} ${expected.id}`);
      save('run.json', state);
    };
    const pool = async (cases, concurrency) => {
      let cursor = 0;
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (cursor < cases.length) { const expected = cases[cursor++]; await execute(expected); }
      }));
    };
    await pool(inventory.cases.filter(c => c.family === 'unit'), 4);
    await pool(inventory.cases.filter(c => c.family === 'smoke'), 2);
    await pool(inventory.cases.filter(c => c.family === 'golden'), 1);
  } catch (error) { state.issues.push({ reason: 'diagnostic-run-failed', detail: String(error) }); }
  finally {
    try {
      if (normalManifest) {
        // Leave the shared checkout in normal mode; this is byte-verified too.
        await invokeBuild('normal-restore', ['node_modules/rollup/dist/bin/rollup', '-c'], normal, true);
        if (!readFileSync(resolve(root, 'dist/houseplan-assets.json')).equals(normalManifest)) throw Error('Restored normal manifest differs');
        await invokeBuild('demo-normal-restore', ['scripts/bundle-sync.mjs'], normal, true);
        state.normalRestored = true;
      }
    } catch (error) { state.issues.push({ reason: 'normal-restore-failed', detail: String(error) }); }
    clearTimeout(totalTimer); process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
    index.issues.push(...state.issues);
    const report = buildCoverageReport({ root, artifactDir, inventory, invocations: state.invocations, index });
    state.ended = Date.now(); state.completeness = report.completeness;
    save('run.json', state); save('report.json', report); save('report.md', coverageMarkdown(report));
  }
  return state;
}

if (isMainModule(import.meta.url)) {
  const arg = key => process.argv.find(a => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  try {
    const state = await diagnosticRun({ sha: arg('sha'), out: arg('out'), plan: process.argv.includes('--plan') });
    console.log(JSON.stringify(state.inventory.counts));
    if (state.completeness && !state.completeness.complete) { console.error('Diagnostic incomplete: see report.json. This is not a product/gate verdict.'); process.exitCode = 2; }
  } catch (error) { console.error(String(error)); process.exitCode = 2; }
}
