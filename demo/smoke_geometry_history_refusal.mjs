// #883: a refused ordinary Undo/Redo keeps the rest of the shared geometry
// history. Real mouse clicks/drags create every step; the card's own toolbar
// buttons and keys undo/redo them; a live public setConfig({ floor }) pins a
// floor. HA is a recording wire (config/get, config/set with expected_rev).
// The only fault injection is the physical-geometry verdict at the history
// boundary (an explicit unsafe verdict or a throwing checker); missing-space
// and corrupted-snapshot refusals are unreachable from the UI and stay
// unit-only (test/geometry-history-refusal.test.mjs).
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';

const room = id => ({ id: `${id}-room`, name: 'Room', area: null, poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] });
const initial = commitWallSegmentModel({ spaces: [
  { id: 'f1', title: 'First', view_box: [0, 0, 1, 1], rooms: [room('f1')] },
  { id: 'f2', title: 'Second', view_box: [0, 0, 1, 1], rooms: [room('f2')] },
], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
let server = structuredClone(initial), revision = 1;
const log = [];
const { page, browser } = await launch({ width: 1180, height: 920 });
await page.exposeFunction('historyWire', async message => {
  if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision, can_write: true };
  if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (message.type !== 'houseplan/config/set') return null;
  log.push(message.expected_rev);
  if (message.expected_rev !== revision) return { __error: { code: 'conflict', message: 'conflict' } };
  server = structuredClone(message.config);
  return { ok: true, rev: ++revision };
});
await page.evaluate(async () => {
  const previous = window.__card, hass = window.__mkHass(), old = hass.callWS.bind(hass);
  hass.devices = {}; hass.entities = {}; hass.states = {};
  hass.callWS = async m => {
    if (m.type.endsWith('registry/list')) return [];
    const answer = await window.historyWire(m);
    if (answer?.__error) throw answer.__error;
    return answer ?? old(m);
  };
  window.__baseConfig = { type: 'custom:houseplan-card', title: 'History refusal', language: 'en' };
  const card = document.createElement('houseplan-card');
  card.setConfig(window.__baseConfig);
  previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
});
await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'f1');
// Test instrumentation only: every toast the person sees, in order, and the
// physical verdict at the Undo/Redo boundary (a preflight fault injection).
await page.evaluate(() => {
  window.__toasts = [];
  const card = window.__card, root = card.renderRoot, strict = card._checkSpacePhysicalGeometry;
  let shown = '';
  new MutationObserver(() => {
    const text = root.querySelector('[data-hp="toast"]')?.textContent?.trim() || '';
    if (text && text !== shown) window.__toasts.push(text);
    shown = text;
  }).observe(root, { subtree: true, childList: true, characterData: true });
  window.__historyVerdict = null;
  card._checkSpacePhysicalGeometry = function (...args) { // private-ok: #883 substitutes only the Undo/Redo boundary verdict; every other caller gets the strict result
    const verdict = strict.apply(this, args), fault = window.__historyVerdict;
    if (!fault || !/_applyGeometryState/.test(new Error().stack || '')) return verdict;
    if (fault === 'throw') throw new TypeError('checker failed');
    return { ...verdict, ok: false, status: 'failed', reason: 'wall-failed-core' };
  };
});

const screen = p => page.evaluate(p => {
  const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
  q.x = p[0] * 1000; q.y = p[1] * 1000; const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
}, p);
const settled = () => page.evaluate(() => window.__hpTest.settled());
const state = () => page.evaluate(() => {
  const card = window.__card, history = card._geometryHistory;
  const button = icon => card.renderRoot.querySelector('[data-hp="toolbar"] ha-icon[icon="' + icon + '"]')?.closest('button');
  return { mode: card._mode, tool: card._tool, space: card._space, undo: history.undoName, redo: history.redoName,
    size: history.size, path: card._path.length, chainRedo: card._wallChainRedo.length,
    undoTitle: button('mdi:undo-variant')?.title ?? null, redoTitle: button('mdi:redo-variant')?.title ?? null };
});
const toasts = () => page.evaluate(() => window.__toasts.splice(0));
/** Let the 500 ms deferred Save fire (or prove that nothing was armed). */
const saved = async () => {
  await page.waitForTimeout(650);
  await page.waitForFunction(() => !window.__card._saveConfigDebounced.pending() && !window.__card._writesPending);
  await settled();
};
/** Saved free-standing walls of a floor (ids), and its decor count, as the server holds them. */
const walls = space => (server.spaces.find(item => item.id === space)?.partitions || []).map(item => item.id).sort();
const decor = space => (server.spaces.find(item => item.id === space)?.decor || []).length;
const without = (list, ...gone) => list.filter(id => !gone.flat().includes(id));
// The isolated page's warm cache is off: a live setConfig would otherwise repaint the
// cached older revision over this session's own accepted writes (a separate finding).
const pin = floor => page.evaluate(async floor => {
  const card = window.__card;
  localStorage.removeItem('houseplan_card_cfg_v1');
  card.setConfig(floor ? { ...window.__baseConfig, floor } : window.__baseConfig);
  await card.updateComplete;
}, floor).then(settled);
const click = async p => { const at = await screen(p); await page.mouse.click(at.x, at.y); await settled(); };
const drawWall = async (a, b) => { await click(a); await click(b); await page.keyboard.press('Escape'); await saved(); };
const toolbar = async icon => {
  await page.locator(`houseplan-card [data-hp="toolbar"][data-kind="plan"] ha-icon[icon="${icon}"]`).locator('xpath=..').click({ timeout: 5000 });
  await settled();
};
const key = async combo => { await page.keyboard.press(combo); await settled(); };
const editor = async (mode, tool) => {
  await page.evaluate(async ([mode, tool]) => { await window.__hpTest.setMode(mode); await window.__hpTest.setTool(tool); }, [mode, tool]);
  await page.waitForFunction(() => !window.__card._modeTransitionBusy);
};
const SEGMENT = 'Add wall segment', DECOR = 'Add decor object';
const PINNED = 'This operation belongs to a space unavailable in this card. Open a card with access to that space or remove the fixed-floor setting.';
const RETRY = 'Undo is not available right now. Try again.';
const removed = (verb, name) => `Cannot ${verb} “${name}”: the geometry cannot be safely restored. Only this operation was removed from history.`;

// ---- two real steps on two floors
await editor('plan', 'draw');
await drawWall([0.3, 0.3], [0.7, 0.3]);
await page.evaluate(() => window.__hpTest.switchSpace('f2'));
await drawWall([0.3, 0.3], [0.7, 0.3]);
const two = await state(), w1 = walls('f1');
check('setup: two named steps on two floors', [two.undo, two.size, two.space, w1.length, walls('f2').length], [SEGMENT, 2, 'f2', 1, 1]);
await toasts();

// ---- AC1: a floor pinned by a live setConfig keeps the refused command and its order
await pin('f2');
check('AC1: the live pin keeps the editor on the pinned floor', [(await state()).mode, (await state()).space], ['plan', 'f2']);
await key('Control+z'); await saved();
check('AC1: the pinned floor itself undoes normally', [(await toasts()).at(-1), (await state()).undo, (await state()).redo], [`Undone: ${SEGMENT}`, SEGMENT, SEGMENT]);
const writesBefore = log.length;
await key('Control+z');
let now = await state();
check('AC1 Ctrl+Z: one named refusal, no «Undone»', await toasts(), [PINNED]);
check('AC1 Ctrl+Z: the step and both directions stay', [now.size, now.undo, now.redo], [1, SEGMENT, SEGMENT]);
check('AC1 Ctrl+Z: same floor and editor, no hidden switch', [now.space, now.mode, now.tool], ['f2', 'plan', 'draw']);
await toolbar('mdi:undo-variant');
now = await state();
check('AC1 toolbar Undo: refused the same way', [now.size, now.undo, now.redo, now.space], [1, SEGMENT, SEGMENT, 'f2']);
check('AC1: the buttons still name the kept steps', [now.undoTitle?.includes(SEGMENT), now.redoTitle?.includes(SEGMENT)], [true, true]);
await saved();
check('AC1: nothing was written, the floor plan is as before', [log.length - writesBefore, walls('f1')], [0, w1]);
await pin(null);
await key('Control+z'); await saved();
now = await state();
check('AC1 unpinned: the retry undoes exactly the refused step and shows its floor', [(await toasts()).at(-1), now.space, now.size, walls('f1')],
  [`Undone: ${SEGMENT}`, 'f1', 0, []]);
await pin('f2');
const redoWrites = log.length;
await key('Control+Shift+z'); await key('Control+y');
now = await state();
check('AC1 Redo (Ctrl+Shift+Z, Ctrl+Y): refused, kept, floor stays', [await toasts(), now.size, now.redo, now.space], [[PINNED], 0, SEGMENT, 'f2']);
await saved();
check('AC1 Redo: nothing written', log.length - redoWrites, 0);
await pin(null);
await key('Control+Shift+z'); await saved();
check('AC1 unpinned: the Redo retry applies exactly it', [(await toasts()).at(-1), (await state()).space, walls('f1')], [`Redone: ${SEGMENT}`, 'f1', w1]);

// ---- AC2: an unfit step leaves alone; the neighbours of another editor and the same name apply next
await editor('decor', 'line');
const from = await screen([0.2, 0.6]), to = await screen([0.5, 0.6]);
await page.mouse.move(from.x, from.y); await page.mouse.down();
await page.mouse.move(to.x, to.y, { steps: 6 }); await page.mouse.up(); await saved();
await editor('plan', 'draw');
await drawWall([0.3, 0.5], [0.7, 0.5]);
const three = await state(), withThird = walls('f1'), w3 = without(withThird, w1);
check('AC2 setup: wall, Background line, wall', [three.undo, three.size, decor('f1'), w3.length], [SEGMENT, 3, 1, 1]);
await toasts();
const unfitWrites = log.length;
await page.evaluate(() => { window.__historyVerdict = 'unsafe'; });
await key('Control+z');
await page.evaluate(() => { window.__historyVerdict = null; });
now = await state();
check('AC2 Undo: only the unfit step left, one toast with its name and reason', await toasts(), [removed('undo', SEGMENT)]);
check('AC2 Undo: the older steps stay in order, nothing entered Redo', [now.size, now.undo, now.redo], [2, DECOR, null]);
await saved();
check('AC2 Undo: the plan and the server are unchanged', [log.length - unfitWrites, walls('f1'), decor('f1')], [0, withThird, 1]);
await key('Control+z'); await saved();
// A snapshot step restores its whole recorded floor: the removed step is not rebuilt (spec: not in scope).
check('AC2: the Background step is undone next from Plan', [(await toasts()).at(-1), decor('f1'), walls('f1')], [`Undone: ${DECOR}`, 0, w1]);
await key('Control+z'); await saved();
check('AC2: the same-named neighbour is undone next', [(await toasts()).at(-1), walls('f1'), (await state()).size], [`Undone: ${SEGMENT}`, [], 0]);
await page.evaluate(() => { window.__historyVerdict = 'unsafe'; });
await key('Control+Shift+z');
await page.evaluate(() => { window.__historyVerdict = null; });
now = await state();
check('AC2 Redo is symmetric: only that step leaves Redo and never enters Undo', [await toasts(), now.size, now.redo],
  [[removed('redo', SEGMENT)], 0, DECOR]);
await key('Control+Shift+z'); await saved();
check('AC2 Redo: the neighbour applies next', [(await toasts()).at(-1), decor('f1'), walls('f1')], [`Redone: ${DECOR}`, 1, w1]);

// ---- AC3: the active Walls chain
const chain = [[0.2, 0.8], [0.4, 0.8], [0.6, 0.8]];
for (const p of chain) await click(p);
await saved();
const chainWalls = walls('f1'), [s1, s2] = without(chainWalls, w1);
check('AC3 setup: an active chain of two accepted segments', [(await state()).path, (await state()).undo, chainWalls.length], [3, SEGMENT, 3]);
await toasts();
await page.evaluate(() => { window.__historyVerdict = 'throw'; });
await key('Control+z');
now = await state();
check('AC3 temporary Undo: the chain ledger and the history stay', [await toasts(), now.path, now.chainRedo, now.size], [[RETRY], 3, 0, 3]);
await page.evaluate(() => { window.__historyVerdict = null; });
await key('Control+z'); await saved();
now = await state();
const oneBack = walls('f1');
check('AC3: one accepted point back', [(await toasts()).at(-1), now.path, now.chainRedo, oneBack.length], [`Undone: ${SEGMENT}`, 2, 1, 2]);
await page.evaluate(() => { window.__historyVerdict = 'throw'; });
await key('Control+Shift+z');
now = await state();
check('AC3 temporary Redo: the redo-point ledger stays', [await toasts(), now.path, now.chainRedo, now.redo], [[RETRY], 2, 1, SEGMENT]);
const chainWrites = log.length;
await page.evaluate(() => { window.__historyVerdict = 'unsafe'; });
await key('Control+Shift+z');
await page.evaluate(() => { window.__historyVerdict = null; });
now = await state();
check('AC3 unfit Redo: one step leaves, the obsolete chain ends, Walls stays', [await toasts(), now.path, now.chainRedo, now.redo, now.tool],
  [[removed('redo', SEGMENT)], 0, 0, null, 'draw']);
await saved();
check('AC3 unfit Redo: no write, saved walls unchanged', [log.length - chainWrites, walls('f1')], [0, oneBack]);
await key('Control+z'); await saved();
check('AC3: the next Ctrl+Z is an ordinary step, not a terminal of the old chain', [(await toasts()).at(-1), (await state()).path, walls('f1')],
  [`Undone: ${SEGMENT}`, 0, w1]);
check('AC3: the chain segments were real saved walls', [s1 && s2 && s1 !== s2], [true]);
for (const p of [[0.2, 0.7], [0.4, 0.7], [0.6, 0.7]]) await click(p);
await saved();
const second = walls('f1'), secondWrites = log.length;
check('AC3 setup: a second chain of two segments', second.length, 3);
await toasts();
await page.evaluate(() => { window.__historyVerdict = 'unsafe'; });
await key('Control+z');
await page.evaluate(() => { window.__historyVerdict = null; });
now = await state();
check('AC3 unfit chain Undo: one step leaves, the chain ends without a write', [await toasts(), now.path, now.chainRedo, now.redo, now.tool],
  [[removed('undo', SEGMENT)], 0, 0, null, 'draw']);
await saved();
check('AC3 unfit chain Undo: saved walls unchanged', [log.length - secondWrites, walls('f1')], [0, second]);
await key('Control+z'); await saved();
check('AC3: the older segment is undone as an ordinary step', [(await toasts()).at(-1), (await state()).path, walls('f1')], [`Undone: ${SEGMENT}`, 0, w1]);
await click([0.3, 0.2]); await click([0.5, 0.2]); await saved();
// The same «Undone» text again: let the previous toast expire so the new one is observed.
await page.waitForFunction(() => !window.__card.renderRoot.querySelector('[data-hp="toast"]'), null, { timeout: 6000 });
await key('Control+z'); await saved();
check('AC3: a new chain and its own one-point Undo work', [(await toasts()).at(-1), (await state()).path], [`Undone: ${SEGMENT}`, 1]);
await page.keyboard.press('Escape'); await settled();

// ---- AC4: View has no geometry Undo/Redo
const viewState = await state(), viewWrites = log.length;
await page.evaluate(() => window.__hpTest.setMode('view'));
await key('Control+z'); await key('Control+Shift+z'); await saved();
const after = await state();
check('AC4 View: no history step and no write', [after.size, after.redo, log.length - viewWrites], [viewState.size, viewState.redo, 0]);
await finish(browser, { requests: log.length, revision });
