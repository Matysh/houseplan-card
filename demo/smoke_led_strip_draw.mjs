/**
 * #780 AC3/AC4/AC5/AC20 (ТЗ §4, §6): the LED strip tool of the Devices editor.
 * Clean clicks draw a chain; a mouse pan, a second finger and a cancelled
 * pointer add nothing; Ctrl+Z removes the chain's own point; Esc finishes and
 * opens the device picker; a click on the first point closes the loop; leaving
 * the tool finishes, never loses the chain. A new segment stops at the first
 * face of a thick wall, a fast vertex drag cannot jump it. The selection lives
 * in the session only, its tray closes on Esc and on a clean background click.
 * A space switch finishes an unfinished chain in its own space (r1 M3).
 * Plan/Background have no LED tool, handles or targets.
 */
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
const evaluate = (fn, arg) => page.evaluate(fn, arg);

await evaluate(async () => {
  const c = window.__card;
  window.__ledSaves = [];
  const orig = c.hass.callWS;
  c.hass.callWS = async (m) => {
    if (m.type === 'houseplan/config/set') window.__ledSaves.push(JSON.parse(JSON.stringify(m.config)));
    return orig.call(c.hass, m);
  };
  // A thick partition across a plain room: the placement body of AC5.
  await window.__hpTest.setServerConfig((cfg) => ({ ...cfg, spaces: [{ id: 'led', title: 'LED', cell_cm: 5, view_box: [0, 0, 1, 0.7],
    rooms: [{ id: 'room', name: 'Room', area: null, poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.6], [0.1, 0.6]] }],
    wall_segments: [], partitions: [{ id: 'p1', a: [0.5, 0.15], b: [0.5, 0.55], cm: 40 }] }], markers: [] }));
  await window.__hpTest.setLayout({});
  await window.__hpTest.setMode('plan');
});
await page.waitForTimeout(300);
check('plan editor has no LED tool', await evaluate(() => !window.__card.shadowRoot.querySelector('[data-tool="led-strip"]')));
await evaluate(() => window.__hpTest.setMode('devices'));
await page.waitForTimeout(300);
check('devices editor has the LED tool next to Add', await evaluate(() => {
  const tools = [...window.__card.shadowRoot.querySelectorAll('.devbar [data-hp="tool"]')].map((b) => b.dataset.tool);
  return tools.indexOf('led-strip') === tools.indexOf('add-device') + 1;
}));
check('no LED chunk before the tool', await evaluate(() => window.__card._ledEditor === null));

const toScreen = (x, y) => evaluate(([x, y]) => {
  const c = window.__card; const r = c.shadowRoot.querySelector('.stage').getBoundingClientRect();
  const a = c._screenToVb(0, 0), b = c._screenToVb(1000, 1000);
  return [r.left + (x - a[0]) / (b[0] - a[0]) * 1000, r.top + (y - a[1]) / (b[1] - a[1]) * 1000];
}, [x, y]);
const clickAt = async (x, y) => { const [sx, sy] = await toScreen(x, y); await page.mouse.click(sx, sy); await page.waitForTimeout(80); };
const chain = () => evaluate(() => window.__card._ledEditor?.chain?.points.length ?? null);
const strips = () => evaluate(() => window.__card._serverCfg.spaces[0].led_strips || []);

await page.click('[data-tool="led-strip"]');
await page.waitForTimeout(500);
check('tool armed, capture layer over icons', await evaluate(() => !!window.__card._ledEditor?.tool
  && !!window.__card.shadowRoot.querySelector('[data-hp-led-capture]')));
check('touch-safe start hint in the tray', await evaluate(() => /Click to start the strip/.test(
  window.__card.shadowRoot.querySelector('.editor-secondary')?.textContent || '')));

await clickAt(200, 200);
await clickAt(400, 200);
check('two clean clicks, two points', await chain(), 2);
// A mouse pan: press, travel past the slop, release.
{
  const [sx, sy] = await toScreen(400, 300);
  await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 60, sy + 10, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(100);
}
check('a pan adds no point', await chain(), 2);
// A pinch: a second finger joins, the release adds nothing.
await evaluate(() => {
  const layer = window.__card.shadowRoot.querySelector('[data-hp-led-capture]');
  const ev = (type, id, x) => layer.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: 300, bubbles: true, button: 0 }));
  ev('pointerdown', 11, 300); ev('pointerdown', 12, 340); ev('pointerup', 11, 300); ev('pointerup', 12, 340);
  ev('pointerdown', 13, 360); ev('pointercancel', 13, 360); ev('pointerup', 13, 360);
});
check('pinch and cancel add no point', await chain(), 2);
await clickAt(400, 400);
check('third point', await chain(), 3);
await page.keyboard.press('Control+z');
check('Ctrl+Z removes the chain’s own point', await chain(), 2);
check('nothing written while drawing', await evaluate(() => window.__ledSaves.length), 0);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
const first = await strips();
check('Esc finished one unbound strip', first.length === 1 && first[0].marker === null
  && JSON.stringify(first[0].points) === JSON.stringify([[0.2, 0.2], [0.4, 0.2]]));
check('the device picker opened', await evaluate(() => !!window.__card.shadowRoot.querySelector('hp-dialog[data-kind="led-picker"]')));
await page.click('[data-led-action="later"]');
await page.waitForTimeout(200);
check('Later keeps the unbound strip, selected with its tray', await evaluate(() => {
  const c = window.__card;
  return c._serverCfg.spaces[0].led_strips.length === 1 && !!c._ledEditor.sel
    && /Strip is not bound to a device/.test(c.shadowRoot.querySelector('.editor-secondary')?.textContent || '');
}));
check('unbound strip is a grey dashed mark in Devices', await evaluate(() => !!window.__card.shadowRoot.querySelector('[data-led-unbound]')));

// AC5: a new segment stops at the first face of the 40 cm partition.
await page.click('[data-tool="led-strip"]'); await page.waitForTimeout(200);
await clickAt(300, 450);
await clickAt(700, 450);
const clamp = await evaluate(() => window.__card._ledEditor.chain.points.map((p) => p.map((v) => Math.round(v * 10) / 10)));
check('segment stopped at the partition face', clamp[1][0] < 500 && clamp[1][0] > 470 && clamp[1][1] === 450);
// Leaving the tool finishes the chain without an extra segment.
await page.click('[data-tool="led-strip"]'); await page.waitForTimeout(400);
check('leaving the tool finished the chain', (await strips()).length, 2);
await page.keyboard.press('Escape'); await page.waitForTimeout(100);

// A click on the first point (≥3 vertices) closes the strip.
await page.click('[data-tool="led-strip"]'); await page.waitForTimeout(200);
await clickAt(150, 150); await clickAt(250, 150); await clickAt(250, 250); await clickAt(150, 152);
await page.waitForTimeout(400);
const loop = (await strips())[2];
check('closed by a click on the first point', !!loop && JSON.stringify(loop.points[0]) === JSON.stringify(loop.points.at(-1)) && loop.points.length === 4);
await page.keyboard.press('Escape'); await page.waitForTimeout(100);

// AC5: a fast vertex drag across the partition keeps the last safe position.
await evaluate(() => window.__card._ledEditor.select(window.__card._serverCfg.spaces[0].led_strips[0].id));
await page.waitForTimeout(200);
const handle = await evaluate(() => { const r = window.__card.shadowRoot.querySelector('[data-led-handle="1"]').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
const far = await toScreen(800, 200);
await page.mouse.move(handle[0], handle[1]); await page.mouse.down(); await page.mouse.move(far[0], far[1], { steps: 2 }); await page.mouse.up();
await page.waitForTimeout(400);
const dragged = (await strips())[0].points[1];
check('vertex drag cannot jump the wall', dragged[0] < 0.5 && dragged[0] > 0.45);
check('the drag is one LED history command', await evaluate(() => window.__card._devicePositionHistory.undoName), 'LED strip shape');
await page.keyboard.press('Control+z'); await page.waitForTimeout(400);
check('Undo restores the shape', JSON.stringify((await strips())[0].points), JSON.stringify([[0.2, 0.2], [0.4, 0.2]]));

// The selection is session state: Esc and a clean background click close the tray.
await evaluate(() => window.__card._ledEditor.select(window.__card._serverCfg.spaces[0].led_strips[0].id));
const savesBefore = await evaluate(() => window.__ledSaves.length);
await page.keyboard.press('Escape'); await page.waitForTimeout(100);
check('Esc drops the selection', await evaluate(() => window.__card._ledEditor.sel), null);
await evaluate(() => window.__card._ledEditor.select(window.__card._serverCfg.spaces[0].led_strips[0].id));
await page.waitForTimeout(100);
await clickAt(700, 550);
check('a clean background click drops the selection', await evaluate(() => window.__card._ledEditor.sel), null);
check('dropping the selection writes nothing', await evaluate(() => window.__ledSaves.length), savesBefore);

// r1 M3 (ТЗ §4): a space switch with an unfinished chain finishes it in the
// space it was drawn in — never in the space shown now — and opens no picker there.
await evaluate(() => window.__hpTest.setServerConfig((cfg) => {
  if (!cfg.spaces.some((space) => space.id === 'led2')) {
    cfg.spaces.push({ id: 'led2', title: 'LED 2', cell_cm: 5, view_box: [0, 0, 1, 0.7], rooms: [], wall_segments: [], partitions: [] });
  }
}));
await page.waitForTimeout(300);
const beforeSwitch = (await strips()).length;
await page.click('[data-tool="led-strip"]');
await page.waitForTimeout(200);
await clickAt(200, 500);
await clickAt(350, 500);
check('an unfinished chain before the switch', await chain(), 2);
await evaluate(() => window.__hpTest.switchSpace('led2'));
await page.waitForTimeout(600);
const switched = await evaluate(() => {
  const c = window.__card;
  const of = (id) => c._serverCfg.spaces.find((space) => space.id === id)?.led_strips || [];
  return { led: of('led').length, led2: of('led2').length, last: of('led').at(-1)?.points,
    sel: c._ledEditor.sel, tool: c._ledEditor.tool,
    picker: !!c.shadowRoot.querySelector('hp-dialog[data-kind="led-picker"]') };
});
check('the chain is stored in the space it was drawn in', switched.led, beforeSwitch + 1);
check('nothing is written into the space shown now', switched.led2, 0);
check('the stored chain keeps its points', JSON.stringify(switched.last), JSON.stringify([[0.2, 0.5], [0.35, 0.5]]));
check('no tool, selection or picker carried into the other space',
  JSON.stringify([switched.tool, switched.sel, switched.picker]), JSON.stringify([false, null, false]));
await evaluate(() => window.__hpTest.switchSpace('led'));
await page.waitForTimeout(400);

// «Optimize plans» reports a strip that passes through the partition and changes nothing in it.
const optimizeNote = await evaluate(async () => {
  const c = window.__card;
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces[0].led_strips = [...cfg.spaces[0].led_strips, { id: 'through', points: [[0.3, 0.3], [0.7, 0.3]], marker: null }];
  });
  c._editorRuntime.optimizePlans.open();
  await c.updateComplete;
  for (let i = 0; i < 40 && !c.shadowRoot.querySelector('[data-led-walls]'); i++) {
    await new Promise((r) => setTimeout(r, 50));
    c.requestUpdate(); await c.updateComplete;
  }
  const note = c.shadowRoot.querySelector('[data-led-walls]');
  const kept = JSON.stringify(c._alignDialog?.config?.spaces?.[0]?.led_strips?.find((s) => s.id === 'through')?.points);
  await window.__hpTest.close(note?.closest('hp-dialog') || undefined);
  return { n: note?.dataset.ledWalls, text: note?.textContent || '', kept };
});
check('optimize reports strips through walls', optimizeNote.n, '1');
check('the report names the space', /Strips passing through walls: 1 \(LED\)/.test(optimizeNote.text));
check('optimize keeps the strip as drawn', optimizeNote.kept, JSON.stringify([[0.3, 0.3], [0.7, 0.3]]));

// Plan/Background: passive translucent marks only, no handles, no targets.
await evaluate(() => window.__hpTest.setMode('decor'));
await page.waitForTimeout(300);
check('Background editor: no LED editor layer or tool', await evaluate(() => {
  const r = window.__card.shadowRoot;
  return !r.querySelector('[data-hp-led-editor]') && !r.querySelector('[data-tool="led-strip"]') && !r.querySelector('[data-led-handle]');
}));

await finish(browser);
