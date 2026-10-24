// #1025: real selection and keyboard against the ordinary persisted harness writer.
import {launch,check,finish,requirePinnedBrowser} from './serve.mjs';
requirePinnedBrowser();
const {page,browser}=await launch({width:1600,height:1000});
const card=page.locator('houseplan-card'), step=1/240;
const near=(a,b)=>Math.abs(a-b)<1e-7;
// Storage retains nine normalized decimals; legacy wall-flush points can have
// longer tails. Compare the exact canonical target, not a looser world epsilon.
const canonicalWorld=n=>Math.round(n*1e6)/1e6;
const settle=()=>page.evaluate(async()=>{await window.__hpTest.waitForWrites();await window.__hpTest.settled();});
const state=()=>page.evaluate(async()=>{
  const c=window.__card,config=await c.hass.callWS({type:'houseplan/config/get'}),layout=await c.hass.callWS({type:'houseplan/layout/get'});
  return{space:config.config.spaces.find(s=>s.id==='nudge'),layout:layout.layout,
    geometry:c._geometryHistory.size,devices:c._devicePositionHistory.size,writes:window.__nudgeWrites.length,
    identity:c._editorRuntime.properties.identity,scroll:document.scrollingElement.scrollTop};
});
const selectWall=async id=>{
  const target=card.locator(`[data-hp="partition"][data-id="${id}"]`),box=await target.boundingBox();
  // The free wall's centre contains its hosted opening: hit the actual wall body.
  await target.click({position:{x:box.width*.2,y:box.height*.5}});
};
const selectOpening=id=>card.locator(`[data-hp="opening"][data-id="${id}"] .op-hit`).click();
const selectDevice=id=>card.locator(`[data-hp="device"][data-id="${id}"]`).click();
const press=async key=>{await page.keyboard.press(key);await settle();};
const anchors=()=>page.evaluate(()=>Object.fromEntries(['keyboard-light','untouched-light'].map(id=>{
  const d=window.__card._devices.find(d=>d.id===id);return[id,window.__card._pos(d)];
})));
try{
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  await page.evaluate(async()=>{
    await window.__hpTest.waitForWrites();
    await window.__hpTest.setServerConfig(cfg=>({...cfg,settings:{...cfg.settings,volumetric_view:false},spaces:[{
      id:'nudge',title:'Nudge',view_box:[0,0,1,1],cell_cm:5,rooms:[],wall_segments:[],
      partitions:[{id:'free',a:[.183,.3],b:[.483,.3],cm:10,future:{keep:true}},
        {id:'connected',a:[.15,.65],b:[.38,.65],cm:10},{id:'branch',a:[.38,.65],b:[.38,.85],cm:10},
        {id:'diagonal',a:[.52,.35],b:[.82,.65],cm:10}],
      openings:[{id:'hosted',type:'window',x:.333,y:.3,angle:0,length:.04,host:{kind:'partition',id:'free',t:.5},future:{keep:[1]}},
        {id:'door',type:'door',x:.67,y:.5,angle:45,length:.04,host:{kind:'partition',id:'diagonal',t:.5}}]},
      {id:'upstairs',title:'Other floor',rooms:[],wall_segments:[]}],markers:[
      {id:'keyboard-light',binding:'virtual',space:'nudge',name:'Keyboard light',icon:'mdi:lightbulb',size:1},
      {id:'untouched-light',binding:'virtual',space:'nudge',name:'Untouched',icon:'mdi:lightbulb',size:1}]}));
    await window.__hpTest.setLayout({'keyboard-light':{s:'nudge',x:.183,y:.52,k:1.3,future:{opaque:true}},
      'untouched-light':{s:'nudge',x:.85,y:.82},foreign:{s:'upstairs',x:.3123,y:.7123,future:{opaque:[1,2]}}});
    await window.__hpTest.switchSpace('nudge');await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');
    const c=window.__card,wire=c.hass.callWS.bind(c.hass);window.__nudgeWrites=[];
    window.__nudgeKeys=[];
    window.addEventListener('keydown',event=>{if(event.key.startsWith('Arrow'))window.__nudgeKeys.push({key:event.key,prevented:event.defaultPrevented});});
    c.hass={...c.hass,callWS:async message=>{
      if(/houseplan\/(config|layout)\/(set|update)$/.test(message.type))window.__nudgeWrites.push(structuredClone(message));
      const answer=await wire(message);
      if(window.__nudgeDelay===message.type){window.__nudgeDelay=null;await new Promise(resolve=>{window.__nudgeRelease=resolve;window.__nudgeHeld=true;});}
      return answer;
    }};
  });
  await card.locator('[data-hp="properties-panel"]').waitFor({state:'visible'});
  await card.locator('[data-hp="zoom-fit"]').click();
  await selectWall('connected');let before=await state();
  check('nudge.connected_native_selection',before.identity?.objectId,'connected');
  for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])await page.keyboard.press(key);
  await settle();check('nudge.connected_four_arrows_noop',await state(),before);
  check('nudge.connected_native_keys_not_consumed',await page.evaluate(()=>window.__nudgeKeys.slice(-4).every(e=>!e.prevented)));
  await selectWall('free');before=await state();check('nudge.free_native_selection',before.identity?.objectId,'free');
  await press('ArrowRight');let after=await state();
  check('nudge.accepted_canvas_arrow_prevents_scroll',await page.evaluate(()=>window.__nudgeKeys.at(-1)?.prevented));
  check('nudge.wall_full_segment_exact_step',after.space.partitions[0].a.every((n,i)=>near(n,before.space.partitions[0].a[i]+(i===0?step:0)))
    &&after.space.partitions[0].b.every((n,i)=>near(n,before.space.partitions[0].b[i]+(i===0?step:0))));
  check('nudge.wall_offset_identity_unknown',after.space.partitions[0].id==='free'&&near(after.space.partitions[0].a[0],.183+step)
    &&JSON.stringify(after.space.partitions[0].future)===JSON.stringify(before.space.partitions[0].future));
  check('nudge.hosted_opening_atomic',near(after.space.openings[0].x,before.space.openings[0].x+step)
    &&near(after.space.openings[0].y,before.space.openings[0].y)&&JSON.stringify(after.space.openings[0].host)===JSON.stringify(before.space.openings[0].host)
    &&JSON.stringify(after.space.openings[0].future)===JSON.stringify(before.space.openings[0].future));
  check('nudge.wall_one_write_one_history_no_scroll',after.geometry===before.geometry+1&&after.writes===before.writes+1&&after.scroll===before.scroll);
  await press('Control+z');after=await state();check('nudge.wall_undo',near(after.space.partitions[0].a[0],before.space.partitions[0].a[0]));
  await press('Control+y');after=await state();check('nudge.wall_redo',near(after.space.partitions[0].a[0],before.space.partitions[0].a[0]+step));
  await selectOpening('door');before=await state();check('nudge.opening_native_selection',before.identity?.objectId,'door');
  await press('ArrowUp');await press('ArrowDown');check('nudge.45_inactive_pair_noop',await state(),before);
  await press('ArrowRight');after=await state();
  check('nudge.45_right_one_cell_along_host',near(after.space.openings[1].x-before.space.openings[1].x,step/Math.sqrt(2))
    &&near(after.space.openings[1].y-before.space.openings[1].y,step/Math.sqrt(2))&&after.space.openings[1].host.id==='diagonal');
  check('nudge.opening_one_write_one_history',after.geometry===before.geometry+1&&after.writes===before.writes+1);
  await press('Control+z');after=await state();check('nudge.opening_undo',near(after.space.openings[1].host.t,before.space.openings[1].host.t));
  await press('Control+y');after=await state();check('nudge.opening_redo',after.space.openings[1].host.t>before.space.openings[1].host.t);
  // Controls use trusted focus and key events, including nested shadow inputs.
  await selectWall('free');before=await state();
  check('nudge.properties_control_has_no_modal',await card.locator('hp-dialog').count(),0);
  const thickness=card.locator('[data-hp="properties-panel"] [data-property="cm"] input');
  await thickness.focus();await press('ArrowRight');after=await state();
  check('nudge.properties_input_keeps_arrows',after.space,before.space);check('nudge.properties_input_no_history_write',after.geometry===before.geometry&&after.writes===before.writes);
  // Pick a different carrier first: a second rapid click on the same wall is
  // the real physical-settings double click and intentionally traps focus.
  await selectWall('connected');await selectWall('free');before=await state();
  check('nudge.modifier_canvas_has_no_modal',await card.locator('hp-dialog').count(),0);
  for(const key of ['Control+ArrowRight','Meta+ArrowRight','Alt+ArrowRight'])await press(key);
  after=await state();check('nudge.reserved_modifiers_noop',after.space,before.space);check('nudge.modifiers_no_history_write',after.geometry===before.geometry&&after.writes===before.writes);
  await page.evaluate(()=>{
    const dock=document.createElement('div');dock.id='nudge-native-controls';dock.style.cssText='position:fixed;right:0;bottom:0;z-index:10000;background:white';
    const root=dock.attachShadow({mode:'open'});root.innerHTML='<input aria-label="Nudge native text" value="abc"><input type="range" aria-label="Nudge native range" value="50"><select aria-label="Nudge native select"><option>A</option><option>B</option></select><span contenteditable="true" aria-label="Nudge native editable">abc</span>';
    document.body.append(dock);
  });
  const controls=page.locator('#nudge-native-controls');before=await state();
  for(const label of ['Nudge native text','Nudge native range','Nudge native select','Nudge native editable']){
    const control=controls.getByLabel(label);await control.focus();
    check('nudge.shadow_control_focused_'+label.split(' ').at(-1),await control.evaluate(el=>el.getRootNode().activeElement===el));
    await press('ArrowRight');
    check('nudge.shadow_control_native_'+label.split(' ').at(-1),await page.evaluate(()=>!window.__nudgeKeys.at(-1)?.prevented));
  }
  check('nudge.native_range_value_changes',await controls.getByLabel('Nudge native range').inputValue(),'51');
  after=await state();check('nudge.shadow_controls_do_not_edit_plan',after.space,before.space);
  check('nudge.shadow_controls_no_history_write',after.geometry===before.geometry&&after.writes===before.writes);
  await page.locator('#nudge-native-controls').evaluate(el=>el.remove());
  await page.evaluate(()=>window.__hpTest.setMode('devices'));await card.locator('[data-hp="zoom-fit"]').click();
  await selectDevice('keyboard-light');before=await state();check('nudge.device_native_selection',before.identity?.objectId,'keyboard-light');
  check('nudge.device_selection_takes_focus',await card.locator('[data-hp="device"][data-id="keyboard-light"]').evaluate(el=>el.getRootNode().activeElement===el));
  await press('Shift+ArrowRight');after=await state();
  check('nudge.device_shift_exact_offset_step',near(after.layout['keyboard-light'].x,before.layout['keyboard-light'].x+step)&&near(after.layout['keyboard-light'].y,before.layout['keyboard-light'].y));
  check('nudge.device_siblings_other_floor',after.layout.foreign,before.layout.foreign);check('nudge.device_other_marker',after.layout['untouched-light'],before.layout['untouched-light']);
  check('nudge.device_unknown_fields',after.layout['keyboard-light'].future,before.layout['keyboard-light'].future);check('nudge.device_scale_untouched',after.layout['keyboard-light'].k,1.3);
  check('nudge.device_one_write_one_history_no_scroll',after.devices===before.devices+1&&after.writes===before.writes+1&&after.scroll===before.scroll);
  await press('Control+z');after=await state();check('nudge.device_undo',near(after.layout['keyboard-light'].x,before.layout['keyboard-light'].x));
  await press('Control+y');after=await state();check('nudge.device_redo',near(after.layout['keyboard-light'].x,before.layout['keyboard-light'].x+step));
  before=await state();await page.keyboard.down('ArrowDown');await page.keyboard.down('ArrowDown');await page.keyboard.up('ArrowDown');await settle();after=await state();
  check('nudge.device_repeat_two_exact_steps',near(after.layout['keyboard-light'].y,before.layout['keyboard-light'].y+2*step));
  check('nudge.device_repeat_two_histories',after.devices===before.devices+2&&after.writes===before.writes+2);
  // A server-authored legacy row is reflowed by the actual contact renderer.
  await page.evaluate(async()=>{
    await window.__hpTest.setLayout(layout=>({...layout,'keyboard-light':{s:'nudge',x:.55,y:.83},'untouched-light':{s:'nudge',x:.8,y:.83}}));
    const c=window.__card,a=c._deviceContacts.scene.shapes.get('keyboard-light').marker,b=c._deviceContacts.scene.shapes.get('untouched-light').marker;
    const depth=Math.min(a.diameter,b.diameter)*13/80-(a.diameter+b.diameter)*.009375;
    await window.__hpTest.setLayout(layout=>({...layout,'untouched-light':{s:'nudge',x:(a.x+a.box.right-b.box.left-depth)/1000,y:.83}}));
  });
  await page.waitForFunction(()=>window.__card._deviceContacts.scene.component('keyboard-light').length===2);
  await selectDevice('keyboard-light');let points=await anchors();before=await state();await press('ArrowLeft');let movedPoints=await anchors();after=await state();
  check('nudge.contact_selected_effective_one_cell',near(movedPoints['keyboard-light'].x,points['keyboard-light'].x-step*1000)&&near(movedPoints['keyboard-light'].y,points['keyboard-light'].y));
  check('nudge.contact_other_effective_anchor_fixed',near(movedPoints['untouched-light'].x,points['untouched-light'].x)&&near(movedPoints['untouched-light'].y,points['untouched-light'].y));
  check('nudge.contact_atomic_one_history_write',after.devices===before.devices+1&&after.writes===before.writes+1);
  await page.evaluate(async()=>{const layout=(await window.__card.hass.callWS({type:'houseplan/layout/get'})).layout;await window.__hpTest.setLayout(layout);});
  const reloaded=await anchors();check('nudge.contact_reload_keeps_exact_anchors',Object.keys(reloaded).every(id=>near(reloaded[id].x,movedPoints[id].x)&&near(reloaded[id].y,movedPoints[id].y)));
  // Seed an ordinary wall-flush reference from the renderer's actual cut face.
  await page.evaluate(async()=>{
    const c=window.__card,m=c._deviceContacts.scene.shapes.get('keyboard-light').marker;
    const wall=c._deviceContacts.scene.walls.find(w=>Math.abs(w.a[1]-w.b[1])<1e-7&&w.normal?.[1]>.9&&w.a[1]>290&&w.a[1]<310&&Math.abs(w.b[0]-w.a[0])>100);
    if(!wall)throw new Error('keyboard wall-contact fixture has no actual long lower face');
    await window.__hpTest.setLayout(layout=>({...layout,'keyboard-light':{s:'nudge',x:(wall.a[0]+wall.b[0])/2000,y:(wall.a[1]-m.box.top+m.diameter*.009375)/1000}}));
  });
  check('nudge.wall_contact_exists',await page.evaluate(()=>Object.keys(window.__card._deviceContacts.scene.shapes.get('keyboard-light').walls).length>0));
  const oldZoom=await page.evaluate(()=>window.__card._zoom);await card.locator('[data-hp="zoom-out"]').click();
  await page.waitForFunction(()=>!window.__card._cameraTransition.active);await settle();
  check('nudge.real_zoom_changed',await page.evaluate(()=>window.__card._zoom)<oldZoom);
  await selectDevice('keyboard-light');points=await anchors();before=await state();await press('ArrowDown');movedPoints=await anchors();after=await state();
  check('nudge.wall_contact_zoom_keeps_full_world_step',near(movedPoints['keyboard-light'].x,canonicalWorld(points['keyboard-light'].x))&&near(movedPoints['keyboard-light'].y,canonicalWorld(points['keyboard-light'].y+step*1000)));
  check('nudge.wall_contact_other_anchor_fixed',near(movedPoints['untouched-light'].x,points['untouched-light'].x)&&near(movedPoints['untouched-light'].y,points['untouched-light'].y));
  check('nudge.wall_contact_one_write_history',after.devices===before.devices+1&&after.writes===before.writes+1);
  await card.locator('[data-hp="zoom-fit"]').click();await page.waitForFunction(()=>!window.__card._cameraTransition.active);await selectDevice('keyboard-light');
  // Delay an ordinary read/receipt, never a private command or product guard.
  const beforeRetirement=await anchors();before=await state();
  await page.evaluate(()=>{window.__nudgeHeld=false;window.__nudgeDelay='houseplan/layout/get';});
  await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
  await page.waitForFunction(()=>window.__nudgeHeld);
  await selectDevice('untouched-light');
  await page.evaluate(()=>window.__nudgeRelease());
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);await settle();after=await state();
  check('nudge.selection_change_retires_unsent_steps',after.writes===before.writes&&after.devices===before.devices);
  check('nudge.selection_change_preserves_server_positions',after.layout,before.layout);
  const retiredPoints=await anchors();check('nudge.selection_change_rolls_back_own_preview',Object.keys(beforeRetirement).every(id=>near(beforeRetirement[id].x,retiredPoints[id].x)&&near(beforeRetirement[id].y,retiredPoints[id].y)));
  await selectDevice('keyboard-light');before=await state();
  await page.evaluate(()=>{window.__nudgeHeld=false;window.__nudgeDelay='houseplan/layout/set';});
  await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');await page.waitForFunction(()=>window.__nudgeHeld);
  await page.evaluate(async()=>{
    await window.__hpTest.setMode('view');
    await window.__hpTest.setLayout(layout=>({...layout,'keyboard-light':{...layout['keyboard-light'],x:.72,y:.74},foreign:{...layout.foreign,x:.4321}}));
  });
  const foreignHistory=await page.evaluate(()=>window.__card._devicePositionHistory.size);
  await page.evaluate(()=>window.__nudgeRelease());await page.waitForFunction(()=>!window.__card._devicePositionBusy);await settle();after=await state();
  check('nudge.foreign_revision_wins_late_receipt',near(after.layout['keyboard-light'].x,.72)&&near(after.layout['keyboard-light'].y,.74)&&near(after.layout.foreign.x,.4321));
  const liveAfter=await anchors();check('nudge.foreign_revision_wins_live_preview',near(liveAfter['keyboard-light'].x,720)&&near(liveAfter['keyboard-light'].y,740));
  check('nudge.retired_ack_no_false_history_or_replay',after.devices===foreignHistory&&after.writes===before.writes+1);
  await page.evaluate(()=>window.__hpTest.setMode('view'));before=await state();await press('ArrowRight');after=await state();
  check('nudge.view_no_write',after.writes,before.writes);check('nudge.view_layout_unchanged',after.layout,before.layout);
}finally{await finish(browser);}
