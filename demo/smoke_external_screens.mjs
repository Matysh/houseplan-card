import {fileURLToPath} from 'node:url';
import {assertFreshDemoBundle} from './bundle-freshness.mjs';
/** #1113 real dialog/URL consumers on the existing synthetic HA wire bus. */
import { launchColdView, checkAll, finish } from './serve.mjs';
const {page,browser}=await launchColdView({width:1280,height:920},1,[],{},undefined,undefined,'/demo.html?panel-cold=1&external-screens=1',false);
const out=await page.evaluate(async()=>{
  const result={}, sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const until=async(probe,label)=>{const end=performance.now()+15000;while(performance.now()<end){if(probe())return;await sleep(20);}throw Error('external screens: '+label);};
  const hass=window.__mkHass(), call=hass.callWS, calls=[];
  const wire={...hass,callWS:async message=>{calls.push(message.type);if(window.__failExternalScreensSave&&message.type==='houseplan/config/set')throw Error('controlled profile save refusal');return call(message);}};
  const initial=await call({type:'houseplan/config/get'});
  const profile=id=>({id,space:null,rotation:0,cycle:0,idle:0,summary:'local',hidden_devices:'local',icon_scale:null,font_scale:null,controls:true});
  initial.config.settings||={};initial.config.settings.external_screens={version:1,next_id:2,screens:[{...profile(1),rotation:90}]};
  window.__pushServerConfig(initial.config);
  history.replaceState(null,'','/houseplan?hpprofile=1&foreign=keep');
  const panel=document.createElement('houseplan-panel');panel.panel={component_name:'houseplan-panel'};panel.hass=wire;panel.narrow=false;panel.route={prefix:'/houseplan',path:''};
  document.getElementById('host').style.cssText='width:100%;height:100vh;margin:0;padding:0';document.getElementById('host').replaceChildren(panel);
  await import('/assets/houseplan-panel.js');await customElements.whenDefined('houseplan-panel');
  await until(()=>panel.shadowRoot?.querySelector('houseplan-card')?._loadOk,'cold profile');
  const admin=panel.shadowRoot.querySelector('houseplan-card');await admin.updateComplete;
  result.coldProfileEnablesKioskAndRotation=admin._kiosk&&admin._rotation===90&&new URLSearchParams(location.search).get('foreign')==='keep';
  const root=admin.renderRoot,element=root.querySelector('ha-card');
  await until(()=>root.querySelector('[data-hp="summary-settings"]'),'positive kiosk controls');
  let setConfigs=0;const original=admin.setConfig;admin.setConfig=function(...args){setConfigs++;return original.apply(this,args);};
  const navigate=async url=>{history.replaceState(null,'',url);panel.route={prefix:'/houseplan',path:location.pathname.slice('/houseplan'.length)};await admin.updateComplete;await sleep(80);await admin.updateComplete;};
  await navigate('/houseplan/kiosk/2?hpprofile=1&hpspace=1&hprotate=270');
  result.pathPositionAndIndependentOverrides=admin._space===admin._model[1].id&&admin._rotation===270;
  await navigate('/houseplan?hpprofile=999&hpsummary=0&hpcontrols=0');
  result.unknownProfileStillKiosk=admin._kiosk&&!root.querySelector('[data-hp="summary-toggle"]')&&!root.querySelector('[data-hp="summary-settings"]');
  await navigate('/houseplan?hpprofile=abc');result.malformedProfileOrdinaryView=!admin._kiosk;
  await navigate('/houseplan');
  root.querySelector('[data-hp="settings"]').click();await until(()=>root.querySelector('hp-dialog[data-kind="settings"]'),'open General settings');
  const settings=()=>root.querySelector('hp-dialog[data-kind="settings"]');
  settings().querySelector('[data-section-target="external-screens"]').click();await admin.updateComplete;
  result.newSectionBeforeMaintenance=[...settings().querySelectorAll('.hpf-settings-nav [data-section-target]')].map(n=>n.dataset.sectionTarget).slice(-2).join(',')==='external-screens,data';
  const beforeSaved=JSON.stringify(admin._serverCfg.settings.external_screens);
  settings().querySelector('[data-hp="external-screen-add"]').click();await admin.updateComplete;
  const child=()=>root.querySelector('hp-dialog[data-kind="external-screen-constructor"]');
  await until(()=>child(),'constructor');
  result.constructorHasNoInnerCard=child().querySelectorAll('.hpf-card').length===0&&child().querySelectorAll('select').length===9;
  const select=(key,value)=>{const el=child().querySelector(`[data-field="external-screen-${key}"]`);el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}));};
  select('space',admin._model[0].id);await admin.updateComplete;
  result.oneSpaceDisablesCycle=child().querySelector('[data-field="external-screen-cycle"]').disabled;
  select('space','');select('cycle',30);await admin.updateComplete;
  result.cycleDisablesIdle=child().querySelector('[data-field="external-screen-idle"]').disabled;
  child().querySelector('[data-hp="dialog-cancel"]').click();await admin.updateComplete;await sleep(250);
  result.cancelDidNotChangeOuterOrServer=admin._settingsDialog.externalScreens.screens.length===1&&JSON.stringify(admin._serverCfg.settings.external_screens)===beforeSaved;
  settings().querySelector('[data-hp="external-screen-add"]').click();await admin.updateComplete;await until(()=>child(),'second constructor');
  child().querySelector('[data-hp="external-screen-ok"]').click();await admin.updateComplete;await sleep(250);
  result.okChangesOnlyOuterDraft=admin._settingsDialog.externalScreens.screens.length===2&&JSON.stringify(admin._serverCfg.settings.external_screens)===beforeSaved;
  settings().querySelector('[data-hp="external-screen-delete"]').click();await admin.updateComplete;
  settings().querySelector('[data-hp="external-screen-add"]').click();await admin.updateComplete;await until(()=>child(),'third constructor');
  child().querySelector('[data-hp="external-screen-ok"]').click();await admin.updateComplete;await sleep(250);
  result.deletedNumberNotReused=admin._settingsDialog.externalScreens.next_id===4&&JSON.stringify(admin._settingsDialog.externalScreens.screens.map(s=>s.id))==='[2,3]';
  // Retire the first fixture profile through the actual outer Save.
  window.__failExternalScreensSave=true;settings().querySelector('[data-hp="dialog-confirm"]').click();
  await until(()=>admin._settingsDialog&&!admin._settingsDialog.busy,'controlled Save refusal');
  result.refusedSaveKeepsOuterDraftAndShell=!!settings()&&!settings().inert&&admin._settingsDialog.externalScreens.screens.length===2;
  window.__failExternalScreensSave=false;
  const save=settings().querySelector('[data-hp="dialog-confirm"]');save.click();
  await until(()=>!admin._settingsDialog,'save ACK');
  const exiting=settings();result.successfulSaveRetainsAnimatedShell=!!exiting&&exiting.inert;
  await until(()=>!settings(),'animated exit completes');
  result.savedProfilesReachAcceptedModel=admin._serverCfg.settings.external_screens.screens.length===2;
  const kiosk=document.createElement('houseplan-card');kiosk.panelHost=true;kiosk.routeKiosk={enabled:true,position:null,profile:2};const kioskCalls=[];kiosk.hass={...hass,callWS:async message=>{kioskCalls.push(message.type);return call(message);}};kiosk.setConfig({type:'custom:houseplan-card'});document.getElementById('host').append(kiosk);
  await until(()=>kiosk._loadOk,'independent kiosk consumer');await kiosk.updateComplete;
  const preferenceSnapshot=()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(key=>/summary-panel|hp_hidden_devices|houseplan_card_kiosk/.test(key)).sort().map(key=>[key,localStorage.getItem(key)])));
  await until(()=>kiosk.renderRoot.querySelector('[data-hp="summary-settings"]'),'second consumer controls');
  const secondRoot=kiosk.renderRoot.querySelector('ha-card'), localBefore=preferenceSnapshot();
  result.eachPanelHasOneOwnConfigSubscription=window.__externalScreenSubscriptionCounts().own===2&&window.__externalScreenSubscriptionCounts().total===2;
  const countsBefore=kioskCalls.filter(type=>type==='houseplan/config/get').length;
  const caches=JSON.stringify(kiosk._floorCacheBuilds), revision=kiosk._cfgRev;
  const cfg=structuredClone(kiosk._serverCfg);Object.assign(cfg.settings.external_screens.screens[0],{summary:'hide',hidden_devices:'show',icon_scale:1.5,font_scale:1.25,controls:false});
  const rev=window.__pushServerConfig(cfg);
  await until(()=>kiosk._cfgRev===rev&&admin._cfgRev===rev,'live event adopted by both consumers');await kiosk.updateComplete;
  result.profileOnlyEventHasNoConfigGet=kioskCalls.filter(type=>type==='houseplan/config/get').length===countsBefore;
  result.kioskRetainsCardAndGeometry=kiosk.renderRoot.querySelector('ha-card')===secondRoot&&JSON.stringify(kiosk._floorCacheBuilds)===caches;
  result.liveProfileAppliesAllFields=kiosk._effectiveKioskScale.icon===1.5&&kiosk._effectiveKioskScale.font===1.25&&kiosk._externalScreen.hidden_devices===true&&!kiosk.renderRoot.querySelector('[data-hp="summary-toggle"]')&&!kiosk.renderRoot.querySelector('[data-hp="summary-settings"]');
  result.profileDidNotOverwriteLocal=preferenceSnapshot()===localBefore;
  const same=kiosk._externalScreen;for(let i=0;i<5;i++){kiosk.hass={...kiosk.hass};await kiosk.updateComplete;}
  result.hassTicksReuseResolution=kiosk._externalScreen===same;
  result.panelNeverSetConfigAgain=setConfigs===0&&root.querySelector('ha-card')===element;
  window.__externalScreensReport={result,calls,kioskCalls,revision,rev};
  return result;
});
// The cold mount deliberately precedes element definition; validate its loaded tree before acceptance.
await assertFreshDemoBundle(page,fileURLToPath(new URL('../',import.meta.url)));
await page.locator('houseplan-panel').evaluate(panel=>panel.remove()); // Retire the other consumer after the live two-client witness.
await page.waitForFunction(()=>window.__externalScreenSubscriptionCounts().own===1);
out.retiredPanelRemovedItsOwnConfigSubscription=await page.evaluate(()=>window.__externalScreenSubscriptionCounts().total===1);
const beforeRecovery=await page.evaluate(()=>window.__externalScreensReport.kioskCalls.filter(type=>type==='houseplan/config/get').length);
await page.evaluate(()=>window.__closeExternalScreenStreams('runtime_changed'));
await page.waitForFunction(before=>window.__externalScreenSubscriptionCounts().own===1&&window.__externalScreensReport.kioskCalls.filter(type=>type==='houseplan/config/get').length===before+1,beforeRecovery);
out.runtimeClosedRefreshesOnceAndResubscribes=await page.evaluate(()=>window.__externalScreenSubscriptionCounts().total===1);

const stage=page.locator('houseplan-card').last().locator('.stage');
await stage.scrollIntoViewIfNeeded();
const box=await stage.boundingBox();
await page.mouse.move(box.x+15,box.y+15);await page.mouse.down();
await page.waitForTimeout(3100);await page.mouse.up();
await page.locator('houseplan-card').last().locator('hp-dialog[data-kind="kiosk"]').waitFor();
Object.assign(out,await page.evaluate(async()=>{
  const kiosk=document.querySelector('houseplan-card'), dialog=kiosk.renderRoot.querySelector('hp-dialog[data-kind="kiosk"]');
  const result={profileScaleSlidersLocked:[...dialog.querySelectorAll('input[type="range"]')].length===2&&[...dialog.querySelectorAll('input[type="range"]')].every(input=>input.disabled),
    bothLockedDisableReset:dialog.querySelector('.btn.ghost').disabled,
    lockReasonIsVisible:[...dialog.querySelectorAll('.rhint')].some(el=>el.textContent.includes(kiosk._t('kiosk.profile_locked')))};
  dialog.querySelector('[data-hp="dialog-cancel"]').click();await kiosk.updateComplete;
  const removed=structuredClone(kiosk._serverCfg);removed.settings.external_screens.screens=removed.settings.external_screens.screens.filter(s=>s.id!==2);
  const rev=window.__pushServerConfig(removed), end=performance.now()+10000;
  while(kiosk._cfgRev!==rev&&performance.now()<end)await new Promise(resolve=>setTimeout(resolve,20));
  await kiosk.updateComplete;
  result.removedProfileRestoresLocalFallback=kiosk._cfgRev===rev&&kiosk._kiosk&&kiosk._externalScreen.icon_scale===undefined&&kiosk._effectiveKioskScale.icon===kiosk._kioskScale.icon;
  const original=window.__mkHass(), root=document.getElementById('host');
  const until=async probe=>{const end=performance.now()+10000;while(performance.now()<end){if(probe())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('external screen capability case');};
  const mount=async(readonly,old)=>{
    const card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card'});
    card.hass={...original,user:{...original.user,id:readonly?'readonly':'writer',is_admin:!readonly},callWS:async message=>{
      const response=await original.callWS(message);if(message.type==='houseplan/config/get'){response.can_write=!readonly;if(old){delete response.external_screens_api;delete response.external_screens_events_api;}}return response;
    }};root.append(card);await until(()=>card._loadOk);await card.updateComplete;return card;
  };
  const readonly=await mount(true,false);
  result.readonlyHasNoProfileSettings=!readonly.renderRoot.querySelector('[data-hp="settings"]')&&!readonly.renderRoot.querySelector('[data-section-target="external-screens"]');
  const old=await mount(false,true);old.renderRoot.querySelector('[data-hp="settings"]').click();
  await until(()=>old.renderRoot.querySelector('hp-dialog[data-kind="settings"]'));
  const settings=old.renderRoot.querySelector('hp-dialog[data-kind="settings"]');settings.querySelector('[data-section-target="external-screens"]').click();await old.updateComplete;
  result.oldBackendExplainsWithoutEditing=!!settings.querySelector('[data-card="external-screens"] [role="status"]')&&!settings.querySelector('[data-hp="external-screen-add"], [data-hp="external-screen-create"]');
  return result;
}));
Object.assign(out,await page.evaluate(async()=>{
  const report=window.__externalScreensReport,calls=()=>report.kioskCalls.filter(type=>type==='houseplan/config/get').length,before=calls(),kiosk=document.querySelector('houseplan-card');
  window.__closeExternalScreenStreams('unauthorized');
  for(let i=0;i<5;i++){kiosk.hass={...kiosk.hass};await kiosk.updateComplete;}
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  return {authClosedNeverReloadsOrResubscribes:window.__externalScreenSubscriptionCounts().own===0&&calls()===before};
}));
checkAll(out);await finish(browser,out);
