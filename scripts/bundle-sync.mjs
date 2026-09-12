#!/usr/bin/env node
/**
 * Разложить собранный бандл по местам, которым он нужен (#255).
 *
 * Копий две с половиной. `custom_components/houseplan/frontend` — та, что
 * ставит HACS, она в репозитории и обязана совпадать с `dist` побайтово.
 * `demo/srv/assets` — рабочая копия стенда: её читают браузерные смоки, golden
 * и съёмка скриншотов, но в репозитории её больше нет. Раньше «скопировать
 * туда» жило шестью разными `cp` в воркфлоу и трижды в документации; когда
 * копию забывали, смок врал согласованно (#236).
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync, existsSync, mkdirSync, readFileSync, rmSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertBundleManifest, assertOwnBundleTopology, orderedBundlePayload, verifyBundleTree,
} from './bundle-tree.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_ROOT = resolve(ROOT, 'dist');
const MANIFEST_NAME = 'houseplan-assets.json';
const TARGETS = [
  'custom_components/houseplan/frontend',
  'demo/srv/assets',
];

const manifestPath = resolve(SOURCE_ROOT, MANIFEST_NAME);
if (!existsSync(manifestPath)) {
  console.error(`dist/${MANIFEST_NAME} не найден: сначала \`npm run build\``);
  process.exit(1);
}

const parseManifest = (path) => {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return parsed;
};
const sourceManifest = assertBundleManifest(parseManifest(manifestPath), manifestPath);
// #537: this script materializes OUR dist, so the topology of the current
// build is judged here and nowhere in the shared loader-side validator.
assertOwnBundleTopology(sourceManifest, manifestPath);
const managedFiles = [MANIFEST_NAME, ...sourceManifest.files.map((file) => file.path)];
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const contained = (root, name) => {
  const path = resolve(root, name);
  const rel = relative(root, path);
  if (!rel || rel.startsWith('..') || rel.includes(':')) {
    throw new Error(`bundle path escapes target root: ${name}`);
  }
  return path;
};

for (const file of sourceManifest.files) {
  const path = contained(SOURCE_ROOT, file.path);
  if (!existsSync(path)) throw new Error(`manifest asset is missing: ${file.path}`);
  if (sha256(path) !== file.sha256) throw new Error(`manifest hash mismatch: ${file.path}`);
}
verifyBundleTree(SOURCE_ROOT);

for (const target of TARGETS) {
  const targetRoot = resolve(ROOT, target);
  const oldManifestPath = resolve(targetRoot, MANIFEST_NAME);
  let old = null;
  if (existsSync(oldManifestPath)) {
    // The first two-entry sync necessarily replaces a valid legacy one-entry
    // manifest. Read only its old inventory here; the copied result below is
    // validated against the complete current contract.
    old = parseManifest(oldManifestPath);
    if (old?.schema !== 1 || !Array.isArray(old.files)) {
      throw new Error(`${oldManifestPath}: invalid previous House Plan bundle manifest`);
    }
  }
  // Content-hashed dependencies first, both stable entries second, manifest
  // last. This is offline materialization, not a promise of live atomicity;
  // either stale entry has its own visible reload fallback for the copy window.
  // The new manifest is never published before its complete payload, while an
  // interrupted pre-manifest copy can still expose a cross-generation entry.
  const payload = orderedBundlePayload(sourceManifest);
  for (const name of payload) {
    const source = contained(SOURCE_ROOT, name);
    const destination = contained(targetRoot, name);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  copyFileSync(manifestPath, oldManifestPath);
  for (const file of old?.files || []) {
    if (!managedFiles.includes(file.path)) rmSync(contained(targetRoot, file.path), { force: true });
  }
  const copied = verifyBundleTree(targetRoot);
  for (const file of copied.files) {
    if (sha256(contained(targetRoot, file.path)) !== file.sha256) {
      throw new Error(`${target}/${file.path}: copied hash mismatch`);
    }
  }
  console.log(`бандл-дерево → ${target}`);
}
