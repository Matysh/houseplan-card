// Real controls, projection and synthetic approved v6 datasets, never service calls.
import {launch,watchPage,checkAll,finish} from './serve.mjs';
import {installSettingsDeviceFixture,openSettingsDeviceDialog} from './helpers/settings-device-947-fixture.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const {page,browser}=await launch({width:1280,height:900});
page.setDefaultTimeout(12000);
const out={},dir='artifacts/settings-mobile';mkdirSync(dir,{recursive:true});
const dialog=page.locator('houseplan-card hp-dialog[data-kind=marker]');
const tick=()=>page.evaluate(()=>window.__hpTest.settled());
const saved=()=>page.evaluate(()=>structuredClone(window.__card._serverCfg));
const close=async()=>{await dialog.locator('.hpf-footer [data-hp=dialog-cancel]').click();const confirm=page.locator('houseplan-card hp-dialog[data-kind=confirm]');if(await confirm.count())await confirm.locator('[data-hp=dialog-confirm]').click();await dialog.waitFor({state:'detached'});};
const section=async id=>{const mobile=dialog.locator('.hpf-settings-mobile');if(await mobile.isVisible())await mobile.locator('select').selectOption(id);else await dialog.locator(`[data-section-target=${id}]`).click();await tick();};
try{
 await installSettingsDeviceFixture(page);
 await page.evaluate(()=>{const c=window.__card,call=c.hass.callService;window.__settings947Commands=0;c.hass={...c.hass,callService:(...args)=>{window.__settings947Commands++;return call(...args);}};});
 const original=await saved();
 const context=page.context();
 const reference=watchPage(await context.newPage());
 await reference.setContent('<!doctype html><html><body>'+readFileSync('docs/design/settings-dialogs-944/device-settings-v6.html','utf8')+'</body></html>');
 await reference.locator('.hp-after h2').waitFor();
 const samples=[['led','demo_led_controller'],['climate','demo_living_climate'],['vacuum','demo_x50'],['radar','demo_radar']];
 for(const [name,id] of samples){
  await openSettingsDeviceDialog(page,id);
  await reference.locator('#hp-review-case').selectOption(name);
  const expected=await reference.locator('.hp-after').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,title:el.querySelector('h2').textContent.trim(),nav:el.querySelector('[data-nav]').getBoundingClientRect().width,sections:[...el.querySelectorAll('[data-nav] button')].map(n=>n.textContent.trim())}));
  out[`${name}_approved_v6`]=await dialog.evaluate((el,expected)=>{const surface=el.shadowRoot.querySelector('.surface').getBoundingClientRect(),nav=el.querySelector('.hpf-settings-nav');return Math.abs(surface.width-expected.width)<2&&Math.abs(surface.height-expected.height)<8&&Math.abs(nav.getBoundingClientRect().width-expected.nav)<2&&el.title===expected.title&&JSON.stringify([...nav.querySelectorAll('button')].map(n=>n.textContent.trim()))===JSON.stringify(expected.sections)&&el.subtitle.includes('1 этаж · жилой / Гостиная')&&el.querySelector('.hpf-footer').firstElementChild.classList.contains('hpf-status');},expected);
  if(!out[`${name}_approved_v6`])console.log('v6 mismatch',name,JSON.stringify({expected,actual:await dialog.evaluate(el=>({width:el.shadowRoot.querySelector('.surface').getBoundingClientRect().width,height:el.shadowRoot.querySelector('.surface').getBoundingClientRect().height,title:el.title,subtitle:el.subtitle,nav:el.querySelector('.hpf-settings-nav').getBoundingClientRect().width,sections:[...el.querySelectorAll('.hpf-settings-nav button')].map(n=>n.textContent.trim())}))}));
  out[`${name}_binding_modes_in_one_row`]=await dialog.locator('.hpf-seg:has(input[name="bmode"]) label').evaluateAll(nodes=>nodes.length===2&&Math.abs(nodes[0].getBoundingClientRect().top-nodes[1].getBoundingClientRect().top)<1&&Math.abs(nodes[0].getBoundingClientRect().width-nodes[1].getBoundingClientRect().width)<1);
  if(name==='climate')out.climate_approved_room_metrics=await dialog.locator('[data-card=basics]').evaluate(el=>[...el.querySelectorAll('h4')].some(h=>h.textContent.trim()==='Показатели комнаты')&&!!el.querySelector('#marker-use-climate-temp')?.closest('.hpf-toggle').querySelector('hp-help[instant]')&&!el.querySelector('#marker-use-climate-temp')?.closest('.hpf-toggle').querySelector('.hpf-toggle-caption'));
  if(name==='led')out.binding_name_is_separate_from_plan_label=await dialog.locator('#marker-name').inputValue()==='Подсветка карниза'&&(await dialog.locator('#marker-binding').textContent()).includes('Контроллер света гостиной');
  if(name==='climate')out.climate_binding_name_is_separate_from_plan_label=await dialog.locator('#marker-name').inputValue()==='Климат гостиной'&&(await dialog.locator('#marker-binding').textContent()).includes('Термостат гостиной');
  const tabs=await dialog.locator('[data-section-target]').evaluateAll(nodes=>nodes.map(n=>n.dataset.sectionTarget));
  out[`${name}_shared_sections`]=JSON.stringify(tabs.slice(0,5))===JSON.stringify(['basics','appearance','actions','light','details']);
  out[`${name}_specialized_only_when_real`]=JSON.stringify(tabs.slice(5))===JSON.stringify(name==='radar'?['radar']:name==='vacuum'?['vacuum']:[]);
  out[`${name}_clean`]=await dialog.locator('.dialog-action-commit [data-hp=dialog-confirm]').isDisabled();
  await section('appearance');
  const face=dialog.locator('hp-device-preview .previewstage .dev');
  out[`${name}_standard_preview_size`]=await face.evaluate(el=>Number(getComputedStyle(el).getPropertyValue('--dev-scale')||'1')===1);
  out[`${name}_no_fit_notice`]=!await dialog.locator('hp-device-preview .previewnotice').allTextContents().then(text=>text.some(t=>/78|уменьшен|scaled/i.test(t)));
  out[`${name}_battery_then_signal`]=await dialog.evaluate(el=>el.querySelector('#marker-hide-battery').closest('.hpf-toggle').nextElementSibling?.contains(el.querySelector('#marker-hide-signal')));
  if(name==='led'){
   out.owned_led_note_is_contextual=await dialog.locator('.led-representation').evaluate(el=>!el.querySelector('.hpf-note,.hpf-callout')&&!!el.querySelector('hp-help[instant]')?.text?.trim());
   out.owned_led_action_after_icon=await dialog.evaluate(el=>{const icon=el.querySelector('.hpf-iconfield'),led=el.querySelector('[data-led-action="show-icon"]'),display=el.querySelector('#marker-display');return !!led&&!!(icon.compareDocumentPosition(led)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(led.compareDocumentPosition(display)&Node.DOCUMENT_POSITION_FOLLOWING);});
   out.led72=await dialog.locator('hp-device-preview .value-badge').textContent().then(t=>t.includes('72'));
   const width=await face.locator('.device-core').evaluate(el=>el.getBoundingClientRect().width);
   await dialog.locator('#marker-size').fill('2');await dialog.locator('#marker-size').dispatchEvent('change');await tick();
   out.size_does_not_change_preview=await face.locator('.device-core').evaluate((el,width)=>Math.abs(el.getBoundingClientRect().width-width)<.01,width);
   await dialog.locator('#marker-angle').fill('75');await dialog.locator('#marker-angle').dispatchEvent('change');await tick();
   out.rotation_changes_only_icon=await face.evaluate(el=>{const icon=el.querySelector('.device-core > ha-icon');return getComputedStyle(icon).transform!=='none'&&getComputedStyle(el.querySelector('.value-badge')).rotate==='none';});
   await section('light');out.fixed65=await dialog.locator('#marker-glow-brightness').inputValue()==='65';
   out.radius_filled_but_not_materialized=await dialog.locator('#marker-glow-radius').inputValue().then(v=>Number(v)>0)&&await page.evaluate(()=>window.__card._markerDialog.glowRadius==='');
   const radiusField=dialog.locator('.hpf-field:has(#marker-glow-radius)');
   out.radius_caption_describes_inheritance=!(await radiusField.locator('.hpf-hint').innerText()).includes('Пусто:');
   out.radius_help_explains_override_and_clear=await radiusField.locator('hp-help').evaluate(el=>/Введите другой радиус/.test(el.text)&&/Очистите поле/.test(el.text));
   await section('actions');out.control_friendly_name=(await dialog.locator('.hpf-chip').allTextContents()).some(t=>t.includes('Потолочная лампа')&&!t.includes('light.living_ceiling'));
   await dialog.locator('#marker-controls-filter').fill('Торшер');await tick();
   await dialog.getByRole('option',{name:/Торшер/}).first().click();await tick();
   const linkedNames=await dialog.locator('.hpf-field:has(#marker-controls-filter) .hpf-chips .hpf-chip').allTextContents();
   out.two_external_controls_use_device_names=linkedNames.length===2&&linkedNames.some(t=>t.includes('Потолочная лампа'))&&linkedNames.some(t=>t.includes('Торшер'))&&linkedNames.every(t=>!/light\.|marker:|device:/.test(t));
   out.action_guidance_uses_shared_note=await dialog.locator('#marker-toggle-hint.hpf-note').count()===1;
   out.confirmation_help_is_contextual=await dialog.locator('#marker-tap-confirm').evaluate(el=>!!el.closest('.hpf-toggle').querySelector('hp-help[instant]')&&!el.closest('.hpf-toggle').querySelector('.hpf-toggle-caption'));
   await section('details');out.model_link_share_stacked_divider=await dialog.locator('#marker-link').evaluate(el=>getComputedStyle(el.closest('.hpf-field')).borderTopWidth==='1px');
   // Return to the exact approved values before visual capture.
   await close();await openSettingsDeviceDialog(page,id);
  }
  if(name==='climate')out.unavailable_stays_dash=(await dialog.locator('hp-device-preview .valtext').textContent()).trim()==='—';
  if(name==='vacuum')out.vacuum68and34=(await dialog.locator('hp-device-preview .valtext').textContent()).includes('68')&&(await dialog.locator('hp-device-preview .value-badge').textContent()).includes('34');
  if(name==='vacuum'){
   await section('vacuum');out.vacuum_source_help_present=await dialog.locator('details.vacpicker > summary hp-help[instant]').count()===1;out.vacuum_live_help_present=await dialog.locator('#marker-vacuum-live').evaluate(el=>!!el.closest('.hpf-toggle').querySelector('hp-help[instant]'));out.vacuum_path_help_present=await dialog.locator('[data-help=vacuum-trail][instant]').count()===1;out.vacuum_profile_has_approved_heading=await dialog.locator('[data-card=vacuum] h3').textContent()==='Пылесос';
   const picker=dialog.locator('details.vacpicker'),sourceHelp=picker.locator('summary hp-help');
   await sourceHelp.locator('button.trigger').hover();await sourceHelp.locator('.tooltip').waitFor({state:'visible'});
   out.vacuum_source_keeps_real_button=await picker.locator(':scope > summary').evaluate(el=>el.classList.contains('btn')&&!el.querySelector('.btn'));out.vacuum_documentation_keeps_normal_type=await dialog.locator('.vacbtns .hpf-button-help').evaluate(el=>!el.classList.contains('hpf-labelrow'));out.vacuum_documentation_help_present=await dialog.locator('.vacbtns .hpf-button-help hp-help[instant]').count()===1;out.vacuum_source_help_hover_keeps_picker_closed=!await picker.evaluate(el=>el.open);
   await sourceHelp.locator('button.trigger').click();out.vacuum_source_help_click_keeps_picker_closed=!await picker.evaluate(el=>el.open);
   await dialog.locator('[data-card=vacuum] h3').hover();
   const diagnostics=dialog.locator('.hpf-profile-diagnostics');out.vacuum_diagnostics_start_collapsed=!await diagnostics.locator('.vacdiag').isVisible();
   await diagnostics.locator('summary').click();out.vacuum_diagnostics_still_available=await diagnostics.locator('.vacdiag').isVisible()&&(await diagnostics.textContent()).includes('camera.demo_x50_map');await diagnostics.locator('summary').click();
   out.vacuum_path_uses_shared_menu=await dialog.locator('[data-card=vacuum] hp-settings-select:has(select)').first().locator('select').inputValue()==='always';
   await section('appearance');
  }
  if(name==='radar'){
   await section('radar');out.radar_field_help_present=await dialog.locator('#radar-profile').evaluate(el=>!!el.closest('.hpf-field').querySelector('hp-help[instant]'))&&await dialog.locator('#radar-room').evaluate(el=>!!el.closest('.hpf-field').querySelector('hp-help[instant]'));out.radar_profile_has_approved_heading=await dialog.locator('[data-card=radar] h3').textContent()==='Радар';
   out.radar_remove_target_help_present=await dialog.locator('.hpf-profile-target-heading hp-help[instant]').count()===2;out.radar_targets_keep_named_removal=await dialog.getByRole('button',{name:'Удалить слот цели 1',exact:true}).count()===1&&await dialog.getByRole('button',{name:'Удалить слот цели 2',exact:true}).count()===1;
   out.radar_profile_value_preserved=await dialog.locator('#radar-profile').inputValue()==='cartesian_v1';await section('appearance');
  }
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   for(const theme of ['light','dark','custom']){
    const palette=theme==='light'?['#fff','#eceeef','#223039','#64747e','#dce2e6','#008aa5']:theme==='dark'?['#17222e','#0f1822','#e7eef4','#a6b6c3','#354755','#67cfe8']:['#fff6e9','#f0e2d0','#35291d','#75634e','#d6c3ac','#9b45b7'];
    await dialog.evaluate((el,{p,dark})=>{const c=el.getRootNode().host;['--card-background-color','--primary-background-color','--primary-text-color','--secondary-text-color','--divider-color','--primary-color'].forEach((k,i)=>c.style.setProperty(k,p[i]));c.style.setProperty('--secondary-background-color',p[1]);c.hass={...c.hass,themes:{...c.hass.themes,darkMode:dark}};},{p:palette,dark:theme==='dark'});await tick();
    for(const tab of tabs){
     await section(tab);await dialog.evaluate(el=>{el.shadowRoot.querySelector('.content').scrollTop=0;});
     out[`${name}_${width}_${theme}_${tab}_fits`]=await dialog.evaluate(el=>{const surface=el.shadowRoot.querySelector('.surface'),content=el.shadowRoot.querySelector('.content'),footer=el.querySelector('.hpf-footer');return surface.getBoundingClientRect().left>=-1&&surface.getBoundingClientRect().right<=innerWidth+1&&content.scrollWidth<=content.clientWidth+1&&footer.getBoundingClientRect().bottom<=innerHeight+1&&[...footer.querySelectorAll('button:not(:disabled)')].every(b=>getComputedStyle(b).cursor==='pointer');});
     if((width===390&&theme!=='custom')||(width===1280&&theme==='light')){await dialog.locator('.surface').screenshot({path:`${dir}/device-${name}-${tab}-${width}-${theme}.png`});if(tab==='appearance'){await dialog.locator('hp-device-preview').scrollIntoViewIfNeeded();await dialog.locator('.surface').screenshot({path:`${dir}/device-${name}-preview-${width}-${theme}.png`});}}
    }
   }
  }
  await close();
 }
 out.cancel_keeps_all_data=JSON.stringify(await saved())===JSON.stringify(original);
 await reference.close();
 out.no_commands=await page.evaluate(()=>window.__settings947Commands===0);
 writeFileSync(`${dir}/device-947-results.json`,JSON.stringify(out,null,2));
 checkAll(out);await finish(browser,out);
}catch(error){await browser.close();throw error;}
