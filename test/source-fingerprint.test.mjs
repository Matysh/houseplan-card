import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { sourceFingerprint } from '../scripts/source-fingerprint.mjs';

test('source fingerprint is stable across LF and CRLF checkouts', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-fingerprint-'));
  const lf = resolve(directory, 'lf');
  const crlf = resolve(directory, 'crlf');
  try {
    mkdirSync(resolve(lf, 'src'), { recursive: true });
    mkdirSync(resolve(crlf, 'src'), { recursive: true });
    writeFileSync(resolve(lf, 'src/example.ts'), 'const a = 1;\nconst b = 2;\n', 'utf8');
    writeFileSync(resolve(crlf, 'src/example.ts'), 'const a = 1;\r\nconst b = 2;\r\n', 'utf8');
    assert.equal(sourceFingerprint(lf), sourceFingerprint(crlf));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('source fingerprint changes with source and build inputs', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'houseplan-fingerprint-change-'));
  try {
    mkdirSync(resolve(directory, 'src'), { recursive: true });
    writeFileSync(resolve(directory, 'src/example.ts'), 'export const value = 1;\n', 'utf8');
    writeFileSync(resolve(directory, 'package.json'), '{"name":"fixture"}\n', 'utf8');
    const initial = sourceFingerprint(directory);
    writeFileSync(resolve(directory, 'src/example.ts'), 'export const value = 2;\n', 'utf8');
    const sourceChanged = sourceFingerprint(directory);
    assert.notEqual(sourceChanged, initial);
    writeFileSync(resolve(directory, 'package.json'), '{"name":"changed"}\n', 'utf8');
    assert.notEqual(sourceFingerprint(directory), sourceChanged);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
