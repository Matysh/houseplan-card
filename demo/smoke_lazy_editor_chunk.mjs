// #337: the display-only card must stay independent from the editor runtime.
// Exercise the production bundle, including its content-hashed retry URL.
import { readFileSync } from 'node:fs';
import { launchColdView, checkAll, finish } from './serve.mjs';

const manifest = JSON.parse(readFileSync('dist/houseplan-assets.json', 'utf8'));
const runtimePath = manifest.files
  .map((file) => file.path)
  .find((path) => /houseplan-editor-runtime-[^/]+\.js$/.test(path));
if (!runtimePath) throw new Error('editor runtime is absent from the bundle manifest');
const runtimeName = runtimePath.split('/').at(-1);
const runtimeUrlPattern = `**/${runtimeName}*`;
const runtimeFile = `demo/srv/assets/${runtimePath}`;
const onboardingPath = manifest.files
  .map((file) => file.path)
  .find((path) => /houseplan-onboarding-runtime-[^/]+\.js$/.test(path));
if (!onboardingPath) throw new Error('onboarding runtime is absent from the bundle manifest');
const onboardingName = onboardingPath.split('/').at(-1);

const clickEditor = async (page, index, mode) => {
  await page.locator('houseplan-card').evaluate((card, tabIndex) => {
    const root = card.shadowRoot || card.renderRoot;
    root.querySelectorAll('.modetab')[tabIndex]?.click();
  }, index);
  await page.waitForFunction((expected) => window.__card._mode === expected, mode);
  await page.waitForFunction(() => window.__card._modeTransitionBusy === false);
};

const { page, browser } = await launchColdView();
const requested = [];
page.on('request', (request) => requested.push(new URL(request.url()).pathname));
const initialResources = await page.evaluate(() => performance.getEntriesByType('resource')
  .map((entry) => new URL(entry.name).pathname));
const out = {
  editorAbsentBeforeIntent: !initialResources.some((path) => path.endsWith(`/${runtimeName}`)),
};

await clickEditor(page, 0, 'plan');
await clickEditor(page, 1, 'devices');
await clickEditor(page, 2, 'decor');
out.oneRuntimeRequestForAllEditors = requested.filter((path) => path.endsWith(`/${runtimeName}`)).length === 1;
out.allEditorsUseInstalledRuntime = await page.evaluate(() =>
  window.__card._editorRuntimeLoader.state === 'ready' && window.__card._mode === 'decor');

// Empty-install onboarding is a separate lazy surface. It may fetch its own
// dialog chunk, but must not fetch or install the editor until Save explicitly
// continues into Plan mode.
const onboarding = await launchColdView();
const onboardingRequests = [];
onboarding.page.on('request', (request) => {
  onboardingRequests.push(new URL(request.url()).pathname);
});
await onboarding.page.evaluate(async () => {
  const card = window.__card;
  card._onboardingShown = false;
  card._serverCfg = { ...card._serverCfg, spaces: [] };
  card._model = [];
  card.hass = { ...card.hass, floors: {}, areas: {} };
  card.requestUpdate();
  await card.updateComplete;
});
await onboarding.page.waitForFunction(() => {
  const card = window.__card;
  return card._onboardingRuntime && card.renderRoot.querySelector('hp-dialog');
});
out.onboardingUsesOwnChunk = onboardingRequests
  .filter((path) => path.endsWith(`/${onboardingName}`)).length === 1;
out.onboardingDoesNotLoadEditor = onboardingRequests
  .every((path) => !path.endsWith(`/${runtimeName}`))
  && await onboarding.page.evaluate(() => !window.__card._editorRuntime);
await onboarding.page.evaluate(async () => {
  const card = window.__card;
  const root = card.renderRoot;
  // #600: онбординг рисует ту же форму, что редактор; поле имени — по id,
  // карточка «Нарисовать» — по смыслу (порядок §4.2: draw → file).
  const title = root.querySelector('hp-dialog #onboarding-space-title');
  title.value = 'Cold onboarding';
  title.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await card.updateComplete;
  [...root.querySelectorAll('hp-dialog input[name="plansrc"]')]
    .find((radio) => radio.closest('label')?.textContent.includes(card._t('space.source_draw')))?.click();
  await card.updateComplete;
  const buttons = [...root.querySelectorAll('hp-dialog button')];
  buttons.find((button) => button.textContent.includes(card._t('btn.save')))?.click();
});
await onboarding.page.waitForFunction(() => {
  const card = window.__card;
  return card._editorRuntime && card._mode === 'plan'
    && card._serverCfg.spaces.some((space) => space.title === 'Cold onboarding');
});
out.onboardingSaveContinuesToPlan = onboardingRequests
  .filter((path) => path.endsWith(`/${runtimeName}`)).length === 1;

const gui = await launchColdView();
out.guiEditorLoadsAsynchronously = await gui.page.evaluate(async () => {
  const ctor = customElements.get('houseplan-card');
  const editor = await ctor.getConfigElement();
  return editor?.localName === 'houseplan-card-editor';
});

// Two network failures end one load cycle, but are NOT terminal (#353): the
// loader re-arms and the next explicit press starts a fresh cycle that heals
// once the network is back. The retry inside a cycle is the same immutable
// chunk with a cache-busting query string.
const failed = await launchColdView();
let failedRequests = 0;
await failed.page.route(runtimeUrlPattern, async (route) => {
  failedRequests += 1;
  await route.abort('failed');
});
const pressEditor = () => failed.page.locator('houseplan-card').evaluate((card) => {
  const root = card.shadowRoot || card.renderRoot;
  root.querySelectorAll('.modetab')[0]?.click();
});
await pressEditor();
await failed.page.waitForFunction(() =>
  window.__card._editorRuntimeLoader.state === 'idle' && window.__card._toast);
out.networkFailureRetriesExactlyOnce = failedRequests === 2;
out.networkFailureKeepsViewWithRetryAdvice = await failed.page.evaluate(() => {
  const card = window.__card;
  return card._mode === 'view'
    && !card._editorRuntime
    && card._toast.includes(card._t('editor.load_failed'))
    && card._toast.includes(card._t('editor.retry_advice'));
});
await failed.page.unroute(runtimeUrlPattern);
await pressEditor();
await failed.page.waitForFunction(() =>
  window.__card._editorRuntimeLoader.state === 'ready' && window.__card._mode === 'plan');
out.secondPressAfterNetworkFailureOpensEditor = true;

// A valid module from a different build is no safer than a 404. Both attempts
// are fulfilled deliberately so this checks the fingerprint handshake rather
// than the network branch above.
const mismatch = await launchColdView();
let mismatchRequests = 0;
const incompatibleRuntime = readFileSync(runtimeFile, 'utf8')
  .replaceAll(manifest.fingerprint, `${manifest.fingerprint}-mismatch`);
await mismatch.page.route(runtimeUrlPattern, async (route) => {
  mismatchRequests += 1;
  await route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: incompatibleRuntime,
  });
});
await mismatch.page.locator('houseplan-card').evaluate((card) => {
  const root = card.shadowRoot || card.renderRoot;
  root.querySelectorAll('.modetab')[1]?.click();
});
await mismatch.page.waitForFunction(() => window.__card._editorRuntimeLoader.state === 'failed');
out.fingerprintMismatchRetriesExactlyOnce = mismatchRequests === 2;
out.fingerprintMismatchKeepsView = await mismatch.page.evaluate(() =>
  window.__card._mode === 'view' && !window.__card._editorRuntime
  && window.__card._toast.includes(window.__card._t('editor.refresh_advice')));

// #757: a render is not an intent. Surfaces the core opens without the
// runtime — the floor import wizard on an empty plan, a dialog a warm remount
// revives — keep asking for it on every repaint. One non-terminal failure is
// one cycle and one notice; the loader then waits for the next explicit
// intent, which still heals. The kiosk scale dialog left that list in #763:
// it needs no editor at all, so with the chunk refused it asks zero times.
const QUIET_MS = 8000;
const chunkRequests = async (session, name, plain = 'abort') => {
  const seen = [];
  session.page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith(`/${name}`)) seen.push(url.search || 'plain');
  });
  const net = { plain, retry: 'abort' };
  await session.page.route(`**/${name}*`, (route) => {
    const verdict = new URL(route.request().url()).search ? net.retry : net.plain;
    return verdict === 'abort' ? route.abort('failed') : route.fallback();
  });
  return { seen, net };
};
/** Toast nodes as the user sees them: each appearance is one notice. */
const installNoticeCounter = (page) => page.evaluate(() => {
  window.__hpWatchNotices = (card) => {
    window.__hpNotices = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && node.matches('[data-hp="toast"]')) window.__hpNotices += 1;
        }
      }
    }).observe(card.shadowRoot || card.renderRoot, { childList: true, subtree: true });
  };
});
const watchToasts = async (page, selector) => {
  await installNoticeCounter(page);
  await page.evaluate((cardSelector) => window.__hpWatchNotices(document.querySelector(cardSelector)), selector);
};
const notices = (page) => page.evaluate(() => window.__hpNotices);
/** `true`, or what actually happened — the count is the evidence. */
const exactly = (expected, actual, what) => actual === expected || `${actual} ${what} instead of ${expected}`;

// (a) Kiosk: a 3 s hold on the empty scene opens the per-screen size dialog
// without the editor (#763; full scenario in smoke_kiosk_scale_no_editor).
const kiosk = await launchColdView();
const kioskChunk = await chunkRequests(kiosk, runtimeName);
await kiosk.page.evaluate(async () => {
  const card = document.createElement('houseplan-card');
  card.id = 'hp-kiosk';
  card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  card.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:700px;z-index:99';
  card.hass = window.__card.hass;
  document.body.appendChild(card);
});
await kiosk.page.waitForFunction(() => {
  const card = document.querySelector('#hp-kiosk');
  return !card._booting && (card.shadowRoot || card.renderRoot).querySelector('.stage');
});
await watchToasts(kiosk.page, '#hp-kiosk');
await kiosk.page.evaluate(() => {
  const card = document.querySelector('#hp-kiosk');
  const stage = (card.shadowRoot || card.renderRoot).querySelector('.stage');
  const box = stage.getBoundingClientRect();
  stage.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, composed: true, cancelable: true, pointerId: 31, pointerType: 'touch',
    isPrimary: true, button: 0, buttons: 1,
    clientX: box.left + box.width / 2, clientY: box.top + box.height / 2,
  }));
});
await kiosk.page.waitForFunction(() => document.querySelector('#hp-kiosk')._kioskDialog === true, null, { timeout: 6000 });
await kiosk.page.waitForTimeout(QUIET_MS);
out.kioskDialogAsksNoChunk = exactly(0, kioskChunk.seen.length, 'chunk requests');
out.kioskDialogShowsNoNotice = exactly(0, await notices(kiosk.page), 'notices');
out.kioskDialogLoaderStaysIdle = await kiosk.page.evaluate(() => {
  const card = document.querySelector('#hp-kiosk');
  return card._editorRuntimeLoader.state === 'idle' && card._kioskDialog === true
    && !!(card.shadowRoot || card.renderRoot).querySelector('hp-dialog input[type="range"]');
});

// (b) Import wizard: an empty plan with HA floors opens it for an admin.
const wizard = await launchColdView();
const wizardChunk = await chunkRequests(wizard, onboardingName);
await watchToasts(wizard.page, 'houseplan-card');
await wizard.page.evaluate(() => window.__hpTest.setServerConfig((cfg) => ({ ...cfg, spaces: [] })));
await wizard.page.waitForFunction(() => !!window.__card._importDialog);
await wizard.page.waitForTimeout(QUIET_MS);
out.importWizardFailureIsOneCycle = exactly(2, wizardChunk.seen.length, 'chunk requests');
out.importWizardFailureIsOneNotice = exactly(1, await notices(wizard.page), 'notices');
out.importWizardLoaderWaitsForIntent = await wizard.page.evaluate(() =>
  window.__card._onboardingRuntimeLoader.state === 'idle' && !!window.__card._importDialog);
wizardChunk.net.retry = 'serve';
await wizard.page.evaluate(() => {
  const card = window.__card;
  (card.shadowRoot || card.renderRoot).querySelector('[data-hp="create-space"]')?.click();
});
await wizard.page.waitForFunction(() => window.__card._onboardingRuntimeLoader.state === 'ready');
out.createSpacePressAfterFailureHeals = true;

// (c) Warm remount: General settings revive on the new instance, offline. The
// plain chunk URL failed earlier in this page, so a cycle is one request —
// the cache-busting retry.
const warm = await launchColdView();
const warmChunk = await chunkRequests(warm, runtimeName);
warmChunk.net.retry = 'serve';
await warm.page.evaluate(() => {
  const card = window.__card;
  (card.shadowRoot || card.renderRoot).querySelector('[data-hp="settings"]')?.click();
});
await warm.page.waitForFunction(() => !!window.__card._settingsDialog && !!window.__card._editorRuntime);
await warm.page.waitForTimeout(300);
warmChunk.net.retry = 'abort';
const warmBefore = warmChunk.seen.length;
await installNoticeCounter(warm.page);
await warm.page.evaluate(() => {
  const old = window.__card;
  const host = old.parentNode;
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan', icon_size: 3.4 });
  card.hass = old.hass;
  old.remove();
  host.appendChild(card);
  window.__hpWatchNotices(card);
  window.__card = card;
});
await warm.page.waitForFunction(() => !!window.__card._settingsDialog);
await warm.page.waitForTimeout(QUIET_MS);
out.warmReviveFailureIsOneCycle = exactly(1, warmChunk.seen.length - warmBefore, 'chunk requests');
out.warmReviveFailureIsOneNotice = exactly(1, await notices(warm.page), 'notices');
out.warmReviveLoaderWaitsForIntent = await warm.page.evaluate(() =>
  window.__card._editorRuntimeLoader.state === 'idle' && !!window.__card._settingsDialog);
warmChunk.net.retry = 'serve';
await warm.page.evaluate(() => {
  const card = window.__card;
  (card.shadowRoot || card.renderRoot).querySelector('[data-hp="mode-tab"][data-mode="plan"]')?.click();
});
await warm.page.waitForFunction(() =>
  window.__card._editorRuntimeLoader.state === 'ready' && window.__card._mode === 'plan');
out.planTabAfterFailureHeals = true;

await kiosk.browser.close();
await wizard.browser.close();
await warm.browser.close();
await failed.browser.close();
await mismatch.browser.close();
await onboarding.browser.close();
await gui.browser.close();
checkAll(out);
await finish(browser, out);
