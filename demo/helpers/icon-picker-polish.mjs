import assert from 'node:assert/strict';
import {expect} from 'playwright/test';
import {waitForUiKitPaint} from './ui-kit-paint.mjs';

const transparent = value => value.replace(/\s/g,'') === 'rgba(0,0,0,0)' || value === 'transparent';
export async function assertIconPickerPolish(page,picker,{desktop=false,reduced=false}={}) {
  await waitForUiKitPaint(page);
  const m=await picker.evaluate(p=>{
    const root=p.shadowRoot,field=root.querySelector('.field'),trigger=root.querySelector('.trigger');
    const clear=root.querySelector('.clear'),arrow=root.querySelector('.arrow');
    let center=null;
    if(clear){
      const r=clear.getBoundingClientRect(),path=clear.querySelector('path'),b=path.getBBox();
      const c=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(path.getScreenCTM());
      center={width:r.width,height:r.height,radius:getComputedStyle(clear).borderRadius,dx:c.x-r.x-r.width/2,dy:c.y-r.y-r.height/2};
    }
    const rotation=new DOMMatrix(getComputedStyle(arrow).transform);
    return {cursor:getComputedStyle(field).cursor,border:getComputedStyle(field).borderTopWidth,
      shadow:getComputedStyle(field).boxShadow,outline:getComputedStyle(trigger).outlineStyle,
      arrow:{a:rotation.a,d:rotation.d,duration:getComputedStyle(arrow).transitionDuration},center,
      taps:[field,trigger,clear].filter(Boolean).map(e=>getComputedStyle(e).getPropertyValue('-webkit-tap-highlight-color'))};
  });
  assert.equal(m.cursor,'pointer');assert.equal(m.border,'1px');assert.equal(m.shadow,'none');assert.equal(m.outline,'none');
  assert.ok(Math.abs(m.arrow.a-1)<.001&&Math.abs(m.arrow.d-1)<.001,'closed arrow is upright');
  assert.equal(m.arrow.duration,reduced?'0s':'0.16s');
  if(m.center){assert.equal(m.center.width,40);assert.equal(m.center.height,40);assert.equal(m.center.radius,'50%');assert.ok(Math.abs(m.center.dx)<.01&&Math.abs(m.center.dy)<.01,JSON.stringify(m.center));}
  for(const value of m.taps)assert.ok(transparent(value),'tap highlight: '+value);
  if(desktop){
    const field=picker.locator('.field');await field.hover();await waitForUiKitPaint(page);
    const own=await field.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopColor}));
    const ordinary=page.locator('hp-settings-select:has(#marker-display) button');await ordinary.hover();await waitForUiKitPaint(page);
    assert.deepEqual(own,await ordinary.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopColor})), 'same hover paint as the ordinary select');
    if(await picker.locator('.clear').count()){
      await picker.locator('.clear').hover();await waitForUiKitPaint(page);
      const color=await picker.locator('.clear').evaluate(e=>getComputedStyle(e).backgroundColor);
      assert.equal(color.replace(/\s/g,''),'rgba(127,127,127,0.16)');
    }
    await page.mouse.move(2,2);await waitForUiKitPaint(page);
  }
}

export async function assertPickerOpenPolish(page,dialog,picker,{reduced=false}={}) {
  await waitForUiKitPaint(page);
  const menu=dialog.locator('.menu.visible:has(input[role=combobox])'),search=menu.locator('input[role=combobox]');
  const options=menu.locator('[role=option]');await expect(options.first()).toBeVisible();
  await expect(menu.locator('[role=option].active')).toHaveCount(0);await expect(search).not.toHaveAttribute('aria-activedescendant');
  await expect(menu.locator('.status')).toHaveCount(0);
  const arrow=await picker.locator('.arrow').evaluate(e=>{const s=getComputedStyle(e),m=new DOMMatrix(s.transform);return {a:m.a,d:m.d,duration:s.transitionDuration};});
  assert.ok(Math.abs(arrow.a+1)<.001&&Math.abs(arrow.d+1)<.001,'open arrow turns 180 degrees');assert.equal(arrow.duration,reduced?'0s':'0.16s');
  assert.ok(transparent(await options.first().evaluate(e=>getComputedStyle(e).getPropertyValue('-webkit-tap-highlight-color'))));
  await search.press('ArrowDown');await expect(options.first()).toHaveClass(/active/);
  assert.equal(await search.getAttribute('aria-activedescendant'),await options.first().getAttribute('id'));
  await search.fill('fan');await search.fill('');await expect(menu.locator('[role=option].active')).toHaveCount(0);
  await search.press('ArrowUp');await expect(options.last()).toHaveClass(/active/);
  assert.equal(await search.getAttribute('aria-activedescendant'),await options.last().getAttribute('id'));
}

export async function assertAutomaticIcon(page,picker,{cleared=true}={}) {
  const expected=await page.evaluate(()=>window.__card._autoIconForBinding(window.__card._markerDialog.binding));
  assert.ok(expected);await expect(picker).toHaveJSProperty('autoIcon',expected);
  if(cleared){
    await expect(picker).toHaveJSProperty('value','');await expect(picker.locator('.trigger span')).toHaveText(expected);
    await expect.poll(()=>picker.evaluate(p=>p.shadowRoot.querySelector('.trigger>svg path')?.getAttribute('d')===p._catalog?.get(p.autoIcon))).toBe(true);
    const preview=page.locator('hp-dialog[data-kind=marker] hp-device-preview');
    if(await preview.count())await expect.poll(()=>preview.evaluate(p=>p.presentation?.icon)).toBe(expected);
  }
  return expected;
}
