// #918: real recorder → public payload → cold View. All home data is synthetic.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchColdView, requirePinnedBrowser, checkAll, finish } from './serve.mjs';

requirePinnedBrowser();
const repo = fileURLToPath(new URL('..', import.meta.url));
const localPython = fileURLToPath(new URL('../.venv-ci/Scripts/python.exe', import.meta.url));
const python = process.env.PYTHON || (process.platform === 'win32'
  ? existsSync(localPython) ? localPython : 'python' : 'python3');
const fixture = JSON.parse(execFileSync(python, ['demo/helpers/vacuum-route-recovery.py'],
  { cwd: repo, encoding: 'utf8' }));
const checks = { recorderIdentified: fixture.evidence.identified,
  recorderExactSource: fixture.evidence.exactSource,
  recorderForeignRootIgnored: fixture.evidence.unrelatedRootUnchanged };

for (const [screen, viewport] of [['desktop', { width: 1200, height: 900 }],
  ['mobile', { width: 390, height: 844 }]]) {
  const { page, browser } = await launchColdView(viewport, 1, [], { hasTouch: screen === 'mobile' });
  try {
    await page.evaluate(async (f) => {
      const old = window.__card, baseWS = old.hass.callWS.bind(old.hass);
      const baseSubscribe = old.hass.connection.subscribeEvents.bind(old.hass.connection);
      for (const [id, state] of Object.entries(f.states)) window.__addRegistryEntity(id, null, state.state);
      const witness = window.__route918 = { fixture: f, payload: f.after, reads: 0, notify: null };
      const hass = { ...old.hass, states: { ...old.hass.states, ...f.states },
        connection: { ...old.hass.connection, subscribeEvents: async (handler, event) => {
          if (event === 'houseplan_trail_updated') { witness.notify = handler; return () => {}; }
          return baseSubscribe(handler, event);
        } },
        callWS: async (message) => {
          if (message.type === 'houseplan/trail/get') { witness.reads++; return structuredClone(witness.payload); }
          return baseWS(message);
        } };
      await window.__hpTest.setServerConfig(cfg => ({ ...cfg,
        settings: { ...cfg.settings, volumetric_view: false }, markers: [...cfg.markers, f.marker] }));
      await window.__hpTest.setLayout(layout => ({ ...layout, [f.marker.id]: { s: 'f1', x: .1, y: .1 } }));
      witness.mount = async () => {
        const prior = window.__card, card = document.createElement('houseplan-card');
        card.hass = prior === old ? hass : prior.hass;
        card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
        prior.replaceWith(card); window.__card = card;
        await window.__hpTest.settled();
      };
      witness.publish = async (payload) => {
        witness.payload = structuredClone(payload);
        await witness.notify?.({ data: {} });
        await window.__hpTest.settled();
      };
      witness.state = async (id, patch) => {
        const c = window.__card;
        c.hass = { ...c.hass, states: { ...c.hass.states, [id]: { ...c.hass.states[id], ...patch } } };
        await window.__hpTest.settled();
      };
      witness.configure = async (change) => window.__hpTest.setServerConfig(cfg => ({
        ...cfg, markers: cfg.markers.map(marker => marker.id === f.marker.id
          ? { ...marker, vacuum: change(structuredClone(marker.vacuum)) } : marker),
      }));
      witness.geometry = () => {
        const c = window.__card, root = c.renderRoot;
        const path = root.querySelector('.vactrail > path.core');
        const tip = root.querySelector('.vactrail line.tip.core');
        const puck = root.querySelector('.vacpuck[data-mid="e_vacuum_route918"]');
        const plan = root.querySelector('.plan-svg');
        const point = new DOMPoint(320, 420).matrixTransform(plan.getScreenCTM());
        const box = puck?.getBoundingClientRect();
        const centre = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : null;
        const tipEnd = tip ? new DOMPoint(+tip.getAttribute('x2'), +tip.getAttribute('y2'))
          .matrixTransform(tip.getScreenCTM()) : null;
        const start = path?.getPointAtLength(0), end = path?.getPointAtLength(path.getTotalLength());
        const visible = path ? getComputedStyle(path).visibility !== 'hidden'
          && getComputedStyle(path).display !== 'none' && path.getTotalLength() > 0 : false;
        const diagnostic = c._vacTrailDiagnostics(c._devices.find(d => d.id === 'e_vacuum_route918'));
        return { d: path?.getAttribute('d') || '', visible, hasPuck: !!puck, hasTip: !!tip,
          start: start ? [start.x, start.y] : null, end: end ? [end.x, end.y] : null,
          puckError: centre ? Math.hypot(centre.x - point.x, centre.y - point.y) : 1e9,
          tipError: centre && tipEnd ? Math.hypot(centre.x - tipEnd.x, centre.y - tipEnd.y) : 1e9,
          puckStyle: puck?.getAttribute('style'), diagnostic,
          mode: root.querySelector('ha-card[data-hp-mode]')?.getAttribute('data-hp-mode'),
          previous: !!root.querySelector('.vactrail g.prev'), reads: witness.reads };
      };
      await witness.mount();
    }, fixture);
    await page.waitForFunction(() => window.__card._vacTrailFormat === 2
      && window.__card._devices.some(d => d.id === 'e_vacuum_route918'));
    await page.waitForTimeout(1300); // ordinary puck CSS interpolation, not a runtime write.
    for (const iso of [false, true]) {
      await page.evaluate(iso => window.__hpTest.setVolumetricView(iso), iso);
      await page.waitForTimeout(1300);
      const prefix = `${screen}:${iso ? 'iso' : 'flat'}`;
      const initial = await page.evaluate(() => window.__route918.geometry());
      checks[`${prefix}:coldViewLoadsServerPath`] = initial.mode === 'view' && initial.reads > 0
        && initial.visible && initial.diagnostic.rendered > 0;
      checks[`${prefix}:pathUsesOnlyRouteCoordinates`] = JSON.stringify(initial.start) === '[100,100]'
        && JSON.stringify(initial.end) === '[300,100]' && !initial.previous;
      checks[`${prefix}:puckUsesRouteSource`] = initial.hasPuck && initial.puckError <= 1;
      checks[`${prefix}:tipEndsAtRoutePuck`] = initial.hasTip && initial.tipError <= 1;
      await page.evaluate(() => window.__route918.state('camera.root918', {
        attributes: { map_name: '1', robot_position: { x: 1500, y: 1600 } },
      }));
      await page.waitForTimeout(1300);
      const movedRoot = await page.evaluate(() => window.__route918.geometry());
      checks[`${prefix}:rootOnlyUpdateCannotMoveRoute`] = movedRoot.d === initial.d
        && movedRoot.puckStyle === initial.puckStyle && movedRoot.puckError <= 1;
    }
    // A fresh client begins in View after the recorder has already collected
    // the path. No editor visit, config resave, vacuum start or local sample.
    await page.evaluate(async () => {
      window.__route918.payload = window.__route918.fixture.reloaded;
      await window.__route918.mount();
    });
    await page.waitForFunction(() => window.__card._vacTrailFormat === 2
      && window.__card._devices.some(d => d.id === 'e_vacuum_route918'));
    await page.waitForTimeout(1300);
    const reloaded = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:freshClientRestoresPathWithoutEditor`] = reloaded.mode === 'view'
      && reloaded.visible && reloaded.hasTip && reloaded.puckError <= 1 && reloaded.reads >= 2;

    await page.evaluate(() => window.__hpTest.switchSpace('garden'));
    const otherFloor = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:foreignFloorHasNoCurrentOrPuck`] = !otherFloor.visible && !otherFloor.hasPuck
      && otherFloor.diagnostic.rendered === 0 && otherFloor.diagnostic.display === 'vac.trail_display_space';
    await page.evaluate(() => window.__hpTest.switchSpace('f1'));

    await page.evaluate(() => window.__route918.state('camera.route918', { state: 'unavailable' }));
    const unavailable = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:unavailableRouteDoesNotBorrowRoot`] = !unavailable.visible && !unavailable.hasPuck
      && unavailable.diagnostic.rendered === 0;
    await page.evaluate(() => window.__route918.state('camera.route918', { state: 'idle',
      attributes: { map_name: '1', robot_position: { x: 320, y: 420 } } }));
    const wrongMap = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:oneIsNotMapOne`] = !wrongMap.visible && !wrongMap.hasPuck
      && wrongMap.diagnostic.rendered === 0;
    await page.evaluate(() => window.__route918.state('camera.route918', {
      attributes: window.__route918.fixture.states['camera.route918'].attributes }));
    await page.waitForTimeout(1300);
    const recovered = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:sameSourceRecoveryNeedsNoConfigChange`] = recovered.visible
      && recovered.puckError <= 1 && recovered.diagnostic.display === 'vac.trail_display_visible';

    await page.evaluate(() => window.__route918.configure(v => ({ ...v,
      map_routes: [...v.map_routes, { ...v.map_routes[0], id: 'ambiguous-918' }] })));
    const ambiguous = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:ambiguousRouteCannotChooseByOrder`] = !ambiguous.visible && !ambiguous.hasPuck
      && ambiguous.diagnostic.rendered === 0;
    await page.evaluate(() => window.__route918.configure(v => ({ ...v, map_routes: [] })));
    const empty = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:emptyRoutesCannotResurrectLegacyCalibration`] = !empty.visible && !empty.hasPuck;
    await page.evaluate(() => window.__route918.configure(() => window.__route918.fixture.marker.vacuum));

    await page.evaluate(() => window.__route918.configure(v => ({ ...v, trail_mode: 'never' })));
    const never = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:neverSuppressesPathButKeepsPosition`] = !never.visible && never.hasPuck
      && never.diagnostic.display === 'vac.trail_display_mode';
    await page.evaluate(() => window.__route918.configure(v => ({ ...v, trail_mode: 'cleaning' })));
    await page.evaluate(() => window.__route918.state('vacuum.route918', { state: 'paused' }));
    await page.waitForTimeout(350);
    const stopped = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:cleaningModeStopsWithVacuum`] = !stopped.visible && !stopped.hasPuck
      && stopped.diagnostic.display === 'vac.trail_display_stopped';
    await page.evaluate(() => window.__route918.configure(v => ({ ...v, trail_mode: 'always' })));
    const always = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:alwaysRetainsStoppedPath`] = always.visible && !always.hasPuck;
    await page.evaluate(() => window.__route918.state('vacuum.route918', { state: 'cleaning' }));
    await page.waitForTimeout(1300);
    checks[`${screen}:resumeWithoutEditor`] = (await page.evaluate(() => window.__route918.geometry())).hasTip;

    // Previous belongs to its own exact route. It can render on garden while
    // current remains on f1; neither connects to the other route or root.
    await page.evaluate(async () => {
      const w = window.__route918;
      await w.configure(v => ({ ...v, map_routes: [...v.map_routes,
        { ...v.map_routes[0], id: 'r918-garden', map_id: 'Map 2', space: 'garden' }] }));
      const payload = structuredClone(w.fixture.after);
      payload.trails.e_vacuum_route918.previous = { route_id: 'r918-garden', map_id: 'Map 2',
        path_format: 2, paths: [[[500, 600], [700, 600]]], points: [[500, 600], [700, 600]],
        quality: { source: 'positions', reason: 'sampled', raw_points: 2 }, ended: 10 };
      await w.publish(payload);
      await window.__hpTest.switchSpace('garden');
    });
    const history = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:historyOnlyOnItsOwnFloor`] = history.previous && !history.visible && !history.hasPuck;
    if (!checks[`${screen}:historyOnlyOnItsOwnFloor`]) console.error('history frame', screen, history,
      await page.evaluate(() => ({
        vacuum: window.__card._devices.find(d => d.id === 'e_vacuum_route918').marker.vacuum,
        server: window.__card._vacSrvTrails.e_vacuum_route918,
      })));
    await page.evaluate(() => window.__route918.state('camera.route918', {
      attributes: { map_name: 'unknown-map', robot_position: { x: 320, y: 420 } },
    }));
    const unresolvedHistory = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:unresolvedCurrentKeepsIdentifiedHistory`] = unresolvedHistory.previous
      && !unresolvedHistory.visible && !unresolvedHistory.hasPuck;
    await page.evaluate(async () => {
      await window.__hpTest.switchSpace('f1');
      await window.__route918.configure(() => window.__route918.fixture.marker.vacuum);
      await window.__route918.state('camera.route918', window.__route918.fixture.states['camera.route918']);
      await window.__route918.publish(window.__route918.fixture.after);
    });

    await page.evaluate(async () => {
      const w = window.__route918, payload = structuredClone(w.fixture.after);
      payload.trails.e_vacuum_route918.current.quality = { source: 'native', reason: 'ok', raw_points: 3 };
      await w.state('camera.route918', { attributes: { map_name: 'Map 1' } });
      await w.publish(payload);
    });
    const nativeMapOnly = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:provenNativePathNeedsNoLivePosition`] = nativeMapOnly.visible
      && !nativeMapOnly.hasPuck && !nativeMapOnly.hasTip && nativeMapOnly.diagnostic.rendered === 3;
    if (!checks[`${screen}:provenNativePathNeedsNoLivePosition`]) console.error('map-only native frame', screen, nativeMapOnly);
    await page.evaluate(async () => {
      const w = window.__route918;
      await w.state('camera.route918', w.fixture.states['camera.route918']);
      await w.publish(w.fixture.after);
    });

    // Build an actual local history under a legacy backend, then advertise
    // format 2 with an untrusted run. Both raw HA path and local buffer exist;
    // neither is allowed to substitute for rejected server ownership.
    await page.evaluate(() => window.__route918.publish({ trail_format: 1, trails: {} }));
    for (const [x, y] of [[100, 100], [200, 100], [300, 200], [320, 420]]) {
      await page.evaluate(([x, y]) => window.__route918.state('camera.route918', {
        attributes: { map_name: 'Map 1', robot_position: { x, y } },
      }), [x, y]);
      await page.waitForTimeout(300);
    }
    checks[`${screen}:legacyLocalBufferActuallyExists`] = await page.evaluate(() => {
      const runtime = window.__card._vacRt.get('e_vacuum_route918');
      return (runtime?.material?.flat().length || runtime?.trail?.length || 0) >= 3;
    });
    await page.evaluate(async () => {
      const w = window.__route918;
      await w.state('camera.route918', { attributes: {
        ...w.fixture.states['camera.route918'].attributes, path: [[900, 900], [950, 950]],
      } });
      await w.publish(w.fixture.before);
    });
    const orphan = await page.evaluate(() => window.__route918.geometry());
    checks[`${screen}:format2CannotBypassRejectedRun`] = !orphan.visible && !orphan.hasTip
      && orphan.diagnostic.raw === 12 && orphan.diagnostic.stored === 12
      && orphan.diagnostic.rendered === 0 && orphan.diagnostic.display === 'vac.trail_display_run';

    // Open the real existing dialog only after all no-editor recovery cases.
    // Both locales must show the same counters and a human-readable refusal.
    for (const language of ['en', 'ru']) {
      await page.evaluate(async language => {
        const c = window.__card;
        c.setConfig({ type: 'custom:houseplan-card', language });
        await window.__hpTest.setMode('devices');
        await window.__hpTest.openMarkerDialog('e_vacuum_route918');
      }, language);
      const text = await page.evaluate(() => window.__card.renderRoot.textContent);
      checks[`${screen}:${language}:diagnosticExplainsStoredButHidden`] = text.includes('12 / 12 / 0')
        && text.includes(language === 'en' ? 'Stored points are not linked to the current map'
          : 'Сохранённые точки не привязаны к текущей карте')
        && !text.includes('vac.trail_display_run');
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.__hpTest.setMode('view'));
    }
  } finally {
    await browser.close();
  }
}
checkAll(checks);
await finish();
