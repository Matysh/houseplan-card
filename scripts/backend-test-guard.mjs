#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const pattern = process.argv[2];
if (!pattern) {
  console.error('usage: node scripts/backend-test-guard.mjs <pytest-k-pattern>');
  process.exit(2);
}
/**
 * Входы обёртки для отбора мутантов (#492 §6.1): без третьего аргумента гард
 * бежит по этому файлу, и правка файла обязана отбирать таких свидетелей.
 * Явно переданный файл попадает в отбор из самой строки гарда.
 */
export const GUARD_INPUTS = ['tests_backend/test_ha_import_export.py'];

const testFile = process.argv[3] || GUARD_INPUTS[0];

const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const result = spawnSync(python, [
  '-m', 'pytest', testFile, '-q', '-k', pattern,
], { stdio: 'inherit' });
process.exit(result.status ?? 2);
