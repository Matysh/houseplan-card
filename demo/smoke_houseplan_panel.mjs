// #486: the custom sidebar panel is a thin, stable host around the existing card.
import { launchPanelCold, checkAll, finish } from './serve.mjs';
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';

const { page, browser } = await launchPanelCold({ width: 1280, height: 800 });
const coldBefore = await page.evaluate(() => ({
  coldStartsWithoutPanelDefinition: !customElements.get('houseplan-panel'),
  coldStartsWithoutCardDefinition: !customElements.get('houseplan-card'),
}));

// #488: reproduce Home Assistant's real mount, not the harness' convenient one.
// <ha-panel-custom> is a display:block element with safe-area padding and NO
// height, and HA assigns panel/hass/narrow/route to the element as soon as the
// module script fires `load` — before the top-level `await import()` in the
// entry has let the class define itself. Both facts left /houseplan empty.
const haSequence = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const waitFor = async (probe, label, timeout = 9000) => {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
      const value = probe();
      if (value) return value;
      await sleep(25);
    }
    throw new Error(`panel smoke timed out: ${label}`);
  };
  history.replaceState(null, '', '/houseplan');
  const root = document.documentElement;
  root.style.setProperty('--safe-area-inset-top', '10px');
  root.style.setProperty('--safe-area-inset-bottom', '6px');
  const host = document.getElementById('host');
  host.replaceChildren();
  host.style.cssText = 'width:100%;margin:0;padding:0;';
  // ha-panel-custom twin: exactly the inline styles HA's _createPanel sets.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:block;box-sizing:border-box;'
    + 'padding-top:var(--safe-area-inset-top);padding-bottom:var(--safe-area-inset-bottom);';
  host.append(wrapper);

  const hass = { ...window.__mkHass(), user: { id: 'writer', name: 'Writer', is_admin: false } };
  const panel = document.createElement('houseplan-panel');
  const assignedBeforeDefinition = !customElements.get('houseplan-panel');
  // HA's setCustomPanelProperties order.
  panel.panel = { component_name: 'houseplan-panel' };
  panel.hass = hass;
  panel.narrow = true;
  panel.route = { path: '/houseplan' };
  wrapper.append(panel);

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('panel module failed to load'));
    script.src = '/assets/houseplan-panel.js';
    document.body.append(script);
  });
  await customElements.whenDefined('houseplan-panel');
  const card = await waitFor(() => panel.shadowRoot?.querySelector('houseplan-card'), 'HA-sequence child');
  await waitFor(() => card.hass === hass, 'HA-sequence hass reaches the card');
  await waitFor(() => card._loadOk && card._model?.length && card._booting === false, 'HA-sequence view');
  await card.updateComplete;
  await frame(); await frame();

  const shadowing = ['panel', 'hass', 'narrow', 'route']
    .filter((key) => Object.prototype.hasOwnProperty.call(panel, key));
  const laterHass = { ...hass, themes: { darkMode: true } };
  panel.hass = laterHass;
  panel.narrow = false;
  await card.updateComplete;
  const cardRoot = card.shadowRoot || card.renderRoot;
  const panelRect = panel.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  const appbarRect = panel.shadowRoot.querySelector('.appbar').getBoundingClientRect();
  const headerRect = cardRoot.querySelector('.hdr').getBoundingClientRect();
  const stageRect = cardRoot.querySelector('.stage').getBoundingClientRect();
  const result = {
    haSequenceAssignsBeforeDefinition: assignedBeforeDefinition,
    haSequenceLeavesNoShadowingOwnProperties: shadowing.length === 0,
    haSequenceForwardsInitialHass: !!card.hass,
    haSequenceForwardsLaterHass: card.hass === laterHass,
    haSequenceAdoptsNarrowThroughAccessor: panel.narrow === false && !panel.hasAttribute('narrow'),
    haSequenceAdoptsRouteAndPanel: panel.route?.path === '/houseplan'
      && panel.panel?.component_name === 'houseplan-panel',
    autoHeightHostFillsViewportMinusInsets: Math.abs(panelRect.height - (innerHeight - 16)) <= 1
      && Math.abs(wrapperRect.height - innerHeight) <= 1,
    autoHeightHostKeepsPositiveStage: stageRect.height > 0 && stageRect.width > 0
      && Math.abs(stageRect.height + headerRect.height + appbarRect.height - panelRect.height) <= 1,
  };
  panel.remove();
  wrapper.remove();
  root.style.removeProperty('--safe-area-inset-top');
  root.style.removeProperty('--safe-area-inset-bottom');
  await frame();
  return result;
});
const result = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const waitFor = async (probe, label, timeout = 9000) => {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
      const value = probe();
      if (value) return value;
      await sleep(25);
    }
    throw new Error(`panel smoke timed out: ${label}`);
  };

  await import('/assets/houseplan-panel.js');
  await customElements.whenDefined('houseplan-panel');
  const Card = customElements.get('houseplan-card');
  const originalSetConfig = Card.prototype.setConfig;
  const panelSetConfigCalls = new WeakMap();
  Card.prototype.setConfig = function setConfig(config) {
    if (this.panelHost) panelSetConfigCalls.set(this, (panelSetConfigCalls.get(this) || 0) + 1);
    return originalSetConfig.call(this, config);
  };
  window.__hpPanelSetConfigCalls = (card) => panelSetConfigCalls.get(card) || 0;
  Card._warmBootReset?.();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('houseplan_card_')) localStorage.removeItem(key);
  }
  history.replaceState(null, '', '/houseplan');

  const host = document.getElementById('host');
  host.replaceChildren();
  host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0;';
  document.documentElement.style.height = '100%';
  document.body.style.height = '100%';

  const emptyHass = {
    ...window.__mkHass(),
    user: { id: 'readonly', name: 'Readonly', is_admin: false },
    callWS: async (message) => {
      if (message.type === 'houseplan/config/get') {
        return { config: { spaces: [], markers: [], settings: {} }, rev: 1, can_write: false };
      }
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      if (message.type === 'houseplan/trail/get') return { trails: {} };
      if (message.type === 'config/device_registry/list') return [];
      if (message.type === 'config/entity_registry/list') return [];
      if (message.type === 'config_entries/get' || message.type === 'manifest/list') return [];
      return { ok: true };
    },
  };
  window.__hpPanelEmptyHass = emptyHass;
  const emptyPanel = document.createElement('houseplan-panel');
  emptyPanel.narrow = true;
  emptyPanel.route = { path: '/houseplan' };
  emptyPanel.panel = { component_name: 'houseplan-panel' };
  host.append(emptyPanel);
  emptyPanel.hass = emptyHass;
  const emptyCard = await waitFor(
    () => emptyPanel.shadowRoot?.querySelector('houseplan-card'), 'empty child',
  );
  await waitFor(() => emptyCard._loadOk && emptyCard._serverCanWrite === false, 'empty snapshot');
  await emptyCard.updateComplete;
  const emptyRoot = emptyCard.shadowRoot || emptyCard.renderRoot;
  const emptyText = emptyRoot.querySelector('.empty')?.textContent || '';
  const coldFrontendResources = performance.getEntriesByType('resource')
    .map((entry) => new URL(entry.name).pathname)
    .filter((path) => path.includes('/assets/houseplan-'));
  const readOnlyResult = {
    coldPanelEntryLoadsFirst: coldFrontendResources[0] === '/assets/houseplan-panel.js',
    coldPanelDefinesCardThroughItsOwnGraph: !!customElements.get('houseplan-card'),
    coldReadOnlyKeepsEditorAndOnboardingLazy: !coldFrontendResources.some(
      (path) => /houseplan-(?:editor|onboarding)-runtime/.test(path),
    ),
    readOnlyConfiguresChildOnce: window.__hpPanelSetConfigCalls(emptyCard) === 1,
    readOnlyHasNoCreateAction: !emptyRoot.querySelector('.empty button'),
    readOnlyExplainsRestriction: emptyText.includes('administrator'),
    readOnlyDoesNotOpenDialog: !emptyCard._spaceDialog && !emptyCard._importDialog,
    readOnlyDoesNotLoadEditorRuntime: !emptyCard._editorRuntime && !emptyCard._onboardingRuntime,
  };
  emptyPanel.remove();
  await frame();

  // Server write capability, not HA administrator status, owns onboarding.
  // Use an empty non-admin writer and prove one lazy dialog/runtime only.
  const emptyWriterHass = {
    ...emptyHass,
    floors: {},
    user: { id: 'writer', name: 'Writer', is_admin: false },
    callWS: async (message) => {
      if (message.type === 'houseplan/config/get') {
        return { config: { spaces: [], markers: [], settings: {} }, rev: 1, can_write: true };
      }
      return emptyHass.callWS(message);
    },
  };
  const writerPanel = document.createElement('houseplan-panel');
  writerPanel.route = { path: '/houseplan' };
  host.replaceChildren(writerPanel);
  writerPanel.hass = emptyWriterHass;
  const writerCard = await waitFor(
    () => writerPanel.shadowRoot?.querySelector('houseplan-card'), 'writer empty child',
  );
  await waitFor(
    () => writerCard._loadOk && writerCard._serverCanWrite === true
      && writerCard._onboardingRuntime && writerCard._spaceDialog,
    'writer onboarding',
  );
  await writerCard.updateComplete;
  const writerRoot = writerCard.shadowRoot || writerCard.renderRoot;
  writerPanel.hass = { ...emptyWriterHass, themes: { darkMode: true } };
  await writerCard.updateComplete;
  const onboardingImports = performance.getEntriesByType('resource')
    .map((entry) => new URL(entry.name).pathname)
    .filter((path) => path.includes('houseplan-onboarding-runtime')).length;
  const writerResult = {
    emptyNonAdminWriterCanCreate: !!writerRoot.querySelector('.empty button'),
    emptyWriterOpensOneOnboarding: writerRoot.querySelectorAll('hp-dialog').length === 1,
    emptyWriterLoadsOnboardingOnce: onboardingImports === 1,
    emptyWriterConfiguresChildOnce: window.__hpPanelSetConfigCalls(writerCard) === 1,
  };
  writerPanel.remove();
  await frame();

  Card._warmBootReset?.();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('houseplan_card_')) localStorage.removeItem(key);
  }
  localStorage.setItem('houseplan_card_nav_v1', JSON.stringify({ space: 'missing-space' }));
  const panel = document.createElement('houseplan-panel');
  panel.narrow = false;
  panel.route = { path: '/houseplan' };
  panel.panel = { component_name: 'houseplan-panel' };
  host.append(panel);
  const baseHass = {
    ...window.__mkHass(),
    user: { id: 'writer', name: 'Writer', is_admin: false },
  };
  panel.hass = baseHass;
  const card = await waitFor(() => panel.shadowRoot?.querySelector('houseplan-card'), 'populated child');
  await waitFor(() => card._loadOk && card._model?.length && card._booting === false, 'populated view');
  await card.updateComplete;
  await frame();

  const shellRoot = panel.shadowRoot;
  const cardRoot = card.shadowRoot || card.renderRoot;
  const childBefore = card;
  const updatedHass = { ...baseHass, themes: { ...(baseHass.themes || {}), darkMode: true } };
  panel.hass = updatedHass;
  panel.narrow = true;
  panel.narrow = false;
  panel.route = { path: '/houseplan', prefix: '/houseplan' };
  panel.panel = { component_name: 'houseplan-panel', config: { ignored: true } };
  await card.updateComplete;

  let menuEvents = 0;
  let menuDetail = null;
  panel.addEventListener('hass-toggle-menu', (event) => {
    menuEvents += 1;
    menuDetail = { bubbles: event.bubbles, composed: event.composed };
  });
  shellRoot.querySelector('.menu').click();

  const contentRect = shellRoot.querySelector('.content').getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const haCardRect = cardRoot.querySelector('ha-card').getBoundingClientRect();
  const headerRect = cardRoot.querySelector('.hdr').getBoundingClientRect();
  const viewStageRect = cardRoot.querySelector('.stage').getBoundingClientRect();
  const viewSpace = card._space;
  const viewBox = card._view;
  const fitEnvelope = card._baseVb();
  const layoutResult = {
    exactlyOneChild: shellRoot.querySelectorAll('houseplan-card').length === 1,
    propertiesDoNotRemount: shellRoot.querySelector('houseplan-card') === childBefore,
    populatedNonAdminWriterHasEditors: !!cardRoot.querySelector('[data-editor-navigation="plan"]'),
    missingLastSpaceFallsBackDeterministically: card._space !== 'missing-space'
      && card._model.some((space) => space.id === card._space),
    populatedWriterConfiguresChildOnce: window.__hpPanelSetConfigCalls(card) === 1,
    hassForwarded: card.hass === updatedHass,
    panelHostWithoutKiosk: card.panelHost === true && card._config?.kiosk !== true,
    noDuplicateProductTitle: !cardRoot.querySelector('.head > .title')
      && shellRoot.querySelectorAll('.title').length === 1,
    retainedCardNavigation: !!cardRoot.querySelector('[data-hp="space-tab"]')
      && !!cardRoot.querySelector('[data-editor-navigation="plan"]'),
    menuContract: menuEvents === 1 && menuDetail?.bubbles === true && menuDetail?.composed === true,
    menuAccessible: shellRoot.querySelector('.menu').getAttribute('aria-label') === 'Menu'
      && shellRoot.querySelector('.menu').getBoundingClientRect().width >= 44,
    appbarKeepsHeaderAndToolbarSemantics: shellRoot.querySelector('.appbar')?.tagName === 'HEADER'
      && !shellRoot.querySelector('.appbar').hasAttribute('role')
      && shellRoot.querySelector('.toolbar')?.getAttribute('role') === 'toolbar',
    noHorizontalOverflow: panel.scrollWidth - panel.clientWidth <= 1
      && shellRoot.querySelector('.page').scrollWidth - shellRoot.querySelector('.page').clientWidth <= 1,
    cardOwnsContentSlot: Math.abs(cardRect.height - contentRect.height) <= 1
      && Math.abs(haCardRect.height - contentRect.height) <= 1,
    viewStageUsesRemainingHeight: viewStageRect.height > 0
      && Math.abs(viewStageRect.height + headerRect.height - contentRect.height) <= 1,
    fitEnvelopeIsInsideOpeningView: !!viewBox
      && fitEnvelope[0] >= viewBox.x - 0.01
      && fitEnvelope[1] >= viewBox.y - 0.01
      && fitEnvelope[0] + fitEnvelope[2] <= viewBox.x + viewBox.w + 0.01
      && fitEnvelope[1] + fitEnvelope[3] <= viewBox.y + viewBox.h + 0.01,
    sectionsDefaultIsFull: JSON.stringify(card.getGridOptions()) === JSON.stringify({ columns: 'full' })
      && card.getCardSize() === 12,
  };

  const runtimeReady = await card._ensureEditorRuntime();
  cardRoot.querySelector('[data-editor-navigation="plan"]').click();
  await waitFor(() => card._mode === 'plan' && !card._modeTransitionBusy, 'animated editor enter');
  await card.updateComplete; await frame(); await frame();
  const editorStage = cardRoot.querySelector('.stage').getBoundingClientRect();
  const editorHeader = cardRoot.querySelector('.hdr').getBoundingClientRect();
  cardRoot.querySelector('[data-editor-navigation="view"]').click();
  await waitFor(() => card._mode === 'view' && !card._modeTransitionBusy, 'animated editor exit');
  await card.updateComplete; await frame(); await frame();
  const returnedViewStage = cardRoot.querySelector('.stage').getBoundingClientRect();
  cardRoot.querySelector('[data-editor-navigation="plan"]').click();
  await waitFor(() => card._mode === 'plan' && !card._modeTransitionBusy, 'second editor enter');
  const editorResult = {
    editorRuntimeLoads: runtimeReady && !!card._editorRuntime,
    editorKeepsPositiveStableStage: editorStage.width > 0 && editorStage.height > 0,
    editorStillFillsContent: Math.abs(editorStage.height + editorHeader.height - contentRect.height) <= 1,
    editorSwapReturnsToPositiveView: returnedViewStage.width > 0 && returnedViewStage.height > 0,
  };

  history.pushState(null, '', '/config/dashboard');
  window.dispatchEvent(new Event('location-changed'));
  await waitFor(() => card._mode === 'view', 'route departure reset');
  const routeResult = {
    routeDepartureReturnsToView: card._mode === 'view',
    routeDepartureKeepsSpace: card._space === viewSpace,
  };

  panel.remove();
  await frame();
  history.pushState(null, '', '/houseplan');
  const returnPanel = document.createElement('houseplan-panel');
  returnPanel.narrow = false;
  returnPanel.route = { path: '/houseplan' };
  returnPanel.panel = { component_name: 'houseplan-panel' };
  host.replaceChildren(returnPanel);
  returnPanel.hass = updatedHass;
  const returnCard = await waitFor(
    () => returnPanel.shadowRoot?.querySelector('houseplan-card'), 'route return child',
  );
  await waitFor(
    () => returnCard._loadOk && returnCard._model?.length && returnCard._booting === false,
    'route return view',
  );
  await waitFor(() => returnCard._devices?.length, 'route return devices');
  await returnCard.updateComplete;
  const returnResult = {
    routeReturnCreatesFreshPanelCard: returnCard !== childBefore,
    routeReturnRestoresSpaceInView: returnCard._space === viewSpace && returnCard._mode === 'view',
    routeReturnConfiguresFreshChildOnce: window.__hpPanelSetConfigCalls(returnCard) === 1,
  };

  returnPanel.remove();
  await frame();
  host.append(returnPanel);
  await returnCard.updateComplete;
  await frame();
  await waitFor(
    () => returnCard.renderRoot.querySelector('[data-hp="device"][data-id="d_temp"][tabindex="0"]'),
    'route return stage interactive',
  );
  const reconnectResult = {
    reconnectKeepsSingleChild: returnPanel.shadowRoot.querySelectorAll('houseplan-card').length === 1,
    reconnectKeepsChildIdentity: returnPanel.shadowRoot.querySelector('houseplan-card') === returnCard,
    reconnectDoesNotRepeatSetConfig: window.__hpPanelSetConfigCalls(returnCard) === 1,
  };

  window.__hpPanel = returnPanel;
  window.__hpPanelCard = returnCard;

  return {
    ...readOnlyResult,
    ...writerResult,
    ...layoutResult,
    ...editorResult,
    ...routeResult,
    ...returnResult,
    ...reconnectResult,
  };
});
await assertFreshDemoBundleUnlessAllowed(page);

// The panel contract is about real user activation, not HTMLElement.click().
// Exercise both pointer and keyboard paths through the open shadow root.
await page.evaluate(() => {
  window.__hpPanelMenuEvidence = { sources: [], events: [] };
  const panel = window.__hpPanel;
  const menu = panel.shadowRoot.querySelector('.menu');
  menu.addEventListener('click', (event) => {
    window.__hpPanelMenuEvidence.sources.push(event.isTrusted);
  }, { capture: true });
  panel.addEventListener('hass-toggle-menu', (event) => {
    window.__hpPanelMenuEvidence.events.push({
      bubbles: event.bubbles,
      composed: event.composed,
    });
  });
  const card = window.__hpPanelCard;
  const stageInteractive = card.renderRoot.querySelector(
    '.stage [data-hp="device"][data-id="d_temp"][tabindex="0"]',
  );
  window.__hpStageInteractive = stageInteractive;
  window.__hpStageEvidence = { moreInfo: 0 };
  panel.addEventListener('hass-more-info', () => { window.__hpStageEvidence.moreInfo += 1; });
});
const wideMenu = page.locator('houseplan-panel').locator('.menu');
await wideMenu.click();
await wideMenu.focus();
await page.keyboard.press('Enter');
await page.evaluate(() => window.__hpStageInteractive?.focus());
const stageFocused = await page.evaluate(() => (
  window.__hpPanelCard.renderRoot.activeElement === window.__hpStageInteractive
));
await page.keyboard.press('Enter');
const wideUserActivation = await page.evaluate(() => ({
  realSources: window.__hpPanelMenuEvidence.sources.every(Boolean),
  eventCount: window.__hpPanelMenuEvidence.events.length,
  validEvents: window.__hpPanelMenuEvidence.events.every(
    (event) => event.bubbles && event.composed,
  ),
  retainedStageInteractiveFocuses: !!window.__hpStageInteractive,
  retainedStageInteractiveActivates: !!window.__hpStageInteractive
    && (window.__hpPanelCard._infoCard?.id === window.__hpStageInteractive.dataset.id
      || window.__hpStageEvidence.moreInfo === 1),
  retainedStageInteractiveNamed: !!(
    window.__hpStageInteractive?.getAttribute('aria-label')
    || window.__hpStageInteractive?.getAttribute('title')
    || window.__hpStageInteractive?.textContent?.trim()
  ),
}));
wideUserActivation.retainedStageInteractiveFocuses &&= stageFocused;

// A real viewport resize must settle without a feedback loop or a page-wide
// horizontal scrollbar. Keep the populated panel mounted for this check.
await page.setViewportSize({ width: 320, height: 720 });
const resized = await page.evaluate(async () => {
  const card = window.__hpPanelCard;
  const panel = window.__hpPanel;
  panel.narrow = true;
  window.dispatchEvent(new Event('resize'));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await card.updateComplete;
  const rect = () => {
    const stage = card.renderRoot.querySelector('.stage').getBoundingClientRect();
    return { x: stage.x, y: stage.y, width: stage.width, height: stage.height };
  };
  const first = rect();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const second = rect();
  const delta = Math.max(...Object.keys(first).map((key) => Math.abs(first[key] - second[key])));
  return {
    narrowPopulatedNoHorizontalOverflow: document.documentElement.scrollWidth
      - document.documentElement.clientWidth <= 1
      && panel.scrollWidth - panel.clientWidth <= 1,
    narrowPopulatedPositiveStage: second.width > 0 && second.height > 0,
    narrowResizeSettles: delta <= 0.5,
  };
});

// Recreate the panel as the exact 320x720 read-only/empty state from AC7/AC10.
const narrowReadOnly = await page.evaluate(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (probe, timeout = 9000) => {
    const end = performance.now() + timeout;
    while (performance.now() < end) {
      const value = probe();
      if (value) return value;
      await wait(25);
    }
    throw new Error('panel smoke timed out: narrow read-only');
  };
  window.__hpPanel.remove();
  const panel = document.createElement('houseplan-panel');
  panel.narrow = true;
  panel.route = { path: '/houseplan' };
  panel.panel = { component_name: 'houseplan-panel' };
  document.getElementById('host').replaceChildren(panel);
  panel.hass = window.__hpPanelEmptyHass;
  const card = await until(() => panel.shadowRoot?.querySelector('houseplan-card'));
  await until(() => card._loadOk && card._serverCanWrite === false);
  await card.updateComplete;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const root = card.renderRoot;
  const content = panel.shadowRoot.querySelector('.content').getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const empty = root.querySelector('.empty');
  window.__hpPanel = panel;
  window.__hpPanelCard = card;
  window.__hpPanelMenuEvidence = { sources: [], events: [] };
  const menu = panel.shadowRoot.querySelector('.menu');
  menu.addEventListener('click', (event) => {
    window.__hpPanelMenuEvidence.sources.push(event.isTrusted);
  }, { capture: true });
  panel.addEventListener('hass-toggle-menu', (event) => {
    window.__hpPanelMenuEvidence.events.push({ bubbles: event.bubbles, composed: event.composed });
  });
  return {
    narrowReadOnlyNoHorizontalOverflow: document.documentElement.scrollWidth
      - document.documentElement.clientWidth <= 1
      && panel.scrollWidth - panel.clientWidth <= 1,
    narrowReadOnlyOwnsContentSlot: Math.abs(cardRect.height - content.height) <= 1,
    narrowReadOnlyNoCreateAction: !empty?.querySelector('button'),
    narrowReadOnlyNoRuntime: !card._editorRuntime && !card._onboardingRuntime,
    narrowReadOnlyOneHeading: panel.shadowRoot.querySelectorAll('[role="heading"]').length === 1
      && !root.querySelector('.head > .title'),
  };
});
const narrowMenu = page.locator('houseplan-panel').locator('.menu');
await narrowMenu.click();
await narrowMenu.focus();
await page.keyboard.press('Enter');
const narrowUserActivation = await page.evaluate(() => ({
  narrowMenuRealSources: window.__hpPanelMenuEvidence.sources.every(Boolean),
  narrowMenuEventCount: window.__hpPanelMenuEvidence.events.length,
  narrowMenuValidEvents: window.__hpPanelMenuEvidence.events.every(
    (event) => event.bubbles && event.composed,
  ),
}));

const finalResult = {
  ...coldBefore,
  ...haSequence,
  ...result,
  ...resized,
  ...narrowReadOnly,
  wideMenuRealSources: wideUserActivation.realSources,
  wideMenuEventCount: wideUserActivation.eventCount,
  wideMenuValidEvents: wideUserActivation.validEvents,
  retainedStageInteractiveFocuses: wideUserActivation.retainedStageInteractiveFocuses,
  retainedStageInteractiveActivates: wideUserActivation.retainedStageInteractiveActivates,
  retainedStageInteractiveNamed: wideUserActivation.retainedStageInteractiveNamed,
  ...narrowUserActivation,
};
checkAll(finalResult, {
  wideMenuEventCount: 2,
  narrowMenuEventCount: 2,
});
await finish(browser, finalResult);
