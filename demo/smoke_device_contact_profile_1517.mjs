/** #1517 independent native browser witness: cold basis, two full cards, profile live scale. */
import assert from 'node:assert/strict';
import {launch,checkAll,finish} from './serve.mjs';
import {contactAtWall} from '../test-build/device-contact-geometry.js';
import {makeContactBasis} from '../test-build/device-contact-basis.js';
import {mkdirSync,writeFileSync} from 'node:fs';
const {page,browser}=await launch({width:1960,height:1500},1,[],{},undefined,undefined,'/demo.html?external-screens=1');
try{
  await page.emulateMedia({reducedMotion:'reduce',colorScheme:'light'});
  await page.evaluate(async()=>{
    const c=window.__card;
    c.setConfig({...c._config,icon_size:4});
    const response=await c.hass.callWS({type:'houseplan/config/get'});
    const config=response.config;
    config.spaces=[{id:'f1',title:'Contact on a saved wall',view_box:[0,0,1,1],cell_cm:5,
      partitions:[{id:'wall-support',a:[.33,.22],b:[.33,.78],cm:12}],
      rooms:[{id:'test-room',name:'Room',poly:[[.05,.07],[.95,.07],[.95,.94],[.05,.94]]}],
      settings:{show_names:false,show_borders:true}}];
    const marker=(id,size)=>({id,binding:'virtual',name:id,icon:'mdi:wall',size,space:'f1',area:null,display:'static_icon',tap_action:'info'});
    config.markers=[marker('attached',1),marker('unrelated',1)];
    config.settings={...config.settings,volumetric_view:false,external_screens:{version:2,next_id:2,screens:[{
      id:1,space:'f1',cycle:0,idle:120,default_view:{rotation:0,zoom:1,summary:'hide',center_summary:false,icon_scale:1.25,font_scale:null},
      space_views:{}
    }]}};
    window.__profileContactConfig=config;
    window.__pushServerConfig(config);
    await window.__hpTest.setLayout({attached:{s:'f1',x:.38,y:.5},unrelated:{s:'f1',x:.76,y:.65}});
  });
  await page.waitForFunction(()=>window.__card._deviceContacts?.scene?.shapes.size===2);
  const sample=await page.evaluate(()=>{
    const scene=window.__card._deviceContacts.scene;
    return {marker:scene.shapes.get('attached').marker,walls:scene.walls};
  });
  const wallContact=sample.walls.flatMap(wall=>contactAtWall(sample.marker,wall))
    .sort((a,b)=>Math.hypot(a.x-sample.marker.x,a.y-sample.marker.y)-Math.hypot(b.x-sample.marker.x,b.y-sample.marker.y))[0];
  assert.ok(wallContact&&Math.hypot(wallContact.x-sample.marker.x,wallContact.y-sample.marker.y)<90,'fixture proves a nearby wall attachment');
  const basis=makeContactBasis({...sample.marker,x:wallContact.x,y:wallContact.y},'f1');
  const layout={attached:{...basis.at,contact_basis:basis},unrelated:{s:'f1',x:.76,y:.65}};
  await page.evaluate(layout=>window.__hpTest.setLayout(layout),layout);

  // Dispose of the measurement card. Every tested card reads the saved basis
  // on its initial load, with no drag gesture or solver state carried forward.
  await page.evaluate(()=>{
    const raw=window.__mkHass(),call=raw.callWS.bind(raw);
    window.__contactWire=call;window.__contactWrites=[];
    const hass={...raw,callWS:async message=>{
      if (/^houseplan\/(config|layout)\/(set|update|delete)$/.test(message.type))window.__contactWrites.push(message.type);
      return call(message);
    }};
    const host=document.getElementById('host');
    host.style.cssText='width:100%;padding:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px';
    const make=(label,icon_size,panelHost=false,route=null)=>{
      const card=document.createElement('houseplan-card');
      card.dataset.contactSurface=label;card.layout='panel';card.narrow=false;
      card.style.cssText='display:block;width:100%;height:580px;min-height:580px';
      card.panelHost=panelHost;
      if(route)card.routeKiosk=route;
      card.hass=hass;
      card.setConfig({type:'custom:houseplan-card',floor:'f1',icon_size});
      return card;
    };
    const main=make('main',4,true);
    const small=make('small',3);
    const large=make('large',5);
    const kiosk=make('kiosk',4,true,{enabled:true,profile:1,position:1});
    host.replaceChildren(main,small,large,kiosk);
    window.__contactSurfaces={main,small,large,kiosk};
  });
  await page.waitForFunction(()=>Object.values(window.__contactSurfaces).every(card=>card._loadOk
    && card._deviceContacts?.scene?.shapes.size===2
    && card.renderRoot.querySelector('.dev[data-id="attached"]')?.getBoundingClientRect().width>0));
  const capture=()=>page.evaluate(()=>Object.fromEntries(Object.entries(window.__contactSurfaces).map(([key,card])=>{
    const scene=card._deviceContacts.scene,shape=scene.shapes.get('attached'),unrelated=scene.shapes.get('unrelated');
    const view=card.renderRoot.querySelector('.dev[data-id="attached"]').getBoundingClientRect();
    return [key,{marker:shape.marker,walls:Object.values(shape.walls),unrelated:unrelated.marker,
      scale:card._effectiveKioskScale.icon,visiblePx:view.width,layout:structuredClone(card._layout),status:card._deviceContacts.resizeStatus}];
  })));
  const storedBefore=await page.evaluate(()=>window.__contactWire({type:'houseplan/layout/get'}));
  const before=await capture();
  const approx=(a,b)=>Math.abs(a-b)<1e-5;
  const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const out={
    coldLoadsEachUseSameWallBasis:Object.values(before).every(s=>s.walls.length===1&&exact(s.walls,before.main.walls)),
    perCardSizesChangeDiameterAndCenter:before.small.marker.diameter<before.main.marker.diameter &&
      before.large.marker.diameter>before.main.marker.diameter && !approx(before.small.marker.x,before.large.marker.x),
    coldProfileUsesActualScale:before.kiosk.scale===1.25&&approx(before.kiosk.marker.diameter/before.main.marker.diameter,1.25),
    wallRetainsLongitudinalPosition:Object.values(before).every(s=>approx(s.marker.y,before.main.marker.y)),
    peerMarkerDoesNotMove:Object.values(before).every(s=>approx(s.unrelated.x,before.main.unrelated.x)&&approx(s.unrelated.y,before.main.unrelated.y)),
    allMarkersRendered:Object.values(before).every(s=>s.visiblePx>0&&!s.status),
  };
  const revision=await page.evaluate(()=>{
    const config=structuredClone(window.__profileContactConfig);
    config.settings.external_screens.screens[0].default_view.icon_scale=.75;
    return window.__pushServerConfig(config);
  });
  await page.waitForFunction(rev=>window.__contactSurfaces.kiosk._cfgRev>=rev
    && window.__contactSurfaces.kiosk._effectiveKioskScale.icon===.75,revision);
  await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  const after=await capture();
  const storedAfter=await page.evaluate(()=>window.__contactWire({type:'houseplan/layout/get'}));
  out.liveProfileReflowsOnlyKiosk=approx(after.kiosk.marker.diameter/before.main.marker.diameter,.75)
    && !approx(before.kiosk.marker.x,after.kiosk.marker.x) && approx(before.kiosk.marker.y,after.kiosk.marker.y)
    && exact(after.kiosk.walls,before.kiosk.walls) && ['main','small','large'].every(k=>exact(before[k].marker,after[k].marker));
  out.profileDoesNotWriteLayout=exact(storedBefore,storedAfter)&&Object.keys(after).every(k=>exact(before[k].layout,after[k].layout));
  out.noConfigOrLayoutWrites=await page.evaluate(()=>window.__contactWrites.length===0);
  mkdirSync('artifacts/1517',{recursive:true});
  writeFileSync('artifacts/1517/profile-contact-witness.json',JSON.stringify({out,before,after,storedBefore,storedAfter},null,2)+'\n');
  checkAll(out);await finish(browser,out);
}catch(error){await browser.close();throw error;}
