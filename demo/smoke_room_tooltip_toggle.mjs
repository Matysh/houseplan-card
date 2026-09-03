import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const room = () => root().querySelector('.room');
  const pointer = (type, pointerType, x, y) => new PointerEvent(type, {
    pointerType, bubbles: true, composed: true, clientX: x, clientY: y,
  });
  const mouse = (type, x, y) => pointer(type, 'mouse', x, y);
  const out = {};

  card._openSettingsDialog();
  await card.updateComplete;
  const settingRow = [...root().querySelectorAll('hp-dialog label.srcrow')]
    .find((label) => label.textContent.trim() === 'Show the room information window on hover');
  out.localizedControl = !!settingRow?.querySelector('ha-switch,input[type="checkbox"]');
  out.defaultOn = card._settingsDialog?.showRoomTooltip === true;

  card._settingsDialog = { ...card._settingsDialog, showRoomTooltip: false };
  card._settingsDialog = null;
  out.cancelKeepsAbsentDefault = !Object.hasOwn(card._serverCfg.settings, 'show_room_tooltip');

  room().dispatchEvent(mouse('pointerenter', 180, 180));
  room().dispatchEvent(mouse('pointermove', 180, 180));
  await card.updateComplete;
  out.defaultRoomTip = card._tip?.room === true && !!root().querySelector('.tip');

  const originalCallWS = card.hass.callWS;
  const beforeRejectedSave = structuredClone(card._serverCfg);
  const beforeRejectedFingerprint = card._cfgContentFingerprint;
  card._openSettingsDialog();
  card._settingsDialog = {
    ...card._settingsDialog,
    colors: {
      ...card._settingsDialog.colors,
      light_on: { c: '#123456', a: 0.4 },
    },
    glowRadius: 4,
    bgColor: '#234567',
    northDeg: 45,
    bgMode: 'static',
    sunRays: true,
    showRoomTooltip: false,
  };
  card.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') throw new Error('offline');
    return originalCallWS(message);
  } };
  await card._saveSettingsDialog();
  await card.updateComplete;
  out.rejectedSettingsRolledBack = JSON.stringify(card._serverCfg)
    === JSON.stringify(beforeRejectedSave);
  out.rejectedFingerprintRolledBack = card._cfgContentFingerprint
    === beforeRejectedFingerprint;
  out.rejectedDraftKept = card._settingsDialog?.showRoomTooltip === false
    && card._settingsDialog?.bgColor === '#234567'
    && card._settingsDialog?.colors.light_on.c === '#123456';
  out.rejectedBusyCleared = card._settingsDialog?.busy === false;
  card._tip = null;
  room().dispatchEvent(mouse('pointermove', 185, 185));
  await card.updateComplete;
  out.rejectedRuntimeUsesServerSettings = card._tip?.room === true;

  const authoritative = structuredClone(beforeRejectedSave);
  authoritative.settings = { ...authoritative.settings, bg_color: '#345678' };
  const authoritativeRev = card._cfgRev + 5;
  card._openSettingsDialog();
  card._settingsDialog = {
    ...card._settingsDialog, bgColor: '#abcdef', showRoomTooltip: false,
  };
  card.hass = { ...card.hass, callWS: async (message) => {
    if (message.type === 'houseplan/config/set') {
      throw Object.assign(new Error('conflict'), { code: 'conflict' });
    }
    if (message.type === 'houseplan/config/get') {
      return { config: structuredClone(authoritative), rev: authoritativeRev, can_write: true };
    }
    return originalCallWS(message);
  } };
  await card._saveSettingsDialog();
  await card.updateComplete;
  out.conflictKeepsAuthoritative = card._serverCfg.settings.bg_color === '#345678'
    && !Object.hasOwn(card._serverCfg.settings, 'show_room_tooltip')
    && card._cfgRev === authoritativeRev;
  out.conflictDraftKept = card._settingsDialog?.bgColor === '#abcdef'
    && card._settingsDialog?.showRoomTooltip === false
    && card._settingsDialog?.busy === false;
  card.hass = { ...card.hass, callWS: originalCallWS };

  card._openSettingsDialog();
  card._settingsDialog = { ...card._settingsDialog, showRoomTooltip: false };
  await card._saveSettingsDialog();
  await card.updateComplete;
  out.falsePersists = card._serverCfg.settings.show_room_tooltip === false;
  out.visibleRoomTipCleared = card._tip === null && !root().querySelector('.tip');

  let roomAreaCalls = 0;
  const originalRoomArea = card._roomArea.bind(card);
  card._roomArea = (...args) => {
    roomAreaCalls += 1;
    return originalRoomArea(...args);
  };
  room().dispatchEvent(mouse('pointerenter', 190, 190));
  room().dispatchEvent(mouse('pointermove', 190, 190));
  await card.updateComplete;
  out.disabledRoomTip = card._tip === null && !root().querySelector('.tip');
  out.disabledSkipsArea = roomAreaCalls === 0;
  out.roomHighlightSurvives = card._hoverRoom !== null
    && !!root().querySelector('.room-hover-fill-layer,.room-hover-outline-layer');

  // The card also has a capture-phase gesture safety net. Remove that one
  // listener briefly so this probe proves the room's tooltip-off early-return
  // branch owns modality rather than receiving accidental parent coverage.
  const gestureOwner = root().querySelector('ha-card');
  gestureOwner.removeEventListener('pointermove', card._touchGestureGuard, { capture: true });
  room().dispatchEvent(pointer('pointermove', 'pen', 190, 190));
  await card.updateComplete;
  out.disabledPenMoveUpdatesModality = card._pointerModality.modality === 'pen';
  out.disabledPenMoveClearsMouseHover = card._hoverRoom === null && card._tip === null;
  room().dispatchEvent(mouse('pointerenter', 195, 195));
  room().dispatchEvent(mouse('pointermove', 195, 195));
  room().dispatchEvent(pointer('pointermove', 'touch', 195, 195));
  await card.updateComplete;
  out.disabledTouchMoveUpdatesModality = card._pointerModality.modality === 'touch';
  out.disabledTouchMoveClearsMouseHover = card._hoverRoom === null && card._tip === null;
  out.disabledNonMouseMovesStillSkipArea = roomAreaCalls === 0;
  gestureOwner.addEventListener('pointermove', card._touchGestureGuard, { capture: true });

  root().querySelector('.dev').dispatchEvent(mouse('pointermove', 200, 200));
  await card.updateComplete;
  out.deviceTipSurvives = card._tip?.room === false && !!root().querySelector('.tip');

  card._openSettingsDialog();
  out.reopenShowsOff = card._settingsDialog?.showRoomTooltip === false;
  card._settingsDialog = { ...card._settingsDialog, showRoomTooltip: true };
  await card._saveSettingsDialog();
  await card.updateComplete;
  out.trueStoredAsAbsent = !Object.hasOwn(card._serverCfg.settings, 'show_room_tooltip');
  out.enableDoesNotRestoreStaleTip = card._tip?.room !== true;

  room().dispatchEvent(mouse('pointermove', 210, 210));
  await card.updateComplete;
  out.roomTipRestoredOnMove = card._tip?.room === true && !!root().querySelector('.tip');
  return out;
});

checkAll(result, {
  localizedControl: true,
  defaultOn: true,
  cancelKeepsAbsentDefault: true,
  defaultRoomTip: true,
  rejectedSettingsRolledBack: true,
  rejectedFingerprintRolledBack: true,
  rejectedDraftKept: true,
  rejectedBusyCleared: true,
  rejectedRuntimeUsesServerSettings: true,
  conflictKeepsAuthoritative: true,
  conflictDraftKept: true,
  falsePersists: true,
  visibleRoomTipCleared: true,
  disabledRoomTip: true,
  disabledSkipsArea: true,
  roomHighlightSurvives: true,
  disabledPenMoveUpdatesModality: true,
  disabledPenMoveClearsMouseHover: true,
  disabledTouchMoveUpdatesModality: true,
  disabledTouchMoveClearsMouseHover: true,
  disabledNonMouseMovesStillSkipArea: true,
  deviceTipSurvives: true,
  reopenShowsOff: true,
  trueStoredAsAbsent: true,
  enableDoesNotRestoreStaleTip: true,
  roomTipRestoredOnMove: true,
});
await finish(browser, result);
