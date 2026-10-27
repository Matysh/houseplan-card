// #1070: native controls/gestures plus exact painted-frame and persistence oracles.
import { launch, launchColdView, launchPanelCold, check, finish, requirePinnedBrowser } from './serve.mjs';
import { installHpTestOnPage } from './helpers/hp-test.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
requirePinnedBrowser();
const { page, browser } = await launch({ width: 1100, height: 1000 });
const evidence = process.env.HP_ROTATION_EVIDENCE || 'artifacts/plan-rotation-1070';
mkdirSync(evidence, { recursive: true });
const card = page.locator('houseplan-card').first();
const stage = card.locator('.stage');
const wait = async () => {
  await page.waitForFunction(() => { const c = window.__card; return !c._booting && !c._bootSoft
    && !c._cameraTransition.active && !c._modeTransitionBusy && !c._refitRaf && !c._pendingRefitSize; });
  await page.evaluate(() => window.__hpTest.settled());
};
const snapshot = () => page.evaluate(() => window.__hpTest.viewFrameSnapshot());
const rotate = async (direction = 'right') => { await card.locator(`[data-hp="rotate-${direction}"]`).click(); await wait(); };
const frame = async name => { await page.mouse.move(2, 2); await wait();
  const image = await stage.screenshot(); writeFileSync(`${evidence}/${name}.png`, image); return image; };
const point = async (x, y) => stage.locator('.decorlayer').evaluate((ink, p) => {
  const out = new DOMPoint(p[0], p[1]).matrixTransform(ink.getScreenCTM()); return { x: out.x, y: out.y };
}, [x, y]);
const centre = locator => locator.boundingBox().then(box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 }));

try {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async () => {
    await window.__hpTest.setServerConfig({ spaces: [
      { id: 'f1', title: 'Quarter turn', cell_cm: 5, view_box: [0, 0, 1, 1],
        settings: { show_names: true, show_borders: true, fill_mode: 'none', north_deg: 0, sun_rays: true },
        rooms: [{ id: 'west', name: 'West room', poly: [[.1,.2],[.5,.2],[.5,.55],[.1,.55]] },
          { id: 'east', name: 'East room', poly: [[.5,.2],[.9,.2],[.9,.4],[.5,.4]] }],
        partitions: [{ id: 'volume', a: [.15,.3], b: [.45,.3], cm: 15 }],
        openings: [{ id: 'sun-window', type: 'window', x: .3, y: .55, angle: 0, length: .12 },
          { id: 'lock-door', type: 'door', x: .7, y: .2, angle: 0, length: .1, lock: 'lock.front_door' }],
        decor: [{ id: 'caption', kind: 'text', x: .3, y: .45, text: 'Plan text', size: .025, color: '#123456' },
          { id: 'rect', kind: 'rect', x: .65, y: .25, w: .1, h: .1, color: '#0080ff', fill: true }] },
      { id: 'f2', title: 'Other', cell_cm: 5, rooms: [], decor: [] }],
      markers: [{ id: 'plain', binding: 'entity:sensor.living_temp', space: 'f1', name: 'Plain', icon: 'mdi:home',
        value_badge: { enabled: true, source: { kind: 'entity_state', entity_id: 'sensor.living_temp' }, position: 'right' } },
        { id: 'angled', binding: 'virtual', space: 'f1', name: 'Angled', icon: 'mdi:arrow-up', angle: 30 }],
      settings: { filter_seeded: true, volumetric_view: false } });
    await window.__hpTest.setLayout({ plain: { s: 'f1', x: .25, y: .3 }, angled: { s: 'f1', x: .7, y: .3 } });
    await window.__hpTest.switchSpace('f1');
    const c = window.__card, callWS = c.hass.callWS;
    window.__rotationWrites = [];
    c.hass = { ...c.hass, states: { ...c.hass.states,
      'sun.sun': { entity_id: 'sun.sun', state: 'above_horizon', attributes: { azimuth: 180, elevation: 24 } } }, callWS: async message => {
      if (/houseplan\/.*(?:set|patch|save|copy|delete|move)/.test(message.type)) window.__rotationWrites.push(structuredClone(message));
      return callWS(message);
    } };
  });
  await wait();
  await card.locator('[data-hp="zoom-fit"]').click(); await wait();
  await page.evaluate(async () => { await window.__hpTest.waitForWrites(); window.__rotationWrites.length = 0; });
  const baseline = await frame('flat-0'), initial = await snapshot();
  const plain0 = await centre(card.locator('[data-hp="device"][data-id="plain"]'));
  const angled = card.locator('[data-hp="device"][data-id="angled"] .device-core > ha-icon');
  check('default and custom-angle fixtures are visibly rendered', !!plain0 && await angled.count() === 1);
  await rotate();
  check('clockwise native control selects 90 degrees', (await snapshot()).rotation === 90);
  const plain90 = await centre(card.locator('[data-hp="device"][data-id="plain"]'));
  const expected = await point(250, 300);
  check('HTML device anchor agrees with the rotated SVG world point', Math.hypot(plain90.x - expected.x, plain90.y - expected.y) < 1);
  check('custom icon angle is plan-relative', await angled.evaluate(el => el.style.transform === 'rotate(120deg)'));
  const badge = await centre(card.locator('[data-id="plain"] .value-badge.pos-right'));
  check('configured right badge remains on the right side of the screen', badge.x > plain90.x && Math.abs(badge.y - plain90.y) < 2);
  check('default device icon and room caption remain screen-facing', await card.locator('[data-hp="device"][data-id="plain"] .device-core > ha-icon').evaluate(el => !el.style.transform)
    && await card.locator('.roomlabel').first().evaluate(el => getComputedStyle(el).transform.startsWith('matrix(1, 0, 0, 1,')));
  await frame('flat-90');
  await card.screenshot({path:`${evidence}/header-controls-90.png`});
  await rotate('left');
  check('+90 then -90 preserves every canonical camera number', JSON.stringify((await snapshot()).camera) === JSON.stringify(initial.camera));
  check('+90 then -90 returns byte-identical painted stage', (await frame('flat-back')).equals(baseline));
  for (let n = 0; n < 4; n++) await rotate();
  check('four clockwise turns preserve camera and pixels', JSON.stringify((await snapshot()).camera) === JSON.stringify(initial.camera)
    && (await frame('flat-four')).equals(baseline));
  check('sunlight uses nonempty identical canonical polygons at every angle', initial.sunPolygons.length > 0
    && JSON.stringify((await snapshot()).sunPolygons) === JSON.stringify(initial.sunPolygons));
  const noWrites = await page.evaluate(() => window.__rotationWrites);
  writeFileSync(`${evidence}/rotation-io.json`, JSON.stringify({ initial, after: await snapshot(), writes: noWrites }, null, 2));
  check('rotation causes no config/layout WS writes or revision changes', noWrites.length === 0
    && (await snapshot()).configRevision === initial.configRevision && (await snapshot()).layoutRevision === initial.layoutRevision);
  await rotate();
  await page.evaluate(() => window.__hpTest.setMode('decor')); await wait();
  check('editor shares the chosen rotation and controls', (await snapshot()).rotation === 90 && await card.locator('[data-hp="rotate-right"]').isVisible());
  await page.evaluate(() => window.__hpTest.setMode('view')); await wait();
  const beforePan = await centre(card.locator('[data-hp="device"][data-id="plain"]'));
  const box = await stage.boundingBox();
  await page.mouse.move(box.x + box.width * .7, box.y + box.height * .8);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .7 + 70, box.y + box.height * .8 + 30, { steps: 8 }); await page.mouse.up(); await wait();
  const afterPan = await centre(card.locator('[data-hp="device"][data-id="plain"]'));
  check('native pan follows screen directions after a quarter turn', Math.abs(afterPan.x - beforePan.x - 70) < 2 && Math.abs(afterPan.y - beforePan.y - 30) < 2);
  const zoomAnchor = await point(350, 350);
  await page.mouse.move(zoomAnchor.x, zoomAnchor.y); await page.mouse.wheel(0, -120); await wait();
  const afterWheel = await point(350, 350);
  check('wheel keeps the same plan point under the screen pointer', Math.hypot(afterWheel.x - zoomAnchor.x, afterWheel.y - zoomAnchor.y) < 1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [phase, mode] of ['plan', 'view', 'decor', 'view'].entries()) {
    const start = await snapshot();
    await page.evaluate(() => {
      window.__rotationModeTrace = []; window.__rotationTraceActive = true;
      const sample = () => { if (!window.__rotationTraceActive) return;
        const state = window.__hpTest.viewFrameSnapshot(), ink = window.__card.renderRoot.querySelector('.decorlayer');
        const matrix = ink?.getScreenCTM();
        window.__rotationModeTrace.push({ ...state, matrix: matrix ? [matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f] : null });
        requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    await card.locator(mode === 'view' ? '.closex[data-hp="editor-close"]' : `.modetab[data-mode="${mode}"]`).click(); await wait();
    const trace = await page.evaluate(() => { window.__rotationTraceActive = false; return window.__rotationModeTrace; });
    const end = await snapshot();
    const centers = [start,end].map(state => [state.camera.view.x + state.camera.view.w/2, state.camera.view.y + state.camera.view.h/2]);
    const bounded = trace.filter(state => state.camera.view).every(state => {
      const v = state.camera.view, center = [v.x+v.w/2,v.y+v.h/2];
      return center.every((value,axis) => value >= Math.min(centers[0][axis],centers[1][axis])-.5
        && value <= Math.max(centers[0][axis],centers[1][axis])+.5);
    });
    check(`animated rotated ${mode} transition keeps canonical camera and fixed quarter-turn basis`, trace.length > 2 && bounded
      && trace.every(state => state.rotation === 90 && (!state.matrix || Math.abs(state.matrix[0]) < 1e-10 && state.matrix[1] > 0)));
    writeFileSync(`${evidence}/mode-${phase}-${mode}.json`, JSON.stringify({ start,end,trace },null,2));
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await card.locator('[data-hp="zoom-fit"]').click(); await wait();
  const fit = await stage.boundingBox(), a = await point(100, 200), b = await point(900, 550);
  check('fit contains the rotated plan in the actual stage', [a,b].every(p => p.x >= fit.x - 1 && p.y >= fit.y - 1 && p.x <= fit.x + fit.width + 1 && p.y <= fit.y + fit.height + 1));
  await page.evaluate(async () => { await window.__hpTest.setVolumetricView(true); }); await wait();
  const isoInitial = await snapshot();
  const sides = [];
  for (let n = 0; n < 4; n++) {
    const state = await snapshot();
    sides.push(await card.locator('.iso-walls-svg').evaluate(svg => svg.innerHTML));
    await frame(`iso-${state.rotation}`); await rotate();
  }
  check('2.5D renders four distinct projected sides', new Set(sides).size === 4);
  const isoAfter = await snapshot();
  check('rotation preserves physical floor/sun/body build counts', JSON.stringify(isoAfter.floorBuilds) === JSON.stringify(isoInitial.floorBuilds)
    && isoAfter.isoStructuralBuilds === isoInitial.isoStructuralBuilds);
  check('Flat/2.5D switches preserve chosen orientation', isoAfter.rotation === 90);
  await page.evaluate(() => window.__hpTest.setVolumetricView(false)); await wait();
  await page.evaluate(async () => { await window.__hpTest.switchSpace('f2'); }); await wait();
  check('another space has an independent default', (await snapshot()).rotation === 0);
  await page.evaluate(() => window.__hpTest.switchSpace('f1')); await wait();
  check('returning to a space restores its own choice', (await snapshot()).rotation === 90);
  await page.evaluate(async () => {
    const main = window.__card;
    const kiosk = document.createElement('houseplan-card'); kiosk.id = 'rotation-kiosk';
    kiosk.setConfig({ type: 'custom:houseplan-card', kiosk: true, floor: 'f1', rotation: 180 });
    document.getElementById('host').append(kiosk); kiosk.hass = main.hass;
    const staticCard = document.createElement('houseplan-space-card'); staticCard.id = 'rotation-static';
    staticCard.setConfig({ type: 'custom:houseplan-space-card', space: 'f1', rotation: 270 });
    document.getElementById('host').append(staticCard); staticCard.hass = main.hass;
  });
  await page.waitForFunction(() => document.getElementById('rotation-kiosk').renderRoot.querySelector('.stage')
    && document.getElementById('rotation-static').renderRoot.querySelector('.hp-static-stage'));
  check('kiosk ignores the device choice and has no rotation controls', await page.locator('#rotation-kiosk .stage').getAttribute('data-hp-plan-rotation') === '180'
    && await page.locator('#rotation-kiosk [data-hp="rotate-right"]').count() === 0);
  check('static card follows the effective per-space choice', await page.locator('#rotation-static .hp-static-stage').getAttribute('data-hp-plan-rotation') === '90');
  const configEditors = await page.evaluate(async () => {
    const output = [];
    for (const [tag,type] of [['houseplan-card','full'],['houseplan-space-card','static']]) {
      const editor = await customElements.get(tag).getConfigElement();
      editor.id = `rotation-${type}-editor`; editor.hass = window.__card.hass;
      editor.setConfig({type:`custom:${tag}`,space:'f1',rotation:45}); document.getElementById('host').append(editor);
      await editor.updateComplete;
      const schema = [...editor.renderRoot.querySelectorAll('ha-form')].flatMap(form => form.schema || []);
      const rotation = schema.find(row => row.name === 'rotation');
      const invalid = !!editor.renderRoot.querySelector('[role="alert"]');
      let saved;
      editor.addEventListener('config-changed', event => { saved = event.detail.config; editor.setConfig(saved); });
      // HA's ha-form is the integration boundary in this synthetic page. Its
      // value-changed event carries a select string; the editor must emit a numeric YAML value.
      editor.renderRoot.querySelector('ha-form').dispatchEvent(new CustomEvent('value-changed', {detail:{value:{rotation:'270'}}}));
      await editor.updateComplete;
      output.push({invalid,options:rotation?.selector.select.options.map(option => option.value),saved:saved?.rotation,
        cleared:!editor.renderRoot.querySelector('.card-config-error')});
    }
    return output;
  });
  check('both Lovelace editors expose four choices, show invalid YAML, and emit numeric rotation', configEditors.every(editor => editor.invalid
    && JSON.stringify(editor.options) === JSON.stringify(['0','90','180','270']) && editor.saved === 270 && editor.cleared));
  await page.evaluate(async () => {
    const c = document.getElementById('rotation-kiosk'); c.setConfig({type:'custom:houseplan-card',floor:'f1',kiosk:true,rotation:45}); await c.updateComplete;
  });
  check('invalid kiosk rotation renders safely at zero', await page.locator('#rotation-kiosk .stage').getAttribute('data-hp-plan-rotation') === '0');
  await page.reload();
  await page.waitForFunction(() => window.__card?._booting === false);
  await installHpTestOnPage(page); await wait();
  check('a real page reload restores the browser choice', (await snapshot()).rotation === 90);
  const fresh = await launchColdView({ width: 900, height: 800 });
  try { check('a separate browser starts with its own orientation', await fresh.page.locator('houseplan-card .stage').getAttribute('data-hp-plan-rotation') === '0'); }
  finally { await fresh.browser.close(); }
  const denied = await launchPanelCold({ width: 900, height: 800 });
  try {
    await denied.page.evaluate(async () => {
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
      Storage.prototype.getItem = function(key) { if (key === 'houseplan_card_rotation_v1') throw new Error('denied'); return get.call(this, key); };
      Storage.prototype.setItem = function(key, value) { if (key === 'houseplan_card_rotation_v1') throw new Error('denied'); return set.call(this, key, value); };
      await import('/assets/houseplan-card.js');
      const c = document.createElement('houseplan-card'); c.setConfig({ type: 'custom:houseplan-card' });
      document.getElementById('host').append(c); window.__card = c; c.hass = window.__mkHass();
    });
    await denied.page.waitForFunction(() => window.__card?._booting === false);
    await denied.page.locator('houseplan-card [data-hp="rotate-right"]').click();
    await denied.page.waitForFunction(() => window.__card.renderRoot.querySelector('.stage').dataset.hpPlanRotation === '90');
    check('cold denied browser storage still permits rotation in memory', true);
  } finally { await denied.browser.close(); }
} finally { await browser.close(); finish(); }
