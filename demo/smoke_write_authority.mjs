/** #1220: native create/draw over a recording transport. This is not HA durability proof. */
import assert from 'node:assert/strict';
import { launch, checkAll, finish } from './serve.mjs';
import { projectGraphSpace, verifyGraphProjection } from '../test-build/plan-graph.js';

const empty = id => projectGraphSpace({ id, title: id, cell_cm: 5, view_box: [0, 0, 1, 1], rooms: [] },
  { version: 1, nodes: [], edges: [], rooms: [], dependencies: [] }).space;
let server = { model_version: 11, spaces: [empty('initial')], markers: [],
  settings: { filter_seeded: true, known_devices: [], new_device_ids: [] } };
let revision = 1;
const writes = [];
const { page, browser } = await launch({ width: 1280, height: 900 });
page.setDefaultTimeout(12000);
const host = page.locator('houseplan-card'), out = {};
try {
  await page.exposeFunction('writeAuthorityWire', message => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(server), rev: revision,
      can_write: true, plan_graph_api: 1, graph_change_api: 2 };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/config/set') {
      assert.equal(message.expected_rev, revision, 'each own accepted ACK advances the next CAS');
      for (const space of message.config.spaces) verifyGraphProjection(space, space.plan_graph);
      writes.push(structuredClone(message)); server = structuredClone(message.config);
      return { ok: true, rev: ++revision, config: structuredClone(server) };
    }
    return null;
  });
  await page.evaluate(async () => {
    const previous = window.__card, hass = window.__mkHass(), base = hass.callWS.bind(hass);
    hass.devices = {}; hass.entities = {}; hass.states = {};
    // A real HA state update replaces hass while preserving connection/user.
    hass.callWS = async message => {
      if (message.type.endsWith('registry/list')) return [];
      const response = await window.writeAuthorityWire(message);
      if (message.type === 'houseplan/config/set') {
        const card = window.__card;
        card.hass = { ...card.hass, states: { ...card.hass.states,
          'sensor.authority_tick': { entity_id: 'sensor.authority_tick', state: String(response.rev), attributes: {} } } };
        await card.updateComplete;
      }
      return response ?? base(message);
    };
    const card = document.createElement('houseplan-card');
    card.setConfig({ type: 'custom:houseplan-card', language: 'en' });
    previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
  });
  await page.waitForFunction(() => window.__card?._booting === false && window.__card._space === 'initial');
  await page.evaluate(() => window.__hpTest.setMode('plan'));
  await host.locator('[data-hp="space-add"]').click();
  const dialog = host.locator('hp-dialog[data-kind="space"]');
  await dialog.locator('input[id$="-title"]').fill('Snapshot create');
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await page.waitForFunction(() => !window.__card._spaceDialog);
  await page.evaluate(() => window.__hpTest.waitForWrites());
  out.spaceCreatedOnce = server.spaces.filter(s => s.title === 'Snapshot create').length === 1 && writes.length === 1;
  out.createAckAdopted = await page.evaluate(rev => window.__card._cfgRev === rev, revision);
  const createdId = server.spaces.find(s => s.title === 'Snapshot create').id;
  await page.waitForFunction(id => window.__card._space === id && window.__card._mode === 'plan', createdId);
  await host.locator('[data-hp="tool"][data-tool="draw"]').click();
  const click = async (x, y) => {
    const p = await host.evaluate((card, [x, y]) => {
      const svg = card.renderRoot.querySelector('svg.plan-svg'), point = svg.createSVGPoint();
      point.x = x; point.y = y;
      const p = point.matrixTransform(svg.getScreenCTM()), box = card.renderRoot.querySelector('.stage').getBoundingClientRect();
      const hit = card.renderRoot.elementFromPoint(p.x, p.y);
      return { x: p.x, y: p.y, inside: p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom,
        clear: !!hit?.closest('.stage') && !hit.closest('button,input,.drawwall,.hp-properties') };
    }, [x, y]);
    assert.ok(p.inside && p.clear && p.x < 1280 && p.y < 900, `visible canvas target: ${JSON.stringify(p)}`);
    await page.mouse.click(p.x, p.y);
    await page.evaluate(() => window.__hpTest.settled());
  };
  await click(250, 450); await click(450, 450);
  await page.evaluate(() => window.__hpTest.waitForWrites());
  out.wallSavedOnce = (server.spaces.find(s => s.id === createdId).partitions || []).length === 1 && writes.length === 2;
  out.wallAckAdopted = await page.evaluate(rev => window.__card._cfgRev === rev, revision);
  out.noFalseContextError = await page.evaluate(() => !String(window.__card._toast || '').includes('context changed'));
  await page.evaluate(async () => { await window.__card._reloadConfigOnly(true); await window.__hpTest.settled(); });
  out.reloadKeepsAccepted = await page.evaluate(expected => JSON.stringify(window.__card._serverCfg) === JSON.stringify(expected), server);
  checkAll(out);
} finally { await finish(browser, out); }
