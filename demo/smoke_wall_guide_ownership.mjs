// #893 AC2/AC4: the guide observes #885's real winning endpoint; it does not
// perform another snap. Native mouse, real lazy editor and recording HA wire.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const results = [];
const cases = ['h', 'v'].flatMap(axis => [0, 20].map(cm => ({ axis, cm, zoom: 1, theme: 'dark' })))
  .concat(['light', 'dark'].flatMap(theme => [0.5, 2].map(zoom => ({ axis: 'h', cm: 20, zoom, theme }))));
await mkdir('artifacts/issue-893', { recursive: true });
for (const { axis, cm, zoom, theme } of cases) {
  const horizontal = axis === 'h', end = 0.6031;
  const reference = horizontal ? [[0.55, 0.65], [end, 0.65]] : [[0.65, 0.55], [0.65, end]];
  const ambiguous = horizontal ? [[end + 0.003, 0.69], [end + 0.003, 0.65]]
    : [[0.69, end + 0.003], [0.65, end + 0.003]];
  const first = [0.4, 0.4], target = horizontal ? [end, first[1]] : [first[0], end];
  let server = commitWallSegmentModel({ spaces: [{ id: 'guide-floor', title: 'Guide', view_box: [0, 0, 1, 1],
    rooms: [{ id: 'frame', name: 'Room', area: null,
      poly: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]] }], openings: [],
    partitions: [{ id: 'reference', a: reference[0], b: reference[1], cm },
      { id: 'ambiguous-neighbour', a: ambiguous[0], b: ambiguous[1], cm: 0 }] }],
    markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
  let revision = 1;
  const writes = [];
  const { page, browser } = await launch({ width: 1180, height: 920 }, 1, [], { hasTouch: true });
  try {
    await page.exposeFunction('guideWire', async message => {
      if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision, can_write: true };
      if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
      if (message.type !== 'houseplan/config/set') return null;
      assert.equal(message.expected_rev, revision);
      server = structuredClone(message.config); writes.push(structuredClone(server));
      return { ok: true, rev: ++revision };
    });
    await page.evaluate(theme => {
      const old = window.__card, hass = window.__mkHass(), call = hass.callWS.bind(hass);
      hass.devices = {}; hass.entities = {}; hass.states = {};
      hass.themes = { darkMode: theme === 'dark' };
      hass.callWS = async message => {
        if (message.type.endsWith('registry/list')) return [];
        return await window.guideWire(message) ?? call(message);
      };
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', title: 'Guide test', language: 'en' });
      for (const [key, value] of Object.entries({
        '--primary-color': theme === 'dark' ? '#3ea6ff' : '#0b73b8',
        '--primary-text-color': theme === 'dark' ? '#e6e7eb' : '#202124',
        '--secondary-text-color': theme === 'dark' ? '#9aa4ad' : '#5f6368',
        '--card-background-color': theme === 'dark' ? '#202126' : '#ffffff',
        '--ha-card-background': theme === 'dark' ? '#202126' : '#ffffff',
        '--divider-color': theme === 'dark' ? '#3a3d45' : '#d7d9de',
      })) card.style.setProperty(key, value);
      old.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
    }, theme);
    await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'guide-floor');
    await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('draw'); });
    await page.waitForFunction(() => !window.__card._modeTransitionBusy);
    if (zoom !== 1) {
      // Genuine browser contacts, not a private camera write. The symmetric
      // pinch changes only zoom and keeps the centre of the fixture visible.
      const stage = await page.locator('houseplan-card').locator('.stage').boundingBox();
      const x = stage.x + stage.width / 2, y = stage.y + stage.height / 2;
      const cdp = await page.context().newCDPSession(page);
      const points = distance => [{ x: x - distance / 2, y, id: 1 }, { x: x + distance / 2, y, id: 2 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(120) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(120 * zoom) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
      await page.waitForTimeout(100);
      check(`${theme}, ${zoom}: native pinch reaches the requested editor scale`,
        await page.evaluate(() => window.__card._zoom), zoom);
    }
    const screen = p => page.evaluate(p => {
      const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
      q.x = p[0] * 1000; q.y = p[1] * 1000;
      const at = q.matrixTransform(svg.getScreenCTM()); return { x: at.x, y: at.y };
    }, p);
    const frames = () => page.evaluate(async () => {
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
    });
    const inspect = () => page.evaluate(() => {
      const c = window.__card;
      const lines = [...c.renderRoot.querySelectorAll('[data-wall-end-guide]')].filter(n => {
        for (let p = n; p?.nodeType === 1; p = p.parentElement) if (+getComputedStyle(p).opacity === 0) return false;
        return true;
      });
      return { cursor: c._cursorPt, candidate: c._planSnapHover?.candidate?.kind,
        conflicts: c._planSnapHover?.conflicts?.length ?? 0,
        lines: lines.map(n => [+n.getAttribute('x1'), +n.getAttribute('y1'), +n.getAttribute('x2'), +n.getAttribute('y2')]),
        groups: new Set(lines.map(n => n.closest('.alignguides'))).size };
    });
    const at = await screen(first); await page.mouse.click(at.x, at.y); await frames();
    const aim = await screen(target);
    await page.mouse.move(aim.x + (horizontal ? 4 : 0), aim.y + (horizontal ? 0 : 4), { steps: 4 }); await frames();
    const preview = await inspect(), label = `${axis}, ${cm}cm, ${theme}, ${zoom}`;
    check(`${label}: exact off-grid preview`, preview.cursor, target.map(x => x * 1000));
    check(`${label}: one winning guide layer`, [preview.lines.length, preview.groups], [1, 1]);
    const line = preview.lines[0];
    check(`${label}: guide starts at the selected independent endpoint`, line?.slice(0, 2), reference[1].map(x => x * 1000));
    check(`${label}: guide shares the exact aligned coordinate`, horizontal ? line?.[2] : line?.[3], end * 1000);
    if (zoom !== 1) {
      const clip = await page.locator('houseplan-card').locator('.stage').boundingBox();
      await page.screenshot({ path: `artifacts/issue-893/guide-${theme}-${zoom}.png`, clip });
    }
    // Endpoint and wall-axis owners outrank alignment. Neither may retain a
    // stale independent-end guide from the immediately preceding hover.
    if (zoom === 1) {
    for (const [kind, p] of [['endpoint', reference[0]], ['axis', reference.map(p => p).reduce((a, p) => [a[0] + p[0] / 2, a[1] + p[1] / 2], [0, 0])]]) {
      const point = await screen(p); await page.mouse.move(point.x, point.y, { steps: 3 }); await frames();
      const owned = await inspect();
      check(`${label}: ${kind} has no false winning alignment guide`, owned.lines.length, 0);
      check(`${label}: ${kind} actually owns the point`, owned.candidate, kind === 'axis' ? 'line' : kind);
    }
    const conflictAt = await screen(horizontal ? [end + 0.0015, 0.65] : [0.65, end + 0.0015]);
    await page.mouse.move(conflictAt.x, conflictAt.y, { steps: 3 }); await frames();
    const conflict = await inspect();
    check(`${label}: genuinely ambiguous endpoints offer no false alignment guide`,
      [conflict.lines.length, conflict.conflicts >= 2], [0, true]);
    await page.keyboard.down('Shift');
    const diagonal = await screen([0.5, 0.5]); await page.mouse.move(diagonal.x, diagonal.y, { steps: 3 }); await frames();
    check(`${label}: Shift diagonal offers no false alignment guide`, (await inspect()).lines.length, 0);
    await page.keyboard.up('Shift');
    }
    // Return to the very same pointer location; click must persist its preview.
    await page.mouse.move(aim.x + (horizontal ? 4 : 0), aim.y + (horizontal ? 0 : 4), { steps: 3 }); await frames();
    const final = await inspect();
    const beforeWrites = writes.length;
    await page.mouse.click(aim.x + (horizontal ? 4 : 0), aim.y + (horizontal ? 0 : 4)); await frames();
    for (let i = 0; i < 200 && writes.length === beforeWrites; i++) await page.waitForTimeout(25);
    const saved = server.spaces[0].partitions.find(w => w.id !== 'reference'
      && Math.hypot(w.a[0] - first[0], w.a[1] - first[1]) < 1e-6);
    check(`${label}: accepted wall endpoint equals the exact preview`, saved?.b, final.cursor?.map(x => x / 1000));
    check(`${label}: save actually reached HA`, writes.length > 0);
    // Third corner enables the accepted contour-closure endpoint owner.
    if (zoom === 1) {
    const third = horizontal ? [end, 0.5] : [0.5, end];
    const next = await screen(third); await page.mouse.click(next.x, next.y); await frames();
    await page.mouse.move(at.x, at.y, { steps: 4 }); await frames();
    const closure = await inspect();
    check(`${label}: closure owns its target without stale alignment guide`, [closure.lines.length, closure.candidate], [0, 'endpoint']);
    }
    await page.keyboard.press('Escape'); await frames();
    results.push({ axis, cm, zoom, theme, preview, accepted: saved?.b });
    await finish(browser, { label });
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ results }, null, 2));
