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
  if(name==='led')out.binding_name_is_separate_from_plan_label=await dialog.locator('#marker-name').inputValue()==='Подсветка карниза'&&(await dialog.locator('#marker-binding').textContent()).includes('Контроллер света гостиной');
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
   out.owned_led_action_after_icon=await dialog.evaluate(el=>{const icon=el.querySelector('.hpf-iconfield'),led=el.querySelector('[data-led-action="show-icon"]'),display=el.querySelector('#marker-display');return !!led&&!!(icon.compareDocumentPosition(led)&Node.DOCUMENT_POSITION_FOLLOWING)&&!!(led.compareDocumentPosition(display)&Node.DOCUMENT_POSITION_FOLLOWING);});
   out.led72=await dialog.locator('hp-device-preview .value-badge').textContent().then(t=>t.includes('72'));
   const width=await face.locator('.device-core').evaluate(el=>el.getBoundingClientRect().width);
   await dialog.locator('#marker-size').fill('2');await dialog.locator('#marker-size').dispatchEvent('change');await tick();
   out.size_does_not_change_preview=await face.locator('.device-core').evaluate((el,width)=>Math.abs(el.getBoundingClientRect().width-width)<.01,width);
   await dialog.locator('#marker-angle').fill('75');await dialog.locator('#marker-angle').dispatchEvent('change');await tick();
   out.rotation_changes_only_icon=await face.evaluate(el=>{const icon=el.querySelector('.device-core > ha-icon');return getComputedStyle(icon).transform!=='none'&&getComputedStyle(el.querySelector('.value-badge')).rotate==='none';});
   await section('light');out.fixed65=await dialog.locator('#marker-glow-brightness').inputValue()==='65';
   out.radius_filled_but_not_materialized=await dialog.locator('#marker-glow-radius').inputValue().then(v=>Number(v)>0)&&await page.evaluate(()=>window.__card._markerDialog.glowRadius==='');
   await section('actions');out.control_friendly_name=(await dialog.locator('.hpf-chip').allTextContents()).some(t=>t.includes('Потолочная лампа')&&!t.includes('light.living_ceiling'));
   // Return to the exact approved values before visual capture.
   await close();await openSettingsDeviceDialog(page,id);
  }
  if(name==='climate')out.unavailable_stays_dash=(await dialog.locator('hp-device-preview .valtext').textContent()).trim()==='—';
  if(name==='vacuum')out.vacuum68and34=(await dialog.locator('hp-device-preview .valtext').textContent()).includes('68')&&(await dialog.locator('hp-device-preview .value-badge').textContent()).includes('34');
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
