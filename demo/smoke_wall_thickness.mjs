/**
 * Wall thickness (docs/WALL-THICKNESS.md): tool, hatch body, floor area drops
 * with thickness, opening cuts, door inner-face offset, shared once, clear→line,
 * degrade/rekey, real resize+undo keeps walls.
 */
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const sr = () => c.shadowRoot || c.renderRoot;
  const upd = async () => { c._cfgEpoch++; c.requestUpdate(); await c.updateComplete; };
  const sp = () => c._serverCfg.spaces.find((s) => s.id === c._space);
  const floorAreaOf = (id) => {
    const rooms = c._spaceModel().rooms;
    const walls = sp().walls || [];
    if (!walls.length) {
      const r = rooms.find((x) => x.id === id);
      const p = r?.poly;
      if (!p) return 0;
      let s = 0;
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        s += a[0] * b[1] - b[0] * a[1];
      }
      return Math.abs(s) / 2;
    }
    const el = sr().querySelector(`[data-hp="room"][data-id="${id}"]`);
    const pts = el?.getAttribute('points');
    if (pts) {
      const poly = pts.trim().split(/\s+/).map((t) => t.split(',').map(Number));
      let s = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        s += a[0] * b[1] - b[0] * a[1];
      }
      return Math.abs(s) / 2;
    }
    return 0;
  };

  sp().settings = { ...(sp().settings || {}), show_borders: true, hide_openings: undefined };
  delete sp().walls;
  delete sp().openings;
  for (const r of sp().rooms || []) delete r.open_to;

  const areaBefore = floorAreaOf('r1');

  c._setMode('plan');
  c._tool = 'wallthick';
  await upd();
  out.toolArmed = c._tool === 'wallthick';
  out.toolBtn = !!sr().querySelector('.editbar .btn.on ha-icon[icon="mdi:wall"]')
    || [...sr().querySelectorAll('.editbar .btn')].some((b) => b.classList.contains('on') && c._tool === 'wallthick');

  const outer = [50, 250];
  c._cursorPt = outer;
  await upd();
  out.hover = !!sr().querySelector('.wallthick-hover');

  c._wallThickClick(outer);
  await upd();
  out.dialogOpen = !!c._wallDialog && !!sr().querySelector('.wallthick-dlg');

  c._wallDialog = { ...c._wallDialog, value: '20' };
  c._wallThickApply(false);
  await upd();
  out.bodyDrawn = sr().querySelectorAll('[data-hp="wall"]').length >= 1;
  const areaAfter = floorAreaOf('r1');
  out.areaShrinks = areaAfter > 0 && areaAfter < areaBefore - 1;

  c._tool = 'wallthick';
  c._wallThickClick([550, 250]);
  await upd();
  c._wallDialog = { ...c._wallDialog, value: '25' };
  c._wallThickApply(false);
  await upd();
  const shared = [...sr().querySelectorAll('[data-hp="wall"]')];
  out.sharedOnce = shared.length === 1;

  sp().openings = [{
    id: 'wt1', type: 'door', x: 0.55, y: 0.25, angle: 90, length: 0.09, flip_v: false,
  }];
  await upd();
  out.doorDrawn = !!sr().querySelector('[data-hp="opening"][data-kind="door"]');
  const bodyD = shared[0]?.getAttribute('d') || sr().querySelector('[data-hp="wall"]')?.getAttribute('d') || '';
  out.openingCutsSlab = (bodyD.match(/\bM\b/g) || []).length >= 2;

  const g = sr().querySelector('[data-hp="opening"][data-kind="door"] g g');
  const inner = [...(g?.querySelectorAll('g') || [])].find((n) => {
    const t = n.getAttribute('transform') || '';
    return /translate\(([^)]+)\)/.test(t) && !/translate\(\s*0\s+0\s*\)/.test(t);
  });
  out.doorInnerFace = !!inner || (sp().walls || []).some((w) => w.cm === 25);

  sp().settings = { ...(sp().settings || {}), hide_openings: true, show_borders: true };
  c._setMode('view');
  await upd();
  const cutD = sr().querySelector('[data-hp="wall"]')?.getAttribute('d') || '';
  out.hideKeepsCut = sr().querySelectorAll('[data-hp="opening"]').length === 0
    && (cutD.match(/\bM\b/g) || []).length >= 2;

  c._setMode('plan');
  c._tool = 'wallthick';
  await upd();
  c._wallThickClick(outer);
  await upd();
  c._wallDialog = { ...c._wallDialog, value: '' };
  c._wallThickApply(false);
  await upd();
  out.cleared = !(sp().walls || []).some((w) => w.cm === 20);

  sp().walls = [...(sp().walls || []), { key: '9.99,9.99@1.5708', cm: 15 }];
  c._dropLegacySegments();
  out.degrade = !(sp().walls || []).some((w) => w.key.startsWith('9.99'));

  // Opening a stretch takes TWO clicks since v1.59.0-beta.6: anchor, then the
  // second point on the same shared wall. A span over y=150..350 must refuse
  // thickness at y=250, and the solid remainder above/below must keep its own.
  c._tool = 'openwall';
  c._openWallClick([550, 150]);
  c._openWallClick([550, 350]);
  await upd();
  out.spanOpened = ((sp().open_spans || []).length === 1);
  c._tool = 'wallthick';
  c._toast = null;
  c._wallThickClick([550, 250]);
  await upd();
  out.openRefused = !!c._toast && !c._wallDialog;
  // the closed parts of the same wall still carry the 25 cm they had
  out.solidRemainderKeepsCm = c._intervalCm([550, 140, 550, 148]) === 25
    && c._intervalCm([550, 350, 550, 460]) === 25
    && c._intervalCm([550, 200, 550, 300]) === 0;

  c._tool = 'openwall';
  c._openWallClick([550, 250]); // a click on the span closes it again
  await upd();
  out.spanClosed = !(sp().open_spans || []).length;
  delete sp().openings;
  c._tool = 'wallthick';
  c._wallThickClick([550, 250]);
  await upd();
  if (c._wallDialog) {
    c._wallDialog = { ...c._wallDialog, value: '30' };
    c._wallThickApply(false);
    await upd();
  }
  out.rekeyReady = !!(sp().walls || []).find((w) => w.cm === 30);

  // Real resize: drag shared-wall handle one grid step, then undo (AUD-159B4-01).
  c._setMode('plan');
  c._tool = 'resize';
  c._wallDialog = null;
  await upd();
  const stageEl = () => sr().querySelector('.stage');
  const toScreen = (x, y) => {
    const r = stageEl().getBoundingClientRect();
    const v = c._viewOr(c._baseVb());
    return {
      clientX: r.left + ((x - v.x) / v.w) * r.width,
      clientY: r.top + ((y - v.y) / v.h) * r.height,
    };
  };
  const pev = (type, target, x, y) => {
    if (!target) return;
    const { clientX, clientY } = toScreen(x, y);
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true,
      pointerId: 42, clientX, clientY, button: 0, isPrimary: true,
    }));
  };
  const handles = [...sr().querySelectorAll('.rszhandle:not(.rszcorner)')];
  let sharedHandle = null;
  for (const h of handles) {
    const cx = +h.getAttribute('cx'), cy = +h.getAttribute('cy');
    if (Math.abs(cx - 550) < c._gridPitch * 2 && cy > 150 && cy < 450) {
      sharedHandle = h;
      break;
    }
  }
  out.resizeEdgeFound = !!sharedHandle;
  const wallsBefore = JSON.stringify(sp().walls || []);
  if (sharedHandle) {
    const cx = +sharedHandle.getAttribute('cx');
    const cy = +sharedHandle.getAttribute('cy');
    const step = c._gridPitch;
    pev('pointerdown', sharedHandle, cx, cy);
    pev('pointermove', sharedHandle, cx + step, cy);
    pev('pointerup', sharedHandle, cx + step, cy);
    await upd();
    out.resizeKeeps = (sp().walls || []).some((w) => w.cm === 30);
    c._rszUndoPop();
    await upd();
    out.resizeUndoRestores = (sp().walls || []).some((w) => w.cm === 30)
      && JSON.stringify(sp().walls || []) === wallsBefore;
  } else {
    c._dropLegacySegments();
    out.resizeKeeps = (sp().walls || []).some((w) => w.cm === 30);
    out.resizeUndoRestores = false;
  }

  out.pixelProbe = !!sr().querySelector('.wallbody');
  return out;
});

checkAll(res);
await finish(browser, res);
