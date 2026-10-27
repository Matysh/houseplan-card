import { chromium, expect } from 'playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const dir=process.env.HP_COMPARE_OUT || 'artifacts/dialog-picker-998-reference';
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(), reports=[], originals=[], pages={}, themes={};
const save=(file,value)=>writeFileSync(`${dir}/${file}`,typeof value==='string'?value:JSON.stringify(value,null,2));
const shell=p=>p.locator('hp-dialog[data-kind=marker]');
const picker=p=>shell(p).locator('ha-icon-picker');
const trigger=p=>picker(p).locator('ha-picker-field button#item');
async function open(page){
 await page.setViewportSize({width:1280,height:1000});
 if(await shell(page).count())await shell(page).locator('button.close').click();
 await page.locator('[data-hp=mode-tab][data-mode=devices]').click();
 await page.waitForFunction(()=>window.__lab.card.shadowRoot.querySelector('ha-card')?.getAttribute('data-hp-mode')==='devices');
 await page.locator('[data-hp=device][data-id=lab_ceiling]').dblclick();
 await expect(shell(page)).toBeVisible();await shell(page).locator('[data-section-target=appearance]').click();
}
async function focus(page){await trigger(page).scrollIntoViewIfNeeded();await trigger(page).focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');await expect(trigger(page)).toBeFocused();await page.mouse.move(0,0);await page.waitForTimeout(250);}
async function paint(page){return picker(page).evaluate(el=>{
 const field=el.shadowRoot.querySelector('ha-generic-picker').shadowRoot.querySelector('ha-picker-field').shadowRoot;
 const item=field.querySelector('ha-combo-box-item'),s=getComputedStyle(item);
 return {height:item.getBoundingClientRect().height,radius:s.borderTopLeftRadius,borderWidth:s.borderTopWidth,borderColor:s.borderTopColor,background:s.backgroundColor,arrow:field.querySelector('.arrow').path};
});}
try{
 for(const [name,port] of [['reference',8898],['candidate',8899]]){
  const page=await browser.newPage({viewport:{width:1280,height:1000}});pages[name]=page;
  await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>window.__lab?.card?._devices?.length>0);
  await page.evaluate(async()=>{
   const require=window.__hpHaRequire,index=await(await fetch('/ha-modules.json')).json(),visited=new Set(),loaded=new Set();
   async function prepare(id){if(visited.has(id))return;visited.add(id);const item=index[id];if(!item){if(!require.m[id])throw Error(id);return;}
    if(!require.m[id]&&!loaded.has(item.file)){const chunk=await import(`/frontend_latest/${item.file}`);Object.assign(require.m,chunk.__webpack_modules__);chunk.__rspack_esm_runtime?.(require);loaded.add(item.file);}for(const dependency of item.dependencies)await prepare(dependency);}
   if(!customElements.get('ha-icon-picker')){await prepare('53214');await require('53214');await customElements.whenDefined('ha-icon-picker');}
   const style=document.createElement('style');style.textContent=require('3184').Q;document.head.prepend(style);
  });
  save(name+'-loaded-build.json',await page.evaluate(()=>({fingerprint:globalThis.__HOUSEPLAN_BUILD_FINGERPRINT__,assets:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>x.includes('houseplan'))})));const local=await page.evaluate(async()=>await(await fetch('/theme-local.css')).text());save(`${name}-original-theme-local.css`,local);
  await open(page);
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.__lab.mock.setDarkMode(theme==='dark');},theme);
   await focus(page);await picker(page).screenshot({path:`${dir}/${name}-${theme}-original-field.png`});
   const tokens=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries([...s].filter(k=>/^--(?:ha-|md-|mdc-|wa-|primary-|secondary-|accent-|card-|divider-|error-|text-|disabled-|warning-|success-|state-|header-|safe-)/.test(k)).map(k=>[k,s.getPropertyValue(k)]));});
   originals.push({name,theme,paint:await paint(page),tokens,localSha256:createHash('sha256').update(local).digest('hex')});if(name==='reference')themes[theme]=tokens;
  }
 }
 save('original-theme-diagnosis.json',originals);
 for(const [name,page] of Object.entries(pages))for(const theme of ['light','dark'])for(const [layout,width,height] of [['desktop',1280,1000],['phone',390,844],['low',1280,450]]){
  console.log('START',name,theme,layout);await open(page);
  await page.evaluate(({theme,tokens})=>{document.documentElement.dataset.theme=theme;window.__lab.mock.setDarkMode(theme==='dark');for(const [key,value]of Object.entries(tokens))document.documentElement.style.setProperty(key,value);},{theme,tokens:themes[theme]});
  await page.setViewportSize({width,height});await focus(page);
  const field=await paint(page);await picker(page).screenshot({path:`${dir}/${name}-${theme}-${layout}-field.png`});
  await trigger(page).click();const combo=picker(page).locator('ha-picker-combo-box'),search=combo.locator('input');
  await expect(search).toHaveAttribute('placeholder','Поиск');await search.fill('mdi:fan');
  await expect(combo.locator('ha-combo-box-item').filter({hasText:/^\s*mdi:fan\s*$/}).first()).toBeVisible();
  const popup=await combo.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,width:r.width,height:r.height,background:s.backgroundColor,color:s.color};});
  const pop=picker(page).locator('wa-popover[open]');let body=null;
  if(await pop.count())body=await pop.evaluate(el=>{const s=getComputedStyle(el.shadowRoot.querySelector('[part=body]'));return {distance:el.distance,radius:s.borderTopLeftRadius,borderWidth:s.borderTopWidth,borderColor:s.borderTopColor,background:s.backgroundColor,shadow:s.boxShadow};});
  assert(popup.x>=-1&&popup.y>=-1&&popup.x+popup.width<=width+1&&popup.y+popup.height<=height+1,`${name} ${theme} ${layout}: popup out of bounds ${JSON.stringify(popup)}`);
  await page.screenshot({path:`${dir}/${name}-${theme}-${layout}-popup.png`});
  await page.keyboard.press('Escape');await expect(combo).not.toBeVisible();await page.waitForTimeout(300);const parentRetained=await shell(page).isVisible();
  if(name==='candidate')assert(parentRetained,'candidate parent lost after Escape');const focusRestored=parentRetained?await trigger(page).evaluate(e=>e.matches(':focus')):false;const focusChain=await page.evaluate(()=>{let n=document.activeElement;const out=[];while(n){out.push(n.localName+'#'+n.id);n=n.shadowRoot?.activeElement;}return out;});
  reports.push({name,theme,layout,field,popup,body,parentRetained,focusRestored,focusChain});save('progress.json',reports);console.log('CAPTURE',name,theme,layout,JSON.stringify({field,body,parentRetained}));
 }
 for(const theme of ['light','dark'])for(const layout of ['desktop','phone','low']){
  const a=reports.find(r=>r.name==='reference'&&r.theme===theme&&r.layout===layout),b=reports.find(r=>r.name==='candidate'&&r.theme===theme&&r.layout===layout);
  assert.deepEqual(b.field,a.field,`${theme} ${layout} field`);assert.deepEqual(b.body,a.body,`${theme} ${layout} popup`);
 }
 save('reference-comparison.json',{reference:'3a559559d68d0475db88d0f26cdf594be784351a',themeInput:'Same captured reference host root custom properties applied to both pages; no component CSS copied.',originals,reports,result:reports.filter(r=>r.name==='candidate').every(r=>r.focusRestored)?'PASS':'FAIL adaptive Escape focus; geometry/paint PASS'});
 assert(reports.filter(r=>r.name==='candidate').every(r=>r.focusRestored),'Candidate must restore trigger focus after Escape in every viewport/theme');console.log('PASS UI-029 reference: two themes, desktop and native adaptive; identical field/popup paint and focus restoration.');
}finally{await browser.close();}





