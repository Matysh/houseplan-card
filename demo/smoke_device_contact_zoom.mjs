// #951: real painted path registration and free-shell thickness during native zoom.
import { launch, requirePinnedBrowser, check, checkAll, finish } from './serve.mjs';
import { makeDeviceContactsFixture } from './golden/device-contacts.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

requirePinnedBrowser('#951 contact zoom');
const dir = process.env.HP_CONTACT_ZOOM_ARTIFACTS || 'artifacts/951/zoom';
mkdirSync(dir, { recursive: true });
const results = [];
for (const dpr of [1, 2]) {
  const { page, browser } = await launch({ width: 1200, height: 1000 }, dpr, [], { hasTouch: true });
  const card = page.locator('houseplan-card'), input = await page.context().newCDPSession(page);
  const fixture = makeDeviceContactsFixture();
  await page.evaluate(async fixture => {
    const c = window.__card, space = c._space;
    const hidden = c._devices.map(d => ({ ...d.marker, id: d.id, hidden: true,
      binding: d.marker?.binding || (d.bindingKind === 'virtual' ? 'virtual' : `${d.bindingKind}:${d.bindingRef}`) }));
    c.setConfig({ ...c._config, icon_size: 5 });
    c.hass = { ...c.hass, states: { ...c.hass.states, ...fixture.states } };
    await window.__hpTest.setServerConfig(cfg => {
      cfg.settings = { ...cfg.settings, ...fixture.config.settings, volumetric_view: false };
      cfg.spaces = [{ ...fixture.config.spaces[0], id: space }];
      cfg.spaces[0].partitions.push({ id: 'zoom-diagonal', a: [.85, .74], b: [.96, .85], cm: 36 });
      cfg.markers = [...hidden, ...fixture.config.markers.map(m => ({ ...m, space })), {
        id: 'zoom-diagonal', binding: 'virtual', space, display: 'static_icon', icon: 'mdi:power-plug',
      }];
      return cfg;
    });
    // A circle's outer support is independent of the wall angle. These are
    // fixture positions, not a second snap implementation or a solver patch.
    const offset = (15 + 45 * .64375) / Math.sqrt(2) / 1000;
    await window.__hpTest.setLayout(layout => ({ ...layout,
      ...Object.fromEntries(Object.entries(fixture.layout).map(([id, p]) => [id, { ...p, s: space }])),
      'zoom-diagonal': { s: space, x: .905 - offset, y: .795 + offset },
    }));
  }, fixture);
  await page.waitForFunction(() => window.__card._deviceContacts?.scene?.shapes.size === 33);
  await page.evaluate(() => {
    const c = window.__card, ws = c.hass.callWS;
    window.__contactZoomWrites = [];
    c.hass = { ...c.hass, callWS: async message => {
      if (['houseplan/layout/update','houseplan/config/set'].includes(message.type)) window.__contactZoomWrites.push(message.type);
      return ws(message);
    } };
  });
  const settle = async () => {
    await page.waitForFunction(() => !window.__card._modeTransitionBusy && !window.__card._modeTransitionPreparing
      && !window.__card._cameraTransition.active);
    await page.evaluate(async () => { await window.__card.updateComplete;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
  };
  const snapshot = (staticCard = false) => page.evaluate(staticCard => {
    const c = staticCard ? window.__contactZoomStatic : window.__card, scene = c._deviceContacts.scene;
    const contours = [...c.renderRoot.querySelectorAll('.device-contact-contour')].map(path => {
      const el = path.closest('.dev'), shape = scene.shapes.get(el.dataset.id), m = shape.marker;
      const core = el.getBoundingClientRect(), matrix = path.getScreenCTM(), length = path.getTotalLength();
      const errors = [0, .31, .71].map(t => {
        const q = path.getPointAtLength(length * t), p = new DOMPoint(q.x, q.y).matrixTransform(matrix);
        return Math.hypot(p.x - (core.x + core.width / 2 + (q.x - m.x) * core.width / m.diameter),
          p.y - (core.y + core.height / 2 + (q.y - m.y) * core.height / m.diameter));
      });
      return { id: m.id, error: Math.max(...errors), stroke: parseFloat(getComputedStyle(path).strokeWidth),
        freeBorder: parseFloat(getComputedStyle(el.querySelector('.device-shell-frame')).borderTopWidth),
        diameter: core.width };
    });
    return { zoom: c._zoom, contours, layout: structuredClone(c._layout), config: structuredClone(c._serverCfg),
      writes: window.__contactZoomWrites.length,
      shapes: JSON.stringify([...scene.shapes]), edges: JSON.stringify([...scene.edges].map(([id, set]) => [id, [...set]])),
      work: { ...c._deviceContacts.work }, diagonal: Object.keys(scene.shapes.get('zoom-diagonal').walls).length > 0 };
  }, staticCard);
  await settle();
  check(`DPR${dpr}:real-wall-and-group-fixture`, await page.evaluate(() => {
    const s = window.__card._deviceContacts.scene;
    return s.component('row-designer-0').length === 4 && s.component('wall-row-designer-0').length === 3
      && Object.keys(s.shapes.get('wall-left-designer-0').walls).length > 0;
  }), true);
  const initial = await snapshot();
  check(`DPR${dpr}:inclined-contact-present`, initial.diagonal, true);
  const sample = async label => {
    const s = await snapshot();
    check(`${label}:painted-path-registration`, s.contours.length >= 10 && s.contours.every(p => p.error < .1), true);
    check(`${label}:same-effective-border`, s.contours.every(p => Math.abs(p.stroke - p.freeBorder) < .01), true);
    checkAll({ [`${label}:layout-unchanged`]: isDeepStrictEqual(s.layout, initial.layout),
      [`${label}:config-unchanged`]: isDeepStrictEqual(s.config, initial.config),
      [`${label}:no-layout-or-config-write`]: s.writes === initial.writes,
      [`${label}:contact-geometry-unchanged`]: s.shapes === initial.shapes && s.edges === initial.edges,
      [`${label}:no-new-measurement-or-rebuild`]: s.work.measurements === initial.work.measurements
        && s.work.rebuilds === initial.work.rebuilds });
    results.push({ label, zoom: s.zoom, maxOffset: Math.max(...s.contours.map(p => p.error)),
      worst: s.contours.reduce((a,b)=>a.error>b.error?a:b),
      maxStrokeDifference: Math.max(...s.contours.map(p => Math.abs(p.stroke - p.freeBorder))) });
  };
  for (const mode of ['view', 'devices']) {
    if (mode === 'devices') { await card.locator('[data-hp="mode-tab"][data-mode="devices"]').click(); await settle(); }
    for (const dark of [false, true]) {
      await page.evaluate(dark => { const c = window.__card; c.hass = { ...c.hass, themes: { darkMode: dark } }; }, dark);
      await settle();
      // Theme changes can refresh face metrics once; zoom itself must not.
      Object.assign(initial, await snapshot());
      for (const zoom of [1/3, .5, .73, 1, 2, 4, 1]) {
        const p = await page.evaluate(zoom => {
          const c = window.__card, root = c.renderRoot, r = root.querySelector('.stage').getBoundingClientRect();
          // Pinch starts on empty plan, including in the best-effort editor:
          // this test is about the camera, not dragging an arbitrary fixture.
          for (const fy of [.15,.85,.3,.7,.5]) for (const fx of [.8,.2,.5]) {
            const x = r.x+r.width*fx, y = r.y+r.height*fy;
            if ([-50,50].every(dx => !root.elementFromPoint(x+dx,y)?.closest('.dev'))) return { x,y,ratio:zoom/c._zoom };
          }
          throw Error('no empty pinch start');
        }, zoom);
        const points = distance => [{ id: 1, x: p.x-distance/2, y: p.y }, { id: 2, x: p.x+distance/2, y: p.y }];
        await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(100) });
        for (let i = 1; i <= 6; i++) {
          await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(100*(1+(p.ratio-1)*i/6)) });
          await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
          await sample(`DPR${dpr}/${mode}/${dark?'dark':'light'}/${zoom}/frame${i}`);
        }
        await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await settle();
        await sample(`DPR${dpr}/${mode}/${dark?'dark':'light'}/${zoom}/settled`);
        if (mode === 'view' && (zoom === 1/3 || zoom === 1)) await page.screenshot({
          path: `${dir}/DPR${dpr}-${dark?'dark':'light'}-${zoom===1/3?'small':'fit'}.png` });
      }
    }
  }
  // Existing animated button zoom must align on intermediate presented frames.
  await card.locator('[data-hp="zoom-in"]').click();
  for (let i = 0; i < 5; i++) { await page.evaluate(() => new Promise(r => requestAnimationFrame(r))); await sample(`DPR${dpr}/button/frame${i}`); }
  await settle(); await card.locator('[data-hp="zoom-fit"]').click(); await settle(); await sample(`DPR${dpr}/fit`);
  await card.locator('[data-hp="editor-close"]').first().click(); await settle();
  Object.assign(initial, await snapshot());
  const empty = await page.evaluate(() => {
    const root = window.__card.renderRoot, r = root.querySelector('.stage').getBoundingClientRect();
    return { x:r.right-80, y:r.top+60 };
  });
  await page.mouse.move(empty.x,empty.y); await page.mouse.down();
  await page.mouse.move(empty.x-40,empty.y+25,{steps:5}); await page.mouse.up(); await settle(); await sample(`DPR${dpr}/pan`);
  await page.mouse.wheel(0,-170);
  for (let i=0;i<5;i++) { await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r))); await sample(`DPR${dpr}/wheel/frame${i}`); }
  await settle(); await sample(`DPR${dpr}/wheel/settled`);
  await page.evaluate(() => {
    const c=window.__card,card=document.createElement('houseplan-space-card');
    card.setConfig({type:'custom:houseplan-space-card',space:c._space,show_button:false,icon_size:c._config.icon_size});
    card.style.width='720px';card.style.display='block';card.hass=c.hass;
    document.getElementById('host').append(card);window.__contactZoomStatic=card;
  });
  await page.waitForFunction(()=>window.__contactZoomStatic?._deviceContacts?.scene?.shapes.size===33);
  for (const width of [720,360]) {
    await page.evaluate(width=>{window.__contactZoomStatic.style.width=`${width}px`;},width);
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const s=await snapshot(true);
    check(`DPR${dpr}/static${width}:registration`,s.contours.length>=10&&s.contours.every(p=>p.error<.1),true);
    check(`DPR${dpr}/static${width}:thickness`,s.contours.every(p=>Math.abs(p.stroke-p.freeBorder)<.01),true);
  }
  await finish(browser);
}
writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 2));
