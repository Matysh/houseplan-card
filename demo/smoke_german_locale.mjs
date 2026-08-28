// #348: German is a page-shared lazy locale with a neutral render gate and bounded fallback.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const localePath = manifest.lazyLocaleFiles?.[0];
if (!localePath) throw new Error('German locale is absent from the bundle manifest');
const localeName = localePath.split('/').at(-1);
const localePattern = `**/${localeName}*`;

const replaceWithGermanCard = (suffix = '') => {
  const old = window.__card;
  const host = document.getElementById('host');
  const config = { ...old._config, title: `Deutsch${suffix}`, language: 'de' };
  const hass = { ...old.hass, language: 'de-DE', locale: { language: 'de-DE' } };
  old.remove();
  const card = document.createElement('houseplan-card');
  card.setConfig(config);
  card.hass = hass;
  host.append(card);
  window.__card = card;
};

const cold = await launchColdView();
const requested = [];
cold.page.on('request', (request) => requested.push(new URL(request.url()).pathname));
const resourcesBefore = await cold.page.evaluate(() => performance.getEntriesByType('resource')
  .map((entry) => new URL(entry.name).pathname));
await cold.page.route(localePattern, async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 250));
  await route.fallback();
});
await cold.page.evaluate(replaceWithGermanCard);
await cold.page.waitForTimeout(60);
const neutral = await cold.page.locator('houseplan-card').evaluate((card) => ({
  inert: card.inert,
  busy: card.getAttribute('aria-busy'),
  progress: !!card.renderRoot.querySelector('ha-circular-progress'),
  text: card.renderRoot.textContent.trim(),
}));
await cold.page.waitForFunction(() => window.__card?._model?.length > 0
  && window.__card._t('btn.save') === 'Speichern'
  && !window.__card.hasAttribute('aria-busy'));
const out = {
  englishColdViewDoesNotRequestGerman: !resourcesBefore.some((path) => path.endsWith(`/${localeName}`)),
  germanColdFrameIsNeutral: neutral.inert && neutral.busy === 'true'
    && neutral.progress && neutral.text === '',
  germanLoadsExactlyOnce: requested.filter((path) => path.endsWith(`/${localeName}`)).length === 1,
  germanCopyCommitsAtomically: await cold.page.evaluate(() =>
    window.__card._t('btn.save') === 'Speichern'
      && window.__card._t('btn.cancel') === 'Abbrechen'
      && window.__card._t('space.header') === 'Bereich'
      && window.__card.getAttribute('lang') === 'de'),
};

const beforeSecond = requested.length;
await cold.page.evaluate(replaceWithGermanCard, ' 2');
await cold.page.waitForFunction(() => window.__card?._model?.length > 0
  && window.__card._t('btn.save') === 'Speichern');
out.secondCardReusesPageLocale = requested.length === beforeSecond;

const failed = await launchColdView();
let failedRequests = 0;
let warnings = 0;
failed.page.on('console', (message) => {
  if (message.type() === 'warning' && message.text().includes('unable to load de locale')) warnings++;
});
await failed.page.route(localePattern, async (route) => {
  failedRequests++;
  await route.abort('failed');
});
await failed.page.evaluate(replaceWithGermanCard);
await failed.page.waitForFunction(() => window.__card?._model?.length > 0
  && !window.__card.hasAttribute('aria-busy')
  && window.__card._t('btn.save') === 'Save');
out.failureRetriesExactlyOnce = failedRequests === 2;
out.failureFallsBackAndUnblocks = await failed.page.evaluate(() =>
  !window.__card.inert && window.__card._t('btn.cancel') === 'Cancel'
    && window.__card.getAttribute('lang') === 'en');
out.failureWarnsOnce = warnings === 1;
// #354: the failed dictionary must be VISIBLE on the View card — a toast in
// the (English-fallback) locale, not only a console line.
out.failureShowsToast = await failed.page.evaluate(() =>
  window.__card._toast === window.__card._t('toast.locale_load_failed')
    && window.__card._t('toast.locale_load_failed').includes('language pack'));

await failed.browser.close();
checkAll(out);
await finish(cold.browser, out);
