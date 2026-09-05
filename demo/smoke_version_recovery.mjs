// #462: the production full-card bundle owns version mismatch recovery in
// ordinary View and kiosk. The static space card deliberately does not.
import { launch, checkAll, finish } from './serve.mjs';

const ATTEMPT_KEY = 'houseplan-card:version-reload-target:v1';
const { page, browser } = await launch(
  { width: 900, height: 820 }, 1, [], { hasTouch: true },
);

const ordinary = await page.evaluate(async (attemptKey) => {
  const card = window.__card;
  const root = () => card.renderRoot || card.shadowRoot;
  const frame = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  const rect = (element) => {
    const box = element?.getBoundingClientRect();
    return box ? [box.x, box.y, box.width, box.height] : null;
  };
  const before = rect(root().querySelector('.stage'));
  sessionStorage.removeItem(attemptKey);
  window.__versionRecoveryReloads = [];
  card._reloadDocument = () => window.__versionRecoveryReloads.push({
    target: sessionStorage.getItem(attemptKey),
    kind: 'manual',
  });
  card._adoptConfigCapabilities({ integration_version: ' 462-browser-target ' });
  await card.updateComplete;
  await frame();
  const relation = card._versionRecovery.relation;
  const banner = root().querySelector('.version-recovery');
  const button = root().querySelector('.version-recovery-reload');
  const hostBox = card.getBoundingClientRect();
  const bannerBox = banner?.getBoundingClientRect();
  const buttonBox = button?.getBoundingClientRect();
  const hostStyle = getComputedStyle(card);
  // HTMLElement.click() is synthetic. The production trusted-event guard must
  // ignore it; the following keyboard/touch probes are real Playwright input.
  button?.click();
  return {
    before,
    after: rect(root().querySelector('.stage')),
    frontend: relation.frontend,
    relationKind: relation.kind,
    backend: relation.backend,
    bannerVisible: !!banner && getComputedStyle(banner).opacity !== '0',
    liveRegion: banner?.getAttribute('role') === 'status'
      && banner?.getAttribute('aria-live') === 'polite'
      && banner?.getAttribute('aria-atomic') === 'true',
    target: banner?.getAttribute('data-version-recovery-target'),
    bannerContained: !!bannerBox
      && bannerBox.left >= hostBox.left + 11.5
      && bannerBox.right <= hostBox.right - 11.5,
    fullCardContainingBlock: hostStyle.display === 'block' && hostStyle.position === 'relative',
    buttonMin44: !!buttonBox && buttonBox.width >= 44 && buttonBox.height >= 44,
    syntheticIgnored: window.__versionRecoveryReloads.length === 0,
  };
}, ATTEMPT_KEY);

await page.waitForTimeout(600);
const ordinaryAfterWait = await page.evaluate(() => ({
  reloads: window.__versionRecoveryReloads.length,
  stored: sessionStorage.getItem('houseplan-card:version-reload-target:v1'),
}));

await page.emulateMedia({ reducedMotion: 'reduce' });
await page.waitForTimeout(30);
const reducedMotion = await page.evaluate(() => {
  const card = window.__card;
  const banner = card.renderRoot.querySelector('.version-recovery');
  return {
    input: card._reducedMotion === true,
    animation: banner && getComputedStyle(banner).animationName,
  };
});
await page.emulateMedia({ reducedMotion: 'no-preference' });

const ordinaryStage = page.locator('#host houseplan-card').locator('.stage');
const stageBox = await ordinaryStage.boundingBox();
if (!stageBox) throw new Error('ordinary stage has no browser bounds');
await page.evaluate(() => {
  window.__versionStagePointerdowns = 0;
  window.__card.renderRoot.querySelector('.stage').addEventListener('pointerdown', () => {
    window.__versionStagePointerdowns++;
  }, { once: true });
});
await page.mouse.click(stageBox.x + 8, stageBox.y + 8);
const stagePointerdowns = await page.evaluate(() => window.__versionStagePointerdowns);

const ordinaryButton = page.locator('#host houseplan-card').locator('.version-recovery-reload');
await ordinaryButton.focus();
await page.keyboard.press('Enter');
await ordinaryButton.tap();
const trustedManual = await page.evaluate(() => ({
  reloads: window.__versionRecoveryReloads.length,
  focused: window.__card.renderRoot.activeElement?.classList.contains('version-recovery-reload') || false,
  stored: sessionStorage.getItem('houseplan-card:version-reload-target:v1'),
}));

const lazyToastWithBanner = await page.evaluate(async () => {
  const card = window.__card;
  const editorFailed = card._editorRuntimeLoader.options.failed;
  const onboardingFailed = card._onboardingRuntimeLoader.options.failed;
  if (!editorFailed || !onboardingFailed) throw new Error('lazy failure callbacks are unavailable');
  const clearToast = async () => {
    clearTimeout(card._toastTimer);
    card._toast = '';
    card.requestUpdate();
    await card.updateComplete;
  };
  await clearToast();
  editorFailed(new Error('terminal editor probe'), { terminal: true });
  onboardingFailed(new Error('terminal onboarding probe'), { terminal: true });
  await card.updateComplete;
  const terminalSuppressed = card._toast === ''
    && !card.renderRoot.querySelector('.toast');

  editorFailed(new Error('retryable editor probe'), { terminal: false });
  await card.updateComplete;
  const retryMessage = `${card._t('editor.load_failed')} ${card._t('editor.retry_advice')}`;
  const nonTerminalPreserved = card._toast === retryMessage
    && card.renderRoot.querySelector('.toast')?.textContent?.trim() === retryMessage;
  await clearToast();
  return { terminalSuppressed, nonTerminalPreserved };
});

const authoritativeClear = await page.evaluate(async () => {
  const card = window.__card;
  card._adoptConfigCapabilities({});
  await card.updateComplete;
  await new Promise((done) => setTimeout(done, 220));
  await card.updateComplete;
  return {
    relation: card._versionRecovery.relation.kind,
    backend: card._haIntegrationVersion,
    banner: !!card.renderRoot.querySelector('.version-recovery'),
  };
});

const configFailureAdoption = await page.evaluate(async () => {
  const base = window.__card;
  const accepted = structuredClone(base._serverCfg);
  if (!accepted?.spaces?.length) throw new Error('AC6 config fixture has no space');
  const probe = document.createElement('houseplan-card');
  probe.setConfig({ type: 'custom:houseplan-card', title: 'AC6 config probe', cycle: 0 });
  probe._serverCfg = accepted;
  probe._serverStorage = true;
  probe._loadOk = true;
  probe._cfgRev = base._cfgRev;
  probe._layout = structuredClone(base._layout);
  probe._layoutRev = base._layoutRev;
  probe._space = accepted.spaces[0].id;
  let configResponse = {
    config: accepted,
    rev: base._cfgRev + 100,
    integration_version: '462-config-before-layout-failure',
  };
  probe.hass = {
    ...base.hass,
    callWS: (message) => {
      if (message.type === 'houseplan/config/get') {
        return Promise.resolve(structuredClone(configResponse));
      }
      if (message.type === 'houseplan/layout/get') {
        return new Promise((_, reject) => setTimeout(
          () => reject(new Error('AC6 forced layout failure')), 0,
        ));
      }
      throw new Error(`unexpected AC6 request: ${message.type}`);
    },
  };
  const mount = document.createElement('div');
  mount.style.cssText = 'position:fixed;left:-2000px;top:0;width:800px;height:600px;visibility:hidden';
  document.body.appendChild(mount);
  mount.appendChild(probe);
  await probe.updateComplete;
  probe._adoptConfigCapabilities({ integration_version: 'stale-before-layout' });
  await probe._loadFromServer();
  clearTimeout(probe._loadRetryTimer);
  probe._loadRetryTimer = undefined;
  const setBeforeLayoutFailure = probe._haIntegrationVersion
      === '462-config-before-layout-failure'
    && probe._versionRecovery.relation.kind === 'mismatch'
    && probe._versionRecovery.banner?.phase === 'visible';

  probe._serverCfg = accepted;
  probe._cfgContentFingerprint = '';
  const rejected = structuredClone(accepted);
  rejected.spaces[0] = {
    ...rejected.spaces[0],
    title: `${rejected.spaces[0].title} AC6 rejected asset`,
  };
  configResponse = { config: rejected, rev: base._cfgRev + 101 };
  probe._signer.prepareImage = async () => false;
  await probe._reloadConfigOnly(true);
  const clearBeforeAssetFailure = probe._haIntegrationVersion === null
    && probe._versionRecovery.relation.kind === 'unknown'
    && probe._serverCfg.spaces[0].title === accepted.spaces[0].title;
  const toast = probe._toast;
  clearTimeout(probe._loadRetryTimer);
  mount.remove();
  return { setBeforeLayoutFailure, clearBeforeAssetFailure, toast };
});

const terminalToastWithoutBanner = await page.evaluate(async () => {
  const card = window.__card;
  clearTimeout(card._toastTimer);
  card._toast = '';
  card.requestUpdate();
  await card.updateComplete;
  card._editorRuntimeLoader.options.failed(
    new Error('terminal editor without banner probe'), { terminal: true },
  );
  await card.updateComplete;
  const expected = `${card._t('editor.load_failed')} ${card._t('editor.refresh_advice')}`;
  const preserved = card._toast === expected
    && card.renderRoot.querySelector('.toast')?.textContent?.trim() === expected;
  clearTimeout(card._toastTimer);
  card._toast = '';
  return { preserved };
});

const kioskSetup = await page.evaluate(async (attemptKey) => {
  const base = window.__card;
  sessionStorage.removeItem(attemptKey);
  const kiosk = document.createElement('houseplan-card');
  kiosk.setConfig({ type: 'custom:houseplan-card', title: 'Version kiosk', kiosk: true, cycle: 0 });
  window.__versionKioskReloads = [];
  kiosk._reloadDocument = () => window.__versionKioskReloads.push({
    target: sessionStorage.getItem(attemptKey),
    banner: kiosk._versionRecovery.banner?.phase || null,
  });
  kiosk.hass = base.hass;
  kiosk.style.cssText = 'position:fixed;inset:0;width:900px;height:820px;z-index:80';
  document.body.appendChild(kiosk);
  window.__versionKiosk = kiosk;
  if (!(await kiosk._ensureEditorRuntime())) throw new Error('kiosk editor runtime did not preload');
  const started = performance.now();
  while (!Object.values(kiosk._versionReloadSafetySnapshot()).every(Boolean)) {
    if (performance.now() - started > 9000) {
      throw new Error(`kiosk frame did not become safe: ${JSON.stringify(
        kiosk._versionReloadSafetySnapshot(),
      )}`);
    }
    await new Promise((done) => setTimeout(done, 30));
  }
  const device = kiosk._devices.find((item) => item.primary);
  if (!device) throw new Error('kiosk more-info fixture device missing');
  device.tapAction = 'more-info';
  window.__versionKioskDeviceId = device.id;
  window.__versionKioskMoreInfo = 0;
  kiosk.addEventListener('hass-more-info', () => window.__versionKioskMoreInfo++);
  return {
    safeInitially: Object.values(kiosk._versionReloadSafetySnapshot()).every(Boolean),
    deviceId: device.id,
  };
}, ATTEMPT_KEY);

const kioskDevice = page.locator('body > houseplan-card').locator(
  `[data-hp="device"][data-id="${kioskSetup.deviceId}"]`,
);
await page.evaluate(() => { window.__versionKiosk._cyclePausedUntil = 0; });
await kioskDevice.focus();
await page.keyboard.press('Enter');
const keyboardMoreInfo = await page.evaluate(() => ({
  fired: window.__versionKioskMoreInfo,
  paused: window.__versionKiosk._cyclePausedUntil > Date.now() + 59_000,
}));
await page.evaluate(() => { window.__versionKiosk._cyclePausedUntil = 0; });
await kioskDevice.tap();
const pointerMoreInfo = await page.evaluate(() => ({
  fired: window.__versionKioskMoreInfo,
  paused: window.__versionKiosk._cyclePausedUntil > Date.now() + 59_000,
}));
const programmaticMoreInfo = await page.evaluate(() => {
  const kiosk = window.__versionKiosk;
  kiosk._cyclePausedUntil = 0;
  kiosk._openMoreInfo(kiosk._devices.find((item) => item.id === window.__versionKioskDeviceId).primary);
  return {
    fired: window.__versionKioskMoreInfo,
    paused: kiosk._cyclePausedUntil > Date.now() + 59_000,
  };
});

const kioskGuards = await page.evaluate(async () => {
  const kiosk = window.__versionKiosk;
  const frontend = window.__card._versionRecovery._input?.frontendVersion
    || kiosk._versionRecovery._input?.frontendVersion;
  const wait = (ms) => new Promise((done) => setTimeout(done, ms));
  const results = {};
  const probe = async (name, block, unblock) => {
    block();
    const before = window.__versionKioskReloads.length;
    kiosk._adoptConfigCapabilities({ integration_version: `462-guard-${name}` });
    await wait(330);
    results[name] = window.__versionKioskReloads.length === before
      && !kiosk._versionRecovery.hasCurrentMismatchNotice;
    kiosk._adoptConfigCapabilities({ integration_version: frontend });
    unblock();
    await wait(20);
  };
  await probe('unsettled', () => { kiosk._loading = true; }, () => { kiosk._loading = false; });
  await probe('editor', () => { kiosk._mode = 'plan'; kiosk._editing = true; },
    () => { kiosk._mode = 'view'; kiosk._editing = false; });
  await probe('dialog', () => { kiosk._kioskDialog = true; }, () => { kiosk._kioskDialog = false; });
  await probe('configWrite', () => { kiosk._writesPending = 1; }, () => { kiosk._writesPending = 0; });
  await probe('physicalWrite', () => { kiosk._pendingPhysicalWrites.set('guard', Promise.resolve()); },
    () => { kiosk._pendingPhysicalWrites.delete('guard'); });
  await probe('layoutWrite', () => { kiosk._dirtyPos.add('guard'); }, () => { kiosk._dirtyPos.delete('guard'); });
  await probe('gesture', () => { kiosk._pointers.set(462, {}); }, () => { kiosk._pointers.delete(462); });
  await probe('pause', () => { kiosk._cyclePausedUntil = Date.now() + 60_000; },
    () => { kiosk._cyclePausedUntil = 0; });
  await probe('zoom', () => { kiosk._zoom = 1.5; }, () => { kiosk._zoom = 1; });
  return results;
});

const kioskAttempt = await page.evaluate(async (attemptKey) => {
  const kiosk = window.__versionKiosk;
  const target = '462-kiosk-target';
  kiosk._cyclePausedUntil = 0;
  kiosk._zoom = 1;
  kiosk._adoptConfigCapabilities({ integration_version: target });
  const started = performance.now();
  while (!window.__versionKioskReloads.length && performance.now() - started < 2000) {
    await new Promise((done) => setTimeout(done, 25));
  }
  return {
    target,
    stored: sessionStorage.getItem(attemptKey),
    reloads: window.__versionKioskReloads.slice(),
    banner: kiosk._versionRecovery.banner?.phase,
  };
}, ATTEMPT_KEY);

const remount = await page.evaluate(async ({ attemptKey, target }) => {
  const previous = window.__versionKiosk;
  const hass = previous.hass;
  previous.remove();
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 });
  window.__versionRemountReloads = 0;
  card._reloadDocument = () => window.__versionRemountReloads++;
  card.hass = hass;
  card.style.cssText = 'position:fixed;inset:0;width:900px;height:820px;z-index:80';
  document.body.appendChild(card);
  await new Promise((done) => setTimeout(done, 30));
  card._adoptConfigCapabilities({ integration_version: target });
  await card.updateComplete;
  await new Promise((done) => setTimeout(done, 400));

  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: card._space });
  staticCard.hass = hass;
  document.body.appendChild(staticCard);
  await staticCard.updateComplete;
  return {
    stored: sessionStorage.getItem(attemptKey),
    banner: card._versionRecovery.banner?.phase,
    reloads: window.__versionRemountReloads,
    staticOwnsNoController: !('_versionRecovery' in staticCard),
    staticHasNoBanner: !staticCard.renderRoot?.querySelector('.version-recovery'),
    staticHostUnaffected: getComputedStyle(staticCard).position !== 'relative'
      && getComputedStyle(staticCard).display !== 'block',
  };
}, { attemptKey: ATTEMPT_KEY, target: kioskAttempt.target });

const sameRect = (a, b) => Array.isArray(a) && Array.isArray(b)
  && a.length === b.length && a.every((value, index) => Math.abs(value - b[index]) < 0.1);
const out = {
  ordinaryMismatchKnown: ordinary.relationKind === 'mismatch'
    && ordinary.backend === '462-browser-target',
  ordinaryBannerVisible: ordinary.bannerVisible && ordinary.liveRegion
    && ordinary.target === '462-browser-target' && ordinary.bannerContained,
  ordinaryHostOwnsBannerContainingBlock: ordinary.fullCardContainingBlock,
  ordinaryStageDoesNotMove: sameRect(ordinary.before, ordinary.after),
  ordinaryButtonAccessible: ordinary.buttonMin44 && ordinary.syntheticIgnored,
  ordinaryReducedMotionAndStageInput: reducedMotion.input
    && reducedMotion.animation === 'none' && stagePointerdowns === 1,
  ordinaryNeverAutoReloads: ordinaryAfterWait.reloads === 0 && ordinaryAfterWait.stored === null,
  trustedKeyboardAndTouchReload: trustedManual.reloads === 2
    && trustedManual.focused && trustedManual.stored === null,
  configGetClearsStaleVersion: authoritativeClear.relation === 'unknown'
    && authoritativeClear.backend === null && !authoritativeClear.banner,
  configCapabilitiesSurviveSiblingFailures:
    configFailureAdoption.setBeforeLayoutFailure
    && configFailureAdoption.clearBeforeAssetFailure,
  terminalLazyToastSuppressedOnlyWithBanner: lazyToastWithBanner.terminalSuppressed
    && lazyToastWithBanner.nonTerminalPreserved && terminalToastWithoutBanner.preserved,
  kioskSettledFixtureIsSafe: kioskSetup.safeInitially,
  keyboardMoreInfoPauses: keyboardMoreInfo.fired === 1 && keyboardMoreInfo.paused,
  pointerMoreInfoPauses: pointerMoreInfo.fired === 2 && pointerMoreInfo.paused,
  programmaticMoreInfoPauses: programmaticMoreInfo.fired === 3 && programmaticMoreInfo.paused,
  everyConcreteKioskGuardBlocks: Object.values(kioskGuards).every(Boolean),
  kioskAttemptMarkedBeforeReload: kioskAttempt.stored === kioskAttempt.target
    && kioskAttempt.reloads.length === 1
    && kioskAttempt.reloads[0].target === kioskAttempt.target
    && kioskAttempt.reloads[0].banner === 'visible'
    && kioskAttempt.banner === 'visible',
  sameTargetRemountIsManualOnly: remount.stored === kioskAttempt.target
    && remount.banner === 'visible' && remount.reloads === 0,
  spaceCardUnaffected: remount.staticOwnsNoController && remount.staticHasNoBanner
    && remount.staticHostUnaffected,
};
checkAll(out);
await finish(browser, {
  ...out, reducedMotion, stagePointerdowns, kioskGuards, configFailureAdoption,
});
