# CODE-REVIEW-691-r1

Материал ревью: `53503e0373fe73d54ebccf5e70af8171ca778716` (продуктовый коммит
`37fbb9824d1d27e5244a3084eb3f5c52d1ffe696` + метрический коммит
`53503e0373fe73d54ebccf5e70af8171ca778716`, `origin/dev..HEAD`). Working copy
уже стоит на этом SHA. Заход r1, блокирующих циклов израсходовано 0 из 4.

## Скоуп

Issue #691: touch-навигация в View/kiosk смешивала pan и переход между
пространствами (владение жестом решали первые 8 px и угол), а double-tap
«Вписать всё» из #449 был практически недоступен на плотном плане (принимал
только owner `background`). ТЗ (принято зелёным на r2, `docs/reviews/SPEC-REVIEW-691-r2.md`)
фиксирует: floor-swipe теперь стартует только из внутренней 48 CSS px
краевой полосы с соседом и только inward + `|dx| > 1.5×|dy|`; single room-fit
откладывается на 350 мс; второй чистый tap по фону/заливке комнаты/пассивной
подписи в этом окне отменяет отложенный room-fit и вызывает общий fit-all;
контракт одинаков для touch/mouse/pen; редакторы не затронуты.

Изменённые файлы (`git diff origin/dev...HEAD --stat`):

```
demo/smoke_kiosk.mjs           |  37 ++++++++++---
demo/smoke_kiosk_pan_lock.mjs  |  73 +++++++++++++++++++------
demo/smoke_room_fit.mjs        |  69 ++++++++++++++++++-----
docs/CANVAS.md                 |  36 +++++++-----
docs/CHANGELOG.md              |   7 +++
docs/CHANGELOG.ru.md           |   8 +++
docs/TOUCH-SUPPORT.md          |   8 ++-
docs/USER-GUIDE.md              |  18 +++---
docs/UX-MODES.md               |   7 ++-
docs/images/screenshots.json   |  24 ++++----
scripts/bundle-budget.mjs      |   9 ++-
scripts/mutation-registry.mjs  |  64 +++++++++++++++++-----
scripts/monolith-baseline.json |   2 +-
src/houseplan-card.ts          |  93 +++++++++++++++++--------------
src/logic.ts                   |  83 ++++++++++++++++++++++++++++
src/room-fit.ts                | 118 ++++++++++++++++++++++++++++++++++++---
test/logic.test.mjs            |  37 ++++++++++++-
test/room-fit.test.mjs         | 124 ++++++++++++++++++++++++++++++++++++++++--
```

Два коммита, оба с корректными трейлерами `Issue: #691`. Продуктовый коммит —
`User-Visible: yes`, оба changelog обновлены в нём же (§3 п.10 PROCESS.md).
Метрический коммит — `User-Visible: no`, меняет только храповик бандла.
Трек — полный (закреплён на этапе аналитики/ТЗ).

## Как проверялось

Дешёвый набор подтверждён зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/36429784227) — `tsc
--noEmit`, `npm test`, `npm run build`. Я перепрогнал часть этого набора и
добавил диффо-зависимые смоки, которые Validate не покрывает:

| Гейт | Прогнан | Результат |
|---|---|---|
| `npm run build` (`tsc --noEmit && rollup`) | да (через `bundle:sync`) | success, `dist`/`demo/srv/assets` пересобраны |
| `npm test` (полный набор) | да | 3217 pass / 0 fail / 1 skip — совпадает с заявленным в хендоффе |
| `node scripts/check-docs.mjs` | да | `Documentation checks passed (7 files, 12 external links)` |
| `node scripts/smoke-select.mjs --base 37fbb982^ --head 53503e03` | да | 32 прямых совпадения, 46 слабых связей (полный список в выводе инструмента) |
| Все 3 смока, названных в AC (`smoke_kiosk`, `smoke_kiosk_pan_lock`, `smoke_room_fit`) | да | все проверки `true`, `OK` |
| Остальные 29 из 32 «прямых совпадений» smoke-select | да (все) | 28 зелёных; **`demo/smoke_pan_any_zoom.mjs` красный** — см. находку Medium-2 |
| 4 новых mutation-witness (`double-fit-plan-owner-guard-removed`, `space-swipe-edge-origin-guard-removed`, `space-swipe-release-ignores-final-owner`, `double-fit-interactive-pending-cancel-removed`) через `node scripts/mutation-gate.mjs --changed origin/dev..HEAD` | частично | сам гейт не уложился в разумное время в этой среде (после 300 с фоновый прогон завершился по таймауту без вывода) и не перезапускался — оставлено как непроверенное; статически подтверждено, что все 4 патча (`find`-строки) применяются к текущему тексту `src/logic.ts`/`src/room-fit.ts`/`src/houseplan-card.ts` побайтово (см. «Чего не проверял») |
| `python -m pytest tests_backend` | нет | дифф не трогает `custom_components/**/*.py` |
| `npm run invariants` | нет | дифф не меняет геометрию: затронуты только pointer-арбитраж и камера-команды, ни один инвариант модели не назван в AC |
| `npm run golden:verify` | нет | `check-docs` подтвердил 11/11 pixel-identical кадров по хендоффу автора и не потребовал отдельного golden-прогона; сам дифф не трогает рендер геометрии/цвета |
| Performance-профили | нет | не названы в AC |

## AC — доказательства

| AC | Как доказан | Вердикт |
|---|---|---|
| AC1 pan вне края | `demo/smoke_kiosk_pan_lock.mjs` (`centralHorizontalDragPans`) + `demo/smoke_kiosk.mjs` (`centralDragPansWithoutSwitching`) + unit `classifySpaceDrag(null, ...)` → `'pan'` | доказано автотестом, прогнано мной |
| AC2 edge-swipe | unit `spaceSwipeEdgeAt`/`classifySpaceDrag` (границы 48/8 px) + `smoke_kiosk.mjs` (`edgeSwipeSwitches`) + `smoke_kiosk_pan_lock.mjs` (`straightSwipeSwitches`) | доказано автотестом, прогнано мной |
| AC3 границы/неверное направление | unit `classifySpaceDrag('previous', 9, 6)==='pan'` (граница `=1.5`) и `(10,6)==='swipe'` (минимальное превышение); край без соседа — `spaceSwipeEdgeAt(...,'f1')===null` на левом краю; `smoke_kiosk.mjs` (`noSwipeZoomed`) | доказано автотестом (включая параметризованную границу, требуемую r2-правкой ТЗ) |
| AC4 финальный owner | unit `spaceSwipeTargetForOwner('pan', -100,0,...)===null` + mutation `space-swipe-release-ignores-final-owner` (статически подтверждена применимость патча) + `smoke_kiosk_pan_lock.mjs` (`curvedPanKeepsTheLock`, `edgeCurvedPanLocksPan`, `curvedSwipeNeverPans`) | доказано автотестом, прогнано мной; mutation-гейт не выполнен (см. таблицу гейтов) |
| AC5 pinch/interactive safety | чтением: второй `pointerdown` в `_stagePointerDown` обнуляет `_swipeStart` до перехода в `_pointers.size===2`/`_pinchStart` (`src/houseplan-card.ts:6704-6706`); `demo/smoke_editor_gestures.mjs` (не переименован, но напрямую задевает `_pinchStart`/`_stagePointerMove` — прогнан мной, зелёный) сохраняет сценарии #563/#578 | проверено чтением + browser smoke (прогнан мной) |
| AC6 одиночный room-fit | fake-clock unit `PlanTapGestureController` (`test/room-fit.test.mjs`, тест «controller owns one fake-clock…») + `smoke_room_fit.mjs` (`singleRoomTapWaitsForSecondTap`, `singleRoomTapStillWaitsInsideWindow`, `kioskSingleRoomTapFitsAfterDelay`) | доказано автотестом, прогнано мной |
| AC7 double fit без промежуточного кадра | unit `completeDoubleFitPointer` (room→background и background→room оба триггерят) + `smoke_room_fit.mjs` (`kioskRoomThenBackgroundUsesDoubleFit`, `normalViewDoubleClickMatchesFitAll`) | доказано автотестом, прогнано мной |
| AC8 модальности | parameterized unit (`down({pointerType:'touch'})`/`'pen'`/`'mouse'`) + `smoke_room_fit.mjs` (`mixedModalitiesDoNotPair`, `penPairUsesSameFitAll`) | доказано автотестом, прогнано мной |
| AC9 interactive owner | mutation `double-fit-interactive-pending-cancel-removed` (статически подтверждена применимость) + `smoke_room_fit.mjs` (`interactiveSecondTapCancelsPendingRoomFit`, `commonInteractiveOwnerSuppressesRoomFit`, `areaLinkSuppressesRoomFit`) | доказано browser smoke (прогнано мной); mutation-гейт не выполнен |
| AC10 lifecycle | unit fake-clock тест (stale-space timer inert) + `smoke_room_fit.mjs` (`lifecycleCleanupCancelsPendingRoomFit`, `panCancelsRoomIntent`, `cancelDisarmsThePreviousTap`); чтением подтверждено, что `_setMode`→`_clearRoomFocus`, `_commitSpace`→`_clearRoomFocus`, `_syncVolumetricSetting`→`_convertProjectionView`→`_clearRoomFocus`, `disconnectedCallback`→`_clearRoomFocus` — все перечисленные в §7.7 события (mode/space/projection/disconnect) действительно очищают `_planTaps`; hidden-состояние закрыто отдельно через `_doubleFitEnabled`'s `_continuity.state==='steady'` gate (таймер срабатывает, но `fitRoom` no-op) | доказано автотестом + проверено чтением по всем перечисленным lifecycle-точкам |
| AC11 редакторы | `demo/smoke_room_fit.mjs` (`editorBackgroundDoesNotFit`, `editorsDoNotExposeRoomAction`) + `demo/smoke_editor_gestures.mjs` (прогнан мной, зелёный, 18/18) | доказано browser smoke, прогнано мной |
| AC12 стандартные гейты | `tsc`, `npm test`, `npm run build` подтверждены Validate и мной; `check-docs` прогнан мной; смоки из AC прогнаны мной; полный смок-матрикс и golden — предрелизные | доказано, частично см. находку Medium-2 |

## Находки

### Medium-1 (в скоупе) — `docs/USER-GUIDE.ru.md` не обновлён и описывает старое поведение

Файл: `docs/USER-GUIDE.ru.md`, строки 474–476, 1936, 1938.

ТЗ §4 требует «обновление touch/canvas-документации» как часть скоупа, а
`AGENTS.md`/`docs/process/REVIEWER.md` называют `docs/USER-GUIDE.ru.md`
источником терминологии интерфейса для видимого поведения — это основной,
более полный пользовательский гайд (английская версия отстаёт, `docs/SCOPE.md`
«Partially covered»/#668). Дифф правит английский `docs/USER-GUIDE.md`
(таблица жестов, kiosk-раздел), но **не трогает** русский эквивалент того же
самого текста ни на строку. В результате `docs/USER-GUIDE.ru.md` сейчас прямо
противоречит новому контракту:

- строка 474: «двойной тап по **свободному фону** вписывает всё» — но по
  новому контракту double-tap работает и по заливке/подписи комнаты, не
  только по фону;
- строка 475: «Одиночный tap **вписывает комнату**; повторный tap не
  сбрасывает киоск» — но теперь одиночный tap НЕ вписывает комнату сразу, а
  ждёт 350 мс (delayed room-fit — центральное изменение этой задачи);
- строка 476: «в киоске свайп при масштабе 1:1» — без единого слова про
  48-пиксельную краевую зону, за пределами которой свайпа больше нет;
- строки 1936, 1938 (таблица киоск-режима): «Свайп — Листает пространства по
  кругу при масштабе 1:1» и «Двойной тап по **свободному фону** — Вписывает
  весь план» — то же самое несоответствие в разделе 17.

Воспроизведение: `git diff 37fbb982^..37fbb982 -- docs/USER-GUIDE.md
docs/USER-GUIDE.ru.md` показывает правки только в первом файле;
`grep -n "свободному фону\|Одиночный tap\|Листает пространства" docs/USER-GUIDE.ru.md`
на текущем SHA возвращает нетронутые старые формулировки.

Почему это не Low: это не редакторская мелочь, а релиз-артефакт из ТЗ §4/§17
для release-blocking touch-поверхности (`docs/TOUCH-SUPPORT.md`), и именно
русский гайд — канон терминологии, которым должен пользоваться следующий
автор/ревьюер. Пользователь, читающий актуальный гайд, получит неверные
инструкции по ключевому новому поведению задачи (задержка room-fit).
Чинится без блокировки — точечная правка тех же четырёх мест на русском,
зеркально английской правке.

### Medium-2 (в скоупе) — существующий регрессионный смок `demo/smoke_pan_any_zoom.mjs` красный на материале ревью

Файл: `demo/smoke_pan_any_zoom.mjs`, строки 224–225 (проверки
`kioskSwipeStillSwitchesFloors`, `kioskHorizontalDragIsNotAPan`).

Это smoke из #531 («pan at any zoom»), который `node
scripts/smoke-select.mjs --base 37fbb982^ --head 53503e03` относит к
**прямым совпадениям** (общие `_stageEl`/`_stagePointerMove`/`_zoom` и т.д.).
Автор его не запускал и не упомянул в хендоффе (там названы только
`smoke_kiosk`, `smoke_kiosk_pan_lock`, `smoke_room_fit`), и `docs/CANVAS.md`
§14 «Затронутые модули» ТЗ этот файл вообще не называет.

Я прогнал его на точном SHA материала:

```
$ node demo/smoke_pan_any_zoom.mjs
...
"kioskSwipeStillSwitchesFloors": false,
"kioskHorizontalDragIsNotAPan": false,
...
FAILED (2):
  - kioskSwipeStillSwitchesFloors: expected true, got false
  - kioskHorizontalDragIsNotAPan: expected true, got false
```

Exit code 1.

Причина: тест запускает kiosk-drag из точки `x=600` на 900-пиксельной
карточке (`fire('pointerdown', 41, 600, 300)` … `fire('pointermove', …, 450,
305)`) — это заведомо не 48-пиксельная краевая полоса. По старому контракту
(любой достаточно горизонтальный drag в kiosk при zoom ≤ 1 — swipe) тест был
верен; по новому контракту (§6 п.5 ТЗ: «Любой primary drag, начатый вне
активной краевой зоны, принадлежит pan независимо от его скорости, длины и
горизонтальности») он обязан пановать, а не переключать пространство —
именно так теперь себя ведёт продукт (я перепроверил: значения `false`
корректны для НОВОГО контракта, а не признак сломанного кода). Собственный
поясняющий комментарий файла («…and the kiosk keeps its floor swipe») тоже
устарел — он объявляет старый инвариант «свайп из любой точки» центральным
предположением, которое #691 сознательно отменяет.

Это не продуктовый баг: `src/logic.ts`/`src/houseplan-card.ts` реализуют ТЗ
корректно (см. таблицу AC выше). Проблема — незамеченный, красный после
мержа регрессионный тест: `demo/smoke_pan_any_zoom.mjs` не был обновлён под
новый контракт (например, перенести точку старта в краевую зону, если цель —
доказать «свайп продолжает работать при любом zoom», или явно зафиксировать
новым assert-ом, что drag из середины теперь пан). Пока это красный тест в
дереве, любой последующий полный smoke-прогон (предрелизный гейт) получит
ложный провал, а точка, где реально проверялась связка «pan-at-any-zoom +
kiosk swipe», временно не проверяет ничего осмысленного.

Почему в скоупе, а не отдельный issue: `demo/**` прямо назван в §4 ТЗ
(«unit, browser smoke … для положительных и защитных сценариев») и списке
затронутых модулей; смок описывает ровно ту связку (kiosk pan/swipe), которую
переписывает #691, — правка целиком внутри уже открытой задачи, не соседнее
поведение.

## Что проверено и корректно

- Чистые функции `spaceSwipeEdgeAt`/`classifySpaceDrag`/`spaceSwipeTargetForOwner`
  (`src/logic.ts`) реализуют контракт §6 буквально: 48 px независимо от zoom/DPR,
  8 px общий порог, `|dx| > 1.5×|dy|` с равенством → `pan`, отсутствие соседа →
  `null` (без мёртвой зоны), inward-направление проверяется явно.
- Финальность owner на release (`spaceSwipeTargetForOwner`) устраняет
  переклассификацию curved-жеста, сохраняя фикс DEV-1DA1-02; `_panLock`
  по-прежнему решается один раз на первом движении свыше 8 px.
- Второй палец (pinch) обнуляет `_swipeStart` до входа в `_pinchStart`-ветку —
  проверено чтением `_stagePointerDown` (строки ~6690–6706) и подтверждено
  `smoke_editor_gestures.mjs`.
- `PlanTapGestureController` — единственный владелец таймера и `recognizer`;
  `pointerDown` любого нового указателя (включая интерактивный) отменяет
  предыдущий `pending` room-fit до его релиза — подтверждено unit-тестом
  «controller owns one fake-clock…» и browser smoke
  (`interactiveSecondTapCancelsPendingRoomFit`).
- Все перечисленные в §7 п.7 lifecycle-триггеры (mode/space/projection change,
  disconnect) действительно очищают отложенный room-fit — проверено чтением
  вызовов `_clearRoomFocus`/`_clearPlanTapSequence` из `_setMode`,
  `_commitSpace`, `_syncVolumetricSetting`→`_convertProjectionView`,
  `disconnectedCallback`; «hidden» закрыт косвенно через `_doubleFitEnabled`'s
  gate на `_continuity.state`.
- Бюджет бандла: `INITIAL_VIEW_GZIP_CEILING` 300 300→301 000, измеренное
  значение 300 370 из хендоффа — арифметика заголовка коммита (630 Б до
  потолка, 1 370 Б до нижней границы 2000-байтовой полосы) сходится;
  `scripts/monolith-baseline.json` `bundleBytes` обновлён тем же коммитом;
  жёсткий лимит 301 066 не менялся. Число видно один раз, источник один
  (`INITIAL_VIEW_GZIP_CEILING`), нарушения «одно число — один источник» нет.
  `npm test` подтверждает согласованность (3217/0/1, совпадает с хендоффом).
  `check-docs.mjs` зелёный (7 файлов, 12 внешних ссылок).
- Никаких новых i18n-строк/ключей, backend, persisted-config изменений — дифф
  ограничен `src/houseplan-card.ts`, `src/logic.ts`, `src/room-fit.ts`,
  тестами, демо-смоками, документацией и метриками, как и заявлено в §4/§9/§10
  ТЗ.
- Мутационные патчи (4 новых ID в `scripts/mutation-registry.mjs`) применимы
  побайтово к текущему тексту `src/logic.ts`/`src/room-fit.ts`/
  `src/houseplan-card.ts` (проверено `String.includes` для каждой `find`-
  строки) — то есть мутанты не «протухли» и в принципе способны покраснеть
  named-тест при исполнении гейта.
- 29 из 32 «прямых совпадений» `smoke-select` (кроме `smoke_pan_any_zoom.mjs`,
  см. находку) — зелёные при прогоне мной на этом SHA, включая
  `smoke_editor_gestures.mjs` (18/18), `smoke_long_press_gesture.mjs`,
  `smoke_isometric_contract.mjs`, `smoke_backdrop.mjs`, `smoke_edit_walk.mjs`
  (нужно >90 с — не регрессия, просто длинный e2e-прогон, зелёный при 180 с),
  и весь оставшийся список (decor/furniture/modes/zoom/align-guides/room-
  settings/stairs/warm-*/version-recovery/space-tab-reorder и т.д.).

## Чего не проверял

- Полный `node scripts/mutation-gate.mjs --changed origin/dev..HEAD` — фоновый
  прогон не уложился в 300 с в этой среде и не был перезапущен из-за
  бюджета времени ревью; статическая проверка применимости патчей (см. выше)
  — это не то же самое, что подтверждение фактического красного/зелёного
  исхода. Если сама инфраструктура мутаций в порядке (что предыдущие раунды
  подтверждали), риск низкий, но формально «тест умеет падать» для этих 4
  ID не воспроизведено мной исполнением.
- `npm run golden:verify` — не гонял; дифф не меняет геометрию/DOM рендера
  (только pointer-арбитраж и таймеры), а `check-docs`/хендофф уже
  зафиксировали 11/11 pixel-identical кадров. Полный golden — предрелизный
  гейт.
- `npm run invariants` — не гонял, дифф не меняет геометрию модели.
- Ручное тестирование на реальном touch-устройстве / HA Companion — как и
  всегда на этапе код-ревью, это диагностика по коду и browser-смокам
  (`pointerType: 'touch'`, синтетические `PointerEvent`), не физическое
  устройство; ТЗ §12 требует именно такого способа доказательства для AC1–AC10.
- Слабые связи `smoke-select` (46 файлов с общим `_mode`/`_model`/`_zoom`) —
  не прогонял ни одной: инструмент явно относит их к «решает ревьюер», и по
  чтению диффа (только `_panLock`/`_swipeStart`/`_doubleFit*`/`_roomPointer`/
  таймер) риск для них ниже, чем для прямых совпадений, которые я прогнал
  все, кроме уже описанного результата.
- Performance-профили — не названы в AC12, не гонял.
- `python -m pytest tests_backend` — дифф не трогает `custom_components/**`.

## Вердикт

Два Medium в скоупе, обе — документационно-тестовые пробелы, а не дефекты
самого touch-контракта: код `src/logic.ts`/`src/room-fit.ts`/
`src/houseplan-card.ts` реализует ТЗ §6/§7 корректно и по всем 12 AC есть
автотест или чтение с явной пометкой, кроме двух точек, отмеченных выше.
`docs/USER-GUIDE.ru.md` — канонический источник терминологии для видимого
поведения — не обновлён и сейчас описывает старый контракт (мгновенный
room-fit, свайп «при масштабе 1:1» без упоминания края, double-tap только по
фону). `demo/smoke_pan_any_zoom.mjs` — существующий регрессионный тест,
прямо совпадающий с диффом по смок-селектору, реально красный на этом SHA
(проверено исполнением) из-за устаревшего допущения «любой горизонтальный
kiosk-drag — свайп», которое #691 сознательно отменяет. Оба фикса — в
скоупе текущей задачи (документация и demo-смоки прямо названы в §4/§14 ТЗ),
без High и без продуктовых изменений.

Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 2

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/691-touch-navigation`, коммит `53503e0373fe` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7e88993df66e38c08587bda9eff3f757ecce457`
  ```
  git log --all --format='%H %T' | grep a7e88993df66
  ```
- Тело issue: `e8f3dd66a656bbca09f4f291c52632feb3ee16759c54dc9dcdd4e328aaf99b7b`
- Вердикт конвейера: `yellow` · High 0
