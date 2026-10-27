// Shared native fixture preparation for #1093 timing and correctness.
export async function installSelectiveInvalidationFixture(page,fixture) {
  await page.evaluate(async fixture=>{
    const c=window.__card,original=c.hass.callWS;
    const connection={...c.hass.connection};
    c.hass={...c.hass,connection,devices:fixture.devices,entities:fixture.entities,
      states:{...c.hass.states,...fixture.states},callWS:async message=>{
        if(message.type==='config/device_registry/list')return Object.values(fixture.devices);
        if(message.type==='config/entity_registry/list')return Object.values(fixture.entities);
        const p=window.__save1093;
        if(message.type==='houseplan/config/set'&&p?.input){
          p.request=performance.now();p.sent=structuredClone(message);
          if(p.delay)await new Promise(r=>setTimeout(r,p.delay));
          const reply=await original(message);p.ack=performance.now();return reply;
        }
        return original(message);
      }};
    await window.__hpTest.setServerConfig(()=>fixture.config);
    await window.__hpTest.setLayout(()=>fixture.layout);
    await window.__hpTest.switchSpace('f1');await window.__hpTest.setMode('devices');
    await c.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const authored=[...c._deviceContacts.scene.shapes.values()];
    // Twelve triples, inside rooms: >=30 actual contact members after safety.
    await window.__hpTest.setLayout(layout=>{
      for(let group=0;group<Math.min(12,Math.floor(authored.length/3));group++){
        let right=.05+(group%5)*.184;
        for(let j=0;j<3;j++){
          const i=group*3+j,shape=authored.find(s=>s.marker.id===`load-${i}`),box=shape.box;
          const depth=shape.marker.diameter*(13/80-.01875)/1000;
          const x=right-box.left/1000-(j?depth:0),y=.12+Math.floor(group/5)*.23-(box.top+box.bottom)/2000;
          layout[`load-${i}`]={s:'f1',x,y};right=x+box.right/1000;
        }
      }
      return layout;
    });
    await window.__hpTest.setMode('view');
    await c.updateComplete;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    window.__long1093=[];
    new PerformanceObserver(list=>window.__long1093.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))))
      .observe({type:'longtask',buffered:false});
    c.addEventListener('pointerdown',event=>{
      if(event.isTrusted&&event.composedPath().some(n=>n?.getAttribute?.('data-hp')==='dialog-confirm')){
        const p=window.__save1093;if(p){p.input=performance.now();p.trusted=true;
          p.before={floor:{...c._floorCacheBuilds},contacts:{...c._deviceContacts.work}};
          const observe=()=>{
            if(!p.ack||c.renderRoot.querySelector('hp-dialog[data-kind="space"]')||
                c._serverCfg.spaces.find(s=>s.id==='f1')?.settings?.bg_mode!==p.expected||
                c.renderRoot.querySelector('.stage')?.classList.contains('daycycle')!==(p.expected==='daynight'))return requestAnimationFrame(observe);
            // Observe the committed frame in the browser, never after a host poll.
            p.paint=performance.now();p.persisted=true;
            p.after={floor:{...c._floorCacheBuilds},contacts:{...c._deviceContacts.work}};
          };
          requestAnimationFrame(observe);
        }
      }
    },true);
  },fixture);
  return page.evaluate(()=>{
    const c=window.__card,shapes=[...c._deviceContacts.scene.shapes.keys()];
    return {markers:c._serverCfg.markers.length,hidden:c._serverCfg.markers.filter(m=>m.hidden).length,
      visible:c.renderRoot.querySelectorAll('[data-hp="device"]').length,
      contacts:shapes.filter(id=>(c._deviceContacts.scene.component(id)||[]).length>1).length,
      contactFaces:[...new Set(shapes.filter(id=>(c._deviceContacts.scene.component(id)||[]).length>1)
        .map(id=>JSON.stringify(c._deviceContacts.scene.shapes.get(id).marker.box)))].length,
      wallPaths:c.renderRoot.querySelectorAll('[data-hp="wall"] path,[data-hp="wall"][d]').length,
      floorBuilds:{...c._floorCacheBuilds},registry:{devices:Object.keys(c.hass.devices).length,
        entities:Object.keys(c.hass.entities).length,states:Object.keys(c.hass.states).length}};
  });
}
