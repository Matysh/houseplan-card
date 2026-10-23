// #1035: real menu/panel commands against the persisted demo writer.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1500, height: 1000 });
const card = page.locator('houseplan-card');
const panel = card.locator('[data-hp="properties-panel"]');
const menu = card.locator('[data-hp="decor-context-menu"]');
const state = () => page.evaluate(() => ({
  ids: window.__card._decorList.map(s => s.id),
  decor: structuredClone(window.__card._decorList),
  history: window.__card._geometryHistory.size,
  epoch: window.__card._cfgEpoch,
  selected: window.__card._decorSel,
}));
const settle = () => page.evaluate(async () => { await window.__hpTest.waitForWrites(); await window.__card.updateComplete; });
const select = async id => {
  const p=await point(id,id==='red'?.1:.8,id==='red'?.1:.8);
  await page.mouse.click(p.x,p.y);
  await page.evaluate(()=>window.__card.updateComplete);
};
const point = (id, x = .5, y = .5) => card.locator(`.decorlayer [data-id="${id}"]`).first().evaluate((node, [x,y]) => {
  if (node instanceof SVGPathElement) {
    const p=node.getPointAtLength(node.getTotalLength()*.25).matrixTransform(node.getScreenCTM());
    return {x:p.x,y:p.y};
  }
  const b = node.getBBox(), p = new DOMPoint(b.x + b.width * x, b.y + b.height * y).matrixTransform(node.getScreenCTM());
  return { x:p.x,y:p.y };
}, [x,y]);
const open = async (id, x, y) => { const p = await point(id,x,y); await page.mouse.click(p.x,p.y,{button:'right'}); await menu.waitFor(); };
const colorAt = async (id,x,y) => {
  const p=await point(id,x,y);
  const shot=await page.screenshot({clip:{x:Math.floor(p.x),y:Math.floor(p.y),width:1,height:1}});
  return page.evaluate(async base64=>{
    const img=new Image();img.src=`data:image/png;base64,${base64}`;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);return [...ctx.getImageData(0,0,1,1).data].slice(0,3);
  },shot.toString('base64'));
};

try {
  await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
  await page.evaluate(async () => {
    const c = window.__card;
    c.setConfig({ ...c._config, language:'ru' });
    const aid='a'.repeat(64), assetUrl=`/api/houseplan/content/assets/_/${aid}.svg`;
    const asset={asset_id:aid,name:'test.svg',mime:'image/svg+xml',width:100,height:50,bytes:100,url:assetUrl,used_by:[]};
    const content='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="orange"/></svg>');
    const call=c.hass.callWS.bind(c.hass);
    window.__orderCanWrite=true;window.__orderAssetMutations=[];
    c.hass={...c.hass,callWS:async message=>{
      if(message.type==='houseplan/assets/resolve'||message.type==='houseplan/assets/list')return {assets:[asset]};
      if(message.type.startsWith('houseplan/assets/')){window.__orderAssetMutations.push(message.type);throw new Error('Unexpected asset mutation');}
      if(message.type==='houseplan/content/sign')return {urls:Object.fromEntries(message.paths.map(path=>[path,path===assetUrl?content:path]))};
      const result=await call(message);
      return message.type==='houseplan/config/get'?{...result,can_write:window.__orderCanWrite,decor_assets_api:1}:result;
    }};
    await window.__hpTest.setServerConfig(cfg => {
      cfg.spaces = [{ id:'order', title:'Decor order', view_box:[0,0,1,1], cell_cm:5, rooms:[], decor:[
        { id:'red',kind:'rect',x:.1,y:.1,w:.3,h:.2,fill:true,fill_color:'#ff0000',fill_opacity:1,color:'#ff0000' },
        { id:'blue',kind:'rect',x:.2,y:.15,w:.3,h:.2,fill:true,fill_color:'#0000ff',fill_opacity:1,color:'#0000ff' },
        { id:'line',kind:'line',x1:.1,y1:.45,x2:.4,y2:.45,color:'#111111',width_cm:5 },
        { id:'ellipse',kind:'ellipse',x:.6,y:.1,w:.15,h:.1,fill:true,fill_color:'#dddddd',fill_opacity:1 },
        { id:'text',kind:'text',x:.3,y:.65,text:'Decor',size_cm:35 },
        { id:'furniture',kind:'furniture',x:.6,y:.4,w:.2,h:.15,symbol:'sofa' },
        { id:'image',kind:'image',x:.65,y:.7,w:.15,h:.1,asset_id:'a'.repeat(64),flip_h:true,opacity:.8 },
      ] }, { id:'other',title:'Other',rooms:[],decor:[] }];
      cfg.markers=[]; return cfg;
    });
    await window.__hpTest.switchSpace('order');
    await window.__hpTest.setMode('decor');
  });
  await panel.waitFor();
  await card.locator('[data-hp="zoom-fit"]').click();

  // All kinds use the existing panel; compare actual rectangles of both controls.
  for (const id of ['red','line','ellipse','text','furniture','image']) {
    await select(id);
    const geometry = await panel.evaluate(el => {
      const a=el.querySelector('[data-action="properties-decor-front"]').getBoundingClientRect();
      const b=el.querySelector('[data-action="properties-decor-back"]').getBoundingClientRect();
      const d=el.querySelector('[data-action="properties-delete"]').getBoundingClientRect();
      return Math.abs(a.top-b.top)<1 && a.right<=b.left && a.bottom<d.top && b.bottom<d.top && a.width>0 && b.width>0;
    });
    check(`order.panel_pair.${id}`,geometry);
  }
  const original = await state();
  check('order.initial_pixels_blue',await colorAt('red',.65,.65),[0,0,255]);
  await select('red');
  await panel.locator('[data-action="properties-decor-front"]').click(); await settle();
  let current=await state();
  check('order.front_preserves_siblings',current.ids,[...original.ids.slice(1),'red']);
  check('order.front_one_history',current.history,original.history+1);
  check('order.front_preserves_geometry',current.decor.find(s=>s.id==='red'),original.decor[0]);
  check('order.front_pixels_red',await colorAt('red',.65,.65),[255,0,0]);
  check('order.front_disabled',await panel.locator('[data-action="properties-decor-front"]').getAttribute('aria-disabled'),'true');
  await panel.locator('[data-action="properties-decor-front"]').evaluate(node=>node.click()); await settle();
  check('order.repeated_front_no_history_or_write',await state(),current);

  // The right click must choose the actually visible top object, not old selection.
  await select('image'); await open('red',.65,.65);
  check('order.right_selects_invoked_object',(await state()).selected,'red');
  check('order.right_shows_invoked_properties',await panel.locator('.hp-prop-title').innerText(),'Прямоугольник');
  check('order.menu_four',(await menu.locator('[role="menuitem"]').allTextContents()).map(s=>s.trim()),[
    'На передний план','На задний план','Удалить','Создать копию']);
  check('order.right_does_not_start_gesture',await page.evaluate(()=>!window.__card._decorMove&&!window.__card._decorDraft));
  await menu.locator('[data-action="decor-back"]').click(); await settle();
  check('order.menu_target_not_previous_selection',(await state()).ids,original.ids);
  check('order.menu_order_keeps_selection',(await state()).selected,'red');
  check('order.back_pixels_blue',await colorAt('red',.65,.65),[0,0,255]);
  check('order.menu_one_history',(await state()).history,original.history+2);
  await card.locator('[data-action="geometry-undo"]').click(); await settle();
  check('order.undo_front',(await state()).ids,[...original.ids.slice(1),'red']);
  await card.locator('[data-action="geometry-redo"]').click(); await settle();
  check('order.redo_back',(await state()).ids,original.ids);

  await open('blue',.8,.8);
  const beforeClose=await state();
  await page.keyboard.press('Escape');
  check('order.escape_closes',await menu.count(),0);
  check('order.escape_no_command',await state(),beforeClose);
  check('order.escape_keeps_selection',(await state()).selected,'blue');
  await open('blue',.8,.8);
  const empty=await card.locator('.stage').boundingBox();
  await page.mouse.click(empty.x+empty.width-15,empty.y+empty.height-15);
  check('order.outside_closes',await menu.count(),0);
  check('order.outside_no_command',await state(),beforeClose);

  // A drawing tool remains armed, but right-click and dismissal do not draw.
  await card.locator('[data-editor-group="shapes"]').click();
  await card.locator('[data-tool="rect"]').click();
  await open('blue',.8,.8);
  const drawingState=await state();
  await page.mouse.click(empty.x+empty.width-15,empty.y+empty.height-15);
  check('order.dismiss_under_drawing_tool_no_shape',await state(),drawingState);
  check('order.dismiss_under_drawing_tool_no_gesture',await page.evaluate(()=>!window.__card._decorDraft&&!window.__card._decorMove));
  await card.locator('[data-tool="select"]').click();

  // Invalid property input is an ordinary input, never a bypassed implementation.
  await select('blue');
  const invalidBefore=await state();
  const width=panel.locator('[data-property="w"] input');
  await width.fill('-1');
  await panel.locator('[data-action="properties-decor-front"]').click();
  check('order.invalid_field_blocks_order',(await state()).ids,invalidBefore.ids);
  check('order.invalid_field_no_history',(await state()).history,invalidBefore.history);
  await width.press('Escape');

  for (const id of ['red','line','ellipse','text','furniture','image']) {
    // For a line the midpoint is on the painted stroke; all others have a body.
    await open(id,.8,.8);
    const before=await state();
    await menu.locator('[data-action="decor-copy"]').click(); await settle();
    const after=await state(), copy=after.decor[after.decor.length-1];
    check(`order.copy_selected.${id}`,copy.id===after.selected && !before.ids.includes(copy.id));
    check(`order.copy_source_unchanged.${id}`,after.decor.find(s=>s.id===id),before.decor.find(s=>s.id===id));
    check(`order.copy_one_history.${id}`,after.history,before.history+1);
    if(id==='image') {
      check('order.image_shared_asset',copy.asset_id,before.decor.find(s=>s.id===id).asset_id);
      check('order.image_catalog_not_duplicated',await page.evaluate(async()=>(await window.__card.hass.callWS({type:'houseplan/assets/list'})).assets.length),1);
      await panel.locator('[data-action="properties-delete"]').click(); await settle();
      check('order.image_original_still_rendered',await card.locator('.decorlayer .dimage[data-id="image"]').count(),1);
      await card.locator('[data-action="geometry-undo"]').click(); await settle();
      check('order.delete_undo_restores_copy',(await state()).ids,after.ids);
      await card.locator('[data-action="geometry-redo"]').click(); await settle();
      check('order.delete_redo_removes_copy',(await state()).ids,before.ids);
      check('order.image_no_asset_mutation',await page.evaluate(()=>window.__orderAssetMutations),[]);
    } else {
      await card.locator('[data-action="geometry-undo"]').click(); await settle();
      check(`order.copy_undo.${id}`,(await state()).ids,before.ids);
      await card.locator('[data-action="geometry-redo"]').click(); await settle();
      check(`order.copy_redo.${id}`,(await state()).decor,after.decor);
      await card.locator('[data-action="geometry-undo"]').click(); await settle();
    }
  }
  // Copy finishes an armed placement just like creating an object normally.
  for(const tool of ['furniture','image']) {
    await card.locator(`[data-tool="${tool}"]`).click();
    if(tool==='furniture') {
      await card.locator('.furnpalette .furnitem[data-category="sofa"]').click();
      await card.locator('.furnpalette .furnitem[data-symbol="sofa"]').click();
    } else await card.locator('.imagepalette .imageasset .furnitem').click();
    await open('blue',.8,.8);
    const armedBefore=await state();
    await menu.locator('[data-action="decor-copy"]').click();await settle();
    check(`order.armed_copy_one_object.${tool}`,(await state()).ids.length,armedBefore.ids.length+1);
    check(`order.armed_copy_finishes_preview.${tool}`,await card.locator('.furniture-placement-preview, .decor-image-placement-preview').count(),0);
    await card.locator(`[data-tool="${tool}"]`).click();
    const armedCopy=await state();
    await page.mouse.click(empty.x+empty.width-15,empty.y+empty.height-15);
    check(`order.reopened_palette_does_not_stamp_old_symbol.${tool}`,(await state()).ids,armedCopy.ids);
    await card.locator('[data-action="geometry-undo"]').click();await settle();
  }
  await select('image');
  mkdirSync('artifacts/decor-order',{recursive:true});
  for (const dark of [false,true]) {
    await page.evaluate(async dark=>{const c=window.__card;c.hass={...c.hass,themes:{...c.hass.themes,darkMode:dark}};await c.updateComplete;},dark);
    await page.mouse.move(5,5);
    await panel.screenshot({path:`artifacts/decor-order/panel-${dark?'dark':'light'}.png`});
    check(`order.theme.${dark?'dark':'light'}`,await panel.getAttribute('data-theme'),dark?'dark':'light');
  }
  await page.evaluate(async()=>{const c=window.__card;c.setConfig({...c._config,language:'en'});await c.updateComplete;});
  check('order.english_front',await panel.locator('[data-action="properties-decor-front"]').innerText(),'Bring to front');
  check('order.english_back',await panel.locator('[data-action="properties-decor-back"]').innerText(),'Send to back');
  await open('blue',.8,.8);
  check('order.english_menu',(await menu.locator('button').allTextContents()).map(s=>s.trim()),['Bring to front','Send to back','Delete','Create a copy']);
  await page.keyboard.press('Escape');

  // External configuration updates and leaving the editor revoke open menus.
  await open('blue',.8,.8);
  let stale=await menu.locator('[data-action="decor-copy"]').elementHandle();
  await page.evaluate(async()=>window.__hpTest.setServerConfig(cfg=>({...cfg,title:'external'})));
  check('order.external_revision_closes',await menu.count(),0);
  let revoked=await state();await stale.evaluate(el=>el.click());await settle();
  check('order.external_revision_revokes_callback',await state(),revoked);

  await open('blue',.8,.8); stale=await menu.locator('[data-action="decor-copy"]').elementHandle();
  await page.evaluate(async()=>window.__hpTest.switchSpace('other'));
  revoked=await state();await stale.evaluate(el=>el.click());await settle();
  check('order.other_space_revokes_callback',await state(),revoked);
  await page.evaluate(async()=>window.__hpTest.switchSpace('order'));

  await open('blue',.8,.8); stale=await menu.locator('[data-action="decor-copy"]').elementHandle();
  await page.evaluate(async()=>{window.__orderCanWrite=false;await window.__hpTest.setServerConfig(cfg=>cfg);});
  check('order.readonly_closes',await menu.count(),0);
  revoked=await state();await stale.evaluate(el=>el.click());await settle();
  check('order.readonly_revokes_callback',await state(),revoked);
  await page.evaluate(async()=>{window.__orderCanWrite=true;await window.__hpTest.setServerConfig(cfg=>cfg);await window.__hpTest.setMode('decor');});

  await open('blue',.8,.8);
  stale=await menu.locator('[data-action="decor-copy"]').elementHandle();
  await page.evaluate(async()=>window.__hpTest.setMode('view'));
  check('order.view_has_no_menu',await menu.count(),0);
  check('order.view_has_no_panel',await panel.count(),0);
  revoked=await state();await stale.evaluate(el=>el.click());await settle();
  check('order.view_revokes_callback',await state(),revoked);
  const p=await point('blue',.8,.8);await page.mouse.click(p.x,p.y,{button:'right'});
  check('order.view_right_click_no_menu',await menu.count(),0);
  const preReload=await state();
  await page.evaluate(()=>{
    const c=window.__card,replacement=document.createElement('houseplan-card');
    replacement.setConfig({...c._config});replacement.hass=c.hass;c.replaceWith(replacement);window.__card=replacement;
  });
  await page.waitForFunction(()=>window.__card._loadOk&&window.__card._decorList.length>0);
  await page.waitForFunction(()=>!window.__card.renderRoot.querySelector('.stage.hpboot, .stage.mode-transition'));
  check('order.server_reload_keeps_array',(await state()).decor,preReload.decor);
  const persisted=await page.evaluate(async()=>{
    const c=window.__card;const cfg=(await c.hass.callWS({type:'houseplan/config/get'})).config;
    return JSON.parse(JSON.stringify(cfg)).spaces.find(s=>s.id==='order').decor;
  });
  check('order.saved_roundtrip',(await state()).decor,persisted);
  await page.setViewportSize({width:390,height:900});
  await page.evaluate(async()=>window.__hpTest.setMode('decor'));
  await card.locator('[data-hp="zoom-fit"]').click();
  await open('blue',.8,.8);
  const box=await menu.boundingBox();
  check('order.narrow_menu_inside_viewport',box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=900);
  await page.keyboard.press('Escape');
  await select('blue');
  await page.waitForFunction(()=>window.__card._decorSel==='blue');
  check('order.narrow_actions_exist',await card.locator('[data-action="decor-front"]').count(),1);
  check('order.narrow_all_actions_visible',await card.locator('.editor-secondary').evaluate(el=>{
    const panel=el.getBoundingClientRect();
    return ['decor-properties','decor-front','decor-back','decor-delete'].every(action=>{
      const button=el.querySelector(`[data-action="${action}"]`),r=button?.getBoundingClientRect();
      return r&&r.width>0&&r.height>0&&r.left>=Math.max(panel.left,0)&&r.right<=Math.min(panel.right,innerWidth)
        &&r.top>=Math.max(panel.top,0)&&r.bottom<=Math.min(panel.bottom,innerHeight);
    });
  }));
  check('order.narrow_no_horizontal_overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  writeFileSync('artifacts/decor-order/config.json',JSON.stringify(await page.evaluate(async()=>
    (await window.__card.hass.callWS({type:'houseplan/config/get'})).config),null,2)+'\n');
  await open('blue',.8,.8);stale=await menu.locator('[data-action="decor-copy"]').elementHandle();
  await page.evaluate(()=>window.__card.remove());revoked=await state();
  await stale.evaluate(el=>el.click());
  check('order.disconnect_revokes_callback',await state(),revoked);
  await finish(browser);
} catch(error) { await browser.close(); throw error; }
