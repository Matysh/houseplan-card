// #1453: real pointer/menu/form controls; authority and writes use the synthetic HA transport.
import { launch, checkAll, finish, requirePinnedBrowser } from './serve.mjs';
import { currentGraphFixture } from '../test/helpers/graph-fixture.mjs';
import { waitForUiKitPaint } from './helpers/ui-kit-paint.mjs';
requirePinnedBrowser('1453-room-context-menu');
const { page, browser } = await launch({ width: 1100, height: 850 }, 1);
page.setDefaultTimeout(8000);
const fixture = currentGraphFixture({ model_version: 10, settings: {}, markers: [], spaces: [{
  id: 'rooms', title: 'Rooms', cell_cm: 5, view_box: [0, 0, 1, .8],
  rooms: [
    { id: 'a', name: 'Room A', poly: [[.1,.15],[.45,.15],[.45,.65],[.1,.65]] },
    { id: 'b', name: 'Room B', poly: [[.45,.15],[.8,.15],[.8,.65],[.45,.65]] },
  ],
  openings: [{ id: 'door', type: 'door', x: .25, y: .15, angle: 0, length: .08 }],
  wall_segments: [
    { id:'a-top', a:[.1,.15], b:[.45,.15], cm:20 },
    { id:'a-bottom', a:[.1,.65], b:[.45,.65], cm:20 },
    { id:'a-left', a:[.1,.15], b:[.1,.65], cm:20 },
    { id:'shared', a:[.45,.15], b:[.45,.65], cm:20 },
    { id:'b-top', a:[.45,.15], b:[.8,.15], cm:20 },
    { id:'b-bottom', a:[.45,.65], b:[.8,.65], cm:20 },
    { id:'b-right', a:[.8,.15], b:[.8,.65], cm:20 },
  ],
  partitions: [],
}] });
const out = {};
const menu = () => page.locator('houseplan-card [data-hp="room-context-menu"]:not([inert])');
const action = key => menu().locator(`[data-action="room-${key}"]`);
const settle = () => page.evaluate(() => window.__hpTest.settled());
const reset = async () => {
  await page.evaluate(async cfg => {
    const ui = window.__hpTest;
    await ui.setServerConfig(cfg); await ui.switchSpace('rooms'); await ui.setMode('plan'); await ui.setTool('select');
  }, fixture);
  await waitForUiKitPaint(page);
};
const point = (id = 'a', fx = .25, fy = .3) => page.evaluate(({ id, fx, fy }) => {
  const c = window.__card, poly = c._spaceModel().rooms.find(room => room.id === id).poly;
  const xs = poly.map(p=>p[0]), ys=poly.map(p=>p[1]);
  const x = Math.min(...xs) + (Math.max(...xs)-Math.min(...xs))*fx;
  const y = Math.min(...ys) + (Math.max(...ys)-Math.min(...ys))*fy;
  const matrix = c.shadowRoot.querySelector('[data-hp="stage"]').getScreenCTM();
  const p = new DOMPoint(x,y).matrixTransform(matrix);
  return {x:p.x,y:p.y};
}, {id,fx,fy});
const open = async (id = 'a') => {
  const p = await point(id);
  await page.mouse.click(p.x,p.y,{button:'right'});
  await settle();
  if (!await menu().count()) console.log('Room menu was not opened', await page.evaluate(()=>{
    const c=window.__card,r=c._editorRuntime;
    return {mode:c._mode,allowed:r.roomMenu.allowed,gesturing:r.roomMenu.gesturing,tool:c._tool,
      nodeBusy:r.nodeMove?.busy,nodeTail:r.nodeMove?.tail,suppress:c._suppressClick,blocked:c._editorSecondaryDialogBlocked,
      menu:!!r.roomMenu.menu,confirm:!!c._dangerConfirm,room:!!c._roomDialog};
  }));
  await menu().waitFor({ state:'visible' });
  await waitForUiKitPaint(page);
};
const snapshot = () => page.evaluate(() => JSON.stringify(window.__card._serverCfg));

try {
  await reset();
  const before = await snapshot();
  await open();
  out.fiveApprovedCommands = JSON.stringify(await menu().locator('[data-action]').evaluateAll(nodes=>nodes.map(n=>n.dataset.action)))
    === JSON.stringify(['room-settings','room-resize','room-split','room-merge','room-delete']);
  out.openDoesNotWrite = await snapshot() === before;
  await page.keyboard.press('Escape'); await settle();
  out.escapeDoesNotWrite = await menu().count() === 0 && await snapshot() === before;

  await page.evaluate(()=>window.__hpTest.setTool('draw'));
  await open();
  const outside = await point('b'); await page.mouse.click(outside.x,outside.y); await settle();
  out.outsideDismissDoesNotDraw = await menu().count()===0 && await page.evaluate(()=>window.__card._path.length===0)
    && await snapshot()===before;
  await page.mouse.click(outside.x,outside.y); await settle();
  out.nextDeliberateClickStillDraws = await page.evaluate(()=>window.__card._path.length===1);
  const active = await point(); await page.mouse.click(active.x,active.y,{button:'right'}); await settle();
  out.activeDrawingIsNotInterrupted = await menu().count()===0 && await page.evaluate(()=>window.__card._path.length===1);
  await page.evaluate(()=>window.__hpTest.setTool('select'));

  await open('b'); await action('settings').click(); await settle();
  out.settingsTargetsClickedRoom = await page.evaluate(()=>window.__card._roomEditId==='b');
  await page.locator('houseplan-card hp-dialog[data-kind="room"] button.btn[data-hp="dialog-cancel"]').click(); await settle();
  await open('b'); await action('resize').click(); await settle();
  out.resizePreselectsClickedRoom = await page.evaluate(()=>window.__card._tool==='resize'
    && window.__card._resize.selectedRoomId==='b');
  await page.evaluate(()=>window.__hpTest.setTool('select'));
  await open(); await action('split').click(); await settle();
  out.splitPreselectsClickedRoom = await page.evaluate(()=>window.__card._tool==='split'
    && window.__card._splitSel?.roomId==='a' && window.__card._splitSel.pts.length===0);
  await page.keyboard.press('Escape'); await settle();
  out.splitCancellationDoesNotWrite = await snapshot()===before;
  await page.evaluate(()=>window.__hpTest.setTool('select'));
  await open(); await action('merge').click(); await settle();
  out.mergePreselectsClickedRoom = await page.evaluate(()=>window.__card._tool==='merge' && window.__card._mergeSel==='a');
  const b = await point('b'); await page.mouse.click(b.x,b.y); await settle();
  out.mergeUsesExistingConfirmation = await page.evaluate(()=>window.__card._mergeDialog?.aId==='a'
    && window.__card._mergeDialog.bId==='b');
  await page.locator('houseplan-card hp-dialog button.btn[data-hp="dialog-cancel"]').click(); await settle();
  out.mergeCancellationDoesNotWrite = await snapshot()===before;
  await page.evaluate(()=>window.__hpTest.setTool('select'));

  // Room deletion shares its existing choice, preserving masonry and openings.
  await open(); await action('delete').click(); await settle();
  out.deleteUsesExistingChoices = await page.evaluate(()=>window.__card._roomDeleteDialog?.roomId==='a'
    && window.__card.shadowRoot.querySelectorAll('hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').length===2);
  await page.locator('houseplan-card hp-dialog[data-kind="confirm"] [data-hp="dialog-confirm"]').first().click();
  await settle();
  await page.waitForFunction(()=>!window.__card._writesPending && !window.__card._pendingPhysicalWrites.size);
  out.deleteKeepsWallsAndDoor = await page.evaluate(()=> {
    const s=window.__card._curSpaceCfg;
    return !s.rooms.some(r=>r.id==='a') && s.rooms.some(r=>r.id==='b')
      && s.openings.some(o=>o.id==='door') && s.partitions.length===3;
  });
  await page.locator('houseplan-card [data-action="geometry-undo"]').click(); await settle();
  await page.waitForFunction(()=>!window.__card._writesPending && !window.__card._pendingPhysicalWrites.size);
  out.undoRestoresRoomAndDoor = await page.evaluate(()=>window.__card._curSpaceCfg.rooms.some(r=>r.id==='a')
    && window.__card._curSpaceCfg.openings.some(o=>o.id==='door'));

  // Dirty settings must ask before yielding to deletion; cancelling preserves the draft.
  await open(); await action('settings').click(); await settle();
  const roomDialog = page.locator('houseplan-card hp-dialog[data-kind="room"]');
  await roomDialog.locator('#room-name').fill('Unsaved name');
  await roomDialog.locator('[data-action="room-delete"]').click(); await settle();
  out.dirtySettingsAskBeforeDelete = await page.evaluate(()=>!!window.__card._dangerConfirm && !window.__card._roomDeleteDialog);
  await page.locator('houseplan-card hp-confirm button.btn[data-hp="dialog-cancel"]').click(); await settle();
  out.keepDraftDoesNotDelete = await roomDialog.locator('#room-name').inputValue()==='Unsaved name'
    && await page.evaluate(()=>!window.__card._roomDeleteDialog);
  await roomDialog.locator('[data-action="room-delete"]').click(); await settle();
  await page.locator('houseplan-card hp-confirm [data-hp="dialog-confirm"]').click(); await settle();
  out.discardThenDeleteTargetsOriginalRoom = await page.evaluate(()=>!window.__card._roomDialog
    && window.__card._roomDeleteDialog?.roomId==='a'
    && window.__card._curSpaceCfg.rooms.find(r=>r.id==='a').name==='Room A');
  await page.locator('houseplan-card hp-dialog[data-kind="confirm"] button.btn[data-hp="dialog-cancel"]').click(); await settle();
  await open(); await action('settings').click(); await settle();
  await roomDialog.locator('[data-action="room-delete"]').click(); await settle();
  out.cleanSettingsOpenSameDeleteChoice = await page.evaluate(()=>!window.__card._dangerConfirm
    && !window.__card._roomDialog && window.__card._roomDeleteDialog?.roomId==='a');
  await page.locator('houseplan-card hp-dialog[data-kind="confirm"] button.btn[data-hp="dialog-cancel"]').click(); await settle();

  // Native hit priority: wall, opening, and node never open a room menu.
  for (const [name,fx,fy] of [['wall',.7,0],['opening',(.25-.1)/(.45-.1),0],['node',0,0]]) {
    await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
    const p=await point('a',fx,fy); await page.mouse.click(p.x,p.y,{button:'right'}); await settle();
    out[`${name}KeepsPriority`] = await menu().count()===0;
    if (await page.locator('houseplan-card [data-hp="node-context-menu"]:not([inert])').count()) {
      await page.keyboard.press('Escape'); await settle();
    }
  }
  await page.evaluate(async()=>{await window.__hpTest.setMode('plan');await window.__hpTest.setTool('select');});
  await open();
  const staleRevision = await action('delete').elementHandle();
  await page.evaluate(async cfg=>window.__hpTest.setServerConfig(cfg),fixture);
  await staleRevision.evaluate(node=>node.click()); await settle();
  out.serverUpdateRetiresOldCommand = await page.evaluate(()=>!window.__card._roomDeleteDialog);
  await open();
  const retired = await action('delete').elementHandle();
  await page.evaluate(()=>window.__hpTest.setMode('view'));
  await retired.evaluate(node=>node.click()); await settle();
  out.modeChangeRetiresOldCommand = await page.evaluate(()=>!window.__card._roomDeleteDialog && window.__card._mode==='view');
  const p=await point(); await page.mouse.click(p.x,p.y,{button:'right'}); await settle();
  out.viewHasNoRoomMenu = await menu().count()===0;
  checkAll(out);
} finally { await finish(browser,out); }
