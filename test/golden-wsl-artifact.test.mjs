import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CAPTURE_PROVENANCE_SCHEMA } from '../scripts/capture-environment.mjs';
import {
  WSL_ATTESTATION_FILE, createWslAttestation, environmentRefusal,
  repositoryRefusal, verifyWslAttestation,
} from '../scripts/golden-wsl-artifact.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';
import { pinsFromSources } from '../scripts/toolchain-pins.mjs';

const ROOT = resolve(fileURLToPath(new URL('../', import.meta.url)));
const BASELINES = resolve(ROOT, 'demo/golden/baselines');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const source = Object.freeze({
  repository: 'Matysh/houseplan-card', branch: 'issue/641-wsl-golden-attestation',
  commit: 'a'.repeat(40), tree: 'b'.repeat(40), remoteSha: 'a'.repeat(40),
  clean: true, status: '',
});
const environment = Object.freeze({
  platform: 'linux', arch: 'x64', kernel: '6.6.0-microsoft-standard-WSL2',
  wsl: true, distro: 'Ubuntu', filesystem: 'ext2/ext3',
});

const toolchain = () => {
  const pins = pinsFromSources();
  return {
    pins,
    node: `${pins.node}.0.0`,
    npm: '10.9.0',
    playwright: pins.playwright,
    chromiumExecutable: '/home/test/chromium',
    chromiumExecutableSha256: 'c'.repeat(64),
  };
};

function artifact() {
  const dir = mkdtempSync(resolve(tmpdir(), 'hp-golden-wsl-'));
  const actualRoot = resolve(dir, 'actual');
  mkdirSync(actualRoot, { recursive: true });
  const index = JSON.parse(readFileSync(resolve(BASELINES, 'baselines-index.json'), 'utf8'));
  const results = GOLDEN_SCENARIOS.map((scenario) => {
    const baseline = resolve(BASELINES, `${scenario.id}.png`);
    assert.equal(existsSync(baseline), true, `test fixture needs reviewed baseline ${scenario.id}`);
    const actual = resolve(actualRoot, `${scenario.id}.png`);
    copyFileSync(baseline, actual);
    const sha = digest(readFileSync(actual));
    return { id: scenario.id, status: 'passed', actualSha256: sha, baselineSha256: sha };
  });
  const report = {
    schema: CAPTURE_PROVENANCE_SCHEMA,
    mode: 'capture',
    capture: {
      platform: 'linux', arch: 'x64', chromium: index.chromium,
      buildFingerprint: sourceFingerprint(ROOT), ci: null,
    },
    generatedAt: '2026-09-23T00:00:00.000Z',
    matrixVersion: GOLDEN_MATRIX_VERSION,
    buildFingerprint: sourceFingerprint(ROOT),
    chromium: index.chromium,
    results,
  };
  writeFileSync(resolve(dir, 'golden-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return dir;
}

const intent = Object.freeze({ expectChange: [], expectNew: [], noWitnesses: false, reason: '' });

test('#641: repository and WSL/ext4 preconditions fail closed', () => {
  assert.equal(repositoryRefusal(source), null);
  assert.match(repositoryRefusal({ ...source, repository: '' }), /repository/);
  assert.match(repositoryRefusal({ ...source, clean: false, status: ' M src/x.ts' }), /чистое/);
  assert.match(repositoryRefusal({ ...source, remoteSha: 'd'.repeat(40) }), /не совпадает/);
  assert.equal(environmentRefusal(environment), null);
  assert.match(environmentRefusal({ ...environment, platform: 'win32', wsl: false }), /только внутри WSL/);
  assert.match(environmentRefusal({ ...environment, filesystem: '9p' }), /ext4/);
  assert.match(environmentRefusal({ ...environment, distro: null }), /distro/);
});

test('#641: complete WSL artifact is self-hashed and can be verified before acceptance', async () => {
  const dir = artifact();
  try {
    const tc = toolchain();
    const attestation = await createWslAttestation({
      root: ROOT, artifactRoot: dir, intent, source, environment, toolchain: tc,
      createdAt: '2026-09-23T00:00:01.000Z',
    });
    assert.match(attestation.sha256, /^[0-9a-f]{64}$/);
    assert.equal(attestation.command, 'npm run golden:wsl:capture');
    assert.equal(attestation.frames.length, GOLDEN_SCENARIOS.length);
    assert.ok(attestation.witnesses.count >= attestation.witnesses.floor);
    writeFileSync(resolve(dir, WSL_ATTESTATION_FILE), `${JSON.stringify(attestation, null, 2)}\n`);
    const verified = await verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      currentSource: source, currentEnvironment: environment, currentToolchain: tc,
    });
    assert.equal(verified.sha256, attestation.sha256);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: tampered intent, source, toolchain and PNG are rejected', async () => {
  const dir = artifact();
  try {
    const tc = toolchain();
    const attestation = await createWslAttestation({
      root: ROOT, artifactRoot: dir, intent, source, environment, toolchain: tc,
    });
    writeFileSync(resolve(dir, WSL_ATTESTATION_FILE), `${JSON.stringify(attestation, null, 2)}\n`);
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir,
      intent: { ...intent, expectChange: [GOLDEN_SCENARIOS[0].id] },
      currentSource: source, currentEnvironment: environment, currentToolchain: tc,
    }), /intent differs/);
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      currentSource: { ...source, commit: 'd'.repeat(40), remoteSha: 'd'.repeat(40) },
      currentEnvironment: environment, currentToolchain: tc,
    }), /another repository, branch, commit or tree/);
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent, currentSource: source,
      currentEnvironment: environment, currentToolchain: { ...tc, npm: '11.0.0' },
    }), /toolchain changed/);
    const victim = resolve(dir, 'actual', `${GOLDEN_SCENARIOS[0].id}.png`);
    writeFileSync(victim, Buffer.concat([readFileSync(victim), Buffer.from([0])]));
    await assert.rejects(() => verifyWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      currentSource: source, currentEnvironment: environment, currentToolchain: tc,
    }), /candidate changed after capture/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: incomplete matrix cannot be attested', async () => {
  const dir = artifact();
  try {
    rmSync(resolve(dir, 'actual', `${GOLDEN_SCENARIOS[0].id}.png`));
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      source, environment, toolchain: toolchain(),
    }), /complete current golden matrix/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: duplicate result rows are not a complete matrix', async () => {
  const dir = artifact();
  try {
    const reportPath = resolve(dir, 'golden-report.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.results.push({ ...report.results[0] });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: dir, intent,
      source, environment, toolchain: toolchain(),
    }), /complete current golden matrix/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('#641: stale fingerprints, toolchain drift and undeclared diffs cannot be attested', async () => {
  const stale = artifact();
  const drifted = artifact();
  const unexpected = artifact();
  try {
    const staleReportPath = resolve(stale, 'golden-report.json');
    const staleReport = JSON.parse(readFileSync(staleReportPath, 'utf8'));
    staleReport.buildFingerprint = 'd'.repeat(64);
    writeFileSync(staleReportPath, `${JSON.stringify(staleReport, null, 2)}\n`);
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: stale, intent,
      source, environment, toolchain: toolchain(),
    }), /current frontend source/);

    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: drifted, intent,
      source, environment,
      toolchain: { ...toolchain(), playwright: '0.0.0' },
    }), /toolchain расходится/);

    const reportPath = resolve(unexpected, 'golden-report.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.results[0].status = 'different';
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await assert.rejects(() => createWslAttestation({
      root: ROOT, artifactRoot: unexpected, intent,
      source, environment, toolchain: toolchain(),
    }), /менять не собирались/);
  } finally {
    rmSync(stale, { recursive: true, force: true });
    rmSync(drifted, { recursive: true, force: true });
    rmSync(unexpected, { recursive: true, force: true });
  }
});
