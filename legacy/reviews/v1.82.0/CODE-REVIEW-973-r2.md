# CODE-REVIEW-973-r2

Issue: #973 «Бэкапы: безопасное восстановление устаревших связей при импорте и проверка при экспорте»
Трек: ask · Этап: code · Заход: r2 · блокирующих циклов использовано 0/4
Материал: `git diff origin/dev...HEAD`, HEAD = `e774a7bce72798b80806b634442464907802f337`
(ветка `issue/973-import-orphan-radar`, рабочая копия уже на этом коммите).
ТЗ: тело issue #973, SPEC-REVIEW-973-r1 — зелёный (High 0 / Medium 0).

## Скоуп

`origin/dev...HEAD` — два коммита:

- `cd5881963` `fix(backup): recover stale device links on import and export` —
  продуктовый код, 31 файл, тот же состав, что проверялся на r1 (новый модуль
  `portable_recovery.py`, интеграция в `import_export.py`, точечные
  transfer-only допуски в `radar_validation.py`/`validation.py`, поверхность
  отчёта в `backup_service.py`/`websocket_api.py`, клиент
  `backup-archive-client.ts`, 4 локали tools-i18n, synthetic/HA/native тесты,
  changelog×2, ledger, канонические документы).
- `e774a7bce` `docs: review document for #973` — публикация
  `docs/reviews/CODE-REVIEW-973-r1.md` ботом, docs-only (`User-Visible: no`).

## Почему r2 на зелёном r1

Комментарии issue (2026-10-20): модельное ревью на `ec635a6d7d1f` дало зелёный
вердикт (CODE-REVIEW-973-r1), но пока оно шло, `dev` продвинулся (вошло
принятое #971), и слияние конфликтовало. Задача вернулась в `S6-in-progress`
не на правку кода, а на ребейз (§2.10: «после ребейза на новый dev это другой
код, принимать без проверки нельзя»). Автор перебазировал ветку на новый
`dev` (база `3cabc7552f86f048c…`, уже включающую #971), разрешил два конфликта
и запросил новое ревью — это и есть r2.

Старый SHA материала r1 (`ec635a6d7d1fb0cdf856ed88f6648bdca37e09bd`, дерево
`e5ddae3d37f2eb19817155e55fa2ea7d059f3d35`) в текущем репозитории не
резолвится (`git cat-file -t` → fatal, не найден ни в одном `git log --all`) —
ожидаемо для орфанной ветки после ребейза, это не находка (§2.10: «если SHA не
резолвится — это не находка»). Поиск по дереву/блобу тоже не дал совпадений.
Дельта восстановлена не по diff-против-SHA, а по прямому построчному сравнению
текущего `git diff origin/dev...HEAD` с описанием, числами и именами функций в
CODE-REVIEW-973-r1.md — они совпадают файл в файл (см. ниже), что и есть
доказательство «тот же код, другая база».

## Как проверялось

Прочитан CODE-REVIEW-973-r1.md целиком (материал того раунда) и построчно
сверен с текущим `git diff origin/dev...HEAD` по каждому классу риска и по
обоим конфликтным местам ребейза:

- `custom_components/houseplan/import_export.py` (167 строк, полный дифф
  прочитан) — тот же набор функций (`prepare_portable_markers`,
  `_materialize_import_candidate`, `create_export`, `build_space_merge`,
  `create_preview`, `revalidate_candidate`), тот же удалённый
  `_drop_invalid_import_marker_links` (70 строк), тот же CAS/digest-кэш в
  `revalidate_candidate`.
- `custom_components/houseplan/radar_validation.py` / `validation.py` (31 / 5
  строк) — те же `allow_inactive_spatial_refs` / `allow_inactive_missing_space`,
  оба по умолчанию `False`.
- `custom_components/houseplan/backup_service.py` / `websocket_api.py` —
  именно это два файла, где прошёл ребейз-конфликт; прочитаны целиком вокруг
  изменений (dataclass `ArchiveSession`, `summary()`, `export()`,
  `ws_export_create`).
- `docs/CONFIG-COMPATIBILITY.md` — второе конфликтное место (два абзаца).
- `src/backup-archive-client.ts`, `src/backup-archive-lazy.ts`,
  `src/houseplan-editor-runtime.ts`, `test/backup-archive-client.test.mjs` —
  построчно, включая вычитание `recovery.counts` из `dropped_marker_links` на
  клиенте (риск «одно число — два источника», см. ниже).
- 4 локали `src/i18n/tools/*.json`, `docs/release-ledger/v1.81.0/973.json`,
  `scripts/monolith-baseline.json`, `scripts/mutation-registry.mjs`,
  `docs/data-hp-contract.json`, `docs/CHANGELOG(.ru).md` — построчно.
- Независимо перепроверена сохранность инфраструктуры #971: `operation_id`,
  `_cancelled_imports`, `validate_operation`, `zip_busy` в `backup_service.py`
  — присутствуют и не задеты диффом #973.
- `tests_backend/test_ha_import_export.py` diff (55 строк) — переименованный
  тест (`test_full_preview_repairs_self_and_cycle_but_ordinary_write_stays_strict`)
  и его новые ассерты прочитаны против кода.

### Гейты

| Гейт | Статус | Как подтверждён |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy | не перегонялся | Validate на точном SHA `e774a7bce` зелёный, проверено `gh run view 39398547743`: `headSha` совпадает, job «Фронтенд: типы, юниты, мутанты, синхрон бандла» — success (#343) |
| `pytest tests_backend/` (реальный HA) | не перегонялся лично | тот же run, job «Бэкенд: pytest в Home Assistant» — success на точном SHA |
| `smoke-select.mjs` | не перегонял повторно (r1 прогнал лично на идентичном продуктовом диффе; делта — только docs + ребейз-конфликт, набор смоков не меняется) | унаследовано из r1: прямое совпадение `smoke_backup_archive/backup_transfer/settings_navigation/space_card`, зарегистрированная связь `smoke_config_authority/empty_backup_import` — все 6 автор прогнал на ребейзнутом материале тоже (handoff-комментарий после ребейза), PASS |
| `smoke_portable_recovery` (AC6) | не перегонялся лично | заявлен автором на новом HEAD после ребейза, PASS; код смока не изменился (диффом #973 не тронут между r1 и r2) — прочитан на r1, здесь не перечитывался (неизменный материал) |
| `golden:verify` | не требуется | нет `ci:golden`, путь отрисовки плана не затронут (неизменно с r1) |
| `npm run invariants` | не требуется | геометрия/ссылки на неё не меняются (неизменно с r1) |
| Мутанты (execution) | не запускались | политика: ночь/реестр. `portable-recovery-weakens-ordinary-radar-validation-973` зарегистрирован (неизменная запись), «не исполнялся» |
| `git merge-base --is-ancestor origin/dev HEAD` | проверено лично | `cd5881963`→`3cabc7552f86f048c…`(=`origin/dev`), т.е. branch строго поверх текущего dev — ребейз чистый, Validate это же CI подтвердил зелёным |

Чего не проверял: ни одной команды из таблицы не перегонял лично — ограничился
чтением диффа, построчной сверкой с r1 и верификацией `gh run view` на точном
SHA. Browser smokes и golden в этом Validate-run `skipped` (ожидаемо: нет
`ci:golden`, рендер не тронут) — не являются неисполненным гейтом, т.к. AC6
закрыт именованным native `smoke_portable_recovery`, не browser golden.

## AC → разбор (по дельте)

Продуктовый код AC1–AC8 не изменился между r1 и r2 (подтверждено построчно
выше: тот же `portable_recovery.py`, та же матрица допусков, те же тесты).
Ревью заново не переоткрывает доказательства AC1–AC8 — они унаследованы из r1
(раздел ниже) — и фокусируется на том, что реально отличается: два места
слияния.

**Конфликт 1 — `ArchiveSession` (`backup_service.py`):** ребейз сохранил оба
поля дата-класса, `recovery: dict[str, Any] | None = None` (#973) и
`workers: set[asyncio.Future] = field(default_factory=set)` (#971), друг за
другом, без потери значений по умолчанию. `session.recovery` присваивается
только в `export()` (строка после `create_export`) и читается только в
`summary()`; `session.workers`/`_cancelled_imports`/`operation_id`/`zip_busy`
из #971 не задеты (grep подтвердил: `validate_operation`, `_cancelled_imports`,
`reserve(..., operation_id)` на месте). Поля ортогональны — пересечения
семантики нет.

**Конфликт 2 — `docs/CONFIG-COMPATIBILITY.md`:** оба абзаца сохранены — один
про #971 (`operation_id` cancellation, строки 28–30, не тронут диффом #973),
один про #973 (portable repair). Третье место правки — абзац про
`dropped_marker_links`/space export (строки ~1043–1048) — дополнен фразой про
recovery-report, не противоречит существующему тексту.

**Новое, что проверено отдельно от r1** — вычитание recovery-счётчиков из
`dropped_marker_links` на клиенте (`houseplan-editor-runtime.ts`,
`droppedLinks = max(0, p.dropped_marker_links - recovery.counts.controls -
recovery.counts.value)`): сервер действительно прибавляет те же
`recovery["counts"].controls/value` к `dropped_marker_links` и в
`create_export`, и в `build_space_merge`, и в `_materialize_import_candidate`
(полный импорт) — то есть `dropped_marker_links` на сервере уже включает
recovery-часть. Клиент вычитает её обратно перед показом старого баннера
«Снято ссылок: N», чтобы не показать те же controls/value дважды — один раз в
баннере, второй раз в блоке `renderRecoveryReport`. Арифметика закрытая:
`dropped_marker_links = old + controls + value`, после вычитания —
`old` ровно. Один источник числа (сервер), две непересекающиеся витрины на
клиенте — находок нет.

## Унаследовано из r1 (без повторной проверки)

Документ: `docs/reviews/CODE-REVIEW-973-r1.md`, материал `ec635a6d7d1fb0cdf856ed88f6648bdca37e09bd`
(вердикт зелёный, High 0/Medium 0, построчно верифицирован тем раундом).
Поскольку продуктовый дифф между r1 и r2 идентичен по содержанию (подтверждено
построчной сверкой выше — не по хешу, так как старый SHA орфанный), следующее
принимается без повторного исполнения:

| Унаследовано | Где проверялось в r1 |
|---|---|
| AC1–AC3, AC5 — автотесты + авторский пруф на приватном ZIP (1/8/86, до/после `invalid_config`→`PASS`) | CODE-REVIEW-973-r1.md, раздел «AC → разбор» |
| AC4, AC7, AC8 (защитные) — таблица «чем доказан/чем краснеет» с реально исполненными негативными случаями (`test_preview_revalidate_and_apply_use_the_same_recovery_not_source_mutation`, `test_real_archive_export_report_apply_inert_runtime_and_undo`) | CODE-REVIEW-973-r1.md, «Защитный AC · чем доказан · чем краснеет» |
| AC6 — native `smoke_portable_recovery.mjs` целиком прочитан, 4 oracle (инъекция/локали-360px/Apply-timing/export-consent) | CODE-REVIEW-973-r1.md, раздел «Как проверялось» |
| `_ControlGraph` bitset-алгоритм, порядок документа, границы MAX_MARKERS/MAX_CONTROLS | CODE-REVIEW-973-r1.md, «Что проверено и корректно» |
| Отсутствие двойного счёта `dropped_marker_links` между старой (out-of-space) и новой (self/cycle) категориями на сервере | CODE-REVIEW-973-r1.md, «Что проверено и корректно» (r2 добавил отдельную проверку клиентского вычитания — см. выше, это новое для r2) |
| `document`/`target_config` разделены, исходник не редактируется | CODE-REVIEW-973-r1.md |
| ledger `stable-fix` относительно v1.81.0, обоснование (строгий radar/vacuum-валидатор уже существовал до тега) | CODE-REVIEW-973-r1.md |
| Один незаявленный tools-ключ `backup.recovery.details` — Low-наблюдение, не возвращено на правки | CODE-REVIEW-973-r1.md |

## Разбор рискованных участков (§707)

- **migration** (`import_export.py`): не изменился между r1 и r2 (построчная
  сверка выше) — унаследовано.
- **devices** (`websocket_api.py:645`, текущая нумерация — строка 644):
  `ws_export_create` добавляет `recovery` в ответ только если отчёт непустой;
  не изменился между раундами, кроме контекста (тот же файл — место второго
  конфликта по `backup_service.py`, не по `websocket_api.py`, этот файл сам
  конфликтов не имел).
- **ux** (i18n tools): все 4 локали, тот же набор из 11 ключей на файл,
  побайтно сверено по диффу — не изменился.

## Что проверено и корректно

- Ребейз не внёс скрытых изменений продукта: число строк диффа по каждому
  файлу (`import_export.py` 167, `portable_recovery.py` 241 новых,
  `radar_validation.py` 31, `validation.py` 5, `backup-archive-client.ts` 40,
  `houseplan-editor-runtime.ts` 22, по 11 строк на каждую из 4 локалей,
  `demo/fixtures/portable-recovery-v1.json` 667, `demo/smoke_portable_recovery.mjs`
  129) совпадает с цифрами, названными в CODE-REVIEW-973-r1.md для того же
  набора файлов.
- `bundleBytes` baseline (`3231572 → 3237078`) идентичен числу из r1 — хотя
  `origin/dev` с тех пор включил #971, рост монолита пересчитан относительно
  актуального `dev`, а не унаследован вслепую (`hostRefs: 5910` в
  pre-image — это значение уже с учётом #971 в dev, не старое).
- Трейлеры: `cd5881963` — `Issue: #973`, `User-Visible: yes`, оба changelog
  правятся в этом же коммите (CHANGELOG.md/.ru.md добавляют отдельную от #971
  запись). `e774a7bce` — `Issue: #973`, `User-Visible: no`, docs-only (только
  публикация ревью-документа), changelog не требуется.
- `git merge-base --is-ancestor origin/dev HEAD` → true: ветка строго поверх
  актуального `dev`, конфликтов при реальном слиянии pipeline не предвидится.
- Инфраструктура #971 (`operation_id`, `_cancelled_imports`, `zip_busy`,
  `validate_operation`) не задета диффом #973 — независимо перепроверено
  grep'ом по `backup_service.py` после ребейза.
- `docs/reviews/INDEX.md` не содержит строки для `CODE-REVIEW-973-r1.md` —
  индекс генерируется отдельным скриптом (`scripts/reviews-index.mjs`) и
  отдельным пайплайн-коммитом (как было сделано для #971:
  «docs(reviews): индекс после сдвига каталога»); текущая задача такого
  коммита не публиковала. Это не находка кода #973 — публикация индекса вне
  скоупа данного коммита и не требуется ни одним AC.

## Находки

Нет. High: 0, Medium: 0.

## Побочные находки

Доверенный снимок политики: `mode=issues` (prepare, Actions variable
`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`). Побочных находок, выходящих за
скоуп #973 и требующих отдельного issue, не обнаружено.

## Маршрут

`route: fix`.

## Вердикт

Зелёный. Продуктовый код между зелёным r1 (`ec635a6d7d1f`) и текущим материалом
(`e774a7bce`) не изменился по содержанию — отличие только в базе ребейза
(дерево `dev` продвинулось на принятый #971) и в двух корректно разрешённых
конфликтах (`ArchiveSession.recovery`+`workers` сосуществуют; оба абзаца
`CONFIG-COMPATIBILITY.md` сохранены). Инфраструктура #971 (cancellation,
`zip_busy`, `operation_id`) не задета. Дополнительно проверено клиентское
вычитание recovery-счётчиков из `dropped_marker_links`, чтобы число не
показывалось дважды — корректно, один источник на сервере. Дешёвые гейты и
полный HA pytest подтверждены зелёным Validate на точном материале SHA
`e774a7bce` (проверено `gh run view`). AC1–AC8 наследуются из зелёного r1 без
повторного исполнения — продукт не менялся.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/973-import-orphan-radar`, коммит `e774a7bce727` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `29b57fcda69661d5d3ec8607ec9b4c3c48dc693a`
  ```
  git log --all --format='%H %T' | grep 29b57fcda696
  ```
- Тело issue: `2d3a66372cda1f622a09ea72a44ebb2bf52452360e121f32546ee4cffa2ec8f3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNjQsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjQ0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0NCwib3V0cHV0X3Rva2VucyI6MzEyODEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTM0MjcyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MjMwNTgzMiwiY29zdFVzZEVzdGltYXRlIjoxLjMxMTE1MjR9XSwidHVybnMiOjM3LCJkdXJhdGlvbk1zIjozOTc0NzksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjMxNjM5NjQwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5208 output_tokens=31297 cache_creation_input_tokens=134272 cache_read_input_tokens=2305832 num_turns=37 -->
