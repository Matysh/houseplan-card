/** #1167: native Draw/Resize graph regression. Synthetic config/get + config/set
 * is a recording boundary, not a Home Assistant server or backend validation proof.
 * Every edit below uses the rendered controls and native Playwright input. */
import assert from 'node:assert/strict';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { projectGraphSpace, validateGraph, verifyGraphProjection } from '../test-build/plan-graph.js';

requirePinnedBrowser();
const clone = value => structuredClone(value);
const settings = { filter_seeded: true, known_devices: [], new_device_ids: [] };
const floor = id => ({ id, title: id, cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [], partitions: [], wall_segments: [] });
const legacy = { model_version: 10, spaces: [floor('draw-floor')], markers: [], settings };
const node = (id, x, y) => ({ id, p: ['l', String(x), String(y)] });
const edge = (id, from, to) => ({ kind: 'wall', id, from, to, cm: 15 });
const ref = (id, reverse = false) => ({ kind: 'wall', id, reverse });
const graph = { version: 1, nodes: [
  node('a', 24, 24), node('b', 96, 24), node('c', 96, 96), node('d', 24, 96),
  node('e', 168, 24), node('f', 168, 96),
  node('g', 204, 24), node('h', 228, 24), node('i', 228, 96), node('j', 204, 96),
], edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('cd', 'c', 'd'), edge('da', 'd', 'a'),
  edge('be', 'b', 'e'), edge('ef', 'e', 'f'), edge('fc', 'f', 'c'),
  edge('gh', 'g', 'h'), edge('hi', 'h', 'i'), edge('ij', 'i', 'j'), edge('jg', 'j', 'g')],
rooms: [
  { room: 'left', edges: ['ab', 'bc', 'cd', 'da'].map(id => ref(id)) },
  { room: 'right', edges: [ref('be'), ref('ef'), ref('fc'), ref('bc', true)] },
  { room: 'untouched', edges: ['gh', 'hi', 'ij', 'jg'].map(id => ref(id)) },
], dependencies: [] };
// Start current fixtures in canonical order so array ordering is also a meaningful invariant.
graph.edges.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const current = { model_version: 11, spaces: [projectGraphSpace({ ...floor('resize-floor'),
  extension: { preserve: ['space', 1] },
  rooms: ['left', 'right', 'untouched'].map(id => ({ id, name: id, area: null, extension: { preserve: id } })),
}, graph).space, projectGraphSpace(floor('other-floor'), {
  version: 1, nodes: [], edges: [], rooms: [], dependencies: [],
}).space], markers: [], settings, extension: { preserve: ['config', true] } };

const assertCurrent = config => {
  assert.equal(config.model_version, 11, 'every structural write promotes/stays current11');
  for (const space of config.spaces) {
    assert.equal(validateGraph(space.plan_graph).ok, true, `valid graph ${space.id}`);
    verifyGraphProjection(space, space.plan_graph);
  }
};
assertCurrent(current);
let server = clone(legacy), revision = 1;
const writes = [];
const { page, browser } = await launch({ width: 1440, height: 1040 });
await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
await page.exposeFunction('planGraphEditorWire', async message => {
  if (message.type === 'houseplan/config/get') {
    let config = clone(server);
    if (message.space_id != null) config.spaces = config.spaces.filter(s => s.id === message.space_id);
    if (message.fields?.length) config = Object.fromEntries(Object.entries(config).filter(([key]) => message.fields.includes(key)));
    return { config, rev: revision, can_write: true, plan_graph_api: 1, wall_node_move_api: 1, wall_node_delete_api: 1 };
  }
  if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (message.type === 'houseplan/config/set') {
    assert.equal(message.expected_rev, revision, 'native writer uses accepted CAS revision');
    assertCurrent(message.config); // Observe and reject: never repair the writer's result.
    server = clone(message.config); writes.push(clone(message));
    return { ok: true, rev: ++revision, config: clone(server) };
  }
  if (/^houseplan\/.*\/(set|update|node_move|node_delete|optimize|copy|history)$/.test(message.type)) {
    throw new Error(`unexpected write in bounded Draw/Resize smoke: ${message.type}`);
  }
  return null;
});
const settle = () => page.evaluate(() => window.__hpTest.settled());
const idle = async () => {
  await settle();
  await page.evaluate(() => window.__hpTest.waitForWrites({ timeoutMs: 10000 }));
};
const boot = async (config, tool) => {
  server = clone(config); revision++; writes.length = 0;
  await page.evaluate(async () => {
    const previous = window.__card, hass = window.__mkHass(), base = hass.callWS.bind(hass);
    hass.devices = {}; hass.entities = {}; hass.states = {};
    hass.callWS = async message => {
      if (message.type.endsWith('registry/list')) return [];
      const result = await window.planGraphEditorWire(message);
      return result ?? base(message);
    };
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', title: 'Synthetic graph editor', language: 'en' });
    previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
  });
  await page.waitForFunction(id => window.__card?._booting === false && window.__card._space === id, config.spaces[0].id);
  await page.evaluate(async tool => { await window.__hpTest.setMode('plan'); await window.__hpTest.setTool(tool); }, tool);
  await page.waitForFunction(() => !window.__card._modeTransitionBusy);
  await settle();
};
const state = () => page.evaluate(() => ({ config: structuredClone(window.__card._serverCfg),
  space: structuredClone(window.__card._curSpaceCfg), path: structuredClone(window.__card._path),
  tool: window.__card._tool })) ;
const nativePoint = async (x, y) => {
  const point = await page.evaluate(([x, y]) => {
    const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), p = svg.createSVGPoint();
    p.x = x; p.y = y; const s = p.matrixTransform(svg.getScreenCTM()), r = svg.getBoundingClientRect();
    const stage = svg.closest('.stage').getBoundingClientRect();
    const within = r => s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom;
    const hit = window.__card.renderRoot.elementFromPoint(s.x, s.y);
    return { x: s.x, y: s.y, inside: within(r) && within(stage),
      unobscured: !!hit && svg.contains(hit)
        && !hit.closest('button,input,select,textarea,[contenteditable="true"],.drawwall,[role="dialog"]'),
      hit: hit ? `${hit.localName}.${hit.getAttribute('class') || ''}` : null };
  }, [x, y]);
  const viewport = page.viewportSize();
  assert.ok(point.inside && point.x >= 0 && point.x < viewport.width && point.y >= 0 && point.y < viewport.height,
    `native plan target must be on stage: ${JSON.stringify(point)}`);
  assert.ok(point.unobscured, `native plan target must hit unobscured SVG: ${JSON.stringify(point)}`);
  return point;
};
const draw = async (x, y) => {
  const p = await nativePoint(x, y); await page.mouse.click(p.x, p.y); await settle();
};
const history = async key => { await page.keyboard.press(key); await idle(); };
const sortedIds = space => ({ nodes: space.plan_graph.nodes.map(n => n.id).sort(),
  edges: space.plan_graph.edges.map(e => `${e.kind}:${e.id}`).sort() });

const drawFromKnownCarrier = async currentModel => {
  const raw = { ...floor('known-carrier'), partitions: [
    { id: 'source', a: [.2, .6], b: [.8, .6], cm: 15, extension: { keep: 'carrier' } },
  ] };
  const sourceGraph = { version: 1,
    nodes: [node('source-left', 48, 144), node('source-right', 192, 144)],
    edges: [{ kind: 'partition', id: 'source', from: 'source-left', to: 'source-right', cm: 15,
      props: { extension: { keep: 'carrier' } } }], rooms: [], dependencies: [] };
  const config = { model_version: currentModel ? 11 : 10,
    spaces: [currentModel ? projectGraphSpace(raw, sourceGraph).space : raw], markers: [], settings };
  const label = currentModel ? 'current' : 'legacy';
  await boot(config, 'draw');
  const field = page.locator('houseplan-card .drawwall input');
  await field.fill('15'); await field.press('Tab');
  // The floating Draw panel lives inside stage; SVG bounds alone accept its
  // input as a canvas target. Prove nativePoint rejects the actual overlay.
  const occluded = await field.evaluate(input => {
    const svg = input.getRootNode().querySelector('svg.plan-svg'), r = input.getBoundingClientRect();
    const p = svg.createSVGPoint(); p.x = r.left + r.width / 2; p.y = r.top + r.height / 2;
    const world = p.matrixTransform(svg.getScreenCTM().inverse());
    return [world.x, world.y];
  });
  await assert.rejects(() => nativePoint(...occluded), /must hit unobscured SVG/);
  check(`${label} native target rejects the visible Draw overlay`, true);
  // Keep the original world segments and expose them using the public camera
  // control: at the fitted zoom the legacy second point is behind Draw's hint.
  await page.locator('houseplan-card [data-hp="zoom-out"]').click();
  await page.waitForFunction(() => !window.__card._cameraTransition?.active && !window.__card._modeTransitionBusy);
  await settle();
  // Current first targets a known endpoint; legacy first targets the interior
  // (which requires a pending split before the first accepted candidate).
  const firstX = currentModel ? 200 : 500;
  await draw(firstX, 600); await draw(firstX, 400); await idle();
  const firstGraph = (await state()).space.plan_graph;
  const at = (g, x, y) => g.nodes.filter(n => JSON.stringify(n.p) === JSON.stringify(['l', String(x), String(y)]));
  const incident = (g, id) => g.edges.filter(e => e.from === id || e.to === id);
  const firstAnchor = at(firstGraph, currentModel ? 48 : 120, 144);
  assert.equal(firstAnchor.length, 1, `${label} first start is one shared graph node`);
  check(`graph.draw.${label}.first_known_anchor_incidence`, incident(firstGraph, firstAnchor[0].id).length, currentModel ? 2 : 3);
  if (currentModel) check('graph.draw.current.first_endpoint_keeps_id', firstAnchor[0].id, 'source-left');
  const originalEnds = [at(firstGraph, 48, 144)[0], at(firstGraph, 192, 144)[0]];
  assert.ok(originalEnds.every(Boolean));

  await history('Control+z'); await history('Control+z');
  check(`graph.draw.${label}.undo_to_empty_path`, (await state()).path.length, 0);
  // Re-enter the original carrier's interior after the active path is empty:
  // a stale pending split/baseline must not orphan the new branch or duplicate T.
  await draw(500, 600); await draw(650, 400); await idle();
  const next = (await state()).space, g = next.plan_graph;
  assert.equal(validateGraph(g).ok, true); verifyGraphProjection(next, g);
  const anchor = at(g, 120, 144);
  assert.equal(anchor.length, 1, `${label} restarted T has one node`);
  check(`graph.draw.${label}.restart_interior_T_degree`, incident(g, anchor[0].id).length, 3);
  check(`graph.draw.${label}.restart_has_two_carrier_children_and_one_branch`, [g.nodes.length, g.edges.length], [4, 3]);
  check(`graph.draw.${label}.restart_keeps_source_endpoint_ids`, originalEnds.every(n =>
    g.nodes.some(nextNode => nextNode.id === n.id && JSON.stringify(nextNode.p) === JSON.stringify(n.p))));
  check(`graph.draw.${label}.undo_drops_previous_branch_tip`, at(g, currentModel ? 48 : 120, 96).length, 0);
  check(`graph.draw.${label}.restart_target_is_connected`, at(g, 156, 96).length === 1 &&
    incident(g, anchor[0].id).some(e => e.from === at(g, 156, 96)[0].id || e.to === at(g, 156, 96)[0].id));
  check(`graph.draw.${label}.source_properties_survive_split`, g.edges.filter(e =>
    e.props?.extension?.keep === 'carrier').length, 2);
  await page.keyboard.press('Escape'); await idle();
  assertCurrent(server);
};


try {
  await boot(legacy, 'draw');
  const thickness = page.locator('houseplan-card .drawwall input');
  await thickness.fill('15'); await thickness.press('Tab');
  await draw(300, 300); await draw(500, 300);
  const first = (await state()).space;
  assert.equal(validateGraph(first.plan_graph).ok, true);
  check('graph.draw.first_segment_promotes_legacy', [first.plan_graph.nodes.length, first.plan_graph.edges.length], [2, 1]);
  await draw(500, 500);
  const second = (await state()).space;
  check('graph.draw.second_segment_reuses_shared_node', [second.plan_graph.nodes.length, second.plan_graph.edges.length], [3, 2]);
  check('graph.draw.second_segment_keeps_existing_nodes', first.plan_graph.nodes.every(n =>
    second.plan_graph.nodes.some(other => JSON.stringify(other) === JSON.stringify(n))));
  await history('Control+z');
  check('graph.draw.active_undo_exact_graph', (await state()).space.plan_graph, first.plan_graph);
  await history('Control+Shift+z');
  check('graph.draw.active_redo_exact_graph', (await state()).space.plan_graph, second.plan_graph);
  await draw(300, 500); await draw(300, 300);
  const dialog = page.locator('houseplan-card [data-kind="room"]:not([inert])');
  await dialog.locator('[data-hp="field"][data-field="room-name"]').fill('Synthetic closed face');
  await dialog.locator('.room-save[data-hp="dialog-confirm"]').click();
  await dialog.waitFor({ state: 'detached' }); await idle();
  const closed = clone(server), closedSpace = closed.spaces[0];
  assertCurrent(closed);
  check('graph.draw.closed_face_has_four_shared_nodes', [closedSpace.rooms.length,
    closedSpace.plan_graph.nodes.length, closedSpace.plan_graph.rooms[0].edges.length], [1, 4, 4]);
  const cycle = closedSpace.plan_graph.rooms[0], edges = closedSpace.plan_graph.edges;
  check('graph.draw.closed_face_reuses_known_node_ids', second.plan_graph.nodes.every(n =>
    closedSpace.plan_graph.nodes.some(other => other.id === n.id && JSON.stringify(other.p) === JSON.stringify(n.p))));
  check('graph.draw.face_cycle_has_shared_endpoint_ids', cycle.edges.every((r, i) => {
    const a = edges.find(e => e.kind === r.kind && e.id === r.id), next = cycle.edges[(i + 1) % cycle.edges.length];
    const b = edges.find(e => e.kind === next.kind && e.id === next.id);
    return (r.reverse ? a.from : a.to) === (next.reverse ? b.to : b.from);
  }));
  check('graph.draw.accepted_config_is_displayed', (await state()).config, closed);
  await history('Control+z');
  check('graph.draw.closed_face_undo_removes_room', server.spaces[0].rooms.length, 0);
  await history('Control+Shift+z');
  check('graph.draw.closed_face_redo_exact_config', server, closed);

  await boot(current, 'resize');
  const before = clone(server), writeCount = writes.length;
  const drag = async cancel => {
    const handle = page.locator('houseplan-card [data-hp="room-resize"][data-room="left"][data-edge="1"][aria-disabled="false"]');
    await handle.waitFor(); await settle();
    const box = await handle.boundingBox(); assert.ok(box);
    const location = await handle.evaluate(h => [Number(h.getAttribute('cx')), Number(h.getAttribute('cy'))]);
    assert.equal(location[0], 400, 'fixture selects the shared right wall');
    const target = await nativePoint(450, location[1]);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 8 }); await settle();
    assert.deepEqual(server, before, 'Resize preview does not write before release');
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up(); await idle();
  };
  await drag(true);
  check('graph.resize.cancel_preserves_exact_config', server, before);
  check('graph.resize.cancel_sends_no_write', writes.length, writeCount);
  check('graph.resize.cancel_restores_displayed_graph', (await state()).space.plan_graph, graph);
  await drag(false);
  const resized = clone(server), resizedSpace = resized.spaces[0];
  assertCurrent(resized);
  check('graph.resize.commit_writes', writes.length > writeCount);
  check('graph.resize.commit_keeps_all_node_and_edge_ids', sortedIds(resizedSpace), sortedIds(before.spaces[0]));
  check('graph.resize.shared_endpoints_move_to_target_lattice', ['b', 'c'].map(id =>
    resizedSpace.plan_graph.nodes.find(n => n.id === id).p), [['l', '108', '24'], ['l', '108', '96']]);
  check('graph.resize.unrelated_nodes_unchanged', resizedSpace.plan_graph.nodes.filter(n => !['b', 'c'].includes(n.id)),
    graph.nodes.filter(n => !['b', 'c'].includes(n.id)));
  // Content equality includes every field and array position, not object insertion order.
  assert.deepEqual([resizedSpace.plan_graph.edges, resizedSpace.plan_graph.rooms], [graph.edges, graph.rooms]);
  check('graph.resize.edges_and_cycles_unchanged', true);
  check('graph.resize.untouched_neighbor_exact', resizedSpace.rooms.find(r => r.id === 'untouched'), before.spaces[0].rooms.find(r => r.id === 'untouched'));
  check('graph.resize.untouched_floor_exact', resized.spaces[1], before.spaces[1]);
  check('graph.resize.unknown_metadata_exact', [resized.extension, resizedSpace.extension], [before.extension, before.spaces[0].extension]);
  check('graph.resize.accepted_config_is_displayed', (await state()).config, resized);
  await history('Control+z');
  check('graph.resize.undo_exact_config', server, before);
  await history('Control+Shift+z');
  check('graph.resize.redo_exact_config', server, resized);
  check('graph.resize.redo_accepted_graph_is_displayed', (await state()).space.plan_graph, resizedSpace.plan_graph);
  await drawFromKnownCarrier(false);
  await drawFromKnownCarrier(true);
  console.log(JSON.stringify({ scope: 'native-browser synthetic wire boundary (not real HA)', writes: writes.length,
    draw: { nodes: closedSpace.plan_graph.nodes.length, edges: closedSpace.plan_graph.edges.length },
    resize: { ids: sortedIds(resizedSpace), revision } }));
} catch (error) {
  console.error('graph.editor.native.failure', error.stack || error);
  console.error('graph.editor.native.state', JSON.stringify({ state: await state().catch(() => null), server, writes: writes.length }));
  process.exitCode = 1;
} finally {
  await finish(browser);
}
