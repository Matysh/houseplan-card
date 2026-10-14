// #894 AC1/AC3: production bundle, accepted config events, trusted keyboard/touch.
import { launchColdView, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('894 current opening and accessible Area');
const out = {};
for (const variant of [
  { language: 'en', dark: false, width: 1280 },
  { language: 'ru', dark: true, width: 360 },
]) {
  const { page, browser } = await launchColdView({ width: variant.width, height: 900 }, 1, [], { hasTouch: true });
  const prefix = `${variant.language}-${variant.width}`;
  try {
    await page.evaluate(async ({ language, dark }) => {
      const c = window.__card;
      window.__894Services = []; window.__894Navigation = [];
      const oldPush = history.pushState.bind(history);
      history.pushState = (...args) => { window.__894Navigation.push(args[2]); };
      window.__894OldPush = oldPush;
      for (const [id, state, name] of [
        ['lock.hp894_a', 'locked', 'Boiler lock'], ['lock.hp894_b', 'unlocked', 'Guest lock'],
        ['binary_sensor.hp894_a', 'off', 'Boiler contact'], ['binary_sensor.hp894_b', 'on', 'Guest contact'],
      ]) window.__addRegistryEntity(id, null, state, 'demo', {}, { friendly_name: name, device_class: id.startsWith('binary') ? 'door' : undefined });
      c.setConfig({ ...c._config, language });
      c.hass = { ...window.__mkHass(), themes: { darkMode: dark },
        callService: async (domain, service, data) => window.__894Services.push({ domain, service, ...data }) };
      await window.__hpTest.setServerConfig(cfg => {
        cfg.spaces = cfg.spaces.map((space, i) => ({ ...space,
          settings: { ...space.settings, show_names: true },
          openings: i === 0 ? [
            { id: '894-a', type: 'door', x: .35, y: .45, angle: 0, length: .1, contact: 'binary_sensor.hp894_a', lock: 'lock.hp894_a' },
            { id: '894-b', type: 'door', x: .65, y: .45, angle: 0, length: .1, contact: 'binary_sensor.hp894_b', lock: 'lock.hp894_b' },
          ] : space.openings })); return cfg;
      });
      await window.__hpTest.waitForWrites();
      const room = c._spaceModel().rooms.find(r => r.name && r.area);
      const layoutRev = window.__pushServerLayout({ ...c._layout, [`rl_${room.id}`]: { x: .12, y: .12, s: c._space } });
      while (c._layoutRev < layoutRev) await new Promise(resolve => setTimeout(resolve, 20));
      await window.__hpTest.settled();
    }, variant);
    const locks = page.locator('#host houseplan-card .oplock');
    await locks.first().tap();
    out[`${prefix}:exact-door-names`] = await page.evaluate(() => {
      const dialog = window.__card.renderRoot.querySelector('hp-dialog[data-kind="opening"]');
      return dialog?.title.includes('Boiler lock') && dialog.textContent.includes('Boiler contact')
        && dialog.textContent.includes('Boiler lock') && !dialog.textContent.includes('Guest contact');
    });
    await page.locator('#host houseplan-card .lockact').click();
    await page.locator('#host houseplan-card hp-dialog[data-kind="confirm"]').waitFor();
    await page.evaluate(async () => {
      await window.__hpTest.setServerConfig(cfg => {
        const op = cfg.spaces[0].openings.find(o => o.id === '894-a');
        op.lock = 'lock.hp894_b'; op.contact = 'binary_sensor.hp894_b'; return cfg;
      });
    });
    out[`${prefix}:accepted-rebind-retires-unlock`] = await page.evaluate(() => {
      const root = window.__card.renderRoot, dialog = root.querySelector('hp-dialog[data-kind="opening"]');
      return !root.querySelector('hp-dialog[data-kind="confirm"]') && dialog?.title.includes('Guest lock')
        && dialog.textContent.includes('Guest contact') && window.__894Services.length === 0;
    });
    await page.evaluate(async () => {
      // private-ok: inject a queued old target at the action boundary; Lit may reuse
      // a button and replace its listener, so retaining DOM is not a stale closure.
      await window.__card._lockAction('lock.hp894_a', 'unlock');
    });
    out[`${prefix}:queued-old-target-refused`] = await page.evaluate(() => window.__894Services.length === 0
      && !window.__card.renderRoot.querySelector('hp-dialog[data-kind="confirm"]'));
    // Accepted #846 closes a popup on a stale action. Re-enter through the
    // genuine current badge; no fabricated popup/state is needed to continue.
    await locks.first().tap();
    await page.locator('#host houseplan-card .lockact').click();
    out[`${prefix}:current-lock-action`] = await page.evaluate(() => window.__894Services.length === 1
      && window.__894Services[0].entity_id === 'lock.hp894_b' && window.__894Services[0].service === 'lock');
    await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
      cfg.spaces[0].openings = cfg.spaces[0].openings.filter(o => o.id !== '894-a'); return cfg;
    }));
    out[`${prefix}:accepted-delete-closes-popup`] = await page.evaluate(() => !window.__card.renderRoot.querySelector('hp-dialog[data-kind="opening"]'));

    const area = page.locator('#host houseplan-card [data-hp="room-area-link"]').first();
    const roomFit = area.locator('..').locator('.rlfit');
    await roomFit.focus(); await page.keyboard.press('Tab');
    out[`${prefix}:separate-native-tab-control`] = await page.evaluate(() => {
      const c = window.__card, button = c.renderRoot.activeElement;
      window.__894Camera = JSON.stringify({ space: c._space, zoom: c._zoom, view: c._view });
      window.__894Services = [];
      const rect = button?.getBoundingClientRect(), style = button && getComputedStyle(button);
      return button?.dataset.hp === 'room-area-link' && button.tagName === 'BUTTON'
        && button.getAttribute('aria-label')?.includes('Home Assistant') && !button.closest('[role="button"]')
        && rect.width >= 44 && rect.height >= 44 && parseFloat(style.outlineWidth) === 2;
    });
    await page.keyboard.press('Enter'); await page.keyboard.press('Space');
    out[`${prefix}:keyboard-navigation-no-fit-service`] = await page.evaluate(() => {
      const c = window.__card;
      return window.__894Navigation.length === 2 && window.__894Services.length === 0
        && window.__894Camera === JSON.stringify({ space: c._space, zoom: c._zoom, view: c._view });
    });
    await area.tap(); await area.tap(); await page.waitForTimeout(400);
    out[`${prefix}:touch-navigation-no-fallthrough`] = await page.evaluate(() => {
      const c = window.__card;
      return window.__894Navigation.length === 4 && window.__894Services.length === 0
        && window.__894Camera === JSON.stringify({ space: c._space, zoom: c._zoom, view: c._view });
    });
    // Mouse activation isolates the new independent owner. Native touch's
    // post-release implicit capture lifecycle is tracked separately by #847.
    await roomFit.click(); await page.waitForTimeout(700);
    out[`${prefix}:separate-room-name-still-fits`] = await page.evaluate(() => {
      const c = window.__card, fit = c.renderRoot.querySelector('.rlfit[data-id]');
      return c._roomFocus?.roomId === fit?.dataset.id && window.__894Navigation.length === 4;
    });
    await page.evaluate(async () => {
      const c = window.__card; c.hass = { ...c.hass, user: { ...c.hass.user, is_admin: false } };
      c.requestUpdate(); await c.updateComplete;
    });
    out[`${prefix}:non-admin-no-area-button`] = await area.count() === 0;
  } finally { await browser.close(); }
}
checkAll(out); await finish(null, out);
