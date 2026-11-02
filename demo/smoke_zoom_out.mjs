// v1.49.x: zoom goes below the base fit, the editor does not shift the plan.
// - the stage height follows the MEASURED header, not a hard-coded 118px, so
//   entering an editor keeps the plan inside the viewport;
// - zoom < 1 centres the content instead of pinning it to a corner;
// - the content frame (default zoom) includes devices standing outside rooms.
import { launch, checkAll, finish } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
const { page, browser } = await launch();
const out = {};

// -- editor entry keeps the stage inside the viewport --------------------
const stageBox = () => page.evaluate(() => {
  const sr = window.__card.shadowRoot || window.__card.renderRoot;
  const b = sr.querySelector('.stage').getBoundingClientRect();
  return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
});
const vh = await page.evaluate(() => window.innerHeight);
const inView = await stageBox();
await page.evaluate(() => window.__card._setMode('plan'));
await page.waitForFunction(() => window.__card._modeTransitionBusy === false);
const inPlan = await stageBox();
out.viewFitsViewport = inView.bottom <= vh + 2;
out.editorFitsViewport = inPlan.bottom <= vh + 2; // used to overflow by ~90px
out.editorStageShrinks = inPlan.top > inView.top && inPlan.bottom <= inView.bottom + 2;
await page.evaluate(() => window.__card._setMode('view'));
await page.waitForFunction(() => window.__card._modeTransitionBusy === false);

// -- zoom out below the base fit -----------------------------------------
out.zoomOut = await page.evaluate(() => {
  const c = window.__card;
  c._resetZoom();
  const fit = { ...c._viewOr(c._baseVb()) };
  const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
  c._zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, 0.5);
  const v = { ...c._view };
  const base = c._baseVb();
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  return {
    zoom: c._zoom,
    wider: v.w > fit.w * 1.9,                                   // actually zoomed out
    centredX: Math.abs(cx - (base[0] + base[2] / 2)) < 1,       // not pinned to a corner
    centredY: Math.abs(cy - (base[1] + base[3] / 2)) < 1,
  };
});
out.zoomOutWorks = out.zoomOut.zoom === 0.5 && out.zoomOut.wider
  && out.zoomOut.centredX && out.zoomOut.centredY;
delete out.zoomOut;
// docs/CANVAS.md §5: the zoom-out floor moved from a fixed 0.4 of the old
// view_box to 1/3 of the CONTENT frame — three canvases of empty plane is as
// far as it is useful to go when the canvas has no edges.
out.floorIsThird = Math.abs(await page.evaluate(() => { window.__card._resetZoom(); const c = window.__card;
  c._applyView(0.01); return c._zoom; }) - 1 / 3) < 1e-9; // clamped at the floor
await page.evaluate(() => window.__card._resetZoom());

// #1207 replaces HP-1543: mode changes preserve physical scale and centre.
// Intermediate editor gestures remain local until the exit commits View intent.
out.editorCamera = await page.evaluate(async () => {
  const c = window.__card, ui = window.__hpTest;
  const setMode=async mode=>{await ui.setMode(mode);const start=performance.now();
    while(c._modeTransitionBusy){if(performance.now()-start>2000)throw Error('Mode did not settle');await new Promise(resolve=>requestAnimationFrame(resolve));}
    await ui.settled();};
  const read = () => {
    const stage=c.renderRoot.querySelector('.stage'),svg=c.renderRoot.querySelector('.plan-svg');
    const v=c._view;
    return {ppu:svg.getBoundingClientRect().width/svg.viewBox.baseVal.width,
      center:[v.x+v.w/2,v.y+v.h/2],zoom:c._zoom,space:c._space,
      saved:JSON.parse(localStorage.getItem('houseplan_card_zoom_v1')||'{}')};
  };
  const same = (a,b) => Math.abs(a.ppu-b.ppu)<1e-5 && Math.hypot(a.center[0]-b.center[0],a.center[1]-b.center[1])<1e-5;
  await setMode('view');
  c._zoomAt(10,10,1.6);c._saveZoom();c.requestUpdate();await c.updateComplete;
  const view=read();await setMode('devices');const entry=read();
  c._zoomAt(10,10,2.5);c._saveZoom();c.requestUpdate();await c.updateComplete;
  const working=read();await setMode('view');const exit=read();
  const entryKeepsCamera=same(view,entry),exitKeepsCamera=same(working,exit);
  const editorNotYetPersisted=Math.abs(working.saved[working.space]-view.saved[view.space])<1e-9;
  const exitPersistsWorking=Math.abs(exit.saved[exit.space]-exit.zoom)<1e-9;
  // A floor changed inside the editor owns its own current camera on exit.
  const firstFloorZoom=exit.saved[exit.space];
  await setMode('devices');await ui.switchSpace('garden');
  c._zoomAt(10,10,5);c._saveZoom();c.requestUpdate();await c.updateComplete;
  const garden=read();await setMode('view');const gardenExit=read();
  const floorExitKeepsCamera=same(garden,gardenExit),floorExitSavesCurrent=Math.abs(gardenExit.saved.garden-gardenExit.zoom)<1e-9;
  const otherFloorUnchanged=Math.abs(gardenExit.saved[view.space]-firstFloorZoom)<1e-9;
  // Navigation in the same tick as an exit must finish the old floor's intent
  // before restoring the newly selected floor; no late callback may save there.
  await setMode('devices');c._zoomAt(10,10,5);c.requestUpdate();await c.updateComplete;
  const pending=read();c._setMode('view');c._slideTo(view.space,'right');
  await ui.settled();await ui.switchSpace('garden');const restored=read();
  const immediateFloorExitPersists=Math.abs(restored.ppu-pending.ppu)<1e-5;
  await ui.switchSpace(view.space);
  return {entryKeepsCamera,exitKeepsCamera,editorNotYetPersisted,exitPersistsWorking,
    floorExitKeepsCamera,floorExitSavesCurrent,otherFloorUnchanged,immediateFloorExitPersists};
});
for(const [name,value] of Object.entries(out.editorCamera))out[name]=value;
delete out.editorCamera;

// -- devices outside rooms stretch the default frame ---------------------
out.devicesStretchFrame = await page.evaluate(async () => {
  const c = window.__card;
  const cfg = JSON.parse(JSON.stringify(c._serverCfg));
  cfg.spaces[0].plan_url = null; cfg.spaces[0].plan_aspect = null;
  c._serverCfg = cfg; c._model = null;
  const before = c._baseVb();
  // walk one lamp far outside every room
  c._layout = { ...c._layout, d_lamp: { s: 'f1', x: 0.99, y: 0.5 } };
  c.requestUpdate();
  await c.updateComplete;
  const after = c._baseVb();
  return after[0] + after[2] > before[0] + before[2] + 20; // right edge follows the lamp
});

// -- a card BELOW other dashboard content still gets a stage (HP-1500-02) --
out.stageSurvivesContentAbove = await page.evaluate(async () => {
  const spacer = document.createElement('div');
  spacer.style.height = '900px';
  document.body.insertBefore(spacer, document.body.firstChild);
  window.dispatchEvent(new Event('resize'));
  await new Promise((r) => setTimeout(r, 120));
  const c = window.__card;
  const sr = c.shadowRoot || c.renderRoot;
  const h = sr.querySelector('.stage').getBoundingClientRect().height;
  spacer.remove();
  window.dispatchEvent(new Event('resize'));
  await new Promise((r) => setTimeout(r, 120));
  // the old code billed the 900px spacer as "header" and left a 0px stage
  return h > 300;
});

// A physically preserved camera may legitimately leave the old relative zoom
// interval. Reload and the next native command must not snap it back to 8.
await page.evaluate(()=>localStorage.setItem('houseplan_card_zoom_v1',JSON.stringify({f1:24})));
await page.reload();
await page.waitForFunction(()=>window.__card?._loadOk&&!window.__card._booting);
await page.setViewportSize({width:1600,height:1000});
await page.evaluate(()=>document.querySelector('#host').style.cssText='width:100%;padding:0;margin:0');
await page.evaluate(()=>window.__card._ensureEditorRuntime());
await installHpTestOnPage(page);
await page.evaluate(()=>window.__hpTest.settled());
out.reloadKeepsExpandedZoom=await page.evaluate(()=>Math.abs(window.__card._zoom-24)<1e-5);
await page.waitForFunction(()=>window.__card._continuity.state==='steady'&&!window.__card._bootSoft);
await page.locator('houseplan-card [data-hp=zoom-out]').click();
await page.waitForFunction(()=>window.__card._zoom<23.9);
await page.waitForFunction(()=>!window.__card._cameraTransition.active);
const stepped=await page.evaluate(()=>window.__card._zoom);
out.nextZoomIsContinuous=Math.abs(stepped-24/1.4)<1e-5;
await page.locator('houseplan-card [data-hp=zoom-fit]').click();
await page.waitForFunction(()=>window.__card._zoom<1.01);
await page.waitForFunction(()=>!window.__card._cameraTransition.active);
out.explicitFitRestoresStandardZoom=await page.evaluate(()=>Math.abs(window.__card._zoom-1)<1e-5);
console.log('Expanded zoom observations',JSON.stringify({stepped,fit:await page.evaluate(()=>window.__card._zoom)}));

await finish(browser, checkAll(out));
