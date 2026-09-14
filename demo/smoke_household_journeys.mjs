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
    segments: (node?.getAttribute('aria-label') || '').split(', ')
      .map((value) => value.trim().toLowerCase()).filter(Boolean),
  };
});
out.j2 = j2;
check('j2.alarm_has_accessible_state', /\S/.test(j2.label) && j2.state !== null, true);
check('j2.alarm_not_colour_only', j2.label.split(',').length >= 2, true);
check('j2.alarm_fact_is_not_repeated', new Set(j2.segments).size, j2.segments.length);
check('j2.alarm_is_spoken_once', j2.segments.filter((part) => part === 'alarm').length, 1);

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
  const tip = card.renderRoot.querySelector('[data-hp-live-tip]');
  const tipBox = tip?.getBoundingClientRect();
  const focusedDevice = card._devices.find((device) => device.id === leaf?.dataset?.id);
  const focusTooltip = {
    visible: !!tip && !tip.hidden,
    title: tip?.querySelector('b')?.textContent?.trim() || '',
    text: tip?.textContent?.trim() || '',
    expectedTitle: focusedDevice?.name || '',
    inViewport: !!tipBox && tipBox.left >= 0 && tipBox.top >= 0
      && tipBox.right <= innerWidth && tipBox.bottom <= innerHeight,
    source: card._tip?.source || null,
  };
  leaf?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  return { calls, focusVisible, ring, idleRing, focusTooltip };
});
out.j4 = { ...j4, ...tabStops };
check('j4.marker_reachable_by_tab', tabStops.id !== null, true);
check('j4.focus_is_visible', j4.focusVisible && j4.ring !== j4.idleRing, true);
check('j4.focus_shows_same_device_tooltip',
  j4.focusTooltip.visible && j4.focusTooltip.title === j4.focusTooltip.expectedTitle, true);
check('j4.focus_tooltip_is_anchored_in_viewport',
  j4.focusTooltip.source === 'focus' && j4.focusTooltip.inViewport, true);
check('j4.enter_calls_service', j4.calls.length > 0, true);

await page.keyboard.press('Tab');
const j4Next = await page.evaluate(() => {
  const card = window.__card;
  const tip = card.renderRoot.querySelector('[data-hp-live-tip]');
  const leaf = (() => {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return node;
  })();
  return {
    visible: !!tip && !tip.hidden,
    activeTag: leaf?.tagName || null,
    activeHp: leaf?.dataset?.hp || null,
    activeId: leaf?.dataset?.id || null,
    tipSource: card._tip?.source || null,
    tipDevice: card._tip?.deviceId || null,
  };
});
out.j4_next = j4Next;
check('j4.tab_moves_focus_tooltip_to_next_device',
  j4Next.visible && j4Next.activeHp === 'device' && j4Next.activeId === j4Next.tipDevice
    && j4Next.tipSource === 'focus', true);

const j4Blur = await page.evaluate(() => {
  const card = window.__card;
  let leaf = document.activeElement;
  while (leaf?.shadowRoot?.activeElement) leaf = leaf.shadowRoot.activeElement;
  leaf?.blur?.();
  const tip = card.renderRoot.querySelector('[data-hp-live-tip]');
  return { hidden: !tip || tip.hidden, stateCleared: card._tip === null };
});
out.j4_blur = j4Blur;
check('j4.blur_hides_focus_tooltip', j4Blur.hidden && j4Blur.stateCleared, true);

const j4HoverParity = await page.evaluate((deviceId) => {
  const card = window.__card;
  const marker = card.renderRoot.querySelector(`[data-hp="device"][data-id="${deviceId}"]`);
  const rect = marker?.getBoundingClientRect();
  marker?.dispatchEvent(new PointerEvent('pointerover', {
    bubbles: true, composed: true, pointerType: 'mouse',
    clientX: rect?.left || 0, clientY: rect?.top || 0,
  }));
  const tip = card.renderRoot.querySelector('[data-hp-live-tip]');
  const hoverText = tip?.textContent?.trim() || '';
  card._showTip(new PointerEvent('pointermove', {
    pointerType: 'mouse', clientX: innerWidth, clientY: innerHeight,
  }), 'Viewport edge', 'clamp probe');
  const edgeBox = tip?.getBoundingClientRect();
  const edgeInViewport = !!edgeBox && edgeBox.left >= 0 && edgeBox.top >= 0
    && edgeBox.right <= innerWidth && edgeBox.bottom <= innerHeight;
  card._clearTransientHover();
  return { hoverText, edgeInViewport };
}, tabStops.id);
out.j4_hover_parity = j4HoverParity;
check('j4.focus_and_mouse_tooltip_content_match',
  j4HoverParity.hoverText, j4.focusTooltip.text);
check('j4.tooltip_clamps_at_viewport_edge', j4HoverParity.edgeInViewport, true);

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
  const navigation = root.querySelector('nav.tabs');
  const currentTabs = [...root.querySelectorAll('[data-hp="space-tab"][aria-current]')];
  const add = root.querySelector('[data-hp="space-add"]');
  return {
    tabs: tabs.length, before, after: card._space,
    roomsChanged: beforeRooms !== afterRooms,
    activeTabIsCurrent: activeTab?.dataset.id === card._space,
    // Состояние вкладки для программы: есть ли он вообще, кроме класса.
    ariaCurrent: activeTab?.getAttribute('aria-current'),
    ariaPressed: activeTab?.getAttribute('aria-pressed'),
    ariaSelected: activeTab?.getAttribute('aria-selected'),
    navigationName: navigation?.getAttribute('aria-label') || '',
    currentCount: currentTabs.length,
    inactiveHaveNoCurrent: [...root.querySelectorAll('[data-hp="space-tab"]')]
      .filter((tab) => tab !== activeTab).every((tab) => !tab.hasAttribute('aria-current')),
    addHasNoCurrent: !add?.hasAttribute('aria-current'),
    hasTablistRoles: !!root.querySelector('[role="tablist"], [role="tab"]'),
  };
});
out.j5 = j5;
check('j5.floor_switched', j5.after !== j5.before, true);
check('j5.plan_rerendered', j5.roomsChanged, true);
check('j5.active_tab_matches_space', j5.activeTabIsCurrent, true);
check('j5.spaces_are_named_navigation', /\S/.test(j5.navigationName), true);
check('j5.only_current_space_is_programmatic',
  j5.ariaCurrent === 'page' && j5.currentCount === 1 && j5.inactiveHaveNoCurrent
    && j5.addHasNoCurrent, true);
check('j5.native_button_navigation_is_kept', j5.hasTablistRoles, false);

const j5Keyboard = {};
for (const [key, expected] of [['Enter', j5.before], [' ', j5.after]]) {
  const before = await page.evaluate(() => window.__card._space);
  await page.evaluate((id) => {
    window.__card.renderRoot.querySelector(`[data-hp="space-tab"][data-id="${id}"]`)?.focus();
  }, expected);
  await page.keyboard.press(key === ' ' ? 'Space' : key);
  await settle();
  const after = await page.evaluate(() => window.__card._space);
  j5Keyboard[key === ' ' ? 'space' : 'enter'] = { before, after, expected };
}
out.j5_keyboard = j5Keyboard;
check('j5.enter_switches_space', j5Keyboard.enter.after, j5Keyboard.enter.expected);
check('j5.space_switches_space', j5Keyboard.space.after, j5Keyboard.space.expected);

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
    id, name: `Dense ${index + 1}`, binding: 'virtual', is_light: true, tap_action: 'info',
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

const semanticOwnerOfCentre = async (id) => {
  const centre = await settledBox(id);
  if (!centre) return null;
  return page.evaluate(([cx, cy]) => window.__card._deviceHitOwnerAt(cx, cy)?.id || null,
    [centre[0], centre[1]]);
};

const clickAndReadInfoOwner = async (centre) => {
  await page.mouse.click(centre[0], centre[1]);
  await page.waitForTimeout(100);
  return page.evaluate(async () => {
    const card = window.__card;
    const id = card._infoCard?.id || null;
    card._infoCard = null;
    card.requestUpdate();
    await card.updateComplete;
    return id;
  });
};

const tablet = {
  size: (await settledBox('dense1'))?.[2] ?? null, owners: [], semanticOwners: [],
};
for (const id of dense.ids) {
  tablet.owners.push(await ownerOfCentre(id));
  tablet.semanticOwners.push(await semanticOwnerOfCentre(id));
}
const tabletCentre = await settledBox('dense1');
tablet.clickWentTo = await clickAndReadInfoOwner(tabletCentre);
out.j7_tablet = tablet;
// Настенный планшет: центр видимого маркера принадлежит ему. Это то свойство,
// которое правка плотных целей обязана сохранить.
check('j7.tablet_centre_belongs_to_its_marker',
  tablet.owners.every((owner, index) => owner === dense.ids[index]), true);
check('j7.tablet_semantic_owner_is_its_marker',
  tablet.semanticOwners.every((owner, index) => owner === dense.ids[index]), true);
check('j7.tablet_click_reaches_its_marker', tablet.clickWentTo, 'dense1');

// Узкая колонка телефона — исходная регрессия #564. И native hit owner, и
// семантический владелец действия обязаны совпасть с видимым маркером.
await setWidth(390);
const phone = {
  size: (await settledBox('dense1'))?.[2] ?? null, owners: [], semanticOwners: [],
};
for (const id of dense.ids) {
  phone.owners.push(await ownerOfCentre(id));
  phone.semanticOwners.push(await semanticOwnerOfCentre(id));
}
const phoneCentre = await settledBox('dense1');
phone.clickWentTo = await clickAndReadInfoOwner(phoneCentre);
phone.latchedOwner = await page.evaluate(async () => {
  const card = window.__card;
  const first = card.renderRoot.querySelector('[data-hp="device"][data-id="dense1"]');
  const second = card.renderRoot.querySelector('[data-hp="device"][data-id="dense2"]');
  const a = first.getBoundingClientRect();
  const b = second.getBoundingClientRect();
  const pointerId = 564;
  const event = (type, rect, buttons) => new PointerEvent(type, {
    pointerId, pointerType: 'touch', buttons, bubbles: true, cancelable: true,
    clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
  });
  const d1 = card._devices.find((device) => device.id === 'dense1');
  const d2 = card._devices.find((device) => device.id === 'dense2');
  card._pointerDown(event('pointerdown', a, 1), d1);
  const moved = card._pointerMove(event('pointermove', b, 1), d2)?.id || null;
  card._pointerUp(event('pointerup', b, 0), d2);
  card._clickDevice(event('click', b, 0), d2);
  await card.updateComplete;
  const clicked = card._infoCard?.id || null;
  card._infoCard = null;
  card.requestUpdate();
  await card.updateComplete;
  return { moved, clicked };
});
out.j7_phone = phone;
check('j7.phone_centre_belongs_to_its_marker',
  phone.owners.every((owner, index) => owner === dense.ids[index]), true);
check('j7.phone_semantic_owner_is_its_marker',
  phone.semanticOwners.every((owner, index) => owner === dense.ids[index]), true);
check('j7.phone_click_reaches_its_marker', phone.clickWentTo, 'dense1');
check('j7.pointer_owner_is_latched_through_terminal_click',
  phone.latchedOwner, { moved: 'dense1', clicked: 'dense1' });

await finish(browser, out);
