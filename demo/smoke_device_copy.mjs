// #935: native editor context menu, real persisted wire pair and cold reader.
import { launch, check, checkAll, finish } from './serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const { page, browser } = await launch({ width: 1440, height: 1000 });
page.on('pageerror',error=>console.error('copy-page-error',error.message));
let card = page.locator('houseplan-card');
await page.evaluate(async () => {
  const c = window.__card;
  await window.__hpTest.waitForWrites();
  const devices = [...c._devices];
  window.__copyAuto = devices.find(d => d.space === c._space && d.primary?.startsWith('light.'));
  const auto = window.__copyAuto;
  if (!auto) throw new Error('copy fixture needs an actual HA light');
  await window.__hpTest.setServerConfig(cfg => {
    cfg.markers = devices.filter(d => d.id !== auto.id).map(d => ({ ...d.marker, id: d.id,
      binding: d.marker?.binding || `${d.bindingKind}:${d.bindingRef}`, hidden: true }));
    cfg.markers.push({ id: 'v_source', binding: 'virtual', space: c._space, name: 'Copy lamp 4',
      room_id: cfg.spaces.find(s => s.id === c._space).rooms[0].id,
      is_light: true, tap_action: 'toggle', icon: 'mdi:desk-lamp', controls: [auto.primary],
      description: 'Independent original', glow_color: { c: '#123456', bri: .5 } },
    { id: 'v_controller', binding: 'virtual', space: c._space, name: 'Controller', controls: ['marker:v_source', auto.primary] },
    { id: 'v_led', binding: 'virtual', space: c._space, name: 'Strip', is_light: true, icon: 'mdi:led-strip-variant' },
    { id: 'v_taken', binding: 'virtual', space: c._space, name: 'Copy lamp 2', hidden: true });
    cfg.spaces.find(s => s.id === c._space).led_strips = [{ id: 'copy-led', marker: 'v_led', points: [[.25,.65],[.55,.65]] }];
    return cfg;
  });
  await window.__hpTest.setLayout(layout => ({ ...layout,
    v_source: { s: c._space, x: .3, y: .35 }, v_controller: { s: c._space, x: .7, y: .35 },
    [auto.id]: { s: c._space, x: .5, y: .35 } }));
  await window.__hpTest.setMode('devices');
  window.__copyWrites = [];
  const original = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async message => {
    if (message.type === 'houseplan/marker/copy') {
      window.__copyWrites.push(structuredClone(message));
      const fault = window.__copyFault; window.__copyFault = null;
      if (fault === 'reject') throw Object.assign(new Error('copy rejected'), { code: 'conflict' });
      if (fault === 'hold') await new Promise(resolve => { window.__copyRelease = resolve; });
      const reply = await original(message);
      if (fault === 'lost') throw new Error('reply lost after acceptance');
      return reply;
    }
    const reply=await original(message);
    return message.type==='houseplan/config/get'?{...reply,can_write:window.__copyWriter!==false}:reply;
  } };
});
const settled = () => page.waitForFunction(() => !window.__card._devicePositionBusy
  && !window.__card._modeTransitionBusy && !window.__card._modeTransitionPreparing);
await settled();
await card.locator('[data-hp="zoom-fit"]').click();
const snapshot = () => page.evaluate(async () => {
  const c = window.__card, cfg = await c.hass.callWS({ type: 'houseplan/config/get' });
  const layout = await c.hass.callWS({ type: 'houseplan/layout/get' });
  return { cfg: cfg.config, layout: layout.layout, cr: cfg.rev, lr: layout.rev,
    writes: window.__copyWrites.length, services: window.__serviceCalls.length, toast: c._toast };
});
const open = async id => {
  const target=card.locator(`[data-hp="device"][data-id="${id}"]`);
  if(await target.evaluate(el=>el.tagName.toLowerCase()==='path')) {
    // SVG horizontal strokes have zero DOM bbox height but are painted/hittable.
    const point=await target.evaluate(el=>{const p=el.getPointAtLength(el.getTotalLength()/2);
      const s=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return{x:s.x,y:s.y};});
    await page.mouse.click(point.x,point.y,{button:'right'});
  } else await target.click({ button: 'right' });
  try { await card.locator('[data-hp="device-context-menu"]').waitFor({ state: 'visible', timeout: 5000 }); }
  catch(error) {
    console.log('copy-menu-diagnostic',await page.evaluate(id=>{
      const c=window.__card;return {id,mode:c._mode,load:c._loadOk,norm:c._norm,canEdit:c._canEdit,kiosk:c._kiosk,
        busy:c._devicePositionBusy,drag:!!c._deviceDrag,device:c._devices.find(d=>d.id===id),menu:c._editorRuntime?.deviceCopy?.menu};
    },id));throw error;
  }
};
const copy = async id => { await open(id); await card.locator('[data-hp="device-copy"]').click(); await settled(); };
const before = await snapshot();
await open('v_source');
check('one-menu-item', await card.locator('[role="menuitem"]').count(), 1);
check('copy-label', await card.locator('[data-hp="device-copy"]').innerText(), 'Copy device');
check('menu-inside-viewport', await card.locator('[data-hp="device-context-menu"]').evaluate(el => {
  const r = el.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
}), true);
await page.keyboard.press('Escape');
check('escape-closes-without-creating', await card.locator('[data-hp="device-context-menu"]').count(), 0);
check('escape-restores-device-focus', await card.locator('[data-hp="device"][data-id="v_source"]').evaluate(el => el.getRootNode().activeElement === el), true);
await open('v_source'); await card.locator('[data-hp="zoom-fit"]').click();
check('outside-closes-menu', await card.locator('[data-hp="device-context-menu"]').count(), 0);
await copy('v_source');
const first = await snapshot(), newMarker = first.cfg.markers.find(m => !before.cfg.markers.some(old => old.id === m.id));
if (!newMarker) throw new Error(`copy command created nothing: ${JSON.stringify({writes:first.writes,toast:first.toast,cr:first.cr,lr:first.lr})}`);
checkAll({ oneVirtualCopy: !!newMarker && newMarker.binding === 'virtual' && first.cfg.markers.length === before.cfg.markers.length + 1,
  firstHoleNotNext: newMarker?.name === 'Copy lamp 3', incomingAppended: first.cfg.markers.find(m=>m.id==='v_controller').controls.join('|') === [...before.cfg.markers.find(m=>m.id==='v_controller').controls,`marker:${newMarker?.id}`].join('|'),
  outgoingKept: JSON.stringify(newMarker?.controls) === JSON.stringify(before.cfg.markers.find(m=>m.id==='v_source').controls),
  originalUnchanged: JSON.stringify(first.cfg.markers.find(m=>m.id==='v_source'))===JSON.stringify(before.cfg.markers.find(m=>m.id==='v_source')),
  originalPositionUnchanged: JSON.stringify(first.layout.v_source)===JSON.stringify(before.layout.v_source),
  oneWrite: first.writes===before.writes+1, noServiceFromMenuOrCopy:first.services===before.services,
  copiedRoom:newMarker?.room_id===before.cfg.markers.find(m=>m.id==='v_source').room_id });
await copy(newMarker.id);
check('copy-numbered-source-reuses-same-series', (await snapshot()).cfg.markers.at(-1).name, 'Copy lamp 5');

const auto = await page.evaluate(() => ({ id: window.__copyAuto.id, icon: window.__copyAuto.icon, name: window.__copyAuto.name }));
await copy(auto.id);
const autoCopy = (await snapshot()).cfg.markers.at(-1);
checkAll({ autoSourceHadNoMarker:!before.cfg.markers.some(m=>m.id===auto.id), autoCopyVirtual:autoCopy.binding==='virtual',
  autoIconPinned:autoCopy.icon===auto.icon, autoRoleAlways:autoCopy.is_light===true,
  ownSelectorsAbsent:!('light_entity' in autoCopy)&&!('toggle_entity' in autoCopy), manualBrightness:typeof autoCopy.glow_color?.bri==='number' });

const ledBefore = await snapshot(); await copy('v_led'); const ledAfter = await snapshot();
const ledCopy = ledAfter.cfg.markers.at(-1);
checkAll({ ledGeometryUnchanged:JSON.stringify(ledBefore.cfg.spaces)===JSON.stringify(ledAfter.cfg.spaces),
  ledCopyOrdinaryIcon:await card.locator(`.dev[data-hp="device"][data-id="${ledCopy.id}"]`).count()===1,
  ledOriginalStillStrip:await card.locator('.led-select-hit[data-id="v_led"]').count()===1,
  ledCopyNearVisibleAnchor:Math.hypot(ledAfter.layout[ledCopy.id].x-.4,ledAfter.layout[ledCopy.id].y-.65)<.2 });

// Stale menu, current permission and a real rejected transport all preserve the pair.
await open('v_source');
await page.evaluate(async()=>{await window.__hpTest.setServerConfig(cfg=>({...cfg,settings:{...cfg.settings,copy_fixture:1}}));});
const staleBefore = await snapshot(); await card.locator('[data-hp="device-copy"]').click(); await settled();
check('stale-config-menu-no-write',(await snapshot()).writes,staleBefore.writes);
await open('v_source');
await page.evaluate(async()=>{window.__copyWriter=false;await window.__hpTest.setServerConfig(cfg=>cfg);});
await card.locator('[data-hp="device-context-menu"]').waitFor({state:'detached'});
check('permission-loss-closes-menu-no-write',(await snapshot()).writes,staleBefore.writes);
await page.evaluate(async()=>{window.__copyWriter=true;await window.__hpTest.setServerConfig(cfg=>cfg);await window.__hpTest.setMode('devices');});
await settled();
await page.evaluate(()=>{window.__copyFault='reject';});
const rejectedBefore=await snapshot();await copy('v_source');const rejectedAfter=await snapshot();
checkAll({ rejectedNoMarker:JSON.stringify(rejectedBefore.cfg)===JSON.stringify(rejectedAfter.cfg),
  rejectedNoPosition:JSON.stringify(rejectedBefore.layout)===JSON.stringify(rejectedAfter.layout), rejectedNoSuccess:rejectedAfter.toast!=='Copy created' });

await page.evaluate(()=>{window.__copyFault='hold';});
const heldBefore=await snapshot();await open('v_source');
await card.locator('[data-hp="device-copy"]').click();
await page.waitForFunction(()=>typeof window.__copyRelease==='function');
await card.locator('[data-hp="device"][data-id="v_source"]').click({button:'right'});
check('pending-copy-cannot-open-second-command',await card.locator('[data-hp="device-copy"]').count(),0);
await page.evaluate(()=>window.__copyRelease());await settled();
check('pending-copy-one-write',(await snapshot()).writes,heldBefore.writes+1);

await page.evaluate(()=>{window.__copyFault='lost';});
const lostBefore=await snapshot();await copy('v_source');const lostAfter=await snapshot();
checkAll({ lostReplyOneWrite:lostAfter.writes===lostBefore.writes+1, lostReplyOneMarker:lostAfter.cfg.markers.length===lostBefore.cfg.markers.length+1,
  acceptedAfterLostReply:lostAfter.toast==='Copy created', lostReplyCopyHasPosition:!!lostAfter.layout[lostAfter.cfg.markers.at(-1).id] });

await open('v_source'); await page.evaluate(()=>window.__hpTest.setMode('view'));
check('mode-change-closes-menu',await card.locator('[data-hp="device-context-menu"]').count(),0);
const viewBefore=(await snapshot()).writes;
await card.locator('[data-hp="device"][data-id="v_source"]').click({button:'right'});
check('view-keeps-more-info-not-copy-menu',await card.locator('[data-hp="device-copy"]').count(),0);
check('view-context-no-copy-write',(await snapshot()).writes,viewBefore);
await page.keyboard.press('Escape');

// A fresh card reads the saved fixture pair, not the optimistic old card objects.
await page.evaluate(async()=>{
  const old=window.__card;await window.__hpTest.waitForWrites();
  const next=document.createElement('houseplan-card');next.setConfig({type:'custom:houseplan-card',icon_size:3.4});
  old.replaceWith(next);window.__card=next;next.hass=old.hass;
});
await page.waitForFunction(()=>window.__card._loadOk&&window.__card._devices.some(d=>d.name==='Copy lamp 3'));
await page.evaluate(()=>window.__hpTest.setMode('devices'));await settled();
check('cold-reader-retains-independent-virtual-copy',await page.evaluate(id=>{
  const c=window.__card,d=c._devices.find(d=>d.id===id);return d?.bindingKind==='virtual'&&d.name==='Copy lamp 3'&&!!c._layout[id];
},newMarker.id),true);
await card.locator(`[data-hp="device"][data-id="${newMarker.id}"]`).click();
await card.locator('#marker-name').fill('Changed copy only');
await card.locator('[data-hp="dialog-confirm"]').click();
await page.evaluate(()=>window.__hpTest.waitForWrites());
const final=await snapshot();
check('editing-copy-does-not-rename-original',final.cfg.markers.find(m=>m.id==='v_source').name,'Copy lamp 4');
check('editing-copy-persists',final.cfg.markers.find(m=>m.id===newMarker.id).name,'Changed copy only');
check('all-copy-actions-service-free',final.services,before.services);
mkdirSync('artifacts/935',{recursive:true});
writeFileSync('artifacts/935/copied-plan.json',JSON.stringify({config:final.cfg,layout:final.layout},null,2));
await finish(browser);
