// #1093: genuine rendered non-marker consumers of hidden HA sources.
import assert from 'node:assert/strict';

export async function runConsumerDemandWitnesses({page,card}) {
  const results={};
  const tick=()=>page.evaluate(async()=>{await window.__card.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  const work=()=>page.evaluate(()=>{const c=window.__card;return {snapshot:c._liveRt.work(),floor:{...c._floorCacheBuilds},contacts:{...c._deviceContacts.work},models:c._spaceModels.work.builds};});
  const row=async(entity,state)=>{await page.evaluate(({entity,state})=>{const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,[entity]:{...c.hass.states[entity],state}}};},{entity,state});await tick();};
  const noPhysics=(a,b)=>{for(const key of ['wallUnion','physicalBodies','cleanFloor','openingWallIndex'])assert.equal(b.floor[key],a.floor[key],key);assert.equal(b.contacts.rebuilds,a.contacts.rebuilds);assert.equal(b.models,a.models);};
  await page.evaluate(async()=>{
    const c=window.__card;
    window.__consumer1093={hass:c.hass,config:structuredClone(c._serverCfg),layout:structuredClone(c._layout),mode:c._mode,space:c._space?.id||'f1',timing:window.__save1093};
    window.__save1093=undefined;
    await window.__hpTest.setMode('view');await window.__hpTest.switchSpace('f1');
    const entity='sensor.load_1497',previous=c.hass.states[entity];
    c.hass={...c.hass,states:{...c.hass.states,[entity]:{...previous,state:'25',attributes:{...previous.attributes,device_class:'temperature',unit_of_measurement:'°C'}}}};
    await window.__hpTest.setServerConfig(cfg=>{
      const floor=cfg.spaces.find(s=>s.id==='f1'),room=floor.rooms.find(r=>r.id==='f1-r0');room.area=null;room.settings={...room.settings,temp_source:undefined};
      floor.settings={...floor.settings,show_names:true,label_temp:true,fill_mode:'none',hide_decor:true};
      cfg.markers.push({id:'consumer-hidden-1093',binding:`entity:${entity}`,space:'f1',room_id:room.id,area:null,hidden:true,icon:'mdi:thermometer'});
      floor.decor=[...(floor.decor||[]),{id:'consumer-caption-1093',kind:'text',x:.3,y:.3,text:'Latest {sensor.load_1496}',color:'#112233'}];
      return cfg;
    });
  });await tick();
  try {
    const label=card.locator('[data-hp="room-label"][data-id="f1-r0"]');
    assert.match(await label.textContent(),/25/,'automatic metric consumes hidden explicitly placed sensor without HA Area');
    assert.equal(await card.locator('[data-hp="device"][data-id="consumer-hidden-1093"]').count(),0);
    let before=await work();await row('sensor.load_1497','29');let after=await work();
    assert.match(await label.textContent(),/29/,'visible room metric updates from the hidden source');noPhysics(before,after);
    assert.equal(after.snapshot.presentations,before.snapshot.presentations,'room metric update paints no hidden marker face');
    results.hiddenRoomMetric={before,after,text:await label.textContent()};
    const caption=card.locator('.decorlayer text.dtext[data-id="consumer-caption-1093"]');
    assert.equal(await caption.count(),0,'hidden decor has no rendered text consumer');
    before=await work();await row('sensor.load_1496','983');after=await work();noPhysics(before,after);
    assert.deepEqual(after.snapshot,before.snapshot,'hidden decor-only source starts no snapshot work');
    await card.locator('.modetab[data-mode="decor"]').click();await tick();
    await caption.waitFor({state:'visible'});
    assert.match(await caption.textContent(),/983/,'native decor reveal uses the latest HA value');
    results.hiddenDecorLatest={before,after,text:await caption.textContent()};
    return results;
  } catch(error){error.consumerWitnesses=results;error.consumerDiagnostics=await page.evaluate(()=>{const c=window.__card;return {labels:[...c.renderRoot.querySelectorAll('[data-hp="room-label"]')].slice(0,2).map(x=>x.textContent),mode:c._mode,devices:c._devices.filter(d=>d.id==='consumer-hidden-1093'),work:c._liveRt.work()};});throw error;}
  finally {
    await page.evaluate(async()=>{const c=window.__card,initial=window.__consumer1093;await window.__hpTest.setMode('view');c.hass=initial.hass;await window.__hpTest.setServerConfig(initial.config);await window.__hpTest.setLayout(initial.layout);await window.__hpTest.switchSpace(initial.space);await window.__hpTest.setMode(initial.mode);window.__save1093=initial.timing;delete window.__consumer1093;});await tick();
  }
}