// AC1: inspect the immutable approved reference and the actual form at one viewport.
// Functional smoke success alone does not establish visual acceptance.
import {readFileSync,mkdirSync} from 'node:fs';
import {launch,watchPage,checkAll,finish} from './serve.mjs';
const {page,browser}=await launch({width:1280,height:900});
const output={},dir='artifacts/settings-mock-match-948';mkdirSync(dir,{recursive:true});
const ctx=page.context();
const reference=watchPage(await ctx.newPage());
await reference.setContent('<!doctype html><html><body style="margin:0;color-scheme:light">'+readFileSync('docs/design/settings-dialogs-944/general-settings-v10.html','utf8')+'</body></html>');
await reference.locator('.hp-after h2').waitFor();
const expected=await reference.locator('.hp-after').evaluate(el=>({width:el.getBoundingClientRect().width,nav:el.querySelector('[data-nav]').getBoundingClientRect().width,labels:[...el.querySelectorAll('[data-nav] button')].map(n=>n.textContent.trim())}));
await page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,language:'ru'});c.style.setProperty('--card-background-color','#fff');c.style.setProperty('--primary-background-color','#eceeef');c.style.setProperty('--primary-text-color','#223039');c.style.setProperty('--secondary-text-color','#64747e');c.style.setProperty('--divider-color','#dce2e6');c.style.setProperty('--primary-color','#008aa5');c.hass={...c.hass,language:'ru'};await window.__hpTest.settled();});
await page.evaluate(async()=>{
 const c=window.__card;
 c.hass={...c.hass,states:{...c.hass.states,'sun.sun':{entity_id:'sun.sun',state:'above_horizon',attributes:{elevation:11,azimuth:120,rising:false}}}};
 await window.__hpTest.setServerConfig(cfg=>{cfg.settings={...cfg.settings,north_deg:32,glow_radius_cm:350,sun_rays:true,
  fill_colors:{...cfg.settings?.fill_colors,glow_light:{c:'#FFD9A0',a:.8}}};});
});
await page.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();
const dialog=page.locator('houseplan-card hp-dialog[data-kind=settings]');
output.referenceStructure=await dialog.evaluate((el,expected)=>{const surface=el.shadowRoot.querySelector('.surface'),nav=el.querySelector('.hpf-settings-nav'),header=el.shadowRoot.querySelector('.header'),close=header.querySelector('.close'),title=header.querySelector('.title');return Math.abs(surface.getBoundingClientRect().width-expected.width)<2&&surface.getBoundingClientRect().height<=760&&Math.abs(nav.getBoundingClientRect().width-expected.nav)<2&&JSON.stringify([...nav.querySelectorAll('button')].map(n=>n.textContent.trim()))===JSON.stringify(expected.labels)&&close.getBoundingClientRect().left<title.getBoundingClientRect().left;},expected);
await dialog.locator('[data-section-target=sun]').click();
await page.evaluate(()=>window.__hpTest.settled());
output.lightFieldComposition=await dialog.evaluate(el=>{const card=el.querySelector('[data-card=sun]'),color=card.querySelector('.hpf-colorrow'),label=color.querySelector('.hpf-labelrow'),picker=color.querySelector('.hpf-colorfield'),radius=card.querySelector('#gs-glow-radius').closest('.hpf-unit');return picker.getBoundingClientRect().top>label.getBoundingClientRect().bottom&&Math.abs(picker.getBoundingClientRect().width-card.getBoundingClientRect().width)<2&&Math.abs(radius.getBoundingClientRect().width-card.getBoundingClientRect().width)<2&&!!card.querySelector('.hpf-north-values .hpf-hint')&&[...card.querySelectorAll('.hpf-field .hpf-callout')].length>=2;});
output.footerStatusFirst=await dialog.locator('.hpf-footer').evaluate(el=>el.firstElementChild.classList.contains('hpf-status')&&el.firstElementChild.textContent.trim().length>0);
await dialog.locator('[data-card=sun] .hpf-colorfield .hpf-hex').click();
output.colourPlateDelegatesToExistingPicker=await dialog.locator('[data-card=sun] hp-color-opacity .trigger').getAttribute('aria-expanded')==='true';
output.lightPickerNamesEffectIntensity=await dialog.locator('[data-card=sun] hp-color-opacity').getByText('Интенсивность свечения',{exact:true}).isVisible();
await page.keyboard.press('Escape');
await reference.locator('.hp-after [data-nav] [data-group-button=g-after-light]').click();
await reference.locator('.hp-after').screenshot({path:`${dir}/approved-light-desktop.png`});
await dialog.locator('.surface').screenshot({path:`${dir}/actual-light-desktop.png`});
for(const width of [320,390]){await page.setViewportSize({width,height:900});await dialog.locator('.hpf-settings-mobile select').selectOption('sun');await page.evaluate(()=>window.__hpTest.settled());output[`mobile${width}`]=await dialog.evaluate(el=>{const content=el.shadowRoot.querySelector('.content');return content.scrollWidth<=content.clientWidth+1&&el.querySelector('.hpf-footer').getBoundingClientRect().bottom<=innerHeight+1;});await dialog.locator('.surface').screenshot({path:`${dir}/actual-light-${width}.png`});}
output.settingsHelpIsCompact=await dialog.locator('hp-help').filter({visible:true}).first().locator('.trigger').evaluate(el=>getComputedStyle(el).width==='22px');
await page.emulateMedia({reducedMotion:'no-preference'});
output.toggleUsesProductMotion=await dialog.locator('#gs-sun-rays').evaluate(el=>getComputedStyle(el,'::after').transitionDuration==='0.15s');
await page.emulateMedia({reducedMotion:'reduce'});
output.toggleRespectsReducedMotion=await dialog.locator('#gs-sun-rays').evaluate(el=>getComputedStyle(el,'::after').transitionDuration==='0s');
await page.emulateMedia({reducedMotion:'no-preference'});
await dialog.locator('.hpf-footer [data-hp=dialog-cancel]').click();await dialog.waitFor({state:'detached'});
await page.evaluate(()=>window.__hpTest.setMode('devices'));
await page.locator('[data-hp=tool][data-tool=device-inbox]').filter({visible:true}).first().click();
const inbox=page.locator('hp-dialog[data-kind=device-inbox]');
output.catalogueKeepsExistingHelpSize=await inbox.locator('hp-help').filter({visible:true}).first().locator('.trigger').evaluate(el=>getComputedStyle(el).width==='32px');
checkAll(output);await reference.close();await finish(browser,output);
