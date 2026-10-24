// #1045: native contextmenu and the shared history; HA is only the recording
// wire. The server recomputes the narrow intent with the production kernel.
// UI expectations below independently name the surviving geometry and fields.
import assert from 'node:assert/strict';
import { launch, check, finish, requirePinnedBrowser } from './serve.mjs';
import { commitWallSegmentModel } from '../test-build/wall-segment-model.js';
import { applyNodeDelete } from '../test-build/wall-node-delete.js';
import { applyNodeMove, prepareNodeMove, structuralWallNodes } from '../test-build/wall-node-move.js';

requirePinnedBrowser();
const clone = value => structuredClone(value);
const initial = commitWallSegmentModel({ spaces: [
  { id: 'delete-floor', title: 'Delete nodes', cell_cm: 5, view_box: [0, 0, 1, 1],
    // The ordinary camera derives floor bounds from rooms; this untouched
    // envelope keeps every tested partition/node inside the native viewport.
    rooms: [{ id: 'envelope', name: 'Untouched room', area: null,
      poly: [[.05, .05], [.95, .05], [.95, .95], [.05, .95]] }],
    partitions: [
      { id: 'a', a: [.15, .3], b: [.4, .3], cm: 0, future: { label: 'keep', flags: [true, 1] } },
      { id: 'b', a: [.4, .3], b: [.75, .3], cm: 0, future: { flags: [true, 1], label: 'keep' } },
      { id: 't-left', a: [.2, .7], b: [.5, .7], cm: 0 },
      { id: 't-right', a: [.5, .7], b: [.8, .7], cm: 0 },
      { id: 't-up', a: [.5, .7], b: [.5, .5], cm: 0 },
    ], openings: [{ id: 'door', type: 'door', x: .3, y: .3, length: .04, angle: 0,
      flip_h: true, host: { kind: 'partition', id: 'a', t: .6 } }] },
  { id: 'room-floor', title: 'Room corner', cell_cm: 5, view_box: [0, 0, 1, 1],
    rooms: [{ id: 'room', name: 'Room', area: null,
      poly: [[.1, .1], [.9, .1], [.9, .9], [.1, .9]] }] },
], markers: [], settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } }).config;
assert.equal(applyNodeDelete(initial.spaces[0], { point: [.4, .3] }).ok, true, 'straight fixture is deletable');
assert.equal(applyNodeDelete(initial.spaces[1], { point: [.9, .1] }).ok, true, 'room fixture is deletable');
let server = clone(initial), revision = 1, capability = 1, writable = true;
const writes = [], requests = [], held = new Map(), failures = new Map();
const hold = type => {
  let release; const promise = new Promise(resolve => { release = resolve; });
  const gate = { promise, release, arrived: false }; held.set(type, gate); return gate;
};
// Match the existing backend's top-level read projection; capability is outside it.
const projected = message => {
  const config = clone(server);
  if (message.space_id != null) config.spaces = config.spaces.filter(s => s.id === message.space_id);
  if (message.marker_fields?.length) config.markers = config.markers.map(marker => Object.fromEntries(
    Object.entries(marker).filter(([key]) => key === 'id' || message.marker_fields.includes(key))));
  return message.fields?.length ? Object.fromEntries(Object.entries(config).filter(([key]) => message.fields.includes(key))) : config;
};
const { page, browser } = await launch({ width: 1500, height: 1000 });
// Exercise the real wide Properties surface; demo's default host is 780px.
await page.addStyleTag({ content: '#host{width:100%;padding:0;margin:0}' });
await page.exposeFunction('nodeDeleteWire', async message => {
  requests.push(clone(message));
  if (message.type === 'houseplan/config/get') return { config: projected(message), rev: revision,
    can_write: writable, wall_node_move_api: 1, ...(capability == null ? {} : { wall_node_delete_api: capability }) };
  if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
  if (!['houseplan/config/set', 'houseplan/wall/node_delete', 'houseplan/wall/node_move'].includes(message.type)) return null;
  const gate = held.get(message.type);
  if (gate) { gate.arrived = true; await gate.promise; held.delete(message.type); }
  writes.push(clone(message));
  const error = failures.get(message.type); failures.delete(message.type);
  if (error) return { __error: { code: error, message: error } };
  if (!writable) return { __error: { code: 'unauthorized', message: 'unauthorized' } };
  if (message.expected_rev !== revision) return { __error: { code: 'conflict', message: 'conflict' } };
  if (message.type === 'houseplan/config/set') { server = clone(message.config); return { ok: true, rev: ++revision }; }
  assert.equal('config' in message, false); assert.equal('candidate' in message, false);
  const index = server.spaces.findIndex(space => space.id === message.space_id);
  const source = message.direction === 'undo' ? message.before_space : server.spaces[index];
  let result;
  if (message.type.endsWith('node_delete')) result = applyNodeDelete(source, message.intent);
  else {
    const nodes = structuralWallNodes(source), node = nodes.find(n => n.point.every((v, i) => v === message.intent.point[i]));
    result = applyNodeMove(prepareNodeMove(source, node, nodes, message.intent.split_ids), message.intent.target, message.intent.axis);
  }
  assert.equal(result.ok, true);
  if (message.direction === 'undo') {
    const forward = commitWallSegmentModel({ ...server, spaces: [result.space] }).config.spaces[0];
    assert.deepEqual(forward, server.spaces[index], 'exact inverse proof at the wire');
  }
  const spaces = [...server.spaces]; spaces[index] = message.direction === 'undo' ? clone(source) : result.space;
  server = commitWallSegmentModel({ ...server, spaces }).config;
  return { ok: true, config: clone(server), rev: ++revision };
});
const boot = async (options = {}, editor = true) => {
  await page.evaluate(async options => {
    const previous = window.__card, hass = window.__mkHass(), base = hass.callWS.bind(hass);
    const connection = hass.connection, listeners = new Set();
    hass.connection = { ...connection, connected: true, subscribeEvents: async (callback, type) => {
      if (type !== 'houseplan_config_updated') return connection.subscribeEvents(callback, type);
      listeners.add(callback); return () => listeners.delete(callback);
    } };
    window.__nodeServerConfigEvent = rev => { for (const callback of listeners) callback({ event_type: 'houseplan_config_updated', data: { rev } }); };
    hass.devices = {}; hass.entities = {}; hass.states = {};
    hass.callWS = async message => {
      if (message.type.endsWith('registry/list')) return [];
      const result = await window.nodeDeleteWire(message);
      if (result?.__error) throw result.__error;
      return result ?? base(message);
    };
    const card = document.createElement('houseplan-card');
    window.__nodeDeleteOptions = { type: 'custom:houseplan-card', title: 'Delete nodes', language: 'en', ...options };
    card.setConfig(window.__nodeDeleteOptions); previous.remove();
    document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
  }, options);
  await page.waitForFunction(() => !window.__card._booting && window.__card._model?.some(space => space.id === 'delete-floor'));
  if (!editor) return;
  await page.evaluate(async () => {
    if (window.__card._space !== 'delete-floor') await window.__hpTest.switchSpace('delete-floor');
    await window.__hpTest.setMode('plan'); await window.__hpTest.setTool('select');
  });
  await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.hp-node-handle'));
};
const card = page.locator('houseplan-card'), menu = card.locator('[data-hp="node-context-menu"]:not([inert])');
const action = () => menu.locator('[data-action="node-delete"]');
const screen = p => page.evaluate(p => {
  const svg = window.__card.renderRoot.querySelector('svg.plan-svg'), q = svg.createSVGPoint();
  q.x = p[0] * 1000; q.y = p[1] * 1000;
  const out = q.matrixTransform(svg.getScreenCTM()); return { x: out.x, y: out.y };
}, p);
const rightClick = async p => {
  const q = await screen(p), viewport = page.viewportSize();
  assert.ok(q.x >= 0 && q.x < viewport.width && q.y >= 0 && q.y < viewport.height,
    `native node target ${p} is inside the viewport: ${JSON.stringify(q)}`);
  await page.mouse.click(q.x, q.y, { button: 'right' });
};
const open = async p => { await rightClick(p); await action().waitFor(); };
const settled = () => page.evaluate(() => window.__hpTest.settled());
const state = () => page.evaluate(() => ({ config: structuredClone(window.__card._serverCfg), rev: window.__card._cfgRev,
  history: window.__card._geometryHistory.size, undo: window.__card._geometryHistory.undoName,
  pan: !!window.__card._panStart, dragging: window.__card._editorRuntime.nodeMove?.dragging ?? false,
  view: { ...window.__card._view }, zoom: window.__card._zoom }));
const noMenu = () => page.waitForFunction(() => ![...window.__card.renderRoot.querySelectorAll('[data-hp="node-context-menu"]')]
  .some(node => !node.closest('[inert],[aria-hidden="true"]')));
const deleteWrites = () => writes.filter(message => message.type === 'houseplan/wall/node_delete');
const handles = () => card.locator('.hp-node-handle').evaluateAll(nodes => nodes.map(node => [Number(node.getAttribute('cx')), Number(node.getAttribute('cy'))]));
const reset = async () => { server = clone(initial); revision++; capability = 1; writable = true; writes.length = 0; requests.length = 0; await boot(); };
const captureButton = () => action().evaluate(node => { window.__retainedNodeDeleteButton = node; });
const invokeRetained = () => page.evaluate(() => window.__retainedNodeDeleteButton?.click());
const emit = async () => {
  await page.evaluate(rev => window.__nodeServerConfigEvent(rev), revision);
  await page.waitForFunction(rev => window.__card._cfgRev === rev, revision); await settled();
};

try {
  await boot();
  const before = await state(), original = clone(server);
  const door = card.locator('[data-hp="opening"][data-id="door"]'), doorBefore = await door.boundingBox();
  assert.ok(doorBefore, 'the hosted opening is actually painted');
  await open([.4, .3]);
  check('delete.rightclick.no_geometry_or_history', [(await state()).config, (await state()).history, writes.length], [original, 0, 0]);
  check('delete.rightclick.no_pan_or_capture', [(await state()).pan, (await state()).dragging], [false, false]);
  check('delete.straight.enabled', await action().isEnabled());
  const q = await screen([.55, .4]); await page.mouse.move(q.x, q.y);
  check('delete.rightclick.released_pointer_cannot_pan', [(await state()).view, (await state()).zoom], [before.view, before.zoom]);
  await action().click(); await settled();
  const expected = clone(original), floor = expected.spaces[0];
  floor.partitions = floor.partitions.filter(wall => wall.id !== 'b').map(wall => wall.id === 'a' ? { ...wall, b: [.75, .3] } : wall);
  floor.openings[0].host = { kind: 'partition', id: 'a', t: .25 };
  const canonicalExpected = commitWallSegmentModel(expected).config;
  check('delete.straight.exact_delta_and_foreign_fields', server, canonicalExpected);
  check('delete.straight.one_command', [deleteWrites().length, (await state()).history], [1, 1]);
  check('delete.straight.original_point_intent', deleteWrites()[0].intent, { point: [.4, .3] });
  check('delete.straight.no_B_handle', (await handles()).some(p => p[0] === 400 && p[1] === 300), false);
  check('delete.straight.exact_A_C_handles', (await handles()).filter(p => p[1] === 300).sort((a, b) => a[0] - b[0]), [[150, 300], [750, 300]]);
  const doorAfter = await door.boundingBox();
  check('delete.straight.painted_opening_stays_literal', doorAfter && ['x', 'y', 'width', 'height'].every(key => Math.abs(doorAfter[key] - doorBefore[key]) < .5));
  check('delete.straight.no_old_wall_fragment', await card.locator('[data-hp="partition"][data-id="b"]').count(), 0);
  const retainedWall = await card.locator('[data-hp="partition"][data-id="a"]').first().boundingBox();
  const hitStroke = await card.locator('[data-hp="partition"][data-id="a"]').first()
    .evaluate(node => parseFloat(getComputedStyle(node).strokeWidth));
  const endpointA = await screen([.15, .3]), endpointC = await screen([.75, .3]);
  // The input line has round 24px non-scaling caps, included in its client box.
  check('delete.straight.A_C_hit_span', retainedWall
    && Math.abs(retainedWall.width - Math.abs(endpointC.x - endpointA.x) - hitStroke) < 1
    && Math.abs(retainedWall.x + hitStroke / 2 - endpointA.x) < 1);
  const paintedSpan = await card.locator('.zero-walls .zero-wall').evaluateAll(nodes => nodes
    .filter(node => Number(node.getAttribute('y1')) === 300 && Number(node.getAttribute('y2')) === 300)
    .map(node => ({ ends: ['x1', 'y1', 'x2', 'y2'].map(key => Number(node.getAttribute(key))),
      visible: getComputedStyle(node).stroke !== 'none' && parseFloat(getComputedStyle(node).strokeWidth) > 0
        && Number(getComputedStyle(node).opacity) > 0 })));
  check('delete.straight.painted_A_C_span_without_B_fragment', paintedSpan, [{ ends: [150, 300, 750, 300], visible: true }]);
  await page.keyboard.press('Control+z'); await settled();
  check('delete.undo.exact_entire_config', server, original);
  check('delete.undo.restores_B', (await handles()).some(p => p[0] === 400 && p[1] === 300));
  await page.keyboard.press('Control+Shift+z'); await settled();
  check('delete.redo.exact_entire_config_and_IDs', server, canonicalExpected);
  check('delete.redo.one_shared_step', [(await state()).history, deleteWrites().map(m => m.direction)], [1, ['apply', 'undo', 'apply']]);
  await boot();
  check('delete.reload.exact_accepted_geometry', (await state()).config, canonicalExpected);
  check('delete.reload.no_transient_menu', await menu.count(), 0);

  // Public DOM compatibility input, with no product-state writes: a stale
  // MouseEvent contextmenu (no pointerType) after two contacts stays inert.
  const touchBaseline = await state(), touchWriteCount = writes.length, touchPoint = await screen([.5, .7]);
  const compatibilityPrevented = await page.evaluate(p => {
    const svg = window.__card.renderRoot.querySelector('svg.plan-svg');
    for (const [type, id] of [['pointerdown', 81], ['pointerdown', 82], ['pointerup', 82], ['pointerup', 81]]) {
      svg.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 81,
        clientX: p.x, clientY: p.y, bubbles: true, composed: true, cancelable: true }));
    }
    const event = new MouseEvent('contextmenu', { clientX: p.x, clientY: p.y, button: 2,
      bubbles: true, composed: true, cancelable: true });
    svg.dispatchEvent(event); return event.defaultPrevented;
  }, touchPoint);
  await settled();
  check('delete.touch_compatibility_contextmenu.blocked', compatibilityPrevented);
  check('delete.touch_compatibility_contextmenu.no_menu_write_or_history',
    [await menu.count(), writes.length, (await state()).history], [0, touchWriteCount, touchBaseline.history]);

  // Disabled degree and old-backend paths use the actual menu, never a private command call.
  const disabledBefore = await state(), countBefore = writes.length;
  await open([.5, .7]);
  check('delete.T_junction.disabled', await action().isDisabled());
  check('delete.T_junction.reason', /two walls/i.test(await menu.innerText()));
  await page.keyboard.press('Escape'); await noMenu();
  check('delete.disabled.no_write_or_history', [server, revision, writes.length, (await state()).history],
    [disabledBefore.config, disabledBefore.rev, countBefore, disabledBefore.history]);
  await reset(); capability = null; await boot(); await open([.4, .3]);
  check('delete.old_backend.disabled', await action().isDisabled());
  check('delete.old_backend.update_reason', /update.*integration/i.test(await menu.innerText()));
  await page.keyboard.press('Escape'); await noMenu();

  for (const cause of ['thickness', 'opening']) {
    await reset();
    if (cause === 'thickness') server.spaces[0].partitions.find(wall => wall.id === 'b').cm = 20;
    else server.spaces[0].partitions.find(wall => wall.id === 'b').b[1] = .4;
    server = commitWallSegmentModel(server).config; revision++; await boot();
    const baseline = clone(server), savedRev = revision;
    await open([.4, .3]); check(`delete.${cause}.disabled`, await action().isDisabled());
    check(`delete.${cause}.reason`, (cause === 'opening' ? /opening/i : /safely connect/i).test(await menu.innerText()));
    await page.keyboard.press('Escape'); await noMenu();
    check(`delete.${cause}.no_partial_write`, [server, revision, writes.length, (await state()).history], [baseline, savedRev, 0, 0]);
  }

  // Retained presentation and later callbacks have no command authority.
  for (const cancel of ['Escape', 'outside', 'mode', 'space', 'revision', 'permission', 'connection', 'detach']) {
    await reset(); await open([.4, .3]); await captureButton();
    const baseline = clone(server), requestCount = deleteWrites().length;
    if (cancel === 'Escape') await page.keyboard.press('Escape');
    else if (cancel === 'outside') { const p = await screen([.85, .85]); await page.mouse.click(p.x, p.y); }
    else if (cancel === 'mode') await page.evaluate(() => window.__hpTest.setMode('decor'));
    else if (cancel === 'space') await page.evaluate(() => window.__hpTest.switchSpace('room-floor'));
    else if (cancel === 'revision' || cancel === 'permission') {
      if (cancel === 'revision') server.spaces[1].title = 'Changed by another client'; else writable = false;
      revision++; await emit();
    } else if (cancel === 'connection') await page.evaluate(() => {
      const card = window.__card; card.hass.connection.connected = false; card.hass = { ...card.hass };
    });
    else await page.evaluate(async () => { window.__card.remove(); await window.__card.updateComplete; });
    if (cancel !== 'detach') await noMenu();
    await invokeRetained(); await settled();
    check(`delete.retired_${cancel}.no_request_or_history`, [deleteWrites().length, (await state()).history], [requestCount, 0]);
    check(`delete.retired_${cancel}.no_geometry_change`, server.spaces[0], baseline.spaces[0]);
  }

  await reset();
  const onceGate = hold('houseplan/wall/node_delete');
  await open([.4, .3]); await captureButton(); await action().click();
  for (let turn = 0; !onceGate.arrived && turn < 100; turn++) await page.waitForTimeout(10);
  assert.equal(onceGate.arrived, true, 'native command reached the held wire');
  await invokeRetained(); await settled();
  check('delete.inflight.one_request', requests.filter(m => m.type.endsWith('/node_delete')).length, 1);
  check('delete.inflight.no_optimistic_adoption_or_history', [(await state()).config, (await state()).history], [initial, 0]);
  onceGate.release();
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 1);
  check('delete.accepted.exactly_one_step', [(await state()).history, deleteWrites().length], [1, 1]);

  await reset(); failures.set('houseplan/wall/node_delete', 'node_delete_unsafe');
  await open([.4, .3]); await action().click();
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy); await settled();
  check('delete.server_refusal.no_partial_change', [server, (await state()).config, (await state()).history], [initial, initial, 0]);
  check('delete.server_refusal.operation_copy', /safely connect/i.test(await card.locator('[data-hp="toast"]').innerText()));

  await reset();
  await open([.4, .3]); await page.keyboard.press('Escape'); await noMenu();
  const dragA = await screen([.15, .3]), dragB = await screen([.18, .4]);
  await page.mouse.move(dragA.x, dragA.y); await page.mouse.down();
  await page.mouse.move(dragB.x, dragB.y, { steps: 6 }); await page.mouse.up();
  await page.waitForFunction(() => !window.__card._editorRuntime.nodeMove.busy && window.__card._geometryHistory.size === 1);
  check('delete.close.next_native_move_works', writes.map(message => message.type), ['houseplan/wall/node_move']);
  check('delete.close.next_move_changes_only_A', server.spaces[0].partitions.find(wall => wall.id === 'a').a[1] > .3);

  // Invalid Properties is a real field input; completion may not replay a late menu.
  await reset();
  const wallPoint = await screen([.22, .3]); await page.mouse.click(wallPoint.x, wallPoint.y);
  const panel = card.locator('[data-hp="properties-panel"]'), thickness = panel.locator('[data-property="cm"] input');
  await thickness.fill('101'); await thickness.press('Enter');
  check('delete.invalid_field.visible_error', await panel.locator('[role="alert"]').count(), 1);
  const invalidBefore = await state(); await rightClick([.4, .3]); await settled();
  check('delete.invalid_field.no_menu_or_delete', [await menu.count(), deleteWrites().length], [0, 0]);
  check('delete.invalid_field.exact_config_history', [(await state()).config, (await state()).history], [invalidBefore.config, invalidBefore.history]);
  await thickness.press('Escape'); await settled();
  check('delete.invalid_field.no_late_replay', [await menu.count(), deleteWrites().length], [0, 0]);

  // A valid field's own queued Save must finish; an outside intent retires the pending open.
  await reset();
  const fieldPoint = await screen([.22, .3]); await page.mouse.click(fieldPoint.x, fieldPoint.y);
  const fieldGate = hold('houseplan/config/set'); await thickness.fill('10'); await rightClick([.4, .3]);
  for (let turn = 0; !fieldGate.arrived && turn < 250; turn++) await page.waitForTimeout(10);
  assert.equal(fieldGate.arrived, true, 'ordinary field completion reached its own writer');
  const outsidePending = await screen([.85, .85]); await page.mouse.click(outsidePending.x, outsidePending.y);
  fieldGate.release(); await page.evaluate(() => window.__hpTest.waitForWrites()); await settled();
  check('delete.pending_field_open.retired_by_outside', [await menu.count(), deleteWrites().length], [0, 0]);
  check('delete.pending_field_open.preserves_the_own_save', server.spaces[0].partitions.find(wall => wall.id === 'a').cm, 10);

  for (const surface of ['view', 'kiosk', 'readonly', 'devices']) {
    server = clone(initial); revision++; writes.length = 0; writable = surface !== 'readonly';
    await boot(surface === 'kiosk' ? { kiosk: true } : {}, surface === 'devices');
    if (surface === 'devices') await page.evaluate(() => window.__hpTest.setMode('devices'));
    else await page.evaluate(() => window.__hpTest.setMode('view'));
    await rightClick([.4, .3]); await settled();
    check(`delete.${surface}.inert`, [await menu.count(), deleteWrites().length, server], [0, 0, initial]);
  }

  writable = true; await reset(); await page.setViewportSize({ width: 390, height: 900 });
  await card.locator('[data-hp="zoom-fit"]').click();
  for (const dark of [false, true]) {
    await page.evaluate(async dark => { const card = window.__card;
      card.hass = { ...card.hass, themes: { ...card.hass.themes, darkMode: dark } }; await card.updateComplete;
    }, dark);
    await open([.5, .7]); const box = await menu.boundingBox();
    check(`delete.narrow_${dark ? 'dark' : 'light'}.viewport`, box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 900);
    check(`delete.narrow_${dark ? 'dark' : 'light'}.disabled_reason_visible`, /two walls/i.test(await menu.innerText()));
    await page.keyboard.press('Escape'); await noMenu();
  }
  await page.setViewportSize({ width: 1500, height: 1000 });

  // Safe room-corner fixture: the physical A/C endpoints and all other owners stay literal.
  await reset();
  await page.evaluate(async () => { await window.__hpTest.switchSpace('room-floor'); await window.__hpTest.setTool('select'); });
  const roomBefore = clone(server), roomSource = clone(server.spaces[1]);
  await open([.9, .1]); check('delete.room_corner.enabled', await action().isEnabled());
  await action().click(); await settled();
  check('delete.room_corner.exact_poly', server.spaces[1].rooms[0].poly, [[.1, .1], [.9, .9], [.1, .9]]);
  check('delete.room_corner.other_floor_literal', server.spaces[0], roomBefore.spaces[0]);
  check('delete.room_corner.no_B_handle', (await handles()).some(p => p[0] === 900 && p[1] === 100), false);
  await page.keyboard.press('Control+z'); await settled();
  check('delete.room_corner.undo_exact', server.spaces[1], roomSource);
  await finish(browser);
} finally {
  for (const gate of held.values()) gate.release();
  await browser.close();
}
