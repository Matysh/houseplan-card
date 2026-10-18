// #866: actual production faces, native mouse/keyboard gestures and point writer.
import { launch, check, checkAll, finish } from './serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const { page, browser } = await launch({ width: 1600, height: 1000 },1,[],{hasTouch:true});
const dir = process.env.HP_CONTACT_ARTIFACTS || 'artifacts/866/native';
mkdirSync(dir, { recursive: true });
const card = page.locator('houseplan-card');
await page.evaluate(async () => {
  const c = window.__card, space = c._space;
  const originalDevices = [...c._devices];
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.markers = [...originalDevices.map((d) => ({ ...(d.marker || {}), id: d.id,
      binding: d.marker?.binding || (d.bindingKind === 'virtual' ? 'virtual' : `${d.bindingKind}:${d.bindingRef}`), hidden: true })),
      ...['a','b','m'].map((id) => ({ id: `contact-${id}`, name: `Contact ${id}`, binding: 'virtual', space,
        display: 'static_icon', tap_action: 'info', icon: 'mdi:lightbulb-outline', angle:id==='a'?37:0, is_light: true }))];
    return cfg;
  });
  await window.__hpTest.setMode('devices');
  await window.__hpTest.setLayout((layout) => ({ ...layout,
    'contact-a': { s: space, x: .22, y: .3 }, 'contact-b': { s: space, x: .6, y: .3 },
    'contact-m': { s: space, x: .35, y: .45, future: { retained: 'yes' } },
  }));
  const d = c._deviceContacts.scene.shapes.get('contact-a').marker.diameter;
  await window.__hpTest.setLayout((layout) => ({ ...layout,
    'contact-b': { s: space, x: (220 + 1.125*d)/1000, y: .3 },
  }));
  const original = c.hass.callWS;
  window.__contactWrites = [];
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/layout/update') {
      if(window.__contactRefuseNext){window.__contactRefuseNext=false;throw new Error('contact write refused');}
      window.__contactWrites.push(structuredClone(message));
    }
    return original(message);
  } };
});
const settle = async () => {
  await page.waitForFunction(() => !window.__card._devicePositionBusy && !window.__card._modeTransitionBusy
    && !window.__card._modeTransitionPreparing);
  await page.evaluate(async () => { await window.__card.updateComplete;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); });
};
await settle();
await card.locator('[data-hp="zoom-fit"]').click(); await settle();
check('default-on', await card.locator('[data-tool="device-magnets"]').getAttribute('aria-pressed'), 'true');
const state = () => page.evaluate(() => {
  const c = window.__card, sr = c.renderRoot;
  const visible = (selector) => [...sr.querySelectorAll(selector)]
    .filter(n => n.closest('.hp-editor-only-layer')?.style.opacity !== '0');
  return { layout: structuredClone(c._layout['contact-m']), history: c._devicePositionHistory.size,
    writes: window.__contactWrites.length, guides: visible('[data-device-snap]').map(n=>n.textContent.trim()),
    components: ['a','b','m'].map(id=>sr.querySelector(`[data-id="contact-${id}"]`)?.dataset.hpDeviceComponent || null),
    contours: sr.querySelectorAll('.device-contact-contour.grouped').length,
    drag: !!c._deviceDrag, work: structuredClone(c._deviceContacts.work),
    builds: c._deviceContacts.scene?.work.builds,
  };
});
const client = (id, target = false) => page.evaluate(({ id, target }) => {
  const c = window.__card, scene = c._deviceContacts.scene, a = scene.shapes.get(id).marker;
  const point = target ? { x: a.x + a.diameter*1.125, y: a.y } : a;
  const rect = c.renderRoot.querySelector('.stage').getBoundingClientRect(), view = c._viewOr(c._baseVb());
  return { x: rect.left+(point.x-view.x)/view.w*rect.width, y: rect.top+(point.y-view.y)/view.h*rect.height,
    world: { x: point.x, y: point.y } };
}, {id,target});
const before = await state(), from = await client('contact-m'), to = await client('contact-b',true);
await page.mouse.move(from.x,from.y); await page.mouse.down();
await page.mouse.move(to.x+3,to.y,{steps:12}); await settle();
const preview = await state();
checkAll({ previewContactGuide: preview.guides.includes('Join outlines'), noWriteDuringDrag: preview.writes===before.writes,
  connectedPreview: preview.components.every(id=>id==='contact-a'), noMeasurementDuringDrag: preview.work.measurements===before.work.measurements });
check('group-has-no-duplicate-individual-frames',await page.evaluate(()=>[...window.__card.renderRoot
  .querySelectorAll('.dev[data-hp-device-contact] .device-shell-frame')].every(n=>getComputedStyle(n).opacity==='0')),true);
await page.screenshot({ path: `${dir}/join-preview.png` });
await page.keyboard.down('Alt'); await settle();
check('Alt-removes-contact-guide', (await state()).guides.length, 0);
await page.keyboard.up('Alt'); await settle();
check('Alt-release-restores-contact-guide', (await state()).guides.includes('Join outlines'), true);
await page.mouse.up(); await settle();
const dropped = await state();
writeFileSync(`${dir}/drop.json`, JSON.stringify({ before, preview, dropped, from, to },null,2));
checkAll({ onePointWrite: dropped.writes===before.writes+1, oneUndo: dropped.history===before.history+1,
  exactContactWritten: Math.abs(dropped.layout.x*1000-to.world.x)<.001 && Math.abs(dropped.layout.y*1000-to.world.y)<.001,
  futureSiblingPreserved: dropped.layout.future?.retained==='yes', noGuideAfterDrop: dropped.guides.length===0 });
await card.locator('[data-device-position-history="undo"]').click(); await settle();
const undone = await state();
check('undo-exact-before', isDeepStrictEqual(undone.layout, before.layout), true);
await card.locator('[data-device-position-history="redo"]').click(); await settle();
check('redo-exact-contact', isDeepStrictEqual((await state()).layout, dropped.layout), true);
await card.locator('[data-tool="device-magnets"]').click(); await settle();
check('disabled-magnets-do-not-dissolve-groups', (await state()).components.every(id=>id==='contact-a'), true);
await card.locator('[data-tool="device-magnets"]').click(); await settle();
const joinedFrom = await client('contact-m'), cancelBefore = await state();
await page.mouse.move(joinedFrom.x,joinedFrom.y); await page.mouse.down();
await page.mouse.move(joinedFrom.x+140,joinedFrom.y+80,{steps:8}); await settle();
check('individual-detach-preview', (await state()).components[2], null);
await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
const cancelled = await state();
checkAll({ cancelRestoresContact: cancelled.components.every(id=>id==='contact-a'), cancelNoWrite: cancelled.writes===cancelBefore.writes,
  cancelExactPosition: isDeepStrictEqual(cancelled.layout,cancelBefore.layout), cancelNoGuide: cancelled.guides.length===0,
  cancelNoHistory: cancelled.history===cancelBefore.history });
for(const terminal of ['pointercancel','lostpointercapture','blur']){
  const saved=await state(), start=await client('contact-m');
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(start.x+100,start.y+80,{steps:8});await settle();
  await page.evaluate(terminal=>{
    const c=window.__card,drag=c._deviceDrag;
    if(terminal==='blur')window.dispatchEvent(new Event('blur'));
    else if(terminal==='lostpointercapture')drag.source.releasePointerCapture(drag.pointerId);
    else drag.source.dispatchEvent(new PointerEvent('pointercancel',{pointerId:drag.pointerId,bubbles:true,composed:true}));
  },terminal);
  await page.mouse.up();await settle();const after=await state();
  checkAll({[`${terminal}:no-write`]:after.writes===saved.writes,[`${terminal}:no-history`]:after.history===saved.history,
    [`${terminal}:exact-restore`]:isDeepStrictEqual(after.layout,saved.layout),[`${terminal}:group-restored`]:after.components.every(id=>id==='contact-a'),
    [`${terminal}:guide-cleared`]:!after.guides.length&&!after.drag});
}
await page.evaluate(()=>{const c=window.__card;c.setConfig({...c._config,language:'ru'});});await settle();
{
  const start=await client('contact-m'),target=await client('contact-b',true);
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(start.x+140,start.y+60,{steps:6});
  await page.mouse.move(target.x+3,target.y,{steps:6});await settle();
  check('ru-contact-guide-visible',(await state()).guides.includes('Общая обводка'),true);
  await page.keyboard.press('Escape');await page.mouse.up();await settle();
}
await page.evaluate(()=>{const c=window.__card;c.setConfig({...c._config,language:'en'});});await settle();
{
  const saved=await state(),start=await client('contact-m');
  await page.evaluate(()=>{window.__contactRefuseNext=true;});
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  await page.mouse.move(start.x+100,start.y+70,{steps:8});await page.mouse.up();await settle();
  const after=await state();checkAll({refusedWriteNoHistory:after.history===saved.history,
    refusedWriteExactRollback:isDeepStrictEqual(after.layout,saved.layout),refusedWriteRestoresGroup:after.components.every(id=>id==='contact-a')});
}
await card.locator('[data-hp="editor-close"]').first().click(); await settle();
await page.waitForFunction(() => window.__card.renderRoot.querySelector('ha-card')?.dataset.hpMode === 'view');
// Existing stable editor chrome remains mounted, but is collapsed, inert and
// aria-hidden in View. No accessible/actionable toggle leaks from it.
check('no-magnets-in-view', await page.evaluate(() => [...window.__card.renderRoot.querySelectorAll('[data-tool="device-magnets"]')]
  .filter(n => !n.closest('[inert]') || n.closest('.editorchrome')?.getAttribute('aria-hidden') !== 'true').length), 0);
for (const id of ['contact-a','contact-b','contact-m']) {
  const p = await client(id);
  await page.mouse.click(p.x,p.y); await settle();
  const opened = await page.evaluate(() => window.__card._infoCard?.id);
  check(`painted-core-opens-own-info:${id}`, opened, id);
  await page.keyboard.press('Escape'); await settle();
  await page.touchscreen.tap(p.x,p.y); await settle();
  check(`touch-core-opens-own-info:${id}`,await page.evaluate(()=>window.__card._infoCard?.id),id);
  await page.keyboard.press('Escape');await settle();
  await card.locator(`.dev[data-id="${id}"]`).focus();await page.keyboard.press('Enter');await settle();
  check(`keyboard-opens-own-info:${id}`,await page.evaluate(()=>window.__card._infoCard?.id),id);
  await page.keyboard.press('Escape');await settle();
}
const parityBefore=await state();
await page.evaluate(()=>{
  const c=window.__card,staticCard=document.createElement('houseplan-space-card');
  staticCard.setConfig({type:'custom:houseplan-space-card',space:c._space,show_button:false,icon_size:c._config.icon_size});
  staticCard.hass=c.hass;document.getElementById('host').append(staticCard);window.__contactStatic=staticCard;
});
await page.waitForFunction(()=>window.__contactStatic?._deviceContacts?.scene?.shapes.has('contact-m'));
checkAll(await page.evaluate(()=>{
  const full=window.__card._deviceContacts.scene,card=window.__contactStatic,scene=card._deviceContacts.scene;
  return{staticSameComponents:scene.component('contact-a').join(',')===full.component('contact-a').join(','),
    staticExactGeometry:['contact-a','contact-b','contact-m'].every(id=>JSON.stringify(scene.shapes.get(id))===JSON.stringify(full.shapes.get(id))),
    staticContactHitStaysPassive:[...card.renderRoot.querySelectorAll('.device-contact-hit')].every(n=>getComputedStyle(n).pointerEvents==='none')};
}));
await page.evaluate(async()=>{await window.__hpTest.setServerConfig(cfg=>{cfg.settings={...cfg.settings,volumetric_view:true};return cfg;});});
await page.waitForFunction(()=>!!window.__card.renderRoot.querySelector('.stage.projection-iso'));
await settle();
checkAll(await page.evaluate(()=>({isoNoFlatContours:window.__card.renderRoot.querySelectorAll('.device-contact-contour').length===0,
  isoNoContactStyleState:window.__card.renderRoot.querySelectorAll('[data-hp-device-contact]').length===0,
  isoHasExistingTileShadows:window.__card.renderRoot.querySelectorAll('.iso-tile-shadow').length>0})));
check('iso-toggle-does-not-write-layout',(await state()).writes,parityBefore.writes);
await page.evaluate(async()=>{await window.__hpTest.setServerConfig(cfg=>{cfg.settings={...cfg.settings,volumetric_view:false};return cfg;});});
await page.waitForFunction(()=>!window.__card.renderRoot.querySelector('.stage.projection-iso'));await settle();
const returned=await state();checkAll({flatRestoresContact:returned.components.every(id=>id==='contact-a'),
  projectionRoundtripKeepsPoint:isDeepStrictEqual(returned.layout,parityBefore.layout),projectionRoundtripNoWrite:returned.writes===parityBefore.writes});
// Cold mount reads the accepted server pair, not the previous renderer's graph.
const reloaded=await page.evaluate(async()=>{
  const old=window.__card,next=document.createElement('houseplan-card');
  const before=structuredClone(old._layout),hass=old.hass,config={...old._config};
  old.remove();next.setConfig(config);next.hass=hass;document.getElementById('host').append(next);window.__card=next;
  return before;
});
await page.waitForFunction(()=>window.__card._loadOk&&window.__card._deviceContacts?.scene?.shapes.has('contact-m'));
await settle();
checkAll({coldReadExactPoint:isDeepStrictEqual((await state()).layout,reloaded['contact-m']),
  coldReadRebuildsGroup:(await state()).components.every(id=>id==='contact-a'),coldReadNoWrite:(await state()).writes===returned.writes});
await card.locator('[data-hp="settings"]').click();
await page.locator('hp-dialog[icon="mdi:cog-outline"] [data-section-target="data"]').click();
await page.locator('hp-dialog[icon="mdi:cog-outline"]').locator('button:has(ha-icon[icon="mdi:broom"])').click();
await page.locator('hp-dialog[icon="mdi:broom"]').waitFor();
check('native-optimize-preview-keeps-contact',await page.evaluate(()=>{
  const c=window.__card,layout=c._alignDialog.layout;
  return ['contact-a','contact-b','contact-m'].every(id=>layout[id].x===c._layout[id].x&&layout[id].y===c._layout[id].y)
    &&layout['contact-m'].future?.retained==='yes';
}),true);
await page.locator('hp-dialog[icon="mdi:broom"]').locator('.btn[data-hp="dialog-cancel"]').click();
writeFileSync(`${dir}/result.json`, JSON.stringify({ before, preview, dropped, undone, cancelled },null,2));
await finish(browser);
