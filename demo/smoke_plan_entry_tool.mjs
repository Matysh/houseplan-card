// #928: public editor entry must select existing geometry, never start a wall.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1180, height: 920 });
const out = {};
await page.evaluate(() => {
  const c = window.__card, call = c.hass.callWS.bind(c.hass);
  window.__entryWrites = [];
  c.hass = { ...c.hass, callWS: async message => {
    if (/^houseplan\/(config|layout)\/set$/.test(message.type))
      window.__entryWrites.push(structuredClone(message));
    return call(message);
  } };
  window.__entrySeed = structuredClone(c._serverCfg);
});
const mode = async value => {
  await page.evaluate(value => window.__hpTest.setMode(value), value);
  await page.waitForFunction(() => !window.__card._modeTransitionBusy);
};
const tool = async value => page.evaluate(value => window.__hpTest.setTool(value), value);
const snapshot = () => page.evaluate(() => {
  const c = window.__card;
  return { tool: c.renderRoot.querySelector('[data-hp="toolbar"] [data-hp="tool"].on')?.dataset.tool,
    path: c._path.length, data: JSON.stringify([c._serverCfg, c._layout]), writes: window.__entryWrites.length };
});
const clickPlan = async () => {
  const box = await page.locator('houseplan-card svg.plan-svg').boundingBox();
  await page.mouse.click(box.x + box.width * .13, box.y + box.height * .83);
  await page.evaluate(() => window.__hpTest.settled());
};

const before = await snapshot();
await mode('plan');
const ready = await snapshot();
await clickPlan();
const clicked = await snapshot();
out.existingPlanEntersSelectWithoutWrites = ready.tool === 'select'
  && ready.data === before.data && ready.writes === before.writes;
out.firstClickDoesNotDraw = clicked.path === 0 && clicked.data === before.data
  && clicked.writes === before.writes;
await tool('draw');
// Actually click the already-active tab; the facade's same-mode shortcut is not an oracle.
await page.locator('houseplan-card [data-hp="mode-tab"][data-mode="plan"]').click();
out.manualToolSurvivesActiveTab = (await snapshot()).tool === 'draw';
await mode('view'); await mode('plan');
out.reentryRecomputesSelect = (await snapshot()).tool === 'select';
await tool('draw');
await page.evaluate(async () => {
  const previous = window.__card, host = previous.parentNode;
  const config = { ...previous._config }, hass = previous.hass;
  previous.remove();
  const card = document.createElement('houseplan-card');
  card.setConfig(config); card.hass = hass;
  host.appendChild(card); window.__card = card;
});
await page.waitForFunction(() => window.__card._mode === 'plan'
  && !window.__card._warmModeRequest && !window.__card._modeTransitionBusy);
out.warmSessionKeepsManualWalls = (await snapshot()).tool === 'draw';
await page.evaluate(async () => {
  const previous = window.__card, host = previous.parentNode;
  const config = { ...previous._config }, hass = previous.hass;
  const permission = new Promise(resolve => { window.__entryReleasePermission = resolve; });
  previous.remove();
  const card = document.createElement('houseplan-card');
  card.setConfig(config);
  card.hass = { ...hass, user: { ...hass.user, is_admin: false }, callWS: async message => {
    if (message.type === 'houseplan/config/get') await permission;
    return hass.callWS(message);
  } };
  host.appendChild(card); window.__card = card;
});
await page.waitForFunction(() => window.__card._pendingNavMode === 'plan');
await page.evaluate(() => window.__entryReleasePermission());
await page.waitForFunction(() => window.__card._mode === 'plan'
  && !window.__card._warmModeRequest && !window.__card._modeTransitionBusy);
out.delayedWarmSessionKeepsManualWalls = (await snapshot()).tool === 'draw';
await mode('view');

// The other floor retains its rooms. Its geometry must not decide the current floor's tool.
const configure = async kind => {
  await page.evaluate(async kind => {
    const cfg = structuredClone(window.__entrySeed);
    const s = cfg.spaces.find(s => s.id === window.__card._space);
    Object.assign(s, { rooms: [], wall_segments: [], walls: [], partitions: [], wall_columns: [], openings: [], stairs: [], led_strips: [] });
    if (kind !== 'image') s.plan_url = null;
    if (kind === 'wall') s.partitions = [{ id: 'entry-wall', a: [.3, .3], b: [.7, .3], cm: 0 }];
    if (kind === 'column') s.wall_columns = [{ id: 'entry-column', center: [.5, .5], shape: 'square', cm: 30 }];
    if (kind === 'opening') {
      // A legacy, unhosted saved opening counts even when no wall is rendered.
      s.openings = [{ id: 'entry-opening', type: 'door', x: .5, y: .5, angle: 0, length: .08 }];
    }
    await window.__hpTest.setServerConfig(cfg);
  }, kind);
};
for (const kind of ['empty', 'image', 'wall', 'column', 'opening']) {
  await configure(kind);
  const start = await snapshot();
  await mode('plan');
  const entered = await snapshot();
  const expected = ['empty', 'image'].includes(kind) ? 'draw' : 'select';
  out[`${kind}InitialToolAndNoWrites`] = entered.tool === expected
    && entered.data === start.data && entered.writes === start.writes;
  if (kind === 'empty' || kind === 'image') {
    await clickPlan();
    const first = await snapshot();
    out[`${kind}FirstClickStartsOnlyDraft`] = first.path === 1
      && first.data === start.data && first.writes === start.writes;
    await page.keyboard.press('Escape');
  }
  await mode('view');
}
// Return to the now-empty current floor: a real exit/reentry must reclassify it.
await configure('empty'); await mode('plan');
out.removedGeometryReopensWalls = (await snapshot()).tool === 'draw';
await mode('devices');
out.devicesStillOpens = await page.evaluate(() => window.__card._mode === 'devices');
await mode('decor');
out.backgroundStillStartsSelect = await page.evaluate(() => window.__card._decorTool === 'select');
await mode('view');
checkAll(out);
await finish(browser, out);
