// Approved UI-019–028/031: real controls, owned drafts and synthetic persisted data.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { installUiPolish963Fixture } from './helpers/ui-polish-963-fixture.mjs';
import { mkdirSync } from 'node:fs';

requirePinnedBrowser('smoke_ui_1051');
const { page, browser } = await launch({ width: 1500, height: 1000 });
const card = page.locator('houseplan-card'), panel = card.locator('[data-hp=properties-panel]');
const menu = card.locator('[data-hp=decor-context-menu]');
const settle = () => page.evaluate(() => window.__hpTest.settled());
const mode = async mode => { await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._cameraTransition.active); await settle(); };
const model = () => page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config.spaces.find(s => s.id === 'polish'));
const history = () => page.evaluate(() => window.__card._geometryHistory.size);
const point = (x, y) => card.locator('.plan-svg').evaluate((el, [x,y]) => {
  const p = new DOMPoint(x,y).matrixTransform(el.getScreenCTM()); return { x:p.x,y:p.y };
}, [x,y]);
const clickAt = async (x,y,options) => { const p=await point(x,y); await page.mouse.click(p.x,p.y,options); await settle(); };
const out = {};
mkdirSync('artifacts/browser-selected/ui-1051',{recursive:true});
try {
  await installUiPolish963Fixture(page);
  await page.evaluate(() => window.__hpTest.setServerConfig(cfg => {
    cfg.spaces[0].decor.push({id:'sofa',kind:'furniture',symbol:'sofa',x:.6,y:.4,w:.16,h:.12,color:'#123456',opacity:.75});
    return cfg;
  }));
  await mode('plan');
  await page.mouse.move(0,0);
  out.empty_plan_default = await card.locator('.stage').evaluate(el=>getComputedStyle(el).cursor==='default');
  for (const zoom of [false,true]) {
    if(zoom) { await card.locator('[data-hp=zoom-out]').click(); await page.waitForFunction(()=>!window.__card._cameraTransition.active); }
    const p=await point(400,100); await page.mouse.move(p.x,p.y);
    await page.waitForFunction(()=>window.__card.renderRoot.querySelector('.stage').hasAttribute('data-plan-select-hit'));
    out[`real_wall_pointer_${zoom}`]=await card.locator('.stage').evaluate(el=>getComputedStyle(el).cursor==='pointer');
    await page.mouse.click(p.x,p.y); await settle();
    out[`same_wall_selected_${zoom}`]=await panel.locator('[data-property=cm]').count()===1;
    const miss=await point(400,180); await page.mouse.move(miss.x,miss.y); await settle();
    out[`wall_miss_default_${zoom}`]=await card.locator('.stage').evaluate(el=>getComputedStyle(el).cursor==='default');
  }
  await card.locator('[data-hp=zoom-fit]').click(); await page.waitForFunction(()=>!window.__card._cameraTransition.active);
  for(const cm of [0,1]) {
    await page.evaluate(cm=>window.__hpTest.setServerConfig(cfg=>{
      const space=cfg.spaces[0];space.openings=[];space.wall_segments[0].cm=cm;
      if(space.walls) for(const wall of space.walls) wall.cm=cm;
      return cfg;
    }),cm);
    out[`fixture_wall_thickness_${cm}`]=await page.evaluate(cm=>window.__card._spaceModel().wall_segments.some(w=>w.id==='contour'&&w.cm===cm),cm);
    const p=await point(400,100);await page.mouse.move(p.x,p.y);
    await page.waitForFunction(()=>window.__card.renderRoot.querySelector('.stage').hasAttribute('data-plan-select-hit'));
    out[`thin_virtual_hit_${cm}`]=await card.locator('.stage').evaluate(el=>getComputedStyle(el).cursor==='pointer');
    await page.mouse.click(p.x,p.y);await settle();
    out[`thin_virtual_select_${cm}`]=await panel.locator('[data-property=cm] input').inputValue()===String(cm);
    await page.mouse.move(p.x,p.y+10);await settle();
    out[`thin_virtual_tolerance_miss_${cm}`]=await card.locator('.stage').evaluate(el=>getComputedStyle(el).cursor==='default');
  }
  await mode('decor'); await clickAt(260,450);
  const stroke=panel.locator('[data-property=stroke]'), hex=stroke.locator('.hpf-inline-hex'), alpha=stroke.locator('.hpf-inline-alpha');
  await hex.waitFor();
  out.inline_fields_fit=await panel.locator('.hpf-colorfield').evaluateAll(fields=>fields.every(field=>{
    const box=field.getBoundingClientRect(); return [...field.querySelectorAll('input, .hpf-unit > span')].every(input=>{
      const r=input.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right;
    });
  }));
  const before=await model(), h=await history();
  out.selected_decor_no_glow=await card.locator('.decorlayer .dsel').evaluate(el=>getComputedStyle(el).filter==='none');
  await hex.fill('f00'); await alpha.fill('75'); await settle();
  out.valid_pair_previews=await card.locator('.decorlayer [data-id=rect]').first().evaluate(el=>getComputedStyle(el).stroke==='rgb(255, 0, 0)'&&Number(el.getAttribute('stroke-opacity'))===.75);
  out.preview_never_writes=JSON.stringify(await model())===JSON.stringify(before)&&await history()===h;
  out.picker_synchronizes=await stroke.locator('hp-color-opacity').evaluate(el=>el.color.toLowerCase()==='#ff0000'&&el.opacity===.75);
  await hex.fill('#12'); await hex.press('Enter'); await settle();
  out.partial_invalid_no_write=await hex.getAttribute('aria-invalid')==='true'&&JSON.stringify(await model())===JSON.stringify(before);
  out.partial_retains_last_preview=await card.locator('.decorlayer [data-id=rect]').first().evaluate(el=>getComputedStyle(el).stroke==='rgb(255, 0, 0)');
  await clickAt(260,450,{button:'right'});
  out.invalid_color_blocks_menu=await menu.count()===0&&JSON.stringify(await model())===JSON.stringify(before);
  await hex.press('Escape'); await settle();
  out.escape_restores_preview=await hex.inputValue()==='#718B82'&&await history()===h;
  await hex.fill('0f0'); await alpha.fill('100'); await alpha.press('Enter'); await alpha.press('Tab'); await settle();
  const saved=(await model()).decor.find(s=>s.id==='rect');
  out.atomic_enter_blur_once=saved.color==='#00ff00'&&saved.opacity===1&&await history()===h+1;
  await card.locator('[data-action=geometry-undo]').click(); await settle();
  await page.waitForFunction(()=>window.__card._decorList.find(s=>s.id==='rect').color!=='#00ff00',null,{timeout:5000}).catch(async error=>{
    console.log(await page.evaluate(()=>{const c=window.__card;return{draft:c._editorRuntime.properties.fields.draft,history:c._geometryHistory.commands(),gesture:[c._decorDraft,c._decorMove,c._dtDrag],toast:c._toast};})); throw error;
  });
  await page.evaluate(()=>window.__hpTest.waitForWrites());
  const restored=(await model()).decor.find(s=>s.id==='rect'), original=before.decor.find(s=>s.id==='rect');
  out.atomic_undo_restores_pair=JSON.stringify(restored)===JSON.stringify(original);
  await card.locator('[data-action=geometry-redo]').click();
  await page.waitForFunction(()=>window.__card._decorList.find(s=>s.id==='rect').color==='#00ff00');
  await page.evaluate(()=>window.__hpTest.waitForWrites());
  out.atomic_redo_restores_pair=(await model()).decor.find(s=>s.id==='rect').opacity===1;
  await hex.fill('abc'); await panel.locator('[data-property=x] input').focus(); await settle();
  out.composite_blur_commits=(await model()).decor.find(s=>s.id==='rect').color==='#aabbcc';
  await card.locator('.hp-properties').screenshot({path:'artifacts/browser-selected/ui-1051/inline-color.png'});
  // Real right click on visible geometry; retired DOM cannot invoke a command.
  await clickAt(260,450,{button:'right'}); await menu.waitFor(); await page.waitForTimeout(200);
  out.menu_order=JSON.stringify(await menu.locator('button').evaluateAll(els=>els.map(el=>el.dataset.action)))===JSON.stringify(['decor-front','decor-back','decor-copy','decor-delete']);
  out.menu_delete_last=await menu.locator('button').last().getAttribute('data-action')==='decor-delete';
  out.menu_geometry=await menu.evaluate(el=>{const s=getComputedStyle(el),items=[...el.querySelectorAll('button')];return s.borderRadius==='0px'&&s.borderTopWidth==='0px'&&s.padding==='0px'&&s.gap==='0px'&&s.fontSize==='12px'&&items.every(item=>getComputedStyle(item).minHeight==='32px');});
  // Theme tokens, disabled ink and keyboard focus share the actual command menu.
  const palettes={light:['#ffffff','#223039','rgb(0, 138, 165)'],dark:['#17222e','#e7eef4','rgb(103, 207, 232)'],custom:['#fff6e9','#35291d','rgb(155, 69, 183)']};
  for(const [theme,palette]of Object.entries(palettes)) {
    await card.evaluate((el,p)=>{for(const [i,key]of ['--card-background-color','--primary-text-color','--primary-color'].entries())el.style.setProperty(key,p[i]);},palette);
    const disabled=menu.locator('button:disabled').first(),enabled=menu.locator('button:not(:disabled)').first();
    await disabled.hover();await page.waitForTimeout(170);
    out[`menu_disabled_${theme}`]=await disabled.evaluate(el=>{const s=getComputedStyle(el);return s.opacity==='1'&&s.cursor==='not-allowed'&&s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.color.includes('0.4')});
    await enabled.hover();await page.waitForTimeout(170);
    out[`menu_hover_${theme}`]=await enabled.evaluate(el=>{const s=getComputedStyle(el);return s.backgroundColor.includes('0.12')&&s.color===getComputedStyle(el.parentElement).getPropertyValue('--primary-color').trim()});
    await page.keyboard.press('End');
    out[`menu_keyboard_last_${theme}`]=await menu.locator('button').last().evaluate(el=>el.getRootNode().activeElement===el);
  }
  const retained=await menu.locator('[data-action=decor-copy]').elementHandle(), prior=await model();
  await page.keyboard.press('Escape');
  out.menu_exit_immediately_inert=await menu.evaluate(el=>el.inert&&el.getAttribute('aria-hidden')==='true');
  await retained.evaluate(el=>el.click()); await settle();
  out.retained_menu_cannot_write=JSON.stringify(await model())===JSON.stringify(prior);
  await menu.waitFor({state:'detached'});
  await clickAt(260,450,{button:'right'}); await page.keyboard.press('Escape');
  await clickAt(260,450,{button:'right'}); await page.waitForTimeout(170);
  out.rapid_reopen_remains_live=await menu.evaluate(el=>!el.inert);
  await menu.screenshot({path:'artifacts/browser-selected/ui-1051/context-menu.png'});
  await page.setViewportSize({width:390,height:1000});await settle();
  out.menu_viewport_390=await menu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;});
  await menu.screenshot({path:'artifacts/browser-selected/ui-1051/context-menu-390.png'});
  await page.setViewportSize({width:1500,height:1000});await settle();
  await page.mouse.click(0,0);
  out.menu_outside_immediately_inert=await menu.evaluate(el=>el.inert);
  await menu.waitFor({state:'detached'});
  await page.emulateMedia({reducedMotion:'reduce'});await clickAt(260,450,{button:'right'});await menu.waitFor();
  out.menu_reduced_no_animation=await menu.evaluate(el=>el.getAnimations().length===0);
  await page.keyboard.press('Escape');await settle();
  out.menu_reduced_removes_immediately=await menu.count()===0;
  await page.emulateMedia({reducedMotion:'no-preference'});
  // Selected device paint remains after the mouse leaves, including keyboard focus.
  await mode('devices');
  const lamp=card.locator('.dev[data-id=lamp]');
  await card.locator('[data-hp=zoom-fit]').focus();
  for(let index=0;index<60&&!await lamp.evaluate(el=>el.getRootNode().activeElement===el);index++)await page.keyboard.press('Tab');
  out.keyboard_focus_precedes_selection=await lamp.evaluate(el=>el.getRootNode().activeElement===el&&!el.classList.contains('sel'));
  await page.keyboard.press(' ');await settle();await lamp.evaluate(el=>Promise.allSettled(el.getAnimations({subtree:true}).map(a=>a.finished)));
  out.trusted_space_selects_device=await lamp.evaluate(el=>el.classList.contains('sel')&&getComputedStyle(el.querySelector('.device-core')).backgroundColor==='rgb(12, 130, 240)');
  await lamp.click(); await page.mouse.move(0,0); await page.waitForTimeout(180);
  out.device_blue_without_hover=await lamp.locator('.device-core').evaluate(el=>getComputedStyle(el).backgroundColor==='rgb(12, 130, 240)');
  out.device_no_old_selection_frame=await card.locator('.hp-prop-selection').count()===0&&await lamp.evaluate(el=>getComputedStyle(el).getPropertyValue('--device-ring-width').trim()==='0px');
  await lamp.focus(); await page.keyboard.press(' '); await page.mouse.move(0,0); await page.waitForTimeout(180);
  out.selected_keyboard_glyph_visible=await lamp.locator('.device-core').evaluate(el=>getComputedStyle(el).color!=='rgb(12, 130, 240)');
  for(const dark of [false,true]) {
    await page.evaluate(async dark=>{const c=window.__card;c.hass={...c.hass,themes:{...c.hass.themes,darkMode:dark}};await window.__hpTest.settled();},dark);
    await lamp.evaluate(el=>Promise.allSettled(el.getAnimations({subtree:true}).map(a=>a.finished)));
    out[`selected_device_own_theme_${dark}`]=await lamp.locator('.device-core').evaluate((el,dark)=>{const s=getComputedStyle(el);return s.backgroundColor==='rgb(12, 130, 240)'&&s.color===(dark?'rgb(37, 37, 37)':'rgb(255, 255, 255)');},dark);
  }
  await mode('view');
  out.view_selection_does_not_leak=await lamp.locator('.device-core').evaluate(el=>getComputedStyle(el).backgroundColor!=='rgb(12, 130, 240)');
  checkAll(out);
} catch(error) { await page.screenshot({path:'artifacts/browser-selected/ui-1051/failure.png'}); throw error; }
finally { await finish(browser,out); }
