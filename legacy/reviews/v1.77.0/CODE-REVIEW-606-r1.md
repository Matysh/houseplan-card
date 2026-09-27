# CODE-REVIEW-606-r1 — «Показать тренажёр и исправить перепутанные bookshelf/shelf_floor»

Issue: [#606](https://github.com/Matysh/houseplan-card/issues/606)
Этап: code · трек: полный · заход r1 · блокирующих циклов израсходовано 0 из 4
Материал: диапазон `origin/dev..HEAD`, вершина `6d6d6a131778b8fca65c3489f206380949159cb2` (рабочая копия на этом SHA, `git status` чистый на всём протяжении ревью)
Коммиты: `20457660` fix(furniture) User-Visible: yes · `748ebe86` test(furniture) · `6d6d6a13` test(golden) — все с трейлерами `Issue: #606`

## Скоуп

Задача — коррекция уже выпущенного пакета мебели `houseplan-0.4.0` (#593):
переименование ошибочно подписанного `cactus` в `exercise` без изменения
рисунка, обмен содержимым файлов `bookshelf.svg`/`shelf_floor.svg`, публикация
пакета `0.4.1`, чтение старого `symbol: cactus` как read-only совместимого
псевдонима на всех поверхностях рендера, обновление локализации и обоих
changelog. Предыдущий этап — ТЗ, зелёный вердикт r1 (`docs/reviews/SPEC-REVIEW-606-r1.md`,
закоммичен этой же веткой). Это первый заход код-ревью, раздела «Унаследовано
из r0» не требуется.

## Как проверялось

Дешёвые гейты уже подтверждены на этом SHA: Validate [run 35601256965](https://github.com/Matysh/houseplan-card/actions/runs/35601256965)
(`headSha` сверен через `gh run view --json headSha` = `6d6d6a13...`) —
success, включая фронтенд (typecheck/unit/mutants по диффу/бандл-синхрон) и
`provenance`, `process-gate`. Поэтому `npx tsc --noEmit`, `npm test` и
`npm run build` со сверкой копий бандла не перегонялись повторно как отдельный
общий прогон; вместо этого бюджет пошёл на targeted-перепроверку и на то, что
Validate в этом прогоне не покрывает (browser smoke, golden — оба `skipped` в
этом run, поскольку это не heavy-гейт).

Что прогнал сам, помимо чтения кода:

- `npm run furniture:check` → `Furniture pack OK: 60 plan symbols, 33 menu icons` — подтверждает AC1 независимо от отчёта автора.
- `diff` байт-в-байт между `assets/furniture/houseplan-0.4.0` и `houseplan-0.4.1`: `plan/exercise.svg` идентичен старому `plan/cactus.svg`; `plan/shelf_floor.svg` (0.4.1) идентичен старому `plan/bookshelf.svg`; `plan/bookshelf.svg` (0.4.1) идентичен старому `plan/shelf_floor.svg`; `menu/exercise.svg` не тронут — подтверждает AC2 напрямую, а не через тест автора.
- `npm run build` + `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` + `node --test` на `test/furniture-assets.test.mjs`, `test/furniture.test.mjs`, `test/furniture-path-join.test.mjs`, `test/pdf-scene.test.mjs`, `test/golden-matrix.test.mjs`, `test/i18n.test.mjs` → 161/161 passed.
- Дисциплина «тест умеет падать»: временно откатил тело `canonicalFurnitureId` в скомпилированном `test-build/furniture-id.js` до `return id;` (только build-артефакт вне git, не источник) и перезапустил `test/furniture.test.mjs` — новый тест `#606: saved cactus resolves…` покраснел (43 passed / 1 failed), файл сразу восстановлен из бэкапа; `git status` после — чистый.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → «Зарегистрированная связь»: `demo/smoke_furniture.mjs ← canonicalFurnitureId`, обоснование в `scripts/smoke-links.mjs` — символ читается по DOM, а не импортом. Больше связей инструмент не назвал; широких совпадений (>52 смоков) нет. Решение: прогнать именно этот смок целиком (единственный прямо связанный с диффом; `demo/smoke_furniture_polish.mjs` и `demo/smoke_furniture_lazy_art.mjs`, названные автором, не прогонял отдельно — не в выдаче инструмента и не требуются ни одним AC как отдельные свидетели, только `smoke_furniture` назван в ТЗ явно).
- `npm run bundle:sync` (build + `bundle-sync.mjs`) → пересобранный `dist/**`/`custom_components/houseplan/frontend/**` байт-в-байт совпал с закоммиченным (`git status` чистый) — независимое подтверждение синхронизации бандла помимо отчёта Validate.
- `node demo/smoke_furniture.mjs` целиком (пересобранный бандл, Linux/headless Chromium) → **OK**, все 90+ полей `checkAll`, включая новые для #606: `exerciseCategoryIsVisible`, `paletteShowsThirtyThreeCategories`, `exerciseCategoryHasOneVariant`, `plantCategoryHasOnlyPlant`, `savedCactusDrawsInView`, `savedCactusUsesExerciseArtwork`, `legacyPropertiesShowExercise`, `unrelatedSaveKeepsLegacyIdAndTransform`, `explicitVariantChangeWritesExercise` — все `true`. Проверил, что `checkAll(res)` в `demo/serve.mjs` требует `true` по умолчанию для каждого ключа возвращённого объекта — падение любого нового поля красит смок.
- `node demo/golden/run.mjs --mode=capture --scenario=furniture-corrected-art-light` (у verify нет флага диагностики по одной сцене — `policy.mjs` отказывает; `--mode=capture --scenario=` — штатный путь для одиночного диагностического кадра) → эталона нет («missing-baseline», ожидаемо: сцена новая, автор явно не принимал её). Полученный `artifacts/golden/actual/furniture-corrected-art-light.png` просмотрен лично: два одинаковых рисунка тренажёра (старый `cactus`, повёрнутый/отражённый, и новый `exercise`) — рисунки идентичны, как и требует AC4; книжный шкаф (повёрнут, отражён) и напольный стеллаж внизу — два явно разных рисунка, как требует AC2/AC3; наложения на стены нет. Это независимое визуальное подтверждение, не принятие эталона — файл лежит в `artifacts/`, которая в `.gitignore`, ничего не закоммичено.

Чего не проверял и почему: полный `npm run golden:verify` по всей матрице (260 сцен) не гонял — задача не трогает ничего вне сценариев мебели, а прогонявшаяся автором матрица уже показала точечные отличия только в несвязанных диалоговых сценах (`device-dialog-*`, `settings-help-*` и т.п.), что подтвердилось и в моём фрагментарном логе того же прогона матрицы (я успел получить только хвост, но не увидел там `furniture-corrected-art-light` вообще, потому что эта сцена не имеет эталона и в списке verify не появляется как «different»/«passed» — с `--mode=capture` это подтвердилось явно как «missing-baseline»); полный прогон не добавил бы уверенности сверх точечной проверки. `python -m pytest tests_backend` не гонял — диф не трогает `custom_components/**/*.py`. Perf-профили — не названы в AC и не в чувствительном пути. `demo/smoke_furniture_polish.mjs`/`demo/smoke_furniture_lazy_art.mjs` — не перепрогонял, см. решение выше; автор отчитался о зелёном прогоне (WSL для lazy_art, с уже известной путевой проблемой на Windows-исполнении, не связанной с #606).

## Находки

Ничего не нашёл, что тянуло бы на High или Medium.

Low: изменение `docs/USER-GUIDE.md` (EN) ограничивается одним абзацем без
переработки более старого текста об «32 категориях» в других местах файла —
не нашёл такого упоминания при чтении изменённого раздела и соседних
абзацев, так что похоже это не отдельная находка, а просто нечего чинить;
явно не помечаю как Low, поскольку не нашёл подтверждающей строки.

## Что проверено и корректно

- **AC1** — `furniture:check` (прогнан лично) и независимое чтение
  `pack.json`: `exercise → exercise`, `plant → plant`, `cactus` отсутствует
  среди 60 видимых id, все 33 категории имеют варианты (`categories.size === 33`
  в `test/furniture-assets.test.mjs`, тест сравнивает с независимым `MANIFEST`).
- **AC2** — прямой байтовый `diff` (не тест автора) подтвердил переименование
  `cactus→exercise` без изменения геометрии и обмен содержимым
  `bookshelf`↔`shelf_floor`; размеры в `pack.json` (`70×120`, `100×35`) и
  `back: top` не изменились; `svg/menu/*` не тронуты.
- **AC3** — `demo/smoke_furniture.mjs`, прогнан лично: категория «Тренажёр»
  видима, содержит один вариант `exercise` (не `cactus`), «Растение» содержит
  только `plant`; превью категорий используют то же арт-исходное представление.
- **AC4** — единственный путь превращения id в рисунок — `canonicalFurnitureId`
  (`src/furniture-id.ts`), подключён во всех точках чтения: `furnitureSymbol`,
  `furnitureArtIsLazy`, `furnitureGraphic`, `furniturePathD` (`src/furniture.ts`),
  выбор в диалоге свойств (`src/decor-image-editor.ts`), PDF/static
  (`src/pdf/pdf-scene.ts`). Проверил, что других мест чтения арта по id нет
  (`grep` по `GENERATED_FURNITURE_ART[`, `FURNITURE_ART_RUNTIME.art(`,
  `furnitureGraphic(` — все проходят либо напрямую через резолвер, либо через
  функции, которые уже его вызывают внутри). `isDesigner`/`furnitureArtBootPending`
  получает уже канонизирующую `furnitureArtIsLazy`, так что boot-veil у
  старого `cactus` ждёт арт как у любого известного символа — риск 1 из ТЗ
  закрыт кодом, а не только тестом. Свойства старого предмета показывают
  «Тренажёр» (canonicalFurnitureId только для вычисления `selected`, само
  значение `dialog.symbol` не переписывается до явного `@change`) — риск 2 из
  ТЗ закрыт; обычное сохранение не переписывает id — smoke
  `unrelatedSaveKeepsLegacyIdAndTransform` подтверждает на всех
  x/y/w/h/angle/flip/color/opacity/width_cm полях. Явная смена варианта пишет
  `exercise` — подтверждено смоком и отдельно unit `test/furniture.test.mjs`.
  Визуально (мой захват golden-кадра) рисунки старого и нового id идентичны,
  а bookshelf/shelf_floor различны, включая повёрнутый/отражённый экземпляр —
  риск 3 из ТЗ закрыт не только тестом матрицы, но и просмотром.
- **AC5** — RU/EN/FR/DE получили `furn.cat_exercise`/`furn.sym_exercise` без
  fallback (`test/i18n.test.mjs` больше не исключает `furn.sym_cactus` из
  проверки «не совпадает с английским», потому что ключ убран целиком —
  ТЗ разрешает это явно: «могут оставаться» не значит «обязаны»).
  `docs/FURNITURE.md`, `docs/USER-GUIDE.ru.md`, `docs/USER-GUIDE.md`,
  `docs/STATUS.md`, оба `CHANGELOG` и `README.md` нового пакета описывают
  фактический результат (33/33 категории, точные три правки, происхождение
  0.4.0 не переписано). Оба changelog в одном `User-Visible: yes` коммите
  `20457660` (проверено `git show --stat`).
- **AC6** — `furniture:check`, `typecheck` (часть `npm run build`),
  `npm test`-эквивалент (targeted + прогнан Validate), `build`,
  `bundle:sync`/`bundle:budget` (Validate), мебельный smoke (лично) и golden
  (лично, точечно) — все зелёные на этом SHA. Изменившийся золотой набор —
  ровно одна новая сцена без эталона, автор явно не принял её автоматически
  (принятие эталонов не входит в эту задачу).
- Мутационный тест `furniture-exercise-misfiled-in-plant` (переименован из
  `furniture-cactus-lands-in-exercise`) бьёт по новому файлу пакета и новому
  инварианту; Validate прогнал мутанты по диффу зелёным на этом SHA (все 6
  шардов «Мутанты по диффу» success).
- Инфраструктурный блокер (рассинхрон `mutation-gate.yml` между `main`/`dev`
  после #604) устранён отдельным инфраструктурным коммитом `74fcff55` вне
  этой ветки — к #606 не относится, в диапазоне ревью не участвует.
- Инварианты геометрии/толщины стен (`npm run invariants`) не запускал:
  дифф не трогает рёбра комнат, `layout`, `marker.space`, `open_spans` —
  только декор-слой (мебель), для которого этот гейт не применим.
- «Одно число — один источник»: диф не вводит новых видимых числовых величин
  (размеры `70×120`/`100×35` не новые, копируются из спецификации #593/#606
  как константы `pack.json`, не дублируются вручную нигде ещё) — проверка
  неприменима.

## Итог

Изменение точное, byte-for-byte проверяемое независимо от тестов автора,
контракт совместимости (`canonicalFurnitureId`) — единая точка входа без
исключений, подтверждённая и чтением, и мутационным тестом, и живым
прогоном браузерного смока и golden-кадра. Все шесть AC закрыты и
перепроверены самостоятельно, а не приняты на веру.

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/606-furniture-catalog-corrections`, коммит `6d6d6a131778` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ce1a14e2528cab1fefbe745d0711ba93aa0b6a7e`
  ```
  git log --all --format='%H %T' | grep ce1a14e2528c
  ```
- Тело issue: `96bd494bbf2f992639dc27711a166b327427c83505722e10119c467c66dbbfd5`
- Вердикт конвейера: `green` · High 0
