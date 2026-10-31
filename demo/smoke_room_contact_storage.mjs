/** #1166: unchanged public export, actual Walls clicks, room writes and history.
 * The transport is a cloned CAS wire store, not a substitute geometry validator;
 * the same produced documents are separately exercised by the real HA harness.
 */
import {readFileSync} from 'node:fs';
import {isDeepStrictEqual as equal} from 'node:util';
import {launch,check,finish} from './serve.mjs';

const exported=JSON.parse(readFileSync(new URL('../test/fixtures/1166-two-contours.json',import.meta.url),'utf8'));
const source={...exported.payload.config,model_version:exported.model_version};
const results={};
let lastBrowser;
const geometry=config=>config.spaces.map(s=>({id:s.id,rooms:s.rooms||[],wall_segments:s.wall_segments||[],
  partitions:s.partitions||[],openings:s.openings||[]}));
async function snapshot(page){return page.evaluate(async()=>{
  const s=window.__roomContact;
  const response=await window.__card.hass.callWS({type:'houseplan/config/get'});
  return {config:structuredClone(window.__card._serverCfg),saved:response.config,
    writes:s.writes,attempts:s.attempts,history:window.__card._geometryHistory.size};
});}
async function settle(page,refused=false){
  await page.waitForFunction(()=>!window.__card._saveConfigDebounced.pending()&&window.__card._writesPending===0);
  await page.evaluate(async refused=>{
    try{await window.__hpTest.waitForWrites();}
    catch(error){if(!refused||!error.message.includes('controlled refusal'))throw error;}
    await window.__hpTest.settled();
  },refused);
}
async function clickPoint(page,point){
  const p=await page.evaluate(([x,y])=>{
    const c=window.__card,r=c.renderRoot.querySelector('.stage').getBoundingClientRect(),v=c._view;
    return {x:r.left+(x-v.x)/v.w*r.width,y:r.top+(y-v.y)/v.h*r.height};
  },point);
  await page.mouse.click(p.x,p.y);
  await page.locator('[data-hp="dialog"][data-kind="room"]').waitFor({state:'visible'});
}
async function confirm(page,name){
  const dialog=page.locator('[data-hp="dialog"][data-kind="room"]');
  await dialog.locator('#room-name').fill(name);
  await dialog.locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
}
async function history(page,action){
  await page.locator('[data-hp="toolbar"][data-kind="plan"] button')
    .filter({has:page.locator(`ha-icon[icon="mdi:${action}-variant"]`)}).click();
  await settle(page);
}

for(const optimize of [false,true])for(const reverse of [false,true]){
  const name=`${optimize?'optimized':'direct'}-${reverse?'reverse':'forward'}`;
  const {page,browser}=await launch({width:1280,height:960});lastBrowser=browser;
  page.setDefaultTimeout(10000);
  try{
    await page.evaluate(async config=>{
      await window.__hpTest.setServerConfig(config);await window.__hpTest.setLayout({});
      const c=window.__card,fallback=c.hass.callWS.bind(c.hass);
      const s={saved:structuredClone(c._serverCfg),writes:0,attempts:0,reads:0,reject:false,held:false,release:null};
      window.__roomContact=s;
      c.hass={...c.hass,callWS:async m=>{
        if(m.type==='houseplan/config/get')s.reads++;
        if(m.type==='houseplan/plan/optimize'){
          s.attempts++;
          const cfg=await fallback({type:'houseplan/config/get'}),layout=await fallback({type:'houseplan/layout/get'});
          if(m.expected_config_rev!==cfg.rev||m.expected_layout_rev!==layout.rev)
            throw Object.assign(new Error('conflict'),{code:'conflict'});
          const config_rev=window.__pushServerConfig(m.config),layout_rev=window.__pushServerLayout(m.layout);
          s.saved=structuredClone(m.config);s.writes++;return {ok:true,config_rev,layout_rev,can_undo:true};
        }
        if(m.type==='houseplan/config/set'){
          s.attempts++;
          if(s.held)await new Promise(resolve=>s.release=resolve);
          if(s.reject)throw Object.assign(new Error('controlled refusal'),{code:'invalid_format'});
          const result=await fallback(m);s.saved=structuredClone(m.config);s.writes++;return result;
        }
        return fallback(m);
      }};
      await c._loadFromServer();await window.__hpTest.switchSpace(config.spaces[0].id);
      await window.__hpTest.setMode('plan');await window.__hpTest.setTool('draw');
      await new Promise(resolve=>setTimeout(resolve,500));await window.__hpTest.settled();
    },source);
    await settle(page);
    if(optimize){
      await page.locator('[data-hp="settings"]').click();
      const settings=page.locator('hp-dialog[data-kind="settings"][icon="mdi:cog-outline"]');
      await settings.locator('[data-section-target="data"]').click();
      const beforePreview=await snapshot(page);
      await settings.getByRole('button',{name:await page.evaluate(()=>window.__card._t('gs.align_all')),exact:true}).click();
      const dialog=page.locator('hp-dialog[data-kind="settings"][icon="mdi:broom"]');
      await dialog.waitFor();
      check(`${name}: preview does not write`,(await snapshot(page)).writes===beforePreview.writes);
      await dialog.locator('[data-hp="dialog-confirm"]').click();await settle(page);
      check(`${name}: Optimize has one acknowledged write`,(await snapshot(page)).writes===beforePreview.writes+1);
      // Close the retained parent through its ordinary Cancel control.
      if(await settings.count())await settings.locator('.btn[data-hp="dialog-cancel"]').click();
    }
    const baseline=await snapshot(page),points=[[350,400],[-200,1240]];
    if(reverse)points.reverse();
    for(const [index,point]of points.entries()){
      await clickPoint(page,point);
      if(!optimize&&!reverse){
        await page.evaluate(()=>window.__roomContact.held=true);
        await confirm(page,`Room ${index}`);
        await page.waitForFunction(()=>typeof window.__roomContact.release==='function');
        check(`${name}: held ACK ${index} has no durable room`,(await snapshot(page)).saved.spaces[0].rooms.length===index);
        if(index===0){
          await page.evaluate(()=>{const s=window.__roomContact;s.reject=true;s.held=false;s.release();s.release=null;});
          await settle(page,true);const refused=await snapshot(page);
          check(`${name}: refused ACK rolls geometry and history back`,equal(geometry(refused.config),geometry(baseline.config))
            && refused.history===baseline.history&&refused.writes===baseline.writes);
          await page.evaluate(()=>window.__roomContact.reject=false);
          await clickPoint(page,point);await confirm(page,`Room ${index}`);
        }else await page.evaluate(()=>{const s=window.__roomContact;s.held=false;s.release();s.release=null;});
      }else await confirm(page,`Room ${index}`);
      await settle(page);
      const state=await snapshot(page);
      check(`${name}: room ${index+1} is durably saved`,state.saved.spaces[0].rooms.length===index+1
        && state.writes===baseline.writes+index+1&&equal(geometry(state.saved),geometry(state.config)));
    }
    const completed=await snapshot(page);
    await history(page,'undo');check(`${name}: Undo removes just the last room`,(await snapshot(page)).saved.spaces[0].rooms.length===1);
    await history(page,'redo');check(`${name}: Redo restores exact identities`,equal(geometry((await snapshot(page)).saved),geometry(completed.saved)));
    // A cold card reads the acknowledged document through ordinary config/get.
    await page.evaluate(()=>{
      const old=window.__card,next=document.createElement('houseplan-card');
      next.setConfig({type:'custom:houseplan-card'});
      // A distinct client connection owns a cold read of the coherent fixture.
      next.hass={...old.hass,connection:{...old.hass.connection}};
      old.replaceWith(next);window.__card=next;
    });
    try{await page.waitForFunction(()=>window.__card._serverCfg?.spaces?.[0]?.rooms?.length===2);}
    catch(error){
      console.error(name,await page.evaluate(()=>({reads:window.__roomContact.reads,
        savedRooms:window.__roomContact.saved.spaces[0].rooms.length,
        rooms:window.__card._serverCfg?.spaces?.map(s=>s.rooms.length),load:window.__card._loadOk,
        clientRev:window.__card._cfgRev,
        error:window.__card._loadError,connected:window.__card.isConnected,config:window.__card._config,
        text:window.__card.renderRoot?.textContent?.slice(-500)})));
      throw error;
    }
    check(`${name}: cold reload retains both rooms`,equal(geometry((await snapshot(page)).config),geometry(completed.saved)));
    results[name]=true;
  }finally{await browser.close();}
}
await finish(lastBrowser,results);
