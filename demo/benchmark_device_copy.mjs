// Bounded same-fixture Copy profile; --root points at a separately built baseline.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
const root=resolve(process.argv.find(arg=>arg.startsWith('--root='))?.slice(7)||'.');
const output=resolve(process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)||'artifacts/1073/copy-profile-matrix.json');
const {launch,requirePinnedBrowser}=await import(pathToFileURL(resolve(root,'demo/serve.mjs')));
requirePinnedBrowser();
const results=[];
// Exactly eight independent cases, no retry-until-green or live network data.
for(const count of [2,200])for(const attachment of [false,true])for(const delay of [0,120]){
  const {page,browser}=await launch({width:1440,height:1000},1,[],{},undefined,undefined,'/demo.html?device-history=1');
  try{
    await page.evaluate(async({count,attachment,delay})=>{
      const c=window.__card,hidden=c._devices.map(d=>({...d.marker,id:d.id,binding:d.marker?.binding||`${d.bindingKind}:${d.bindingRef}`,hidden:true}));
      const markers=Array.from({length:count},(_,i)=>({id:i?'v_fixture_'+i:'v_source',binding:'virtual',space:'f1',
        name:'Profile lamp '+i,icon:'mdi:lamp',is_light:true,...(i?{hidden:true}:{}),
        ...(i===0&&attachment?{pdfs:[{name:'Manual',url:'/api/houseplan/content/files/v_source/manual.pdf'}]}:{})}));
      await window.__hpTest.setServerConfig(cfg=>({...cfg,markers:[...markers,...hidden],spaces:cfg.spaces.map(space=>space.id!=='f1'?space:{...space,
        ...(count===200?{rooms:Array.from({length:60},(_,i)=>{const x=(i%10)/10,y=Math.floor(i/10)/6;return{id:'profile_room_'+i,name:'Room '+i,
          poly:[[x,y],[x+.1,y],[x+.1,y+1/6],[x,y+1/6]]};})}:{}),
      })}));
      await window.__hpTest.setLayout(layout=>({...layout,v_source:{s:'f1',x:.3,y:.35}}));
      await window.__hpTest.setMode('devices');
      window.__profile={};
      c.addEventListener('click',event=>{
        if(event.composedPath().some(node=>node?.getAttribute?.('data-hp')==='device-copy'))window.__profile.click=performance.now();
      },true);
      const original=c.hass.callWS;
      c.hass={...c.hass,callWS:async request=>{
        if(request.type==='houseplan/files/migrate'){
          window.__profile.migrations=(window.__profile.migrations||0)+1;
          window.__profile.filesStart=performance.now();
          const result={mapping:{'manual.pdf':'manual.pdf'}};window.__profile.filesEnd=performance.now();return result;
        }
        if(request.type==='houseplan/marker/copy'){
          window.__profile.request=performance.now();
          if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
          const response=await original(request);window.__profile.response=performance.now();return response;
        }
        return original(request);
      }};
    },{count,attachment,delay});
    const card=page.locator('houseplan-card');await card.locator('[data-hp="zoom-fit"]').click();
    await page.waitForFunction(()=>!window.__card._modeTransitionBusy&&!window.__card._devicePositionBusy);
    await card.locator('[data-hp="device"][data-id="v_source"]').click({button:'right'});
    await card.locator('[data-hp="device-copy"]').click();
    await page.waitForFunction(()=>!window.__card._devicePositionBusy&&window.__card._serverCfg.markers.some(m=>m.id!=='v_source'&&m.name==='Profile lamp 0 2'));
    const result=await page.evaluate(async()=>{
      const c=window.__card;await c.updateComplete;await new Promise(resolve=>requestAnimationFrame(resolve));
      const p=window.__profile,paint=performance.now();return{clickToRequest:p.request-p.click,server:p.response-p.request,responseToFrame:paint-p.response,
        total:paint-p.click,files:p.filesEnd-p.filesStart||0,migrations:p.migrations||0,phases:c._editorRuntime?.deviceCopy.lastProfile?.phases||null,
        actualMarkers:c._serverCfg.markers.length,rooms:c._curSpaceCfg.rooms.length};
    });
    results.push({markers:count,attachment,serverDelay:delay,...result});
  }finally{await browser.close();}
}
mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify({root,node:process.version,cases:results},null,2));
console.log(JSON.stringify(results));
