# CODE-REVIEW-918-r1

**Issue:** #918 «Пылесос движется на плане без следа: сохранённые точки не доходят до отображения»
**Трек:** ask · **Этап:** code · **Заход:** r1 · блокирующих циклов израсходовано 0/4
**Материал:** `a06be4e56510cee07860ccc5a803ba129ae03dd8` (ветка `issue/918-vacuum-trail`, база `origin/dev@9ace68b0`)
**Коммит:** один, `fix(vacuum): restore routed trails and server history on open`, трейлеры `Issue: #918`, `User-Visible: yes` — корректны; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены в этом же коммите.

## Скоуп

ТЗ (зелёный SPEC-REVIEW-918-r1) требует: единый выбор владельца текущей записи при явных `map_routes` по точной паре `source + map_id`; защиту текущего прогона от чужих событий; безопасный переход orphan→identified run с новым поколением; автоматическое восстановление записи без визита в редактор; согласованные координаты/матрицу/значок/tip/diagnostics с одного источника; сохранение границы доверия `1` ≠ `Map 1`; защиту native/истории; согласованность режимов и диагностику причины отсутствия пути (AC1–AC8).

Риск по изменённым участкам (#707), сверка с ТЗ:
- **devices** (`custom_components/houseplan/trails.py`, `vacuum_routes.py`): покрыт AC1, AC2, AC3, AC7 — единый владелец записи, lifecycle чужих событий, orphan-переход, native/teardown.
- **perf** (`src/render-device-snapshot.ts`, `src/render-snapshot-capture.ts`): покрыт AC4/AC8 — один источник фактов на кадр (`host._vacRuntimeSource`), инвалидация замороженного снапшота при обновлении серверной книги маршрутов (мутант `vacuum-server-event-keeps-old-render-snapshot`).
- **ux** (новые ключи `vac.diag_trail_display`, `vac.trail_display_*` в `en/ru/de/fr.json`): покрыт AC6, UX-раздел ТЗ и `docs/USER-GUIDE{,.ru}.md`.

Все три класса закрыты поименованными AC — повышение трека не требуется.

## Как проверялось

Дешёвые гейты подтверждены на этом точном SHA воркфлоу «Проверка (CI)» — `gh run view 39021574007` (`headSha == a06be4e5...`, `conclusion: success`), с разбивкой по джобам:

| Джоб | Результат |
|---|---|
| Предполёт: документация, провенанс, процесс | success |
| Фронтенд: типы, юниты, мутанты, синхрон бандла (typecheck + `npm test` + bundle-sync) | success |
| Бэкенд: pytest в Home Assistant (реальный HA, не pure-subset) | success |
| Смоки в браузере (3/3 шарда, включая новый `smoke_vacuum_route_recovery.mjs`) | success |
| Перф-смок: бюджет времени кадра | success |
| Golden-кадры против принятых эталонов (`ci:golden`) | success |
| Мутанты по диффу / Геометрия TS/Python parity | skipped — ожидаемо: исполнение мутантов нигде в разработке не идёт (#709), геометрия калибровки/сглаживания не менялась |

Это закрывает `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle:verify`, `pytest tests_backend` (включая `test_ha_*`), полный demo-smoke набор и `golden:verify` — повторный прогон не требовался (§8, «дешёвые гейты уже подтверждены»).

Дополнительно самостоятельно выполнено в эту сессию:
- `node scripts/mutation-gate.mjs --check` → `ok` для всех 1638 определений, включая 5 новых (`vacuum-server-event-keeps-old-render-snapshot`, `vacuum-route-owner-borrows-root-coordinates`, `vacuum-format2-rejected-run-uses-local-path`, `vacuum-recorder-foreign-source-writes-current`, `vacuum-mixed-identity-promotes-orphan`) и 3 переиспользованных из прежних issue (`vacuum-native-late-delete-resurrects-run`, `vacuum-route-ambiguity-takes-the-first`, `vacuum-empty-routes-revive-legacy-frontend`) — все патчи статически находят свою уникальную строку в текущем коде, регистрация не протухла.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` → 43 direct + 3 registered = 46, совпадает с заявленными автором «46/46»; `smoke_vacuum_route_recovery.mjs` — в direct по `_vacRt/_vacSrvTrails/_vacTrailFormat`. `smoke_vacuum_multifloor.mjs` не входит в выборку, но назван в ТЗ как целевой и прогнан автором отдельно — корректно.
- Чтение полного диффа (2311 строк) построчно: `custom_components/houseplan/trails.py`, `vacuum_routes.py`, `src/vacuum-runtime-source.ts` (новый модуль), `src/vacuum-trail-material.ts`, `src/vacuum-trail-diagnostics.ts`, `src/houseplan-card.ts`, `src/render-snapshot-capture.ts`, `src/render-device-snapshot.ts`, все тестовые файлы (TS unit, Python unit/HA, browser smoke), i18n, документация, release-ledger.
- Прослежена построчно логика `same_run_identity`/`ensure_run`/`_sample`/`_recording_route`/`_current_route_source`/`_accept_path` против всех их тестовых случаев (`test_same_run_identity_contract`, `test_issue918_*` в `test_trail_recorder.py`/`test_trails.py`/`test_ha_vacuum_paths.py`) — расчётные результаты совпали с ожиданиями тестов во всех прослеженных ветвях (включая ambiguous/wrong_map/empty/unavailable, owner-source-loss-and-recovery, orphan rotation, late native callback после смены route/teardown).
- Прослежена логика `resolveVacuumRuntimeSource`/`resolveRoute` (TS и Python mirror) на новых fixtures `test/fixtures/vacuum-routes/resolve.json` и `test/vacuum-routes.test.mjs` — детерминированный выбор fallback/ambiguous независимо от порядка маршрутов подтверждён и чтением, и фикстурами.
- Сверены трейлеры коммита, оба changelog, `docs/release-ledger/v1.81.0/918.json` (категория `stable-fix` относительно 1.81.0, без `introducedBy` — обоснованно: дефект относится к уже выпущенной 1.81.0, а не к текущей бете).

## Находки

Находок нет (High: 0, Medium: 0, Low: 0).

Побочных находок нет (`REVIEW_FINDINGS_POLICY`: `mode=issues`, новых issue не заводилось).

## Что проверено и корректно

- **AC1/AC2 (один владелец, чужое событие не портит путь).** `TrailRecorder._sample` для `explicit_route_markers` резолвит владельца через `_recording_route` (across all exact available route sources, не по порядку событий); события источника, который не является резолвленным владельцем, полностью игнорируются (`continue` без побочных эффектов), что подтверждено `test_issue918_foreign_source_cannot_change_current_lifecycle_or_native_context` и реальным HA-тестом `test_issue918_exact_owner_recovers_and_survives_real_ha_store_restart` (unrelated root → `unchanged_by_root`/`before_root == data`).
- **AC3 (безопасный переход orphan→identified).** `same_run_identity` строго разделяет routed/unrouted (новая сигнатура с `source`/`legacy`); при появлении точного маршрута `ensure_run` создаёт новое поколение, старый прогон уходит в `previous` без приписывания route_id задним числом — прослежено построчно и подтверждено `test_issue918_orphan_rotation_never_promotes_or_joins_old_points` и `test_issue918_route_recovers_from_orphan_without_root_points_in_either_event_order` (оба порядка событий, оба варианта одинакового/разного map_id).
- **AC4 (согласованное отображение).** Новый `src/vacuum-runtime-source.ts` — единая точка выбора `source/mapId/telemetry/resolution` для tick-рантайма (`_vacRuntimeSource`), снапшота (`render-snapshot-capture.ts`) и диагностики (`vacuum-trail-diagnostics.ts`); устраняет ранее дублированный расчёт `effectiveRoutes/resolveRoute` в трёх местах. Мутант `vacuum-route-owner-borrows-root-coordinates` целится ровно в прежний баг («root одолжил координаты чужому маршруту»).
- **AC5 (граница доверия).** `test/vacuum-routes.test.mjs` — пять новых тестов на `resolveVacuumRuntimeSource`: равный map_id у разных камер не склеивается, `map_routes: []` не возрождает legacy-калибровку, отсутствие калибровки не меняет источник, legacy-only конфигурация сохраняет свой маршрут. Python-зеркало `test_issue918_recording_owner_is_exact_unique_and_independent_of_paint` подтверждает то же на бэкенде.
- **AC6 (диагностика причины).** `routeDisplayReason`/`modeDisplayReason` в `vacuum-trail-diagnostics.ts` реализуют заявленный в ТЗ приоритет (режим/остановка → источник/маршрут → пространство → принадлежность run → фрагменты → видим); `test/vacuum-trail-diagnostics.test.mjs` перебирает все 12 причин и явно проверяет, что счётчики raw/stored не меняются защитными ветками (не маскируются). Строки RU/EN проверены через реальный `renderVacuumPathDiagnostics`/`t()`, без «сырых» ключей.
- **AC7 (native/teardown).** `test_ha_vacuum_paths.py::test_issue918_exact_owner_recovers_and_survives_real_ha_store_restart` — реальный Store/restart, поздний `_accept_path` после teardown не меняет сохранённые данные; поколение сохраняется через рестарт.
- **AC8 (режимы, format-2 защита, «одно число — один источник»).** `currentVacuumTrailFrame()` — общая функция для View и диагностики (один `frame.count`, нет второго независимого расчёта «нарисовано»). Browser smoke `smoke_vacuum_route_recovery.mjs` строит реальный локальный буфер (`legacyLocalBufferActuallyExists` ≥ 3 точек) и проверяет, что отклонённый format-2 run его не использует (`format2CannotBypassRejectedRun`) — негативный случай не вырожденный.
- Мутационная таблица автора (AC→свидетель) по каждому защитному AC заполнена: либо обычный исполненный отрицательный тест, либо названный id зарегистрированного (статически валидного) свидетеля с честным «не исполнялся» — пустых третьих столбцов нет.
- Release-ledger, оба changelog, `docs/VACUUM.md`/`ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`/`USER-GUIDE{,.ru}.md` согласованно описывают новое поведение; терминология («Отображение пути» / «Path display») соответствует добавленным ключам i18n.
- Bundle budget поднят только по `bundleBytes` (+4241 байт, 0.14%) с явным обоснованием (новая строка диагностики × 8 ключей × 4 языка + вынесенный из монолита модуль); `npm run bundle:budget` проходит, прочие пороги не менялись.

## Чего не проверял

- Не выполнял сам полный `npm test`/`pytest tests_backend`/`npm run build`/`golden:verify`/demo-smoke набор — они уже зелёные на этом точном SHA в workflow run 39021574007 (подтверждено `gh run view` по `headSha`), повторный прогон экономически не нужен (§8).
- Не запускал исполнение зарегистрированных мутантов (включая 5 новых) — это ночная обязанность (#709), не гейт этого ревью; статической валидностью (`mutation-gate --check` → `ok`) ограничился.
- Не выполнял ручную/GPU-приёмку на реальном Home Assistant/реальном пылесосе dreame.vacuum.p2029 — она добровольна и не является находкой (#929); все доказательства — автоматические (реальный HA Store/event loop в pytest, headless Chromium в demo-smoke).
- Не проверял лингвистическое качество переводов `de.json`/`fr.json` за пределами структурного совпадения набора ключей с `en/ru` — содержательная проверка DE/FR не требуется процессом.
- Не проверял инварианты геометрии модели (`npm run invariants`) — дифф не меняет формулы калибровки/сглаживания/проекции, только то, какой источник их применяет; гейт неприменим.

## Вердикт

Зелёный. AC1–AC8 выполнены и доказаны по канону (автотест + подтверждённая способность упасть, либо чтение с явной пометкой), оба класса риска из тройки devices/perf/ux закрыты именованными AC, дешёвые гейты зелены на материале, трейлеры и релизные артефакты корректны. Цикл не открывается.

route: fix

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/918-vacuum-trail`, коммит `a06be4e56510` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f17c41689020ba75debea5d2d5a7551142cc4523`
  ```
  git log --all --format='%H %T' | grep f17c41689020
  ```
- Тело issue: `fd3d559a03b8ddf131bb9216a965f5588e676c238c3724dade036640c69ac920`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyNDEsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzI2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4OCwib3V0cHV0X3Rva2VucyI6MzcxNjksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTkwMTQ1LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NTQyMTIzOSwiY29zdFVzZEVzdGltYXRlIjoyLjIxNjY5Mzc5OTk5OTk5OTR9XSwidHVybnMiOjUwLCJkdXJhdGlvbk1zIjo0MzE1MzQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjIyMjAxOTc5OTk5OTk5OTUsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5329 output_tokens=37186 cache_creation_input_tokens=190145 cache_read_input_tokens=5421239 num_turns=50 -->
