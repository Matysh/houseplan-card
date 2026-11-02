// #1211: downloadable converter bytes consumed by the real panel View.
// Synthetic transport only; backend persistence is checked separately.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { launchPanelCold, finish, check } from './serve.mjs';
import { convertEasy } from '../scripts/sh3d-convert/easy.mjs';

const { page, browser } = await launchPanelCold({ width: 1280, height: 800 });
const artifacts = new URL('../artifacts/easy-converter-openings/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
try {
  const converter = await page.context().newPage();
  await converter.route(/^https?:/, route => route.abort());
  await converter.goto(pathToFileURL(fileURLToPath(new URL('../scripts/sh3d-convert/dist/index.html', import.meta.url))).href);
  await converter.locator('#format').selectOption('easy');
  const source = readFileSync(new URL('../scripts/sh3d-convert/fixtures/easy-content.json', import.meta.url), 'utf8');
  await converter.locator('#paste').fill(source);
  await converter.locator('#convert-paste').click();
  const downloading = converter.waitForEvent('download');
  await converter.locator('.level button').click();
  const download = await downloading;
  const document = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.deepEqual(document, convertEasy(source, { now: document.created_at }).documents[0]);
  await converter.close();

  const mount = async () => {
    await page.evaluate(async document => {
      const hass = window.__mkHass(), original = hass.callWS;
      hass.callWS = async message => {
        if (message.type === 'houseplan/config/get') return {
          config: { ...structuredClone(document.payload.config), model_version: document.model_version },
          rev: 1, can_write: false,
        };
        if (message.type === 'houseplan/layout/get') return { layout: structuredClone(document.payload.layout), rev: 1 };
        if (message.type === 'houseplan/config/set') throw Error('View must not write');
        return original(message);
      };
      await import('/assets/houseplan-panel.js');
      const panel = window.document.createElement('houseplan-panel');
      panel.hass = hass;
      window.document.querySelector('#host').append(panel);
      window.__card = panel.shadowRoot.querySelector('houseplan-card');
    }, document);
    await page.waitForFunction(() => window.__card?._loadOk);
  };
  const space = document.payload.config.spaces[0], opening = space.openings[0];
  for (const stage of ['initial', 'reload']) {
    if (stage === 'reload') await page.reload();
    await mount();
    const symbol = page.locator(`[data-hp="opening"][data-id="${opening.id}"]`);
    await symbol.waitFor({ state: 'visible' });
    check(`${stage}: door symbol visible over background`, await symbol.isVisible());
    check(`${stage}: doorway retains its host`, await page.evaluate(expected => {
      const c = window.__card, saved = c._curSpaceCfg.openings[0];
      return c._curSpaceCfg.plan_url === '/local/plan.png'
        && saved.host.id === expected.host.id && saved.host.t === expected.host.t;
    }, opening));
    check(`${stage}: no orphan symbol`, await page.locator('[data-hp="opening-orphan"]').count() === 0);
  }
  await page.screenshot({ path: fileURLToPath(new URL('reopened.png', artifacts)) });
} finally { await finish(browser); }
