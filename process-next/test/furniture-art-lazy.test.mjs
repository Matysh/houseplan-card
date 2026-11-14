import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertFurnitureArtLazy } from '../../scripts/furniture-art-lazy.mjs';
import { buildBundleManifest } from '../../scripts/bundle-manifest.mjs';

function bundle(eager = false) {
  const art = 'furniture.js';
  const chunks = {
    'houseplan-card.js': { type: 'chunk', fileName: 'houseplan-card.js', code: 'view', isEntry: true,
      facadeModuleId: '/repo/src/houseplan-ha-card-entry.ts',
      imports: eager ? [art] : [], dynamicImports: [art] },
    'houseplan-panel.js': { type: 'chunk', fileName: 'houseplan-panel.js', code: 'panel', isEntry: true,
      facadeModuleId: '/repo/src/houseplan-panel.ts',
      imports: ['houseplan-card.js'], dynamicImports: [] },
    [art]: { type: 'chunk', fileName: art, code: 'art', isEntry: false, imports: [], dynamicImports: [],
      modules: { '/repo/src/furniture-plan-art.generated.ts': {} } },
  };
  return { chunks, manifest: buildBundleManifest(chunks, 'f'.repeat(64)) };
}

test('#1407 furniture ownership ignores unrelated size growth but rejects actual eager artwork', () => {
  const lazy = bundle().manifest;
  lazy.initialViewGzipBytes = 1_000_000_000;
  assert.doesNotThrow(() => assertFurnitureArtLazy(lazy));
  assert.throws(() => assertFurnitureArtLazy(bundle(true).manifest), /furniture artwork graph/);
  assert.throws(() => assertFurnitureArtLazy({ ...lazy, lazyFurnitureArtFiles: [] }), /no lazy/);
});

test('#1407 registered furniture witness uses graph ownership, without the retired budget CLI', async () => {
  const { MUTANTS } = await import('../../scripts/mutation-registry.mjs');
  const witness = MUTANTS.find(item => item.id === 'furniture-art-eager-import');
  assert.equal(witness.guard, 'npm run build && node scripts/furniture-art-lazy.mjs');
});

test('#1407 ownership CLI verifies the actual tree and refuses corrupted chunks', t => {
  const root = mkdtempSync(join(tmpdir(), 'furniture-lazy-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const { chunks, manifest } = bundle();
  for (const chunk of Object.values(chunks)) writeFileSync(join(root, chunk.fileName), chunk.code);
  writeFileSync(join(root, 'houseplan-assets.json'), JSON.stringify(manifest));
  const command = fileURLToPath(new URL('../../scripts/furniture-art-lazy.mjs', import.meta.url));
  const run = () => spawnSync(process.execPath, [command, root], { encoding: 'utf8', windowsHide: true });
  assert.equal(run().status, 0);
  writeFileSync(join(root, 'furniture.js'), 'corrupted');
  const failed = run();
  assert.notEqual(failed.status, 0);
  assert.match(failed.stderr, /hash mismatch/);
});
