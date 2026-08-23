# Issue #253 — Resize не теряет интервалы толщины стен

- Дата: 2026-08-23
- Тип: bug · приоритет P2
- Оценка: пользовательская ценность 9/10 · ценность для разработки 8/10 · сложность 7/10 · риск 8/10
- Issue: [#253](https://github.com/Matysh/houseplan-card/issues/253)
- Связанные задачи: [#201](https://github.com/Matysh/houseplan-card/issues/201),
  [#229](https://github.com/Matysh/houseplan-card/issues/229),
  [#233](https://github.com/Matysh/houseplan-card/issues/233),
  [#254](https://github.com/Matysh/houseplan-card/issues/254)
- Ветка: `issue/253-resize-wall-thickness`
- Статус ТЗ: на ревью

Канонические документы: `docs/SCOPE.md`, `docs/WALL-THICKNESS.md`,
`docs/ARCHITECTURE.md`, `docs/CANVAS.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/UX-MODES.md`, `docs/TOUCH-SUPPORT.md`, `docs/USER-GUIDE.md`,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Администратор дома уточняет готовый план в desktop Plan editor. Он выбирает
Resize и двигает стену одной комнаты — например, верхнюю стену сауны. Эта стена
является только частью более длинной физической стены, которая продолжается
вдоль соседних комнат и уже имеет настроенную толщину.

Пользователь ожидает, что перемещённая часть кладки последует за комнатой, а
соседний неперемещённый участок останется на месте. Это сценарий J6 из
`docs/SCOPE.md`: план должен оставаться правдивым по мере изменения дома.

Точная работа Resize является desktop-first. Общий safety floor для всех
способов ввода остаётся сильнее: pointer cancel, Esc или промежуточный preview
не могут записать либо потерять данные.

## 2. Что человек увидит до и после

**До:** после движения стены часть толстой стены превращается в тонкую осевую
линию; иногда исчезает и продолжение той же кладки у соседней комнаты, а около
стыков или проёмов остаются отдельные штрихованные обрезки.

**После:** перемещённая часть стены сохраняет прежнюю толщину и следует за
комнатой, неперемещённое продолжение остаётся на прежнем месте; ни одна другая
стена не истончается и проём остаётся в своей стене.

## 3. Проблема и подтверждённый диагноз

`_rszApplyPreview()` на каждом pointer move восстанавливает immutable snapshot,
формирует параллельные `oldSpans/newSpans` всех изменённых комнат и вызывает
`rekeyWallsAfterMove()` для сохранённых `space.walls`.

Текущая функция переносит запись с точными `a/b`, только если оба конца записи
лежат в допуске одного старого polygon edge. Запись 33 см из пользовательского
экспорта идёт по `y=0.4375` от `x=0.0708` до `x=0.4208`, а перемещаемое ребро
сауны заканчивается на `x=0.2042`. Поэтому запись пересекает ребро лишь частично,
не сопоставляется и не разрезается.

После этого ей оставляется старый compatibility key. Если такой key уже занял
другой результат, `if (used.has(nk)) continue` удаляет запись без проверки
точных концов и толщины. На реальном жесте число записей уменьшается с 24 до 23,
а единственное значение 33 см исчезает целиком. Следовательно, дефект находится
в persisted wall model, а не только в SVG, допуске или проёме.

Нарушены два действующих инварианта:

1. единица толщины — атомарный физический интервал, а не целое ребро polygon;
2. Resize переносит точные endpoints и re-key всех затронутых интервалов в одной
   транзакции без тихой потери пользовательских данных.

## 4. Цели

1. Сделать перенос `space.walls` lossless при полном и частичном пересечении с
   перемещаемыми рёбрами.
2. Оставлять неперемещённые части длинной стены на прежнем носителе.
3. Исключить удаление разных записей только из-за одинакового округлённого key.
4. Сохранить существующие Resize preview, opening, Undo/Redo и storage contracts.
5. Закрепить реальный дефект числовым production-bundle smoke и мутационным
   гейтом.

## 5. Скоуп

### Входит

- lossless transform точных wall intervals по парам `oldSpans/newSpans`;
- разрез сохранённого интервала во всех точках начала/конца частичных
  коллинеарных пересечений;
- перенос только покрытых частей и сохранение непокрытых остатков;
- дедупликация только геометрически одинаковых результатов одной толщины;
- deterministic key, ordering и canonical exact endpoints результата;
- edge drag и corner scale через общий helper;
- общие стены нескольких комнат, разные значения толщины и расщеплённые
  интервалы;
- сценарий с проёмом на перемещаемой части;
- unit, model invariant, mutation guard, production-bundle smoke;
- документация и changelog RU/EN.

### Не входит

- изменение UX, handles, snap, внутренних размерных подписей или минимальных
  размеров Resize;
- новое редактирование толщины, автоматический выбор толщины либо переработка
  инструмента «Толщина»;
- восстановление стены, уже потерянной старой версией, без исходного экспорта;
- фоновая миграция или Optimize pass для исторически повреждённых планов;
- изменение схемы `space.walls`, Store/model version или backend validation;
- изменение `open_spans`, правила привязки/размещения проёмов и jamb margin;
- изменение геометрии стыков, штриховки или внутренней площади;
- публикация нового предупреждения пользователю либо диагностического экрана;
- полная переработка room-resize planner из `src/resize.ts`.

## 6. Контракт интервалов

### 6.1 Источник истины

Для современной записи `WallEntry.a/b` являются точной геометрией;
`WallEntry.key` — совместимый производный индекс. Key не является достаточным
доказательством идентичности двух интервалов.

Запись без валидных точных `a/b` сохраняет текущий compatibility-путь: exact
whole-edge key map, затем midpoint projection. Задача не изобретает длину
legacy-записи, которой в данных нет, но и не удаляет её при коллизии key.

Толщина `cm` каждой выходной части равна толщине исходной записи после
существующего clamp. Resize никогда не интерполирует и не выбирает толщину.

### 6.2 Разбиение точной записи

Каждая точная исходная запись рассматривается независимо и проходит один
immutable transform:

1. найти старые spans, коллинеарные записи в действующем угловом допуске;
2. вычислить точные одномерные пересечения записи с каждым span;
3. добавить границы всех непустых пересечений в partition исходного интервала;
4. для каждого полученного ненулевого fragment определить покрывающие его
   преобразования по midpoint;
5. если fragment покрыт согласованным moved span, перенести оба endpoint по
   линейному параметру `t` из соответствующего `oldSpan` в `newSpan`;
6. если fragment не покрыт ни одним moved span, сохранить endpoint без изменений.

Преобразование применяется к исходной записи один раз; выход предыдущего
fragment/записи не становится входом следующего. Это запрещает накопление
ошибки и повторный перенос общей стены, встреченной в рёбрах двух комнат.

Касание только одной точкой имеет нулевую длину и не создаёт fragment. Очень
короткий ненулевой результат подчиняется тем же epsilon/canonical rules, что и
действующие wall intervals; он не удаляется лишь из-за визуального размера.

### 6.3 Несколько преобразований общей стены

Один fragment может быть покрыт старым ребром обеих соседних комнат. Если их
преобразования дают одинаковые endpoint в действующем coordinate epsilon, это
одно преобразование и один результат.

Если корректный Resize planner когда-либо передаст для одной физической части
разные назначения, helper работает fail-closed: не выбирает результат по
порядку массива, не теряет fragment и возвращает для него исходную геометрию.
Такой случай обязан быть отдельной явно красной unit-диагностикой; текущие
валидные edge drag и corner scale не должны его создавать.

### 6.4 Канонизация и дедупликация

Каждый точный результат строится через единый wall-entry constructor: canonical
ориентация `a/b`, clamp `cm`, key от фактических концов с текущими
`pitch/coordScale`. Nine-decimal storage canonicalization остаётся на общей
границе записи и не подменяет геометрический epsilon helper.

Результаты объединяются только если одновременно совпадают:

- canonical exact `a/b` в coordinate epsilon;
- `cm` после clamp.

Совпадение одного `key` не является условием удаления. Если разные exact spans
имеют одинаковый key, обе записи сохраняются. Если exact span совпал, но `cm`
различен, ни одно значение молча не выигрывает: конфликт остаётся видимым для
инвариантов/теста и не разрешается порядком входа.

Порядок результата deterministic: порядок исходных записей, затем fragments
вдоль canonical source interval. Повторный вызов с тем же snapshot и spans
возвращает deep-equal результат.

## 7. Контракт Resize

### 7.1 Preview, commit, cancel

`_rszApplyPreview()` продолжает каждый раз читать immutable pre-drag snapshot.
Новые интервалы живут только в `_rszPreview`; `_serverCfg` не меняется на
pointer move. Pointerup фиксирует весь resize одной существующей командой
history, а Esc/pointercancel возвращает прежние rooms, openings, walls и
open_spans без storage write.

Если polygons не изменились, wall list остаётся semantic deep-equal. Resize не
создаёт write только из-за нового порядка либо округления записей.

### 7.2 Проёмы и виртуальные части

`rekeyOpenSpansAfterMove()` сохраняет свой существующий контракт и порядок
вызова. Проём на перемещённом участке получает новые координаты через текущий
resize planner и остаётся на оси этой стены. Wall body вокруг opening cut
строится из перенесённых интервалов и не получает разрывов кроме самого проёма.

Неперемещённый остаток длинной стены сохраняет свои проёмы/виртуальные части и
не следует за другой комнатой. Эта задача не переассоциирует opening между
room wall и independent partition.

### 7.3 Реальный контрольный сценарий

Для комнаты `room_rmr649led_dc20a18c` «Сауна» при движении верхнего ребра вниз
на шесть шагов 5-см сетки:

- число wall records после полного жеста остаётся **24**, а не 23;
- 33 см есть на новом `y=0.4625`, `x=0.0708…0.2042`;
- 33 см остаётся на старом `y=0.4375`, `x=0.2042…0.4208`;
- вертикали 29 и 20 см заканчиваются на `y=0.4625` как в текущей корректной
  части поведения;
- ни одно значение `cm`, представленное до операции, не исчезает полностью;
- reload показывает ту же кладку, Undo возвращает исходные 24 записи, Redo —
  тот же исправленный результат.

## 8. UX, accessibility и touch

Новых контролов, сообщений и фокусируемых элементов нет. Мышь, keyboard Escape
и существующие touch/pointer события используют прежние handlers.

Визуальная приёмка проверяет не только наличие штриховки: body стены, её ось,
внутренняя площадь и проём должны совпадать с новой physical geometry. На
масштабах 1 см/точку и legacy 5 см/точку исправление одинаково по физическому
смыслу.

Pan, pinch и pointercancel не завершают жест и не сохраняют preview. Никакой
hover-only информации для понимания результата не требуется.

## 9. Модель данных, compatibility и миграция

Схема остаётся прежней:

```ts
space.walls: Array<{ key: string; cm: number; a?: [number, number]; b?: [number, number] }>
```

Новых полей, model/store version и backend API нет. Existing exact records
получают lossless поведение при следующем Resize. Legacy key-only records
остаются читаемыми и не переписываются фоном.

Исправление не выполняет read-time migration и не меняет untouched storage.
После завершённого Resize затронутые exact entries записываются обычным текущим
путём и проходят общий nine-decimal canonical writer. Старый frontend сможет
прочитать результат как обычные atomic wall records.

Уже повреждённый план автоматически не восстанавливается: отсутствующее `cm`
нельзя достоверно вывести. Пользователь может вернуть экспорт/backup или снова
задать толщину вручную.

## 10. i18n и документация

Новых строк интерфейса нет. RU/EN user guides должны одинаково утверждать, что
при частичном совпадении Resize переносит перемещённую часть толщины и сохраняет
остаток. `docs/WALL-THICKNESS.md` фиксирует lossless partition/dedup contract,
а `docs/ARCHITECTURE.md` — роль exact endpoints и compatibility key.

Оба changelog получают один пользовательский bugfix bullet со ссылкой #253 в
том же коммите, что и продуктовый код (`User-Visible: yes`). Внутренние имена
helper, key и wall records в changelog не используются.

## 11. Критерии приёмки

| AC | Требование | Доказательство |
|---|---|---|
| AC1 | Реальный сценарий §7.3 после edge drag оставляет 24 записи и точные две части стены 33 см на старом/новом `y`; вертикали 29/20 см движутся как раньше | production-bundle `demo/smoke_resize_wall_thickness.mjs` на минимизированной экспортной fixture + числовые assertions |
| AC2 | Точный interval при частичном коллинеарном overlap разрезается по обеим границам; покрытые fragments линейно переносятся, непокрытые сохраняются | `test/wall-thickness.test.mjs`: horizontal/vertical/reversed/diagonal table |
| AC3 | Whole-edge move, key-only legacy move и уже существующие partial-virtual tests остаются зелёными | existing + extended `wall-thickness` unit tests |
| AC4 | Два согласованных moved spans общей стены не переносят fragment дважды; conflicting transforms не выбираются по порядку и не теряют запись | permutation unit tests + mutation guard |
| AC5 | Одинаковый key у разных exact intervals не удаляет ни один; exact same geometry+cm объединяется; same geometry с разным cm не решается молча | collision/dedup unit matrix и мутант, возвращающий `used.has(key) → continue` |
| AC6 | Сценарий с opening на перемещаемой части переносит opening и оставляет непрерывное тело кладки вокруг cut; остаток стены и его geometry остаются на месте | production-bundle smoke с DOM/path + model assertions |
| AC7 | Preview не меняет `_serverCfg`; Esc/pointercancel не пишут; pointerup — одна history-команда; Undo/Redo/reload воспроизводят exact before/after | browser smoke через реальные handlers и write-spy |
| AC8 | Edge drag, corner scale, две смежные комнаты, Г-образная комната, split thickness и scale 1/5 см не теряют представленное значение `cm` | pure table + model invariant gate на before/after pairs |
| AC9 | Persisted schema/version/backend неизменны; повторный preview одного snapshot deep-equal и clean no-op не получает лишний write | compatibility/unit assertions + config round-trip |
| AC10 | RU/EN docs и оба changelog описывают пользовательский результат; bundles синхронны | `check-docs`, i18n/docs tests, bundle SHA comparison, process/provenance gates |

## 12. План автотестов и гейтов

### 12.1 Unit

В `test/wall-thickness.test.mjs` добавить табличные случаи:

- полный перенос exact interval;
- overlap в начале, конце и середине с двумя/тремя fragments;
- reversed endpoints, vertical и diagonal spans;
- несколько adjacent/equivalent old spans;
- fragment вне moved spans;
- point-only touch и degenerate span;
- одинаковый key при разных lengths/endpoints;
- exact duplicate same cm и conflict different cm;
- conflicting transforms и permutation stability;
- corner scale с изменением длины/направления;
- key-only legacy record без silent drop.

Тесты проверяют не только count/key, но canonical exact `a/b`, `cm`, суммарное
покрытие по каждому носителю и deep equality повторного запуска.

### 12.2 Integration / production bundle

Новый `demo/smoke_resize_wall_thickness.mjs` обязан использовать собранный
bundle и реальные `_rszEdgeDown → _rszMove → _rszUp`, а не прямой вызов helper.
Fixture минимизируется из пользовательского экспорта и не содержит имён,
entity/device ids или других личных данных, кроме технической geometry,
нужной для дефекта.

Smoke покрывает основной drag, commit, reload projection, Undo/Redo, Esc и
opening variant. Если полный экспорт нельзя безопасно положить в репозиторий,
фиксируется минимальный synthetic space с теми же числами и коллизией.

### 12.3 Инварианты и мутации

- `checkWallRecordsPreserved(before, after)` должен находить исходный broken
  result и быть зелёным на исправленном;
- mutating lossless splitter в no-split и возврат key-only `continue` обязаны
  краснить targeted tests/smoke;
- существующие fixture-model reference invariants остаются зелёными.

### 12.4 Локальный гейт перед `S7-code-review`

1. `npm run typecheck`;
2. `npm test`;
3. `npm run build` и побайтовая сверка двух tracked bundle copies;
4. `node scripts/smoke-select.mjs --base origin/dev --head HEAD`, затем все
   выбранные geometry/Resize smoke;
5. targeted model-invariant before/after run;
6. `node scripts/mutation-gate.mjs --check` и запуск новых мутантов;
7. `node scripts/check-docs.mjs` после любого `src/**` diff;
8. `npm run golden:verify`, только если менялась/добавлялась raster baseline;
9. `node scripts/process-gate.mjs --range origin/dev..HEAD --issues`.

Backend pytest не требуется без Python diff. Полные smoke/golden/performance
остаются предрелизными гейтами. Полный HA harness на Windows не заявляется.

## 13. Производительность и безопасность

Ожидаемая сложность helper: `O(W × E log E)`, где `W` — wall records, `E` —
затронутые room edges; сортируются только точки разбиения одного interval.
Операция работает только во время активного Resize и на уже загруженном
пространстве. Plan-wide boolean geometry, DOM measurement, registry/backend
запросы и новый render cache запрещены.

Должны сохраняться immutable snapshot и bounded finite math. `NaN`, бесконечные
или degenerate endpoints не создают новые записи. Никакие user strings/HTML,
permissions, service calls или внешние данные не добавляются.

## 14. Риски и защита

| Риск | Защита |
|---|---|
| Общая стена встречается у нескольких changed rooms и движется дважды | fragment строится только из immutable source; equivalent transforms collapse; permutation tests |
| Key collision снова удаляет физически другую запись | exact geometry+cm signature вместо `Set<key>`; специальный мутант |
| Разрез создаёт gap/overlap из-за epsilon | одномерный partition по общей source parameterization; coverage assertions |
| Corner scale и diagonal wall искажают t | линейное отображение endpoint по old/new span и diagonal table |
| Wall fix ломает opening/open span | отдельный real-handler smoke; соседний helper не меняется |
| Canonical writer создаёт повторный diff | deep-equal repeat/round-trip test и общий nine-decimal boundary |
| Исторически потерянная толщина выглядит как исправленная | документация явно не обещает восстановление старых данных |

## 15. Откат

Откат — один revert продуктового коммита #253 вместе с тестами, документацией,
changelog и синхронными bundles. Схема и данные не мигрируют, поэтому отдельный
rollback script не нужен.

Откат возвращает известный риск потери толщины при Resize. Он не должен удалять
уже корректно сохранённые atomic intervals: прежняя версия умеет читать их как
обычные exact wall entries.

## 16. Release-артефакты

- product commit с терминальными trailers `Issue: #253` и
  `User-Visible: yes`;
- RU/EN changelog bullets со ссылкой #253 в том же коммите;
- синхронные `dist/houseplan-card.js` и
  `custom_components/houseplan/frontend/houseplan-card.js`;
- новый/расширенный production-bundle smoke, unit и mutation guard;
- обновлённые RU/EN user guide, `WALL-THICKNESS.md` и `ARCHITECTURE.md`;
- handoff с командами/результатами, точным branch HEAD и выбранными smoke;
- green code-review document в `docs/reviews/` после автоматического ревью;
- включение в ближайшую бету только по отдельной команде владельца.

## 17. Принятые технические предположения

Эти решения пользователь напрямую не наблюдает; ревьюер может свободно
оспорить их без арбитража владельца.

1. Основной фикс живёт в чистом `rekeyWallsAfterMove()`, а не в UI handler:
   один contract нужен edge drag, corner scale и optimizer callers.
2. Exact overlap вычисляется в render coordinates с текущими
   `pitch/coordScale/angleClose` допусками; persisted endpoints возвращаются в
   normalized coordinates единым constructor.
3. Несогласованное двойное преобразование считается нарушением planner
   contract и сохраняет source fragment fail-closed; отдельный пользовательский
   toast в этой задаче не вводится.
4. Разные exact fragments могут законно иметь одинаковый compatibility key;
   дедупликация по key запрещена, пока exact endpoints расходятся.
5. Минимизированная fixture сохраняет только геометрию, необходимую для #253;
   персональные имена/HA bindings из пользовательского экспорта не коммитятся.
6. Golden baseline не принимается только ради исправления дефекта. Если
   доказательная визуальная сцена добавляется впервые, её canonical Linux
   artifact проходит обычный review/accept contract.
