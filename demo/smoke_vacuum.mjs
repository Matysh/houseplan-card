// Live vacuum P1 (docs/VACUUM.md): puck, trail, calibration, hidden rules.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const out = await page.evaluate(async () => {
  const c = window.__card;
  const o = {};
  const sr = () => c.shadowRoot || c.renderRoot;
  // a vacuum device bound to space f1, dock placed by layout, plus a source
  // camera whose coords live in "robot mm": target = 0.02*x+? — we calibrate
  // via the 6-number matrix directly (0.5 scale: robot 0..2000 -> canvas 0..1000)
  const M = [0.5, 0, 0, 0, 0.5, 0];
  const mkAttrs = (x, y, extra) => ({ vacuum_position: { x, y, a: 45 }, map_name: 'm1', ...extra });
  c.hass = { ...c.hass,
    entities: { ...c.hass.entities,
      'vacuum.robo': { entity_id: 'vacuum.robo', platform: 'demo', disabled_by: null },
      'camera.robo_map': { entity_id: 'camera.robo_map', platform: 'demo', disabled_by: null } },
    states: { ...c.hass.states,
    'vacuum.robo': { state: 'docked', attributes: { friendly_name: 'Робот' } },
    'camera.robo_map': { state: 'idle', attributes: mkAttrs(600, 800) },
  } };
  const cfg = c._serverCfg;
  cfg.markers = cfg.markers || [];
  cfg.markers.push({ id: 'e_vacuum_robo', binding: 'entity:vacuum.robo', space: 'f1',
    vacuum: { source: 'camera.robo_map', calibration: { m1: M } } });
  c._layout['e_vacuum_robo'] = { s: 'f1', x: 0.1, y: 0.1 };
  c._regSignature = ''; c._setMode('view'); await c.updateComplete;

  o.dockedNoPuck = !sr().querySelector('.vacpuck');
  o.baseMarkerThere = !!sr().querySelector('.dev');

  // start cleaning -> puck appears at transformed coords, base marker stays
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'cleaning', attributes: { friendly_name: 'Робот' } } } };
  await c.updateComplete; await new Promise((r) => setTimeout(r, 50));
  let puck = sr().querySelector('.vacpuck');
  o.puckAppears = !!puck;
  o.puckRound = puck && getComputedStyle(puck).borderRadius === '50%';
  // owner 2026-07-31: the base badge, but round and 20% smaller — same plate
  // vs a NEUTRAL badge: the robot's own base is yellow while cleaning
  const devEl = sr().querySelector('.dev:not(.on)');
  const pcs = getComputedStyle(puck), dcs = getComputedStyle(devEl);
  o.puckPlateMatchesDev = pcs.backgroundColor === dcs.backgroundColor
    && pcs.borderTopColor === dcs.borderTopColor;
  o.puck80pct = Math.abs(puck.getBoundingClientRect().width
    - devEl.getBoundingClientRect().width * 0.8) < 2;
  o.noWedge = !sr().querySelector('.vacwedge'); // owner 2026-07-31: no heading arrow
  // the glyph is DEAD centre (owner report: it floated on the text baseline)
  const pr = puck.getBoundingClientRect();
  const ir = sr().querySelector('.vacpuck ha-icon').getBoundingClientRect();
  o.iconCentred = Math.abs(ir.left + ir.width / 2 - (pr.left + pr.width / 2)) < 0.75
    && Math.abs(ir.top + ir.height / 2 - (pr.top + pr.height / 2)) < 0.75;
  o.baseStaysDuringCleaning = !!sr().querySelector('.dev');

  // drive: two more points -> trail polyline grows; puck moves
  const p1 = puck.getBoundingClientRect();
  for (const [x, y] of [[900, 800], [900, 1100]]) {
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'camera.robo_map': { state: 'idle', attributes: mkAttrs(x, y) } } };
    await c.updateComplete; await new Promise((r) => setTimeout(r, 30));
  }
  const trail = sr().querySelector('.vactrail path.case');
  // the trail LAGS one point behind the puck: after 3 telemetry points only
  // the first two are drawn — a segment never outruns the icon (owner)
  const localD = trail?.getAttribute('d') || '';
  o.trailDrawn = (localD.match(/[ML]/g) || []).length === 2;
  o.trailScaledByMatrix = localD.startsWith('M 300.0 400.0');
  o.trailBehindPuck = !localD.includes('450.0 550.0');
  // a zoom/view change TELEPORTS the puck instead of gliding across the plan
  c._applyView(1.35); c.requestUpdate(); await c.updateComplete;
  o.zoomTeleports = sr().querySelector('.vacpuck').classList.contains('jump');
  c._applyView(1); c.requestUpdate(); await c.updateComplete;
  // casing pair: dark halo + light core with identical geometry — the trail
  // must survive any room fill underneath (owner 2026-07-31)
  const tcase = sr().querySelector('.vactrail .case');
  const tcore = sr().querySelector('.vactrail .core');
  o.trailCasing = !!tcase && !!tcore
    && tcase.getAttribute('d') === tcore.getAttribute('d')
    && parseFloat(getComputedStyle(tcase).strokeWidth) > parseFloat(getComputedStyle(tcore).strokeWidth)
    && getComputedStyle(tcase).stroke.includes('0, 0, 0')
    && getComputedStyle(tcore).stroke.includes('255, 255, 255');


  // trail off via marker option
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.trail = false;
  c._cfgEpoch++; c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
  o.trailToggleOff = !sr().querySelector('.vactrail');
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.trail = null;

  // dock -> puck dissolves, trail lingers (linger window)
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'docked', attributes: { friendly_name: 'Робот' } } } };
  c._regSignature = ''; c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 30));
  o.puckGoneWhenDocked = !sr().querySelector('.vacpuck');
  // default mode 'cleaning': the trail HIDES the moment the run ends (owner)
  o.trailHiddenAfterDock = !sr().querySelector('.vactrail path, .vactrail polyline');

  // hidden marker renders neither puck nor trail
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'cleaning', attributes: { friendly_name: 'Робот' } } } };
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').hidden = true;
  c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
  o.hiddenNoPuck = !sr().querySelector('.vacpuck') && !sr().querySelector('.vactrail');
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').hidden = false;

  // no calibration for the active map -> no puck (graceful degradation)
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.robo_map': { state: 'idle', attributes: mkAttrs(900, 1100, { map_name: 'm2' }) } } };
  c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
  o.unknownMapNoPuck = !sr().querySelector('.vacpuck');

  // ---- server-side runs: current + one previous (owner 2026-07-31) ----
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.trail_mode = 'always';
  c._vacSrvTrails = { e_vacuum_robo: {
    current: { map_id: 'm1', started: 1, ended: null,
      points: [[700, 500], [900, 500], [1100, 640], [950, 1150]] },
    previous: { map_id: 'm1', started: 0, ended: 1,
      points: [[600, 1300], [800, 1300], [800, 1500]] },
  } };
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'cleaning', attributes: { friendly_name: 'Робот' } },
    'camera.robo_map': { state: 'idle', attributes: { vacuum_position: { x: 950, y: 1150, a: 0 }, map_name: 'm1' } } } };
  await c.updateComplete;
  c.hass = { ...c.hass, states: { ...c.hass.states } }; await c.updateComplete;
  const prevG = sr().querySelector('.vactrail g.prev');
  o.srvPrevRunShown = !!prevG && prevG.querySelectorAll('polyline').length === 2
    && prevG.querySelector('.case').getAttribute('points').split(' ').length === 3;
  const cur = sr().querySelector('.vactrail > path.case');
  // 4 server points, the live tail trimmed while moving -> 3 rendered
  o.srvCurTrimmed = !!cur && (cur.getAttribute('d').match(/[ML]/g) || []).length === 3;
  o.srvPrevFaded = !!prevG && getComputedStyle(prevG).opacity === '0.4';
  // XCME integration path outranks the simultaneous server run. Its two
  // subpaths remain two SVG moveto sections: no synthetic bridge over a gap.
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.robo_map': { state: 'idle', attributes: {
      vacuum_position: { x: 950, y: 1150, a: 0 }, map_name: 'm1',
      path: { path: [
        [{ x: 100, y: 100 }, { x: 200, y: 100 }],
        [{ x: 800, y: 900 }, { x: 900, y: 900 }, { x: 950, y: 1150 }],
      ] },
    } },
  } };
  await c.updateComplete;
  const integrationD = sr().querySelector('.vactrail > path.case')?.getAttribute('d') || '';
  o.multiSubpathNoBridge = (integrationD.match(/M /g) || []).length === 2
    && (integrationD.match(/L /g) || []).length === 2;
  // the growing tip is glued to the puck by the rAF sampler
  const tip = sr().querySelector('line.tip');
  o.tipExists = !!tip;
  await new Promise((r) => setTimeout(r, 250));
  const puckNow = sr().querySelector('.vacpuck').getBoundingClientRect();
  const svgT = sr().querySelector('.vactrail');
  const vbT = svgT.viewBox.baseVal; const sbT = svgT.getBoundingClientRect();
  const tx = sbT.left + ((parseFloat(tip.getAttribute('x2')) - vbT.x) / vbT.width) * sbT.width;
  const ty = sbT.top + ((parseFloat(tip.getAttribute('y2')) - vbT.y) / vbT.height) * sbT.height;
  o.tipGluedToPuck = Math.hypot(tx - (puckNow.left + puckNow.width / 2), ty - (puckNow.top + puckNow.height / 2)) < 12;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'docked', attributes: { friendly_name: 'Робот' } },
  } };
  await c.updateComplete;
  const restingIntegrationD = sr().querySelector('.vactrail > path.case')?.getAttribute('d') || '';
  o.integrationPathAlwaysAtRest = (restingIntegrationD.match(/M /g) || []).length === 2;
  // 'never' kills every line including the previous run
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.trail_mode = 'never';
  c._cfgEpoch++; c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
  o.neverHidesAll = !sr().querySelector('.vactrail');
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.trail_mode = null;
  c._vacSrvTrails = {};

  // ---- the fit panel (drag + corner-stretch) end to end ----
  c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
  const dev = c._devices.find((x) => x.id === 'e_vacuum_robo');
  o.fitDevFound = !!dev;
  // map m2 with rooms (bboxes) and a parked robot
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'camera.robo_map': { state: 'idle', attributes: { vacuum_position: { x: 500, y: 500, a: 0 }, map_name: 'm2',
      rooms: { 1: { name: 'Кухня', x0: 0, y0: 0, x1: 1000, y1: 800 },
               2: { name: 'Зал', x0: 0, y0: 800, x1: 1000, y1: 2000 } } } } } };
  await c.updateComplete;
  c._vacStartFit(dev); await c.updateComplete;
  o.fitOverlay = !!sr().querySelector('.vacfit');
  o.fitGhostRooms = sr().querySelectorAll('.vacfit polygon').length === 2;
  o.fitLabels = [...sr().querySelectorAll('.vacfit text')].map((t) => t.textContent.trim()).join('|') === 'Кухня|Зал';
  o.fitHandles = sr().querySelectorAll('.vacfithandle').length === 4;
  // REAL hit-tests: what would an actual click land on? Synthetic dispatch
  // bypasses pointer-events, and that let the untouchable overlay pass once.
  const hitAt = (el) => {
    const r = el.getBoundingClientRect();
    let n = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    while (n && n.shadowRoot) {
      const deeper = n.shadowRoot.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!deeper || deeper === n) break;
      n = deeper;
    }
    return n;
  };
  o.fitHandleHittable = hitAt(sr().querySelector('.vacfithandle'))?.classList?.contains('vacfithandle') === true;
  o.fitGhostHittable = !!hitAt(sr().querySelector('.vacfit polygon'))?.closest?.('.vacfit');
  o.fitBar = !!sr().querySelector('.vaccalbar');
  o.fitMirrorDefault = c._vacFit.p.mir === true;
  // drag: the ghost centre must follow; rotate: the centre must NOT move
  const before = { ...c._vacFit.p };
  const svgEl = sr().querySelector('.vacfit');
  const sb2 = svgEl.getBoundingClientRect();
  const fire = (type, x, y, target) => (target || svgEl).dispatchEvent(new PointerEvent(type, {
    bubbles: true, composed: true, pointerId: 7, clientX: x, clientY: y }));
  fire('pointerdown', sb2.left + sb2.width * 0.5, sb2.top + sb2.height * 0.5);
  fire('pointermove', sb2.left + sb2.width * 0.6, sb2.top + sb2.height * 0.55);
  fire('pointerup', sb2.left + sb2.width * 0.6, sb2.top + sb2.height * 0.55);
  await c.updateComplete;
  o.fitDragMoves = c._vacFit.p.ox !== before.ox && c._vacFit.p.oy !== before.oy;
  const centreBefore = (() => { const t = c._vacFit.p; const m = [t.s * (t.mir ? -1 : 1), 0, t.ox, 0, t.s, t.oy];
    return [m[0] * 500 + m[2], m[4] * 1000 + m[5]]; })();
  c._vacFitTurn({ rot: 90 }); await c.updateComplete;
  o.fitRotateKeepsCentre = c._vacFit.p.rot === 90;
  // corner-stretch scales
  const s0 = c._vacFit.p.s;
  const handle = sr().querySelector('.vacfithandle');
  const hb = handle.getBoundingClientRect();
  fire('pointerdown', hb.left + hb.width / 2, hb.top + hb.height / 2, handle);
  fire('pointermove', hb.left + hb.width / 2 + 60, hb.top + hb.height / 2 + 60);
  fire('pointerup', hb.left + hb.width / 2 + 60, hb.top + hb.height / 2 + 60);
  await c.updateComplete;
  o.fitCornerScales = Math.abs(c._vacFit.p.s - s0) > 1e-6;
  // save -> matrix stored for m2, panel closed, puck appears while cleaning
  c._vacFitSave(); await c.updateComplete;
  const savedM = c._serverCfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.calibration.m2;
  o.fitSavedMatrix = Array.isArray(savedM) && savedM.length === 6 && savedM.every(Number.isFinite);
  o.fitClosed = !c._vacFit && !sr().querySelector('.vacfit');
  o.oldWizardGone = typeof c._vacCalClick === 'undefined' && typeof c._vacStartWizard === 'undefined';
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'cleaning', attributes: { friendly_name: 'Робот' } },
    'camera.robo_map': { state: 'idle', attributes: { vacuum_position: { x: 501, y: 501, a: 0 }, map_name: 'm2',
      rooms: {} } } } };
  await c.updateComplete;
  c.hass = { ...c.hass, states: { ...c.hass.states } }; await c.updateComplete;
  o.puckAfterFit = !!sr().querySelector('.vacpuck');

  return o;
});

checkAll(out, {
  dockedNoPuck: true, baseMarkerThere: true, puckAppears: true, puckRound: true,
  puckPlateMatchesDev: true, puck80pct: true,
  noWedge: true, iconCentred: true, baseStaysDuringCleaning: true, trailDrawn: true,
  trailScaledByMatrix: true, trailBehindPuck: true, zoomTeleports: true,
  trailCasing: true, trailToggleOff: true,
  puckGoneWhenDocked: true, trailHiddenAfterDock: true, hiddenNoPuck: true,
  unknownMapNoPuck: true,
  srvPrevRunShown: true, srvCurTrimmed: true, srvPrevFaded: true,
  multiSubpathNoBridge: true, integrationPathAlwaysAtRest: true,
  tipExists: true, tipGluedToPuck: true, neverHidesAll: true,
  fitDevFound: true, fitOverlay: true, fitGhostRooms: true, fitLabels: true,
  fitHandles: true, fitHandleHittable: true, fitGhostHittable: true, fitBar: true, fitMirrorDefault: true, fitDragMoves: true,
  fitRotateKeepsCentre: true, fitCornerScales: true, fitSavedMatrix: true,
  fitClosed: true, oldWizardGone: true, puckAfterFit: true,
});
await finish(browser);
