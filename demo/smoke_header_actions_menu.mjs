import { mkdirSync, writeFileSync } from 'node:fs';
import { launchColdView, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser('#1347 intrinsic third-row actions menu');
const {page,browser}=await launchColdView({width:1800,height:1000},1,[],{hasTouch:true});
const out='artifacts/header-actions-1347';mkdirSync(out,{recursive:true});
const card=page.locator('houseplan-card').first(),trigger=card.locator('[data-hp="header-actions-trigger"]');
const menu=card.locator('[data-hp="header-actions-menu"]:not([inert])');
const settle=async()=>{await page.evaluate(()=>window.__hpTest.settled());await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._modeTransitionPreparing);await page.evaluate(()=>window.__hpTest.settled());};
const size=async width=>{await page.evaluate(width=>{const host=document.getElementById('host');host.style.cssText='width:'+width+'px!important;max-width:none!important;margin:0;padding:0';},width);await settle();};
const read=()=>page.evaluate(()=>{const c=window.__card,r=c.renderRoot,h=r.querySelector('.hdr>.head'),hdr=h.parentElement;
 const visible=e=>e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
 return {phase:Number(hdr.dataset.panelFlow),picker:[...h.querySelectorAll('hp-settings-select')].some(visible),
 buttons:[...h.querySelectorAll('button')].filter(visible).map(b=>({hp:b.dataset.hp,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),
 width:h.getBoundingClientRect().width,scroll:h.scrollWidth,height:h.getBoundingClientRect().height,
 pickerAbove:[...h.querySelectorAll('hp-settings-select')].filter(visible).every(s=>s.getBoundingClientRect().bottom<=h.querySelector('[data-hp=header-actions-trigger]').getBoundingClientRect().top),
 metrics:r.querySelectorAll('.panel-header-metrics').length};});
try {
 await page.evaluate(()=>{window.__card.setConfig({...window.__card._config,language:'ru'});});await settle();
 const widths=[];
 for(const width of [1800,1400,1100,900,780,700,600,500,480,400,360,320]){await size(width);widths.push({width,...await read()});}
 const narrow=widths.filter(r=>r.phase===5),normal=widths.filter(r=>r.phase<5);
 check('measured-transition-exists',narrow.length>0&&normal.length>0);
 check('normal-before-extreme',widths.every((r,i)=>!i||r.phase>=widths[i-1].phase));
 check('picker-above-actions',narrow.every(r=>r.pickerAbove));
 check('extreme-only-one-button',narrow.every(r=>r.buttons.length===1&&r.buttons[0].hp==='header-actions-trigger'));
 check('no-overflow',widths.every(r=>r.scroll<=r.width+1&&r.metrics===0));
 check('44px-target',narrow.every(r=>r.buttons[0].w>=44&&r.buttons[0].h>=44));
 await size(320);check('unpinned-card-keeps-picker',(await read()).picker);
 await trigger.click();await menu.waitFor();
 const items=await menu.locator('button').evaluateAll(bs=>bs.map(b=>({action:b.dataset.action,label:b.textContent.trim(),height:b.getBoundingClientRect().height})));
 check('all-owned-commands', ['space-settings','space-add','mode-plan','mode-devices','mode-decor','rotate-left','rotate-right','zoom-in','zoom-out','zoom-fit','hidden-devices','settings','pdf','support','summary-settings','summary-toggle'].every(id=>items.some(i=>i.action===id)));
 check('menu-touch-targets-and-labels',items.every(i=>i.height>=44&&i.label.length>0));
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
 await trigger.click();await menu.locator('[data-action="mode-view"]').click();await settle();
 check('editor-close',await page.evaluate(()=>window.__card._mode),'view');
 // Pinned Lovelace omits only the selector, preserving the action commands.
 await page.evaluate(()=>{const c=window.__card;c.setConfig({...c._config,floor:c._space});});await settle();
 check('pinned-card-hides-picker',!(await read()).picker);await card.screenshot({path:out+'/pinned-card.png'});
 await page.evaluate(()=>{const c=window.__card;const {floor,...config}=c._config;c.setConfig(config);c.panelHost=true;c.requestUpdate();});await settle();
 check('multi-space-panel-keeps-picker',(await read()).picker);
 await page.evaluate(async()=>{await window.__hpTest.setServerConfig(cfg=>{cfg.spaces=cfg.spaces.slice(0,1);});});await settle();
 check('single-space-panel-hides-picker',!(await read()).picker);
 await page.evaluate(()=>{const c=window.__card;c.panelHost=false;c.requestUpdate();});await settle();
 check('single-space-unpinned-card-keeps-picker',(await read()).picker);
 // Revoked authority or a changed layout cannot leave a stale actionable sheet.
 await trigger.click();await page.evaluate(()=>{window.__card._serverCanWrite=false;window.__card.requestUpdate();});await settle();
 await menu.waitFor({state:'hidden'});await size(180);await trigger.click();
 check('readonly-omits-edit-commands',await menu.locator('[data-action="mode-plan"],[data-action="settings"],[data-action="space-add"]').count(),0);
 await page.keyboard.press('Escape');await size(1800);
 check('widening-restores-original-layout',(await read()).phase<5);
 writeFileSync(out+'/evidence.json',JSON.stringify({widths,items},null,2));
 await finish(browser,{widths:widths.map(r=>({width:r.width,phase:r.phase})),items:items.map(i=>i.action)});
} catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await browser.close();throw error;}
