// Merge & split room ops (v1.21.0) via the card's markup handlers (norm coords).
import { launch } from './serve.mjs';
const { page, browser } = await launch();
const snap = await page.evaluate(() => JSON.stringify(window.__card._serverCfg));
const restore = () => page.evaluate((s) => {
  const c = window.__card; c._serverCfg = JSON.parse(s);
  c._mergeSel = null; c._mergeDialog = null; c._splitSel = null; c._pendingSplit = null; c._roomDialog = false;
  c._regSignature = ''; c._maybeRebuildDevices(); c.requestUpdate(); return c.updateComplete && true;
}, snap);
// norm→render helper mirrors what _markupClick passes to handlers
const R = (nx, ny) => page.evaluate(([nx, ny]) => {
  const c = window.__card; const H = 1000 / c._curSpaceCfg.aspect; return [nx * 1000, ny * H];
}, [nx, ny]);
const S = () => page.evaluate(() => {
  const c = window.__card;
  return { rooms: c._serverCfg.spaces.find((s) => s.id==='f1').rooms.map((r)=>({id:r.id,name:r.name,area:r.area})),
    mergeDlg: !!c._mergeDialog, roomDlg: !!c._roomDialog, pendingSplit: !!c._pendingSplit, toast: c._toast };
});
const enter = (t) => page.evaluate((t)=>{const c=window.__card; if(!c._markup)c._setMode('plan'); c._tool=t; return true;}, t);
const out = {};

// MERGE living(r1)+kitchen(r2) — share wall x=0.55, y∈[0.05..0.45]
await enter('merge');
await page.evaluate((p)=>window.__card._mergeClick(p), await R(0.3,0.3));
await page.evaluate((p)=>window.__card._mergeClick(p), await R(0.75,0.25));
out.mergeDialog = (await S()).mergeDlg;
await page.evaluate(()=>window.__card._commitMerge());
let s = await S();
out.mergeRooms = s.rooms.length;                          // 4→3
out.mergeKeptR1 = s.rooms.some(r=>r.id==='r1');
out.mergeDroppedR2 = !s.rooms.some(r=>r.id==='r2');
await restore();

// MERGE non-adjacent: living(r1)+garden's-only? use r2+r4 (kitchen & hallway don't share a wall)
await enter('merge');
await page.evaluate((p)=>window.__card._mergeClick(p), await R(0.75,0.25)); // kitchen
await page.evaluate((p)=>window.__card._mergeClick(p), await R(0.3,0.8));   // hallway
s = await S();
out.nonAdjRefused = !s.mergeDlg && s.rooms.length===4;
out.nonAdjToast = !!s.toast;
await restore();

// grid-aligned test room (real rooms are snapped; demo rooms are not)
await page.evaluate(()=>{
  const c=window.__card;
  c._serverCfg.spaces.find(s=>s.id==='f1').rooms.push(
    {id:'rg', name:'GridRoom', area:null, poly:[[0.05,0.0625],[0.5,0.0625],[0.5,0.5],[0.05,0.5]]});
  c._regSignature=''; c._maybeRebuildDevices(); c.requestUpdate();
});
// SPLIT rg vertical chord x=0.25 (all on grid nodes)
await enter('split');
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.28,0.28));  // pick rg
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.25,0.0625)); // wall pt a
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.25,0.5));  // wall pt b
out.splitPending = (await S()).pendingSplit;
out.splitDialog = (await S()).roomDlg;
// cancel keeps it whole
await page.evaluate(()=>window.__card._roomDialogCancel());
out.cancelWhole = (await S()).rooms.length===5; // 4 базовых + rg
// redo + confirm with a name (no area)
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.28,0.28));
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.25,0.0625));
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.25,0.5));
await page.evaluate(()=>{const c=window.__card; c._nameSel='Cabinet'; c._saveRoomNoArea();});
s = await S();
out.splitRooms = s.rooms.length===6;                      // 4 базовых + rg разрезанная надвое
out.bigKeepsLiving = s.rooms.some(r=>r.id==='r1' && r.area==='living_room');
out.newRoom = s.rooms.find(r=>!['r1','r2','r3','r4','rg'].includes(r.id))?.name;
await restore();

// SPLIT along a wall → refused (both pts on top wall of rg)
await page.evaluate(()=>{const c=window.__card; c._serverCfg.spaces.find(s=>s.id==='f1').rooms.push(
  {id:'rg2', name:'G2', area:null, poly:[[0.05,0.0625],[0.5,0.0625],[0.5,0.5],[0.05,0.5]]});
  c._regSignature=''; c._maybeRebuildDevices();});
await enter('split');
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.28,0.28));
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.1,0.0625));
await page.evaluate((p)=>window.__card._splitClick(p), await R(0.4,0.0625));
s = await S();
out.alongWallRefused = !s.roomDlg && !s.pendingSplit;

console.log(JSON.stringify(out,null,1));
await browser.close();
