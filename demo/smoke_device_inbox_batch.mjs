// #618: batch Hide/Show in the Devices catalog. Selection is read-only, a
// batch of K rows is exactly one `houseplan/config/set`, a failed write
// changes nothing and keeps the selection, and the selection lives only on
// the "On plan" / "Hidden" tabs.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 980, height: 820 });
const out = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.renderRoot || c.shadowRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = async () => { await c.updateComplete; await frame(); await c.updateComplete; };
  const result = {};

  // Let the seeder and any debounced background write finish first.
  const t0 = Date.now();
  while (!c._serverCfg?.settings?.filter_seeded && Date.now() - t0 < 3000) {
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  await new Promise((resolve) => setTimeout(resolve, 650));
  c._saveConfigDebounced?.flush?.();
  await c._writeChain;

  const realWS = c.hass.callWS;
  let configWrites = 0;
  let otherWrites = 0;
  let gate = null;
  let reject = null;
  let lastSet = null;
  // The demo backend acknowledges config/set without storing it; remember the
  // last accepted document so a conflict re-read returns the real server state.
  let accepted = null;
  const countingWS = async (message) => {
    if (message.type === 'houseplan/config/set') {
      configWrites += 1;
      lastSet = message;
      if (gate) await gate.promise;
      if (reject) { const error = reject; reject = null; throw error; }
      const response = await realWS(message);
      accepted = JSON.parse(JSON.stringify(message.config));
      return response;
    }
    if (message.type === 'houseplan/config/get' && accepted) {
      const response = await realWS(message);
      return { ...response, config: JSON.parse(JSON.stringify(accepted)) };
    }
    if (/^houseplan\/(config|layout)\/(set|update|delete)$/.test(message.type)) {
      otherWrites += 1;
    }
    return realWS(message);
  };
  c.hass = { ...c.hass, callWS: countingWS };
  // A registry change arrives as a fresh hass object; keep the write counter.
  const refreshHass = async () => {
    c.hass = { ...window.__mkHass(), callWS: countingWS };
    await new Promise((resolve) => setTimeout(resolve, 220));
    await settle();
  };

  c._setMode('devices');
  await settle();
  c._openDeviceInbox();
  await settle();

  const tabButton = (index) => root().querySelectorAll('.device-inbox-tabs [role="tab"]')[index];
  const tabCount = (index) => Number(tabButton(index)?.querySelector('span')?.textContent || NaN);
  const batch = () => root().querySelector('.device-inbox-batch');
  const selectAll = () => batch()?.querySelector('.device-inbox-select-all input');
  const rowBox = (binding) => root()
    .querySelector(`.device-inbox-row[data-binding="${binding}"] .device-inbox-select input`);
  const click = async (node) => { node?.click(); await settle(); };
  const selected = () => [...(c._deviceInbox?.selected || [])];
  const snapshot = () => JSON.stringify({
    config: c._serverCfg, layout: c._layout, cfgRev: c._cfgRev, layoutRev: c._layoutRev,
  });

  // ---- AC1: only "On plan" and "Hidden" carry selection ---------------------
  const presence = [];
  for (let index = 0; index < 4; index++) {
    await click(tabButton(index));
    presence.push({
      tab: c._deviceInbox?.tab,
      batch: !!batch(),
      boxes: root().querySelectorAll('.device-inbox-select input').length,
      rows: root().querySelectorAll('.device-inbox-row').length,
    });
  }
  const byTab = Object.fromEntries(presence.map((item) => [item.tab, item]));
  result.batchOnlyOnTwoTabs = byTab.on_plan?.batch && byTab.on_plan.boxes === byTab.on_plan.rows
    && byTab.on_plan.rows > 3
    && !byTab.available?.batch && byTab.available?.boxes === 0
    && !byTab.readd?.batch && byTab.readd?.boxes === 0
    && byTab.hidden?.batch === true;
  await click(tabButton(0));
  // smoke_hidden_flag takes the LAST checkbox in .device-inbox-filters.
  const filterBoxes = [...root().querySelectorAll('.device-inbox-filters input[type="checkbox"]')];
  result.batchLivesOutsideFilters = !root().querySelector('.device-inbox-filters .device-inbox-batch')
    && !!filterBoxes.at(-1)?.closest('.device-inbox-filter-help');

  // ---- AC8: selecting is read-only -----------------------------------------
  const before = snapshot();
  const onPlan = c._deviceInboxRows().filter((row) => row.category === 'on_plan' && row.canHide);
  const [a, b, d, e] = onPlan.map((row) => row.binding);
  await click(rowBox(a));
  await click(rowBox(b));
  result.rowSelectionWorks = selected().length === 2 && !!root().querySelector('.device-inbox-batch-actions')
    && /Selected: 2/.test(batch()?.textContent || '');
  await click(selectAll());
  result.selectAllSelectsEveryEligibleRow = selected().length === onPlan.length
    && new RegExp(`Select all \\(${onPlan.length}\\)`).test(batch()?.textContent || '');
  await click(root().querySelector('.device-inbox-batch-clear'));
  result.clearSelectionEmpties = selected().length === 0 && !root().querySelector('.device-inbox-batch-actions');
  result.selectionIsReadOnly = snapshot() === before && configWrites === 0 && otherWrites === 0;

  // ---- AC6: selection resets on tab / arrow / search / New only ------------
  await click(rowBox(a));
  await click(tabButton(2));
  result.selectionResetOnTabClick = selected().length === 0;
  await click(tabButton(0));
  await click(rowBox(a));
  root().querySelector('.device-inbox-tabs')
    .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await settle();
  result.selectionResetOnArrow = c._deviceInbox?.tab === 'available' && selected().length === 0;
  await click(tabButton(0));
  await click(rowBox(a));
  const search = root().querySelector('.device-inbox-search');
  search.value = 'x';
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle();
  result.selectionResetOnSearch = selected().length === 0;
  search.value = '';
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await settle();
  await click(rowBox(a));
  const onlyNew = root().querySelector('.device-inbox-filters input[type="checkbox"]');
  await click(onlyNew);
  result.selectionResetOnOnlyNew = selected().length === 0;
  if (c._deviceInbox?.onlyNew) await click(root().querySelector('.device-inbox-filters input[type="checkbox"]'));

  await click(rowBox(a));
  await click(rowBox(b));
  const nestedRow = c._deviceInboxRows().find((row) => row.binding === d);
  c._openInboxMarker(nestedRow);
  await settle();
  const nestedOpen = !!c._markerDialog && !c._deviceInbox;
  c._closeMarkerDialog();
  await settle();
  result.selectionSurvivesNestedDialog = nestedOpen
    && JSON.stringify(selected().sort()) === JSON.stringify([a, b].sort())
    && rowBox(a)?.checked === true;
  await click(root().querySelector('.device-inbox-batch-clear'));

  // ---- AC3 + AC7: hide 3 in one write, catalog inert while writing ----------
  const hiddenBefore = tabCount(2);
  const onPlanBefore = tabCount(0);
  for (const binding of [a, b, d]) await click(rowBox(binding));
  const writesBeforeHide = configWrites;
  let release;
  gate = { promise: new Promise((resolve) => { release = resolve; }) };
  root().querySelector('.device-inbox-batch-apply').click();
  await c.updateComplete;
  while (configWrites === writesBeforeHide) await new Promise((resolve) => setTimeout(resolve, 5));
  await c.updateComplete;
  result.catalogInertWhileWriting = root().querySelector('.device-inbox')?.hasAttribute('inert') === true
    && c._deviceInbox?.busy === '__batch__';
  gate = null;
  release();
  while (c._deviceInbox?.busy) await new Promise((resolve) => setTimeout(resolve, 10));
  await settle();
  const hideToast = c._toast;
  const markerHidden = (binding) => (c._serverCfg.markers || [])
    .filter((marker) => marker.binding === binding && !marker.removed);
  result.hideIsOneWrite = configWrites - writesBeforeHide === 1
    && typeof lastSet?.expected_rev === 'number';
  result.hideAppliedToAll = [a, b, d].every((binding) => {
    const live = markerHidden(binding);
    return live.length === 1 && live[0].hidden === true;
  }) && markerHidden(e).every((marker) => marker.hidden !== true);
  result.hideToastCountsRows = hideToast === 'Hidden: 3';
  result.selectionClearedAfterSuccess = selected().length === 0
    && root().querySelector('.device-inbox')?.hasAttribute('inert') === false;
  result.tabCountersUpdated = tabCount(2) === hiddenBefore + 3 && tabCount(0) === onPlanBefore - 3;

  // Show 2 of the 3 on "Hidden": total two writes, one of the three stays.
  await click(tabButton(2));
  await click(rowBox(a));
  await click(rowBox(b));
  result.showButtonNamesCount = /Show selected \(2\)/.test(batch()?.textContent || '');
  root().querySelector('.device-inbox-batch-apply').click();
  await c.updateComplete;
  while (c._deviceInbox?.busy) await new Promise((resolve) => setTimeout(resolve, 10));
  await settle();
  result.showIsOneWrite = configWrites - writesBeforeHide === 2;
  result.showToastCountsRows = c._toast === 'Shown: 2';
  const hiddenNow = c._deviceInboxRows().filter((row) => row.category === 'hidden').map((row) => row.binding);
  result.oneOfThreeStaysHidden = hiddenNow.includes(d) && !hiddenNow.includes(a) && !hiddenNow.includes(b)
    && markerHidden(a).length === 1 && markerHidden(a)[0].hidden === false;

  // ---- AC2: an HA-disabled row is listed but not selectable nor counted ----
  // (both tabs; the rows keep a marker, so HA deactivation keeps them listed)
  const idOf = (binding) => binding.slice(binding.indexOf(':') + 1);
  const selectAllCount = () => Number((batch()?.querySelector('.device-inbox-select-all')?.textContent || '')
    .match(/\((\d+)\)/)?.[1] ?? NaN);
  const inactiveChecks = [];
  for (const [tabIndex, binding] of [[2, d], [0, a]]) {
    await click(tabButton(tabIndex));
    const countBefore = selectAllCount();
    window.__setRegistryDisabled('device', idOf(binding), 'user');
    await refreshHass();
    const box = rowBox(binding);
    inactiveChecks.push(!!box && box.disabled && !!box.closest('label')?.title
      && selectAllCount() === countBefore - 1
      && c._deviceInboxRows().find((row) => row.binding === binding)?.status.kind === 'ha_disabled');
    await click(selectAll());
    inactiveChecks.push(!selected().includes(binding) && selected().length === countBefore - 1);
    await click(root().querySelector('.device-inbox-batch-clear'));
    window.__setRegistryDisabled('device', idOf(binding), null);
    await refreshHass();
  }
  result.inactiveRowNotSelectable = inactiveChecks.length === 4 && inactiveChecks.every(Boolean);
  await click(tabButton(2));

  // ---- AC5: a rejected write changes nothing and keeps the selection -------
  for (const [label, error] of [
    ['Error', new Error('batch rejected by test')],
    ['Conflict', Object.assign(new Error('revision conflict'), { code: 'conflict' })],
  ]) {
    await click(rowBox(d));
    const markersBefore = JSON.stringify(c._serverCfg.markers);
    const writes = configWrites;
    reject = error;
    root().querySelector('.device-inbox-batch-apply').click();
    await c.updateComplete;
    while (configWrites === writes || c._deviceInbox?.busy) await new Promise((resolve) => setTimeout(resolve, 10));
    await settle();
    result[`rejected${label}KeepsMarkers`] = JSON.stringify(c._serverCfg.markers) === markersBefore
      && markerHidden(d)[0]?.hidden === true;
    result[`rejected${label}ShowsError`] = /^Error:|Ошибка|error/i.test(c._toast || '')
      && c._toast !== 'Shown: 1';
    result[`rejected${label}KeepsSelection`] = JSON.stringify(selected()) === JSON.stringify([d])
      && rowBox(d)?.checked === true;
    result[`rejected${label}CatalogActiveAgain`] = !c._deviceInbox?.busy
      && root().querySelector('.device-inbox')?.hasAttribute('inert') === false;
    await click(root().querySelector('.device-inbox-batch-clear'));
  }

  // ---- AC10: no horizontal overflow on desktop -----------------------------
  await click(tabButton(0));
  await click(rowBox(e));
  const dialog = root().querySelector('hp-dialog');
  result.noHorizontalOverflow = !!dialog && dialog.scrollWidth <= dialog.clientWidth + 1;
  return result;
});

// Narrow viewport: the selection panel wraps instead of overflowing.
await page.setViewportSize({ width: 390, height: 820 });
out.noHorizontalOverflowNarrow = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.renderRoot || c.shadowRoot;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await c.updateComplete;
  const dialog = root().querySelector('hp-dialog');
  const inbox = root().querySelector('.device-inbox');
  return !!dialog && !!root().querySelector('.device-inbox-batch-actions')
    && dialog.scrollWidth <= dialog.clientWidth + 1 && inbox.scrollWidth <= inbox.clientWidth + 1;
});

checkAll(out);
await finish(browser, out);
