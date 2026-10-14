/** #867 AC3/AC7: localized native checkbox/help bounds and draft-only cancellation. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, checkAll, finish } from './serve.mjs';
import { installBatteryFixture } from './helpers/device-battery-fixture.mjs';

const { page, browser } = await launch();
const artifacts = new URL('../artifacts/device-signal-settings-867/', import.meta.url);
mkdirSync(artifacts, { recursive: true });
const out = {}, receipts = [];
try {
  await page.addStyleTag({ content: 'body { margin: 0; } #host { width: 100%; margin: 0; }' });
  await installBatteryFixture(page);
  for (const [language, darkMode, width] of [['en', false, 360], ['en', true, 1280], ['ru', false, 1280], ['ru', true, 360]]) {
    const key = `${language}-${darkMode ? 'dark' : 'light'}-${width}`;
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async ({ language, darkMode }) => {
      const variables = darkMode ? {
        '--primary-color': '#3ea6ff', '--primary-text-color': '#e6e7eb', '--secondary-text-color': '#9aa4ad',
        '--card-background-color': '#202126', '--ha-card-background': '#202126', '--divider-color': '#3a3d45',
      } : {
        '--primary-color': '#0b73b8', '--primary-text-color': '#202124', '--secondary-text-color': '#5f6368',
        '--card-background-color': '#ffffff', '--ha-card-background': '#ffffff', '--divider-color': '#d7d9de',
      };
      for (const [name, value] of Object.entries(variables)) document.documentElement.style.setProperty(name, value);
      document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
      const card = window.__card;
      card.setConfig({ type: 'custom:houseplan-card', language });
      card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode } };
      await window.__hpTest.setMode('devices');
      await window.__hpTest.openMarkerDialog('d_temp');
      await window.__hpTest.waitForWrites();
    }, { language, darkMode });
    const dialog = page.locator('#host houseplan-card hp-dialog[data-kind="marker"]');
    const checkbox = dialog.locator('#marker-hide-signal');
    await checkbox.scrollIntoViewIfNeeded();
    out[`${key}-localizedAccessibleDefault`] = !await checkbox.isChecked()
      && (await checkbox.getAttribute('aria-label') || await checkbox.evaluate(node => node.closest('label')?.textContent || '')).trim().length > 0;
    await checkbox.check();
    await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-device-preview')?.shadowRoot?.querySelector('.lqi'));
    const help = dialog.locator('hp-help[data-help-key="marker.hide_signal_help"]');
    const trigger = help.getByRole('button');
    // A real keyboard input selects keyboard modality; focus then opens the same accessible help surface.
    await page.keyboard.press('Tab'); await trigger.focus();
    await page.waitForFunction(() => window.__card.shadowRoot.querySelector('hp-help[data-help-key="marker.hide_signal_help"]')
      ?.shadowRoot?.querySelector('button')?.getAttribute('aria-expanded') === 'true');
    await page.waitForFunction(() => {
      const tip = window.__card.shadowRoot.querySelector('hp-help[data-help-key="marker.hide_signal_help"]')?.shadowRoot?.querySelector('.tooltip');
      return !!tip && tip.matches(':popover-open') && getComputedStyle(tip).visibility === 'visible' && Number(getComputedStyle(tip).opacity) > .99;
    });
    const receipt = await page.evaluate(() => {
      const r = window.__card.shadowRoot, checkbox = r.querySelector('#marker-hide-signal');
      const row = checkbox.closest('.hpf-toggle'), help = r.querySelector('hp-help[data-help-key="marker.hide_signal_help"]');
      const tip = help.shadowRoot.querySelector('.tooltip'), button = help.shadowRoot.querySelector('button');
      const bounds = node => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
      return { row: bounds(row), tip: bounds(tip), label: row.textContent.trim(), opacity: Number(getComputedStyle(tip).opacity),
        helpLabel: button.getAttribute('aria-label'), helpText: tip.textContent.trim(), viewport: { width: innerWidth, height: innerHeight },
        acceptedHasHide: !!window.__card._serverCfg.markers.find(marker => marker.id === 'd_temp').hide_signal,
        planLqi: r.querySelector('[data-id="d_temp"] .lqi')?.textContent.trim() };
    });
    receipts.push({ key, ...receipt });
    out[`${key}-helpAndRowInsideViewport`] = receipt.row.width > 0 && receipt.row.height >= 44 && receipt.opacity > .99
      && receipt.row.x >= -1 && receipt.row.right <= width + 1
      && receipt.tip.width > 0 && receipt.tip.height > 0 && receipt.tip.x >= 0 && receipt.tip.y >= 0
      && receipt.tip.right <= width + 1 && receipt.tip.bottom <= 901;
    out[`${key}-localizedHelpAndPlanUnchanged`] = !!receipt.helpLabel && !!receipt.helpText
      && !receipt.helpText.includes('marker.hide_signal') && !receipt.acceptedHasHide && receipt.planLqi === '154'
      && (language === 'ru' ? /Скрыть|скрыть/.test(receipt.label) : /Hide/.test(receipt.label));
    await page.screenshot({ path: fileURLToPath(new URL(`${key}.png`, artifacts)) });
    await page.keyboard.press('Escape');
    await page.evaluate(async () => {
      const closed = await window.__hpTest.close(undefined, { via: 'cancel' });
      closed.confirm?.querySelector('[data-hp="dialog-confirm"]')?.click();
      await window.__hpTest.settled();
    });
    out[`${key}-cancelKeepsStoredFlag`] = await page.evaluate(() => !window.__card._serverCfg.markers.find(marker => marker.id === 'd_temp').hide_signal);
  }
} finally {
  writeFileSync(new URL('evidence.json', artifacts), JSON.stringify({ out, receipts }, null, 2));
  checkAll(out); await finish(browser, out);
}
