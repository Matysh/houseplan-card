/** #937: the deployed offline artifact, not a development-only UI wrapper. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { enforcePinnedBrowser, requirePinnedBrowser } from '../scripts/browser-attestation.mjs';
import { convertEasy, TOOL_VERSION } from '../scripts/sh3d-convert/easy.mjs';
import { watchPage, finish } from './serve.mjs';

requirePinnedBrowser('#937 external offline converter artifact');
const root = path => fileURLToPath(new URL(`../scripts/sh3d-convert/${path}`, import.meta.url));
const browser = await chromium.launch({ args: ['--no-sandbox'] });
await enforcePinnedBrowser(browser);
const context = await browser.newContext({ viewport: { width: 1000, height: 900 }, locale: 'en-US' });
const page = watchPage(await context.newPage()), requests = [];
await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
try {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      if (this.name === 'slow.json') await new Promise(resolve => { window.releaseSlowRead = resolve; });
      return original.call(this);
    };
  });
  await page.goto(pathToFileURL(root('dist/index.html')).href);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.locator('#file').setInputFiles(root('fixtures/flat-two-rooms.sh3d'));
  await page.locator('#result').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.level button').count(), 1);
  assert.match(await page.locator('.stats').innerText(), /2 rooms/);
  await page.locator('#format').selectOption('easy');
  assert.equal(await page.locator('#result').isVisible(), false);
  const source = readFileSync(root('fixtures/easy-content.json'), 'utf8');
  await page.locator('#paste').fill(source);
  await page.locator('#convert-paste').click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert.match(await page.locator('.stats').innerText(), /3 devices/);
  assert.match(await page.locator('#shared-notes').innerText(), /Estimated scale/);
  const downloadEvent = page.waitForEvent('download');
  await page.locator('.level button').click();
  const download = await downloadEvent;
  const document = JSON.parse(readFileSync(await download.path(), 'utf8'));
  const expected = convertEasy(source, { now: document.created_at, toolVersion: TOOL_VERSION }).documents[0];
  assert.deepEqual(document, expected, 'download and CLI/core must be identical');
  assert.equal(document.model_version, 10);
  // Editing an input invalidates the old download immediately, even before
  // another conversion. A closure retained from a detached button is inert.
  await page.locator('.level button').evaluate(button => { window.oldDownload = button; });
  await page.locator('#paste').fill('type: wrong-card');
  assert.equal(await page.locator('#result').isVisible(), false);
  let staleDownloads = 0;
  const stale = () => { staleDownloads++; };
  page.on('download', stale);
  await page.evaluate(() => window.oldDownload.click());
  await page.locator('#convert-paste').click();
  assert.equal(await page.locator('#error').isVisible(), true);
  assert.match(await page.locator('#error-text').innerText(), /one type/);
  assert.equal(staleDownloads, 0); page.off('download', stale);
  // Slow source A resolves only after source B has been selected. It may not
  // restore A's result or replace B's error. No timer-dependent race fixture.
  await page.locator('#file').setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from(source) });
  await page.waitForFunction(() => typeof window.releaseSlowRead === 'function');
  await page.locator('#paste').fill('type: wrong-card');
  await page.locator('#convert-paste').click();
  await page.evaluate(() => window.releaseSlowRead());
  await page.waitForFunction(() => document.getElementById('busy').hidden);
  assert.equal(await page.locator('#result').isVisible(), false);
  assert.equal(await page.locator('#error').isVisible(), true);
  // A second delayed source is invalidated by a format switch too.
  await page.locator('#file').setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from(source) });
  await page.waitForFunction(() => typeof window.releaseSlowRead === 'function');
  await page.locator('#format').selectOption('sh3d');
  await page.evaluate(() => window.releaseSlowRead());
  assert.equal(await page.locator('#result').isVisible(), false);
  // Browser YAML path (not merely JSON), translated report, hostile text and
  // mobile form width. Input text can never create elements or network reads.
  await page.locator('#format').selectOption('easy');
  await page.locator('[data-lang=ru]').click();
  await page.locator('#paste').fill('type: custom:easy-floorplan-card\nwalls:\n  - {x1: 0, y1: 0, x2: 400, y2: 0}\ntexts:\n  - {x: 20, y: 30, text: "<img src=https://evil.invalid/x>"}\n');
  await page.locator('#convert-paste').click();
  await page.locator('#result').waitFor({ state: 'visible' });
  assert.match(await page.locator('#shared-notes').innerText(), /Нет ориентиров масштаба/);
  assert.equal(await page.locator('img').count(), 0);
  await page.setViewportSize({ width: 360, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: root('.build/easy-page.png'), fullPage: true });
  assert.deepEqual(requests, [], 'offline artifact must not request anything over the network');
  console.log('PASS #937: SH3D + Easy file/paste, YAML, download parity, source/input races, stale click, RU/EN, offline, 360px form');
} finally { await finish(browser, { converterArtifact: true }); }
