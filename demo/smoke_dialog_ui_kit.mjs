// Composition geometry and independent interaction, using the real primitives.
import {rollup} from 'rollup';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import ts from 'typescript';
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,checkAll,finish,requirePinnedBrowser} from './serve.mjs';
requirePinnedBrowser();
const build=await rollup({input:'demo/dialog-ui-kit.ts',plugins:[
 {name:'transpile-gallery',transform(code,id){if(id.endsWith('.ts'))return {code:ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,experimentalDecorators:true,useDefineForClassFields:false}}).outputText,map:null};}},
 nodeResolve({extensions:['.mjs','.js','.json','.ts']}),
],onwarn(warning){if(warning.code!=='CIRCULAR_DEPENDENCY')console.warn(warning.message);}});
const {output}=await build.generate({format:'es',inlineDynamicImports:true});await build.close();
const touch=process.argv.includes('--touch');
const {page,browser}=await launch({width:1280,height:900},1,[],{hasTouch:touch});
const out={},dir='artifacts/dialog-ui-kit-1007';mkdirSync(dir,{recursive:true});
writeFileSync(dir+'/gallery.js',output[0].code);
writeFileSync(dir+'/index.html','<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Dialog UI kit</title><style>:root{--primary-color:#008aa5;--card-background-color:#fff;--primary-text-color:#223039;--secondary-text-color:#64747e;--divider-color:#dce2e6;--text-primary-color:#fff}body{font:14px/1.5 Arial,sans-serif}</style><body><script type="module" src="./gallery.js"></script></body></html>');
try {
 await page.addScriptTag({type:'module',content:output[0].code});
 const gallery=page.locator('hp-dialog-kit-gallery'),dialog=gallery.locator('hp-dialog');
 await dialog.waitFor();await page.waitForTimeout(220);
 const settle=()=>gallery.evaluate(async e=>{await e.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
 const palettes={light:['#ffffff','#223039','#64747e','#dce2e6','#008aa5'],dark:['#17222e','#e7eef4','#a6b6c3','#354755','#67cfe8'],custom:['#fff6e9','#35291d','#75634e','#d6c3ac','#9b45b7']};
 for(const width of [1280,390,320])for(const [theme,palette]of Object.entries(palettes)){
  await page.setViewportSize({width,height:900});
  await gallery.evaluate((el,p)=>{for(const [i,key]of ['--card-background-color','--primary-text-color','--secondary-text-color','--divider-color','--primary-color'].entries())el.style.setProperty(key,p[i]);},palette);
  await settle();
  out[width+'_'+theme+'_fit']=await dialog.evaluate(el=>{const content=el.querySelector('.hpf-settings-content'),r=content.getBoundingClientRect();return content.scrollWidth<=content.clientWidth+1&&r.left>=0&&r.right<=innerWidth+1;});
  out[width+'_'+theme+'_rhythm']=await gallery.locator('.hpf-sections').evaluate(el=>[...el.children].slice(1).every(n=>{const s=getComputedStyle(n);return parseFloat(s.paddingTop)===18&&parseFloat(s.marginTop)===18&&parseFloat(s.borderTopWidth)===1;}));
  out[width+'_'+theme+'_toggle']=await gallery.locator('.hpf-toggle').evaluate(n=>{const a=n.querySelector('.hpf-toggle-title').getBoundingClientRect(),b=n.querySelector('input').getBoundingClientRect();return Math.abs((a.top+a.bottom-b.top-b.bottom)/2)<1&&b.height===44;});
  await dialog.locator('.surface').screenshot({path:dir+'/gallery-'+width+'-'+theme+'.png'});
 }
 await page.setViewportSize({width:1280,height:900});await settle();
 const first=gallery.locator('#kit-source');
 await first.fill('Сохранённый черновик');
 await dialog.getByRole('button',{name:'Скрыть поле',exact:true}).click();await settle();
 out.omittedSectionHasNoSeparator=await gallery.locator('[data-kit=conditional]').count()===0&&await gallery.locator('.hpf-section').count()===7;
 out.siblingDraftSurvivesOmission=await first.inputValue()==='Сохранённый черновик';
 const help=gallery.locator('.hpf-toggle hp-help .trigger'),toggle=gallery.locator('#kit-toggle');
 if(touch){await help.scrollIntoViewIfNeeded();const r=await help.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}
 else await help.click();
 out.helpDoesNotToggle=!(await toggle.isChecked());await page.keyboard.press('Escape');
 const picker=gallery.locator('details.kit-picker'),summary=picker.locator('summary'),pickerHelp=gallery.locator('.hpf-disclosure-with-help hp-help .trigger');
 out.disclosureStartsClosed=!(await picker.evaluate(e=>e.open))&&!(await gallery.locator('[data-kit=pick]').isVisible());
 await page.mouse.move(0,0);const rest=await summary.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,shadow:getComputedStyle(e).boxShadow}));
 await pickerHelp.hover();await page.waitForTimeout(40);
 out.helpHoverDoesNotPaintTrigger=await summary.evaluate((e,rest)=>!e.matches(':hover')&&getComputedStyle(e).backgroundColor===rest.bg&&getComputedStyle(e).boxShadow===rest.shadow,rest);
 out.helpOpensImmediately=await pickerHelp.evaluate(e=>e.getAttribute('aria-expanded')==='true');
 await page.keyboard.press('Escape');await pickerHelp.click();
 out.helpClickDoesNotOpen=!(await picker.evaluate(e=>e.open));await page.keyboard.press('Escape');
 await summary.click();out.disclosureOpens=await picker.evaluate(e=>e.open)&&await gallery.locator('[data-kit=pick]').isVisible();
 await summary.focus();await page.keyboard.press('Enter');out.keyboardCloses=!(await picker.evaluate(e=>e.open));
 const action=gallery.locator('[data-kit=action]'),actionHelp=gallery.locator('.hpf-action-help hp-help .trigger');
 out.pickerTriggerKeepsActionInsets=await summary.evaluate((e,paint)=>{const s=getComputedStyle(e);return s.paddingLeft===paint.left&&s.paddingRight===paint.right&&s.borderRadius===paint.radius;},await action.evaluate(e=>{const s=getComputedStyle(e);return {left:s.paddingLeft,right:s.paddingRight,radius:s.borderRadius};}));
 await actionHelp.click();out.actionHelpDoesNotAct=await gallery.evaluate(e=>e.actionCount===0);await page.keyboard.press('Escape');
 await action.click();out.actionStillWorks=await gallery.evaluate(e=>e.actionCount===1);
 await page.emulateMedia({reducedMotion:'reduce'});await summary.click();
 out.reducedMotion=await picker.locator('.hpf-disclosure-content').evaluate(e=>getComputedStyle(e).animationName==='none');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await dialog.getByRole('button',{name:'Поменять порядок',exact:true}).click();await settle();
 out.reorderedSectionsKeepRhythm=await gallery.locator('.hpf-section').evaluateAll(nodes=>getComputedStyle(nodes[0]).borderTopWidth==='0px'&&nodes.slice(1).every(e=>getComputedStyle(e).paddingTop==='18px'));
 await page.getByRole('button',{name:'Скрыть поле',exact:true}).click();await settle();
 out.conditionalSectionRestored=await gallery.locator('[data-kit=conditional]').count()===1;
 writeFileSync(dir+'/verification.json',JSON.stringify(out,null,2));checkAll(out);await finish(browser,out);
}catch(error){await page.screenshot({path:dir+'/failure.png',fullPage:true});await browser.close();throw error;}
