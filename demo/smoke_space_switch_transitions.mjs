// Переключение пространств не доигрывает чужие переходы (#525).
//
// Lit переиспользует узлы списка по позиции. Пока у створки двери
// (`.op-leaf`, `transform`) и у дуги (`.op-arc`, `stroke-dashoffset`) есть
// переход в 0.6 с, позиционное переиспользование превращает смену
// пространства в анимацию: створка нового этажа доезжает из положения двери,
// которая занимала этот слот раньше. То же у оболочки маркера
// (`.device-shell-frame`, `box-shadow`).
//
// Две ловушки, обе стоили бы свидетелю правдивости:
//   1. `document.getAnimations()` здесь пуст ДАЖЕ НА СЛОМАННОМ КОДЕ — карточка
//      живёт в shadow root, и документный вызов туда не заходит. Считаем
//      поэлементно, обходя вложенные теневые деревья.
//   2. В демо-доме проёмов нет вовсе (`space.openings` пуст у обоих
//      пространств), поэтому дверь в двух пространствах готовит сам смок.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();

const res = await page.evaluate(async () => {
  const out = {};
  const c = window.__card;
  const root = () => c.shadowRoot || c.renderRoot;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const settle = async (frames = 10, ms = 500) => {
    for (let i = 0; i < frames; i++) await frame();
    await new Promise((resolve) => setTimeout(resolve, ms));
  };
  /** Все бегущие анимации внутри карточки, включая вложенные shadow root. */
  const runningAnimations = () => {
    const found = [];
    const walk = (node) => {
      for (const element of node.querySelectorAll('*')) {
        const list = element.getAnimations ? element.getAnimations() : [];
        for (const animation of list) {
          if (animation.playState !== 'running') continue;
          found.push({
            cls: element.getAttribute?.('class') || element.tagName,
            property: animation.transitionProperty || animation.animationName || '?',
          });
        }
        if (element.shadowRoot) walk(element.shadowRoot);
      }
    };
    walk(root());
    return found;
  };
  // Вкладка подсвечивается, слайд едет, значения сводной панели проявляются —
  // это и есть переключение. Всё остальное, что бежит сразу после него,
  // доигрывает чужие данные.
  const EXPECTED = (entry) => /(^|\s)tab(\s|$)|zoomwrap/.test(entry.cls)
    || /^summary-/.test(entry.property);

  // ---- фикстура: дверь на одном месте в двух пространствах ---------------
  const ids = c._serverCfg.spaces.map((space) => space.id).slice(0, 2);
  out.twoSpacesExist = ids.length === 2;
  const physicalize = (space) => {
    for (const room of [...(space.rooms || [])]) {
      const rendered = c._spaceModelById(space.id)?.rooms?.find((item) => item.id === room.id);
      if (!rendered?.poly?.length) continue;
      c._wallDialog = {
        a: rendered.poly[0], b: rendered.poly[1], value: '15', roomId: room.id,
        source: { kind: 'room' }, sx: 0, sy: 0,
      };
      c._wallThickApply(true);
    }
  };
  for (const id of ids) physicalize(c._serverCfg.spaces.find((space) => space.id === id));
  c._geometryHistory.length = 0;
  const contactOpen = 'binary_sensor.probe_door_open';
  const contactShut = 'binary_sensor.probe_door_shut';
  const withContacts = (openState) => ({
    ...c.hass,
    states: {
      ...c.hass.states,
      [contactOpen]: { entity_id: contactOpen, state: openState, attributes: { device_class: 'door' } },
      [contactShut]: { entity_id: contactShut, state: 'off', attributes: { device_class: 'door' } },
    },
    entities: {
      ...(c.hass.entities || {}),
      [contactOpen]: { entity_id: contactOpen },
      [contactShut]: { entity_id: contactShut },
    },
  });
  c.hass = withContacts('on');
  const door = (id, contact) => ({
    id, type: 'door', x: 0.2, y: 0.14, angle: 0, length: 0.08, contact,
  });
  c._serverCfg.spaces.find((space) => space.id === ids[0]).openings = [door('opA', contactOpen)];
  c._serverCfg.spaces.find((space) => space.id === ids[1]).openings = [door('opB', contactShut)];
  c._cfgEpoch++;
  c.requestUpdate();
  await c.updateComplete;

  // ---- 1) штатное переключение не анимирует чужую створку ----------------
  c._pickSpace(ids[0]);
  await c.updateComplete;
  await settle();
  const leafBefore = root().querySelector('.op-leaf');
  out.doorIsDrawnInTheFirstSpace = !!leafBefore;
  // #528: маркеры судятся по идентичности узлов, а не по бегущему переходу.
  // Прежняя проверка смотрела на переход `box-shadow` у оболочки — он исчез
  // вместе с правкой #524, и мутант «маркеры без ключей» начал выживать:
  // признак стал тривиально истинным. Идентичность узла не зависит ни от
  // одного перехода и переживёт любую правку стилей.
  const markersBefore = [...root().querySelectorAll('[data-hp="device"]')]
    .map((node) => ({ node, id: node.dataset.id }));
  out.markersDrawnInTheFirstSpace = markersBefore.length >= 3;
  out.quietBeforeTheSwitch = runningAnimations().filter((entry) => !EXPECTED(entry)).length === 0;
  // поворот створки живёт инлайновым стилем, не атрибутом
  const leafTransform = (leaf) => leaf?.style?.transform || leaf?.getAttribute('transform') || null;
  const transformBefore = leafTransform(leafBefore);

  c._pickSpace(ids[1]);
  await c.updateComplete;
  await frame();
  const afterSwitch = runningAnimations();
  const leafAfter = root().querySelector('.op-leaf');
  out.doorIsDrawnInTheSecondSpace = !!leafAfter;
  out.theTwoDoorsDifferInState = !!transformBefore && transformBefore !== leafTransform(leafAfter);
  out.noOpeningTransitionOnSwitch = afterSwitch
    .filter((entry) => /op-leaf|op-arc/.test(entry.cls)).length === 0;
  out.noMarkerTransitionOnSwitch = afterSwitch
    .filter((entry) => /device-shell-frame/.test(entry.cls)).length === 0;
  // Узел, живший до переключения, не имеет права остаться в DOM под чужим
  // `data-id`: это и есть позиционное переиспользование, ради которого в
  // `repeat` стоят ключи (#525 AC2, #528).
  const reused = markersBefore.filter((entry) => entry.node.isConnected
    && entry.node.dataset.id !== entry.id);
  out.noMarkerNodeReusedForAnotherDevice = reused.length === 0;
  out.reusedMarkerNodes = reused.map((entry) => `${entry.id} → ${entry.node.dataset.id}`);
  const unexpected = afterSwitch.filter((entry) => !EXPECTED(entry));
  out.onlyTheSwitchItselfAnimates = unexpected.length === 0;
  out.unexpectedAnimations = unexpected.map((entry) => `${entry.cls}:${entry.property}`);
  // ещё кадр — переход мог стартовать с задержкой в один тик
  await frame();
  await frame();
  const later = runningAnimations().filter((entry) => !EXPECTED(entry));
  out.stillQuietOneFrameLater = later.length === 0;

  // ---- 2) настоящая смена состояния двери по-прежнему анимируется --------
  await settle();
  out.quietBeforeTheRealChange = runningAnimations()
    .filter((entry) => /op-leaf|op-arc/.test(entry.cls)).length === 0;
  c.hass = { ...c.hass, states: { ...c.hass.states,
    [contactShut]: { entity_id: contactShut, state: 'on', attributes: { device_class: 'door' } } } };
  await c.updateComplete;
  await frame();
  const onRealChange = runningAnimations();
  out.aRealDoorOpeningStillAnimates = onRealChange
    .filter((entry) => /op-leaf/.test(entry.cls)).length >= 1;
  // ---- 3) состав списка меняется ВНУТРИ пространства (#534) --------------
  // Внешний ключ `keyed(space.id, …)` снимает дорогой диф на смене
  // пространства, но внутри пространства состав списков всё равно ездит:
  // у маркеров — призраки редактора и живой синк, у проёмов — запись с
  // нерешённым хостом, которая живёт ТОЛЬКО в режиме plan. Если убрать
  // внутренний `repeat`, позиционное переиспользование вернётся через эту
  // дверь, и ни одна проверка выше не покраснеет.
  await settle();
  const byId = (nodes) => new Map(nodes.map((node) => [node.dataset.id, node]));
  const markerNodes = () => [...root().querySelectorAll('[data-hp="device"]')];
  const openingNodes = () => [...root().querySelectorAll('.opening')];

  const markersKept = byId(markerNodes());
  const template = c._renderDevices.find((device) => device.space === c._space);
  out.markerTemplateFound = !!template;
  c._devices = [{ ...template, id: 'hp-534-probe', name: 'probe' }, ...c._devices];
  c._cfgEpoch++;
  c.requestUpdate();
  await c.updateComplete;
  await frame();
  const markersAfterInsert = byId(markerNodes());
  const movedMarkers = [...markersKept].filter(([id, node]) =>
    markersAfterInsert.has(id) && markersAfterInsert.get(id) !== node);
  out.listGrewInsideTheSpace = markersAfterInsert.size > markersKept.size;
  out.noMarkerNodeSwappedInsideTheSpace = movedMarkers.length === 0;
  out.swappedMarkerNodes = movedMarkers.map(([id]) => id);
  out.quietAfterTheInsert = runningAnimations().filter((entry) => !EXPECTED(entry)).length === 0;

  // Проёмы: запись с нерешённым хостом отдаётся только в режиме plan, поэтому
  // вход в редактор добавляет её в список и сдвигает позиции остальных.
  await settle();
  const space = c._serverCfg.spaces.find((item) => item.id === c._space);
  const donor = space.openings[0];
  out.openingDonorFound = !!donor;
  space.openings = [
    { ...donor, id: 'hp-534-orphan', host: { kind: 'partition', id: 'hp-534-missing' } },
    ...space.openings,
  ];
  c._cfgEpoch++;
  c.requestUpdate();
  await c.updateComplete;
  await settle();
  const openingsKept = byId(openingNodes());
  c._setMode('plan');
  await c.updateComplete;
  await frame();
  const openingsInPlan = byId(openingNodes());
  const movedOpenings = [...openingsKept].filter(([id, node]) =>
    openingsInPlan.has(id) && openingsInPlan.get(id) !== node);
  out.orphanAppearsOnlyInPlan = openingsInPlan.size > openingsKept.size;
  out.noOpeningNodeSwappedInsideTheSpace = movedOpenings.length === 0;
  out.swappedOpeningNodes = movedOpenings.map(([id]) => id);
  out.quietAfterTheModeSwitch = runningAnimations()
    .filter((entry) => /op-leaf|op-arc/.test(entry.cls)).length === 0;
  return out;
});
checkAll(res, { unexpectedAnimations: [], reusedMarkerNodes: [],
  swappedMarkerNodes: [], swappedOpeningNodes: [] });
await finish(browser, res);
