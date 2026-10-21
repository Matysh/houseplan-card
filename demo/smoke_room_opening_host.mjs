/** #996: real editor deletion, Undo/Redo and room recreation; real backend promotion proof. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launch, check, finish } from './serve.mjs';

const seed = JSON.parse(readFileSync(new URL('../test/fixtures/996-room-opening-host.json', import.meta.url), 'utf8'));
let { page, browser } = await launch({ width: 1400, height: 1000 });
const accepted = [];
const installOracle = () => page.exposeFunction('proveRoomOpeningHost', payload => {
  const result = JSON.parse(execFileSync(process.env.PYTHON || 'python3',
    [fileURLToPath(new URL('./helpers/partition-host-oracle.py', import.meta.url))], {
      input: JSON.stringify(payload), encoding: 'utf8',
    }));
  if (result.ok) accepted.push(structuredClone(payload));
  return result;
});
await installOracle();
async function settleWrites(expected) {
  await page.waitForFunction(n => window.__roomHost?.accepted >= n && window.__card._writesPending === 0
    && !window.__card._saveConfigDebounced.pending(), expected);
  await page.evaluate(() => window.__hpTest.settled());
}
async function clickPlan(x, y) {
  const point = await page.evaluate(([x, y]) => {
    const rect = window.__card.renderRoot.querySelector('.stage').getBoundingClientRect();
    const view = window.__card._view;
    return { x: rect.left + (x * 1000 - view.x) / view.w * rect.width,
      y: rect.top + (y * 1000 - view.y) / view.h * rect.height };
  }, [x, y]);
  await page.mouse.click(point.x, point.y);
}
const history = kind => page.locator('[data-hp="toolbar"][data-kind="plan"] button')
  .filter({ has: page.locator(`ha-icon[icon="mdi:${kind}-variant"]`) });
try {
  for (const type of ['door', 'window']) {
    if (type === 'window') {
      await browser.close();
      ({ page, browser } = await launch({ width: 1400, height: 1000 }));
      await installOracle();
    }
    const config = structuredClone(seed);
    config.spaces[0].openings[0].type = type;
    if (type === 'window') for (const key of ['lock', 'flip_h', 'flip_v']) delete config.spaces[0].openings[0][key];
    await page.evaluate(async config => {
      if (window.__roomHostBaseHass) window.__card.hass = window.__roomHostBaseHass;
      await window.__hpTest.setServerConfig(config);
      await window.__hpTest.switchSpace('floor');
      await window.__hpTest.setMode('plan');
      const card = window.__card, fallback = card.hass.callWS.bind(card.hass);
      window.__roomHostBaseHass = card.hass;
      const state = window.__roomHost = { saved: structuredClone(card._serverCfg), rev: card._cfgRev, accepted: 0, rejected: [] };
      card.hass = { ...card.hass, callWS: async message => {
        if (message.type === 'houseplan/config/get') return { config: structuredClone(state.saved), rev: state.rev, can_write: true };
        if (message.type !== 'houseplan/config/set') return fallback(message);
        if (message.expected_rev !== state.rev) throw Object.assign(new Error('stale revision'), { code: 'conflict' });
        const candidate = structuredClone(message.config);
        const result = await window.proveRoomOpeningHost({ config: candidate, previous: state.saved });
        if (!result.ok) {
          state.rejected.push(result.code);
          throw Object.assign(new Error(result.code), { code: result.code });
        }
        state.saved = candidate; state.accepted++;
        return { ok: true, rev: ++state.rev };
      } };
      await new Promise(resolve => setTimeout(resolve, 500));
    }, config);
    await page.locator('[data-editor-group="rooms"]').click();
    await page.locator('[data-group-item="delroom"]').click();
    await page.evaluate(() => window.__hpTest.settled());
    await clickPlan(0.3, 0.3);
    const deletion = page.locator('[data-hp="dialog"]').filter({ has: page.locator('ha-icon[icon="mdi:wall"]') });
    await deletion.locator('button').filter({ has: page.locator('ha-icon[icon="mdi:wall"]') }).click();
    await settleWrites(1);
    const deleted = await page.evaluate(() => window.__roomHost.saved.spaces[0]);
    assert.equal(deleted.rooms.length, 1);
    assert.equal(deleted.openings[0].host.kind, 'partition');
    for (let cycle = 0; cycle < 2; cycle++) {
      await history('undo').click(); await settleWrites(2 + cycle * 2);
      const restored = await page.evaluate(() => window.__roomHost.saved.spaces[0]);
      assert.deepEqual(restored, config.spaces[0], 'accepted Undo restores the exact physical snapshot');
      await history('redo').click(); await settleWrites(3 + cycle * 2);
      assert.deepEqual(await page.evaluate(() => window.__roomHost.saved.spaces[0]), deleted);
    }
    await page.evaluate(() => window.__hpTest.setTool('draw'));
    await clickPlan(0.3, 0.3);
    const room = page.locator('[data-hp="dialog"][data-kind="room"]');
    await room.locator('#room-name').fill('Recreated');
    await room.locator('.dialog-action-commit [data-hp="dialog-confirm"]').click();
    await settleWrites(6);
    const recreated = await page.evaluate(() => ({ space: window.__roomHost.saved.spaces[0], rejected: window.__roomHost.rejected,
      rendered: !!window.__card.renderRoot.querySelector('[data-hp="opening"][data-id="opening"]') }));
    assert.equal(recreated.space.rooms.length, 2);
    assert.deepEqual(recreated.space.openings, config.spaces[0].openings);
    assert.deepEqual(recreated.space.rooms.find(r => r.id === 'neighbor'), config.spaces[0].rooms.find(r => r.id === 'neighbor'));
    assert.deepEqual(recreated.rejected, []);
    assert.equal(recreated.rendered, true);
    check(`${type}: durable Undo/Redo and recreated room retain the visible opening`, true);
  }
  check('all 12 physical transitions reached the production promotion proof',
    accepted.filter(p => p.config.spaces[0].rooms.length !== p.previous.spaces[0].rooms.length).length === 12);
} catch (error) {
  console.error('Writes', accepted.map(p => ({ before: p.previous.spaces[0].rooms.map(r => r.id),
    after: p.config.spaces[0].rooms.map(r => r.id), host: p.config.spaces[0].openings[0].host })));
  console.error(await page.evaluate(() => ({ mode: window.__card._mode, tool: window.__card._tool,
    deletion: window.__card._roomDeleteDialog, toast: window.__card._toast,
    dialogs: [...window.__card.renderRoot.querySelectorAll('[data-hp="dialog"]')].map(d => d.outerHTML.slice(0, 1000)) })));
  throw error;
} finally {
  await browser.close();
}
await finish();
