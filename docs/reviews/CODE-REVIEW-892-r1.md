# CODE-REVIEW-892-r1

Issue: #892 «Optimize: права запуска, предупреждения пылесоса и безопасная
очистка старых позиций». Этап: код-ревью (PROCESS.md §2.7). Трек: `ask`.
Заход: r1 (код-ревью считается отдельно от ревью ТЗ; спек прошёл r1→r3,
зелёный SPEC-REVIEW-892-r3). Блокирующих циклов израсходовано: 0/4.

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
на коммите **`5b9268e7bdfe499f0ce283f5826b67078b63ee3b`** (рабочая копия уже
на нём; `git fetch/pull/checkout` не выполнялись). Accepted dev на момент
хендоффа: `22ee4d3ec7c5eb989b07689f5b93952cf80c9371` (#849 S8). Validate на
`5b9268e7` — success: https://github.com/Matysh/houseplan-card/actions/runs/38678960909.

## Скоуп

Контракт п.1 (frontend `can_write`/kiosk gate для Optimize/Undo, текст отказа
backend без нового `is_admin`), п.2 (понятный vacuum warning), п.3 (разделение
видимых/архивных позиций, честный `maxShiftCm`), п.4 (`model-invariants`
не считает `grp_*` live по совпадению HA-area), п.5–7 (новая кнопка «Удалить
некорректные записи»: точные безопасные классы, opt-in в preview, Apply,
честный отчёт, гонки/Undo). Файлы: `src/space-reference-repair.ts`,
`src/align-grid.ts`/`plan-optimizer.ts`, `src/optimize-source.ts` (новый),
`src/plan-optimize-write.ts`, `src/optimize-plans-dialog.ts`,
`src/optimize-plans-loader.ts`, `src/houseplan-editor-runtime.ts`,
`src/editors/general-settings-dialog.ts`, `custom_components/houseplan/websocket_api.py`
(только текст unauthorized), `scripts/model-invariants.mjs`, 4 locale-словаря,
USER-GUIDE RU/EN, CONFIG-COMPATIBILITY/ARCHITECTURE/STATUS/DEVELOPMENT,
release-ledger, golden baselines (2 PNG), unit/backend/smoke-тесты,
mutation-registry (7 новых определений). `auth.py`/`may_write` не менялись —
подтверждено (`git diff` по `custom_components/` пуст, кроме двух строк текста
в `websocket_api.py`).

## Как проверялось

Static-first: прочитан canonical-материал подсистемы (ARCHITECTURE.md/STATUS.md
правки в этом же диффе, USER-GUIDE.ru.md — терминология «права на изменение
Houseplan», «Удалить некорректные записи», «Применить изменения» взята из
принятого ТЗ и совпадает с i18n-ключами и кодом). Прочитан весь дифф построчно
(не только риск-участки из промпта); каждый риск-класс (geometry/devices/ux)
прослежен до конкретного AC.

Дешёвые гейты (typecheck/`npm test`/`npm run build`+bundle) не перегонялись
полностью — зелёный Validate на этом SHA уже подтверждён (ссылка выше).
Выполнено самостоятельно, адресно по диффу:

| Гейт | Команда | Результат |
|---|---|---|
| i18n-полнота 4 словарей | узкий `node -e` diff по ключам `en/ru/de/fr` `src/i18n/settings/*.json` | PASS — 0 missing/extra в каждом |
| Инвариант модели AC4, живым кодом | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`, затем `node scripts/model-invariants.mjs --config <синтетический конфиг: комната area=kitchen, layout grp_kitchen>` | На `HEAD`: `grp_kitchen` → note `unknown_owner` (не нарушение). На `origin/dev` (тот же файл, скопированный во временный нетрекаемый `scripts/_tmp-dev-model-invariants.mjs`, удалён сразу после прогона — `git status` чист): **нет вообще никакой записи** — старый код молча признавал `grp_kitchen` live по совпадению HA-area. Это и есть «краснеет» для AC4, доказанное исполнением продукт­ного кода, а не только чтением юнит-теста |
| Логика `repairSpaceReferences`/cleanup-классификации | прочитана построчно (`src/space-reference-repair.ts:352-444`) и прослежена против каждого кейса `test/optimize-cleanup-892.test.mjs` (строка кода ↔ assert) | соответствует контракту п.5 дословно |
| Коммит-трейлеры и golden-трейлеры | `git log --format` по диапазону | PASS — см. ниже |
| `validate-commit-provenance` | не перегонялся отдельно — часть уже зелёного Validate | — |

Полные `npx tsc --noEmit`, `npm test`, `npm run build`+сверка бандла,
`golden:verify`, `pytest tests_backend` целиком, мутанты — не гонял: см.
«Чего не проверял».

## Находки

Нет High. Нет Medium. Нет Low, требующих правки.

## Что проверено и корректно

**AC1 (frontend/backend write-gate).** `general-settings-dialog.ts:277-290`
добавляет `?disabled=${!host._canEdit || host._kiosk}` на кнопки Optimize/Undo
(тот же паттерн, что уже работал у секции backup — подтверждено спек-ревью r2
чтением `_canEdit`) и подсказку `gs.optimize_write_required`.
`optimize-plans-dialog.ts` (`preview()`, `run()`) и `optimize-plans-loader.ts#open()`
отдельно отказывают при `!canWrite()` ещё до построения кандидата (unit
`#892 AC1: direct and lazy entry points refuse a current non-writer...`,
`test/optimize-plans-dialog.test.mjs:999-1010`). Backend (`websocket_api.py:2283,2495`)
меняет только текст ошибки на `"Houseplan write permission is required..."`;
ACL (`_check_write`/`may_write`/`admin_only`) не тронут — подтверждено пустым
`git diff` по `auth.py`. Матрица admin_only×группа живым HA WS-тестом:
`tests_backend/test_ha_websocket.py::test_issue_892_optimize_cleanup_acl_pair_and_undo`
(4 параметризации: admin/admin_only=true → true; ordinary writer/false → true;
ordinary writer/true → false; read-only/false → false), включая проверку
текста ошибки («administrators» более не встречается) и paired Undo для
разрешённого случая. Смоки `smoke_optimize_cleanup.mjs`
(`ordinaryWriterNotAdminCanOpen`, `currentReadOnlyCapabilityDisablesOptimizeAndUndo`,
`denialHintDoesNotClaimAdminOnly`) проверяют то же в реальном DOM с живым
`is_admin:false`.
**Чем краснеет:** mutant `optimize-892-no-write-permission-guard` (прямая
проверка снятия gate) + вручную подтверждённый HA-тест выше реально падает
при `admin_only=true`/ordinary writer (`allowed=False` в параметризации)
— не просто «тест умеет падать» декларативно, а параметризация с обоими
исходами проверена построчно.

**AC2 (vacuum warning).** `nestedRefsUnresolved` (не изменён в этом PR) плюс
новый `vacuumNames` (`optimize-plans-dialog.ts:254-257`) формирует
`gs.optimize_vacuum_action` с именем устройства и путём «Device editor →
vacuum → Maps»; текст явно говорит «This report does not remove them or
change calibration». Смоук `vacuumWarningNamesObjectAndRealGuiPath` в
`smoke_optimize_cleanup.mjs` матчит реальный рендер на реальном marker
`Vacuum892`. Проверено чтением и смоук-рендером, не отдельным unit —
изменение в этой области ограничено текстом/計算vacuumNames, что признал
уже спек-ревью r2 как унаследованное и не меняющееся в r3.

**AC3 (archived vs visible / честный maxShift).** `align-grid.ts:356-362`
считает `currentPositions`/`archivedPositions`(Moved) отдельно от общего
`moved`/`maxShiftCm`, который остаётся upper bound по всем позициям (не
занижается удалением — `test/optimize-cleanup-892.test.mjs` «AC3: a
deleted-floor maximum...» прогоняет два масштаба, проверяет
`ordinary.report.maxShiftCm >= largest`, затем после `cleaned` —
`archivedPositionsMoved===1` (запись-мусор не считается как ещё одно
перемещение) и `cleaned.report.maxShiftCm < largest`, то есть «финальный
кандидат» честно меньше после реального удаления, но никогда не был занижен
до него. Второй прогон `optimizePlans(cleaned...)` → `changed:false`
(идемпотентность). **Чем краснеет:** сам assert `maxShiftCm + 1e-8 >= largest`
ловит «занижение максимума», отдельного мутанта для `align-grid.ts` в
реестре нет, но утверждение проверяется прямым числовым инвариантом в тесте,
не косвенно.

**AC4 (model-invariants grp_* не live по HA-area).**
`scripts/model-invariants.mjs` убирает `areasBySpace`/`allAreas`, заменяет
классификацию `grp_*` по области на `note('unknown_owner', ...)` без
nарушения. Доказано исполнением (таблица выше) на настоящем CLI, не только
юнит-тестом `test/model-invariants.test.mjs` (тоже обновлён и проверяет
`kinds.includes('layout_owner:grp_no_such_area') === false` и наличие
`unknown_owner`-заметки). **Чем краснеет:** любой возврат логики `allAreas`
немедленно превращает заметку `unknown_owner` обратно в отсутствие записи
(показано вручную выше) — негативный прогон на обеих версиях кода, не
гипотетический.

**AC5/AC6/AC7 (безопасная очистка: точные классы, honest report,
accessibility).** Логика классификации (`space-reference-repair.ts:419-443`)
прослежена построчно против каждого пункта контракта п.5 и теста
`optimize-cleanup-892.test.mjs`:
- `plainPosition()` отклоняет записи с посторонними полями/нечисловыми
  координатами → `unknown_shape` (тест `grp_extended`/`grp_bad`/`future_widget`).
- `liveEntityIds.has(key)` защищает entity-keyed state-only позиции
  (`light.state_only` в тесте) раньше любой другой проверки.
- Старый `grp_*`-namespace проходит без полного реестра (`rosterAuthoritative`
  не требуется для `kind==='legacy_group'`), а прочий `unknown`-owner требует
  И `rosterAuthoritative`, И ключ в форме 32-hex HA-id — иначе
  `unknown_shape`/`registry_unavailable`. Подтверждено тестами
  `#892 AC5/6` и `#892 AC6` (оба направления: `authoritative=true` → 3
  eligible-записи ровно нужных id; `authoritative=false` → `grp_old` всё ещё
  eligible, `dead`-hex — `registry_unavailable`).
- `k` удаляемой записи удаляется вместе с ней; `k` живой комнаты (`rl_room`)
  не трогается даже при мёртвом `s` (`applied.layout.rl_room.k === 1.4` в
  тесте, `_labelScale` отдельно подтверждён в ARCHITECTURE.md и смоуке
  `liveRoomActuallyUsesRetainedScale`/`retainedViewPlacementScaleAndVacuumUnchanged`).
- `invalidCleanupSupported` считается в `plan-optimizer.ts` по
  `model_version` оптимизатора, а не передаётся вызывающим кодом — будущая
  модельfail-closed (`#892 AC6 future model...` тест).
- Точный импорт-lineage чинится ДО цикла unresolved (отдельный тест AC7),
  поэтому восстановимая запись никогда не попадает в «мусор».

UI: кнопка видна только при `invalidEligible.length || invalidRetained.length`,
disabled без eligible-записей/при busy/retry/failed-preflight/`!canWrite()`
(`optimize-plans-dialog.ts:659-684`); при retained-only остаётся видимой и
disabled с причиной (`optimize_invalid_none_safe`) — подтверждено
`smoke_optimize_context.mjs` блоком «Retained-only is a discoverable disabled
action» и `test/optimize-plans-dialog.test.mjs` («retained-only cleanup
remains discoverable but cannot be selected»). 360/1280px, light/dark,
RU/EN, target ≥44px, keyboard (Space) — `smoke_optimize_cleanup.mjs`
(`cleanup_layout_*`, `keyboardSelectPreviewsWithoutWriting`). **Чем краснеет:**
mutant `optimize-892-cleans-live-owner-as-unused`,
`optimize-892-retained-only-control-enabled` в `scripts/mutation-registry.mjs`
(исполнение — только ночью, по правилу #709, что соответствует треку `ask`
в разработке — ревьюер мутанты тоже не гоняет, проверяет регистрацию).

**AC8 (гонки: pending write, roster, foreign connection/user, stale rev).**
`optimize-source.ts` (новый файл) — чистая функция `sameOptimizeSource` плюс
`OptimizeWriteGuard`; `plan-optimize-write.ts#commitPlanOptimization` проверяет
guard **после** `await host._writeChain` (до отправки) и **снова** после
ответа WS (`authorityCurrent`/`connection`). Источник (`source()` в
`houseplan-editor-runtime.ts:906-920`) включает оба rev, оба content-fingerprint,
fingerprint ownership-evidence (registry revision/authoritative/device&entity
ids/state ids/effective areas) и существующий `_configWriteGuard()`-claim —
это именно тот механизм, которым карта уже защищает обычный config-write
(`houseplan-card.ts:7699-7702`), переиспользован, а не изобретён заново.
Четыре сценария гонки проверены исполнением в `demo/smoke_optimize_context.mjs`:
held Apply-ответ при смене state/connection/user (ordinary фрейм принимает
свой результат, foreign — нет, `canUndo:false`), held General settings Save
блокирует отправку Apply до завершения и owner-arrival сбрасывает consent,
full↔partial registry меняет consent без записи. Backend: `test_issue_892_...`
дополнительно гоняет честный `conflict` при CAS-несовпадении и восстановление
Undo. Юнит `test/optimize-cleanup-892.test.mjs` («AC8» тесты) проверяет каждое
поле `OptimizeSource` по отдельности (`for (const field of [...])`) и отдельно
— что оригинальный `authorityCurrent`-claim, а не свежий, решает исход
(«the original authority claim fences both queued work and a same-connection
late reply»). **Чем краснеет:** три mutant-определения
(`optimize-892-preview-forgets-ha-claim`, `optimize-892-old-reply-adopted-after-context-change`,
`optimize-892-pending-flush-bypasses-source-fence`) прямо патчат каждую из
трёх защитных точек (capture claim / recheck after response / recheck before
send) и ссылаются на падающий тест/смоук.

**AC9 (единственный paired Apply/Undo, cold reload).** Подтверждено реальным
HA WS-тестом (`runtime.store.async_load()` до/после, `reread_*` через
отдельного authenticated-клиента, `can_optimize_undo`/`undo_kind`, повторный
`optimize` с теми же rev → `conflict`, `optimize_undo` восстанавливает
`original_layout` целиком, второй `layout/get` подтверждает восстановление) и
смоук `smoke_optimize_context.mjs` (cold remount дважды, настоящий GUI Undo,
`persistence:undoRestoresDiagnosticWithoutImplicitSecondCleanup` —
восстановленная запись не удаляется автоматически повторно).

**Release-артефакты.** Оба коммита с `User-Visible: yes` (`ca326111`,
`38918199`) правят `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же
коммите. Golden-коммит `16db4bd8` (трогает
`demo/golden/baselines/**`) несёт `Release: v1.81.0-beta.3` и
`Baseline-Reviewed-Local: sha256:...` — оба обязательных трейлера на месте.
`docs/release-ledger/v1.80.1/892.json` классифицирует issue как `stable-fix`
относительно `v1.80.1`; проверено против истории: `repairSpaceReferences`,
`unverifiedPositions`/`liveMissingPositions`-бакет и ручное удаление
`orphan*PositionsRemoved` для доказанно-absent записей существовали уже в
`v1.80.1` (`git show v1.80.1:src/space-reference-repair.ts` подтверждает это
дословно), а баг AC4 (`allAreas`-ложноположительный live) там же уже
присутствовал — значит часть контракта (п.1 gate-баг, п.4 invariants-баг)
действительно чинит stable-поведение. Отдельно учтено: диагностика
`legacy_group`/registry-retry (#869) и сама новая кнопка очистки (п.5-7)
появились уже после `v1.80.1` (`git merge-base --is-ancestor` для первого
коммита #869 относительно тега `v1.80.1` → false, то есть #869 НЕ предок
стабильного тега). Это согласуется с явной формулировкой принятого ТЗ
(«Контракт очистки относится к ранее существовавшей Plan maintenance, не
инфраструктура» — раздел «Release-артефакты» тела issue, зафиксирован ещё в
зелёном SPEC-REVIEW-892-r3) — то есть классификация «stable-fix» не вывод
реализации, а предрешённое и обоснованное авторское суждение самого ТЗ;
код ему не противоречит. Это зафиксировано здесь как проверенное
соответствие, не как новая находка.

**i18n.** Все 4 словаря (`en/ru/de/fr`) содержат одинаковый набор новых
ключей (`gs.optimize_write_required` … `gs.optimize_vacuum_action`), без
пропусков/лишних — проверено прямым сравнением ключей (см. таблицу гейтов).
Формулировки совпадают по смыслу с принятым ТЗ дословно («Удалить
некорректные записи»/«Delete invalid records», «Применить изменения»/«Apply
changes»).

**Документация.** USER-GUIDE.ru.md/.md, CONFIG-COMPATIBILITY.md,
ARCHITECTURE.md, STATUS.md описывают контракт п.1 и п.5-7 без расхождений с
кодом (например, ARCHITECTURE.md явно говорит «Cleanup neither persists a
second snapshot nor calls `layout/set`», что совпадает с тем, что
`commitPlanOptimization` остаётся единственной точкой записи и в cleanup-, и
в обычном Optimize-сценарии).

**Риск по изменённым участкам (#707), покрытие AC (трек ask):**
geometry (`align-grid.ts`) → AC3; devices (`websocket_api.py`) → AC1; ux
(новые i18n-ключи `gs.optimize_invalid_*`/`gs.optimize_vacuum_action`/
`gs.optimize_visible_positions`/`gs.optimize_missing_space_positions`) →
AC2/AC5/AC6. Каждый класс закрыт явным AC принятого ТЗ, пробелов не нашёл.

## Чего не проверял

- Полный `npx tsc --noEmit`, `npm test`, `npm run build`+сверка 3 копий
  бандла, `golden:verify`, полный `pytest tests_backend`, `npm run
  mutation-gate` — не перегонял: зелёный Validate на материале `5b9268e7`
  (run 38678960909) уже подтверждает их на этом SHA (#343); узкие прогоны,
  которые я сделал сам (model-invariants CLI, i18n diff), были нацелены на
  то, что Validate не проверяет содержательно (именно это поведение, а не
  факт компиляции/наличия теста).
- Не гонял мутанты (development не запускает ни один мутант ни на каком
  треке — поимку проверяет ночь, #709); проверил только, что 7 новых
  определений в `scripts/mutation-registry.mjs` синтаксически patch'ат верные
  строки (`find`-паттерны совпадают с текущим кодом дословно — иначе
  `mutation-gate --check`, упомянутый автором как PASS в хендоффе, не прошёл
  бы статическую проверку наличия паттерна).
- Не проверял реальный HA-инстанс (не Home Assistant test harness) вживую —
  доверился `tests_backend/test_ha_websocket.py` (запускается через
  `.venv-backend`, автор заявил `4 passed, 128 deselected` на узком фильтре
  `-k issue_892`; полный backend-прогон за рамки риска этой задачи не брал,
  т.к. ACL-механизм не менялся, только два текстовых сообщения).
- Golden-скриншоты (`optimize-orphan-references-*`) не пересчитывал и не
  сравнивал попиксельно — доверился принятому `Baseline-Reviewed-Local`
  трейлеру с hash-паспортом; свежесть скриншотов документации вне скоупа
  задачи (#697).
- Производительность: AC не называет performance-гейт, `scripts/mutation-registry.mjs`
  note явно фиксирует «classification linear by layout/rooms/markers/one
  registry snapshot» — проверено чтением (`for (const [key, position] of
  Object.entries(layout))` — один проход, без вложенных сканирований), не
  измерением.
- Не перепроверял независимо унаследованные из зелёного SPEC-REVIEW-892-r2
  контракт п.1 (may_write-политика) и п.2/п.4 текстуально — они не менялись
  между r2 и r3 тела issue; но их РЕАЛИЗАЦИЯ (код, а не текст ТЗ) в этом
  коде-ревью проверена впервые (это первый код-ревью issue), поэтому выше
  они разобраны по коду, а не просто приняты на слово.

## Вердикт

Зелёный. Контракт реализован полно и соответствует каждому из AC1–AC9;
гонки и деструктивные кейсы доказаны исполнением (unit/smoke/backend), не
только декларативно; документация, i18n, changelog-трейлеры и release-ledger
согласованы с кодом и между собой. High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/892-optimize-cleanup`, коммит `5b9268e7bdfe` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7cd71fd6837caeecb18a94630cbc7b00cc099463`
  ```
  git log --all --format='%H %T' | grep 7cd71fd6837c
  ```
- Тело issue: `8901a5b2ed858580cb3371da08e684344917666ebb2ed409133e4dcc27b29407`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MzUsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzM1MDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTA0LCJvdXRwdXRfdG9rZW5zIjo0NDY4NywiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxOTQ3OTAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo3NjQyNTc2LCJjb3N0VXNkRXN0aW1hdGUiOjIuNzU0NzUzMTk5OTk5OTk5N31dLCJ0dXJucyI6NjEsImR1cmF0aW9uTXMiOjU3MTM0MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuNzU5NDg4MiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4739 output_tokens=44707 cache_creation_input_tokens=194790 cache_read_input_tokens=7642576 num_turns=61 -->
