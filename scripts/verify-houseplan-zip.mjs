#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readZipEntries } from './release-prerelease.mjs';
import { readBundleManifest, sha256Bytes } from './bundle-tree.mjs';

export function verifyHouseplanZip(zipPath, bundleRoot, expectedVersion = '') {
  const expected = readBundleManifest(bundleRoot);
  const header = readZipEntries(zipPath, [
    'manifest.json', 'frontend/houseplan-assets.json',
  ]);
  const integration = JSON.parse(header.get('manifest.json').toString('utf8'));
  if (expectedVersion && integration.version !== expectedVersion) {
    throw new Error(`houseplan.zip manifest version ${integration.version} != ${expectedVersion}`);
  }
  const bundled = JSON.parse(header.get('frontend/houseplan-assets.json').toString('utf8'));
  if (JSON.stringify(bundled) !== JSON.stringify(expected)) {
    throw new Error('houseplan.zip frontend manifest differs from source tree');
  }
  const entries = readZipEntries(zipPath, expected.files.map((file) => `frontend/${file.path}`));
  for (const file of expected.files) {
    if (sha256Bytes(entries.get(`frontend/${file.path}`)) !== file.sha256) {
      throw new Error(`houseplan.zip frontend hash mismatch: ${file.path}`);
    }
  }
  return { version: integration.version, files: expected.files.length };
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  try {
    const [zip, root, version = ''] = process.argv.slice(2);
    if (!zip || !root) {
      throw new Error('usage: node scripts/verify-houseplan-zip.mjs <zip> <bundle-root> [version]');
    }
    const result = verifyHouseplanZip(resolve(zip), resolve(root), version);
    console.log(`verified houseplan.zip ${result.version}: ${result.files} frontend assets`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
