import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// The HACS submission check does not read hacs.json to find the integration: it
// globs `*manifest.json` over the whole clone of the DEFAULT branch and exits 1
// unless there is exactly one (hacs/default, scripts/helpers/integration_path.py
// -> "No manifest"). Two stand-only manifests under demo/stand turned the
// Hassfest job of PR #9004 red on 2026-08-11, five weeks into the review queue,
// and the failure said nothing about which file was to blame. Anything that
// needs a second manifest ships it as `manifest.template.json` and renames it at
// install time — see demo/stand/install.sh.
test('the tree carries exactly one *manifest.json: HACS rejects a repository with two', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
    .toString('utf8').split('\0').filter(Boolean);
  const found = tracked.filter((path) => path.split('/').pop().endsWith('manifest.json'));
  assert.deepEqual(found, ['custom_components/houseplan/manifest.json']);
});
