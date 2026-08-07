/**
 * The two "draw less" space options and the virtual-wall rule (owner
 * 2026-08-05), plus the handle beads that came with them.
 *
 *   • «Скрыть декоративный слой» hides decor everywhere EXCEPT its own editor;
 *   • «Скрыть проёмы» hides doors/windows everywhere EXCEPT the plan editor,
 *     and does not touch what an opening MEANS (the light still gets through);
 *   • a space that does not draw room borders draws no dashed virtual walls
 *     in View; every editor still does, because the complete centreline span
 *     must remain visible while editing;
 *   • both switches survive a round trip through the dialog;
 *   • every corner handle paints a bead a quarter of its hit radius, and the
 *     hit radius itself is unchanged.
 */
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c._cfgEpoch++; c.requestUpdate(); await c.updateComplete; };
  const sp = () => c._serverCfg.spaces.find((s) => s.id === c._space);
  const set = async (patch) => {
    const s = sp();
    s.settings = { ...(s.settings || {}), ...patch };
    await upd();
  };
  const mode = async (m) => { c._setMode(m); await upd(); };
  const n = (sel) => sr().querySelectorAll(sel).length;

  // a shape and an opening to look for, on the space we are on
  const s0 = sp();
  s0.decor = [{ id: 'hl1', kind: 'rect', x: 0.3, y: 0.3, w: 0.1, h: 0.1, color: '#ff0000', width: 3 }];
  s0.openings = [{ id: 'hl2', type: 'door', x: 0.3, y: 0.2, angle: 0, length: 0.09 }];
  await mode('view');
  await set({ hide_decor: undefined, hide_openings: undefined, show_borders: true });

  // ---- 1) the baseline: both layers are drawn ---------------------------
  out.decorDrawnByDefault = n('.decorlayer .dshape') > 0;
  out.openingDrawnByDefault = n('[data-hp="opening"]') > 0;

  // ---- 2) hide the decor layer ------------------------------------------
  await set({ hide_decor: true });
  out.decorHiddenInView = n('.decorlayer .dshape') === 0;
  await mode('devices');
  out.decorHiddenInDevices = n('.decorlayer .dshape') === 0;
  // …but its own editor still shows it, or it could not be edited
  await mode('decor');
  out.decorVisibleInItsEditor = n('.decorlayer .dshape') > 0;
  await mode('view');
  // the shape itself was never touched
  out.decorShapeKept = (sp().decor || []).length === 1;
  await set({ hide_decor: undefined });
  out.decorBackAfterOff = n('.decorlayer .dshape') > 0;

  // ---- 3) hide the openings ---------------------------------------------
  const opCount = () => n('[data-hp="opening"]');
  const before = opCount();
  await set({ hide_openings: true });
  out.openingsHiddenInView = opCount() === 0 && before > 0;
  await mode('plan');
  c._tool = 'opening';
  await upd();
  out.openingsVisibleInPlanEditor = opCount() > 0;
  await mode('view');
  // the opening is still an opening: it stayed in the config untouched
  out.openingKept = (sp().openings || []).length === 1;
  await set({ hide_openings: undefined });
  out.openingsBackAfterOff = opCount() === before;

  // ---- 4) virtual walls follow the borders switch ------------------------
  // an open boundary is a link between two rooms that share a wall; the demo's
  // first two rooms do (smoke_render_parity relies on the same fact)
  const rooms = sp().rooms || [];
  rooms[0].open_to = [rooms[1].id];
  await upd();
  out.openWallsFound = c._openPairs().length > 0;
  await set({ show_borders: true });
  out.openWallsDrawnWithBorders = n('.openwalls .openwall') > 0;
  await set({ show_borders: false });
  out.openWallsGoneWithoutBorders = n('.openwalls .openwall') === 0;
  // Every editor still draws them. The dash deliberately reaches the physical
  // centreline there, even if show_borders is off; only View hides it.
  await mode('plan');
  c._tool = 'openwall';
  await upd();
  out.openWallsVisibleInPlanEditor = n('.openwalls .openwall') > 0;
  await mode('devices');
  out.openWallsVisibleInDevicesEditor = n('.openwalls .openwall') > 0;
  await mode('decor');
  out.openWallsVisibleInDecorEditor = n('.openwalls .openwall') > 0;
  await mode('view');
  await set({ show_borders: true });

  // ---- 5) the dialog carries both switches round trip --------------------
  c._openSpaceDialog('edit', c._space);
  await upd();
  const rows = [...sr().querySelectorAll('hp-dialog .srcrow')].map((r) => r.textContent.trim());
  out.dialogOffersHideDecor = rows.some((t) => /декорат|decorative/i.test(t));
  out.dialogOffersHideOpenings = rows.some((t) => /проём|проем|doors and windows/i.test(t));
  out.dialogReadsOff = c._spaceDialog.hideDecor === false && c._spaceDialog.hideOpenings === false;
  c._spaceDialog = { ...c._spaceDialog, hideDecor: true, hideOpenings: true };
  await c._saveSpaceDialog();
  await upd();
  out.savedBoth = sp().settings.hide_decor === true && sp().settings.hide_openings === true;
  c._openSpaceDialog('edit', c._space);
  await upd();
  out.dialogReadsOn = c._spaceDialog.hideDecor === true && c._spaceDialog.hideOpenings === true;
  c._spaceDialog = { ...c._spaceDialog, hideDecor: false, hideOpenings: false };
  await c._saveSpaceDialog();
  await upd();
  // switched off = nothing is stored (undefined, which JSON drops on the way
  // to the server), not a stored `false` — the same rule bg_color follows
  out.clearedNotStored = sp().settings.hide_decor === undefined
    && sp().settings.hide_openings === undefined
    && !('hide_decor' in JSON.parse(JSON.stringify(sp().settings)));
  c._spaceDialog = null;
  await upd();
  return out;
});

checkAll(res);

// ---- 6) the beads: a quarter of the hit radius, and the hit is unchanged --
const rad = await page.evaluate(async () => {
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  c._setMode('decor'); c._decorTool = 'backdrop';
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  const hit = sr().querySelector('.bdframe .bdhandle');
  const knob = sr().querySelector('.bdframe .bdknob');
  const view = c._viewOr(c._baseVb());
  const o = {
    hasBoth: !!hit && !!knob,
    hitR: hit ? Number(hit.getAttribute('r')) : 0,
    knobR: knob ? Number(knob.getAttribute('r')) : 0,
    expectHit: Math.max(view.w, view.h) * 0.02,
    knobInert: knob ? getComputedStyle(knob).pointerEvents === 'none' : false,
    // the bead sits exactly on the handle
    sameCentre: hit && knob
      && hit.getAttribute('cx') === knob.getAttribute('cx')
      && hit.getAttribute('cy') === knob.getAttribute('cy'),
  };
  // …and the resize tool's corner beads follow the same rule
  c._setMode('plan'); c._tool = 'resize';
  c._rszSel = (c._curSpaceCfg.rooms || [])[0]?.id || null;
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  const rh = sr().querySelector('.rszcorner');
  const rk = sr().querySelector('.rszknob');
  o.rszBoth = !!rh && !!rk;
  o.rszQuarter = rh && rk
    ? Math.abs(Number(rk.getAttribute('r')) * 4 - Number(rh.getAttribute('r'))) < 0.05
    : false;
  c._setMode('view');
  return o;
});
checkAll({
  handleAndBead: rad.hasBoth,
  hitRadiusUnchanged: Math.abs(rad.hitR - rad.expectHit) < 0.15,
  beadIsAQuarter: Math.abs(rad.knobR * 4 - rad.hitR) < 0.05,
  beadTakesNoPointer: rad.knobInert,
  beadOnTheHandle: rad.sameCentre,
  resizeCornerHasBead: rad.rszBoth,
  resizeBeadIsAQuarter: rad.rszQuarter,
});

// ---- 7) the backdrop editor opens ON the picture tool ---------------------
const armed = await page.evaluate(async () => {
  const c = window.__card;
  c._setMode('view'); await c.updateComplete;
  c._setMode('decor'); await c.updateComplete;
  const o = { tool: c._decorTool, movable: c._bdMovable, hasPicture: !!c._curSpaceCfg.plan_url };
  // and the picture really moves under it: press inside the body, drag, release
  const r = c._bdRect;
  const before = { x: c._curSpaceCfg.plan_x ?? 0, y: c._curSpaceCfg.plan_y ?? 0 };
  const pt = [r.x + r.w / 2, r.y + r.h / 2];
  const ev = (x, y) => ({ pointerId: 42, clientX: x, clientY: y, target: c._stageEl,
    preventDefault() {}, stopPropagation() {}, shiftKey: false });
  // _svgPoint reads clientX/Y — go through the stage geometry
  const stage = (c.shadowRoot || c.renderRoot).querySelector('.stage');
  const box = stage.getBoundingClientRect();
  const vb = stage.querySelector('svg').getAttribute('viewBox').split(' ').map(Number);
  const toScreen = (x, y) => [box.left + ((x - vb[0]) / vb[2]) * box.width,
    box.top + ((y - vb[1]) / vb[3]) * box.height];
  const [sx, sy] = toScreen(pt[0], pt[1]);
  const [ex, ey] = toScreen(pt[0] + vb[2] * 0.1, pt[1]);
  c._stagePointerDown(ev(sx, sy));
  c._stagePointerMove(ev(ex, ey));
  c._stagePointerUp(ev(ex, ey));
  await c.updateComplete;
  o.moved = (c._curSpaceCfg.plan_x ?? 0) !== before.x;
  c._setMode('view');
  return o;
});
checkAll({
  backdropToolArmed: armed.tool === 'backdrop',
  pictureMovableAtOnce: armed.movable,
  dragMovedThePicture: armed.moved,
});

await finish(browser);
