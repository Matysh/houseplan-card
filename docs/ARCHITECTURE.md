# Архитектура House Plan

Обновлено: 2026-07-04 (v1.2.2). Репозиторий = HACS-интеграция (категория **Integration**),
которая содержит и бэкенд (`custom_components/houseplan`), и Lovelace-карточку (`src/` → `dist/`).

## Состав

```
houseplan-card/
├─ src/                          # исходники карточки (TypeScript + Lit 3)
│  ├─ houseplan-card.ts          # карточка: рендер, состояния, drag, tooltip, sticky-шапка
│  ├─ editor.ts                  # GUI-редактор конфига (ha-form + селекторы)
│  ├─ rules.ts                   # правила иконок (iconFor), курирование, группы, приоритет доменов
│  └─ data/
│     ├─ house.ts                # геометрия: ROOMS (комнаты→area), FLOOR_VB (viewBox), названия
│     └─ backgrounds.ts          # ВЕКТОРНЫЕ планы (SVG base64) + FLOOR_BG_RECT (позиционирование)
├─ dist/houseplan-card.js        # сборка (rollup+terser), ~290 КБ, планы внутри
├─ custom_components/houseplan/  # интеграция HA
│  ├─ __init__.py                # setup: Store, WS-команды, раздача JS (add_extra_js_url)
│  ├─ websocket_api.py           # houseplan/layout/get|set|update
│  ├─ config_flow.py             # одна запись; опция admin_only (правка только админам)
│  ├─ const.py                   # DOMAIN, STORAGE_KEY, VERSION, FRONTEND_URL
│  └─ frontend/houseplan-card.js # копия dist, раздаётся как /houseplan_files/houseplan-card.js
├─ assets/                       # исходники планов: f1_plan.svg, f2_plan.svg (РЕМПЛАННЕР), *_bg.png (старые растровые)
├─ hacs.json                     # манифест HACS
└─ docs/                         # эта документация
```

## Ключевые решения

1. **Один репозиторий — интеграция + карточка.** Интеграция сама раздаёт JS
   (`hass.http.async_register_static_paths` + `frontend.add_extra_js_url`), пользователю не
   нужно прописывать ресурс Lovelace. Паттерн как у browser_mod/xiaomi_vacuum_map.
2. **Раскладка иконок — на сервере.** `helpers.storage.Store(1, "houseplan.layout")` →
   `.storage/houseplan.layout`. Карточка читает/пишет через `hass.callWS`
   (`houseplan/layout/get|set|update`). Fallback — localStorage (если интеграции нет).
3. **Без токена.** Всё из объекта `hass` фронтенда: `hass.states` (реактивно),
   `hass.devices/entities/areas` (реестры). Никаких прямых WS-подключений.
4. **Реактивность.** Каждое изменение состояния в HA приводит к set hass → re-render.
   Температуры/LQI/вкл-выкл live по определению (проверено подменой state).

## Координатная система

- Базовое пространство: **1489×1053** («пиксели» старого PNG-рендера, 1 ед. = 1 px).
  Все комнаты, позиции иконок и viewBox этажей — в нём. НЕ менять без миграции раскладки.
- Векторные планы вставляются `<image href=svg>` в прямоугольник `FLOOR_BG_RECT`:
  - f1: scale **0.647**, offset **(490, 27)** → rect [490, 27, 774.2, 949.3]
  - f2: scale **0.896**, offset **(351, 21)** → rect [351, 21, 1048.4, 961.4]
  - вычислено растровой корреляцией (cv2.matchTemplate по бинаризованным картам темноты)
    рендера SVG с эталонным PNG; точность ~1 px. Скрипты воспроизводимы (docs/DEVELOPMENT.md).
- Комнаты (`ROOMS`) сняппены к внутренним граням стен (полуавто: поиск ближайшей «тёмной линии»
  по профилю + ручная доводка по overlay-рендерам).

## Модель данных карточки (runtime)

`DevItem`: id (device_id), name, model, area, floor, icon, entities[], primary (сущность для
more-info по приоритету доменов), temp, members[] (группа ламп), link/linkPrimary (Z2M-группа).

Построение из реестров (`_buildDevices`), правила 1-в-1 из прототипа:
- показываются только устройства с area из списка комнат;
- скрываются: entry_type=service, интеграции из EXCLUDED_DOMAINS, model=Group, сцены, мосты,
  под-устройства myheat, дубли по «имя|area»;
- **устройство с сущностью `lock.*` всегда получает `mdi:lock`** (TTLock-замки в реестре
  называются «Дом»/«Терраса»/«Кладовка» — по имени не распознать);
- лампы (mdi:lightbulb) ≥2 в комнате схлопываются в группу `mdi:lightbulb-group`
  (клик → меню: вся группа + отдельные).

## Живые данные

- Температура: сущность с device_class=temperature / °C / `_temperature$` → метка справа.
- LQI (zigbee): среднее по `*_linkquality`-сущностям → метка под иконкой; цвет
  `lqiColor()`: ≤40 красный → ≥180 зелёный (hsl-градиент). Среднее по комнате — в тултипе комнаты.
- Классы состояния иконки: on (жёлтый), open (оранжевый: cover/valve/lock/binary_sensor
  проблемных классов), unavail (прозрачность).

## Размеры

`icon_size` в конфиге = **% ширины видимой области плана** (дефолт 2.5). Реализация:
`.stage { container-type: inline-size }` + размеры в `cqw`. Легаси px-значения (>8) игнорируются.

## Sticky-шапка

`.head { position: sticky; top: var(--header-height, 56px) }`; ОБЯЗАТЕЛЬНО
`ha-card { overflow: visible }` — `overflow: hidden` ломает sticky.

## Маркеры устройств (v1.6.0+)

`config.markers[]`: `{id, binding:'device:<id>'|'entity:<eid>'|'virtual', space?, area?, hidden?,
name?, icon?, model?, link?, description?, pdfs:[{name,url}]}`. Гибрид: авто-устройства HA
появляются сами; маркер с `binding=device:<id>` их перекрывает (метаданные/перепривязка/скрытие),
`entity:<eid>` — для групп/хелперов, `virtual` — ручной значок без HA. id маркера = device_id /
`lg_<eid>` / `v_<rand>` (сохраняет позицию в layout). Пикер привязки исключает уже размещённые
ссылки и дубли по имя|area. Файлы-инструкции: `houseplan/file/set` → `/config/houseplan/files/<id>/`,
отдача `/houseplan_files/files/`.

## Серверная конфигурация (v1.3.0+)

`.storage/houseplan.config` (Store):
```json
{ "spaces": [{ "id","title","plan_url","aspect","view_box":[4],"rooms":[{"id","name","area","x","y","w","h"}] }],
  "device_overrides": {"<device_id>": {"hidden","icon","name"}},
  "virtual_devices": [{"id","space","name","icon","x","y","note?","entity_id?"}],
  "settings": {"exclude_integrations":[],"group_lights":true} }
```
Все координаты **нормированные (0..1 от плана пространства)**; рендер-пространство
1000 × 1000/aspect. Раскладка v2: `{device_id: {"s": space, "x", "y"}}` (нормир.).
Файлы планов: `<config>/houseplan/plans/<space>.<ext>` → URL `/houseplan_files/plans/…`.
Если server config пуст — карточка работает от legacy-бандла (дача) и показывает кнопку
миграции «На сервер» в режиме правки. Дача мигрирована 2026-07-04.

## Редактор разметки (v1.4.0+)

Состояние в карточке: `_markup` (режим), `_tool` (draw/erase/delroom), `_path` (текущий контур,
вершины по сетке GRID_N=60). Клики по stage → `_svgPoint`→`_snap`. Каждая пара точек добавляет
сегмент в `space.segments` (дедуп по ключу, сохранение config/set с дебаунсом). Контур замкнут
= клик по первой вершине → селект зоны (hass.areas) + имя → room {poly}. Комнаты-полигоны и
прямоугольники рендерятся единообразно (hit-test: point-in-polygon / rect).

## WS API интеграции

| Команда | Параметры | Ответ |
|---|---|---|
| `houseplan/layout/get` | — | `{layout: {device_id: {x,y}}}` |
| `houseplan/layout/set` | `layout` | `{ok}` (admin_only опционально) |
| `houseplan/layout/update` | `device_id`, `pos` | `{ok}` |
| `houseplan/config/get` | — | `{config, rev}` |
| `houseplan/config/set` | `config`, `expected_rev?` | `{ok, rev}` / err `conflict`; событие `houseplan_config_updated` |
| `houseplan/plan/set` | `space_id`, `ext` (svg/png/jpg/webp), `data` (b64, ≤8МБ) | `{ok, url}` |
| `houseplan/file/set` | `marker_id`, `filename`, `data` (b64, ≤25МБ) | `{ok, url, name}` |
