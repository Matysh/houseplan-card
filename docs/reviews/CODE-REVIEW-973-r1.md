# CODE-REVIEW-973-r1

Issue: #973 «Бэкапы: безопасное восстановление устаревших связей при импорте и проверка при экспорте»
Трек: ask · Этап: code · Заход: r1 · блокирующих циклов использовано 0/4
Материал: `git diff origin/dev...HEAD`, HEAD = `ec635a6d7d1fb0cdf856ed88f6648bdca37e09bd` (ветка `issue/973-import-orphan-radar`, remote tip совпадает).
ТЗ: тело issue #973, SPEC-REVIEW-973-r1 — зелёный (High 0 / Medium 0).

## Скоуп

31 изменённый файл: новый модуль `custom_components/houseplan/portable_recovery.py`
(общий copy-only recovery helper), интеграция в `import_export.py`
(`create_export`, `build_space_merge`, `_materialize_import_candidate`,
`create_preview`, `revalidate_candidate`), точечные флаги допуска в
`radar_validation.py`/`validation.py` (`allow_inactive_spatial_refs`,
`allow_inactive_missing_space`), поверхность отчёта в `backup_service.py`/
`websocket_api.py`, клиент (`backup-archive-client.ts` — новый `RecoveryReport`,
`renderRecoveryReport`, consent-флаг `preparedJson`), 4 локали tools-i18n,
synthetic/HA backend тесты, native smoke, changelog×2, ledger, канонические
документы (ARCHITECTURE/CONFIG-COMPATIBILITY/DEVELOPMENT/STATUS/USER-GUIDE×2).

Классы риска по §707: **migration** (import_export.py — общий контракт
восстановления), **devices** (websocket_api.py:645 — поверхность отчёта в
export-ответе), **ux** (новые tools-ключи backup.recovery.*). Все три
проверены построчно ниже.

## Как проверялось

Повторного раунда нет (r1), контекст не наследуется. Прочитаны целиком:
`portable_recovery.py` (241 строк), диффы `import_export.py` (167 строк),
`radar_validation.py`/`validation.py`, `websocket_api.py`/`backup_service.py`,
`backup-archive-client.ts`, все i18n-диффы, `docs/CONFIG-COMPATIBILITY.md`/
`ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md`/`USER-GUIDE(.ru).md`,
`CHANGELOG(.ru).md`, `docs/release-ledger/v1.81.0/973.json`,
`scripts/mutation-registry.mjs`, `scripts/monolith-baseline.json`,
`docs/data-hp-contract.json`. Прочитаны и прослежены по коду ключевые тесты:
`tests_backend/test_portable_recovery.py` (весь файл),
`tests_backend/test_ha_portable_recovery.py` (весь файл), целевые диффы
`test_ha_import_export.py`, `test/backup-archive-client.test.mjs`,
`demo/smoke_portable_recovery.mjs`.

### Гейты

| Гейт | Статус | Как подтверждён |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | не перегонялся | Validate на точном SHA `ec635a6d7` зелёный: https://github.com/Matysh/houseplan-card/actions/runs/39391690771 (#343) |
| `pytest tests_backend/` (реальный HA) | не перегонялся лично | тот же Validate-run, джоба «Бэкенд: pytest в Home Assistant» — success на этом SHA; покрывает новые `test_portable_recovery.py`/`test_ha_portable_recovery.py`/изменённый `test_ha_import_export.py` |
| Ruff | не перегонялся | заявлен автором в handoff (PASS); не является блокирующим гейтом ревью на `ask` без признаков линт-нарушений при чтении |
| `smoke-select.mjs --base origin/dev --head HEAD` | выполнен мной лично | прямое совпадение: `smoke_backup_archive`, `smoke_backup_transfer`, `smoke_settings_navigation`, `smoke_space_card`; зарегистрированная связь: `smoke_config_authority`, `smoke_empty_backup_import` — все 6 автор прогнал локально, PASS (см. handoff) |
| Именованный в AC6 `smoke_portable_recovery` | не перегонялся лично | заявлен автором, PASS, 4 oracle (локали/360px/инъекция/Apply-timing/export-consent) — код смока прочитан целиком, видно, что он реально проверяет HTML-инъекцию (`[data-recovery-injection]` count 0 + `<img ...>` как литеральный текст), horizontal scroll, порядок Apply/export-consent |
| `golden:verify` | не требуется и не прогонялся | нет `ci:golden`, путь отрисовки плана не затронут диффом (подтверждено построчно — изменения только backend/i18n/client-report) |
| `npm run invariants` | не требуется | диффом не меняется геометрия/ссылки на неё — геометрические валидаторы (`commit_wall_segment_model` и т.д.) не тронуты, только допуски radar/vacuum/controls на уровне transfer |
| Мутанты (execution) | не запускались | политика: не запускаются на разработке/ревью, только ночь. Зарегистрирован `portable-recovery-weakens-ordinary-radar-validation-973` со статусом «не исполнялся» — корректно, не заявлен как caught |
| Ручной приватный архив (AC1) | не воспроизводился мной (файл не публикуется) | автор дал формат, запрошенный на spec-ревью: команда + before/after (`spaces=1 rooms=8 markers=86`, `invalid_config` → `PASS`, SHA256 исходника не изменился, `LIVE_HA_WRITES: 0`) — принимается как разбор по коду + автором предоставленная трасса, формат соответствует требованию SPEC-REVIEW-973-r1 |

Чего не проверял: не запускал ни одной команды из таблицы лично (ограничился
чтением кода/тестов и верификацией зелёного Validate+pytest-джобы на точном
материале через `gh run view`); Ruff не перепроверял; реальный Windows/HA
окружения не поднимал.

## AC → разбор

| AC | Статус | Основание |
|---|---|---|
| AC1 | проверено чтением + авторский пруф | `tests_backend/test_ha_portable_recovery.py::test_native_wire_fixture_is_real_backend_recovery_not_an_invented_success` перечитывает реальные ZIP-байты backend'ом (не mock); приватный ZIP — формат пруфа соответствует требованию spec-ревью |
| AC2 | автотест, падает корректно | `test_portable_recovery.py` покрывает каждую строку таблицы отдельно (`test_radar_is_inert_without_losing_spatial_setup` — 5 параметров problem × 2 enabled, `test_vacuum_keeps_all_maps_and_matrices_without_guessing_a_floor`, `test_controls_retain_document_order_and_break_only_unusable_edges`, `test_dependent_values_use_existing_neutral_formats`); идемпотентность проверена в тех же тестах (повторный прогон не меняет документ) |
| AC3 | автотест | `test_valid_config_and_temporarily_absent_entities_remain_literal`, `test_space_export_does_not_validate_excluded_devices_and_plan_only_stays_private`, `test_space_duplicate_policy_does_not_repair_existing_target_or_report_removed_radars` |
| AC4 (защитный) | автотест + реальный HA | `test_real_archive_export_report_apply_inert_runtime_and_undo`: после Apply `radar_coordinator.radars == {}`, нет `_unsub_sources`, `trail_recorder.pairs == {}`/`routes_by_marker == {}`; Undo восстанавливает исходный `radar`-блок байт-в-байт. Нормальная строгая проверка подтверждена переименованным `test_full_preview_repairs_self_and_cycle_but_ordinary_write_stays_strict` (обычный `validate_marker_controls` без transfer-контекста по-прежнему кидает `marker_control_self`/`marker_control_cycle`) |
| AC5 | автотест | `test_export_repairs_only_a_copy_and_the_actual_document_imports_on_empty_setup`: исходный `cfg` не меняется (`assert cfg == before`), экспортированный документ реально проходит `create_preview`→`prepare_apply` на пустой установке; в `create_export` добавлен прямой dry-run через `_materialize_import_candidate` на пустом target до выдачи файла (строки 648-658) |
| AC6 (защитный, UX) | native smoke, код прочитан | `demo/smoke_portable_recovery.mjs`: HTML-подобное имя не создаёт `<img>` (`data-recovery-injection` count 0, текст остаётся литеральным), 4 локали + 360px без horizontal scroll, Apply не вызывается до явного подтверждения (`previewAndCancelNeverApply`), export не скачивается до согласия и скачивает именно подготовленный ZIP (`exportConsentDownloadsFrozenActualZip`) |
| AC7 (защитный) | автотест, негативный случай исполнен | `test_preview_revalidate_and_apply_use_the_same_recovery_not_source_mutation`: после ручной порчи `candidate["details"]["recovery"]["total"] += 1` — `prepare_apply` кидает `ImportFailure` с `"changed"` (реально исполненный негативный случай, не просто registry-запись); `test_forged_report_cannot_authorize_active_broken_radar` — исторический `transfer.recovery` из файла полностью игнорируется и пересчитывается заново |
| AC8 (защитный) | автотест + registered witness | Полный HA suite (структурные/ACL/quotas проверки не тронуты диффом, кроме точечных `allow_*` флагов по умолчанию `False`); дополнительно зарегистрирован мутант `portable-recovery-weakens-ordinary-radar-validation-973` на случай, если `allow_inactive_spatial_refs` просочится в обычный путь — статус честно «не исполнялся» |

Защитный AC · чем доказан · чем краснеет (явная таблица, §2.7):

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC4 | `test_real_archive_export_report_apply_inert_runtime_and_undo` (реальный HA) | Исполненный тест: без патча radar_coordinator пуст после Apply; obычный (non-transfer) `validate_marker_radars`/`validate_marker_controls` по-прежнему строгие — проверено в том же наборе |
| AC7 | `test_preview_revalidate_and_apply_use_the_same_recovery_not_source_mutation` | Исполненный негативный случай: подмена `details.recovery.total` → `ImportFailure("...changed...")` |
| AC8 | HA suite + registered witness | id `portable-recovery-weakens-ordinary-radar-validation-973`, «не исполнялся» (честно, не заявлен caught) |

Пустых третьих столбцов нет.

## Разбор рискованных участков (§707)

- **migration** (`import_export.py`): новая общая точка входа
  `prepare_portable_markers` заменяет собой три прежних самостоятельных пути
  (`_drop_invalid_import_marker_links` удалён целиком, 70 строк). Проверено,
  что старое поведение «self-link сохраняется, чтобы `validate_marker_controls`
  кинул `marker_control_self`» сознательно заменено новым контрактом
  (self/cycle теперь безопасно снимаются в переносимой копии) — это прямо
  предписано таблицей ТЗ, и обычный (non-transfer) путь остаётся строгим
  (отдельно протестировано). Разделение `document` (неизменный исходник) и
  `target_config` (материализованный кандидат) подтверждено тестом
  (`candidate["document"]...["markers"] == markers`, т.е. исходный файл не
  редактируется) — это новая гарантия по сравнению с прежней архитектурой, где
  recovery мутировал тот же объект, что лежал в `document`.
- **devices** (`websocket_api.py:645`): `ws_export_create` добавляет
  необязательный ключ `recovery` в ответ, только когда отчёт непустой —
  обратной совместимости не нарушает (старый клиент просто не читает ключ).
- **ux** (i18n tools): 10 заявленных в ТЗ ключей присутствуют во всех 4
  локалях (RU/EN/DE/FR); добавлен один незаявленный ключ
  `backup.recovery.details` («Show devices»/«Показать устройства») — подпись
  `<details><summary>` для раскрытия списка примеров. Это аддитивная, безвредная
  мелочь вне буквального списка ТЗ, не меняющая ни один заявленный AC; оставляю
  как Low-наблюдение, не возвращаю на правки.

## Что проверено и корректно

- Разделение transfer-only допусков (`allow_inactive_spatial_refs`,
  `allow_inactive_missing_space`) от обычного пути: оба флага по умолчанию
  `False`, прокидываются только из `prepare_portable_markers`; обычный
  `config/set` путь (не тронутый диффом) этих параметров не передаёт.
- Алгоритм `_ControlGraph` (bitset-замыкание вместо DFS на ребро) проверен
  вручную на тесте `test_controls_retain_document_order_and_break_only_unusable_edges`:
  порядок документа соблюдён (A→B сохранено первым, обратное B→A снято как
  цикл), самоссылка снимается отдельно от обычного цикла. Граничный тест
  `test_control_graph_is_bounded_at_current_marker_and_edge_limits` прогоняет
  2000 маркеров × 200 рёбер (MAX_MARKERS/MAX_CONTROLS) без исключений.
- Digest/CAS-механизм (`_candidate_digest`) не новый сам по себе (функция и её
  использование в `create_preview`/`prepare_apply` не тронуты диффом); новое —
  добавленная проверка digest и «unchanged»-кэш в начале `revalidate_candidate`
  (строки 2081, 2097-2117). Проверено, что кэш-ветка переиспользуется только
  при полном совпадении `duplicate_policy`/`config_rev`/`layout_rev`/`content`/
  `confirmation_required` — то есть ничего не пересчитывается заново там, где
  вход не изменился, что соответствует «Revalidate воспроизводит их».
- Двойной подсчёт `dropped_marker_links` отсутствует: старая логика в
  `create_export` (убирает ссылки, выходящие за пределы экспортируемого
  пространства) работает на уже отфильтрованном `selected_markers` до вызова
  `prepare_portable_markers`, поэтому новый recovery считает только
  внутри-пространственные self/cycle/missing/non-light случаи — категории не
  пересекаются.
- CPU-путь остаётся в executor: `create_export`, `revalidate_candidate`,
  `prepare_apply` вызываются через `hass.async_add_executor_job` (не тронуто
  диффом, проверено прямым grep).
- Экспорт реально дорабатывает собственный выход перед выдачей: добавленный
  dry-run (`parse_document` + `_materialize_import_candidate` на пустом
  target) в `create_export` — прямое доказательство AC5 «текущий backend
  действительно разбирает его» без записи в preview-токен/публичные файлы.
- Трейлеры: `Issue: #973`, `User-Visible: yes` на единственном коммите;
  `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в том же коммите.
- Одно число — один источник: `recovery.total`/`counts` вычисляются один раз
  сервером в `_materialize_import_candidate`/`build_space_merge`/
  `create_export`, клиент не пересчитывает — только отображает присланные
  (ограниченные 24 примерами) данные; клиент дополнительно сам режет
  `examples.slice(0, 24)` как defense-in-depth против недоверенного транзита
  envelope-статистики — не создаёт второй независимый источник числа, так как
  это тот же массив, просто с клиентским пределом не выше серверного.
- `docs/release-ledger/v1.81.0/973.json`: `stable-fix` относительно
  v1.81.0, обоснование называет уже существующий строгий radar/vacuum
  валидатор — корректно, это не внутрибетное изменение новой фичи
  (`introducedBy` не требуется).
- USER-GUIDE (RU/EN) формулировки совпадают с i18n-строками клиента
  («Скачать исправленную копию» / «Download repaired backup»).
- Bundle/monolith baseline обновлён только по измеренному факту
  (`bundleBytes` 3 231 572 → 3 237 078), остальные метрики (`delegates`,
  `portMembers`, `hostRefs`, `portPrivates`, `harnessPrivates`) не подняты;
  новый internal DOM-проб `backup-recovery` зарегистрирован в
  `data-hp-contract.json`.

## Находки

Нет. High: 0, Medium: 0.

## Побочные находки

Доверенный снимок политики: `mode=issues` (prepare, Actions variable
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`). Побочных находок, выходящих за
скоуп #973 и требующих отдельного issue, не обнаружено.

## Маршрут

`route: fix` (не `show`, применимо только непустым `reclassify` на треке show).

## Вердикт

Зелёный. Контракт восстановления реализован в общем pure-модуле, переиспользован
симметрично экспортом и импортом (full/space), обычный путь сохранения остаётся
строгим, все восемь AC имеют исполненные автотесты или код-разбор с явной
трассой, защитные AC имеют непустую таблицу «чем краснеет» с реально
исполненными негативными случаями. Дешёвые гейты и полный HA pytest подтверждены
зелёным Validate-run на точном материале.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/973-import-orphan-radar`, коммит `ec635a6d7d1f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e5ddae3d37f2eb19817155e55fa2ea7d059f3d35`
  ```
  git log --all --format='%H %T' | grep e5ddae3d37f2
  ```
- Тело issue: `2d3a66372cda1f622a09ea72a44ebb2bf52452360e121f32546ee4cffa2ec8f3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNjksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjU5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMTgsIm91dHB1dF90b2tlbnMiOjMzNzg5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0Njg3MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY2Nzg2MzEsImNvc3RVc2RFc3RpbWF0ZSI6Mi4yNjEzMzIyMDAwMDAwMDA1fV0sInR1cm5zIjo2NSwiZHVyYXRpb25NcyI6NDQ1OTQ1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4yNjY1OTEyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5287 output_tokens=33807 cache_creation_input_tokens=146870 cache_read_input_tokens=6678631 num_turns=65 -->
