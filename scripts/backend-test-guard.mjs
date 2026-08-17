#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const pattern = process.argv[2];
if (!pattern) {
  console.error('usage: node scripts/backend-test-guard.mjs <pytest-k-pattern>');
  process.exit(2);
}

const result = spawnSync(process.env.PYTHON || 'python', [
  '-m', 'pytest', 'tests_backend/test_ha_import_export.py', '-q', '-k', pattern,
], { stdio: 'inherit' });
process.exit(result.status ?? 2);
