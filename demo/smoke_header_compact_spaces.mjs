// #997: real UI choices, actual header widths and accepted navigation state.
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';
import { mkdirSync } from 'node:fs';

requirePinnedBrowser();
const { page, browser } = await launchColdView({ width: 1440, height: 1000 }, 1, [], { hasTouch: true });
const evidence = 'artifacts/header-spaces-997';
mkdirSync(evidence, { recursive: true });
const card = page.locator('houseplan-card').first();
const picker = card.locator('[data-hp="space-select"]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const snapshot = () => page.evaluate(() => {
  const c = window.__card, root = c.renderRoot;
  const shown = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const select = root.querySelector('[data-hp="space-select-value"]');
  const host = root.querySelector('[data-hp="space-select"]');
  const trigger = host?.shadowRoot.querySelector('[data-hp="select-trigger"]');
  const contrast = () => {
    if (!trigger) return null;
    const context = document.createElement('canvas').getContext('2d');
    const rgb = color => { context.clearRect(0, 0, 1, 1); context.fillStyle = color;
      context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const style = getComputedStyle(trigger), background = rgb(style.backgroundColor), ink = rgb(style.color);
    const luminance = values => values.slice(0, 3).map(value => value / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const a = luminance(background), b = luminance(ink);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  };
  return { width: root.querySelector('.hdr').getBoundingClientRect().width,
    compact: shown(host), tabs: root.querySelectorAll('[data-hp="space-tab"]').length,
    value: select?.value, label: trigger?.textContent.trim(), space: c._space,
    fieldHeight: trigger?.getBoundingClientRect().height,
    fieldContrast: contrast(),
    headerHeight: root.querySelector('.head').getBoundingClientRect().height,
    gear: shown(root.querySelector('[data-hp="space-settings"]')),
    add: shown(root.querySelector('[data-hp="space-add"]')),
    zoom: shown(root.querySelector('[data-hp="zoom-in"]')),
    headerMenu: shown(root.querySelector('[data-hp="header-menu"]')),
    decor: [...root.querySelectorAll('[data-hp="decor"][data-kind="text"]')].map(e => e.textContent),
    order: c._serverCfg.spaces.map(s => s.id),
    options: select ? [...select.options].map(o => ({ id: o.value, title: o.label })) : [],
  };
});
const size = async (width, viewport = 1440, height = 1000) => {
  await page.setViewportSize({ width: viewport, height });
  await page.evaluate(width => {
    const host = document.getElementById('host');
    host.style.setProperty('width', `${width}px`, 'important');
    host.style.setProperty('max-width', 'none', 'important');
    host.style.setProperty('padding', '0', 'important');
    host.style.setProperty('margin', '0', 'important');
  }, width);
  await settle();
  await page.waitForFunction(expected => {
    const root = window.__card.renderRoot;
    return Math.abs(root.querySelector('.hdr').getBoundingClientRect().width - expected) < .01
      && (expected <= 1024 ? !!root.querySelector('[data-hp="space-select"]') : !!root.querySelector('[data-hp="space-tab"]'));
  }, width);
  await settle();
};
const choose = async id => {
  await picker.locator('[data-hp="select-trigger"]').click();
  await picker.locator(`[data-hp="select-option"][data-id="${id}"]`).click();
  await settle();
};
const waitSpace = id => page.waitForFunction(id => {
  const c = window.__card;
  return c._space === id && !c._slide && !c._modeTransitionBusy
    && c.renderRoot.querySelector('[data-hp="space-select-value"]')?.value === id;
}, id);

try {
  const floors = await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => {
      cfg.spaces = cfg.spaces.slice(0, 2);
      cfg.spaces.forEach((space, i) => {
        space.title = i ? 'Второй этаж с очень длинным названием для проверки компактного поля' : 'Первый этаж';
        space.settings = { ...space.settings, hide_decor: false };
        space.decor = [{ id: `nav-floor-${i}`, kind: 'text', x: .6, y: .6,
          text: i ? 'NAV SECOND FLOOR' : 'NAV FIRST FLOOR', size_cm: 40, color: '#000000' },
        { id: `nav-rect-${i}`, kind: 'rect', x: .2, y: .2, w: .2, h: .2,
          color: '#ff0000', fill: true, fill_color: '#ff0000', fill_opacity: 1 }];
      });
    });
    return window.__card._serverCfg.spaces.map(s => ({ id: s.id, title: s.title }));
  });
  for (const width of [1025, 1024.25, 1024, 1023.75, 1023]) {
    await size(width);
    const s = await snapshot();
    check(`header.${width}.measured-width`, s.width, width);
    check(`header.${width}.compact-boundary`, s.compact, width <= 1024);
    check(`header.${width}.only-one-navigation`, s.tabs, width <= 1024 ? 0 : floors.length);
  }
  await size(768);
  check('header.narrow-card-in-wide-window', (await snapshot()).compact);
  await size(1024);
  const before = await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config);
  for (const [i, floor] of floors.entries()) {
    await choose(floor.id); await waitSpace(floor.id); await settle();
    const s = await snapshot();
    check(`header.choose.${floor.id}.field`, s.value, floor.id);
    check(`header.choose.${floor.id}.title`, s.label, floor.title);
    check(`header.choose.${floor.id}.visible-plan`, s.decor.some(text => text.includes(i ? 'NAV SECOND FLOOR' : 'NAV FIRST FLOOR')));
    check(`header.choose.${floor.id}.order`, s.order, floors.map(f => f.id));
  }
  check('header.selection.does-not-rewrite-plan', await page.evaluate(async () =>
    (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config), before);
  check('header.selection.persisted-navigation', await page.evaluate(() =>
    JSON.parse(localStorage.getItem('houseplan_card_nav_v1')).space), floors[1].id);
  const button = picker.locator('[data-hp="select-trigger"]');
  await button.click(); await page.keyboard.press('Escape');
  check('header.escape.no-navigation', (await snapshot()).value, floors[1].id);
  check('header.escape.focus-return', await button.evaluate(e => e.getRootNode().activeElement === e));
  await button.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
  await waitSpace(floors[0].id);
  check('header.keyboard.real-selection', (await snapshot()).label, floors[0].title);
  for (const width of [481, 768, 1024]) {
    await size(width);
    const s = await snapshot();
    check(`header.${width}.settings-and-add`, s.gear && s.add);
    await card.locator('[data-hp="space-settings"]').click();
    await card.locator('hp-dialog[data-kind="space"]').waitFor();
    check(`header.${width}.settings-real-dialog`, await card.locator('hp-dialog[data-kind="space"]').count(), 1);
    await page.keyboard.press('Escape'); await settle();
    await card.locator('[data-hp="space-add"]').click();
    await card.locator('hp-dialog[data-kind="space"]').waitFor();
    check(`header.${width}.add-real-dialog`, await card.locator('hp-dialog[data-kind="space"]').count(), 1);
    await page.keyboard.press('Escape'); await settle();
  }
  await size(1024);
  await page.evaluate(() => window.__hpTest.setMode('decor'));
  await card.locator('[data-hp="decor"][data-id="nav-rect-0"]').click();
  const invalid = card.locator('[data-hp="properties-panel"] [data-property="w"] input');
  await invalid.waitFor(); await invalid.fill('');
  await choose(floors[1].id); await settle();
  check('header.refused-dirty-navigation.accepted-space', (await snapshot()).space, floors[0].id);
  check('header.refused-dirty-navigation.accepted-field', (await snapshot()).value, floors[0].id);
  check('header.refused-dirty-navigation.accepted-label', (await snapshot()).label, floors[0].title);
  check('header.refused-dirty-navigation.visible-error', await card.locator('[data-hp="properties-panel"] [role="alert"]').count(), 1);
  await invalid.press('Escape');
  await page.evaluate(() => window.__hpTest.setMode('view'));
  await size(390, 390, 844);
  let s = await snapshot();
  check('header.phone.field-44px', s.fieldHeight, 44);
  check('header.phone.one-row-56px', s.headerHeight <= 56);
  check('header.phone.gear-and-zoom', s.headerMenu && s.zoom && !s.gear && !s.add);
  const touch = await button.boundingBox();
  await page.touchscreen.tap(touch.x + touch.width / 2, touch.y + touch.height / 2);
  const option = await picker.locator(`[data-hp="select-option"][data-id="${floors[1].id}"]`).boundingBox();
  await page.touchscreen.tap(option.x + option.width / 2, option.y + option.height / 2);
  await waitSpace(floors[1].id);
  check('header.phone.touch-selects-visible-floor', (await snapshot()).label, floors[1].title);
  await card.screenshot({ path: `${evidence}/phone-long-name.png` });
  await size(768, 1200, 700);
  check('header.orientation.preserves-space', (await snapshot()).value, floors[1].id);
  for (const [theme, background, foreground] of [['light', '#ffffff', '#112233'], ['dark', '#202126', '#e6e7eb'], ['custom', '#263541', '#7cddbe']]) {
    await page.evaluate(({ background, foreground }) => {
      document.body.style.setProperty('--card-background-color', background);
      document.body.style.setProperty('--primary-text-color', foreground);
    }, { background, foreground });
    check(`header.theme.${theme}.field-contrast`, (await snapshot()).fieldContrast >= 4.5);
    await button.click();
    check(`header.theme.${theme}.long-option-readable`, await picker.locator(`[data-hp="select-option"][data-id="${floors[1].id}"]`).innerText(), `${floors[1].title}\n✓`);
    await page.keyboard.press('Escape');
    await card.screenshot({ path: `${evidence}/${theme}.png` });
  }
} finally { await finish(browser); }
