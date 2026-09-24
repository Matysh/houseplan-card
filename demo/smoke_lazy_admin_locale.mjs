// #627 AC4–AC7: ru/de/fr словарей пространств `settings`, `support`,
// `topology` — ленивые чанки. Смок идёт по production-бандлу: реальные
// загрузчики рантаймов, реальные retry-URL, журнал запросов и снимок текста
// каждого кадра (MutationObserver коммитит снимок на каждый рендер Lit).
//
// Контракт — тот же, что у de/fr основного каталога (#348): холодное открытие
// показывает только прежний индикатор загрузки рантайма и затем сразу язык
// пользователя; смена языка на лету держит прежний кадр (inert + aria-busy);
// отказ — английский в строках пространства, один тост, без вечной загрузки.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const NAMESPACE_CHUNKS = (manifest.lazyNamespaceLocaleFiles || []).map((path) => path.split('/').at(-1));
if (NAMESPACE_CHUNKS.length !== 9) throw new Error('bundle manifest has no nine namespace locale chunks');
const chunkName = (namespace, language) => {
  const name = NAMESPACE_CHUNKS.find((candidate) => candidate.startsWith(`${namespace}-${language}-`));
  if (!name) throw new Error(`namespace chunk ${namespace}-${language} is absent from the manifest`);
  return name;
};
const editorRuntimeName = manifest.files.map((file) => file.path.split('/').at(-1))
  .find((name) => /^houseplan-editor-runtime-[^/]+\.js$/.test(name));

const dictionary = (namespace, language) => JSON.parse(
  readFileSync(`src/i18n/${namespace}/${language}.json`, 'utf8'),
);
const plain = (value) => typeof value === 'string' && !/[{}]/.test(value);
/** English strings that must never be painted for `language` (translation differs). */
const englishLeaks = (namespaces, language) => namespaces.flatMap((namespace) => {
  const en = dictionary(namespace, 'en');
  const target = dictionary(namespace, language);
  return Object.keys(en).filter((key) => plain(en[key]) && en[key].length >= 12
    && target[key] !== en[key]).map((key) => en[key]);
});
const translated = (namespaces, language) => namespaces.flatMap((namespace) => {
  const en = dictionary(namespace, 'en');
  const target = dictionary(namespace, language);
  return Object.keys(target).filter((key) => plain(target[key]) && target[key].length >= 8
    && target[key] !== en[key]).map((key) => target[key]);
});
const rawKeys = (namespaces) => namespaces.flatMap((namespace) => Object.keys(dictionary(namespace, 'en'))
  .filter((key) => /[._]/.test(key) && key.length >= 6));

const requestsOf = (page) => {
  const requested = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname.split('/').at(-1)));
  return requested;
};
const count = (requested, name) => requested.filter((candidate) => candidate === name).length;
const namespaceRequests = (requested) => requested.filter((name) => NAMESPACE_CHUNKS.includes(name));

const delayChunk = (page, name, ms = 250) => page.route(`**/${name}*`, async (route) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
  await route.fallback();
});

/** Replace the demo card by a fresh one on `language` (config + HA profile). */
const replaceCard = async (page, language) => {
  await page.evaluate((lang) => {
    const old = window.__card;
    const host = document.getElementById('host');
    const config = { ...old._config, language: lang };
    const hass = { ...old.hass, language: lang, locale: { ...(old.hass.locale || {}), language: lang } };
    old.remove();
    const card = document.createElement('houseplan-card');
    card.setConfig(config);
    card.hass = hass;
    host.append(card);
    window.__card = card;
  }, language);
  await page.waitForFunction(() => window.__card?._model?.length > 0
    && window.__card._booting === false && !window.__card.hasAttribute('aria-busy'));
};

/** Snapshot the dialog text and host state on every committed render. */
const recordFrames = (page) => page.evaluate(() => {
  const card = window.__card;
  const root = card.renderRoot;
  window.__hpFrames = [];
  const snap = () => window.__hpFrames.push({
    busy: card.getAttribute('aria-busy') === 'true',
    inert: !!card.inert,
    lang: card.getAttribute('lang'),
    loading: !!root.querySelector('.editorloading'),
    dialogs: [...root.querySelectorAll('hp-dialog')]
      .map((dialog) => dialog.textContent.replace(/\s+/g, ' ').trim()),
  });
  window.__hpFrameObservers?.forEach((observer) => observer.disconnect());
  const tree = new MutationObserver(snap);
  tree.observe(root, { subtree: true, childList: true, characterData: true });
  const host = new MutationObserver(snap);
  host.observe(card, { attributes: true, attributeFilter: ['aria-busy', 'lang'] });
  window.__hpFrameObservers = [tree, host];
  snap();
});
const frames = (page) => page.evaluate(() => window.__hpFrames);

const dialogFrames = (list) => list.filter((frame) => frame.dialogs.some(Boolean));
const leaksIn = (frame, leaks, keys) => frame.dialogs.flatMap((text) => [
  ...leaks.filter((value) => text.includes(value)),
  ...keys.filter((key) => text.includes(key)),
]);
const hasTranslation = (frame, strings) => frame.dialogs.some((text) => strings.some((value) => text.includes(value)));

/** A wait that reports instead of throwing: a regression reads as a named check. */
const settled = (promise) => promise.then(() => true, () => false);

const out = {};

// --- AC4a: cold onboarding on ru — the first-run form ------------------------
{
  const { page, browser } = await launchColdView();
  const requested = requestsOf(page);
  await replaceCard(page, 'ru');
  out.ruViewRequestsNoNamespaceChunk = namespaceRequests(requested).length === 0;
  await delayChunk(page, chunkName('settings', 'ru'));
  await recordFrames(page);
  const strings = translated(['settings'], 'ru');
  await page.evaluate(async () => {
    const card = window.__card;
    card._onboardingShown = false;
    card._serverCfg = { ...card._serverCfg, spaces: [] };
    card._model = [];
    card.hass = { ...card.hass, floors: {}, areas: {} };
    card.requestUpdate();
    await card.updateComplete;
  });
  out.onboardingOpensInRussian = await settled(page.waitForFunction((values) => {
    const card = window.__card;
    const dialog = card._onboardingRuntime && card.renderRoot.querySelector('hp-dialog');
    return !!dialog && values.some((value) => dialog.textContent.includes(value));
  }, strings, { timeout: 5000 }));
  await page.waitForTimeout(80);
  const list = await frames(page);
  const withDialog = dialogFrames(list);
  const leaks = englishLeaks(['settings'], 'ru');
  const keys = rawKeys(['settings']);
  out.onboardingFirstDialogFrameIsRussian = withDialog.length > 0
    && hasTranslation(withDialog[0], strings) && leaksIn(withDialog[0], leaks, keys).length === 0;
  out.onboardingNoEnglishOrRawKeyInAnyFrame = list.every((frame) => leaksIn(frame, leaks, keys).length === 0)
    || list.flatMap((frame) => leaksIn(frame, leaks, keys)).slice(0, 3);
  // Cold open shows only the existing runtime-loading surface: no warm gate.
  out.onboardingColdOpenNeverBusy = list.every((frame) => !frame.busy && !frame.inert);
  out.onboardingSettingsRuRequestedOnce = count(requested, chunkName('settings', 'ru')) === 1;
  out.onboardingRequestsOnlySettings = namespaceRequests(requested)
    .every((name) => name === chunkName('settings', 'ru'));
  out.onboardingDoesNotLoadEditor = count(requested, editorRuntimeName) === 0;
  await browser.close();
}

// --- AC4b: cold «Общие настройки» on de (lazy main catalog too) --------------
{
  const { page, browser } = await launchColdView();
  const requested = requestsOf(page);
  await replaceCard(page, 'de');
  out.deViewRequestsNoNamespaceChunk = namespaceRequests(requested).length === 0;
  for (const namespace of ['settings', 'support', 'topology']) await delayChunk(page, chunkName(namespace, 'de'));
  await recordFrames(page);
  const strings = translated(['settings'], 'de');
  await page.evaluate(() => window.__card._openSettingsDialog());
  out.settingsOpensInGerman = await settled(page.waitForFunction((values) => {
    const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    return !!dialog && values.some((value) => dialog.textContent.includes(value));
  }, strings, { timeout: 5000 }));
  await page.waitForTimeout(80);
  const list = await frames(page);
  const withDialog = dialogFrames(list);
  const namespaces = ['settings', 'support', 'topology'];
  const leaks = englishLeaks(namespaces, 'de');
  const keys = rawKeys(namespaces);
  const firstDialog = list.indexOf(withDialog[0]);
  out.settingsFirstDialogFrameIsGerman = withDialog.length > 0
    && hasTranslation(withDialog[0], strings) && leaksIn(withDialog[0], leaks, keys).length === 0;
  out.settingsNoEnglishOrRawKeyInAnyFrame = list.every((frame) => leaksIn(frame, leaks, keys).length === 0)
    || list.flatMap((frame) => leaksIn(frame, leaks, keys)).slice(0, 3);
  out.settingsDelayShowsOnlyRuntimeIndicator = list.slice(0, firstDialog).some((frame) => frame.loading)
    && list.every((frame) => !frame.busy && !frame.inert);
  out.settingsRequestsEachGermanNamespaceOnce = namespaces
    .every((namespace) => count(requested, chunkName(namespace, 'de')) === 1);
  out.settingsRequestsNoOtherLanguage = namespaceRequests(requested)
    .every((name) => /^(settings|support|topology)-de-/.test(name));
  await browser.close();
}

// --- AC4c: cold device dialog on fr ------------------------------------------
{
  const { page, browser } = await launchColdView();
  const requested = requestsOf(page);
  await replaceCard(page, 'fr');
  await delayChunk(page, chunkName('settings', 'fr'));
  await recordFrames(page);
  const strings = translated(['settings'], 'fr');
  await page.evaluate(() => {
    const card = window.__card;
    const device = card._devices.find((candidate) => candidate.id === 'd_light1') || card._devices[0];
    card._openMarkerDialog(device);
  });
  out.deviceOpensInFrench = await settled(page.waitForFunction((values) => {
    const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="marker"]');
    return !!dialog && values.some((value) => dialog.textContent.includes(value));
  }, strings, { timeout: 5000 }));
  await page.waitForTimeout(80);
  const list = await frames(page);
  const withDialog = dialogFrames(list);
  const namespaces = ['settings', 'support', 'topology'];
  const leaks = englishLeaks(namespaces, 'fr');
  const keys = rawKeys(namespaces);
  out.deviceFirstDialogFrameIsFrench = withDialog.length > 0
    && hasTranslation(withDialog[0], strings) && leaksIn(withDialog[0], leaks, keys).length === 0;
  out.deviceNoEnglishOrRawKeyInAnyFrame = list.every((frame) => leaksIn(frame, leaks, keys).length === 0)
    || list.flatMap((frame) => leaksIn(frame, leaks, keys)).slice(0, 3);
  out.deviceColdOpenNeverBusy = list.every((frame) => !frame.busy && !frame.inert);
  out.deviceRequestsFrenchSettingsOnce = count(requested, chunkName('settings', 'fr')) === 1;
  await browser.close();
}

// --- AC5: live switch ru → de with «Общие настройки» open --------------------
{
  const { page, browser } = await launchColdView();
  const requested = requestsOf(page);
  await replaceCard(page, 'ru');
  const russian = translated(['settings'], 'ru');
  const german = translated(['settings'], 'de');
  await page.evaluate(() => window.__card._openSettingsDialog());
  await page.waitForFunction((values) => {
    const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    return !!dialog && values.some((value) => dialog.textContent.includes(value))
      && !window.__card.hasAttribute('aria-busy');
  }, russian);
  await delayChunk(page, chunkName('settings', 'de'));
  await recordFrames(page);
  await page.evaluate(() => {
    const card = window.__card;
    card._config = { ...card._config, language: 'de' };
    card.requestUpdate();
  });
  out.liveSwitchSettlesInGerman = await settled(page.waitForFunction((values) => {
    const card = window.__card;
    const dialog = card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    return !card.hasAttribute('aria-busy') && !!dialog
      && values.some((value) => dialog.textContent.includes(value));
  }, german, { timeout: 5000 }));
  await page.waitForTimeout(80);
  const list = await frames(page);
  const namespaces = ['settings', 'support', 'topology'];
  const leaks = englishLeaks(namespaces, 'de');
  const keys = rawKeys(namespaces);
  const busy = list.filter((frame) => frame.busy);
  out.liveSwitchHoldsPreviousFrameInertAndBusy = busy.length > 0
    && busy.every((frame) => frame.inert && hasTranslation(frame, russian));
  out.liveSwitchNoEnglishFlash = list.every((frame) => leaksIn(frame, leaks, keys).length === 0)
    || list.flatMap((frame) => leaksIn(frame, leaks, keys)).slice(0, 3);
  const last = list.at(-1);
  out.liveSwitchCommitsWholeGermanFrame = hasTranslation(last, german) && !hasTranslation(last, russian)
    && last.lang === 'de';
  out.liveSwitchRequestsGermanSettingsOnce = count(requested, chunkName('settings', 'de')) === 1;
  // A second card on the page reuses the page-scoped dictionary.
  const before = requested.length;
  await page.evaluate(() => {
    const first = window.__card;
    const second = document.createElement('houseplan-card');
    second.setConfig({ ...first._config, title: 'Zweite', language: 'de' });
    second.hass = first.hass;
    document.getElementById('host').append(second);
    window.__second = second;
  });
  await page.waitForFunction(() => window.__second?._model?.length > 0 && window.__second._booting === false);
  await page.evaluate(() => window.__second._openSettingsDialog());
  out.secondCardOpensInGerman = await settled(page.waitForFunction((values) => {
    const dialog = window.__second.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    return !!dialog && values.some((value) => dialog.textContent.includes(value));
  }, german, { timeout: 5000 }));
  out.secondCardReusesNamespaceChunks = namespaceRequests(requested.slice(before)).length === 0;
  await browser.close();
}

// --- AC6: both attempts of a namespace chunk fail ----------------------------
{
  const { page, browser } = await launchColdView();
  const requested = requestsOf(page);
  let warnings = 0;
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().includes('unable to load de locale')) warnings++;
  });
  await replaceCard(page, 'de');
  let attempts = 0;
  await page.route(`**/${chunkName('settings', 'de')}*`, async (route) => {
    attempts++;
    await route.abort('failed');
  });
  // The fallback is the English layer of the failed namespace only.
  const englishStrings = englishLeaks(['settings'], 'de');
  const supportGerman = translated(['support'], 'de');
  await page.evaluate(() => window.__card._openSettingsDialog());
  out.failureSettlesWithEnglishSettings = await settled(page.waitForFunction((values) => {
    const card = window.__card;
    const dialog = card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    return !card.hasAttribute('aria-busy') && !!dialog
      && values.some((value) => dialog.textContent.includes(value));
  }, englishStrings, { timeout: 5000 }));
  await page.waitForTimeout(120);
  const state = await page.evaluate((support) => {
    const card = window.__card;
    const dialog = card.renderRoot.querySelector('hp-dialog[data-kind="settings"]');
    return {
      inert: card.inert,
      lang: card.getAttribute('lang'),
      toast: card._toast,
      expectedToast: card._t('toast.locale_load_failed'),
      supportGerman: !!dialog && support.some((value) => dialog.textContent.includes(value)),
    };
  }, supportGerman);
  out.failureRetriesExactlyOnce = attempts === 2 && count(requested, chunkName('settings', 'de')) === 2;
  out.failureDialogWorksInEnglish = !state.inert;
  out.failureShowsOneLocaleToast = state.toast === state.expectedToast && !!state.expectedToast;
  out.failureWarnsOnce = warnings === 1;
  out.failureKeepsHostLanguage = state.lang === 'de';
  out.failureDoesNotSpreadToOtherNamespaces = state.supportGerman;
  await browser.close();
}

// --- AC7: View without editors requests nothing; Zigbee layer only topology --
{
  const { page, browser } = await launchColdView();
  const requested = requestsOf(page);
  const initial = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => new URL(entry.name).pathname.split('/').at(-1)));
  out.enViewRequestsNoNamespaceChunk = namespaceRequests(initial).length === 0;
  await page.evaluate(() => window.__card._requestMode('plan'));
  await page.waitForFunction(() => window.__card._mode === 'plan' && !!window.__card._editorRuntime);
  await page.waitForTimeout(80);
  out.enEditorRequestsNoNamespaceChunk = namespaceRequests(requested).length === 0;
  await browser.close();
}
{
  const { page, browser } = await launchColdView();
  const requested = requestsOf(page);
  await replaceCard(page, 'ru');
  await page.evaluate(async () => {
    const card = window.__card;
    card._serverCfg = {
      ...card._serverCfg,
      settings: { ...(card._serverCfg.settings || {}), zigbee_topology: { enabled: true, z2mBaseTopics: [] } },
    };
    card.requestUpdate();
    await card.updateComplete;
  });
  await page.waitForFunction(() => !!window.__card.renderRoot.querySelector('hp-zigbee-topology-overlay'));
  await page.waitForTimeout(300);
  out.zigbeeLayerRequestsTopologyRuOnce = count(requested, chunkName('topology', 'ru')) === 1;
  out.zigbeeLayerRequestsNothingElse = namespaceRequests(requested)
    .every((name) => name === chunkName('topology', 'ru'))
    && count(requested, editorRuntimeName) === 0;
  await browser.close();
}

checkAll(out);
await finish(null, out);
