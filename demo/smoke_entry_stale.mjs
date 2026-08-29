// #353 AC3b: a proxy-cached entry `houseplan-card.js` that survived an update
// points at a main chunk the manifest-gated server no longer serves. Before
// the fix the static re-export aborted the whole module and the card died
// silently; now the entry defines a fallback element with a human message,
// and `await import(entry)` + `createElement(...).setConfig(...)` stays valid.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { check, checkAll } from './serve.mjs';

const entry = readFileSync('dist/houseplan-card.js');
const page404 = `<!doctype html><meta charset="utf-8"><body><script type="module">
  await import('/assets/houseplan-card.js');
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card' });
  document.body.appendChild(card);
  window.__done = true;
<\/script></body>`;

const run = async (locale, expected) => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ locale })).newPage();
  let pageErrors = 0;
  page.on('pageerror', (error) => { pageErrors++; console.log('EXC', error.message); });
  await page.route('**/*', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/stale.html') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: page404 });
    }
    if (path === '/assets/houseplan-card.js') {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: entry });
    }
    // Every hashed chunk of the cached build is gone after the update.
    return route.fulfill({ status: 404, body: 'nf' });
  });
  await page.goto('http://demo.local/stale.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__done === true, { timeout: 9000 });
  const text = await page.locator('houseplan-card').textContent();
  await browser.close();
  return { text, pageErrors };
};

const en = await run('en-US');
const ru = await run('ru-RU');
const fr = await run('fr-FR');
const out = {
  entrySurvivesMissingChunk: en.pageErrors === 0 && ru.pageErrors === 0 && fr.pageErrors === 0,
  englishMessageVisible: en.text.includes('House Plan was updated')
    && en.text.includes('reload the page'),
  russianMessageVisible: ru.text.includes('House Plan обновился')
    && ru.text.includes('перезагрузите страницу'),
  frenchMessageVisible: fr.text.includes('House Plan a été mis à jour')
    && fr.text.includes('recharger la page'),
};
checkAll(out);
check('smoke_entry_stale', Object.values(out).every(Boolean));
if (Object.values(out).every(Boolean)) console.log('OK');
