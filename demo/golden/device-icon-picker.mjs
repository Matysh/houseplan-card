/** #1375: a captured field must be the fully painted local MDI picker. */
export async function inspectDeviceIconPicker(page, { expectedValue, filled = true } = {}) {
  await page.waitForFunction(needIcon => {
    const card=window.__goldenCard||window.__card;
    const p=card?.renderRoot.querySelector('hp-dialog[data-kind="marker"] hp-icon-picker');
    return p?.shadowRoot?.querySelector('.field')?.getBoundingClientRect().height>0 && (!needIcon||!!p?.shadowRoot?.querySelector('.trigger>svg path')?.getAttribute('d') && !!p?._catalog);
  },filled);
  const result=await page.evaluate(()=>{
    const card=window.__goldenCard||window.__card;
    const dialog=card.renderRoot.querySelector('hp-dialog[data-kind="marker"]');
    const picker=dialog.querySelector('hp-icon-picker');
    const root=picker.shadowRoot,paint=root.querySelector('.field');
    const trigger=root.querySelector('.trigger'),clear=root.querySelector('.clear'),arrow=root.querySelector('.arrow');
    const path=root.querySelector('.trigger>svg path');
    const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    const style = getComputedStyle(paint), bounds = rect(paint), pane = rect(dialog.querySelector('.hpf-settings-content'));
    const inside = r => r.width > 0 && r.height > 0 && r.x >= bounds.x-.5 && r.right <= bounds.right+.5 && r.y >= bounds.y-.5 && r.bottom <= bounds.bottom+.5;
    const ordinary = dialog.querySelector('hp-settings-select:has(#marker-display)')?.shadowRoot?.querySelector('button');
    return {runtime:!!picker._catalog, value:picker.value, bounds, pane,
      fieldHeight:rect(picker).height, ordinaryHeight:ordinary?.getBoundingClientRect().height,
      border:style.borderTopWidth, radius:style.borderRadius, background:style.backgroundColor,
      innerBorder:getComputedStyle(trigger).borderTopWidth, underline:getComputedStyle(paint,'::after').display,
      visible:style.visibility==='visible' && style.opacity!=='0',
      inViewport:bounds.x>=0&&bounds.y>=0&&bounds.right<=innerWidth+.5&&bounds.bottom<=innerHeight+.5,
      triggerInside:inside(rect(trigger)),clearInside:!clear||inside(rect(clear)),arrowInside:!!arrow&&inside(rect(arrow)),
      clearShown:!!clear && rect(clear).width>0,iconPainted:!!path?.getAttribute('d')?.trim(),
      overflow:dialog.scrollWidth>dialog.clientWidth+1 || picker.scrollWidth>picker.clientWidth+1};
  });
  const near = (a,b) => Number.isFinite(a) && Math.abs(a-b)<.1;
  if (!result.runtime || !near(result.bounds.height,44) || !near(result.fieldHeight,44)
      || !near(result.ordinaryHeight,44) || result.border!=='1px' || result.radius!=='8px'
      || result.innerBorder!=='0px'
      || result.background==='rgba(0, 0, 0, 0)' || !result.visible || result.overflow
      || !result.inViewport || !result.triggerInside || !result.clearInside || !result.arrowInside
      || result.bounds.x<result.pane.x-.5 || result.bounds.right>result.pane.right+.5
      || result.bounds.y<result.pane.y-.5 || result.bounds.bottom>result.pane.bottom+.5
      || filled && (!result.clearShown || !result.iconPainted)
      || expectedValue!==undefined && result.value!==expectedValue) {
    throw Error('Local device icon picker is not a single visible 44px field: '+JSON.stringify(result));
  }
  return result;
}
