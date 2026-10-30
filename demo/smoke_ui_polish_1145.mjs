/** #1145: real dialog/picker styles, native input and measured small controls. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {launch,check,finish,requirePinnedBrowser} from './serve.mjs';
requirePinnedBrowser('#1145 ten UI-kit findings');
const output='artifacts/ui-polish-1145';mkdirSync(output,{recursive:true});
const {page,browser}=await launch({width:1100,height:940},1,[],{hasTouch:true});
const card=page.locator('#host > houseplan-card'),report={themes:[],sizes:[],rows:[]};
const settled=()=>page.evaluate(()=>window.__hpTest.settled());
const boxOK=(r,size=44)=>r.width>=size&&r.height>=size;
check('AC4 oracle refuses 43px width',!boxOK({width:43,height:44}));
check('AC4 oracle refuses 43px height',!boxOK({width:44,height:43}));
check('AC4 oracle accepts 44px',boxOK({width:44,height:44}));
try {
 await card.evaluate(c=>c.style.setProperty('--secondary-background-color','#35414e'));
 await page.evaluate(()=>window.__hpTest.setMode('decor'));
 // Real caller templates, not invented primary class names in a style gallery.
 for(const kind of ['text','backdrop','shape','image']){
  await card.evaluate(async(c,kind)=>{
   if(kind==='text')c._decorTextDialog={x:.3,y:.3,text:'UI audit',color:'#223344',opacity:1,angle:'0',sizeCm:20}; // private-ok: #1145 actual text-template paint fixture without persisting a decor object; no Save command invoked.
   if(kind==='backdrop')c._backdropDialog={widthCm:500,heightCm:400,angle:'0'}; // private-ok: #1145 inspect the actual frame form without uploading a mock background asset.
   if(kind==='shape')c._decorShapeDialog={id:'ui-shape',kind:'rect',color:'#223344',opacity:1,widthCm:2,angle:'0'}; // private-ok: #1145 legacy shape-footer paint fixture without inventing persisted geometry.
   if(kind==='image'){c._haDecorAssetsApi=1;c._decorAssetCatalog=[];c.requestUpdate();await window.__hpTest.settled();c.shadowRoot.querySelector('[data-editor-palette=image]').click();} // private-ok: #1145 mock backend capability/catalog seed before the actual public palette click; no writer guard is replaced.
   await window.__hpTest.settled();
  },kind);
  const action=card.locator(kind==='image'?'.imageupload':'hp-dialog [slot=footer] [data-hp=dialog-confirm]').last();
  await action.waitFor({state:'visible'});
  check('AC1 '+kind+' actual action is primary',await action.evaluate(e=>getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)'&&e.classList.contains('on')));
  await page.screenshot({path:`${output}/${kind}.png`});
  if(kind==='image')await card.locator('[data-action=image-palette-close]').click();
  else await card.locator('hp-dialog .close').last().click();
  await settled();
 }
 // Measure real dialog bodies, including the physical dialog incorrectly
 // referenced as wallthick-dlg in the original audit. Seed only input data.
 await page.evaluate(async()=>{
  await window.__hpTest.setServerConfig(cfg=>{cfg.spaces[0].stairs=[{id:'ui-stair1145',kind:'straight',x:.32,y:.32,length:.2,width:.1,angle:0,direction:'forward'}];});
  await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');
 });
 await card.locator('[data-hp=stair][data-id=ui-stair1145] .hp-stair-hit').dblclick();await settled();
 const stairs=card.locator('hp-dialog[data-kind=stairs]');await stairs.waitFor({state:'visible'});
 const inspectRows=async(loc,label)=>{
  const rows=await loc.locator('.body .row').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return{padding:s.padding,border:s.borderTopWidth,justify:s.justifyContent};}));
  report.rows.push({label,rows});check('AC5 '+label+' real body rows are not footer',rows.length>0&&rows.every(r=>r.padding==='0px'&&r.border==='0px'&&r.justify!=='flex-end'));
  await page.screenshot({path:`${output}/rows-${label}.png`});
 };
 await inspectRows(stairs,'stairs');
 check('AC1 stairs direction is a supported wrapping group',await stairs.locator('.hpf-actions').evaluate(e=>getComputedStyle(e).display==='flex'&&getComputedStyle(e).flexWrap==='wrap'));
 await stairs.locator('.hpf-actions button').last().click();
 check('AC1 stairs direction still selects one value',await stairs.locator('.hpf-actions .on').count()===1);
 await stairs.locator('[slot=footer] [data-hp=dialog-cancel]').click();await settled();
 for(const kind of ['partition','column']){
  await card.evaluate(async(c,kind)=>{c._physicalDialog={id:'ui-physical1145',kind,shape:'square',cm:'15',angle:'0'};await window.__hpTest.settled();},kind); // private-ok: #1145 real physical-form display fixture; native field input/Cancel are exercised and no Save is invoked.
  const physical=card.locator('hp-dialog[data-kind=physical]');await physical.waitFor({state:'visible'});await inspectRows(physical,kind);
  const input=physical.locator('[data-field=physical-size]');await input.fill('20');
  check('AC5 '+kind+' input still updates draft',await card.evaluate(c=>c._physicalDialog.cm==='20'));
  await physical.locator('[slot=footer] [data-hp=dialog-cancel]').click();await settled();
  check('AC5 '+kind+' native Cancel retires dialog',await physical.count()===0);
 }
 await page.evaluate(()=>window.__hpTest.setMode('view'));await settled();
 await card.locator('[data-hp=settings]').click();
 const settings=card.locator('hp-dialog[data-kind=settings][icon="mdi:cog-outline"]');
 await settings.locator('[data-section-target=data]').click();
 const optimizeName=await card.evaluate(c=>c._t('gs.align_all'));
 await settings.getByRole('button',{name:optimizeName,exact:true}).click();
 const optimize=card.locator('hp-dialog[data-kind=settings][icon="mdi:broom"]');await optimize.waitFor({state:'visible'});
 // A failed-result data fixture selects the diagnostics branch; no guard or function is replaced.
 await card.evaluate(async c=>{c._alignDialog={...c._alignDialog,changed:true,preflight:{ok:false,failures:[{displayName:'UI audit',reason:'wall-null'}]}};await window.__hpTest.settled();}); // private-ok: #1145 failed-result display data only, no geometry guard/function is replaced or Apply invoked.
 await inspectRows(optimize,'optimize');
 await optimize.locator('[slot=footer] [data-hp=dialog-cancel]').click();await settled();
 await settings.locator('.close').click();await settled();
 await page.evaluate(()=>window.__hpTest.setMode('decor'));
 // A real hp-dialog with the production shared stylesheet already adopted by
 // this real card. These fixture-only commands count callbacks, not HA calls.
 await card.evaluate(async c=>{
  const d=document.createElement('hp-dialog');d.id='audit1145';d.hass=c.hass;d.className='ui-dialog';d.title='UI audit';
  const b=document.createElement('div');b.className='body';
  b.innerHTML='<div class="row"><input class="namein" value="Body input"><span>cm</span></div><div class="hpf-settings-form"><button id="disabled1145" class="btn" disabled>Disabled</button><button id="enabled1145" class="btn">Enabled</button><section data-settings-section="alarms"><button class="alarm-add">+</button><button class="alarm-remove">−</button></section></div><button id="danger1145" class="btn danger">Delete</button><div class="backuperror">Backup error</div><div class="rrow"><input class="rpat bad" value="invalid pattern"></div><div class="furnitem on">Selected furniture</div><hp-color-opacity id="picker1145"></hp-color-opacity>';
  const f=document.createElement('div');f.className='row';f.slot='footer';f.innerHTML='<button class="btn on">Save</button>';
  d.append(b,f);c.shadowRoot.append(d);await d.updateComplete;
  window.__1145Calls={disabled:0,enabled:0};
  for(const id of ['disabled','enabled'])b.querySelector('#'+id+'1145').addEventListener('click',()=>window.__1145Calls[id]++);
 });
 const dialog=card.locator('#audit1145'),disabled=dialog.locator('#disabled1145'),enabled=dialog.locator('#enabled1145');
 const row=await dialog.locator('.body > .row').evaluate(e=>{const s=getComputedStyle(e);return{padding:s.padding,border:s.borderTopWidth,justify:s.justifyContent};});
 report.rows.push(row);
 check('AC5 body row has no footer border or padding',row.padding==='0px'&&row.border==='0px'&&row.justify!=='flex-end');
 check('AC5 real footer retains right alignment',await dialog.locator('[slot=footer]').evaluate(e=>getComputedStyle(e).justifyContent==='flex-end'));
 check('AC3 disabled hit keeps cursor',await disabled.evaluate(e=>getComputedStyle(e).pointerEvents!=='none'&&getComputedStyle(e).cursor==='not-allowed'));
 const dbox=await disabled.boundingBox();await page.mouse.move(dbox.x+dbox.width/2,dbox.y+dbox.height/2);await page.mouse.click(dbox.x+dbox.width/2,dbox.y+dbox.height/2);
 await enabled.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Enter');await page.keyboard.press('Space');
 check('AC3 disabled native mouse and keys stay inert',await page.evaluate(()=>window.__1145Calls.disabled===0));
 await enabled.click();check('AC3 enabled neighbour still invokes command',await page.evaluate(()=>window.__1145Calls.enabled===1));
 for(const [theme,surface,text,accent,error] of [['light','#ffffff','#212121','#1565c0','#db4437'],['dark','#202126','#eeeeee','#90caf9','#db4437'],['custom','#302b38','#fff2e8','#ffb74d','#ffab91']]){
  await card.evaluate((c,{surface,text,accent,error})=>{for(const [k,v]of Object.entries({'--card-background-color':surface,'--primary-text-color':text,'--primary-color':accent,'--error-color':error,'--hpf-danger':error,'--hp-accent':accent,'--hp-txt':text}))c.style.setProperty(k,v);},{surface,text,accent,error});
  await page.mouse.move(5,5);
  await dialog.evaluate(async d=>{await Promise.all([...d.querySelectorAll('*')].flatMap(e=>e.getAnimations()).filter(a=>Number.isFinite(a.effect.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
  const state=await dialog.evaluate((d,{surface,error,accent})=>{
   const rgba=s=>{const x=document.createElement('canvas');x.width=x.height=1;const g=x.getContext('2d');g.fillStyle=s;g.fillRect(0,0,1,1);return [...g.getImageData(0,0,1,1).data];};
   const blend=(a,b)=>a.slice(0,3).map((v,i)=>v*a[3]/255+b[i]*(1-a[3]/255));
   const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
   const danger=d.querySelector('#danger1145'),backup=d.querySelector('.backuperror'),furniture=d.querySelector('.furnitem'),bad=d.querySelector('.rpat.bad');
   const color=rgba(getComputedStyle(danger).color),errorRgb=rgba(error),bg=rgba(surface),bc=rgba(getComputedStyle(backup).color),bb=blend(rgba(getComputedStyle(backup).backgroundColor),bg),fc=rgba(getComputedStyle(furniture).backgroundColor),ac=rgba(accent);
   return{danger:getComputedStyle(danger).color,error:getComputedStyle(backup).color,border:getComputedStyle(bad).borderColor,selected:getComputedStyle(furniture).backgroundColor,
    dangerToken:color.slice(0,3).every((v,i)=>v===errorRgb[i]),backupToken:bc.slice(0,3).every((v,i)=>v===errorRgb[i]),regexToken:rgba(getComputedStyle(bad).borderTopColor).slice(0,3).every((v,i)=>v===errorRgb[i]),furnitureToken:blend(fc,bg).every((v,i)=>Math.abs(v-(ac[i]*.18+bg[i]*.82))<=1),
    dangerContrast:contrast(color,bg),backupContrast:contrast(bc,bb),baselineBackupContrast:contrast(rgba('#ff7a5c'),blend(rgba('rgba(179,64,42,.16)'),bg)),selectedAlpha:fc[3]/255};
  },{surface,error,accent});
  report.themes.push({theme,...state});
  check('AC2 '+theme+' danger, backup and invalid field follow error token',state.dangerToken&&state.backupToken&&state.regexToken);
  check('AC2 '+theme+' furniture follows accent with translucent paint',state.furnitureToken&&state.selectedAlpha>.15&&state.selectedAlpha<.22);
  await page.screenshot({path:`${output}/theme-${theme}.png`});
 }
 for(const cls of ['alarm-add','alarm-remove']){const r=await dialog.locator('.'+cls).boundingBox();report.sizes.push({cls,...r});check('AC4 '+cls+' 44px target',boxOK(r));}
 const picker=dialog.locator('#picker1145');
 check('AC4 ordinary color trigger 44px',boxOK(await picker.locator('.trigger').boundingBox()));
 await picker.locator('.trigger').click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:940});
  await picker.evaluate(async p=>{await p.updateComplete;await Promise.all(p.shadowRoot.querySelector('.picker').getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const state=await picker.evaluate(p=>{const surface=p.shadowRoot.querySelector('.picker'),r=surface.getBoundingClientRect();return{left:r.left,right:r.right,scroll:surface.scrollWidth,client:surface.clientWidth,fits:r.left>=0&&r.right<=innerWidth&&surface.scrollWidth<=surface.clientWidth,controls:[...surface.querySelectorAll('input,.confirm')].map(e=>({cls:e.className,type:e.type,height:e.getBoundingClientRect().height}))};});
  report.sizes.push({width,...state});check('AC4 picker '+width+' fits and controls 44px',state.fits&&state.controls.every(r=>r.height>=44));
  await page.screenshot({path:`${output}/picker-${width}.png`});
 }
 await page.keyboard.press('Escape');
 // Owner-approved compact swatch remains 36px; the popover above stays ordinary.
 await picker.evaluate(async p=>{p.setAttribute('compact-swatch','');p.style.cssText='width:36px;height:36px';await p.updateComplete;});
 check('AC4 compact color trigger remains 36px',await picker.locator('.trigger').evaluate(e=>e.getBoundingClientRect().height===36));
 await dialog.evaluate(e=>e.remove());await page.setViewportSize({width:1100,height:940});
 await page.evaluate(()=>window.__hpTest.setMode('view'));await settled();
 // Native tap on the actual summary toggle: sticky :hover needs real touch.
 const summary=card.locator('[data-hp=summary-toggle]');await summary.waitFor({state:'visible'});
 await page.mouse.move(5,5);const plain=await summary.evaluate(e=>getComputedStyle(e).backgroundColor);
 await summary.tap();await page.waitForTimeout(200);
 check('AC6 native touch leaves no sticky hover',await summary.evaluate((e,plain)=>getComputedStyle(e).backgroundColor===plain,plain));
 // A touch-only context correctly advertises no fine-pointer capability; use
 // an ordinary desktop context for the distinct native mouse/keyboard case.
 const desktop=await launch({width:1100,height:900});
 try{
  const toggle=desktop.page.locator('houseplan-card [data-hp=summary-toggle]');await toggle.waitFor({state:'visible'});
  await desktop.page.locator('houseplan-card').evaluate(c=>c.style.setProperty('--secondary-background-color','#35414e'));
  await desktop.page.mouse.move(5,5);const original=await toggle.evaluate(e=>getComputedStyle(e).backgroundColor);
  await toggle.hover();await desktop.page.waitForTimeout(200);
  report.desktop=await toggle.evaluate((e,original)=>({host:e.getRootNode().host.localName,gate:e.getRootNode().host.hasAttribute('data-pointer-hover'),hover:e.matches(':hover'),bg:getComputedStyle(e).backgroundColor,secondary:getComputedStyle(e).getPropertyValue('--secondary-background-color'),original,media:matchMedia('(any-hover: hover) and (any-pointer: fine)').matches}),original);
  check('AC6 desktop mouse hover still paints',report.desktop.gate&&report.desktop.bg!==original);
  await desktop.page.locator('houseplan-card').evaluate(async c=>{const d=document.createElement('hp-dialog');d.id='disabled-hover1145';d.hass=c.hass;d.className='ui-dialog';d.innerHTML='<div class="body"><button class="btn" disabled>Unavailable</button></div>';c.shadowRoot.append(d);await d.updateComplete;});
  const inertButton=desktop.page.locator('houseplan-card #disabled-hover1145 .btn');
  const paintOf=el=>({bg:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderColor});
  await desktop.page.mouse.move(5,5);const disabledPaint=await inertButton.evaluate(paintOf);
  await inertButton.hover();await desktop.page.waitForTimeout(200);
  check('AC3 disabled desktop hover preserves paint',JSON.stringify(await inertButton.evaluate(paintOf))===JSON.stringify(disabledPaint));
  await desktop.page.locator('houseplan-card #disabled-hover1145').evaluate(e=>e.remove());
  await desktop.page.mouse.move(5,5);await toggle.focus();await desktop.page.keyboard.press('Tab');await desktop.page.keyboard.press('Shift+Tab');
  check('AC6 keyboard retains focus-visible',await toggle.evaluate(e=>e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle!=='none'));
 }finally{await desktop.browser.close();}
 // A deliberately long translated label uses the production farhint styles.
 await card.evaluate(c=>{const e=document.createElement('div');e.className='farhint';e.id='far1145';e.innerHTML='<ha-icon icon="mdi:map-marker-alert-outline"></ha-icon><span>Objects outside the plan — '+ 'long-label-'.repeat(20)+'</span><button class="btn ghost">Show</button>';c.shadowRoot.querySelector('.stage').append(e);});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:940});await settled();
  const bounds=await card.locator('#far1145').evaluate(e=>{const b=e.getBoundingClientRect(),s=e.parentElement.getBoundingClientRect(),button=e.querySelector('button').getBoundingClientRect();return{left:b.left,right:b.right,containerLeft:s.left,containerRight:s.right,scroll:e.scrollWidth,client:e.clientWidth,buttonWidth:button.width};});
  check('AC1 long farhint fits '+width,bounds.left>=bounds.containerLeft&&bounds.right<=bounds.containerRight&&bounds.scroll<=bounds.client&&bounds.buttonWidth>0);
 }
 await card.locator('#far1145').evaluate(e=>e.remove());await page.setViewportSize({width:1100,height:940});
 // Static-card button uses its own ShadowRoot, never the main card sheet.
 await page.evaluate(async()=>{const s=document.createElement('houseplan-space-card');s.id='static1145';s.style.cssText='position:fixed;left:30px;top:30px;width:300px';s.setConfig({type:'custom:houseplan-space-card',space:window.__card._space,button_target:'/houseplan'});s.hass=window.__card.hass;document.body.append(s);});
 const staticButton=page.locator('#static1145 .hp-static-btn');await staticButton.waitFor({state:'visible'});
 check('AC4 static card button height44', (await staticButton.boundingBox()).height>=44);
}finally{writeFileSync(output+'/report.json',JSON.stringify(report,null,2));await finish(browser);}