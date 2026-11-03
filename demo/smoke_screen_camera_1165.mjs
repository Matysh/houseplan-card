/** Profiles use the real card, summary layout and shared camera controller. */
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';
requirePinnedBrowser('#1165 profile reference camera');
const { page, browser } = await launchColdView({width:1280,height:920},1,[],{},undefined,undefined,
  '/demo.html?panel-cold=1&external-screens=1',false);
const out = await page.evaluate(async () => {
  const out = {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const until = async (probe, label) => {
    const end=performance.now()+10000;
    while(performance.now()<end) { if(probe()) return; await sleep(20); }
    const c=window.__screenCameraCard;
    throw Error('#1165: '+label+' '+JSON.stringify(c&&{space:c._space,profile:c._externalScreen,view:c._view,
      zoom:c._zoom,pending:c._screenReferencePending,reference:c._screenReference,continuity:c._continuity.state}));
  };
  const hass=window.__mkHass(), initial=await hass.callWS({type:'houseplan/config/get'});
  const view={rotation:0,zoom:2,summary:'show',center_summary:true,icon_scale:null,font_scale:null};
  initial.config.settings ||= {};
  initial.config.settings.center_summary = true; // Ordinary preference must not override a profile.
  initial.config.settings.external_screens={version:2,next_id:2,screens:[{id:1,space:null,cycle:0,idle:0,default_view:view,space_views:{}}]};
  initial.config.settings.summary_panel={version:1,title:'Synthetic summary',show_on_mobile:true,blocks:[{
    id:'b',title:'State',visible:true,scope:{type:'all'},values:[{id:'v',label:'Value',source:{type:'entity',entity_id:'sensor.profile_value'}}]}]};
  hass.states={...hass.states,'sensor.profile_value':{state:'1',attributes:{friendly_name:'Profile test'}}};
  window.__pushServerConfig(initial.config);
  const host=document.getElementById('host'); host.style.cssText='width:100%;height:100vh;margin:0;padding:0';
  const panel=document.createElement('houseplan-panel'); panel.hass=hass; panel.narrow=false;
  panel.panel={component_name:'houseplan-panel'}; panel.route={prefix:'/houseplan',path:''};
  history.replaceState(null,'','/houseplan?hpprofile=1'); host.replaceChildren(panel);
  await import('/assets/houseplan-panel.js');
  await until(()=>panel.shadowRoot?.querySelector('houseplan-card')?._loadOk,'cold profile');
  const c=panel.shadowRoot.querySelector('houseplan-card'); window.__screenCameraCard=c;
  await until(()=>c._screenAtReference&&!c._booting&&c._continuity.state==='steady','opening reference');
  const stable=()=>JSON.stringify({view:c._view,zoom:c._zoom});
  const storedZoom=()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(key=>/zoom/i.test(key)).sort().map(key=>[key,localStorage.getItem(key)])));
  const zoomBefore=storedZoom();
  const update=async patch=>{
    const cfg=structuredClone(c._serverCfg), row=cfg.settings.external_screens.screens[0];
    row.space_views[c._space]={...row.default_view,...row.space_views[c._space],...patch};
    const rev=window.__pushServerConfig(cfg); await until(()=>c._cfgRev===rev,'profile event');
    await until(()=>c._screenAtReference,'new reference'); await c.updateComplete; await sleep(50);
  };
  const visibleCheck=()=>{
    const stage=c._stageEl.getBoundingClientRect(), panel=c.renderRoot.querySelector('.summary-overlay').getBoundingClientRect();
    const side=stage.width>=stage.height?'right':'bottom';
    const freeW=side==='right'?panel.left-stage.left:stage.width, freeH=side==='bottom'?panel.top-stage.top:stage.height;
    const vb=c._baseVb(), b=c._displayBase(vb), v=c._viewOr(vb), ppu=stage.width/v.w;
    const expected=Math.min(freeW/b.w,freeH/b.h)*c._externalScreen.zoom;
    return Math.abs(ppu/expected-1)<.0001
      && Math.abs((b.x+b.w/2-v.x)*ppu-freeW/2)<1
      && Math.abs((b.y+b.h/2-v.y)*ppu-freeH/2)<1;
  };
  out.opening200FitsFreeArea=visibleCheck();
  await update({center_summary:false});
  {
    const s=c._stageEl, vb=c._baseVb(), b=c._displayBase(vb), v=c._viewOr(vb), ppu=s.clientWidth/v.w;
    out.profileFalseOverridesGlobalTrue=Math.abs(ppu/(Math.min(s.clientWidth/b.w,s.clientHeight/b.h)*c._externalScreen.zoom)-1)<.0001
      &&Math.abs((b.x+b.w/2-v.x)*ppu-s.clientWidth/2)<1;
  }
  await update({center_summary:true});
  out.rotationsAndZooms=true;
  for(const rotation of [0,90,180,270]) for(const zoom of [.1,.5,1,2,10]) {
    await update({rotation,zoom});
    const badge=c.renderRoot.querySelector('[data-hp-live-zoom]');
    out.rotationsAndZooms &&= visibleCheck() && badge.hidden===(zoom===1)
      && badge.textContent.trim()===`${Math.round(zoom*100)}%` && c._swipeZone;
  }
  await update({rotation:0,zoom:2});
  const before=stable(), ref=c._screenReference;
  for(const value of ['1234567890123456789012345678901234567890','unavailable','3']) {
    c.hass={...c.hass,states:{...c.hass.states,'sensor.profile_value':{state:value,attributes:{friendly_name:'Profile test'}}}};
    await c.updateComplete; await sleep(50);
  }
  out.valuesNeverMoveCamera=stable()===before&&c._screenReference===ref;
  c._fitAll('double-tap'); await until(()=>!c._screenFitRequest&&!c._cameraTransition.active,'explicit Fit');
  out.explicitFitIs100WithoutChangingProfile=c._zoomBadge.percent===100&&c._externalScreen.zoom===2&&!c._screenAtReference;
  c._restoreScreenReference(); await until(()=>c._screenAtReference,'idle default');
  out.idleReturnsStored200=c._zoomBadge.percent===200&&c._swipeZone;
  const old=c._space, next=c._model.find(s=>s.id!==old).id;
  const cfg=structuredClone(c._serverCfg), row=cfg.settings.external_screens.screens[0];
  row.space_views[next]={...row.default_view,zoom:.5,rotation:90};
  window.__pushServerConfig(cfg); await sleep(80);
  c._slideTo(next,'left',true); await until(()=>c._screenAtReference&&c._space===next,'carousel arrival');
  out.arrivalUsesOwn50=c._zoomBadge.percent===50&&c._rotation===90&&c._swipeZone;
  c._view={...c._view,x:c._view.x+50}; c.requestUpdate(); await c.updateComplete;
  out.manualPanDisablesSwipe=!c._screenAtReference&&!c._swipeZone;
  const manual=stable(); c.hass={...c.hass}; await c.updateComplete; await sleep(50);
  out.stateTickPreservesManualView=stable()===manual;
  c._restoreScreenReference(); await until(()=>c._screenAtReference,'restore after manual pan');
  out.profileNeverWritesOrdinaryZoom=storedZoom()===zoomBefore;
  // #1213: the first expired-pause tick must finish the current reference;
  // pending layout work is not an invitation to advance in the same task.
  await until(()=>!c._slide,'arrival motion settled');
  const carousel=structuredClone(c._serverCfg);carousel.settings.external_screens.screens[0].cycle=10;
  const cycleRev=window.__pushServerConfig(carousel);await until(()=>c._cfgRev===cycleRev&&c._effectiveCycle===10,'active profile carousel');
  c._view={...c._view,x:c._view.x+100};c.requestUpdate();await c.updateComplete;
  c._cyclePausedUntil=Date.now()-1;
  const pausedSpace=c._space;c._kioskCarousel.tick();
  out.expiredPauseHoldsCurrentSpace=c._space===pausedSpace&&c._screenReferencePending;
  await until(()=>c._screenAtReference&&c._continuity.state==='steady','pause restores reference');
  c._kioskCarousel.tick();
  out.nextTickAdvancesAfterReference=c._space!==pausedSpace;
  await until(()=>c._screenAtReference&&!c._slide,'next carousel arrival');
  c._kioskCarousel.dispose();
  return out;
});
await page.setViewportSize({width:390,height:844});
await page.waitForFunction(()=>{const c=window.__screenCameraCard;return c._screenAtReference&&c._screenReference.size[0]===390
  &&c.renderRoot.querySelector('.summary-overlay.bottom:not([inert])');});
out.bottomSummaryUsesFreeHeight=await page.evaluate(()=>{
  const c=window.__screenCameraCard,s=c._stageEl.getBoundingClientRect(),p=c.renderRoot.querySelector('.summary-overlay').getBoundingClientRect();
  const vb=c._baseVb(),b=c._displayBase(vb),v=c._viewOr(vb),ppu=s.width/v.w;
  return Math.abs((b.x+b.w/2-v.x)*ppu-s.width/2)<1
    &&Math.abs((b.y+b.h/2-v.y)*ppu-(p.top-s.top)/2)<1;
});
out.isometricReference=await page.evaluate(async()=>{
  const c=window.__screenCameraCard,cfg=structuredClone(c._serverCfg);cfg.settings.volumetric_view=true;
  const rev=window.__pushServerConfig(cfg),end=performance.now()+10000;
  while(c._cfgRev!==rev&&performance.now()<end)await new Promise(r=>setTimeout(r,20));
  if(!await c._ensureIsoSceneRuntime())return false;
  c._restoreScreenReference();
  while((!c._screenAtReference||!c.renderRoot.querySelector('.stage.projection-iso')||c._isoFirstFrame.pending(c._desiredProjection,!!c._isoSceneRuntime))&&performance.now()<end)await new Promise(r=>setTimeout(r,20));
  const s=c._stageEl.getBoundingClientRect(),p=c.renderRoot.querySelector('.summary-overlay').getBoundingClientRect();
  const vb=c._baseVb(),b=c._displayBase(vb),v=c._viewOr(vb),ppu=s.width/v.w;
  return c._screenAtReference&&!!c.renderRoot.querySelector('.stage.projection-iso')
    &&Math.abs(ppu/(Math.min(s.width/b.w,(p.top-s.top)/b.h)*c._externalScreen.zoom)-1)<.0001
    &&Math.abs((b.x+b.w/2-v.x)*ppu-s.width/2)<1
    &&Math.abs((b.y+b.h/2-v.y)*ppu-(p.top-s.top)/2)<1;
});
checkAll(out); await finish(browser,out);
