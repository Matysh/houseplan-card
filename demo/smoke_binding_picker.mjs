// Пикер привязок: что пользователь видит в списке «Добавить» (#263).
//
// Зачем смок, а не юнит-тест. `_bindingCandidates` — приватный метод карточки,
// читающий `_planHass`, `_devices`, `_markers` и состояние диалога. Переписать
// его логику в тесте значит проверять копию: ровно так дефект #262 и дожил до
// отчёта пользователя — надгробия были покрыты со всех сторон, а список никто
// не спрашивал. Здесь дёргается настоящий метод собранного бандла.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
const out = {};

Object.assign(out, await page.evaluate(async () => {
  const o = {};
  const c = window.__card;
  const nativeConfirm = window.confirm;

  // Пикер читает `showEntities` и `bindingFilter` из открытого диалога, поэтому
  // спрашивать его при закрытом бессмысленно: отдельные сущности устройств не
  // перечисляются вовсе, и «сущность вернулась» ничего не значило бы.
  const openAdd = async (showEntities) => {
    c._openMarkerDialog();
    await c.updateComplete;
    c._markerDialog = { ...c._markerDialog, showEntities: !!showEntities, bindingFilter: '' };
    await c.updateComplete;
  };
  const offered = async (showEntities) => {
    await openAdd(showEntities);
    return c._bindingCandidates().map((item) => item.value);
  };
  const remove = async (device) => {
    c._openMarkerDialog(device);
    await c.updateComplete;
    window.confirm = () => true;
    await c._deleteMarker();
    await c.updateComplete;
    window.confirm = nativeConfirm;
  };
  const markers = () => c._serverCfg.markers || [];
  const tombstones = () => markers().filter((m) => m.removed === true);
  const liveMarkers = (binding) => markers().filter((m) => m.removed !== true && m.binding === binding);

  // --- 1. удалили устройство — оно снова предлагается ----------------------
  const device = c._devices.find((d) => d.bindingKind === 'device' && d.bindingRef && !d.hidden);
  o.standHasDeviceMarker = !!device;
  const deviceBinding = `device:${device.bindingRef}`;
  const childEntity = Object.entries(c._planHass.entities)
    .find(([, reg]) => reg.device_id === device.bindingRef && !reg.hidden)?.[0];
  o.standHasChildEntity = !!childEntity;
  const childBinding = `entity:${childEntity}`;

  o.placedDeviceNotOffered = !(await offered(false)).includes(deviceBinding);
  await remove(device);
  o.deleteLeavesTombstone = tombstones().some((m) => m.binding === deviceBinding);
  o.deletedDeviceOfferedAgain = (await offered(false)).includes(deviceBinding);

  // --- 2. чекбокс «показывать сущности» и есть ловушка ---------------------
  // «Нет в списке» и «спрятано за галкой» для пользователя неразличимы: для
  // нового маркера галка выключена, и обычная сущность устройства отсутствует.
  const withoutCheckbox = await offered(false);
  const withCheckbox = await offered(true);
  const plainEntity = Object.entries(c._planHass.entities)
    .find(([eid, reg]) => reg.device_id && reg.device_id !== device.bindingRef
      && !withoutCheckbox.includes(`entity:${eid}`))?.[0];
  o.standHasPlainEntity = !!plainEntity;
  o.plainEntityHiddenWithoutCheckbox = !withoutCheckbox.includes(`entity:${plainEntity}`);
  o.plainEntityShownWithCheckbox = withCheckbox.includes(`entity:${plainEntity}`);
  o.checkboxOffForNewMarker = (await (async () => {
    c._openMarkerDialog();
    await c.updateComplete;
    return c._markerDialog.showEntities;
  })()) === false;

  // --- 3. #262: из удалённого parent возвращается одна exact entity --------
  // Parent tombstone открывает переход в picker, но сохраняется после Save:
  // выбранная X оживает, siblings и автоматический device:D — нет.
  o.deletedDeviceChildHiddenWithoutCheckbox =
    !(await offered(false)).includes(childBinding);
  o.deletedDeviceChildOfferedWithCheckbox =
    (await offered(true)).includes(childBinding);

  const saveChild = async () => {
    await openAdd(true);
    const reg = c._planHass.entities[childEntity];
    const state = c._planHass.states[childEntity];
    c._markerDialog = {
      ...c._markerDialog,
      bindingMode: 'ha',
      binding: childBinding,
      name: reg?.name || state?.attributes?.friendly_name || childEntity,
    };
    await c._saveMarker();
    await c.updateComplete;
    return liveMarkers(childBinding)[0];
  };

  const childMarker = await saveChild();
  o.childSaveCreatesOneLiveMarker = liveMarkers(childBinding).length === 1
    && !tombstones().some((m) => m.binding === childBinding);
  o.childSaveKeepsParentTombstone = tombstones().some((m) => m.binding === deviceBinding);
  const childDevice = () => c._devices.find((d) =>
    d.bindingKind === 'entity' && d.bindingRef === childEntity);
  o.childBuiltWithoutAutoParent = !!childDevice()
    && !c._devices.some((d) => d.bindingKind === 'device' && d.bindingRef === device.bindingRef);
  const childPos = childMarker && c._layout[childMarker.id];
  o.childGetsFreshLayoutPosition = !!childPos
    && Number.isFinite(childPos.x) && Number.isFinite(childPos.y) && !!childPos.s;
  c._setMode('view');
  await c.updateComplete;
  o.childDrawnInView = !!c.renderRoot.querySelector(
    `.dev[data-id="${CSS.escape(childMarker.id)}"]`,
  );

  o.parentStillOfferedAfterChildSave = (await offered(false)).includes(deviceBinding);
  o.liveChildRemovedFromPicker = !(await offered(true)).includes(childBinding);

  // Повторный Delete → Add той же X обязан быть идемпотентным и не затрагивать
  // соседний parent tombstone.
  await remove(childDevice());
  o.childDeleteLeavesBothTombstones = tombstones().some((m) => m.binding === deviceBinding)
    && tombstones().some((m) => m.binding === childBinding);
  o.deletedChildOfferedAgain = (await offered(true)).includes(childBinding);
  await saveChild();
  o.secondChildSaveIsIdempotent = liveMarkers(childBinding).length === 1
    && !tombstones().some((m) => m.binding === childBinding)
    && tombstones().some((m) => m.binding === deviceBinding);

  // --- 4. повторное добавление возвращает устройство в список размещённых --
  // Явные device:D + entity:X сосуществуют по принятому контракту #226.
  await openAdd(false);
  c._markerDialog = { ...c._markerDialog, bindingMode: 'ha', binding: deviceBinding,
    name: device.name };
  await c._saveMarker();
  await c.updateComplete;
  o.readdReplacesTombstone = !tombstones().some((m) => m.binding === deviceBinding)
    && (c._serverCfg.markers || []).some((m) => m.binding === deviceBinding);
  o.readdRemovesFromPicker = !(await offered(false)).includes(deviceBinding);
  o.explicitParentAndChildCoexist = c._devices.some((d) =>
    d.bindingKind === 'device' && d.bindingRef === device.bindingRef)
    && !!childDevice();

  c._markerDialog = null;
  c._setMode('view');
  await c.updateComplete;
  return o;
}));

checkAll(out);
await finish(browser, out);
