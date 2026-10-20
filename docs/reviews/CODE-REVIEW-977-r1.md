# CODE-REVIEW-977-r1

## Якоря материала

- Issue: #977 · этап `code` · заход r1 · трек `track:ask` · блокирующих циклов израсходовано 0 из 4
- Материал: ровно `ba83d02f68cc917c9e04b22b4be20f6ae5337a6c` (сверено `git rev-parse HEAD`), рабочая копия на нём, fetch/checkout не выполнялись
- Коммиты диапазона `origin/dev..HEAD`: `8b60cfd8f` (Issue #977, User-Visible: yes), `7be376ff2` (Issue #977, User-Visible: no), `ba83d02f6` (Issue #977, User-Visible: no, Release: v1.82.0-beta.3, Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/39449573965)
- Ревью ТЗ `docs/reviews/SPEC-REVIEW-977-r1.md` — зелёное, r1, 0/0. ТЗ в теле issue (решения владельца 1б/2а/3а + UX-дополнение) принято без изменений.
- `REVIEW_FINDINGS_POLICY`: `mode=issues` (доверенный снимок Actions-переменной). Побочных находок нет — новых issue не заводил.

## Скоуп ревью

Ручной выбор «Источника состояния значка» для обычной активности/пульсации маркера:
новое поле `marker.state_source` (entity_id + опциональный `active_states`),
общий resolver `src/marker-state-source.ts`, интеграция в
`resolvePresentationSources`/`resolveDevicePresentation`, редактор
(`src/editors/marker-state-source.ts`, `marker-dialog.ts`, `marker-form-state.ts`),
объясняющее превью (`hp-device-preview.ts`), серверная валидация
(`validation.py`, `const.py`, `config-schema.json`, `config-field-registry.mjs`),
golden-кадры standard/manual/unknown/protected RU+EN, i18n RU/EN/DE/FR, документация
(ARCHITECTURE/DEVICE-PRESENTATION/CONFIG-COMPATIBILITY/USER-GUIDE.ru/DEVELOPMENT/STATUS),
CHANGELOG RU+EN, release-ledger `v1.81.0/977.json` (classification `major`).

Работа закрывает J1/J2/J3/J6 из `docs/SCOPE.md`: уточняет индикацию «что сейчас
происходит» для составных устройств без изменения управления/безопасности.

## Как проверялось

Прочитаны один раз: `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
канон `PROCESS.md` по ссылкам §2.6–2.7, §3 п.10, §4, §7.2, §8, §12,
`docs/DEVICE-PRESENTATION.md` (канонический документ подсистемы),
`docs/USER-GUIDE.ru.md` (терминология), тело issue #977 целиком (ТЗ + решения
владельца), `docs/reviews/SPEC-REVIEW-977-r1.md`.

Прочитаны полностью все изменённые продуктовые файлы (не только диффы):
`src/marker-state-source.ts`, `src/device-presentation.ts` (изменённые hunks и
их контекст), `src/editors/marker-state-source.ts`, `src/editors/marker-dialog.ts`,
`src/editors/marker-form-state.ts`, `src/hp-device-preview.ts`,
`src/houseplan-editor-runtime.ts` (точки сохранения/загрузки черновика),
`src/render-snapshot-capture.ts` (risky hunk), `custom_components/houseplan/validation.py`
и `const.py` (risky hunk — миграция/граница валидации), `src/types.ts`,
`scripts/config-field-registry.mjs`, `scripts/config-schema.json`, все i18n-файлы
(en/ru/de/fr + settings/*), тесты `test/marker-state-source.test.mjs`,
`tests_backend/test_validation.py` (новые кейсы), `tests_backend/test_ha_backup_archive.py`,
`tests_backend/test_ha_import_export.py` (новые кейсы), `demo/smoke_marker_state_source.mjs`,
`demo/golden/harness.mjs`/`matrix.mjs` (новые сценарии), документация, changelog,
release-ledger, `scripts/mutation-registry.mjs` (новая запись).

### Риск по изменённым участкам (#707)

| Класс | Участок | Где AC покрывает |
|---|---|---|
| migration | `validation.py:967–990` (новый блок `state_source`), `const.py` (новый код ошибки) | AC4/AC10: структурная/семантическая валидация, lossless для нетронутых блоков, round-trip |
| perf | `render-snapshot-capture.ts:183–184` (трекинг выбранного sibling вне `d.entities`) | AC7/AC12: инкрементальная проекция равна полной, без лишнего реестрового скана |
| ux | 124 новых i18n-ключа (`marker.state_source*`, `marker.preview.state_source_*`, `backup.error.invalid_state_source`) RU/EN/DE/FR | AC11: без raw-ключей, парные формулировки |

Каждый класс покрыт конкретной строкой AC ТЗ (ниже, в таблице по AC). Повышения трека не требуется — `track:ask` уже максимальный.

## Гейты

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+bundle-policy | не перегонял | Validate на `ba83d02f6` зелёный: https://github.com/Matysh/houseplan-card/actions/runs/39453130872 |
| `npm run build` (локально, для golden/smoke) | прогнал | `created dist in 28.5s`, после — `npm run bundle:clean` вернул `dist/` и `custom_components/houseplan/frontend` к закоммиченному состоянию |
| `node --test test/marker-state-source.test.mjs` | прогнал | 8/8 pass |
| `node --test test/i18n.test.mjs test/i18n-dead-keys.test.mjs test/i18n-lazy-namespaces.test.mjs` | прогнал | 40/40 pass (парность RU/EN/DE/FR, нет мёртвых/sentinel-ключей) |
| `node --test test/dialog-baseline.test.mjs test/golden-matrix.test.mjs test/golden-scene-repaint.test.mjs` | прогнал | 73/73 pass |
| `demo/smoke_marker_state_source.mjs` (AC2/AC6/AC8/AC10/AC11, назван в плане автотестов ТЗ) | прогнал | OK, все 13 проверок true |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнал | 1 зарегистрированная связь: `demo/smoke_space_battery_policy.mjs` (#945); остальные — слабая связь через общее поле `_markerDialog` |
| `demo/smoke_space_battery_policy.mjs` (зарегистрированная связь) | прогнал | OK, все 10 проверок true |
| `golden` (визуальный риск — новые baseline-кадры рендера) | прогнал `--mode=capture --scenario=<id>` для всех 4 новых сцен (verify требует полную матрицу — предрелизный гейт) | все 4 `passed` против принятых baseline: `device-state-source-standard-en`, `device-state-source-manual-ru`, `device-state-source-unknown-en`, `device-state-source-protected-ru` (diff=792px, ratio≈0.00056 — фон стенда, не новый контент) |
| `pytest tests_backend -k issue977` | НЕ прогнал | в среде ревью нет `pytest`/`homeassistant` (не установлены, нет `.venv-backend`); покрыто цитированным зелёным Validate, где job «Бэкенд: pytest в Home Assistant» ставит `tests_backend/requirements.txt` и гоняет полный `tests_backend/` с реальным HA harness |
| `node scripts/mutation-registry.mjs --check` | прогнал | exit 0 — новая запись `icon-state-source-invalid-write-977` синтаксически корректна (patch find встречается ровно один раз); сама подмена **не исполнялась** — вне ночного workflow запрещено |
| `npm run invariants` (геометрия) | не прогонял | дифф не меняет геометрию/её ссылки — не применимо |
| performance | не прогонял | не назван в AC данного изменения; AC12 проверен операционным счётом в unit-тестах (кэш по identity реестра, O(1) ownership) и чтением |

## Находки

Находок нет: ни High, ни Medium, ни Low.

## Что проверено и корректно

- **AC1 (Авто/владение).** `resolveMarkerStateSource` возвращает `null` при
  `raw == null` — presentation идёт прежним путём без нового угадывания;
  загрузка черновика (`houseplan-editor-runtime.ts:7340`) берёт `marker?.state_source`
  без мутации при чтении; `markerStateSourceFields` (`marker-state-source.ts:149`)
  не пишет блок, если draft не тронут пользователем. Доказано unit-тестом
  `#977 Auto is identical…` (идентичность Auto/undefined/null) и backend
  `test_issue977_state_source_round_trip_and_structural_authority`.
- **AC2 (own-only, позиция, доступность).** `markerStateSourceCandidates`
  строит список строго по `device_id`, без имён/via_device/controls — доказано
  тестом `#977 own-device candidates never borrow…` и smoke
  (`ownOnly: true`). Позиция «сразу после “Способ отображения”» — отдельная
  проверка DOM в smoke (`sourceAfterDisplay: true`) и в golden-harness
  (навигация в раздел `appearance`). Поле — нативный `<select>` с aria-label
  на кнопках добавления/удаления состояний — клавиатура/screen reader не
  требуют новой модалки.
- **AC3 (стандартная логика).** Resolver переиспользует существующие
  `entityVisualSample`/`applianceLifecycleVisualSample`, не вводит
  параллельный список — доказано таблицей в
  `#977 standard domain/class/attribute/lifecycle semantics…` (binary_sensor
  running/occupancy, automation=on не working, climate hvac_action idle/heating,
  lifecycle sensor.operation_state).
- **AC4 (ручной список, точный OR).** Нормализация (trim/dedupe/регистр,
  запрет unknown/unavailable/CR-LF, 1–32×1–255) идентична на фронте
  (`normalizeMarkerStateSource`) и бэке (`validation.py`); unit и backend
  параметризованные тесты покрывают оба положительных и весь список
  отрицательных случаев (пусто, 33 элемента, 256 символов, `\n`, `unknown`,
  boolean-элемент). «Чем краснеет»: прямые `assert.equal(..., null)` в
  `test/marker-state-source.test.mjs` и `pytest.raises(MarkerControlError)` в
  `test_validation.py` — обычные отрицательные кейсы, не мутанты (проверено
  чтением и выполнением обоих наборов).
- **AC5 (приоритеты/защищённые роли).** `protectedFace` вычисляется из уже
  разрешённой роли (`visualSources`/`sourceKind==='cover'`), а не из
  произвольного sibling — доказано тестом, где случайный `cover.unrelated` в
  `d.entities` НЕ включает protected-режим. На защищённом лице override не
  применяется (`resolvePresentationSources`: `if (stateSource && !protectedFace)`),
  поле в редакторе `disabled` и подпись «Авто — специальное состояние»
  (строка `marker.state_source_special`). Критический sibling остаётся
  critical даже при явном ручном nonmatch (тест `an own selected critical
  sibling cannot be demoted…`).
- **AC6 (отсутствие данных).** `failure` — отдельное поле, не путается с
  «известно неактивен»; `missing`/`foreign`/`disabled`/`virtual` проверены
  тестом с `Object.defineProperty(..., { get() { throw … } })` — ловушкой,
  доказывающей, что чужое/виртуальное состояние физически не читается (не
  просто «тест прошёл», а структурная невозможность прочитать). `unknown`
  отдельно не триггерит Auto-fallback — подтверждено unit и smoke
  (`unknownNoFallback: true`, `unknownExplained: true` для RU и EN).
- **AC7 (кадр/инвалидация).** `render-snapshot-capture.ts` включает выбранный
  sibling, если он не в функциональном `d.entities`, в `entityIds` только при
  отсутствии failure или при `unknown` (чтобы отслеживать восстановление) —
  проверено тестом `#977 chosen diagnostic outside d.entities…`: atribute-only
  тик (`hvac_action`) и registry-only переезд (`device_id` смена → `foreign`)
  дают одинаковый результат full vs incremental capture.
- **AC8 (единый resolver, превью).** `_sourceSummary`/`_stateSummary`/
  `_stateSourceExplanation` в `hp-device-preview.ts` используют поля,
  вычисленные resolver'ом (`sample`, `failure`, `explicitStates`), UI не
  считает свой `isActive`. Golden-кадры standard/manual/unknown/protected
  RU+EN приняты (`Baseline-Reviewed` + сам прогнал `--mode=capture` для всех
  четырёх сцен — совпадают с принятым baseline в пределах фонового шума
  рендера). Smoke подтверждает одинаковый результат на плане и в
  `houseplan-space-card` (`planStaticParity: true`).
- **AC9 (неизменность соседних поверхностей).** Тест сравнивает
  `icon/lightColor/valueText/valueBadge/battery/lqiText/rippleColor` между
  ручным источником и Auto (идентичны), `resolveToggleIntent` и
  `resolvedLightSources` тоже идентичны — override не достаёт до
  действия/света.
- **AC10 (сохранение/округление).** Save гейтится `markerProblems`
  (`marker-form-state.ts`) и прямой проверкой в `_saveMarker`; backend-тесты
  доказывают full/space/ZIP round-trip с сохранением `future`-ключей и то, что
  `plan_only`-экспорт не содержит чужой entity_id. Smoke подтверждает реальное
  сохранение через форму (`saved: true`) и что явный возврат в «Авто» убирает
  ключ (`autoClears: true`).
- **AC11 (i18n/touch).** 4 языка параллельны (en/ru/de/fr), без raw-ключей в
  тексте превью (данные — entity name/state, не ключи); i18n parity suite
  зелёный; поле доступно touch (нативный select, inline-кнопки без
  hover-only).
- **AC12 (бюджеты).** `markerStateSourceCandidates` кэширует индекс по
  identity реестра (`WeakMap`), `stateSourceOwnership` — O(1) без скана;
  `scripts/monolith-baseline.json` `bundleBytes` обновлён легитимно
  (+19 482 байт в пределах ratchet-механизма, тот же коммит); Validate
  подтвердил сборку/типы в пределах budget-гейтов.
- Трейлеры корректны: `Issue: #977` на всех трёх коммитах; `User-Visible: yes`
  на `8b60cfd8f` — оба CHANGELOG правлены в том же коммите; `Release:
  v1.82.0-beta.3` + `Baseline-Reviewed: <run URL>` на коммите, трогающем
  `demo/golden/baselines/**`.
- Одно число — один источник: предел `32` состояний и `255` символов задан
  константами `STATE_SOURCE_MAX_STATES`/`STATE_SOURCE_MAX_LENGTH` на фронте и
  литералами `32`/`255` в `validation.py` — два места, но единственный
  источник истины по ТЗ — `validation.py` (п. «Модель данных»); фронтовые
  константы точно совпадают (32/255) и покрыты параметризованным тестом на
  обеих сторонах, расхождения нет.
- `docs/release-ledger/v1.81.0/977.json`: классификация `major` с явным
  обоснованием («No such user override existed in v1.81.0») — соответствует
  требованию ТЗ («новая пользовательская возможность, не исправление»), не
  инфраструктура и не internal-beta fix.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build`+bundle-policy —
  переиспользован зелёный Validate на этом же SHA (см. таблицу гейтов); сам
  `npm run build` прогнал отдельно для golden/smoke и откатил `dist/` через
  `npm run bundle:clean`.
- `pytest tests_backend -k issue977` своими руками — в среде ревью нет
  Python-зависимостей/HA harness; доверился цитированному Validate, где
  бэкенд-job ставит `tests_backend/requirements.txt` и явно проверяет, что
  `test_ha_*` не возвращает `0 collected`.
- Полная golden-матрица (`golden:verify`) — инструмент сам отказывается
  принимать `--scenario` в режиме verify («предрелизный гейт, а не гейт
  ревью»); вместо этого прогнал `--mode=capture` для всех 4 новых сцен и
  сверил результат с принятым baseline (все `passed`).
- Инварианты геометрии — дифф не меняет геометрию/ссылки на неё, гейт не
  применим.
- Performance-бенчмарки — не названы в AC этого изменения; возможное влияние
  оценено операционными unit-тестами (кэш по identity, без скана на кадр) и
  обновлённым `bundleBytes`-ratchet.
- Ручная dev/GPU-приёмка владельцем — не требуется для вердикта (#929);
  headless golden — не замена, но и не обязанность ревьюера.
- Мутационный прогон `icon-state-source-invalid-write-977` — только
  статический `--check` (exit 0, патч синтаксически корректен и ложится один
  раз); фактическое исполнение подмены запрещено вне ночного workflow,
  включая ревьюера. Защитные AC4/AC10 на этом свидетеле помечены «не
  исполнялся», доказательство «чем краснеет» для них дополнительно закрыто
  обычными отрицательными unit/pytest-кейсами (см. выше), которые я выполнил.

## Побочные находки

Побочных находок нет (policy `mode=issues`, новых issue не заводил).

## Маршрут

`route: fix` (не `show`, повышение/понижение трека не применимо — `track:ask`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/977-icon-state-source`, коммит `ba83d02f68cc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `135935f0c98dcf569855cdfc38628874aed5349b`
  ```
  git log --all --format='%H %T' | grep 135935f0c98d
  ```
- Тело issue: `ff7155f86281175454ceca341a073d71cebefc8c50c7b3bc139fc6dd9dd89df4`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNDcsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjQ3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNzIsIm91dHB1dF90b2tlbnMiOjQwNjYxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE4MDk4MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjExMDEzODUyLCJjb3N0VXNkRXN0aW1hdGUiOjMuMzMzNjUyNDAwMDAwMDAwNX1dLCJ0dXJucyI6MTAwLCJkdXJhdGlvbk1zIjo3MTYxMDcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjozLjMzODg5OTQwMDAwMDAwMDMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5319 output_tokens=40681 cache_creation_input_tokens=180982 cache_read_input_tokens=11013852 num_turns=100 -->
