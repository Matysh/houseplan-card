# Код-ревью #593 — «Заменить все иконки библиотеки и расширить каталог до 60 плановых символов»

Заход: **r1** · блокирующих циклов израсходовано **0/4** (после этого вердикта — 1/4)
Материал: `7df2740f1ccc3bf14caeca1ae824eed853dda50f` (рабочая копия), один коммит,
245 изменённых файлов. Ветка была ребейзнута на ушедший вперёд `dev` (влился #594)
уже на этой вершине — конфликт был только в `dist/**`, `custom_components/.../frontend/**`,
обоих changelog и `docs/images/screenshots.json`; исходный код мебели трогали одни только
изменения этой задачи.

## 1. Скоуп ревью

ТЗ — редакция 4 в теле issue #593 (§1–§12), 11 критериев приёмки (AC1–AC11). Ревью
полное: это первый заход code review, дельты от предыдущего раунда нет (спор
был только в рамках самой спецификации, r1–r4 которой уже закрыт владельцем).

## 2. Как проверялось

Дешёвые гейты на `7df2740f` уже зелёные (Validate run 35438169526: success), поэтому
`npx tsc --noEmit`, `npm test`, `npm run build` заново не гонялись. Пересобраны и
прогнаны:

| команда | результат |
|---|---|
| `npm run build && npm run bundle:sync` | бандл собран, три копии дерева совпали |
| `npm run furniture:check` | `Furniture pack OK: 60 plan symbols, 33 menu icons (generated files current)` |
| `npm run bundle:budget` | initial View 290836/291400 ±2000 · lazy editor 221927/222900 ±2000 · lazy furniture art 16943/17900 ±2000 — все три внутри полосы |
| `node scripts/check-docs.mjs --screenshots=strict` | `Documentation checks passed (7 files, 12 external links)` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `smoke_decor.mjs`, `smoke_furniture_lazy_art.mjs`, `smoke_furniture.mjs` |
| `node demo/smoke_furniture.mjs` | OK, все факты `true`, включая `paletteShowsThirtyTwoCategories`, `newCategoriesAreVisible`, `requiredCategoriesArePresent`, `menuOnlyCategoriesStayHidden` |
| `node demo/smoke_furniture_lazy_art.mjs` | OK, включая `failedChunkDrawsNothingAtAll: true` (Q2) |
| `node demo/smoke_furniture_polish.mjs` | OK (не в прямой выборке инструмента, но назван в AC6 автором — прогнан) |
| `node demo/smoke_decor.mjs` | OK (прямое совпадение по символу `FURNITURE`) |
| `npm run golden:verify` (полная матрица, Chromium 151.0.7922.34 — совпадает с каноном) | 3 сцены `different`, 1 `missing-baseline` (новая сцена), остальные `passed`; разбор — находка §4.2 |
| прямые вычисления по `pack.json` / `test-build` (см. §4.1) | AC1–AC4 проверены исполнением скрипта, а не чтением |

Ручной проверкой кода (без исполнения): состав мутантов в `scripts/mutation-registry.mjs`
(5 новых + 1 исправленный), провенанс-документ пакета, i18n-диффы, docs/CHANGELOG*,
`docs/STATUS.md`, `docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`.

## 3. Находки

### Medium 1 — `docs/ARCHITECTURE.md` не обновлён, хотя ТЗ явно называет это условием

`docs/ARCHITECTURE.md:249` до сих пор говорит: «Designer furniture artwork follows
the same shape (#474): the catalogue (ids, groups, default sizes) stays eager,
**the 44 SVG drawings** live in `lazyFurnitureArtFiles`…». После задачи их **60**,
и союза с примитивами (12 retained) тоже больше нет — а абзац именно про этот
механизм (см. `git diff` — файл вообще не тронут этой задачей).

ТЗ §9 называет условие явно: «`docs/ARCHITECTURE.md` — если там названо число 44
или союз с примитивами». Условие выполнено (искал `grep -n "44\|primitive"
docs/ARCHITECTURE.md` — единственное релевантное вхождение это строка 249), правка
не сделана. Расхождение будет видно любому, кто читает архитектурный документ
после `docs/FURNITURE.md` (там число уже 60) — источники разойдутся.

**Воспроизведение:** `grep -n "44 SVG drawings" docs/ARCHITECTURE.md` → строка 249,
не изменена в `git diff origin/dev...HEAD -- docs/ARCHITECTURE.md` (диф пуст).

### Medium 2 — сцена `tray-narrow-palette-en` меняется, но не объявлена в списке golden-приёмки

ТЗ §8 объявляет ровно 10 сцен, которые разойдутся с эталоном («Объявляются заранее,
чтобы `--expect-change` был написан до прогона, а не подогнан под результат»).
`node scripts/rebase-on-dev.mjs`/хендофф этот список повторяют без изменений.

Прогнал `npm run golden:verify` на пересобранном бандле этой самой вершины,
Chromium 151.0.7922.34 (совпадает с каноном из `docs/images/screenshots.json`, то
есть это не шум чужой среды). Результат — **три** сцены `different`, а не две:

```
tray-narrow-palette-en          different   diffRatio 0.0022   ← НЕ в списке §8
furniture-categories-light      different   diffRatio 0.0034   (объявлена)
furniture-placement-preview-light different diffRatio 0.0031   (объявлена)
```

`tray-narrow-palette-en` (`demo/golden/matrix.mjs:616-618`) рендерит ту же
двухуровневую палитру категорий (`furniturePalette: 'categories'`) на узком
вьюпорте — те же новые 33 иконки меню и 32 категории, что и у объявленной
`furniture-categories-light`, просто в другой раскладке. Соседние `tray-*` сцены
(`tray-wide-selection-en`, `tray-medium-group-en`, `tray-medium-selection-ru`) —
все `passed`, то есть разница локализована именно в контенте палитры мебели, а
не в шуме раскладки/шрифта.

Это не абстрактный риск: `scripts/golden-acceptance.mjs` → `goldenAcceptanceRefusal`
буквально отказывает приёмке при необъявленной `different`-сцене («съёмка
разошлась с принятыми эталонами в сценах, которые менять не собирались... приёмка
запрещена»). Владелец планирует принимать эталоны отдельным шагом со своей машины
(§8, риск №4) — с текущим списком `--expect-change` эта команда откажет именно на
`tray-narrow-palette-en`, и раунд придётся повторить только из-за неполного списка.

**Воспроизведение:** `npm run build && npm run bundle:sync && npm run golden:verify`
на этой вершине → `artifacts/golden/golden-report.json`, `results[].id ==
'tray-narrow-palette-en'`, `status: 'different'`.

**Что делать:** дописать `tray-narrow-palette-en` в перечень §8 (и, соответственно,
в `--expect-change` будущей команды приёмки). Кода это не касается — только текста
объявленного списка, который передаётся владельцу.

Оба High отсутствуют. Обе находки — Medium **в скоупе** задачи (одна прямо названа
условием ТЗ §9, вторая — прямое следствие изменённого набора SVG меню, которое ТЗ
само описывает в §8). По правилу PROCESS.md §12 (2026-08-19, #202) отдельный issue
не заводится — обе чинятся в этой же ветке.

## 4. Проверено и подтверждено исполнением (AC1–AC11)

- **AC1** (пакет 33/60, идентичность): `npm run furniture:check` → `OK: 60 plan
  symbols, 33 menu icons`; прямым JSON-разбором `pack.json` — `menu_icons.length
  === 33`, `symbols.length === 60`, `pack_version === '0.4.0'`, `author`/`license`
  корректны.
- **AC2** (совместимость ID): вычислил множество старых публичных ID (44 дизайнерских
  из `houseplan-0.3.0/pack.json` + 12 retained из `LEGACY_FURNITURE`/`RETAINED_IDS`
  на `origin/dev`) против новых 60 — расхождение `missing: []`, `added: ['computer',
  'hood', 'oven', 'cactus']`. Ровно как требует ТЗ.
- **AC3** (mapping/категории): `menu_icons` минус используемые `symbols[].menu_icon`
  → пустая ровно `exercise`; занятых категорий 32. `cactus.menu_icon === 'plant'`.
  Подтверждено также смоком (`paletteShowsThirtyTwoCategories`,
  `menuOnlyCategoriesStayHidden`, `newCategoriesAreVisible` — все `true`).
- **AC4** (сохранённые размеры): вычислил объединённые старые размеры (44 из
  0.3.0 pack.json + 12 из примитивов на `origin/dev` `src/furniture.ts`) и сравнил
  с новыми `width_cm/depth_cm` для тех же 56 ID — `mismatches: []`. Таблица
  `BEFORE` в `test/furniture.test.mjs` подтверждена независимым пересчётом, а не
  просто прочитана.
- **AC5** (inert-subset): `furniture:check` не ослаблен (генератор — тот же файл,
  правки только в константах идентичности пакета, см. `git diff
  scripts/generate-furniture-assets.mjs` — 3 строки).
- **AC6** (UX палитры): `demo/smoke_furniture.mjs` и `demo/smoke_furniture_polish.mjs`
  — оба зелёные на пересобранном бандле этой вершины.
- **AC7** (видимость 60 вариантов): golden-сцена `furniture-new-symbols-light`
  добавлена в матрицу (версия 63→64), содержит все 4 новых ID; статус в отчёте —
  `missing-baseline` (ожидаемо, эталона ещё нет). Остальной мебельный срез
  разобран в §3 (Medium 2). `test/pdf-scene.test.mjs`/`test/pdf-svg-path.test.mjs`
  не менялись и не нуждались — уже параметризованы по каталогу, не по примитивам.
- **AC8** (lazy split, отказ чанка): `demo/smoke_furniture_lazy_art.mjs`
  зелёный, `failedChunkDrawsNothingAtAll: true`, `foreignBuildFallsBackLikeNetworkFailure`
  тоже смотрит на `furniture === 0`. `furnitureArtIsLazy` в `src/furniture.ts`
  теперь `BY_ID.has(id)` — унифицировано для всех 60.
- **AC9** (бюджеты-гейты): `lazyGraphCeilingViolation` — новый экспорт,
  используется в `assertBundleBudget`; `npm run bundle:budget` на собранном
  бандле подтверждает обе новые проверки внутри полосы (лог в §2). Тест
  `test/bundle-assets.test.mjs` сверяет и реальный `dist/houseplan-assets.json`,
  и синтетику по обе стороны полосы, и «зазор > 500 Б» с обеих сторон — как
  требует §7 ТЗ.
- **AC10** (провенанс/грант/лицензия): `assets/furniture/houseplan-0.4.0/README.md`
  несёт ссылку на грант `issuecomment-5739841899`, имя архива
  `houseplan-furniture-0.4.0.zip`, SHA-256 `69BA5E0C…`. Тест `release provenance
  is normalized...` в `test/furniture-assets.test.mjs` — 6 assert (2 equal + 4
  match) против 5 у версии на `origin/dev` (2 equal + 3 match): число проверок
  **не уменьшилось**, требование ТЗ §4 п.10 выполнено буквально.
- **AC11** (доказательства/команды): хендофф от 2026-09-19 называет команды и
  результат; после ребейза — второй хендофф с полным списком (`furniture:check`,
  `npm test` 2787/2786/1 skipped, `bundle:sync`, `bundle:budget`,
  `docs:accept -- --identical` 11/11, `mutation-gate.mjs --check`,
  `process-gate.mjs`). Я independently повторил релевантную часть (см. §2) на
  этой же вершине.

Ловушка союза `LEGACY_FURNITURE ∪ GENERATED_FURNITURE_CATALOG` (§5 ТЗ) закрыта
буквально: `LEGACY_FURNITURE`, `RETAINED_IDS`, тип `Prim`, `box()`,
`primitivePathD` удалены из `src/furniture.ts`, `FURNITURE` — прямое отображение
`GENERATED_FURNITURE_CATALOG`. Мутант `furniture-legacy-shadows-designer-art`
воспроизводит именно эту ловушку патчем на `src/furniture.ts` и ловится
`test/furniture-assets.test.mjs`/`test/furniture.test.mjs` (подтверждено автором
как «1 из 1» на этой же вершине после ребейза, и я не нашёл оснований сомневаться
— код мутанта соответствует описанию, `node --check
scripts/mutation-registry.mjs` синтаксически чист).

i18n: 7 ключей × 4 локали = 28 добавленных строк, посчитано `git diff` построчно —
ровно совпадает с §6 ТЗ. `furn.cat_exercise` не добавлен — верно, категория скрыта.

## 5. Чего не проверял и почему

- **`npm run typecheck` / `npm test` / `npm run build` "с нуля"** — не гонял:
  Validate на этой же вершине (`7df2740f`) зелёный (run 35438169526), а рекомендация
  задания прямо разрешает не повторять эти три гейта при зелёном Validate на
  материале. `npm run build` я всё же выполнил (дважды) — но не ради этого гейта,
  а чтобы получить свежий бандл для golden/smoke, поэтому неявно он подтверждён
  тоже (чисто, без ошибок typecheck).
- **`npm run gate:small -- --smokes`, полный `demo/smoke_*` (250 файлов)** —
  не требовалось: diff не «широкий» символ (11 попаданий на изменённых строках,
  порог — 50), инструмент назвал 3 сцены прямого совпадения, все три прогнаны.
  Дополнительно прогнал `smoke_furniture_polish.mjs`, названный в AC6 автором.
- **`python -m pytest tests_backend`** — diff не касается
  `custom_components/houseplan/**/*.py` (`git diff --stat` подтверждает: ни одного
  Python-файла в дифе).
- **`npm run invariants -- --config …`** — diff не касается геометрии/ссылок
  (рёбра комнат, толщина, `layout`, `marker.space`, `open_spans`); мебель — decor
  без геометрической модели (ТЗ и `docs/FURNITURE.md` это прямо фиксируют).
- **`node scripts/mutation-gate.mjs`** — не перегонял сам (это дорогой полный
  прогон); полагаюсь на то, что диффовый mutation-gate — часть Validate на
  review-кандидате (`.github/workflows/validate.yml`, шаг `mutation-gate.mjs
  --changed=$base..$HEAD_SHA`), а он зелёный на этой же вершине, плюс автор
  отдельно перепроверил ключевые мутанты после ребейза.
- **Приёмка golden-эталонов (`golden:accept`)** — вне досягаемости ревьюера
  (нужна машина владельца с полным Linux CI артефактом), что верно и названо
  в самом ТЗ (§8, риск №4). `golden:verify` (advisory, легален где угодно) я
  прогнал — и это как раз дало находку Medium 2.
- **`node scripts/process-gate.mjs --issues`** — требует `gh` с правами записи
  в контексте задачи; не относится к предмету код-ревью.

## 6. Вердикт

Одиннадцать AC доказаны — частично чтением, частично (там, где это имело смысл:
подсчёт множеств ID/размеров, смоки, бюджеты, golden) независимым исполнением на
этой же вершине, не только цитированием хендоффа. Явных дефектов поведения не
нашёл: ловушка союза каталогов закрыта, Q1/Q2/Q3 реализованы буквально, бюджеты
стали настоящим гейтом, провенанс не ослаблен.

Две находки Medium — обе в скоупе, обе не требуют выхода за пределы задачи:
пропущенная правка `docs/ARCHITECTURE.md` (условие ТЗ §9 сработало, но не
выполнено) и неполный список golden-сцен для будущей приёмки эталонов (реальный,
воспроизведённый на каноническом Chromium диф, который иначе откажет команде
`golden:accept`). High нет.

**Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 2 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/593-furniture-pack-0.4.0`, коммит `7df2740f1ccc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4141dff7cb0ad45e725cc54b9fac4ce7a156a9cc`
  ```
  git log --all --format='%H %T' | grep 4141dff7cb0a
  ```
- Тело issue: `3a8d99615191f61cc781ac873210df277ce0951d828113e3efa89700a5b7b6a3`
- Вердикт конвейера: `yellow` · High 0
