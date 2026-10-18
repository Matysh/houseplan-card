import {launch,watchPage,checkAll,finish} from './serve.mjs';
import {mkdirSync,readFileSync} from 'node:fs';
const {page,browser}=await launch({width:1280,height:900});
const out={};const dir='artifacts/settings-mobile';mkdirSync(dir,{recursive:true});
await page.evaluate(async()=>{
 const c=window.__card;c.setConfig({...c._config,language:'ru'});
 window.__addRegistryEntity('sensor.living_room_air_temperature',null,'22.6','demo',{}, {friendly_name:'TH-01 · Температура',device_class:'temperature',unit_of_measurement:'°C'});
 window.__addRegistryEntity('sensor.living_room_co2',null,'820','demo',{}, {friendly_name:'CO₂ · Гостиная',device_class:'carbon_dioxide',unit_of_measurement:'ppm'});
 c.hass=window.__mkHass();
 await window.__hpTest.setServerConfig(cfg=>{const sp=cfg.spaces.find(s=>s.id==='f1');sp.title='1 этаж · жилой';sp.settings={...sp.settings,fill_mode:'temp',temp_min:20,temp_max:24,card_name_scale:1.25,card_label_scale:1.25,label_co2:true};const r=sp.rooms.find(r=>r.id==='r1');r.name='Гостиная';r.area=null;r.settings={temp_max:23,temp_source:'entity:sensor.living_room_air_temperature',co2_source:'entity:sensor.living_room_co2',name_scale:1.1,label_scale:.9};});
 await window.__hpTest.setMode('plan');await window.__hpTest.openRoomEdit('r1');
});
const dlg=page.locator('houseplan-card hp-dialog[data-kind=room]');
await page.waitForFunction(()=>window.__card.getAttribute('lang')==='ru'&&!window.__card.hasAttribute('aria-busy'));
const context=page.context();
const reference=watchPage(await context.newPage());
await reference.setContent('<!doctype html><html><body>'+readFileSync('docs/design/settings-dialogs-944/room-settings-v4.html','utf8')+'</body></html>');
await reference.locator('.hp-after h2').waitFor();
const expected=await reference.locator('.hp-after').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,title:el.querySelector('h2').textContent.trim()}));
out.approvedRoomV4=await dlg.evaluate((el,expected)=>{const surface=el.shadowRoot.querySelector('.surface').getBoundingClientRect(),name=el.querySelector('#room-name').getBoundingClientRect(),area=el.querySelector('#room-area').closest('hp-settings-select').getBoundingClientRect(),bounds=el.querySelector('.hpf-temperature-range').getBoundingClientRect();return Math.abs(surface.width-expected.width)<2&&Math.abs(surface.height-expected.height)<8&&el.title===expected.title&&!el.querySelector('.hpf-settings-nav')&&area.top>name.bottom+24&&Math.abs(name.width-area.width)<2&&bounds.width<=360&&el.querySelector('.hpf-status').textContent.trim().length>0;},expected);
await reference.close();
for(const width of [320,390,1280]){
 await page.setViewportSize({width,height:900});
 for(const theme of ['light','dark','custom']){
  const palette=theme==='light'?['#ffffff','#f0f2f4','#223039','#64747e','#dce2e6','#008aa5']:theme==='dark'?['#17222e','#0f1822','#e7eef4','#a6b6c3','#354755','#67cfe8']:['#fdf5e8','#eee2ce','#30291f','#746751','#d5c8ae','#9754b8'];
  await dlg.evaluate((el,p)=>{const c=el.getRootNode().host;['--card-background-color','--primary-background-color','--primary-text-color','--secondary-text-color','--divider-color','--primary-color'].forEach((k,i)=>c.style.setProperty(k,p[i]));},palette);
  await page.waitForTimeout(200);
  out[`${width}_${theme}`]=await dlg.evaluate(el=>{const surface=el.shadowRoot.querySelector('.surface'),content=el.shadowRoot.querySelector('.content');const cancel=el.querySelector('[data-hp=dialog-cancel]'),range=el.querySelector('.hpf-temperature-range');return surface.getBoundingClientRect().left>=-1&&surface.getBoundingClientRect().right<=innerWidth+1&&content.scrollWidth<=content.clientWidth+1&&cancel.getBoundingClientRect().bottom<=innerHeight+1&&getComputedStyle(cancel).cursor==='pointer'&&range.children[0].getBoundingClientRect().top===range.children[1].getBoundingClientRect().top;});
  if(width===390||width===1280){await dlg.evaluate(el=>{el.shadowRoot.querySelector('.content').scrollTop=0;});await dlg.locator('.surface').screenshot({path:`${dir}/room-${width}-${theme}-top.png`});await dlg.locator('[data-card=sizes]').scrollIntoViewIfNeeded();await dlg.locator('.surface').screenshot({path:`${dir}/room-${width}-${theme}-sizes.png`});}
 }
}
checkAll(out);await finish(browser,out);
