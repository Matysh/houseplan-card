import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const sourceFiles = (directory) => {
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const path = resolve(directory, name);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else files.push(path);
  }
  return files;
};

const BUILD_INPUTS = [
  'package.json',
  'package-lock.json',
  'rollup.config.mjs',
  'tsconfig.json',
  'scripts/source-fingerprint.mjs',
];

/** Stable digest of frontend sources plus the files that control their build. */
export const sourceFingerprint = (root = process.cwd()) => {
  const sourceRoot = resolve(root, 'src');
  const hash = createHash('sha256');
  const files = [
    ...sourceFiles(sourceRoot),
    ...BUILD_INPUTS.map((name) => resolve(root, name)).filter(existsSync),
  ].sort((a, b) => relative(root, a).localeCompare(relative(root, b)));
  for (const file of files) {
    hash.update(relative(root, file).replaceAll('\\', '/'));
    hash.update('\0');
    // Git-canonical text, independent of core.autocrlf. Otherwise the injected
    // hash would make an otherwise identical Windows/Linux bundle differ.
    hash.update(readFileSync(file, 'utf8').replace(/\r\n?/g, '\n'));
    hash.update('\0');
  }
  return hash.digest('hex');
};
