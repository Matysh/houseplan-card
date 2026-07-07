// Shared launcher for demo captures: starts headless Chromium serving demo/srv/
// via request interception (no HTTP server needed). Usage: const {page,browser}=await launch();
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const ROOT = dirname(fileURLToPath(import.meta.url)) + '/srv';
const CT = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
export async function launch(viewport = { width: 820, height: 760 }, scale = 1) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport, deviceScaleFactor: scale })).newPage();
  page.on('pageerror', (e) => console.log('EXC', e.message));
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url());
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/demo.html';
    const f = ROOT + p;
    existsSync(f)
      ? r.fulfill({ status: 200, headers: { 'content-type': CT[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }, body: readFileSync(f) })
      : r.fulfill({ status: 404, body: 'nf' });
  });
  await page.goto('http://demo.local/demo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__card?._model?.length > 0, { timeout: 9000 });
  // hass flows continuously in production; the stub sets it once — nudge a rebuild
  await page.evaluate(() => { const c = window.__card; c.hass = { ...c.hass }; });
  await page.waitForFunction(() => window.__card._devices.length > 0, { timeout: 9000 });
  return { page, browser };
}
