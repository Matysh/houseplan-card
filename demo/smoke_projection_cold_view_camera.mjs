/** #1469: a real cold document with a persistent ISO floor must not claim a square camera. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launchPanelCold, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { makeVisualMatrixFixture } from './fixtures/visual-matrix.mjs';
import { assertFreshDemoBundle } from './bundle-freshness.mjs';
requirePinnedBrowser('#1469 first visible cold ISO camera');

const cases = [
  {host:'panel',width:1280,height:720,rotation:0,zoom:2.18,center:false},
  {host:'panel',width:1280,height:720,rotation:90,zoom:1.65,center:true},
  {host:'panel',width:430,height:820,rotation:180,zoom:2.18,center:false},
  {host:'panel',width:430,height:820,rotation:270,zoom:1.65,center:true},
  {host:'card',width:1180,height:920,rotation:0,zoom:1.65,center:false},
  {host:'kiosk',width:430,height:820,rotation:90,zoom:2.18,center:false},
];
for(const scenario of cases) {
  const {page,browser}=await launchPanelCold({width:scenario.width,height:scenario.height});
  try {
    const fixture=makeVisualMatrixFixture();
    // Geometry-only matrix space intentionally has no live devices. Start on
    // the representative lit/furnished space so an empty layer cannot pass.
    fixture.config.spaces.sort((a,b)=>Number(b.id==='golden-lighting')-Number(a.id==='golden-lighting'));
    fixture.config.settings={...fixture.config.settings,volumetric_view:true,center_summary:scenario.center,
      filter_seeded:true,known_devices:Object.keys(fixture.devices),new_device_ids:[]};
    const html=readFileSync(new URL('./srv/demo.html',import.meta.url),'utf8');
    await page.route(url=>url.pathname==='/houseplan',route=>route.fulfill({contentType:'text/html',body:html}));
    let delayed=0;
    await page.route(/\/(?:iso-scene-(?:geometry|render)|furniture-volume\.generated|floor-worker)-[^/]+\.js$/,async route=>{
      delayed++;await new Promise(resolve=>setTimeout(resolve,120));await route.fallback();
    });
    const mount=(restoring=false)=>page.evaluate(async({fixture,scenario,restoring})=>{
      const zoomKey='houseplan_card_zoom_v1';
      const saved=JSON.stringify(Object.fromEntries(fixture.config.spaces.map(space=>[space.id,scenario.zoom])));
      localStorage.setItem(zoomKey,saved);
      localStorage.setItem('houseplan_card_rotation_v1',JSON.stringify(
        Object.fromEntries(fixture.config.spaces.map(space=>[space.id,scenario.rotation]))));
      const url='/houseplan?panel-cold=1'+(scenario.host==='kiosk'?'&hpkiosk=1':'');
      history.replaceState(null,'',url);
      // Delay the real derived-floor response, not a replacement geometry producer:
      // the persisted passive preview must be painted before the current full scene.
      if(restoring) {
        const NativeWorker=window.Worker;
        window.Worker=class extends NativeWorker {
          postMessage(...args) {setTimeout(()=>super.postMessage(...args),650);}
        };
      }
      const wire=[],services=[];
      const hass={language:'en',locale:{language:'en'},user:{id:'cold-camera-reader',is_admin:false},
        devices:fixture.devices,entities:fixture.entities,areas:fixture.areas,states:fixture.states,
        connection:{subscribeEvents:async()=>()=>{},subscribeMessage:async()=>()=>{}},
        localize:()=>null,formatEntityState:state=>state.state,config:{unit_system:{length:'km'}},
        callService:async(...args)=>{services.push(args);},
        callWS:async message=>{
          wire.push(message.type);
          if(message.type==='houseplan/config/get') {
            if(restoring)await new Promise(resolve=>setTimeout(resolve,800));
            return{config:structuredClone(fixture.config),rev:1,can_write:false};
          }
          if(message.type==='houseplan/layout/get')return{layout:structuredClone(fixture.layout),rev:1};
          if(message.type==='config/device_registry/list')return Object.values(fixture.devices);
          if(message.type==='config/entity_registry/list')return Object.values(fixture.entities);
          if(message.type==='config_entries/get'||message.type==='manifest/list')return[];
          return{ok:true};
        }};
      const host=document.getElementById('host');host.style.cssText='width:100%;height:100vh;margin:0;padding:0';
      const hiddenStart=!restoring&&scenario.host==='panel'&&scenario.rotation===0;
      if(hiddenStart)host.style.display='none';
      let card,panel;
      if(scenario.host==='card'||scenario.host==='kiosk') {
        await import('/assets/houseplan-card.js');
        card=document.createElement('houseplan-card');card.setConfig({type:'custom:houseplan-card',rotation:scenario.rotation,
          ...(scenario.host==='kiosk'?{kiosk:true}:{})});
        host.replaceChildren(card);card.hass=hass;
      } else {
        await import('/assets/houseplan-panel.js');
        panel=document.createElement('houseplan-panel');panel.panel={component_name:'houseplan-panel'};
        panel.route={prefix:'/houseplan',path:''};panel.narrow=scenario.width<600;panel.hass=hass;host.replaceChildren(panel);
      }
      let hiddenRejected=true;
      if(hiddenStart) {
        const deadline=performance.now()+5000;
        while(performance.now()<deadline) {
          await new Promise(resolve=>requestAnimationFrame(resolve));
          card??=panel?.shadowRoot?.querySelector('houseplan-card');
          if(card?._loadOk&&card._floorPreparation&&!card._floorPreparation.pending)break;
        }
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        hiddenRejected=!!card&&card._view===null&&card._stageEl.clientWidth===0;
        host.style.removeProperty('display');
      }
      let preview=false,visible=0,maxError=0,first=null;
      const end=performance.now()+12000;
      while(performance.now()<end) {
        await new Promise(resolve=>requestAnimationFrame(resolve));
        card??=panel?.shadowRoot?.querySelector('houseplan-card');
        if(!card)continue;
        const root=card.renderRoot,stage=card._stageEl,svg=root.querySelector('.plan-svg');
        preview||=!!root.querySelector('[data-hp-floor-cache="preview"]');
        if(!stage?.clientWidth||!stage.clientHeight||card._floorPassive||card._floorPreparation?.pending
          ||card._booting||card._bootFading||card._continuity.state!=='steady'
          ||stage.getAttribute('data-hp-iso-readiness')!=='ready'||!svg)continue;
        const vb=svg.viewBox.baseVal,rect=stage.getBoundingClientRect();
        const aspectError=Math.abs(vb.height-vb.width*rect.height/rect.width)*rect.width/vb.width;
        let anchorError=0,count=0;
        const matrix=svg.getScreenCTM(),layer=root.querySelector('.devlayer')?.getBoundingClientRect();
        for(const node of root.querySelectorAll('.devlayer > [data-hp="device"][data-hp-iso-visual]')) {
          const [x,y]=node.getAttribute('data-hp-iso-visual').split(',').map(Number);
          const p=new DOMPoint(x,y).matrixTransform(matrix);
          anchorError=Math.max(anchorError,Math.abs(p.x-layer.left-parseFloat(node.style.left)*layer.width/100),
            Math.abs(p.y-layer.top-parseFloat(node.style.top)*layer.height/100));count++;
        }
        if(!count)continue;
        maxError=Math.max(maxError,aspectError,anchorError);visible++;
        first??={viewBox:[vb.x,vb.y,vb.width,vb.height],size:[rect.width,rect.height],zoom:card._zoom};
        if(visible>=8)break;
      }
      window.__coldCamera=card;
      const writes=wire.filter(type=>/^houseplan\/(?:config|layout)\/(?:set|update|patch|commit)/.test(type));
      return{visible,maxError,first,preview,hiddenRejected,persistedZoomUnchanged:localStorage.getItem(zoomKey)===saved,
        cache:structuredClone(card?._floorPreparation?.diagnostic),
        noWrites:writes.length===0&&services.length===0,hasSummaryReference:!scenario.center||!!card?._screenReference,
        actualRotation:card?._rotation,space:card?._space,
        state:visible?null:{load:card?._loadOk,mode:card?._mode,boot:card?._booting,fading:card?._bootFading,
          pending:card?._floorPreparation?.pending,passive:card?._floorPassive,continuity:card?._continuity.state,
          stage:card?._stageEl?.outerHTML.slice(0,500),model:card?._model?.length,wire:wire.slice(-12)}};
    },{fixture,scenario,restoring});
    const cold=await mount();
    assert.ok(cold.visible>0,'cold live camera never appeared: '+JSON.stringify(cold));
    await assertFreshDemoBundle(page);
    // Await the ordinary post-paint cache publication, then start a genuinely new document.
    await page.waitForFunction(()=>window.__coldCamera?._floorPreparation?.diagnostic.store.writes>0);
    await page.reload({waitUntil:'domcontentloaded'});
    const restored=await mount(true);
    const name=`${scenario.host}-${scenario.width}-${scenario.rotation}-${scenario.center?'summary':'ordinary'}`;
    const out={};
    for(const [phase,row] of [['cold',cold],['restored',restored]]) {
      out[`${name}-${phase}-first-visible-camera`]=row.visible>0&&row.maxError<=1;
      out[`${name}-${phase}-no-write`]=row.noWrites&&row.persistedZoomUnchanged;
      out[`${name}-${phase}-saved-zoom`]=Math.abs(row.first?.zoom-scenario.zoom)<.001;
      out[`${name}-${phase}-rotation`]=row.actualRotation===scenario.rotation;
      out[`${name}-${phase}-screen-reference`]=row.hasSummaryReference;
      out[`${name}-${phase}-hidden-stage-rejected`]=row.hiddenRejected;
    }
    out[`${name}-real-delayed-ISO-runtime`]=delayed>0;
    out[`${name}-cold-cache-miss`]=cold.cache.misses>0&&cold.cache.diskHits===0;
    out[`${name}-persistent-preview-to-live`]=restored.preview&&restored.cache.diskHits>0
      &&restored.cache.firstPreview>0&&restored.visible>0;
    console.log(JSON.stringify({scenario,cold,restored}));
    checkAll(out);await finish(browser,out);
  } catch(error) {await browser.close();throw error;}
}
