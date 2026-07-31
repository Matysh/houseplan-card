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
  c.hass = { ...c.hass, states: { ...c.hass.states,
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
  const trail = sr().querySelector('.vactrail polyline');
  o.trailDrawn = !!trail && trail.getAttribute('points').split(' ').length >= 3;
  o.trailScaledByMatrix = !!trail && trail.getAttribute('points').startsWith('300.0,400.0');


  // trail off via marker option
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.trail = false;
  c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
  o.trailToggleOff = !sr().querySelector('.vactrail');
  cfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.trail = null;

  // dock -> puck dissolves, trail lingers (linger window)
  c.hass = { ...c.hass, states: { ...c.hass.states,
    'vacuum.robo': { state: 'docked', attributes: { friendly_name: 'Робот' } } } };
  c._regSignature = ''; c.requestUpdate(); await c.updateComplete; await new Promise((r) => setTimeout(r, 30));
  o.puckGoneWhenDocked = !sr().querySelector('.vacpuck');
  o.trailLingers = !!sr().querySelector('.vactrail polyline');

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

  // ---- the three-point wizard end to end ----
  c._regSignature = ''; c.requestUpdate(); await c.updateComplete;
  const dev = c._devices.find((x) => x.id === 'e_vacuum_robo');
  o.wizardDevFound = !!dev;
  // robot parked at known coords on map m2 (uncalibrated so far)
  const putRobot = async (x, y) => {
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'camera.robo_map': { state: 'idle', attributes: { vacuum_position: { x, y, a: 0 }, map_name: 'm2' } } } };
    await c.updateComplete;
  };
  await putRobot(200, 200);
  c._vacStartWizard(dev); await c.updateComplete;
  o.wizardBanner = !!sr().querySelector('.vaccalbar');
  // three clicks; the stage click handler converts client → canvas via
  // _svgPoint, so click through the real stage at chosen client points
  const stage = sr().querySelector('.stage');
  const sb = stage.getBoundingClientRect();
  const click = async (fx, fy) => {
    stage.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true,
      clientX: sb.left + sb.width * fx, clientY: sb.top + sb.height * fy }));
    await c.updateComplete;
  };
  await click(0.2, 0.2);
  await putRobot(1800, 200);
  await click(0.8, 0.2);
  await putRobot(1800, 1800);
  await click(0.8, 0.8);
  const savedM = c._serverCfg.markers.find((m) => m.id === 'e_vacuum_robo').vacuum.calibration.m2;
  o.wizardSavedMatrix = Array.isArray(savedM) && savedM.length === 6 && savedM.every(Number.isFinite);
  o.wizardClosed = !c._vacCal;
  // the freshly calibrated map now shows the puck while cleaning
  await putRobot(1000, 1000);
  o.puckAfterWizard = !!sr().querySelector('.vacpuck');

  return o;
});

checkAll(out, {
  dockedNoPuck: true, baseMarkerThere: true, puckAppears: true, puckRound: true,
  puckPlateMatchesDev: true, puck80pct: true,
  noWedge: true, iconCentred: true, baseStaysDuringCleaning: true, trailDrawn: true,
  trailScaledByMatrix: true, trailToggleOff: true,
  puckGoneWhenDocked: true, trailLingers: true, hiddenNoPuck: true,
  unknownMapNoPuck: true,
  wizardDevFound: true, wizardBanner: true, wizardSavedMatrix: true,
  wizardClosed: true, puckAfterWizard: true,
});
await finish(browser);
