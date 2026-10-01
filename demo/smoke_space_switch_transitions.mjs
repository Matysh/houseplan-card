// Переключение пространств не доигрывает чужие переходы (#525).
//
// Lit переиспользует узлы списка по позиции. Пока у створки двери
// (`.op-leaf`, `transform`) и у дуги (`.op-arc`, `stroke-dashoffset`) есть
// переход в 0.6 с, позиционное переиспользование превращает смену
// пространства в анимацию: створка нового этажа доезжает из положения двери,
// которая занимала этот слот раньше. То же у оболочки маркера
// (`.device-shell-frame`, `box-shadow`) и у фигуры комнаты (`.room`, заливка
// и обводка за 0,12 с, #742).
//
// Две ловушки, обе стоили бы свидетелю правдивости:
//   1. `document.getAnimations()` здесь пуст ДАЖЕ НА СЛОМАННОМ КОДЕ — карточка
//      живёт в shadow root, и документный вызов туда не заходит. Считаем
//      поэлементно, обходя вложенные теневые деревья.
//   2. В демо-доме проёмов нет вовсе (`space.openings` пуст у обоих
//      пространств), поэтому дверь в двух пространствах готовит сам смок.
import { launch, checkAll, finish } from './serve.mjs';
const { page, browser } = await launch();
/** DEFAULT_CUSTOM_FILL (`src/logic.ts`) в вычисленном стиле: цвет / `fill-opacity`. */
const FINAL_FILL = 'rgb(96, 125, 139) / 0.18';

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
  const ids = c._serverCfg.spaces.map((space) => space.id).slice(0, 2);
  out.twoSpacesExist = ids.length === 2;

  // ---- 0) фигуры комнат: смена пространства их не перекрашивает (#742) ---
  // `.room` переводит все свойства за 0,12 с. Пока список фигур был голым
  // `map()`, узел комнаты прежнего этажа доставался комнате нового, и заливка
  // ехала от чужого значения: кадр белой бумаги, потом темнее итога.
  // Раздел стоит ДО physicalize: после толстых стен первая комната рисуется
  // другой веткой шаблона, Lit создаёт её узел заново, и свидетель молчит
  // даже на сломанном коде. Здесь первые комнаты обоих этажей — `polygon`
  // по `r.poly`: на f1 подложка и `room overlay` без заливки, второму этажу
  // смок включает `fill_mode: 'custom'`. Конфиг меняется пушем с сервера
  // (`__hpTest.setServerConfig`) — тем же путём, что правка с другого клиента.
  const T = window.__hpTest;
  const initialSpace = c._space;
  const initialCfg = structuredClone(c._serverCfg);
  const spaceOf = (cfg, id) => cfg.spaces.find((space) => space.id === id);
  const roomNodes = () => [...root().querySelectorAll('[data-hp="room"]')];
  const roomTransitions = () => roomNodes().flatMap((node) => node.getAnimations()
    .filter((animation) => animation instanceof CSSTransition)
    .map((animation) => `${node.dataset.id}:${animation.transitionProperty}`));
  /**
   * Узлы комнат по `data-id` и переходы, стартовавшие на них до `stop()`.
   * Событие не зависит от того, успел ли кадр дойти до проверки.
   */
  const watchRooms = () => {
    const nodes = new Map(roomNodes().map((node) => [node.dataset.id, node]));
    const ran = [];
    const listening = new AbortController();
    for (const [id, node] of nodes) {
      node.addEventListener('transitionrun', (event) => ran.push(`${id}:${event.propertyName}`),
        { signal: listening.signal });
    }
    return { nodes, stop: () => { listening.abort(); return [...ran]; } };
  };
  const pickSpace = async (id) => {
    c._pickSpace(id);
    await c.updateComplete;
    await settle();
  };
  /** Сменить пространство и снять первый кадр после смены. */
  const switchRooms = async (to) => {
    const before = roomNodes().map((node) => ({ node, id: node.dataset.id, cls: node.getAttribute('class') }));
    const tagBefore = before[0]?.node.tagName.toLowerCase();
    c._pickSpace(to);
    await c.updateComplete;
    await frame();
    const head = roomNodes()[0];
    const style = head ? getComputedStyle(head) : null;
    return {
      fixture: !!head && tagBefore === 'polygon' && head.tagName.toLowerCase() === 'polygon'
        && !/\bstyled\b/.test(before[0].cls) && /\bfilled\b/.test(head.getAttribute('class')),
      headId: head?.dataset.id,
      transitions: roomTransitions(),
      // Любой подключённый узел прежнего пространства сейчас рисует комнату
      // нового — под чужим `data-id` или под тем же, если `id` совпали.
      survivors: before.filter((entry) => entry.node.isConnected)
        .map((entry) => `${entry.id} → ${entry.node.dataset.id}`),
      fill: style ? `${style.fill} / ${style.fillOpacity}` : null,
    };
  };
  await T.setServerConfig((cfg) => {
    const second = spaceOf(cfg, ids[1]);
    second.settings = { ...(second.settings || {}), fill_mode: 'custom', show_borders: true };
  });
  await pickSpace(ids[0]);
  // AC1: подложка без заливки → этаж с заливкой
  const paperToFill = await switchRooms(ids[1]);
  out.roomWitnessFixtureHolds = paperToFill.fixture;
  out.noRoomTransitionOnSwitch = paperToFill.transitions;
  out.noRoomNodeOutlivesTheSwitch = paperToFill.survivors;
  out.newFloorRoomsBornInTheirFill = paperToFill.fill;
  // AC2: состав списка меняется внутри пространства — новая комната первой
  await pickSpace(ids[0]);
  const kept = watchRooms();
  const probeId = 'hp-742-probe';
  await T.setServerConfig((cfg) => {
    const space = spaceOf(cfg, ids[0]);
    space.rooms = [
      { id: probeId, name: 'probe', poly: [[0.04, 0.88], [0.2, 0.88], [0.2, 0.97], [0.04, 0.97]] },
      ...space.rooms,
    ];
  });
  const afterInsert = new Map(roomNodes().map((node) => [node.dataset.id, node]));
  out.roomListGrewInsideTheSpace = afterInsert.size > kept.nodes.size && roomNodes()[0]?.dataset.id === probeId;
  out.noRoomNodeSwappedInsideTheSpace = [...kept.nodes]
    .filter(([id, node]) => afterInsert.get(id) !== node).map(([id]) => id);
  out.quietRoomsAfterTheInsert = kept.stop();
  // AC1, второй случай: `id` уникален только внутри пространства
  const sharedId = spaceOf(c._serverCfg, ids[0]).rooms.find((room) => room.id !== probeId)?.id;
  await T.setServerConfig((cfg) => {
    spaceOf(cfg, ids[0]).rooms = spaceOf(cfg, ids[0]).rooms.filter((room) => room.id !== probeId);
    spaceOf(cfg, ids[1]).rooms[0].id = sharedId;
  });
  const sameId = await switchRooms(ids[1]);
  out.sameRoomIdOnBothFloors = sameId.fixture && !!sharedId && sameId.headId === sharedId;
  out.noRoomTransitionOnSwitchWithSameId = sameId.transitions;
  out.noRoomNodeOutlivesTheSwitchWithSameId = sameId.survivors;
  out.sameIdRoomBornInItsFill = sameId.fill;
  // AC3: настоящая смена заливки той же комнаты по-прежнему анимируется —
  // ловит ложный фикс `transition: none`
  await settle();
  const filled = watchRooms();
  await T.setServerConfig((cfg) => {
    const second = spaceOf(cfg, ids[1]);
    second.settings = { ...second.settings, custom_fill: { c: '#c62828', a: 0.5 } };
  });
  out.realFillChangeKeepsTheRoomNode = !!filled.nodes.get(sharedId)
    && roomNodes().find((node) => node.dataset.id === sharedId) === filled.nodes.get(sharedId);
  out.aRealFillChangeStillAnimates = filled.stop().includes(`${sharedId}:fill`);
  // фикстуру разделов ниже не трогаем
  await T.setServerConfig(initialCfg);
  await pickSpace(initialSpace);

  // ---- фикстура: дверь на одном месте в двух пространствах ---------------
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
  swappedMarkerNodes: [], swappedOpeningNodes: [],
  noRoomTransitionOnSwitch: [], noRoomNodeOutlivesTheSwitch: [],
  newFloorRoomsBornInTheirFill: FINAL_FILL,
  noRoomNodeSwappedInsideTheSpace: [], quietRoomsAfterTheInsert: [],
  noRoomTransitionOnSwitchWithSameId: [], noRoomNodeOutlivesTheSwitchWithSameId: [],
  sameIdRoomBornInItsFill: FINAL_FILL });
await finish(browser, res);
