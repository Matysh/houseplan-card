// #954: local acceleration only. This receipt has no CI/review authority.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { contentInputKey } from './content-inputs.mjs';
import { artifactTree } from './frontend-proof.mjs';
import { reusableFrontendInputs } from './frontend-units.mjs';
import { localGateEnvironment } from './local-gate-environment.mjs';

export function localGateKey(root, env = process.env) {
  // Each Windows -> WSL invocation gets a new interoperability socket. It is
  // transport identity, not an input of this Linux build/pure-unit group. All
  // actual tool/PATH/options and unknown user variables still invalidate it.
  const environment = localGateEnvironment(env);
  const envHash = createHash('sha256').update(JSON.stringify(environment)).digest('hex');
  return contentInputKey(root, 'frontend', { environment: { node: process.version, platform: process.platform, arch: process.arch, argv: process.execArgv, envHash },
    select: reader => reusableFrontendInputs(root, reader),
    extra: ['scripts/gate-small.mjs', 'scripts/local-gate-proof.mjs', 'scripts/local-gate-environment.mjs', 'scripts/frontend-units.mjs', 'scripts/content-inputs.mjs'] });
}
function directory(root) {
  const gitDir = execFileSync('git', ['-C', root, 'rev-parse', '--absolute-git-dir'], { encoding: 'utf8' }).trim();
  const path = resolve(gitDir, 'hp-local-gate-v1');
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw Error('unsafe local receipt directory');
  return path;
}
export function invalidateLocalGate(root) {
  const path = join(directory(root), 'proof.json');
  if (existsSync(path)) rmSync(path);
}
export function restoreLocalGate(root, key, now = Date.now()) {
  try {
    const dir = directory(root), p = JSON.parse(readFileSync(join(dir, 'proof.json'), 'utf8'));
    if (p.schema !== 1 || p.key !== key || p.outcome !== 'success' || !Number.isFinite(p.created)
      || now < p.created || now - p.created > 86400000) return false;
    for (const name of ['dist', 'test-build']) if (artifactTree(join(dir, name)) !== p[name]) return false;
    for (const name of ['dist', 'test-build']) {
      const target = resolve(root, name);
      if (existsSync(target) && lstatSync(target).isSymbolicLink()) return false;
      rmSync(target, { recursive: true, force: true });
      cpSync(join(dir, name), target, { recursive: true });
      if (artifactTree(target) !== p[name]) throw Error('copied receipt inventory differs');
    }
    return true;
  } catch { return false; }
}
export function sealLocalGate(root, key, now = Date.now()) {
  const dir = directory(root);
  mkdirSync(dir, { recursive: true });
  invalidateLocalGate(root);
  const inventories = {};
  for (const name of ['dist', 'test-build']) {
    inventories[name] = artifactTree(join(root, name));
    const target = join(dir, name);
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) throw Error('unsafe local artifact directory');
    rmSync(target, { recursive: true, force: true });
    cpSync(join(root, name), target, { recursive: true });
    if (artifactTree(target) !== inventories[name]) throw Error('local artifact copy differs');
  }
  writeFileSync(join(dir, 'proof.json'), JSON.stringify({ schema: 1, key, created: now, outcome: 'success', ...inventories }), { mode: 0o600 });
}
