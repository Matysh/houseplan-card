import { launchPanelCold, checkAll, finish } from './serve.mjs';
import { assertFreshDemoBundleUnlessAllowed } from './bundle-freshness.mjs';

const { page, browser } = await launchPanelCold();
try {
  const result = await page.evaluate(async () => {
    history.replaceState(null, '', '/houseplan?foreign=keep&hpkiosk=1&hpspace=2');
    const host = document.getElementById('host');
    host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0';
    const panel = document.createElement('houseplan-panel');
    panel.panel = { component_name: 'houseplan-panel' };
    const hass = window.__mkHass();
    const callWS = hass.callWS;
    window.__routeKioskCalls = [];
    panel.hass = { ...hass, callWS: async (message) => {
      window.__routeKioskCalls.push(message.type);
      return callWS(message);
    } };
    panel.narrow = false;
    panel.route = { prefix: '/houseplan', path: '' };
    host.replaceChildren(panel);
    await import('/assets/houseplan-panel.js');
    await customElements.whenDefined('houseplan-panel');
    const until = async (probe) => {
      const end = performance.now() + 10000;
      while (performance.now() < end) {
        if (probe()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error('route kiosk did not load');
    };
    await until(() => panel.shadowRoot?.querySelector('houseplan-card')?._loadOk);
    const card = panel.shadowRoot.querySelector('houseplan-card');
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.__routeKioskPanel = panel;
    window.__routeKioskUntil = until;
    window.__routeKioskNavigate = async (url, via = 'route', push = false) => {
      history[push ? 'pushState' : 'replaceState'](null, '', url);
      if (via === 'route') panel.route = {
        prefix: '/houseplan', path: location.pathname.slice('/houseplan'.length),
      };
      else window.dispatchEvent(new CustomEvent('location-changed', { detail: {} }));
      await card.updateComplete;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await card.updateComplete;
    };
    const originalSetConfig = card.setConfig;
    window.__routeKioskSetConfigs = 0;
    card.setConfig = function (config) {
      window.__routeKioskSetConfigs++;
      return originalSetConfig.call(this, config);
    };
    const header = card.renderRoot.querySelector('.hdr');
    return {
      coldUrlEntersKiosk: card._kiosk === true,
      coldUrlUsesKioskReloadSafety: card._config.kiosk !== true && card._versionReloadSafetySnapshot().viewOnly,
      coldUrlSelectsSecond: card._model.length >= 2 && card._space === card._model[1].id,
      coldUrlHidesOwnHeader: !header || getComputedStyle(header).display === 'none',
      coldUrlRetainsForeignQuery: new URLSearchParams(location.search).get('foreign') === 'keep',
    };
  });
  await assertFreshDemoBundleUnlessAllowed(page);
  Object.assign(result, await page.evaluate(async () => {
    const panel = window.__routeKioskPanel, card = panel.shadowRoot.querySelector('houseplan-card');
    const navigate = window.__routeKioskNavigate, hp = window.__hpTest;
    await hp.waitForWrites();
    await navigate('/houseplan');
    await hp.setServerConfig((cfg) => {
      cfg.spaces[0].name = 'Zulu'; cfg.spaces[1].name = 'Alpha';
      cfg.spaces.push({ ...structuredClone(cfg.spaces[0]), id: 'aaa-first-id', name: 'Middle', rooms: [] });
    });
    const ids = card._model.map((space) => space.id);
    const listed = [...card.renderRoot.querySelectorAll('[data-hp="space-tab"]')].map((tab) => tab.dataset.id);
    const config = card._serverCfg, model = card._model, epoch = card._cfgEpoch;
    const navBefore = localStorage.getItem('houseplan_card_nav_v1');
    const counts = () => window.__routeKioskCalls.filter((type) =>
      /houseplan\/(config|layout)\/(get|set)/.test(type));
    const baselineCalls = JSON.stringify(counts());
    const out = { ordinaryListIsPositionOracle: JSON.stringify(listed) === JSON.stringify(ids) && ids.length === 3 };
    for (const [name, url, index] of [
      ['pathFirst', '/houseplan/kiosk/1', 0],
      ['pathThird', '/houseplan/kiosk/3?foreign=a%26b', 2],
      ['pathWinsQuery', '/houseplan/kiosk/2?hpspace=3&hpkiosk=0', 1],
      ['querySecond', '/houseplan?foreign=a%26b&hpspace=02&hpkiosk=1', 1],
    ]) {
      await navigate(url, name === 'querySecond' ? 'event' : 'route');
      out[name] = card._kiosk && card._space === ids[index] && card._hasFixedFloor
        && [...card.renderRoot.querySelectorAll('[data-hp="mode-tab"]')]
          .every((tab) => tab.getClientRects().length === 0);
    }
    location.hash = '#space=' + ids[0];
    await new Promise((resolve) => setTimeout(resolve, 50));
    out.fixedHashCannotEscape = card._space === ids[1];
    const view = JSON.stringify(card._view), root = card.renderRoot.querySelector('ha-card');
    await navigate('/houseplan?foreign=changed&hpspace=02&hpkiosk=1#space=' + ids[0], 'event');
    out.foreignQueryKeepsFrame = card.renderRoot.querySelector('ha-card') === root
      && JSON.stringify(card._view) === view;
    card.hass = { ...card.hass };
    await card.updateComplete;
    out.noUrlDataReloadOrWrite = JSON.stringify(counts()) === baselineCalls;
    out.noRuntimeSetConfig = window.__routeKioskSetConfigs === 0;
    out.retainsOrderedModel = card._serverCfg === config && card._model === model && card._cfgEpoch === epoch;
    out.fixedDoesNotOverwriteOrdinaryNavigation = localStorage.getItem('houseplan_card_nav_v1') === navBefore;
    for (const value of ['', '0', '-1', '1.5', 'text', '999999999999999999999']) {
      await navigate('/houseplan?hpkiosk=1&hpspace=' + value, 'event');
      out['softFallback_' + (value || 'empty')] = card._kiosk && !card._hasFixedFloor
        && !card.renderRoot.querySelector('[data-fixed-floor-state="invalid"]');
    }
    await navigate('/houseplan/kiosk/3');
    await hp.setServerConfig((cfg) => { cfg.spaces.reverse(); });
    out.liveReorderResolvesPosition = card._space === card._model[2].id && card._hasFixedFloor;
    await hp.setServerConfig((cfg) => { cfg.spaces.pop(); });
    out.liveOutOfRangeBecomesAll = !card._hasFixedFloor && !card.renderRoot.querySelector('[role="alert"]');
    await hp.setServerConfig((cfg) => { cfg.spaces.push({ ...structuredClone(cfg.spaces[0]), id: 'added', rooms: [] }); });
    out.liveAddRestoresPosition = card._hasFixedFloor && card._space === 'added';
    await navigate('/houseplan/kiosk/1', 'event', true);
    await navigate('/houseplan/kiosk/2', 'event', true);
    return out;
  }));
  await page.goBack();
  await page.waitForFunction(() => window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card').routeKiosk.position === 1);
  result.backUsesPreviousIntent = await page.evaluate(() => {
    const card = window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card');
    return card._space === card._model[0].id;
  });
  await page.goForward();
  await page.waitForFunction(() => window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card').routeKiosk.position === 2);
  result.forwardUsesNextIntent = await page.evaluate(() => {
    const card = window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card');
    return card._space === card._model[1].id;
  });
  const touch = await page.context().newCDPSession(page);
  const swipe = async () => {
    const box = await page.locator('houseplan-panel houseplan-card .stage').boundingBox();
    const x = box.x + box.width - 20, y = box.y + box.height / 2;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (const dx of [25, 55, 90, 125]) {
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - dx, y, id: 1 }] });
    }
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => window.__hpTest.settled());
  };
  await page.evaluate(() => window.__routeKioskNavigate('/houseplan/kiosk/1'));
  const fixedSpace = await page.evaluate(() => window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card')._space);
  await swipe();
  result.nativeFixedSwipeStaysOnSpace = await page.evaluate((id) =>
    window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card')._space === id, fixedSpace);
  await page.evaluate(() => window.__routeKioskNavigate('/houseplan/kiosk'));
  const allSpace = await page.evaluate(() => window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card')._space);
  await swipe();
  result.nativeAllSpacesSwipeNavigates = await page.evaluate((id) =>
    window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card')._space !== id, allSpace);
  await touch.detach();
  await page.evaluate(() => window.__routeKioskNavigate('/houseplan'));
  result.removingRouteReturnsView = await page.evaluate(() => {
    const card = window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card');
    return card._mode === 'view' && !card._kiosk;
  });
  await page.locator('houseplan-panel [data-hp="mode-tab"][data-mode="devices"]').click();
  await page.waitForFunction(() => window.__routeKioskPanel.shadowRoot.querySelector('houseplan-card')._mode === 'devices');
  Object.assign(result, await page.evaluate(async () => {
    const panel = window.__routeKioskPanel, card = panel.shadowRoot.querySelector('houseplan-card');
    const out = {};
    const hp = window.__hpTest;
    const owner = await hp.openMarkerDialog();
    await hp.input(owner.querySelector('#marker-name'), 'Unfinished route draft');
    const writesBefore = window.__routeKioskCalls.filter((type) => type === 'houseplan/config/set').length;
    const confirmation = () => card.renderRoot.querySelector('hp-confirm hp-dialog');
    await window.__routeKioskNavigate('/houseplan/kiosk/1');
    await window.__routeKioskUntil(confirmation);
    out.dirtyRouteHeldWithCoherentUrl = card._mode === 'devices' && !card._kiosk
      && location.pathname === '/houseplan' && owner.isConnected;
    confirmation().querySelector('[data-hp="dialog-cancel"]').click();
    await hp.settled();
    out.keepDraftRetainsInput = owner.isConnected
      && owner.querySelector('#marker-name').value === 'Unfinished route draft'
      && location.pathname === '/houseplan' && !card._kiosk;
    await window.__routeKioskNavigate('/houseplan/kiosk/1');
    await window.__routeKioskUntil(confirmation);
    confirmation().querySelector('[data-hp="dialog-confirm"]').click();
    await window.__routeKioskUntil(() => card._kiosk);
    await hp.settled();
    out.discardResumesExactlyRequestedRoute = card._mode === 'view'
      && card._space === card._model[0].id && location.pathname === '/houseplan/kiosk/1'
      && !owner.isConnected && !card.renderRoot.querySelector('hp-confirm');
    out.discardDoesNotSaveDraft = writesBefore
      === window.__routeKioskCalls.filter((type) => type === 'houseplan/config/set').length;
    await window.__routeKioskNavigate('/houseplan');
    // Actual departure still ends an editor; internal path changes did not re-read data.
    await window.__hpTest.setMode('devices');
    history.replaceState(null, '', '/config');
    window.dispatchEvent(new CustomEvent('location-changed', { detail: {} }));
    await card.updateComplete;
    out.realDepartureStillEndsEditor = card._mode === 'view';
    const intent = card.routeKiosk;
    panel.remove();
    history.replaceState(null, '', '/houseplan/kiosk/3');
    window.dispatchEvent(new CustomEvent('location-changed', { detail: {} }));
    out.disconnectedHostIgnoresRoute = card.routeKiosk === intent;
    return out;
  }));
  const pendingRun = await launchPanelCold({ width: 360, height: 740 });
  try {
    Object.assign(result, await pendingRun.page.evaluate(async () => {
      history.replaceState(null, '', '/houseplan/kiosk/2');
      const hass = window.__mkHass(), original = hass.callWS;
      const response = await original({ type: 'houseplan/config/get' });
      const stale = structuredClone(response.config);
      stale.spaces.reverse();
      localStorage.setItem('houseplan_card_cfg_v1', JSON.stringify({ config: stale, rev: 0, layout: {} }));
      let release;
      const held = new Promise((resolve) => { release = resolve; });
      const panel = document.createElement('houseplan-panel');
      panel.hass = { ...hass, user: { id: 'readonly', is_admin: false }, callWS: async (message) => {
        if (message.type === 'houseplan/config/get') {
          await held;
          return { ...await original(message), can_write: false };
        }
        return original(message);
      } };
      panel.narrow = true;
      panel.route = { prefix: '/houseplan', path: '/kiosk/2' };
      const host = document.getElementById('host');
      host.style.cssText = 'width:100%;height:100vh;margin:0;padding:0';
      host.replaceChildren(panel);
      await import('/assets/houseplan-panel.js');
      await customElements.whenDefined('houseplan-panel');
      const until = async (probe) => {
        const deadline = performance.now() + 9000;
        while (!probe()) {
          if (performance.now() > deadline) throw new Error('authority/pending case did not settle');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      };
      const card = panel.shadowRoot.querySelector('houseplan-card');
      await until(() => card.renderRoot.querySelector('[data-fixed-floor-state="pending"]'));
      const out = {
        staleRosterCannotChoosePosition: card._model[0].id === stale.spaces[0].id
          && !card.renderRoot.querySelector('.stage'),
        pendingDoesNotLoadEditors: !card._editorRuntime && !card._onboardingRuntime,
      };
      release();
      await until(() => card._loadOk);
      await card.updateComplete;
      out.authoritativeOrderWinsCache = card._space === response.config.spaces[1].id
        && card._space !== stale.spaces[1].id;
      await window.__hpTest.setServerConfig({ spaces: [], markers: [], settings: {} });
      out.emptyReadOnlyKioskHasNoCreate = card._kiosk && !card._hasFixedFloor
        && !card.renderRoot.querySelector('.empty button')
        && !card._editorRuntime && !card._onboardingRuntime;
      const content = panel.shadowRoot.querySelector('.content').getBoundingClientRect();
      const empty = card.renderRoot.querySelector('.empty').getBoundingClientRect();
      out.narrowEmptyFillsAvailableContent = content.height > 0 && Math.abs(empty.bottom - content.bottom) <= 1;
      out.narrowHasNoDocumentOverflow = document.documentElement.scrollWidth <= innerWidth
        && document.documentElement.scrollHeight <= innerHeight;
      panel.hass = { ...hass, callWS: async (message) => {
        const reply = await original(message);
        return message.type === 'houseplan/config/get' ? { ...reply, can_write: true } : reply;
      } };
      await until(() => card._loadOk && card._canManageConfiguration);
      await window.__hpTest.settled();
      out.emptyAdminKioskDoesNotOfferSetup = card._kiosk
        && !card.renderRoot.querySelector('.empty button') && !card._importDialog && !card._spaceDialog;
      history.replaceState(null, '', '/houseplan');
      window.dispatchEvent(new CustomEvent('location-changed', { detail: {} }));
      await window.__hpTest.settled();
      card.renderRoot.querySelector('[data-hp="create-space"]').click();
      await until(() => card.renderRoot.querySelector('hp-dialog[data-kind="onboarding"]'));
      const creation = card.renderRoot.querySelector('hp-dialog[data-kind="onboarding"]');
      const floorImport = card.renderRoot.querySelector('hp-dialog[data-kind="import"]');
      out.emptyAdminUsesOnlyOnboardingRuntime = !!card._onboardingRuntime && !card._editorRuntime;
      history.replaceState(null, '', '/houseplan/kiosk');
      window.dispatchEvent(new CustomEvent('location-changed', { detail: {} }));
      await window.__hpTest.settled();
      out.kioskRetiresFirstRunFloorImport = !!floorImport && !floorImport.isConnected && !card._importDialog;
      out.kioskRetiresOnboardingOnlyDialog = card._kiosk && !creation.isConnected
        && !card._spaceDialog && !card._importDialog;
      return out;
    }));
    await assertFreshDemoBundleUnlessAllowed(pendingRun.page);
    await finish(pendingRun.browser, {});
  } finally { await pendingRun.browser.close(); }
  checkAll(result);
  await finish(browser, result);
} finally {
  await browser.close();
}
