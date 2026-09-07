import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');

const writeCurrentBundle = (root) => {
  const contents = new Map([
    ['houseplan-card.js', 'card facade'],
    ['houseplan-panel.js', 'panel shell'],
    ['houseplan-assets/card-HASH.js', 'shared card implementation'],
  ]);
  for (const [name, value] of contents) {
    const path = join(root, 'dist', name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, value);
  }
  const files = [...contents].map(([path, value]) => ({
    path,
    sha256: sha256(value),
    rawBytes: Buffer.byteLength(value),
    gzipBytes: path === 'houseplan-card.js' ? 5 : path === 'houseplan-panel.js' ? 3 : 7,
    isEntry: path === 'houseplan-card.js' || path === 'houseplan-panel.js',
    imports: path === 'houseplan-panel.js'
      ? ['houseplan-card.js']
      : path === 'houseplan-card.js' ? ['houseplan-assets/card-HASH.js'] : [],
    dynamicImports: [],
  }));
  const manifest = {
    schema: 1,
    fingerprint: 'f'.repeat(64),
    entry: 'houseplan-card.js',
    panelEntry: 'houseplan-panel.js',
    initialViewFiles: ['houseplan-assets/card-HASH.js', 'houseplan-card.js'],
    initialViewGzipBytes: 12,
    initialPanelFiles: [
      'houseplan-assets/card-HASH.js', 'houseplan-card.js', 'houseplan-panel.js',
    ],
    initialPanelGzipBytes: 15,
    initialPanelOnlyFiles: ['houseplan-panel.js'],
    initialPanelOnlyGzipBytes: 3,
    files,
  };
  writeFileSync(join(root, 'dist/houseplan-assets.json'), `${JSON.stringify(manifest)}\n`);
  return manifest;
};

const writeLegacyTarget = (root, target) => {
  const targetRoot = join(root, target);
  mkdirSync(join(targetRoot, 'houseplan-assets'), { recursive: true });
  writeFileSync(join(targetRoot, 'houseplan-card.js'), 'old card');
  writeFileSync(join(targetRoot, 'houseplan-legacy.js'), 'old root entry');
  writeFileSync(join(targetRoot, 'houseplan-assets/old-HASH.js'), 'old chunk');
  writeFileSync(join(targetRoot, 'houseplan-assets.json'), JSON.stringify({
    schema: 1,
    fingerprint: 'legacy',
    entry: 'houseplan-card.js',
    files: [
      { path: 'houseplan-card.js' },
      { path: 'houseplan-legacy.js' },
      { path: 'houseplan-assets/old-HASH.js' },
    ],
  }));
};

test('#486 bundle sync materializes both entries and removes the legacy inventory', () => {
  const root = mkdtempSync(join(tmpdir(), 'houseplan-bundle-sync-'));
  try {
    mkdirSync(join(root, 'scripts'), { recursive: true });
    for (const name of ['bundle-sync.mjs', 'bundle-tree.mjs']) {
      writeFileSync(
        join(root, 'scripts', name),
        readFileSync(new URL(`../scripts/${name}`, import.meta.url)),
      );
    }
    const manifest = writeCurrentBundle(root);
    for (const target of [
      'custom_components/houseplan/frontend', 'demo/srv/assets',
    ]) writeLegacyTarget(root, target);

    const run = spawnSync(process.execPath, ['scripts/bundle-sync.mjs'], {
      cwd: root, encoding: 'utf8',
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    for (const target of [
      'custom_components/houseplan/frontend', 'demo/srv/assets',
    ]) {
      assert.equal(readFileSync(join(root, target, 'houseplan-card.js'), 'utf8'), 'card facade');
      assert.equal(readFileSync(join(root, target, 'houseplan-panel.js'), 'utf8'), 'panel shell');
      assert.deepEqual(
        JSON.parse(readFileSync(join(root, target, 'houseplan-assets.json'), 'utf8')),
        manifest,
      );
      assert.equal(existsSync(join(root, target, 'houseplan-legacy.js')), false);
      assert.equal(existsSync(join(root, target, 'houseplan-assets/old-HASH.js')), false);
    }

    writeFileSync(join(root, 'dist/houseplan-orphan.js'), 'unlisted entry');
    const orphan = spawnSync(process.execPath, ['scripts/bundle-sync.mjs'], {
      cwd: root, encoding: 'utf8',
    });
    assert.notEqual(orphan.status, 0);
    assert.match(`${orphan.stdout}${orphan.stderr}`, /orphan bundle asset: houseplan-orphan\.js/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
