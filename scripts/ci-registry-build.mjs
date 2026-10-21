#!/usr/bin/env node
// Restore only verified immutable inventories. A beta assembles its own bytes.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { artifactTree } from './artifact-inventory.mjs';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { portableCommand, isMainModule } from './spawn-portable.mjs';
import { producerToolchain, producerRecipe } from './ci-registry-cli.mjs';
import { parseVersionSources, validateVersionSources } from './release-contract.mjs';

export function verifyRegistryBuild(inventory, directory) {
  if (!inventory?.dist || !inventory?.testBuild
    || artifactTree(join(directory, 'dist')) !== inventory.dist
    || artifactTree(join(directory, 'test-build')) !== inventory.testBuild) throw Error('immutable frontend byte inventory mismatch');
}
export function restoreRegistryBuild({ root = process.cwd(), record, repo, download = (run, name, dir) =>
  execFileSync('gh', ['run', 'download', String(run), '--repo', repo, '--name', name, '--dir', dir], { stdio: 'pipe' }) }) {
  const temp = mkdtempSync(join(tmpdir(), 'hp-registry-build-'));
  try {
    download(record.run, 'producer-card-bundle', join(temp, 'dist'));
    download(record.run, 'producer-test-build', join(temp, 'test-build'));
    verifyRegistryBuild(record.inventory, temp);
    for (const name of ['dist', 'test-build']) {
      const target = resolve(root, name);
      // Both fixed targets are within this explicitly selected checkout.
      if (target !== join(resolve(root), name)) throw Error('unsafe build destination');
      if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw Error('unsafe artifact destination link');
      rmSync(target, { recursive: true, force: true });
      cpSync(join(temp, name), target, { recursive: true });
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
export function runCandidateCommand(args, cwd = process.cwd()) {
  const command = portableCommand('npm');
  const result = spawnSync(command.cmd, args, { cwd, shell: command.shell, stdio: 'inherit' });
  if (result.status !== 0) throw Error('candidate assembly failed', { cause: result.error });
}
export async function prepareRegistryBundle(env = process.env) {
  const reused = env.FRONTEND_REUSED === 'true';
  if (reused) {
    const record = JSON.parse(env.FRONTEND_RECORD);
    restoreRegistryBuild({ record, repo: env.GITHUB_REPOSITORY });
    if (env.REGISTRY_MODE === 'candidate') {
      runCandidateCommand(['ci']); runCandidateCommand(['run', 'build']); runCandidateCommand(['exec', '--', 'tsc', '-p', 'tsconfig.test.json']);
      execFileSync(process.execPath, ['scripts/fix-test-build.mjs'], { stdio: 'inherit' });
    } else if (record.inventory.fingerprint !== sourceFingerprint()) throw Error('restored producer fingerprint differs');
  } else verifyRegistryBuild(JSON.parse(env.FRONTEND_INVENTORY), process.cwd());
}
if (isMainModule(import.meta.url)) {
  if (process.argv.includes('--manifest')) {
    const read = path => readFileSync(path, 'utf8'), version = JSON.parse(read('package.json')).version;
    const sources = parseVersionSources({ packageJson: read('package.json'), packageLock: read('package-lock.json'),
      manifest: read('custom_components/houseplan/manifest.json'), constSource: read('custom_components/houseplan/const.py'),
      cardSource: read('src/houseplan-card.ts'), editorRuntimeSource: read('src/houseplan-editor-runtime.ts') });
    validateVersionSources('v' + version, sources, { requirePrerelease: false });
    if (JSON.parse(read('custom_components/houseplan/manifest.json')).domain !== 'houseplan') throw Error('foreign backend manifest');
    console.log('Fresh manifest and all release version mirrors verified');
  } else if (process.argv.includes('--stamp')) {
    const inventory = { dist: artifactTree('dist'), testBuild: artifactTree('test-build'), fingerprint: sourceFingerprint() };
    const text = 'inventory=' + JSON.stringify(inventory) + '\ntoolchain=' + JSON.stringify(producerToolchain())
      + '\nrecipe=' + producerRecipe(process.cwd(), 'frontend') + '\n';
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, text); process.stdout.write(text);
  } else await prepareRegistryBundle();
}
