#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUNDLE_MANIFEST = 'houseplan-assets.json';
export const CARD_ENTRY = 'houseplan-card.js';
export const PANEL_ENTRY = 'houseplan-panel.js';

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

const assertUniqueGraph = (manifest, field, listed, label) => {
  const graph = manifest[field];
  if (!Array.isArray(graph) || graph.some((path) => typeof path !== 'string')) {
    throw new Error(`${label}: ${field} must be an array of bundle paths`);
  }
  if (new Set(graph).size !== graph.length) {
    throw new Error(`${label}: ${field} contains duplicate assets`);
  }
  const missing = graph.filter((path) => !listed.has(path));
  if (missing.length) throw new Error(`${label}: ${field} references missing asset ${missing[0]}`);
  return graph;
};

/**
 * Topology of the CURRENT build, checked only against our own tree (#537).
 *
 * `assertBundleManifest` above answers «can this manifest be loaded»: paths
 * exist, nothing is duplicated, graphs reference listed assets, sizes add up.
 * That question is also asked about FOREIGN trees — the performance harness
 * runs the candidate's benchmark against a baseline checkout, so the
 * candidate's validator reads a manifest built by an older commit.
 *
 * «Is the panel wired the way we decided today» is a different question, and
 * #535 proved the cost of confusing them: the rule «the panel graph does not
 * contain the card facade» is true of every build since #535 and false of
 * every build before it, so putting it in the shared validator made the
 * candidate refuse to LOAD any older baseline. All nine performance profiles
 * went red at once, and the release gate withheld an asset from a published
 * stable release. Topology belongs here, where only our own dist is judged.
 */
export function assertOwnBundleTopology(manifest, label = BUNDLE_MANIFEST) {
  const initialPanel = manifest?.initialPanelFiles;
  if (!Array.isArray(initialPanel)) {
    throw new Error(`${label}: initialPanelFiles must be an array of bundle paths`);
  }
  if (initialPanel.includes(CARD_ENTRY)) {
    throw new Error(`${label}: initial panel graph must not contain the card facade`);
  }
  return manifest;
}

/** Validate the additive two-entry manifest contract independently of disk I/O. */
export function assertBundleManifest(manifest, label = BUNDLE_MANIFEST) {
  if (manifest?.schema !== 1 || typeof manifest.fingerprint !== 'string'
      || !Array.isArray(manifest.files)) {
    throw new Error(`${label}: invalid House Plan bundle manifest`);
  }
  if (manifest.entry !== CARD_ENTRY || manifest.panelEntry !== PANEL_ENTRY) {
    throw new Error(`${label}: expected entries ${CARD_ENTRY} and ${PANEL_ENTRY}`);
  }
  const names = manifest.files.map((file) => file?.path);
  const listed = new Set(names);
  if (listed.size !== names.length || !listed.has(CARD_ENTRY) || !listed.has(PANEL_ENTRY)) {
    throw new Error(`${label}: duplicate assets or missing stable entry`);
  }
  const declaredEntries = manifest.files
    .filter((file) => file?.isEntry === true)
    .map((file) => file.path)
    .sort();
  if (JSON.stringify(declaredEntries) !== JSON.stringify([CARD_ENTRY, PANEL_ENTRY].sort())) {
    throw new Error(`${label}: isEntry inventory must contain exactly both stable entries`);
  }

  const initialView = assertUniqueGraph(manifest, 'initialViewFiles', listed, label);
  const initialPanel = assertUniqueGraph(manifest, 'initialPanelFiles', listed, label);
  const initialPanelOnly = assertUniqueGraph(manifest, 'initialPanelOnlyFiles', listed, label);
  if (!initialView.includes(CARD_ENTRY) || initialView.includes(PANEL_ENTRY)) {
    throw new Error(`${label}: initial View graph must contain only the card stable entry`);
  }
  if (!initialPanel.includes(PANEL_ENTRY)) {
    throw new Error(`${label}: initial panel graph must contain its own stable entry`);
  }
  if (initialView.some((path) => path !== CARD_ENTRY && !initialPanel.includes(path))) {
    throw new Error(`${label}: initial View implementation is not a subset of initial panel graph`);
  }
  const expectedPanelOnly = initialPanel
    .filter((path) => !initialView.includes(path))
    .sort();
  if (JSON.stringify([...initialPanelOnly].sort()) !== JSON.stringify(expectedPanelOnly)) {
    throw new Error(`${label}: initialPanelOnlyFiles is not panel minus View`);
  }
  const gzip = (paths) => paths.reduce((total, path) => {
    const value = manifest.files.find((file) => file.path === path)?.gzipBytes;
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label}: missing gzip size for ${path}`);
    }
    return total + value;
  }, 0);
  for (const [field, graph] of [
    ['initialViewGzipBytes', initialView],
    ['initialPanelGzipBytes', initialPanel],
    ['initialPanelOnlyGzipBytes', initialPanelOnly],
  ]) {
    if (manifest[field] !== gzip(graph)) {
      throw new Error(`${label}: ${field} does not match its graph inventory`);
    }
  }
  return manifest;
}

/** Copy immutable dependencies first, then both replaceable stable entries. */
export function orderedBundlePayload(manifest) {
  const stableEntries = new Set([manifest.entry, manifest.panelEntry]);
  return manifest.files
    .map((file) => file.path)
    .sort((left, right) => (stableEntries.has(left) ? 1 : 0)
      - (stableEntries.has(right) ? 1 : 0) || left.localeCompare(right));
}

export function readBundleManifest(root) {
  const path = resolve(root, BUNDLE_MANIFEST);
  if (!existsSync(path)) throw new Error(`${path}: bundle manifest is missing`);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  return assertBundleManifest(manifest, path);
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
  // #353 K5 / #486: a managed chunk on disk that the manifest does not name is
  // dead weight. Stable-looking root entries are just as dangerous as old
  // hashed chunks: both ride into the HACS zip and can mask a stale sync.
  const listed = new Set(manifest.files.map((file) => file.path));
  for (const name of readdirSync(root)) {
    if (/^houseplan-.*\.js$/.test(name) && !listed.has(name)) {
      throw new Error(`orphan bundle asset: ${name}`);
    }
  }
  const assetDir = resolve(root, 'houseplan-assets');
  if (existsSync(assetDir)) {
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
