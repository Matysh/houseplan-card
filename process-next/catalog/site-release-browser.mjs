/** Mount a release ZIP's unpacked bytes against the reference host, without HA. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { enforcePinnedBrowser, requirePinnedBrowser } from '../../scripts/browser-attestation.mjs';

const [source, archiveRoot] = process.argv.slice(2).map(path => resolve(path));
const fromSource = path => import(pathToFileURL(resolve(source, path)));
const { standaloneFixture } = await fromSource('demo/standalone/fixture.mjs');
const { createCoreProcess } = await fromSource('demo/standalone/core-process.mjs');
const { PLAN_ONLY_CAPABILITIES } = await fromSource('test-build/plan-capabilities.js');
const manifest = JSON.parse(readFileSync(resolve(archiveRoot, 'houseplan-standalone-manifest.json'), 'utf8'));
const contents = new Map(manifest.files.map(({ path }) => ['/editor/'+path, readFileSync(resolve(archiveRoot, path))]));
const origin = 'http://site-release.test';
requirePinnedBrowser('packaged standalone editor');
const core = await createCoreProcess({ config: standaloneFixture(), fingerprint: manifest.source.fingerprint, version: manifest.version });
let browser;
try {
  browser = await chromium.launch({ args: ['--no-sandbox'] });
  await enforcePinnedBrowser(browser);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [], unexpected = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html',
        body: '<!doctype html><meta charset="utf-8"><div id="host" style="height:760px"></div>' });
      if (url.pathname === '/standalone-host.js') return route.fulfill({ contentType: 'text/javascript',
        body: readFileSync(resolve(source, 'demo/standalone/host.js')) });
      if (url.pathname === '/standalone-core-rpc') return route.fulfill({ json: await core.rpc(route.request().postDataJSON()) });
      if (contents.has(url.pathname)) {
        const contentType = url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.ttf') ? 'font/ttf' : 'text/javascript';
        return route.fulfill({ contentType, body: contents.get(url.pathname) });
      }
    }
    unexpected.push(url.href);
    return route.abort();
  });
  await page.goto(origin);
  await page.evaluate(async ({ entry, capabilities }) => {
    const { mountHouseplan } = await import('/editor/'+entry);
    const { host } = (await import('/standalone-host.js')).createCorePlanHost(capabilities);
    window.__standaloneRelease = mountHouseplan(document.getElementById('host'), host,
      { language: 'en', darkMode: false });
    window.__standaloneReleaseCard = await window.__standaloneRelease.ready;
  }, { entry: manifest.entry, capabilities: PLAN_ONLY_CAPABILITIES });
  await page.waitForFunction(() => window.__standaloneReleaseCard?._loadOk &&
    !window.__standaloneReleaseCard?._booting, undefined, { timeout: 15000 });
  const state = await core.rpc({op:'snapshot'});
  assert.equal(state.result.haImported, false);
  assert.equal(await page.evaluate(() => window.__standaloneReleaseCard.hass === undefined &&
    !document.querySelector('home-assistant') && !customElements.get('ha-dialog')), true);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, []);
  console.log('Standalone archive mount and no-HA handshake passed');
} finally {
  try { await browser?.close(); }
  finally { await core.close(); }
}
