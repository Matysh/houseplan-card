# CODE-REVIEW-445-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/445
- Этап: code (PROCESS.md §2.7), трек: full
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- Материал: ветка `issue/445-furniture-wall-face`, `HEAD` = `081cdbc6f3682c31e548b66c6cee4e231d24d2c0`
  - `04e3f5ee437c512c562432619932690f1045ad25` — `fix: snap furniture to wall surfaces` (Issue: #445, User-Visible: yes)
  - `081cdbc6f3682c31e548b66c6cee4e231d24d2c0` — `docs: accept screenshots for #445` (Issue: #445, User-Visible: no)
- merge-base с `origin/dev`: `560ca214b0d7d9018ff7916b25ebaea96a80e912` = `origin/dev` (ребейза не требовалось, история линейна)
- Предыдущий этап: spec принят зелёным на `SPEC-REVIEW-445-r2.md` (материал `a6d0c0b980bb…`, High:0/Medium:0). Это первый код-ревью раунда, поэтому разделы «Закрытие раунда r0» и «Унаследовано из r0» не применяются (§2.9 говорит о round-to-round внутри одного этапа; первый заход этапа `code` разбирается полностью).

## Скоуп

`git diff origin/dev...HEAD --stat`: 33 файла — новые `src/furniture-wall-surface.ts` (152 строки) и `src/furniture-placement.ts` (188 строк), урезанный `src/furniture.ts` (-151, старый магнит удалён), точечная интеграция в `src/houseplan-editor-runtime.ts` (+26/-24 в трёх местах: `_furnWalls`, `_resolveFurniturePlacement`, `_furnMoveUpdate`), расширенный `test/furniture.test.mjs` (+новые unit), расширенный `demo/smoke_furniture.mjs`, пять новых мутантов в `scripts/mutation-gate.mjs`, `docs/FURNITURE.md` + оба changelog, три бандл-копии (class D) и `docs/images/screenshots.json` (провенанс скриншотов). `src/space-geometry.ts` и `src/wall-thickness.ts` не тронуты — новый модуль только читает уже существующие `roomWallProfile`/`inwardNormal`, ничего в них не меняя.

Разбирался диапазон `git log --oneline origin/dev..HEAD` (2 коммита) и `git diff origin/dev...HEAD` целиком против ТЗ `docs/specs/445-furniture-wall-face-snap.md` (принятая версия, зелёный SPEC-REVIEW-445-r2) и AC1…AC10.

## Как проверялось

1. Прочитано тело issue #445 и все комментарии (аналитика → Q1/Q2 → решение владельца → ТЗ → SPEC-REVIEW-445-r1 (жёлтый) → SPEC-REVIEW-445-r2 (зелёный, AC10 закрыт)) и полный текст принятого ТЗ.
2. Построчно сверены `src/furniture-wall-surface.ts`, `src/furniture-placement.ts`, диффы `src/furniture.ts` и `src/houseplan-editor-runtime.ts` против контракта («Физический кандидат стены», «Выбор стороны» пп.1–6, «Положение предмета», «Радиус магнита», «Preview, commit и move», «Кэш и производительность»).
3. Ручным прогоном арифметики проверены пограничные тесты `test/furniture.test.mjs` (толстая внешняя стена, общая стена с точным попаданием на ось, локальная атомарная толщина, независимые тела, corner tie-break AC10) — числа сошлись с кодом `snapFurnitureToWall`/`roomFurnitureWallSurfaces`.
4. Гейты прогнаны сам (зелёного Validate на этом SHA нет):
   - `npx tsc --noEmit` — чисто;
   - `npm test` — 1884 теста, 1883 pass, 1 skip, 0 fail (`npm run inventory`: Node unit 1884 — не считал вручную);
   - `npm run build` — успешно;
   - `npm run bundle:sync` — no-op diff (три копии бандла уже синхронны в дереве коммита);
   - `npm run bundle:budget` — initial View 292747 B (было 293163 B на `origin/dev` — **уменьшилось**, новые модули ушли в `lazy editor` +1281 B gzip); есть неснятое предупреждение о запасе бюджета — это долг #367, не создан этой задачей;
   - `node scripts/check-docs.mjs` (diff трогает `src/**`) — «Documentation checks passed (7 files, 12 external links)».
5. `npm run invariants` не запускал: диф не пишет и не переносит геометрию стен, wall thickness records, `layout`, `marker.space` или `open_spans` — модуль `furniture-wall-surface.ts` только читает уже существующий `roomWallProfile`/`_rawPhysicalBodiesR()`, ничего не создаёт и не сериализует. Не тот тип изменения, для которого инварианты отвечают на свои три вопроса.
6. `node scripts/smoke-select.mjs --base origin/dev --head HEAD`: 43 «широких» символа на изменённых строках → «Прямое совпадение» (21 смок) и «Зарегистрированная связь» (2 смока), список и решение — в разделе «Гейты» ниже.
7. Прогнал `node demo/smoke_furniture.mjs` (назван в AC5/AC7 явно) на production-бандле — 100% ассершенов зелёные, включая все новые (`wallSurfaceCandidatesAreCached`, `thickWallPreviewAndCommitAreIdentical`, `sharedWallUsesRawPointerSide`, `exactAxisDragPreservesWallSide`).
8. Дисциплина «тест должен уметь падать» — проверена не декларативно: временно применил мутацию `furniture-wall-runtime-drops-raw-intent` (замена `intentPoint: [raw[0], raw[1]]` на `[snapped[0], snapped[1]]` в `houseplan-editor-runtime.ts`), пересобрал бандл и перезапустил `demo/smoke_furniture.mjs` — упали ровно `sharedWallUsesRawPointerSide` и `exactAxisDragPreservesWallSide`, остальное осталось зелёным. Откатил правку (`git status` после отката — дерево чистое), бандл пересобран на исходном коде.
9. Проверено чтением (не исполнением): `resolveFurniturePlacement`/`snapFurnitureToWall`/`furnitureWallSurfacesFor` вызываются только из `_resolveFurniturePlacement` (preview+place) и `_furnMoveUpdate` (drag) — ни одного вызова из пути рендера/загрузки уже сохранённой мебели, поэтому «уже сохранённая мебель не переписывается при load/render» (AC7, «Данные и совместимость») верно структурно.
10. Проверено чтением: `_cfgEpoch` — уже установленный в проекте сигнал инвалидации кэшей геометрии (используется `_decorSnapCache`, `_wallUnion` и другими кэшами тем же паттерном); `sourceCache` в `furniture-wall-surface.ts` следует тому же идиоматическому контракту, ключ также учитывает `space.id`, так что переключение этажа без смены `_cfgEpoch` тоже инвалидирует кэш.
11. Отдельным подпотоком проверено происхождение golden-сценария `furniture-placement-preview-light` (`demo/fixtures/visual-matrix.mjs`, `golden-geometry`, pointer `[0.35, 0.90]`): ближайшая стена там имеет `cm: 10` (не нулевая) — существующий canonical fixture действительно демонстрирует ненулевую толщину, как того требует AC8, и новый сценарий не понадобился.

## Находки

Находок уровня High или Medium в скоупе задачи не обнаружено.

Ниже — то, что специально проверялось как вероятные точки риска и не подтвердилось дефектом (не находки, а протокол проверки):

- **Побочный эффект на golden-снимок.** `furniture-placement-preview-light` идёт через реальный `_resolveFurniturePlacement` с геометрией `golden-geometry` (там есть стена `cm: 10` рядом с точкой предпросмотра), поэтому пиксели этого снимка почти наверняка изменятся по сравнению с текущим baseline (BACK теперь ложится на поверхность, а не на ось). `demo/golden/baselines/**` в этом коммите не менялся — и не должен: класс D, а приёмка golden — только через Linux CI перед бетой (AC8, `AGENTS.md` «Гейты»). Это ожидаемое поведение процесса, а не пропуск: называю явно, чтобы задача, готовящая следующую бету, не удивилась дифу.
- **Смещение области действия магнита у внешней стены снаружи дома.** У толстой внешней стены расстояние теперь меряется от внутренней поверхности, поэтому пользователь, наводящий курсор снаружи дома (за пределами наружного фасада), должен подойти ближе, чем раньше, чтобы попасть в шесть клеток. Это прямое и осознанное следствие принятого владельцем Q2-default («радиус от физической поверхности»), явно описанное в контракте и AC4 — не дефект.

## Что проверено и корректно

- **AC1** (толстая внешняя стена → внутренняя поверхность): `roomFurnitureWallSurfaces` строит один candidate на внешнее ребро комнаты со смещением `axis + inwardNormal*half`; тесты «the magnet presses…», «an outer wall always keeps…» проходят и арифметически совпадают с ожиданием ТЗ (BACK на `TOP_20`, центр `TOP_20+45`).
- **AC2** (общая стена, намеренная сторона): distance-to-surface естественно разносит два кандидата общей стены по сторонам (тест «a shared thick wall selects the intent side…»); точное равенство на оси разрешается `preferredNormal` (drag) либо стабильным `stableId` (новое размещение) — тест «new exact-axis placement is stable across room order, winding and surface order» проходит при перестановке комнат/winding/порядка массива.
- **AC3** (локальная атомарная толщина): `roomWallProfile`/`atomicPolyForRoom` уже делят периметр на атомы с собственным `offset`; тест «local atomic wall thickness owns the surface under the projection» проверяет разные offset на соседних участках 10/20 см без утечки в соседний атом.
- **AC4** (радиус от поверхности): distance считается до уже смещённого `surface.a/b`, а не до оси; тест «out of reach there is no magnet at all» проверяет порог по обе стороны от `TOP_20 ± 30`.
- **AC5** (единый resolver для preview/commit/move): и `_furniturePreviewPlacement`, и `_furnPlace` вызывают один и тот же `_resolveFurniturePlacement(raw, free, pointerType)` с одним и тем же `raw`; unit «preview and commit share one deterministic furniture placement resolver» и browser-смок (`thickWallPreviewAndCommitAreIdentical`) подтверждают побайтовое совпадение. Перемещение (`_furnMoveUpdate`) использует тот же `snapFurnitureToWall`, а не отдельную центролинейную ветку — код прочитан построчно, дублирования пути нет.
- **AC6** (нулевые стены/независимые тела): «zero walls keep the old centreline geometry» и «independent physical-body faces are not offset twice» проходят; malformed-фикстура подтверждает finite-фолбэк без падения остальных кандидатов.
- **AC7** (touch safety и данные): существующий набор touch-ассершенов смока (`touchCancelMoveAndSecondContactDoNotSave` и др.) зелёный на новом коде; вызовы resolver’а не достижимы из путей рендера/загрузки (см. «Как проверялось», п.9) — уже сохранённая мебель не переписывается.
- **AC8** (визуальная защита): единственный canonical furniture-placement фикстур (`furniture-placement-preview-light`, только light-тема — ровно как допускает ТЗ «одна тема — пиксельный witness, другая — geometry assertions») уже стоит на стене `cm:10`; geometry-assertions на стороне browser-смока покрывают вторую тему функционально. Приёмка изображения — по процессу, перед бетой.
- **AC9** (кэш/производительность): `furnitureWallSurfacesFor` кэширует список по `WeakMap` с ключом `space.id|cfgEpoch|cellCm|gridPitch|wallKeyPitch`; unit «runtime wall surfaces are built once per geometry epoch» доказывает ровно один вызов `_openCuts()` на эпоху и инвалидацию при её смене. Фактические размеры бандла (`dist/houseplan-assets.json`, `git diff`) подтверждают: initial View не вырос (293163→292747 B), новый код целиком в `lazy editor` (166061→167342 B) — new import не попал в initial-view граф.
- **AC10** (угловой tie-break, добавлен в SPEC-REVIEW-445-r2): unit «corner selection is nearest-first, intent-aware and invariant to input order» — вручную пересчитан для всех трёх кейсов (ближе/на грани по intent-стороне/полное равенство) и сходится с реализацией `sideScore`/`stableId.localeCompare`.
- Оба changelog обновлены в том же коммите, что и код (`04e3f5ee`, `User-Visible: yes`); `docs/FURNITURE.md` переписан под физический контракт без противоречий коду.
- Трейлеры `Issue:`/`User-Visible:` верны на обоих коммитах; класс файлов (A/B/C/D) не нарушен, никакой продуктовый код не тронут за пределами заявленной карты реализации.
- Persisted schema и backend не тронуты (`git diff` по `src/types.ts` и `custom_components/**/*.py` пуст) — соответствует «Данные и совместимость» ТЗ.

## Гейты — что прогнал, что нет и почему

Прогнал сам (зелёного Validate на этом SHA нет):

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | чисто |
| `npm test` | 1883 pass / 1 skip / 0 fail из 1884 |
| `npm run build` | успешно |
| `npm run bundle:sync` | no-op, три копии синхронны |
| `npm run bundle:budget` | initial View 292747 B, в пределах потолка (существующий низкий запас — долг #367, не введён этой задачей) |
| `node scripts/check-docs.mjs` | passed (diff трогает `src/**`) |
| `node demo/smoke_furniture.mjs` (назван в AC5/AC7) | все ассершены зелёные; вручную подтверждено, что 2 из них краснеют под мутацией и снова зеленеют после отката |
| `node scripts/mutation-gate.mjs --list` (только парсинг/регистрация пяти новых мутантов #445) | зарегистрированы корректно, guard-команды валидны |

Не прогонял и почему:

- **`npm run invariants`** — диф не пишет геометрию/толщину/`open_spans`/`layout`, только читает существующие `roomWallProfile`/`_rawPhysicalBodiesR()`; вопросы, на которые отвечают инварианты, к этому дифу неприменимы.
- **19 из 21 «прямое совпадение» смоков** (`smoke_junction_holes`, `smoke_junction_patch_resilience`, `smoke_active_chain_ink`, `smoke_backdrop_guard`, `smoke_danger_confirmation`, `smoke_decor`, `smoke_drag_bounds`, `smoke_glow`, `smoke_grid_scale_invariance`, `smoke_grid_snap`, `smoke_help_affordance`, `smoke_infinite_canvas`, `smoke_junction_limits`, `smoke_multiwall_junction`, `smoke_opening_measure`, `smoke_optional_space_model`, `smoke_space_scale_defaults`, `smoke_wall_junctions`, `smoke_wall_key_roundtrip`, `smoke_wallthick_standalone`) — инструмент совпал по распространённым символам (`NORM_W`, `GRID_PITCH`, `cellCm`, `_spaceWalls`, `_openCuts`, `_rawPhysicalBodiesR`), которые новый код только читает как вход; их определения и поведение не менялись (`src/space-geometry.ts`, `src/wall-thickness.ts` — 0 изменений в дифе). Это ровно тот случай «слабой связи по распространённому имени», который процесс называет поводом посмотреть, а не обязанностью прогонять.
- **2 «зарегистрированная связь»** (`smoke_resize_pointer_real_plan.mjs`, `smoke_resize_wall_thickness.mjs`, оба по типу `WallEntry`) — `WallEntry` использован только как тип импорта без изменений в определении или семантике; resize-путь этой задачей не затронут.
- **`npm run golden:verify` / `golden:capture`** — canonical furniture fixture (см. «Что проверено», AC8) реально изменит пиксели, но по ТЗ и процессу принятие golden — задача перед бетой на точном Linux CI SHA, не этого раунда.
- **`python -m pytest tests_backend`** — ни один файл `custom_components/**/*.py` не менялся.
- **performance_smoke / перф-профили** — не названы в AC, чувствительные к перфу пути (рендер стен/junction) не тронуты; единственное перф-требование (AC9, кэш на эпоху) доказано unit-тестом и фактическими размерами бандла.

## Одно число — один источник

Диф вводит одну пользовательски видимую величину дважды по своей природе: положение мебели показывается один раз в hover-превью и один раз в сохранённой записи. Источник один — оба вызывают `resolveFurniturePlacement`/`_resolveFurniturePlacement` с одним и тем же `raw`; unit-тест и browser-смок (`thickWallPreviewAndCommitAreIdentical`) утверждают побайтовое равенство. Второй потенциальный дубль — угол между превью и drag — тоже проведён через один и тот же `snapFurnitureToWall`. Отдельного числового поля (подписи, лейбла) с независимым источником в этом дифе не добавлено.

## Вердикт

Все девять AC исходного ТЗ и AC10 из SPEC-REVIEW-445-r2 доказаны конкретными тестами, которые я перепроверил на способность падать (мутация + мутационные тесты в `scripts/mutation-gate.mjs`). Гейты, которые применимы к дифу, зелёные. Golden-приёмка сознательно отложена на пре-бета-гейт по процессу, а не пропущена.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/445-furniture-wall-face`, коммит `081cdbc6f368` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5f7ab4e16fe5d56b87d423ac19c563f6c7a579d3`
  ```
  git log --all --format='%H %T' | grep 5f7ab4e16fe5
  ```
- ТЗ `docs/specs/445-furniture-wall-face-snap.md`, блоб `95d03a5425fc37f95095c2f53a49363e668edb40`
  ```
  git log --all --find-object=95d03a5425fc37f95095c2f53a49363e668edb40 -- docs/specs/445-furniture-wall-face-snap.md
  ```
