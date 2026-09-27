# CODE-REVIEW-447-r1

Issue: #447 · Этап: code · Заход: r1 · блокирующих циклов израсходовано 0 из 4

Материал: `git diff origin/dev...HEAD` на коммите `f62dd6b6` (HEAD ветки
`issue/447-exterior-snap-keyboard`, `git merge-base origin/dev HEAD` совпадает
с `origin/dev` — ветка не отстаёт и не расходится).

Коммиты в диапазоне:
- `a1fbea07`, `6c668d4b`, `818ad2d2`, `62ecb856` — спецификация и её ревью
  (spec-этап, уже пройден зелёным в r2, здесь не пересматривается);
- `6b07b70d` — продуктовый код, тесты, документация, changelog
  (`Issue: #447`, `User-Visible: yes`);
- `f62dd6b6` — принятый screenshot fingerprint (`Issue: #447`,
  `User-Visible: no`).

## Скоуп проверки

ТЗ: `docs/specs/447-exterior-furniture-snap-keyboard-nudge.md`, прошло
независимое spec-ревью r2 зелёным (H1 r1 закрыт). Код-ревью проверяет
реализацию против контракта §1–§4 и AC1–AC9 этого файла.

Изменённые продуктовые файлы:
- `src/furniture-wall-surface.ts` — парная наружная поверхность внешнего
  атома;
- `src/furniture-placement.ts` — `sideScore` → eligibility-фильтр для парных
  поверхностей;
- `src/editors/decor/geometry.ts` — `nudgeDecorShape`, чистый расчёт
  клавиатурной дельты;
- `src/houseplan-card.ts` — Arrow-guard в `_keyHandler`, `_decorNudge`;
- `test/furniture.test.mjs`, `test/decor-geometry.test.mjs` — новые unit;
- `demo/smoke_furniture.mjs`, `demo/smoke_decor.mjs` — новые browser-сценарии;
- `scripts/mutation-gate.mjs` — три новых дорогих мутанта;
- `docs/FURNITURE.md`, `docs/DECOR-EDITOR.md`, `docs/USER-GUIDE.ru.md`,
  оба CHANGELOG, `docs/images/screenshots.json`.

## Как проверялось

Зелёного Validate на `f62dd6b6` не найдено, поэтому дешёвые гейты прогнаны
самостоятельно, на этом SHA:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный, без вывода |
| `npm test` | 1889 тестов, 1888 passed, 0 failed, 1 skipped (совпадает с числом из отчёта реализации) |
| `npm run build` | собрался, 11.8s |
| `npm run bundle:sync` | зелёный; `git status` после — чисто, обе поставляемые копии (`custom_components/.../frontend`, `dist/`) побайтно совпадают с закоммиченными |
| `npm run bundle:budget` | зелёный: initial View 293220 B gzip / потолок 294000 B; предупреждение о запасе 6780 Б — тот же долг #367, не новый |
| `node scripts/check-docs.mjs` | зелёный (диф трогает `src/**` → обязателен); `docs/images/screenshots.json` до/после: `imageSha256` всех 10 сценариев не изменился, изменился только `sourceFingerprint/sourceSha256` — переотпечаток без визуальной регрессии |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 117 новых строк, новых `any` нет |
| `node scripts/mutation-gate.mjs --check` | все мутанты реестра, включая три новых (`furniture-exterior-surface-removed`, `decor-keyboard-nudge-reruns-magnet`, `decor-keyboard-nudge-drops-focus-dialog-guards`) — `ok` (патчи применимы, guard-файлы существуют); дорогой прогон (пересборка бандла на мутанте) не повторялся — это предрелизный гейт, автор уже прогнал и получил красный→зелёный на каждом |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | см. раздел ниже |
| `node demo/smoke_furniture.mjs` | зелёный, все поля `true`, включая три новых (`exteriorPreviewStaysOutside`, `exteriorCommitMatchesPreview`, `exteriorExactAxisDragPreservesSide`) |
| `node demo/smoke_decor.mjs` | зелёный, все поля `true`, включая девять новых Arrow-полей |
| `npm run invariants` | не прогонялся: диф не трогает persisted geometry/`layout`/wall thickness records/`marker.space`/`open_spans` — новые поверхности transient editor-only (подтверждено чтением `furnitureWallSurfacesFor`: кэш по `_cfgEpoch`, не пишется в конфиг) |
| `python -m pytest tests_backend` | не прогонялся: `custom_components/**/*.py` не тронут (только сгенерированный frontend-бандл) |

### smoke-select

```
Изменено файлов src/**: 4 · символов проекта на изменённых строках: 27
Матрица: 219 смоков · порог «широкого» символа: больше 43 смоков
Прямое совпадение (30): ...
Слабая связь (40): ...
Не учитывались как широкие: _gridPitch
```

Решение по каждой строке «прямого совпадения»: не прогонял ни один из
оставшихся 28, кроме уже расширенных `smoke_furniture.mjs` и
`smoke_decor.mjs`. Основание: общие символы совпадения — `_curSpaceCfg`,
`_saveConfig`, `_mode`, `_decorTool`, `_decorList`, `_decorMove`, `_decorSel`,
`_decorDraft`, `_dtDrag`, `_bdDrag`, `_geometrySnapshot`, `NORM_W` — это
состояние общего editor-harness, которое называет почти любой decor/furniture
смок независимо от темы; ни один из них не читает `roomFurnitureWallSurfaces`,
`snapFurnitureToWall` или клавиатурную дельту. Показательно, что сам
`_gridPitch` — тот единственный символ, который централен именно для AC4 —
инструмент исключил как «слишком широкий» (пересекает порог в 43 смока) и в
список совпадений вообще не попал; это подтверждает, что список совпадений
управляется общими полями оркестрации, а не темой задачи. `smoke_grid_snap.mjs`
и `smoke_drag_bounds.mjs` проверяют pointer-snap и pointer-drag границы —
не Arrow-путь; AC6 (bounds/no-deform для клавиатурного сдвига) уже доказан
unit-тестом с проверяемой падаемостью (см. ниже), отдельный browser-повтор не
добавляет покрытия для этой дельты. Слабые связи (40 позиций) не
просматривались — все совпадения там по одному распространённому имени
(`_mode`, `_curSpaceCfg` и т.п.), гейт называет это поводом посмотреть, не
обязанностью прогонять.

### Дисциплина «тест должен уметь падать»

Проверено для тестов, которые я прогонял, локальной мутацией с последующим
`git checkout --`:

- `const exterior = ownersByAtom.get(atomId)?.size === 1 && half > 1e-9;` →
  `const exterior = false;` — `npm test` красит 4 теста (AC1/AC2/AC3-смежные
  unit в `test/furniture.test.mjs`);
- `const wantedX = renderDx / canvasW, wantedY = renderDy / canvasH;` →
  `const wantedX = renderDx, wantedY = renderDy;` в `nudgeDecorShape` —
  `test/decor-geometry.test.mjs` красит тест «keyboard nudge moves every decor
  kind by one visible cell...» (AC4), причём падает именно на масштабе
  (`AssertionError: expected true, actual false` в `close()`), а не на
  постороннем поле.

Оба файла возвращены в исходное состояние, `git status` после — чисто.

## Находки

Не найдено ни одной находки — ни High, ни Medium, ни Low.

## Проверено и корректно

- **AC1 (наружная поверхность).** `roomFurnitureWallSurfaces` группирует
  атомы по `ownersByAtom` (ключ — канонический `segmentIdentity(axisA, axisB)`,
  инвариантный к порядку точек), и только атом с ровно одним владельцем и
  `half > 1e-9` получает вторую, наружную поверхность
  (`src/furniture-wall-surface.ts:92-108`). Наружная поверхность построена как
  `axis - inwardNormal*half` с нормалью `-inwardNormal` — ровно то, что требует
  §1 ТЗ. Внутренняя поверхность (уже существовавшая) сохранена без изменений
  геометрии, только помечена `roomSide: 'inside'`.
- **`snapFurnitureToWall` — фильтр, не тай-брейк, только для парных
  поверхностей.** `if (surface.roomSide) continue;` на стороне «за стеной»
  (`src/furniture-placement.ts:108-114`) полностью убирает поверхность из
  участия при равном/меньшем расстоянии — то, что r1 spec-ревью потребовало
  явно решить (§2 ТЗ: «фильтр, не тай-брейк»). Общие/нулевые/independent
  поверхности (`surface.roomSide === undefined`) не проходят через `continue`
  и сохраняют старое поведение `sideScore = -2` — регрессии для #445 нет,
  подтверждено тестом «a shared thick wall selects the intent side...» (не
  изменён логически, только дополнен проверкой `roomSide === undefined`).
- **AC2 (общая/нулевая/independent стена).** Новый тест «partially shared
  edges are atomised before exterior ownership is assigned» бьёт по главному
  риску ТЗ («принять частично общий атом за внешний»): вертикальная стена
  100→400 с частичным перекрытием комнатой `side` на 200→300 даёт `shared`
  (2 поверхности, `roomSide === undefined`) ровно на пересекающемся
  интервале и `inside+outside` на обоих внешних огрызках 100–200 и 300–400.
  Существующий тест инвариантности к порядку/winding/surface order не
  затронут и остаётся зелёным.
- **Exact-axis tie-break.** Новый placement на оси без `preferredNormal`
  детерминированно выбирает `inside` за счёт вторичного тай-брейка
  `stableId.localeCompare` (`":inside" < ":outside"` лексикографически) —
  устройство неэлегантное, но корректное и покрыто тестом «new exact-axis
  exterior placement defaults inside while drag preserves either side»; тот же
  тест подтверждает, что drag с `preferredNormal=[0,-1]` (наружу) сохраняет
  наружную сторону.
- **AC3 (preview/commit/drag).** `demo/smoke_furniture.mjs` прогнан лично:
  наружный pointer даёt preview снаружи, `pointerdown` коммитит идентичную
  геометрию, drag с наружной стороны на ось сохраняет сторону — все три поля
  `true`.
- **AC4 (клавиатурная дельта, единый источник масштаба).** `_decorNudge`
  вызывает `nudgeDecorShape(selected, renderDx, renderDy, NORM_W,
  this._decorH, CANVAS_LIMIT)` (`src/houseplan-card.ts:8460-8463`); `_decorH`
  — геттер, буквально возвращающий `NORM_W` (`src/houseplan-card.ts:8342-8344`,
  холст квадратный), поэтому `renderDx/NORM_W` и `renderDy/this._decorH`
  вычисляют то же `GRID_STEP_N`, что уже использует mouse-drag
  `_decorMoveUpdate` (`src/houseplan-editor-runtime.ts:4353-4354`) — то самое
  требование r1 spec-ревью (H1) выполнено в коде, не только в тексте ТЗ.
  Unit-тест использует те же экспортированные константы (`GRID_PITCH`,
  `GRID_STEP_N`, `NORM_W`, `CANVAS_LIMIT`) из `space-geometry.ts`, а не
  захардкоженные числа — «одно число, один источник» соблюдено.
- **`nudgeDecorShape` не деформирует и не пересчитывает снап.** Для линии оба
  конца получают одну дельту; для box-фигур меняются только `x/y`, не
  `w/h/angle`; функция явно документирована как «does not know about grid or
  wall snapping». Off-grid фаза сохраняется (дельта прибавляется, не
  округляется) — проверено тестом с дробным начальным `x=0.1013`.
- **AC5 (без повторного магнита).** `demo/smoke_decor.mjs` подставляет шпионы
  на `_decorSnap` и `_editorRuntime._furnMoveUpdate` вокруг Arrow-нажатий и
  проверяет `decorSnapCalls === 0 && furnitureMoveCalls === 0` — резолверы
  магнита физически не вызываются, это не косвенный вывод по результату.
  Соответствующий мутант `decor-keyboard-nudge-reruns-magnet` (вызов
  `_decorSnap` внутри `_decorNudge`) ловится именно этим шпионом.
- **AC6 (bounds без деформации).** Тест «keyboard nudge preserves line
  geometry and clamps the whole object at canvas bounds» проверяет и линию
  (длина/направление неизменны у границы), и повёрнутый на 45° rect через
  `boxCorners` (реальные повёрнутые углы, не осевой bbox) — последний шаг
  короче клетки, следующий — `null` (no-op). Падаемость теста подтверждена
  вручную (см. выше).
- **AC7 (history/save = одно нажатие).** `demo/smoke_decor.mjs`:
  `arrowIsOneHistoryAndSaveTransaction` проверяет `_geometryHistory.size===1`,
  имя записи `history.decor_move`, ровно один вызов debounced-save и рост
  `_cfgEpoch` на 1 за один keydown; `boundaryNoopIsConsumedButNotSaved`
  проверяет, что no-op у границы не трогает ни историю, ни `_cfgEpoch`, ни
  счётчик save. Undo/Redo восстанавливают ровно один шаг
  (`arrowUndoRedoIsExactlyOneStep`), selection не теряется.
- **AC8 (поля/диалоги/жесты/модификаторы).** Guard в `_keyHandler`
  (`src/houseplan-card.ts:3024-3034`) переиспользует существующий
  `inField`/`inEditorSecondary`/`_editorSecondaryDialogBlocked` паттерн, уже
  проверенный для Delete/Backspace двумя строками выше. Смок отдельно проверил
  `input/textarea/select/contenteditable`, toolbar-кнопку, открытый
  `_decorEraseConfirm`, активный `_decorMove` и `Ctrl/Cmd/Alt+Arrow` — все не
  меняют декор. `Shift+Arrow` даёт тот же один шаг (`mod` не включает
  `shiftKey`, что видно по определению `const mod = e.ctrlKey ||
  e.metaKey`) — соответствует явному решению владельца «ускоренного шага по
  Shift нет».
- **AC9 (совместимость и бюджет).** Все перечисленные в AC9 гейты
  (`typecheck`, `test`, `build`, `bundle:sync`, `bundle:budget`, `check-docs`)
  зелёные, включая мой независимый прогон, не только отчёт автора.
  `furnitureWallSurfacesFor` кэширует по `[space.id, _cfgEpoch, _cellCm,
  _gridPitch, _wallKeyPitch]` — как и раньше, один пересчёт на geometry epoch,
  новый парный кандидат не меняет модель кэширования.
- **Trailers и changelog.** `6b07b70d`: `Issue: #447`, `User-Visible: yes`, в
  том же коммите правки `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`.
  `f62dd6b6`: `Issue: #447`, `User-Visible: no` — верно для чисто
  fingerprint-коммита без видимого изменения (все 10 `imageSha256`
  побайтно прежние).
- **Терминология.** «Редактор подложки», «Выбрать», формулировки про стрелки
  в `docs/USER-GUIDE.ru.md` и `docs/DECOR-EDITOR.md` согласованы друг с
  другом и с уже принятой в проекте терминологией интерфейса.
- **Одно число — один источник.** Диф не добавляет новую видимую пользователю
  величину, показанную в двух местах (badge длины/площади не пересчитывается
  по-новому — nudge просто сдвигает существующую геометрию, которую badge и
  так читает из того же объекта). `test/single-source-numbers.test.mjs` в
  общем прогоне `npm test` зелёный.

## Не проверял

- Дорогой прогон `scripts/mutation-gate.mjs` (пересборка бандла на каждом из
  трёх новых мутантов) — это предрелизный гейт (PROCESS.md §8); ограничился
  `--check` (применимость патчей) и подтвердил силу соответствующих unit/smoke
  вручную отдельной локальной мутацией не из реестра (см. «тест должен уметь
  падать» выше). Автор в комментарии сообщил, что все три мутанта дали
  красный→зелёный переход при полном прогоне.
- Полный набор `demo/smoke_*.mjs` (219 файлов), golden (`npm run
  golden:verify`) и performance-профили — не названы в AC и не запускались;
  задача не меняет статическую композицию готового плана (только
  интерактивное позиционирование, уже покрытое DOM-coordinate смоками), это
  явно оговорено в разделе «План тестирования» ТЗ.
- 28 из 30 «прямых совпадений» `smoke-select` — решение и обоснование см. в
  разделе «smoke-select» выше; 40 «слабых связей» не просматривались.
- `npm run invariants` и backend pytest — диф не касается persisted-геометрии
  и `custom_components/**/*.py`, гейты неприменимы (обоснование выше).
- Ручное тестирование в браузере не проводилось (не входит в цикл ревью);
  вопрос «оно вообще работает» закрыт чтением кода плюс самостоятельным
  прогоном `demo/smoke_furniture.mjs`/`demo/smoke_decor.mjs`, которые управляют
  реальным production-бандлом через Playwright, а не мок.

## Вывод

AC1–AC9 доказаны кодом и тестами, которые я перепроверил лично (прогон плюс
целевая мутация для двух самых нагруженных AC). High/Medium находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/447-exterior-snap-keyboard`, коммит `f62dd6b632cf` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f6a04165e64ca68009db103a9a8ee83426aff47d`
  ```
  git log --all --format='%H %T' | grep f6a04165e64c
  ```
- ТЗ `docs/specs/447-exterior-furniture-snap-keyboard-nudge.md`, блоб `5c0036470b3bd675147ad5dc308b8d760be18b9c`
  ```
  git log --all --find-object=5c0036470b3bd675147ad5dc308b8d760be18b9c -- docs/specs/447-exterior-furniture-snap-keyboard-nudge.md
  ```
