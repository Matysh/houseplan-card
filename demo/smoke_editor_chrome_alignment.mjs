// #1352: shared header close geometry and equal single-row editor chrome.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser('#1352 editor chrome alignment');
const { page, browser } = await launch({ width: 1920, height: 900 });
try {
  await page.evaluate(async () => {
    const host = document.getElementById('host');
    host.style.cssText = 'width:1920px;margin:0;padding:0';
    const panel = document.createElement('houseplan-panel');
    panel.panel = { component_name: 'houseplan-panel' };
    panel.route = { prefix: '/houseplan', path: '' };
    panel.narrow = false;
    panel.hass = window.__mkHass();
    host.replaceChildren(panel);
    await import('/assets/houseplan-panel.js');
    await customElements.whenDefined('houseplan-panel');
    for (let n = 0; n < 90 && !panel.shadowRoot?.querySelector('houseplan-card'); n++)
      await new Promise(requestAnimationFrame);
    window.__card = panel.shadowRoot.querySelector('houseplan-card');
  });
  await page.waitForFunction(() => window.__card?._model?.length && !window.__card._booting);
  await page.evaluate(async () => { await window.__card._ensureEditorRuntime(); await window.__hpTest.settled(); });
  const card = page.locator('houseplan-panel houseplan-card');
  const settled = async () => {
    await page.waitForFunction(() => !window.__card._modeTransitionBusy && !window.__card._modeTransitionPreparing);
    await page.evaluate(() => window.__hpTest.settled());
  };
  const geometry = () => page.evaluate(() => {
    const root = window.__card.renderRoot;
    const box = element => {
      const r = element.getBoundingClientRect();
      return { y: r.y, height: r.height, bottom: r.bottom, width: r.width };
    };
    const header = root.querySelector('.hdr > .head');
    const close = header.querySelector('.closex');
    const path = close.querySelector('ha-icon').shadowRoot.querySelector('path');
    const paint = path.getBBox();
    const centre = new DOMPoint(paint.x + paint.width / 2, paint.y + paint.height / 2).matrixTransform(path.getScreenCTM());
    const bar = root.querySelector('.editbar');
    const color = bar.querySelector('hp-color-opacity');
    return { close: box(close), glyphCentre: centre.y, tab: box(header.querySelector('.modetab.active')),
      slot: box(header.querySelector('.editor-close-slot')), bar: box(bar),
      controls: [...bar.querySelectorAll('.editbar-tools > button,.editbar-end > button')].map(box),
      color: color ? box(color.shadowRoot.querySelector('.trigger')) : null };
  });
  for (const width of [1920, 1000, 600]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(width => { document.getElementById('host').style.width = `${width}px`; }, width);
    await settled();
    const bars = [];
    for (const mode of ['plan', 'devices', 'decor']) {
      await card.locator(`.head [data-mode="${mode}"]`).click();
      await settled();
      const close = card.locator('.head [data-hp="editor-close"]');
      const aligned = value => Math.abs(value.close.y - value.tab.y) < .5
        && Math.abs(value.close.height - value.tab.height) < .5
        && value.close.width >= 44 && value.close.height >= 44
        && Math.abs(value.close.y - value.slot.y) < .5
        && Math.abs(value.glyphCentre - value.tab.y - value.tab.height / 2) < .5;
      const idle = await geometry();
      check(`${width}-${mode}-header-close-aligned`, aligned(idle));
      await close.hover();
      check(`${width}-${mode}-header-close-hover-aligned`, aligned(await geometry()));
      await close.focus();
      check(`${width}-${mode}-header-close-focus-aligned`, aligned(await geometry()));
      check(`${width}-${mode}-tools-not-clipped`, idle.controls.every(control => control.width > 0
        && control.y >= idle.bar.y && control.bottom <= idle.bar.bottom));
      if (mode === 'decor') {
        check(`${width}-compact-colour-trigger`, idle.color.width === 40 && idle.color.height === 40);
      }
      bars.push(idle.bar.height);
    }
    if (width >= 1000) check(`${width}-equal-single-row-toolbar-heights`, bars.every(height => Math.abs(height - bars[0]) < .5));
    console.log(JSON.stringify({ editorChrome: { width, toolbarHeights: bars } }));
  }
  const picker = card.locator('hp-color-opacity[data-field="decor-color"]');
  await picker.locator('[data-field="colour-open"]').click();
  await picker.locator('[data-field="colour-hex"]').fill('#13579b');
  await picker.locator('[data-field="colour-hex"]').press('Tab');
  await picker.locator('[data-field="colour-opacity"][data-value="number"]').fill('65');
  await picker.locator('[data-field="colour-opacity"][data-value="number"]').press('Tab');
  await picker.locator('[data-action="colour-confirm"]').click();
  check('compact-picker-keeps-colour-and-opacity', await page.evaluate(() =>
    window.__card._decorStyle.color.toLowerCase() === '#13579b' && window.__card._decorStyle.opacity === .65));
  await card.locator('.head [data-hp="editor-close"]').click();
  await settled();
  check('header-close-returns-to-view', await page.evaluate(() => window.__card._mode === 'view'
    && !window.__card.renderRoot.querySelector('.head .closex')));
} finally {
  await finish(browser);
}
