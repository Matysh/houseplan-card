import assert from 'node:assert/strict';
import { expect } from 'playwright/test';
import { launchColdView, finish } from './serve.mjs';

const { page, browser } = await launchColdView({ width: 1440, height: 900 });
// #1428: assert rendered paint and native focus, not just a CSS class. The kit
// uses its one ordinary border for hover, selection and actual Tab traversal.
async function singleBorder(button, label, accent) {
  await expect.poll(() => button.evaluate(el => {
    const style = getComputedStyle(el);
    return {outline:style.outlineStyle, shadow:style.boxShadow,
      border:style.borderTopWidth, color:style.borderTopColor};
  }), {message:label}).toEqual({outline:'none', shadow:'none', border:'1px', color:accent});
}
async function tabTo(button) {
  // A real preceding Tab stop avoids crossing browser chrome when this is the
  // only header button. Focus the test cursor, never the button under assertion.
  await button.evaluate(el=>{
    const cursor=document.createElement('span');cursor.tabIndex=0;
    cursor.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    el.before(cursor);el.__tabCursor=cursor;cursor.focus();
  });
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  await button.evaluate(el=>{el.__tabCursor?.remove();delete el.__tabCursor;});
}
async function settled() {
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing);
  await page.evaluate(async()=>{
    await window.__hpTest.settled();
    for(let i=0;i<5;++i)await new Promise(requestAnimationFrame);
  });
}
try {
  await page.evaluate(()=>{
    document.getElementById('host').style.cssText='width:100%;box-sizing:border-box;margin:0;padding:8px';
  });
  await page.locator('[data-hp="support"]').click();
  const dialog = page.locator('hp-dialog[data-kind="support"]');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const support = page.locator('[data-hp="support"]');
  await expect(support).toBeFocused();
  assert.equal(await support.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  await page.keyboard.press('Tab');
  assert.equal(await support.evaluate(el => el.classList.contains('hp-dialog-return-focus')), false);
  for (const dark of [false, true]) {
    await page.evaluate(dark => {
      window.__card.style.setProperty('--primary-color', dark ? '#64b5f6' : '#1976d2');
      window.__card.style.setProperty('--card-background-color', dark ? '#202020' : '#fff');
    }, dark);
    for (const mode of ['plan', 'devices', 'decor']) {
      const button = page.locator(`[data-hp="mode-tab"][data-mode="${mode}"]`);
      await button.click();
      await page.waitForFunction(mode => window.__card?._mode === mode && !window.__card?._modeTransitionPreparing, mode);
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => window.__card?._mode === 'view');
      await expect(button).toBeFocused();
      assert.equal(await button.evaluate(el => getComputedStyle(el).outlineStyle), 'none', `${mode}: automatic return`);
      await page.keyboard.press('Tab');
      assert.equal(await button.evaluate(el => el.classList.contains('hp-dialog-return-focus')), false);
      await page.keyboard.press('Shift+Tab');
      await expect(button).toBeFocused();
      await singleBorder(button, `${mode}: real keyboard navigation`, dark ? 'rgb(100, 181, 246)' : 'rgb(25, 118, 210)');
      await page.keyboard.press('Escape');
      assert.equal(await button.evaluate(el => el.classList.contains('hpf-tab-focus')), false, 'Escape retires, never revives Tab paint');
      await page.keyboard.press('Escape');
      assert.equal(await button.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
    }
    const accent = dark ? 'rgb(100, 181, 246)' : 'rgb(25, 118, 210)';
    for (let cycle = 0; cycle < 3; ++cycle) {
      await page.mouse.move(5, 5);
      await tabTo(support);
      await singleBorder(support, 'Tab on header action', accent);
      await page.keyboard.press('Enter');
      await expect(dialog).toBeVisible();
      const close = dialog.locator('button.close');
      await tabTo(close);
      await singleBorder(close, 'Tab on dialog close', accent);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(support).toBeFocused();
      for (const key of ['Escape', 'Escape', 'Shift', 'ArrowRight']) {
        await page.keyboard.press(key);
        assert.equal(await support.evaluate(el => el.classList.contains('hpf-tab-focus')), false, `${key} is not Tab`);
        assert.equal(await support.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
      }
      await tabTo(support);
      await singleBorder(support, 'new Tab after automatic return', accent);
      await page.mouse.move(5, 5);
      await support.focus();
    }
    // Joined zoom segments and compact mode/navigation use the same border.
    for (const width of [1440, 430]) {
      await page.setViewportSize({width, height:900});
      await settled();
      const buttons = page.locator('.hdr button.hpf-icon-action:visible, .hdr button.hpf-nav-item:visible');
      for (let index = 0; index < await buttons.count(); ++index) {
        const button = buttons.nth(index);
        if (await button.isDisabled()) continue;
        await tabTo(button);
        await singleBorder(button, `header ${width}/${index}`, accent);
      }
    }
    await page.setViewportSize({width:1440, height:900});
    await page.evaluate(async dark => {
      await customElements.whenDefined('houseplan-space-card');
      const card=document.createElement('houseplan-space-card');
      card.id='focus-static'; card.style.cssText='display:block;width:320px';
      card.style.setProperty('--primary-color',dark?'#64b5f6':'#1976d2');
      card.setConfig({type:'custom:houseplan-space-card',space:'f1',show_button:true});
      card.hass=window.__card.hass; document.body.append(card); await card.updateComplete;
    },dark);
    const staticButton=page.locator('#focus-static button.hp-static-btn.on');
    await expect(staticButton).toBeVisible();
    await tabTo(staticButton);
    await expect(staticButton).toHaveClass(/hpf-tab-focus/);
    await singleBorder(staticButton,'independent Static owner',accent);
    await page.keyboard.press('Escape');
    await expect(staticButton).not.toHaveClass(/hpf-tab-focus/);
    await page.evaluate(()=>document.getElementById('focus-static').remove());

    await page.setViewportSize({width:320,height:900});
    await page.evaluate(()=>document.getElementById('host').style.width='260px');
    await settled();
    const trigger=page.locator('[data-hp="header-actions-trigger"]');
    await expect(trigger).toBeVisible();
    await tabTo(trigger); await page.keyboard.press('Enter');
    const menu=page.locator('[data-hp="header-actions-menu"]:not([inert])');
    await expect(menu).toBeVisible();
    for(const key of [null,'ArrowDown','End','Home','ArrowUp']){
      if(key) await page.keyboard.press(key);
      const current=menu.locator('button.hpf-keyboard-current');
      await expect(current).toHaveCount(1); await expect(current).toBeFocused();
      await expect.poll(()=>current.evaluate(el=>{
        const s=getComputedStyle(el);return [s.borderLeftWidth,s.borderLeftColor,s.outlineStyle,s.boxShadow];
      })).toEqual(['1px',accent,'none','none']);
      await expect(current).not.toHaveClass(/hpf-tab-focus/);
    }
    await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).not.toHaveClass(/hpf-(tab-focus|keyboard-current)/);
    await tabTo(trigger); await singleBorder(trigger,'Tab after composite close',accent);

    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>document.getElementById('host').style.width='100%');
    await settled();
    await page.locator('[data-hp="mode-tab"][data-mode="decor"]').click();
    await settled();
    const shapes=page.locator('[data-editor-group="shapes"]');
    await expect(shapes).toBeVisible();
    await tabTo(shapes); await page.keyboard.press('ArrowDown');
    for(const key of [null,'ArrowRight','End','Home']){
      if(key) await page.keyboard.press(key);
      const item=page.locator('.editor-group-item.hpf-keyboard-current');
      await expect(item).toHaveCount(1); await expect(item).toBeFocused();
      await singleBorder(item,'composite editor group current',accent);
    }
    await page.keyboard.press('Escape');
    await expect(shapes).toBeFocused();
    await expect(shapes).not.toHaveClass(/hpf-(tab-focus|keyboard-current)/);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>window.__card._mode==='view');
  }
} finally { await finish(browser); }
