// Household-сценарии основного View (#560).
//
// Шесть путей домашнего пользователя, а не шесть проверок функций: открыть
// карточку на проснувшемся экране, найти тревогу, прочитать значение, выполнить
// разрешённое действие, переключить этаж, вернуться после обновления. У каждого
// названы персона, вход, действие и НЕЗАВИСИМЫЙ наблюдаемый оракул: где можно —
// не «класс появился», а вызов сервиса, доступное имя или содержимое модели.
//
// Две ширины, потому что домашний пользователь живёт в двух разных местах:
// настенный планшет (штатная ширина демо-стенда, 780 px) и узкая колонка
// телефона (390 px) — та самая, на которой ломается первый контакт.
//
// Граница честности: это синтетический стенд. Реальная установка владельца в
// этом заходе читалась только на чтение (профиль в docs/QUALITY-560.md),
// добровольцев и физического Companion в проверке не было.
import { launch, check, finish, watchPage } from './serve.mjs';

const { page, browser } = await launch();
const out = {};

const settle = () => page.evaluate(() => new Promise((resolve) =>
  requestAnimationFrame(() => requestAnimationFrame(resolve))));

/** Геометрия карточки успокоилась: два одинаковых замера подряд (#533). */
const settledBox = async (id, attempts = 25) => {
  let previous = null;
  for (let i = 0; i < attempts; i++) {
    await page.waitForTimeout(120);
    const now = await page.evaluate((markerId) => {
      const node = window.__card.renderRoot.querySelector(`[data-hp="device"][data-id="${markerId}"]`);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return [Number((rect.x + rect.width / 2).toFixed(2)), Number((rect.y + rect.height / 2).toFixed(2)),
        Number(rect.width.toFixed(2))];
    }, id);
    if (previous && now && previous[0] === now[0] && previous[1] === now[1]) return now;
    previous = now;
  }
  return previous;
};

const setWidth = async (px) => {
  await page.evaluate(async (width) => {
    const card = window.__card;
    card.style.width = `${width}px`;
    card._lastValidStageSize = null;
    card._refitView?.();
    await card.updateComplete;
  }, px);
  await settle();
};

// --- J1. «Экран проснулся» ---------------------------------------------------
// Персона: домашний пользователь у настенного планшета. Вход: вкладка, которая
// никогда не загружала редакторский чанк. Оракул: план показан (вуаль снята),
// комнаты и устройства нарисованы, редакторский чанк не запрашивался.
const requested = [];
page.on('request', (request) => requested.push(new URL(request.url()).pathname));
const j1 = await page.evaluate(() => {
  const card = window.__card;
  const root = card.renderRoot;
  return {
    booting: card._booting,
    rooms: root.querySelectorAll('[data-hp="room"]').length,
    devices: root.querySelectorAll('[data-hp="device"]').length,
    stageVisible: getComputedStyle(root.querySelector('.stage')).visibility,
  };
});
out.j1 = j1;
check('j1.plan_revealed', j1.booting === false && j1.stageVisible === 'visible', true);
check('j1.rooms_drawn', j1.rooms > 0, true);
check('j1.devices_drawn', j1.devices > 0, true);

// --- J2. «Где протечка» ------------------------------------------------------
// Вход: датчик протечки уходит в тревогу. Оракул независимый: доступное имя
// маркера называет состояние, а не только цвет пятна.
const j2 = await page.evaluate(async () => {
  const card = window.__card;
  const leak = card._devices.find((device) => device.id === 'd_leak') || card._devices[0];
  const entity = leak.primary || Object.keys(card.hass.states)[0];
  card.hass = { ...card.hass, states: { ...card.hass.states, [entity]: { ...card.hass.states[entity], state: 'on' } } };
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 150));
  const node = card.renderRoot.querySelector(`[data-hp="device"][data-id="${leak.id}"]`);
  return {
    id: leak.id,
    label: node?.getAttribute('aria-label') || '',
    state: node?.dataset.state || null,
    alarmClass: node?.classList.contains('alarm') || false,
    role: node?.getAttribute('role') || null,
  };
});
out.j2 = j2;
check('j2.alarm_has_accessible_state', /\S/.test(j2.label) && j2.state !== null, true);
check('j2.alarm_not_colour_only', j2.label.split(',').length >= 2, true);

// --- J3. «Сколько в спальне» -------------------------------------------------
// Оракул: числовое значение попадает в ДОСТУПНОЕ ИМЯ, а не только в рисунок.
const j3 = await page.evaluate(() => {
  const card = window.__card;
  const nodes = [...card.renderRoot.querySelectorAll('[data-hp="device"]')];
  const withValue = nodes
    .map((node) => ({ id: node.dataset.id, label: node.getAttribute('aria-label') || '' }))
    .filter((item) => /\d/.test(item.label));
  return { total: nodes.length, withValue: withValue.length, sample: withValue.slice(0, 2) };
});
out.j3 = j3;
check('j3.values_are_readable_by_name', j3.withValue > 0, true);

// --- J4. «Выключить свет с клавиатуры» ---------------------------------------
// Вход: Tab до маркера на плане, затем Enter. Оракул: вызов сервиса, а не
// внутренний флаг карточки.
const tabStops = await (async () => {
  let stops = 0;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    stops += 1;
    const reached = await page.evaluate(() => {
      const leaf = (() => {
        let node = document.activeElement;
        while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
        return node;
      })();
      return leaf?.dataset?.hp === 'device' ? leaf.dataset.id : null;
    });
    if (reached) return { stops, id: reached };
  }
  return { stops, id: null };
})();
const j4 = await page.evaluate(async () => {
  const card = window.__card;
  const calls = [];
  const hass = card.hass;
  const original = hass.callService?.bind(hass);
  card.hass = { ...hass, callService: (...args) => { calls.push(`${args[0]}.${args[1]}`); return original?.(...args); } };
  await card.updateComplete;
  const leaf = (() => {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return node;
  })();
  const focusVisible = leaf?.matches?.(':focus-visible') || false;
  const ring = leaf ? getComputedStyle(leaf).getPropertyValue('--device-ring-color').trim() : null;
  const idle = card.renderRoot.querySelector('[data-hp="device"]:not(:focus-visible)');
  const idleRing = idle ? getComputedStyle(idle).getPropertyValue('--device-ring-color').trim() : null;
  leaf?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { calls, focusVisible, ring, idleRing };
});
out.j4 = { ...j4, ...tabStops };
check('j4.marker_reachable_by_tab', tabStops.id !== null, true);
check('j4.focus_is_visible', j4.focusVisible && j4.ring !== j4.idleRing, true);
check('j4.enter_calls_service', j4.calls.length > 0, true);

// --- J5. «Переключить этаж» --------------------------------------------------
const j5 = await page.evaluate(async () => {
  const card = window.__card;
  const root = card.renderRoot;
  const tabs = [...root.querySelectorAll('[data-hp="space-tab"]')];
  const before = card._space;
  const other = tabs.find((tab) => tab.dataset.id !== before);
  const beforeRooms = [...root.querySelectorAll('[data-hp="room"]')].map((node) => node.dataset.id).join(',');
  other.click();
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 250));
  const afterRooms = [...root.querySelectorAll('[data-hp="room"]')].map((node) => node.dataset.id).join(',');
  const activeTab = root.querySelector('[data-hp="space-tab"].active');
  return {
    tabs: tabs.length, before, after: card._space,
    roomsChanged: beforeRooms !== afterRooms,
    activeTabIsCurrent: activeTab?.dataset.id === card._space,
    // Состояние вкладки для программы: есть ли он вообще, кроме класса.
    ariaCurrent: activeTab?.getAttribute('aria-current'),
    ariaPressed: activeTab?.getAttribute('aria-pressed'),
    ariaSelected: activeTab?.getAttribute('aria-selected'),
  };
});
out.j5 = j5;
check('j5.floor_switched', j5.after !== j5.before, true);
check('j5.plan_rerendered', j5.roomsChanged, true);
check('j5.active_tab_matches_space', j5.activeTabIsCurrent, true);

// --- J6. «Вернулся после обновления» ----------------------------------------
const j6 = await page.evaluate(async () => {
  const card = window.__card;
  const chosen = card._space;
  card._serverCfg = structuredClone(card._serverCfg);
  card._cfgEpoch++;
  card.requestUpdate();
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    chosen, after: card._space,
    rooms: card.renderRoot.querySelectorAll('[data-hp="room"]').length,
    devices: card.renderRoot.querySelectorAll('[data-hp="device"]').length,
  };
});
out.j6 = j6;
check('j6.space_kept', j6.after === j6.chosen, true);
check('j6.plan_redrawn', j6.rooms > 0 && j6.devices > 0, true);

// --- J7. Цель нажатия при плотной расстановке --------------------------------
// Вход: пять маркеров в колонке с шагом 0,0333 нормированной единицы — самая
// плотная расстановка, найденная на реальной установке владельца.
// Оракул: в центре ВИДИМОГО маркера нажатие достаётся ему же.
const dense = await page.evaluate(async () => {
  const card = window.__card;
  const space = card._serverCfg.spaces.find((candidate) => candidate.id === card._space);
  const room = space.rooms.find((candidate) => candidate.id && candidate.area) || space.rooms[0];
  const ids = ['dense1', 'dense2', 'dense3', 'dense4', 'dense5'];
  card._serverCfg.markers = [...(card._serverCfg.markers || []), ...ids.map((id, index) => ({
    id, name: `Dense ${index + 1}`, binding: 'virtual', is_light: true, tap_action: 'toggle',
    space: space.id, area: room.area, room_id: room.id,
  }))];
  const layout = { ...card._layout };
  ids.forEach((id, index) => { layout[id] = { s: space.id, x: 0.5, y: 0.3 + index * 0.0333 }; });
  card._layout = layout;
  card._cfgEpoch++;
  card._regSignature = '';
  card._maybeRebuildDevices();
  card.requestUpdate();
  await card.updateComplete;
  window.__journeyHits = [];
  const original = card._clickDevice?.bind(card);
  if (original) {
    card._clickDevice = (event, device) => { window.__journeyHits.push(device?.id || null); return original(event, device); };
  }
  return { ids };
});

const ownerOfCentre = async (id) => {
  const centre = await settledBox(id);
  if (!centre) return null;
  return page.evaluate(([cx, cy]) => {
    let node = document.elementFromPoint(cx, cy);
    while (node?.shadowRoot?.elementFromPoint) {
      const deeper = node.shadowRoot.elementFromPoint(cx, cy);
      if (!deeper || deeper === node) break;
      node = deeper;
    }
    return node?.closest?.('[data-hp="device"]')?.dataset?.id || null;
  }, [centre[0], centre[1]]);
};

const tablet = { size: (await settledBox('dense1'))?.[2] ?? null, owners: [] };
for (const id of dense.ids) tablet.owners.push(await ownerOfCentre(id));
const tabletCentre = await settledBox('dense1');
await page.mouse.click(tabletCentre[0], tabletCentre[1]);
await page.waitForTimeout(200);
tablet.clickWentTo = await page.evaluate(() => window.__journeyHits.at(-1) || null);
out.j7_tablet = tablet;
// Настенный планшет: центр видимого маркера принадлежит ему. Это то свойство,
// которое правка плотных целей обязана сохранить.
check('j7.tablet_centre_belongs_to_its_marker',
  tablet.owners.every((owner, index) => owner === dense.ids[index]), true);
check('j7.tablet_click_reaches_its_marker', tablet.clickWentTo, 'dense1');

// Узкая колонка телефона: тот же замер печатается в отчёт БЕЗ проверки —
// расхождение здесь заведено отдельным issue, и свидетель приедет с правкой.
// Вписывать текущее поведение проверкой значило бы узаконить дефект.
await setWidth(390);
const phone = { size: (await settledBox('dense1'))?.[2] ?? null, owners: [] };
for (const id of dense.ids) phone.owners.push(await ownerOfCentre(id));
const phoneCentre = await settledBox('dense1');
const before = await page.evaluate(() => window.__journeyHits.length);
await page.mouse.click(phoneCentre[0], phoneCentre[1]);
await page.waitForTimeout(200);
phone.clickWentTo = await page.evaluate((from) => window.__journeyHits.slice(from).at(-1) || null, before);
out.j7_phone = phone;
console.log('j7.phone (без проверки, см. docs/QUALITY-560.md):', JSON.stringify(phone));

await finish(browser, out);
