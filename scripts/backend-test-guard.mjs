#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const pattern = process.argv[2];
if (!pattern) {
  console.error('usage: node scripts/backend-test-guard.mjs <pytest-k-pattern>');
  process.exit(2);
}

const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(python, [
  '-m', 'pytest', 'tests_backend/test_ha_import_export.py', '-q', '-k', pattern,
], { stdio: 'inherit' });
process.exit(result.status ?? 2);
