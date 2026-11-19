import { launch, requirePinnedBrowser } from '../serve.mjs';
import { makeIsoPaintFixture } from '../fixtures/iso-paint.mjs';
import { currentGraphFixture } from './graph-fixture.mjs';
import { join } from 'node:path';

export async function startIsoPaintScene({width=1480,height=1080,referenceRoot,browserArgs=[],createPage}={}) {
  requirePinnedBrowser('#1470 paired paint/raster evidence');
  const fixture=makeIsoPaintFixture();fixture.config=currentGraphFixture(fixture.config);
  const args=[{width,height},1,browserArgs,{reducedMotion:'reduce',createPage}];
  if(referenceRoot)args.push(join(referenceRoot,'demo/srv'),referenceRoot);
  const env=await launch(...args);
  try {
    await env.page.evaluate(async fixture=>{
      history.replaceState(null,'','#space='+fixture.config.spaces[0].id);
      const host=document.getElementById('host');
      Object.assign(host.style,{width:'100%',height:'calc(100vh - 60px)',maxWidth:'none'});
      const card=document.createElement('houseplan-card');
      card.setConfig({type:'custom:houseplan-card',icon_size:2.5});
      const connection={subscribeEvents:async()=>()=>{},subscribeMessage:async()=>()=>{}};
      window.__isoPaintCalls=[];window.__isoPaintWrites=[];
      const readTypes=new Set(['houseplan/config/get','houseplan/layout/get','houseplan/trail/get',
        'config/device_registry/list','config/entity_registry/list','config_entries/get','manifest/list']);
      card.hass={language:'en',locale:{language:'en'},user:{id:'synthetic',is_admin:true},
        devices:fixture.devices,entities:fixture.entities,areas:fixture.areas,floors:{},states:fixture.states,
        connection,localize:()=>null,formatEntityState:state=>state.state,
        config:{unit_system:{length:'km'}},
        callService:async()=>{window.__isoPaintWrites.push('service');throw Error('No device control is permitted in the paint fixture');},
        callWS:async message=>{
          window.__isoPaintCalls.push(message.type);
          if(!readTypes.has(message.type)){
            window.__isoPaintWrites.push(message.type);
            throw Error('Unexpected mutating or unsupported WS call: '+message.type);
          }
          if(message.type==='houseplan/config/get')return{config:structuredClone(fixture.config),rev:1,can_write:true,
            device_contact_api:1,plan_graph_api:1};
          if(message.type==='houseplan/layout/get')return{layout:structuredClone(fixture.layout),rev:1};
          if(message.type==='config/device_registry/list')return Object.values(fixture.devices);
          if(message.type==='config/entity_registry/list')return Object.values(fixture.entities);
          return{ok:true};
        }};
      host.replaceChildren(card);window.__isoPaint=card;
      const deadline=performance.now()+20000;
      while(!card._loadOk||card._booting||!card.renderRoot.querySelector('.stage[data-hp-iso-readiness="ready"] .plan-svg')) {
        if(performance.now()>deadline)throw Error('Paint scene did not become ready');
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      await card.updateComplete;
      if(window.__isoPaintWrites.length)throw Error('Paint fixture attempted a write during startup');
    },fixture);
    await settleIsoPaint(env.page);
    env.provenance={browser:env.browser.version(),node:process.version,viewport:{width,height},dpr:1,
      pinnedBrowserAttested:true};
    return env;
  } catch(error) {await env.browser.close();throw error;}
}

export async function settleIsoPaint(page) {
  await page.evaluate(async()=>{
    const card=window.__isoPaint,deadline=performance.now()+10000;
    while(card._modeTransitionBusy||card._cameraTransition?.active||card._rotationTransition?.active||card._floorPreparation?.pending) {
      if(performance.now()>deadline)throw Error('Paint camera did not settle');
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    await card.updateComplete;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}

export async function zoomIsoPaint(page,zoom=2.18) {
  await page.evaluate(async zoom=>{
    const card=window.__isoPaint,base=card._baseVb();
    card._applyView(zoom,base[0]+base[2]/2,base[1]+base[3]/2);
    card.requestUpdate();await card.updateComplete;
  },zoom);
  await settleIsoPaint(page);
}
