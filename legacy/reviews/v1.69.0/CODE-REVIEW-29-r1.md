# CODE-REVIEW-29-r1

- Issue: #29 «[HP-UX-02] inbox и жизненный цикл устройств»
- Этап: code (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4 (первый реальный код-ревью:
  предыдущая попытка была остановлена до чтения кода из-за конфликта ребейза —
  см. комментарий issue от 2026-08-27T22:42:46Z — поэтому дельта-режим §2.9 не
  применяется, разбор ниже полный)
- Проверено на SHA `905d4847a3797a8830eb6c5c509351f142193b73` (ветка
  `issue/29-device-inbox-lifecycle`, перебазирована на `origin/dev@2c20f2d`)
- ТЗ: `docs/specs/029-device-inbox-lifecycle.md`, зелёный spec-review r2
  (`docs/reviews/SPEC-REVIEW-29-r2.md`)

## Скоуп изменения

Один коммит `905d4847` (Issue #29, User-Visible: yes, оба CHANGELOG в этом же
коммите):

- новый чистый модуль `src/device-inbox.ts` (281 строка): `bindingCandidates`
  (общий eligibility-helper, вынесенный из `_bindingCandidates`),
  `buildDeviceInbox` (резолвер строк каталога), `filterDeviceInbox`;
- `src/houseplan-card.ts`: диалог каталога устройств (`_renderDeviceInbox` и
  ~15 приватных методов), замена кнопок «Добавить»/«Скрытые и деактивированные»
  на «Устройства», перенос ghost-toggle внутрь каталога;
- `src/styles/dialogs.styles.ts` (+135), `src/hp-dialog.ts` (параметризована
  ширина wide-диалога);
- `src/i18n/en.json` / `ru.json` (+45 ключей `device_inbox.*`, обновлён
  `marker.hide_tip`);
- `test/device-inbox.test.mjs` (154 строки, чистый модуль);
- `demo/smoke_device_inbox.mjs` (новый), `demo/smoke_hidden_flag.mjs`
  (адаптирован под перенос ghost-toggle);
- `demo/golden/{harness,matrix}.mjs` — 3 новых golden-сценария
  (`device-inbox-desktop-en-light/ru-dark/narrow-ru-dark`);
- `scripts/mutation-gate.mjs`, `tsconfig.test.json` — точечные правки под
  перенос кода в `device-inbox.ts`;
- документация: `docs/ARCHITECTURE.md`, `docs/FILTERING.md`, `docs/TESTING.md`,
  `docs/USER-GUIDE.md`/`.ru.md`, `docs/STATUS.md`, `docs/CHANGELOG.md`/`.ru.md`,
  golden-скриншоты и `screenshots.json` (docs-check зелёный, см. ниже).

## Как проверялось

Гейты, реально прогнанные мной на дереве SHA `905d4847`:

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | `# tests 1400 / pass 1399 / fail 0 / skipped 1` |
| `npm run build` | собран `dist/houseplan-card.js` за 10.8s |
| `md5sum dist/… custom_components/…` | идентичны после чистой пересборки (bundle:sync подтверждён) |
| `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| `npm run bundle:sync` | пересобрал и синхронизировал все три копии, включая недостающую `demo/srv/assets/…` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 75 прямых совпадений, много «зарегистрированных связей», 41 слабая связь (полный вывод ниже) |
| `node demo/smoke_device_inbox.mjs` | `OK`, все 12 проверок true |
| `node demo/smoke_binding_picker.mjs` | `OK`, все 24 проверки true |
| `node demo/smoke_hidden_flag.mjs` | `OK`, все 27 проверок true |
| `node scripts/mutation-gate.mjs --id=device-tombstone-blocks-child-picker` | `поймано 1 из 1` — тест умеет падать |
| `npm run inventory` | Node unit 1400, backend pure 198, HA-harness 143, browser smokes 194 (совпадает с числами автора после ребейза) |
| `node demo/smoke_editor_tabs.mjs` | **FAILED** — `devBarBtns: expected true, got false` (находка H1 ниже) |
| `gh run view` на точный SHA `905d4847` | CI уже прогнан и **red**: job «Смоки в браузере (шард 2 из 3)» упал именно на `smoke_editor_tabs` с той же ошибкой; job «Golden» упал на 3 `missing-baseline` для новых сценариев (ожидаемо, см. «Что не проверялось») |

`smoke-select` — «прямое совпадение» (75) в основном ложноположительное: почти
все совпадения идут по родовым символам `_markerDialog`/`_openMarkerDialog`/
`_maybeRebuildDevices`/`_infoCard`/`_config`/`_spaceDialog`/`_zoom`, которые
задеты только потому, что `this._markerDialog = null` заменено на
`this._closeMarkerDialog()` в нескольких местах кода, не относящихся к
каталогу. Прочитал `_closeMarkerDialog()` (houseplan-card.ts:14173-14186): вне
пути возврата из каталога (`_deviceInboxReturn` не установлен) он делает ровно
то же самое, `this._markerDialog = null`, — поведение для всех смоков вне темы
каталога не меняется. Прогонять все 75 не стал; прогнал три прямо тематических
(`smoke_device_inbox`, `smoke_binding_picker`, `smoke_hidden_flag` — все зелёные
выше) и, поскольку инструмент относит `smoke_editor_tabs.mjs` только к «слабой
связи» (общее имя `_saveConfig`), посмотрел его отдельно из-за прецедента
#234 («по названию не про тему — на деле регрессия») — и он оказался красным
(находка H1). Остальные слабые связи не прогонял: все они делят по одному
общему символу (`_saveConfig`/`_applyView`/`_zoom`/`_model` и т.п.) с
изменёнными строками, не относящимися по смыслу к каталогу устройств.

Прочитан полный diff `src/houseplan-card.ts` (687 строк) построчно и полностью
модуль `src/device-inbox.ts`; сверено с ТЗ по каждому AC1–AC11 (детали в
следующем разделе), с `docs/SCOPE.md` (J4/J6, admin persona, desktop-first) и
с `docs/USER-GUIDE.ru.md` (терминология «На плане/Доступны/Скрытые/Доступны
снова», «Показывать скрытые на плане» и т.д. совпадает 1:1 с UI-строками).

## Находки

### H1 — `demo/smoke_editor_tabs.mjs` сломан этим диффом (High, в скоупе)

`demo/smoke_editor_tabs.mjs:159` — существующая, не тронутая этим PR строка:

```js
out.devBarBtns = sr().querySelectorAll('.editbar.devbar .btn:not(.barclose)').length === 3; // add/show-all/rules (v1.33.2: Reset removed)
```

ТЗ §10.1 сознательно заменяет две кнопки («Добавить», «Скрытые и
деактивированные») на одну («Устройства»), оставляя «Правила иконок» —
итоговый devbar имеет 2 кнопки, не 3. Ассерт не обновлён.

Воспроизведение — не гипотеза, дважды подтверждено:

1. Локально: `node demo/smoke_editor_tabs.mjs` → `FAILED (1): - devBarBtns:
   expected true, got false`.
2. В CI на точном SHA задачи: run `33123777345` (`Проверка (CI)`, SHA
   `905d4847…`), job «Смоки в браузере (шард 2 из 3)»
   (https://github.com/Matysh/houseplan-card/actions/runs/33123777345/job/98697171028)
   уже красный с той же строкой: `FAIL smoke_editor_tabs` /
   `devBarBtns: expected true, got false`.

Это ровно тот класс дефекта, о котором предупреждает прецедент #234: смок
называется «editor_tabs» и не намекает на устройства, `smoke-select` относит
его только к слабой связи по общему имени `_saveConfig` — но по факту это
прямая регрессия темы задачи. `smoke` — один из обязательных gate-джобов
(`AGENTS.md`: `docs, provenance, process-gate, hacs, hassfest, frontend,
smoke, golden, performance_smoke, backend`), и он объективно красный на SHA
задачи прямо сейчас, а не гипотетически. Фикс тривиален и целиком в скоупе
задачи: обновить ожидаемое число (и комментарий `add/show-all/rules`) до 2
кнопок/`devices/rules`; отдельный issue не заводится (решение владельца
2026-08-19, #202).

### M2 — «комната» в каталоге — это имя HA-зоны, а не название комнаты плана (Medium, в скоупе)

`src/houseplan-card.ts`, `_deviceInboxRows()`:

```js
const areaNames: Record<string, string> = {};
for (const [id, area] of Object.entries<any>(this.hass?.areas || {})) areaNames[id] = area?.name || id;
```

Это единственный источник поля `areaName`/поисковой строки для «комнаты» в
каталоге (`src/device-inbox.ts` строит `searchText` и мета-строку строго из
переданных `areaNames`). Значение берётся из **имени HA-зоны** (`hass.areas`),
а не из **имени комнаты плана** (`RoomCfg.name`), которое пользователь
свободно переименовывает независимо от HA (единственное место записи —
`room.name = this._nameSel.trim() || room.name` в диалоге комнаты,
houseplan-card.ts:19386, без всякой синхронизации с зоной HA) и которое
показывается везде на самом плане (подпись комнаты на канвасе —
`${r.name}` — houseplan-card.ts:19054; sub-label бинд-пикера —
`(sp.title || sp.id) + ' · ' + r.name`, houseplan-card.ts:14571/14576).

Сам каталог явно различает эти два понятия: причина `no_bound_room`
переведена как «Зона HA не связана с комнатой плана» — то есть «зона» и
«комната» осознанно не одно и то же. При этом ТЗ §10.2 требует показывать в
строке «пространство и комнату», а `docs/USER-GUIDE.ru.md` (этот же коммит)
прямо обещает: «Поиск работает по имени, модели, интеграции, комнате,
пространству и exact binding» — то есть комнатой пользователю обещан
объект, названный так, как он называется на плане, а не как называется зона
Home Assistant.

Воспроизводимый сценарий: пользователь переименовал в редакторе плана
комнату «Kitchen» (имя зоны HA) в «Кухня-столовая» (`room.name`). На плане и
в бинд-пикере отображается «Кухня-столовая». В каталоге устройств та же
строка покажет и будет искаться по «Kitchen» — расхождение с тем, что видно
на самом плане, прямо в задаче, продукт которой — «объяснить, почему
устройство там, где оно есть» (§2 «После» ТЗ). Это не гипотетический边ge
case: `room.name` независимо редактируется в стандартном рабочем процессе, не
только в экзотике.

Исправление в скоупе: строить `areaNames` (или отдельный `roomNames`) из
`this._areaToSpace[areaId]?.room?.name`, а не из `this.hass?.areas`; на
`hass.areas` можно откатываться только для `available`-кандидатов без
привязанной комнаты (`no_bound_room`), где комнаты действительно ещё нет.

### L3 — `DeviceInboxRow.canOpenHa` — мёртвое поле (Low)

`src/device-inbox.ts:245`: `const canOpenHa = kind === 'device' || kind ===
'entity';` — тривиально всегда `true` (у `kind` только два значения), и само
поле нигде не читается: рендер каталога (`houseplan-card.ts`) использует
отдельный, независимый метод `this._bindingHasHaPage(row.binding)` для того
же решения. Не влияет на поведение — предлагаю удалить поле как неиспользуемое,
либо, если оно задумано для другого потребителя, использовать per отчёту.
Не блокирует; можно оставить с пометкой в этом документе (снято ревьюером).

## Проверено чтением и признано корректным

- **AC1** (единая точка входа): подтверждено кодом и `smoke_device_inbox`
  (`oneCatalogEntryPoint`), плюс `smoke_editor_tabs` фактически доказывает
  замену кнопок (см. H1 — сам факт правильный, сломан только счётчик).
- **AC2** (детерминированная классификация): приоритет `removed → hidden →
  on_plan → available` в `buildDeviceInbox` (device-inbox.ts:219-224) читается
  ровно как в §7.2 ТЗ; unit-тест «full lifecycle matrix» покрывает auto
  no-marker, manual/automatic hidden, ha_disabled, orphaned, unverified,
  removed active/missing, parent-tombstone+live-child, synthetic light group,
  candidate без комнаты — все проходят зелёным.
- **AC3** (auto/new): `isNew: !!runtime && newDeviceIds.has(runtime.id)`,
  подтверждён unit-тестами (`device:auto`/`device:d3`) и не снимается Find
  (`_findInboxDevice` не трогает `_newIds`), снимается только через
  `_openMarkerDialog` → `_ackNewDevice` (существующий контракт, не менялся).
- **AC4** (lifecycle/HA-status независимы): проверено unit-тестом
  «HA status overlays lifecycle…» — `hidden:true+ha_disabled` остаётся в
  `hidden`, `canShow=false`, `canFind` включается только вместе с
  `showHiddenOnPlan`; `limited registry` (`unverified`) не создаёт ложный
  disabled/orphaned — статус остаётся `unverified` дословно.
- **AC5** (exact binding/re-add): device-parent tombstone и live entity child
  дают разные строки (`readd`/`on_plan`) в unit-тесте №1; логика материализации
  Re-add переиспользует немодифицированный `_saveMarker`/`deletePlanMarkerRecords`
  (контракт #262), только точка входа `_closeMarkerDialog` заменяет
  `this._markerDialog = null`. Подтверждено `smoke_binding_picker` (24/24) и
  mutation-gate (`device-tombstone-blocks-child-picker` — поймано 1/1).
- **AC6** (действия): Find/Edit/Hide/Show/Add/Hide-from-list/Re-add сверены
  построчно с таблицей §10.3; `_setInboxHidden` использует существующий
  `marker.hidden`, не создаёт tombstone, требует `status.kind==='active'`,
  что совпадает с `canHide`/`canShow` в резолвере. Ghost-toggle перенесён и
  проверен `smoke_hidden_flag` (`ghostToggleMovedIntoCatalog`, `ghostInEditor`
  и весь остальной набор — 27/27).
- **AC7** (read-only): открытие/поиск/смена вкладки/Show more/Find не
  вызывают `_saveConfig`/websocket-запись — проверено чтением всех
  обработчиков (только присвоения `this._deviceInbox = {...}`) и
  подтверждено `smoke_device_inbox.browsingIsReadOnly` (перехват `callWS`,
  сравнение `config/layout/cfgRev/layoutRev` до/после — 0 записей).
- **AC8** (возврат/refresh): `_deviceInboxReturn` восстанавливает
  tab/search/filter и `anchor` после Cancel/Save, `_deviceInboxMemo`
  инвалидируется по `cfgRev/cfgEpoch/regSignature/newSyncKey` — подтверждено
  `smoke_device_inbox.nestedCancelReturnsContext`.
- **AC9** (поиск/большие реестры): `bindingCandidates` не режет список до
  фильтрации (только глобальная сортировка), пагинация (`limit`) применяется
  строго после `filterDeviceInbox` — подтверждено unit-тестом на 260 сущностях
  (находит `entity_259`, за пределами старого cap=200) и
  `smoke_device_inbox.searchUsesFullSnapshot`.
- **AC10** (accessibility/responsive): `role=tablist`/`aria-selected`,
  `aria-live=polite`, стрелочная навигация (`_deviceInboxTabKey`,
  подтверждена `smoke_device_inbox.arrowChangesTab`), нет горизонтального
  скролла на десктопе (`noHorizontalOverflow`) и в golden narrow-сценарии
  (`device-inbox-narrow-ru-dark`, ширина 390px, harness проверяет
  `scrollWidth <= clientWidth+1`). Полный ручной keyboard-проход (Tab по всем
  действиям, focus-restore при закрытии) не выполнялся — см. «Что не
  проверялось».
- **AC11** (compatibility): `npm test` зелёный целиком (1399/1400, 1
  пропущен), включая незатронутые regression-наборы `devices.test.mjs`,
  `ha-binding-status.test.mjs`; miграция конфигурации не добавлена
  (`filter_seeded`/`show_all` логика не изменена по существу — см. отдельно
  ниже).
- Три golden-сценария (`device-inbox-desktop-en-light/ru-dark`,
  `device-inbox-narrow-ru-dark`) добавлены в матрицу и harness-препарация
  проверяет 4 вкладки + отсутствие горизонтального переполнения.
- Трейлеры коммита корректны: один коммит, `Issue: #29`, `User-Visible: yes`,
  оба CHANGELOG в этом же коммите.
- Отдельно проверил переход `_showAll`/`_showHidden`/legacy `settings.show_all`
  (комментарий автора в коде: «Legacy configs still honour it through
  buildDevices until they are seeded»): для конфигов до `filter_seeded` окно,
  где чекбокс «Показывать скрытые на плане» не мог бы выключить унаследованный
  `show_all:true`, закрывается автоматически при первом
  `_maybeRebuildDevices()` редактирующего клиента (сидер удаляет
  `settings.show_all`, houseplan-card.ts:3693) — это существующий,
  немодифицированный этой задачей механизм; не завожу как находку.

## Чего не проверял и почему

- **Полный набор `demo/smoke_*.mjs` (194 файла)** — не прогонял целиком;
  прогнал 4 тематических (`device_inbox`, `binding_picker`, `hidden_flag`,
  `editor_tabs` — последний отдельно из-за прецедента #234) плюс сверил
  вывод `smoke-select`. Полный набор — обязанность pre-release гейта
  (PROCESS.md §8) и одновременно уже прогнан в CI (см. H1) — красный сейчас
  именно на `editor_tabs`, других красных смоков в этом прогоне CI не было.
- **`npm run golden:verify` / приёмка baseline** — не прогонял. Три новых
  golden-ID (`device-inbox-*`) не имеют базовых кадров; CI на этом SHA уже
  показал `missing-baseline` для всех трёх (job «Golden», run 33123777345) —
  это ожидаемое, задокументированное поведение (PROCESS.md: baseline
  принимается только `npm run golden:accept -- --reviewed` на полном Linux
  CI-артефакте, не в рамках код-ревью), а не находка.
- **`python -m pytest tests_backend`** — diff не трогает
  `custom_components/**/*.py`; backend-код не менялся.
- **Performance-профили** — АС/риски (§17 ТЗ) не called out perf budget,
  `smoke-select` не выделил performance-чувствительные пути; unit-тест на
  260 записях покрывает синтетический large-registry сценарий, отдельный
  benchmark не запускал.
- **Ручной keyboard/screen-reader проход** — полагался на чтение разметки
  (roles/aria-атрибуты) и golden/smoke автоматику; полного ручного прохода
  Tab-порядка по всем действиям строки не делал.
- **71 из 75 «прямых совпадений» `smoke-select`** — не прогонял; обоснование
  см. в разделе «Как проверялось» (общие символы `_markerDialog` и т.п.,
  поведение вне пути возврата из каталога не меняется — проверено чтением
  `_closeMarkerDialog`).

## Вывод

Один подтверждённый High (сломанный существующий смок, воспроизведён и
локально, и в реальном CI-прогоне на SHA задачи) и один Medium в скоупе
(источник имени «комната» в каталоге — HA-зона вместо имени комнаты плана,
расходится с остальным UI и с обещанием user-guide). Оба чинятся в этой же
задаче без нового issue. Функциональное ядро (резолвер, read-only контракт,
поиск, re-add/exact-binding семантика) проверено тестами, которые умеют
падать (mutation-gate), и не вызывает возражений.
