import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { mdiPalette, mdiChip, mdiFloorPlan } from '@mdi/js';
import { generateDemoIcons, demoIconSourceFiles } from '../../demo/gen_icons.mjs';
import { captureProvenance } from '../../scripts/capture-environment.mjs';
import { requirePinnedBrowser, enforcePinnedBrowser } from '../../scripts/browser-attestation.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
function fixture(t) {
  const temp = mkdtempSync(resolve(tmpdir(), 'hp-demo-icons-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  for (const dir of ['src', 'demo/srv/assets', 'demo/out', 'demo/ui-lab/private', 'demo/ui-lab/.cache', 'demo/ui-lab/exports', 'demo/ui-lab/evidence'])
    mkdirSync(resolve(temp, dir), { recursive: true });
  writeFileSync(resolve(temp, 'src/card.ts'), 'const icon = "mdi:palette";');
  writeFileSync(resolve(temp, 'demo/page.html'), '<ha-icon icon="mdi:chip"></ha-icon>');
  for (const dir of ['demo/out', 'demo/ui-lab/private', 'demo/ui-lab/.cache', 'demo/ui-lab/exports', 'demo/ui-lab/evidence'])
    writeFileSync(resolve(temp, dir, 'stale.mjs'), 'const icon = "mdi:account";');
  const output = resolve(temp, 'demo', 'srv', 'assets', 'icons.js');
  writeFileSync(output, 'window.__ICONS={"mdi:account":"stale"};\n');
  writeFileSync(resolve(temp, 'demo', 'srv', 'assets', 'houseplan-assets.json'), '{"icon":"mdi:account"}');
  return { temp, output };
}
const readMap = output => JSON.parse(readFileSync(output, 'utf8').slice('window.__ICONS='.length, -2));

test('#1193 generation replaces stale paths from source, excludes capture/private outputs and is repeatable', t => {
  const { temp, output } = fixture(t);
  assert.deepEqual(generateDemoIcons(temp), { icons: 2, references: 2 });
  assert.deepEqual(readMap(output), { 'mdi:chip': mdiChip, 'mdi:palette': mdiPalette });
  assert.deepEqual(demoIconSourceFiles(temp), ['demo/page.html', 'src/card.ts']);
  writeFileSync(resolve(temp, 'src/next.json'), '{"icon":"mdi:floor-plan"}');
  generateDemoIcons(temp);
  assert.equal(readMap(output)['mdi:floor-plan'], mdiFloorPlan);
  const first = readFileSync(output, 'utf8');
  generateDemoIcons(temp);
  assert.equal(readFileSync(output, 'utf8'), first);
});

test('#1193 the real synthetic HaIcon paints the generated mdi:palette path', async t => {
  const { temp, output } = fixture(t);
  generateDemoIcons(temp);
  // Use the actual host element, not a second implementation or the product.
  const html = readFileSync(resolve(root, 'demo/srv/demo.html'), 'utf8');
  const script = html.match(/<script>\s*(class HaIcon[\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, 'the real demo host HaIcon definition is required');
  requirePinnedBrowser('demo icon fixture regression');
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  t.after(() => browser.close());
  await enforcePinnedBrowser(browser);
  const page = await browser.newPage();
  await page.setContent(`<script>${readFileSync(output, 'utf8')}</script><script>${script}</script><ha-icon icon="mdi:palette"></ha-icon>`);
  const actual = await page.locator('ha-icon').evaluate(element => {
    const path = element.shadowRoot.querySelector('path');
    const box = path.getBBox();
    return { path: path.getAttribute('d'), width: box.width, height: box.height };
  });
  assert.equal(actual.path, mdiPalette);
  assert.ok(actual.width > 0 && actual.height > 0, 'a nonempty painted glyph is required');
});

test('#1193 capture provenance records the actual synthetic icon-map checksum', () => {
  const icons = readFileSync(resolve(root, 'demo', 'srv', 'assets', 'icons.js'));
  const recorded = captureProvenance({ root });
  assert.equal(recorded.harnessIconsSha256, createHash('sha256').update(icons).digest('hex'));
  assert.ok(recorded.sourceSha);
  assert.equal(captureProvenance().harnessIconsSha256, undefined, 'legacy no-root callers remain usable');
});
