import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { packageCandidate } from '../lib/package.mjs';
import { collectMeasurement, measureZip } from '../lib/metrics.mjs';
import { digest } from '../lib/storage.mjs';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-package-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, value) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), value); };
  write('package.json', '{"version":"1.99.0-beta.1"}'); write('custom_components/houseplan/manifest.json', '{"version":"1.99.0-beta.1"}');
  write('package-lock.json', '{"version":"1.99.0-beta.1","packages":{"":{"version":"1.99.0-beta.1"}}}');
  write('custom_components/houseplan/const.py', "VERSION = '1.99.0-beta.1'\n");
  write('src/houseplan-card.ts', "const CARD_VERSION = '1.99.0-beta.1';\n");
  write('src/houseplan-editor-runtime.ts', "const CARD_VERSION = '1.99.0-beta.1';\n");
  write('custom_components/houseplan/__init__.py', 'value = 1\n'); write('custom_components/houseplan/THIRD_PARTY_NOTICES.md', 'license');
  write('custom_components/houseplan/frontend/old.js', 'old must not ship'); write('docs/data-hp-contract.json', '{}'); write('.gitignore', 'dist/\nartifacts/\n');
  const git = args => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: root, stdio: ['ignore','pipe','pipe'], encoding: 'utf8' });
  git(['init','-q']); git(['add','.']); git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','candidate']);
  const main = Buffer.from('new frontend'); write('dist/houseplan-card.js', main);
  write('dist/houseplan-assets.json', JSON.stringify({ fingerprint: 'same-build', initialViewFiles: ['houseplan-card.js'], files: [{ path: 'houseplan-card.js', sha256: digest(main) }] }));
  return { root, write, git };
}
test('package uses prepared bytes, includes delivered licenses and keeps the source tree untouched', { skip: process.platform === 'win32' ? 'ZIP construction verified in prepared WSL/Python' : false }, t => {
  const { root, git } = fixture(t), result = packageCandidate({ root });
  assert.equal(git(['status','--porcelain']).trim(), '');
  assert.equal(readFileSync(join(result.candidateRoot, 'custom_components/houseplan/THIRD_PARTY_NOTICES.md'), 'utf8'), 'license');
  assert.equal(readFileSync(result.standalone, 'utf8'), 'new frontend');
  const sizes = measureZip(result.zip); assert.equal(sizes.files.length, 2); assert.equal(sizes.buildFingerprint, 'same-build');
  const second = packageCandidate({ root }); assert.equal(second.artifactDigest, result.artifactDigest);
  const performance = { sourceSha: result.sourceSha, buildFingerprint: 'same-build', rows: Array.from({ length: 7 }, () => ({ firstStableRenderMs: 1, spaceSwitchMs: 2, panZoomMs: 3, stateUpdateMs: 4 })), samples: 7, warmups: 1, runtime: {} };
  const args = { zip: result.zip, performance, sourceSha: result.sourceSha, host: { cpu:'fixture', power_scheme:'fixture' }, runnerHash:'fixture', release:result.version };
  assert.equal(collectMeasurement(args).timing_metrics.panZoomMs.median, 3);
  performance.buildFingerprint = 'wrong-build'; assert.throws(() => collectMeasurement(args), /packaged frontend/);
});
test('uncommitted release bytes and mismatched assets cannot be packaged as the committed candidate', t => {
  const { root, write } = fixture(t); write('custom_components/houseplan/__init__.py', 'changed');
  assert.throws(() => packageCandidate({ root }), /Commit the release candidate/);
  write('custom_components/houseplan/__init__.py', 'value = 1\n'); write('dist/houseplan-card.js', 'wrong');
  assert.throws(() => packageCandidate({ root }), /Incomplete prepared frontend/);
});
