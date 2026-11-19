import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { launch, checkAll, finish } from './serve.mjs';
import { currentGraphFixture } from './helpers/graph-fixture.mjs';
import { makeStaticWallOpeningsFixture } from './fixtures/static-wall-openings.mjs';
import { prepareDesktopControls } from './helpers/desktop-controls.mjs';

const authored = makeStaticWallOpeningsFixture();
const door = authored.spaces[0].openings.find(opening => opening.id === 'wall-door');
Object.assign(door, { contact: 'binary_sensor.window', lock: 'lock.front_door' });
const fixture = currentGraphFixture(authored);
const { page, browser } = await launch({ width: 1280, height: 900 });
page.setDefaultTimeout(10000);
const results = {};
const capture = process.env.HP_SWING_CAPTURE_DIR;
const dialog = page.locator('hp-dialog[data-kind="opening"]');
const position = dialog.locator('[data-field="opening-swing-position"]');
const choose = async (field, value) => {
  const control = dialog.locator('hp-settings-select:has(select[name="' + field + '"])');
  const label = await control.locator('option[value="' + value + '"]').textContent();
  await control.locator('[data-hp="select-trigger"]').click();
  await control.getByRole('option', { name: label, exact: true }).click();
};
const properties = page.locator('[data-field="properties-swing_position"]');
const saved = () => page.evaluate(async () => {
  const data = await window.__card.hass.callWS({ type: 'houseplan/config/get' });
  return data.config.spaces.find(space => space.id === 'f1').openings.find(opening => opening.id === 'wall-door');
});
const editDoor = () => page.evaluate(async () => {
  const card = window.__card;
  card._editorRuntime._editOpening(card._openingsR.find(opening => opening.id === 'wall-door'));
  await card.updateComplete;
});
const waitForSave = async (position, mechanism) => {
  const until = Date.now() + 8000;
  do {
    const door = await saved();
    if (door.swing_position === position && (door.opening_features?.mechanism ?? 'swing') === mechanism) return;
    await delay(40);
  } while (Date.now() < until);
  throw new Error('The saved door did not reach the expected position and mechanism');
};
const apply = async (position, mechanism = 'swing') => {
  await dialog.locator('[data-hp="dialog-confirm"]').click();
  await dialog.waitFor({ state: 'hidden' });
  await waitForSave(position, mechanism);
  await page.evaluate(() => window.__hpTest.settled());
};
const isoOffset = () => page.evaluate(() => {
  const basis = window.__card._isoSource().build().openings.find(opening => opening.id === 'wall-door');
  return basis.leaves[0].hinge[1] - basis.axis.center[1];
});
try {
  if (capture) await mkdir(capture, { recursive: true });
  await prepareDesktopControls(page);
  await page.evaluate(async config => {
    const card = window.__card, callWS = card.hass.callWS.bind(card.hass);
    card.hass = { ...card.hass, callWS: async request => {
      const response = await callWS(request);
      return request.type === 'houseplan/config/get' ? { ...response, opening_features_api: 1 } : response;
    }, states: { ...card.hass.states,
      'binary_sensor.window': { ...card.hass.states['binary_sensor.window'], state: 'off' } } };
    await window.__hpTest.setServerConfig(config);
    await window.__hpTest.switchSpace('f1');
    await window.__hpTest.setMode('plan');
    await window.__hpTest.setTool('select');
  }, fixture);
  const before = await saved();
  assert.equal('swing_position' in before, false);
  await editDoor();
  assert.equal(await position.inputValue(), 'auto');
  assert.deepEqual(await position.locator('option').evaluateAll(options => options.map(option => option.value)),
    ['auto', 'negative', 'positive', 'center']);
  assert.match(await position.locator('option[value="negative"]').innerText(), /Снаружи|Outside/);
  assert.match(await position.locator('option[value="positive"]').innerText(), /Внутри|Inside/);
  if (capture) await page.screenshot({ animations: 'disabled', path: join(capture, 'position-dialog.png') });
  await choose('opening-swing-position', 'positive');
  await apply('positive');
  const { swing_position, ...geometryAndBindings } = await saved();
  assert.equal(swing_position, 'positive');
  assert.deepEqual(geometryAndBindings, before);
  results.dialogSavesOnlyPosition = true;

  await properties.waitFor();
  assert.equal(await properties.inputValue(), 'positive');
  await properties.selectOption('center');
  await page.waitForFunction(() => window.__card._curSpaceCfg.openings.find(o => o.id === 'wall-door').swing_position === 'center'
    && !window.__card._editorRuntime.properties.fields.draft);
  const history = async (direction, expected) => {
    await page.evaluate(direction => window.__card._editorRuntime._stepGeometryHistory(direction), direction);
    await page.waitForFunction(expected => window.__card._curSpaceCfg.openings.find(o => o.id === 'wall-door').swing_position === expected,
      expected);
    await waitForSave(expected, 'swing');
    await page.evaluate(() => window.__hpTest.settled());
  };
  await waitForSave('center', 'swing');
  await history('undo', 'positive');
  await history('redo', 'center');
  assert.equal((await saved()).swing_position, 'center');
  results.propertiesUndoAndRedo = true;

  await editDoor();
  await choose('opening-mechanism', 'slide');
  await position.waitFor({ state: 'hidden' });
  await dialog.locator('[data-field="opening-flip-vertical"]').waitFor();
  await apply('center', 'slide');
  assert.equal((await saved()).swing_position, 'center');
  const side = page.locator('[data-property="flip_v"]');
  assert.match(await side.innerText(), /Сторона размещения|Placement side/);
  const slideLabels = await side.getByRole('button').allTextContents();
  assert.match(slideLabels[0], /Внутри|Inside/);
  assert.match(slideLabels[1], /Снаружи|Outside/);
  await editDoor();
  await choose('opening-mechanism', 'swing');
  assert.equal(await position.inputValue(), 'center');
  await choose('opening-swing-position', 'positive');
  await apply('positive');
  results.slideKeepsManualPlacementDormant = true;

  const flat = page.locator('.opening[data-id="wall-door"]');
  const body = flat.locator(':scope > g[transform^="scale("] > g[transform^="translate("]').first();
  const halfDepth = await page.evaluate(() => 30 / 2 / window.__card._cellCm * window.__card._gridPitch);
  assert.equal(Number((await body.getAttribute('transform')).match(/^translate\(0 ([\d.]+)\)$/)?.[1]), halfDepth);
  await page.evaluate(() => window.__hpTest.setMode('view'));
  if (capture) await page.screenshot({ animations: 'disabled', path: join(capture, 'flat-positive.png') });
  await page.evaluate(async () => {
    await window.__hpTest.setVolumetricView(true);
    await window.__hpTest.settled();
  });
  await page.waitForFunction(() => !!window.__card.renderRoot.querySelector('[data-hp="iso-walls"]'));
  assert.equal(await isoOffset(), halfDepth);
  if (capture) await page.screenshot({ animations: 'disabled', path: join(capture, 'iso-positive.png') });
  for (let rotation = 0; rotation < 4; rotation++) {
    await page.evaluate(async () => {
      window.__card._rotatePlan(1);
      await window.__hpTest.settled();
    });
    assert.equal(await isoOffset(), halfDepth);
  }
  results.flatAndIsoUseSamePhysicalFace = true;

  await page.evaluate(() => {
    const old = window.__card;
    const fresh = document.createElement('houseplan-card');
    fresh.setConfig({ type: 'custom:houseplan-card' });
    fresh.hass = old.hass;
    old.replaceWith(fresh);
    window.__card = fresh;
  });
  await page.waitForFunction(() => !!window.__card?.renderRoot.querySelector('[data-hp="iso-walls"]'));
  assert.equal((await saved()).swing_position, 'positive');
  assert.equal(await isoOffset(), halfDepth);
  results.reloadedIsoKeepsPlacement = true;
} catch (error) {
  results.completed = false;
  console.error(error, await page.evaluate(() => {
    const card = window.__card;
    return { opening: card?._curSpaceCfg?.openings.find(o => o.id === 'wall-door'), toast: card?._toast };
  }).catch(() => ({})));
  throw error;
} finally {
  checkAll(results);
  await finish(browser, results);
}
