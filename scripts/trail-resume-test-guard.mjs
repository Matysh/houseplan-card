#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const localPython = process.platform === 'win32'
  ? join(process.cwd(), '.venv', 'Scripts', 'python.exe')
  : join(process.cwd(), '.venv', 'bin', 'python');
const python = process.env.PYTHON
  || (existsSync(localPython) ? localPython : (process.platform === 'win32' ? 'python' : 'python3'));
const result = spawnSync(python, [
  '-m', 'pytest',
  'tests_backend/test_trails.py',
  'tests_backend/test_trail_recorder.py',
  '-q', '-k', 'resume or short_available',
], { stdio: 'inherit' });

if (result.error) {
  console.error(`trail resume guard could not start ${python}: ${result.error.message}`);
  process.exit(2);
}
process.exit(result.status ?? 2);
