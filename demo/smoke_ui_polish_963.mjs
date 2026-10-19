// #963: ordinary user paths on synthetic data, with measured layout and negative lifecycle checks.
import {launchHaDialogFixture} from './helpers/ha-dialog-fixture.mjs';
import {UI_POLISH_963_HA_PIN} from './helpers/ui-polish-963-pin.mjs';
import {prepareUi963Page} from './helpers/ui-polish-963-reference.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {enforcePinnedBrowser} from '../scripts/browser-attestation.mjs';
import {checkAll,watchPage,finish} from './serve.mjs';
import {fileURLToPath} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';

const fixture=await launchHaDialogFixture({authentic:true,pin:UI_POLISH_963_HA_PIN,
  wheelPath:process.env.HP_UI_963_HA_WHEEL,extraModules:['33396','95788'],viewport:{width:1440,height:1000}});
const {page}=fixture,out={};watchPage(page);await enforcePinnedBrowser(fixture.browser);
const card=page.locator('houseplan-card'),panel=card.locator('[data-hp=properties-panel]');
const settle=()=>page.evaluate(()=>window.__hpTest.settled());
const mode=async value=>{await page.evaluate(value=>window.__hpTest.setMode(value),value);await page.waitForFunction(()=>!window.__card._modeTransitionBusy);};
try {
  await prepareUi963Page(page,fixture.url);
  await assertFreshDemoBundle(page,fileURLToPath(new URL('..',import.meta.url)));
  const baseline=await page.evaluate(()=>JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout}));
  await mode('plan');await panel.waitFor();
  out.no_service_heading=await panel.locator('.hp-prop-heading,.hp-prop-clear').count()===0;
  out.section_headings_are_not_controls=await panel.locator('button.hp-prop-group-title').count()===0;
  out.panel_starts_at_card_top=await panel.evaluate(el=>Math.abs(el.getBoundingClientRect().top-el.closest('ha-card').getBoundingClientRect().top)<=1);
  out.panel_width=await panel.evaluate(el=>Math.round(el.getBoundingClientRect().width)===360);
  const wall=card.locator('[data-hp=partition][data-id=wall]');
  const wallBox=await wall.boundingBox();
  await wall.click({position:{x:wallBox.width*.25,y:wallBox.height/2}});await settle();await page.waitForTimeout(280);
  out.wall_keeps_A_B=JSON.stringify(await card.locator('.hp-prop-selection text').allTextContents())===JSON.stringify(['A','B']);
  const wallHeight=await panel.locator('.hp-prop-group.position').evaluate(el=>el.getBoundingClientRect().height);
  await card.locator('[data-hp=wall-column][data-id=column]').click();await settle();await page.waitForTimeout(280);
  out.position_shrinks_with_content=await panel.locator('.hp-prop-group.position').evaluate((el,wallHeight)=>el.getBoundingClientRect().height<wallHeight-20,wallHeight);
  out.hints_stay_in_flow=await panel.locator('.hp-prop-group > .hp-prop-hint').evaluateAll(nodes=>nodes.every(el=>getComputedStyle(el).position==='static'&&parseFloat(getComputedStyle(el).marginTop)===12));
  out.column_rotation_uses_shared_handle=await card.locator('.hp-column-frame .dtrot + .dtknob').count()===1;
  out.column_visual_smaller_than_hit=await card.locator('.hp-column-frame').count()>0&&await card.locator('.hp-column-frame').evaluate(el=>{const hit=el.querySelector('.dtrot'),knob=el.querySelector('.dtknob');return !!hit&&!!knob&&+hit.getAttribute('r')>=4*+knob.getAttribute('r');});
  const rooms=card.locator('[data-editor-group=rooms]');
  out.rooms_group_exists=await rooms.count()===1;
  if(await rooms.count()) {
    await rooms.click();await settle();
    out.rooms_order=JSON.stringify(await card.locator('[data-group-item]').evaluateAll(nodes=>nodes.map(el=>el.dataset.groupItem)))===JSON.stringify(['merge','split','resize','delroom']);
    await card.locator('[data-group-item=resize]').click();await settle();
    out.rooms_command_uses_native_tool=await page.evaluate(()=>window.__card._tool==='resize');
    await page.evaluate(()=>window.__hpTest.setTool('select'));
  }
  out.history_at_end=await card.locator('.planbar .editbar-end button').count()===3&&await card.locator('.planbar .editbar-tools button[data-hp-tooltip]').filter({has:page.locator('ha-icon[icon="mdi:undo-variant"]')}).count()===0;
  out.plan_select_pointer=await card.locator('.stage').evaluate(el=>getComputedStyle(el).cursor==='pointer');
  await card.locator('.opening[data-id=window] .op-hit').click();await settle();
  out.window_has_side_choices=await panel.locator('[data-property=flip_h]').count()===0&&await panel.locator('[data-property=flip_v] .hp-prop-choices button').count()===2;
  out.window_side_names=await panel.locator('[data-property=flip_v]').innerText().then(text=>text.includes('Gallery')&&text.includes('Наружу'));
  out.only_wall_endpoint_captions=await card.locator('.hp-prop-selection text').count()===0;
  await mode('decor');
  out.shapes_group_exists=await card.locator('[data-editor-group=shapes]').count()===1;
  if(await card.locator('[data-editor-group=shapes]').count()) {
    await card.locator('[data-editor-group=shapes]').click();await settle();
    out.shapes_order=JSON.stringify(await card.locator('[data-group-item]').evaluateAll(nodes=>nodes.map(el=>el.dataset.groupItem)))===JSON.stringify(['line','rect','ellipse']);
    await card.locator('[data-group-item=rect]').click();await settle();
    out.shape_command_uses_native_tool=await page.evaluate(()=>window.__card._decorTool==='rect');
    await page.evaluate(()=>window.__hpTest.setTool('select'));
  }
  out.stairs_dim_only_with_architecture=await card.locator('.hp-stairs-layer').evaluate(el=>Math.abs(parseFloat(getComputedStyle(el).opacity)-.35)<.001);
  out.decor_not_dimmed=await card.locator('.decorlayer').evaluate(el=>getComputedStyle(el).opacity==='1');
  out.decor_history_at_end=await card.locator('.decorbar .editbar-end button').count()===3;
  const tip=card.locator('.hp-chrome-tooltip');
  const zoom=card.locator('[data-hp=zoom-in]');
  out.zoom_target_sizes=await card.locator('.zoomctl button').evaluateAll(nodes=>nodes.length===3&&nodes.every(el=>{const r=el.getBoundingClientRect();return r.width===44&&r.height===44;}));
  out.summary_half_gear=await card.locator('.summary-control').evaluate(el=>{const first=el.firstElementChild,icon=first.querySelector('svg');return first.getBoundingClientRect().width===24&&el.lastElementChild.getBoundingClientRect().width===44&&getComputedStyle(first).overflow==='hidden'&&getComputedStyle(icon).right==='-10px'&&icon.getBoundingClientRect().width===20;});
  const zoomBorders=await card.locator('.zoomctl button').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).borderColor));
  await zoom.hover();await page.waitForTimeout(180);out.tooltip_delay=!(await tip.isVisible());
  out.zoom_hover_affects_only_owner=await card.locator('.zoomctl button').evaluateAll((nodes,borders)=>nodes.every((el,i)=>i===2?getComputedStyle(el).borderColor!==borders[i]:getComputedStyle(el).borderColor===borders[i]),zoomBorders);
  await page.waitForTimeout(220);out.tooltip_opens=await tip.isVisible();
  await page.mouse.move(0,0);await page.waitForTimeout(150);out.tooltip_dismisses=!(await tip.isVisible());
  for(let i=0;i<100;i++){
    await page.keyboard.press('Tab');
    if(await zoom.evaluate(el=>el===el.getRootNode().activeElement))break;
  }
  await page.waitForTimeout(350);out.tooltip_keyboard=await tip.isVisible()&&await zoom.getAttribute('aria-label')!==null;
  await page.keyboard.press('Escape');await page.waitForTimeout(150);out.tooltip_escape=!(await tip.isVisible());
  await zoom.hover();await page.waitForTimeout(80);await page.mouse.move(0,0);await page.waitForTimeout(340);out.no_retired_tooltip=!(await tip.isVisible());
  await mode('view');out.stairs_restore_opacity=await card.locator('.hp-stairs-layer').evaluate(el=>getComputedStyle(el).opacity==='1');
  out.user_text_preserved=(await card.locator('.decorlayer').textContent()).includes('Keep this note');
  out.room_labels_preserved=(await card.locator('.roomlabel').allTextContents()).some(text=>text.includes('Gallery'));
  out.visual_actions_preserve_data=await page.evaluate(baseline=>JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout})===baseline,baseline);
  const lamp=card.locator('.dev[data-id=lamp]');
  out.value_badge_preserved=(await lamp.innerText()).includes('24');
  await lamp.hover();await page.waitForTimeout(350);
  const information=card.locator('[data-hp-live-tip]');
  out.information_tooltip_content=await information.isVisible()&&(await information.innerText()).includes('Reading lamp');
  out.information_tooltip_shared_surface=await information.evaluate(el=>{const s=getComputedStyle(el);return s.padding==='9px 11px'&&s.borderRadius==='9px'&&s.fontSize==='13px';});
  await page.mouse.move(0,0);
  await mode('plan');await card.locator('[data-hp=wall-column][data-id=column]').click();await settle();
  const originalColumn=await page.evaluate(()=>structuredClone(window.__card._spaceModel().wall_columns.find(c=>c.id==='column')));
  for(const scale of [0,1]){
    if(!await card.locator('.hp-column-frame').count()){
      await card.locator('[data-hp=wall-column][data-id=column]').click();await settle();
    }
    if(scale){await card.locator('[data-hp=zoom-out]').click();await page.waitForFunction(()=>!window.__card._cameraTransition.active);}
    const hit=await card.locator('.hp-column-frame .dtrot').boundingBox();
    const centre=await card.locator('[data-hp=wall-column][data-id=column]').boundingBox();
    const x=hit.x+hit.width*.7,y=hit.y+hit.height/2,cx=centre.x+centre.width/2,cy=centre.y+centre.height/2;
    out[`column_rotation_${scale}_native_hit`]=await card.evaluate((el,{x,y})=>el.shadowRoot.elementFromPoint(x,y)?.classList.contains('dtrot'),{x,y});
    await page.mouse.move(x,y);await page.mouse.down();
    await page.mouse.move(cx+(cy-y),cy,{steps:12});await page.mouse.up();await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
    const saved=await page.evaluate(()=>window.__card._spaceModel().wall_columns.find(c=>c.id==='column'));
    out[`column_rotation_${scale}_saved_angle`]=Math.abs(saved.angle-originalColumn.angle)>10;
    out[`column_rotation_${scale}_keeps_centre`]=JSON.stringify(saved.center)===JSON.stringify(originalColumn.center);
    await page.keyboard.press('Control+z');await page.evaluate(()=>window.__hpTest.waitForWrites());await settle();
    out[`column_rotation_${scale}_undo`]=await page.evaluate(original=>{const c=window.__card._spaceModel().wall_columns.find(c=>c.id==='column');return c.angle===original.angle&&JSON.stringify(c.center)===JSON.stringify(original.center);},originalColumn);
  }
  await card.locator('[data-hp=zoom-fit]').click();await page.waitForFunction(()=>!window.__card._cameraTransition.active);await settle();
  await page.emulateMedia({reducedMotion:'reduce'});
  const currentWallBox=await wall.boundingBox();await wall.click({position:{x:currentWallBox.width*.25,y:currentWallBox.height/2}});await settle();
  out.reduced_motion_no_section_animation=await panel.evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.playState!=='running'));
  out.reduced_motion_summary_controls=await card.locator('.summary-control > button').evaluateAll(els=>els.length>0&&els.every(el=>getComputedStyle(el).transitionDuration.split(',').every(value=>parseFloat(value)===0)));
  await page.emulateMedia({reducedMotion:'no-preference'});
  const point=await card.locator('.plan-svg').evaluate(el=>{const p=new DOMPoint(400,100).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});await page.mouse.click(point.x,point.y);await settle();
  out.contour_note_in_position=await panel.locator('.hp-prop-group.position .hp-prop-hint').innerText().then(text=>text.includes('A')&&text.includes('B'));
  out.contour_no_empty_features=await panel.locator('.hp-prop-group').count()===3;
  const deleteButton=panel.locator('.delete[aria-disabled=true]');await deleteButton.hover();await page.waitForTimeout(180);out.disabled_delete_delay=!(await tip.isVisible());
  await page.waitForTimeout(220);out.disabled_delete_reason=await tip.isVisible()&&(await tip.innerText()).includes('комнаты');
  out.disabled_delete_bounds=await tip.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=8&&r.right<=innerWidth-8&&r.width<=320;});
  const deleteBox=await deleteButton.boundingBox();await page.mouse.click(deleteBox.x+deleteBox.width/2,deleteBox.y+deleteBox.height/2);await settle();out.disabled_delete_preserves_wall=await page.evaluate(()=>window.__card._spaceModel().wall_segments.some(w=>w.id==='contour'));
  await zoom.hover();await page.waitForTimeout(80);await mode('decor');await page.waitForTimeout(360);out.editor_change_retires_tooltip=!(await tip.isVisible());
  await mode('devices');out.devices_history_at_end=await card.locator('.devbar .editbar-end button').count()===3;
  const originalLanguage=await page.evaluate(()=>window.__card._config.language);
  const deviceHints={
    en:['Devices on the plan','Icon rules: which MDI icon devices get by name'],
    ru:['Устройства на плане','Правила иконок: какая MDI-иконка достаётся устройству по имени'],
    de:['Geräte auf dem Plan','Symbolregeln: welche MDI-Symbole Geräte nach Namen erhalten'],
    fr:['Appareils sur le plan','Règles d’icônes : quelle icône MDI attribuer aux appareils selon leur nom'],
  };
  for(const [language,hints] of Object.entries(deviceHints)){
    await page.mouse.move(0,0);
    await page.evaluate(language=>window.__card.setConfig({...window.__card._config,language}),language);
    await mode('devices');await settle();
    for(const [index,tool] of ['device-inbox','icon-rules'].entries()){
      const button=card.locator(`[data-tool=${tool}]`);
      await button.hover();await page.waitForTimeout(350);
      out[`devices_${language}_${tool}_meaningful_hint`]=await tip.isVisible()
        &&await tip.innerText()===hints[index]&&await button.innerText()!==hints[index]
        &&await button.getAttribute('aria-describedby')===await tip.getAttribute('id')
        &&await button.getAttribute('title')===null;
      await page.mouse.move(0,0);await page.waitForTimeout(150);
    }
  }
  await page.evaluate(language=>window.__card.setConfig({...window.__card._config,language}),originalLanguage);
  await mode('devices');await settle();
  out.device_hints_preserve_data=await page.evaluate(baseline=>JSON.stringify({config:window.__card._serverCfg,layout:window.__card._layout})===baseline,baseline);
  await card.locator('[data-tool=device-inbox]').click();await settle();
  const inbox=card.locator('hp-dialog[data-kind=device-inbox]');
  const filter=inbox.locator('.device-inbox-space-filter hp-settings-select');
  out.inbox_actual_select=await filter.count()===1;
  const trigger=filter.locator('button');await trigger.click();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await settle();
  out.inbox_keyboard_filter=await filter.locator('select').inputValue()==='space:other';
  await page.keyboard.press('Escape');await inbox.waitFor({state:'detached'});
  await mode('view');
  for(const width of [1280,760,390,280]) {
    await page.setViewportSize({width,height:900});await settle();
    out[`header_${width}_no_overflow`]=await card.locator('.head').evaluate(el=>el.scrollWidth<=el.clientWidth+1);
    out[`header_${width}_one_action_row`]=await card.locator('.header-actions').count()>0&&await card.locator('.header-actions').evaluate(el=>{const boxes=[...el.children].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.getBoundingClientRect());return boxes.length>0&&Math.max(...boxes.map(b=>b.top))-Math.min(...boxes.map(b=>b.top))<2;});
    if(width<=480)out[`phone_${width}_height`]=await card.locator('.head').evaluate(el=>el.getBoundingClientRect().height<=56);
  }
  await page.setViewportSize({width:1440,height:1000});await settle();
  await zoom.hover();await page.waitForTimeout(80);
  const parent=await card.evaluateHandle(el=>el.parentElement),detached=await card.elementHandle();
  await detached.evaluate(el=>el.remove());await page.mouse.move(0,0);
  await parent.evaluate((el,card)=>el.append(card),detached);await parent.dispose();await detached.dispose();
  await page.waitForFunction(()=>window.__card.isConnected&&!window.__card._booting);await settle();await page.waitForTimeout(350);
  out.remount_retires_old_tooltip=!(await tip.isVisible());
  await page.mouse.move(0,0);await zoom.hover();await page.waitForTimeout(350);
  out.remount_tooltip_works=await tip.isVisible()&&await tip.count()===1;
  mkdirSync('artifacts/ui-polish-963',{recursive:true});writeFileSync('artifacts/ui-polish-963/behavior.json',JSON.stringify(out,null,2));
  await fixture.assertClean();checkAll(out);await finish(fixture.browser,out);
} finally {await fixture.close();}
