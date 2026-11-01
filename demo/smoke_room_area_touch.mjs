// #1128: real touch hits in the former invisible Area-shortcut rectangle.
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('room Area touch ownership');
const out = {};
for (const width of [390, 820]) {
  const { page, browser } = await launchColdView({ width, height: 844 }, 1, [], { hasTouch: true, isMobile: true });
  try {
    await page.evaluate(async width => {
      const c = window.__card;
      c.panelHost = true;
      c.style.cssText = `position:fixed;inset:0;width:${width}px;height:844px`;
      c.requestUpdate(); await c.updateComplete;
      await new Promise(resolve => setTimeout(resolve, 500));
      window.__area1128 = { navigation: [], services: [], original: structuredClone(c._layout) };
      history.pushState = (...args) => window.__area1128.navigation.push(args[2]);
      c.hass = { ...c.hass, callService: async (...args) => window.__area1128.services.push(args) };
      await window.__hpTest.setServerConfig(cfg => {
        cfg.spaces[0].settings = { ...cfg.spaces[0].settings, show_names: true };
        return cfg;
      });
      await window.__hpTest.settled();
    }, width);
    const point = await page.evaluate(() => {
      const c = window.__card, button = c.renderRoot.querySelector('[data-hp="room-area-link"]');
      const name = button.parentElement.querySelector('.rlfit'), r = name.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(button.parentElement).columnGap);
      const p = { x: r.right + gap + 38, y: r.top + r.height / 2 };
      const stage = c._stageEl.getBoundingClientRect(), v = c._screenToVb(p.x - stage.left, p.y - stage.top), b = c._baseVb();
      window.__area1128.position = { x: (v[0] - b[0]) / b[2], y: (v[1] - b[1]) / b[3] };
      return p;
    });
    out[`${width}:touch-shortcut-has-no-hit-floor`] = await page.evaluate(() => {
      const node = window.__card.renderRoot.querySelector('[data-hp="room-area-link"]');
      const s = getComputedStyle(node), r = node.getBoundingClientRect();
      return matchMedia('(hover: none)').matches && s.pointerEvents === 'none' && r.width <= 1 && r.height <= 1;
    });
    await page.evaluate(async () => {
      const c = window.__card, rev = window.__pushServerLayout({ ...c._layout,
        d_light1: { ...window.__area1128.position, s: c._space } });
      while (c._layoutRev < rev) await new Promise(resolve => setTimeout(resolve, 20));
      await window.__hpTest.settled();
    });
    const core = page.locator('houseplan-card .dev[data-id="d_light1"] .device-core');
    await core.tap();
    out[`${width}:device-receives-native-tap`] = await page.evaluate(() => window.__area1128.services.length === 1 && window.__area1128.navigation.length === 0);
    await page.evaluate(async () => {
      const c = window.__card, rev = window.__pushServerLayout(window.__area1128.original);
      while (c._layoutRev < rev) await new Promise(resolve => setTimeout(resolve, 20));
      await window.__hpTest.setServerConfig(cfg => {
        cfg.spaces[0].stairs = [{ id: 'area-touch-1128', kind: 'straight', ...window.__area1128.position,
          width: .08, length: .16, angle: 0, direction: 'forward', target_space_id: cfg.spaces[1].id }];
        return cfg;
      });
      await window.__hpTest.settled();
    });
    const originalSpace = await page.evaluate(() => window.__card._space);
    // Existing View-menu closing must consume the physical outside press.
    await page.evaluate(async () => {
      const c = window.__card, r = c._stageEl.getBoundingClientRect();
      const v = c._screenToVb(r.width - 60, r.height - 60), b = c._baseVb();
      const rev = window.__pushServerLayout({ ...c._layout, d_temp: {
        s: c._space, x: (v[0] - b[0]) / b[2], y: (v[1] - b[1]) / b[3] } });
      while (c._layoutRev < rev) await new Promise(resolve => setTimeout(resolve, 20));
      await window.__hpTest.settled();
    });
    await page.locator('houseplan-card .dev[data-id="d_temp"] .device-core').click({ button: 'right' });
    const menu = page.locator('houseplan-card [data-hp="device-context-menu"]:not([inert])');
    await menu.waitFor({ state: 'visible' });
    const menuBox = await menu.boundingBox();
    if (point.x >= menuBox.x && point.x <= menuBox.x + menuBox.width && point.y >= menuBox.y && point.y <= menuBox.y + menuBox.height) throw new Error('Fixture outside point is inside menu');
    await page.touchscreen.tap(point.x, point.y);
    await menu.waitFor({ state: 'detached' });
    await page.waitForTimeout(450);
    out[`${width}:outside-dismiss-does-not-use-stair`] = await page.evaluate(id => window.__card._space === id && !window.__card._markerDialog && window.__area1128.navigation.length === 0, originalSpace);
    await page.touchscreen.tap(point.x, point.y);
    await page.waitForTimeout(450);
    out[`${width}:next-native-tap-uses-stair`] = await page.evaluate(id => window.__card._space !== id && window.__area1128.navigation.length === 0, originalSpace);
    await page.evaluate(async id => {
      await window.__hpTest.switchSpace(id);
      await window.__hpTest.setServerConfig(cfg => { cfg.spaces[0].stairs = []; return cfg; });
      await window.__hpTest.settled();
      window.__area1128.camera = JSON.stringify(window.__card._view);
    }, originalSpace);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    for (let step = 1; step <= 5; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - step * 9, y: point.y + step * 4 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(450);
    out[`${width}:former-link-floor-allows-pan`] = await page.evaluate(() => window.__area1128.camera !== JSON.stringify(window.__card._view) && window.__area1128.navigation.length === 0);
    // A keyboard user still has an intentional, visibly focused native link.
    const area = page.locator('houseplan-card [data-hp="room-area-link"]').first();
    await page.keyboard.press('Tab'); await area.focus();
    out[`${width}:keyboard-restores-44px-target`] = await area.evaluate(node => node.matches(':focus-visible') && node.getBoundingClientRect().width >= 44 && node.getBoundingClientRect().height >= 44);
    await page.keyboard.press('Enter');
    out[`${width}:keyboard-area-navigation-preserved`] = await page.evaluate(() => window.__area1128.navigation.length === 1);
  } finally { await browser.close(); }
}
checkAll(out); await finish(null, out);
