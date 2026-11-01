import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { digest, within, writeJson } from './storage.mjs';

/** Stage an installable candidate without rewriting the checked source tree. */
export function packageCandidate({ root, output = join(root, 'artifacts', 'process-next'), python = 'python3' }) {
  root = resolve(root); output = within(root, resolve(output));
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const backend = join(root, 'custom_components', 'houseplan');
  if (JSON.parse(readFileSync(join(backend, 'manifest.json'), 'utf8')).version !== version) throw Error('Candidate version differs between package and HA manifest');
  const manifest = JSON.parse(readFileSync(join(root, 'dist', 'houseplan-assets.json'), 'utf8'));
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw Error('Prepared frontend manifest is empty');
  const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src', 'assets', 'custom_components/houseplan', 'docs/data-hp-contract.json', 'package.json', 'package-lock.json', 'rollup.config.mjs'], { cwd: root, encoding: 'utf8' });
  if (changes.trim()) throw Error('Commit the release candidate before packaging it; release SHA must identify the tested source');
  const paths = execFileSync('git', ['ls-files', '-z', '--', 'custom_components/houseplan', 'docs/data-hp-contract.json'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const files = paths.filter(path => !path.startsWith('custom_components/houseplan/frontend/')).map(path => [path, within(root, path)]);
  for (const file of manifest.files) {
    const source = within(join(root, 'dist'), file.path);
    if (digest(readFileSync(source)) !== file.sha256) throw Error(`Incomplete prepared frontend: ${file.path}`);
    files.push([`custom_components/houseplan/frontend/${file.path}`, source]);
  }
  files.push(['custom_components/houseplan/frontend/houseplan-assets.json', join(root, 'dist', 'houseplan-assets.json')]);
  if (new Set(files.map(([path]) => path)).size !== files.length) throw Error('Duplicate packaged path');
  // Only this owned output subtree is replaced. Caller source, dev and frozen baseline are untouched.
  const stage = within(root, join(output, 'candidate'));
  if (stage === root) throw Error('Invalid staging directory');
  mkdirSync(output, { recursive: true }); rmSync(stage, { recursive: true, force: true }); mkdirSync(stage);
  for (const [path, source] of files) { const destination = within(stage, path); mkdirSync(dirname(destination), { recursive: true }); copyFileSync(source, destination); }
  const zip = join(output, 'houseplan.zip');
  const script = `import pathlib,sys,zipfile\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2], 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:\n for p in sorted(root.rglob('*')):\n  if p.is_file():\n   i=zipfile.ZipInfo(p.relative_to(root).as_posix(), (1980,1,1,0,0,0)); i.compress_type=zipfile.ZIP_DEFLATED; i.external_attr=0o100644<<16; z.writestr(i,p.read_bytes(),compresslevel=9)\n`;
  execFileSync(python, ['-c', script, join(stage, 'custom_components', 'houseplan'), zip], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const result = { schema: 1, version, sourceSha, candidateRoot: stage, zip, artifactDigest: digest(readFileSync(zip)),
    files: files.map(([path, source]) => ({ path, digest: digest(readFileSync(source)) })) };
  writeJson(join(output, 'package.json'), result); return result;
}
