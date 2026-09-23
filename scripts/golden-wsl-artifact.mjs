#!/usr/bin/env node
/**
 * Полный локальный golden-артефакт из WSL (#641).
 *
 * Съёмка допустима только от чистого опубликованного SHA ветки. Артефакт
 * аттестует исходное дерево, WSL/ext4, пиновый Node/Playwright/Chromium,
 * полный набор сцен, PNG-хеши и floor свидетелей. Приёмщик повторяет все
 * проверки; финальный exact-SHA Validate в GitHub остаётся merge/release-гейтом.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { release as osRelease } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from '../demo/golden/matrix.mjs';
import { GOLDEN_BASELINE_MANIFEST } from '../demo/golden/policy.mjs';
import {
  goldenAcceptanceRefusal, goldenWitnessRefusal,
} from './golden-acceptance.mjs';
import { reportCaptureProvenance } from './capture-environment.mjs';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { pinsFromSources } from './toolchain-pins.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const WSL_ATTESTATION_FILE = 'wsl-attestation.json';
export const WSL_ATTESTATION_SCHEMA = 'houseplan-golden-wsl/v1';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
};
export const canonicalJson = (value) => JSON.stringify(canonical(value));
export const objectSha256 = (value) => sha256(canonicalJson(value));

export async function fileSha256(path) {
  const hash = createHash('sha256');
  await new Promise((accept, reject) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', accept);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

const command = (cwd, executable, args) => execFileSync(executable, args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
}).trim();

const normalizeRepository = (remote) => {
  const text = String(remote || '').trim().replace(/\.git$/, '');
  return text.match(/github\.com[/:]([^/]+\/[^/]+)$/i)?.[1] || text;
};

export function repositorySnapshot(root = ROOT, run = command) {
  const branch = run(root, 'git', ['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const commit = run(root, 'git', ['rev-parse', 'HEAD']);
  const tree = run(root, 'git', ['rev-parse', 'HEAD^{tree}']);
  const status = run(root, 'git', ['status', '--porcelain=v1', '--untracked-files=all']);
  const remoteUrl = run(root, 'git', ['remote', 'get-url', 'origin']);
  const remoteLine = run(root, 'git', ['ls-remote', '--exit-code', 'origin', `refs/heads/${branch}`]);
  const remoteSha = remoteLine.split(/\s+/)[0] || '';
  return {
    repository: normalizeRepository(remoteUrl), branch, commit, tree, remoteSha,
    clean: status === '', status,
  };
}

export function repositoryRefusal(snapshot) {
  if (!snapshot?.repository) return 'не удалось определить repository для WSL golden';
  if (!snapshot?.branch) return 'WSL golden требует именованную ветку, detached HEAD запрещён';
  if (!snapshot.clean || snapshot.status) return 'WSL golden требует чистое рабочее дерево';
  if (!/^[0-9a-f]{40}$/.test(snapshot.commit || '') || snapshot.commit !== snapshot.remoteSha) {
    return `локальный HEAD ${snapshot?.commit || 'unknown'} не совпадает с опубликованным origin/${snapshot?.branch || '?'} ${snapshot?.remoteSha || 'missing'}`;
  }
  if (!/^[0-9a-f]{40}$/.test(snapshot.tree || '')) return 'не удалось зафиксировать tree SHA исходного коммита';
  return null;
}

export function runtimeEnvironment(root = ROOT, {
  env = process.env, platform = process.platform, arch = process.arch,
  release = osRelease(), run = command,
} = {}) {
  let filesystem = null;
  try { filesystem = run(root, 'stat', ['-f', '-c', '%T', '.']); } catch { /* refusal below */ }
  const wsl = platform === 'linux' && (
    Boolean(String(env.WSL_DISTRO_NAME || '').trim()) || /microsoft/i.test(String(release))
  );
  return {
    platform, arch, kernel: String(release), wsl,
    distro: String(env.WSL_DISTRO_NAME || '').trim() || null,
    filesystem,
  };
}

export function environmentRefusal(environment) {
  if (environment?.platform !== 'linux' || !environment?.wsl) {
    return 'аттестованная локальная съёмка разрешена только внутри WSL';
  }
  if (!environment.filesystem) return 'не удалось определить файловую систему рабочего дерева';
  if (!environment.distro || !environment.kernel || !environment.arch) {
    return 'WSL golden требует distro, kernel и architecture в паспорте среды';
  }
  if (/^(9p|drvfs|fuseblk|cifs|smb)/i.test(environment.filesystem)) {
    return `рабочее дерево находится на ${environment.filesystem}; требуется Linux/ext4 clone внутри WSL`;
  }
  return null;
}

export async function toolchainSnapshot(root = ROOT) {
  const pins = pinsFromSources();
  const playwrightPackage = JSON.parse(readFileSync(resolve(root, 'node_modules/playwright/package.json'), 'utf8'));
  const { chromium } = await import('playwright');
  const chromiumExecutable = chromium.executablePath();
  if (!existsSync(chromiumExecutable)) throw new Error(`Chromium не установлен: ${chromiumExecutable}`);
  return {
    pins,
    node: process.versions.node,
    npm: command(root, 'npm', ['--version']),
    playwright: playwrightPackage.version,
    chromiumExecutable,
    chromiumExecutableSha256: await fileSha256(chromiumExecutable),
  };
}

export function toolchainRefusal(toolchain, report = null) {
  const failures = [];
  if (String(toolchain?.node || '').split('.')[0] !== String(toolchain?.pins?.node || '')) failures.push('Node');
  if (toolchain?.playwright !== toolchain?.pins?.playwright) failures.push('Playwright');
  const browserVersion = toolchain?.pins?.chromium?.version;
  if (report && browserVersion && !String(report.chromium || '').includes(browserVersion)) failures.push('Chromium');
  if (!/^[0-9a-f]{64}$/.test(toolchain?.chromiumExecutableSha256 || '')) failures.push('Chromium executable');
  return failures.length ? `toolchain расходится с CI: ${failures.join(', ')}` : null;
}

export function intentFromArgv(argv = process.argv.slice(2)) {
  const list = (name) => {
    const value = argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || '';
    return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))].sort();
  };
  const reason = argv.find((arg) => arg.startsWith('--reason='))?.slice('--reason='.length) || '';
  return {
    expectChange: list('expect-change'),
    expectNew: list('expect-new'),
    noWitnesses: argv.includes('--no-witnesses'),
    reason,
  };
}

const pngDimensions = (bytes) => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, signature.length).equals(signature)) {
    throw new Error('candidate is not a PNG');
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

const sameInventory = (left, right) => JSON.stringify([...left].sort())
  === JSON.stringify([...right].sort());

export function inspectArtifact({ root = ROOT, artifactRoot, report, intent }) {
  if (report.matrixVersion !== GOLDEN_MATRIX_VERSION) {
    throw new Error(`candidate matrix ${report.matrixVersion} != current ${GOLDEN_MATRIX_VERSION}`);
  }
  if (report.buildFingerprint !== sourceFingerprint(root)) {
    throw new Error('candidate screenshots were not captured from the current frontend source');
  }
  const { provenance } = reportCaptureProvenance(report);
  if (provenance.platform !== 'linux' || provenance.ci) {
    throw new Error('WSL attestation requires a local Linux capture without CI provenance');
  }
  if (!Array.isArray(report.results)) throw new Error('candidate report has no scenario results');
  const expected = GOLDEN_SCENARIOS.map((scenario) => scenario.id);
  const reported = report.results.map((result) => result.id);
  const actualRoot = resolve(artifactRoot, 'actual');
  const files = existsSync(actualRoot)
    ? readdirSync(actualRoot).filter((name) => name.endsWith('.png')).map((name) => name.slice(0, -4))
    : [];
  if (!sameInventory(expected, reported) || !sameInventory(expected, files)) {
    throw new Error('WSL artifact does not contain the complete current golden matrix');
  }
  const refusal = goldenAcceptanceRefusal(report.results, intent.expectChange, intent.expectNew);
  if (refusal) throw new Error(refusal);
  const previous = JSON.parse(readFileSync(resolve(root, 'demo/golden/baselines', GOLDEN_BASELINE_MANIFEST), 'utf8'));
  const witness = goldenWitnessRefusal({
    results: report.results,
    sceneCount: GOLDEN_SCENARIOS.length,
    declared: intent.expectChange,
    declaredNew: intent.expectNew,
    previousHashes: previous.scenarios || {},
    skipWitnesses: intent.noWitnesses,
    skipReason: intent.reason,
  });
  if (witness.refusal) throw new Error(witness.refusal);
  const byId = new Map(report.results.map((result) => [result.id, result]));
  const frames = expected.sort().map((id) => {
    const result = byId.get(id);
    if (result?.error || !['missing-baseline', 'passed', 'different'].includes(result?.status)) {
      throw new Error(`review candidate has an invalid run status: ${id} (${result?.status || 'missing'})`);
    }
    const path = resolve(actualRoot, `${id}.png`);
    const bytes = readFileSync(path);
    const digest = sha256(bytes);
    if (digest !== result.actualSha256) throw new Error(`candidate changed after capture: ${id}`);
    return { id, sha256: digest, ...pngDimensions(bytes) };
  });
  const reportBytes = readFileSync(resolve(artifactRoot, 'golden-report.json'));
  const reportSha256 = sha256(reportBytes);
  const artifactSha256 = objectSha256({ reportSha256, frames });
  return {
    reportSha256, artifactSha256, frames,
    witnesses: intent.noWitnesses
      ? { skipped: true, reason: intent.reason }
      : { count: witness.witnesses.length, floor: witness.floor },
  };
}

export async function createWslAttestation({
  root = ROOT, artifactRoot = resolve(ROOT, 'artifacts/golden'), intent,
  source = repositorySnapshot(root), environment = runtimeEnvironment(root),
  toolchain = null, createdAt = new Date().toISOString(),
} = {}) {
  toolchain ||= await toolchainSnapshot(root);
  const repoProblem = repositoryRefusal(source);
  if (repoProblem) throw new Error(repoProblem);
  const envProblem = environmentRefusal(environment);
  if (envProblem) throw new Error(envProblem);
  const report = JSON.parse(readFileSync(resolve(artifactRoot, 'golden-report.json'), 'utf8'));
  const toolProblem = toolchainRefusal(toolchain, report);
  if (toolProblem) throw new Error(toolProblem);
  const artifact = inspectArtifact({ root, artifactRoot, report, intent });
  const payload = {
    schema: WSL_ATTESTATION_SCHEMA,
    kind: 'wsl-local',
    command: 'npm run golden:wsl:capture',
    createdAt,
    source,
    environment,
    toolchain,
    packageLockSha256: sha256(readFileSync(resolve(root, 'package-lock.json'))),
    matrixVersion: report.matrixVersion,
    buildFingerprint: report.buildFingerprint,
    chromium: report.chromium,
    intent,
    ...artifact,
  };
  return { ...payload, sha256: objectSha256(payload) };
}

const matchingSource = (attestation, current) => [
  'repository', 'branch', 'commit', 'tree', 'remoteSha',
].every((key) => attestation?.source?.[key] === current?.[key]);

export async function verifyWslAttestation({
  root = ROOT, artifactRoot, intent,
  currentSource = null,
  currentEnvironment = null,
  currentToolchain = null,
} = {}) {
  const path = resolve(artifactRoot, WSL_ATTESTATION_FILE);
  if (!existsSync(path)) return null;
  currentSource ||= repositorySnapshot(root);
  currentEnvironment ||= runtimeEnvironment(root);
  currentToolchain ||= await toolchainSnapshot(root);
  const attestation = JSON.parse(readFileSync(path, 'utf8'));
  if (attestation.schema !== WSL_ATTESTATION_SCHEMA || attestation.kind !== 'wsl-local') {
    throw new Error(`unsupported WSL golden attestation: ${attestation.schema || 'missing'}`);
  }
  const { sha256: declaredSha, ...payload } = attestation;
  if (!/^[0-9a-f]{64}$/.test(declaredSha || '') || objectSha256(payload) !== declaredSha) {
    throw new Error('WSL golden attestation hash does not match its payload');
  }
  const repoProblem = repositoryRefusal(currentSource);
  if (repoProblem) throw new Error(repoProblem);
  const envProblem = environmentRefusal(currentEnvironment);
  if (envProblem) throw new Error(envProblem);
  if (!matchingSource(attestation, currentSource)) {
    throw new Error('WSL golden attestation belongs to another repository, branch, commit or tree');
  }
  if (canonicalJson(attestation.intent) !== canonicalJson(intent)) {
    throw new Error('acceptance intent differs from the reviewed WSL golden attestation');
  }
  if (attestation.packageLockSha256 !== sha256(readFileSync(resolve(root, 'package-lock.json')))) {
    throw new Error('package-lock.json changed after the WSL golden capture');
  }
  const toolProblem = toolchainRefusal(currentToolchain);
  if (toolProblem) throw new Error(toolProblem);
  for (const key of ['node', 'npm', 'playwright', 'chromiumExecutableSha256']) {
    if (currentToolchain[key] !== attestation.toolchain?.[key]) {
      throw new Error(`toolchain changed after WSL golden capture: ${key}`);
    }
  }
  const report = JSON.parse(readFileSync(resolve(artifactRoot, 'golden-report.json'), 'utf8'));
  const artifact = inspectArtifact({ root, artifactRoot, report, intent });
  for (const key of ['reportSha256', 'artifactSha256']) {
    if (artifact[key] !== attestation[key]) throw new Error(`WSL golden artifact changed after capture: ${key}`);
  }
  if (canonicalJson(artifact.frames) !== canonicalJson(attestation.frames)
    || canonicalJson(artifact.witnesses) !== canonicalJson(attestation.witnesses)) {
    throw new Error('WSL golden artifact frames or witnesses changed after capture');
  }
  return attestation;
}

const runNpm = (args) => {
  const result = spawnSync('npm', args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
};

async function main() {
  const intent = intentFromArgv();
  const before = repositorySnapshot(ROOT);
  const beforeProblem = repositoryRefusal(before);
  if (beforeProblem) throw new Error(beforeProblem);
  const environment = runtimeEnvironment(ROOT);
  const envProblem = environmentRefusal(environment);
  if (envProblem) throw new Error(envProblem);
  const toolchain = await toolchainSnapshot(ROOT);
  const toolProblem = toolchainRefusal(toolchain);
  if (toolProblem) throw new Error(toolProblem);

  const artifactRoot = resolve(ROOT, 'artifacts/golden');
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });
  runNpm(['run', 'bundle:sync']);
  const built = repositorySnapshot(ROOT);
  if (repositoryRefusal(built) || !matchingSource({ source: before }, built)) {
    throw new Error('bundle:sync changed the published source tree; commit and push it before capture');
  }
  runNpm(['run', 'golden:capture']);
  const after = repositorySnapshot(ROOT);
  if (repositoryRefusal(after) || !matchingSource({ source: before }, after)) {
    throw new Error('repository changed while the WSL golden artifact was captured');
  }
  const attestation = await createWslAttestation({
    root: ROOT, artifactRoot, intent, source: after, environment, toolchain,
  });
  writeFileSync(resolve(artifactRoot, WSL_ATTESTATION_FILE), `${JSON.stringify(attestation, null, 2)}\n`);
  console.log(`WSL golden artifact: ${artifactRoot}`);
  console.log(`Baseline-Reviewed-Local: sha256:${attestation.sha256}`);
  const flags = [
    intent.expectChange.length ? `--expect-change=${intent.expectChange.join(',')}` : '',
    intent.expectNew.length ? `--expect-new=${intent.expectNew.join(',')}` : '',
    intent.noWitnesses ? '--no-witnesses' : '',
    intent.reason ? `--reason=${JSON.stringify(intent.reason)}` : '',
  ].filter(Boolean).join(' ');
  console.log(`Приёмка внутри WSL: npm run golden:accept -- --reviewed --from=artifacts/golden ${flags}`.trim());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`WSL golden: ${error.message}`);
    process.exitCode = 1;
  });
}
