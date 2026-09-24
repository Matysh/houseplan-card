// #629: тестовый фасад харнесса window.__hpTest (demo/helpers/hp-test.mjs).
//
// Каждая операция доказывается наблюдаемым результатом настоящего пути:
// кнопка нажата — режим сменился в ha-card[data-hp-mode]; конфиг доставлен
// событием сервера — подпись комнаты на плане другая; ввод — по событию input
// на символ; закрытие — диалог отсоединился. Приватные поля карточки здесь
// только ЧИТАЮТСЯ (правило №6 docs/TESTING.md).
import { launch, check, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 1100, height: 820 }, 1);

const out = await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const hp = window.__hpTest;
  const sr = () => c.shadowRoot || c.renderRoot;
  const mode = () => sr().querySelector('ha-card')?.getAttribute('data-hp-mode');
  const errorOf = async (fn) => { try { await fn(); return null; } catch (error) { return String(error?.message || error); } };

  // P2/AC9: бандл сам фасад не определяет — его ставит харнесс.
  o.bundleDoesNotDefineFacade = hp?.preinstalled === false;
  o.facadeIsFrozen = Object.isFrozen(hp);

  // F/AC6: отсутствующий элемент — именованная ошибка, без отката на приватный метод.
  const viewError = await errorOf(() => hp.openRoomEdit('r2'));
  o.missingElementIsANamedError = !!viewError
    && viewError.includes('__hpTest.openRoomEdit')
    && viewError.includes('[data-hp="room-settings"][data-room="r2"]')
    && viewError.includes('режим view');
  o.noFallbackOpenedADialog = !sr().querySelector('[data-hp="dialog"]');

  // 1) setMode: настоящая вкладка режима, затем крестик редактора.
  await hp.setMode('plan');
  o.setModePlan = mode() === 'plan'
    && sr().querySelector('[data-hp="mode-tab"][data-mode="plan"]')?.classList.contains('active') === true;

  // 2) setTool: кнопка в панели активного редактора.
  const drawButton = await hp.setTool('draw');
  o.setToolDraw = c._tool === 'draw' && drawButton?.getAttribute('aria-pressed') === 'true';
  await hp.setTool('select');
  o.setToolSelect = c._tool === 'select';

  // 4) openRoomEdit + 9) input + 10) close через Escape.
  const roomDialog = await hp.openRoomEdit('r2');
  o.openRoomEdit = roomDialog?.getAttribute('data-kind') === 'room' && roomDialog.isConnected;
  const nameField = roomDialog.querySelector('#room-name');
  const events = [];
  nameField.addEventListener('input', (event) => events.push(event.inputType));
  const typed = 'Кухня 2';
  await hp.input(nameField, typed);
  o.inputTypesCharByChar = events.filter((type) => type === 'insertText').length === typed.length
    && events[0] === 'deleteContentBackward';
  o.inputReachesTheDraft = c._nameSel === typed && nameField.value === typed;
  const escaped = await hp.close(roomDialog, { via: 'escape' });
  // черновик изменён: закрытие либо спрашивает подтверждение, либо закрывает
  o.closeEscape = escaped.closed || !!escaped.confirm;
  if (escaped.confirm) {
    const discard = escaped.confirm.querySelector('[data-hp="dialog-confirm"]');
    discard?.click();
    await hp.settled();
  }
  o.roomDialogGone = !roomDialog.isConnected;

  // 10) close через крестик окна и через «Отмена» содержимого.
  const viaX = await hp.close(await hp.openRoomEdit('r2'), { via: 'x' });
  o.closeX = viaX.closed === true && viaX.confirm === null;
  const viaCancel = await hp.close(await hp.openRoomEdit('r2'), { via: 'cancel' });
  o.closeCancel = viaCancel.closed === true && viaCancel.confirm === null;

  // 7) setServerConfig: карточка сама перечитывает конфиг по событию сервера;
  // подписи комнат видны в редакторе плана.
  const revBefore = c._cfgRev;
  const labelText = () => [...sr().querySelectorAll('[data-hp="room-label"]')].map((el) => el.textContent.trim()).join('|');
  const rev = await hp.setServerConfig((cfg) => {
    cfg.spaces.find((space) => space.id === 'f1').rooms.find((room) => room.id === 'r2').name = 'Kitchen 2';
  });
  o.setServerConfigAdoptsRevision = rev > revBefore && c._cfgRev >= rev;
  o.setServerConfigRepaints = labelText().includes('Kitchen 2');

  // 5) openMarkerDialog: «Добавить устройство» и клик по маркеру в режиме устройств.
  await hp.setMode('devices');
  o.setModeDevices = mode() === 'devices';
  const addDialog = await hp.openMarkerDialog();
  o.openMarkerDialogAdd = addDialog?.getAttribute('data-kind') === 'marker';
  await hp.close(addDialog, { via: 'cancel' });
  const lampDialog = await hp.openMarkerDialog('d_lamp');
  o.openMarkerDialogDevice = lampDialog?.getAttribute('data-kind') === 'marker'
    && lampDialog.querySelector('#marker-name')?.value === 'Floor lamp';
  o.closeMarker = (await hp.close(lampDialog, { via: 'x' })).closed === true;

  // 6) openSpaceDialog: создание и настройки существующего пространства.
  const createDialog = await hp.openSpaceDialog('create');
  o.openSpaceDialogCreate = createDialog?.getAttribute('data-kind') === 'space';
  await hp.close(createDialog, { via: 'escape' });
  const editDialog = await hp.openSpaceDialog('edit', 'f1');
  o.openSpaceDialogEdit = editDialog?.getAttribute('data-kind') === 'space' && editDialog !== createDialog;
  await hp.close(editDialog, { via: 'escape' });
  o.spaceDialogsClosed = !createDialog.isConnected && !editDialog.isConnected;

  // 1) setMode('view') — крестиком на активной вкладке.
  await hp.setMode('view');
  o.setModeView = mode() === 'view'
    && !sr().querySelector('[data-hp="mode-tab"].active');

  // 3) switchSpace — настоящая вкладка пространства.
  await hp.switchSpace('garden');
  o.switchSpace = c._space === 'garden'
    && sr().querySelector('[data-hp="space-tab"][data-id="garden"]')?.getAttribute('aria-current') === 'page';
  await hp.switchSpace('f1');

  // 8) setLayout: позиция маркера меняется событием раскладки.
  const kettle = () => sr().querySelector('[data-hp="device"][data-id="d_kettle"]');
  const leftBefore = Number.parseFloat(kettle()?.style.left || 'NaN');
  const layoutRev = await hp.setLayout((layout) => { layout.d_kettle = { ...layout.d_kettle, x: 0.3, y: 0.3 }; });
  const leftAfter = Number.parseFloat(kettle()?.style.left || 'NaN');
  o.setLayoutAdoptsRevision = c._layoutRev >= layoutRev;
  o.setLayoutMovesTheMarker = Number.isFinite(leftBefore) && Number.isFinite(leftAfter)
    && Math.abs(leftAfter - leftBefore) > 5;
  return o;
});

for (const [name, value] of Object.entries(out)) check(name, value);
await finish(browser, out);
