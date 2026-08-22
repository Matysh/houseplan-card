// #244: production-bundle coverage for Optimize reference preview/apply/undo,
// remaining-only warning, space-delete blocker and invalid default_floor UI.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 920, height: 900 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  const clone = (value) => structuredClone(value);
  const original = {
    model_version: 6,
    spaces: [{
      id: 'home', title: 'Home', view_box: [0, 0, 1, 1], cell_cm: 5,
      rooms: [{ id: 'living', name: 'Living', area: null, poly: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
    }],
    markers: [
      {
        id: 'orphan', binding: 'virtual', space: 'gone', name: 'Kept marker',
        icon: 'mdi:washing-machine', description: 'must survive',
      },
      {
        // Independent from the Optimize→Undo cycle: this is the actual
        // dependency of the later attempt to delete `home`.
        id: 'home-blocker', binding: 'virtual', space: 'home', name: 'Home blocker',
      },
    ],
    settings: {},
  };
  const originalLayout = {
    orphan: { s: 'gone', x: 0.25, y: 0.5, k: 1.1 },
    opaque_owner: { s: 'gone', x: 0.6, y: 0.7 },
  };
  let serverConfig = clone(original);
  let serverLayout = clone(originalLayout);
  let backup = null;
  const calls = [];
  const baseCall = card.hass.callWS.bind(card.hass);
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      if (message.type === 'houseplan/plan/optimize') {
        calls.push(message.type);
        backup = { config: clone(serverConfig), layout: clone(serverLayout) };
        serverConfig = clone(message.config);
        serverLayout = clone(message.layout);
        return { ok: true, config_rev: 2, layout_rev: 2, can_undo: true };
      }
      if (message.type === 'houseplan/plan/optimize_undo') {
        calls.push(message.type);
        serverConfig = clone(backup.config);
        serverLayout = clone(backup.layout);
        return { ok: true };
      }
      if (message.type === 'houseplan/space/delete') {
        calls.push(message.type);
        throw Object.assign(new Error('in use'), { code: 'space_in_use' });
      }
      if (message.type === 'houseplan/config/get') {
        return { config: clone(serverConfig), rev: 3, can_write: true };
      }
      if (message.type === 'houseplan/layout/get') {
        return { layout: clone(serverLayout), rev: 3 };
      }
      return baseCall(message);
    },
  };
  card._config = { ...card._config, language: 'en' };
  card._serverStorage = true;
  card._serverCfg = clone(original);
  card._layout = clone(originalLayout);
  card._space = 'home';
  card._cfgRev = 1;
  card._layoutRev = 1;
  card._modelCache = null;
  card._regSignature = '';
  card._maybeRebuildDevices();
  card.requestUpdate();
  await card.updateComplete;

  card._openAlignDialog();
  await card.updateComplete;
  const preview = card._alignDialog;
  const previewText = card.renderRoot.querySelector('hp-dialog .body')?.textContent || '';
  result.previewSeparatesRepairAndDebt = preview?.report.markersDetached === 1
    && preview.report.positionsUnresolved === 1
    && preview.report.deadSpaceIds.join(',') === 'gone'
    && previewText.includes('devices detached from missing spaces — 1')
    && previewText.includes('unresolved positions — 1');
  result.previewPreservesMarkerSettings = preview?.config.markers[0].description === 'must survive'
    && preview.config.markers[0].space === undefined
    && preview.layout.orphan === undefined
    && preview.layout.opaque_owner.s === 'gone';
  result.previewOffersOneApplyWithoutWriting = !!card.renderRoot.querySelector('hp-dialog .btn.on')
    && calls.length === 0;

  card._alignDialog = null;
  await card.updateComplete;
  result.cancelWritesNothing = calls.length === 0;

  card._openAlignDialog();
  await card.updateComplete;
  await card._runAlignToGrid();
  await card.updateComplete;
  result.applyUsesExactAtomicEndpoint = calls.filter((type) => type === 'houseplan/plan/optimize').length === 1;
  const restored = card._devices.find((device) => device.id === 'orphan');
  result.applyRestoresMarkerToView = restored?.space === 'home'
    && restored.icon === 'mdi:washing-machine'
    && !!card.renderRoot.querySelector('.dev[data-id="orphan"]');

  card._openAlignDialog();
  await card.updateComplete;
  const noOpText = card.renderRoot.querySelector('hp-dialog .body')?.textContent || '';
  result.remainingOnlyWarningHasNoApply = card._alignDialog?.changed === false
    && noOpText.includes('All plans already use the current optimized data model.')
    && noOpText.includes('unresolved positions — 1')
    && !card.renderRoot.querySelector('hp-dialog .btn.on');
  card._alignDialog = null;
  await card.updateComplete;

  await card._undoPlanOptimization();
  await card.updateComplete;
  result.undoRestoresDeadRefs = card._serverCfg.markers[0].space === 'gone'
    && card._layout.orphan.s === 'gone'
    && !card.renderRoot.querySelector('.dev[data-id="orphan"]');

  let nativeConfirmCalls = 0;
  const oldConfirm = window.confirm;
  window.confirm = () => { nativeConfirmCalls++; return true; };
  card._openSpaceDialog('edit', 'home');
  await card.updateComplete;
  await card._deleteSpace();
  await card.updateComplete;
  const blocker = card.renderRoot.querySelector('hp-dialog [role="alert"]')?.textContent || '';
  result.deleteExplainsBlockerWithoutConfirmOrWrite = nativeConfirmCalls === 0
    && blocker.includes('still used by 1 device')
    && !calls.includes('houseplan/space/delete')
    && card._spaceDialog?.spaceId === 'home';
  window.confirm = oldConfirm;
  card._spaceDialog = null;
  await card.updateComplete;

  const editor = document.createElement('houseplan-card-editor');
  editor.hass = {
    ...card.hass,
    callWS: async (message) => message.type === 'houseplan/config/get'
      ? { config: { spaces: [{ id: 'home', title: 'Home' }] } }
      : baseCall(message),
  };
  editor.setConfig({ type: 'custom:houseplan-card', default_floor: 'gone', kiosk: true });
  document.body.append(editor);
  await editor.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await editor.updateComplete;
  const editorAlert = editor.renderRoot.querySelector('[role="alert"]')?.textContent || '';
  result.editorKeepsRawInvalidDefault = editorAlert.includes(
    'Initial space “gone” no longer exists. Choose another space.',
  ) && editor._config.default_floor === 'gone' && editor._config.kiosk === true;
  editor.remove();
  return result;
});

await finish(browser, checkAll(out));
