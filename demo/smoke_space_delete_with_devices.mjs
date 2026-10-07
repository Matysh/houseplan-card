// #819: «Удалить» у пространства с устройствами. Прокрутка к предупреждению
// и фокус на нём (1000×700 и 375×812, в том числе повторно после ручной
// прокрутки вверх), кнопка «Удалить пространство вместе с устройствами» в
// предупреждении, одно подтверждение с N и «в том числе скрытые: K», отмена
// без записи, одна запись `space/delete` c `remove_markers`, тост и привязки в
// «Доступны снова», конфликт ревизий без удаления. Сервер здесь — мок: что
// именно он удаляет, доказывает pytest на общей с карточкой фикстуре.
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1000, height: 700 });

const pass = (viewport) => page.evaluate(async ({ full }) => {
  const result = {};
  const card = window.__card;
  await card._ensureEditorRuntime();
  const root = () => card.renderRoot;
  const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = async () => { await card.updateComplete; await frames(); await card.updateComplete; };
  const until = async (predicate, timeout = 3000) => {
    const started = performance.now();
    while (!predicate()) {
      if (performance.now() - started > timeout) return false;
      await new Promise((resolve) => setTimeout(resolve, 20));
      await card.updateComplete;
    }
    return true;
  };
  const deepActive = () => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    return active;
  };
  // The one scrolling ancestor of the warning in the flat tree (slots included).
  const scrollerOf = (node) => {
    let element = node;
    while (element) {
      element = element.assignedSlot || element.parentElement
        || (element.parentNode instanceof ShadowRoot ? element.parentNode.host : null);
      if (element instanceof Element && /(auto|scroll)/.test(getComputedStyle(element).overflowY)
        && element.scrollHeight > element.clientHeight) return element;
    }
    return null;
  };
  const spaceDialog = () => root().querySelector('hp-dialog[data-kind="space"]');
  const warning = () => spaceDialog()?.querySelector('.hpf-callout[role="alert"]');
  const withDevices = () => warning()?.querySelector('button.btn.danger');
  const footerDelete = () => spaceDialog()?.querySelector('.dialog-action-danger button');
  const fullyVisible = (node) => {
    const scroller = scrollerOf(node);
    if (!node || !scroller) return false;
    const box = node.getBoundingClientRect();
    const port = scroller.getBoundingClientRect();
    return box.height > 0 && box.top >= port.top - 1 && box.bottom <= port.bottom + 1
      && box.bottom <= innerHeight + 1 && box.left >= -1 && box.right <= innerWidth + 1;
  };
  const confirmUi = () => {
    const dialog = root().querySelector('hp-confirm hp-dialog');
    return {
      open: !!dialog?.shadowRoot?.querySelector('dialog')?.open,
      text: dialog?.textContent?.replace(/\s+/g, ' ') || '',
      buttons: [...(dialog?.querySelectorAll('.danger-confirm-footer button') || [])],
    };
  };

  // ---- fake server: f1 holds a visible, a hidden and a virtual device -------
  const space = (id, title) => ({
    id, title, view_box: [0, 0, 1, 1], plan_url: null, cell_cm: 5, wall_segments: [], partitions: [],
    rooms: [{ id: `${id}-room`, name: title, poly: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]] }],
  });
  const server = {
    config: {
      model_version: 9,
      spaces: [space('f1', 'Ground floor'), space('garden', 'Garden'), space('attic', 'Attic')],
      markers: [
        { id: 'd_lamp', binding: 'device:d_lamp', space: 'f1', name: 'Floor lamp' },
        { id: 'd_tv', binding: 'device:d_tv', space: 'f1', room_id: 'f1-room', hidden: true },
        { id: 'note', binding: 'virtual', name: 'Note', icon: 'mdi:note-outline' },
        { id: 'd_gate', binding: 'device:d_gate', space: 'garden' },
      ],
      settings: { filter_seeded: true, known_devices: [], new_device_ids: [] },
    },
    layout: {
      d_lamp: { s: 'f1', x: 0.3, y: 0.3 },
      d_tv: { s: 'f1', x: 0.4, y: 0.4 },
      note: { s: 'f1', x: 0.5, y: 0.5 },
      d_gate: { s: 'garden', x: 0.5, y: 0.5 },
    },
    cfgRev: 10,
    layoutRev: 20,
    conflictNext: false,
  };
  const blocking = (spaceId) => {
    const rooms = new Set((server.config.spaces.find((item) => item.id === spaceId)?.rooms || []).map((room) => room.id));
    return server.config.markers.filter((marker) => marker.removed !== true && (marker.space === spaceId
      || rooms.has(marker.room_id) || server.layout[marker.id]?.s === spaceId)).map((marker) => marker.id).sort();
  };
  const calls = [];
  const structural = [];
  const services = [];
  // The demo backend of the page, not a wrapper left by an earlier pass.
  window.__hpDemoCallWS ||= card.hass.callWS.bind(card.hass);
  const baseCall = window.__hpDemoCallWS;
  card.hass = {
    ...card.hass,
    callService: async (...args) => { services.push(args); },
    callWS: async (message) => {
      calls.push(structuredClone(message));
      switch (message.type) {
        case 'houseplan/config/get':
          return { config: structuredClone(server.config), rev: server.cfgRev, can_write: true };
        case 'houseplan/layout/get':
          return { layout: structuredClone(server.layout), rev: server.layoutRev };
        case 'houseplan/space/delete': {
          if (message.expected_config_rev !== server.cfgRev || message.expected_layout_rev !== server.layoutRev
            || server.conflictNext) {
            if (server.conflictNext) {
              // Another client puts one more device on the floor first.
              server.config.markers.push({ id: 'd_kettle', binding: 'device:d_kettle', space: 'f1' });
              server.layout.d_kettle = { s: 'f1', x: 0.6, y: 0.6 };
              server.cfgRev += 1;
              server.layoutRev += 1;
              server.conflictNext = false;
            }
            throw Object.assign(new Error('Plan changed elsewhere'), { code: 'conflict' });
          }
          const ids = blocking(message.space_id);
          if (ids.length && !message.remove_markers) {
            throw Object.assign(new Error('in use'), { code: 'space_in_use' });
          }
          server.config.markers = server.config.markers.flatMap((marker) => !ids.includes(marker.id) ? [marker]
            : marker.binding === 'virtual' ? []
              : [{ id: marker.id, binding: marker.binding, removed: true, hidden: true }]);
          server.config.spaces = server.config.spaces.filter((item) => item.id !== message.space_id);
          for (const [key, position] of Object.entries(server.layout)) {
            if (position.s === message.space_id || ids.includes(key)) delete server.layout[key];
          }
          server.cfgRev += 1;
          server.layoutRev += 1;
          return {
            ok: true, config_rev: server.cfgRev, layout_rev: server.layoutRev, removed_markers: ids,
          };
        }
        case 'houseplan/config/set': {
          // Settings housekeeping (known devices) may land at any time; only a
          // write that touches spaces or markers belongs to the delete flow.
          const plan = ({ spaces, markers }) => JSON.stringify({ spaces, markers });
          if (plan(message.config) !== plan(server.config)) structural.push(message.type);
          server.config = structuredClone(message.config);
          server.cfgRev += 1;
          return { ok: true, rev: server.cfgRev };
        }
        default:
          if (/^houseplan\/layout\/(set|update|delete)$/.test(message.type)) {
            structural.push(message.type);
            server.layoutRev += 1;
            return { ok: true, rev: server.layoutRev };
          }
          return baseCall(message);
      }
    },
  };
  const hp = window.__hpTest;
  const toast = () => root().querySelector('[data-hp="toast"]')?.textContent.trim() || '';
  card._saveConfigDebounced.cancel();
  card._persistLayout.cancel();
  await card._writeChain;
  // The mock server's plan becomes the card's, as an authoritative re-read would.
  card._adoption.restoreCached({
    config: structuredClone(server.config), rev: server.cfgRev,
    layout: structuredClone(server.layout), layout_rev: server.layoutRev,
  });
  card.requestUpdate();
  await hp.settled();
  const writes = () => [...structural, ...calls.filter((call) => call.type === 'houseplan/space/delete')];

  // ---- AC1: the block scrolls the warning into view and focuses it --------
  await hp.openSpaceDialog('edit', 'f1');
  await settle();
  result.dialogOpensWithoutWarning = !!footerDelete() && !warning();
  footerDelete().click();
  await until(() => !!warning() && deepActive() === warning());
  await frames();
  const scroller = scrollerOf(warning());
  result.blockScrollsTheWarningIntoView = !!scroller && scroller.scrollTop > 0 && fullyVisible(warning());
  result.blockFocusesTheWarning = deepActive() === warning() && warning().tabIndex === -1;
  result.warningNamesTheCount = warning()?.textContent.includes('still used by 3 device');
  result.scrollIsInstant = !!scroller && getComputedStyle(scroller).scrollBehavior !== 'smooth';
  result.blockWritesNothing = writes().length === 0;

  if (scroller) scroller.scrollTop = 0;
  footerDelete().focus();
  await frames();
  const scrolledAway = !fullyVisible(warning()) && deepActive() === footerDelete();
  footerDelete().click();
  await until(() => deepActive() === warning());
  await frames();
  result.repeatAfterManualScrollRevealsAgain = scrolledAway && fullyVisible(warning())
    && deepActive() === warning();

  // ---- AC1/contract 2: the way out sits in the warning, danger style ------
  const button = withDevices();
  result.warningOffersDeleteWithDevices = !!button && button.textContent.trim() === 'Delete space with devices'
    && !button.disabled && button.getBoundingClientRect().right <= innerWidth + 1;
  // A Save in flight keeps the warning while the dialog is busy; pinned here
  // without a hanging request.
  card._spaceDialog = { ...card._spaceDialog, busy: true }; // private-ok: #819 busy exists only inside an in-flight write
  await settle();
  result.buttonDisabledWhileBusy = withDevices()?.disabled === true;
  card._spaceDialog = { ...card._spaceDialog, busy: false }; // private-ok: #819 restores the state pinned above
  await settle();
  // Without the button (an older card) the rest has nothing to press.
  if (!full || !withDevices()) return result;

  // ---- AC3: one danger confirmation with N and K; Cancel writes nothing ---
  const before = JSON.stringify({ config: card._serverCfg, layout: card._layout, rev: card._cfgRev, lrev: card._layoutRev });
  withDevices().click();
  await until(() => confirmUi().open);
  let ui = confirmUi();
  result.confirmNamesSpaceCountAndHidden = ui.open && ui.text.includes('Ground floor')
    && ui.text.includes('Its devices will be deleted too: 3.') && ui.text.includes('Including hidden: 1.');
  ui.buttons[0].click();
  await until(() => !confirmUi().open);
  await settle();
  result.cancelWritesNothing = writes().length === 0 && JSON.stringify({
    config: card._serverCfg, layout: card._layout, rev: card._cfgRev, lrev: card._layoutRev,
  }) === before && card._spaceDialog?.busy === false;

  // ---- AC4 (card side): the plan changed under the confirmation -----------
  withDevices().click();
  await until(() => confirmUi().open);
  card._serverCfg.markers.push({ id: 'd_motion', binding: 'device:d_motion', space: 'f1' });
  confirmUi().buttons[1].click();
  await until(() => !confirmUi().open);
  await until(() => warning()?.textContent.includes('still used by 4 device'));
  await frames();
  result.changedPlanUnderConfirmationDeletesNothing = writes().length === 0
    && card._spaceDialog?.busy === false && fullyVisible(warning()) && deepActive() === warning();
  card._serverCfg.markers.pop();
  // A card that deleted anyway has closed the dialog: nothing left to press.
  if (!card._spaceDialog) return result;
  footerDelete().click();
  await until(() => warning()?.textContent.includes('still used by 3 device'));

  // ---- AC4 (server side): revisions moved between confirmation and write --
  server.conflictNext = true;
  withDevices().click();
  await until(() => confirmUi().open);
  confirmUi().buttons[1].click();
  await until(() => calls.some((call) => call.type === 'houseplan/space/delete'));
  await until(() => warning()?.textContent.includes('still used by 4 device') && card._spaceDialog?.busy === false);
  await frames();
  const conflicted = calls.filter((call) => call.type === 'houseplan/space/delete');
  result.conflictKeepsSpaceAndMarkers = conflicted.length === 1 && conflicted[0].remove_markers === true
    && card._serverCfg.spaces.some((item) => item.id === 'f1')
    && ['d_lamp', 'd_tv', 'note', 'd_kettle'].every((id) => card._serverCfg.markers.some((marker) => marker.id === id && !marker.removed));
  result.conflictShowsCurrentCountNotBusy = card._spaceDialog?.busy === false
    && fullyVisible(warning()) && deepActive() === warning();
  // The other client takes its device away again; the card re-reads it.
  server.config.markers = server.config.markers.filter((marker) => marker.id !== 'd_kettle');
  delete server.layout.d_kettle;
  server.cfgRev += 1;
  server.layoutRev += 1;
  await Promise.all([card._reloadConfigOnly(true), card._reloadLayoutOnly()]);
  if (!card._spaceDialog) return result;
  footerDelete().click();
  await until(() => warning()?.textContent.includes('still used by 3 device'));

  // ---- AC2: confirm → one write with remove_markers → toast, Available again
  const revs = { config: card._cfgRev, layout: card._layoutRev };
  calls.length = 0;
  structural.length = 0;
  withDevices().click();
  await until(() => confirmUi().open);
  ui = confirmUi();
  result.confirmCountsTheCurrentSet = ui.text.includes('Its devices will be deleted too: 3.');
  ui.buttons[1].click();
  await until(() => card._spaceDialog === null);
  await until(() => toast() === 'Space deleted');
  result.toastSpaceDeleted = toast() === 'Space deleted';
  await settle();
  const deletes = calls.filter((call) => call.type === 'houseplan/space/delete');
  result.oneAtomicWriteWithTheFlag = deletes.length === 1 && deletes[0].space_id === 'f1'
    && deletes[0].remove_markers === true
    && deletes[0].expected_config_rev === revs.config && deletes[0].expected_layout_rev === revs.layout
    && writes().length === 1;
  const byId = Object.fromEntries(card._serverCfg.markers.map((marker) => [marker.id, marker]));
  result.markersBecomeTombstones = !card._serverCfg.spaces.some((item) => item.id === 'f1')
    && byId.d_lamp?.removed === true && byId.d_tv?.removed === true && !byId.note
    && byId.d_gate?.removed !== true
    && !card._layout.d_lamp && !card._layout.d_tv && !card._layout.note && !!card._layout.d_gate;
  result.noHomeAssistantChanges = services.length === 0
    && calls.every((call) => call.type.startsWith('houseplan/') || !/(update|remove|delete|create)/.test(call.type));
  await hp.setMode('devices');
  card._openDeviceInbox();
  await settle();
  root().querySelectorAll('.device-inbox-tabs [role="tab"]')[3]?.click();
  await settle();
  const readd = [...root().querySelectorAll('.device-inbox-row')].map((row) => row.dataset.binding);
  result.bindingsAvailableAgain = card._deviceInbox?.tab === 'readd'
    && readd.includes('device:d_lamp') && readd.includes('device:d_tv');
  await hp.close(root().querySelector('hp-dialog[data-kind="device-inbox"]') || root().querySelector('hp-dialog'));
  await hp.setMode('view');

  // ---- AC5: a space without devices keeps the old request and copy --------
  calls.length = 0;
  structural.length = 0;
  await hp.openSpaceDialog('edit', 'attic');
  await settle();
  footerDelete().click();
  await until(() => confirmUi().open);
  ui = confirmUi();
  result.plainDeleteKeepsOldCopy = !ui.text.includes('Its devices') && !warning();
  ui.buttons[1].click();
  await until(() => card._spaceDialog === null);
  const plain = calls.filter((call) => call.type === 'houseplan/space/delete');
  result.plainDeleteSendsNoNewKey = plain.length === 1 && !('remove_markers' in plain[0]);
  return result;
}, viewport);

const desktop = await pass({ full: true });
// The phone pass also runs with reduced motion: the reveal must not depend on it.
await page.setViewportSize({ width: 375, height: 812 });
await page.emulateMedia({ reducedMotion: 'reduce' });
const phone = await pass({ full: false });

const out = {
  ...desktop,
  ...Object.fromEntries(Object.entries(phone).map(([key, value]) => [`phone_${key}`, value])),
};
checkAll(out);
await finish(browser, out);
