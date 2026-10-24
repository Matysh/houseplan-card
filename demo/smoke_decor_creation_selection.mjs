// #1047: create with real mouse gestures; no programmatic selection between A/B/C.
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';

requirePinnedBrowser();
const { page, browser } = await launch({ width: 1500, height: 1000 });
const card = page.locator('houseplan-card');
const panel = card.locator('[data-hp="properties-panel"]');
const settle = () => page.evaluate(async () => {
  await window.__hpTest.waitForWrites();
  await window.__card.updateComplete;
  await window.__card._editorRuntime._whenLiveEditorSettled();
});
const state = () => page.evaluate(() => ({
  decor: structuredClone(window.__card._decorList),
  native: window.__card._decorSel,
  identity: window.__card._editorRuntime.properties.identity?.objectId ?? null,
  tool: window.__card._decorTool,
}));
const point = (x, y) => card.locator('.decorlayer').evaluate((stage, [x,y]) => {
  const p = new DOMPoint(x * 1000, y * 1000).matrixTransform(stage.getScreenCTM());
  return { x: p.x, y: p.y };
}, [x,y]);
const uncoveredPoint = () => card.evaluate(c => {
  const matrix=c.renderRoot.querySelector('.decorlayer').getScreenCTM();
  for(const [x,y] of [[.6,.15],[.2,.15],[.8,.15],[.15,.6],[.8,.6]]) {
    const p=new DOMPoint(x*1000,y*1000).matrixTransform(matrix);
    const target=c.renderRoot.elementFromPoint(p.x,p.y);
    if(target?.closest('.stage')&&!target.closest('.editor-secondary'))return {x:p.x,y:p.y};
  }
  throw new Error('No unobscured canvas point for placement');
});
const drag = async (a = [.2,.3], b = [.4,.4]) => {
  const from = await point(...a), to = await point(...b);
  if ((await state()).tool === 'line') {
    await page.mouse.click(from.x,from.y); await page.mouse.click(to.x,to.y); await settle(); return;
  }
  await page.mouse.move(from.x,from.y); await page.mouse.down();
  await page.mouse.move(to.x,to.y,{steps:8}); await page.mouse.up(); await settle();
};
const tool = async kind => {
  if (['line','rect','ellipse'].includes(kind)) {
    await card.locator('[data-editor-group="shapes"]').click();
    await card.locator(`[data-group-item="${kind}"]`).click();
  } else await card.locator(`[data-hp="tool"][data-tool="${kind}"]`).click();
  await settle();
};
const assertSelected = async (name, wide = true) => {
  const s = await state(), last = s.decor.at(-1);
  check(`${name}.native`,s.native,last.id);
  if (wide) {
    check(`${name}.panel`,s.identity,last.id);
    check(`${name}.single_outline`,await card.locator('.hp-prop-selection').count(),1);
    // The actual painted outline must use the new object's coordinates.
    const frame = card.locator('.hp-prop-selection');
    if (last.kind === 'line') check(`${name}.frame_geometry`,await frame.locator('path').first().getAttribute('d'),
      `M${last.x1*1000} ${last.y1*1000}L${last.x2*1000} ${last.y2*1000}`);
    else if (last.kind !== 'text') check(`${name}.frame_geometry`,Number(await frame.locator('rect').first().getAttribute('x')),last.x*1000);
  } else check(`${name}.native_frame`,await card.locator('.dtframe').count(),1);
  return last;
};

try {
  await page.addStyleTag({content:'#host{width:100%;padding:0;margin:0}'});
  await page.evaluate(async () => {
    const c=window.__card;
    await window.__hpTest.setServerConfig(cfg=>{
      cfg.spaces=[{id:'creation',title:'Creation',cell_cm:5,view_box:[0,0,1,1],rooms:[],decor:[]}];
      cfg.markers=[];return cfg;
    });
    c._commitSpace('creation');await window.__hpTest.setMode('decor');
  });
  await panel.waitFor(); await card.locator('[data-hp="zoom-fit"]').click(); await settle();
  for (const kinds of [['line','line','line'],['rect','rect','rect'],['ellipse','ellipse','ellipse'],['line','rect','ellipse']]) {
    let armed;
    for (const [index,kind] of kinds.entries()) {
      if (kind!==armed) { await tool(kind); armed=kind; }
      const before=await state();await drag();
      const name=`creation.${kinds.join('-')}.${index}`;
      const last=await assertSelected(name);
      check(`${name}.one_created`,(await state()).decor.length,before.decor.length+1);
      check(`${name}.tool_retained`,(await state()).tool,kind);
      const input=panel.locator('[data-property="x"] input');
      await input.fill(String(700+index*10));await input.press('Enter');await settle();
      const after=await state();
      check(`${name}.property_changes_new`,JSON.stringify(after.decor.at(-1))!==JSON.stringify(last));
      check(`${name}.older_unchanged`,after.decor.slice(0,-1),before.decor);
    }
  }
  const dirtyBefore=await state();
  const width=panel.locator('[data-property="w"] input');await width.fill('0');
  await drag();
  check('creation.invalid_field_blocks_new_object',(await state()).decor,dirtyBefore.decor);
  check('creation.invalid_field_keeps_owner',(await state()).identity,dirtyBefore.identity);
  check('creation.invalid_field_keeps_error',await panel.locator('[role="alert"]').count(),1);
  await width.press('Escape');
  // Invalid/cancelled gestures keep both the prior identity and the stored data.
  await card.locator('[data-editor-group="shapes"]').focus();
  const beforeCancel=await state();
  await drag([.2,.3],[.2,.3]);
  check('creation.invalid_keeps_selection_and_data',await state(),beforeCancel);
  const from=await point(.2,.3),to=await point(.4,.4);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:4});
  await page.keyboard.press('Escape');await page.mouse.up();await settle();
  check('creation.escape_keeps_selection_and_data',await state(),beforeCancel);
  await page.setViewportSize({width:850,height:1000});await panel.waitFor({state:'hidden'});
  await drag();
  check('creation.compact.native',(await state()).native,(await state()).decor.at(-1).id);
  await tool('select');await assertSelected('creation.compact',false);
  await page.setViewportSize({width:1500,height:1000});await panel.waitFor();await settle();
  await assertSelected('creation.widen');
  // The remaining creation paths use their real dialogs and palettes.
  for (let i=0;i<2;i++) {
    await tool('text');const p=await point(.5,.2+i*.15);await page.mouse.click(p.x,p.y);
    const dialog=card.locator('hp-dialog[data-kind="decor-text"]');
    await card.locator('textarea.dtarea').fill(`Label ${i}`);
    await card.locator('textarea.dtarea').press('Control+Enter');await settle();
    await assertSelected(`creation.text.${i}`);
    check(`creation.text.${i}.value`,(await state()).decor.at(-1).text,`Label ${i}`);
    await dialog.waitFor({state:'hidden'});
    await tool('furniture');await card.locator('[data-hp="furniture-category"]').first().click();
    await card.locator('[data-hp="furniture-item"]').first().click();await settle();
    const f=await uncoveredPoint();
    await page.mouse.click(f.x,f.y);await settle();
    await assertSelected(`creation.furniture.${i}`);
    check(`creation.furniture.${i}.kind`,(await state()).decor.at(-1).kind,'furniture');
  }
  await page.evaluate(async()=>{
    const c=window.__card,id='b'.repeat(64),url=`/api/houseplan/content/assets/_/${id}.svg`;
    const asset={asset_id:id,name:'selection.svg',mime:'image/svg+xml',width:100,height:50,bytes:100,url,used_by:[]};
    const content='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="orange"/></svg>');
    const call=c.hass.callWS.bind(c.hass);
    c.hass={...c.hass,callWS:async message=>{
      if(message.type==='houseplan/assets/list'||message.type==='houseplan/assets/resolve')return {assets:[asset]};
      if(message.type==='houseplan/content/sign')return {urls:Object.fromEntries(message.paths.map(p=>[p,p===url?content:p]))};
      const result=await call(message);
      return message.type==='houseplan/config/get'?{...result,decor_assets_api:1}:result;
    }};
    await window.__hpTest.setServerConfig(cfg=>cfg);
  });
  await settle();
  for(let i=0;i<2;i++) {
    await tool('image');await card.locator('[data-action="image-palette-select"]').first().click();
    const p=await point(.7,.3);await page.mouse.move(p.x,p.y);await page.mouse.click(p.x,p.y);await settle();
    await assertSelected(`creation.image.${i}`);
    check(`creation.image.${i}.kind`,(await state()).decor.at(-1).kind,'image');
  }
  const beforeDelete=await state();
  await panel.locator('[data-action="properties-delete"]').click();await settle();
  check('creation.delete_current',(await state()).decor,beforeDelete.decor.slice(0,-1));
  await card.locator('[data-action="geometry-undo"]').click();await settle();
  check('creation.undo_delete',(await state()).decor,beforeDelete.decor);
  await card.locator('[data-action="geometry-redo"]').click();await settle();
  check('creation.redo_delete',(await state()).decor,beforeDelete.decor.slice(0,-1));
} catch (error) {
  check('creation.completed',false);console.error(error);
} finally { await finish(browser); }
