// Public old Git bundle + immutable approved prototype vs current product.
// Both pages use genuine pinned HA, identical synthetic data, font, DPR and camera.
import {launchHaDialogFixture,applyHaDialogTypography} from './helpers/ha-dialog-fixture.mjs';
import {UI_POLISH_963_HA_PIN} from './helpers/ui-polish-963-pin.mjs';
import {prepareUi963Page,createUi963Reference,UI_963_BASE} from './helpers/ui-polish-963-reference.mjs';
import {buttonPaint} from './helpers/button-paint.mjs';
import {enforcePinnedBrowser} from '../scripts/browser-attestation.mjs';
import {checkAll,watchPage,finish} from './serve.mjs';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

const output=process.env.HP_UI_963_OUT||'artifacts/ui-polish-963';mkdirSync(output,{recursive:true});
const fixture=await launchHaDialogFixture({authentic:true,pin:UI_POLISH_963_HA_PIN,
 wheelPath:process.env.HP_UI_963_HA_WHEEL,extraModules:['33396','95788'],viewport:{width:1440,height:1000},
 videoDir:process.env.HP_UI_963_VIDEO?join(output,'video'):undefined});
const {page}=fixture,out={},measurements=[];watchPage(page);await enforcePinnedBrowser(fixture.browser);
const palettes={light:['#fff','#f1f7f8','#28343c','#74818a','#e1e6e9','#078a9e'],dark:['#17222e','#0f1822','#e7eef4','#a6b6c3','#354755','#67cfe8']};
const setup=async p=>{
 if(process.env.HP_QA_SEGOE_DIR){
  const fonts=process.env.HP_QA_SEGOE_DIR;
  await p.route('**/__963_fonts/*',route=>route.fulfill({contentType:'font/ttf',body:readFileSync(join(fonts,new URL(route.request().url()).pathname.split('/').pop()))}));
  await p.addStyleTag({content:[['segoeui.ttf',400],['seguisb.ttf',600],['segoeuib.ttf',700]].map(([file,weight])=>`@font-face{font-family:'Segoe UI';src:url('/__963_fonts/${file}');font-weight:${weight}}`).join('')});
  await p.evaluate(async()=>{await Promise.all([400,600,700].map(w=>document.fonts.load(`${w} 14px "Segoe UI"`)));await document.fonts.ready;});
 }else await applyHaDialogTypography(p);
};
const theme=async(p,colors)=>p.evaluate(colors=>{
 const c=window.__card;['--card-background-color','--secondary-background-color','--primary-text-color','--secondary-text-color','--divider-color','--primary-color'].forEach((key,i)=>c.style.setProperty(key,colors[i]));
 c.hass={...c.hass,themes:{...c.hass.themes,darkMode:colors[0]!=='#fff'}};
 c.style.setProperty('--ha-card-background',colors[0]);c.style.setProperty('--primary-background-color',colors[1]);c.style.setProperty('--text-primary-color','#fff');
},colors);
const select=async(p,mode,selector)=>{
 await p.evaluate(mode=>window.__hpTest.setMode(mode),mode);await p.waitForFunction(()=>!window.__card._modeTransitionBusy);
 if(selector==='@contour'){
  const point=await p.locator('houseplan-card .plan-svg').evaluate(el=>{const p=new DOMPoint(400,100).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});
  await p.mouse.click(point.x,point.y);await p.waitForTimeout(300);return;
 }
 const target=p.locator('houseplan-card '+selector);
 if(selector.includes('partition')){const r=await target.boundingBox();await target.click({position:{x:r.width*.25,y:r.height/2}});}
 else if(selector.includes('led-select')){const point=await target.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()*.25).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});await p.mouse.click(point.x,point.y);}
 else await target.click();
 await p.evaluate(()=>window.__hpTest.settled());await p.waitForTimeout(300);
};
const metrics=p=>p.locator('houseplan-card [data-hp=properties-panel]').evaluate(panel=>{
 const top=panel.getBoundingClientRect(),rect=el=>{const r=el.getBoundingClientRect();return [r.x-top.x,r.y-top.y,r.width,r.height];};
 return {panel:rect(panel),groups:[...panel.querySelectorAll('.hp-prop-group')].filter(el=>getComputedStyle(el).display!=='none').map(el=>({
   heading:el.querySelector('.hp-prop-group-title')?.textContent.trim(),box:rect(el),
   hint:[...el.querySelectorAll('.hp-prop-hint')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({text:e.textContent.trim(),box:rect(e)})),
   fields:[...el.querySelectorAll('[data-property]')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({key:e.dataset.property,box:rect(e)})),
 })), title:panel.querySelector('.hp-prop-title')?.textContent.trim(),actions:[...panel.querySelectorAll('.hp-prop-action')].map(el=>{const s=getComputedStyle(el);return {text:el.textContent.trim(),border:s.borderColor,color:s.color,background:s.backgroundColor};})};
});
try{
 await prepareUi963Page(page,fixture.url);const reference=await createUi963Reference(fixture);await setup(page);await setup(reference);
 const scenes=[['wall','plan','[data-hp=partition][data-id=wall]'],['column','plan','[data-hp=wall-column][data-id=column]'],
 ['window','plan','.opening[data-id=window] .op-hit'],['door','plan','.opening[data-id=door] .op-hit'],
 ['rectangle','decor','.decorlayer [data-id=rect]'],['text','decor','.decorlayer [data-id=text]'],
 ['device','devices','.dev[data-id=lamp]'],['led','devices','[data-led-select=led]'],['contour','plan','@contour']];
 for(const [name,colors]of Object.entries(palettes)){
  for(const p of [reference,page])await theme(p,colors);
  for(const [scene,mode,selector]of scenes){
   for(const p of [reference,page])await select(p,mode,selector);
   const approved=await metrics(reference),actual=await metrics(page),prefix=name+'_'+scene;
   out[prefix+'_selected']=!!approved.title&&!!actual.title&&!/Ничего не выбрано|Nothing selected/.test(approved.title+' '+actual.title);
   const near=(a,b)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=1);
   out[prefix+'_panel']=near(approved.panel,actual.panel);
   out[prefix+'_section_geometry']=approved.groups.length===actual.groups.length&&approved.groups.every((group,i)=>near(group.box,actual.groups[i].box));
   out[prefix+'_field_geometry']=approved.groups.every((group,i)=>group.fields.length===actual.groups[i]?.fields.length&&group.fields.every((f,j)=>f.key===actual.groups[i].fields[j].key&&near(f.box,actual.groups[i].fields[j].box)));
   out[prefix+'_action_paint']=JSON.stringify(approved.actions)===JSON.stringify(actual.actions);
   measurements.push({scene:prefix,approved,actual});
   console.log(prefix,JSON.stringify(Object.fromEntries(Object.entries(out).filter(([k])=>k.startsWith(prefix)))));
   for(const [p,label]of [[reference,'approved'],[page,'product']])await p.screenshot({path:join(output,`${prefix}-${label}.png`)});
  }
 }
 // Same genuine form/footer and visible lettering in all supported languages/themes.
 const save=[];
 for(const lang of ['ru','en','de','fr'])for(const [name,colors]of Object.entries(palettes)){
  const paints=[];
  for(const p of [reference,page]){
   await p.evaluate(async lang=>{const c=window.__card;c.setConfig({...c._config,language:lang});await window.__hpTest.setMode('view');},lang);
   await p.waitForFunction(()=>!window.__card._modeTransitionBusy);await theme(p,colors);
   await p.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();
   const d=p.locator('houseplan-card hp-dialog[data-kind=settings]');await d.waitFor();await p.waitForTimeout(300);
   paints.push(await buttonPaint(d.locator('.hpf-footer [data-hp=dialog-confirm]')));
   await p.screenshot({path:join(output,`${lang}-${name}-save-${p===page?'product':'approved'}.png`)});
   await p.keyboard.press('Escape');await d.waitFor({state:'detached'});
  }
  out[`${lang}_${name}_approved_save_ink`]=paints.every(p=>p.height>=44&&p.textInkOffset!==null&&Math.abs(p.iconOffset)<=.25)&&Math.abs(paints[0].textInkOffset-paints[1].textInkOffset)<=.5;
  save.push({lang,theme:name,approved:paints[0],actual:paints[1]});
  console.log(lang,name,'Save paint',JSON.stringify(paints));
 }
 writeFileSync(join(output,'comparison.json'),JSON.stringify({base:UI_963_BASE,ha:fixture.provenance,font:process.env.HP_QA_SEGOE_DIR?'Segoe UI':'pinned HA Roboto',dpr:1,out,measurements,save},null,2));
 await fixture.assertClean();checkAll(out);await finish(fixture.browser,out);
}finally{
 writeFileSync(join(output,'measurements.json'),JSON.stringify({out,measurements},null,2));await fixture.close();
}
