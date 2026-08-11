import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set([
  '.git', 'node_modules', 'dist', 'coverage', 'artifacts',
  '.venv', '__pycache__', '.pytest_cache',
]);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(ROOT, full).split(sep).join('/'));
  }
  return out;
};

// The HACS submission check does not read hacs.json to find the integration: it
// globs `*manifest.json` over the whole clone of the DEFAULT branch and exits 1
// unless there is exactly one (hacs/default, scripts/helpers/integration_path.py
// -> "No manifest"). Two stand-only manifests under demo/stand turned the
// Hassfest job of PR #9004 red on 2026-08-11, five weeks into the review queue,
// and the failure said nothing about which file was to blame. Anything that
// needs a second manifest ships it as `manifest.template.json` and renames it at
// install time — see demo/stand/install.sh.
test('the tree carries exactly one *manifest.json: HACS rejects a repository with two', () => {
  const found = walk(ROOT).filter((path) => path.split('/').pop().endsWith('manifest.json'));
  assert.deepEqual(found, ['custom_components/houseplan/manifest.json']);
});
