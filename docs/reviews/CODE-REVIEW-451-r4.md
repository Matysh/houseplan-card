# CODE-REVIEW #451 — заход r4

- **Issue:** #451 — «План тормозит: диагностика считается на каждый кадр, перетаскивание перерисовывает всё, нет фильтра обновлений»
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r4 · блокирующих циклов до этого раунда: 3/4
- **Материал раунда:** ветка `issue/451-render-performance`, `HEAD = 07ba2ffbd1c02172d114ef27fb7cee2e40cf326e`
  (сверено `git rev-parse HEAD` непосредственно перед выводом, дерево чистое, PROCESS.md §2.7/#312)
- **Дельта раунда:** `git diff 444562e47cb746dc1c7d740b66b2f832ca02f064..07ba2ffb` — SHA взят из машинного блока
  «Материал раунда» документа `docs/reviews/CODE-REVIEW-451-r3.md` (дерево `9489e0f2e24a6…`, сверено
  `git log --all --format='%H %T' | grep 9489e0f2e24a` — совпадает с `444562e4`). Файлы дельты
  (без `dist/**` и копий бандла стенда): `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`,
  `src/resize-controller.ts`, новый `src/resize-live-preflight.ts`, `test/resize-controller.test.mjs`,
  `demo/benchmark_large_house.mjs`, `demo/performance/card-contract.mjs`, `docs/images/screenshots.json`,
  `docs/reviews/CODE-REVIEW-451-r3.md`.

## Скоуп раунда

r3 (жёлтый, High:0/Medium:1) закончился на `444562e4`. Единственная находка r3 — **M1**: фикс H3 из r2
не просто вернул прежнее поведение, а ввёл порог `resizeLivePreflightAllowed(rooms, edgeBudget=64)` —
точная physical-geometry проверка во время resize-жеста была живой только для планов ≤ 64 вершин
комнат, для больших планов работала только на `pointerup`. Не заявлено в ТЗ, противоречило changelog
«внешний вид и результат действий не меняются».

Автор ответил одним коммитом `5692a288` («fix: preserve live resize validation on large plans»,
`User-Visible: no`): порог полностью удалён, вместо него — новый модуль `resize-live-preflight.ts` с
тремя функциями (`resizeLiveRoomIds`, `resizeLiveJunctionRoomIds`, `resizeLiveCandidateSpace`), которые
строят «локальный кандидат» — только затронутые комнаты плюс геометрически близкие к их границе
стены/сегменты/партиции/проёмы — и гоняют через него ту же самую `_checkSpacePhysicalGeometry`,
безусловно, на любом размере плана. `07ba2ffb` поверх — только обновление отпечатка скриншотов
документации (`docs: refresh screenshot fingerprint for #451`).

Разбираю всю дельту по коду: это новый файл на 210 строк с нетривиальной геометрией (distance-to-segment,
segment-intersection, AABB-touch), напрямую заменяющий защитный механизм, который весь путь r2→r3→r4 и
был предметом ревью.

## Как проверялось

Дельта не трогает персистентный формат — только момент и объём вызова уже существующей проверки.
Валидация на точном HEAD (`07ba2ffb`) уже зелёная в CI: [Validate run 33927104551](https://github.com/Matysh/houseplan-card/actions/runs/33927104551),
success. Это покрывает `npx tsc --noEmit`, `npm test`, `npm run build`+сверку бандла и `check-docs`
(docs job зелёный на этом SHA) — **не перегонял эти четыре повторно**, см. правило дешёвых гейтов §8/§2.10.

Что прогнал сам в этом раунде:

| Команда | Результат |
|---|---|
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` | зелёный (нужно для собственных проб ниже) |
| `node scripts/no-new-any.mjs --base 444562e4 --head HEAD` | «Новых any нет» (225 строк в 3 файлах) |
| `npm run build && npm run bundle:sync` | зелёные, дерево бандла пересобрано без ошибок |
| `node scripts/smoke-select.mjs --base 444562e4 --head HEAD` | 19 прямых совпадений + 2 зарегистрированные связи, все по теме wall-union/junction/masonry/resize (список ниже) |
| `node demo/smoke_room_resize.mjs` | OK — реальные (не замоканные) сценарии `owner_boundary_clamped`, `corner_clamped`, `mixed_role_*` не задеты |
| `node demo/smoke_resize_pointer_real_plan.mjs` | OK |
| `node demo/smoke_junction_holes.mjs` | OK |
| `node demo/smoke_glow_fail_dark.mjs` | OK |
| `node demo/smoke_glow.mjs` | OK |
| `node demo/smoke_junction_patch_resilience.mjs` | OK |
| `node demo/smoke_multiwall_junction.mjs` | OK |
| `node demo/smoke_multiwall_strip_containment.mjs` | OK |
| `node demo/smoke_opening_measure.mjs` | OK |
| `node demo/smoke_optional_space_model.mjs` | OK |
| `node demo/smoke_wall_key_roundtrip.mjs` | OK |
| `node demo/smoke_wall_thickness_transition.mjs` | OK |
| `node demo/smoke_wall_union_isolation.mjs` | OK (включая генуинный, не замоканный `degradedPhysicalEditRejected` на **commit**-пути) |
| `node demo/smoke_zero_divider_taper.mjs` | OK |
| `node demo/smoke_real_plan_masonry.mjs` | OK («зарегистрированная связь» smoke-select — реальный план, разрывы кладки, которые синтетика не ловит) |
| `node demo/smoke_resize_wall_thickness.mjs` | OK («зарегистрированная связь») |

Плюс собственная проба (не входит в существующий гейт, привожу как воспроизведение находки ниже):
прямой вызов `checkSpacePhysicalGeometry`/`resizeLiveCandidateSpace`/`resizeLiveJunctionRoomIds` из
`test-build/*.js` на реальном производственном фикстуре регрессии `test/fixtures/278-wall-union-isolation.json`
(#278) плюс синтетические «дальние» комнаты для имитации большого плана.

## Закрытие r3

| Находка r3 | Чем закрыта | Где видно |
|---|---|---|
| **M1** (порог `edgeBudget=64`: точная live-проверка выключена целиком для планов > 64 вершин комнат, не заявлено в ТЗ/changelog) | Порог `resizeLivePreflightAllowed` удалён вовсе (`src/resize-controller.ts`, было 13 строк функции — теперь нет). Вместо него `resizeLiveCandidateSpace`/`resizeLiveRoomIds` (`src/resize-live-preflight.ts`) строят локальный физический кандидат и `_rszProjectPreview` гоняет `_checkSpacePhysicalGeometry` через него **безусловно**, на любом размере плана — деление по порогу исчезло как класс | `5692a2880f9ba645b9e2a897a828a9ea169a3a1a` (`src/houseplan-editor-runtime.ts:3654-3656`); сам прочитал — вызов больше не обёрнут в `if (resizeLivePreflightAllowed(...))`; `demo/benchmark_large_house.mjs` теперь структурно требует `resizeLivePreflightChecks >= 1` на `large-house` фикстуре (80 вершин, выше старого порога) — не даёт тихо вернуть скип |

Формально M1 закрыта в буквальном прочтении (порог убран, вызов безусловный на любом размере). Но
дельта заменила один раскрытый компромисс на другой, нераскрытый — см. находку ниже: сам факт «вызов
происходит всегда» не означает «проверка обнаруживает то же самое, что обнаруживала до #451».

## Находки

### M1 (r4) — локальный кандидат для physical-geometry исключает соседнюю комнату, от которой зависит валидность стыка; живая проверка может пропустить реальный дефект кладки на любом размере плана (в скоупе, чинится в этой же задаче)

**Файлы:** `src/resize-live-preflight.ts:59-65` (`resizeLiveRoomIds`), `:91-124` (`resizeLiveCandidateSpace`),
`src/houseplan-editor-runtime.ts:3654-3656` (`_rszProjectPreview`, использование).

`resizeLiveCandidateSpace(sp, changedRoomIds)` строит кандидат для `_rszSpaceCandidateGeometry` (→
`_checkSpacePhysicalGeometry`), отбирая **только** комнаты, чей id входит в `changedRoomIds`
(`resizeLiveRoomIds` — точное совпадение id, без расширения на соседей). Стены/сегменты/партиции
отбираются отдельно, по геометрической близости к границе **этих** комнат. Соседняя комната, которая
физически не изменилась в этом кадре (её id не в `changedRoomIds`), в кандидат не попадает вовсе — даже
если общий с ней узел/стена как раз и есть источник невалидности.

Это не гипотетическое рассуждение о коде — воспроизвёл прогоном на реальном production-фикстуре
регрессии #278 (`test/fixtures/278-wall-union-isolation.json`, две комнаты `r1`/`r2`, общая стена
толщиной 20, историческая дефектная кладка, статус `degraded-extra`):

```js
import { checkSpacePhysicalGeometry } from './test-build/plan-geometry-preflight.js';
import { resizeLiveCandidateSpace } from './test-build/resize-live-preflight.js';
// baseSpace = spaces[0] из test/fixtures/278-wall-union-isolation.json (r1, r2, стена 20см)
// + 80 «дальних» синтетических комнат (10..90 по x), чтобы получить план > 64 вершин.

checkSpacePhysicalGeometry({ spaces: [largeSpace] }, largeSpace.id)
// -> { status: 'failed', reason: 'wall-degraded-extra', ok: false }   ← ПОЛНОЕ пространство: дефект виден,
//    независимо от того, сколько в плане посторонних комнат (80 или 0)

const liveSpace = resizeLiveCandidateSpace(largeSpace, ['r1']); // r1 «изменилась», r2 — нет
liveSpace.rooms.map(r => r.id)   // -> ['r1']   (r2 выброшена целиком)
checkSpacePhysicalGeometry({ spaces: [liveSpace] }, largeSpace.id)
// -> { status: 'ok', ok: true }   ← ТОТ ЖЕ дефект больше не виден
```

Итог: во время resize-жеста, когда двигается только `r1`, а `r2` (владелец второй стороны той же
дефектной стены) не входит в `changedRoomIds`, живая проверка сообщает «геометрия в порядке» для
кандидата, который на самом деле нарушает контракт масонри — тот же самый контракт, ради которого
существует `_checkSpacePhysicalGeometry` и весь путь #278/H3(r2)/M1(r3). Это воспроизводится **на любом
размере плана** — добавление или удаление 80 посторонних комнат ничего не меняет, значит находка не
«ещё один порог», а более фундаментальная: набор комнат для physical-geometry кандидата определяется
по `changedRoomIds` (точное совпадение id), а не по геометрической смежности.

Показательно, что для **другого** кандидата в том же методе — `_resizePreviewNodes` (junction-limit
проверка, #329) — автор уже использует `resizeLiveJunctionRoomIds` (один слой AABB-соседей), а не голый
`changedRoomIds`. Подставил тот же более широкий набор в physical-geometry кандидат — и дефект снова
виден:

```js
const junctionIds = resizeLiveJunctionRoomIds(largeSpace.rooms, ['r1']); // -> ['r1', 'r2']
const liveSpaceViaJunctionIds = resizeLiveCandidateSpace(largeSpace, junctionIds);
checkSpacePhysicalGeometry({ spaces: [liveSpaceViaJunctionIds] }, largeSpace.id)
// -> { status: 'failed', reason: 'wall-degraded-extra', ok: false }   ← дефект снова обнаружен
```

Почему это Medium, а не техническая деталь:

1. **Данные не портятся.** `_commitPhysicalGeometry` (не в этой дельте, прочитал — не изменился) вызывает
   `_checkSpacePhysicalGeometry` на **полном** пространстве безусловно на `pointerup`. Невалидная
   геометрия всё ещё не может сохраниться.
2. **Но живая обратная связь пользователю может отсутствовать именно там, где её восстановление и было
   предметом M1(r3).** Пользователь дотягивает жест до конца, не видя «последней безопасной позиции», а
   затем получает отказ commit (`resize.commit_failed`, класс регресса, который уже описан в H3 r2) без
   предупреждения по пути — то есть худший, а не лучший исход по сравнению с раскрытым порогом r3: тот
   хотя бы предсказуемо и одинаково выключал проверку выше 64 вершин; этот — непредсказуемо, в
   зависимости от того, какая именно комната «официально изменилась» в данном кадре resize-солвера,
   и на любом размере плана, включая маленькие.
3. **Ни ТЗ, ни changelog, ни коммит-сообщение** (`fix: preserve live resize validation on large plans`,
   `User-Visible: no`) не упоминают эту границу — коммит заявляет ровно противоположное тому, что
   происходит для дефектов, зависящих от соседней комнаты.
4. **Существующее покрытие не могло эту находку поймать.** Новые unit-тесты в
   `test/resize-controller.test.mjs` проверяют только структуру фильтрации (какие id/стены попадают в
   кандидат), не пропуская результат через `checkSpacePhysicalGeometry`. Новая проверка в
   `demo/benchmark_large_house.mjs` (`deltas.resizeLivePreflightChecks < 1` роняет раннер) доказывает
   только, что проверка **вызывается**, а не что она может вернуть `false` для реально невалидного
   кандидата. `smoke_room_resize.mjs` (единственный реальный смок с геометрией без мока) использует
   фикстуры, где невалидность — либо однокомнатная топология (`corner_clamped`), либо ровно совпадающая
   с существующей стеной (`owner_boundary_clamped`, `wall-metadata`-путь, отдельная от physical-geometry
   проверка, использует полный `sp.rooms` — не задета этой находкой); ни один существующий тест не
   строит #278-подобный «дефект стыка, видимый только если обе стороны в модели».

**Что нужно от автора (не мой выбор, перечисление опций для следующего цикла):** либо расширить набор
комнат physical-geometry кандидата тем же способом, что уже используется для junction-кандидата
(`resizeLiveJunctionRoomIds`, один слой AABB-соседей — проба выше показывает, что этого достаточно для
воспроизведённого случая; открытый вопрос — достаточно ли одного слоя для более сложных многосторонних
узлов, это стоит явного теста), либо обосновать и явно задокументировать в ТЗ/коде, почему набора
`changedRoomIds` достаточно для physical-geometry (если у меня неверна модель угрозы), и в любом случае
добавить тест, который прогоняет `resizeLiveCandidateSpace`-кандидат **через** `checkSpacePhysicalGeometry`
на заведомо дефектной (не замоканной) геометрии — по образцу пробы выше, лучше всего на самом фикстуре
#278, — чтобы AC «восстановлена live-валидация» имело названного свидетеля, который умеет краснеть.

## Унаследовано из r3 (и через r3 из r1/r2), без повторной проверки

Эта дельта не касается доказательной базы следующих пунктов — принимаю как есть:

- H1–H3 из r2 (docs fingerprint, новые `any`, регресс `smoke_room_resize`) и дополнительный DOM-регресс
  (`resize_pointer.unrelated_pointer_ignored`/`capture_loss_restores_dom`) — файлы их фиксов
  (`houseplan-card.ts` типизация junction-limits, `live-editor.ts`, `046efe96` DOM-guard) не входят в
  дельту `444562e4..HEAD`. Документ: `CODE-REVIEW-451-r2.md`/`-r3.md`, SHA `cb68492c`/`444562e4`.
- AC1–AC2, AC7 (разделение intake/визуальной инвалидизации, dependency projection, last-wins HA во время
  жеста) — файлы фильтра `hass`/dependency classifier не в дельте `444562e4..HEAD`. Документ:
  `CODE-REVIEW-451-r2.md`, SHA `cb68492c`.
- AC4 (diagnostics cache) — не тронут этой дельтой.
- AC9 (golden/canonical screenshots) — единственный тронутый в этой дельте артефакт —
  `docs/images/screenshots.json` (отпечаток источника, коммит `07ba2ffb`); Linux-съёмка на предыдущем
  SHA (`444562e4`) была канонической (r3: [run 33926924502]) и её результат (10/10 без диффов) не
  меняется этой дельтой — сама дельта не трогает `src/**` рендер-путь, только момент вызова физической
  проверки во время resize, до commit/settled-кадра. Отдельно не перепрогонял golden — не требуется:
  результирующий кадр после `pointerup` идентичен (полная проверка на commit не изменилась).
- Инварианты модели по всем моделям проекта — часть `npm test` (зелёный на HEAD в CI); конфиг-специфичная
  команда `npm run invariants -- --config …` не нужна отдельно: дельта не меняет персистентную форму
  (`walls[]`, `wall_segments`, `marker.space`, `open_spans`) — только состав кандидата, временно
  собираемого в памяти для live-проверки во время жеста, никогда не записываемого в конфиг.
- `INITIAL_VIEW_GZIP_CEILING` 297000→298000 и его обоснование — не тронуты этой дельтой.

## Что проверено и корректно

- Порог `resizeLivePreflightAllowed`/`edgeBudget=64` из r3 действительно удалён целиком — прочитал diff
  `resize-controller.ts`, функции больше нет; `_rszProjectPreview` больше не содержит ветвления по
  размеру плана для physical-geometry вызова.
- 17 из 21 отмеченных `smoke-select` тестов (19 прямых + 2 зарегистрированных за вычетом 6 слабых
  `cellCm`-совпадений, см. «Чего не проверял») прогнаны лично, все зелёные — включая генуинный (не
  замоканный) commit-time `degradedPhysicalEditRejected` в `smoke_wall_union_isolation.mjs` и реальный
  план в `smoke_real_plan_masonry.mjs`.
- Реальные (не замоканные) мелкоплановые сценарии `smoke_room_resize.mjs` (`owner_boundary_clamped`,
  `corner_clamped`, `mixed_role_*`) не регрессировали при переходе на безусловный локальный кандидат —
  прогнал, зелёные.
- `_commitPhysicalGeometry` (полное пространство, безусловный вызов на `pointerup`) не тронут этой
  дельтой — прочитал, данные при коммите остаются fail-closed независимо от находки M1(r4): невалидная
  геометрия не может сохраниться, регресс только в live-обратной связи посреди жеста.
- Новые unit-тесты `resize-controller.test.mjs` корректно проверяют то, что они заявляют проверять
  (структура фильтрации id/стен/партиций/проёмов на 100-комнатном синтетическом плане) — прочитал, тест
  умеет падать на этом узком контракте (например, `resizeLiveRoomIds` вернёт лишний id, если убрать
  фильтр по `changed`). Находка M1(r4) не в том, что эти тесты неверны, а в том, что они не покрывают
  промежуточный конечный результат (`checkSpacePhysicalGeometry` на построенном кандидате).
- `no-new-any --base 444562e4 --head HEAD` — 0 новых `any` в 225 добавленных строках 3 файлов.
- Новая инструментация `demo/benchmark_large_house.mjs` (`physicalPreflightCount`/`physicalPreflightMs`,
  ассерт `resizeLivePreflightChecks < 1`) корректно доказывает то немногое, что доказывает: вызов
  происходит хотя бы раз во время editor-резайза на large-house фикстуре — не более.
- Трейлеры `Issue: #451` присутствуют, `User-Visible: no` для `5692a288` и `07ba2ffb` — точны для
  заявленного эффекта (реализация не меняет видимое поведение, когда проверка срабатывает), но не
  раскрывают найденную M1(r4) границу, где она не срабатывает.

## Чего не проверял и почему

- Полный `npm run golden:verify`, `npx tsc --noEmit`, `npm test`, `npm run build`+сверка бандла отдельно
  от CI — не перегонял: Validate зелёный на точном HEAD `07ba2ffb`
  ([run 33927104551](https://github.com/Matysh/houseplan-card/actions/runs/33927104551)), дешёвые гейты
  §8 сошлись на этом прогоне.
- 6 слабых `smoke-select`-совпадений по единственному общему идентификатору `cellCm`
  (`smoke_backdrop_guard`, `smoke_danger_confirmation`, `smoke_decor`, `smoke_grid_scale_invariance`,
  `smoke_help_affordance`, `smoke_space_scale_defaults`) — не гонял: `cellCm` — параметр с fallback по
  умолчанию в новом файле, общий для всей кодовой базы идентификатор без содержательной связи с темой
  этих смоков (ни один не про resize/physical-geometry); риск по существу покрыт целевыми
  wall-union/junction/resize смоками выше.
- Полный `npm run benchmark:large-house-interaction` — не перегонял сам; автор привёл 7 прогонов с
  зелёными абсолютными бюджетами на этом SHA. Дельта этого раунда не меняет веса editor-series (то же
  число вызовов physical-geometry на move, что и раньше, только на другом наборе комнат) — по построению
  не должна была измениться, и находка M1(r4) не является перформанс-регрессией (наоборот: локальный
  кандидат обычно дешевле полного пространства).
- `python -m pytest tests_backend` — диф не трогает `custom_components/**/*.py` (проверено
  `git diff --name-only 444562e4..HEAD`).
- Мутация для `resizeLiveCandidateSpace`/`resizeLiveRoomIds` через `scripts/mutation-gate.mjs` — не
  заводил (это не моя роль); вместо этого привёл воспроизводимую пробу через прямой вызов
  скомпилированных пары чистых функций на production-фикстуре #278 — она и есть демонстрация «чем
  краснеет» для находки M1(r4). Постоянный мутант в гейте — тоже часть того, что нужно от автора при
  закрытии находки.
- Полная browser-smoke матрица (222 файла) — не прогонял; это предрелизный гейт (PROCESS.md §8), дельта
  локальна (4 файла кода) и `smoke-select` по точному диапазону раунда покрыл релевантную тему.

## Итог

**Вердикт: жёлтый.** High: 0, Medium: 1 (M1(r4), в скоупе — возвращается автору, отдельный issue не
заводится). Порог из M1(r3) действительно удалён, но замена (`resizeLiveCandidateSpace` с фильтрацией
комнат по точному `changedRoomIds`) вводит новый, более скрытый пробел того же класса: воспроизведён
прогоном на реальном production-фикстуре #278, что живая physical-geometry проверка может вернуть `ok`
для кандидата, эквивалентного заведомо дефектной (`wall-degraded-extra`) полной геометрии, если
источник дефекта — стык с соседней, формально «неизменившейся» комнатой. Данные не портятся
(`_commitPhysicalGeometry` на `pointerup` не изменился и остаётся безусловным), поэтому находка не
блокирует как High, но AC «restore live resize validation» в исходном смысле (было в r1/r2 до #451
сломавших это) не является полностью восстановленным для этого класса дефектов ни на одном размере
плана — направление минимального фикса (переиспользовать уже существующий `resizeLiveJunctionRoomIds`)
подтверждено той же пробой.

---

<!-- material-anchors: заполняется конвейером публикации -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/451-render-performance`, коммит `07ba2ffbd1c0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c2def02d1a1409564ed4eaa3661b663cbba356c1`
  ```
  git log --all --format='%H %T' | grep c2def02d1a14
  ```
- ТЗ `docs/specs/451-render-performance.md`, блоб `7c323a29110974aae369077214b9e2a74d9387c1`
  ```
  git log --all --find-object=7c323a29110974aae369077214b9e2a74d9387c1 -- docs/specs/451-render-performance.md
  ```
