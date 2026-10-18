// #876 AC6: native keyboard, measured targets and localized inherited choices.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('signal visibility localized controls');

const results = {};
for (const width of [360, 1280]) for (const language of ['ru', 'en']) for (const dark of [false, true]) {
  const prefix = `${width}-${language}-${dark ? 'dark' : 'light'}`;
  const { page, browser } = await launch({ width, height: 900 }, 1, [],
    width === 360 ? { hasTouch: true } : {});
  try {
    // The synthetic demo is an overflowing desktop document, unlike the HA
    // host. Keep touch input but require the actual360px CSS viewport rather
    // than Chromium mobile's expanded980px layout of that demo document.
    results[`${prefix}-realViewport`] = await page.evaluate(width=>innerWidth===width,width);
    await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    await page.evaluate(({ language, dark }) => {
      const card = window.__card;
      card.setConfig({ type: 'custom:houseplan-card', language });
      card.hass = { ...card.hass, themes: { darkMode: dark } };
      const style = document.documentElement.style;
      style.setProperty('--primary-background-color', dark ? '#111318' : '#fafafa');
      style.setProperty('--card-background-color', dark ? '#202228' : '#fff');
      style.setProperty('--primary-text-color', dark ? '#f2f2f2' : '#202020');
    }, { language, dark });
    // setConfig starts a new boot/render cycle. Wait for its visible root,
    // rather than retaining an obsolete updateComplete promise across reset.
    await page.waitForFunction(() => window.__card?._booting === false
      && !!window.__card?.shadowRoot.querySelector('ha-card[data-hp-mode]'));
    await page.evaluate(() => window.__hpTest.setMode('devices'));
    await page.evaluate(async () => {
      const card = window.__card;
      // The same mobile menu is the public entry, not a private opening method.
      let button = card.shadowRoot.querySelector('[data-hp="settings"]');
      if (!button || !button.getBoundingClientRect().width) {
        card.shadowRoot.querySelector('[data-hp="header-menu"]').click();
        await window.__hpTest.settled();
        button = card.shadowRoot.querySelector('[data-hp="header-menu-item"][data-id="settings"]');
      }
      button.click();
    });
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
    const space = page.locator('houseplan-card hp-dialog[data-kind="space"]');
    if(width===360){
      const nav=space.locator('.hpf-settings-mobile hp-settings-select');
      const label=await nav.locator('select option[value=room-cards]').textContent();
      await nav.locator('button').first().click();await nav.getByRole('option',{name:label.trim(),exact:true}).click();
    }else await space.locator('[data-section-target=room-cards]').click();
    const native = space.locator('select[name$="-show-lqi"]');
    const select = space.locator('hp-settings-select:has(select[name$="-show-lqi"])');
    const button = select.locator('button').first();await button.focus();
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    results[`${prefix}-selectKeyboard`] = await native.inputValue()==='on';
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Home');await page.keyboard.press('Enter');
    results[`${prefix}-selectInheritRestored`] = await native.inputValue()==='inherit';
    await button.click();
    await select.locator('[role=listbox].visible').waitFor({state:'visible'});
    await select.locator('[role=listbox]').evaluate(async el=>{el.getBoundingClientRect();await Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>{})));});
    results[`${prefix}-localChoicesFit`] = await select.locator('[role=option]').evaluateAll(options => options.length===3&&options.every(option=>{
      const box=option.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&box.height>=44-.01;
    }));
    results[`${prefix}-noRawKeys`] = !(await select.locator('[role=listbox]').innerText()).includes('space.lqi_');
    await page.keyboard.press('Escape');
  } finally {
    checkAll(Object.fromEntries(Object.entries(results).filter(([key]) => key.startsWith(prefix))));
    await finish(browser, { [prefix]: 'observed' });
  }
}
console.log(JSON.stringify(results, null, 2));
if (Object.values(results).some(value => value !== true)) process.exitCode = 1;
