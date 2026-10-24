// Official offline HA 20260930.4: approved furniture shell, tray and common kit.
import {launchHaDialogFixture} from './helpers/ha-dialog-fixture.mjs';
import {UI_POLISH_963_HA_PIN} from './helpers/ui-polish-963-pin.mjs';
import {prepareUi963Page} from './helpers/ui-polish-963-reference.mjs';
import {settingsSection} from './helpers/settings-section.mjs';
import {enforcePinnedBrowser} from '../scripts/browser-attestation.mjs';
import {checkAll,watchPage,finish} from './serve.mjs';
import {mkdirSync} from 'node:fs';

const fixture=await launchHaDialogFixture({authentic:true,pin:UI_POLISH_963_HA_PIN,
  extraModules:['33396','95788'],viewport:{width:820,height:1000}});
const {page,browser}=fixture;watchPage(page);await enforcePinnedBrowser(browser);
const card=page.locator('houseplan-card'),out={completed:false};
const settle=()=>page.evaluate(()=>window.__hpTest.settled());
const mode=async value=>{await page.evaluate(value=>window.__hpTest.setMode(value),value);
  await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._cameraTransition.active);await settle();};
const close=async dialog=>{await dialog.locator('[slot=footer] [data-hp=dialog-cancel]').click();await dialog.waitFor({state:'detached'});};
mkdirSync('artifacts/browser-selected/ui-1051-native',{recursive:true});
try {
  await prepareUi963Page(page,fixture.url);
  await page.evaluate(()=>{
    const card=window.__card,original=card.hass;
    card.hass={...original,connection:{...original.connection},callWS:message=>
      ['config_entries/get','manifest/list'].includes(message.type)?Promise.resolve([]):original.callWS(message)};
  });
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>{
    cfg.spaces[0].decor.push({id:'sofa',kind:'furniture',symbol:'sofa',x:.65,y:.32,w:.16,h:.12,color:'#123456',opacity:.75});return cfg;
  }));
  await mode('decor');
  const sofaPoint=await card.locator('.decorlayer [data-id=sofa]').first().evaluate(el=>{
    const p=el.getPointAtLength(el.getTotalLength()*.1).matrixTransform(el.getScreenCTM());return{x:p.x,y:p.y};
  });
  await page.mouse.click(sofaPoint.x,sofaPoint.y);await settle();
  const tray=card.locator('.editor-secondary[data-layout=actions]');await tray.waitFor();
  await tray.evaluate(el=>Promise.allSettled(el.getAnimations({subtree:true}).map(animation=>animation.finished)));
  out.tray_order=JSON.stringify(await tray.locator('button').evaluateAll(els=>els.map(el=>el.dataset.action)))===JSON.stringify(['decor-front','decor-back','decor-properties','decor-delete']);
  out.tray_geometry=await tray.evaluate(el=>{const s=getComputedStyle(el),head=getComputedStyle(el.querySelector('.editor-context-label')),buttons=[...el.querySelectorAll('button')];
    return Math.round(el.getBoundingClientRect().width)===352&&s.padding==='16px'&&s.gap==='12px'
      &&head.fontSize==='16px'&&head.lineHeight==='24px'&&head.fontWeight==='600'&&buttons.every(button=>Math.round(button.getBoundingClientRect().height)===44);
  });
  await tray.screenshot({path:'artifacts/browser-selected/ui-1051-native/tray.png'});
  await tray.locator('[data-action=decor-properties]').click();
  const furniture=card.locator('hp-dialog[data-kind=decor]');await furniture.waitFor();
  out.authentic_ha_shell=await furniture.locator('ha-dialog').count()===1;
  out.furniture_first_frame_kit=await furniture.evaluate(el=>el.hasAttribute('form-shell')&&el.hasAttribute('settings-layout')&&el.hasAttribute('compact')
    &&getComputedStyle(el.querySelector('[data-field=decor-width]')).height==='44px');
  out.furniture_all_fields=await furniture.locator('[data-field=decor-symbol],[data-field=decor-width],[data-field=decor-height],[data-field=decor-angle],[data-field=decor-flip-horizontal],[data-field=decor-flip-vertical]').count()===6;
  out.color_readout_transparency=await furniture.locator('hp-color-opacity').first().evaluate(el=>el.nativeTooltip===false&&el.readout.includes('#123456')&&el.readout.includes('25%'));
  out.color_caption=await furniture.locator('hp-color-opacity').first().evaluate(el=>el.label==='Цвет:');
  out.furniture_first_label_no_extra_space=await furniture.locator('.body > label').first().evaluate(el=>getComputedStyle(el).marginTop==='0px');
  out.furniture_toggle_geometry=await furniture.locator('.hpf-toggle > input').evaluateAll(els=>els.length===2&&els.every(el=>{
    const s=getComputedStyle(el),track=getComputedStyle(el,'::before');return s.width==='44px'&&s.height==='44px'&&track.width==='36px'&&track.height==='22px';
  }));
  const before=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
  const originalStyle=await card.getAttribute('style'),originalThemes=await page.evaluate(()=>window.__card.hass.themes);
  const palettes={light:['rgb(255, 255, 255)','rgb(34, 48, 57)','#64747e','#dce2e6','#008aa5'],dark:['rgb(23, 34, 46)','rgb(231, 238, 244)','#a6b6c3','#354755','#67cfe8'],custom:['rgb(255, 246, 233)','rgb(53, 41, 29)','#75634e','#d6c3ac','#9b45b7']};
  for(const [theme,palette]of Object.entries(palettes)) {
    await card.evaluate((el,{theme,palette})=>{for(const [i,key]of ['--card-background-color','--primary-text-color','--secondary-text-color','--divider-color','--primary-color'].entries())el.style.setProperty(key,palette[i]);el.style.colorScheme=theme==='dark'?'dark':'light';},{theme,palette});
    await page.evaluate(dark=>{const c=window.__card;c.hass={...c.hass,themes:{...c.hass.themes,darkMode:dark}};},theme==='dark');
    for(const width of [820,390]) {
      await page.setViewportSize({width,height:1000});await settle();
      await furniture.evaluate(el=>Promise.allSettled(el.getAnimations({subtree:true}).map(a=>a.finished)));
      out[`furniture_${theme}_fit_${width}`]=await furniture.locator('.body.hpf-form').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth);
      await page.screenshot({path:`artifacts/browser-selected/ui-1051-native/furniture-${theme}-${width}.png`});
    }
    out[`furniture_${theme}_tokens`]=await furniture.locator('.body.hpf-form').evaluate((el,p)=>{const s=getComputedStyle(el);return s.backgroundColor===p[0]&&s.color===p[1];},palette);
  }
  await card.evaluate((el,style)=>style===null?el.removeAttribute('style'):el.setAttribute('style',style),originalStyle);
  await page.evaluate(themes=>{const c=window.__card;c.hass={...c.hass,themes};},originalThemes);
  await furniture.locator('[data-field=decor-width]').fill('210');
  await close(furniture);
  out.furniture_cancel_preserves_plan=await page.evaluate(before=>JSON.stringify(window.__card._serverCfg)===before,before);
  await page.setViewportSize({width:1440,height:1000});await mode('decor');
  const swatch=card.locator('.decor-default-color .trigger');
  await swatch.hover();await page.waitForTimeout(380);
  out.toolbar_chrome_tooltip=await card.locator('.hp-chrome-tooltip').isVisible()&&await swatch.getAttribute('title')===null;
  await page.screenshot({path:'artifacts/browser-selected/ui-1051-native/toolbar-tooltip.png'});
  await page.mouse.move(0,0);await mode('view');
  await card.locator('[data-hp=settings]').click();
  const settings=card.locator('hp-dialog[data-kind=settings]');await settingsSection(settings,'data');
  const link=settings.locator('.hpf-converter .hpf-link');
  await link.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
  const paint=await link.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{bg:s.backgroundColor,border:s.border,shadow:s.boxShadow,w:r.width,h:r.height,color:s.color};});
  await link.hover();await page.waitForTimeout(180);
  out.text_link_only_color_changes=await link.evaluate((el,before)=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.backgroundColor===before.bg&&s.border===before.border&&s.boxShadow===before.shadow&&r.width===before.w&&r.height===before.h&&s.color!==before.color;},paint);
  await link.screenshot({path:'artifacts/browser-selected/ui-1051-native/converter-hover.png'});
  // A real shared disclosure retains content through close, retargets and obeys reduced motion.
  await settingsSection(settings,'zigbee');
  const topology=settings.locator('hp-zigbee-topology-settings');
  const zigbeeEnabled=topology.locator('[data-field=zigbee-enabled]'), wasEnabled=await zigbeeEnabled.isChecked();
  await zigbeeEnabled.check();
  const disclosure=topology.locator('.hpf-disclosure').first(),summary=disclosure.locator('summary');
  await summary.waitFor();await summary.click();
  out.disclosure_animation=await disclosure.evaluate(el=>el.querySelector('.hpf-disclosure-content').getAnimations().some(a=>a.effect.getTiming().duration===220&&a.effect.getTiming().easing==='cubic-bezier(0.2, 0, 0.2, 1)'));
  await summary.click();await summary.click();await page.waitForTimeout(260);
  out.disclosure_rapid_retarget=await disclosure.evaluate(el=>el.open&&el.dataset.expanded==='true'&&!el.querySelector('.hpf-disclosure-content').inert);
  await page.screenshot({path:'artifacts/browser-selected/ui-1051-native/disclosure-open.png'});
  const collapseEnd=await disclosure.evaluate(async el=>{
    el.querySelector('summary').click();const content=el.querySelector('.hpf-disclosure-content'),animation=content.getAnimations()[0];
    animation.pause();animation.currentTime=animation.effect.getTiming().duration;
    const sample={height:content.getBoundingClientRect().height,padding:getComputedStyle(content).paddingTop,open:el.open};
    animation.finish();await animation.finished;return sample;
  });
  console.log('disclosure collapse endpoint',collapseEnd);
  out.disclosure_collapse_reaches_zero_before_terminal=collapseEnd.open&&collapseEnd.height===0;
  await summary.click();await page.waitForTimeout(260);
  const pageScroll=await page.evaluate(()=>scrollY);
  await summary.click();await page.waitForTimeout(250);await summary.click();await page.waitForTimeout(300);
  out.disclosure_never_scrolls_page=await page.evaluate(y=>scrollY===y,pageScroll);
  await page.emulateMedia({reducedMotion:'reduce'});await summary.click();
  out.disclosure_reduced_immediate=await disclosure.evaluate(el=>!el.open&&el.querySelector('.hpf-disclosure-content').getAnimations().length===0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:820,height:600});await summary.click();await page.waitForTimeout(350);
  out.disclosure_scrolls_dialog_to_heading_or_limit=await summary.evaluate(el=>{
    let node=el;
    while(node){
      node=node.assignedSlot||node.parentElement||(node.getRootNode() instanceof ShadowRoot?node.getRootNode().host:null);
      if(!node||node.localName==='hp-dialog'||node===document.body)return false;
      if(node instanceof HTMLElement&&/auto|scroll/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight+1){
        return Math.abs(el.getBoundingClientRect().top-node.getBoundingClientRect().top-node.clientTop)<=2
          ||Math.abs(node.scrollTop-(node.scrollHeight-node.clientHeight))<=2;
      }
    }return false;
  });
  await page.setViewportSize({width:1440,height:1000});
  if(!wasEnabled) await zigbeeEnabled.uncheck();
  await close(settings);
  await card.locator('[data-hp=support]').click();
  const support=card.locator('hp-dialog[data-kind=support]'),supportLink=support.locator('.supportlinks .aboutlink').first();
  await supportLink.scrollIntoViewIfNeeded();await page.mouse.move(0,0);
  const supportPaint=await supportLink.evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{bg:s.backgroundColor,border:s.border,shadow:s.boxShadow,filter:s.filter,decoration:s.textDecorationLine,w:r.width,h:r.height,color:s.color};});
  await supportLink.hover();await page.waitForTimeout(180);
  out.support_text_link_only_color_changes=await supportLink.evaluate((el,before)=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.backgroundColor==='rgba(0, 0, 0, 0)'&&s.backgroundColor===before.bg&&s.border===before.border&&s.boxShadow===before.shadow&&s.filter===before.filter&&s.textDecorationLine===before.decoration&&r.width===before.w&&r.height===before.h&&s.color!==before.color;},supportPaint);
  await supportLink.screenshot({path:'artifacts/browser-selected/ui-1051-native/support-link-hover.png'});
  await page.keyboard.press('Escape');await support.waitFor({state:'detached'});
  // Actual space section DOM order, including unmodified conditional fields.
  await card.locator('[data-hp=space-settings][data-id=polish]').click();
  const space=card.locator('hp-dialog[data-kind=space]');await settingsSection(space,'appearance');
  out.room_appearance_dom_order=await space.locator('[data-card=appearance]').evaluate(el=>{
    const relevant=[...el.querySelectorAll('[data-field]')].map(el=>el.getAttribute('data-field')).filter(id=>/show-borders|zero-wall-style|name-color|border-color|wall-fill|fill-mode/.test(id));
    return relevant.join('|').includes('show-borders|')&&relevant.findIndex(id=>id.endsWith('name-color'))<relevant.findIndex(id=>id.endsWith('border-color'))
      &&relevant.findIndex(id=>id.endsWith('wall-fill'))<relevant.findIndex(id=>id.endsWith('fill-mode'));
  });
  const fill=space.locator('select[name=space-fill-mode]');
  for(const mode of ['custom','lqi','light','temp']) {
    await fill.selectOption(mode);await settle();
    out[`fill_conditional_${mode}`]=await space.locator('[data-field=space-fill-color]').count()===(mode==='custom'?1:0);
  }
  out.room_temperature_fields_retained=await space.locator('[data-field$=temp-min],[data-field$=temp-max]').count()===2;
  await space.locator('[data-field=space-temp-min]').fill('16');await space.locator('[data-field=space-temp-max]').fill('28');
  await page.screenshot({path:'artifacts/browser-selected/ui-1051-native/space-appearance.png'});
  await space.locator('[data-hp=dialog-confirm]').click();await space.waitFor({state:'detached'});await page.evaluate(()=>window.__hpTest.waitForWrites());
  await card.locator('[data-hp=space-settings][data-id=polish]').click();await settingsSection(space,'appearance');
  out.room_save_reopen=await fill.inputValue()==='temp'&&await space.locator('[data-field=space-temp-min]').inputValue()==='16'&&await space.locator('[data-field=space-temp-max]').inputValue()==='28';
  await close(space);await fixture.assertClean();out.completed=true;checkAll(out);
} catch(error){await page.screenshot({path:'artifacts/browser-selected/ui-1051-native/failure.png'});throw error;}
finally{await fixture.close();await finish(browser,out);}
