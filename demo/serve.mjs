// Shared launcher for demo captures: starts headless Chromium serving demo/srv/
// via request interception (no HTTP server needed). Usage: const {page,browser}=await launch();
import { chromium } from 'playwright';
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
const ROOT = dirname(fileURLToPath(import.meta.url)) + '/srv';
// Корень репозитория, а не каталог раздачи: фингерпринт считается по
// src/** и demo/fixtures, которых внутри demo/srv нет (#236).
const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CT = { '.html': 'text/html', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
// ---- assertion harness (audit T1) --------------------------------------
// Until 2026-07-27 the smokes printed booleans and always exited 0: a broken
// build reported success. `check()` accumulates named failures, `finish()`
// prints them and sets the exit code.
const _failures = [];
let _pageErrors = 0;

/** Assert one named fact. `expected` defaults to true. */
export function check(name, actual, expected = true) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) _failures.push(`${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  return ok;
}

/** Assert a whole result object: every key must equal true unless listed. */
export function checkAll(out, expected = {}) {
  for (const [k, v] of Object.entries(out)) check(k, v, k in expected ? expected[k] : true);
  return out;
}

/** Print the result, report failures, close the browser, set the exit code. */
export async function finish(browser, out) {
  if (out !== undefined) console.log(JSON.stringify(out, null, 1));
  if (_pageErrors) _failures.push(`${_pageErrors} uncaught exception(s) inside the card`);
  await browser?.close?.();
  if (_failures.length) {
    console.error('\nFAILED (' + _failures.length + '):');
    for (const f of _failures) console.error('  - ' + f);
    process.exitCode = 1;
  } else {
    console.log('OK');
  }
}

export async function launch(
  viewport = { width: 820, height: 760 },
  scale = 1,
  browserArgs = [],
  contextOptions = {},
  serveRoot = ROOT,
) {
  const browser = await chromium.launch({ args: ['--no-sandbox', ...browserArgs] });
  const page = await (await browser.newContext({
    viewport, deviceScaleFactor: scale, ...contextOptions,
  })).newPage();
  // audit T1: an exception inside the card used to be logged and ignored
  page.on('pageerror', (e) => { _pageErrors++; console.log('EXC', e.message); });
  await page.route('**/*', (r) => {
    const u = new URL(r.request().url());
    let p = decodeURIComponent(u.pathname);
    if (p === '/') p = '/demo.html';
    const f = serveRoot + p;
    existsSync(f)
      ? r.fulfill({ status: 200, headers: { 'content-type': CT[p.slice(p.lastIndexOf('.'))] || 'application/octet-stream' }, body: readFileSync(f) })
      : r.fulfill({ status: 404, body: 'nf' });
  });
  await page.goto('http://demo.local/demo.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__card?._model?.length > 0, { timeout: 9000 });
  // Свежесть бандла проверяется здесь, а не в каждом смоке (#236). Смок читает
  // demo/srv/assets/houseplan-card.js; если туда не скопирован свежий dist,
  // проверяется прежняя версия карточки — и результат выглядит осмысленным,
  // потому что часть проверок краснеет, а часть зеленеет. На #234 это стоило
  // круга разбора: три проверки упали, четвёртая ложно прошла, поскольку старый
  // код одинаково врал в двух местах, которые сверялись друг с другом.
  // golden и бенчмарки эту защиту имели с самого начала, смоки — нет.
  await assertFreshDemoBundleUnlessAllowed(page, REPO_ROOT);
  // HP-1552: the first-open boot veil hides the plan (visibility:hidden) until
  // the stage height settles — real pointer interaction cannot hit a hidden
  // plan, so every smoke starts where the user does: with the plan revealed.
  await page.waitForFunction(() => window.__card._booting === false, { timeout: 9000 });
  // hass flows continuously in production; the stub sets it once — nudge a rebuild
  await page.evaluate(() => { const c = window.__card; c.hass = { ...c.hass }; });
  await page.waitForFunction(() => window.__card._devices.length > 0, { timeout: 9000 });
  return { page, browser };
}
