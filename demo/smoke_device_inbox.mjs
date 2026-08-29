// #29: one lifecycle catalog replaces the separate hidden-device paths.
// #363 restores a direct Add shortcut without creating a second catalog.
// This smoke exercises the real Lit dialog and verifies that browsing it is
// read-only while nested marker flows return to the same catalog state.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 980, height: 820 });
const out = await page.evaluate(async () => {
  const c = window.__card;
  const root = () => c.renderRoot || c.shadowRoot;
  const writes = [];
  const originalCallWS = c.hass.callWS;
  c.hass = { ...c.hass, callWS: async (message) => {
    if (/^houseplan\/(config|layout)\/(set|update|delete)$/.test(message.type)) {
      writes.push(message.type);
    }
    return originalCallWS(message);
  } };

  c._setMode('devices');
  await c.updateComplete;
  const toolbar = [...root().querySelectorAll('.editbar .btn')];
  const labels = toolbar.map((node) => node.textContent.trim());
  const result = {
    catalogAndDirectAddEntryPoints: labels.some((label) => /Devices/i.test(label))
      && labels.some((label) => /^Add$/i.test(label))
      && !labels.some((label) => /Hidden and disabled/i.test(label)),
  };

  const before = JSON.stringify({
    config: c._serverCfg, layout: c._layout, cfgRev: c._cfgRev, layoutRev: c._layoutRev,
  });
  c._openDeviceInbox();
  await c.updateComplete;
  const dialog = root().querySelector('hp-dialog');
  const dialogSurface = dialog?.renderRoot?.querySelector('.surface');
  const tabs = [...root().querySelectorAll('.device-inbox-tabs [role="tab"]')];
  result.dialogHasFourTabs = !!dialog && tabs.length === 4;
  result.desktopCatalogIsWide = !!dialogSurface && dialogSurface.getBoundingClientRect().width > 800;
  result.hasOverflowMenu = !!root().querySelector('.device-inbox-menu');
  result.onPlanHasRows = root().querySelectorAll('.device-inbox-row[data-category="on_plan"]').length > 0;
  result.noHorizontalOverflow = !!dialog && dialog.scrollWidth <= dialog.clientWidth + 1;

  // The catalog speaks in the plan's room names, not a stale HA Area name.
  const initialRoomRow = c._deviceInboxRows()
    .find((item) => item.areaId && c._areaToSpace[item.areaId]);
  const roomTarget = initialRoomRow ? c._areaToSpace[initialRoomRow.areaId] : null;
  const sourceRoom = roomTarget ? c._serverCfg.spaces.find((space) => space.id === roomTarget.space)
    ?.rooms?.find((room) => room.id === roomTarget.room.id) : null;
  result.hasCatalogRowInPlanRoom = !!roomTarget && !!initialRoomRow && !!sourceRoom;
  if (roomTarget && initialRoomRow && sourceRoom) {
    const originalRoomName = sourceRoom?.name;
    const planRoomName = 'Renamed room on plan';
    sourceRoom.name = planRoomName;
    c._cfgEpoch++;
    c._deviceInboxMemo = null;
    await c.updateComplete;
    const roomRow = c._deviceInboxRows().find((item) => item.binding === initialRoomRow.binding);
    result.planRoomNameWins = roomRow?.areaName === planRoomName;
    result.planRoomNameIsSearchable = !!roomRow?.searchText.includes(planRoomName.toLowerCase());
    sourceRoom.name = originalRoomName;
    c._cfgEpoch++;
    c._deviceInboxMemo = null;
  } else {
    result.planRoomNameWins = false;
    result.planRoomNameIsSearchable = false;
  }

  const search = root().querySelector('.device-inbox-search');
  search.value = 'Ceiling light';
  search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  await c.updateComplete;
  result.searchUsesFullSnapshot = root().querySelectorAll('.device-inbox-row').length === 1
    && root().querySelector('.device-inbox-row')?.textContent.includes('Ceiling light');

  // Arrow-key tab navigation is part of the keyboard contract.
  const tablist = root().querySelector('.device-inbox-tabs');
  tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await c.updateComplete;
  result.arrowChangesTab = c._deviceInbox?.tab === 'available';

  // Restore a non-default context, open the real marker dialog, then cancel.
  c._deviceInbox = { ...c._deviceInbox, tab: 'on_plan', search: 'lamp', onlyNew: false };
  await c.updateComplete;
  const row = c._deviceInboxRows().find((item) => item.category === 'on_plan' && item.canEdit);
  c._openInboxMarker(row);
  await c.updateComplete;
  result.nestedDialogOpened = !!c._markerDialog && !c._deviceInbox;
  c._closeMarkerDialog();
  await c.updateComplete;
  result.nestedCancelReturnsContext = c._deviceInbox?.tab === 'on_plan'
    && c._deviceInbox?.search === 'lamp' && c._deviceInbox?.anchor === row.key;

  // Find is navigation only: it closes the dialog and selects a marker briefly.
  c._deviceInbox = { ...c._deviceInbox, search: '' };
  const findable = c._deviceInboxRows().find((item) => item.category === 'on_plan' && item.canFind);
  c._findInboxDevice(findable);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await c.updateComplete;
  result.findClosesAndSelects = !c._deviceInbox && c._selId === findable.deviceId;

  const after = JSON.stringify({
    config: c._serverCfg, layout: c._layout, cfgRev: c._cfgRev, layoutRev: c._layoutRev,
  });
  result.browsingIsReadOnly = before === after && writes.length === 0;
  return result;
});

checkAll(out);
await finish(browser, out);
