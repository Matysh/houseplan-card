/** Addressed source checks only; never a repository-wide backend gate. */
import { existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { within } from '../lib/storage.mjs';

const backendPython = /^custom_components\/houseplan\/(?:[\w-]+\/)*[\w-]+\.py$/;
export function backendQualityFiles(root, changedFiles) {
  return [...new Set(changedFiles.filter(file => backendPython.test(file)
    && existsSync(within(root, file)) && statSync(within(root, file)).isFile()))].sort();
}

export function runBackendQuality(files, { root = process.cwd(), execute = spawnSync } = {}) {
  if (!files.length || files.some(file => !backendPython.test(file)))
    throw Error('Expected nonempty exact custom_components/houseplan Python source selection');
  for (const file of files) if (!statSync(within(root, file)).isFile()) throw Error('Expected source file: ' + file);
  for (const args of [
    ['-m', 'ruff', 'check', '--', ...files],
    ['-m', 'mypy', '--', ...files],
  ]) {
    const child = execute('python3', args, { cwd: root, stdio: 'inherit', shell: false });
    if (child.error) throw child.error;
    if (child.status !== 0) throw Error(`${args[1]} failed (${child.signal || (child.status ?? 'no result')})`);
  }
  console.log(`Backend quality: ${files.length} changed source files passed ruff + mypy`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  try { runBackendQuality(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
