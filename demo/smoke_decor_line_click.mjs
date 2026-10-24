import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
requirePinnedBrowser();
const { page, browser } = await launch({ width: 1500, height: 1000 });
const card = page.locator('houseplan-card');
const closePoint = (a,b) => a?.length===2&&b?.length===2&&a.every((n,i)=>Math.abs(n-b[i])<1e-8);
const settle = () => page.evaluate(async () => { await window.__hpTest.waitForWrites(); await window.__card.updateComplete;
  await window.__card._editorRuntime._whenLiveEditorSettled(); });
const state = () => page.evaluate(() => ({ decor: structuredClone(window.__card._decorList),
  history: window.__card._geometryHistory.size, selected: window.__card._decorSel,
  owner: window.__card._editorRuntime.properties.identity?.objectId,
  draft: structuredClone(window.__card._decorDraft), active: window.__card._editorRuntime.decorLine.active,
  blocked: window.__card._editorSecondaryDialogBlocked,
  anchor: window.__card._editorRuntime.decorLine.snapshot?.anchor, tool: window.__card._decorTool }));
const point = (x,y) => card.locator('.decorlayer').last().evaluate((node,[x,y]) => {
  const p=new DOMPoint(x,y).matrixTransform(node.getScreenCTM()); return {x:p.x,y:p.y};
},[x,y]);
const click = async (x,y) => { const p=await point(x,y); await page.mouse.click(p.x,p.y); await settle(); };
const tool = async name => {
  await page.evaluate(async name => { window.__card._editorRuntime._activateDecorTool(name); await window.__card.updateComplete; },name);
};
const reset = async () => {
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig(cfg => { cfg.spaces=[{id:'line',title:'Line',view_box:[0,0,1,1],cell_cm:5,rooms:[],decor:[]},
      {id:'other',title:'Other',rooms:[],decor:[]}];cfg.markers=[];return cfg; });
    await window.__hpTest.switchSpace('line'); await window.__hpTest.setMode('decor');
    window.__card._geometryHistory.clear();
  });
  await card.locator('[data-hp="zoom-fit"]').click(); await tool('line');
};
const esc = async () => { await card.locator('[data-editor-group="shapes"]').focus();
  await page.keyboard.press('Escape'); await settle(); };
const key = async combo => { await page.keyboard.press(combo); await settle(); };

try {
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  await reset();
  const a=await point(200,250), b=await point(450,300);
  await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.up(); await settle();
  check('line.first_up_no_write',(await state()).decor.length,0);
  await page.mouse.move(b.x,b.y); await page.waitForTimeout(50);
  check('line.hover_no_write',(await state()).decor.length,0);
  check('line.hover_visible',await card.locator('.decorlayer .ddraft').count()>0);
  await click(450,300); await click(700,450);
  let s=await state();
  check('line.ABC_two_segments',s.decor.length,2); check('line.ABC_two_history',s.history,2);
  check('line.independent_ids',s.decor[0].id!==s.decor[1].id);
  check('line.chain_shared_endpoint',[s.decor[0].x2,s.decor[0].y2],[s.decor[1].x1,s.decor[1].y1]);
  check('line.native_latest',s.selected,s.decor[1].id); check('line.tool_stays',s.tool,'line');
  // A real field edit proves which object owns Properties; selection is observable by the actual frame.
  check('line.properties_latest',s.owner,s.decor[1].id);
  const frame=card.locator('.hp-prop-selection path').first();
  check('line.frame_latest',await frame.getAttribute('d'),`M${s.decor[1].x1*1000} ${s.decor[1].y1*1000}L${s.decor[1].x2*1000} ${s.decor[1].y2*1000}`);
  const first=s.decor[0], panel=card.locator('[data-hp="properties-panel"]');
  const xField=panel.locator('[data-field="properties-x"]');
  await xField.fill('55'); await xField.press('Enter'); await settle();
  check('line.properties_preserves_previous',(await state()).decor[0],first);
  check('line.properties_changes_latest',JSON.stringify((await state()).decor[1])!==JSON.stringify(s.decor[1]));
  const dirtyBefore=await state(), length=panel.locator('[data-property="length"] input');
  await length.fill('0'); await click(800,600);
  check('line.invalid_field_no_draw',(await state()).decor,dirtyBefore.decor);
  check('line.invalid_field_error',await panel.locator('[role="alert"]').count(),1);
  await length.press('Escape'); await settle();
  await reset(); await click(200,250); await click(450,300); await click(700,450);
  const chain=(await state()).decor;
  await key('Control+z'); s=await state();
  check('line.active_undo_one',s.decor.length,1);
  check('line.active_undo_exact',s.decor,chain.slice(0,1));
  check('line.active_undo_anchor',closePoint(s.anchor,[s.decor[0].x2*1000,s.decor[0].y2*1000]));
  await key('Control+Shift+z'); s=await state(); check('line.active_redo_one',s.decor.length,2);
  check('line.active_redo_exact',s.decor,chain);
  check('line.active_redo_anchor',closePoint(s.anchor,[s.decor[1].x2*1000,s.decor[1].y2*1000]));
  await esc(); s=await state(); check('line.escape_keeps_lines',s.decor.length,2);
  check('line.escape_ends',s.active,false); check('line.escape_keeps_tool',s.tool,'line');
  check('line.escape_no_history',s.history,2);
  await key('Control+z'); await key('Control+Shift+z'); check('line.completed_history_no_revival',(await state()).active,false);
  check('line.completed_history_exact',(await state()).decor,chain);

  await reset(); await click(250,250);
  let p=await point(443,328); await page.mouse.move(p.x,p.y); await page.waitForTimeout(50);
  const ordinary=(await state()).draft.b;
  await page.keyboard.down('Shift'); await page.waitForTimeout(50); s=await state();
  const dx=s.draft.b[0]-s.draft.a[0],dy=s.draft.b[1]-s.draft.a[1];
  check('line.shift_preview_exact',dx===0||dy===0||Math.abs(dx)===Math.abs(dy));
  check('line.shift_without_move',JSON.stringify(s.draft.b)!==JSON.stringify(ordinary));
  const preview=s.draft.b; await page.mouse.click(p.x,p.y); await page.keyboard.up('Shift'); await settle();
  s=await state();check('line.preview_equals_commit',closePoint([s.decor[0].x2*1000,s.decor[0].y2*1000],preview));
  await esc(); await click(200,250); const before=await state(); await click(200,250);
  check('line.repeated_point_no_history',(await state()).history,before.history);

  for(const kind of ['drag','cancel','lostcapture','multi']) {
    await reset(); await click(200,250); p=await point(450,350);
    if(kind==='drag') { await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+40,p.y+20,{steps:5});await page.mouse.up(); }
    else await card.locator('.stage').evaluate((el,{kind,p})=>{
      const fire=(type,id=41)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,cancelable:true,
        pointerId:id,pointerType:'touch',isPrimary:id===41,button:0,clientX:p.x,clientY:p.y}));
      fire('pointerdown');
      if(kind==='multi'){fire('pointerdown',42);fire('pointerup',42);}
      else fire(kind==='cancel'?'pointercancel':'lostpointercapture');
      fire('pointerup');el.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true,clientX:p.x,clientY:p.y}));
    },{kind,p});
    await settle();s=await state();check(`line.${kind}_no_segment`,s.decor.length,0);
    check(`line.${kind}_keeps_anchor`,!!s.anchor);
    // Navigation changed the viewport: resolve the next deliberate coordinates afresh.
    await click(600,400);check(`line.${kind}_next_clean_click`,(await state()).decor.length,1);
  }
  await reset(); await click(200,250);p=await point(450,350);
  await card.locator('.stage').evaluate((el,p)=>{
    for(const type of ['pointerdown','pointerup'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,composed:true,
      pointerId:91,pointerType:'touch',isPrimary:true,button:0,clientX:p.x,clientY:p.y}));
    el.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true,clientX:p.x,clientY:p.y}));
  },p);await settle();check('line.clean_touch_tap',(await state()).decor.length,1);
  const tapState=await state();
  await card.locator('.stage').evaluate((el,p)=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true,
    clientX:p.x,clientY:p.y})),p);await settle();check('line.synthetic_without_press_no_write',(await state()).decor,tapState.decor);
  await reset();await click(200,250);
  await page.evaluate(()=>window.__hpTest.openSpaceDialog('edit','line'));
  check('line.modal_owns_input',(await state()).blocked);
  p=await point(600,400);
  await card.locator('hp-dialog[data-kind="space"] button.btn[data-hp="dialog-cancel"]').click();await settle();
  await card.locator('.stage').evaluate((el,p)=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,composed:true,
    clientX:p.x,clientY:p.y})),p);await settle();
  check('line.modal_tail_no_write',(await state()).decor.length,0);
  check('line.modal_closed',(await state()).blocked,false);
  await click(600,400);check('line.after_modal_clean_click',(await state()).decor.length,1);
  await reset();await click(200,250);await tool('rect');await tool('line');await click(500,400);
  check('line.tool_change_no_stale_anchor',(await state()).decor.length,0);
  await page.evaluate(async()=>{await window.__hpTest.switchSpace('other');await window.__hpTest.switchSpace('line');});
  await click(650,450);check('line.space_change_no_stale_anchor',(await state()).decor.length,0);
  await reset();await click(200,250);await click(500,400);await esc();await settle();
  const saved=(await state()).decor;
  const server=await page.evaluate(async()=>window.__card.hass.callWS({type:'houseplan/config/get'}));
  check('line.writer_persisted',server.config.spaces.find(s=>s.id==='line').decor,saved);
  await click(650,450);
  await page.evaluate(async cfg=>window.__hpTest.setServerConfig(cfg),server.config);
  check('line.reload_keeps_accepted',(await state()).decor,saved);
  check('line.external_revision_clears_anchor',(await state()).active,false);
  await page.evaluate(()=>window.__hpTest.setMode('view'));
  await click(400,400);await click(700,500);check('line.view_inert',(await state()).decor,saved);
  await page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,kiosk:true});await c.updateComplete;});
  await click(400,400);await click(700,500);check('line.kiosk_inert',(await state()).decor,saved);
  await page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,kiosk:false});await c.updateComplete;
    await window.__hpTest.setMode('decor');});await tool('line');await click(200,250);
  await page.evaluate(async()=>{const c=window.__card,call=c.hass.callWS.bind(c.hass);
    c.hass={...c.hass,callWS:async msg=>{const result=await call(msg);return msg.type==='houseplan/config/get'?{...result,can_write:false}:result;}};
    await window.__hpTest.setServerConfig(cfg=>cfg);});
  await click(600,400);check('line.permission_loss_inert',(await state()).decor,saved);
  check('line.permission_loss_ends_session',(await state()).active,false);
} finally { await finish(browser); }
