// #371: French is the second lazy locale — community-contributed dictionary
// (@OUARZA). This smoke pins the fr-specific wiring only: automatic selection
// from an fr-CA profile, one lazy chunk per page, and the initial graph free
// of French. The generic failure machinery (retry, fallback, render gate,
// failure toast) is locale-agnostic and stays proven by smoke_german_locale.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const frPath = manifest.files.map((f) => f.path).find((p) => /(?:^|\/)fr-[^/]+\.js$/.test(p));
if (!frPath) throw new Error('French locale chunk is absent from the bundle manifest');
const frName = frPath.split('/').at(-1);

const { page, browser } = await launchColdView();
const requested = [];
page.on('request', (r) => requested.push(new URL(r.url()).pathname));
const out = await page.evaluate(async (frChunk) => {
  const card = window.__card;
  const out = {};
  const waitFor = async (predicate, timeout = 8000) => {
    const started = Date.now();
    while (!predicate() && Date.now() - started < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return !!predicate();
  };
  // профиль HA fr-CA → французский, без явного выбора
  card.hass = { ...card.hass, locale: { ...card.hass.locale, language: 'fr-CA' } };
  card.requestUpdate();
  out.frenchCommits = await waitFor(() => card._t('btn.save') === 'Enregistrer');
  out.frenchTitleGlossary = card._t('space.header') === 'Espace';
  out.langAttrIsFr = await waitFor(() => card.getAttribute('lang') === 'fr');
  return out;
}, frName);
out.frChunkRequestedOnce = requested.filter((p) => p.endsWith(`/${frName}`)).length === 1;
out.initialGraphHasNoFrench = !manifest.initialViewFiles.some((p) => /(?:^|\/)fr-[^/]+\.js$/.test(p))
  && manifest.lazyLocaleFiles.some((p) => /(?:^|\/)fr-[^/]+\.js$/.test(p));
checkAll(out);
await finish(browser, out);
