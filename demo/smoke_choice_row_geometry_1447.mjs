import assert from 'node:assert/strict';
import { expect } from 'playwright/test';
import { launch, finish, requirePinnedBrowser } from './serve.mjs';
import { GOLDEN_SCENARIOS } from './golden/matrix.mjs';
import { prepareGoldenScenario } from './golden/harness.mjs';
import { formKitCss, CARD_DIALOG_FORM_KIT } from '../test-build/styles/form-kit.styles.js';

requirePinnedBrowser('#1447 choice row footprint');
const { page, browser } = await launch({ width: 1100, height: 1000 });
const scene = GOLDEN_SCENARIOS.find(s => s.id === 'more-info-dialog-mobile-ru');
assert.ok(scene);
const rows = () => page.locator('hp-dialog [data-more-info-target] .hpf-cand');
const geometry = () => rows().evaluateAll(items => items.map(el => {
  const box = el.getBoundingClientRect(), text = el.querySelector('span').getBoundingClientRect();
  const check = el.querySelector('.hpf-choice-check')?.getBoundingClientRect();
  return [box.width, box.height, text.x - box.x, text.y - box.y,
    ...(check ? [check.x - box.x, check.y - box.y] : [])].map(n => Math.round(n * 1000) / 1000);
}));
async function tabTo(button) {
  await button.evaluate(el => {
    const cursor = document.createElement('span'); cursor.tabIndex = 0;
    cursor.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    el.before(cursor); el.__tabCursor = cursor; cursor.focus();
  });
  await page.keyboard.press('Tab'); await expect(button).toBeFocused();
  await button.evaluate(el => { el.__tabCursor.remove(); delete el.__tabCursor; });
}
try {
  for (const width of [360, 1100]) for (const theme of ['light', 'dark']) {
    await prepareGoldenScenario(page, { ...scene, theme, viewport: { width, height: 1000 }, panelHost: true });
    const ordinary = await geometry();
    assert.ok(ordinary.length >= 3);
    assert.ok(ordinary.every(row => row[1] === 62), `historical two-line rows are 62px: ${ordinary}`);
    // Independent historical density oracle on the actual rendered controls:
    // the old borderless paddings and absolute check position, not a new PNG.
    await page.evaluate(() => {
      const style = document.createElement('style'); style.id = 'choice-row-old-density';
      style.textContent = '.hpf-cand:is(button){border:0!important;padding:8px 10px!important}'
        + '.hpf-panel .hpf-cand:is(button){padding:10px 36px 10px 12px!important}'
        + '.hpf-panel .hpf-cand:is(button)>.hpf-choice-check{inset-inline-end:12px!important}';
      window.__goldenCard.renderRoot.append(style);
    });
    const historical = await geometry();
    await page.evaluate(() => window.__goldenCard.renderRoot.querySelector('#choice-row-old-density').remove());
    assert.deepEqual(await geometry(), historical, `${width}/${theme}: border preserves text, rows and check`);

    const first = rows().first();
    for (const state of ['disabled', 'aria-disabled']) {
      await first.evaluate((el, state) => el.setAttribute(state, state === 'disabled' ? '' : 'true'), state);
      await first.hover({ force: true });
      assert.deepEqual(await geometry(), ordinary, `${state} reserves the same border and padding`);
      assert.equal(await first.evaluate(el => getComputedStyle(el).borderTopWidth), '1px');
      await first.evaluate((el, state) => el.removeAttribute(state), state);
    }
    const expectedAccent = await rows().filter({ has: page.locator('.hpf-choice-check') }).evaluateAll(items => getComputedStyle(items[0]).color);
    await first.hover();
    await expect.poll(() => first.evaluate(el => getComputedStyle(el).borderTopColor)).toBe(expectedAccent);
    await page.mouse.move(0, 0); await tabTo(first);
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    await expect(first).toBeFocused(); await expect(first).toHaveClass(/hpf-tab-focus/);
    await expect.poll(() => first.evaluate(el => {
      const s = getComputedStyle(el); return [s.borderTopWidth, s.borderTopColor, s.outlineStyle, s.boxShadow];
    })).toEqual(['1px', expectedAccent, 'none', 'none']);
    assert.deepEqual(await geometry(), ordinary, 'native hover/Tab never moves rows');
  }
  const long = 'Длинная подпись выбранного источника с несколькими словами и оченьдлиннымнеразрывнымназванием';
  await prepareGoldenScenario(page, { ...scene, panelHost: true,
    stateOverrides: { 'switch.golden_washer_child_lock': { attributes: { friendly_name: long } } } });
  const selected = page.locator('hp-dialog [data-more-info-target] .hpf-cand[aria-selected=true]');
  await expect(selected).toContainText(long);
  assert.ok((await selected.boundingBox()).height >= 44);
  assert.equal(await selected.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
  const legacy = await page.evaluate(async css => {
    // Compatibility API on native elements, independent of the live sheet.
    const frame = document.createElement('iframe'); frame.style.cssText = 'width:300px;height:250px';
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.head.innerHTML = '<style>body{font:14px/20px Arial}' + css + '</style>';
    doc.body.innerHTML = '<hp-dialog><div class="hpf-form"><div class="hpf-panel">'
      + '<button class="hpf-cand"><span>Label</span><small>Reference</small></button>'
      + '<div role="option" class="hpf-cand"><span>Label</span><small>Reference</small></div>'
      + '</div><button class="hpf-cand"><span>Label</span><small>Reference</small></button></div></hp-dialog>';
    const items = [...doc.querySelectorAll('.hpf-cand')];
    const read = () => items.map(el => {
      const box = el.getBoundingClientRect(), text = el.firstElementChild.getBoundingClientRect();
      return [box.height, text.x - box.x, frame.contentWindow.getComputedStyle(el).borderTopWidth];
    });
    const enabled = read(); items[0].disabled = true; items[2].setAttribute('aria-disabled', 'true');
    const disabled = read(); frame.remove(); return { enabled, disabled };
  }, formKitCss(CARD_DIALOG_FORM_KIT, { withSwitch: false }));
  assert.deepEqual(legacy.enabled, [[62, 12, '1px'], [62, 12, '0px'], [58, 10, '1px']]);
  assert.deepEqual(legacy.disabled, legacy.enabled, 'legacy densities and non-button listbox rows retain their geometry');
  console.log('PASS #1447 actual source-picker rows: historical 62px/text/check, states, light/dark, mobile/desktop, hover/Tab, long label');
} finally { await finish(browser); }
