// #828: real mouse + full Lit/hass ticks + independent pixel compositing oracle.
// Synthetic plans only. No private gesture/config mutation or golden acceptance.
import assert from 'node:assert/strict';
import { launch, finish } from './serve.mjs';
import { mkdirSync } from 'node:fs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { editGraphFixture } from './helpers/graph-fixture.mjs';

const wall = (id, a, b, cm = 25) => ({ id, a, b, cm });
const config = (partitions, rooms = [], openings = []) => commitWallSegmentModel({ spaces: [{
  id: 'reliability', title: 'Nodes', view_box: [0, 0, 1, 1], rooms, partitions, openings,
  zero_wall_style: 'dashed',
}], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
const door = { id: 'door', type: 'door', x: .5, y: .4, angle: 0, length: .06,
  host: { kind: 'partition', id: 'moving', t: .75 } };
let server, revision = 0, writes = 0;
const { page, browser } = await launch({ width: 1180, height: 920 });
mkdirSync('artifacts/828-node', { recursive: true });
try {
  await page.exposeFunction('reliabilityWire', message => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision,
      can_write: true, wall_node_move_api: 1, plan_graph_api: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/wall/node_move') { writes++; throw new Error('unexpected write'); }
    return null;
  });
  const mount = async (cfg, dark = false) => {
    server = structuredClone(cfg); revision++;
    await page.evaluate(({dark,id}) => {
      const hass = window.__mkHass(), old = hass.callWS.bind(hass);
      hass.devices = {}; hass.entities = {}; hass.states = {};
      hass.themes = { ...hass.themes, darkMode: dark };
      hass.callWS = async m => m.type.endsWith('registry/list') ? [] : (await window.reliabilityWire(m)) ?? old(m);
      const card = document.createElement('houseplan-card'); card.setConfig({ type: 'custom:houseplan-card', language: 'en', floor:id });
      window.__card.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
    }, {dark,id:cfg.spaces[0].id});
    await page.waitForFunction(id => window.__card?._booting === false && window.__card._space === id, cfg.spaces[0].id);
    await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
    await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
    await page.evaluate(() => window.__hpTest.settled());
  };
  const screen = p => page.evaluate(p => {
    const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
    q.x = p[0] * 1000; q.y = p[1] * 1000;
    const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
  }, p);
  const move = async p => { const s = await screen(p); await page.mouse.move(s.x, s.y);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  const down = async p => { await move(p); await page.mouse.down(); };
  const cancel = async () => {
    await page.keyboard.press('Escape'); await page.mouse.up();
    await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.dragging);
    assert.equal(await page.evaluate(() => window.__card.renderRoot.querySelectorAll('[data-hp-node-live], .hp-node-source').length), 0);
    assert.equal(await page.evaluate(() => [...window.__card.renderRoot.querySelectorAll('[style]')]
      .some(e => e.style.mask?.includes('hp-node-'))), false, 'all source/candidate masks retire');
  };
  const tick = () => page.evaluate(async () => {
    const card = window.__card;
    card.hass = { ...card.hass, states: { ...card.hass.states,
      'sensor.unrelated': { entity_id: 'sensor.unrelated', state: String(performance.now()), attributes: {} } } };
    card.requestUpdate(); await card.updateComplete;
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  const transient = () => page.evaluate(() => {
    const root = window.__card.renderRoot;
    return { invalid: window.__card._editorRuntime.nodeMove.invalid,
      settled: root.querySelector('.hp-node-layer:not([data-hp-node-live] .hp-node-layer)')?.querySelectorAll('text, :scope > path, .hp-node-guide').length,
      warnings: [...root.querySelectorAll('.hp-node-layer text')].map(t => [t.textContent, t.getAttribute('x'), t.getAttribute('y')]),
      guides: root.querySelectorAll('.hp-node-guide').length,
      sources: root.querySelectorAll('.hp-node-source').length };
  });
  const base = config([wall('moving', [.2, .4], [.6, .4])], [], [door]);
  for (const ticks of [false, true]) {
    await mount(base); await down([.2, .4]); await move([.6, .4]);
    assert.ok((await transient()).invalid); assert.equal((await transient()).warnings.length, 1);
    if (ticks) for (let i = 0; i < 3; i++) await tick();
    const a = await transient(); assert.equal(a.settled, 0); assert.equal(a.warnings.length, 1);
    await move([.55, .44]);
    const b = await transient(); assert.ok(b.invalid); assert.equal(b.settled, 0);
    assert.equal(b.warnings.length, 1); assert.notDeepEqual(b.warnings[0].slice(1), a.warnings[0].slice(1));
    if (ticks) await tick();
    await move([.25, .55]);
    const c = await transient(); assert.equal(c.invalid, null); assert.equal(c.warnings.length, 0);
    assert.equal(c.settled, 0); assert.equal(c.sources, 1);
    if (ticks) { await tick(); assert.equal((await transient()).warnings.length, 0); }
    assert.deepEqual(await page.evaluate(() => window.__card._serverCfg), base);
    await cancel();
  }
  console.log('invalid A / full hass+Lit ticks / invalid B / valid C: single owner; no stale warning or candidate');

  // X prompt and snap guides must obey the same ownership as error outlines.
  await mount(config([wall('h', [.1, .5], [.9, .5]), wall('v', [.4, .2], [.4, .8])]));
  await down([.4, .5]); await tick();
  assert.equal((await transient()).warnings.length, 1); assert.equal((await transient()).settled, 0);
  await move([.6, .5]); await tick();
  assert.equal((await transient()).warnings.length, 0); assert.equal((await transient()).guides, 1);
  await cancel();

  const samples = async (frame, points) => page.evaluate(async ({ frame, points }) => {
    const image = await createImageBitmap(new Blob([Uint8Array.from(atob(frame), c => c.charCodeAt(0))], { type: 'image/png' }));
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    return points.map(p => [...ctx.getImageData(Math.round(p.x) - 3, Math.round(p.y) - 3, 7, 7).data]);
  }, { frame: frame.toString('base64'), points });
  const delta = (a, b) => a.reduce((n, x, i) => n + Math.abs(x - b[i]), 0) / a.length;
  const opaque = (pixels, label) => assert.ok(pixels.every(sample => sample
    .every((value,index) => index % 4 !== 3 || value === 255)), `${label}: every raster probe is opaque`);
  const neighbourDOM = () => page.evaluate(() => {
    const root = window.__card.renderRoot;
    const ordinary = element => !element.closest('[data-hp-node-live], .hp-node-source');
    const far = [...root.querySelectorAll('[data-hp="partition"][data-id="far"]')].find(ordinary);
    const walls = [...root.querySelectorAll('.wallbodies .wallbody-fill, .wallbodies [data-hp="wall"]')].filter(ordinary);
    if (!far || !walls.length) throw Error('independent neighbour DOM positive is absent');
    if (!far.isPointInFill(new DOMPoint(700,400)))
      throw Error('neighbour probe is outside its real physical body/stroke');
    return [far, ...walls].map(element => {
      const style = getComputedStyle(element), matrix = element.getScreenCTM();
      return { d: element.getAttribute('d'), fill: style.fill, stroke: style.stroke, opacity: style.opacity,
        fillOpacity: style.fillOpacity, strokeOpacity: style.strokeOpacity, strokeWidth: style.strokeWidth,
        matrix: matrix && [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f] };
    });
  });
  for (const dark of [false, true]) for (const cm of [25, 0]) {
    const cfg = config([wall('moving', [.2, .4], [.6, .4], cm), wall('far', [.6, .4], [.9, .4], 15)], [], cm ? [door] : []);
    // Each raster variant owns its camera; the preceding zero-wall case must
    // not hand a differently zoomed saved viewport to the next paint sample.
    cfg.spaces[0].id = `compositing-${dark?'dark':'light'}-${cm}`;
    // Contrasting ordinary wall paint makes this a compositing oracle rather
    // than a test of Chromium's decorative hatch raster cache.
    cfg.spaces[0].settings = { wall_fill:{c:'#5e7488',a:1} };
    await mount(cfg, dark);
    // .75 was outside the old screenshot, producing transparent false equality.
    // .70 is still beyond the moving arm's junction patch, on the real neighbour.
    const locations = [[.32, .4], [.70, .4], [.5, .412]];
    const insideScreenshot = points => {
      const size = page.viewportSize();
      return points.every(p => p.x - 3 >= 0 && p.y - 3 >= 0
        && p.x + 3 < size.width && p.y + 3 < size.height);
    };
    const gestureLocations = [...locations, [.2,.4], [.25,.55], [.6,.4]];
    const insideStage = async points => {
      const box = await page.locator('.stage').boundingBox();
      return insideScreenshot(points) && points.every(p => p.x - 3 >= box.x && p.y - 3 >= box.y
        && p.x + 3 < box.x + box.width && p.y + 3 < box.y + box.height);
    };
    // Cached cameras can clip the neighbour (or the source of a zero wall).
    // Ordinary wheel input prepares a visible fixture, never private camera state.
    for (let guard = 0; guard < 12 && !await insideStage(await Promise.all(gestureLocations.map(screen))); guard++) {
      const box = await page.locator('.stage').boundingBox();
      await page.mouse.move(box.x+box.width*.8,box.y+box.height*.75);
      await page.mouse.wheel(0,120);
      await page.evaluate(() => window.__hpTest.settled());
      await page.waitForFunction(() => !window.__card._cameraTransition.active);
    }
    assert.ok(await insideStage(await Promise.all(gestureLocations.map(screen))),
      'all native drag endpoints and raster probes are visible within the stage');
    assert.ok(await page.locator('.plan-snap-overlay .plan-snap-line').count() > 0,
      'native visual guides exist before masonry-only fixture isolation');
    assert.ok(await page.evaluate(() => {
      const root=window.__card.renderRoot,path=root.querySelector('.wallbody');
      return !!root.querySelector('pattern#hp-wall-hatch') && !!path
        && getComputedStyle(path).fill.includes('hp-wall-hatch')
        && getComputedStyle(root.querySelector('.wallbody-fill')).fill==='rgb(94, 116, 136)';
    }), 'native hatch and configured contrasting wall paint exist before isolation');
    const nativeNeighbour = await neighbourDOM();
    assert.ok(nativeNeighbour.every(path => path.d?.startsWith('M')
      && path.matrix?.length === 6 && path.matrix.every(Number.isFinite)),
    'native neighbour geometry, material paint and finite screen transforms exist before isolation');
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = '.plan-snap-overlay,.hp-node-layer text,.hp-node-guide{visibility:hidden}'
        + '.wallbodies .wallbody,.wallbodies>path[fill*="hp-wall-hatch"]{fill:none!important}';
      window.__card.renderRoot.appendChild(style);
    });
    // Keep pointer away from probes, so hover/cursor cannot affect the oracle.
    await move([.1, .8]);
    const probes = await Promise.all(locations.map(screen));
    assert.ok(insideScreenshot(probes), `all masonry probes are inside the screenshot: ${JSON.stringify({cm,probes,viewport:page.viewportSize()})}`);
    assert.ok(await insideStage(probes), 'all masonry probes are inside the actual rendered stage');
    assert.ok(await page.evaluate(point => {
      const root=window.__card.renderRoot,far=root.querySelector('[data-hp="partition"][data-id="far"]');
      const matrix=far.getScreenCTM(),inverse=matrix.inverse();
      const stroke=Number.parseFloat(getComputedStyle(root.querySelector('.wallbody')).strokeWidth);
      const margin=1+stroke*Math.hypot(matrix.a,matrix.b)/2;
      for(let x=-3;x<=3;x++)for(let y=-3;y<=3;y++)for(const dx of [-margin,margin])for(const dy of [-margin,margin])
        if(!far.isPointInFill(new DOMPoint(point.x+x+dx,point.y+y+dy).matrixTransform(inverse)))return false;
      return true;
    },probes[1]), 'all 49 neighbour samples are inside the real body with stroke-plus-one-pixel inset');
    const neighbourBefore = await neighbourDOM();
    const before = await samples(await page.screenshot({ animations: 'disabled' }), probes);
    opaque(before, 'before');
    assert.ok(before[1].every((value,index)=>value===[94,116,136,255][index%4]),
      'all neighbour samples contain the actual configured solid material, not background');
    for (const invalid of [false, true]) {
      await down([.2, .4]); await move(invalid ? [.6, .4] : [.25, .55]);
      assert.ok(await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging),
        `native node drag captured: dark=${dark} cm=${cm} invalid=${invalid}`);
      assert.equal(!!(await transient()).invalid, invalid);
      await tick();
      assert.equal(await page.evaluate(() => [...window.__card.renderRoot.querySelectorAll('.plan-snap-node[cx="200"][cy="400"]')]
        .some(e => getComputedStyle(e).opacity !== '0')), false, 'no old active snap handle');
      assert.deepEqual(await neighbourDOM(), neighbourBefore,
        'ordinary neighbour path, paint and screen matrix remain unchanged before annotation isolation');
      if (!invalid) {
        assert.ok(await page.locator('[data-hp="wall-side-dimensions"]').count() > 0,
          'native dimension annotation remains present during the compositing fixture');
        // Dimensions and snap guides have their own native scenarios. They
        // must not cover a pixel probe intended to measure masonry alpha.
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.textContent = '[data-hp="wall-side-dimensions"]{visibility:hidden}';
          window.__card.renderRoot.appendChild(style);
        });
        console.log('neighbour DOM positive unchanged; native dimension annotation present',
          { dark, cm, nativePaths: nativeNeighbour.length });
      }
      const frozen = await samples(await page.screenshot({ animations: 'disabled' }), probes);
      opaque(frozen, 'frozen');
      // Calibrate the same observed source against the same frozen background,
      // not the older before-frame whose paper/candidate layers can differ.
      const originalOpacity = await page.evaluate(() => {
        const ghost = window.__card.renderRoot.querySelector('.hp-node-source');
        const value = ghost.style.opacity; ghost.style.opacity = '1'; return value;
      });
      let fullSource;
      try {
        fullSource = await samples(await page.screenshot({ animations: 'disabled' }), probes);
        opaque(fullSource, 'full source reference');
      } finally {
        await page.evaluate(value => {
          window.__card.renderRoot.querySelector('.hp-node-source').style.opacity = value;
        }, originalOpacity);
      }
      // Hide only the observed ghost via ordinary CSS. This independent
      // rendered background lets the raster prove alpha, not its DOM attribute.
      await page.evaluate(() => {
        const style = document.createElement('style'); style.id = 'source-oracle';
        style.textContent = '.hp-node-source{visibility:hidden}'; window.__card.renderRoot.appendChild(style);
      });
      const background = await samples(await page.screenshot({ animations: 'disabled' }), probes);
      await page.evaluate(() => window.__card.renderRoot.querySelector('#source-oracle').remove());
      const full = delta(fullSource[0], background[0]), visible = delta(frozen[0], background[0]);
      assert.ok(full > 3 && visible > .8, `source raster visible: dark=${dark} cm=${cm} invalid=${invalid}`);
      assert.ok(Math.abs(visible / full - .35) < .09, `source raster alpha=.35, got ${visible / full}`);
      console.log('source alpha raster', { dark, cm, invalid, ratio: visible / full });
      const neighbourDelta = delta(before[1],frozen[1]);
      assert.ok(neighbourDelta < 1, 'unaffected positive neighbour solid material pixels unchanged');
      console.log('unchanged solid neighbour raster', { dark, cm, invalid, delta: neighbourDelta });
      if (cm) assert.ok(delta(frozen[2], background[2]) < 1, 'old opening cut stays empty; no old opening symbol');
      if (!dark && cm === 25) await page.screenshot({ path: `artifacts/828-node/source-${invalid ? 'invalid' : 'valid'}.png`, animations: 'disabled' });
      await cancel();
      const restored = await samples(await page.screenshot({ animations: 'disabled' }), probes);
      assert.ok(delta(before[0], restored[0]) < 1, 'Esc exact source raster');
    }
  }
  // A shared room corner uses production old room-wall bodies, not new quads.
  const shared = config([], [
    { id: 'one', poly: [[.1, .1], [.5, .1], [.5, .5], [.1, .5]] },
    { id: 'two', poly: [[.5, .1], [.9, .1], [.9, .5], [.5, .5]] },
  ]);
  shared.spaces[0].id = 'shared-reliability'; // separate saved camera, not the preceding single-wall floor
  editGraphFixture(shared, 'shared-reliability', { kind: 'thickness', rooms: ['one', 'two'], cm: 25 }, draft => {
    for (const wall of draft.wall_segments) wall.cm = 25;
  });
  await mount(commitWallSegmentModel(shared).config); await down([.5, .1]);
  if (!await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging)) console.log('shared capture diagnostics',
    await screen([.5, .1]), await page.evaluate(() => ({ mode: window.__card._mode, tool: window.__card._tool,
      toast: window.__card._toast, context: window.__card._editorRuntime.nodeMove.port.context(),
      handles: [...window.__card.renderRoot.querySelectorAll('.hp-node-handle')].map(e => [e.getAttribute('cx'), e.getAttribute('cy')]),
    })));
  assert.equal(await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging), true, 'shared corner captured');
  await move([.65, .1]); await tick();
  assert.equal((await transient()).sources, 1); assert.equal((await transient()).settled, 0);
  const sharedProbe = [await screen([.5, .3])];
  const withSource = await samples(await page.screenshot({ animations: 'disabled' }), sharedProbe);
  await page.evaluate(() => { window.__card.renderRoot.querySelector('.hp-node-source').style.visibility = 'hidden'; });
  const withoutSource = await samples(await page.screenshot({ animations: 'disabled' }), sharedProbe);
  assert.ok(delta(withSource[0], withoutSource[0]) > 1, 'shared old room body is visible above candidate room fill');
  await cancel();
  assert.equal(writes, 0); assert.equal(await page.evaluate(() => window.__card._geometryHistory.size), 0);
  console.log('source raster: alpha=.35 valid/invalid, positive/zero/mixed, light/dark, opening cuts, shared corner; cleanup exact');
  await finish(browser, { writes });
} finally { await browser.close(); }
