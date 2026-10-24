// #1038: actual native input and persisted config; no private selection/writer calls.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser();
const {page,browser}=await launch({width:1600,height:1100});
const card=page.locator('houseplan-card'),panel=card.locator('[data-hp="properties-panel"]');
const settle=()=>page.evaluate(async()=>{
  await window.__hpTest.waitForWrites();await window.__card.updateComplete;
  await window.__card._editorRuntime._whenLiveEditorSettled();
});
const state=()=>page.evaluate(()=>({
  ids:[...window.__card._editorRuntime.properties.decorSelectionIds],native:window.__card._decorSel,
  decor:structuredClone(window.__card._decorList),history:window.__card._geometryHistory.size,
  writes:window.__1038Writes.length,tool:window.__card._decorTool,
}));
const saved=()=>page.evaluate(async()=>(await window.__card.hass.callWS({type:'houseplan/config/get'})).config.spaces.find(s=>s.id==='group').decor);
const rect=(id,x,y,color='#ff0000',opacity=.2)=>({id,kind:'rect',x,y,w:.13,h:.09,fill:true,fill_color:'#778899',fill_opacity:.6,color,opacity,angle:0,width_cm:2,future:{keep:[id,true]}});
const records=()=>[
  {id:'line',kind:'line',x1:.12,y1:.16,x2:.32,y2:.23,color:'#ff0000',opacity:.2,line_style:'dashed',width_cm:3},
  rect('rect',.4,.15),{...rect('ellipse',.66,.16),kind:'ellipse',angle:24},
  {id:'text',kind:'text',x:.2,y:.48,text:'Room {sensor.group_temperature}',color:'#334455',size_cm:16,angle:17},
  {id:'furniture',kind:'furniture',x:.4,y:.4,w:.18,h:.13,symbol:'sofa',color:'#116633',opacity:.7,angle:22,flip_h:true},
  {id:'image',kind:'image',x:.67,y:.4,w:.16,h:.12,asset_id:'a'.repeat(64),opacity:.6,angle:-15,flip_v:true},
];
const seed=async decor=>{
  await page.evaluate(async decor=>{
    await window.__hpTest.waitForWrites();
    await window.__hpTest.setServerConfig(cfg=>({...cfg,spaces:[
      {id:'group',title:'Group',cell_cm:5,view_box:[0,0,1,1],rooms:[],wall_segments:[],decor},
      {id:'other',title:'Other',cell_cm:5,view_box:[0,0,1,1],rooms:[],decor:[{id:'foreign',kind:'text',x:.3,y:.3,text:'Other floor'}]},
    ],markers:[]}));
    if(window.__card._space!=='group')window.__card.renderRoot.querySelector('[data-hp="space-tab"][data-id="group"]').click();
    await window.__hpTest.setMode('decor');await window.__hpTest.setTool('select');
  },decor);
  await card.locator('[data-hp="zoom-fit"]').click();await settle();
};
const point=async(x,y)=>card.locator('.decorlayer').evaluate((el,[x,y])=>{
  const p=new DOMPoint(x*1000,y*1000).matrixTransform(el.getScreenCTM());return{x:p.x,y:p.y};
},[x,y]);
// Search only the actual painted public hit surface, excluding occluded/offscreen points.
const hit=async id=>card.evaluate((c,id)=>{
  const shapes=[...c.renderRoot.querySelectorAll('[data-hp="decor"][data-id]')].filter(el=>el.dataset.id===id);
  for(const shape of shapes){const b=shape.getBoundingClientRect();
    for(const fy of [.5,.1,.9,.25,.75])for(const fx of [.5,.1,.9,.25,.75]){
      const x=b.x+b.width*fx,y=b.y+b.height*fy;if(x<0||y<0||x>innerWidth||y>innerHeight)continue;
      const actual=c.renderRoot.elementFromPoint(x,y)?.closest('[data-hp="decor"]');
      if(actual?.dataset.id===id)return{x,y};
    }
  }throw Error(`No unobscured painted decor hit ${id}`);
},id);
const click=async(id,ctrl=false)=>{const p=await hit(id);if(ctrl)await page.keyboard.down('Control');await page.mouse.click(p.x,p.y);if(ctrl)await page.keyboard.up('Control');await settle();};
const select=async ids=>{await click(ids[0]);for(const id of ids.slice(1))await click(id,true);};
const empty=async()=>{
  const p=await card.evaluate(c=>{
    const matrix=c.renderRoot.querySelector('.decorlayer').getScreenCTM();
    const receipt={};
    for(const [x,y] of [[.86,.79],[.7,.78],[.45,.78],[.2,.8],[.1,.7],[.08,.55],[.08,.08]]){
      const p=new DOMPoint(x*1000,y*1000).matrixTransform(matrix),target=c.renderRoot.elementFromPoint(p.x,p.y);
      const observed={x:p.x,y:p.y,tag:target?.tagName,classes:target?.getAttribute('class'),stage:!!target?.closest('.stage')};
      receipt.preferred??=observed;
      if(!observed.stage||target?.closest('button,hp-dialog,.editor-secondary,.hp-properties,[data-hp="decor"],.dtframe,.backdropframe'))continue;
      receipt.chosen=observed;(window.__1038EmptyReceipts??=[]).push(receipt);return{x:p.x,y:p.y};
    }
    throw Error(`No unobscured empty stage: ${JSON.stringify(receipt)}`);
  });
  await page.mouse.click(p.x,p.y);await settle();
};
const shortcut=async key=>{await page.keyboard.press(`Control+${key}`);await settle();};
const drag=async(id,dx=.07,dy=.04,up=true)=>{
  const p=await hit(id),a=await point(.2,.2),b=await point(.2+dx,.2+dy);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+b.x-a.x,p.y+b.y-a.y,{steps:8});
  if(up){await page.mouse.up();await settle();}return{p,end:{x:p.x+b.x-a.x,y:p.y+b.y-a.y}};
};
const alpha=()=>panel.locator('[data-property="stroke"] [data-hp="field"][data-field="stroke-opacity"]');
const hex=()=>panel.locator('[data-property="stroke"] [data-hp="field"][data-field="stroke-hex"]');

try{
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  await page.evaluate(()=>{
    const c=window.__card,call=c.hass.callWS.bind(c.hass);window.__1038Writes=[];window.__1038Calls=[];
    window.__addRegistryEntity('sensor.group_temperature','kitchen','22.4','demo',{}, {unit_of_measurement:'°C'});
    c.hass={...c.hass,callWS:async message=>{
      window.__1038Calls.push(message.type);
      if(message.type==='houseplan/config/set')window.__1038Writes.push(structuredClone(message));
      return call(message);
    }};
  });
  await seed(records());
  const base=await state();
  await click('rect');check('group.plain_singleton',(await state()).ids,['rect']);
  await click('ellipse',true);check('group.ctrl_add',(await state()).ids,['rect','ellipse']);
  check('group.native_singleton_projection_empty',(await state()).native,null);
  check('group.only_individual_outlines',await card.locator('.hp-prop-group-contour').count(),2);
  check('group.no_group_handles',await card.locator('.hp-prop-group-selection circle,.hp-prop-group-selection .dthandle,.dtframe').count(),0);
  check('group.contours_are_inert',await card.locator('.hp-prop-group-selection').getAttribute('pointer-events'),'none');
  await click('rect',true);check('group.ctrl_remove',(await state()).ids,['ellipse']);
  await click('rect',true);await click('rect');check('group.clean_member_click_collapses',(await state()).ids,['rect']);
  await empty();check('group.empty_click_clear',(await state()).ids,[]);
  await shortcut('a');check('group.ctrl_a_all',(await state()).ids,records().map(x=>x.id));
  check('group.text_contour_measured',await card.locator('.hp-prop-group-contour[data-decor-selection="text"] rect').count(),1);
  await shortcut('m');check('group.ctrl_m_only_furniture',(await state()).ids,['furniture']);
  check('group.selection_only_no_writes',(await state()).writes,base.writes);
  check('group.selection_only_no_history',(await state()).history,base.history);

  await empty();await shortcut('a');
  const before=await state(),beforeSaved=await saved();
  await drag('ellipse',.07,.04,false);
  await page.evaluate(()=>window.__card._editorRuntime._whenLiveEditorSettled());
  check('group.drag_live_paints_every_member',await card.locator('.hp-live-decor [data-hp="decor"]').evaluateAll(els=>[...new Set(els.map(el=>el.dataset.id))]),before.ids);
  await page.mouse.up();await settle();const moved=await state(),afterSaved=await saved();
  const dx=afterSaved[1].x-beforeSaved[1].x,dy=afterSaved[1].y-beforeSaved[1].y;
  check('group.drag_one_real_delta',Math.abs(dx)>.005&&Math.abs(dy)>.005);
  check('group.drag_all_ids_retained',moved.ids,before.ids);
  check('group.drag_one_write',moved.writes,before.writes+1);check('group.drag_one_history',moved.history,before.history+1);
  const expected=beforeSaved.map(s=>s.kind==='line'?{...s,x1:s.x1+dx,y1:s.y1+dy,x2:s.x2+dx,y2:s.y2+dy}:{...s,x:s.x+dx,y:s.y+dy});
  const coordinates=new Set(['x','y','x1','y1','x2','y2']);
  const normalized=items=>items.map(item=>Object.fromEntries(Object.entries(item).map(([key,value])=>
    [key,coordinates.has(key)&&typeof value==='number'?Number(value.toFixed(9)):value])));
  check('group.drag_complete_records',normalized(afterSaved),normalized(expected));
  await shortcut('z');check('group.shared_undo_complete',await saved(),beforeSaved);
  await page.keyboard.press('Control+Shift+z');await settle();check('group.shared_redo_complete',await saved(),afterSaved);
  const cancelBefore=await state();await drag('rect',.04,.03,false);await page.keyboard.press('Escape');await page.mouse.up();await settle();
  check('group.escape_restores_entire_begin',(await state()).decor,cancelBefore.decor);
  check('group.escape_preserves_selection',(await state()).ids,cancelBefore.ids);
  check('group.escape_no_write',(await state()).writes,cancelBefore.writes);
  await page.keyboard.press('ArrowRight');await page.keyboard.press('Delete');await settle();
  check('group.no_hidden_singleton_action',(await state()).decor,cancelBefore.decor);

  for(const kind of ['rect','ellipse','line','text','furniture','image']){
    const first=records().find(x=>x.kind===kind),second={...first,id:'second',color:'#0000ff',opacity:.8};
    if(kind==='line'){Object.assign(first,{x1:.16,y1:.28,x2:.32,y2:.31});Object.assign(second,{x1:.55,y1:.28,x2:.72,y2:.31});}
    else{Object.assign(first,{x:.16,y:.32});Object.assign(second,{x:.56,y:.32});}
    if(kind==='text')second.text='Second label';if(kind==='furniture')second.symbol='armchair';
    if(kind==='image'){delete first.color;delete second.color;second.asset_id='b'.repeat(64);}
    await seed([first,second]);await select([first.id,'second']);
    check(`group.matrix.${kind}.position_disabled`,await panel.locator('[data-property="x"]').evaluate(el=>el.classList.contains('disabled')),true);
    check(`group.matrix.${kind}.stroke_group_field`,await panel.locator('[data-property="stroke"] hp-color-opacity').count(),1);
    check(`group.matrix.${kind}.fill_matrix`,await panel.locator('[data-property="fill"] hp-color-opacity').count(),kind==='rect'||kind==='ellipse'?1:0);
    check(`group.matrix.${kind}.actions_disabled`,await panel.locator('.hp-prop-action').evaluateAll(els=>els.every(el=>el.getAttribute('aria-disabled')==='true')));
    const start=await state();
    if(kind!=='image'){
      check(`group.matrix.${kind}.mixed_hex_empty`,await hex().inputValue(),'');
      await hex().fill('#ABCDEF');await hex().press('Enter');await settle();
      const after=await saved();check(`group.matrix.${kind}.color_only`,after.map(x=>x.color),['#abcdef','#abcdef']);
      check(`group.matrix.${kind}.opposite_alpha_kept`,after.map(x=>x.opacity),[first.opacity,.8]);
    }else{
      check('group.image.no_hex',await panel.locator('[data-property="stroke"] [data-field="stroke-hex"]').count(),0);
      const imagePicker=panel.locator('[data-property="stroke"] hp-color-opacity');
      await imagePicker.locator('.trigger').click();
      check('group.image.popup_alpha_only',await imagePicker.locator('.sv-field,.preview,[data-field="colour-hex"],[data-field="colour-none"]').count(),0);
      await page.keyboard.press('Escape');await settle();
    }
    await alpha().fill('35');await alpha().press('Enter');await settle();
    const after=await saved();check(`group.matrix.${kind}.alpha_only`,after.map(x=>x.opacity),[.35,.35]);
    check(`group.matrix.${kind}.alpha_keeps_color`,after.map(x=>x.color),kind==='image'?[undefined,undefined]:['#abcdef','#abcdef']);
    check(`group.matrix.${kind}.one_command_per_field`,(await state()).history,start.history+(kind==='image'?1:2));
  }

  await seed([rect('a',.18,.32),rect('b',.58,.32,'#0000ff',.8)]);await select(['a','b']);
  const picker=panel.locator('[data-property="stroke"] hp-color-opacity');
  const untouched=await state();await picker.locator('.trigger').click();
  await picker.locator('.confirm').click();await settle();
  check('group.picker.untouched_confirm_no_write',(await state()).writes,untouched.writes);
  check('group.picker.untouched_no_defaults',(await state()).decor,untouched.decor);
  await picker.locator('.trigger').click();const number=picker.locator('input[data-value="number"]');
  await number.fill('42');await number.fill('');await picker.locator('.confirm').click();
  check('group.picker.empty_alpha_remains_open',await picker.locator('.picker').isVisible());
  check('group.picker.empty_alpha_invalid',await number.getAttribute('aria-invalid'),'true');
  check('group.picker.empty_alpha_no_write',(await state()).writes,untouched.writes);
  await number.fill('0');await picker.locator('.confirm').click();await settle();
  check('group.picker.real_zero_saved',(await saved()).map(x=>x.opacity),[0,0]);
  await picker.locator('.trigger').click();const popupHex=picker.locator('[data-field="colour-hex"]');
  await popupHex.fill('INVALID');await picker.locator('.confirm').click();
  check('group.picker.invalid_hex_stays_visible',await popupHex.inputValue(),'INVALID');
  const invalidBefore=await state();await number.fill('65');await picker.locator('.confirm').click();
  check('group.picker.alpha_cannot_launder_invalid_hex',(await state()).writes,invalidBefore.writes);
  await empty();
  check('group.picker.invalid_hex_blocks_canvas_navigation',(await state()).ids,invalidBefore.ids);
  check('group.picker.invalid_hex_remains_open_on_navigation',await picker.locator('.picker').isVisible());
  await page.keyboard.press('Escape');await settle();check('group.picker.cancel_restores_full_baseline',(await state()).decor,invalidBefore.decor);

  await seed([rect('a',.18,.32),rect('b',.58,.32),rect('unselected',.4,.62)]);await select(['a','b']);
  await hex().focus();await page.keyboard.press('Control+a');await page.keyboard.press('Control+m');
  check('group.shortcut.focused_input_keeps_set',(await state()).ids,['a','b']);
  await picker.locator('.trigger').click();await picker.locator('.confirm').focus();
  await page.keyboard.press('Control+a');await page.keyboard.press('Control+m');
  check('group.shortcut.picker_button_keeps_set',(await state()).ids,['a','b']);
  await page.keyboard.press('Escape');await settle();
  // Exercise the supported browser-without-Popover path, not a product flag.
  await page.evaluate(()=>{
    window.__1038Popover=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'showPopover');
    Object.defineProperty(HTMLElement.prototype,'showPopover',{configurable:true,value:undefined});
  });
  await picker.locator('.trigger').click();const fallback=page.locator('[data-hp-overlay="color-opacity"]');
  await fallback.locator('.confirm').focus();await page.keyboard.press('Control+a');await page.keyboard.press('Control+m');
  check('group.shortcut.fallback_picker_button_keeps_set',(await state()).ids,['a','b']);
  await page.keyboard.press('Escape');await settle();
  await page.evaluate(()=>Object.defineProperty(HTMLElement.prototype,'showPopover',window.__1038Popover));
  await hex().fill('INVALID');const hiddenDraft=await state();
  await page.setViewportSize({width:850,height:1100});await settle();
  await drag('a',.03,.02);await shortcut('a');await shortcut('m');
  check('group.compact.invalid_hidden_field_no_move',(await state()).decor,hiddenDraft.decor);
  check('group.compact.invalid_hidden_field_keeps_set',(await state()).ids,hiddenDraft.ids);
  check('group.compact.invalid_hidden_field_no_write',(await state()).writes,hiddenDraft.writes);
  await page.setViewportSize({width:1600,height:1100});await settle();
  await hex().press('Escape');

  await seed(records());await select(['rect','ellipse']);const selection=await state();
  await card.locator('[data-hp="tool"][data-tool="shapes"]').click();await card.locator('[data-hp="tool"][data-tool="line"]').click();
  const anchor=await point(.22,.72);await page.mouse.click(anchor.x,anchor.y);
  const chainState=()=>page.evaluate(()=>({active:window.__card._editorRuntime.decorLine.active,anchor:window.__card._editorRuntime.decorLine.snapshot,
    draft:structuredClone(window.__card._decorDraft),ids:[...window.__card._editorRuntime.properties.decorSelectionIds],
    history:window.__card._geometryHistory.size,decor:structuredClone(window.__card._decorList),tool:window.__card._decorTool}));
  const chain=await chainState();
  await shortcut('a');await shortcut('m');
  check('group.shortcut.active_line_preserved',await chainState(),chain);
  const end=await point(.36,.72);await page.mouse.click(end.x,end.y);await settle();
  check('group.shortcut.active_line_continues',(await state()).decor.length,chain.decor.length+1);
  await page.keyboard.press('Escape');await seed(records());await empty();await shortcut('a');
  await page.setViewportSize({width:850,height:1100});await settle();
  check('group.compact.no_second_properties',await panel.count(),0);check('group.compact.individual_contours',await card.locator('.hp-prop-group-contour').count(),records().length);
  await empty();await shortcut('m');check('group.compact.shortcuts_work',(await state()).ids,['furniture']);
  await page.setViewportSize({width:1600,height:1100});await settle();
  await empty();await shortcut('a');
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>({...cfg,settings:{...cfg.settings,external1038:true}})));
  check('group.external_revision_retires_selection',(await state()).ids,[]);
  await shortcut('a');
  await page.evaluate(()=>window.__hpTest.setServerConfig(cfg=>cfg));
  check('group.same_content_revision_retires_selection',(await state()).ids,[]);
  await shortcut('a');check('group.same_content_can_reselect_same_ids',(await state()).ids,records().map(x=>x.id));
  const many=Array.from({length:1000},(_,i)=>({...rect(`quota-${i}`,.12+(i%40)*.017,.15+Math.floor(i/40)*.022,i%2?'#ff0000':'#0000ff',(i%10)/10),w:.012,h:.012}));
  await seed(many);await empty();await shortcut('a');
  check('group.quota.all_1000_ids',(await state()).ids,many.map(x=>x.id));
  check('group.quota.all_1000_contours',await card.locator('.hp-prop-group-contour').count(),1000);
  const quotaBefore=await state();await alpha().fill('50');await alpha().press('Enter');await settle();
  const quotaSaved=await saved();
  check('group.quota.one_write',(await state()).writes,quotaBefore.writes+1);
  check('group.quota.one_history',(await state()).history,quotaBefore.history+1);
  check('group.quota.complete_records',quotaSaved,many.map(item=>({...item,opacity:.5})));
  check('group.no_services',await page.evaluate(()=>window.__serviceCalls.length),0);
  check('group.no_persistent_group_keys',(await saved()).every(item=>!Object.hasOwn(item,'group')&&!Object.hasOwn(item,'selected')));
  check('group.no_new_api_writes',await page.evaluate(()=>window.__1038Calls.filter(type=>/(?:set|update|delete|copy|upload|import)$/.test(type)).every(type=>type==='houseplan/config/set')));
  check('group.no_asset_requests',await page.evaluate(()=>window.__1038Calls.every(type=>!/(?:asset.*(?:set|delete|copy|upload)|files\/(?:upload|delete))/.test(type))));
  check('group.initial_selection_did_not_mutate_records',selection.decor,records());
}finally{
  console.log('group.empty_point_receipts',JSON.stringify(await page.evaluate(()=>window.__1038EmptyReceipts??[])));
  await finish(browser);
}
