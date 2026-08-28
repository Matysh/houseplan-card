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
  const title = root.querySelector('hp-dialog input.namein');
  title.value = 'Cold onboarding';
  title.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await card.updateComplete;
  const sources = root.querySelectorAll('hp-dialog input[name="plansrc"]');
  sources[1].click();
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

await failed.browser.close();
await mismatch.browser.close();
await onboarding.browser.close();
await gui.browser.close();
checkAll(out);
await finish(browser, out);
