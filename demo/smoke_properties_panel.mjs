// #931: real panel controls and native selection against the persisted harness writer.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { mkdirSync } from 'node:fs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1920, height: 1080 });
const card = page.locator('houseplan-card');
const panel = card.locator('[data-hp="properties-panel"]');
await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
try {
  check('properties.view_absent', await panel.count(), 0);
  await page.evaluate(async () => {
    const c = window.__card;
    await window.__hpTest.waitForWrites();
    c.setConfig({ ...c._config, language: 'ru' });
    window.__addRegistryEntity('sensor.kitchen_temperature','kitchen','22.4','demo',{},
      {friendly_name:'Температура на кухне',unit_of_measurement:'°C'});
    await window.__hpTest.setServerConfig(cfg => {
      cfg.spaces = [{ id: 'properties', title: 'Первый этаж', view_box: [0,0,1,1], cell_cm: 5, rooms: [], wall_segments: [],
        plan_url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="gray"/></svg>'),plan_aspect:1,plan_opacity:.7,
        partitions: [{ id: 'wall', a: [.2,.35], b: [.5,.35], cm: 12 }],
        wall_columns: [{ id: 'column', shape: 'square', center: [.7,.3], cm: 30, angle: 0 }],
        openings: [{ id: 'door', type: 'door', x: .3, y: .35, angle: 0, length: .075, host: { kind: 'partition', id: 'wall', t: 1/3 } }],
        decor: [
          { id: 'rect', kind: 'rect', x: .15, y: .5, w: .25, h: .125, angle: 15, color: '#718B82', opacity: 1, fill: true, fill_color: '#C4D5CF', fill_opacity: .65, width_cm: 2 },
          { id: 'text', kind: 'text', x: .5, y: .65, text: 'На кухне {sensor.kitchen_temperature}', color: '#526871', size_cm: 22.5 },
          { id:'image',kind:'image',x:.5,y:.6,w:.2,h:.1,asset_id:'a'.repeat(64),opacity:.8 },
        ] }];
      cfg.markers = [{ id: 'panel-light', binding: 'virtual', space: 'properties', name: 'Подсветка кухни', icon: 'mdi:lightbulb', size: 1,
        description: 'keep', angle: 0, glow_color: { c: '#123456', bri: null } }];
      return cfg;
    });
    c._commitSpace('properties');
    await window.__hpTest.setLayout(layout => ({ ...layout, 'panel-light': { s: 'properties', x: .6, y: .222222, k: 1.3 } }));
    await window.__hpTest.setMode('plan');
  });
  await panel.waitFor({ state: 'visible' });
  check('properties.empty_title', await panel.locator('.hp-prop-title').innerText(), 'Ничего не выбрано');
  check('properties.fixed_width', Math.round((await panel.boundingBox()).width), 360);
  check('properties.empty_keeps_three_groups', await panel.locator('.hp-prop-group').count(), 3);
  check('properties.empty_disabled_delete', await panel.locator('.delete').getAttribute('aria-disabled'), 'true');
  await card.locator('[data-hp="zoom-fit"]').click();
  await card.locator('[data-hp="partition"][data-id="wall"]').click();
  await page.waitForFunction(() => window.__card.renderRoot.querySelector('.hp-prop-title')?.textContent === 'Независимая стена');
  check('properties.wall_hosted_width_label', await panel.locator('[data-property="cm"] label').innerText(), 'Толщина стены');
  const thickness = panel.locator('[data-property="cm"] input');
  await thickness.fill('14'); await thickness.press('Enter');
  await page.waitForFunction(() => !window.__card._editorRuntime.properties.fields.draft);
  check('properties.wall_saved', await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config.spaces.find(s => s.id === 'properties').partitions[0].cm), 14);
  const history = await page.evaluate(() => window.__card._geometryHistory.size);
  await thickness.press('Tab');
  check('properties.enter_blur_no_duplicate_history', await page.evaluate(() => window.__card._geometryHistory.size), history);
  await thickness.fill('101'); await thickness.press('Enter');
  check('properties.invalid_field_error', await panel.locator('[role="alert"]').count(), 1);
  const opening=card.locator('.opening[data-id="door"] .op-hit');
  await opening.click();
  check('properties.invalid_blocks_selection_change', await panel.locator('.hp-prop-title').innerText(), 'Независимая стена');
  await thickness.press('Escape');
  await opening.click();
  check('properties.native_opening_hit_selected',await panel.locator('.hp-prop-title').innerText(),'Дверной проём');
  check('properties.opening_single_click_no_dialog',await card.locator('hp-dialog').count(),0);
  await panel.locator('[data-property="length"] input').fill('80');
  await panel.locator('[data-property="length"] input').press('Enter');
  await page.waitForFunction(()=>!window.__card._editorRuntime.properties.fields.draft);
  const door=await page.evaluate(async()=>(await window.__card.hass.callWS({type:'houseplan/config/get'})).config.spaces.find(s=>s.id==='properties').openings[0]);
  check('properties.opening_width_keeps_centre',Math.abs(door.x-.3)<1e-9);
  check('properties.opening_width_saved',Math.abs(door.length-80/1200)<1e-9);
  await card.locator('[data-hp="wall-column"][data-id="column"]').click();
  check('properties.column_selected',await panel.locator('.hp-prop-title').innerText(),'Колонна');
  await panel.locator('[data-property="shape"] button').last().click();
  await page.waitForFunction(()=>!window.__card._editorRuntime.properties.fields.draft);
  check('properties.circle_disables_angle',await panel.locator('[data-property="angle"]').evaluate(el=>el.classList.contains('disabled')),true);
  await page.setViewportSize({ width: 959, height: 1080 });
  await panel.waitFor({ state: 'hidden' });
  check('properties.narrow_absent', await panel.count(), 0);
  await page.setViewportSize({ width: 960, height: 1080 });
  await panel.waitFor({ state: 'visible' });
  check('properties.threshold_960', Math.round((await panel.boundingBox()).width), 360);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(async () => { await window.__hpTest.setMode('devices'); });
  await card.locator('[data-hp="zoom-fit"]').click();
  const marker = card.locator('.dev[data-hp="device"][data-id="panel-light"]');
  await marker.click();
  check('properties.device_single_select', await panel.locator('.hp-prop-title').innerText(), 'Подсветка кухни');
  check('properties.single_click_no_dialog', await card.locator('hp-dialog[data-kind="marker"]').count(), 0);
  const x = panel.locator('[data-property="x"] input');
  await x.fill('800'); await x.press('Enter');
  await page.waitForFunction(() => !window.__card._editorRuntime.properties.fields.draft);
  const position = await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/layout/get' })).layout['panel-light']);
  check('properties.device_x', Math.abs(position.x - 800/1200) < 1e-6);
  check('properties.device_untouched_y', position.y, .222222);
  check('properties.device_layout_sibling', position.k, 1.3);
  const scale = panel.locator('[data-property="size"] input');
  await scale.fill('120'); await scale.press('Enter');
  await page.waitForFunction(() => !window.__card._editorRuntime.properties.fields.draft);
  const saved = await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config.markers.find(m => m.id === 'panel-light'));
  check('properties.device_scale', saved.size, 1.2); check('properties.marker_sibling', saved.description, 'keep');
  check('properties.marker_null_sibling', saved.glow_color.bri, null);
  await panel.locator('[data-property="settings"] button').click();
  await card.locator('hp-dialog').waitFor({ state: 'visible' });
  check('properties.full_dialog_makes_panel_inert', await panel.getAttribute('inert'), '');
  await page.keyboard.press('Escape');
  await page.evaluate(async () => { await window.__hpTest.setMode('decor'); window.__card._editorRuntime.properties.select('rect','rect'); });
  await panel.locator('[data-property="w"] input').fill('360');
  await panel.locator('[data-property="w"] input').press('Enter');
  await page.waitForFunction(() => !window.__card._editorRuntime.properties.fields.draft);
  const rect = await page.evaluate(async () => (await window.__card.hass.callWS({ type: 'houseplan/config/get' })).config.spaces.find(s=>s.id==='properties').decor.find(s=>s.id==='rect'));
  check('properties.decor_centre_preserved', Math.abs(rect.x + rect.w/2 - .275) < 1e-12);
  check('properties.decor_fill_unchanged', rect.fill_opacity, .65);
  check('properties.fill_swatch_solid',await panel.locator('[data-property="fill"] hp-color-opacity').evaluate(el=>{
    const trigger=el.shadowRoot.querySelector('.trigger'),swatch=el.shadowRoot.querySelector('.swatch');
    return !el.coverSwatch && el.flatSwatch && getComputedStyle(trigger).backgroundImage==='none'
      && getComputedStyle(swatch).opacity==='1' && Math.round(trigger.getBoundingClientRect().width)===15;
  }),true);
  const select=async(mode,kind,id,binding)=>{
    await page.evaluate(async({mode,kind,id,binding})=>{await window.__hpTest.setMode(mode);window.__card._editorRuntime.properties.select(kind,id,binding);},{mode,kind,id,binding});
    await page.waitForFunction(()=>!window.__card._modeTransitionBusy);
  };
  const finishField=async(key,value)=>{
    const field=panel.locator(`[data-property="${key}"] input`);
    await field.fill(String(value));await field.press('Enter');
    await page.waitForFunction(()=>!window.__card._editorRuntime.properties.fields.draft);
  };
  const savedSpace=()=>page.evaluate(async()=> (await window.__card.hass.callWS({type:'houseplan/config/get'})).config.spaces.find(s=>s.id==='properties'));
  // Pure resize must neither commit nor discard a number draft.
  await panel.locator('[data-property="w"] input').fill('400');
  await page.setViewportSize({width:959,height:1080});await panel.waitFor({state:'hidden'});
  check('properties.responsive_draft_not_written',(await savedSpace()).decor[0].w,rect.w);
  await page.setViewportSize({width:1920,height:1080});await panel.waitFor();
  check('properties.responsive_draft_retained',await panel.locator('[data-property="w"] input').inputValue(),'400');
  await panel.locator('[data-property="w"] input').press('Escape');
  // The existing picker previews locally; even invalid internal HEX must survive suspension.
  let picker=panel.locator('[data-property="stroke"] hp-color-opacity');
  await picker.locator('.trigger').click();
  await picker.locator('input[type="text"]').fill('#12');
  await page.setViewportSize({width:959,height:1080});await panel.waitFor({state:'hidden'});
  await page.setViewportSize({width:1920,height:1080});await panel.waitFor();
  picker=panel.locator('[data-property="stroke"] hp-color-opacity');
  await picker.locator('.trigger').click();
  check('properties.responsive_hex_retained',await picker.locator('input[type="text"]').inputValue(),'#12');
  await picker.locator('.confirm').click();
  check('properties.invalid_hex_blocks_confirmation',await picker.locator('.trigger').getAttribute('aria-expanded'),'true');
  check('properties.invalid_hex_no_write',(await savedSpace()).decor[0].color,rect.color);
  await picker.locator('input[type="text"]').fill('#123456');
  check('properties.colour_preview_no_write',(await savedSpace()).decor[0].color,rect.color);
  const beforeColor=await page.evaluate(()=>window.__card._geometryHistory.size);
  await picker.locator('.confirm').click();await page.waitForFunction(()=>!window.__card._editorRuntime.properties.fields.draft);
  check('properties.confirm_colour_one_command',await page.evaluate(()=>window.__card._geometryHistory.size),beforeColor+1);
  check('properties.confirm_colour_value',(await savedSpace()).decor[0].color,'#123456');
  await select('decor','image','image');await finishField('w',360);
  let image=(await savedSpace()).decor.find(s=>s.id==='image');
  check('properties.image_ratio',Math.abs(image.w/image.h-2)<1e-12);
  check('properties.image_centre',Math.abs(image.x+image.w/2-.6)<1e-12);
  await panel.locator('[data-property="ratio"] button').click();await finishField('w',480);
  image=(await savedSpace()).decor.find(s=>s.id==='image');
  check('properties.image_unlocked_preserves_height',image.h,.15);
  await select('decor','text','text');
  const text=panel.locator('textarea');await text.fill('На кухне ');
  await panel.locator('.hp-prop-variable').click();
  const variable=card.locator('hp-dialog[data-kind="properties-variable"]');
  await variable.locator('.hpf-pick').click();
  await variable.locator('.hpf-cand').filter({hasText:'sensor.kitchen_temperature'}).click();
  check('properties.variable_preview_resolves',await variable.locator('.hp-prop-preview strong').innerText(),'На кухне 22.4 °C');
  await variable.locator('.hp-prop-variable-footer button').first().click();
  check('properties.variable_cancel_keeps_draft',await text.inputValue(),'На кухне ');
  check('properties.variable_cancel_no_write',(await savedSpace()).decor.find(s=>s.id==='text').text,'На кухне {sensor.kitchen_temperature}');
  await text.press('End');await text.press('Enter');await text.type('Строка');
  check('properties.enter_is_newline',(await text.inputValue()).includes('\n'),true);
  await text.press('Control+Enter');await page.waitForFunction(()=>!window.__card._editorRuntime.properties.fields.draft);
  check('properties.multiline_saved',(await savedSpace()).decor.find(s=>s.id==='text').text,'На кухне \nСтрока');
  await text.fill('Значение: ');await text.press('End');
  await panel.locator('.hp-prop-variable').click();
  await variable.locator('.hpf-pick').click();
  await variable.locator('.hpf-cand').filter({hasText:'sensor.kitchen_temperature'}).click();
  await variable.locator('.hp-prop-variable-footer .insert').click();
  await variable.waitFor({state:'hidden'});
  check('properties.variable_insert_saved',(await savedSpace()).decor.find(s=>s.id==='text').text,'Значение: {sensor.kitchen_temperature}');
  check('properties.variable_insert_caret',await text.evaluate(el=>el.selectionStart),'Значение: {sensor.kitchen_temperature}'.length);
  await page.evaluate(()=>{
    const c=window.__card,call=c.hass.callWS.bind(c.hass);
    let release;const promise=new Promise(resolve=>{release=resolve;});
    window.__931Pending={hold:true,release:()=>{window.__931Pending.hold=false;release();}};
    c.hass={...c.hass,callWS:async message=>{if(message.type==='houseplan/config/set'&&window.__931Pending.hold)await promise;return call(message);}};
  });
  await text.fill('Сохранение с задержкой');await text.press('Control+Enter');
  await page.waitForFunction(()=>window.__card._editorRuntime.properties.fields.draft?.pending);
  check('properties.pending_text_is_disabled',await text.isDisabled(),true);
  check('properties.pending_sibling_input_is_disabled',await panel.locator('[data-property="x"] input').isDisabled(),true);
  await page.evaluate(async()=>{
    const c=window.__card;c._editorRuntime._openDecorProperties(c._decorList.find(s=>s.id==='text'));await c.updateComplete;
  });
  check('properties.pending_native_dialog_waits_for_ack',await card.locator('hp-dialog').count(),0);
  await page.evaluate(()=>window.__931Pending.release());
  await page.waitForFunction(()=>!window.__card._editorRuntime.properties.fields.draft);
  await card.locator('hp-dialog').waitFor();
  check('properties.pending_native_dialog_inert_after_ack',await panel.getAttribute('inert'),'');
  await page.keyboard.press('Escape');await card.locator('hp-dialog').waitFor({state:'hidden'});
  check('properties.pending_text_saved_once',(await savedSpace()).decor.find(s=>s.id==='text').text,'Сохранение с задержкой');
  await select('decor','backdrop','properties');await finishField('opacity',0);
  check('properties.reset_uses_reference_glyph',await panel.locator('[data-property="reset"] path').getAttribute('d'),'M3 8h11a7 7 0 0 1 0 14M3 8l5-5M3 8l5 5');
  await panel.locator('.delete').hover();
  await card.locator('.hp-chrome-tooltip').waitFor({state:'visible'});
  check('properties.backdrop_delete_explains_action',(await card.locator('.hp-chrome-tooltip').innerText()).replace(/\s+/g,' '),'Чтобы убрать картинку, измените вид подложки в настройках пространства.');
  check('properties.opacity_zero_saved',(await savedSpace()).plan_opacity,0);
  await panel.locator('[data-property="reset"] button').click();await page.evaluate(()=>window.__hpTest.waitForWrites());
  check('properties.reset_preserves_zero_opacity',(await savedSpace()).plan_opacity,0);
  await select('devices','device','panel-light','virtual');await finishField('angle',15);
  await card.locator('[data-device-position-history="undo"]').click();
  await page.waitForFunction(()=>!window.__card._devicePositionBusy);
  check('properties.device_undo_angle',(await page.evaluate(async()=> (await window.__card.hass.callWS({type:'houseplan/config/get'})).config.markers.find(m=>m.id==='panel-light'))).angle,0);
  check('properties.no_ha_services',await page.evaluate(()=>window.__serviceCalls.length),0);
  await page.evaluate(async()=>{
    await window.__hpTest.setServerConfig(cfg=>({...cfg,spaces:[...cfg.spaces,{id:'matrix',title:'Matrix',cell_cm:5,rooms:[],wall_segments:[],
      plan_url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"/>'),plan_aspect:1,
      partitions:[{id:'p',a:[.1,.1],b:[.9,.1],cm:10}],wall_columns:[{id:'c',center:[.3,.3],shape:'square',cm:20}],
      openings:['door','window','gate','passage'].map((type,i)=>({id:type,type,x:.2+i*.18,y:.1,length:.08,angle:0,host:{kind:'partition',id:'p',t:(.1+i*.18)/.8}})),
      stairs:[{id:'straight',kind:'straight',x:.5,y:.4,length:.2,width:.1,angle:30,direction:'forward'},
        {id:'spiral',kind:'spiral',x:.7,y:.7,radius:.1,angle:15,direction:'clockwise'}],
      decor:[{id:'line',kind:'line',x1:.1,y1:.1,x2:.3,y2:.2},
        ...['rect','ellipse','image','furniture'].map(kind=>({id:kind,kind,x:.2,y:.3,w:.3,h:.2,...(kind==='image'?{asset_id:'a'.repeat(64)}:kind==='furniture'?{symbol:'sofa'}:{})})),
        {id:'text',kind:'text',x:.5,y:.5,text:'Matrix',size_cm:20}],
      led_strips:[{id:'led',points:[[.1,.7],[.3,.7]]}],
    }]}));
    await window.__hpTest.switchSpace('matrix');
  });
  const beforeSelectionOnly=await page.evaluate(async()=>(await window.__card.hass.callWS({type:'houseplan/config/get'})).config);
  for(const [mode,kind,id] of [
    ['plan','partition','p'],['plan','column','c'],...['door','window','gate','passage'].map(id=>['plan','opening',id]),
    ['plan','stair','straight'],['plan','stair','spiral'],...['line','rect','ellipse','text','furniture','image'].map(id=>['decor',id,id]),
    ['decor','backdrop','matrix'],['devices','led','led'],
  ]){
    await select(mode,kind,id,kind==='led'?'':undefined);
    if(kind==='backdrop')await page.evaluate(()=>window.__hpTest.setTool('backdrop'));
    check(`properties.matrix_${id}_selected`,await panel.locator('.hp-prop-title').innerText()!=='Ничего не выбрано',true);
    check(`properties.matrix_${id}_three_common_groups`,await panel.locator('.position,.geometry,.appearance').count(),3);
    check(`properties.matrix_${id}_no_error`,await panel.locator('[role="alert"]').count(),0);
    if(kind!=='led') {
      console.log('dialog matrix',mode,kind,id);
      const openFull=()=>page.evaluate(async({kind,id})=>{
        const c=window.__card,r=c._editorRuntime;
        if(kind==='partition'||kind==='column')r._openPhysicalDialog(kind,id);
        else if(kind==='opening')r._editOpening(c._openingsR.find(o=>o.id===id));
        else if(kind==='stair')c.renderRoot.querySelector(`[data-hp="stair"][data-id="${id}"]`).dispatchEvent(new MouseEvent('dblclick',{bubbles:true,composed:true}));
        else if(kind==='backdrop')r._openBackdropDialog();
        else r._openDecorProperties(c._decorList.find(s=>s.id===id));
        c.requestUpdate();await c.updateComplete;
      },{kind,id});
      const input=panel.locator('.hp-prop-field:not(.readonly):not(.disabled) input').first();
      await input.fill('');await openFull();
      await page.waitForFunction(()=>!window.__card._editorRuntime.properties.handoff);
      check(`properties.dialog_${id}_invalid_blocks`,await card.locator('hp-dialog').count(),0);
      check(`properties.dialog_${id}_invalid_retained`,await panel.locator('[role="alert"]').count(),1);
      await input.press('Escape');
      await openFull();await card.locator('hp-dialog').waitFor();
      check(`properties.dialog_${id}_wide_inert`,await panel.getAttribute('inert'),'');
      await page.keyboard.press('Escape');await card.locator('hp-dialog').waitFor({state:'hidden'});
      await input.fill('');
      await page.setViewportSize({width:959,height:1080});await panel.waitFor({state:'hidden'});
      await openFull();await card.locator('hp-dialog').waitFor();
      check(`properties.dialog_${id}_narrow_discards_hidden_draft`,await page.evaluate(()=>window.__card._editorRuntime.properties.fields.draft),null);
      await page.keyboard.press('Escape');await card.locator('hp-dialog').waitFor({state:'hidden'});
      await page.setViewportSize({width:1920,height:1080});await panel.waitFor();
    }
  }
  check('properties.selection_matrix_no_config_write',await page.evaluate(async()=>(await window.__card.hass.callWS({type:'houseplan/config/get'})).config),beforeSelectionOnly);
  // HA's explicit mode wins; without it the actual CSS palette follows the
  // browser scheme. Checking the data attribute alone missed the golden defect.
  for (const media of ['dark','light']) {
    await page.emulateMedia({colorScheme:media});
    for (const dark of [undefined,false,true]) {
      await page.evaluate(async dark=>{
        const c=window.__card, themes={...c.hass.themes};
        if(dark==null) delete themes.darkMode; else themes.darkMode=dark;
        c.style.setProperty('--card-background-color','#152331');
        c.style.setProperty('--primary-text-color','#e5edf5');
        c.hass={...c.hass,themes}; await c.updateComplete;
      },dark);
      const actual=await panel.evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,ink:s.color};});
      const isDark=dark??media==='dark';
      check(`properties.theme_pixels_${media}_${dark??'auto'}`,actual,isDark
        ? {background:'rgb(21, 35, 49)',ink:'rgb(229, 237, 245)'}
        : {background:'rgb(255, 255, 255)',ink:'rgb(40, 52, 60)'});
    }
  }
  await page.evaluate(()=>{const c=window.__card;c.style.removeProperty('--card-background-color');c.style.removeProperty('--primary-text-color');c.hass={...c.hass,themes:{...c.hass.themes,darkMode:true}};});
  // Short-height and large text keep the pinned footer and a scrollable form.
  await page.setViewportSize({width:1000,height:480});
  await page.evaluate(()=>window.__hpTest.settled());
  check('properties.short_footer_accessible',await panel.locator('.hp-prop-foot').evaluate(el=>{const r=el.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0;}),true);
  check('properties.short_form_scrollable',await panel.locator('.hp-prop-scroll').evaluate(el=>el.scrollHeight>el.clientHeight),true);
  await page.setViewportSize({width:1920,height:1080});
  mkdirSync('output/properties-931', { recursive: true });
  await page.screenshot({ path: 'output/properties-931/first-rectangle.png' });
} catch (error) {
  console.error(await page.evaluate(() => { const c=window.__card;return { mode:c._mode,canEdit:c._canEdit, norm:c._norm, load:c._loadOk, connected:c.isConnected,
    propsWidth:c._editorRuntime?.properties?.width, propsAllowed:c._editorRuntime?.properties?.allowed, draft:c._editorRuntime?.properties?.fields?.draft, toast:c._toast }; }));
  throw error;
} finally { await finish(browser); }
