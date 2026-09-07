// #353 AC3b / #486: a proxy-cached stable entry that survived an update can
// point at a main chunk the manifest-gated server no longer serves. Before the
// fix a static edge aborted the whole module and the surface died silently;
// now both the card entry and the panel-through-card path leave a visible human
// message, while their awaited imports still settle successfully.
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { check, checkAll, finish } from './serve.mjs';

const cardEntry = readFileSync('dist/houseplan-card.js');
const panelEntry = readFileSync('dist/houseplan-panel.js');
const cardPage404 = `<!doctype html><meta charset="utf-8"><body><script type="module">
  await import('/assets/houseplan-card.js');
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card' });
  document.body.appendChild(card);
  window.__done = true;
<\/script></body>`;
const panelPage404 = `<!doctype html><meta charset="utf-8"><body><script type="module">
  await import('/assets/houseplan-panel.js');
  const panel = document.createElement('houseplan-panel');
  document.body.appendChild(panel);
  window.__done = true;
<\/script></body>`;

const run = async (locale, surface = 'card') => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ locale })).newPage();
  let pageErrors = 0;
  page.on('pageerror', (error) => { pageErrors++; console.log('EXC', error.message); });
  await page.route('**/*', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/stale.html') {
      return route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: surface === 'panel' ? panelPage404 : cardPage404,
      });
    }
    if (path === '/assets/houseplan-card.js') {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: cardEntry });
    }
    if (path === '/assets/houseplan-panel.js') {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: panelEntry });
    }
    // Every hashed chunk of the cached build is gone after the update.
    return route.fulfill({ status: 404, body: 'nf' });
  });
  await page.goto('http://demo.local/stale.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__done === true, { timeout: 9000 });
  const text = surface === 'panel'
    ? await page.locator('houseplan-panel').evaluate((panel) => (
      panel.shadowRoot?.querySelector('houseplan-card')?.textContent || panel.textContent || ''
    ))
    : await page.locator('houseplan-card').textContent();
  await browser.close();
  return { text, pageErrors };
};

const en = await run('en-US');
const ru = await run('ru-RU');
const fr = await run('fr-FR');
const panel = await run('en-US', 'panel');
const out = {
  entrySurvivesMissingChunk: en.pageErrors === 0 && ru.pageErrors === 0 && fr.pageErrors === 0,
  englishMessageVisible: en.text.includes('House Plan was updated')
    && en.text.includes('reload the page'),
  russianMessageVisible: ru.text.includes('House Plan обновился')
    && ru.text.includes('перезагрузите страницу'),
  frenchMessageVisible: fr.text.includes('House Plan a été mis à jour')
    && fr.text.includes('recharger la page'),
  panelEntrySurvivesMissingChunk: panel.pageErrors === 0,
  panelMessageVisible: panel.text.includes('House Plan was updated')
    && panel.text.includes('reload the page'),
};
checkAll(out);
// #407: до этого смок не мог провалиться в принципе. `check`/`checkAll`
// складывали неудачи в `_failures`, но их никто не печатал и код возврата не
// выставлял — ровно тот паттерн «печатали булевы значения и всегда выходили
// нулём», который описан в шапке serve.mjs как исправленный в 2026-07-27.
// Браузеры закрыты внутри run(), поэтому finish() получает undefined.
await finish(undefined, out);
