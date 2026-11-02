// #1157: approved persistent copy in the real shared settings dialog.
import { readFileSync, mkdirSync } from 'node:fs';
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1280, height: 720 });
const artifacts = new URL('../artifacts/zigbee-map-explanation/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
try {
  await page.evaluate(async () => {
    const c = window.__card;
    c.hass = { ...c.hass, language: 'ru' };
    await c._ensureEditorRuntime();
    c._openSettingsDialog(); await c.updateComplete;
    c.shadowRoot.querySelector('[data-section-target="zigbee"]').click();
    await c.updateComplete;
  });
  const settings = page.locator('hp-dialog[data-kind="settings"] hp-zigbee-topology-settings');
  for (const lang of ['ru', 'en', 'de', 'fr']) {
    const copy = JSON.parse(readFileSync(new URL(`../src/i18n/topology/${lang}.json`, import.meta.url)));
    await page.evaluate(async language => {
      const c = window.__card;
      c.hass = { ...c.hass, language };
      await c._ensureEditorRuntime();
      await c.updateComplete;
    }, lang);
    await settings.evaluate((element, language) => { element.language = language; }, lang);
    const hint = settings.locator('p.hpf-hint').filter({ hasText: copy.map_explanation });
    await hint.waitFor({ state: 'visible' });
    for (const enabled of [false, true]) {
      await settings.evaluate(async (element, value) => {
        element.value = { ...element.value, enabled: value };
        await element.updateComplete;
      }, enabled);
      check(`${lang}: persistent hint (${enabled})`, await hint.count() === 1 && await hint.isVisible());
      check(`${lang}: existing help preserved`, await settings.locator('hp-help[data-help-key="topology.help"]').evaluate((e, expected) => e.text === expected, copy.help));
    }
    check(`${lang}: below toggle, before topics`, await hint.evaluate(element => {
      const root = element.getRootNode();
      const toggle = root.querySelector('[data-field="zigbee-enabled"]');
      const topics = root.querySelector('textarea');
      return !!(toggle.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING)
        && !!topics && !!(element.compareDocumentPosition(topics) & Node.DOCUMENT_POSITION_FOLLOWING);
    }));
  }
  await settings.evaluate(async element => {
    element.language = 'ru'; element.value = { ...element.value, enabled: false };
    await element.updateComplete;
  });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 720 });
    const hint = settings.locator('p.hpf-hint').first();
    check(`${width}: wraps within dialog`, await hint.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.left >= 0 && rect.right <= innerWidth
        && element.scrollWidth <= element.clientWidth + 1;
    }));
    await page.screenshot({ path: new URL(`settings-${width}.png`, artifacts).pathname });
  }
} finally {
  await finish(browser);
}
