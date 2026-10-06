// Карточка пространства: маркеры и символы проёмов с ключами (#764).
//
// #745 дал ключи фигурам комнат `houseplan-space-card`. Маркеры и символы
// проёмов рисовались голым `map()`: Lit отдаёт узел по ПОЗИЦИИ в списке, и узел
// прежнего объекта достаётся новому. Стили у карточки общие с планом
// (`cardStyles`): у створки `.op-leaf` переход `transform` 0,6 с, у дуги `.op-arc`
// — `stroke-dashoffset`, у сердцевины маркера `.device-core` — `background` и
// `color` 0,15 с. Чужой узел — это анимация события, которого не было: дверь
// закрытого этажа «закрывается» из угла открытой двери прежнего, лампа гаснет
// цветом соседа.
//
// Два пути, на которых состав списков меняется в ТОМ ЖЕ DOM:
//   A. новый `space` в `setConfig` того же элемента (превью редактора карточки);
//   B. событие конфигурации (`__hpTest.setServerConfig` — пуш с сервера, на
//      который подписана карточка): другой клиент вставил дверь в начало списка
//      и скрыл первый маркер.
// Судим не только по идентичности узлов (#528): каждое изменение снимается по
// кадрам, и вычисленный стиль объекта в каждом кадре сверяется с итоговым.
// Обратная половина контракта: настоящая смена состояния ТОГО ЖЕ объекта
// по-прежнему анимируется на том же узле (ловит ложный фикс `transition: none`).
import { launch, checkAll, finish } from './serve.mjs';

const { page, browser } = await launch({ width: 900, height: 900 }, 1);
const res = await page.evaluate(async () => {
  const out = {};
  const T = window.__hpTest;
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // дольше самого длинного перехода (0,6 с у створки)
  const settle = async () => { for (let i = 0; i < 10; i++) await frame(); await sleep(900); };
  const waitUntil = async (predicate, ms = 6000) => {
    const deadline = performance.now() + ms;
    while (!predicate() && performance.now() < deadline) await sleep(16);
    return !!predicate();
  };
  const spaceOf = (cfg, id) => cfg.spaces.find((space) => space.id === id);

  // ---- фикстура ----------------------------------------------------------
  // Демо-дом без проёмов: на обоих этажах одна и та же перегородка, на ней
  // двери в разных состояниях. Символы карточка рисует только у проёмов на
  // перегородке (`resolvedHosted`). Слот 1 на обоих этажах — дверь с ОДНИМ И
  // ТЕМ ЖЕ id в противоположных состояниях: id уникален только внутри этажа.
  const contact = {
    open: 'binary_sensor.hp764_open', gShut: 'binary_sensor.hp764_garden_shut',
    sharedF1: 'binary_sensor.hp764_shared_f1', sharedGarden: 'binary_sensor.hp764_shared_garden',
  };
  const wall = { id: 'hp764-wall', a: [0.15, 0.3], b: [0.85, 0.3], cm: 15 };
  const door = (id, t, sensor) => ({
    id, type: 'door', length: 0.08, contact: sensor, host: { kind: 'partition', id: wall.id, t },
  });
  const sharedId = 'hp764-shared';
  const f1Doors = [door('hp764-open', 0.25, contact.open), door(sharedId, 0.6, contact.sharedF1)];
  const gardenDoors = [door('hp764-g-shut', 0.25, contact.gShut), door(sharedId, 0.6, contact.sharedGarden)];
  const fixtureSpace = (space, doors) => {
    space.cell_cm = 5;
    space.settings = { ...(space.settings || {}), show_borders: true, hide_openings: false };
    space.partitions = [{ ...wall }];
    space.openings = doors.map((item) => ({ ...item, host: { ...item.host } }));
  };
  await T.setServerConfig((cfg) => {
    fixtureSpace(spaceOf(cfg, 'f1'), f1Doors);
    fixtureSpace(spaceOf(cfg, 'garden'), gardenDoors);
  });
  // Состояния соседей по списку различаются: слоты 0 и 1 f1 — горящий свет
  // (`.on`, оранжевая сердцевина), слоты 0 и 1 сада — косилка на базе и
  // ворота с нейтральной сердцевиной; дальше по f1 — протечка (`.alarm`,
  // красная, с пульсацией), окно, замок и погасшие лампы вперемешку.
  const sensor = (id, state) => ({ entity_id: id, state, attributes: { device_class: 'door' } });
  let hass = window.__card.hass;
  const setStates = (patch) => {
    hass = { ...hass, states: { ...hass.states, ...patch } };
    el.hass = hass;
  };
  const host = document.createElement('div');
  host.style.width = '600px';
  document.body.appendChild(host);
  const el = document.createElement('houseplan-space-card');
  const config = { type: 'custom:houseplan-space-card', show_button: false };
  el.setConfig({ ...config, space: 'f1' });
  setStates({
    [contact.open]: sensor(contact.open, 'on'),
    [contact.gShut]: sensor(contact.gShut, 'off'),
    [contact.sharedF1]: sensor(contact.sharedF1, 'off'),
    [contact.sharedGarden]: sensor(contact.sharedGarden, 'on'),
    'light.ceiling': { ...hass.states['light.ceiling'], state: 'on' },
    'light.floor_lamp': { ...hass.states['light.floor_lamp'], state: 'on' },
    'binary_sensor.sink_leak': { ...hass.states['binary_sensor.sink_leak'], state: 'on' },
    'vacuum.mower': { ...hass.states['vacuum.mower'], state: 'docked' },
  });
  host.appendChild(el);

  const root = () => el.renderRoot;
  const nodesOf = (kind) => [...(root()?.querySelectorAll(`[data-hp="${kind}"]`) || [])];
  const byId = (kind) => new Map(nodesOf(kind).map((node) => [node.dataset.id, node]));
  const openingIds = () => nodesOf('opening').map((node) => node.dataset.id);
  const markerIds = () => nodesOf('device').map((node) => node.dataset.id);
  /** Видимое состояние объекта: створка и дуга двери, сердцевина маркера. */
  const look = () => {
    const seen = {};
    for (const node of nodesOf('opening')) {
      const leaf = node.querySelector('.op-leaf');
      const arc = node.querySelector('.op-arc');
      seen[`opening:${node.dataset.id}`] = leaf || arc ? `${leaf ? getComputedStyle(leaf).transform : '-'} | ${
        arc ? getComputedStyle(arc).strokeDashoffset : '-'}` : 'none';
    }
    for (const node of nodesOf('device')) {
      const core = node.querySelector('.device-core');
      seen[`device:${node.dataset.id}`] = core
        ? `${getComputedStyle(core).backgroundColor} | ${getComputedStyle(core).color}` : 'none';
    }
    return seen;
  };
  /**
   * Переходы, стартовавшие на узлах проёмов и маркеров, и покадровый снимок
   * их вида — от изменения до покоя. Событие `transitionrun` всплывает до
   * shadow root и не зависит от того, успел ли кадр дойти до проверки.
   */
  const watch = () => {
    const ran = [];
    const frames = [];
    const listening = new AbortController();
    root().addEventListener('transitionrun', (event) => {
      const owner = event.target.closest?.('[data-hp="opening"], [data-hp="device"]');
      if (!owner) return;
      const cls = String(event.target.getAttribute('class') || event.target.tagName).split(/\s+/)[0];
      ran.push(`${owner.dataset.hp}:${owner.dataset.id}:${cls}:${event.propertyName}`);
    }, { signal: listening.signal });
    let sampling = true;
    const sampler = (async () => {
      while (sampling) { frames.push(look()); await frame(); }
    })();
    return {
      async stop() {
        await settle();
        sampling = false;
        await sampler;
        listening.abort();
        const final = look();
        // объект в кадре выглядел не так, как в покое: он доезжал из чужого вида
        const off = new Set();
        frames.forEach((seen) => {
          for (const [key, value] of Object.entries(seen)) {
            if (key in final && final[key] !== value) off.add(key);
          }
        });
        let offFrames = 0;
        for (const seen of frames) {
          if (Object.entries(seen).some(([key, value]) => key in final && final[key] !== value)) offFrames++;
        }
        const firstOff = {};
        for (const key of off) {
          const index = frames.findIndex((seen) => key in seen && seen[key] !== final[key]);
          firstOff[key] = { frame: index, seen: frames[index][key], final: final[key] };
        }
        return { ran: [...new Set(ran)], off: [...off], offFrames, frames: frames.length, final, firstOff };
      },
    };
  };

  await waitUntil(() => openingIds().length === 2 && markerIds().length >= 3);
  await el.updateComplete;
  await settle();
  const f1Look = look();
  out.f1DoorsDrawn = JSON.stringify(openingIds()) === JSON.stringify(['hp764-open', sharedId]);
  out.f1DoorsDiffer = f1Look['opening:hp764-open'] !== f1Look[`opening:${sharedId}`];
  out.f1FirstMarkersAreTheLights = JSON.stringify(markerIds().slice(0, 2)) === JSON.stringify(['d_light1', 'd_lamp']);

  // ---- путь A: тот же элемент получает другое пространство ---------------
  const beforeA = [...nodesOf('opening'), ...nodesOf('device')]
    .map((node) => ({ node, key: `${node.dataset.hp}:${node.dataset.id}` }));
  el.setConfig({ ...config, space: 'garden' });
  await el.updateComplete;
  // Снимать с первого кадра ПОСЛЕ смены: до неё в DOM ещё f1, и дверь с тем же
  // id показывала бы вид чужого этажа. Переход стартует при пересчёте стилей,
  // а `transitionrun` уходит в следующем кадре — слушатель успевает.
  const watchA = watch();
  const pathA = await watchA.stop();
  out.gardenDoorsDrawn = JSON.stringify(openingIds()) === JSON.stringify(['hp764-g-shut', sharedId]);
  out.gardenMarkersDrawn = JSON.stringify(markerIds()) === JSON.stringify(['d_mower', 'd_gate']);
  // Фикстура действительно ставит в один слот разные виды — иначе свидетель
  // молчал бы и на сломанном коде.
  out.pathASlotsDifferInLook = f1Look['opening:hp764-open'] !== pathA.final['opening:hp764-g-shut']
    && f1Look[`opening:${sharedId}`] !== pathA.final[`opening:${sharedId}`]
    && f1Look['device:d_light1'] !== pathA.final['device:d_mower']
    && f1Look['device:d_lamp'] !== pathA.final['device:d_gate'];
  out.pathANoForeignTransition = pathA.ran;
  out.pathANoNodeOutlivesTheSwitch = beforeA.filter((entry) => entry.node.isConnected)
    .map((entry) => `${entry.key} → ${entry.node.dataset.hp}:${entry.node.dataset.id}`);
  out.pathAEveryFrameShowsTheObject = pathA.off;
  out.pathAFramesSampled = pathA.frames >= 8;

  // ---- путь B: событие конфигурации внутри пространства -----------------
  el.setConfig({ ...config, space: 'f1' });
  await el.updateComplete;
  await waitUntil(() => openingIds().length === 2 && markerIds()[0] === 'd_light1');
  await settle();
  const keptOpenings = byId('opening');
  const keptMarkers = byId('device');
  const watchB = watch();
  // Вставленная дверь висит на датчике, который этаж уже читает (закрыт).
  // Новый датчик попал бы в проекцию состояний рендера только после барьера
  // непрерывности, и дверь сначала рисовалась бы открытой — это другой
  // механизм, не идентичность списка.
  await T.setServerConfig((cfg) => {
    const f1 = spaceOf(cfg, 'f1');
    f1.openings = [door('hp764-probe', 0.85, contact.sharedF1), ...f1.openings];
    cfg.markers = [...(cfg.markers || []), { binding: 'device:d_light1', hidden: true }];
  });
  out.pathBListsChanged = await waitUntil(() => openingIds()[0] === 'hp764-probe'
    && openingIds().length === 3 && !markerIds().includes('d_light1'));
  await el.updateComplete;
  const pathB = await watchB.stop();
  const afterOpenings = byId('opening');
  const afterMarkers = byId('device');
  out.pathBNoNodeSwapped = [
    ...[...keptOpenings].filter(([id, node]) => afterOpenings.has(id) && afterOpenings.get(id) !== node)
      .map(([id]) => `opening:${id}`),
    ...[...keptMarkers].filter(([id, node]) => afterMarkers.has(id) && afterMarkers.get(id) !== node)
      .map(([id]) => `device:${id}`),
  ];
  out.pathBNoForeignTransition = pathB.ran;
  out.pathBEveryFrameShowsTheObject = pathB.off;
  out.pathBFramesSampled = pathB.frames >= 8;

  // ---- настоящая смена состояния того же объекта анимируется -------------
  const realId = 'hp764-open';
  const realDoor = afterOpenings.get(realId);
  const realMarker = afterMarkers.get('d_lamp');
  const watchReal = watch();
  setStates({
    [contact.open]: sensor(contact.open, 'off'),
    'light.floor_lamp': { ...hass.states['light.floor_lamp'], state: 'off' },
  });
  await el.updateComplete;
  const real = await watchReal.stop();
  out.realChangeKeepsTheDoorNode = !!realDoor && byId('opening').get(realId) === realDoor;
  out.realChangeKeepsTheMarkerNode = !!realMarker && byId('device').get('d_lamp') === realMarker;
  out.aRealDoorChangeStillAnimates = real.ran.includes(`opening:${realId}:op-leaf:transform`);
  out.aRealLightChangeStillAnimates = real.ran.includes('device:d_lamp:device-core:background-color');
  // и это видно в кадрах: вид объекта доезжал до итога, а не прыгал
  out.theRealChangeIsVisibleInFrames = real.off.includes(`opening:${realId}`)
    && real.off.includes('device:d_lamp');
  out.onlyTheChangedObjectsAnimate = real.ran.filter((entry) =>
    !entry.startsWith(`opening:${realId}:`) && !entry.startsWith('device:d_lamp:'));
  out.diagnostics = {
    pathA: { ran: pathA.ran.length, offFrames: pathA.offFrames, frames: pathA.frames, firstOff: pathA.firstOff },
    pathB: { ran: pathB.ran.length, offFrames: pathB.offFrames, frames: pathB.frames, firstOff: pathB.firstOff },
    real: { ran: real.ran.length, offFrames: real.offFrames, frames: real.frames, firstOff: real.firstOff },
  };
  host.remove();
  return out;
});
const { diagnostics } = res;
delete res.diagnostics;
console.log(JSON.stringify({ diagnostics }, null, 1));
checkAll(res, {
  pathANoForeignTransition: [], pathANoNodeOutlivesTheSwitch: [], pathAEveryFrameShowsTheObject: [],
  pathBNoNodeSwapped: [], pathBNoForeignTransition: [], pathBEveryFrameShowsTheObject: [],
  onlyTheChangedObjectsAnimate: [],
});
await finish(browser, res);
