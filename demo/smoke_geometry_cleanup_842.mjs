/**
 * #842: an editor save never deletes plan objects silently.
 *
 * AC2 — four stored-plan defects (repeated partition/column id, degenerate
 *       partition, column off the canvas, degenerate partition carrying an
 *       opening): the marker dialog's real «Save» sends nothing, leaves the
 *       config byte-for-byte, keeps the dialog draft and asks K3 with the counts
 *       instead of an error toast.
 * AC3 — «Delete and save» writes exactly R (openings on it included) once; the
 *       open marker dialog then saves. «Cancel» writes nothing.
 * AC6 — an explicit partition+opening delete (select, Delete key, «Delete»)
 *       writes normally, with no K3.
 * AC7 — a background write (a decor gesture, no dialog) refuses by itself and
 *       asks K3; «Cancel» keeps the edit unsent and the next gesture asks
 *       again; «Delete and save» writes the edits without R; teardown with a
 *       non-empty R sends nothing.
 * AC4 LED — a rejected LED command re-arms the deferred write it cancelled.
 *
 * Input is Playwright pointer/keyboard on the rendered controls; the stored
 * plan arrives as a server event (`__hpTest.setServerConfig`), and `config/set`
 * is observed on the HA connection object the card is given.
 */
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1200, height: 900 }, 1);
const ev = (fn, arg) => page.evaluate(fn, arg);
const sleep = (ms) => page.waitForTimeout(ms);

await ev(() => {
  const c = window.__card;
  const real = c.hass.callWS;
  const state = { sets: [], reject: 0 };
  window.__842 = state;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      state.sets.push(structuredClone(message.config));
      if (state.reject > 0) { state.reject -= 1; throw new Error('offline (#842 smoke)'); }
    }
    return real(message);
  } };
  /** The stored plan of f1, optionally with one defect. */
  state.plan = (defect) => (cfg) => {
    const space = cfg.spaces.find((item) => item.id === 'f1');
    delete space.segments;
    space.partitions = [
      { id: 'p-host', a: [0.1, 0.3], b: [0.3, 0.3], cm: 15 },
      { id: 'p-free', a: [0.1, 0.45], b: [0.3, 0.45], cm: 10, note: 'kept by the backend' },
    ];
    space.wall_columns = [
      { id: 'c-square', shape: 'square', center: [0.45, 0.3], cm: 30, angle: 0, finish: 'brick' },
      { id: 'c-round', shape: 'circle', center: [0.45, 0.45], cm: 20, label: 'pillar' },
    ];
    space.openings = [
      { id: 'o-room', type: 'door', x: 0.3, y: 0.14, angle: 0, length: 0.05 },
      { id: 'o-partition', type: 'door', x: 0.2, y: 0.3, angle: 0, length: 0.05,
        host: { kind: 'partition', id: 'p-host', t: 0.5 } },
    ];
    space.decor = [];
    const defects = {
      duplicate: () => space.wall_columns.push({ id: 'p-free', shape: 'square', center: [0.4, 0.75], cm: 20, angle: 0 }),
      degenerate: () => space.partitions.push({ id: 'p-zero', a: [0.7, 0.7], b: [0.7, 0.7], cm: 15 }),
      offCanvas: () => space.wall_columns.push({ id: 'c-far', shape: 'square', center: [6000, 0.5], cm: 20, angle: 0 }),
      hostedOpening: () => {
        space.partitions.push({ id: 'p-lost', a: [0.7, 0.3], b: [0.7, 0.3], cm: 15 });
        space.openings.push({ id: 'o-lost', type: 'door', x: 0.7, y: 0.3, angle: 0, length: 0.05,
          host: { kind: 'partition', id: 'p-lost', t: 0.5 } });
      },
    };
    for (const name of [].concat(defect || [])) defects[name]();
    return cfg;
  };
  state.ids = (list) => (list || []).map((item) => item.id).join(',');
  state.k3 = () => {
    const body = c.shadowRoot.querySelector('hp-confirm .danger-confirm-body[data-confirm-key="geometry-cleanup"]');
    return body ? body.textContent.replace(/\s+/g, ' ').trim() : null;
  };
  state.toast = () => c.shadowRoot.querySelector('[data-hp="toast"]')?.textContent.trim() || '';
});

const sets = () => ev(() => window.__842.sets.length);
const k3 = () => ev(() => window.__842.k3());
const waitK3 = (present = true) => page.waitForFunction((want) => !!window.__842.k3() === want, present, { timeout: 5000 })
  .catch(async () => {
    const state = await ev(() => ({ sets: window.__842.sets.length, k3: window.__842.k3(), confirm: window.__card._dangerConfirm?.request?.key ?? null,
      partitions: window.__842.ids(window.__card._serverCfg.spaces.find((item) => item.id === 'f1').partitions), toast: window.__842.toast(),
      decor: (window.__card._serverCfg.spaces.find((item) => item.id === 'f1').decor || []).length, tool: window.__card._decorTool, mode: window.__card._mode,
      pending: window.__card._saveConfigDebounced.pending(), writes: window.__card._writesPending }));
    throw new Error(`K3 ${present ? 'did not appear' : 'did not close'}: ${JSON.stringify(state)}`);
  });
const pushPlan = (defect) => ev(async (d) => {
  await window.__hpTest.setServerConfig(window.__842.plan(d));
  window.__842.sets.length = 0;
}, defect);
const markerDialog = 'hp-dialog[data-kind="marker"]';
/** Plan (render) coordinates → page pixels, as the LED smoke does. */
const toScreen = (x, y) => ev(([px, py]) => {
  const c = window.__card; const r = c.shadowRoot.querySelector('.stage').getBoundingClientRect();
  const a = c._screenToVb(0, 0), b = c._screenToVb(1000, 1000);
  return [r.left + (px - a[0]) / (b[0] - a[0]) * 1000, r.top + (py - a[1]) / (b[1] - a[1]) * 1000];
}, [x, y]);
const k3Button = (which) => page.locator(`hp-confirm .danger-confirm-footer [data-hp="dialog-${which}"]`);

/** Real input: open the device's dialog, type a name, press its Save. */
async function saveMarker(name) {
  await ev(() => window.__hpTest.setMode('devices'));
  await page.locator('[data-hp="device"][data-id="d_light1"]').click();
  await page.locator(`${markerDialog} #marker-name`).fill(name);
  await page.locator(`${markerDialog} .dialog-action-commit [data-hp="dialog-confirm"]`).click();
}
async function closeMarker() {
  await page.locator(`${markerDialog} button.btn.ghost[data-hp="dialog-cancel"]`).click();
  await sleep(150);
  if (await k3Button('confirm').count()) await k3Button('confirm').click(); // discard the draft
  await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]'));
}

// ---------------- AC2: four defects, the marker dialog's Save ----------------
const counts = {
  duplicate: { partitions: 0, columns: 1, openings: 0 },
  degenerate: { partitions: 1, columns: 0, openings: 0 },
  offCanvas: { partitions: 0, columns: 1, openings: 0 },
  hostedOpening: { partitions: 1, columns: 0, openings: 1 },
};
for (const [defect, expected] of Object.entries(counts)) {
  await pushPlan(defect);
  const before = await ev(() => JSON.stringify(window.__card._serverCfg));
  await saveMarker(`Ceiling ${defect}`);
  await waitK3();
  await sleep(150);
  const after = await ev(() => JSON.stringify(window.__card._serverCfg));
  check(`AC2 ${defect}: config/set is not called`, await sets(), 0);
  check(`AC2 ${defect}: the live config is byte-for-byte the previous one`, after === before);
  check(`AC2 ${defect}: the marker dialog keeps its draft, not busy`, await ev((name) => {
    const dialog = window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]');
    return dialog?.querySelector('#marker-name')?.value === name && window.__card._markerDialog?.busy === false;
  }, `Ceiling ${defect}`));
  check(`AC2 ${defect}: K3 names the counts`, await k3(), await ev((vars) => window.__card._t('confirm.geometry_cleanup_body', vars), expected));
  check(`AC2 ${defect}: no generic error toast`, await ev(() => window.__842.toast()), '');
  if (defect !== 'hostedOpening') {
    await k3Button('cancel').click();
    await waitK3(false);
    await closeMarker();
  }
}

// ---------------- AC3: «Delete and save» on the hosted-opening defect ----------------
await k3Button('confirm').click();
await waitK3(false);
await page.waitForFunction(() => window.__842.sets.length >= 1);
await sleep(300);
const cleaned = await ev(() => {
  const sent = window.__842.sets[0].spaces.find((item) => item.id === 'f1');
  const { ids } = window.__842;
  return {
    writes: window.__842.sets.length,
    partitions: ids(sent.partitions), columns: ids(sent.wall_columns), openings: ids(sent.openings),
    finish: sent.wall_columns.find((item) => item.id === 'c-square')?.finish,
    toast: window.__842.toast(),
    dialogOpen: !!window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]'),
    markers: window.__842.sets[0].markers.filter((item) => item.name === 'Ceiling hostedOpening').length,
  };
});
check('AC3 «Delete and save»: exactly R is gone in one write', cleaned, {
  writes: 1, partitions: 'p-host,p-free', columns: 'c-square,c-round', openings: 'o-room,o-partition',
  finish: 'brick', toast: await ev(() => window.__card._t('toast.geometry_cleanup_done')),
  dialogOpen: true, markers: 0,
});
await page.locator(`${markerDialog} .dialog-action-commit [data-hp="dialog-confirm"]`).click();
await page.waitForFunction(() => !window.__card.shadowRoot.querySelector('hp-dialog[data-kind="marker"]'), null, { timeout: 5000 });
check('AC3: the open dialog then saves', await ev(() => ({
  writes: window.__842.sets.length,
  saved: window.__842.sets.at(-1).markers.some((item) => item.name === 'Ceiling hostedOpening'),
})), { writes: 2, saved: true });

await pushPlan('degenerate');
const beforeCancel = await ev(() => JSON.stringify(window.__card._serverCfg));
await saveMarker('Ceiling cancel');
await waitK3();
await k3Button('cancel').click();
await waitK3(false);
await sleep(700);
check('AC3 «Cancel»: nothing written, nothing changed', { writes: await sets(),
  same: await ev(() => JSON.stringify(window.__card._serverCfg)) === beforeCancel }, { writes: 0, same: true });
await closeMarker();

// ---------------- AC6: explicit partition+opening delete ----------------
await pushPlan(null);
await ev(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
await sleep(600);
const [px, py] = await toScreen(140, await ev(() => window.__card._spaceModel().partitions[0].a[1]));
await page.mouse.click(px, py); // a quarter along p-host, clear of its door
await sleep(200);
await page.keyboard.press('Delete');
await page.locator('hp-dialog[data-kind="confirm"]:not(.danger-confirm-dialog) [data-hp="dialog-confirm"]').click();
await sleep(900);
check('AC6: the explicit delete writes once, without K3', await ev(() => {
  const sent = window.__842.sets.at(-1)?.spaces.find((item) => item.id === 'f1');
  return { writes: window.__842.sets.length, k3: window.__842.k3(),
    partitions: window.__842.ids(sent?.partitions), openings: window.__842.ids(sent?.openings) };
}), { writes: 1, k3: null, partitions: 'p-free', openings: 'o-room' });

// ---------------- AC7: a background write asks by itself ----------------
await pushPlan('degenerate');
await ev(async () => { await window.__hpTest.setMode('decor'); await window.__hpTest.setTool('rect'); });
const drawRect = async (dx) => {
  const [x, y] = await toScreen(640 + dx * 1000, 640); // inside r3, plan render units
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 30, { steps: 5 });
  await page.mouse.up();
};
await sleep(600);
check('AC7 precondition: no dialog is open', await ev(() => window.__card.shadowRoot.querySelectorAll('hp-dialog').length), 0);
await drawRect(0);
await sleep(200);
check('AC7: nothing before the deferred write fires', { k3: await k3(), writes: await sets() }, { k3: null, writes: 0 });
await waitK3();
const refused = await ev(() => {
  const space = window.__card._serverCfg.spaces.find((item) => item.id === 'f1');
  return { writes: window.__842.sets.length, decor: (space.decor || []).length,
    keeps: window.__842.ids(space.partitions).includes('p-zero'), toast: window.__842.toast() };
});
check('AC7: refused by itself — no config/set, the edit and every object stay, no toast', refused,
  { writes: 0, decor: 1, keeps: true, toast: '' });
await k3Button('cancel').click();
await waitK3(false);
await sleep(700);
check('AC7 «Cancel»: the edit stays local and unsent', { writes: await sets(),
  decor: await ev(() => window.__card._serverCfg.spaces.find((item) => item.id === 'f1').decor.length) }, { writes: 0, decor: 1 });
await drawRect(0.12);
await waitK3();
check('AC7: the next gesture asks again', await sets(), 0);
await k3Button('confirm').click();
await page.waitForFunction(() => window.__842.sets.length >= 1);
await sleep(400);
check('AC7 «Delete and save»: one write with the edits, without R', await ev(() => {
  const sent = window.__842.sets[0].spaces.find((item) => item.id === 'f1');
  return { writes: window.__842.sets.length, decor: (sent.decor || []).length,
    zero: window.__842.ids(sent.partitions).includes('p-zero') };
}), { writes: 1, decor: 2, zero: false });

// ---------------- AC4 LED: a rejected command restores the cancelled deferred write ----------------
// HA disables a device, the stored plan predates it; re-enabling it later makes
// the card flag a new device and schedule its ordinary deferred write.
await pushPlan(null);
await ev(async () => {
  window.__setRegistryDisabled('device', 'd_kettle', 'user');
  await new Promise((resolve) => setTimeout(resolve, 300));
  await window.__hpTest.setServerConfig((cfg) => {
    cfg.settings.known_devices = (cfg.settings.known_devices || []).filter((id) => id !== 'd_kettle');
    cfg.settings.new_device_ids = [];
    return cfg;
  });
  await window.__hpTest.setMode('devices');
});
await sleep(700);
await page.click('[data-tool="led-strip"]');
await sleep(400);
for (const [x, y] of [[620, 300], [880, 300]]) {
  const [sx, sy] = await toScreen(x, y);
  await page.mouse.click(sx, sy);
  await sleep(80);
}
await ev(() => window.__setRegistryDisabled('device', 'd_kettle', null));
const armed = await page.waitForFunction(() => window.__card._saveConfigDebounced.pending(), null, { timeout: 2000 })
  .then(() => true, () => false);
check('AC4 LED precondition: the new-device write is pending while the chain is open', armed);
await ev(() => { window.__842.reject = 1; window.__842.sets.length = 0; });
await page.keyboard.press('Escape');
await sleep(1200);
check('AC4 LED: the rejected command, then exactly one restored write with the new device', await ev(() => {
  const [rejected, restored] = window.__842.sets;
  const strips = (cfg) => (cfg?.spaces.find((item) => item.id === 'f1').led_strips || []).length;
  return { writes: window.__842.sets.length, attempted: strips(rejected), restoredStrips: strips(restored),
    newDevice: (restored?.settings?.new_device_ids || []).includes('d_kettle') };
}), { writes: 2, attempted: 1, restoredStrips: 0, newDevice: true });
await page.keyboard.press('Escape');

// ---------------- AC7 teardown: non-empty R, a pending edit, the card leaves ----------------
await pushPlan('degenerate');
await ev(async () => { await window.__hpTest.setMode('decor'); await window.__hpTest.setTool('rect'); });
await drawRect(0.05);
await ev(() => { window.__842.sets.length = 0; window.__card.remove(); });
await sleep(900);
check('AC7 teardown: nothing sent, no dialog left behind', await ev(() => ({
  writes: window.__842.sets.length, confirm: window.__card._dangerConfirm,
})), { writes: 0, confirm: null });

await finish(browser, { done: true });
