// #113: deleting the final space and receiving an empty plan over WS must be
// a supported lifecycle state, not a synthetic SpaceModel or an exception.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 820, height: 760 });

const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const root = () => card.shadowRoot || card.renderRoot;
  const settle = async () => {
    await card.updateComplete;
    await sleep(40);
    await card.updateComplete;
  };
  const original = structuredClone(card._serverCfg);
  const first = structuredClone(original.spaces[0]);
  const retainedMarker = {
    id: '__issue244_retained', binding: 'virtual', space: first.id,
    name: 'Retained marker', icon: 'mdi:lightbulb',
    actions: [{ tap: 'more-info' }], description: 'must survive final space delete',
  };
  let serverConfig = {
    ...structuredClone(original),
    spaces: [first],
    markers: [...(structuredClone(original.markers) || []), retainedMarker],
  };
  let serverLayout = {
    ...structuredClone(card._layout || {}),
    [retainedMarker.id]: { s: first.id, x: 0.4, y: 0.6 },
  };
  const markersBeforeDelete = structuredClone(serverConfig.markers);
  const firstRoomIds = new Set((first.rooms || []).map((room) => room.id));
  const affectedMarkerIds = new Set((serverConfig.markers || [])
    .filter((marker) => marker.space === first.id || firstRoomIds.has(marker.room_id)
      || serverLayout[marker.id]?.s === first.id)
    .map((marker) => marker.id));
  const baseCall = card.hass.callWS.bind(card.hass);
  let deleteCalls = 0;
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/space/delete') {
        deleteCalls++;
        const target = message.space_id;
        const space = serverConfig.spaces.find((item) => item.id === target);
        const roomIds = new Set((space?.rooms || []).map((room) => room.id));
        serverConfig = {
          ...serverConfig,
          spaces: serverConfig.spaces.filter((item) => item.id !== target),
          markers: (serverConfig.markers || []).map((marker) => {
            const affected = marker.space === target || roomIds.has(marker.room_id)
              || serverLayout[marker.id]?.s === target;
            if (!affected) return marker;
            const detached = { ...marker };
            delete detached.space;
            delete detached.room_id;
            return detached;
          }),
        };
        serverLayout = Object.fromEntries(
          Object.entries(serverLayout).filter(([, position]) => position?.s !== target),
        );
        return { ok: true, config_rev: 2, layout_rev: 2 };
      }
      if (message.type === 'houseplan/config/get') {
        return { config: structuredClone(serverConfig), rev: 2, can_write: true };
      }
      if (message.type === 'houseplan/layout/get') {
        return { layout: structuredClone(serverLayout), rev: 2 };
      }
      return baseCall(message);
    },
  };

  // Exercise the real delete command with exactly one remaining space.
  card._serverCfg = structuredClone(serverConfig);
  card._space = first.id;
  card._cfgEpoch++;
  card.requestUpdate();
  await settle();
  card._openSpaceDialog('edit', first.id);
  card._mode = 'plan';
  card._path = [[100, 100], [200, 100]];
  card._resumeDraftBySpace = { [first.id]: 'stale-draft' };
  card._pointers.set(113, { x: 10, y: 10 });
  card._drag = { id: 'stale-device', sx: 0, sy: 0, ox: 0, oy: 0, moved: true };
  card._saveConfigDebounced();
  const confirmBefore = card._confirmDanger;
  card._confirmDanger = async () => true;
  try {
    await card._deleteSpace();
  } finally {
    card._confirmDanger = confirmBefore;
  }
  await settle();

  out.deleteLastRendersEmpty = !!root().querySelector('.empty') && !root().querySelector('.stage');
  out.deleteLastClearsSelection = card._space === '' && card._spaceModel() === undefined;
  out.deleteLastAbortsEditorState = card._mode === 'view'
    && card._path.length === 0 && card._pointers.size === 0 && card._drag === null
    && Object.keys(card._resumeDraftBySpace).length === 0;
  out.deleteLastClosesEditDialog = card._spaceDialog === null;
  out.deleteLastCancelsPendingWrite = card._saveConfigDebounced.pending() === false;
  out.deleteLastUsesAuthoritativeEndpoint = deleteCalls === 1;
  const retainedAfterDelete = serverConfig.markers.find((marker) => marker.id === retainedMarker.id);
  out.deleteLastPreservesMarkersWithoutPlacement = serverConfig.markers.length === markersBeforeDelete.length
    && affectedMarkerIds.size > 0
    && serverConfig.markers.filter((marker) => affectedMarkerIds.has(marker.id))
      .every((marker) => marker.space === undefined && marker.room_id === undefined)
    && Object.values(serverLayout).every((position) => position?.s !== first.id)
    && retainedAfterDelete?.binding === retainedMarker.binding
    && retainedAfterDelete?.icon === retainedMarker.icon
    && retainedAfterDelete?.description === retainedMarker.description
    && JSON.stringify(retainedAfterDelete?.actions) === JSON.stringify(retainedMarker.actions);

  // The empty state still owns global recovery flows.
  const add = root().querySelector('.empty button.btn.on');
  add?.click();
  await settle();
  out.createFlowSurvivesEmpty = card._spaceDialog?.mode === 'create';

  // Recreate a plan, then reproduce the same transition as a config-updated WS
  // event. This also arms the once-per-empty cleanup for a second cycle.
  card._spaceDialog = null;
  card._serverCfg = structuredClone(original);
  card._space = original.spaces[0].id;
  card._cfgEpoch++;
  card.requestUpdate();
  await settle();
  out.recreateRestoresPlan = !!root().querySelector('.stage') && card._spaceModel()?.id === card._space;

  card._mode = 'devices';
  card._pointers.set(114, { x: 20, y: 20 });
  card._serverCfg = { ...structuredClone(original), spaces: [] };
  card._cfgEpoch++;
  card.requestUpdate();
  await settle();
  out.wsEmptyAbortsLiveGesture = card._mode === 'view'
    && card._pointers.size === 0 && card._spaceModel() === undefined;

  // Empty plans must remain inert under unrelated HA/render ticks.
  card._serverCanWrite = false;
  card.hass = {
    ...card.hass,
    themes: { ...(card.hass.themes || {}), darkMode: !card.hass.themes?.darkMode },
  };
  window.dispatchEvent(new Event('resize'));
  await settle();
  out.emptySurvivesThemeResizeReadonly = !!root().querySelector('.empty')
    && !root().querySelector('.stage') && card._mode === 'view';

  return out;
});

checkAll(result);
await finish(browser, result);
