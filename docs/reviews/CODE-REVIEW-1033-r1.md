# CODE-REVIEW-1033-r1

**Issue:** #1033 · **Этап:** code · **Трек:** ask · **Заход:** r1 ·
блокирующих циклов использовано 0/4 · **Материал:** `334d413f2fd8a429996a36dad7d7a4ad6c54e92d`
(`git rev-parse HEAD` на момент ревью совпадает) · диапазон `origin/dev..HEAD`
(4 коммита: `c667fc5c8`, `233b2fc6b`, `0fe61bf7f`, `334d413f2`).

## Скоуп

Три независимых, но сшитых одним issue исправления:

1. **К1** — подпись кнопки экспорта `backup.download`: «Скачать JSON» →
   «Скачать» (en/ru/de/fr), `support.download` не тронут.
2. **К2** — подложки (`kind: plan`) в полном ZIP при упаковке и восстановлении
   идут по правилу загрузки подложки (сигнатура + XML-проверка SVG без DTD-
   сущностей), а не по белому списку тегов декора (F125).
3. **К3–К6** — импорт больше не отклоняет план целиком из-за проёма вне своей
   стены/перегородки: новый чистый модуль `opening_repair.py` чинит геометрию
   перед схемой теми же предикатами, что и схема; отчёт `opening_repairs` в
   предпросмотре; подтверждение при `detached > 0`; К6 — ни самовосстановление,
   ни миграция, ни пересадка больше не сажают проём поверх соседа (питон +
   TS-зеркало на одном фикстурном файле).

Риск по изменённым участкам (из промпта) — три класса: **geometry**
(`opening_repair.py` + канонизация), **migration** (`import_export.py`),
**ux** (новые ключи `src/i18n/tools/*.json`). Все три покрыты АС ТЗ:
geometry/К6 → AC5, AC6, AC12; migration/отчёт → AC4, AC7–AC10, AC13; ux →
AC11 (плюс AC1 для `backup.download` в основном словаре). Непокрытого класса
нет.

## Как проверялось

Дешёвые гейты (`npx tsc --noEmit`, `npm test`, `npm run build` +
`bundle-policy --verify`, **включая HA-прогон `pytest tests_backend` —
отдельная job в `validate.yml`**) подтверждены зелёным Validate на этом же
SHA: https://github.com/Matysh/houseplan-card/actions/runs/39929232640 —
не перегонялись.

Сам прогнал (по диффу и AC, то, что Validate не покрывает):

| Гейт | Команда | Результат |
|---|---|---|
| Чистые backend-тесты (без HA) | `python -m pytest tests_backend -q` | 1239 passed, 4 skipped, 2 fail — оба сбоя в `test_support_builds.py` (нет плагина `pytest-asyncio` в песочнице), **не относятся к диффу**; `test_opening_repair.py` + `test_wall_segment_model.py` отдельно — 85 passed |
| TS/JS unit новых и общих файлов | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/backup-download-label.test.mjs test/wall-segment-model.test.mjs` | 3 + 40 passed (включая 7 кейсов АС12 по общему фикстурному файлу) |
| Контракт data-hp / фасад тестов | `node --test test/data-hp-contract.test.mjs test/hp-test-facade.test.mjs` | 16 passed — новый `backup-openings-details` заявлен и проходит |
| `smoke-select.mjs` по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `demo/smoke_glow.mjs`, `demo/smoke_junction_holes.mjs`; названный в AC `demo/smoke_backup_transfer.mjs` прочитан вручную (ниже) |
| Смок AC1/AC11 | прочитан исполнением сценария по исходнику `demo/smoke_backup_transfer.mjs` (сам файл в диффе, добавляет `openingsReport` с реальными текстами/disabled-состояниями чекбокса) — не перезапускал Playwright-браузер в этой сессии, проверка по тексту ассерта и ожидаемых значений в `checkAll` | ассерты соответствуют К1/К4/АС11 построчно |
| Golden | не перегонял — baseline уже принят на Linux CI в этом же диапазоне коммитов (`0fe61bf7f`, `Baseline-Reviewed` на run `39925838271`, `acceptedOn: linux`) | открыл PNG — кнопка действительно читает «Download» (см. ниже) |
| Инварианты модели (`#254`, диффа геометрии) | `npm run invariants -- --config <config>` на трёх конфигурациях: (1) JSON-импорт с дверью, оторванной от стены, после `repair_imported_openings`; (2) все 5 кейсов `test/fixtures/1033-opening-overlap-guard.json` после `commit_wall_segment_model` | «Инварианты выполнены: ссылки разрешимы, записи толщины находятся» на всех конфигурациях |
| Сгенерированные артефакты SH3D-конвертера | `node -e "import('./scripts/sh3d-convert/build-runtime.mjs').then(m=>m.buildGeometryRuntime())"` + `node scripts/sh3d-convert/build-page.mjs --check` | пересборка `geometry-runtime.generated.mjs` дала нулевой diff к закоммиченному; `build-page.mjs --check` — «ok: offline converter matches its sources and canonical runtime» |
| `bundleBytes`/монолит-метрики | `npm run build && node scripts/inventory.mjs` | delegates/portMembers/hostRefs/portPrivates/harnessPrivates совпали с базой 1:1; `bundleBytes` 3364661 против базы 3363984 (+677, полоса `BUNDLE_BYTES_BAND`=2000) — в допуске |

Golden-браузер (`demo/smoke_backup_transfer.mjs` исполнением через Playwright)
и полный ночной `pytest tests_backend` с HA я не перегонял сам — это
покрыто зелёным Validate на точном SHA материала (ссылка выше); для смока
достаточно по объёму задачи (не предрелизный гейт).

## Находки

Нет. High — 0, Medium (в скоупе и вне скоупа) — 0.

Разобрано по существу и проверено (ключевые риски из ТЗ):

- **Двойной разбор ZIP (К3 п.6) не удваивает счётчики.** `read_archive`
  парсит `document.json` один раз (`backup_archive.py:436`,
  `parse_document(...)` без `opening_repairs`) и кладёт полный отчёт в
  `document["transfer"]["opening_repairs"]`. `backup_service.py:309-313`
  передаёт этот отчёт в `create_preview(..., opening_repairs=...)`, которая
  зовёт `parse_document` второй раз на уже *отремонтированной* (замутированной
  in-place) конфигурации. Второй проход находит 0 новых чинок (проёмы либо
  уже валидны, либо уже без `host` и пропускаются `_host()`), так что
  `merge_repair_reports(first, second=0)` возвращает первый отчёт без
  задвоения. Подтверждено реальным тестом
  `test_issue1033_zip_with_a_door_off_its_wall_imports_after_confirmation_and_undoes`
  (`tests_backend/test_ha_backup_archive.py`): `detached == 1`, не 2.
- **К6 (запрет занятого участка)** — прочитан и прослежен построчно в обеих
  реализациях (`wall_segment_model.py:_host_openings`,
  `wall-segment-model.ts:hostRoomOpenings`): действующий подходящий носитель
  не перепроверяется (`segment is current` в `acceptable`/`accept` всегда
  истинно для него), а запись, потерявшая носитель на занятый единственный
  кандидат, доходит до `raise WallSegmentMigrationError("opening-host", …)` /
  `throw new WallSegmentModelError('opening-host', …)` — то же дерево решений,
  что было до #1033, с добавленным фильтром `wall_interval_free`. Зафиксировано
  общим фикстурным файлом `test/fixtures/1033-opening-overlap-guard.json`,
  исполняемым и в Python (`test_wall_segment_model.py`), и в TS
  (`wall-segment-model.test.mjs`) — по факту я прогнал оба набора, 100% pass.
- **`opening_repair.py` переиспользует, а не дублирует** предикаты схемы
  (`validation.wall_opening_host_fault` / `partition_opening_host_fault`,
  вынесенные из `_config_wall_segment_invariants` /
  `_space_geometry_invariants` тем же диффом — сравнение до/после в
  `validation.py` показывает чистый рефакторинг без изменения условий) и
  правило стены (`wall_segment_model.wall_carrier_eligible` /
  `pick_wall_carrier` / `wall_interval_free` — те же функции, что зовёт
  `_host_openings`). Дрейфа между «что чинит импорт» и «что проверит
  следующая запись» архитектурно не может быть — одна реализация на оба
  пути.
- **`legacy_detached` (модели < 8)** считается не в `opening_repair.py`
  (который для `model < 8` только снимает проёмы с перегородки и выходит),
  а отдельно в `import_export._opening_repair_details` — по факту, обходом
  уже смигрировавшего конфига (`migrated.get("spaces")`). Независимый от
  удвоения парсинга способ (пересчитывается с нуля при каждом вызове
  `_materialize_import_candidate`, а не копится через `merge_repair_reports`),
  поэтому проблема двойного ZIP-парсинга его не касается в принципе.
  Проверено тестом `test_issue1033_older_model_reports_what_its_migration_left_unhosted`.
- **Генерируемые артефакты не задрифтовали.** `scripts/sh3d-convert/
  geometry-runtime.generated.mjs` и `dist/index.html` — зеркала
  `wall-segment-model.ts`; я пересобрал оба и получил 0 diff / «ok» от
  собственного `--check` инструмента, значит правка К6 действительно
  протащена в конвертер, а не забыта.
- **Переводы** (`backup.download` в 4 языках основного словаря;
  `backup.openings_rehosted/detached/details`, `backup.confirm_openings` в
  `tools/*.json`) совпадают с текстом ТЗ дословно для всех четырёх языков —
  построчно сверено.
- **Changelog/release-ledger/трейлеры.** Коммит `c667fc5c8` несёt
  `User-Visible: yes` и правит `docs/CHANGELOG.md` + `docs/CHANGELOG.ru.md`
  в одном коммите, как требуется; `docs/release-ledger/v1.82.0/1033.json`
  классифицирует это как `stable-fix` относительно `v1.82.0` — обоснование
  («кнопка/подложки/геометрия — все три регрессии уже в этой stable») здравое,
  никакого внутри-бетного `introducedBy` не требуется. Golden-коммит
  `0fe61bf7f` несёт `Release:` + `Baseline-Reviewed:` — соответствует правилу
  trailers для `demo/golden/baselines/**`.
- **Одно число — один источник (§8).** `bundleBytes`/5 монолит-метрик в
  `scripts/monolith-baseline.json` я пересчитал независимо
  (`node scripts/inventory.mjs`) — пять «точных» чисел совпали 1:1, шестое
  (`bundleBytes`) — в объявленной полосе допуска; расхождения с «числом,
  видимым дважды», нет.

## Что проверено и корректно

- AC1–AC13 — каждый либо покрыт автотестом с реальным отрицательным случаем
  (`pytest.raises(vol.Invalid, …)`, `ImportFailure` с ожидаемым кодом,
  `assert.throws` в TS), который я лично прогнал и увидел зелёным, либо (для
  «не-скоуп»/неизменного поведения, напр. AC3 про >8 МиБ) разобран чтением —
  поведение не менялось этим диффом.
- Защитные AC (AC6, AC10, AC12, AC13, К6) имеют обычные отрицательные
  свидетели в собственных тестах: перекрытие, несуществующий/нулевой
  носитель, не помещается, подделанный `transfer.opening_repairs`, попытка
  сесть на занятый участок — все воспроизведены исполнением, не только
  заявлены. Дополнительно зарегистрированы мутанты
  `opening-repair-overlap-guard-off-1033` (и `-ts-1033`),
  `opening-repair-skipped-1033`, `opening-repair-no-confirmation-1033`,
  `backdrop-decor-whitelist-1033`, `backdrop-signature-unchecked-1033` в
  `scripts/mutation-registry.mjs` — для ночного прогона, не исполнял сам.
- Нерегресс соседней геометрии (AC7, AC9) подтверждён тестами, сравнивающими
  результат импорта сломанного файла с результатом импорта того же файла без
  сломанного проёма — побайтово совпадают кроме самого проёма.
- UX-диалог (AC11): реальные строки `data-hp="action"
  data-action="backup-openings-details"`, порядок подсказка/предупреждение,
  объединённый текст чекбокса при одновременном content+openings
  подтверждении, `disabled`→`enabled` после галочки — смок проверяет это по
  тексту и состоянию DOM, не только по наличию поля в объекте.
- USER-GUIDE (ru+en) и CONFIG-COMPATIBILITY.md обновлены согласованно с
  контрактом К2/К3/К6 и используют существующую терминологию интерфейса
  («Показать проёмы», «Скачать»).

## Чего не проверял

- Не перезапускал Playwright-рендер `demo/smoke_backup_transfer.mjs` и
  golden-набор браузером в этой сессии — положился на зелёный Validate этого
  точного SHA (ссылка выше), который включает обе эти позиции, плюс ручной
  просмотр принятого PNG и построчное чтение смок-сценария/ассертов.
- Не прогонял ночной реестр мутаций (вне ночного workflow запрещено
  политикой ревью) — для «чем краснеет» использовал обычные отрицательные
  кейсы тестов, которые сам исполнил и увидел падающими/проходящими по
  ожиданию.
- E2E `houseplan-e2e` по ТЗ — явно вынесено за рамки этой задачи («после
  слияния, отдельная инфраструктурная правка по #1010»); в диффе их нет и не
  должно быть.
- Два упавших теста `test_support_builds.py::test_timeout_keeps_physical_lease…`
  и `…test_global_budget_and_parent_cancellation…` — из-за отсутствия
  `pytest-asyncio` в песочнице ревью (не установлен, не относится к диффу
  #1033, файл не входит в changedFiles); Validate CI прогоняет полный `pytest
  tests_backend` с HA-окружением, где эти плагины есть — там же подтверждён
  зелёным.

## Маршрут

`route: fix` (трек `ask`, не `show`; `reclassify` неприменим).

---
Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1033-backup-plans-openings`, коммит `334d413f2fd8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `3c2f6508b2536ba4397a2b97e7576dc870c25728`
  ```
  git log --all --format='%H %T' | grep 3c2f6508b253
  ```
- Тело issue: `f8a619ed5eb4152618b237b3c36c55acbaedb84351182c16620195a3ea8cb1ee`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyNjcsIm91dHB1dF90b2tlbnMiOjI1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzkyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNjAsIm91dHB1dF90b2tlbnMiOjQ3OTc4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE5NTk4MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEyMTIyNDExLCJjb3N0VXNkRXN0aW1hdGUiOjMuNjg4NTAyMjAwMDAwMDAwM31dLCJ0dXJucyI6ODksImR1cmF0aW9uTXMiOjgwNTY2MywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuNjkzODk0MjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5427 output_tokens=48003 cache_creation_input_tokens=195980 cache_read_input_tokens=12122411 num_turns=89 -->
