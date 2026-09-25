// #616: компактная шапка на телефоне (≤ 480 px). В одной строке ≤ 56 px —
// вкладки пространств, зум и одна шестерёнка; всё, что строка убрала, — пункты
// её меню с теми же действиями, что у прежних кнопок. Тап вне меню поглощается,
// Escape возвращает фокус на шестерёнку, активная вкладка видна в прокрутке.
// На > 480 px шапка прежняя, в киоске меню нет. Клики — настоящие (Playwright
// по координатам), приватные поля карточки только читаются.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 390, height: 844 }, 1);
// Как в golden: карточка во всю ширину окна, а не фиксированные 780 px стенда.
await page.addStyleTag({ content: '#host{width:min(100%,1120px)!important;margin:0 auto!important;padding:0!important}' });
const out = {};
const settle = () => page.evaluate(() => window.__hpTest.settled());
const size = async (width) => { await page.setViewportSize({ width, height: 844 }); await settle(); };

// Снимок шапки: что видно, одна ли строка, высота.
const header = () => page.evaluate(() => {
  const sr = window.__card.shadowRoot;
  const head = sr.querySelector('.hdr > .head');
  const shown = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const kids = [...head.children].filter((el) => shown(el) && el.getBoundingClientRect().width > 0);
  const mids = kids.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; });
  const gear = sr.querySelector('[data-hp="header-menu"]');
  const g = gear?.getBoundingClientRect();
  return {
    height: head.getBoundingClientRect().height,
    oneRow: mids.length > 0 && Math.max(...mids) - Math.min(...mids) <= 6,
    title: shown(head.querySelector(':scope > .title')),
    tabs: shown(head.querySelector(':scope > .tabs')),
    zoom: shown(head.querySelector(':scope > .zoomctl')),
    gear: shown(gear),
    gear44: !!g && g.width >= 44 && g.height >= 44,
    hiddenInline: ['.modes', '.header-action', '.summary-control', '.projection-toggle', '.tabedit', '.tabadd']
      .filter((selector) => [...head.querySelectorAll(selector)].some(shown)),
    tabEditInDom: !!head.querySelector('.tabedit, .tabadd'),
    inlineVisible: ['.header-action', '.summary-control'].filter((selector) => [...head.querySelectorAll(selector)].some(shown)),
  };
});
const menuState = () => page.evaluate(() => {
  const sr = window.__card.shadowRoot;
  const menu = sr.querySelector('#hp-header-menu');
  const gear = sr.querySelector('[data-hp="header-menu"]');
  const items = [...sr.querySelectorAll('[data-hp="header-menu-item"]')];
  return {
    open: !!menu, expanded: gear?.getAttribute('aria-expanded'),
    ids: items.map((el) => el.dataset.id),
    pressed: Object.fromEntries(items.filter((el) => el.hasAttribute('aria-pressed')).map((el) => [el.dataset.id, el.getAttribute('aria-pressed')])),
    current: items.filter((el) => el.getAttribute('aria-current') === 'true').map((el) => el.dataset.id),
    items44: items.every((el) => el.getBoundingClientRect().height >= 44),
    inViewport: !menu || (() => { const r = menu.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; })(),
  };
});
const clickAt = async (selector) => {
  const box = await page.evaluate((s) => {
    const el = window.__card.shadowRoot.querySelector(s);
    if (!el) return null;
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  if (!box) throw new Error(`нет ${selector}`);
  await page.mouse.click(box.x, box.y);
  await settle();
};
const openMenu = async () => { if (!(await menuState()).open) await clickAt('[data-hp="header-menu"]'); };
const dialogKinds = () => page.evaluate(() => {
  const kinds = [];
  const walk = (root) => {
    for (const d of root.querySelectorAll('hp-dialog[data-kind]')) kinds.push(d.getAttribute('data-kind'));
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
  };
  walk(window.__card.shadowRoot);
  return kinds.sort();
});
const closeDialogs = async () => {
  for (let i = 0; i < 4 && (await dialogKinds()).length; i++) {
    await page.evaluate(() => window.__hpTest.close());
  }
};
const mode = () => page.evaluate(() => window.__card.shadowRoot.querySelector('ha-card[data-hp-mode]')?.getAttribute('data-hp-mode'));

// ---- администратор (стенд) --------------------------------------------------
const ADMIN_VIEW = ['mode-plan', 'mode-devices', 'mode-decor', 'space-settings', 'space-add', 'settings', 'pdf', 'support', 'summary-settings', 'summary-toggle'];
for (const width of [390, 320]) {
  await size(width);
  const h = await header();
  out[`admin${width}_oneRow56`] = h.oneRow && h.height <= 56;
  out[`admin${width}_rowContent`] = !h.title && h.tabs && h.zoom && h.gear && h.gear44;
  out[`admin${width}_inlineHidden`] = h.hiddenInline.length === 0 ? true : h.hiddenInline.join(',');
  await openMenu();
  const m = await menuState();
  out[`admin${width}_menuItems`] = m.ids.join(',') === ADMIN_VIEW.join(',') ? true : m.ids.join(',');
  out[`admin${width}_menuTargets`] = m.items44 && m.inViewport && m.expanded === 'true';
  await clickAt('[data-hp="header-menu"]');
  out[`admin${width}_gearToggles`] = !(await menuState()).open;
}

// Каждый пункт делает то же, что прежняя кнопка: сначала прежняя кнопка на
// 1400 px (эталон эффекта), потом пункт меню на 390 px.
const same = {};
for (const [id, inline] of [['settings', '[data-hp="settings"]'], ['pdf', '[data-hp="pdf"]'], ['support', '[data-hp="support"]'],
  ['space-settings', '[data-hp="space-settings"]'], ['space-add', '[data-hp="space-add"]'], ['summary-settings', '.summary-control > button:first-child']]) {
  await size(1400);
  await clickAt(inline);
  await page.waitForTimeout(250);
  const expected = await dialogKinds();
  await closeDialogs();
  await size(390);
  await openMenu();
  await clickAt(`[data-hp="header-menu-item"][data-id="${id}"]`);
  await page.waitForTimeout(250);
  const actual = await dialogKinds();
  const closed = !(await menuState()).open;
  // Открытое меню перехватывает Escape — диалог тогда не закрыть; это провал пункта, а не смока.
  const closeError = await closeDialogs().then(() => '', (error) => String(error.message || error).slice(0, 80));
  if ((await menuState()).open) await clickAt('[data-hp="header-menu"]');
  if (closeError) await closeDialogs().catch(() => {});
  same[id] = expected.length > 0 && expected.join() === actual.join() && closed && !closeError
    ? true : `${expected}|${actual}|closed=${closed}|${closeError}`;
}
out.itemsSameEffect = Object.values(same).every((v) => v === true) ? true : JSON.stringify(same);

// Сводная панель: переключатель меняет то же локальное состояние, что и кнопка.
await openMenu();
const before = (await menuState()).pressed['summary-toggle'];
await clickAt('[data-hp="header-menu-item"][data-id="summary-toggle"]');
await openMenu();
const after = (await menuState()).pressed['summary-toggle'];
await clickAt('[data-hp="header-menu-item"][data-id="summary-toggle"]');
out.summaryToggleFlips = before !== after && ['true', 'false'].includes(after);

// Редактор с телефона: вход из меню, строка одна, × виден и закрывает.
await openMenu();
await clickAt('[data-hp="header-menu-item"][data-id="mode-plan"]');
await page.waitForTimeout(300);
out.editorFromMenu = (await mode()) === 'plan';
const inEditor = await header();
out.editorOneRow56 = inEditor.oneRow && inEditor.height <= 56 && inEditor.hiddenInline.length === 0;
await openMenu();
const editorMenu = await menuState();
out.editorMenuMarksCurrent = editorMenu.current.join() === 'mode-plan' && !editorMenu.ids.includes('summary-toggle');
await clickAt('[data-hp="header-menu"]');
await clickAt('[data-hp="editor-close"]');
await page.waitForTimeout(300);
out.crossClosesOnPhone = (await mode()) === 'view';

// Escape закрывает меню и возвращает фокус на шестерёнку.
await openMenu();
await page.keyboard.press('Escape');
await settle();
out.escapeClosesAndFocuses = await page.evaluate(() => {
  const sr = window.__card.shadowRoot;
  return !sr.querySelector('#hp-header-menu') && sr.activeElement === sr.querySelector('[data-hp="header-menu"]');
});

// Тап вне меню поглощается: под пальцем маркер устройства, но до него тап не доходит.
const target = await page.evaluate(() => {
  const sr = window.__card.shadowRoot;
  const top = sr.querySelector('.hdr').getBoundingClientRect().bottom + 40;
  for (const el of sr.querySelectorAll('[data-hp="device"]')) {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2; const y = r.top + r.height / 2;
    if (r.width > 0 && y > top && y < innerHeight - 20 && x > 20 && x < innerWidth - 20) {
      const hit = sr.elementFromPoint(x, y);
      if (hit && (hit === el || el.contains(hit))) return { x, y, id: el.getAttribute('data-id') };
    }
  }
  return null;
});
if (target) {
  await openMenu();
  const shield = await page.evaluate(({ x, y }) => window.__card.shadowRoot.elementFromPoint(x, y)?.getAttribute('data-hp'), target);
  const states = () => page.evaluate(() => JSON.stringify(window.__card.hass.states));
  const dialogsBefore = await dialogKinds();
  const statesBefore = await states();
  await page.mouse.click(target.x, target.y);
  await settle();
  await page.waitForTimeout(250);
  out.outsideTapClosesMenu = !(await menuState()).open;
  out.outsideTapSwallowed = shield === 'header-menu-scrim' && (await states()) === statesBefore
    && (await dialogKinds()).join() === dialogsBefore.join();
} else {
  out.outsideTapClosesMenu = 'нет маркера под шапкой';
  out.outsideTapSwallowed = 'нет маркера под шапкой';
}

// Много пространств с длинными названиями: строка одна, активная вкладка видна.
await page.evaluate(() => window.__hpTest.setServerConfig((cfg) => {
  const base = cfg.spaces[0];
  for (let i = 1; i <= 4; i++) {
    cfg.spaces.push({ ...structuredClone(base), id: `smoke-long-${i}`, title: `Очень длинное пространство ${i}`, floor: undefined });
  }
  return cfg;
}));
await size(390);
const lastId = await page.evaluate(() => [...window.__card.shadowRoot.querySelectorAll('[data-hp="space-tab"]')].at(-1)?.dataset.id);
await page.evaluate((id) => window.__hpTest.switchSpace(id), lastId);
await page.waitForTimeout(200);
const tabVisible = () => page.evaluate(() => {
  const sr = window.__card.shadowRoot;
  const nav = sr.querySelector('.head .tabs').getBoundingClientRect();
  const tab = sr.querySelector('.head .tab.active').getBoundingClientRect();
  return tab.left >= nav.left - 0.5 && tab.right <= nav.right + 0.5;
});
const many = await header();
out.manySpacesOneRow = many.oneRow && many.height <= 56;
out.activeTabRevealedOnSwitch = await tabVisible();
const firstId = await page.evaluate(() => window.__card.shadowRoot.querySelector('[data-hp="space-tab"]').dataset.id);
await page.evaluate((id) => window.__hpTest.switchSpace(id), firstId);
await page.waitForTimeout(200);
out.activeTabRevealedBack = await tabVisible();

// > 480 px: прежняя шапка, кнопки меню не видно.
for (const width of [481, 768, 1400]) {
  await size(width);
  const w = await header();
  out[`admin${width}_unchanged`] = !w.gear && w.inlineVisible.length === 2 && w.title ? true : JSON.stringify(w);
}

// ---- не-админ ---------------------------------------------------------------
await page.evaluate(async () => {
  const base = window.__mkHass();
  const hass = {
    ...base, user: { id: 'household', name: 'Household', is_admin: false },
    callWS: async (m) => {
      const r = await base.callWS(m);
      return m.type === 'houseplan/config/get' ? { ...r, can_write: false } : r;
    },
  };
  const host = document.getElementById('host');
  host.replaceChildren();
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan' });
  host.append(card);
  card.hass = hass;
  window.__card = card;
  const until = Date.now() + 8000;
  while (Date.now() < until && !card.shadowRoot?.querySelector('[data-hp="space-tab"]')) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 600));
});
for (const width of [390, 320]) {
  await size(width);
  const h = await header();
  out[`household${width}_oneRow56`] = h.oneRow && h.height <= 56;
  out[`household${width}_rowContent`] = !h.title && h.tabs && h.zoom && h.gear && !h.tabEditInDom;
  await openMenu();
  const m = await menuState();
  out[`household${width}_menuItems`] = m.ids.join(',') === 'summary-settings,summary-toggle' ? true : m.ids.join(',');
  await page.keyboard.press('Escape');
  await settle();
}
// «После загрузки на последнем»: вкладка запомнена, новая карточка открывает
// её же — и докручивает в видимую область без участия человека.
await size(390);
const lastHouseholdId = await page.evaluate(() => [...window.__card.shadowRoot.querySelectorAll('[data-hp="space-tab"]')].at(-1)?.dataset.id);
await page.evaluate((id) => window.__hpTest.switchSpace(id), lastHouseholdId);
await page.evaluate(async () => {
  const old = window.__card;
  const hass = old.hass;
  const host = document.getElementById('host');
  host.replaceChildren();
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan' });
  host.append(card);
  card.hass = hass;
  window.__card = card;
  const until = Date.now() + 8000;
  while (Date.now() < until && !card.shadowRoot?.querySelector('.head .tab.active')) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 800));
});
out.reloadOpensLastSpace = await page.evaluate((id) => window.__card.shadowRoot.querySelector('.head .tab.active')?.dataset.id === id, lastHouseholdId);
out.activeTabRevealedOnLoad = await tabVisible();
await size(1400);
const wide = await header();
out.household1400_noTabEditing = !wide.tabEditInDom && !wide.gear;

// ---- киоск: шапки нет, меню не рендерится ------------------------------------
await size(390);
await page.evaluate(async () => {
  const host = document.getElementById('host');
  host.replaceChildren();
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', kiosk: true });
  host.append(card);
  card.hass = window.__mkHass();
  window.__card = card;
  const until = Date.now() + 8000;
  while (Date.now() < until && !card.shadowRoot?.querySelector('.hdr')) await new Promise((r) => setTimeout(r, 50));
  await new Promise((r) => setTimeout(r, 400));
});
out.kioskNoMenu = await page.evaluate(() => {
  const sr = window.__card.shadowRoot;
  return getComputedStyle(sr.querySelector('.hdr')).display === 'none' && !sr.querySelector('[data-hp="header-menu"]');
});

for (const [name, value] of Object.entries(out)) check(name, value);
await finish(browser, out);
