import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { verifyHouseplanZip } from '../scripts/verify-houseplan-zip.mjs';

const sha256 = (contents) => createHash('sha256').update(contents).digest('hex');

const git = (root, args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
};

const write = (root, name, contents) => {
  const path = join(root, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
};

test('#486 HACS zip contains both entries and rejects stale managed roots', () => {
  const root = mkdtempSync(join(tmpdir(), 'houseplan-zip-panel-'));
  const component = join(root, 'component');
  const frontend = join(component, 'frontend');
  const zip = join(root, 'houseplan.zip');
  try {
    const payload = new Map([
      ['houseplan-card.js', 'card entry'],
      ['houseplan-panel.js', 'panel entry'],
      ['houseplan-assets/card-HASH.js', 'shared card'],
    ]);
    for (const [name, contents] of payload) write(frontend, name, contents);
    const files = [...payload].map(([path, contents]) => ({
      path,
      sha256: sha256(contents),
      rawBytes: Buffer.byteLength(contents),
      gzipBytes: path === 'houseplan-card.js' ? 5 : path === 'houseplan-panel.js' ? 3 : 7,
      isEntry: path === 'houseplan-card.js' || path === 'houseplan-panel.js',
      imports: path === 'houseplan-panel.js'
        ? ['houseplan-assets/card-HASH.js']
        : path === 'houseplan-card.js' ? ['houseplan-assets/card-HASH.js'] : [],
      dynamicImports: [],
    }));
    write(frontend, 'houseplan-assets.json', `${JSON.stringify({
      schema: 1,
      fingerprint: 'f'.repeat(64),
      entry: 'houseplan-card.js',
      panelEntry: 'houseplan-panel.js',
      initialViewFiles: ['houseplan-assets/card-HASH.js', 'houseplan-card.js'],
      initialViewGzipBytes: 12,
      initialPanelFiles: [
        'houseplan-assets/card-HASH.js', 'houseplan-panel.js',
      ],
      initialPanelGzipBytes: 10,
      initialPanelOnlyFiles: ['houseplan-panel.js'],
      initialPanelOnlyGzipBytes: 3,
      files,
    })}\n`);
    write(component, 'manifest.json', '{"version":"1.2.3"}\n');

    git(root, ['init', '-q']);
    git(root, ['config', 'user.name', 'House Plan test']);
    git(root, ['config', 'user.email', 'test@example.invalid']);
    git(root, ['config', 'core.autocrlf', 'false']);
    git(root, ['add', 'component']);
    git(root, ['commit', '-qm', 'fixture']);
    git(root, ['archive', '--format=zip', `--output=${zip}`, 'HEAD:component']);
    assert.deepEqual(verifyHouseplanZip(zip, frontend, '1.2.3'), {
      version: '1.2.3', files: 3,
    });

    unlinkSync(join(frontend, 'houseplan-panel.js'));
    git(root, ['add', '-A', 'component']);
    git(root, ['commit', '-qm', 'missing panel']);
    unlinkSync(zip);
    git(root, ['archive', '--format=zip', `--output=${zip}`, 'HEAD:component']);
    assert.throws(
      () => verifyHouseplanZip(zip, frontend, '1.2.3'),
      /missing frontend\/houseplan-panel\.js/,
    );

    write(frontend, 'houseplan-panel.js', 'panel entry');
    write(frontend, 'houseplan-obsolete.js', 'stale root entry');
    git(root, ['add', '-A', 'component']);
    git(root, ['commit', '-qm', 'orphan']);
    unlinkSync(zip);
    git(root, ['archive', '--format=zip', `--output=${zip}`, 'HEAD:component']);
    assert.throws(
      () => verifyHouseplanZip(zip, frontend, '1.2.3'),
      /orphan bundle asset: frontend\/houseplan-obsolete\.js/,
    );

    unlinkSync(join(frontend, 'houseplan-obsolete.js'));
    write(frontend, 'houseplan-panel.js', 'tampered panel entry');
    git(root, ['add', '-A', 'component']);
    git(root, ['commit', '-qm', 'tamper']);
    unlinkSync(zip);
    git(root, ['archive', '--format=zip', `--output=${zip}`, 'HEAD:component']);
    assert.throws(
      () => verifyHouseplanZip(zip, frontend, '1.2.3'),
      /frontend hash mismatch: houseplan-panel\.js/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
