import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch();
const result = await page.evaluate(async () => {
  const card = window.__card;
  const root = () => card.shadowRoot || card.renderRoot;
  const room = () => root().querySelector('.room');
  const mouse = (type, x, y) => new PointerEvent(type, {
    pointerType: 'mouse', bubbles: true, composed: true, clientX: x, clientY: y,
  });
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
  falsePersists: true,
  visibleRoomTipCleared: true,
  disabledRoomTip: true,
  disabledSkipsArea: true,
  roomHighlightSurvives: true,
  deviceTipSurvives: true,
  reopenShowsOff: true,
  trueStoredAsAbsent: true,
  enableDoesNotRestoreStaleTip: true,
  roomTipRestoredOnMove: true,
});
await finish(browser, result);
