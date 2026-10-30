Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче · Документ: docs/reviews/CODE-REVIEW-1089-r1.md

# Код-ревью #1089 — контекстное меню устройства в Просмотре (r1)

## Материал

SHA `f4cc0bd54be8d0fe43c367e4be067bfec859acf8` (рабочая копия уже на нём, `git rev-parse HEAD` в gitStatus совпадает). Диапазон коммитов подтверждён `read:log`: от `7da936ced feat: add guarded View device context menu` до `f4cc0bd54 Merge accepted scoped config validation and refresh joint metadata`, включая мерджи принятых соседних задач (#998, #1107, threshold alarms, #1096). Трек `ask`, маршрут вердикта — `fix` (задан пакетом, не пересматривается).

## Скоуп

ТЗ (тело issue #1089, раздел `## ТЗ`): отдельный transient View-owner контекстного меню из пяти команд (Настройки/HA more-info/Карточка/Скрыть-Показать/Удалить) по правому клику на устройство в обычном Просмотре, на общем UI Kit `EditorContextMenu`, без утечки в редактор, с переиспользованием существующих guard'ов прав/kiosk/HA-цели и существующих операций (#1050 settings, #1087 more-info resolver, #930 delete, device-inbox hide/show).

Риск по изменённым участкам (#707), сверено с AC:
- touch-токены (`houseplan-card.ts:7593`, `view-device-menu.ts:50,57`) — AC7 (отзыв intent), AC8 (outside-click), AC9 (touch/kiosk guard). Покрыто.
- perf-токен `getBoundingClientRect` (`view-device-menu.ts:105`) — AC8 (позиционирование у краёв), AC10 (нет per-frame скана: вызывается только внутри `render()`, т.е. только пока меню открыто, не в цикле). Покрыто.
- ux-токены — новые ключи `view.menu_*` (RU/EN/DE/FE) — AC1/AC3/AC5/AC11/AC12. Покрыто.

Все классы из пакета находят соответствующий AC в ТЗ; `reclassify` не требуется.

## Как проверялось

Static-first: прочитаны `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`, тело issue #1089 (ТЗ, хендофф, AC→witness таблица), затем независимо — вызывающий код и инварианты:

- `src/view-device-menu.ts` (целиком) — модель владельца, generation/current-guard, `availability()`, `invoke()`, `render()`.
- `src/houseplan-card.ts` — точка входа `_ctxDevice` (контекстное меню на маркере, `@contextmenu`), `_openMarkerDialog` (kiosk-отказ, #1050 guard), `_guardTouchGesture` (touch-хвосты), все сайты инкремента `_viewDeviceMenuRequest` (камера/пространство/blur/поворот/зум/pan).
- `src/view-runtimes.ts`, `src/view-runtime-code.ts` — ленивая загрузка (`ViewRuntimeBoundary`, fingerprint-проверка), баннер отказа/retry.
- `src/houseplan-editor-runtime.ts:_runViewDeviceMenuAction`, `src/marker-deletion.ts` — delete/visibility через существующие транзакции.
- `src/device-more-info.ts` (не изменён, переиспользован #1087) — проверено, что `resolveDeviceMoreInfoTarget` остаётся единственным источником HA-цели.
- `src/editor-context-menu-adoption.ts`, `src/editor-style-adoption.ts` — общий idempotent CSS-adopter, подключаемый один раз на root.
- Локали `ru/en/de/fr.json` — построчное сравнение новых ключей `view.menu_*`.
- `docs/ARCHITECTURE.md`, `docs/DEVICE-PRESENTATION.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`, `docs/USER-GUIDE(.ru).md`, `docs/CHANGELOG(.ru).md`, `docs/release-ledger/v1.82.0/1089.json`.
- `demo/smoke_view_device_menu.mjs`, `demo/smoke_view_device_menu_lifecycle.mjs`, `demo/golden/view-device-menu.mjs`, `scripts/mutation-registry.mjs`, `docs/testing-notes/mutation-browser-guards.md`, `test/view-device-menu.test.mjs` — построчный разбор сценариев и утверждений (не только список названий).

Выполнено адресно через `run_check`: `read:log` (подтверждение диапазона коммитов материала). Полных build/test/typecheck заново не гонял — компатибельный push/CI на этом материале уже зелёный (`validate-gate` run 40604554537, "review-light-golden proof is complete"), и пробела, требующего нового прогона, не нашёл (ниже — что именно покрывает это доказательство).

## Независимый разбор по рискам

- **ABA/stale target**: `ViewDeviceMenu` различает токен меню (`this.menu`) и принятый intent (`generation`). `open()` всегда зовёт `close()` → инкремент `generation`, что аннулирует любой ранее принятый `current()` даже если DOM/callback старого меню ещё жив. `invoke()` фиксирует `generation` и свежую `availability()` непосредственно перед диспетчем — права/HA-цель берутся не из рендера, а из момента выбора. Проверено код-чтением и трассировкой: `_ctxDevice` (houseplan-card.ts:5941) формирует `current()` с перепроверкой `_mode`, `_kiosk`, `_canEdit`, `_configWriteGuard()`, `_cfgRev`/`_layoutRev`/`adoptionEpoch` — то есть старый target не может быть принят после смены пространства/прав/конфигурации. Смоук `smoke_view_device_menu_lifecycle.mjs` исполняет это реальным held-import по 10 видам отзыва (permission/space/hidden/rebind/detach/newest/blur/pagehide/user/connection) и отдельно 5 видов отзыва во время открытого confirm-диалога Delete — GREEN в приложенном evidence, proof пригоден.
- **Закрытие меню vs отмена intent**: после принятого клика `this.menu = null` выставляется БЕЗ вызова `close()` (значит, `generation` не растёт) — обычное закрытие не отменяет уже разрешённую загрузку формы/async-операцию; `close()` (внешний retire/новый `open()`) явно увеличивает `generation`. Это именно контракт ТЗ («штатное закрытие меню после выбора не отменяет... внешняя навигация/отзыв прав её отменяют»), подтверждено юнитом `test/view-device-menu.test.mjs` («accepted selection survives normal menu close, external retirement cancels held load»).
- **Cold/warm и lazy-граница**: `settings`/`ha`/`info` не трогают `_ensureEditorRuntime()` вовсе (используют `host._openMarkerDialog`/`_openMoreInfo`/`_infoCard` напрямую); только `visibility`/`delete` грузят `_editorRuntime`. Отказ загрузки (`EditorRuntimeLoader.failed`) уже показывает тост с retry-advice через существующий общий колбэк (`houseplan-card.ts:692-699`), независимо от #1089 — переиспользуется, не продублирован. Отдельно сам модуль `view-device-menu.ts` грузится через собственный `ViewRuntimeBoundary` с fingerprint-проверкой и собственным баннером отказа/retry (`view-runtimes.ts: failures()`), что исполняет `smoke_view_device_menu_lifecycle.mjs` реальным `route().abort('failed')` + retry — GREEN.
- **Гонки при pan/zoom/повороте/камере**: все точки начала этих жестов (`_prepareCameraCommand`, `_zoomAt`, начало `_pointers.size===1`, `_rotatePlan`, `_commitSpace`, `_onWindowBlur`) инкрементируют тот же `_viewDeviceMenuRequest`, который формирует `current()` в `_ctxDevice`; на следующем рендере `ViewDeviceMenu.render()` видит `device=null` и зовёт `this.close()`. Механизм идентичен уже существующему (`_markerDialogRequest`, `_settingsDialogRequest`), это не новая конструкция с непроверенным поведением.
- **Touch/kiosk**: kiosk-путь не меняется — правый клик в kiosk идёт на `_openMarkerDialog(d, true)`, которая внутри `deviceEditorAllowed(canEdit, kiosk)` всё ещё возвращает `false` и показывает прежний тост отказа; новое меню в этот путь не включено. Touch-хвосты (`_touchClickGuard`, `_guardTouchGesture`) не изменены помимо однострочного инкремента `_viewDeviceMenuRequest` при `pointerdown`/`keydown`, пока `deviceMenu.state==='loading'`, что не меняет ни один существующий touch-инвариант.
- **Outside click / закрытие vs активация под меню**: `closingClick`/`closingPointer`/`freshInput` поглощают ровно один compatibility-клик по сохранённому `pointerId`, остальные проходят. Юнит и смоук оба подтверждают: один раз поглощается, повторный «чистый» ввод проходит немедленно — соответствует контракту «без таймера разблокировки».
- **Мутанты (без исполнения, статическая сверка)**: три собственных определения в `scripts/mutation-registry.mjs` (`view-menu-forgets-generation-1089`, `view-menu-outside-click-leaks-1089`, `view-menu-info-opens-wrong-target-1089`) сверены построчно с текущим кодом — строки `find` совпадают дословно с реальными `src/houseplan-card.ts`/`src/view-device-menu.ts` (не устарели). Статическая регистрация подтверждена чтением; не исполнялись — поимка принадлежит ночному прогону реестра (#709), это не found/PASS, а честно заявленное «не исполнялся», что соответствует политике.

## AC → доказательство (независимая сверка)

| AC | Проверено | Способ |
|---|---|---|
| AC1 | ✔ | Код: `@contextmenu` на маркере → `_ctxDevice` → `preventDefault/stopPropagation`, `_interruptViewGesture()`; пять пунктов в порядке `settings/ha/info/visibility/delete` в `render()`. Смоук: реальный правый клик, `getByRole('menuitem').allTextContents()` = 5 строк в порядке; Shift+F10 на фокусе — клавиатурный якорь у маркера, не (0,0) |
| AC2 | ✔ | `settings` не трогает editor-runtime boundary, зовёт `_openMarkerDialog(device, true, current)` (существующий #1050 guard: writer/kiosk/loaded/navigation/`_otherDialogsBlocked`). Смоук: реальное сохранение имени, читбек через `config/get` |
| AC3 | ✔ | `ha` зовёт немодифицированный `resolveDeviceMoreInfoTarget` (#1087), disabled-причины маппятся на `view.menu_*`. Смоук и lifecycle: точная своя сущность, disabled для foreign/missing при включённой локальной карточке |
| AC4 | ✔ | `info` — `host._infoCard = owner.current()`, без сервиса/записи. Смоук проверяет `writes+services===0` |
| AC5 | ✔ | `hidden` читается из `h._markers` (не из проекции), `inboxVisibilityAllowed` (существующий #930 источник). Смоук: реальный Hide/Show, read-back, rollback при отказе записи, «глаз»→Show без смены отметки |
| AC6 | ✔ | `delete` → `deletePlanDevice` (существующее подтверждение/транзакция, не изменено по существу, кроме внешнего `candidateCurrent`). Смоук: cancel без записи, confirm → tombstone, HA-реестр цел |
| AC7 | ✔ | `generation`/`current()` разбор выше; lifecycle-смоук реальным held-import по 10+5 видам отзыва |
| AC8 | ✔ | `role=menu/menuitem` через общий `EditorContextMenu` (не копия), `outside`/`closingClick`/`freshInput`. Смоук: Escape возвращает фокус, resize репозиционирует, outside не активирует устройство под меню |
| AC9 | ✔ | kiosk-путь не затронут (см. выше); touch-хвосты используют существующие guard'ы без изменения контракта |
| AC10 | ✔ | Лениво: `ViewDeviceMenu` — отдельный `ViewRuntimeBoundary`/fingerprint; settings/ha/info не грузят editor-runtime; failure/retry — общий существующий канал. Смоук: `performance.getEntriesByType('resource')` не содержит editor-чанк при простом открытии/инфо-командах |
| AC11 | ✔ (частично — проверено чтением сценариев, не глазами) | 4 golden-сцены (`demo/golden/view-device-menu.mjs`) с содержательными ассертами (5 строк, fits, no horizontal overflow, grid-presentation, корректный disabled-набор, `Показать на плане` для hidden); release-ledger `visual` с `baselineIndex`. Глобальные эталоны не требуются на этом этапе |
| AC12 | **частично — см. находку** | RU/EN/DE/FR полны и согласованы; CHANGELOG(.ru) и ARCHITECTURE/DEVICE-PRESENTATION/TOUCH-SUPPORT корректно описывают новое поведение; **UX-MODES.md содержит устаревший абзац, противоречащий новому контракту** (см. находку ниже) |

## Находки

### Medium (в скоупе) — M1: `docs/UX-MODES.md` описывает заменённое поведение #1050 как текущее

`docs/UX-MODES.md:3` (верхний баннер) корректно обновлён: «In ordinary View, right-click a device to choose Device settings, HA more-info, Device card, Hide ..., or Delete. ... (#1089)».

Но тот же документ в разделе про информационную карточку Просмотра (`docs/UX-MODES.md:252-254`) оставляет прежний текст без изменений:

> «The saved **Device settings** action and right click in View open that same device editor without changing mode (#1050). Both require the current loaded House Plan writer authority outside kiosk; otherwise they show the permission hint...»

Это прямо противоречит реализации и верхнему баннеру того же файла: правый клик в обычном Просмотре больше не открывает диалог настроек напрямую — сначала открывается меню из пяти команд, и «Настройки устройства» лишь первый его пункт (что сам баннер на `UX-MODES.md:3` и `docs/TOUCH-SUPPORT.md:117-119`, и `docs/DEVICE-PRESENTATION.md:638-641` формулируют верно). Абзац на строках 252-254 не отмечен как устаревший/замещённый и не упоминает #1089 вовсе — для случайного читателя (включая будущего автора задачи по этому же узлу, например #1081) это зафиксированное в каноне подсистемы неверное поведение.

AC12 ТЗ прямо требует: «Документы описывают замену только View ПКМ и принятые ограничения» — этот конкретный участок канонического документа подсистемы (`UX-MODES.md` входит в обязательный список AGENTS.md для нетривиальных правок режимов) не описывает замену, а повторяет уже отменённый контракт как действующий факт.

**Воспроизведение**: открыть `docs/UX-MODES.md`, сравнить строку 3 (новый контракт) со строками 252-254 (старый контракт, тот же файл, без пометки о замене).

**Серьёзность**: Medium, в скоупе — это прямое требование AC12 этой же задачи, не постороннее улучшение. Без High это жёлтый вердикт; правится в этом же issue (переформулировать 252-254 аналогично уже верно обновлённым `TOUCH-SUPPORT.md`/`DEVICE-PRESENTATION.md`, одной-двумя фразами, без расширения скоупа).

## Что проверено и корректно

- Модель владельца/generation/current-guard в `view-device-menu.ts` — корректна и соответствует контракту «нормальное закрытие ≠ отзыв intent».
- Переиспользование существующих guard'ов (#1050 settings, #1087 HA more-info, #930/#935 delete, device-inbox hide/show) — без дублирования источников прав или HA-цели.
- Общий `EditorContextMenu`/`editorContextMenuStyles` — единственная презентация; idempotent-адаптер стилей на shadow-root, без копии CSS для View.
- Ленивая граница (`ViewRuntimeBoundary` + fingerprint) — простое открытие/инфо-команды не грузят `houseplan-editor-runtime`; ошибка загрузки показывает существующий тост retry/refresh, отдельный баннер `view.menu_title` с кнопкой retry для самого chunk'а меню.
- i18n: все новые ключи `view.menu_*` присутствуют и согласованы в ru/en/de/fr; текст совпадает с ТЗ/CHANGELOG/USER-GUIDE.
- Release-артефакты: `docs/release-ledger/v1.82.0/1089.json` — `category: major` с обоснованием относительно v1.82.0, `visual` с 4 golden-сценами и `baselineIndex`; CHANGELOG.md/.ru.md пополнены в соответствующем описании одним согласованным абзацем на обоих языках.
- Мутанты: три определения в `scripts/mutation-registry.mjs` синтаксически и по месту совпадают с текущим кодом (не stale); корректно классифицированы в `docs/testing-notes/mutation-browser-guards.md`.
- Смоук/лайфсайкл-сценарии (`smoke_view_device_menu.mjs`, `smoke_view_device_menu_lifecycle.mjs`) — не фиктивные: реальные right-click, реальные HA/config read-back, содержательные негативные случаи (ABA, held import, strict HA foreign/missing, outside tail, failed import+retry).
- Golden-сценарий (`demo/golden/view-device-menu.mjs`) содержит исполняемые семантические проверки (fits/overflow/disabled-набор/label), а не только визуальное сравнение.

## Чего не проверял / ограничения

- Полный `npm run build`/`npm test`/`gate:small` заново не гонял: материал не менялся с момента зелёного `validate-gate` (run 40604554537, "review-light-golden proof is complete"), и не нашёл AC/риска без пригодного доказательства, требующего нового прогона — только `read:log` для сверки диапазона коммитов.
- Полную матрицу golden (все темы/разрешения) и ручную браузерную приёмку не проводил — не требуется на этом этапе (владелец не исполнял добровольную приёмку, что не является находкой; глобальные baseline принимает бета).
- Арифметику построчных комментариев `scripts/bundle-budget.mjs` (история дельт по прошлым задачам, `373914→375012`, `LAZY_EDITOR_GZIP_CEILING=373_073`, «inherited 1939-B gap») не пересчитывал самостоятельно — это многолетняя внутренняя бухгалтерия поверх ленты, зависящая от исторического состояния других задач; итоговое число совпадает с явным заявлением хендоффа («увеличен ровно на 1098 B до 373073»), а фактическую валидность проверяет существующий автоматический бюджетный тест при сборке, не покрытый адресным риском этого ревью.
- Полный реестр мутантов (1028 определений) не исполнял — вне раунда ревью по общей политике (#709, #905); для трёх новых определений выполнена только статическая сверка строк патча с текущим кодом.
- pytest tests_backend не запускал — ТЗ не предусматривает правку Python/backend (подтверждено: #1096 — уже принятый соседний backend-diff, вошедший через merge, не расширяет скоуп #1089).

## Гейты: что прогнано, что нет и почему

| Гейт | Статус | Основание |
|---|---|---|
| `validate-gate` (build/typecheck/bundle/тесты/смоуки на материале) | Переиспользован, не повторялся | Зелёный на точном материале `f4cc0bd54b`, run 40604554537 (контекст пакета); нет непокрытого AC/риска, требующего нового прогона |
| `read:log` | Выполнен | Сверка диапазона и порядка коммитов материала |
| Полный `npm run build`/`npm test`/`typecheck` | Не прогонялся | Не единственный способ проверки по политике (#857); переиспользуется готовый зелёный прогон на этом материале |
| Golden `view-device-menu-*` (4 сцены) | Не перегонялся повторно | Уже исполнены на материале (implementation-evidence), семантика сценария проверена чтением скрипта, а не повторным запуском |
| `pytest tests_backend` | Не запускался | Нет diff по Python в этой задаче |
| `npm run invariants` | Не запускался | Нет правки геометрии/привязанных к ней ссылок |
| Полный реестр мутаций | Не запускался (и не должен в этом раунде) | #709/#905 — ночной прогон, не гейт ревью |

## Унаследовано из r0

Раунд первый (r1), раздела «Унаследовано из r<N-1>» не требуется.

## Маршрут

`route: fix` (задан пакетом для трека `ask`; жёлтый вердикт возвращает автору на исправление M1 в том же issue).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjBkMzc3MTExMjg0Y2MyNTA4OGMwOTU1MzU2ODk0YWNjZjk3MDY0NjAwNDMzNGY0NzQ1MTcxODY1M2I5NWM1YmIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI4ZDNmZjdjYTQ2YzczZjZkZTY5MzJkM2ZiZGUxMzZlM2I4ODQ1ZTVmOWM3Y2UxN2VlYTBjMjhmZTZiYzc1OWU5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDg5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJmNGNjMGJkNTRiZThkMGZlNDNjMzY3ZTRiZTA2N2JmZWM4NTlhY2Y4IiwidHJlZSI6IjZkMDAxNzIyYTliMTkzMjAyNzViM2IyOTU3Y2NjMTFlMWVlYTUxNGEiLCJib2R5RGlnZXN0IjoiZTZhNGE1NjU4ZDI2YzQyMzFlZDZjMWI3N2ZmODhmZDViMDUzZDcxZDU3ZjAxZjQyOTY1NWE3YTRhZWZkOTY2YyIsInByb2R1Y2VyUnVuIjoiNDA2MDU3NTQ0OTUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjExNmI5OTBiOWIxNGM3YmY3MzgyMzdmMTZiMmY5ZTcwM2NiN2E4YTdmY2M5NDFhMDA0ZGFmOWQ2ZGQ0NWQ5NGQiLCJ2ZXJkaWN0RGlnZXN0IjoiYTA4ZjRiZTI2NTQzNmE5ZWQzZjRjNzZmMDEyZGQ0OTQ1NTA5ZjRlNjZkOTU2MTJlMDU0ZjM2ZWMzZGZkMGI2YSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkMzlhNGMxNGRhOWQ4MDdhNDYzYTk5MjZhMDFhNTIwYWJhYjYzZjY2NmU3NDU5NDE3MzNmZDlhNTYxNmVmYzZjIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDU3MDMxNTg3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDg5I2lzc3VlY29tbWVudC02NDU3MDMxNTg3IiwiYm9keURpZ2VzdCI6IjRiMWQ0YmFlY2ZkMmUyYjhmMzIyZDBjNTExMGY2Nzg5MTgzNGJkNWE4MWI1MTQzYjhmYjlhNzhiNDRiMGViN2YifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1089-view-device-menu`, коммит `f4cc0bd54be8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6d001722a9b19320275b3b2957ccc11e1eea514a`
  ```
  git log --all --format='%H %T' | grep 6d001722a9b1
  ```
- Тело issue: `e6a4a5658d26c4231ed6c1b77ff88fd5b053d71d57f01f429655a7a4aefd966c`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTQyLCJvdXRwdXRfdG9rZW5zIjo0OTc4NSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoyMjIyMDYsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo5NDY1MzQ1LCJjb3N0VXNkRXN0aW1hdGUiOjMuMjgwMDI3fV0sInR1cm5zIjo5MSwiZHVyYXRpb25NcyI6NjUwNjg1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6My4yODAwMjcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=142 output_tokens=49785 cache_creation_input_tokens=222206 cache_read_input_tokens=9465345 num_turns=91 -->
