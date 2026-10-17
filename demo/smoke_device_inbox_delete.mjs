// #930: real catalog controls, exact virtual identities and durable delete/refusal.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch({ width: 1100, height: 900 });
const card = page.locator('houseplan-card');
await page.evaluate(async () => {
  const c = window.__card;
  await window.__hpTest.waitForWrites();
  const [a, b] = c._model;
  if (!a || !b) throw Error('two-space fixture required');
  window.__inbox930 = { a: a.id, b: b.id, writes: [], fault: null };
  await window.__hpTest.setServerConfig(cfg => {
    for (let index = 0; index < 155; index++) cfg.markers.push({
      id: `q930_${index}`, binding: 'virtual', name: `Q930 device ${index}`,
      space: index < 152 ? a.id : b.id, hidden: index === 1,
    });
    return cfg;
  });
  await window.__hpTest.setLayout(layout => ({ ...layout,
    q930_0: { s: a.id, x: .4, y: .4 }, q930_1: { s: a.id, x: .5, y: .4 },
  }));
  const original = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async message => {
    if (/^houseplan\/(config|layout|files|trail)\/(set|delete|cleanup)$/.test(message.type)) {
      window.__inbox930.writes.push(structuredClone(message));
      if (message.type === 'houseplan/config/set' && window.__inbox930.fault === 'refuse') {
        window.__inbox930.fault = null;
        throw new Error('930 controlled refusal');
      }
    }
    return original(message);
  } };
  await window.__hpTest.setMode('devices');
  await window.__hpTest.waitForWrites();
});
const out = {};
const settle = () => page.evaluate(() => window.__hpTest.settled());
const open = async () => { await card.locator('[data-hp="tool"][data-tool="device-inbox"]').click(); await settle(); };
const search = () => card.locator('.device-inbox-search');
const scope = () => card.locator('.device-inbox-space-filter select');
const row = id => card.locator(`.device-inbox-row[data-key="virtual:${id}"]`);
const choose = async id => { await row(id).locator('input[type="checkbox"]').check(); await settle(); };
const tab = index => card.locator('.device-inbox-tabs [role="tab"]').nth(index);
const snapshot = () => page.evaluate(() => ({ config: structuredClone(window.__card._serverCfg),
  layout: structuredClone(window.__card._layout), writes: window.__inbox930.writes.length,
  space: window.__card._space, selected: [...(window.__card._deviceInbox?.selected || [])] }));
const a = await page.evaluate(() => window.__inbox930.a);
const b = await page.evaluate(() => window.__inbox930.b);
await open();
out.startsAll = await scope().inputValue() === '';
const beforeFilters = await snapshot();
await search().fill('Q930');
await scope().selectOption(`space:${a}`); await settle();
out.filterKeepsOtherFloorOut = await card.locator('.device-inbox-row code').evaluateAll(nodes =>
  nodes.length === 100 && nodes.every(node => !['virtual:q930_152','virtual:q930_153','virtual:q930_154'].includes(node.textContent)));
await card.locator('.device-inbox-select-all input').check(); await settle();
out.selectAllIncludesUnpaged = (await snapshot()).selected.length === 151;
await scope().selectOption(`space:${b}`); await settle();
out.scopeClearsSelection = !(await snapshot()).selected.length && await card.locator('.device-inbox-row').count() === 3;
await scope().selectOption(''); await settle();
out.allRestoresFullResult = await card.locator('.device-inbox-row').count() === 100;
await scope().selectOption('@unassigned'); await settle();
out.unassignedDoesNotGuess = await card.locator('.device-inbox-row').count() === 0;
const afterFilters = await snapshot();
out.filtersAreReadOnly = JSON.stringify(beforeFilters.config) === JSON.stringify(afterFilters.config)
  && JSON.stringify(beforeFilters.layout) === JSON.stringify(afterFilters.layout)
  && beforeFilters.writes === afterFilters.writes && beforeFilters.space === afterFilters.space;
await scope().selectOption(`space:${a}`); await search().fill('Q930 device 0'); await settle();
await choose('q930_0');
const addButton = card.locator('.device-inbox-head button');
out.addCaption = (await addButton.innerText()).trim() === 'Add device';
await addButton.click();
await page.waitForFunction(() => !!window.__card._markerDialog);
await page.evaluate(async () => { await window.__hpTest.close(undefined, { via: 'cancel' }); });
await settle();
out.nestedReturnsFiltersAndSelection = await scope().inputValue() === `space:${a}`
  && await search().inputValue() === 'Q930 device 0' && (await snapshot()).selected.length === 1;
await card.locator('.device-inbox-batch-apply').click();
await page.waitForFunction(() => !window.__card._deviceInbox?.busy);
await settle();
const hidden = await snapshot();
out.virtualHideKeepsNeighbour = hidden.config.markers.find(m => m.id === 'q930_0').hidden === true
  && hidden.config.markers.find(m => m.id === 'q930_1').hidden === true
  && hidden.config.markers.find(m => m.id === 'q930_2').hidden !== true;
await tab(2).click(); await choose('q930_0');
await card.locator('.device-inbox-batch-apply').click();
await page.waitForFunction(() => !window.__card._deviceInbox?.busy); await settle();
const shown = await snapshot();
out.virtualShowKeepsNeighbour = shown.config.markers.find(m => m.id === 'q930_0').hidden === false
  && shown.config.markers.find(m => m.id === 'q930_1').hidden === true;
await tab(0).click(); await choose('q930_0');
const beforeCancel = await snapshot();
await card.locator('.device-inbox-batch-delete').click();
const confirm = card.locator('hp-confirm [data-kind="confirm"]');
await confirm.waitFor();
out.confirmNamesExactTarget = (await confirm.innerText()).includes('virtual:q930_0')
  && !(await confirm.innerText()).includes('virtual:q930_1');
await confirm.locator('button.btn[data-hp="dialog-cancel"]').click(); await settle();
const cancelled = await snapshot();
out.cancelNoWrite = JSON.stringify(cancelled) === JSON.stringify(beforeCancel);
await page.evaluate(() => { window.__inbox930.fault = 'refuse'; });
await card.locator('.device-inbox-batch-delete').click();
await confirm.locator('[data-hp="dialog-confirm"]').click();
await page.waitForFunction(() => !window.__card._deviceInbox?.busy); await settle();
const refused = await snapshot();
out.refusalRollsBackAndKeepsChoice = JSON.stringify(refused.config) === JSON.stringify(beforeCancel.config)
  && JSON.stringify(refused.layout) === JSON.stringify(beforeCancel.layout)
  && JSON.stringify(refused.selected) === JSON.stringify(beforeCancel.selected);
out.refusalCleansNothing = await page.evaluate(() => window.__inbox930.writes
  .filter(message => message.type !== 'houseplan/config/set').length === 0);
const beforeDelete = await snapshot();
await card.locator('.device-inbox-batch-delete').click();
await confirm.locator('[data-hp="dialog-confirm"]').click();
await page.waitForFunction(() => !window.__card._deviceInbox?.busy); await settle();
const deleted = await snapshot();
out.deleteVirtualOnly = !deleted.config.markers.some(m => m.id === 'q930_0')
  && deleted.config.markers.some(m => m.id === 'q930_1')
  && deleted.config.markers.filter(m => m.id.startsWith('q930_')).length === 154;
out.successClearsChoice = !deleted.selected.length && await card.locator('.device-inbox-row').count() === 0;
out.oneCommitThenCleanup = await page.evaluate(start => {
  const messages = window.__inbox930.writes.slice(start);
  return messages[0]?.type === 'houseplan/config/set'
    && messages.filter(m => m.type === 'houseplan/config/set').length === 1
    && messages.filter(m => m.type !== 'houseplan/config/set').length === 3
    && messages.slice(1).every(m => (m.marker_id || m.device_id) === 'q930_0');
}, beforeDelete.writes);
await search().fill(''); await settle();
const haRow = card.locator('.device-inbox-row[data-category="on_plan"][data-status="active"][data-binding^="device:"]').first();
const haBinding = await haRow.getAttribute('data-binding');
const beforeHaDelete = await snapshot();
const servicesBefore = await page.evaluate(() => window.__serviceCalls.length);
await haRow.locator('.device-inbox-select input').check();
await card.locator('.device-inbox-batch-delete').click();
await confirm.locator('[data-hp="dialog-confirm"]').click();
await page.waitForFunction(() => !window.__card._deviceInbox?.busy); await settle();
const haDeleted = await snapshot();
out.haDeleteLeavesExactTombstone = haDeleted.config.markers.filter(m => m.binding === haBinding).length === 1
  && haDeleted.config.markers.find(m => m.binding === haBinding).removed === true;
out.haDeleteOneConfigAndNoService = await page.evaluate(({ start, servicesBefore }) =>
  window.__inbox930.writes.slice(start).filter(m => m.type === 'houseplan/config/set').length === 1
    && window.__serviceCalls.length === servicesBefore,
{ start: beforeHaDelete.writes, servicesBefore });
await search().fill('Q930'); await scope().selectOption(`space:${b}`); await settle();
out.foreignFloorSurvives = await card.locator('.device-inbox-row').count() === 3;
await scope().selectOption(`space:${a}`); await settle();
await search().fill('Q930 device 2'); await choose('q930_2');
await card.locator('.device-inbox-batch-delete').click();
await confirm.waitFor();
const beforeStale = (await snapshot()).writes;
await page.evaluate(async id => { await window.__hpTest.setServerConfig(cfg => {
  cfg.markers.find(marker => marker.id === 'q930_2').space = id; return cfg;
}); }, b);
await confirm.locator('[data-hp="dialog-confirm"]').click();
await page.waitForFunction(() => !window.__card._deviceInbox?.busy); await settle();
const stale = await snapshot();
out.staleConfirmationRefusesMovedTarget = stale.writes === beforeStale
  && stale.config.markers.some(marker => marker.id === 'q930_2' && marker.space === b);
await page.evaluate(async id => { await window.__hpTest.setServerConfig(cfg => {
  cfg.spaces = cfg.spaces.filter(s => s.id !== id); return cfg;
}); }, a);
await settle();
out.removedSpaceResetsSelector = await scope().inputValue() === '' && !(await snapshot()).selected.length;
out.noHorizontalOverflow = await card.locator('.device-inbox').evaluate(node => node.scrollWidth <= node.clientWidth + 1);
checkAll(out);
await finish(browser, out);
