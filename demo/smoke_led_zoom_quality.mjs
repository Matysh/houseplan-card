/** #789: real input → temporary LED-only24 → exact full48. Not a benchmark. */
import { launch, check, finish } from './serve.mjs';
import { installLedZoomOracle } from './helpers/led-zoom-oracle.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1, [], { hasTouch: true });
await page.evaluate(installLedZoomOracle);
const cdp = await page.context().newCDPSession(page);
const results = [];
const quality = () => page.evaluate(() => window.__ledZoomOracle.quality(window.__card));
const idle = async () => {
  await page.waitForFunction(() => !window.__card.hasAttribute('data-led-zoom-quality')
    && !window.__card._cameraTransition.active, undefined, { timeout: 1500 });
  await page.evaluate(() => window.__hpTest.settled());
};
const point = () => page.evaluate(() => {
  const r = window.__card.shadowRoot.querySelector('.stage').getBoundingClientRect();
  return { x: r.left + r.width * .55, y: r.top + r.height * .65 };
});
const wheel = async (dy = -80) => {
  const p = await point(); await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, dy);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
};
const active = async label => {
  const q = await quality(); results.push({ label, ...q });
  check(`${label}: real scale change activates coarse`, q.coarse);
  check(`${label}: retained48 paints even24 with exact midpoint falloff, never hidden`,
    q.fields.length > 0 && q.fields.every(f => f.retained === 48 && f.painted === 24 && f.correct24 && f.visible));
  check(`${label}: ordinary light is not hidden by LED quality`, q.ordinary.length > 0 && q.ordinary.every(f => f.visible));
  return q.coarse;
};
const restored = async label => {
  await idle();
  const q = await quality();
  check(`${label}: owner removes coarse and paints original48`, !q.coarse
    && q.fields.length > 0 && q.fields.every(f => f.retained === 48 && f.painted === 48 && f.visible));
  const rows = await page.evaluate(() => window.__ledZoomOracle.full48(window.__card, { scales: [1, 2] }));
  for (const row of rows) check(`${label}: all restored pixels equal frozen48 at scale ${row.scale}`, row.differentPixels, 0);
};
const setState = (state, attributes = {}) => page.evaluate(async ({ state, attributes }) => {
  const card = window.__card, previous = card.hass.states['light.ceiling'];
  card.hass = { ...card.hass, states: { ...card.hass.states,
    'light.ceiling': { ...previous, state, attributes: { ...previous.attributes, ...attributes } } } };
  await card.updateComplete;
}, { state, attributes });
const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type,
  touchPoints: points.map(([x, y], i) => ({ x, y, id: i + 1, radiusX: 2, radiusY: 2, force: 1 })) });
const twoFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

try {
  await setState('on', { rgb_color: [117, 197, 42], brightness: 190 });
  await page.evaluate(async () => {
    const card = window.__card, lamp = card.hass.states['light.floor_lamp'];
    card.hass = { ...card.hass, states: { ...card.hass.states,
      'light.floor_lamp': { ...lamp, state: 'on', attributes: { ...lamp.attributes, brightness: 200 } } } };
    await card.updateComplete;
    await window.__hpTest.setServerConfig(cfg => {
      const space = cfg.spaces.find(s => s.id === 'f1');
      space.settings = { ...space.settings, glow_enabled: true };
      space.led_strips = [
        { id: 'quality', marker: 'd_light1', points: [[.15, .3], [.4, .3], [.4, .46]] },
        { id: 'overlap', marker: 'quality-virtual', points: [[.2, .35], [.45, .35]] },
      ];
      cfg.markers = [...(cfg.markers || []).filter(m => !['quality-virtual', 'd_light1', 'd_lamp'].includes(m.id)),
        { id: 'd_light1', binding: 'device:d_light1', space: 'f1' },
        { id: 'd_lamp', binding: 'device:d_lamp', space: 'f1' },
        { id: 'quality-virtual', binding: 'virtual', is_light: true, space: 'f1',
          glow_radius_cm: 120, glow_color: { c: '#b552dd', bri: .43 } }];
      return cfg;
    });
  });
  await page.waitForFunction(() => window.__card.shadowRoot.querySelectorAll('[data-led-field]').length === 2);
  await page.waitForTimeout(600);
  check('fixture includes ordinary Glow outside LED quality scope', await page.evaluate(() =>
    window.__card.shadowRoot.querySelectorAll('[data-glow-source]').length > 0));
  const visibilityGuard = await page.evaluate(() => {
    const card = window.__card, parent = card.shadowRoot.querySelector('.led-fields');
    const original = parent.getAttribute('style'), result = {};
    const restore = () => original === null ? parent.removeAttribute('style') : parent.setAttribute('style', original);
    try {
      for (const [property, value] of [['opacity', '0'], ['display', 'none']]) {
        restore(); parent.style.setProperty(property, value);
        const q = window.__ledZoomOracle.quality(card);
        result[property] = q.fields.length === 2 && q.fields.every(f => !f.visible)
          && q.ordinary.length > 0 && q.ordinary.every(f => f.visible);
      }
    } finally { restore(); }
    result.restored = parent.getAttribute('style') === original
      && window.__ledZoomOracle.quality(card).fields.every(f => f.visible);
    return result;
  });
  for (const [kind, caught] of Object.entries(visibilityGuard))
    check(`visibility oracle negative control ${kind}: ancestor hiding cannot pass as visible light`, caught);
  for (const motion of ['no-preference', 'reduce']) {
    await page.emulateMedia({ reducedMotion: motion });
    await idle();
    await page.evaluate(() => { window.__qualityBefore = window.__ledZoomOracle.snapshot(window.__card); });
    await wheel();
    const works = await active(`${motion} trusted wheel`);
    if (process.argv.includes('--red-witness')) break;
    // Baseline fails the named active24 assertion, not setup/import/timeouts.
    if (!works) continue;
    const activeInvariant = await page.evaluate(() => window.__ledZoomOracle.unchanged(window.__card, window.__qualityBefore));
    check(`${motion}: active coarse preserves geometry, DOM and cache`, activeInvariant.stable && activeInvariant.cacheStable);
    await restored(`${motion} wheel idle`);
    const invariant = await page.evaluate(() => window.__ledZoomOracle.unchanged(window.__card, window.__qualityBefore));
    check(`${motion}: camera retains fields/masks/clips/tubes/ordinary DOM and geometry`, invariant.stable);
    check(`${motion}: camera never recomputes geometry or grows cache`, invariant.cacheStable);
    results.push({ motion, permittedTransparentHitWidthChanges: invariant.hitWidthChanges });
    await wheel();
    const still = await point(); await page.mouse.move(still.x, still.y); await page.mouse.down();
    check(`${motion}: stationary pointerdown cannot shorten an active quality lease`, (await quality()).coarse);
    await page.mouse.up();
    check(`${motion}: stationary pointerup cannot shorten an active quality lease`, (await quality()).coarse);
    await restored(`${motion} stationary pointer deadline`);

    // Two native contacts, not _zoomAt or direct calls of pointer handlers.
    const p = await point();
    await page.evaluate(() => {
      window.__qualityTouchEvents = [];
      const stage = window.__card.shadowRoot.querySelector('.stage');
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
        stage.addEventListener(type, e => window.__qualityTouchEvents.push({ type, trusted: e.isTrusted,
          id: e.pointerId, x: e.clientX, scale: window.__card._zoom }));
      }
    });
    await touch('touchStart', [[p.x - 50, p.y], [p.x + 50, p.y]]);
    await touch('touchMove', [[p.x - 75, p.y], [p.x + 75, p.y]]);
    await twoFrames();
    await active(`${motion} trusted pinch`);
    await page.waitForTimeout(230); // deadline is scale silence, not pointerup.
    check(`${motion}: held pinch restores48 after scale silence`, !(await quality()).coarse);
    await touch('touchMove', [[p.x - 90, p.y], [p.x + 90, p.y]]);
    await twoFrames();
    await active(`${motion} held pinch restart`);
    results.push({ motion, touchEvents: await page.evaluate(() => window.__qualityTouchEvents) });
    await touch('touchCancel', []);
    await restored(`${motion} cancelled pinch`);

    await touch('touchStart', [[p.x - 50, p.y], [p.x + 50, p.y]]);
    await touch('touchMove', [[p.x - 65, p.y], [p.x + 65, p.y]]); await twoFrames();
    await active(`${motion} pinch before lost capture`);
    check(`${motion}: trusted contact capture is released`, await page.evaluate(() => {
      const stage = window.__card.shadowRoot.querySelector('.stage');
      const down = window.__qualityTouchEvents.filter(e => e.type === 'pointerdown').slice(-2);
      let released = 0;
      for (const e of down) {
        const target = [...window.__card.shadowRoot.querySelectorAll('*')].find(n => n.hasPointerCapture?.(e.id));
        if (target) { target.releasePointerCapture(e.id); released++; }
      }
      return released > 0;
    }));
    await twoFrames(); await page.waitForTimeout(230);
    check(`${motion}: lost capture cannot leave coarse stuck`, !(await quality()).coarse);
    await touch('touchCancel', []);

    // Pan moves the centre without changing scale. A stationary two-contact
    // gesture also cannot request coarse or keep a stale deadline alive.
    await touch('touchStart', [[p.x - 50, p.y], [p.x + 50, p.y]]);
    check(`${motion}: stationary pinch stays full48`, !(await quality()).coarse);
    await touch('touchEnd', []);
    const beforePan = await page.evaluate(() => ({ zoom: window.__card._zoom, ...window.__card._view }));
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 30, p.y + 18, { steps: 3 });
    check(`${motion}: pan stays full48`, !(await quality()).coarse);
    await page.mouse.up();
    const afterPan = await page.evaluate(() => ({ zoom: window.__card._zoom, ...window.__card._view }));
    check(`${motion}: pan witness actually moves only the centre`, beforePan.zoom === afterPan.zoom
      && (beforePan.x !== afterPan.x || beforePan.y !== afterPan.y));

    await page.locator('[data-hp="zoom-in"]').click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await active(`${motion} toolbar zoom`);
    await idle();
    await page.locator('[data-hp="zoom-fit"]').click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await active(`${motion} toolbar fit`);
    await restored(`${motion} fit idle`);
    const centre = await point();
    await page.mouse.move(centre.x, centre.y); await page.mouse.down();
    await page.mouse.move(centre.x + 45, centre.y + 20, { steps: 3 }); await page.mouse.up();
    await page.evaluate(() => {
      window.__centreBefore = { zoom: window.__card._zoom, ...window.__card._view };
      window.__centreCoarse = [];
      window.__centreObserver = new MutationObserver(rows => {
        for (const row of rows) if (row.attributeName === 'data-led-zoom-quality')
          window.__centreCoarse.push(row.oldValue, window.__card.getAttribute('data-led-zoom-quality'));
      });
      window.__centreObserver.observe(window.__card, { attributes: true, attributeOldValue: true });
    });
    await page.locator('[data-hp="zoom-fit"]').click(); await idle();
    const centred = await page.evaluate(() => {
      window.__centreObserver.disconnect();
      return { before: window.__centreBefore, after: { zoom: window.__card._zoom, ...window.__card._view },
        coarse: window.__centreCoarse };
    });
    check(`${motion}: centre-only fit actually changes centre`, centred.before.x !== centred.after.x || centred.before.y !== centred.after.y);
    check(`${motion}: centre-only fit preserves scale`, centred.before.zoom, centred.after.zoom);
    check(`${motion}: centre-only interpolated fit never requests coarse`, centred.coarse.includes('coarse'), false);
  }

  if (!process.argv.includes('--red-witness') && results.some(r => r.coarse)) {
    // At the scale clamp a wheel event is not an actual scale change.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    let reachedMax = false;
    for (let i = 0; i < 25; i++) {
      await wheel();
      if (await page.evaluate(() => window.__card._zoom >= 8)) { reachedMax = true; break; }
    }
    check('clamp witness reaches maximum by real wheel while coarse is active', reachedMax && (await quality()).coarse);
    await page.evaluate(() => { window.__clampStarted = performance.now(); });
    await page.waitForTimeout(45);
    await page.evaluate(() => { window.__colourCache = [...window.__card.shadowRoot.querySelectorAll('.led-fields')]
      .map(n => [n.dataset.ledCache, n.dataset.ledRecomputes]); });
    await wheel();
    check('clamped wheel during coarse does not cancel the current lease', (await quality()).coarse);
    await page.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 175 - (performance.now() - window.__clampStarted))));
    });
    check('clamped wheel does not extend the original lease', !(await quality()).coarse);
    await idle();
    const maxScale = await page.evaluate(() => window.__card._zoom);
    await wheel();
    check('clamped wheel leaves scale unchanged', await page.evaluate(() => window.__card._zoom), maxScale);
    check('clamped wheel neither enters coarse nor extends its deadline', !(await quality()).coarse);
    await page.locator('[data-hp="zoom-fit"]').click(); await idle();

    await wheel();
    await setState('on', { rgb_color: [225, 70, 35], brightness: 120 });
    const changed = await quality();
    check('new RGB arrives while coarse, not after restoration', changed.coarse
      && changed.fields.find(f => f.id === 'quality')?.fill.toLowerCase() === '#e14623');
    const rgbAlpha = Number(changed.fields.find(f => f.id === 'quality')?.alpha);
    await setState('on', { brightness: 40 });
    const dimmed = await quality(), alpha = dimmed.fields.find(f => f.id === 'quality')?.alpha;
    check('brightness-only update dims current coarse field immediately', dimmed.coarse
      && Number(alpha) > 0 && Number(alpha) < rgbAlpha);
    await restored('latest RGB/brightness');
    check('restore retains latest RGB and brightness', await page.evaluate(alpha => {
      const pool = window.__card.shadowRoot.querySelector('[data-led-field="quality"] .led-pool');
      return pool.getAttribute('fill').toLowerCase() === '#e14623' && pool.getAttribute('fill-opacity') === alpha;
    }, alpha));
    check('RGB/brightness updates never recompute geometry or grow caches', await page.evaluate(() =>
      JSON.stringify(window.__colourCache) === JSON.stringify([...window.__card.shadowRoot.querySelectorAll('.led-fields')]
        .map(n => [n.dataset.ledCache, n.dataset.ledRecomputes]))));
    for (const state of ['off', 'unavailable']) {
      await wheel(); await setState(state); await page.waitForTimeout(650);
      check(`${state} during coarse is never resurrected by restore`, await page.evaluate(() =>
        !window.__card.shadowRoot.querySelector('[data-led-field="quality"]')));
      await wheel(); await setState('on', { rgb_color: [117, 197, 42], brightness: 190 });
      const appeared = await quality(), newFields = appeared.fields.filter(f => f.id === 'quality');
      check(`new on field during coarse uses current quality (${state})`, appeared.coarse && newFields.length === 1
        && newFields.every(f => f.retained === 48 && f.painted === 24 && f.correct24));
      await page.waitForTimeout(650); await restored(`on after ${state}`);
    }

    await page.evaluate(() => {
      window.__resizeCoarse = false;
      window.__resizeObserver = new MutationObserver(rows => {
        window.__resizeCoarse ||= rows.some(row => row.oldValue === 'coarse')
          || window.__card.hasAttribute('data-led-zoom-quality');
      });
      window.__resizeObserver.observe(window.__card, { attributes: true, attributeOldValue: true,
        attributeFilter: ['data-led-zoom-quality'] });
    });
    await page.setViewportSize({ width: 1020, height: 820 }); await page.waitForTimeout(220);
    check('structural resize alone never activates coarse, including intermediate frames', await page.evaluate(() => {
      window.__resizeObserver.disconnect(); return !window.__resizeCoarse && !window.__card.hasAttribute('data-led-zoom-quality');
    }));
    await page.setViewportSize({ width: 1000, height: 820 }); await page.waitForTimeout(220);
    await page.evaluate(async () => {
      const stat = document.createElement('houseplan-space-card');
      stat.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', light_pools: true, live_states: true });
      stat.hass = window.__card.hass; stat.style.cssText = 'position:fixed;left:-1200px;width:700px';
      document.body.appendChild(stat); window.__qualityStatic = stat; await stat.updateComplete;
    });
    await page.waitForTimeout(600); await wheel();
    check('static owner never inherits main owner coarse', await page.evaluate(() => {
      const q = window.__ledZoomOracle.quality(window.__qualityStatic);
      return !q.coarse && q.fields.length === 2 && q.fields.every(f => f.retained === 48 && f.painted === 48);
    }));
    await idle();
    for (const mode of ['plan', 'view']) {
      await wheel(); await page.evaluate(mode => window.__hpTest.setMode(mode), mode);
      check(`mode ${mode} resets coarse`, !(await quality()).coarse);
    }
    await wheel(); await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); });
    check('projection adoption resets coarse', !(await quality()).coarse);
    await page.evaluate(() => window.__hpTest.setVolumetricView(false));
    await wheel(); await page.evaluate(() => window.__hpTest.switchSpace('garden'));
    check('space switch resets coarse', !(await quality()).coarse);
    await page.evaluate(() => window.__hpTest.switchSpace('f1')); await page.waitForTimeout(600);
    await wheel();
    check('document hidden listener resets coarse synchronously', await page.evaluate(() => {
      // Browser visibility seam: dispatch the real listener, never call the
      // card's private visibility handler. Restore the original descriptor.
      const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
      try {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
        return !window.__card.hasAttribute('data-led-zoom-quality');
      } finally {
        if (descriptor) Object.defineProperty(document, 'visibilityState', descriptor);
        else delete document.visibilityState;
        document.dispatchEvent(new Event('visibilitychange'));
      }
    }));
    await wheel();
    check('disconnect immediately removes coarse', await page.evaluate(() => {
      const c = window.__card; window.__qualityParent = c.parentNode; c.remove();
      return !c.hasAttribute('data-led-zoom-quality');
    }));
    await page.waitForTimeout(220);
    check('cancelled callback cannot reapply coarse to disconnected owner', !(await quality()).coarse);
    await page.evaluate(async () => { window.__qualityParent.appendChild(window.__card); await window.__card.updateComplete; });
    await page.waitForTimeout(650);
    await wheel(); await active('reconnected owner new wheel'); await restored('reconnected owner');
    await page.evaluate(() => window.__qualityStatic.remove());
  }
} finally {
  await cdp.detach();
  await finish(browser, results);
}
