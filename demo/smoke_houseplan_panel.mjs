// #486: the custom sidebar panel is a thin, stable host around the existing card.
import { launchColdView, checkAll, finish } from './serve.mjs';

const { page, browser } = await launchColdView({ width: 1280, height: 800 });
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
  window.__card.remove();
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
  const readOnlyResult = {
    readOnlyHasNoCreateAction: !emptyRoot.querySelector('.empty button'),
    readOnlyExplainsRestriction: emptyText.includes('administrator'),
    readOnlyDoesNotOpenDialog: !emptyCard._spaceDialog && !emptyCard._importDialog,
    readOnlyDoesNotLoadEditorRuntime: !emptyCard._editorRuntime && !emptyCard._onboardingRuntime,
  };
  emptyPanel.remove();
  await frame();

  Card._warmBootReset?.();
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('houseplan_card_')) localStorage.removeItem(key);
  }
  const panel = document.createElement('houseplan-panel');
  panel.narrow = false;
  panel.route = { path: '/houseplan' };
  panel.panel = { component_name: 'houseplan-panel' };
  host.append(panel);
  const baseHass = window.__mkHass();
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
  const layoutResult = {
    exactlyOneChild: shellRoot.querySelectorAll('houseplan-card').length === 1,
    propertiesDoNotRemount: shellRoot.querySelector('houseplan-card') === childBefore,
    hassForwarded: card.hass === updatedHass,
    panelHostWithoutKiosk: card.panelHost === true && card._config?.kiosk !== true,
    noDuplicateProductTitle: !cardRoot.querySelector('.head > .title')
      && shellRoot.querySelectorAll('.title').length === 1,
    retainedCardNavigation: !!cardRoot.querySelector('[data-hp="space-tab"]')
      && !!cardRoot.querySelector('[data-editor-navigation="plan"]'),
    menuContract: menuEvents === 1 && menuDetail?.bubbles === true && menuDetail?.composed === true,
    menuAccessible: shellRoot.querySelector('.menu').getAttribute('aria-label') === 'Menu'
      && shellRoot.querySelector('.menu').getBoundingClientRect().width >= 44,
    noHorizontalOverflow: panel.scrollWidth - panel.clientWidth <= 1
      && shellRoot.querySelector('.page').scrollWidth - shellRoot.querySelector('.page').clientWidth <= 1,
    cardOwnsContentSlot: Math.abs(cardRect.height - contentRect.height) <= 1
      && Math.abs(haCardRect.height - contentRect.height) <= 1,
    viewStageUsesRemainingHeight: viewStageRect.height > 0
      && Math.abs(viewStageRect.height + headerRect.height - contentRect.height) <= 1,
    sectionsDefaultIsFull: JSON.stringify(card.getGridOptions()) === JSON.stringify({ columns: 'full' })
      && card.getCardSize() === 12,
  };

  const runtimeReady = await card._ensureEditorRuntime();
  await card._requestMode('plan', false);
  await card.updateComplete;
  await frame();
  await frame();
  const editorStage = cardRoot.querySelector('.stage').getBoundingClientRect();
  const editorHeader = cardRoot.querySelector('.hdr').getBoundingClientRect();
  const editorResult = {
    editorRuntimeLoads: runtimeReady && card._mode === 'plan',
    editorKeepsPositiveStableStage: editorStage.width > 0 && editorStage.height > 0,
    editorStillFillsContent: Math.abs(editorStage.height + editorHeader.height - contentRect.height) <= 1,
  };

  history.pushState(null, '', '/config/dashboard');
  window.dispatchEvent(new Event('location-changed'));
  await card.updateComplete;
  history.pushState(null, '', '/houseplan');
  window.dispatchEvent(new Event('location-changed'));
  await card.updateComplete;
  const routeResult = {
    routeDepartureReturnsToView: card._mode === 'view',
    routeDepartureKeepsSpace: card._space === viewSpace,
  };

  panel.remove();
  await frame();
  host.append(panel);
  await card.updateComplete;
  const reconnectResult = {
    reconnectKeepsSingleChild: panel.shadowRoot.querySelectorAll('houseplan-card').length === 1,
    reconnectKeepsChildIdentity: panel.shadowRoot.querySelector('houseplan-card') === childBefore,
  };

  window.__hpPanel = panel;
  window.__hpPanelCard = card;

  return {
    ...readOnlyResult,
    ...layoutResult,
    ...editorResult,
    ...routeResult,
    ...reconnectResult,
  };
});

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
});
const wideMenu = page.locator('houseplan-panel').locator('.menu');
await wideMenu.click();
await wideMenu.focus();
await page.keyboard.press('Enter');
const wideUserActivation = await page.evaluate(() => ({
  realSources: window.__hpPanelMenuEvidence.sources.every(Boolean),
  eventCount: window.__hpPanelMenuEvidence.events.length,
  validEvents: window.__hpPanelMenuEvidence.events.every(
    (event) => event.bubbles && event.composed,
  ),
  retainedStageInteractive: !!window.__hpPanelCard.renderRoot.querySelector(
    '.stage [tabindex="0"], .stage button:not([disabled]), .stage [role="button"]',
  ),
}));

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
  ...result,
  ...resized,
  ...narrowReadOnly,
  wideMenuRealSources: wideUserActivation.realSources,
  wideMenuEventCount: wideUserActivation.eventCount,
  wideMenuValidEvents: wideUserActivation.validEvents,
  retainedStageInteractive: wideUserActivation.retainedStageInteractive,
  ...narrowUserActivation,
};
checkAll(finalResult, {
  wideMenuEventCount: 2,
  narrowMenuEventCount: 2,
});
await finish(browser, finalResult);
