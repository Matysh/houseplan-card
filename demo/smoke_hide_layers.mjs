/**
 * The two "draw less" space options and the zero-wall rule (#306), plus the
 * handle beads that came with them.
 *
 *   • «Скрыть декоративный слой» hides decor everywhere EXCEPT its own editor;
 *   • «Скрыть проёмы» hides doors/windows everywhere EXCEPT the plan editor,
 *     and does not touch what an opening MEANS (the light still gets through);
 *   • a space that does not draw room borders draws no zero-thickness walls
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
  const setThickness = async (point, value) => {
    c._setMode('plan'); c._tool = 'wallthick'; await upd();
    c._wallThickClick(point); await c.updateComplete;
    if (!c._wallDialog) return false;
    c._wallDialog = { ...c._wallDialog, value: String(value) };
    c._wallThickApply(false); await c.updateComplete;
    return true;
  };

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
  await set({ show_borders: false });
  out.openingsHiddenInView = opCount() === 0 && before > 0;
  await mode('plan');
  c._tool = 'opening';
  await upd();
  out.openingsVisibleInPlanEditor = opCount() > 0;
  await mode('view');
  // the opening is still an opening: it stayed in the config untouched
  out.openingKept = (sp().openings || []).length === 1;
  await set({ show_borders: true });
  out.openingsBackAfterOff = opCount() === before;

  // ---- 4) zero walls follow the borders switch ---------------------------
  // The demo's first two rooms share x=550. Apply zero through the public
  // Thickness workflow so the smoke exercises the canonical v9 catalogue.
  // The synthetic unhosted opening above has finished its own assertions and
  // must not participate in the structural migration exercised here.
  delete sp().openings;
  await upd();
  out.zeroWallCreated = await setThickness([550, 250], 0);
  sp().zero_wall_style = 'dashed';
  await upd();
  await mode('view');
  await set({ show_borders: true });
  out.zeroWallsDrawnWithBorders = n('.zero-walls .zero-wall') > 0;
  await set({ show_borders: false });
  out.zeroWallsGoneWithoutBorders = n('.zero-walls .zero-wall') === 0;
  // Every editor still draws them. The dash deliberately reaches the physical
  // centreline there, even if show_borders is off; only View hides it.
  await mode('plan');
  await upd();
  out.zeroWallsVisibleInPlanEditor = n('.zero-walls .zero-wall') > 0;
  await mode('devices');
  out.zeroWallsVisibleInDevicesEditor = n('.zero-walls .zero-wall') > 0;
  await mode('decor');
  out.zeroWallsVisibleInDecorEditor = n('.zero-walls .zero-wall') > 0;
  await mode('view');
  await set({ show_borders: true });

  // ---- 5) the dialog carries both switches round trip --------------------
  c._openSpaceDialog('edit', c._space);
  await upd();
  const layerRows = [...sr().querySelectorAll('hp-dialog .hpf-toggle')];
  const rowText = r => r.querySelector('.hpf-toggle-title')?.textContent.trim() || '';
  const decorRow = layerRows.find(r => /декорат|decorative|dekorativ|décoratif/i.test(rowText(r)));
  const borders = sr().querySelector('#space-show-borders');
  out.dialogOffersHideDecor = !!decorRow && decorRow.querySelector('input').checked;
  out.dialogOffersCoupledOpenings = !!borders && borders.checked && !sr().querySelector('#space-layer-openings');
  out.dialogReadsOff = c._spaceDialog.hideDecor === false && c._spaceDialog.hideOpenings === false;
  decorRow.querySelector('input').click(); await upd();
  out.layerToggleWritesInvertedKey = c._spaceDialog.hideDecor === true && c._spaceDialog.hideOpenings === false;
  borders.click(); await upd();
  await c._saveSpaceDialog(); await upd();
  out.savedBoth = sp().settings.hide_decor === true && sp().settings.hide_openings === true;
  c._openSpaceDialog('edit',c._space); await upd();
  out.dialogReadsOn = c._spaceDialog.hideDecor === true && c._spaceDialog.hideOpenings === true;
  sr().querySelector('#space-layer-decor').click(); await upd();
  sr().querySelector('#space-show-borders').click(); await upd();
  await c._saveSpaceDialog(); await upd();
  out.clearedNotStored = sp().settings.hide_decor === undefined && sp().settings.hide_openings === undefined
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
  // #277 removed the Resize corner scale frame entirely; Backdrop keeps its
  // own independent handle/bead contract above.
  c._setMode('plan'); c._tool = 'resize';
  c._resize.selectRoom((c._curSpaceCfg.rooms || [])[0]?.id || null);
  c._cfgEpoch++; c.requestUpdate(); await c.updateComplete;
  o.rszLegacyCornersAbsent = !sr().querySelector('.rszcorner, .rszknob, .rszframe');
  c._setMode('view');
  return o;
});
checkAll({
  handleAndBead: rad.hasBoth,
  hitRadiusUnchanged: Math.abs(rad.hitR - rad.expectHit) < 0.15,
  beadIsAQuarter: Math.abs(rad.knobR * 4 - rad.hitR) < 0.05,
  beadTakesNoPointer: rad.knobInert,
  beadOnTheHandle: rad.sameCentre,
  resizeLegacyCornerScaleAbsent: rad.rszLegacyCornersAbsent,
});

// ---- 7) every Background session starts on Select; image has its own tool --
await page.evaluate(async () => {
  await window.__hpTest.setMode('view');
  await window.__hpTest.setMode('decor');
});
await page.waitForFunction(() => !window.__card.renderRoot.querySelector('.stage.mode-transition'));
const armed = await page.evaluate(() => {
  const c = window.__card, root = c.renderRoot;
  return {
    startsOnSelect: !!root.querySelector('.decorbar .dtool.on[data-tool="select"]'),
    inertUntilPictureTool: !root.querySelector('.stage.bdgrab'),
    hasPicture: !!c._curSpaceCfg.plan_url,
  };
});
await page.locator('.decorbar .dtool[data-tool="backdrop"]').click();
await page.evaluate(() => window.__hpTest.settled());
const pictureDrag = await page.evaluate(() => {
  const c = window.__card, root = c.renderRoot;
  const image = root.querySelector('.stage svg image');
  const svg = root.querySelector('.stage svg');
  const x = +image.getAttribute('x') + +image.getAttribute('width') / 2;
  const y = +image.getAttribute('y') + +image.getAttribute('height') / 2;
  const viewWidth = svg.viewBox.baseVal.width;
  const matrix = svg.getScreenCTM();
  const start = new DOMPoint(x, y).matrixTransform(matrix);
  const end = new DOMPoint(x + viewWidth * 0.1, y).matrixTransform(matrix);
  return { movable: !!root.querySelector('.stage.bdgrab'),
    beforeX: c._curSpaceCfg.plan_x ?? 0,
    start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
});
armed.movable = pictureDrag.movable;
await page.mouse.move(pictureDrag.start.x, pictureDrag.start.y);
await page.mouse.down();
await page.mouse.move(pictureDrag.end.x, pictureDrag.end.y, { steps: 6 });
await page.mouse.up();
await page.evaluate(() => window.__hpTest.waitForWrites());
armed.moved = await page.evaluate((beforeX) => (window.__card._curSpaceCfg.plan_x ?? 0) !== beforeX,
  pictureDrag.beforeX);
await page.evaluate(() => window.__hpTest.setMode('view'));
checkAll({
  backgroundStartsOnSelect: armed.startsOnSelect,
  pictureInertUntilOwnTool: armed.inertUntilPictureTool,
  pictureMovableUnderOwnTool: armed.movable,
  dragMovedThePicture: armed.moved,
});

await finish(browser);
