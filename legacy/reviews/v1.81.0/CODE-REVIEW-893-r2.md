# CODE-REVIEW-893-r2

Материал: `8073a096ebfc445d6b3287ea5585e400aed5d815` (`origin/dev..HEAD` =
`53c77783`, `117bdc73`, `ee263b14`, `d5a6f48e`, `9ef81d72`, `8efc62ec`,
`8073a096`). `git merge-base HEAD origin/dev` = `11c9789234d8` = текущий tip
`origin/dev` — ветка ровно на вершине dev, ребейз не требуется. Трек: `ask`.
Заход r2, блокирующих циклов 0/4.

## Скоуп

Тот же, что в r1 (ТЗ, SPEC-REVIEW-893-r1, зелёный, тело issue не менялось):
(1) выровнять eligibility alignment/equal-spacing guides с реально
нарисованным ростером иконок; (2) Walls — подсказка реального победившего
independent-wall endpoint (#885), без второй snap-логики; (3) отмена только
незавершённого device-drag на pagehide/hidden/disconnect/смену editor или
space, без письма/истории/сервисного вызова released/pending write; (4) без
UX/i18n/моделей данных; (5) CANVAS.md без устаревшего `_savePos`.

Этот раунд существует не из-за находок: r1 (`8073a096`'s предок
`7a7cf8cc`) получил зелёный вердикт (High 0, Medium 0). Автоматический merge
после r1 конфликтовал с параллельно принятыми `#849`/`#892` (конфликты только
в `docs/DEVELOPMENT.md` и числовой сводке `docs/testing-notes/mutation-browser-
guards.md`), что по `PROCESS.md` возвращает задачу в `S6-in-progress` с
вердиктом r1 нетронутым и без траты цикла; автор дважды ребейзился на
двигавшийся `dev` (`→ 005983d1 → 8073a096`) и снова встал на `S7-code-review`
— отсюда заход r2.

Все пять строк Core user jobs: J6 (eligibility/lifecycle реальность
редактора) напрямую; изменение полностью внутри admin-only редакторов
Devices/Walls, View новых обработчиков не получает (неизменно с r1).

## Риск по изменённым участкам (#707)

- **geometry** (`src/wall-end-align.ts:18,23-26` и вся функция
  `alignWallEnd`/`alignDrawnWallEnd`): покрыт AC2. Перечитал диф целиком на
  точном материале — `onMatch`/`onGuide` остаются чисто наблюдательными
  колбэками: `best` в цикле строго убывает (`d < best.d`), поэтому последний
  вызов `onMatch` перед выходом из цикла всегда соответствует финальному
  победителю; возвращаемое значение `alignWallEnd`/`alignDrawnWallEnd` не
  меняется относительно до-правки (подтверждено тестом `wall-end-align.test.mjs`,
  45/45 PASS в этом прогоне).
- **touch** (`src/houseplan-card.ts:5663`, токен `PointerEvent`): покрыт AC3
  — `this._deviceDragRetirement.blocksClick(ev as PointerEvent)`. Строка
  сдвинулась с `:5662` (r1) на `:5663` из-за одной строки, добавленной
  параллельно принятым соседним изменением выше по файлу; сам код идентичен.
  Для View путь неактивен (`_deviceDrag` заводится только в
  `this._mode === 'devices'`), новый интерактивный слой в View не появляется.

Оба класса покрыты AC ТЗ так же, как в r1 — reclassify не требуется,
`route: fix`.

## Как проверялось

Зелёный Validate на этом точном SHA подтверждён и перепроверён:
[ordinary run 38682343873](https://github.com/Matysh/houseplan-card/actions/runs/38682343873),
[full run 38682452460](https://github.com/Matysh/houseplan-card/actions/runs/38682452460)
— `gh run view 38682452460 --json headSha,conclusion,status` →
`headSha: 8073a096ebfc445d6b3287ea5585e400aed5d815`, `conclusion: success`,
`status: completed`. Это закрывает typecheck/test/build/bundle-policy/golden/
perf/geometry-parity — повторно полным набором не гонял.

Сверх Validate (выбрано по диффу и риску, независимо выполнено в этом раунде,
не копия чисел из r1):

| Гейт | Команда | Результат |
|---|---|---|
| Отсутствие незакрытых конфликтов после ребейза | `grep -rn '^<<<<<<<\|^=======$\|^>>>>>>>' $(git diff origin/dev...HEAD --name-only)` | пусто — конфликтных маркеров нет |
| Структурная проверка мутантов (новые/изменённые защиты AC1–AC3) | `node scripts/mutation-gate.mjs --check` | PASS — все новые id (`editor-guides-use-invisible-discovery-roster`, `wall-winning-guide-disconnected`, `wall-winning-guide-survives-other-owner`, `hidden-device-drag-not-retired`, `space-device-drag-survives-navigation`, `retired-device-tail-opens-settings`, `cancelled-device-dom-keeps-live-coordinate`, `detached-device-rollback-revives-live-rendering`, `device-retirement-never-accepts-fresh-pointer`) — `ok`; static readiness 1559/354 (денаминатор пересчитан после параллельно принятой задачи, рост согласован с добавленными guard-строками); 5 унаследованных warning (не новые, не относятся к #893) |
| Unit-свидетели изменённых/новых модулей | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/device-icon-roster.test.mjs test/device-drag-retirement.test.mjs test/wall-end-align.test.mjs test/live-editor.test.mjs test/device-marker-polish-contract.test.mjs test/device-spacing.test.mjs` | 45/45 PASS |
| `no-new-private-writes` | `node scripts/no-new-private-writes.mjs --base origin/dev` | PASS, 484 добавленных строки только в `demo/smoke_*`, новых записей в приватное состояние нет |
| `smoke-select` (AC + диапазон) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 43 прямых совпадения + 1 зарегистрированная связь (`smoke_wall_guide_ownership.mjs` ← `src/wall-end-align.ts`); НЕОПРЕДЕЛЁННОСТЬ не возникла |
| Нативные смоки — прямое совпадение/AC-поименованные | после `npm run bundle:sync`: `node demo/smoke_editor_guides_lifecycle.mjs`, `smoke_wall_guide_ownership.mjs`, `smoke_align_guides.mjs`, `smoke_device_equal_spacing.mjs`, `smoke_device_position_history.mjs`, `smoke_drag_bounds.mjs`, `smoke_wall_end_align.mjs`, `smoke_modes.mjs` | 8/8 PASS (бандл возвращён `npm run bundle:clean`, `git status` чист) |
| Инварианты модели (`invariants`) | не гонял | изменение в `wall-end-align.ts` остаётся чисто наблюдательным колбэком поверх уже существующей (#885) функции сопоставления; возвращаемая точка снапа не меняется (доказано тестом, см. выше); персистентная геометрическая модель (room/wall union) не затронута |
| `golden:verify`/полные наборы/`pytest` | не гонял | полный golden/perf/TS-Python parity уже зелёные на этом точном SHA в Validate (см. выше); Python-правок в диффе нет |

## Закрытие раунда r1

| Находка | Чем закрыта | Где видно |
|---|---|---|
| (находок High/Medium не было — r1 зелёный) | Автоматический merge-конфликт с `#849`/`#892` устранён ребейзом на принятый `11c9789234d8`; содержимое `src/**`/`test/**`/`demo/**` идентично r1 | diff `origin/dev...HEAD` ограничен теми же 7 файлами `src/**`, что и в r1 (`device-icon-roster.ts`, `device-drag-retirement.ts`, `device-spacing.ts`, `houseplan-card.ts`, `houseplan-editor-runtime.ts`, `live-editor.ts`, `wall-end-align.ts`); `mutation-registry.mjs`/`mutation-browser-guards.md` содержат ровно те 9 id AC1–AC3, что перечислены в r1 (`docs/reviews/CODE-REVIEW-893-r1.md`); отсутствие конфликт-маркеров подтверждено `grep` выше |

Возврат из `S7` в `S6` после r1 был merge-конфликтом, а не находкой ревью —
цикл по счётчику 0/4 не тратился ни разу (комментарии issue это явно
декларируют: «Код-ревью зелёное… Не удалось только слияние», «штатный возврат
произошёл до модели: новый цикл не израсходован»).

## Унаследовано из r1

Принято без повторного исполнения (материал r1 — коммит `7a7cf8ccef91`,
дерево `9433641f740b682703ce5efc3320ef112bf078da`; оба объекта более не
резолвятся локально из-за двух последующих ребейзов — это нормальное
следствие рутинного ребейза (§2.10), а не находка, так как дерево не было
мёртвым в момент публикации r1):

- Разбор AC1 (eligibility roster исключает hidden/tombstone/HA-disabled/LED)
  построчно против кода и nativeсмока `smoke_editor_guides_lifecycle.mjs` —
  независимо перечитан в этом раунде (см. «Риск» и таблицу гейтов), вывод не
  изменился.
- Разбор AC5 (CANVAS.md без устаревшего `_savePos`, актуальные имена
  `_devicePlacementForCanvas`/`_persistDevicePlacement`) — независимо
  перепроверен чтением `src/houseplan-card.ts:5312,5350` в этом раунде, имена
  существуют как заявлено.
- Дубликаты (#873, #885 закрыты; #861, #866 открыты и вне скоупа) — сверка
  живых статусов GitHub из r1 не повторялась; статусы issues не являются
  частью диффа этого раунда и не зависят от ребейза.
- Проверка зависимости от #847 (неопубликованный код не заимствован) — из
  r1; в этом раунде зависимость сместилась на #849/#892, что разобрано отдельно
  выше, а не унаследовано слепо.
- Release-ledger классификация (`stable-fix` относительно v1.80.1, Walls-guide
  не выдаётся за отдельную stable-фичу) — содержимое `docs/release-ledger/
  v1.80.1/893.json` в этом раунде побайтово совпадает с тем, что описал r1
  (перечитано в этом раунде, см. «Что проверено и корректно»); обоснование не
  изменилось.
- Трейлеры и changelog-формулировки — унаследован вывод r1 о консистентности
  русской терминологии («значки», «направляющие», «перетаскивание», «этаж»);
  в этом раунде changelog-текст побайтово совпадает (перечитан, см. ниже).

## Находки

Нет High. Нет Medium.

## Что проверено и корректно

- **AC1**: `device-icon-roster.ts` (`visibleIconMarkers`/`positionableIconMarkers`)
  — единый read-only источник для canvas (`houseplan-card.ts:10846`),
  align-кандидатов (`houseplan-editor-runtime.ts:10523-10524`) и equal-spacing
  (`device-spacing.ts:66-68`, через `positionableIconMarkers`). Unit
  (`device-icon-roster.test.mjs`) явно проверяет все восемь категорий
  (`plain`, `virtual`, `unavailable`, `hidden`, `disabled`,
  `disabled-visible-service`, `removed`, `led`, `upstairs`) и подтверждает, что
  видимый, но `ha_disabled` маркер остаётся кликабельным (`visibleIconMarkers`),
  но не является опорой выравнивания (`positionableIconMarkers`) — ровно то,
  что требует ТЗ («служебные» значки не опоры).
- **AC2**: `alignWallEnd`/`alignDrawnWallEnd` сообщают фактическую выигравшую
  точку через колбэк без второго прохода снапа (перечитано построчно, логика
  строго-убывающего `best` разобрана выше). `_resolvePlanDrawPoint` обнуляет
  `_wallEndGuide` на каждый вызов и блокирует его при
  node/axis/closure/ambiguous/45°-Shift кандидате (`wallGuideBlocked`).
  `_renderAlignGuides` в режиме Walls-drawing подменяет источник guides на
  единственный `_wallEndGuide` вместо `_alignCandidates()`, сохраняя ровно один
  слой (`data-wall-end-guide`). Существующие #885 AC1–AC7 (9/9, внутри
  `wall-end-align.test.mjs`, общий прогон выше) не тронуты.
- **AC3**: `_cancelDeviceDrag` теперь дополнительно вызывает
  `this._deviceDragRetirement.retire(drag.pointerId)` и
  `this._editorRuntime?._commitLiveEditor(drag.id)`, вызывается из
  pagehide/hidden-обработчика (новая строка `houseplan-card.ts:2333`) и из
  смены space (новая строка `houseplan-card.ts:1481`), вместе с уже
  существующим вызовом в `_pointerUp`/`disconnectedCallback`.
  `DeviceDragRetirement` (`device-drag-retirement.ts`) — маленький чистый
  класс: `retire`/`begin`/`key`/`blocksClick`; unit-тест
  (`device-drag-retirement.test.mjs`) явно проверяет, что retired pointerId
  блокирует клик, что новый `begin` снимает блокировку только для него (старый
  retired id продолжает блокироваться), что `key('Enter'/' ')` снимает
  `tailBlocked`, а `key('Escape')` — нет. `commitHouseplanEditor(value,
  restoredDeviceId)` в `live-editor.ts` перекрашивает imperative left/top даже
  при отключённом хосте (`host.renderRoot`), но не трогает disposed live-state
  при `!host.isConnected` — раздельные guard-и, подтверждённые двумя unit-ами
  в `live-editor.test.mjs`.
- **AC5**: `docs/CANVAS.md` таблица device markers → `_devicePlacementForCanvas`
  → `_persistDevicePlacement` (оба метода существуют по этим именам,
  `houseplan-card.ts:5312,5350`); добавлен абзац про shared eligibility и
  lifecycle-retirement без выдуманных имён.
- Трейлеры: все 6 содержательных коммитов несут `Issue: #893`; оба
  `User-Visible: yes` коммита (`53c77783`, `117bdc73`) редактируют
  `docs/CHANGELOG.md` **и** `docs/CHANGELOG.ru.md` в том же коммите
  (`git show --stat` подтверждает оба файла в обоих коммитах).
  `docs/reviews/CODE-REVIEW-893-r1.md` в коммите `8073a096` несёт
  `User-Visible: no` — корректно, это публикация отчёта, не продуктовая правка.
- `docs/release-ledger/v1.80.1/893.json`: `stable-fix` с явным обоснованием,
  Walls-guide явно не выдаётся за отдельную stable-фичу — перечитано,
  согласен с r1.
- Одно число — один источник: «единственный guide layer» —
  `this._wallEndGuide`, второй SVG-слой не создаётся (`_renderAlignGuides`
  строит `guides` из одного источника за раз — либо `[this._wallEndGuide]`,
  либо `alignGuides(...)`, никогда вместе).
- `scripts/mutation-registry.mjs`: структурно `ok` для всех id AC1–AC3 на этом
  точном SHA (см. таблицу гейтов); денаминатор `browser guards: 354/200`
  пересчитан консистентно (67→70 pointer-geometry, 180→183 custom-element —
  разница ровно 3+3 = 6 новых guard-строк этой задачи, что совпадает с
  количеством новых id с `compiledNodeSmoke`/native guard в реестре).

## Чего не проверял

- `npm run invariants` — геометрический результат `wall-end-align.ts` не
  меняется (см. выше), персистентная модель не тронута; гонять нечего
  проверять в этом диффе.
- Полный `golden:capture`/`golden:verify`, полный `npm test`, `npm run build`
  с трёхсторонней сверкой копий бандла, performance-бенчмарки — уже зелёные на
  этом точном SHA в Validate (см. ссылки выше); повторный прогон добавил бы
  время без нового сигнала.
- `pytest tests_backend` — диапазон не трогает `custom_components/houseplan/**`;
  Python-джоб в Validate корректно `skipped`.
- Полная матрица 345 нативных смоков — вместо неё прогнал 43 прямых совпадения
  из `smoke-select` списком (не исполнял все 43 по отдельности построчно в
  этом раунде — доверился их зелёному статусу внутри полного Validate-прогона
  на этом же SHA) и вручную перепрогнал 8 AC-поименованных/наиболее рисковых
  сценариев, перечисленных в таблице гейтов.
- Исполнение зарегистрированных мутантов (execution) — по правилу трека:
  мутанты не исполняются ни на каком треке во время разработки, это
  обязанность ночи (#709); структурная проверка (`--check`) выполнена.
- Дубликаты/живые статусы GitHub (#873, #885, #861, #866) — не сверялись
  повторно в этом раунде: они не являются частью диффа `origin/dev...HEAD` и
  их статус не может измениться из-за ребейза; унаследовано из r1.
- Реальные Android/iOS устройства, реальный bfcache/GPU — ограничение
  унаследовано из существующей инфраструктуры (#847) и не предмет этой задачи.

## Вердикт

Зелёный. r1 уже доказал все AC автотестом/нативным смоком/структурной
проверкой мутантов; этот раунд существует исключительно из-за
merge-конфликта при автоматическом ребейзе на двинувшийся `dev` (конфликты
только в генерируемой числовой сводке и соседней секции документации, не в
продуктовом коде). Независимая перепроверка на точном материале `8073a096`
подтверждает: конфликт-маркеров не осталось, структурная проверка реестра
мутантов проходит без ошибок (1559/354, 5 унаследованных предупреждений),
45 unit и 8 AC-поименованных native смоков зелены, оба риска из промпта
(#707) по-прежнему покрыты AC2/AC3 дословно, CANVAS.md/release-ledger/
trailers/changelog в порядке. Branch на вершине dev. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/893-editor-guides-lifecycle`, коммит `8073a096ebfc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `518afe94a1e217c3a0726eab5e3b04815d365341`
  ```
  git log --all --format='%H %T' | grep 518afe94a1e2
  ```
- Тело issue: `e67873c221aba2a1ced13357846b196ecc90576f16fcad31813a1ea923ae1f00`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0NTAsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTM1fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5OCwib3V0cHV0X3Rva2VucyI6MzM2NTUsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTI5NTI4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTMyODYyMCwiY29zdFVzZEVzdGltYXRlIjoxLjkyMDU4MjAwMDAwMDAwMDV9XSwidHVybnMiOjU5LCJkdXJhdGlvbk1zIjo1MDgxMzksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjkyNTExNzAwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4548 output_tokens=33672 cache_creation_input_tokens=129528 cache_read_input_tokens=5328620 num_turns=59 -->
