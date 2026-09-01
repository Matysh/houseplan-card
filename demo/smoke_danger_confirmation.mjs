// #32: one House Plan confirmation surface owns destructive actions in View,
// onboarding and every editor.  This smoke covers the real dialog contract,
// then exercises every migrated mutation class through both lazy runtimes.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 320, height: 760 });
const out = await page.evaluate(async () => {
  const result = {};
  const card = window.__card;
  await card._ensureOnboardingRuntime();
  const editor = card._editorRuntime;
  const onboarding = card._onboardingRuntime;
  const root = () => card.shadowRoot || card.renderRoot;
  const settle = async () => {
    await card.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };
  const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  const request = (key = 'delete-plan') => ({
    key,
    kind: 'destructive',
    title: card._t('confirm.delete_plan_title'),
    message: card._t('confirm.delete_plan_body'),
    objectName: 'A deliberately very long plan filename — Grundriss für das Dachgeschoss.png',
    confirmLabel: card._t('btn.delete'),
    cancelLabel: card._t('btn.cancel'),
  });
  const visible = () => {
    const component = root().querySelector('hp-confirm');
    const dialog = component?.querySelector('hp-dialog');
    return {
      component,
      dialog,
      native: dialog?.shadowRoot?.querySelector('dialog'),
      surface: dialog?.shadowRoot?.querySelector('.surface'),
      footer: dialog?.querySelector('.danger-confirm-footer'),
      buttons: [...(dialog?.querySelectorAll('.danger-confirm-footer button') || [])],
    };
  };

  const opener = document.createElement('button');
  opener.textContent = 'danger action';
  root().append(opener);
  opener.focus();
  const cancelled = card._confirmDanger(request());
  await settle();
  let ui = visible();
  result.sharedDialogVisible = !!ui.component && !!ui.native?.open
    && ui.dialog?.title === card._t('confirm.delete_plan_title');
  result.cancelHasInitialFocus = deepActive() === ui.buttons[0]
    && ui.buttons[0]?.hasAttribute('autofocus');
  result.narrowContentFits = !!ui.surface && !!ui.footer
    && ui.surface.getBoundingClientRect().left >= -1
    && ui.surface.getBoundingClientRect().right <= innerWidth + 1
    && ui.surface.scrollWidth <= ui.surface.clientWidth + 1
    && ui.footer.scrollWidth <= ui.footer.clientWidth + 1
    && ui.buttons.every((button) => button.getBoundingClientRect().right <= innerWidth + 1);
  ui.buttons[0].click();
  result.cancelButtonIsSafe = await cancelled === false;
  await settle();
  result.cancelRestoresFocus = deepActive() === opener;

  const accepted = card._confirmDanger(request());
  await settle();
  ui = visible();
  ui.buttons[1].click();
  result.acceptButtonResolvesOnce = await accepted === true;

  const escaped = card._confirmDanger(request('escape'));
  await settle();
  deepActive()?.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'Escape', bubbles: true, composed: true, cancelable: true,
  }));
  result.escapeIsSafe = await escaped === false;

  const closed = card._confirmDanger(request('close'));
  await settle();
  visible().dialog.shadowRoot.querySelector('.close').click();
  result.closeIsSafe = await closed === false;

  const scrimmed = card._confirmDanger(request('scrim'));
  await settle();
  const native = visible().native;
  native.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  result.scrimIsSafe = await scrimmed === false;

  const first = card._confirmDanger(request('first'));
  const second = card._confirmDanger(request('second'));
  await settle();
  visible().buttons[1].click();
  result.replacementCancelsOldRequest = await first === false && await second === true;

  const localeFits = async (language, expectedCancel) => {
    card._config = { ...(card._config || {}), language };
    card.requestUpdate();
    for (let attempt = 0; attempt < 50 && card._t('btn.cancel') !== expectedCancel; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await settle();
    }
    const pending = card._confirmDanger(request(`locale-${language}`));
    await settle();
    const current = visible();
    const fits = current.buttons[0]?.textContent.trim() === expectedCancel
      && current.surface.scrollWidth <= current.surface.clientWidth + 1
      && current.footer.scrollWidth <= current.footer.clientWidth + 1;
    current.buttons[0].click();
    await pending;
    return fits;
  };
  result.germanNarrowFits = await localeFits('de', 'Abbrechen');
  result.frenchNarrowFits = await localeFits('fr', 'Annuler');
  opener.remove();

  // From here the UI promise is replaced with deterministic decisions so the
  // action matrix can prove mutation ownership independently of layout.
  const originalConfirm = card._confirmDanger;
  let decision = false;
  card._confirmDanger = async () => decision;
  let geometryCommits = 0;
  editor._geometrySnapshot = () => ({ spaceId: 'danger-space' });
  editor._commitPhysicalGeometry = () => { geometryCommits++; return true; };

  const baseSpace = () => ({
    id: 'danger-space', title: 'Danger space', cell_cm: 5,
    view_box: [0, 0, 1, 1], rooms: [], settings: {},
  });
  const setDraft = (draft) => {
    card._space = 'danger-space';
    card._serverCfg = { spaces: [{ ...baseSpace(), room_drafts: [draft] }], markers: [], settings: {} };
  };

  setDraft({ id: 'draft-whole', points: [[0, 0], [1, 0]], segments: [{ cm: 10 }] });
  card._physicalDialog = { kind: 'draft', id: 'draft-whole', segment: 0, cm: '10', length: '1 m' };
  await editor._deleteDraftWhole();
  const wholeCancel = card._serverCfg.spaces[0].room_drafts.length === 1 && geometryCommits === 0;
  decision = true;
  await editor._deleteDraftWhole();
  result.draftWholeCancelAccept = wholeCancel
    && !card._serverCfg.spaces[0].room_drafts && geometryCommits === 1;

  decision = false;
  setDraft({
    id: 'draft-segment', points: [[0, 0], [0.5, 0], [1, 0]],
    segments: [{ cm: 10 }, { cm: 10 }],
  });
  card._physicalDialog = { kind: 'draft', id: 'draft-segment', segment: 0, cm: '10', length: '1 m' };
  await editor._deleteDraftSegment();
  const segmentCancel = card._serverCfg.spaces[0].room_drafts[0].segments.length === 2
    && geometryCommits === 1;
  decision = true;
  await editor._deleteDraftSegment();
  result.draftSegmentCancelAccept = segmentCancel
    && card._serverCfg.spaces[0].room_drafts[0].segments.length === 1
    && geometryCommits === 2;

  let configSaves = 0;
  editor._saveConfigNow = async () => { configSaves++; };
  card._serverCfg = {
    spaces: [baseSpace()], settings: {},
    markers: [{ id: 'danger-marker', binding: 'entity:switch.danger', space: 'danger-space' }],
  };
  card._devices = [];
  // #404 AC5: объявленный тип требует binding и bindingMode, и без них
  // _bindingHasHaPage падал на undefined.split(':') — два необработанных
  // исключения, которых гард не видел. Дефекта поведения тут нет: все 15 мест
  // в src/, создающих диалог, binding пишут; врала фикстура.
  card._markerDialog = {
    devId: 'danger-marker', name: 'Danger marker', busy: false,
    binding: 'entity:switch.danger', bindingMode: 'ha', bindingOpen: false,
  };
  decision = false;
  await editor._deleteMarker();
  const markerCancel = card._serverCfg.markers.length === 1 && configSaves === 0;
  decision = true;
  await editor._deleteMarker();
  result.markerCancelAccept = markerCancel && card._serverCfg.markers.length === 1
    && card._serverCfg.markers[0].id === 'danger-marker'
    && card._serverCfg.markers[0].removed === true
    && card._serverCfg.markers[0].hidden === true && configSaves === 1;

  const wsCalls = [];
  card.hass = {
    ...card.hass,
    callWS: async (message) => {
      wsCalls.push(message);
      if (message.type === 'houseplan/config/get') return { config: card._serverCfg, rev: 1 };
      if (message.type === 'houseplan/layout/get') return { layout: card._layout, rev: 1 };
      return {};
    },
  };
  const setPlanDialog = () => {
    card._spaceDialog = {
      mode: 'edit', spaceId: 'danger-space', title: 'Danger space', planUrl: null,
      planFile: null, source: 'draw', showBorders: true, showNames: true,
      zeroWallStyle: 'dashed', displayTouched: true, hideDecor: false,
      hideOpenings: false, roomColor: '#888888', roomOpacity: 1, bgColor: null,
      bgMode: null, northDeg: null, sunRays: null, fillMode: 'custom', customFill: null,
      glowEnabled: true, tempMin: 15, tempMax: 30, showLqi: true, cardFontScale: 1,
      labelTemp: true, labelHum: true, labelLqi: true, labelLight: true, cellCm: 5,
      busy: false, saved: [{ name: 'old.png', url: '/old.png', size: 1, modified: 1, used_by: [] }],
    };
  };
  for (const [name, runtime] of [['editor', editor], ['onboarding', onboarding]]) {
    setPlanDialog();
    decision = false;
    const before = wsCalls.length;
    await runtime._deleteServerPlan('old.png');
    const cancelSafe = wsCalls.length === before;
    decision = true;
    await runtime._deleteServerPlan('old.png');
    result[`${name}PlanCancelAccept`] = cancelSafe
      && wsCalls.filter((call) => call.type === 'houseplan/plans/delete').length
        === (name === 'editor' ? 1 : 2);
  }

  card._saveConfigDebounced.cancel();
  card._persistLayout.cancel();
  card._writeChain = Promise.resolve();
  card._adoptStructuralResponses = () => ({ configChanged: false, layoutChanged: false });
  for (const [name, runtime] of [['editor', editor], ['onboarding', onboarding]]) {
    card._space = 'another-space';
    card._serverCfg = { spaces: [baseSpace()], markers: [], settings: {} };
    setPlanDialog();
    decision = false;
    const before = wsCalls.filter((call) => call.type === 'houseplan/space/delete').length;
    await runtime._deleteSpace();
    const cancelSafe = wsCalls.filter((call) => call.type === 'houseplan/space/delete').length === before;
    decision = true;
    await runtime._deleteSpace();
    result[`${name}SpaceCancelAccept`] = cancelSafe
      && wsCalls.filter((call) => call.type === 'houseplan/space/delete').length === before + 1;
  }

  const services = [];
  card._openingEntityAvailable = () => true;
  card._openingInfo = {
    id: 'door', type: 'door', rx: 0.5, ry: 0.5, len_cm: 90, lock: 'lock.danger',
  };
  card.hass = {
    ...card.hass,
    states: {
      ...card.hass.states,
      'lock.danger': { entity_id: 'lock.danger', state: 'locked', attributes: { friendly_name: 'Door' } },
    },
    callService: async (...args) => { services.push(args); },
  };
  decision = false;
  await card._lockAction('lock.danger', 'unlock');
  const unlockCancel = services.length === 0;
  decision = true;
  await card._lockAction('lock.danger', 'unlock');
  result.unlockCancelAccept = unlockCancel && services.length === 1
    && services[0][0] === 'lock' && services[0][1] === 'unlock';

  let resolveRace;
  card._confirmDanger = () => new Promise((resolve) => { resolveRace = resolve; });
  setDraft({ id: 'race-draft', points: [[0, 0], [1, 0]], segments: [{ cm: 10 }] });
  card._physicalDialog = { kind: 'draft', id: 'race-draft', segment: 0, cm: '10', length: '1 m' };
  const raced = editor._deleteDraftWhole();
  card._space = 'changed-space';
  resolveRace(true);
  await raced;
  result.staleContextCannotMutate = card._serverCfg.spaces[0].room_drafts.length === 1
    && geometryCommits === 2;
  card._confirmDanger = originalConfirm;
  return result;
});

checkAll(out);
await finish(browser, out);
