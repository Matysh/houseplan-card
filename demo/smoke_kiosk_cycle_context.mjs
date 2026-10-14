// #846: real card, DOM/HA intent and real browser timers under a boundary clock.
import { launch, check, checkAll, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
const { page, browser } = await launch({width:1000,height:800});
await page.clock.install();
await page.evaluate(()=>localStorage.setItem('houseplan_card_zoom_v1',JSON.stringify({f1:1,garden:2,unrelated:3})));
await page.reload();
await page.waitForFunction(() => window.__card?._booting === false && window.__card?._devices?.length > 0);
await installHpTestOnPage(page);
await page.evaluate(async () => {
  const c=window.__card;
  c.setConfig({type:'custom:houseplan-card',kiosk:true,cycle:90,language:'en'});
  await window.__hpTest.setServerConfig(cfg => {
    cfg.spaces=cfg.spaces.map(s=>({...s,settings:{...s.settings,show_names:true}}));
    cfg.spaces.find(s=>s.id==='f1').openings=[{
      id:'cycle-door',type:'door',rx:550,ry:200,angle:90,len_cm:90,lock:'lock.front_door',
    }];
    cfg.markers=[{id:'cycle-light',binding:'device:d_light1',space:'f1',tap_action:'toggle',tap_confirm:true}];
    return cfg;
  });
  window.__cycleCalls=[];
  c.hass={...c.hass,callService:async (...args)=>{window.__cycleCalls.push({space:c._space,args});}};
});
await page.waitForFunction(()=>window.__card.shadowRoot.querySelector('[data-hp="room-label"][data-id="r1"]'));
const freeze=async()=>page.clock.pauseAt(await page.evaluate(()=>Date.now()+10));
await freeze();
// Keyboard room fit is public and immediate; its key event starts the60s pause.
await page.locator('houseplan-card [data-hp="room-label"][data-id="r1"]').press('Enter');
await page.clock.runFor(300);
check('room fit genuinely increases kiosk zoom',await page.evaluate(()=>window.__card._zoom>1.1));
const first=await page.evaluate(()=>({space:window.__card._space,until:window.__card._cyclePausedUntil,now:Date.now()}));
await page.clock.fastForward(Math.max(0,first.until-first.now-1));
check('idle does not reset early',await page.evaluate(()=>window.__card._zoom>1.1));
await page.clock.runFor(300);
checkAll(await page.evaluate((first)=>{
  const c=window.__card;
  const saved=JSON.parse(localStorage.getItem('houseplan_card_zoom_v1'));
  return { idleFitsBefore90sTick:c._zoom===1&&c._space===first.space,
    idleSavesOnlyCurrentFloor:saved.f1===1&&saved.unrelated===3 };
},first));
await page.clock.fastForward(30_000); await page.clock.runFor(300);
checkAll(await page.evaluate(()=>{
  const c=window.__card,saved=JSON.parse(localStorage.getItem('houseplan_card_zoom_v1'));
  return {arrivalIsFitAll:c._space==='garden'&&c._zoom===1,
    arrivalSavesOnlyDestination:saved.garden===1&&saved.unrelated===3};
}));
await page.clock.fastForward(90_000); await page.clock.runFor(300);
check('arrival saved zoom cannot strand next tick',await page.evaluate(()=>window.__card._space==='f1'));
const swipeBox=await page.locator('houseplan-card .stage').boundingBox();
for(const [type,dx,buttons] of [['pointerdown',0,1],['pointermove',-80,1],['pointerup',-120,0]]) {
  await page.locator('houseplan-card .stage').dispatchEvent(type,{
    pointerId:81,pointerType:'touch',isPrimary:true,button:0,buttons,
    clientX:swipeBox.x+swipeBox.width-20+dx,clientY:swipeBox.y+swipeBox.height/2,
  });
}
await page.clock.runFor(300);
check('manual swipe restores garden base saved by carousel',await page.evaluate(()=>window.__card._space==='garden'&&window.__card._zoom===1));
await page.evaluate(()=>{location.hash='#space=f1';});await page.clock.runFor(300);

// Door card owns the floor for arbitrarily many ticks, and dialog input pauses.
await page.locator('houseplan-card .oplock').click();
const held=await page.evaluate(()=>window.__card._space);
await page.clock.fastForward(300_000);
check('open local dialog holds through many missed ticks',await page.evaluate(held=>{
  const c=window.__card;return c._space===held&&!!c._openingInfo;
},held));
await page.locator('houseplan-card hp-dialog[data-kind="opening"] .lockact').focus();
await page.keyboard.press('ArrowDown');
check('dialog keyboard extends shared462 pause',await page.evaluate(()=>window.__card._cyclePausedUntil-Date.now()>=59_990));
await page.keyboard.press('Escape'); await page.clock.runFor(1);
const closed=await page.evaluate(()=>({space:window.__card._space,until:window.__card._cyclePausedUntil,now:Date.now()}));
check('closing dialog starts fresh60s',closed.until-closed.now>=59_990);
await page.clock.fastForward(59_000);
check('dialog close never catches up skipped ticks',await page.evaluate(closed=>window.__card._space===closed.space,closed));

// Public wheel input also pauses, without relying on a pointerdown beforehand.
await page.locator('houseplan-card .stage').dispatchEvent('wheel',{deltaY:-120,clientX:400,clientY:400});
await page.clock.runFor(300);
checkAll(await page.evaluate(()=>({wheelZooms:window.__card._zoom>1,
  wheelPauses:window.__card._cyclePausedUntil-Date.now()>59_000})));
// Pointer held beyond deadline blocks reset and advance; no private deadline writes.
await page.locator('houseplan-card .stage').dispatchEvent('pointerdown',{
  pointerId:73,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:440,clientY:400,
});
// Movement cancels the independent3s settings hold, but the contact stays down.
await page.locator('houseplan-card .stage').dispatchEvent('pointermove',{
  pointerId:73,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:480,clientY:400,
});
const pointer=await page.evaluate(()=>({space:window.__card._space,zoom:window.__card._zoom}));
await page.clock.fastForward(180_000);
check('down pointer holds zoom/floor beyond idle',await page.evaluate(pointer=>{
  const c=window.__card;return c._space===pointer.space&&c._zoom===pointer.zoom;
},pointer));
await page.locator('houseplan-card .stage').dispatchEvent('pointerup',{
  pointerId:73,pointerType:'touch',isPrimary:true,button:0,buttons:0,clientX:480,clientY:400,
});
await page.clock.runFor(300);
check('release services overdue idle fit',await page.evaluate(()=>window.__card._zoom===1));

// Use the ordinary surface for navigation context tests; no carousel can race setup.
await page.clock.resume();
await page.evaluate(()=>window.__card.setConfig({type:'custom:houseplan-card',language:'en'}));
await page.evaluate(async()=>{
  location.hash='#space=f1';await window.__hpTest.settled();
});
await page.locator('houseplan-card .oplock').click();
await page.evaluate(()=>{location.hash='#space=garden';});
await page.waitForFunction(()=>window.__card._space==='garden');
checkAll(await page.evaluate(()=>({spaceChangeClosesDoor:!window.__card._openingInfo,
  ordinaryCardRestoresCarouselBase:window.__card._zoom===1,
  navigationSendsNoService:window.__cycleCalls.length===0})));
await page.evaluate(()=>{location.hash='#space=f1';});
await page.waitForFunction(()=>window.__card._space==='f1');
await page.locator('houseplan-card .oplock').click();
await page.evaluate(()=>{location.hash='#space=f1';});
check('same-space navigation preserves popup',await page.evaluate(()=>!!window.__card._openingInfo));

// The old DOM button may outlive a server adoption; dispatch must re-resolve.
await page.evaluate(()=>{window.__oldCycleLock=window.__card.shadowRoot.querySelector('.lockact');});
await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>{
  cfg.spaces.find(s=>s.id==='f1').openings=[];return cfg;
}));
await page.evaluate(()=>window.__oldCycleLock.click());
checkAll(await page.evaluate(()=>({deletedDoorSendsNoService:window.__cycleCalls.length===0,
  changedTargetClosesPopup:!window.__card._openingInfo,
  changedTargetHasExplanation:window.__card.shadowRoot.querySelector('[data-hp="toast"]')?.textContent.includes('target changed')})));

// Marker confirmation is scoped by the captured floor even when target ids stay identical.
await page.locator('houseplan-card [data-hp="device"][data-id="cycle-light"]').click();
check('real marker opens toggle confirmation',await page.evaluate(()=>!!window.__card._tapConfirm));
await page.evaluate(()=>{window.__oldCycleToggleButton=window.__card.shadowRoot.querySelector(
  'hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');});
await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>{
  cfg.markers=cfg.markers.map(m=>m.id==='cycle-light'?{...m,area:'garden',space:'garden'}:m);return cfg;
}));
check('server event really moved live marker',await page.evaluate(()=>window.__card._devices.find(d=>d.id==='cycle-light')?.space==='garden'));
await page.locator('houseplan-card hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').click();
checkAll(await page.evaluate(()=>({movedMarkerSendsNoService:window.__cycleCalls.length===0,
  markerConfirmationClosed:!window.__card._tapConfirm})));

const resetContexts=async()=>{
  await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>{
    cfg.spaces.find(s=>s.id==='f1').openings=[{
      id:'cycle-door',type:'door',rx:550,ry:200,angle:90,len_cm:90,lock:'lock.front_door',
    }];
    cfg.markers=cfg.markers.map(m=>m.id==='cycle-light'
      ? {...m,area:'living_room',space:'f1',tap_action:'toggle'}:m);
    return cfg;
  }));
};
await resetContexts();
await page.locator('houseplan-card .oplock').click();
await page.locator('houseplan-card .lockact').click();
check('unlock actually asks rather than acting',await page.evaluate(()=>!!window.__card._dangerConfirm&&window.__cycleCalls.length===0));
await page.locator('houseplan-card hp-confirm [data-hp="dialog-confirm"]').click();
check('current unlock dispatches exactly once to captured floor/entity',await page.evaluate(()=>{
  const calls=window.__cycleCalls;return calls.length===1&&calls[0].space==='f1'
    && calls[0].args[0]==='lock'&&calls[0].args[1]==='unlock'
    &&calls[0].args[2].entity_id==='lock.front_door';
}));
// Same popup, new confirmation, but HA rebinds the door while it is pending.
await page.locator('houseplan-card .lockact').click();
await page.evaluate(async()=>{
  window.__addRegistryEntity('lock.other','hallway','locked','demo',{}, {friendly_name:'Other door'});
  await window.__hpTest.setServerConfig(cfg=>{
    cfg.spaces.find(s=>s.id==='f1').openings[0].lock='lock.other';return cfg;
  });
});
const rebindConfirm=page.locator('houseplan-card hp-confirm [data-hp="dialog-confirm"]');
// #894 may already dismiss a rebound popup; neither dismissal nor stale accept acts.
if(await rebindConfirm.count()) await rebindConfirm.click();
check('rebound unlock never sends the old command',await page.evaluate(()=>window.__cycleCalls.length===1));
await resetContexts();
await page.evaluate(()=>{
  const c=window.__card;
  c.hass={...c.hass,states:{...c.hass.states,'lock.front_door':{
    ...c.hass.states['lock.front_door'],state:'unlocked',
  }}};
});
await page.locator('houseplan-card .oplock').click();
await page.locator('houseplan-card .lockact').click();
check('Lock has no confirmation and sends exactly one current entity',await page.evaluate(()=>{
  const call=window.__cycleCalls.at(-1);return window.__cycleCalls.length===2&&!window.__card._dangerConfirm
    &&call.args[1]==='lock'&&call.args[2].entity_id==='lock.front_door';
}));
await page.keyboard.press('Escape');
await page.locator('houseplan-card [data-hp="device"][data-id="cycle-light"]').click();
await page.evaluate(()=>window.__oldCycleToggleButton.click());
check('retired DOM confirmation cannot accept a newer same-floor intent',await page.evaluate(()=>{
  return window.__cycleCalls.length===2&&!!window.__card._tapConfirm;
}));
await page.locator('houseplan-card hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').click();
check('current marker confirmation sends exactly one light operation',await page.evaluate(()=>{
  const call=window.__cycleCalls.at(-1);return window.__cycleCalls.length===3&&call.space==='f1'
    &&call.args[0]==='light'&&call.args[2].entity_id==='light.ceiling';
}));
// Every accepted navigation closes only the old space's informational surface.
await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>{
  cfg.markers[0].tap_action='info';return cfg;
}));
await page.locator('houseplan-card [data-hp="device"][data-id="cycle-light"]').click();
check('real informational marker opens its card',await page.evaluate(()=>!!window.__card._infoCard));
await page.evaluate(async()=>window.__hpTest.switchSpace('garden'));
check('tab navigation closes device card without services',await page.evaluate(()=>!window.__card._infoCard&&window.__cycleCalls.length===3));
await page.evaluate(async()=>window.__hpTest.switchSpace('f1'));
await resetContexts();
await page.locator('houseplan-card [data-hp="device"][data-id="cycle-light"]').click();
await page.evaluate(()=>{window.__staleCycleConfirmButton=window.__card.shadowRoot.querySelector(
  'hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]');});
await page.evaluate(()=>{location.hash='#space=garden';});
await page.waitForFunction(()=>window.__card._space==='garden');
await page.evaluate(()=>window.__staleCycleConfirmButton.click());
check('hash navigation cancels pending toggle without service',await page.evaluate(()=>!window.__card._tapConfirm&&window.__cycleCalls.length===3));
await page.evaluate(()=>{location.hash='#space=f1';});
await page.waitForFunction(()=>window.__card._space==='f1');
await page.evaluate(()=>{
  const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
    'lock.front_door':{...c.hass.states['lock.front_door'],state:'locked'}}};
});
await page.locator('houseplan-card .oplock').click();
await page.locator('houseplan-card .lockact').click();
await page.evaluate(()=>{location.hash='#space=garden';});
await page.waitForFunction(()=>window.__card._space==='garden');
check('space navigation cancels both door and unlock confirmation',await page.evaluate(()=>{
  const c=window.__card;return !c._openingInfo&&!c._dangerConfirm&&window.__cycleCalls.length===3;
}));

await page.evaluate(()=>{location.hash='#space=f1';});
await page.waitForFunction(()=>window.__card._space==='f1');
const beforeRun=await page.evaluate(()=>window.__cycleCalls.length);
await page.evaluate(async()=>{
  window.__addRegistryEntity('script.cycle_test','living_room','off');
  const c=window.__card;c.hass={...c.hass,states:{...c.hass.states,
    'script.cycle_test':{entity_id:'script.cycle_test',state:'off',attributes:{friendly_name:'Run test'}}}};
  await window.__hpTest.setServerConfig(cfg=>{
    cfg.markers[0]={...cfg.markers[0],tap_action:'run',tap_target:'script.cycle_test'};return cfg;
  });
});
await page.locator('houseplan-card [data-hp="device"][data-id="cycle-light"]').click();
await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>{
  cfg.markers[0]={...cfg.markers[0],area:'garden',space:'garden'};return cfg;
}));
await page.locator('houseplan-card hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').click();
check('moved run confirmation cannot act on hidden marker',await page.evaluate(n=>window.__cycleCalls.length===n,beforeRun));
await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>{
  cfg.markers[0]={...cfg.markers[0],area:'living_room',space:'f1'};return cfg;
}));
await page.locator('houseplan-card [data-hp="device"][data-id="cycle-light"]').click();
await page.locator('houseplan-card hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').click();
check('current run confirmation dispatches exactly once',await page.evaluate(n=>{
  const call=window.__cycleCalls.at(-1);return window.__cycleCalls.length===n+1
    &&call.space==='f1'&&call.args[0]==='script'&&call.args[1]==='turn_on'
    &&call.args[2].entity_id==='script.cycle_test';
},beforeRun));

// Native lifecycle: an unmounted instance cannot move the floor or camera.
await page.evaluate(()=>window.__card.setConfig({type:'custom:houseplan-card',kiosk:true,cycle:90}));
await freeze();
await page.locator('houseplan-card .stage').dispatchEvent('wheel',{deltaY:-120,clientX:400,clientY:400});
await page.clock.runFor(300);
const detached=await page.evaluate(()=>{
  const c=window.__card;const before={space:c._space,zoom:c._zoom};c.remove();return before;
});
await page.clock.fastForward(180_000);
check('disconnected instance neither resets nor cycles',await page.evaluate(before=>{
  const c=window.__card;return c._space===before.space&&c._zoom===before.zoom;
},detached));
await page.evaluate(()=>document.getElementById('host').append(window.__card));
await page.clock.runFor(300);
await page.clock.fastForward(90_000);await page.clock.runFor(300);
check('reconnected instance cycles again',await page.evaluate(before=>window.__card._space!==before.space,detached));
await page.evaluate(()=>window.__card.setConfig({type:'custom:houseplan-card',kiosk:true,cycle:0}));
await page.locator('houseplan-card .stage').dispatchEvent('wheel',{deltaY:-120,clientX:400,clientY:400});
await page.clock.runFor(300);
const disabled=await page.evaluate(()=>({space:window.__card._space,zoom:window.__card._zoom}));
await page.clock.fastForward(180_000);
check('cycle0 cancels both carousel and idle reset',await page.evaluate(before=>{
  const c=window.__card;return c._space===before.space&&c._zoom===before.zoom&&c._zoom>1;
},disabled));
for(const options of [{}, {kiosk:true,cycle:90,floor:'f1'}]) {
  await page.evaluate(options=>window.__card.setConfig({type:'custom:houseplan-card',...options}),options);
  await page.clock.runFor(300);
  await page.locator('houseplan-card .stage').dispatchEvent('wheel',{deltaY:-120,clientX:400,clientY:400});
  await page.clock.runFor(300);
  const before=await page.evaluate(()=>({space:window.__card._space,zoom:window.__card._zoom}));
  await page.clock.fastForward(180_000);
  check(options.kiosk?'fixed floor has no idle reset':'ordinary card has no idle reset',
    await page.evaluate(before=>{const c=window.__card;return c._space===before.space&&c._zoom===before.zoom;},before));
}
await page.clock.resume();
await page.evaluate(()=>window.__card.setConfig({type:'custom:houseplan-card',kiosk:true,cycle:90}));
await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>{
  cfg.spaces=cfg.spaces.filter(s=>s.id==='f1');return cfg;
}));
await freeze();
await page.locator('houseplan-card .stage').dispatchEvent('wheel',{deltaY:-120,clientX:400,clientY:400});
await page.clock.runFor(300);
const single=await page.evaluate(()=>({space:window.__card._space,zoom:window.__card._zoom}));
await page.clock.fastForward(180_000);
check('one-space kiosk has no idle reset',await page.evaluate(before=>{
  const c=window.__card;return c._space===before.space&&c._zoom===before.zoom;
},single));
await finish(browser);
