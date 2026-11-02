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
      card.hass = { ...card.hass, language, locale:{...card.hass.locale,language}, themes: { darkMode: dark } };
      const style = document.documentElement.style;
      style.setProperty('--primary-background-color', dark ? '#111318' : '#fafafa');
      style.setProperty('--card-background-color', dark ? '#202228' : '#fff');
      style.setProperty('--primary-text-color', dark ? '#f2f2f2' : '#202020');
    }, { language, dark });
    // Each case starts a fresh card. Set HA's language without tearing that
    // card down, then observe the public mode instead of a CDP-held promise.
    await page.waitForFunction(() => window.__card?._booting === false
      && !!window.__card?.shadowRoot.querySelector('ha-card[data-hp-mode]'));
    await page.evaluate(() => { void window.__hpTest.setMode('devices'); });
    await page.waitForFunction(()=>window.__card?.renderRoot.querySelector('ha-card[data-hp-mode]')?.getAttribute('data-hp-mode')==='devices');
    // Native clicks resolve the current visible control after lazy locale/mode
    // work. A CDP-held settled() promise can be collected during that change;
    // the actual settings field below, not that promise, is the entry oracle.
    const settingsButton = page.locator('houseplan-card [data-hp="settings"]');
    await settingsButton.click();
    const general = page.locator('houseplan-card hp-dialog[data-kind="settings"]');
    const nativeGlobal = general.locator('#gs-show-lqi');
    const globalSelect = general.locator('hp-settings-select:has(#gs-show-lqi)');
    const globalButton = globalSelect.locator('button').first();
    await globalButton.scrollIntoViewIfNeeded();
    const before = await nativeGlobal.inputValue();
    await globalButton.focus();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Enter');
    results[`${prefix}-keyboardSelect`] = await nativeGlobal.inputValue() !== before;
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Home'); await page.keyboard.press('Enter');
    results[`${prefix}-keyboardRestores`] = await nativeGlobal.inputValue() === before;
    results[`${prefix}-threeChoices`] = await nativeGlobal.locator('option').count() === 3;
    const measured = await globalButton.evaluate(input => {
      const box = input.getBoundingClientRect(), row = input.getRootNode().host.closest('.hpf-field');
      const label = row.querySelector('.hpf-label').getBoundingClientRect();
      return { target: box.width >= 44 && box.height >= 44,
        readable: label.width > 40 && label.left >= 0 && label.right <= innerWidth + 1,
        text: row.textContent, focused: input.getRootNode().activeElement === input };
    });
    results[`${prefix}-target44`] = measured.target;
    results[`${prefix}-readableLocalized`] = measured.readable && measured.text.includes(language === 'ru' ? 'Показывать Zigbee-сигнал' : 'Show Zigbee signal');
    results[`${prefix}-focusStable`] = measured.focused;
    await page.keyboard.press('Tab');
    results[`${prefix}-tabLeavesControl`] = !(await globalButton.evaluate(input => input.getRootNode().activeElement === input));
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
    results[`${prefix}-localChoicesFit`] = await select.locator('[role=option]').evaluateAll(options => options.length===4&&options.every(option=>{
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
