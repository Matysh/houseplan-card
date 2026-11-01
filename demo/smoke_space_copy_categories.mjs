/** #1156: native copy choices in the real panel; synthetic storage is delegated unchanged. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import {launchPanelCold,check,finish,requirePinnedBrowser} from './serve.mjs';
import {applyUiKitTheme} from './helpers/ui-kit-theme.mjs';
import {waitForUiKitPaint} from './helpers/ui-kit-paint.mjs';
requirePinnedBrowser('#1156 space copy choices');
const folder='artifacts/1156-copy-categories';mkdirSync(folder,{recursive:true});
const fixture={model_version:10,spaces:[{id:'f1',title:'Copy choices',view_box:[0,0,1,1],cell_cm:1,rooms:[],wall_segments:[],decor:[
 {id:'chair',kind:'furniture',symbol:'chair',x:.1,y:.1,w:.2,h:.2,flip_h:true},
 {id:'line',kind:'line',x1:.1,y1:.5,x2:.4,y2:.5,width_cm:2,color:'#123456'},
 {id:'label',kind:'text',x:.6,y:.6,text:'Original decor',size_cm:20},
]}],markers:[],settings:{}};
const {page,browser}=await launchPanelCold({width:1280,height:900});
page.setDefaultTimeout(12000);
const card=page.locator('houseplan-panel houseplan-card');
const shell=card.locator('hp-dialog[data-kind="space"]');
const settle=async()=>{await page.evaluate(async()=>{await window.__hpTest.waitForWrites();await window.__hpTest.settled();});await waitForUiKitPaint(page);};
const open=async()=>{
 await page.evaluate(()=>window.__hpTest.openSpaceDialog('edit','f1'));await waitForUiKitPaint(page);
 await shell.locator('[data-action="space-copy"]').click();await waitForUiKitPaint(page);
 await shell.locator('#space-copy-name').waitFor();
};
const defaults=async()=>!(await shell.locator('#space-copy-furniture').isChecked())&&!(await shell.locator('#space-copy-decor').isChecked());
const evidence={frames:[],copies:[]};
try{
 await page.evaluate(cfg=>{
  window.__pushServerConfig(cfg);window.__pushServerLayout({});history.replaceState(null,'','/houseplan');
  const host=document.getElementById('host');host.style.cssText='width:100%;height:100vh;margin:0;padding:0';
  const panel=document.createElement('houseplan-panel');window.__panel1156=panel;
  panel.panel={component_name:'houseplan-panel'};panel.route={prefix:'/houseplan',path:''};panel.narrow=false;panel.hass=window.__mkHass();host.replaceChildren(panel);
 },fixture);
 await page.evaluate(()=>import('/assets/houseplan-panel.js'));
 await page.waitForFunction(()=>{const c=window.__panel1156.shadowRoot?.querySelector('houseplan-card');if(!c?.renderRoot.querySelector('ha-card[data-hp-state="ready"]'))return false;window.__card=c;return !c._booting;});
 await page.evaluate(()=>window.__hpTest.setMode('plan'));await settle();
 await page.evaluate(()=>{
  const c=window.__card,base=c.hass.callWS.bind(c.hass);window.__copy1156={writes:[]};
  c.hass={...c.hass,callWS:async message=>{
   if(['houseplan/config/set','houseplan/plan/optimize'].includes(message.type)){
    window.__copy1156.writes.push(structuredClone(message));
    if(window.__copy1156.hold)await new Promise(resolve=>{window.__copy1156.release=resolve;});
   }
   return base(message);
  }};
 });
 await open();check('new operation starts with both choices off',await defaults());
 await shell.locator('#space-copy-furniture').focus();await page.keyboard.press('Space');
 check('Space toggles furniture checkbox',await shell.locator('#space-copy-furniture').isChecked());
 await page.keyboard.press('Tab');await page.keyboard.press('Space');
 check('Tab then Space independently toggles decor',await shell.locator('#space-copy-decor').isChecked());
 for(const width of [1280,390])for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await applyUiKitTheme(page,theme);await waitForUiKitPaint(page);
  const bounds=await shell.locator('.body').evaluate(el=>{const box=el.getBoundingClientRect();return {left:box.left,right:box.right,scroll:el.scrollWidth,width:el.clientWidth};});
  check(`${width}/${theme}: fields stay within viewport`,bounds.left>=-1&&bounds.right<=width+1&&bounds.scroll<=bounds.width+1);
  const path=`${folder}/copy-${width}-${theme}.png`;await page.screenshot({path,fullPage:true});evidence.frames.push(path);
 }
 await shell.locator('button.btn[data-hp="dialog-cancel"]').click();await waitForUiKitPaint(page);
 check('Cancel restores settings without any write',await shell.locator('#space-title').isVisible()&&await page.evaluate(()=>window.__copy1156.writes.length===0));
 await shell.locator('[data-action="space-copy"]').click();await waitForUiKitPaint(page);check('reopening resets both choices',await defaults());
 await shell.locator('#space-copy-furniture').check();await shell.locator('#space-copy-name').press('Escape');await waitForUiKitPaint(page);
 check('Escape returns to settings without write',await shell.locator('#space-title').isVisible()&&await page.evaluate(()=>window.__copy1156.writes.length===0));
 await page.setViewportSize({width:1280,height:900});await applyUiKitTheme(page,'light');
 // Close restored settings via its ordinary close button before opening the next operation.
 await shell.locator('button.close').click();await waitForUiKitPaint(page);
 const sourceBefore=await page.evaluate(()=>structuredClone(window.__card._serverCfg.spaces.find(s=>s.id==='f1')));
 for(const furniture of [false,true])for(const decor of [false,true]){
  await open();check(`choices ${furniture}/${decor}: fresh defaults`,await defaults());
  if(furniture)await shell.locator('#space-copy-furniture').check();
  if(decor)await shell.locator('#space-copy-decor').check();
  const title=`Copy ${Number(furniture)}${Number(decor)}`;await shell.locator('#space-copy-name').fill(title);
  await page.evaluate(()=>{window.__copy1156.hold=true;window.__copy1156.release=null;});
  await shell.locator('button.btn[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(()=>!!window.__copy1156.release||!!window.__card._dangerConfirm);
  const confirm=card.locator('hp-confirm .danger-confirm-footer [data-hp="dialog-confirm"]');
  if(await confirm.count())await confirm.click();
  await page.waitForFunction(()=>!!window.__copy1156.release);
  check(`choices ${furniture}/${decor}: name and choices disabled during write`,await shell.locator('#space-copy-name').isDisabled()&&await shell.locator('#space-copy-furniture').isDisabled()&&await shell.locator('#space-copy-decor').isDisabled());
  await page.evaluate(()=>{window.__copy1156.hold=false;window.__copy1156.release();});
  await page.waitForFunction(title=>!window.__card._spaceDialog&&window.__card._serverCfg.spaces.some(s=>s.title===title),title);await settle();
  const state=await page.evaluate(title=>({copy:structuredClone(window.__card._serverCfg.spaces.find(s=>s.title===title)),source:structuredClone(window.__card._serverCfg.spaces.find(s=>s.id==='f1')),writes:window.__copy1156.writes.length}),title);
  const expected=sourceBefore.decor.filter(item=>item.kind==='furniture'?furniture:decor);
  check(`choices ${furniture}/${decor}: persisted candidate has selected category fields`,equal((state.copy.decor??[]).map(({id,...fields})=>fields),expected.map(({id,...fields})=>fields)));
  check(`choices ${furniture}/${decor}: selected IDs remapped and original unchanged`,(state.copy.decor??[]).every(item=>!sourceBefore.decor.some(source=>source.id===item.id))&&equal(state.source,sourceBefore));
  evidence.copies.push({title,kinds:(state.copy.decor??[]).map(item=>item.kind),writes:state.writes});
 }
 writeFileSync(`${folder}/observations.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 await finish(browser,evidence);
}catch(error){await page.screenshot({path:`${folder}/failure.png`,fullPage:true}).catch(()=>{});await browser.close();throw error;}
