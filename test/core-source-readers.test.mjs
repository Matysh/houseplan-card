// #1391: exercise the cheap source readers against the actual extracted owners.
// Mutation execution is deliberately not part of this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
for (const [title, command, args] of [
  ['schema manifest freshness', 'python3', ['scripts/dump-config-schema.py', '--check']],
  ['converter canonical backend limits', process.execPath, ['scripts/sh3d-convert/build-runtime.mjs', '--check']],
  ['compatibility inventory', process.execPath, ['scripts/config-compatibility-inventory.mjs']],
  ['mutation anchor uniqueness without execution', process.execPath, ['scripts/mutation-gate.mjs', '--check']],
]) {
  test(`#1391 ${title}`, { timeout: 60000 }, () => {
    const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 55000, maxBuffer: 8 * 1024 ** 2 });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stdout + result.stderr);
  });
}
