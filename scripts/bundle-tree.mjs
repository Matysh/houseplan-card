#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUNDLE_MANIFEST = 'houseplan-assets.json';

export const sha256Bytes = (contents) => createHash('sha256').update(contents).digest('hex');

export function containedBundlePath(root, name) {
  if (typeof name !== 'string' || !name || name.includes('\\')) {
    throw new Error(`invalid bundle path: ${String(name)}`);
  }
  const path = resolve(root, name);
  const rel = relative(resolve(root), path);
  if (!rel || rel.startsWith('..') || rel.includes(':')) {
    throw new Error(`bundle path escapes root: ${name}`);
  }
  return path;
}

export function readBundleManifest(root) {
  const path = resolve(root, BUNDLE_MANIFEST);
  if (!existsSync(path)) throw new Error(`${path}: bundle manifest is missing`);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest?.schema !== 1 || typeof manifest.entry !== 'string'
      || typeof manifest.fingerprint !== 'string' || !Array.isArray(manifest.files)) {
    throw new Error(`${path}: invalid House Plan bundle manifest`);
  }
  const names = manifest.files.map((file) => file?.path);
  if (new Set(names).size !== names.length || !names.includes(manifest.entry)) {
    throw new Error(`${path}: duplicate assets or missing entry`);
  }
  return manifest;
}

export function verifyBundleTree(root) {
  const manifest = readBundleManifest(root);
  for (const file of manifest.files) {
    if (typeof file?.path !== 'string' || !file.path.endsWith('.js')
        || !/^[a-zA-Z0-9._/-]+$/.test(file.path)) {
      throw new Error(`invalid manifest asset path: ${String(file?.path)}`);
    }
    const path = containedBundlePath(root, file.path);
    if (!existsSync(path)) throw new Error(`manifest asset is missing: ${file.path}`);
    const actual = sha256Bytes(readFileSync(path));
    if (actual !== file.sha256) {
      throw new Error(`manifest hash mismatch: ${file.path} (${actual} != ${file.sha256})`);
    }
  }
  // #353 К5: a chunk on disk that the manifest does not name is dead weight —
  // it would ride into the release zip and mask sync bugs. Fail loudly.
  const assetDir = resolve(root, 'houseplan-assets');
  if (existsSync(assetDir)) {
    const listed = new Set(manifest.files.map((file) => file.path));
    for (const name of readdirSync(assetDir)) {
      if (name.endsWith('.js') && !listed.has(`houseplan-assets/${name}`)) {
        throw new Error(`orphan bundle asset: houseplan-assets/${name}`);
      }
    }
  }
  return manifest;
}

export function compareBundleTrees(sourceRoot, targetRoot) {
  const source = verifyBundleTree(sourceRoot);
  const target = verifyBundleTree(targetRoot);
  if (JSON.stringify(target) !== JSON.stringify(source)) {
    throw new Error('bundle manifests differ');
  }
  for (const file of source.files) {
    const left = readFileSync(containedBundlePath(sourceRoot, file.path));
    const right = readFileSync(containedBundlePath(targetRoot, file.path));
    if (!left.equals(right)) throw new Error(`bundle asset differs: ${file.path}`);
  }
  return source;
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    const [source, target] = process.argv.slice(2);
    if (!source) throw new Error('usage: node scripts/bundle-tree.mjs <root> [matching-root]');
    const manifest = target
      ? compareBundleTrees(resolve(source), resolve(target))
      : verifyBundleTree(resolve(source));
    console.log(`verified ${manifest.files.length} bundle assets`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
