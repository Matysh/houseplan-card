# CODE-REVIEW-871-r1

Материал: `742794c4c817992c617d0ee251093163f3395228` (база `ece52121269f8a83e0e15eb0f7081e88d408c3fa`), рабочая копия — на нём же. Трек `ask`, заход r1, блокирующих циклов 0/4.

## Скоуп

Issue #871: путь пылесоса (`.vactrail`) отрывается от плана во время live-панорамирования/зума, а его динамический конец (`line.tip`) — от визуального центра робота. ТЗ называет две причины и требует исправить обе одним фиксом, не трогая источники/калибровку/маршруты/сглаживание/историю. Диапазон изменений: `src/houseplan-card.ts` (`_renderVacuums`, `_vacRafLoop`, `_pageVisibility`), новый `src/vacuum-view.ts`, `src/live-viewport.ts` (`inheritedSceneClip` + ветка в `paintLiveViewport`), тесты (`test/live-viewport.test.mjs`, новый `test/vacuum-view.test.mjs`), новый native-смок `demo/smoke_vacuum_camera.mjs`, `scripts/mutation-registry.mjs` (4 новых мутанта), `scripts/smoke-links.mjs`, `scripts/monolith-baseline.json` (только `bundleBytes`), документация (VACUUM/CANVAS/ARCHITECTURE/DEVELOPMENT/TESTING/STATUS/CHANGELOG×2), `docs/release-ledger/v1.80.1/871.json`. Соответствует заявленному скоупу ТЗ; за его пределы диффа не выходит (geometry/calibration/vacuum.ts/vacuum-routes.ts/trails.py/i18n не тронуты).

## Риск по изменённым участкам (#707) — покрытие AC

- **live-viewport (touch)**: `inheritedSceneClip`/ветка `data-hp-live-inherited-scene` в `paintLiveViewport` — контракт AC2/AC6/AC9 ТЗ, зафиксирован в `docs/CANVAS.md` §5 и `docs/ARCHITECTURE.md` («The vacuum SVG is a passive exception…»); touch-паритет доказан native-смоком (CDP touch/pinch в обоих режимах View/kiosk).
- **devices (vacuum\*)**: весь `src/vacuum-view.ts` — AC3 (unit, `test/vacuum-view.test.mjs`) и AC4 (native, multi-robot/integration/server/local/floor-retirement в `smoke_vacuum_camera.mjs`), контракт в `docs/VACUUM.md` «Camera attachment (#871)».
- **perf (`getBoundingClientRect`)**: AC5 — бюджет 100 мс/15%, один RAF, bounded paint window, отсутствие full render per move; измерено тем же native-смоком (`noRenderPerMove`, `singleVacuumRaf`, `boundedPaintWindow`) и зафиксировано в `docs/DEVELOPMENT.md`/`docs/TESTING.md`.

Все три класса покрыты документом/AC — `route: fix` обоснован (трек `ask`, маршрут `reclassify` здесь неприменим).

## Как проверялось

Validate на точном SHA материала зелёный (run 38432478767) — `tsc`/`npm test`/`npm run build` не перегонялись. Моя часть — то, что Validate не покрывает: смоки по диффу, AC-защита мутантами (с личным воспроизведением красного), чтение логики.

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` | Не перегонял | Зелёный Validate на этом SHA (ссылка выше), §8 разрешает не повторять |
| `node scripts/smoke-select.mjs --base ece52121..  --head 742794c4` | Выполнил | Прямое совпадение: новый `smoke_vacuum_camera.mjs` + 11 несвязанных по сути `_stageEl`-смоков (шумовое совпадение на удалённой строке, не прогонял — связь не по существу изменения); зарегистрированная связь: `smoke_live_pan_coverage.mjs`, `smoke_live_pan_viewbox.mjs`, `smoke_vacuum_multifloor.mjs` |
| `node demo/smoke_vacuum_camera.mjs` (AC1/2/4/5/6) | Прогнал сам, PASS | 152/152 assertions, `OK`; до этого требовался `node scripts/bundle-sync.mjs` после моего `npm run build` — без него смок падал на `Failed to fetch dynamically imported module` (ожидаемо, не дефект задачи) |
| `node demo/smoke_vacuum_multifloor.mjs` | Прогнал сам, PASS | `OK` |
| `node demo/smoke_live_pan_viewbox.mjs` | Прогнал сам, PASS | `OK`, `worstParityPx: 0` |
| `node demo/smoke_live_pan_coverage.mjs` | Прогнал сам, PASS | `OK` |
| `node --test --test-name-pattern="#871" test/live-viewport.test.mjs test/vacuum-view.test.mjs` | Прогнал сам, PASS | 5/5 (после `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`) |
| Мутант `vacuum-trail-double-camera-owner` (AC1, «чем краснеет») | Применил вручную, подтвердил красный | `data-hp-live-inherited-scene="camera"` → `data-hp-live-viewbox="camera"`, пересобрал бандл: `smoke_vacuum_camera.mjs` падает на `*:landmarks`/`*:noDoubleCamera` во всех 24 сценариях — именно воспроизведённый старый баг |
| Мутант `vacuum-tip-runtime-skips-current-matrix` (AC2) | Применил вручную, подтвердил красный | Запись сырых экранных координат вместо `vacuumScreenPoint(...)`: `*:tips` падает во всех View-сценариях |
| Мутант `vacuum-screen-inverse-keeps-stale-origin` (AC3) | Применил вручную, подтвердил красный | `px = x - e, py = y - f` → `px = x, py = y`: 3 из 4 тестов `vacuum-view.test.mjs` падают |
| Мутант `vacuum-inherited-paint-window-unbounded` (AC5) | Применил вручную, подтвердил красный | `inheritedSceneClip(...)` → `"none"`: именованный `#871`-тест в `live-viewport.test.mjs` падает |
| `golden:verify` (ci:golden) | Не перегонял | Автор уже прогнал полный матрикс 205/205 PASS на этом же `buildFingerprint` (комментарий 2026-10-13T15:59:55Z), без изменения эталонов/порогов; `demo/golden/baselines/**` в диффе нет — перегонять незачем |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | Не перегонял | Прогнан автором, PASS; трейлеры и changelog проверил сам вручную (ниже) |
| AC6 (реальная GPU-приёмка владельца) | Не выполнял сам (не браузер) | Подтверждено отдельным сообщением владельца в issue (comment 6150345951, «Проверил — принимаю»), это не вывод из headless |

Чего не проверял: полный `npm run gate:small`/mutation execution (ночной прогон реестра, не гейт ревью на этом треке); 11 `_stageEl`-смоков из «прямого совпадения» smoke-select — совпадение по удалённой строке кода, не по изменённому поведению; Firefox/физический телефон (вне require ТЗ, только Chromium headless + CDP touch).

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- **Единственный владелец камеры.** `.vactrail` больше не получает `data-hp-live-viewbox="camera"` — только `data-hp-live-inherited-scene="camera"`; `paintLiveViewport` больше не пишет ему `viewBox`/`transform`, только bounded `clip-path` (`inheritedSceneClip`) вокруг бюджетного якоря. Устраняет двойную проекцию (причина №1) без потери ограничения растровой поверхности (`inset(-25%)`-семантика сохранена, числа проверены вручную: `inset(-0.5% 2.5% 25.5% 22.5%)` для тестового кадра сходятся с формулой).
- **Актуальная матрица для конца пути.** `syncVacuumTips`/`vacuumScreenPoint` в `src/vacuum-view.ts` берут текущий `getScreenCTM()` SVG вместо устаревшего `_vacLastView` (поле удалено). Read-before-write порядок подтверждён юнит-тестом (`order` в фикстуре) и моим прогоном. Guard на `null`/вырожденную/нефинитную матрицу и нулевой размер puck — корректен; крайний случай почти вырожденного, но не строго нулевого детерминанта (напр. `a: Number.MIN_VALUE`) не ловится явной проверкой `det === 0`, но естественно ловится финальным `Number.isFinite`-фильтром из-за переполнения — проверено на тестовых данных, не находка.
- **Жизненный цикл RAF.** `_vacRafLoop` останавливается на `hidden`/disconnect/отсутствии валидных пар и перезапускается на новом примонтированном DOM или возврате видимости (`_pageVisibility`) — подтверждено как юнит-тестом фикстуры, так и native-смоком (`hiddenStopsWrites`, `visibleRestarts`, `disposal`, `remountRecovers`, `oldFloorRetired`).
- **Трейлеры и changelog.** Один коммит, `Issue: #871`, `User-Visible: yes`; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены в этом же коммите, формулировки совпадают по смыслу.
- **Release-ledger.** `docs/release-ledger/v1.80.1/871.json`: `category: "stable-fix"` относительно актуального `baseStable: v1.80.1` (последний stable-тег, подтверждено `git tag`) — корректно, баг существовал в стабильной линии, а не внесён бетой; `rationale` и `introducedBy` не требуется (это не правка бета-функции).
- **Одно число — один источник (§8).** `bundleBytes` 2 806 821 упомянуто в `scripts/monolith-baseline.json` (единственный источник истины для гейта) и описательно в `docs/DEVELOPMENT.md` — числа совпадают, остальные поля baseline (`hostRefs`/`portPrivates`/`harnessPrivates`) не менялись, подтверждено диффом.
- **Мутанты.** Все 4 новых мутанта реестра воспроизводят именно исправленные причины (двойная камера, устаревшая матрица конца, отсутствие инверсии трансляции, неограниченное окно отрисовки) и лично мной проверены на красный результат названным guard-ом — колонка «чем краснеет» в ТЗ не пустая и подтверждена исполнением, а не доверием к тексту.
- **Не-скоуп соблюдён.** Диффом не тронуты `vacuum.ts`, `vacuum-routes.ts`, backend `trails.py`, калибровка/маршруты/сглаживание/i18n — подтверждено `git diff --stat`.

## Чего не проверял (сведено)

Полные `gate:small`, mutation execution и Firefox/физический телефон — вне объёма этого ревью по §8 (предрелизные гейты и ночной прогон реестра соответственно); реальная GPU-приёмка владельца принята как факт из issue, не повторялась мной руками.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/871-vacuum-camera-lock`, коммит `742794c4c817` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e58cc92a37da4fd3fdebd702b060d7e7bbdbac24`
  ```
  git log --all --format='%H %T' | grep e58cc92a37da
  ```
- Тело issue: `c693e5d1e0db21fb0e6f8487e3a856eef95c708816675dfe0b10c89c4a1daeb6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1ODAsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njh9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjg4LCJvdXRwdXRfdG9rZW5zIjozMTY3NywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMzEzOTQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo0ODAyMzYzLCJjb3N0VXNkRXN0aW1hdGUiOjEuODAyOTk0NjAwMDAwMDAwM31dLCJ0dXJucyI6NTUsImR1cmF0aW9uTXMiOjYxNjI1NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuODA3Njc0NjAwMDAwMDAwNCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4668 output_tokens=31697 cache_creation_input_tokens=131394 cache_read_input_tokens=4802363 num_turns=55 -->
