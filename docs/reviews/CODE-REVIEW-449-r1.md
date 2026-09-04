# CODE-REVIEW-449-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/449
- Этап: код-ревью (PROCESS.md §2.7), заход r1, блокирующих циклов израсходовано 0/4
- ТЗ: `docs/specs/449-double-fit-all.md` (трек полный)
- SHA материала: `05ef318133ca54b1f702844253d06edd5a665c5e` (единственный код-коммит
  на ветке сверх `origin/dev`)
- Ветка: `issue/449-double-fit-all`

## Скоуп

Один коммит `feat: fit all on double background tap`:

- `src/houseplan-card.ts`, `src/room-fit.ts` — общий `DoubleFitGestureRecognizer`,
  единый gesture owner (`planGestureOwnerFromPath`), замена kiosk-only
  `_lastTap` на разделяемый со View контракт, `_fitAll` принимает reason
  `double-tap`.
- `test/room-fit.test.mjs` — unit-покрытие recognizer/owner.
- `scripts/mutation-gate.mjs` — 4 новых мутанта + правка 2 существующих под
  новую форму кода.
- `demo/smoke_room_fit.mjs`, `smoke_kiosk.mjs`, `smoke_kiosk_pan_lock.mjs`,
  `smoke_smooth_zoom.mjs` — расширенные сценарии.
- `docs/CANVAS.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`,
  `docs/USER-GUIDE.md(.ru)`, оба `CHANGELOG` — синхронно, `User-Visible: yes`.
- `dist/**` — пересобран.

Ревью полное (первый заход).

## Как проверялось — таблица гейтов

Зелёного Validate на этом SHA нет, все гейты ниже прогнаны локально мной.

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | **зелёный** |
| Юниты | `npm test` | **красный**: 3 из 1914 (`#438 полоса шире наблюдаемого шума метрики`, `манифест бандла не ссылается в никуда... (#349)`, `release ZIP inspection is portable...`). Разобрано ниже (H1, M1) |
| Сборка | `npm run build` | зелёный (детерминированно собирается, хеши чанков меняются между прогонами — ожидаемо, эмбеддед fingerprint) |
| Три копии бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` на закоммиченном HEAD | **красный**: `differ: byte 45, line 1` — см. H1 |
| any-гигиена | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | зелёный: «Новых any нет» |
| docs-гейт (диф трогает `src/**`) | `node scripts/check-docs.mjs` | **красный** (exit 1): «screenshot source fingerprint is stale» — см. H2. На `origin/dev` тот же скрипт зелёный, регрессия подтверждена сравнением |
| Подбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Прямое совпадение» — 35 файлов (полный список приведён ниже) |
| Прямые смоки (35 из «прямое совпадение») | `node demo/smoke_*.mjs` по каждому | 34 PASS, 1 **FAIL** (`smoke_kiosk_pan_lock.mjs`) — см. H3 |
| Мутанты #449 (4 новых) | `node scripts/mutation-gate.mjs --id=<id>` × 4 | все 4 «тест покраснел, как обязан» |
| Мутанты #152, тронутые рефактором (5 существующих) | `node scripts/mutation-gate.mjs --id=<id>` × 5 | 4 «покраснел», 1 **«остался зелёным на сломанном коде»** (`room-fit-enters-kiosk-double-tap-sequence`) — см. M1 |
| Инвентарь | `npm run inventory` | 1914 unit / 308 pure backend / 186 HA-harness / 221 smoke — справочно |
| golden:verify | не прогонялся | diff не трогает рендер/стили/геометрию — новый жест не рисует ничего нового; см. «Чего не проверял» |
| pytest tests_backend | не прогонялся | diff не касается `custom_components/**/*.py` |
| model-invariants | не прогонялся | diff не касается геометрии/`layout`/толщины стен |

Working tree после каждого гейта, менявшего файлы (`npm run build`,
`npm run bundle:sync`, mutation-gate), возвращён к состоянию коммита
(`git checkout -- . && git clean -fd` на затронутых путях) — в репозитории
никаких изменений не оставлено.

### Прямое совпадение smoke-select (35) — решение по каждому

`smoke_decor.mjs, smoke_editor_gestures.mjs, smoke_grid_scale_invariance.mjs,
smoke_room_fit.mjs, smoke_decor_default_persist.mjs, smoke_furniture.mjs,
smoke_lazy_editor_chunk.mjs, smoke_long_press_gesture.mjs, smoke_modes.mjs,
smoke_support_feedback.mjs, smoke_editor_tabs.mjs, smoke_isometric_contract.mjs,
smoke_junction_patch_resilience.mjs, smoke_resize_pointer_real_plan.mjs,
smoke_room_link.mjs, smoke_smooth_zoom.mjs, smoke_space_tab_reorder.mjs,
smoke_warm_dialogs.mjs, smoke_warm_owners.mjs, smoke_zoom_out.mjs,
smoke_audit_1490.mjs, smoke_backdrop.mjs, smoke_canvas_frame.mjs,
smoke_edit_walk.mjs, smoke_icon_center.mjs, smoke_infinite_canvas.mjs,
smoke_kiosk_pan_lock.mjs, smoke_linked_virtual_light.mjs, smoke_pan_any_zoom.mjs,
smoke_plan_snap_overlay.mjs, smoke_real_plan_masonry.mjs,
smoke_unified_wall_tool.mjs, smoke_vacuum_firstuse.mjs,
smoke_vacuum_multifloor.mjs, smoke_vacuum.mjs` — все прогнаны (плюс
`smoke_kiosk.mjs`, названный в AC3 напрямую). Решение: прогнать все 35, а не
выбирать по теме — инструмент отметил их как прямое совпадение по изменённым
символам (`_fitAll`, `_mode`, `_resetZoom`, `_roomPointer`, `_panLock`,
`_suppressClick`, `_vacFit`, `_continuity`, `_pinchStart`, `_panStart`,
`_holdFired`, `_editorRuntime`, `_modeTransitionBusy`, `_stagePointerCancel`), а
не по названию. «Слабая связь» (41 файл, одно распространённое имя) не
прогонялась — решение ревьюера: символы там (`_editorRuntime`,
`_modeTransitionBusy` и т. п.) относятся к неизменённым веткам этих файлов, а
диф не касается их логики.

## Находки

### High-1 — `custom_components/houseplan/frontend/**` не синхронизирован с `dist/**`: пользователь не получает фичу

Коммит пересобрал и закоммитил `dist/**` (видно в дифе), но не выполнил
`npm run bundle:sync` — вторая закоммиченная копия бандла, та, которую
устанавливает HACS и раздаёт интеграция, осталась на **предыдущей** сборке.

**Воспроизведение:**
```
$ cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js
dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js differ: byte 45, line 1
$ git log --oneline -1 -- custom_components/houseplan/frontend
8935a736 fix: accept Zigbee2MQTT raw network maps        # НЕ #449
$ git log --oneline -1 -- dist
05ef3181 feat: fit all on double background tap
```
Явное доказательство — файл с новым именем чанка есть только в `dist/`:
`dist/houseplan-assets/houseplan-card-CbNfZuwV.js` существует,
`custom_components/houseplan/frontend/houseplan-assets/houseplan-card-BgNWi9NC.js`
— это старый чанк (имя не поменялось со времён `8935a736`, до #449).

Это ровно тот гейт, который PROCESS.md §8 требует прогонять перед выходом из
«В разработке» (`npm run build && cmp dist/houseplan-card.js
custom_components/houseplan/frontend/houseplan-card.js`) — и он был бы красным
с первой попытки.

Автоматически это же ловят два теста из `npm test`:
- `манифест бандла не ссылается в никуда, обе копии целы и равны (#349)` (`test/bundle-tree-committed.test.mjs`) — `AssertionError: копии бандла разошлись`;
- `release ZIP inspection is portable and does not depend on tar` (`test/release-contract.test.mjs`) — sha256 закоммиченного `dist/houseplan-card.js` не совпадает с тем, что попадёт в релизный zip из `custom_components/houseplan`.

**Последствие:** релиз с этим коммитом отдаёт пользователям HACS-интеграцию без
жеста #449 — весь остальной код ревью (тесты, смоки, мутанты) проверяет код,
которого реальный пользователь не увидит.

**Исправление:** `npm run bundle:sync` и закоммитить результат в этом же коммите.

### High-2 — `docs`-гейт красный: скрипты не пересняты после правки `src/**`

```
$ node scripts/check-docs.mjs
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
$ echo $?
1
```
На `origin/dev` тот же скрипт зелёный («Documentation checks passed»). Диф
меняет `src/houseplan-card.ts` и `src/room-fit.ts`, отпечаток документации
считается по всему `src/**` — правило, повторённое в задании ревью буквально
с историей: «Пропуск этого шага в #230 и #234 оставил `dev` с красным job
`docs` до следующей задачи (#237)».

**Исправление:** `npm run build && node demo/docs/capture.mjs`, закоммитить.
ТЗ прямо говорит, что новых скриншотов не требуется («статический вид не
меняется») — но фингерпринт пересчитывается механически по исходникам, а не
по итоговой картинке, так что пересъёмка (даже с побайтово идентичным
результатом, если камера та же) обязательна.

### High-3 — заявленное доказательство AC3 красное: `demo/smoke_kiosk_pan_lock.mjs`

AC3 («Kiosk использует общий contract без регрессии навигации») называет этот
смок доказательством. Он падает:

```
$ node demo/smoke_kiosk_pan_lock.mjs
...
FAILED (1):
  - doubleTapStillResetsZoom: expected true, got false
```

**Причина (разобрано инструментированным прогоном сценария):** сценарий 4
смока делает `home()` → `_applyView(2)` → два клика по фону (id 58, id 60) — всё
синхронно, без ожидания макротаска. Перед этим сценарий 1–3 гоняет реальные
pan-жесты, последний из которых (`straightPan`, id 57) взводит
`this._suppressClick = true` на `pointerup`. Сброс отложен:

```ts
// src/houseplan-card.ts, _stagePointerUp
if (this._suppressClick) setTimeout(() => (this._suppressClick = false), 0);
```

`_doubleFitEnabled` требует `!this._suppressClick`. Если следующий
`pointerdown`/`pointerup` (первая и вторая половина double-tap) происходит до
срабатывания этого `setTimeout(0)`, `_doubleFitEnabled` остаётся `false` для
**обеих** половин — кандидат не взводится вовсе, `_fitAll` не вызывается ни
разу. Прямая проверка (инструментированный повтор того же сценария):

```
debugZoom (после двух тапов id 58/60)                  = 2   // не изменился
debugDirectFitZoom (сразу же вызванный _fitAll('fit'))  = 1   // корректная цель
```

Итог: не «другая цель», а полностью проглоченный жест.

Это регрессия именно #449: до этой задачи kiosk-сброс зума не проверял
`_suppressClick` вовсе (старая ветка `_lastTap` в `_stagePointerUp` читала
только `_swipeStart`/движение). Начиная с этого коммита kiosk-таблица
double-tap разделяет общий `_doubleFitEnabled`, и получила вместе с ним новую
гонку между отложенным сбросом `_suppressClick` и следующим касанием.

В реальном использовании окно гонки — один macrotask (~0 мс), обычный человек
вряд ли попадёт в него пальцем сразу после панорамирования; но ровно это и
проверяет смок синхронной подачей событий, и он назван ТЗ как обязательное
доказательство AC3 — и это доказательство ложно-зелёным не является, оно
честно красное.

**Исправление на усмотрение автора:** либо не гейтить взвод первой половины
double-tap через `_suppressClick` (у него уже есть отдельная роль — подавлять
одиночный click), либо синхронизировать сброс (например, сбрасывать
`_suppressClick` сразу, а не через `setTimeout(0)`, раз причина отложенности
была про порядок с нативным `click`-событием — нужно перепроверить, не сломает
ли это исходный сценарий #396). Смок либо чинится по коду, либо (если решение
— «это приемлемая деградация в 1 macrotask») ТЗ и смок обновляются вместе, с
объяснением, а не молча.

## Medium (в скоупе — чинится в этой же задаче)

### Medium-1 — bundle budget: запас ушёл ниже шумовой полосы

```
$ npm test  →  not ok: "#438 полоса шире наблюдаемого шума метрики"
error: 'сверху меньше 500 Б — это шум'
```
`dist/houseplan-assets.json.initialViewGzipBytes`: на `origin/dev` — 295066 Б,
на этой ветке — 295743 Б (+677 Б от нового recognizer/теста). Потолок 296000 Б
± 2000. Запас сократился с 934 Б до 257 Б — меньше требуемых тестом 500 Б.
`npm run bundle:budget` формально ещё проходит (потолок не пробит), но ратчет
собственным тестом сигналит: рост наблюдаемый и заметный, тест обязан либо
увидеть поднятый потолок в этом же коммите (документированная практика
ратчета, см. комментарии `#367` в `test/bundle-assets.test.mjs`), либо код
нужно уменьшить. AC11 прямо заявляет «initial bundle проходит действующий
потолок» и ссылается на `bundle:budget` — сейчас его более строгая версия в
`npm test` красная.

**Исправление:** поднять `INITIAL_VIEW_GZIP_CEILING`/`INITIAL_VIEW_CEILING_BAND`
в `scripts/bundle-budget.mjs` вместе с этим коммитом, либо срезать рост.

### Medium-2 — мутант `room-fit-enters-kiosk-double-tap-sequence` больше ничего не ловит

```
$ node scripts/mutation-gate.mjs --id=room-fit-enters-kiosk-double-tap-sequence
ok   чистый прогон: node demo/smoke_room_fit.mjs
FAIL room-fit-enters-kiosk-double-tap-sequence: тест остался зелёным на сломанном коде
     a room-owned tap must not update the kiosk free-background double-tap sequence
     or unexpectedly reach the whole plan (#152 AC8)
```
Мутация убирает `!acceptedRoom` из guard'а kiosk-ветки `_stagePointerUp`. До
#449 внутри этого же `if` жила double-tap-логика (`_lastTap`), поэтому снятие
guard'а реально пускало room-релиз в double-tap-последовательность. #449
вынес double-tap целиком в `this._doubleFit.pointerUp(...)`, вызываемый
**до** этого `if` и независимо от `acceptedRoom` — у него своя защита через
`owner.kind !== 'background'`. Мутация в старом месте теперь не трогает ничего
значимого, `smoke_room_fit.mjs` остаётся зелёным не потому что защита жива, а
потому что мутированный код больше ни на что не влияет.

Функционально дыры нет — то же самое поведение (room-таб не взводит
double-fit) отдельно и прямо проверяется новым unit-тестом
(`#449 moved, cancelled, multitouch, foreign-owner...` со входом
`{ owner: { kind: 'room', roomId: 'room-a' } }`) и новыми полями смока
(`areaLinkSuppressesRoomFit`, `kioskRoomTapDoesNotEnterDoubleTap`) — оба
прошли. Проблема узкая: конкретно этот исторический свидетель ослеп и будет
молча стоять в дереве, выдавая мнимое покрытие любому, кто позже тронет этот
код и понадеется на мутацию как на страховку (тот самый паттерн #421/#423/#430
из вводной к этому ревью).

**Исправление:** переписать `find`/`replace` мутанта на актуальное место
защиты (`input.owner.kind !== 'background'` в `completeDoubleFitPointer`) —
дублировать с `double-fit-free-background-owner-removed` не обязательно, но
нынешний текст мутанта нужно удалить или перенаправить на реальный код.

## Low

### Low-1 — AC5 для device/opening доказана только чтением, не смоком

ТЗ (AC5) обещает «targeted production-bundle smoke для device, opening и room
link». Смок получил только room link
(`areaLinkSuppressesRoomFit` в `smoke_room_fit.mjs`); double-click по `.dev`/
`.opening` в живом DOM никакой новый смок не проверяет.

Проверено чтением: `planGestureOwnerFromPath` матчит `.dev`, `.opening`,
`.op-hit`, `.oplock`, `.vacpuck` в `ROOM_FIT_INTERACTIVE_OWNER`
(`src/room-fit.ts`), эти классы реально проставлены на отрендеренных узлах
(`src/houseplan-card.ts:12547` — `.dev`, `:13061`/`:13067` — `.opening`/
`.op-hit`); `_doubleFit.pointerDown` вызывается безусловно на каждый
`pointerdown` до любых mode-specific ранних `return`, так что реальный тап по
устройству/проёму в View корректно резолвится как `interactive` до того, как
путь дойдёт до `.stage`. Юнит-таблица `planGestureOwnerFromPath` в
`test/room-fit.test.mjs` покрывает `.dev`/`.opening`/`[data-room-fit-block]`
явно. Риск невысокий, но обещанный смок не доставлен — оставляю как Low,
автор вправе снять запись, если считает юнит-покрытие достаточным (тогда
ТЗ-пункт AC5 по факту доказан частично смоком, частично кодом — стоит явно
пометить в задаче).

## Таблица «AC → чем доказан → чем краснеет»

| AC | Доказательство | Статус | Чем краснеет |
|---|---|---|---|
| AC1 mouse double-click = toolbar fit-all | `smoke_room_fit.mjs`: `normalViewDoubleClickMatchesFitAll`, `normalViewUsesDoubleTapReason` | PASS | не проверялся отдельным мутантом; `double-fit-bypasses-canonical-fit-all` мутант ловит подмену `_fitAll`→`_resetZoom` |
| AC2 touch/pen double-tap, без смешения modality | `smoke_room_fit.mjs`: `mixedModalitiesDoNotPair`, `penPairUsesSameFitAll`; unit «#449 an expired tap…» | PASS | unit-таблица с явными `assert.equal` на смешанной модальности |
| AC3 kiosk parity | `smoke_kiosk.mjs` PASS, `smoke_kiosk_pan_lock.mjs` **FAIL** | **FAIL** | см. High-3 |
| AC4 комната вне sequence | `smoke_room_fit.mjs`: `kioskRoomTapDoesNotEnterDoubleTap` PASS; мутант `room-fit-enters-kiosk-double-tap-sequence` | функционально PASS, свидетель ослеп | см. Medium-2 |
| AC5 interactive owners подавляют жест | unit-таблица owner (room/device/opening/link/button); смок только для room link | частично PASS | мутант `double-fit-free-background-owner-removed` ловит снятие owner-guard'а целиком (не по каждому классу отдельно) |
| AC6 навигационные жесты не завершаются как double-tap | unit «#449 moved, cancelled, multitouch…»; `smoke_room_fit.mjs`: `cancelDisarmsThePreviousTap`; `smoke_kiosk_pan_lock.mjs` (кроме сценария 4) | PASS (кроме пересечения с High-3) | мутант `double-fit-navigation-block-ignored` |
| AC7 редакторы не меняются | `smoke_editor_gestures.mjs` PASS; `smoke_room_fit.mjs`: `editorBackgroundDoesNotFit` PASS; unit `{mode:'decor'}`/`{mode:'plan'}` | PASS | мутант `double-fit-editor-mode-enabled` |
| AC8 sequence изолирована, 2 инстанса | unit «#449 recognizer instances keep independent transient sequences» | PASS (проверено чтением для mode/space/projection lifecycle — см. ниже) | нет отдельного мутанта; риск низкий, логика самокоррекции при следующем pointerDown разобрана в тексте ревью |
| AC9 camera transition единый | код идентичен `_fitAll('fit'\|'home')`, третий reason не создаёт новый путь; `smoke_smooth_zoom.mjs` (`card._fitAll('double-tap')`) PASS | PASS, проверено чтением + существующий smoke | наследует защиту #82, отдельного нового мутанта нет — обоснованно, путь не новый |
| AC10 нет server/HA side effects | код-ревью: `_fitAll`/`DoubleFitGestureRecognizer` не содержат `callService`/`save`/навигации | PASS, проверено чтением | не проверялось отдельным spy-смоком; риск низкий (чистые функции + переиспользование существующей команды) |
| AC11 perf/bundle budget | `no-new-any` зелёный; `npm run bundle:budget` зелёный (с предупреждением о низком запасе — не новый долг, #367); `npm test` bundle-assets — **FAIL** | **FAIL** | см. Medium-1 |

## Что проверено и корректно

- Чистая типизация, `no-new-any` — новый код не добавляет `any`.
- Архитектура recognizer'а (`beginDoubleFitPointer`/`completeDoubleFitPointer` —
  чистые функции без DOM/side effects, `DoubleFitGestureRecognizer` — тонкая
  обёртка с try/catch fail-safe на `composedPath()`) соответствует принятым
  предположениям ТЗ (Pointer Events, без нового timer/RAF на первом тапе).
  Подтверждено чтением: нет `setInterval`/новых RAF-циклов, `pointerDown`
  делает ровно один owner-lookup и O(1) запись.
  `_doubleFit.clearOutside` корректно закрывает случай, когда фокус
  переходит на элемент вне stage (composedPath не долетает до `.stage`).
- Общий owner (`planGestureOwnerFromPath`) — единственный источник для
  room-fit и double-fit, расхождения между #152 и #449 нет (заявленное в ТЗ
  требование выполнено).
- 33 из 34 unit-тестов `test/room-fit.test.mjs` (включая новые для #449)
  прочитаны целиком: таблицы owner/candidate/sequence покрывают позитивные и
  отрицательные пути с явными ожиданиями, тест умеет падать — проверено 3
  целевыми мутантами (см. таблицу выше), все три поймали свою поломку.
  Четвёртый мутант (`double-fit-bypasses-canonical-fit-all`, через
  `smoke_room_fit.mjs`) тоже поймал.
  Итого 4 из 4 новых мутантов ловят — «сколько мутантов принесла задача»
  здесь ненулевое и рабочее, в отличие от старого свидетеля (Medium-2).
- `docs/CANVAS.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`,
  `docs/USER-GUIDE.ru.md`/`.md` обновлены по существу: терминология
  («Вписать всё», «Просмотр», «киоск») соответствует уже принятой в
  `USER-GUIDE.ru.md`, ничего не изобретено. `UX-MODES.md` заодно поправил
  устаревшую фразу «room taps do nothing since v1.40.1» на актуальное «room
  click/tap → room fit» — попутная, но верная и мелкая правка синхронно с
  темой строки.
- Оба `CHANGELOG` (RU/EN) правлены в этом же коммите, запись пользовательская,
  без внутренних имён — соответствует `User-Visible: yes`.
- «Одно число — один источник»: диф не вводит новых видимых пользователю
  чисел (zoom/viewBox не показываются как текст), контроль неприменим.
- Мутация `double-fit-bypasses-canonical-fit-all` явно доказывает, что жест не
  подменяет канонический `_fitAll` на локальный `_resetZoom`, — то самое
  требование ТЗ «Второй controller... запрещён».

## Чего не проверял

- **`npm run golden:verify`** — не прогонял. Diff не меняет разметку, стили,
  геометрию или что-либо рисуемое; новый жест управляет только камерой тем же
  путём, что уже покрытые golden-сценариями «Вписать всё»/kiosk-reset. Риск
  визуальной регрессии считаю нулевым; предрелizный гейт всё равно прогонит
  его перед бетой.
- **`python -m pytest tests_backend`** — не прогонял, diff не касается
  `custom_components/**/*.py`.
- **`node scripts/model-invariants.mjs`** — не прогонял, diff не меняет
  геометрию, `layout`, `marker.space` или толщину стен.
- **Полный набор `demo/smoke_*.mjs` (221 файл)** — не прогонял целиком, это
  предрелизная обязанность (§8), не гейт ревью; прогнал прямое совпадение
  (35) целиком и это уже поймало регрессию (High-3).
- **«Слабая связь» smoke-select (41 файл)** — не прогонял, символы там не
  относятся к затронутым веткам логики.
- **Реальное устройство/браузер (ручное тестирование)** — вне цикла ревью по
  правилам PROCESS.md §2.7; вместо этого — код-чтение и автотесты.
- **Perf-профили** — не названы в AC сверх bundle budget, не прогонял.

## Итог

3 High (шипуется без фичи в реальном пакете; `docs`-гейт красный; названное
доказательство AC3 красное) + 2 Medium в скоупе (bundle-budget headroom;
ослепший мутант) + 1 Low (снято с пометкой — неполный, но компенсированный
чтением, набор смоков для AC5). Присутствие High делает вердикт красным
независимо от Medium/Low.

Все три High и оба Medium чинятся в этой же задаче без переоценки скоупа:
`npm run bundle:sync` + `npm run build && node demo/docs/capture.mjs` (в
комплекте один локальный проход `npm test`/`cmp`/`check-docs`, чтобы не
разъезжаться повторно), правка гонки `_suppressClick`↔double-tap (или
осознанная правка смока+ТЗ, если деградация признана приемлемой), подъём
bundle-budget потолка и ремонт/удаление ослепшего мутанта.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/449-double-fit-all`, коммит `05ef318133ca` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `548b50a1b777369620551358d0288bfc879c2b5b`
  ```
  git log --all --format='%H %T' | grep 548b50a1b777
  ```
- ТЗ `docs/specs/449-double-fit-all.md`, блоб `d6ddccbb3920bdffbb8414f4b6c225a4cdf4f420`
  ```
  git log --all --find-object=d6ddccbb3920bdffbb8414f4b6c225a4cdf4f420 -- docs/specs/449-double-fit-all.md
  ```
