import {pathToFileURL,fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const arg=k=>process.argv.find(a=>a.startsWith('--'+k+'='))?.slice(k.length+3);
const root=arg('root'),typographyRoot=arg('typography-root')||root,outDir=arg('out'),label=arg('label');
if(!root||!outDir||!label)throw Error('root/out/label required');
const mod=async p=>import(pathToFileURL(root+'/'+p));
const {launchHaDialogFixture}=await mod('demo/helpers/ha-dialog-fixture.mjs');
const {applyHaDialogTypography}=await import(pathToFileURL(typographyRoot+'/demo/helpers/ha-dialog-fixture.mjs'));
const {installHpTestOnPage}=await mod('demo/helpers/hp-test.mjs');
const {ensureHarnessEditorRuntime}=await mod('demo/editor-runtime-compat.mjs');
const {assertFreshDemoBundle}=await mod('demo/bundle-freshness.mjs');
const sha=x=>createHash('sha256').update(x).digest('hex');
const fixture=await launchHaDialogFixture({authentic:true,viewport:{width:1280,height:900},extraModules:['16213']});
const {page}=fixture;const result={label,probeSha256:sha(readFileSync(fileURLToPath(import.meta.url))),typographySha256:sha(readFileSync(typographyRoot+'/demo/helpers/ha-dialog-fixture.mjs')),source:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),srcTree:execFileSync('git',['rev-parse','HEAD:src'],{cwd:root,encoding:'utf8'}).trim(),checks:{},measurements:{},images:[]};mkdirSync(outDir,{recursive:true});
const settle=()=>page.evaluate(()=>window.__hpTest.settled());
const hover=async b=>{await page.mouse.move(0,0);await b.hover();await page.waitForTimeout(180);return b.evaluate(el=>{const s=getComputedStyle(el);return {cursor:s.cursor,shadow:s.boxShadow,background:s.backgroundColor,pass:s.cursor==='pointer'&&s.boxShadow!=='none'&&s.backgroundColor!=='rgba(0, 0, 0, 0)'};});};
try{
 await page.goto(fixture.url+'/product.html');await applyHaDialogTypography(page);
 try{await page.waitForFunction(()=>window.__card?._booting===false&&window.__card?._devices?.length>0);}catch(e){result.boot=await page.evaluate(()=>({card:!!window.__card,booting:window.__card?._booting,devices:window.__card?._devices?.length,ready:window.__ha505Ready}));throw e;}await page.clock.setFixedTime(new Date('2026-10-16T15:42:00Z'));await assertFreshDemoBundle(page,root);if(!await page.evaluate(ensureHarnessEditorRuntime))throw Error('editor');await installHpTestOnPage(page);
 const inputData=arg('input')?JSON.parse(readFileSync(arg('input'),'utf8')):null;
 await page.evaluate(async inputData=>{const c=window.__card;c.setConfig({...c._config,language:'ru'});c.hass={...c.hass,states:{...c.hass.states,'sun.sun':{entity_id:'sun.sun',state:'above_horizon',attributes:{elevation:18,azimuth:120,rising:false}}}};await window.__hpTest.setServerConfig(cfg=>{if(inputData)return structuredClone(inputData);cfg.settings={...cfg.settings,bg_mode:'static',bg_color:'#000000',sun_rays:true,moon:true,zigbee_topology:{enabled:true,z2m_base_topics:['zigbee2mqtt']}};});await window.__hpTest.setMode('plan');},inputData);
 const saved=await page.evaluate(()=>JSON.stringify(window.__card._serverCfg));result.syntheticDataSha256=sha(saved);writeFileSync(outDir+'/'+label+'-data.json',saved);
 await page.locator('houseplan-card [data-hp=settings]').filter({visible:true}).first().click();const d=page.locator('houseplan-card hp-dialog[data-kind=settings]');await d.waitFor();let offsets=[],heightStable=true;
 const section=async id=>{const mobile=d.locator('.hpf-settings-mobile');if(await mobile.isVisible())await mobile.locator('select').selectOption(id);else await d.locator(`[data-section-target=${id}]`).click();await settle();await page.waitForTimeout(200);};
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});const heights={};
  for(const id of ['display','plan','fills','sun','zigbee','data']){
   await section(id);heights[id]=await d.locator('ha-dialog wa-dialog dialog').evaluate(el=>el.getBoundingClientRect().height);
   offsets.push(...await d.locator('.hpf-settings-pane:not([hidden]) .hpf-toggle').filter({visible:true}).evaluateAll(rows=>rows.map(n=>{const text=[];const walk=document.createTreeWalker(n.querySelector('.hpf-toggle-title'),NodeFilter.SHOW_TEXT,{acceptNode:x=>x.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});let t;while(t=walk.nextNode()){const r=document.createRange();r.selectNodeContents(t);text.push(...r.getClientRects());}const b=n.querySelector('input').getBoundingClientRect();return (Math.min(...text.map(r=>r.top))+Math.max(...text.map(r=>r.bottom))-b.top-b.bottom)/2;})));
   if(id==='zigbee'){
    const h=d.locator('hp-zigbee-topology-settings hp-help').first();await h.locator('button').hover();await page.waitForTimeout(30);const help=await h.evaluate(el=>({open:el.shadowRoot.querySelector('button').getAttribute('aria-expanded'),cursor:getComputedStyle(el.shadowRoot.querySelector('button')).cursor,background:getComputedStyle(el.shadowRoot.querySelector('button')).backgroundColor}));result.measurements['help'+width]=help;result.checks['2_help_hover']=(result.checks['2_help_hover']??true)&&help.open==='true'&&help.cursor==='pointer'&&help.background!=='rgba(0, 0, 0, 0)';await page.mouse.move(0,0);
    if(width===390){const counts=await d.locator('hp-zigbee-topology-settings .hpf-toggle-title').evaluate(el=>{const walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:x=>x.textContent.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}),boxes=[];let text;while(text=walk.nextNode())for(const w of text.textContent.matchAll(/\S+/g)){const r=document.createRange();r.setStart(text,w.index);r.setEnd(text,w.index+w[0].length);boxes.push({word:w[0],y:r.getBoundingClientRect().top});}const bottom=Math.max(...boxes.map(b=>b.y));return boxes.filter(b=>Math.abs(b.y-bottom)<1).map(b=>b.word);});result.measurements.lastLine=counts;result.checks['1_zigbee_wrap']=counts.length>=2;}
   }
   if(id==='sun'){
    const selects=await d.locator('select[name=gs-sun-ray-origin]').count(),radios=await d.locator('input[name=gs-sun-ray-origin][type=radio]').count();result.measurements.origins={selects,radios};result.checks['3_preview_selection']=selects===0&&radios===2;const border=await d.locator('#gs-moon-status').evaluate(el=>getComputedStyle(el).borderTopWidth);result.measurements.moonBorder=border;result.checks['5_moon_divider']=border==='0px';
   }
   if(id==='plan'){
    const button=d.getByRole('button',{name:'Как в теме',exact:true});await button.hover();await page.waitForTimeout(180);const clipped=await button.evaluate(el=>{const r=el.getBoundingClientRect(),out=[];for(let p=el.parentElement;p&&p.tagName!=='HP-DIALOG';p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if((s.overflowX!=='visible'&&b.right<r.right+1)||(s.overflowY!=='visible'&&b.bottom<r.bottom+1))out.push(p.className);}return out;});result.measurements['clipped'+width]=clipped;result.checks['8_theme_ring']=(result.checks['8_theme_ring']??true)&&clipped.length===0;
    const picker=d.locator('[data-card=plan] hp-color-opacity').first();await picker.locator('.trigger').click();const input=picker.locator('input[type=number]');await input.fill('100');const alpha=await input.evaluate(el=>{const s=getComputedStyle(el),c=document.createElement('canvas').getContext('2d');c.font=s.font;return {value:el.value,width:el.clientWidth,padding:parseFloat(s.paddingLeft)+parseFloat(s.paddingRight),ink:c.measureText('100').width};});result.measurements['alpha'+width]=alpha;result.checks['6_alpha_100']=(result.checks['6_alpha_100']??true)&&alpha.value==='100'&&alpha.width-alpha.padding>=alpha.ink+16;await page.keyboard.press('Escape');
   }
   if(['sun','zigbee','plan'].includes(id)){const name=label+'-'+width+'-'+id+'.png';await d.locator('ha-dialog wa-dialog dialog').screenshot({path:outDir+'/'+name});result.images.push({file:name,sha256:sha(readFileSync(outDir+'/'+name))});}
  }
  result.measurements['heights'+width]=heights;heightStable&&=Math.max(...Object.values(heights))-Math.min(...Object.values(heights))<=1;
 }
 result.measurements.toggleOffsets=offsets;result.checks['4_toggle_alignment']=offsets.length>0&&offsets.every(n=>Math.abs(n)<=1.25);result.checks['7_stable_height']=heightStable;
 await page.setViewportSize({width:1280,height:900});await section('display');await d.locator('.hpf-settings-pane:not([hidden]) input[type=checkbox]').first().click();await d.locator('.hpf-footer [data-hp=dialog-cancel]').click();const confirm=page.locator('houseplan-card hp-dialog[data-kind=confirm]');await confirm.waitFor();const buttons=confirm.locator('.danger-confirm-footer .btn');result.measurements.confirmation=[];for(let i=0;i<2;i++)result.measurements.confirmation.push(await hover(buttons.nth(i)));result.checks['9_common_button_hover']=result.measurements.confirmation.every(r=>r.pass);await confirm.locator('[data-hp=dialog-confirm]').click();await d.waitFor({state:'detached'});result.savedDataUnchanged=await page.evaluate(saved=>JSON.stringify(window.__card._serverCfg)===saved,saved);await fixture.assertClean();result.errors=fixture.errors;result.external=fixture.externalRequests;
}finally{result.errors=fixture.errors;result.external=fixture.externalRequests;await fixture.close();writeFileSync(outDir+'/'+label+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({label,source:result.source,data:result.syntheticDataSha256,checks:result.checks,unchanged:result.savedDataUnchanged,boot:result.boot,errors:result.errors,external:result.external}));}
if(Object.keys(result.checks).length!==9||Object.values(result.checks).some(v=>!v))process.exitCode=1;
