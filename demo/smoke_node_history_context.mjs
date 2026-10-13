// #843: Undo/Redo of a wall-node move is applied from any Plan/Background tool,
// after a mode or floor change and after the person's own write; it moves the
// cursor only after the server accepted it and shows the result floor. Real
// toolbar buttons, keys and pointers; HA is a recording wire with expected_rev.
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';

const room = id => ({ id: `${id}-room`, name: 'Room', area: null, poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] });
const initial = commitWallSegmentModel({ spaces: [
  { id: 'node-floor', title: 'Nodes', view_box: [0, 0, 1, 1], rooms: [room('node')],
    partitions: [{ id: 'wall', a: [0.2, 0.4], b: [0.6, 0.4], cm: 25 }],
    openings: [{ id: 'door', type: 'door', x: 0.5, y: 0.4, angle: 0, length: 0.06,
      host: { kind: 'partition', id: 'wall', t: 0.75 }, flip_h: true }] },
  { id: 'second', title: 'Second', view_box: [0, 0, 1, 1], rooms: [room('second')] },
], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
let server = structuredClone(initial), revision = 1;
const log = [], gates = {}, failures = {};
/** Hold the next request of `type` at the server until released. */
const hold = type => {
  let release; const promise = new Promise(resolve => { release = resolve; });
  return (gates[type] = { promise, release, arrived: false });
};
const { page, browser } = await launch({ width: 1180, height: 920 });
await page.exposeFunction('historyWire', async message => {
  if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision, can_write: true, wall_node_move_api: 1 };
  if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (message.type !== 'houseplan/config/set' && message.type !== 'houseplan/wall/node_move') return null;
  const gate = gates[message.type];
  if (gate) { gate.arrived = true; await gate.promise; delete gates[message.type]; }
  const entry = { type: message.type.split('/').at(-1), rev: message.expected_rev, direction: message.direction, space: message.space_id };
  log.push(entry);
  const failure = failures[message.type];
  if (failure) { delete failures[message.type]; entry.refused = failure.code; return { __error: failure }; }
  if (message.expected_rev !== revision) { entry.refused = 'conflict'; return { __error: { code: 'conflict', message: 'conflict' } }; }
  if (message.type === 'houseplan/config/set') { server = structuredClone(message.config); return { ok: true, rev: ++revision }; }
  const index = server.spaces.findIndex(space => space.id === message.space_id);
  const source = message.direction === 'undo' ? message.before_space : server.spaces[index];
  const nodes = structuralWallNodes(source);
  const node = nodes.find(n => Math.hypot(n.point[0] - message.intent.point[0], n.point[1] - message.intent.point[1]) < 1e-8);
  const moved = applyNodeMove(prepareNodeMove(source, node, nodes, message.intent.split_ids), message.intent.target, message.intent.axis);
  if (!moved.ok) return { __error: { code: 'node_move_invalid', message: 'node_move_invalid' } };
  const spaces = [...server.spaces]; spaces[index] = message.direction === 'undo' ? source : moved.space;
  server = commitWallSegmentModel({ ...server, spaces }).config;
  return { config: structuredClone(server), rev: ++revision, ok: true };
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
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'Node history', language: 'en' });
  previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
});
await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'node-floor');
// Test instrumentation only: every distinct toast the person sees, in order.
await page.evaluate(() => {
  window.__toasts = [];
  const root = window.__card.renderRoot;
  new MutationObserver(() => {
    const text = root.querySelector('[data-hp="toast"]')?.textContent?.trim();
    if (text && text !== window.__toasts.at(-1)) window.__toasts.push(text);
  }).observe(root, { subtree: true, childList: true, characterData: true });
});
await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));

const screen = p => page.evaluate(p => {
  const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
  q.x = p[0] * 1000; q.y = p[1] * 1000; const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
}, p);
const state = () => page.evaluate(() => {
  const card = window.__card, history = card._geometryHistory;
  const button = icon => card.renderRoot.querySelector(`[data-hp="toolbar"] ha-icon[icon="${icon}"]`)?.closest('button');
  return { mode: card._mode, tool: card._tool, space: card._space, undo: history.undoName, redo: history.redoName,
    size: history.size, handles: card.renderRoot.querySelectorAll('.hp-node-handle').length,
    undoDisabled: button('mdi:undo-variant')?.disabled ?? null, redoDisabled: button('mdi:redo-variant')?.disabled ?? null };
});
const idle = () => page.waitForFunction(() => {
  const node = window.__card._editorRuntime?.nodeMove;
  return !node?.busy && !node?.dragging;
}, null, { timeout: 10000 });
const toasts = () => page.evaluate(() => window.__toasts.splice(0));
const nodeLog = () => log.filter(entry => entry.type === 'node_move' && !entry.refused).map(e => `${e.direction}@${e.rev}`);
const settled = () => page.evaluate(() => window.__hpTest.settled());
const MOVE = 'Move wall node';
const toolbar = async (kind, icon) => {
  await page.locator(`houseplan-card [data-hp="toolbar"][data-kind="${kind}"] ha-icon[icon="${icon}"]`).locator('xpath=..').click({ timeout: 5000 });
};
const step = async (label, run, direction) => {
  const before = nodeLog().length;
  await run(); await idle(); await settled();
  check(`${label}: exactly one accepted ${direction}`, nodeLog().slice(before), [`${direction === 'Undo' ? 'undo' : 'apply'}@${revision - 1}`]);
  check(`${label}: ${direction} toast after acceptance`, (await toasts()).at(-1), `${direction === 'Undo' ? 'Undone' : 'Redone'}: ${MOVE}`);
};

// ---- the node move itself (Plan/Select is still the only capture context)
const start = await screen([0.2, 0.4]), target = await screen([0.25, 0.55]);
await page.mouse.move(start.x, start.y); await page.mouse.down();
await page.mouse.move(target.x, target.y, { steps: 6 });
await page.waitForFunction(() => window.__card._editorRuntime.nodeMove.preview !== null);
await page.mouse.up(); await idle();
const moved = structuredClone(server);
check('accepted move is one node write', nodeLog(), ['apply@1']);
check('history holds the move', (await state()).undo, MOVE);
await toasts();

// ---- AC1: no setTool('select') before Undo/Redo; keys and buttons
await page.evaluate(() => window.__hpTest.setTool('draw'));
check('AC1 Draw: no node handles outside Select', (await state()).handles, 0);
await step('AC1 Draw Ctrl+Z', () => page.keyboard.press('Control+z'), 'Undo');
check('AC1 Draw: exact starting floor', server, initial);
await step('AC1 Draw Ctrl+Shift+Z', () => page.keyboard.press('Control+Shift+z'), 'Redo');
check('AC1 Draw: exact moved floor', server, moved);
await page.evaluate(() => window.__hpTest.setTool('resize'));
await step('AC1 Resize toolbar Undo', () => toolbar('plan', 'mdi:undo-variant'), 'Undo');
await step('AC1 Resize toolbar Redo', () => toolbar('plan', 'mdi:redo-variant'), 'Redo');
check('AC1 Resize: tool and editor stay, no handles', (await state()).tool + (await state()).mode + (await state()).handles, 'resizeplan0');
await page.evaluate(async () => { await window.__hpTest.setMode('view'); await window.__hpTest.setMode('plan'); });
check('AC1 Plan→View→Plan resets the tool to Draw', (await state()).tool, 'draw');
await step('AC1 Plan→View→Plan Ctrl+Z', () => page.keyboard.press('Control+z'), 'Undo');
await step('AC1 Plan→View→Plan Ctrl+Y', () => page.keyboard.press('Control+y'), 'Redo');
await page.evaluate(() => window.__hpTest.setMode('decor'));
await step('AC1 Background Ctrl+Z', () => page.keyboard.press('Control+z'), 'Undo');
await step('AC1 Background toolbar Redo', () => toolbar('decor', 'mdi:redo-variant'), 'Redo');
const kept = await state();
check('AC1: history kept through every context', [kept.undo, kept.redo, kept.size], [MOVE, null, 1]);

// ---- AC5 + AC4 in flight: another floor, cursor and floor only after the answer
await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.switchSpace('second'); });
check('AC5: the floor change resets the tool to Draw', [(await state()).space, (await state()).tool], ['second', 'draw']);
let gate = hold('houseplan/wall/node_move');
await page.keyboard.press('Control+z');
await page.waitForFunction(() => window.__card._editorRuntime.nodeMove.busy);
for (let i = 0; i < 50 && !gate.arrived; i++) await page.waitForTimeout(20);
await page.keyboard.press('Control+z'); await settled();
let held = await state();
check('AC4 in flight: cursor not moved, floor not switched, buttons inactive',
  [held.undo, held.redo, held.space, held.undoDisabled, held.redoDisabled], [MOVE, null, 'second', true, true]);
check('AC4 in flight: no «Undone» before acceptance', (await toasts()).some(text => text.startsWith('Undone')), false);
gate.release(); await idle(); await settled();
check('AC4: the repeated press was ignored (one request)', nodeLog().slice(-1), [`undo@${revision - 1}`]);
check('AC5: the result floor is shown, editor and tool stay', [(await state()).space, (await state()).mode, (await state()).tool],
  ['node-floor', 'plan', 'draw']);
check('AC5: Undone after acceptance', (await toasts()).at(-1), `Undone: ${MOVE}`);

// ---- AC4: a refused request keeps the history; the next attempt passes
failures['houseplan/wall/node_move'] = { code: 'timeout', message: 'timeout' };
const refusedAt = log.length;
await page.keyboard.press('Control+Shift+z'); await idle(); await settled();
check('AC4 refused: one request reached the server and was refused', log.slice(refusedAt).filter(e => e.type === 'node_move').map(e => e.refused), ['timeout']);
check('AC4 refused: cursor and commands as before', [(await state()).undo, (await state()).redo], [null, MOVE]);
check('AC4 refused: the cause is named', (await toasts()).at(-1), 'Undo is not available right now. Try again.');
await step('AC4 next attempt', () => page.keyboard.press('Control+Shift+z'), 'Redo');

// ---- AC7: a move while the own Save flies, accepted in the middle of the gesture
await page.evaluate(() => window.__hpTest.setTool('draw'));
gate = hold('houseplan/config/set');
for (const p of [[0.3, 0.75], [0.7, 0.75]]) { const at = await screen(p); await page.mouse.click(at.x, at.y); }
await page.keyboard.press('Escape');
for (let i = 0; i < 200 && !gate.arrived; i++) await page.waitForTimeout(20);
check('AC7: the own wall Save is in flight', gate.arrived, true);
await page.evaluate(() => window.__hpTest.setTool('select'));
await page.waitForFunction(() => window.__card.renderRoot.querySelector('.hp-node-handle'));
const node = await screen([0.25, 0.55]), next = await screen([0.3, 0.6]);
const ownRev = revision;
await page.mouse.move(node.x, node.y); await page.mouse.down();
await page.mouse.move((node.x + next.x) / 2, (node.y + next.y) / 2, { steps: 3 });
gate.release();
await page.waitForFunction(rev => window.__card._cfgRev > rev, ownRev);
const withWall = structuredClone(server);
await page.mouse.move(next.x, next.y, { steps: 3 });
check('AC7: the gesture survives its own accepted Save', await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging), true);
await page.mouse.up(); await idle(); await settled();
check('AC7: own Save, then one node request with the revision after it',
  log.slice(-2).map(e => `${e.type}@${e.rev}${e.refused ? '!' : ''}`), [`set@${ownRev}`, `node_move@${ownRev + 1}`]);
check('AC7: the move is the newest command', (await state()).undo, MOVE);
await toasts();

// ---- AC2: two quick Ctrl+Z — an ordinary command above the node command
await page.evaluate(() => window.__hpTest.setTool('draw'));
for (const p of [[0.3, 0.85], [0.7, 0.85]]) { const at = await screen(p); await page.mouse.click(at.x, at.y); }
await page.keyboard.press('Escape');
const quickAt = log.length;
await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
await idle(); await page.waitForFunction(() => !window.__card._saveConfigDebounced.pending()); await idle(); await settled();
const quick = log.slice(quickAt).map(e => `${e.type}@${e.rev}${e.refused ? '!' : ''}`);
check('AC2: the own write goes first, then exactly one node Undo with the revision after it',
  [quick.filter(e => e.startsWith('node_move')).length, quick.at(-1), quick.at(-2)?.startsWith('set@')],
  [1, `node_move@${revision - 1}`, true]);
check('AC2: the node floor returns exactly to its state before the move', server.spaces[0], withWall.spaces[0]);
check('AC2: both commands undone, tool stays', [(await state()).redo, (await state()).tool], [MOVE, 'draw']);
check('AC2: both toasts', (await toasts()).slice(-2), ['Undone: Add wall segment', `Undone: ${MOVE}`]);

// ---- AC6: a text field, an active Draw chain and View never reach node history
const quiet = log.length, first = await screen([0.3, 0.3]);
await page.mouse.click(first.x, first.y); await settled();
await page.keyboard.press('Control+z'); await settled();
check('AC6: Ctrl+Z removes the Draw point, no history step', [log.length, (await state()).undo, (await state()).redo],
  [quiet, 'Add wall segment', MOVE]);
await page.mouse.click(first.x, first.y); await settled();
await page.keyboard.press('Control+Shift+z'); await idle(); await settled();
check('AC6: the active Draw chain owns the first Redo; no node write', [log.length, (await state()).redo], [quiet, MOVE]);
const dialog = await page.evaluate(async () => {
  const dialog = await window.__hpTest.openRoomEdit('node-room');
  const field = dialog.querySelector('input') || dialog.shadowRoot?.querySelector('input');
  field?.focus();
  return !!field;
});
await page.keyboard.press('Control+Shift+z');
check('AC6: a text field keeps its native history', [dialog, log.length], [true, quiet]);
await page.evaluate(() => window.__hpTest.close());
await page.evaluate(() => window.__hpTest.setMode('view'));
await page.keyboard.press('Control+Shift+z'); await settled();
check('AC6 View: no geometry Redo and no node write', [log.length, (await state()).redo], [quiet, MOVE]);
await page.evaluate(() => window.__hpTest.setMode('devices'));
await page.keyboard.press('Control+Shift+z'); await settled();
check('AC6 Devices: its own history, no node write', [log.length, (await state()).redo], [quiet, MOVE]);
await finish(browser, { requests: log.length, revision });
