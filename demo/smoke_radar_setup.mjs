// #485 Stage 1: eligibility, manual entry and session-local on-plan setup.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const out = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const update = async () => {
    card.requestUpdate();
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  card._setMode('devices');
  await update();
  const ordinary = card._devices.find((device) => device.bindingKind !== 'virtual'
    && !device.marker?.radar && device.id === 'd_lamp')
    || card._devices.find((device) => device.bindingKind !== 'virtual' && !device.marker?.radar);
  card._openMarkerDialog(ordinary);
  await update();
  const noAutomaticSection = !root().querySelector('.radargroup');
  const manualToggle = root().querySelector('#marker-radar-presence');
  manualToggle?.click();
  await update();
  const declared = !!card._markerDialog?.radar && !!root().querySelector('.radargroup');

  const room = card._spaceModelById(ordinary.space)?.rooms?.[0];
  const binary = Object.keys(card._planHass.states || {}).find((id) => id.startsWith('binary_sensor.'));
  card._markerDialog = {
    ...card._markerDialog,
    radar: {
      ...card._markerDialog.radar,
      profile: 'presence_v1', roomId: room?.id || '', occupancyEntity: binary || '',
    },
  };
  await update();
  root().querySelector('.radargroup button ha-icon[icon="mdi:map-marker-radius"]')
    ?.closest('button')?.click();
  await update();
  const setup = root().querySelector('.radarsetup');
  const setupOpened = !!setup;
  const planSvg = setup?.querySelector('svg');
  const press = (x, y) => planSvg?.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: x, clientY: y, pointerId: 1,
  }));
  if (planSvg) {
    planSvg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000,
      right: 1000, bottom: 1000, x: 0, y: 0, toJSON() {} });
    press(250, 400);
    press(250, 100);
  }
  await update();
  const installationDrafted = card._editorRuntime?._radarSetup?.isActive() === true;
  const persistedBeforeSave = card._serverCfg.markers.find((marker) => marker.id === ordinary.id)?.radar;
  root().querySelector('.radarsetup .iconbtn')?.click();
  await update();
  const cancelReleased = !root().querySelector('.radarsetup')
    && card._serverCfg.markers.find((marker) => marker.id === ordinary.id)?.radar === persistedBeforeSave;

  card._closeMarkerDialog();
  // #602: a radar saved in an earlier session reopens as an enabled toggle in
  // Details, regardless of whether it was once manual or auto-recognized.
  const savedRadar = {
    version: 1, enabled: true, show_live: true, profile: 'presence_v1',
    sources: { occupancy_entity: binary || '' },
    mount: { installation_id: 'saved-radar-smoke', x: 50, y: 50, heading_deg: 0, range_cm: 500, fov_deg: 120 },
    room_id: room?.id || '',
    calibration: { method: 'not_required', mirror: false, cell_cm: card._spaceModelById(ordinary.space)?.cellCm || 5 },
  };
  const originalMarker = ordinary.marker;
  ordinary.marker = { ...(ordinary.marker || {}), id: ordinary.id, binding: `device:${ordinary.bindingRef}`, radar: savedRadar };
  card._openMarkerDialog(ordinary);
  await update();
  const savedToggle = root().querySelector('#marker-radar-presence');
  const savedReopensInline = savedToggle?.checked === true
    && !!savedToggle.closest('.hpf-card[data-card="details"] .radaradditional')?.querySelector('.radargroup')
    && !root().querySelector('.hpf-card[data-card="basics"] .radargroup');
  savedToggle?.click(); await update();
  const savedOffKeepsOriginal = card._markerDialog?.radarRemove === true
    && card._markerDialog?.radar?.original?.mount?.installation_id === 'saved-radar-smoke';
  root().querySelector('#marker-radar-presence')?.click(); await update();
  const savedOnRestoresOriginal = card._markerDialog?.radarRemove === false
    && card._markerDialog?.radar?.original?.mount?.installation_id === 'saved-radar-smoke';
  card._closeMarkerDialog();
  ordinary.marker = originalMarker;
  const virtual = card._devices.find((device) => device.bindingKind === 'virtual');
  if (virtual) card._openMarkerDialog(virtual);
  await update();
  const virtualHasNoEntry = !virtual || (!root().querySelector('.radargroup')
    && !root().querySelector('.radaradditional'));
  card._closeMarkerDialog();
  card._setMode('view');
  return {
    noAutomaticSection, manualToggleVisible: !!manualToggle, declared, setupOpened,
    installationDrafted, cancelReleased, savedReopensInline, savedOffKeepsOriginal,
    savedOnRestoresOriginal, virtualHasNoEntry,
  };
});

// #774: the on-plan setup shows the real contour of the selected room, and the
// contour, mount, heading, pending/reference marks and the live trail share ONE
// projection: content frame (docs/CANVAS.md §4) → SVG viewBox → xMidYMid meet.
// Plan units below are the stored ones (render = ×1000). Every expected number
// is computed here, from the fixture and the measured SVG rectangle — never by
// asking the product code.
const POLY = {
  // an ordinary non-rectangular room inside the historical square
  r_l: [[0.1, 0.2], [0.7, 0.2], [0.7, 0.45], [0.4, 0.45], [0.4, 0.6], [0.1, 0.6]],
  // a room entirely outside [0,1], negative on both axes
  r_out: [[-0.55, -0.4], [-0.15, -0.4], [-0.15, -0.1], [-0.35, -0.1], [-0.55, -0.25]],
  // a room entirely past 1 on both axes
  r_far: [[1.1, 0.8], [1.45, 0.8], [1.45, 1.15], [1.1, 1.15]],
};
const SAVED_774 = {
  version: 1, enabled: true, show_live: false, profile: 'cartesian_v1',
  sources: { slots: [{ id: 'target_1', x_entity: 'sensor.living_temp',
    y_entity: 'sensor.living_temp', unit: 'cm' }] },
  room_id: 'r_l',
  mount: { installation_id: 'smoke-774', x: 0.2, y: 0.3, heading_deg: 45, range_cm: 600, fov_deg: 120 },
  calibration: { method: 'two_point', mirror: false, cell_cm: 5, rms_cm: 4,
    refs: [{ plan: { x: 0.3, y: 0.3 }, local_cm: { x: 0, y: 100 } },
      { plan: { x: 0.25, y: 0.4 }, local_cm: { x: 80, y: 60 } }] },
};
const FIXTURE_774 = {
  spaces: [{
    id: 'rs', title: 'Radar setup', view_box: [0, 0, 1, 1], cell_cm: 5, plan_url: null, plan_aspect: null,
    rooms: [
      { id: 'r_l', name: 'L room', area: 'zx_l', poly: POLY.r_l },
      { id: 'r_out', name: 'Outside', area: 'zx_out', poly: POLY.r_out },
      { id: 'r_far', name: 'Far', area: 'zx_far', poly: POLY.r_far },
      // a legacy rectangle: a room WITHOUT a contour polygon
      { id: 'r_rect', name: 'No contour', area: 'zx_rect', x: 0.75, y: 0.25, w: 0.15, h: 0.15 },
    ],
  }],
  // made-up areas: no demo device lands here, the radar is the only marker
  markers: [{ id: 'm_radar', binding: 'device:d_motion', area: 'zx_l', radar: SAVED_774 }],
  settings: { filter_seeded: true },
};
// The radar's icon stands outside every room, so a frame built from the rooms
// alone (a truncated set of inputs) is NOT the frame the card opens on.
const LAYOUT_774 = { m_radar: { s: 'rs', x: -0.6, y: 1.2 } };
// Content bbox: x -600..1450 (2050), y -400..1200 (1600); 5 % of 2050 = 102.5.
// Five items, no outlier (docs/CANVAS.md §4.1) → core = all.
const FRAME_774 = [-702.5, -502.5, 2255, 1805];

const out774 = await page.evaluate(async ({ fixture, layout, poly, frame, saved }) => {
  const hp = window.__hpTest;
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const result = {};
  const savedRadar = () => JSON.stringify(card._serverCfg.markers.find((m) => m.id === 'm_radar')?.radar);
  const setup = () => root().querySelector('.radarsetup');
  const svgOf = () => setup()?.querySelector('svg') || null;
  const viewBoxOf = (svg) => (svg?.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const pointsOf = (value) => (value || '').trim().split(/\s+/).filter(Boolean)
    .map((pair) => pair.split(',').map(Number));
  const contourOf = (svg) => pointsOf(svg?.querySelector('polygon.room')?.getAttribute('points'));
  const render = (pts) => pts.map(([x, y]) => [x * 1000, y * 1000]);
  const samePts = (a, b, eps = 1e-6) => a.length === b.length
    && a.every((p, i) => Math.abs(p[0] - b[i][0]) <= eps && Math.abs(p[1] - b[i][1]) <= eps);
  const near = (a, b, eps) => !!a && !!b && Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;
  const within = (pts, vb) => pts.length > 0 && pts.every(([x, y]) => x >= vb[0] && y >= vb[1]
    && x <= vb[0] + vb[2] && y <= vb[1] + vb[3]);
  const sameFrame = (a, b) => a.length === 4 && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  // xMidYMid meet, written out independently of src/radar-setup.ts
  const screen = (svg) => {
    const rect = svg.getBoundingClientRect();
    const [vx, vy, vw, vh] = viewBoxOf(svg);
    const k = Math.min(rect.width / vw, rect.height / vh);
    const ox = rect.left + (rect.width - vw * k) / 2;
    const oy = rect.top + (rect.height - vh * k) / 2;
    return { rect, k, ox, oy, client: ([px, py]) => [ox + (px * 1000 - vx) * k, oy + (py * 1000 - vy) * k] };
  };
  const press = (svg, [x, y]) => svg.dispatchEvent(new PointerEvent('pointerdown', {
    bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true,
  }));
  const centre = (el) => {
    const r = el?.getBoundingClientRect();
    return r ? [r.left + r.width / 2, r.top + r.height / 2] : null;
  };
  const markOf = (cls) => svgOf()?.querySelector(`g.${cls} circle`) || null;
  const marksAt = (cls) => [...(svgOf()?.querySelectorAll(`g.${cls}`) || [])]
    .map((g) => g.getAttribute('transform'));
  const choose = async (select, value) => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await hp.settled();
  };
  const roomSelect = () => root().querySelector('#radar-room');
  const configure = async () => {
    root().querySelector('.radargroup button ha-icon[icon="mdi:map-marker-radius"]')
      ?.closest('button')?.click();
    await hp.settled();
    return svgOf();
  };
  const toast = () => root().querySelector('[data-hp="toast"]')?.textContent?.trim() || '';
  const markerDialog = () => root().querySelector('[data-hp="dialog"][data-kind="marker"]');
  const acceptConfirm = async (confirm) => {
    const buttons = [...(confirm?.querySelectorAll('.danger-confirm-footer button')
      || confirm?.shadowRoot?.querySelectorAll('.danger-confirm-footer button') || [])];
    buttons.at(-1)?.click();
    await hp.settled();
  };
  const closeMarker = async () => {
    if (!markerDialog()) return false;
    const { confirm } = await hp.close(markerDialog(), { via: 'escape' });
    if (confirm) await acceptConfirm(confirm);
    // a second confirmation (the dialog's own) may follow the setup's
    const again = root().querySelector('[data-hp="dialog"][data-kind="confirm"]');
    if (again) await acceptConfirm(again);
    return !markerDialog();
  };

  // Live diagnostics: the demo's subscribeMessage is a no-op; this one hands the
  // setup subscription's callback to the smoke so it can push real snapshots.
  const connection = card.hass.connection;
  const realSubscribe = connection.subscribeMessage;
  const live = { push: null, subscribed: 0, released: 0 };
  connection.subscribeMessage = async (callback, message) => {
    if (message?.type !== 'houseplan/radar/setup/subscribe') return () => {};
    live.subscribed += 1;
    live.push = callback;
    return () => { live.released += 1; };
  };
  const realNow = Date.now;
  let skew = 0;
  Date.now = () => realNow.call(Date) + skew;
  // Every config write the card sends, as the radar block it would persist. The
  // editor may write unrelated housekeeping on its own; only a changed radar
  // block before the ordinary Save is a leak (AC4).
  const hass = card.hass;
  const realCallWS = hass.callWS;
  const radarWrites = [];
  hass.callWS = async (message) => {
    if (message?.type === 'houseplan/config/set') {
      radarWrites.push(JSON.stringify(message.config?.markers?.find((m) => m.id === 'm_radar')?.radar));
    }
    return realCallWS(message);
  };
  try {
    await hp.setServerConfig(fixture);
    await hp.setLayout(layout);
    if (card._space !== 'rs') await hp.switchSpace('rs');
    await hp.setMode('devices');
    await hp.openMarkerDialog('m_radar');
    const saved0 = savedRadar();
    const persisted = () => savedRadar() === saved0 && radarWrites.every((radar) => radar === saved0);
    result.fixtureLoaded = saved0 === JSON.stringify(saved) && !!roomSelect();

    // -------------------------------------------------- AC1: room outside [0,1]
    await choose(roomSelect(), 'r_out');
    let svg = await configure();
    result.setupOpensForOutsideRoom = !!svg;
    const vb = viewBoxOf(svg);
    result.frameIsContentDerived = sameFrame(vb, frame);
    // the main card frames the same space with the very same numbers
    const cardFrame = card._frameOf().rect;
    result.frameMatchesMainCard = sameFrame(vb, [cardFrame.x, cardFrame.y, cardFrame.w, cardFrame.h]);
    const contourOut = contourOf(svg);
    result.outsideContourScaledOnce = samePts(contourOut, render(poly.r_out));
    result.outsideContourFitsViewBox = within(contourOut, vb);

    // -------------------------------------------------- AC2/AC3: one projection
    let view = screen(svg);
    result.squareSvgLetterboxes = Math.abs(view.rect.width - view.rect.height) < 1
      && view.oy - view.rect.top > 10;
    press(svg, [view.rect.left + view.rect.width / 2, view.rect.top + (view.oy - view.rect.top) / 2]);
    await hp.settled();
    result.letterboxPressIgnored = !markOf('mount')
      && card._editorRuntime._radarSetup.active?.mount === null;
    const MOUNT = [-0.3, -0.25];       // inside r_out: negative plan units
    const AHEAD = [0.5, -0.25];        // due east of the mount → heading 90°
    press(svg, view.client(MOUNT));
    await hp.settled();
    press(svg, view.client(AHEAD));
    await hp.settled();
    const state = () => card._editorRuntime._radarSetup.active;
    result.mountInPlanUnits = near(state()?.mount, MOUNT, 1e-9)
      && state()?.draft.mountX === '-300' && state()?.draft.mountY === '-250'
      && state()?.draft.heading === '90';
    result.mountMarkOnClick = near(centre(markOf('mount')), view.client(MOUNT), 1);
    const line = svgOf().querySelector('line.heading');
    result.headingLineInSceneUnits = !!line
      && near([+line.getAttribute('x1'), +line.getAttribute('y1')], [-300, -250], 1e-6)
      && near([+line.getAttribute('x2'), +line.getAttribute('y2')], [500, -250], 1e-6);
    const polygonBox = svgOf().querySelector('polygon.room').getBoundingClientRect();
    const outMin = view.client([-0.55, -0.4]);
    const outMax = view.client([-0.15, -0.1]);
    result.contourOnScreenWhereProjected = Math.abs(polygonBox.left - outMin[0]) < 1.5
      && Math.abs(polygonBox.top - outMin[1]) < 1.5 && Math.abs(polygonBox.right - outMax[0]) < 1.5
      && Math.abs(polygonBox.bottom - outMax[1]) < 1.5;
    await sleep(0);
    result.coordinateProfileSubscribed = live.subscribed === 1 && typeof live.push === 'function';

    // live trail: 600 cm ahead, then 60 cm to its right (heading 90, cell 5 → 1200 cm/unit)
    live.push?.({ local_targets: [{ slot: 'target_1', x_cm: 0, y_cm: 600 }], frame: { health: 'ok' } });
    live.push?.({ local_targets: [{ slot: 'target_1', x_cm: 60, y_cm: 600 }], frame: { health: 'ok' } });
    await hp.settled();
    const trail = pointsOf(svgOf().querySelector('polyline.trail')?.getAttribute('points'));
    result.trailInSameProjection = samePts(trail, [[200, -250], [200, -200]], 1e-6);
    result.frameStableAfterClicksAndLive = sameFrame(viewBoxOf(svgOf()), frame);

    // reference 1 at x > 1, y < 0: exactly 1800 cm ahead of the mount
    const REF1 = [1.2, -0.25];
    press(svgOf(), view.client(REF1));
    await hp.settled();
    result.pendingMarkOnClick = near(state()?.pendingPlan, REF1, 1e-9)
      && near(centre(markOf('pending')), view.client(REF1), 1);
    const capture = async (local) => {
      setup().querySelector('.row button.btn:not(.ghost):not(.on)')?.click();
      await hp.settled();
      skew += 10_500;                                 // countdown over
      const t0 = Date.now() / 1000;
      for (const dt of [0, 1.2, 2.4]) {
        live.push?.({ local_targets: [{ slot: 'target_1', x_cm: local[0], y_cm: local[1],
          reported_at: t0 + dt }], frame: { health: 'ok' } });
      }
      skew += 5_000;                                  // capture window over
      await sleep(450);                               // the 200 ms setup tick closes it
      await hp.settled();
    };
    await capture([0, 1800]);
    result.referenceOneCaptured = state()?.phase === 'reference_2'
      && near(state()?.refs?.[0]?.plan, REF1, 1e-9)
      && near(centre(markOf('reference')), view.client(REF1), 1);

    // resize: only the screen matrix changes; the scene and the stored points do not
    const before = { vb: svgOf().getAttribute('viewBox'), marks: [...marksAt('mount'), ...marksAt('reference')] };
    svgOf().style.width = '300px';
    await hp.settled();
    view = screen(svgOf());
    result.resizeChangedScreen = Math.abs(view.rect.width - 300) < 1;
    result.resizeKeepsFrameAndScene = svgOf().getAttribute('viewBox') === before.vb
      && JSON.stringify([...marksAt('mount'), ...marksAt('reference')]) === JSON.stringify(before.marks);
    result.resizeMovesMarksWithMatrix = near(centre(markOf('mount')), view.client(MOUNT), 1)
      && near(centre(markOf('reference')), view.client(REF1), 1);
    // reference 2 placed through the NEW matrix: 1200 cm right and 1200 cm ahead
    const REF2 = [0.7, 0.75];
    press(svgOf(), view.client(REF2));
    await hp.settled();
    result.clickAfterResizeLands = near(state()?.pendingPlan, REF2, 1e-9)
      && near(centre(markOf('pending')), view.client(REF2), 1);
    await capture([1200, 1200]);
    result.twoPointSolved = state()?.phase === 'solved' && state()?.solved?.mirror === false
      && Math.abs(state()?.solved?.headingDeg - 90) < 1e-6;
    result.frameStableThroughSession = sameFrame(viewBoxOf(svgOf()), frame);

    // -------------------------------------------------- AC4: Apply ≠ Save
    setup().querySelector('.row button.btn.on')?.click();
    await hp.settled();
    const applied = card._markerDialog?.radar;
    const refs = applied?.calibrationOverride?.refs || [];
    result.applyReturnsPlanUnits = !setup() && applied?.mountX === '-300' && applied?.mountY === '-250'
      && applied?.heading === '90' && applied?.mirror === false
      && applied?.calibrationOverride?.method === 'two_point' && refs.length === 2
      && near([refs[0].plan.x, refs[0].plan.y], REF1, 1e-9)
      && near([refs[1].plan.x, refs[1].plan.y], REF2, 1e-9)
      && refs[0].local_cm.x === 0 && refs[0].local_cm.y === 1800;
    result.applyReleasesSubscription = live.released === 1;
    result.applyDoesNotPersist = persisted();
    result.closeWithoutSaveDiscards = await closeMarker() && persisted();

    // -------------------------------------------------- reopen: saved calibration untouched
    await hp.openMarkerDialog('m_radar');
    result.reopenShowsSavedCalibration = JSON.stringify(card._markerDialog?.radar?.original) === saved0
      && roomSelect()?.value === 'r_l';
    // AC1: the ordinary non-rectangular room, same frame
    svg = await configure();
    const contourL = contourOf(svg);
    result.ordinaryContourScaledOnce = samePts(contourL, render(poly.r_l));
    result.ordinaryContourFitsViewBox = within(contourL, viewBoxOf(svg));
    result.ordinaryRoomSameFrame = sameFrame(viewBoxOf(svg), frame);
    // Escape with a dirty setup: confirmation, nothing written
    view = screen(svg);
    press(svg, view.client([0.2, 0.3]));
    await hp.settled();
    result.escapeWithDirtySetupDiscards = !!markOf('mount') && await closeMarker() && persisted();

    // -------------------------------------------------- AC5: no contour / unknown room
    await hp.openMarkerDialog('m_radar');
    await choose(roomSelect(), 'r_rect');
    svg = await configure();
    result.noContourWarns = toast() === card._t('radar.no_contour');
    result.noContourNoInventedOutline = !!svg && contourOf(svg).length === 0
      && sameFrame(viewBoxOf(svg), frame);
    setup().querySelector('.radarsetup-head .iconbtn')?.click();
    await hp.settled();
    result.untouchedCancelCloses = !setup();
    await closeMarker();
    await hp.setServerConfig((cfg) => {
      cfg.markers.find((m) => m.id === 'm_radar').radar.room_id = 'r_gone';
      return cfg;
    });
    await hp.openMarkerDialog('m_radar');
    svg = await configure();
    result.unknownRoomIsAnError = !svg && toast() === card._t('radar.invalid');
    await closeMarker();

    // -------------------------------------------------- AC2: stored view_box does not frame content
    await hp.setServerConfig((cfg) => {
      cfg.spaces[0].view_box = [5, 5, 2, 2];
      cfg.markers.find((m) => m.id === 'm_radar').radar.room_id = 'r_l';
      return cfg;
    });
    await hp.openMarkerDialog('m_radar');
    svg = await configure();
    result.storedViewBoxIgnoredWithContent = sameFrame(viewBoxOf(svg), frame);
    setup().querySelector('.radarsetup-head .iconbtn')?.click();
    await hp.settled();
    await closeMarker();

    // -------------------------------------------------- AC1: the outlier room (core → all)
    await hp.setServerConfig((cfg) => {
      cfg.spaces[0].rooms.push({ id: 'r_remote', name: 'Remote', area: 'zx_remote',
        poly: [[40, 40], [40.5, 40], [40.5, 40.5], [40, 40.5]] });
      return cfg;
    });
    await hp.openMarkerDialog('m_radar');
    svg = await configure();
    result.mainMassRoomKeepsCore = sameFrame(viewBoxOf(svg), frame);
    setup().querySelector('.radarsetup-head .iconbtn')?.click();
    await hp.settled();
    await choose(roomSelect(), 'r_remote');
    svg = await configure();
    const remote = contourOf(svg);
    // all: x -600..40500 (41100), y -400..40500 (40900); 5 % of 41100 = 2055
    result.outlierRoomOpensOnAll = sameFrame(viewBoxOf(svg), [-2655, -2455, 45210, 45010])
      && samePts(remote, [[40000, 40000], [40500, 40000], [40500, 40500], [40000, 40500]])
      && within(remote, viewBoxOf(svg));
    setup().querySelector('.radarsetup-head .iconbtn')?.click();
    await hp.settled();
    await closeMarker();
    result.scenarioCompleted = true;
  } catch (error) {
    // keep the named results gathered so far; the failure itself is reported too
    result.scenarioCompleted = `stopped: ${error?.message || error}`;
  } finally {
    Date.now = realNow;
    hass.callWS = realCallWS;
    connection.subscribeMessage = realSubscribe;
    if (markerDialog()) await closeMarker().catch(() => {});
    await hp.setMode('view').catch(() => {});
  }
  return result;
}, { fixture: FIXTURE_774, layout: LAYOUT_774, poly: POLY, frame: FRAME_774, saved: SAVED_774 });

await finish(browser, checkAll({ ...out, ...out774 }));
