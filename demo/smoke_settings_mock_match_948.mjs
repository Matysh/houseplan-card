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
const expected=await reference.locator('.hp-after').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,nav:el.querySelector('[data-nav]').getBoundingClientRect().width,labels:[...el.querySelectorAll('[data-nav] button')].map(n=>n.textContent.trim())}));
await page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,language:'ru'});c.style.setProperty('--card-background-color','#fff');c.style.setProperty('--primary-background-color','#eceeef');c.style.setProperty('--primary-text-color','#223039');c.style.setProperty('--secondary-text-color','#64747e');c.style.setProperty('--divider-color','#dce2e6');c.style.setProperty('--primary-color','#008aa5');c.hass={...c.hass,language:'ru'};await window.__hpTest.settled();});
await page.evaluate(async()=>{
 const c=window.__card;
 c.hass={...c.hass,states:{...c.hass.states,'sun.sun':{entity_id:'sun.sun',state:'above_horizon',attributes:{elevation:11,azimuth:120,rising:false}}}};
 await window.__hpTest.setServerConfig(cfg=>{cfg.settings={...cfg.settings,bg_mode:'daynight',north_deg:32,glow_radius_cm:350,sun_rays:true,
  fill_colors:{...cfg.settings?.fill_colors,glow_light:{c:'#FFD9A0',a:.8}}};});
});
await page.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();
const dialog=page.locator('houseplan-card hp-dialog[data-kind=settings]');
output.referenceStructure=await dialog.evaluate((el,expected)=>{const surface=el.shadowRoot.querySelector('.surface'),nav=el.querySelector('.hpf-settings-nav'),header=el.shadowRoot.querySelector('.header'),close=header.querySelector('.close'),title=header.querySelector('.title');return Math.abs(surface.getBoundingClientRect().width-expected.width)<2&&Math.abs(surface.getBoundingClientRect().height-expected.height)<=8&&Math.abs(nav.getBoundingClientRect().width-expected.nav)<2&&JSON.stringify([...nav.querySelectorAll('button')].map(n=>n.textContent.trim()))===JSON.stringify(expected.labels)&&close.getBoundingClientRect().left<title.getBoundingClientRect().left;},expected);
output.paletteCaptionsAboveSwatches=await dialog.locator('[data-card=fills] .hpf-colortile').evaluateAll(nodes=>nodes.length===8&&nodes.every(n=>n.firstElementChild.classList.contains('hpf-colortile-heading')&&n.firstElementChild.querySelector('hp-help')));
output.paletteKeepsUndividedGroups=await dialog.locator('[data-card=fills] .hpf-sections-plain > .hpf-section').evaluateAll(nodes=>nodes.length===4&&nodes.slice(1).every(n=>{const s=getComputedStyle(n);return s.borderTopWidth==='0px'&&s.paddingTop==='0px'&&s.marginTop==='18px';}));
output.volumetricMatchesApprovedSection=await dialog.locator('[data-card=plan] .hpf-body > :first-child #gs-volumetric-view').count()===1;
await dialog.locator('[data-section-target=plan]').click();
output.phasePreviewMatchesCanonicalPalette=await dialog.locator('.hpf-background-stage').evaluateAll(nodes=>JSON.stringify(nodes.map(n=>n.dataset.phase))===JSON.stringify(['dawn','day','dusk','night'])&&getComputedStyle(nodes[0]).backgroundImage.includes('170, 189, 209')&&getComputedStyle(nodes[1]).backgroundImage.includes('220, 233, 239'));
await dialog.locator('[data-section-target=data]').click();
output.maintenanceMatchesApprovedRows=await dialog.locator('[data-card=data]').evaluate(el=>{const rows=el.querySelectorAll('.hpf-actions'),first=rows[0].querySelectorAll('button'),second=rows[1].querySelectorAll('button');return first[0].textContent.includes('Импорт')&&first[1].textContent.includes('Экспорт')&&Math.abs(second[0].getBoundingClientRect().top-second[1].getBoundingClientRect().top)<2&&!!el.querySelector('.hpf-converter a.hpf-link')&&!el.querySelector('.hpf-converter .hpf-callout');});
await dialog.locator('[data-section-target=sun]').click();
await page.evaluate(()=>window.__hpTest.settled());
output.lightFieldComposition=await dialog.evaluate(el=>{const card=el.querySelector('[data-card=sun]'),color=card.querySelector('.hpf-colorrow'),label=color.querySelector('.hpf-labelrow'),picker=color.querySelector('.hpf-colorfield'),radius=card.querySelector('#gs-glow-radius').closest('.hpf-unit');return picker.getBoundingClientRect().top>label.getBoundingClientRect().bottom&&Math.abs(picker.getBoundingClientRect().width-card.getBoundingClientRect().width)<2&&Math.abs(radius.getBoundingClientRect().width-card.getBoundingClientRect().width)<2&&!!card.querySelector('.hpf-north-values .hpf-hint')&&[...card.querySelectorAll('.hpf-field .hpf-callout')].length>=2;});
output.footerStatusFirst=await dialog.locator('.hpf-footer').evaluate(el=>el.firstElementChild.classList.contains('hpf-status')&&el.firstElementChild.textContent.trim().length>0);
output.dividersKeepEqualToggleInsets=await dialog.locator('[data-card=sun] .hpf-section:has(> .hpf-toggle)').evaluateAll(nodes=>nodes.length>0&&nodes.every(n=>getComputedStyle(n).paddingTop==='18px'&&getComputedStyle(n).marginTop==='18px'));
output.sectionDividerReachesBodyBottom=await dialog.locator('.hpf-settings-layout').evaluate(el=>Math.abs(el.getBoundingClientRect().bottom-el.querySelector('.hpf-settings-content').getBoundingClientRect().bottom)<2);
const cancel=dialog.locator('.hpf-footer [data-hp=dialog-cancel]');
for(const dark of [false,true]){
 await dialog.evaluate((el,dark)=>{const host=el.getRootNode().host;host.style.setProperty('--card-background-color',dark?'#17222e':'#fff');host.style.setProperty('--primary-text-color',dark?'#e7eef4':'#223039');host.style.setProperty('--primary-color',dark?'#67cfe8':'#008aa5');},dark);
 await page.mouse.move(0,0);await page.waitForTimeout(180);
 const before=await cancel.evaluate(el=>getComputedStyle(el).backgroundColor);
 await cancel.hover();await page.waitForTimeout(180);
 output[`footerVisibleHover${dark?'Dark':'Light'}`]=await cancel.evaluate((el,before)=>{const s=getComputedStyle(el);return s.cursor==='pointer'&&s.backgroundColor!==before&&s.backgroundColor!=='rgba(0, 0, 0, 0)'&&s.boxShadow!=='none';},before);
}
await page.mouse.move(0,0);
await dialog.evaluate(el=>{const host=el.getRootNode().host;host.style.setProperty('--card-background-color','#fff');host.style.setProperty('--primary-text-color','#223039');host.style.setProperty('--primary-color','#008aa5');});
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
// #976 deliberately aligns the catalogue with the shared compact instant help.
output.catalogueUsesSharedHelpSize=await inbox.locator('hp-help').filter({visible:true}).first().locator('.trigger').evaluate(el=>getComputedStyle(el).width==='22px');
// #1012: the catalogue is now intentionally compact. A real unscoped public
// control still needs its default 32px target; compact tokens must not leak.
await page.evaluate(()=>{const help=document.createElement('hp-help');help.id='unscoped-help-1012';help.text='Unscoped help';help.ariaLabel='Help';document.body.append(help);});
const unscoped=page.locator('#unscoped-help-1012');
await unscoped.locator('.trigger').waitFor();
output.unscopedHelpKeepsDefaultTarget=await unscoped.locator('.trigger').evaluate(el=>getComputedStyle(el).width==='32px'&&getComputedStyle(el).height==='32px');
await unscoped.evaluate(el=>el.remove());
checkAll(output);await reference.close();await finish(browser,output);
