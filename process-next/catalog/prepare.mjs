import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { within } from '../lib/storage.mjs';
const modes = {
  build: [['node_modules/typescript/bin/tsc', '--noEmit'], ['node_modules/rollup/dist/bin/rollup', '-c']],
  tests: [['node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'], ['scripts/fix-test-build.mjs']],
};
const commands = modes[process.argv[2]];
if (!commands) throw Error('Expected build or tests');
// tsc does not delete emitted modules whose source was removed. A fresh output
// tree prevents a test from passing against a stale, no-longer-shipped module.
if (process.argv[2] === 'tests') rmSync(within(process.cwd(), 'test-build'), { recursive: true, force: true });
for (const args of commands) {
  const child = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false });
  if (child.error) throw child.error;
  if (child.status !== 0) process.exit(child.status || 1);
}
