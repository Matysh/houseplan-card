/**
 * Wall thickness (docs/WALL-THICKNESS.md): tool, hatch body, floor area drops
 * with thickness, opening cuts, centred/default and flipped door symbols,
 * shared once, clear→line,
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

  // A sun shaft starts at the two room-side corners of a thick opening, not
  // on the wall centreline and not at an incidence-narrowed pseudo-aperture.
  sp().openings = [{
    id: 'wtSun', type: 'window', x: 0.04, y: 0.25, angle: 90, length: 0.09,
  }];
  sp().settings = { ...(sp().settings || {}), north_deg: 0, sun_rays: true };
  c.hass = { ...c.hass, states: { ...c.hass.states, 'sun.sun': {
    entity_id: 'sun.sun', state: 'above_horizon',
    attributes: { azimuth: 240, elevation: 60 },
  } } };
  c._setMode('view');
  await upd();
  const sunRay = (c._sunRaysCache?.rays || []).find((r) => r.openingId === 'wtSun');
  const sunDepth = (20 / c._cellCm) * c._gridPitch;
  const ys = sunRay ? [sunRay.a[1], sunRay.b[1]].sort((a, b) => a - b) : [];
  out.sunStartsInnerFace = !!sunRay
    && Math.abs(sunRay.a[0] - (40 + sunDepth / 2)) < 1e-6
    && Math.abs(sunRay.b[0] - (40 + sunDepth / 2)) < 1e-6;
  out.sunStartsInnerCorners = !!sunRay
    && Math.abs(ys[0] - 205) < 1e-6 && Math.abs(ys[1] - 295) < 1e-6;
  c._setMode('plan');
  c._tool = 'wallthick';
  await upd();

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

  const doorBodyTransform = () => sr()
    .querySelector('[data-hp="opening"][data-kind="door"] > g[transform^="scale("]'
      + ' > g[transform^="translate("]')
    ?.getAttribute('transform') || '';
  out.doorDefaultCentered = /^translate\(0 0\)$/.test(doorBodyTransform());
  sp().openings[0].flip_v = true;
  await upd();
  out.doorSavedFlipStaysCentered = /^translate\(\s*0\s+0\s*\)$/.test(doorBodyTransform());

  const firstGateTurn = (id) => {
    const transform = sr().querySelector(
      `[data-hp="opening"][data-id="${id}"] .op-leaf`,
    )?.style?.transform || '';
    return Number(transform.match(/rotate\(([-+0-9.eE]+)deg\)/)?.[1]);
  };
  sp().openings = [
    { id: 'wtGateDefault', type: 'gate', x: 0.55, y: 0.20, angle: 90, length: 0.08,
      flip_v: false },
    { id: 'wtGateFlipped', type: 'gate', x: 0.55, y: 0.30, angle: 90, length: 0.08,
      flip_v: true },
  ];
  await upd();
  const sharedGateDefault = firstGateTurn('wtGateDefault');
  const sharedGateFlipped = firstGateTurn('wtGateFlipped');
  out.sharedGateFlipReversesTurn = Math.abs(sharedGateDefault) === 10
    && sharedGateFlipped === -sharedGateDefault;

  const partitionsBefore = structuredClone(sp().partitions || []);
  sp().partitions = [...partitionsBefore, {
    id: 'wt-gate-partition', a: [0.15, 0.75], b: [0.45, 0.75], cm: 25,
  }];
  sp().openings = [
    { id: 'wtPartGateDefault', type: 'gate', x: 0.25, y: 0.75, angle: 0, length: 0.08,
      flip_v: false, host: { kind: 'partition', id: 'wt-gate-partition', t: 1 / 3 } },
    { id: 'wtPartGateFlipped', type: 'gate', x: 0.35, y: 0.75, angle: 0, length: 0.08,
      flip_v: true, host: { kind: 'partition', id: 'wt-gate-partition', t: 2 / 3 } },
  ];
  await upd();
  const partitionGateDefault = firstGateTurn('wtPartGateDefault');
  const partitionGateFlipped = firstGateTurn('wtPartGateFlipped');
  out.partitionGateFlipReversesTurn = Math.abs(partitionGateDefault) === 10
    && partitionGateFlipped === -partitionGateDefault;
  sp().partitions = partitionsBefore;
  sp().openings = [{
    id: 'wt1', type: 'door', x: 0.55, y: 0.25, angle: 90, length: 0.09, flip_v: true,
  }];
  await upd();

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
  c._tool = 'boundary';
  c._boundaryClick([550, 150]);
  c._boundaryClick([550, 350]);
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

  c._tool = 'boundary';
  c._boundaryClick([550, 250]);
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
    c._undoGeometry();
    await upd();
    out.resizeUndoRestores = (sp().walls || []).some((w) => w.cm === 30)
      && JSON.stringify(sp().walls || []) === wallsBefore;
  } else {
    c._dropLegacySegments();
    out.resizeKeeps = (sp().walls || []).some((w) => w.cm === 30);
    out.resizeUndoRestores = false;
  }

  out.pixelProbe = !!sr().querySelector('.wallbody');

  // AUD-159B7-04: the same screen-depth policy owns both cards. At 1 cm the
  // hatch must be suppressed in full and static views; at 20 cm both restore
  // it. The static card measures its actual stage width via ResizeObserver.
  c._setMode('view');
  const parityCfg = JSON.parse(JSON.stringify(c._serverCfg));
  const paritySp = parityCfg.spaces.find((x) => x.id === c._space);
  paritySp.settings = { ...(paritySp.settings || {}), show_borders: true };
  paritySp.walls = (paritySp.walls || []).map((w) => ({ ...w, cm: 1 }));
  c._serverCfg = parityCfg;
  await upd();

  await customElements.whenDefined('houseplan-space-card');
  const baseCall = c.hass.callWS.bind(c.hass);
  const staticHass = { ...c.hass, callWS: async (m) => {
    if (m.type === 'houseplan/config/get') return { config: parityCfg, rev: 1 };
    if (m.type === 'houseplan/layout/get') return { layout: c._layout || {}, rev: 1 };
    return baseCall(m);
  } };
  const staticCard = document.createElement('houseplan-space-card');
  staticCard.setConfig({ type: 'custom:houseplan-space-card', space: c._space, show_button: false });
  staticCard.hass = staticHass;
  document.body.appendChild(staticCard);
  const t0 = Date.now();
  while ((!staticCard.renderRoot?.querySelector('.wallbody') || !(staticCard._stageWidth > 0))
    && Date.now() - t0 < 6000) {
    await new Promise((r) => setTimeout(r, 60));
  }
  await staticCard.updateComplete;
  out.thinWallFullSolid = !!sr().querySelector('.wallbody.solid');
  out.thinWallStaticSolid = !!staticCard.renderRoot?.querySelector('.wallbody.solid');

  for (const w of paritySp.walls || []) w.cm = 20;
  c._cfgEpoch++;
  c.requestUpdate();
  staticCard.requestUpdate();
  await c.updateComplete;
  await staticCard.updateComplete;
  out.thickWallFullHatched = !!sr().querySelector('.wallbody:not(.solid)');
  out.thickWallStaticHatched = !!staticCard.renderRoot?.querySelector('.wallbody:not(.solid)');
  staticCard.remove();
  return out;
});

checkAll(res);
await finish(browser, res);
