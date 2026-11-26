import { expect } from 'playwright/test';
import { launchColdView, finish } from './serve.mjs';
import { externalSignal, installExternalAlertFixture } from './helpers/external-alert-fixture.mjs';

const { page, browser } = await launchColdView({ width: 1280, height: 950 });
try {
  await page.evaluate(async () => {
    const card = window.__card;
    card.setConfig({ type: 'custom:houseplan-card', icon_size: 5, language: 'ru' });
    await window.__hpTest.setServerConfig(config => ({
      ...config, markers: [
        { id: 'd_kettle', binding: 'device:d_kettle', space: 'f1', display: 'icon_ripple', tap_action: 'info' },
      ],
    }));
  });
  await installExternalAlertFixture(page);
  await page.evaluate(async () => {
    await customElements.whenDefined('houseplan-space-card');
    const card = document.createElement('houseplan-space-card');
    card.id = 'static-signals';
    card.style.display = 'block';
    card.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', language: 'ru' });
    card.hass = window.__card.hass;
    document.querySelector('#host').appendChild(card);
  });
  const full = page.locator('[data-hp="device"][data-id="d_kettle"]').first();
  const space = page.locator('#static-signals [data-hp="device"][data-id="d_kettle"]');
  const info = page.locator('hp-dialog[data-kind="info"]');
  const publish = rows => page.evaluate(rows => window.__publishExternalAlerts(rows), rows);
  await expect(full).toBeVisible();
  await expect(space).toBeAttached();
  await publish([externalSignal('d_kettle', 'attention')]);
  await expect(full.locator('.device-attention')).toBeVisible();
  await expect(space.locator('.device-attention')).toBeAttached();
  await full.click();
  await expect(info.locator('.device-issue')).toContainText('Температура выше порога');
  await expect(info.locator('.device-issue')).toContainText('Сигнал из Home Assistant');
  await publish([externalSignal('d_kettle', 'alarm')]);
  await expect(full).toHaveClass(/\balarm\b/);
  await expect(space).toHaveClass(/\balarm\b/);
  await expect(info.locator('.device-issues.alarm .device-issue')).toBeVisible();

  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__card.setConfig({ type: 'custom:houseplan-card', kiosk: true, cycle: 0 }));
  await expect(full).toHaveClass(/\balarm\b/);
  await publish([externalSignal('d_kettle', 'alarm', 'entity:input_boolean.some_other_binding')]);
  await expect(full).not.toHaveClass(/\balarm\b/);
  await expect(space).not.toHaveClass(/\balarm\b/);
  await publish([externalSignal('d_kettle', 'attention')]);
  await expect(full.locator('.device-attention')).toBeVisible();
  await publish([]);
  await expect(full.locator('.device-attention')).toHaveCount(0);
  await expect(space.locator('.device-attention')).toHaveCount(0);
  console.log('PASS #1001 external signals on panel, static card and kiosk');
} finally {
  await finish(browser);
}
