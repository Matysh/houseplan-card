import { mkdirSync, writeFileSync } from 'node:fs';
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';
import { clickHeaderAction } from './helpers/header-actions.mjs';
requirePinnedBrowser('#1364 intrinsic single-row actions menu');
const {page,browser}=await launchColdView({width:1800,height:1000},1,[],{hasTouch:true});
const out='artifacts/header-actions-1364';mkdirSync(out,{recursive:true});
const card=page.locator('houseplan-card').first(),trigger=card.locator('[data-hp="header-actions-trigger"]');
const menu=card.locator('[data-hp="header-actions-menu"]:not([inert])');
const settle=async()=>{await page.evaluate(()=>window.__hpTest.settled());await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing);await page.evaluate(()=>window.__hpTest.settled());};
const size=async width=>{await page.evaluate(width=>{const host=document.getElementById('host');host.style.cssText='width:'+width+'px!important;max-width:none!important;margin:0;padding:0';},width);await settle();};
const read=()=>page.evaluate(()=>{const c=window.__card,r=c.renderRoot,h=r.querySelector('.hdr>.head'),hdr=h.parentElement;
 const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
 const space=[...h.querySelectorAll('hp-settings-select,[data-hp="space-name"]')].find(visible),action=h.querySelector('[data-hp="header-actions-trigger"]');
 const s=space?.getBoundingClientRect(),a=action.getBoundingClientRect();
 return {phase:Number(hdr.dataset.panelFlow),picker:[...h.querySelectorAll('hp-settings-select')].some(visible),
 name:h.querySelector('[data-hp="space-name"]')?.textContent,expectedName:c._headerNavigationSpaces.find(x=>x.id===c._space)?.title,
 rows:new Set([...h.querySelectorAll('button,hp-settings-select,[data-hp="space-name"]')].filter(visible).map(e=>Math.round(e.getBoundingClientRect().y))).size,
 buttons:[...h.querySelectorAll('button')].filter(visible).map(b=>({hp:b.dataset.hp,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),
 width:h.getBoundingClientRect().width,scroll:h.scrollWidth,height:h.getBoundingClientRect().height,
 spaceBeside:!!s&&s.width>0&&s.right<=a.left+.5&&Math.abs(s.y-a.y)<.5,
 triggerGlyph:action.querySelector('ha-icon')?.getAttribute('icon'),triggerText:action.textContent.trim(),
 metrics:r.querySelectorAll('.panel-header-metrics').length};});
const singleResizeMatrix=async label=>{
 const rows=[];
 for(const width of [1800,1400,1100,1000,900,780,600,320,600,780,900,1000,1100,1400,1800]){
  await size(width);const row=await read();rows.push({width,...row});
  if(row.phase===5)check(label+'-'+width+'-plain-name',!row.picker&&row.name===row.expectedName&&row.spaceBeside&&row.rows===1);
  if(row.phase===3)check(label+'-'+width+'-ordinary-compact-picker',row.picker&&row.name===undefined&&row.rows===1);
 }
 check(label+'-crosses-3-and-5',rows.some(r=>r.phase===3)&&rows.some(r=>r.phase===5));
 await size(320);
};
try {
 await page.evaluate(()=>{window.__card.setConfig({...window.__card._config,language:'ru'});});await settle();
 const widths=[];
 for(const width of [1800,1400,1100,900,780,700,600,500,480,400,360,320]){await size(width);widths.push({width,...await read()});}
 const narrow=widths.filter(r=>r.phase===5),normal=widths.filter(r=>r.phase<5);
 check('measured-transition-exists',narrow.length>0&&normal.length>0);
 check('normal-before-extreme',widths.every((r,i)=>!i||r.phase>=widths[i-1].phase));
 check('space-beside-actions',narrow.every(r=>r.spaceBeside&&r.rows===1));
 check('all-adaptive-states-stay-one-row',widths.every(r=>r.rows===1));
 check('icon-only-vertical-actions',narrow.every(r=>r.triggerGlyph==='mdi:dots-vertical'&&r.triggerText===''));
 check('extreme-only-one-button',narrow.every(r=>r.buttons.length===1&&r.buttons[0].hp==='header-actions-trigger'));
 check('no-overflow',widths.every(r=>r.scroll<=r.width+1&&r.metrics===0));
 check('44px-square-target',narrow.every(r=>r.buttons[0].w===44&&r.buttons[0].h===44));
 await size(320);check('unpinned-card-keeps-picker',(await read()).picker);
 let deferredMenus=0;
 await page.route(/\/header-actions-menu-[^/?]+\.js(?:\?.*)?$/,async route=>{
  deferredMenus++;await new Promise(resolve=>setTimeout(resolve,120));await route.fallback();
 });
 await page.evaluate(()=>window.__hpTest.setMode('plan'));await settle();
 check('facade-waits-for-lazy-header-command',await page.evaluate(()=>window.__card._mode),'plan');
 check('facade-case-really-deferred-menu',deferredMenus,1);
 await page.evaluate(()=>window.__hpTest.setMode('view'));await settle();
 await page.unroute(/\/header-actions-menu-[^/?]+\.js(?:\?.*)?$/);
 await trigger.click();await menu.waitFor();
 const items=await menu.locator('button').evaluateAll(bs=>bs.map(b=>({action:b.dataset.action,label:b.textContent.trim(),height:b.getBoundingClientRect().height})));
 check('all-owned-commands', ['space-settings','space-add','mode-plan','mode-devices','mode-decor','rotate-left','rotate-right','zoom-in','zoom-out','zoom-fit','hidden-devices','settings','pdf','support','summary-settings','summary-toggle'].every(id=>items.some(i=>i.action===id)));
 check('menu-touch-targets-and-labels',items.every(i=>i.height>=44&&i.label.length>0));
 await trigger.click();await menu.waitFor({state:'hidden'});
 check('pointer-trigger-closes',await trigger.getAttribute('aria-expanded'),'false');
 await trigger.press('Enter');await menu.waitFor();
 await trigger.press('Enter');await menu.waitFor({state:'hidden'});
 check('keyboard-trigger-closes',await trigger.getAttribute('aria-expanded'),'false');
 await trigger.click();await menu.waitFor();
 await menu.evaluate(async e=>{await Promise.all(e.getAnimations().map(a=>a.finished.catch(()=>{})));});
 await card.screenshot({path:out+'/unpinned-card-menu.png'});
 await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
 check('escape-restores-trigger-focus',await trigger.evaluate(b=>b.getRootNode().activeElement===b));
 const before=await page.evaluate(()=>window.__card._showHidden);
 await trigger.click();await menu.locator('[data-action="hidden-devices"]').click();await settle();
 check('toggle-routes-to-owner',await page.evaluate(()=>window.__card._showHidden),!before);
 await trigger.click();check('toggle-state-present',await menu.locator('[data-action="hidden-devices"]').getAttribute('aria-pressed'),String(!before));
 await page.mouse.click(1700,950);await menu.waitFor({state:'hidden'});check('outside-closes',await menu.count(),0);
 await trigger.click();await menu.locator('[data-action="mode-plan"]').click();await settle();
 check('editor-navigation',await page.evaluate(()=>window.__card._mode),'plan');
 // A wide window with Properties leaves a narrower head; the popup must
 // remain reachable inside that head instead of falling under Properties.
 await size(1024);
 check('properties-case-is-compact',(await read()).phase,5);
 check('properties-case-has-real-panel',await card.locator('[data-hp="properties-panel"]').isVisible());
 await trigger.click();await menu.waitFor();
 check('popup-stays-inside-head',await menu.evaluate(e=>{
  const h=window.__card.renderRoot.querySelector('.hdr>.head').getBoundingClientRect(),r=e.getBoundingClientRect();
  return r.left>=h.left&&r.right<=h.right;
 }));
 await menu.locator('[data-action="mode-view"]').click({timeout:5000});await settle();
 check('properties-cannot-intercept-close',await page.evaluate(()=>window.__card._mode),'view');
 await clickHeaderAction(card,'mode-decor');await settle();
 await page.evaluate(()=>window.__hpTest.setTool('line'));await settle();
 const drawing=await card.locator('.plan-svg').boundingBox();
 await page.mouse.click(drawing.x+drawing.width*.3,drawing.y+drawing.height*.65);
 await page.mouse.click(drawing.x+drawing.width*.45,drawing.y+drawing.height*.65);
 await page.evaluate(()=>window.__hpTest.waitForWrites());
 const pendingLine=await page.evaluate(()=>JSON.stringify(window.__card._decorStart));
 check('background-line-is-still-active',pendingLine!==undefined&&pendingLine!=='null');
 await trigger.click();await menu.waitFor({timeout:5000});
 check('opening-menu-keeps-live-line',await page.evaluate(()=>JSON.stringify(window.__card._decorStart)),pendingLine);
 await menu.locator('[data-action="mode-plan"]').click();await settle();
 check('live-drawing-cannot-swallow-menu-command',await page.evaluate(()=>window.__card._mode),'plan');
 await size(320);
 await trigger.click();await menu.locator('[data-action="mode-view"]').click();await settle();
 check('editor-close',await page.evaluate(()=>window.__card._mode),'view');
 for(const language of ['en','ru','de','fr']){
  await page.evaluate(async language=>{window.__card.setConfig({...window.__card._config,language});await window.__hpTest.setServerConfig(cfg=>{
   cfg.spaces[0].title='A very long ground floor space name '.repeat(5);cfg.spaces[1].title='Second floor';
  });},language);await settle();
  for(const width of [480,390,320,180]){await size(width);const row=await read();check(language+'-'+width+'-one-row',row.rows===1&&row.scroll<=row.width+1&&row.spaceBeside);}
 }
 await size(320);
 const originalSpace=await page.evaluate(()=>window.__card._space);
 const picker=card.locator('[data-hp="space-select"]');
 await picker.locator('[data-hp="select-trigger"]').click();
 const next=await picker.locator('option').evaluateAll((options,current)=>options.find(o=>o.value!==current).value,originalSpace);
 await picker.locator('[data-hp="select-option"][data-id="'+next+'"]').click();await settle();
 check('space-picker-uses-existing-navigation',await page.evaluate(()=>window.__card._space),next);
 await trigger.click();await menu.locator('[data-action="space-settings"]').click();
 const spaceDialog=card.locator('hp-dialog[data-kind="space"]');await spaceDialog.waitFor();
 check('space-settings-uses-current-space',await spaceDialog.locator('#space-title').inputValue(),'Second floor');
 await spaceDialog.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();await spaceDialog.waitFor({state:'detached'});await settle();
 await trigger.click();await menu.locator('[data-action="space-add"]').click();await spaceDialog.waitFor();
 check('add-space-opens-create',await spaceDialog.locator('#space-title').inputValue(),'');
 await spaceDialog.locator('[slot="footer"] [data-hp="dialog-cancel"]').click();await spaceDialog.waitFor({state:'detached'});await settle();
 // A sole available space is always a plain label, including pinned Lovelace.
 await page.evaluate(async()=>{const id=window.__card._space;await window.__hpTest.setServerConfig(cfg=>{
  cfg.spaces.find(space=>space.id===id).title='A very long pinned floor name '.repeat(6);
 });});await settle();
 await page.evaluate(()=>{const c=window.__card;c.setConfig({...c._config,floor:c._space});});await settle();
 let single=await read();check('pinned-card-keeps-plain-name',!single.picker&&single.name===single.expectedName&&single.spaceBeside);await card.screenshot({path:out+'/pinned-card.png'});
 await singleResizeMatrix('pinned-width-only');
 await page.evaluate(()=>{const c=window.__card;const {floor,...config}=c._config;c.setConfig(config);c.panelHost=true;c.requestUpdate();});await settle();
 check('multi-space-panel-keeps-picker',(await read()).picker);
 await page.evaluate(async()=>{await window.__hpTest.setServerConfig(cfg=>{cfg.spaces=cfg.spaces.slice(0,1);});});await settle();
 single=await read();check('single-space-panel-keeps-plain-name',!single.picker&&single.name===single.expectedName&&single.spaceBeside);
 await singleResizeMatrix('single-panel-width-only');
 await page.evaluate(()=>{const c=window.__card;c.panelHost=false;c.requestUpdate();});await settle();
 single=await read();check('single-space-unpinned-card-keeps-plain-name',!single.picker&&single.name===single.expectedName&&single.spaceBeside);
 // Revoked authority or a changed layout cannot leave a stale actionable sheet.
 await trigger.click();await page.evaluate(()=>{window.__card._serverCanWrite=false;window.__card.requestUpdate();});await settle();
 await menu.waitFor({state:'hidden'});await size(180);await trigger.click();
 check('readonly-omits-edit-commands',await menu.locator('[data-action="mode-plan"],[data-action="settings"],[data-action="space-add"]').count(),0);
 await page.keyboard.press('Escape');await size(1800);
 check('widening-restores-original-layout',(await read()).phase<5);
 writeFileSync(out+'/evidence.json',JSON.stringify({widths,items},null,2));
 await finish(browser,{widths:widths.map(r=>({width:r.width,phase:r.phase})),items:items.map(i=>i.action)});
} catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await browser.close();throw error;}
