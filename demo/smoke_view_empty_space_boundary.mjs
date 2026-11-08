import {headerActionTarget,clickHeaderAction} from './helpers/header-actions.mjs';
// #1333: actual cold View, server adoption, space navigation and permission changes.
import { launchColdView, check, checkAll, finish } from './serve.mjs';
import { mkdirSync } from 'node:fs';
const { page, browser } = await launchColdView({ width: 390, height: 760 }, 1, [], { hasTouch: true });
const out = {};
const prompt = page.locator('[data-hp="empty-plan"]');
const button = page.locator('[data-hp="empty-plan-edit"]');
await page.evaluate(async () => {
  document.querySelector("#host").style.cssText = "width:auto;margin:0;padding:8px";
  const c = window.__card;
  window.__1333writer = true;
  const original = c.hass.callWS.bind(c.hass);
  c.hass = { ...c.hass, language: 'ru', locale: { ...c.hass.locale, language: 'ru' }, callWS: async (message) => {
    const response = await original(message);
    return message.type === 'houseplan/config/get' ? { ...response, can_write: window.__1333writer } : response;
  } };
  await window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.push({ id: 'empty1333', title: 'Пустое пространство', rooms: [], partitions: [],
      wall_segments: [], wall_columns: [], openings: [], decor: [], stairs: [], led_strips: [], view_box: [0, 0, 1, 1] });
    return cfg;
  });
  await window.__hpTest.switchSpace('empty1333');
});
await prompt.waitFor({ state: 'visible' });
check('literal Russian prompt', await prompt.locator('span').textContent(), 'План пока пуст. Давайте что-нибудь нарисуем.');
check('literal Russian editor label', await button.textContent(), 'Редактора плана');
const rect = await button.boundingBox();
out.touchTarget44 = rect.width >= 44 && rect.height >= 44;
out.coldViewHasNoEditor = await page.evaluate(() => !window.__card._editorRuntime);
const layout = await page.evaluate(() => {
  const root = window.__card.renderRoot, stage = root.querySelector('.stage').getBoundingClientRect();
  const empty = root.querySelector('[data-hp="empty-plan"]').getBoundingClientRect();
  return Math.abs(empty.x + empty.width / 2 - stage.x - stage.width / 2) < 1
    && Math.abs(empty.y + empty.height / 2 - stage.y - stage.height / 2) < 1;
});
out.centredOnStage = layout;
mkdirSync('docs/testing/issue1333', { recursive: true });
await page.screenshot({ path: 'docs/testing/issue1333/empty-space-mobile.png' });
await button.tap();
await page.waitForFunction(() => window.__card._mode === 'plan' && !window.__card._modeTransitionBusy);
out.ctaOpensCurrentPlan = await page.evaluate(() => window.__card._space === 'empty1333');
out.editorHasNoPrompt = await prompt.count() === 0;
await clickHeaderAction(page.locator('houseplan-card').first(),'mode-view');
await prompt.waitFor({ state: 'visible' });
// Retained DOM references must recheck current authority at click time.
await page.evaluate(() => { window.__1333stale = window.__card.renderRoot.querySelector('[data-hp="empty-plan-edit"]'); });
await page.evaluate(async () => { window.__1333writer = false; await window.__hpTest.setServerConfig(cfg => cfg); });
out.readOnlyHasTextOnly = await prompt.count() === 1 && await button.count() === 0;
await page.evaluate(() => window.__1333stale.click());
out.revokedStaleButtonRefuses = await page.evaluate(() => window.__card._mode === 'view');
await page.evaluate(async () => { window.__1333writer = true; await window.__hpTest.setServerConfig(cfg => cfg); });
await button.waitFor();
await page.evaluate(async () => { const c = window.__card; c.setConfig({ ...c._config, kiosk: true }); await window.__hpTest.settled(); });
out.kioskHasNoEditorEntry = await button.count() === 0;
await page.evaluate(async () => { const c = window.__card; c.setConfig({ ...c._config, kiosk: false }); await window.__hpTest.settled(); });
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg => {
    cfg.spaces.find(s => s.id === 'empty1333').decor = [{ id: 'hidden-line', type: 'line',
      a: [0.2, 0.2], b: [0.5, 0.5], hidden: true }]; return cfg;
  });
});
out.hiddenContentRemovesPrompt = await prompt.count() === 0;
await page.evaluate(async () => {
  await window.__hpTest.setServerConfig(cfg => { cfg.spaces.find(s => s.id === 'empty1333').decor = []; return cfg; });
});
await prompt.waitFor();
out.removingLastContentRestoresPrompt = true;
await page.evaluate(async () => {
  const other = window.__card._model.find(s => s.id !== 'empty1333').id;
  await window.__hpTest.switchSpace(other);
});
out.populatedSpaceHasNoPrompt = await prompt.count() === 0;
checkAll(out);
await finish(browser, out);
