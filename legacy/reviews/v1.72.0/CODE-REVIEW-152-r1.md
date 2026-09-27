# CODE-REVIEW-152-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/152
- Ветка: `issue/152-room-click-fit`
- SHA материала: `a54addb694a38baad7fe289c7eb9ab3d90c99704`
- Диапазон: `origin/dev..HEAD` (merge-base `d5bfa0e3`)
- Заход: r1 (код-ревью) · блокирующих циклов израсходовано 0 из 4 на этом этапе
- ТЗ: `docs/specs/152-room-click-fit.md` (r2, зелёное ревью ТЗ подтверждено в
  `docs/reviews/SPEC-REVIEW-152-r2.md`, коммит `f672de67`)

## Скоуп

10 коммитов от `f29c4c5b` (спека) до `a54addb6` (принятие provenance
скриншотов). Продуктовый код: новый `src/room-fit.ts` (чистая геометрия/hit
ownership), интеграция в `src/houseplan-card.ts` (`_stagePointerDown/Move/Up/Cancel`,
`_fitRoom`, `_roomFitBounds`, `_renderRoomLabel`, resize-refit), новый
`CameraTransitionReason: 'room'` в `src/viewport-transition.ts`, механический
вынос части существующих хелперов в новый `src/card-runtime.ts` (лимит размера
основного файла), 4 новых мутанта в `scripts/mutation-gate.mjs`, поднятие
`bundle:budget` потолка 294 000 → 296 000 Б (документировано), i18n en/ru/de/fr,
`demo/smoke_room_fit.mjs`, `test/room-fit.test.mjs`, документация
(CANVAS/ISOMETRIC/TESTING/USER-GUIDE/CHANGELOG×2).

Трейлеры: все коммиты несут `Issue: #152`; `User-Visible: yes` только на
`4aad9fac` (фича) — тот же коммит правит `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md`. Остальные коммиты — `User-Visible: no` (тесты,
документация, фикс без пользовательского эффекта). Соответствует правилу.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | 1897 tests · 1896 pass · 0 fail · 1 skip (совпадает с заявлением автора) |
| build | `npm run build` | зелёный, `dist` пересобран |
| bundle sync | `npm run bundle:sync` | зелёный; `git status` после пересборки чист — три копии бандла побайтно совпадают с коммитом |
| bundle budget | `npm run bundle:budget` | зелёный: initial View 294 862 Б при потолке 296 000 (±2000); предупреждение о запасе 5 138 Б — это раскрытый и обоснованный в самом диффе долг #367, не новая находка |
| docs fingerprint | `node scripts/check-docs.mjs` | зелёный (diff трогает `src/**`, гейт обязателен) — «7 files, 12 external links» |
| mutation-gate AC6 | `node scripts/mutation-gate.mjs --id=room-fit-interactive-owner-leaks-through` | мутант поймал: `smoke_room_fit.mjs` краснеет |
| mutation-gate AC7 | `node scripts/mutation-gate.mjs --id=room-fit-pan-release-reaccepted` | мутант поймал |
| mutation-gate AC8 | `node scripts/mutation-gate.mjs --id=room-fit-enters-kiosk-double-tap-sequence` | мутант поймал |
| mutation-gate AC10 | `node scripts/mutation-gate.mjs --id=room-fit-html-overlay-jumps-ahead` | мутант поймал |
| smoke (AC-named) | `node demo/smoke_room_fit.mjs` | зелёный, все 14 свидетелей `true` |
| smoke (AC9) | `node demo/smoke_smooth_zoom.mjs` | зелёный |
| smoke (smoke-select, сильная связь на затронутый `_stagePointerCancel`) | `node demo/smoke_editor_gestures.mjs` | зелёный |
| smoke (smoke-select, сильная связь на `_holdFired/_panStart/_pinchStart/_swipeStart`) | `node demo/smoke_long_press_gesture.mjs` | зелёный |
| smoke (smoke-select, прямое совпадение `_applyView/_baseVb/_clampView/_panStart/_stageEl/_view`) | `node demo/smoke_pan_any_zoom.mjs` | **КРАСНЫЙ — необработанное исключение, см. High-1** |
| smoke (smoke-select, прямое совпадение) | `node demo/smoke_infinite_canvas.mjs` | зелёный |
| smoke (smoke-select, прямое совпадение) | `node demo/smoke_kiosk_pan_lock.mjs` | зелёный |
| smoke (smoke-select, прямое совпадение) | `node demo/smoke_decor.mjs` | зелёный |
| smoke (smoke-select, прямое совпадение) | `node demo/smoke_furniture.mjs` | зелёный |
| smoke (та же семья вызова `_stagePointerUp` плоским объектом) | `node demo/smoke_backdrop.mjs`, `node demo/smoke_hide_layers.mjs` | зелёные — крашится только View-ветка `smoke_pan_any_zoom` |
| ручная мутация AC15 (нет в реестре, см. Medium-2) | правка `houseplan-card.ts`, `bundle:sync`, `node demo/smoke_room_fit.mjs`, откат | `roomIntentIsSessionOnly` перевернулся в `false` — защита реальна, но не зарегистрирована |
| ручная проверка AC14 в редакторах (см. Medium-1) | ad-hoc браузерный скрипт через `demo/serve.mjs`, `_mode='devices'`/`'decor'` | `role="button" tabindex="0" aria-label="Fit room Office"` присутствуют, Enter/Space не производят эффекта |
| golden | не запускал | AC3/AC4 сами называют метод `unit + golden`, но план тестирования спеки прямо откладывает golden на пре-бету (`docs/specs/152-room-click-fit.md` §«План тестирования»: «Golden, полный smoke и performance — перед beta»), это же в PROCESS.md §8. Не расхождение, а согласованное разделение обязанностей |
| backend (`pytest tests_backend`) | не запускал | diff не трогает `custom_components/**/*.py` |
| invariants (`npm run invariants`) | не запускал | diff не меняет модель стен/комнат/layout/marker.space/open_spans — правится только камера |
| полный `demo/smoke_*.mjs` (220 файлов) | не запускал | непропорционально: диапазон правит camera/pointer-подсистему View, а не «всё»; выбор по `smoke-select.mjs` плюс прямые попадания выше признан достаточным, кроме описанной ниже находки |
| performance_smoke | не запускал | не названо в AC, perf-бюджет описан только как «не регрессирует» и закрыт бандл-бюджетом + отсутствием новых DOM-чтений (см. код-чтение AC16) |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` вывод: 5 изменённых
файлов `src/**`, 101 символ на изменённых строках, порог «широкого» символа — 44
смока. 59 файлов — «прямое совпадение», ядро (`smoke_room_fit`,
`smoke_smooth_zoom`, `smoke_editor_gestures`, `smoke_long_press_gesture`,
`smoke_pan_any_zoom`, `smoke_infinite_canvas`, `smoke_kiosk_pan_lock`,
`smoke_decor`, `smoke_furniture`) прогнан выше; остальные — совпадения по
одному распространённому символу (`_mode`, `_baseVb`, `_view`, `_zoom`,
`stopPropagation`, `_applyView`), которые сами инструмент и правило ревью
относят к «слабой связи» («повод посмотреть, а не обязанность прогонять»); я
их не прогонял. Полная матрица (220 файлов) — обязанность пре-релиза
(PROCESS.md §8), не этого цикла.

## Находки

### High-1. `demo/smoke_pan_any_zoom.mjs` падает необработанным исключением — новый код не переживает существующий вызов `_stagePointerUp`

**Файл:** `src/houseplan-card.ts:6220-6223` (`_roomOwner`), вызов из
`_stagePointerUp` (`src/houseplan-card.ts:6941` и далее, `this._roomOwner(ev)`
на аргументе `acceptedRoomFitGesture`).

**Воспроизведение:** на SHA `a54addb6`, чистое дерево, свежий `bundle:sync`:

```
$ node demo/smoke_pan_any_zoom.mjs
...
page.evaluate: TypeError: e.composedPath is not a function
    at yg._roomOwner (…/houseplan-card-CAJGhl9a.js:4951:48660)
    at yg._stagePointerUp (…/houseplan-card-CAJGhl9a.js:4959:10851)
    at pu (eval at evaluate…)
    at drag (eval at evaluate…)
    at async inMode (eval at evaluate…)
Node.js v22.23.2
```

Скрипт вызывает `_stagePointerUp({ pointerId, clientX, clientY })` —
лёгкий объект вместо настоящего `PointerEvent` — паттерн, которым в этом же
демо-наборе пользуются ещё три смока (`smoke_backdrop.mjs`,
`smoke_editor_gestures.mjs`, `smoke_hide_layers.mjs`); все три остаются
зелёными, потому что вызывают `_stagePointerUp` только вне `_mode==='view'`,
где `_roomOwner` рано возвращает `null` и до `ev.composedPath()` дело не
доходит. `smoke_pan_any_zoom.mjs` — единственный, кто гоняет ровно этот сценарий
(drag по пустому месту) в `_mode==='view'` (`inMode('view', …)` — первый вызов
в скрипте), и там `_roomOwner` пытается прочитать `ev.composedPath()`
безусловно.

**Причина:** `_stagePointerUp` теперь вычисляет `this._roomOwner(ev)`
безоговорочно (как аргумент `acceptedRoomFitGesture`), даже когда
`this._roomPointer` уже `null` и результат гарантированно будет отброшен
`acceptedRoomFitGesture`'s `if (!candidate || …) return null;`. JS вычисляет
аргументы до вызова функции, так что защита внутри `acceptedRoomFitGesture` не
спасает — `ev.composedPath()` читается раньше.

**В проде не воспроизводится** — единственный продуктовый вызов
`_stagePointerUp` идёт из `@pointerup=${(e: PointerEvent) => this._stagePointerUp(e)}`
(`houseplan-card.ts:11556`) с настоящим DOM-событием, у которого
`composedPath()` есть всегда. Но это не снимает находку: `demo/smoke_pan_any_zoom.mjs`
входит в обязательный пре-релизный набор (PROCESS.md §8, `smoke` — гейт
`validate.yml`) и **сейчас красный на этом SHA**, а не только «не прогнан
автором» — это уже сломанный существующий тест, а не пропущенный.

**Почему High, а не Medium:** это не гипотетический край, а воспроизводимый
крах существующего, ранее зелёного гейта, обязательного перед бетой; ревью не
может подтвердить «оно работает», когда прогон падает необработанным
исключением, а не assertion-ошибкой.

**Предполагаемое направление фикса** (не мой мандат — решает автор): либо
защитить `_roomOwner`/`roomFitOwnerFromPath` от отсутствия `composedPath`,
либо не звать `this._roomOwner(ev)` вообще, когда `this._roomPointer` уже
`null` (это заодно и дешевле — не ходит по `composedPath()` на каждый
posterup, у которого не было room-кандидата).

### Medium-1 (в скоупе). Подпись комнаты в редакторах Devices/Decor получает нерабочую клавиатурную кнопку — нарушает собственный AC14

**Файл:** `src/houseplan-card.ts:12798-12804` (`_renderRoomLabel`): `role`,
`tabindex`, `aria-label` и `@keydown` гейтятся условием `!this._markup`, а
`_markup` (`houseplan-card.ts:1707`) — это `this._mode === 'plan'`, то есть
**только** редактор Plan. В Devices (`_mode==='devices'`) и Decor
(`_mode==='decor'`) те же атрибуты присутствуют.

**Воспроизведение** (ad-hoc браузерный скрипт через `demo/serve.mjs`, комната
с именем и `disp.showNames: true`):

```
c._mode = 'devices'; c.requestUpdate(); await c.updateComplete;
// .roomlabel[data-id="room-a"]:
//   role="button" tabindex="0" aria-label="Fit room Office"
label.focus();
label.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', … }));
// → c._view не изменился, c._roomFocus остался null

c._mode = 'decor'; // тот же результат: role="button" tabindex="0" aria-label="Fit room Office"
```

`_roomLabelKey` (`houseplan-card.ts:7032`) начинается с
`if (this._mode !== 'view' || …) return;`, так что Enter/Space в Devices/Decor
не делают ничего — но screen reader и клавиатурный пользователь видят
фокусируемую кнопку «Вписать комнату Office», которая молча ничего не
исполняет.

**Нарушенный AC:** AC14 прямым текстом: «…editors не получают room action».
Раздел «Touch, темы и режимы» ТЗ называет явно Plan/Backdrop, но общий принцип
раздела «Клавиатура и доступность» — target есть только «в View/kiosk» — тоже
нарушен для Devices/Decor.

**Почему Medium, не High:** не ломает основной сценарий (клик/тап в View),
не искажает данные, задевает только клавиатурных/screen-reader пользователей
внутри admin-only редакторов. Фикс тривиален и в скоупе: заменить
`!this._markup` на `this._mode === 'view'` в атрибутах `role`/`tabindex`/
`aria-label` и в условии `@keydown` подписи.

### Medium-2 (в скоупе). Защита AC15 (запрет `_saveZoom` для reason `room`) не зарегистрирована в mutation-gate, хотя доказывается только дорогим смоком

**Файлы:** `src/houseplan-card.ts:1122` (`if (state.reason !== 'room') this._saveZoom();`)
и `:1142` (`if (presentedZoom !== undefined && reason !== 'room') this._saveZoom();`).

Спека сама формулирует AC15 так: «Mutation, направляющая reason `room` в
`_saveZoom`, краснит storage spy» — то есть обещает мутанта. План тестирования
относит AC15 к «дешёвым pure unit», которые ревьюер проверяет локальным снятием
защиты. По факту защита доказана только внутри `demo/smoke_room_fit.mjs`
(`roomIntentIsSessionOnly`) — не pure-unit тестом (`test/viewport-transition.test.mjs`
не тронут вообще этим диффом) — то есть именно «дорогим гейтом (смок)», для
которого PROCESS.md §2.7 требует обязательного мутанта в
`scripts/mutation-gate.mjs`: «там ревьюер не воспроизведёт отрицательный прогон
второй раз». Среди 4 новых мутантов диффа (`room-fit-interactive-owner-leaks-through`,
`room-fit-pan-release-reaccepted`, `room-fit-enters-kiosk-double-tap-sequence`,
`room-fit-html-overlay-jumps-ahead` — все покрывают AC6/AC7/AC8/AC10) мутанта на
AC15 нет.

**Я проверил вручную, что защита реальна** (иначе это была бы находка High —
непроверяемый AC): временно убрал оба условия `reason !== 'room'`,
`bundle:sync`, `node demo/smoke_room_fit.mjs`:

```
"roomIntentIsSessionOnly": false   // было true
FAILED (1): - roomIntentIsSessionOnly: expected true, got false
```

Откатил правку, `bundle:sync`, дерево чисто на `a54addb6`. Защита работает
сейчас — но без записи в реестре она не переживёт следующую правку камеры:
будущий ревьюер (или CI) не узнает, что нужно её защищать, пока баг снова не
доедет до пользователя (ровно сценарий, который описывает сам mutation-gate.mjs
в шапке файла).

**Почему Medium, не High:** сам факт защиты подтверждён (мутация красит
smoke), это пробел в реестре регресс-тестирования, а не текущий баг.

### Low (снимаю без правки, с записью)

1. **AC5 (вложенные комнаты) и AC9 (retarget между двумя разными комнатами
   во время tween)** не имеют прямого автотеста, обещанного планом
   тестирования (`demo/smoke_room_fit.mjs` кликает только по одной комнате —
   `room-a`; вторая комната `outer` в фикстуре есть, но по ней ни разу не
   кликают; `test/viewport-transition.test.mjs` этим диффом не тронут вообще,
   хотя план тестирования спеки обещал его расширить). Не поднимаю до Medium:
   оба свойства следуют по конструкции из переиспользования немодифицированного
   механизма — `roomFitOwnerFromPath` читает `ev.composedPath()` те же DOM-узлы
   `[data-hp="room"]`, что уже использует hover (`@pointerenter=${enterRoom}` на
   тех же элементах, `houseplan-card.ts:11700-11726`), и `_startCameraTransition`
   (ретаргет от `_cameraState()`, который читает live `_zoom`/`_view`,
   непрерывно обновляемые во время tween) — код, который #82 уже покрывает для
   других reason. Проверено чтением, не исполнением.
2. **Механический вынос в `src/card-runtime.ts`** (`strictNumber`, `lruRead`/
   `lruWrite`, `normalizeMarkupTool`, `expiredWarmViewport`, `warmBootKey`,
   `warmMatch`) побайтно сверен построчным diff с версией на `origin/dev` —
   логика идентична (только `export`, переименование локальных переменных
   `s`→`slot`, форматирование), но при переносе потеряны развёрнутые
   комментарии-обоснования (`DEV-B703-01`, `AUD-159B1-01` и др.), объясняющие
   *почему* устроено именно так warm-remount кеширование. Не блокирует —
   история остаётся в `git blame` — но будущим читателям `card-runtime.ts`
   будет сложнее реконструировать контекст.

## Таблица «чем краснеет» (защитные AC, PROCESS.md §2.7)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC6 (интерактивный владелец подавляет fit) | `node demo/smoke_room_fit.mjs` | `node scripts/mutation-gate.mjs --id=room-fit-interactive-owner-leaks-through` → красный, прогнано, поймано |
| AC7 (pan/pinch/long press не создают fit) | `node demo/smoke_room_fit.mjs` | `node scripts/mutation-gate.mjs --id=room-fit-pan-release-reaccepted` → красный, прогнано, поймано |
| AC8 (room tap не входит в kiosk double-tap) | `node demo/smoke_room_fit.mjs` | `node scripts/mutation-gate.mjs --id=room-fit-enters-kiosk-double-tap-sequence` → красный, прогнано, поймано |
| AC10 (SVG/HTML синхронны на промежуточных кадрах) | `node demo/smoke_room_fit.mjs` | `node scripts/mutation-gate.mjs --id=room-fit-html-overlay-jumps-ahead` → красный, прогнано, поймано |
| AC15 (нет zoom-only записи для reason `room`) | `node demo/smoke_room_fit.mjs` (`roomIntentIsSessionOnly`) | **не зарегистрирован**; ручная мутация (снял оба `reason !== 'room'`) → `roomIntentIsSessionOnly: false`, прогнано мной, не воспроизводимо CI до фикса (Medium-2) |
| AC11 (повторный fit — no-op) | `node demo/smoke_room_fit.mjs` (`repeatedFitIsNoOp`) | не зарегистрирован; логика (`sameCameraState`-гард в `_startCameraTransition`) не изменена этим диффом, унаследована от #82 — не перепроверял мутацией, см. «чего не проверял» |
| AC12 (resize сохраняет focus до ручной команды) | `node demo/smoke_room_fit.mjs` (`resizeRefitsAtomically`, `panCancelsRoomIntent`) | не зарегистрирован; проверено чтением (`_clearRoomFocus()` вызывается во всех перечисленных в ТЗ точках отмены) — не перепроверял мутацией |
| AC2/AC3/AC4 (математика полей/zoom/bounds) | `node --test test/room-fit.test.mjs` (pure unit, `test-build/room-fit.js`) | дешёвый unit, я прочитал и мысленно снял защиту (`q: 0.8→1`, удаление clamp) — assertions считают точные числа, любое искажение ломает `close()`/`assert.equal`; не требует мутации по PROCESS.md §2.7 (дешёвый pure unit) |

## Что проверено и корректно

- **AC1** (чистый click/tap вписывает и центрирует): `smoke_room_fit.mjs` →
  `cleanRoomTapFits`, `oneFlatAxisUsesTenPercent` зелёные для mouse; keyboard —
  `keyboardUsesSameCommand`. Touch/pen отдельно не гонял (смок использует
  `pointerType: 'mouse'`/`'touch'` в разных секциях — touch есть в kiosk-блоке),
  pen — проверено чтением: ownership-код (`roomFitOwnerFromPath`,
  `acceptedRoomFitGesture`) не различает `pointerType`, значит логика
  идентична для mouse/touch/pen по конструкции.
- **AC2** (10% ± 1 px, 2000×1000→800×800): `test/room-fit.test.mjs` точно
  воспроизводит числовой пример спеки; прогнано, проходит.
- **AC3/AC4** (bounds = ровно floor+wall body, Flat/Iso через точные
  проекции): unit-тесты плюс код-чтение `_roomFitBounds` — использует те же
  `_innerRoomContour`/`_wallUnionGeometry`/`roomWallProfile`/`outsetContour`,
  что рендер, без DOM `getBoundingClientRect` и без второй wall-модели
  (`grep` по диффу — ноль совпадений). Golden — сознательно отложен на
  пре-бету по плану тестирования спеки.
- **AC5**: проверено чтением — общий DOM-путь с hover (см. Low-1).
- **AC6/AC7/AC8/AC10**: доказаны и перепроверены мутациями (таблица выше) —
  все четыре мутанта поймали регресс.
- **AC9**: проверено чтением, `_startCameraTransition` и `_cameraState()` не
  изменены этим диффом кроме добавления reason `room`; `smoke_smooth_zoom.mjs`
  зелёный подтверждает, что общий контракт ретаргета/cancel не сломан.
- **AC11/AC12/AC13**: смок зелёный (`repeatedFitIsNoOp`, `resizeRefitsAtomically`,
  `panCancelsRoomIntent`); AC13 (invalid geometry/zero stage) — код-чтение
  `_fitRoom`/`_roomFitBounds` (оба возвращают `null`/no-op на невалидных данных
  без NaN-путей, `_roomFitBounds`→`roomFitGeometryBounds`→`finitePoint`
  фильтрует NaN на входе).
- **AC14**: role/tabindex/aria-label/focus-visible/Enter-Space работают
  корректно **в View и kiosk** — `smoke_room_fit.mjs`
  (`labelIsKeyboardAction`, `keyboardUsesSameCommand`); но см. Medium-1 для
  Devices/Decor.
- **AC15**: гейт работает сейчас (см. Medium-2 про отсутствие мутанта).
- **AC16**: bundle:budget зелёный; код-чтение подтверждает, что
  `_roomFitBounds` вызывается один раз на принятый жест/resize (не в
  `_stagePointerMove`/RAF), и не читает layout (`getBoundingClientRect`
  отсутствует).
- i18n: `room.fit_action` добавлен с parity en/ru/de/fr.
- Документация: `docs/CANVAS.md`, `docs/ISOMETRIC.md`, `docs/TESTING.md`,
  `docs/USER-GUIDE.ru.md`, оба CHANGELOG — соответствуют реализации, термины
  совпадают с фактическим поведением (не проверял на разошедшиеся с кодом
  утверждения, кроме уже отмеченного разрыва в Medium-1, который документация
  не выдаёт за факт — таблица USER-GUIDE описывает только View).
- Фикс-коммит `6a7ef48a` («preserve editor pointer cancellation») — реальная,
  обоснованная правка регрессии, внесённой первым коммитом этой же задачи
  (`4aad9fac`), не расширение скоупа: `_stagePointerCancel` раньше считал
  `viewportGestureEnded` уже ПОСЛЕ того как host обнулял `_pinchStart`/
  `_panStart`, из-за чего editor-ветка теряла `requestUpdate()` после отмены
  pan/pinch в редакторе. Перепроверено `smoke_editor_gestures.mjs` (зелёный) —
  единственный минус: два оператора на одной строке через `;` (стилевая
  мелочь, не блокирует).
- Bundle-budget: поднятие потолка задокументировано в самом файле с числами,
  согласуется с измеренным результатом (294 862 Б, заявлено 294 864 в
  комментарии — расхождение 2 Б, в пределах шума сборки).

## Чего не проверял

- Полный `demo/smoke_*.mjs` (220 файлов), `npm run golden:capture`/`golden:verify`,
  `performance_smoke` — по плану тестирования спеки и PROCESS.md §8 это
  пре-релизный гейт, не гейт этого цикла; я прогнал целевую выборку
  (smoke-select + AC-именованные + семью `_stagePointerUp`-вызовов) и нашёл в
  ней реальный красный результат (High-1) — до его исправления смысла гонять
  остальные 200+ файлов не вижу.
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.
- `npm run invariants` — diff не меняет геометрическую модель (комнаты/стены/
  layout/marker.space/open_spans); камера не участвует в инвариантах.
- Мутации для AC11/AC12 (нет в реестре; логика либо унаследована от #82
  без изменений в этом диффе — AC11, либо тривиально читается — AC12).
- Реальное touch/pen устройство и screen reader — по коду и смоку логика не
  различает `pointerType`, но живого браузера на телефоне/с NVDA не было.
- Изометрический golden-скриншот (см. выше — сознательно отложен).

## Вердикт

Один блокирующий High (сломанный существующий пре-релизный смок,
воспроизведён на текущем SHA) и два Medium в скоупе (нарушение AC14 в
Devices/Decor, отсутствующий обязательный mutation-gate на AC15). Все три —
чинятся в этой же задаче без расширения скоупа.

**Вердикт: красный · заход r1 · блокирующих циклов 1/4 · High: 1 · Medium: 2 → в задаче**

Возврат в `S6-in-progress`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/152-room-click-fit`, коммит `a54addb694a3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `042ef7b3005c8e10620427979a9960d36eed0155`
  ```
  git log --all --format='%H %T' | grep 042ef7b3005c
  ```
- ТЗ `docs/specs/152-room-click-fit.md`, блоб `fb036d2bb9cc522555c55e15000d7d693e204f8b`
  ```
  git log --all --find-object=fb036d2bb9cc522555c55e15000d7d693e204f8b -- docs/specs/152-room-click-fit.md
  ```
