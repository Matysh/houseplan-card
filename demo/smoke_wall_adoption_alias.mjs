// #826: real Resize commits materialize every floor. Inject point ownership,
// not geometry, and prove the untouched floor survives two commits and history.
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1180, height: 920 });
const aliasOwnership = !process.argv.includes('--json-model');
await page.evaluate(() => {
  const source = { spaces: [
    { id: 'moving', title: 'Moving', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [
        { id: 'left', name: 'Left', poly: [[.1, .1], [.4, .1], [.4, .4], [.1, .4]] },
        { id: 'right', name: 'Right', poly: [[.4, .1], [.7, .1], [.7, .4], [.4, .4]] },
      ], openings: [{ id: 'door', type: 'door', x: .4, y: .25, angle: 90, length: .08 }] },
    { id: 'other', title: 'Untouched', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [
        { id: 'big', name: 'Big', poly: [[0, 0], [1, 0], [1, 1], [0, 1]] },
        { id: 'small', name: 'Small', poly: [[1, .5], [2, .5], [2, 1], [1, 1]] },
      ] },
  ], markers: [], settings: {} };
  const previous = window.__card, hass = window.__mkHass(), callWS = hass.callWS.bind(hass);
  let rev = 1;
  window.__aliasWrites = [];
  hass.callWS = async message => {
    if (message.type === 'houseplan/config/get') return { config: structuredClone(source), rev, can_write: true };
    if (message.type === 'houseplan/layout/get') return { layout: {}, rev: 1 };
    if (message.type === 'houseplan/config/set') {
      window.__aliasWrites.push(structuredClone(message)); return { ok: true, rev: ++rev };
    }
    return callWS(message);
  };
  const card = document.createElement('houseplan-card');
  card.setConfig({ type: 'custom:houseplan-card', title: 'House Plan' });
  previous.remove(); document.getElementById('host').appendChild(card); window.__card = card; card.hass = hass;
});
await page.waitForFunction(() => window.__card._booting === false && window.__card._space === 'moving');
await page.evaluate(async () => {
  const card = window.__card;
  await card._requestMode('plan'); await card.updateComplete;
  [...card.renderRoot.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Resize')?.click();
  await card.updateComplete;
});
await page.waitForFunction(() => !window.__card._modeTransitionBusy && window.__card.renderRoot.querySelector('.rszhandle'));
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
await settle();
check('alias.setup_changes_only_ownership', await page.evaluate(alias => {
  const card = window.__card, other = card._serverCfg.spaces.find(space => space.id === 'other');
  const before = JSON.stringify(other), root = card._serverCfg;
  // private-ok: construct shared ownership with identical existing values;
  // copying points here would remove the defect instead of exercising adoption.
  if (alias) other.rooms[1].poly[3] = other.rooms[0].poly[2];
  window.__aliasRefs = { root, other, rooms: [...other.rooms] };
  const runtime = card._editorRuntime, original = runtime._junctionLimitsIntroduced.bind(runtime);
  // private-ok: observe the actual validated candidate, never replace the guard.
  runtime._junctionLimitsIntroduced = (candidate, ...args) => {
    window.__aliasExpectedOther = JSON.stringify(candidate.spaces.find(space => space.id === 'other'));
    return original(candidate, ...args);
  };
  return JSON.stringify(other) === before && (!alias || other.rooms[1].poly[3] === other.rooms[0].poly[2]);
}, aliasOwnership));
// Let the pre-existing cold setup write finish before counting gesture writes.
await page.waitForTimeout(650);
const writesBefore = await page.evaluate(() => window.__aliasWrites.length);
const geometry = () => page.evaluate(() => JSON.stringify(window.__card._serverCfg.spaces));
const unchangedOther = () => page.evaluate(() => {
  const card = window.__card, refs = window.__aliasRefs, other = card._serverCfg.spaces.find(space => space.id === 'other');
  return JSON.stringify(other) === window.__aliasExpectedOther && card._serverCfg === refs.root
    && other === refs.other && other.rooms.every((room, index) => room === refs.rooms[index]);
});
const move = async (name, from, steps) => {
  const handle = await page.evaluate(({ from, steps }) => {
    const node = [...window.__card.renderRoot.querySelectorAll('.rszhandle[aria-disabled="false"]')]
      .find(node => Math.abs(Number(node.getAttribute('cx')) - from) < 1 && Math.abs(Number(node.getAttribute('cy')) - 250) < 1);
    if (!node) return null;
    const rect = node.getBoundingClientRect(), point = node.ownerSVGElement.createSVGPoint();
    point.x = from + steps * window.__card._gridPitch; point.y = 250;
    const end = point.matrixTransform(node.getScreenCTM());
    return { start: [rect.left + rect.width / 2, rect.top + rect.height / 2], end: [end.x, end.y] };
  }, { from, steps });
  check(`alias.${name}_enabled_handle`, !!handle);
  if (!handle) return;
  const before = await geometry();
  await page.mouse.move(...handle.start); await page.mouse.down(); await page.mouse.move(...handle.end, { steps: 8 });
  await settle(); check(`alias.${name}_preview_is_not_persisted`, await geometry(), before);
  await page.mouse.up(); await settle(); await page.waitForTimeout(650);
};
await move('first', 400, 10);
check('alias.first_preserves_validated_other_floor_and_refs', await unchangedOther());
check('alias.first_is_saved', await page.evaluate(before => window.__aliasWrites.length === before + 1
  && window.__card._geometryHistory.size === 1, writesBefore));
if (process.argv.includes('--red-witness')) { await finish(browser, { done: true }); process.exit(0); }
const first = await geometry(), pitch = await page.evaluate(() => window.__card._gridPitch);
await move('second', 400 + 10 * pitch, 5);
const second = await geometry();
check('alias.second_is_new_valid_saved_commit', second !== first && await page.evaluate(before =>
  window.__aliasWrites.length === before + 2 && window.__card._geometryHistory.size === 2, writesBefore));
check('alias.saved_pair_has_exact_values_and_ids', await page.evaluate(() =>
  JSON.stringify(window.__aliasWrites.at(-1).config.spaces) === JSON.stringify(window.__card._serverCfg.spaces)));
check('alias.second_preserves_other_floor_and_refs', await unchangedOther());
check('alias.no_unrelated_opening_host_error', await page.evaluate(() => !/could not|unsafe|host|stopped/i.test(window.__card._toast || '')));
await page.keyboard.press('Control+z'); await settle(); await page.waitForTimeout(650);
check('alias.undo_exact_values_and_ids', await geometry(), first);
await page.keyboard.press('Control+Shift+z'); await settle(); await page.waitForTimeout(650);
check('alias.redo_exact_values_and_ids', await geometry(), second);
check('alias.history_keeps_other_floor', await page.evaluate(() => JSON.stringify(window.__card._serverCfg.spaces.find(space => space.id === 'other')) === window.__aliasExpectedOther));
await finish(browser, { done: true });
