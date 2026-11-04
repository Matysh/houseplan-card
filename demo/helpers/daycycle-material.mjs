import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDemoIcons, demoIconSourceFiles } from '../gen_icons.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const ICONS = 'demo/srv/assets/icons.js';
const INPUTS = ['src', 'demo', 'scripts', 'package.json', 'package-lock.json',
  'tsconfig.json', 'tsconfig.test.json', 'rollup.config.mjs', '.nvmrc', '.python-version'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

/** A prepared icon map is allowed only after reproducing its exact bytes.
 * All authored changes and every other dirty output still invalidate the run.
 */
export function daycycleMaterial(root = ROOT) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const materialSha = git(['rev-parse', 'HEAD']);
  const materialTree = git(['rev-parse', 'HEAD^{tree}']);
  const expected = Buffer.from(renderDemoIcons(root).text);
  const sourceHash = createHash('sha256');
  for (const path of demoIconSourceFiles(root)) {
    sourceHash.update(path).update('\0').update(readFileSync(resolve(root, path))).update('\0');
  }
  let actual;
  try { actual = readFileSync(resolve(root, ICONS)); } catch { /* Missing output is unverified. */ }
  const generatedIcons = { path: ICONS, expectedSha256: digest(expected),
    actualSha256: actual ? digest(actual) : null,
    sourceSha256: sourceHash.digest('hex'), verified: !!actual && actual.equals(expected) };
  // Keep the leading XY columns. trim() would hide the worktree/staged
  // distinction of the first entry; -z also handles spaces without quoting.
  const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=normal', '--', ...INPUTS],
    { cwd: root, encoding: 'utf8' });
  const dirtySources = status.split('\0').filter(Boolean).filter(entry =>
    !(entry.slice(0, 3) === ' M ' && entry.slice(3) === ICONS && generatedIcons.verified));
  return { materialSha, materialTree,
    materialClean: dirtySources.length === 0 && generatedIcons.verified,
    materialInputs: { dirtySources, generatedIcons } };
}
