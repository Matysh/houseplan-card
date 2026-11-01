import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GOLDEN_SCENARIOS } from '../../demo/golden/matrix.mjs';
import { prepareGoldenSelection } from '../catalog/golden-selection.mjs';
import { acceptGolden, goldenAcceptArguments } from '../catalog/golden-accept.mjs';
import { digest } from '../lib/storage.mjs';
import { captureProvenance } from '../../scripts/capture-environment.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
const variants = prepareGoldenSelection(GOLDEN_SCENARIOS).all;
const scenes = [variants.find(scene => scene.panelHost && scene.sourceSceneId), variants.find(scene => !scene.panelHost && !scene.staticWallOpenings)].map(scene => ({
  id: scene.id, host: scene.panelHost ? 'panel' : 'lovelace', sourceSceneId: scene.sourceSceneId ?? scene.id,
}));

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'golden-accept-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const baselineRoot = path.join(root, 'demo/golden/baselines'), artifacts = path.join(root, 'artifacts/capture');
  mkdirSync(baselineRoot, { recursive: true }); mkdirSync(path.join(artifacts, 'actual'), { recursive: true });
  const indexPath = path.join(baselineRoot, 'baselines-index.json'), report = path.join(artifacts, 'golden-report.json');
  const oldPng = Buffer.concat([png, Buffer.from('old-reviewed-content')]);
  writeFileSync(path.join(baselineRoot, `${scenes[0].id}.png`), oldPng);
  writeFileSync(path.join(baselineRoot, 'unrelated.png'), oldPng);
  const previous = { schema: 3, chromium: 'old-browser', acceptedAt: 'older-acceptance', sourceFingerprint: 'old-source', matrixVersion: 10,
    capture: { platform: 'linux', ci: { sha: 'old-sha' } }, scenarios: { [scenes[0].id]: digest(oldPng), unrelated: digest(oldPng) },
    scenarioProvenance: { unrelated: { decision: 'keep this evidence' } } };
  writeFileSync(indexPath, JSON.stringify(previous));
  const capture = { schema: 2, chromium: '151.fixture', capture: { platform: 'linux', arch: 'x64', chromium: '151.fixture', ci: null },
    matrixVersion: 109, buildFingerprint: 'captured-source', results: scenes.map((scene, i) => ({ ...scene, actualHost: scene.host,
      status: i ? 'missing-baseline' : 'different', actual: `/original-wsl-path/actual/${scene.id}.png`, actualSha256: digest(png) })) };
  for (const scene of scenes) writeFileSync(path.join(artifacts, 'actual', `${scene.id}.png`), png);
  const save = () => writeFileSync(report, JSON.stringify(capture)); save();
  return { root, report, indexPath, baselineRoot, artifacts, previous, capture, save, scenes: scenes.map(scene => scene.id), decision: 'chat:#1105/owner-reviewed-selected-diffs' };
}

test('default plan changes nothing, execute accepts selected PNGs and only their provenance', t => {
  const f = fixture(t);
  const before = readFileSync(f.indexPath), oldBaseline = readFileSync(path.join(f.baselineRoot, `${scenes[0].id}.png`));
  const plan = acceptGolden(f);
  assert.equal(plan.dryRun, true);
  assert.equal(plan.selected.length, 2);
  assert.deepEqual(readFileSync(f.indexPath), before);
  assert.deepEqual(readFileSync(path.join(f.baselineRoot, `${scenes[0].id}.png`)), oldBaseline);
  assert.equal(existsSync(path.join(f.baselineRoot, `${scenes[1].id}.png`)), false);
  const result = acceptGolden({ ...f, execute: true });
  assert.equal(result.dryRun, false);
  const next = JSON.parse(readFileSync(f.indexPath));
  for (const scene of scenes) {
    assert.deepEqual(readFileSync(path.join(f.baselineRoot, `${scene.id}.png`)), png);
    assert.equal(next.scenarios[scene.id], digest(png));
    assert.equal(next.scenarioProvenance[scene.id].decision, f.decision);
    assert.equal(next.scenarioProvenance[scene.id].reportSha256, digest(readFileSync(f.report)));
    assert.equal(next.scenarioProvenance[scene.id].host, scene.host);
  }
  assert.equal(next.scenarios.unrelated, f.previous.scenarios.unrelated);
  assert.deepEqual(next.scenarioProvenance.unrelated, f.previous.scenarioProvenance.unrelated);
  for (const key of ['acceptedAt', 'sourceFingerprint', 'capture', 'matrixVersion', 'chromium']) assert.deepEqual(next[key], f.previous[key]);
  assert.deepEqual(readFileSync(path.join(f.baselineRoot, 'unrelated.png')), oldBaseline);
});

test('human review reference and explicit real selection are required for writes', t => {
  const f = fixture(t), before = readFileSync(f.indexPath);
  for (const overrides of [{ decision: '' }, { scenes: [] }, { scenes: ['*'] }, { scenes: ['invented-scene'] }, { scenes: [scenes[0].id, scenes[0].id] }])
    assert.throws(() => acceptGolden({ ...f, execute: true, ...overrides }), /decision|scene|Duplicate/);
  assert.deepEqual(readFileSync(f.indexPath), before);
});

test('one damaged or errored selected capture prevents all replacements', t => {
  for (const mutation of [
    f => { f.capture.results[1].actualSha256 = '0'.repeat(64); },
    f => { f.capture.results[1].status = 'error'; },
    f => { f.capture.results[1].error = 'semantic assertion failed'; },
    f => { f.capture.results[1].actualHost = 'panel'; },
    f => { f.capture.results[0].sourceSceneId = 'wrong-fixture'; },
    f => { f.capture.results.push({ ...f.capture.results[0] }); },
  ]) {
    const f = fixture(t), oldIndex = readFileSync(f.indexPath), oldPng = readFileSync(path.join(f.baselineRoot, `${scenes[0].id}.png`));
    mutation(f); f.save();
    assert.throws(() => acceptGolden({ ...f, execute: true }), /changed|errored|host|source|one captured/);
    assert.deepEqual(readFileSync(f.indexPath), oldIndex);
    assert.deepEqual(readFileSync(path.join(f.baselineRoot, `${scenes[0].id}.png`)), oldPng);
    assert.equal(existsSync(path.join(f.baselineRoot, `${scenes[1].id}.png`)), false);
  }
});

test('an unselected error does not force unrelated acceptance or a new capture', t => {
  const f = fixture(t);
  f.capture.results[1].status = 'error'; f.save();
  const result = acceptGolden({ ...f, scenes: [scenes[0].id], execute: true });
  assert.equal(result.selected.length, 1);
  assert.equal(existsSync(path.join(f.baselineRoot, `${scenes[1].id}.png`)), false);
});

test('captured candidate SHA must match HEAD when present; absence is explicit', t => {
  const f = fixture(t);
  const git = (...args) => execFileSync('git', args, { cwd: f.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
  git('init', '-q'); git('config', 'user.name', 'Golden fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'core.hooksPath', path.join(f.root, 'no-hooks')); git('add', '.'); git('commit', '-qm', 'capture source');
  f.capture.sourceSha = git('rev-parse', 'HEAD'); f.save();
  assert.equal(acceptGolden(f).sourceSha, f.capture.sourceSha);
  f.capture.sourceSha = 'f'.repeat(40); f.save();
  assert.throws(() => acceptGolden({ ...f, execute: true }), /differs from current checkout/);
  delete f.capture.sourceSha; f.save();
  assert.match(acceptGolden(f).warnings[0], /no candidate SHA/);
});

test('a dispatched capture identifies its checkout independently of the workflow event SHA', t => {
  const f = fixture(t);
  const git = (...args) => execFileSync('git', args, { cwd: f.root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
  git('init', '-q'); git('config', 'user.name', 'Golden fixture'); git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'core.hooksPath', path.join(f.root, 'no-hooks')); git('add', '.'); git('commit', '-qm', 'actual checked-out candidate');
  const sourceSha = git('rev-parse', 'HEAD'), workflowSha = 'a'.repeat(40);
  f.capture.capture = captureProvenance({ root: f.root, chromium: f.capture.chromium,
    source: { platform: 'linux', arch: 'x64' },
    env: { GITHUB_RUN_ID: '42', GITHUB_REPOSITORY: 'owner/repo', GITHUB_SHA: workflowSha } });
  f.save();
  const before = readFileSync(f.indexPath);
  assert.equal(acceptGolden(f).sourceSha, sourceSha);
  assert.equal(f.capture.capture.ci.sha, workflowSha, 'original event provenance is retained');
  assert.deepEqual(readFileSync(f.indexPath), before, 'planning never approves or rewrites baselines');
  git('commit', '--allow-empty', '-qm', 'another candidate');
  assert.throws(() => acceptGolden(f), /differs from current checkout/);
});
test('CLI arguments preserve default dry-run and require an explicit execute flag', () => {
  const plan = goldenAcceptArguments(['--scenes=one,two', '--report=artifacts/report.json', '--decision=chat:owner']);
  assert.deepEqual(plan.scenes, ['one', 'two']);
  assert.equal(plan.execute, false);
  assert.equal(goldenAcceptArguments(['--execute']).execute, true);
  assert.throws(() => goldenAcceptArguments(['--all']), /Unknown/);
});
