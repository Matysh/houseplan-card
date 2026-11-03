// #1256/#1257: accepted Python replies must retain native node interactions.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { launch, check, finish } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { structuralWallNodes } from '../test-build/wall-node-move.js';

const clone = value => structuredClone(value);
const square = [[.05, .05], [.95, .05], [.95, .95], [.05, .95]];
const backup = process.env.HP_NODE_ORDER_BACKUP;
const initial = backup ? (() => {
  const data = JSON.parse(readFileSync(backup, 'utf8'));
  assert.equal(data.kind, 'space');
  return { ...data.payload.config, model_version: data.model_version };
})() : commitWallSegmentModel({ spaces: [{ id: 'python-nodes', title: 'Python nodes', cell_cm: 5,
  view_box: [0, 0, 1, 1],
  rooms: [{ id: 'room', name: 'Room', area: null, poly: square,
    wall_ids: square.map((_, i) => `contour-${i}`) }],
  wall_segments: square.map((a, i) => ({ id: `contour-${i}`, a, b: square[(i + 1) % square.length], cm: 20 })),
  partitions: [{ id: 'wall', a: [.2, .35], b: [.7, .35], cm: 20 }],
}], markers: [] }).config;
initial.settings = { ...initial.settings, filter_seeded: true, known_devices: [], new_device_ids: [] };
const floor = initial.spaces[0], nodes = structuralWallNodes(floor);
const lone = (point, id) => nodes.some(n => n.valence === 1 && n.walls[0].id === id
  && n.point.every((v, i) => Math.abs(v - point[i]) < 1e-8));
const selected = floor.partitions.filter(p => lone(p.a, p.id) && lone(p.b, p.id))
  .sort((a, b) => Math.hypot(...b.a.map((v, i) => v - b.b[i])) - Math.hypot(...a.a.map((v, i) => v - a.b[i])))[0];
assert.ok(selected, 'fixture has an isolated wall with two independent endpoints');
const edge = floor.plan_graph.edges.find(e => e.kind === 'partition' && e.id === selected.id);
const expectedIds = floor.plan_graph.edges.map(e => [e.kind, e.id]);
let server = clone(initial), revision = 1;
const writes = [], observations = [];
const python = process.env.PYTHON || 'python3';
const script = fileURLToPath(new URL('./helpers/wall-node-python.py', import.meta.url));
const { page, browser } = await launch({ width: 1500, height: 1000 });
try {
  await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
  await page.exposeFunction('pythonNodeWire', async message => {
    if (message.type === 'houseplan/config/get') return { config: clone(server), rev: revision,
      can_write: true, wall_node_move_api: 1, wall_node_delete_api: 1, plan_graph_api: 1 };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/config/set') throw Error('node gestures must not fall through to a body/config write');
    if (message.type !== 'houseplan/wall/node_move') return null;
    assert.equal(message.expected_rev, revision, 'serialized revision');
    const next = JSON.parse(execFileSync(python, [script], { encoding: 'utf8',
      input: JSON.stringify({ config: server, ...message }), maxBuffer: 16 * 1024 * 1024 }));
    assert.deepEqual(next.spaces[0].plan_graph.edges.map(e => [e.kind, e.id]), expectedIds, 'no duplicated wall');
    // Do not rebuild this Python reply with the TS projector: its key order is the regression.
    server = next;
    writes.push(clone(message));
    return { ok: true, config: clone(server), rev: ++revision };
  });
  const boot = async () => {
    await page.evaluate(() => {
      const previous = window.__card, hass = window.__mkHass(), base = hass.callWS.bind(hass);
      hass.devices = {}; hass.entities = {}; hass.states = {};
      hass.connection = { ...hass.connection, connected: true };
      hass.callWS = async message => message.type.endsWith('registry/list') ? []
        : (await window.pythonNodeWire(message)) ?? base(message);
      const card = document.createElement('houseplan-card');
      card.setConfig({ type: 'custom:houseplan-card', title: 'Python node roundtrip', language: 'en' });
      previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
    });
    await page.waitForFunction(id => !window.__card._booting && window.__card._space === id, floor.id);
    await page.evaluate(async () => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select'); });
    await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card._editorRuntime.nodeMove);
    await page.evaluate(() => window.__hpTest.settled());
  };
  const center = async id => {
    const handle = page.locator(`houseplan-card .hp-node-handle[data-node="${id}"]`);
    assert.equal(await handle.count(), 1, `interactive handle ${id} survives the accepted reply`);
    const box = await handle.boundingBox();
    assert.ok(box, 'handle is presented');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  const interaction = async (id, label) => {
    const p = await center(id);
    await page.mouse.move(p.x, p.y);
    const cursor = await page.evaluate(({ x, y }) => {
      const target = window.__card.renderRoot.elementFromPoint(x, y);
      return target && getComputedStyle(target).cursor;
    }, p);
    check(`${label}: hover offers node grab`, cursor, 'grab');
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.waitForFunction(() => !!window.__card.renderRoot.querySelector('[data-hp="node-context-menu"]:not([inert])'));
    check(`${label}: context menu opens`, true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__card.renderRoot.querySelector('[data-hp="node-context-menu"]:not([inert])'));
    observations.push({ label, cursor, menu: true });
  };
  const waitRevision = async next => {
    await page.waitForFunction(next => window.__card._cfgRev === next
      && !window.__card._editorRuntime.nodeMove.busy && !window.__card._editorRuntime.nodeMove.dragging, next);
    await page.evaluate(() => window.__hpTest.settled());
    check(`revision ${next}: all node handles remain`, await page.locator('houseplan-card .hp-node-handle').count(), nodes.length);
  };
  await boot();
  await interaction(edge.from, 'before first move A');
  await interaction(edge.to, 'before first move B');
  for (const [id, label] of [[edge.from, 'A'], [edge.to, 'B']]) {
    const p = await center(id), frozen = clone(server), next = revision + 1;
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    check(`${label}: native pointer captures a node`, await page.evaluate(() => window.__card._editorRuntime.nodeMove.dragging));
    check(`${label}: body drag remains idle`, await page.evaluate(() => !window.__card._editorRuntime.physicalGesture.active));
    await page.mouse.move(p.x + 26, p.y + 20, { steps: 5 });
    await page.waitForFunction(() => !!window.__card._editorRuntime.nodeMove.preview && !window.__card._editorRuntime.nodeMove.invalid);
    assert.deepEqual(server, frozen, 'held preview is never a saved edit');
    await page.mouse.up(); await waitRevision(next);
    check(`${label}: accepted request is node_move`, writes.at(-1)?.type, 'houseplan/wall/node_move');
    const accepted = server.spaces[0].partitions.find(p => p.id === selected.id);
    const old = frozen.spaces[0].partitions.find(p => p.id === selected.id);
    assert.deepEqual(accepted[label === 'A' ? 'b' : 'a'], old[label === 'A' ? 'b' : 'a'], 'opposite endpoint stays fixed');
    await interaction(edge.from, `after saved ${label}: A`);
    await interaction(edge.to, `after saved ${label}: B`);
  }
  const accepted = clone(server);
  let next = revision + 1;
  await page.keyboard.press('Control+z'); await waitRevision(next);
  await interaction(edge.from, 'after Undo');
  next = revision + 1;
  await page.keyboard.press('Control+Shift+z'); await waitRevision(next);
  assert.deepEqual(server, accepted, 'Redo restores the exact accepted Python result');
  await interaction(edge.to, 'after Redo');
  await boot();
  await interaction(edge.from, 'after reload A');
  await interaction(edge.to, 'after reload B');
  check('two moves, Undo and Redo are four node writes', writes.length, 4);
  const reportPath = resolve(process.env.HP_NODE_ORDER_REPORT || 'artifacts/node-projection-roundtrip.json');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({ fixture: backup ? 'owner-backup' : 'synthetic', browser: browser.version(),
    nodeCount: nodes.length, writes: writes.map(w => ({ type: w.type, direction: w.direction })), observations }, null, 2));
} finally { await finish(browser); }
