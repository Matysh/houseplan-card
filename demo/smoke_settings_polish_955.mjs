// #955: shared interaction/layout evidence in real HA, across all four forms.
import {launchHaDialogFixture,applyHaDialogTypography} from './helpers/ha-dialog-fixture.mjs';
import {installHpTestOnPage} from './helpers/hp-test.mjs';
import {ensureHarnessEditorRuntime} from './editor-runtime-compat.mjs';
import {installSettingsDeviceFixture,openSettingsDeviceDialog} from './helpers/settings-device-947-fixture.mjs';
import {installSettingsSpaceFixture} from './helpers/settings-space-945-fixture.mjs';
import {buttonPaint} from './helpers/button-paint.mjs';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
import {checkAll,watchPage,finish} from './serve.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const touch=process.argv.includes('--touch');
const fixture=await launchHaDialogFixture({authentic:true,viewport:{width:1280,height:900},extraModules:['16213'],hasTouch:touch});
const {page}=fixture,out={},matrix=[];
const fast=process.argv.includes('--fast');
const geometryOnly=process.argv.includes('--geometry');
const palettes={light:['#fff','#eceeef','#223039','#64747e','#dce2e6','#008aa5'],dark:['#17222e','#0f1822','#e7eef4','#a6b6c3','#354755','#67cfe8'],custom:['#fff6e9','#f0e2d0','#35291d','#75634e','#d6c3ac','#9b45b7']};
watchPage(page);
const settled=()=>page.evaluate(()=>window.__hpTest.settled());
const section=async(d,id)=>{
 const mobile=d.locator('.hpf-settings-mobile');
 if(await mobile.isVisible())await mobile.locator('select').selectOption(id);
 else await d.locator(`[data-section-target="${id}"]`).click();
 await settled();
};
const hoverButton=async b=>{
 await page.mouse.move(0,0);await b.hover();await page.waitForTimeout(180);
 return b.evaluate(el=>{const s=getComputedStyle(el);return s.cursor==='pointer'&&s.boxShadow!=='none'&&s.backgroundColor!=='rgba(0, 0, 0, 0)';});
};
try{
 await page.goto(fixture.url+'/product.html');
 await applyHaDialogTypography(page);
 if(process.argv.includes('--demo-font'))await page.addStyleTag({content:"html,body{font-family:'Segoe UI',Roboto,Arial,sans-serif}"});
 await page.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);
 await assertFreshDemoBundle(page,fileURLToPath(new URL('..',import.meta.url)));
 if(!await page.evaluate(ensureHarnessEditorRuntime))throw new Error('Editor preload failed');
 await installHpTestOnPage(page);await installSettingsDeviceFixture(page);await installSettingsSpaceFixture(page);
 await page.evaluate(async()=>{
  await window.__hpTest.setServerConfig(cfg=>{const r=cfg.spaces.find(s=>s.id==='f1').rooms.find(r=>r.id==='r1');r.name='Гостиная';r.settings={...r.settings,temp_max:23,temp_source:'entity:sensor.demo_room_temperature',co2_source:'entity:sensor.demo_room_co2'};});
  await window.__hpTest.setMode('plan');
 });
 const original=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));
 for(const [name,kind,device] of [['general','settings'],['space','space'],['room','room'],['led','marker','demo_led_controller'],['climate','marker','demo_living_climate'],['vacuum','marker','demo_x50'],['radar','marker','demo_radar']].filter(([name])=>!fast||name==='general')){
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(async device=>{await window.__hpTest.switchSpace(device?'floor01':'f1');await window.__hpTest.setMode(device?'devices':'plan');},!!device);
  if(device)await openSettingsDeviceDialog(page,device);
  else if(kind==='settings')await page.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();
  else if(kind==='space')await page.evaluate(()=>window.__hpTest.openSpaceDialog('edit','f1').then(()=>null));
  else await page.evaluate(()=>window.__hpTest.openRoomEdit('r1').then(()=>null));
  const d=page.locator(`houseplan-card hp-dialog[data-kind="${kind}"]`);await d.waitFor();await settled();
  const sections=await d.locator('[data-section-target]').evaluateAll(nodes=>nodes.map(n=>n.dataset.sectionTarget));if(!sections.length)sections.push('form');
  let sawHelp=0,sawColors=0,sawToggles=0,sawSelects=0;
  for(const [width,height] of fast?[[touch?390:1280,900]]:[[1280,900],[390,900],[320,480],[1280,480]]){
   await page.setViewportSize({width,height});
   // HA's entry/resize motion scales the surface before its final geometry.
   await page.waitForTimeout(250);
   for(const [theme,palette] of Object.entries(fast?{light:palettes.light}:palettes)){
    await d.evaluate((el,p)=>{const c=el.getRootNode().host;['--card-background-color','--primary-background-color','--primary-text-color','--secondary-text-color','--divider-color','--primary-color'].forEach((k,i)=>c.style.setProperty(k,p[i]));c.style.setProperty('--secondary-background-color',p[1]);},palette);
    const heights=[];
    for(const id of sections){
     if(id!=='form')await section(d,id);await settled();
     await d.evaluate(el=>el.shadowRoot.querySelector('ha-dialog').shadowRoot.querySelector('.body').scrollTop=0);
     heights.push(await d.locator('ha-dialog wa-dialog dialog').evaluate(el=>el.getBoundingClientRect().height));
     const prefix=`${name}_${width}x${height}_${theme}_${id}`;
     if(name==='space'&&id==='appearance'&&width===1280)out[prefix+'_approved_nav_wrap']=await d.locator('[data-section-target=appearance]').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);return range.getClientRects().length===1;});
     out[prefix+'_fit']=await d.evaluate(el=>{const ha=el.shadowRoot.querySelector('ha-dialog'),body=ha.shadowRoot.querySelector('.body'),r=ha.shadowRoot.querySelector('wa-dialog').shadowRoot.querySelector('dialog').getBoundingClientRect(),f=el.querySelector('.hpf-footer').getBoundingClientRect();return body.scrollWidth<=body.clientWidth+1&&r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&f.bottom<=r.bottom+1;});
     out[prefix+'_compact_temperature_fields']=await d.locator('.hpf-temperature-range .hpf-unit').filter({visible:true}).evaluateAll(nodes=>nodes.every(el=>Math.abs(parseFloat(getComputedStyle(el).width)-96)<.1));
     out[prefix+'_body_action_targets']=await d.locator('.hpf-settings-pane .btn').filter({visible:true}).evaluateAll(nodes=>nodes.every(el=>el.getBoundingClientRect().height>=44-.1));
     const toggles=d.locator('.hpf-settings-pane .hpf-toggle').filter({visible:true});sawToggles+=await toggles.count();
     out[prefix+'_heading_to_toggle_spacing']=await d.locator('.hpf-sub + .hpf-toggle').filter({visible:true}).evaluateAll(rows=>rows.every(row=>{const walker=document.createTreeWalker(row.querySelector('.hpf-toggle-title'),NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}),range=document.createRange();range.selectNodeContents(walker.nextNode());const gap=range.getBoundingClientRect().top-row.previousElementSibling.getBoundingClientRect().bottom;return gap>=10&&gap<=30;}));
     // The title container can be centred while its actual text still sits
     // several pixels above the switch. Measure the rendered text, not its box.
     out[prefix+'_toggle_alignment']=await toggles.evaluateAll(nodes=>nodes.every(n=>{
      const title=n.querySelector('.hpf-toggle-title'),walker=document.createTreeWalker(title,NodeFilter.SHOW_TEXT,{acceptNode:t=>t.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}),lines=[];let text;while(text=walker.nextNode()){const r=document.createRange();r.selectNodeContents(text);lines.push(...r.getClientRects());}
      const top=Math.min(...lines.map(r=>r.top)),bottom=Math.max(...lines.map(r=>r.bottom)),right=Math.max(...lines.map(r=>r.right)),last=lines.at(-1),b=n.querySelector('input').getBoundingClientRect(),host=title.querySelector('hp-help'),help=host?.shadowRoot.querySelector('svg')?.getBoundingClientRect();
      return Math.abs((top+bottom-b.top-b.bottom)/2)<=1.25&&right<=b.left+1&&(!help||(Math.abs((help.top+help.bottom-last.top-last.bottom)/2)<=1.25&&Math.abs(host.getBoundingClientRect().left-last.right-4)<=.25));
     }));
     out[prefix+'_help_alignment']=await d.locator('hp-help').filter({visible:true}).evaluateAll(nodes=>nodes.every(h=>{
      const parent=h.parentElement;if(!parent.matches('.hpf-labelrow,.hpf-label,.hpf-label-tail'))return true;
      const walker=document.createTreeWalker(parent,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});let text,last;while(text=walker.nextNode())last=text;if(!last)return false;
      const range=document.createRange();range.selectNodeContents(last);const a=parent.querySelector('label')?.getBoundingClientRect()||[...range.getClientRects()].at(-1),b=h.shadowRoot.querySelector('svg').getBoundingClientRect();return Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<=1.25&&(!parent.matches('.hpf-label-tail')||Math.abs(h.getBoundingClientRect().left-a.right-4)<=.25);
     }));
     if(name==='general'&&id==='zigbee')out[prefix+'_zigbee_wrap']=await toggles.first().evaluate(el=>{
      const span=el.querySelector('.hpf-toggle-title > span'),node=document.createTreeWalker(span,NodeFilter.SHOW_TEXT).nextNode();
      const words=[...node.textContent.matchAll(/\S+/g)].map(word=>{const r=document.createRange();r.setStart(node,word.index);r.setEnd(node,word.index+word[0].length);return r.getBoundingClientRect().top;});
      const last=Math.max(...words);return words.filter(top=>Math.abs(top-last)<1).length>=2;
     });
     // Exercise every help/colour path once per palette on desktop; the same
     // nodes also pass narrow/low viewport geometry above, without reloading HA.
     if(width===1280&&height===900&&!geometryOnly){
      if(kind==='room'&&theme==='light'){
       const fill=d.locator('hp-settings-select:has(select[name=rfill])');
       const label=await fill.locator('option[value=custom]').textContent();
       await fill.locator('button').first().click();await fill.getByRole('option',{name:label.trim(),exact:true}).click();await settled();
      }
      const helps=d.locator('hp-help').filter({visible:true});
      for(let i=0;i<await helps.count();i++){
       const h=helps.nth(i),trigger=h.locator('button');await trigger.hover();await page.waitForTimeout(30);
       out[prefix+`_help_immediate_${i}`]=await trigger.getAttribute('aria-expanded')==='true';await page.waitForTimeout(160);
       out[prefix+`_help_${i}`]=await h.evaluate(el=>{const b=el.shadowRoot.querySelector('button'),s=getComputedStyle(b),p=el.shadowRoot.querySelector('.tooltip');return b.getAttribute('aria-expanded')==='true'&&s.cursor==='pointer'&&s.backgroundColor!=='rgba(0, 0, 0, 0)'&&p?.getBoundingClientRect().width>0;});
       sawHelp++;await page.keyboard.press('Escape');await page.mouse.move(0,0);
      }
      const pickers=d.locator('hp-color-opacity').filter({visible:true});
      for(let i=0;i<await pickers.count();i++){
       const picker=pickers.nth(i),trigger=picker.locator('.trigger');if(await trigger.isDisabled())continue;
       await trigger.click();const number=picker.locator('input[type=number]');
       if(await number.count()){
        await number.fill('100');await number.press('Tab');
        out[prefix+`_opacity_${i}`]=await number.evaluate(el=>{const s=getComputedStyle(el),ctx=document.createElement('canvas').getContext('2d');ctx.font=s.font;const surface=el.closest('.picker');return el.value==='100'&&el.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)>=ctx.measureText('100').width+16&&surface.scrollWidth<=surface.clientWidth+1;});
       }
       out[prefix+`_picker_confirm_${i}`]=await hoverButton(picker.locator('.confirm'));
       sawColors++;await page.keyboard.press('Escape');
      }
      const buttons=d.locator('.hpf-settings-pane .btn:not(:disabled)').filter({visible:true});
      for(let i=0;i<await buttons.count();i++)out[prefix+`_button_${i}`]=await hoverButton(buttons.nth(i));
      const select=d.locator('.hpf-settings-pane hp-settings-select').filter({visible:true}).first();
      if(await select.count()&&!await select.locator('button').first().isDisabled()){
       const button=select.locator('button').first();await page.mouse.move(0,0);await page.waitForTimeout(180);
       const before=await button.evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderColor}));
       await button.hover();await page.waitForTimeout(180);
       out[prefix+'_select_hover']=await button.evaluate((el,before)=>{const s=getComputedStyle(el);return s.cursor==='pointer'&&(s.backgroundColor!==before.background||s.borderColor!==before.border);},before);
       await button.click();sawSelects++;
       out[prefix+'_select_popup']=await select.locator('[role=listbox]').evaluate(el=>{const s=getComputedStyle(el);return el.getBoundingClientRect().height>0&&parseFloat(s.borderRadius)>0&&s.boxShadow!=='none'&&s.transitionDuration.split(',').some(n=>parseFloat(n)>0);});
       await page.keyboard.press('Escape');
       out[prefix+'_select_closed']=await button.getAttribute('aria-expanded')==='false';
      }
     }
     if(name==='general'&&id==='sun'){
      out[prefix+'_no_duplicate_origin_select']=await d.locator('select[name=gs-sun-ray-origin]').count()===0&&await d.locator('input[type=radio][name=gs-sun-ray-origin]').count()===2;
      out[prefix+'_moon_no_divider']=await d.locator('#gs-moon-status').evaluate(el=>getComputedStyle(el).borderTopWidth==='0px');
      const outer=d.locator('.hpf-ray-choice:has(input[value=outer])');
      if(width===1280&&height===900&&theme==='light'){
       await outer.click();out.ray_preview_click=await d.locator('input[name=gs-sun-ray-origin][value=outer]').isChecked();
       await d.locator('input[name=gs-sun-ray-origin][value=outer]').focus();await page.keyboard.press('ArrowRight');
       out.ray_native_keyboard=await d.locator('input[name=gs-sun-ray-origin][value=inner]').isChecked();
      }
     }
     if(name==='general'&&id==='plan'&&width===1280&&height===900){
      const themeButton=d.getByRole('button',{name:'Как в теме',exact:true});await themeButton.hover();
      out[prefix+'_theme_ring_unclipped']=await themeButton.evaluate(el=>{const r=el.getBoundingClientRect();for(let a=el.parentElement;a&&a.tagName!=='HP-DIALOG';a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect();if((s.overflowX!=='visible'&&b.right<r.right+1)||(s.overflowY!=='visible'&&b.bottom<r.bottom+1))return false;}return true;});
     }
    }
    out[`${name}_${width}x${height}_${theme}_stable_height`]=Math.max(...heights)-Math.min(...heights)<=1;
    if(!out[`${name}_${width}x${height}_${theme}_stable_height`])console.log('dialog heights',name,width,height,theme,heights);
    for(let i=0;i<await d.locator('.hpf-footer .btn:not(:disabled)').count();i++)out[`${name}_${width}x${height}_${theme}_footer_${i}`]=await hoverButton(d.locator('.hpf-footer .btn:not(:disabled)').nth(i));
    if((width===1280||width===390)&&height===900&&theme==='light'){
     await page.mouse.move(0,0);await page.waitForTimeout(180);
     const paint=await buttonPaint(d.locator('.hpf-footer .btn.on[data-hp=dialog-confirm]'));
     out[`${name}_${width}_save_visible_content_centred`]=paint.height>=44&&paint.textInkOffset!==null&&Math.abs(paint.textInkOffset)<=1.25&&Math.abs(paint.iconOffset)<=.25;
     if(!out[`${name}_${width}_save_visible_content_centred`])console.log('Save paint',name,width,paint);
    }
   }
  }
  await page.setViewportSize({width:1280,height:900});if(sections[0]!=='form')await section(d,sections[0]);
  if(kind==='settings')await d.locator('.hpf-settings-pane:not([hidden]) input[type=checkbox]').first().click();
  else {const input=d.locator('.hpf-settings-pane input[type=text]').filter({visible:true}).first();await input.fill((await input.inputValue())+' ·');await input.press('Tab');}
  await d.locator('.hpf-footer [data-hp=dialog-cancel]').click();
  const confirm=page.locator('houseplan-card hp-dialog[data-kind=confirm]');await confirm.waitFor();
  for(let i=0;i<2;i++)out[name+`_discard_hover_${i}`]=await hoverButton(confirm.locator('.danger-confirm-footer .btn').nth(i));
  await confirm.locator('.danger-confirm-footer [data-hp=dialog-cancel]').click();await confirm.waitFor({state:'detached'});
  out[name+'_keep_returns_draft']=await d.isVisible();await d.locator('.hpf-footer [data-hp=dialog-cancel]').click();
  await confirm.locator('[data-hp=dialog-confirm]').click();await d.waitFor({state:'detached'});
  out[name+'_cancel_preserves_config']=await page.evaluate(original=>JSON.stringify(window.__card._serverCfg)===original,original);
  matrix.push({form:name,sections,helpPaths:sawHelp,colorPaths:sawColors,toggleRows:sawToggles,selectPaths:sawSelects});
  console.log('#955 checked '+name);
 }
 await fixture.assertClean();mkdirSync('artifacts/polish-955',{recursive:true});writeFileSync(`artifacts/polish-955/${fast?touch?'touch-matrix':'fast-matrix':'matrix'}.json`,JSON.stringify({matrix,out},null,2));checkAll(out);await finish(fixture.browser,out);
}finally{mkdirSync('artifacts/polish-955',{recursive:true});writeFileSync(`artifacts/polish-955/${fast?touch?'touch-matrix':'fast-matrix':'matrix'}.json`,JSON.stringify({matrix,out},null,2));await fixture.close();}
