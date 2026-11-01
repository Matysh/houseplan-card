// #1184: native shared-header controls, container adaptation, titles and roles.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1800, height: 1000 }, 1, [], { hasTouch: true });
const dir = 'artifacts/header-shared-1184'; mkdirSync(dir, { recursive: true });
const card = () => page.locator('houseplan-card').first();
const settle = async () => {
  await page.evaluate(() => window.__hpTest.settled());
  await page.waitForFunction(() => !window.__card._modeTransitionBusy && !window.__card._modeTransitionPreparing);
};
const size = async width => {
  await page.evaluate(width => {
    document.getElementById('host').style.cssText = `width:${width}px!important;max-width:none!important;padding:0!important;margin:0!important`;
  }, width);
  await settle();
  await page.waitForFunction(width => Math.abs(window.__card.renderRoot.querySelector('.head').getBoundingClientRect().width - width) < 1, width);
  // Wait for the intrinsic layout, not only Lit's initial resize commit.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const read = () => card().evaluate(c => {
  const root = c.shadowRoot, head = root.querySelector('.head'), bounds = head.getBoundingClientRect();
  const visible = e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
  const buttons = [...head.querySelectorAll('button')].filter(visible);
  return { width: bounds.width, height: bounds.height, scroll: head.scrollWidth,
    phase: Number(root.querySelector('.hdr').dataset.panelFlow),
    title: head.querySelector('.title')?.textContent.trim(), titleHint: head.querySelector('.title')?.title,
    controls: buttons.map(e => ({ id:e.dataset.hp, mode:e.dataset.mode, width:e.getBoundingClientRect().width,
      height:e.getBoundingClientRect().height, inside:e.getBoundingClientRect().left >= bounds.left - 1 && e.getBoundingClientRect().right <= bounds.right + 1 })),
    legacy: !!root.querySelector('[data-hp="header-menu"],[data-hp="header-menu-item"],[data-hp="header-menu-scrim"]'),
    haMenu: !!root.querySelector('[data-hp="panel-menu"]'),
    stageHeight: root.querySelector('.stage').getBoundingClientRect().height,
    metricTrees: root.querySelectorAll('.panel-header-metrics').length };
});
const records = [];
try {
  await page.emulateMedia({ reducedMotion:'reduce' });
  for (const width of [1800,1400,1100,900,700,480,390,320,390,900,1800]) {
    await size(width); const row = await read(); records.push(row);
    assert.ok(row.scroll <= row.width + 1, JSON.stringify(row));
    assert.ok(row.controls.every(c => c.inside && c.width >= 43.99 && c.height >= 43.99), JSON.stringify(row));
    assert.ok(!row.legacy && !row.haMenu && row.title.includes('House Plan'), JSON.stringify(row));
    for (const id of ['mode-tab','settings','pdf','support','hidden-devices','space-add'])
      assert.ok(row.controls.some(c => c.id === id), id + ' at ' + width);
    assert.equal(row.metricTrees, 0); assert.ok(row.stageHeight > 100);
    if ([1800,390,320].includes(width)) await card().locator('.hdr').screenshot({ path:`${dir}/card-${width}.png` });
  }
  assert.equal(records[0].phase, 0); assert.equal(records.at(-1).phase, 0);
  assert.ok(records.slice(0,8).every((r,i,a) => !i || r.phase >= a[i-1].phase));
  await size(390);
  for (const mode of ['plan','devices','decor']) {
    await card().locator(`[data-hp="mode-tab"][data-mode="${mode}"]`).tap(); await settle();
    assert.equal(await card().locator('ha-card').getAttribute('data-hp-mode'), mode);
    const row = await read(); assert.ok(row.stageHeight > 50, JSON.stringify(row));
    const close = card().locator('.head [data-hp="editor-close"]');
    const rect = await close.boundingBox(); assert.ok(rect.width >= 44 && rect.height >= 44);
    await close.tap(); await settle();
    assert.equal(await card().locator('ha-card').getAttribute('data-hp-mode'), 'view');
  }
  const eye = card().locator('[data-hp="hidden-devices"]');
  const pressed = await eye.getAttribute('aria-pressed'); await eye.tap(); await settle();
  assert.notEqual(await eye.getAttribute('aria-pressed'), pressed); await eye.tap(); await settle();
  const title = 'A very long custom Houseplan card title that must remain readable';
  await page.evaluate(title => window.__card.setConfig({ ...window.__card._config, title }), title); await settle();
  let row = await read(); assert.equal(row.titleHint, title); assert.ok(row.scroll <= row.width + 1);
  await card().locator('.hdr').screenshot({ path:`${dir}/long-title-390.png` });
  for (const language of ['en','ru']) {
    await page.evaluate(language => window.__card.setConfig({ ...window.__card._config,language }), language);
    await settle(); row = await read(); assert.ok(row.scroll <= row.width + 1, JSON.stringify(row));
    await card().locator('.hdr').screenshot({ path:`${dir}/long-title-390-${language}.png` });
  }
  await page.evaluate(() => {
    const other = document.createElement('houseplan-card');
    other.setConfig({type:'custom:houseplan-card',title:'Second card'}); other.hass=window.__card.hass;
    other.style.cssText='position:fixed;left:0;top:650px;width:1800px';
    document.body.append(other); window.__otherHeaderCard=other;
  });
  await page.waitForFunction(() => window.__otherHeaderCard.shadowRoot?.querySelector('.hdr')?.dataset.panelFlow === '0');
  assert.equal((await read()).width,390,'a neighbour must not borrow or change this card width');
  await page.evaluate(() => { window.__otherHeaderCard.remove(); delete window.__otherHeaderCard; });
  // Remount a read-only card with the same real harness data and denied writer capability.
  await page.evaluate(async () => {
    const base = window.__mkHass(), call = base.callWS;
    const c = document.createElement('houseplan-card');
    c.setConfig({ type:'custom:houseplan-card', title:'Household' });
    c.hass = { ...base, user:{id:'household',is_admin:false}, callWS:async message => {
      const result = await call(message);
      return message.type === 'houseplan/config/get' ? { ...result, can_write:false } : result;
    }};
    document.getElementById('host').replaceChildren(c); window.__card = c;
  });
  await page.waitForFunction(() => window.__card.shadowRoot?.querySelector('.stage') && !window.__card._booting);
  await settle(); row = await read();
  assert.ok(!row.controls.some(c => ['mode-tab','settings','pdf','support','space-add','space-settings'].includes(c.id)), JSON.stringify(row));
  assert.ok(row.controls.some(c => c.id === 'hidden-devices'));
  await card().locator('[data-hp="hidden-devices"]').tap(); await settle();
  await page.evaluate(() => window.__card.setConfig({ type:'custom:houseplan-card',kiosk:true,cycle:0 })); await settle();
  assert.equal(await card().locator('.hdr').evaluate(e => getComputedStyle(e).display), 'none');
  assert.equal(await card().evaluate(c => !!c._roHdr), false);
  writeFileSync(`${dir}/summary.json`, JSON.stringify(records,null,2));
} finally { await finish(browser); }
