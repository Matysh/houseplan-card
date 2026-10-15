// #876 AC6: native keyboard, measured targets and localized inherited choices.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('signal visibility localized controls');

const results = {};
for (const width of [360, 1280]) for (const language of ['ru', 'en']) for (const dark of [false, true]) {
  const prefix = `${width}-${language}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await launch({ width, height: 900 }, 1, [],
    width === 360 ? { hasTouch: true, isMobile: true } : {});
  try {
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await page.evaluate(async ({ language, dark }) => {
      const card = window.__card;
      card.setConfig({ type: 'custom:houseplan-card', language });
      card.hass = { ...card.hass, themes: { darkMode: dark } };
      const style = document.documentElement.style;
      style.setProperty('--primary-background-color', dark ? '#111318' : '#fafafa');
      style.setProperty('--card-background-color', dark ? '#202228' : '#fff');
      style.setProperty('--primary-text-color', dark ? '#f2f2f2' : '#202020');
      await window.__hpTest.settled();
      await window.__hpTest.setMode('devices');
      // The same mobile menu is the public entry, not a private opening method.
      let button = card.shadowRoot.querySelector('[data-hp="settings"]');
      if (!button || !button.getBoundingClientRect().width) {
        card.shadowRoot.querySelector('[data-hp="header-menu-toggle"]').click();
        await window.__hpTest.settled();
        button = card.shadowRoot.querySelector('[data-hp="header-menu-item"][data-id="settings"]');
      }
      button.click();
    }, { language, dark });
    const general = page.locator('houseplan-card hp-dialog[data-kind="settings"]');
    const checkbox = general.locator('#gs-show-lqi');
    await checkbox.waitFor();
    await checkbox.scrollIntoViewIfNeeded();
    const before = await checkbox.isChecked();
    await checkbox.focus();
    await page.keyboard.press('Space');
    results[`${prefix}-keyboardSpace`] = await checkbox.isChecked() !== before;
    await page.keyboard.press('Space');
    results[`${prefix}-keyboardRestores`] = await checkbox.isChecked() === before;
    const measured = await checkbox.evaluate(input => {
      const box = input.getBoundingClientRect(), row = input.closest('.hpf-toggle');
      const label = row.querySelector('.hpf-toggle-title').getBoundingClientRect();
      return { target: box.width >= 44 && box.height >= 44,
        readable: label.width > 40 && label.left >= 0 && label.right <= innerWidth + 1,
        text: row.textContent, focused: input.getRootNode().activeElement === input };
    });
    results[`${prefix}-target44`] = measured.target;
    results[`${prefix}-readableLocalized`] = measured.readable && measured.text.includes(language === 'ru' ? 'Показывать Zigbee-сигнал' : 'Show Zigbee signal');
    results[`${prefix}-focusStable`] = measured.focused;
    await page.keyboard.press('Tab');
    results[`${prefix}-tabLeavesControl`] = !(await checkbox.evaluate(input => input.getRootNode().activeElement === input));
    await page.evaluate(async () => {
      await window.__hpTest.close(document.querySelector('houseplan-card').shadowRoot.querySelector('hp-dialog[data-kind="settings"]'), { via: 'cancel' });
      await window.__hpTest.openSpaceDialog('edit', 'f1');
    });
    const radios = page.locator('houseplan-card hp-dialog[data-kind="space"] input[name$="-show-lqi"]');
    await radios.first().scrollIntoViewIfNeeded();
    await radios.first().focus();
    await page.keyboard.press('ArrowRight');
    results[`${prefix}-radioKeyboard`] = await radios.nth(1).isChecked();
    await page.keyboard.press('ArrowLeft');
    results[`${prefix}-radioInheritRestored`] = await radios.first().isChecked();
    results[`${prefix}-localChoicesFit`] = await radios.evaluateAll(inputs => inputs.length === 3 && inputs.every(input => {
      const label = input.closest('label'), box = label.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth + 1 && box.height >= 44;
    }));
    results[`${prefix}-noRawKeys`] = !(await radios.first().evaluate(input => input.closest('.hpf-inline').textContent)).includes('space.lqi_');
  } finally {
    checkAll(Object.fromEntries(Object.entries(results).filter(([key]) => key.startsWith(prefix))));
    await finish(browser, { [prefix]: 'observed' });
  }
}
console.log(JSON.stringify(results, null, 2));
if (Object.values(results).some(value => value !== true)) process.exitCode = 1;
