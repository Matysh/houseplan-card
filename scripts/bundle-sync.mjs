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

const readManifest = (path) => {
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  if (parsed?.schema !== 1 || !Array.isArray(parsed.files) || !parsed.entry) {
    throw new Error(`${path}: invalid House Plan bundle manifest`);
  }
  return parsed;
};
const sourceManifest = readManifest(manifestPath);
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

for (const target of TARGETS) {
  const targetRoot = resolve(ROOT, target);
  const oldManifestPath = resolve(targetRoot, MANIFEST_NAME);
  let old = null;
  if (existsSync(oldManifestPath)) {
    old = readManifest(oldManifestPath);
  }
  // Content-hashed dependencies first, stable entry second, manifest last.
  // At every observable point the current manifest therefore names a complete
  // tree; an interrupted copy cannot publish an allowlist for absent chunks.
  const payload = sourceManifest.files
    .map((file) => file.path)
    .sort((left, right) => (left === sourceManifest.entry ? 1 : 0)
      - (right === sourceManifest.entry ? 1 : 0) || left.localeCompare(right));
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
  const copied = readManifest(resolve(targetRoot, MANIFEST_NAME));
  for (const file of copied.files) {
    if (sha256(contained(targetRoot, file.path)) !== file.sha256) {
      throw new Error(`${target}/${file.path}: copied hash mismatch`);
    }
  }
  console.log(`бандл-дерево → ${target}`);
}
