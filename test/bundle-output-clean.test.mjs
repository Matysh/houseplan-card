import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cleanBundleOutputPlugin } from '../scripts/bundle-manifest.mjs';

const generated = `globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__="${'a'.repeat(64)}";export{};`;
const fixture = t => {
  const parent = mkdtempSync(join(tmpdir(), 'hp-output-clean-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const root = join(parent, 'dist');
  mkdirSync(root);
  return { parent, root, put(name, content) {
    const path = join(root, name);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
    return path;
  } };
};

for (const withManifest of [false, true]) test(`#1016 cleanup recovers orphan chunks with manifest=${withManifest}`, t => {
  const { root, put } = fixture(t);
  const old = put('houseplan-assets/old-chunk-aBc_1234.js', generated);
  const dotted = put('houseplan-assets/form-kit.styles-aBc_1234.js', generated);
  const hoisted = put('houseplan-assets/hoisted-aBc_1234.js', `function hoisted(){}${generated}`);
  const sequence = put('houseplan-assets/sequence-aBc_1234.js', generated.replace(';export', ',void 0;export'));
  const foreign = put('houseplan-assets/foreign-aBc_1234.js', 'export const userFile=true;');
  const metadata = put('houseplan-assets/metadata-aBc_1234.js', `const text=${JSON.stringify(generated)};`);
  const comment = put('houseplan-assets/comment-aBc_1234.js', `/*${generated}*/export{};`);
  const unrecognized = put('houseplan-assets/not-a-hashed-output.js', generated);
  const note = put('notes.txt', 'keep');
  const nested = put('houseplan-assets/nested/old-aBc_1234.js', generated);
  if (withManifest) {
    put('houseplan-card.js', 'old entry');
    put('houseplan-assets.json', JSON.stringify({ files: [{ path: 'houseplan-card.js' }] }));
  }
  cleanBundleOutputPlugin(root).buildStart();
  for (const path of [old, dotted, hoisted, sequence]) assert.equal(existsSync(path), false, path);
  assert.equal(existsSync(join(root, 'houseplan-assets.json')), false);
  if (withManifest) assert.equal(existsSync(join(root, 'houseplan-card.js')), false);
  for (const path of [foreign, metadata, comment, unrecognized, note, nested]) assert.ok(existsSync(path), path);
  cleanBundleOutputPlugin(root).buildStart(); // repeated cleanup is safe
});

test('#1016 cleanup validates the complete previous inventory before deleting', t => {
  const { parent, root, put } = fixture(t);
  const owned = put('houseplan-assets/old-aBc_1234.js', generated);
  const outside = join(parent, 'outside.txt');
  writeFileSync(outside, 'keep');
  put('houseplan-assets.json', JSON.stringify({ files: [{ path: 'houseplan-assets/old-aBc_1234.js' }, { path: '../outside.txt' }] }));
  assert.throws(() => cleanBundleOutputPlugin(root).buildStart(), /escapes output root/);
  assert.ok(existsSync(owned));
  assert.equal(readFileSync(outside, 'utf8'), 'keep');
});

for (const linked of ['root', 'assets']) test(`#1016 cleanup refuses a symlinked ${linked} directory`, t => {
  const { parent, root } = fixture(t);
  const outside = join(parent, 'outside');
  mkdirSync(outside);
  const owned = join(outside, 'old-aBc_1234.js');
  writeFileSync(owned, generated);
  const link = join(root, linked === 'root' ? 'linked-output' : 'houseplan-assets');
  symlinkSync(outside, link, 'junction');
  assert.throws(() => cleanBundleOutputPlugin(linked === 'root' ? link : root).buildStart(), /symlink/);
  assert.equal(readFileSync(owned, 'utf8'), generated);
});
