/**
 * #780 AC6/AC19/AC20 (ТЗ §5): binding and the «icon ↔ LED strip» switch.
 * The picker binds a light (lights first): the live marker is created with
 * the strip's explicit space, the ordinary icon disappears and comes back on
 * «Show as icon», whose shape stays hidden and is restored exactly by «Show as
 * LED strip» — no drawing, no new record, no HA service. An ordinary icon
 * clicked while a strip is selected opens its own dialog without the LED tray.
 * Deleting the bound marker leaves an unbound strip. A failed write rolls back
 * and records no command; Undo/Redo of the switch is one command each.
 */
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 820 }, 1);
const evaluate = (fn, arg) => page.evaluate(fn, arg);

await evaluate(async () => {
  const c = window.__card;
  window.__ledSaves = 0; window.__ledFail = false; window.__ledServices = [];
  const orig = c.hass.callWS;
  c.hass.callWS = async (m) => {
    if (m.type === 'houseplan/config/set') {
      if (window.__ledFail) throw new Error('offline');
      window.__ledSaves++;
    }
    return orig.call(c.hass, m);
  };
  const service = c.hass.callService;
  c.hass.callService = async (...args) => { window.__ledServices.push(args.slice(0, 2).join('.')); return service(...args); };
  // One unbound strip in the Living room of the demo floor.
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.spaces[0].led_strips = [{ id: 'led-a', points: [[0.12, 0.22], [0.40, 0.22], [0.40, 0.40]], marker: null }];
  });
  await window.__hpTest.setMode('devices');
});
await page.waitForTimeout(800);
check('an editable strip loads the tool for the Devices editor', await evaluate(() => !!window.__card._ledEditor));
const icon = (id) => evaluate((id) => !!window.__card.shadowRoot.querySelector(`.dev[data-id="${id}"], [data-hp="device"][data-id="${id}"]:not(.led-hit)`), id);
check('the light starts as an ordinary icon', await icon('d_bedlight'));

await evaluate(() => window.__card._ledEditor.select('led-a'));
await page.waitForTimeout(200);
await page.click('[data-led-action="bind"]');
await page.waitForTimeout(200);
check('lights first in the picker', await evaluate(() => {
  const picks = [...window.__card.shadowRoot.querySelectorAll('[data-led-pick]')].map((b) => b.dataset.ledPick);
  const firstOther = picks.findIndex((id) => !['d_light1', 'd_lamp', 'd_bedlight'].includes(id));
  return picks.slice(0, 3).every((id) => ['d_light1', 'd_lamp', 'd_bedlight'].includes(id)) && firstOther === 3;
}));
await page.click('[data-led-pick="d_bedlight"]');
await page.waitForTimeout(500);
const bound = await evaluate(() => {
  const c = window.__card;
  return { strip: c._serverCfg.spaces[0].led_strips[0], marker: c._serverCfg.markers.find((m) => m.id === 'd_bedlight') };
});
check('bound to the light', bound.strip.marker, 'd_bedlight');
check('the live marker carries the explicit strip space', bound.marker?.space, 'f1');
check('the ordinary icon is gone', await icon('d_bedlight'), false);
check('the device keeps its catalogue place', await evaluate(() => window.__card._devices.some((d) => d.id === 'd_bedlight' && d.space === 'f1')));

// An ordinary icon while the strip is selected: its own dialog, no LED tray.
await evaluate(() => window.__card._ledEditor.select('led-a'));
await page.waitForTimeout(100);
await evaluate(() => window.__hpTest.openMarkerDialog('d_lamp'));
await page.waitForTimeout(200);
check('an icon dialog drops the strip selection', await evaluate(() => window.__card._ledEditor.sel), null);
await evaluate(() => window.__hpTest.close());
await page.waitForTimeout(150);
check('closing that dialog shows no LED tray', await evaluate(() => !/Delete strip/.test(window.__card.shadowRoot.querySelector('.editor-secondary')?.textContent || '')));

// Tray: «Show as icon» hides the shape and returns the icon.
await evaluate(() => window.__card._ledEditor.select('led-a'));
await page.waitForTimeout(150);
await page.click('[data-led-action="icon"]');
await page.waitForTimeout(500);
check('«Show as icon» keeps the exact shape hidden', await evaluate(() => {
  const s = window.__card._serverCfg.spaces[0].led_strips[0];
  return s.active === false && s.marker === 'd_bedlight' && JSON.stringify(s.points) === JSON.stringify([[0.12, 0.22], [0.4, 0.22], [0.4, 0.4]]);
}));
check('the icon is back and nothing of the strip is drawn', await icon('d_bedlight')
  && await evaluate(() => !window.__card.shadowRoot.querySelector('[data-led-strip], [data-led-select]')));
check('the switch is one command', await evaluate(() => window.__card._devicePositionHistory.undoName), 'Device representation');
await page.keyboard.press('Control+z'); await page.waitForTimeout(500);
check('Undo shows the strip again', await evaluate(() => window.__card._serverCfg.spaces[0].led_strips[0].active !== false));
await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(500);
check('Redo hides it again', await evaluate(() => window.__card._serverCfg.spaces[0].led_strips[0].active), false);

// Device dialog: «Show as LED strip» restores the hidden shape at once.
await evaluate(() => window.__hpTest.openMarkerDialog('d_bedlight'));
await page.waitForTimeout(300);
check('the dialog offers unbind/delete for a hidden shape', await evaluate(() => [...window.__card.shadowRoot
  .querySelectorAll('[data-led-representation] [data-led-action]')].map((b) => b.dataset.ledAction).join()), 'show-strip,unbind,delete');
await page.click('[data-led-representation] [data-led-action="show-strip"]');
await page.waitForTimeout(500);
check('restored without drawing, same record', await evaluate(() => {
  const strips = window.__card._serverCfg.spaces[0].led_strips;
  return strips.length === 1 && strips[0].id === 'led-a' && strips[0].active === true && !window.__card._ledEditor.tool;
}));
check('no HA service on any representation change', await evaluate(() => window.__ledServices.length), 0);

// A failed write rolls back and records no command.
const undoBefore = await evaluate(() => window.__card._devicePositionHistory.undoName);
await evaluate(() => { window.__ledFail = true; });
await evaluate(() => window.__card._ledEditor.setActive('led-a', false, 'f1'));
await page.waitForTimeout(300);
check('failed write: state unchanged', await evaluate(() => window.__card._serverCfg.spaces[0].led_strips[0].active), true);
check('failed write: no new command', await evaluate(() => window.__card._devicePositionHistory.undoName), undoBefore);
await evaluate(() => { window.__ledFail = false; });

// Converting a plain icon by drawing: one write, the same marker.
await evaluate(() => window.__hpTest.openMarkerDialog('d_lamp'));
await page.waitForTimeout(300);
await page.click('[data-led-representation] [data-led-action="show-strip"]');
await page.waitForTimeout(400);
const toScreen = (x, y) => evaluate(([x, y]) => {
  const c = window.__card; const r = c.shadowRoot.querySelector('.stage').getBoundingClientRect();
  const a = c._screenToVb(0, 0), b = c._screenToVb(1000, 1000);
  return [r.left + (x - a[0]) / (b[0] - a[0]) * 1000, r.top + (y - a[1]) / (b[1] - a[1]) * 1000];
}, [x, y]);
for (const [x, y] of [[150, 480], [380, 480]]) { const [sx, sy] = await toScreen(x, y); await page.mouse.click(sx, sy); await page.waitForTimeout(80); }
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
check('drawing converted the lamp in one write, no picker', await evaluate(() => {
  const c = window.__card; const strip = c._serverCfg.spaces[0].led_strips.find((s) => s.marker === 'd_lamp');
  return !!strip && strip.active === true && !c._ledEditor.picker && c._serverCfg.markers.filter((m) => m.id === 'd_lamp').length === 1;
}));

// Deleting the bound marker leaves an unbound strip with its geometry —
// through the strip's own «Device settings» and the dialog's Delete + confirm.
await evaluate(() => window.__card._ledEditor.select('led-a'));
await page.waitForTimeout(150);
await page.click('[data-led-action="settings"]');
await page.waitForTimeout(300);
await page.click('hp-dialog[data-kind="marker"] .markeractions .btn.danger');
await page.waitForTimeout(200);
await page.click('hp-confirm [data-hp="dialog-confirm"]');
await page.waitForTimeout(500);
check('deleting the marker unbinds the strip in the same write', await evaluate(() => {
  const s = window.__card._serverCfg.spaces[0].led_strips.find((x) => x.id === 'led-a');
  return s.marker === null && s.active === true && s.points.length === 3;
}));

await finish(browser);
