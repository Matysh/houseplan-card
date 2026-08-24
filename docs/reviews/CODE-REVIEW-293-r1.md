# CODE-REVIEW-293-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/293
- **Ветка:** `issue/293-resize-pointer-noop` (HEAD `0a52b675`, детач от неё)
- **База:** `origin/dev`
- **ТЗ:** `docs/specs/293-resize-pointer-noop.md`, ревью ТЗ зелёное на r2
  (`docs/reviews/SPEC-REVIEW-293-r2.md`)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4 (первый заход этапа
  code-review — счётчик спека и код-ревью раздельны, §10.4)

## Скоуп диффа

`git diff origin/dev...HEAD` — 24 файла, 1114/-57. Продуктовый код: 5 коммитов
(`8eb351ba`…`0a52b675`), два помечены `User-Visible: yes`
(`6c5163c3`, `e2c1dbec`), остальные — тесты/документация.

Ядро фикса:

1. `src/resize.ts` — новая чистая функция `safeResizePointerDisplacement`:
   смещение считается от точки `pointerdown`, а не от `plan.a` (абсолютной
   позиции стены). Это и есть причина бага из issue: старый код проецировал
   *текущую* точку указателя на нормаль относительно стены, а не относительно
   стартовой точки жеста, поэтому клик где угодно на стене сразу давал большое
   `d`, а `clampSafeResize`/дальнейшая логика ошибочно душила это смещение до
   нуля на реальной геометрии (в синтетических тестах паттерн клика совпадал
   со стартовой точкой стены и маскировал дефект).
2. `src/houseplan-card.ts` — `_rszEdgeDown` сохраняет стартовую SVG-точку в
   `_rszDrag.start`; `_rszMove` использует новую функцию; `_rszApplyPreview`
   возвращает структурированную причину отказа (`missing-context` /
   `wall-metadata` / `open-span-metadata` / `physical-geometry`) вместо
   `boolean` и теперь прогоняет **тот же** fail-closed physical-geometry
   preflight (`_rszSpaceCandidateRenderable`, вынесенный из бывшего
   `_rszCandidateRenderable`) на каждом кандидате предпросмотра, а не только
   на pointerup; непредсказуемый reject показывает один тост
   `resize.preview_failed` за жест (`rejectNotified`).
3. `src/houseplan-card.ts` `_applyGeometryState` — новый параметр
   `allowHistoryBoundaryRepair`; Undo/Redo и `_undoActiveDraftPoint` передают
   `true`, что разрешает восстановление снапшота истории, даже если строгая
   physical-geometry проверка возвращает конкретно `wall-degraded-extra`
   (не любую причину). `_writeConfig` при этом продолжает строго проверять
   исходящий кандидат — послабление касается только локального восстановления
   уже показанного пользователю состояния, не персистентности.
4. `src/wall-thickness.ts` `rekeyWallsAfterMove` — атомы, полученные при рекее
   двух независимых владельцев общего шва, теперь склеиваются обратно в одну
   запись толщины, если стыкуются встык и коллинеарны; несовпадающие по
   направлению атомы по-прежнему остаются раздельными (сохранение поведения
   #253). Эта функция используется и Resize, и `plan-optimizer.ts` (Optimize) —
   изменение задевает оба потребителя.
5. Новый smoke `demo/smoke_resize_pointer_real_plan.mjs` — реальные
   `page.mouse.*` события на живом бандле, карточка создаётся через
   `config/get`, без обращения к приватным resize-методам (проверено
   отдельным unit-тестом на источник смока).
6. `scripts/mutation-gate.mjs` — 5 новых мутантов
   (`resize-pointer-delta-zeroed`, `resize-shared-seam-not-coalesced`,
   `resize-pointer-capture-removed`, `resize-preview-reject-silent`,
   `resize-history-boundary-repair-removed`).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | 1246 тестов, 1245 pass, 1 skip, 0 fail |
| Build + bundle parity | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | `MATCH`; после `npm run bundle:sync` третья копия `demo/srv/assets/houseplan-card.js` тоже побайтово совпала; `git status --short` пуст — рабочее дерево уже содержало актуальный бандл |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — коммит `0a52b675` уже обновил `sourceFingerprint` |
| Smoke selection | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 18 «прямых совпадений» (в основном по широким символам `_svgPoint`/`_showToast`/`_writeConfig`, которые сами не менялись, только вызываются из нового кода) плюс 1 «зарегистрированная связь» — `smoke_resize_pointer_real_plan.mjs`. Разбор по строкам ниже |
| Целевой smoke | `node demo/smoke_resize_pointer_real_plan.mjs` | `OK`, все проверки зелёные |
| Смежные Resize-смоки | `node demo/smoke_room_resize.mjs`, `smoke_resize_wall_thickness.mjs`, `smoke_resize_outer_reconciliation.mjs`, `smoke_resize_virtual_thick.mjs`, `smoke_resize_audit_1550.mjs`, `smoke_wall_union_isolation.mjs` | все `OK` (AC9) |
| Model invariants | `node scripts/model-invariants.mjs --config <дамп сервер-конфига после реального resize-жеста на real-plan-second-floor.json>` | `Инварианты выполнены: ссылки разрешимы, записи толщины находятся.` Дамп получен прогоном настоящего браузерного жеста (`page.mouse.*`, не приватные методы) поверх `demo/serve.mjs`; количество wall-записей до/после — 24/24, `open_spans` 0/0 |
| Mutation gate (targeted) | `node scripts/mutation-gate.mjs --check` (применимость всех патчей) + `--id=resize-pointer-delta-zeroed`, `--id=resize-shared-seam-not-coalesced`, `--id=resize-history-boundary-repair-removed`, `--id=resize-pointer-capture-removed`, `--id=resize-preview-reject-silent` | все патчи применились; каждый мутант «поймано 1 из 1» — целевой тест реально красится |
| Performance | `node demo/benchmark_safe_resize.mjs`, `node demo/benchmark_safe_resize_render.mjs` | `pass: true` на обоих; pointer p95 0.018 мс (бюджет 16 мс), commit-preflight p95 0.0018 мс (бюджет 75 мс), render p95 1.4 мс (бюджет 25 мс) — новая проверка physical-geometry на каждом кандидате предпросмотра (см. находку L1) бюджет не задевает |
| Backend | не прогонялся | `custom_components/**/*.py` в диффе нет — не нужен по правилу §8 |
| Golden | не прогонялся | см. «Чего не проверял» |

### Разбор выборки смоков

Прямые совпадения по `_svgPoint`, `_showToast`, `_writeConfig` — эти функции
сами не менялись (диф не трогает их тела), только добавлены новые вызовы уже
существующих методов внутри resize-кода. Смоки вне темы Resize
(`smoke_grid_snap`, `smoke_decor`, `smoke_island_rooms`, `smoke_hide_layers`,
`smoke_card_tool_conflict`, `smoke_drag_bounds`, `smoke_partition_openings`,
`smoke_help_affordance`, `smoke_optimize_coordinate_canonicalization`,
`smoke_space_tab_reorder`, `smoke_bg_color`, `smoke_lattice_write_barrier`) не
прогонялись целиком — совпадение по одноимённому широко используемому символу,
не по изменённой логике; полный прогон всей матрицы — предрелизный гейт.
Resize-тематические смоки из этого же списка (`smoke_resize_wall_thickness`,
`smoke_resize_outer_reconciliation`, `smoke_resize_virtual_thick`,
`smoke_resize_audit_1550`, `smoke_wall_union_isolation`, `smoke_room_resize`)
прогнаны — см. таблицу выше.

## Разбор по AC

| AC | Статус | Доказательство |
|---|---|---|
| AC1 (реальный drag работает) | ✅ | `smoke_resize_pointer_real_plan.mjs`: `dom_preview_ten_steps`, `preview_not_persisted`, `both_rooms_commit_ten_steps` |
| AC2 (жест не теряется за пределами хэндла) | ✅ | тот же smoke: `capture_beyond_handle`, `capture_travels_past_hit_area` (движение считается относительно фактического `hitRadiusSvg`, не константы); мутант `resize-pointer-capture-removed` красит именно этот smoke |
| AC3 (delta не зависит от точки клика вдоль стены) | ✅ | unit `test/resize.test.mjs` «#293 pointer displacement…» — три разных `start` вдоль нормали `[1,0]`, включая обратную нормаль `[-1,0]`; интеграционная точка применения (`g.start` вместо `plan.a`) — одна строка, прочитана и подтверждена; мутант `resize-pointer-delta-zeroed` красит именно этот тест |
| AC4 (один commit и Undo) | ✅ | smoke: `one_history_command`, `one_atomic_write`, `undo_keyboard_consumed_history`, `undo_byte_exact`, `undo_one_atomic_write`; отдельный фикс `_applyGeometryState`/`allowHistoryBoundaryRepair` подтверждён мутантом `resize-history-boundary-repair-removed` (красит тот же smoke) |
| AC5 (Esc/interruption безопасны) | ✅ | smoke: `escape_restores_config`, `escape_zero_extra_write`, `unrelated_pointer_ignored`, `preview_before_capture_loss`, `capture_loss_restores_dom/config`, `capture_loss_zero_extra_write` |
| AC6 (reject не молчит) | ✅ | `demo/smoke_room_resize.mjs`: `preflight_visible_reason`, `preflight_reason_once` (тост ровно один раз при повторных move-событиях в рамках одного отклонённого жеста); мутант `resize-preview-reject-silent` красит этот smoke |
| AC7 (metadata/topology сохраняются) | ✅ | smoke `wall_metadata_preserved`; независимо — `npm run invariants` на реальном пост-resize конфиге (24 wall-записи до/после, ссылки разрешимы); unit `test/wall-thickness.test.mjs` «issue 293 moving a shared seam…» проверяет и склейку, и сохранение раздельности для некомпланарных атомов; мутант `resize-shared-seam-not-coalesced` красит юнит |
| AC8 (harness не даёт ложную зелень) | ✅ | `fixture_is_current_server_space`/`fixture_loaded` проверки в начале smoke; unit «#293 real-plan smoke cannot bypass the production pointer pipeline» запрещает вызовы `_rszMove`/`_rszApplyPreview`/`_rszUp`/`applySafeResize`/`clampSafeResize`/`validateSafeResize` из текста смока через `assert.doesNotMatch`; `smoke_room_resize.mjs` добавил `commit_preflight_no_commit`/`commit_preflight_zero_write` для отдельного барьера pointerup |
| AC9 (регрессия существующих сценариев) | ✅ | `smoke_room_resize.mjs` целиком зелёный (включая новые сценарии из этой задачи), `smoke_resize_wall_thickness/outer_reconciliation/virtual_thick/audit_1550`, `smoke_wall_union_isolation` — все `OK` |
| AC10 (локальные гейты) | ✅ | таблица выше; `check-docs` обязателен и пройден, targeted smoke+mutation прогнаны лично |

## Находки

Блокирующих (High) находок нет. Одна находка ниже помечена Low — не блокирует,
оставляю с запиской, так как не искажает ни один AC и не относится к
заявленному сценарию.

**L1 — расширение зоны действия правки за пределы Resize (наблюдение, не
блокирует).** `rekeyWallsAfterMove` в `src/wall-thickness.ts` используется не
только Resize (`src/houseplan-card.ts:8541`), но и Optimize
(`src/plan-optimizer.ts:572`). Новая склейка коллинеарных атомов меняет
поведение Optimize тоже, хотя раздел «Область» ТЗ называет только «production
pointer pipeline safe Resize» и явно не упоминает Optimize как задетую
подсистему. Технически это неизбежное следствие исправления общей функции
(без него AC7 не выполняется на реальной геометрии — двое независимых
владельцев одного шва иначе продолжают дробить физически целую стену на
записи), и оно не ослабляет прежний тест на #253 (лоссless split для
некомпланарных атомов подтверждён новым unit-тестом), а `smoke_resize_outer_
reconciliation.mjs` (сценарий Optimize) остаётся зелёным. Считаю находку не
дефектом, а стоящей записью: если Optimize на других реальных планах когда-нибудь
начнёт сливать записи с разной физической толщиной по разные стороны шва
(что текущий `collinearForward`/`closePoint` не проверяет отдельно от
направления и точки стыка, но проверяет исходный `w.cm` — единый на все атомы
одной физической стены, так что это не тот случай), это будет faster to trace
благодаря явному комментарию и тесту, добавленным в этом же диффе. Не требую
правки; фиксирую для протокола.

## Что проверено и корректно

- Корень бага (проекция на нормаль от `plan.a` вместо стартовой точки) найден
  точно и устранён точечно — один вызов заменён на чистую функцию с
  собственным unit-тестом.
- Reject-путь live preview теперь возвращает структурированную причину и
  корректно не спамит тостами; final commit-preflight на pointerup остаётся
  independent барьером (не доверяет факту показанного превью — новый сценарий
  `commit_preflight_*` в `smoke_room_resize.mjs` это явно проверяет).
- Physical-geometry preflight на каждом кандидате предпросмотра — не
  регрессия по производительности: оба бенчмарка (`benchmark_safe_resize`,
  `benchmark_safe_resize_render`) проходят с большим запасом от бюджета.
- Ослабление проверки при Undo/Redo (`allowHistoryBoundaryRepair`) сужено до
  одной конкретной причины отказа (`wall-degraded-extra`), не любой; путь
  записи на сервер (`_writeConfig`) не ослаблен — комментарий в коде и
  мутационный тест это подтверждают.
- i18n: оба ключа (`resize.preview_failed`) добавлены в `en.json` и `ru.json`
  в одном и том же коммите с кодом (`6c5163c3`), оба changelog обновлены в тех
  же коммитах, где стоит `User-Visible: yes` (`6c5163c3`, `e2c1dbec`).
- `scripts/smoke-links.mjs` обновлён под новый экспорт
  `safeResizePointerDisplacement` и новый smoke — реестр не отстал от кода.
- Единственное число, которое пользователь видит дважды в этой задаче,—
  величина смещения стены в предпросмотре — считается один раз в
  `safeResizePointerDisplacement`/`clampSafeResize` и это тот же путь, что
  использует commit; отдельного превью-числа с другим источником диф не
  вводит. Тост `resize.preview_failed` не содержит числа. `test/single-source-
  numbers.test.mjs` прошёл в составе `npm test`.
- Ни одного `console.*`/`debugger` в диффе; `git status` после
  `build`/`bundle:sync` чист — сгенерированные копии в коммитах побайтово
  совпадают с тем, что собирается из текущего исходника.

## Чего не проверял

- **Golden** (`npm run golden:verify`) — не прогонял. Диф не меняет видимую
  геометрию рендера сам по себе (только исправляет то, что раньше не
  работало вовсе — само по себе движение стены уже покрыто smoke-проверками
  DOM-координат хэндлов и общей стены); визуальных сценариев, завязанных на
  Resize-предпросмотр, в golden-наборе нет отдельно от смоков. Полный golden —
  предрелizный гейт.
- **Полная матрица браузерных смоков** (`ls demo/smoke_*.mjs | wc -l`) — не
  прогонял, прогнаны только Resize-тематические и указанные `smoke-select`
  плюс отобранные вручную по теме диффа (список в таблице). Слабые совпадения
  по `_svgPoint`/`_showToast`/`_writeConfig` вне Resize не прогонялись — эти
  функции не менялись, только вызваны из нового кода.
- **`python -m pytest tests_backend`** — не прогонял, диф не касается
  `custom_components/**/*.py`.
- **Touch-физическое устройство** — safety floor (`pointercancel`,
  чужой `pointerId`, `lostpointercapture`) проверен через синтетические
  `PointerEvent`/DOM API в смоках, не на реальном тач-экране; это тот же
  уровень доказательства, что и у остальных Resize-смоков в проекте.
- **Полный HA harness / WSL** — недоступен в этом окружении; диф не трогает
  backend, поэтому не требуется правилом §8.

## Вывод

Все 10 AC доказаны автотестом, который умеет падать (5 из них — явным
мутационным тестом на живом бандле), либо разобраны по коду. Обязательные
гейты (`typecheck`, `test`, `build`+parity, `check-docs`) зелёные, дополнительно
прогнаны инварианты модели на реальном пост-resize конфиге, целевые
resize-смоки, целевые мутанты и оба performance-бенчмарка. Единственная находка
(L1) — Low, не в скоупе для правки, зафиксирована с обоснованием, почему она не
дефект. Вердикт: зелёный.
