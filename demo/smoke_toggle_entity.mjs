// #178: production-bundle contract for the exact Toggle-entity selector.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1180, height: 1000 });
const result = await page.evaluate(async () => {
  const out = {};
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const base = card._devices.find((device) =>
    device.bindingKind === 'device' && device.primary?.startsWith('light.'));
  const primary = base.primary;
  const secondary = 'switch.issue178_child_lock';

  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      [secondary]: {
        entity_id: secondary,
        state: 'off',
        attributes: { friendly_name: 'Child lock' },
      },
    },
    entities: {
      ...card.hass.entities,
      [secondary]: {
        entity_id: secondary,
        device_id: base.bindingRef,
        platform: 'issue178',
        disabled_by: null,
      },
    },
  };
  await card.updateComplete;

  // Keep the browser smoke independent from registry loading order while the
  // production resolver, dialog and persistence helpers remain unmodified.
  const realPreview = card._markerPreviewDevice.bind(card);
  card._markerPreviewDevice = (draft) => draft.devId === base.id ? {
    ...base,
    tapAction: draft.tapActionTouched ? draft.tapAction : 'toggle',
    entities: [primary, secondary],
    marker: {
      ...(base.marker || {}),
      id: base.id,
      binding: `device:${base.bindingRef}`,
      tap_action: 'toggle',
      toggle_entity: draft.toggleEntity || null,
    },
  } : realPreview(draft);

  card._openMarkerDialog({
    ...base,
    tapAction: 'toggle',
    entities: [primary, secondary],
    marker: {
      ...(base.marker || {}), id: base.id, binding: `device:${base.bindingRef}`,
      tap_action: 'toggle', toggle_entity: primary,
    },
  });
  await card.updateComplete;
  let select = root().querySelector('#marker-toggle-entity');
  if (!select) throw new Error(JSON.stringify({
    dialog: card._markerDialog,
    effectiveTapAction: card._effectiveMarkerTapAction(card._markerDialog),
    preview: card._markerPreviewDevice(card._markerDialog),
    selectIds: [...root().querySelectorAll('select')].map((item) => item.id),
  }));
  out.selectorForMultiple = !!select && select.options.length === 3;
  out.savedSelectionProjected = select?.value === primary;

  select.value = secondary;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await card.updateComplete;
  select = root().querySelector('#marker-toggle-entity');
  const hint = root().querySelector('#marker-toggle-hint')?.textContent || '';
  out.selectionUpdatesDraft = card._markerDialog.toggleEntity === secondary
    && select?.value === secondary;
  out.selectionUpdatesHintBeforeSave = hint.includes(secondary)
    && card._markerDialog.tapHintAnnouncement.includes(secondary);
  out.writerPersistsSelection = card._markerToggleEntityFields(card._markerDialog)
    .toggle_entity === secondary;

  // Re-open the persisted shape, then simulate a temporarily missing entity.
  card._markerDialog = null;
  card._openMarkerDialog({
    ...base,
    tapAction: 'toggle',
    entities: [primary, secondary],
    marker: {
      ...(base.marker || {}), id: base.id, binding: `device:${base.bindingRef}`,
      tap_action: 'toggle', toggle_entity: secondary,
    },
  });
  await card.updateComplete;
  out.reopenRestoresSelection = root().querySelector('#marker-toggle-entity')?.value === secondary;

  card._markerDialog = {
    ...card._markerDialog,
    toggleEntity: 'switch.issue178_removed',
    toggleEntityTouched: false,
    originalHasToggleEntity: true,
    originalToggleEntity: 'switch.issue178_removed',
  };
  await card.updateComplete;
  const warning = root().querySelector('.markertoggleentity [role="status"]');
  out.staleWarnsAndShowsAuto = root().querySelector('#marker-toggle-entity')?.value === ''
    && warning?.textContent?.includes('switch.issue178_removed');
  out.staleLiteralSurvives = card._markerToggleEntityFields(card._markerDialog)
    .toggle_entity === 'switch.issue178_removed';

  card._markerDialog = null;
  card._markerPreviewDevice = realPreview;
  const single = card._devices.find((device) =>
    device.bindingKind === 'device' && device.entities.filter((eid) =>
      eid.startsWith('light.') || eid.startsWith('switch.')).length === 1);
  card._openMarkerDialog({
    ...single,
    tapAction: 'toggle',
    marker: {
      ...(single.marker || {}), id: single.id, binding: `device:${single.bindingRef}`,
      tap_action: 'toggle',
    },
  });
  await card.updateComplete;
  out.singleEntityHidesSelector = !root().querySelector('#marker-toggle-entity');
  card._markerDialog = null;
  await card.updateComplete;
  return out;
});

checkAll(result, {});
await finish(browser, result);
