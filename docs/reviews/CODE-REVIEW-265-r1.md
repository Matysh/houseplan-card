# CODE-REVIEW-265-r1

- Issue: [#265](https://github.com/Matysh/houseplan-card/issues/265) — единый контракт ссылочного шва импорта
- Этап: код-ревью · заход r1 · блокирующих циклов израсходовано 0/4 (первый заход этапа code)
- Ветка: `issue/265-import-seam-contract`
- Материал: `git diff origin/dev...9f54cbab7591ffba17ad3999bedeb70eba685aa9`, 39 файлов, +2990/-958
- Спецификация: `docs/specs/265-import-reference-seam.md` (принята на SPEC-REVIEW r3, зелёный, SHA `26af611a`)
- Ревьюер: свежая сессия, без контекста реализации

## 1. Скоуп

Задача переносит контроль ссылочного шва импорта из трёх разрозненных починок
(#244/#248/#252) в один контракт: канонический (bounded, ≤16 слоёв) lineage-id
для повторных space-import, безопасный cross-generation repair мёртвых
target-ссылок, единая типизированная матрица из §8 ТЗ, неизменяемый
preview/apply candidate с digest, структурированный отчёт и расширенный
`model-invariants.mjs`. Затронуты классы A (`custom_components/houseplan/
import_export.py`, `websocket_api.py`, `src/houseplan-card.ts`,
`src/space-reference-repair.ts`, `src/styles.ts`, `src/i18n/*.json`) и B/C/D
(тесты, скрипты, demo, документация, бандл).

Соответствует J6 «Keep the plan true as the home evolves» из `docs/SCOPE.md` —
чинит накопление служебного мусора при повторном импорте, не открывает новую
UX-поверхность. Импорт/детали остаются desktop admin-editing поверхностью, как
и зафиксировано в ТЗ §1 (View/kiosk не затронуты) — подтверждено чтением: новый
UI живёт целиком внутри `_backupImportDialog` рендера, доступного только из
редактора.

## 2. Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green (прогнан локально) |
| Unit/юнит | `npm test --silent` | green — 1298 тестов, 1297 pass, 1 skip, 0 fail (прогнан локально, совпадает с CI) |
| Build + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | green — байт-в-байт совпадает после чистой пересборки |
| `check-docs` (diff трогает `src/**`) | `node scripts/check-docs.mjs` | green — 7 файлов, 10 внешних ссылок |
| `model-invariants` (диф трогает ссылочную матрицу) | `npm test` (юнит-часть `test/model-invariants.test.mjs`, включает новые категории #265); CLI-прогон на конкретном экспорте не переисполнял — требует пересборки `test-build/*`, которую уже покрывает `npm test`/CI `frontend` | green по юнитам; независимая проверка через готовый CI-прогон (`frontend` job, SHA `9f54cbab`) — green |
| Смок-выборка | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 1 зарегистрированная связь: `demo/smoke_orphan_space_references.mjs` (прямых совпадений нет) |
| Целевые браузерные смоки | CI `smoke` (3 шарда) на SHA `9f54cbab` | green — оба изменённых файла (`smoke_backup_transfer.mjs`, `smoke_orphan_space_references.mjs`) в наборе, оба шарда green |
| `golden:verify` (diff меняет видимый результат import preview) | CI `golden` job на SHA `9f54cbab` (`Validate` run [32844271523](https://github.com/Matysh/houseplan-card/actions/runs/32844271523)) | **red** — см. находку H1 |
| `pytest tests_backend` (правки в Python) | CI `backend` job на SHA `9f54cbab` (полный HA-harness, Linux) — локально недоступно (нет `homeassistant`/`.venv-backend` в этой среде, `test_ha_*.py` тихо пропускаются без него, см. AGENTS.md) | green на CI — каноническое доказательство есть |
| `performance_smoke` | CI job на SHA `9f54cbab` | green (не в AC как обязательный, но CI уже покрыл) |

Все обязательные дешёвые гейты (`typecheck`, `test`, `build`+сверка бандла,
`check-docs`) прогнаны мной лично на этом дереве, а не только заявлены автором.
Тяжёлые гейты (`backend`, `smoke`, `golden`, `performance_smoke`) взяты из
завершённого прогона CI `Validate` на точном заявленном SHA — это тот же канон,
что требует `PROCESS.md` §8 для бета-гейта, и здесь он же служит независимым
подтверждением/опровержением для код-ревью.

## 3. Находки

### H1 (High) — `golden` красный на заявленном SHA для самого нового экрана; заявление автора о зелёном golden не подтверждается

**Где:** сценарий `backup-space-preview-mobile-ru` в `demo/golden/harness.mjs`
(строки, добавленные этим диффом: `repaired_target_refs`, `preserved_unresolved_refs`,
`reference_report` в моке `space`-превью) → `src/houseplan-card.ts:15925-15943` (новый
блок `backupwarn`/`backupdetails`) — не сопровождается обновлённым/принятым
`demo/golden/baselines/backup-space-preview-mobile-ru.png`.

**Воспроизведение:** CI `Validate` на точном SHA `9f54cbab7591ffba17ad3999bedeb70eba685aa9`
(run [32844271523](https://github.com/Matysh/houseplan-card/actions/runs/32844271523)),
job `golden` → шаг «Capture or verify golden matrix» завершается `exit code 1`,
единственная расходящаяся строка:
```
different         backup-space-preview-mobile-ru
```
Скачан артефакт `golden-images` этого прогона и сверены `actual/` и `diff/` для
этого сценария: diff-маска (сплошная magenta) покрывает практически весь
диалог — то есть baseline вообще не содержит новый контент, а не отличается на
пиксель. `actual/backup-space-preview-mobile-ru.png` при этом визуально
корректен: показывает ровно то, что требует §10 ТЗ и добавленные в этом же
диффе `src/i18n/ru.json` строки — «Существующих ссылок восстановлено этим
импортом: 3.», блок «Неоднозначные ссылки сохранены без изменений: 1. House
Plan ничего не угадывал и не удалял. После импорта запустите «Оптимизировать
планы»…» и раскрывающийся `▶ Подробности восстановления ссылок`. Логической
ошибки в самом рендере не нашёл — проблема ровно в том, что
`demo/golden/baselines/**` (class D, генерируется) не тронут этим диффом
(`git diff --stat origin/dev...HEAD` не содержит файлов `demo/golden/baselines/**`),
хотя сценарий, привязанный к изменённому экрану, обязан был получить новый
принятый baseline.

**Почему это прошло мимо автора:** в комментарии готовности к ревью автор
пишет «`npm run golden:capture` — все сценарии выполнены без runtime/semantic
failures». `golden:capture` — режим захвата, а не сравнения: он не отказывает,
если существующий baseline не совпадает с новым рендером, он просто
перезаписывает `actual/`. Раз baseline уже существует в репозитории, канонический
режим — `golden:verify` (тот же, что запускает CI при наличии baseline,
`demo/golden/README.md`/`AGENTS.md` §8), и именно он ловит расхождение. Заявленная
проверка технически не могла обнаружить эту находку — она не про то ложное
чувство уверенности, которое запрещено правилом «Verified без названной команды
и её результата не является доказательством»: команда названа верно, но её
режим не давал права на утверждение «зелёный golden», которое в отчёте
фактически прочитывается как «golden:verify».

**Почему это блокирует, а не Low:** §15.1 ТЗ прямо требует для AC10
«reviewed canonical golden import preview» как обязательное доказательство до
S7; на заявленном SHA это доказательство не просто отсутствует — CI по нему
красный. Смежное прошлое (`check-docs` в #230/#234, AGENTS.md §8) уже показало
цену пропуска именно такого шага: не пойманное здесь, оно оставит `dev` с
красным job `golden` до следующей задачи, которая случайно это заметит.

**Как чинится (в скоупе, без нового issue):** пересобрать golden с этого дерева,
прогнать `npm run golden:verify` локально (или взять уже готовый CI-артефакт
этого прогона), просмотреть `diff/backup-space-preview-mobile-ru.png`, принять
через `npm run golden:accept -- --reviewed` на полном Linux CI-артефакте с
трейлерами `Release:`/`Baseline-Reviewed:` в отдельном коммите. Механическая
правка, но обязательная перед повторным заходом.

### M1 (Medium, в скоупе) — нет backend-теста на успешный cross-generation lineage repair (только exact-map и ambiguous-fail покрыты)

**Где:** `tests_backend/test_ha_import_export.py`, раздел новых тестов (строки
1134–1259 в диффе). Матрица доказательств §15.1 ТЗ требует для AC2 «Backend
positive/live/ambiguous/type-mismatch tests», для AC3 — «Parameterized
unit/backend test каждой строки §8».

**Что есть:** `test_issue_244_space_import_repairs_existing_target_refs_with_exact_map`
(не новый, ранее существовавший — это exact-map: `marker["space"] == "ground"`
буквально совпадает с исходным id импортируемого пространства, не lineage);
`test_issue_265_cross_generation_target_repair_fails_closed_when_ambiguous`
(новый, но это отрицательный случай — сохраняет ссылку, потому что есть второй
живой кандидат того же lineage); `test_issue_265_target_marker_links_require_an_imported_light_target`
(тоже отрицательный, про `marker.controls`/light-семантику).

**Чего нет:** ни одного backend-теста, где мёртвая target-ссылка на
*прошлое поколение* (не exact-map, а именно каноническая lineage — например
`space_ground_<hash1>` при живом импорте, создающем `space_ground_<hash2>`, без
конкурирующего живого кандидата) успешно переносится в новое поколение
(`repaired_target_refs > 0` за счёт reason `"lineage"` в `_lineage_resolver`, а
не `"exact"`). Это ровно тот регресс, который сформулирован в теле issue #265
(«создаёт новый `space_f1_<hash2>`, но не переносит ссылку:
`repaired_target_refs == 0`») — то есть заглавный дефект задачи не имеет
положительного backend-доказательства фикса, только фронтенд-версия того же
алгоритма (`test/space-reference-repair.test.mjs`: «issue 265 Optimize resolves
an import-of-import lineage without guessing» — это TypeScript/Optimize сторона,
не Python/import сторона).

Прочитал код `_lineage_resolver`/`_repair_target_space_refs`
(`custom_components/houseplan/import_export.py:100-362`) построчно: логика
выглядит корректной для этого случая (кандидаты строятся из `id_maps` текущего
импорта, при отсутствии живого конкурента с тем же root возвращается
`"lineage"`) — поэтому не блокирую как High, отмечаю как «проверено чтением, не
исполнением» для положительного backend-пути, но это не заменяет обязательное
по ТЗ автотест-доказательство и не даёт «тесту, который умеет падать» для этой
конкретной ветки.

### M2 (Medium, в скоупе) — нет synthetic maximum-size backend теста, требуемого AC9

**Где:** та же матрица §15.1: «AC9 | Synthetic maximum-size backend test,
owner/TTL/limit security tests и code review отсутствия O(n²) lookup».
Owner/TTL/limit тест есть и не новый
(`test_preview_candidate_digest_and_global_memory_cap_are_enforced`), но он не
про размер одного candidate/report, тронутый этим диффом (`_REPORT_EXAMPLE_LIMIT`,
рост `reference_report` пропорционально числу владельцев/ссылок). Отсутствие
O(n²) я проверил чтением: `_lineage_resolver` строит `imported`/`live` словари
за один проход и дальше отвечает за O(1) на обращение; циклы по `spaces` →
`rooms`/`openings`, по `markers`, по `layout` — каждый одного прохода, без
вложенного полного сравнения. Но синтетического теста на реальный большой
конфиг (число owners/refs у предела `MAX_CONFIG_BYTES`) не добавлено — заявлено
в матрице доказательств как обязательное, доказательства по факту нет.

Оба M1/M2 — в скоупе этой же задачи, чинятся автором тут же (issue #202: свой
issue для Medium заводится только вне скоупа).

## 4. Что проверено и признано корректным (по AC)

- **AC1 (плоский lineage).** `canonical_import_root`/`_fresh` в Python
  (`import_export.py:809-848`) и `canonicalImportRoot` в TS
  (`space-reference-repair.ts:68-83`) реализуют один и тот же bounded-parser (≤16
  слоёв, строгий `^<prefix>_(.+)_([0-9a-f]{8})$`). Общий conformance-fixture
  `test/fixtures/import-id-lineage.json` покрывает: нулевой слой, один слой, два
  слоя, uppercase-хеш (не снимается), чужой namespace (не снимается), unicode
  root, 17-кратную обёртку (bounded=true на границе 16). Backend-тест
  `test_issue_265_python_lineage_matches_shared_fixture` и frontend-тест «issue
  265 Python/TypeScript lineage fixture stays strict and bounded» гоняют один и
  тот же fixture через оба языка — параллельная реализация не может тихо
  расползтись. `test_issue_265_import_of_import_flattens_every_owned_namespace`
  прогоняет реальный import-of-import через `build_space_merge` два раза и
  проверяет отсутствие `space_space_`/`room_room_`/`partition_partition_`/
  `opening_opening_` в результате — тест умеет падать: на старом коде (`_fresh`
  строил stem из `old` без канонизации) второй импорт детерминированно давал
  `space_space_f1_..._...`. Принято.
- **AC2 (безопасный cross-generation repair), кроме positive-ветки (см. M1).**
  Условия §6.2 ТЗ (мёртвая ссылка, ровно один совместимый живой кандидат,
  отсутствие exact live id, отсутствие второго живого кандидата) отображены в
  `_lineage_resolver.resolve()` построчно: `live_ids` проверяется первым (reason
  `"live"`), `exact_map` — вторым (`"exact"`), затем canonical root против
  `imported` с условием `len(candidates) == 1 and not live.get(root)` —
  это ровно «единственный кандидат и нет второго живого с тем же root».
  Ambiguous-путь и light-target-gate покрыты новыми backend-тестами и проходят
  на CI. Локальность владения (matrix-примечание §8: room/partition-ссылка не
  переписывается через границу пространств) реализована консервативно —
  `room.open_to`/`opening.host` целевых (не импортируемых) пространств никогда
  не перезаписываются, только помечаются в `preservedUnresolved`, что корректно
  соответствует правилу («существующего независимого пространства нельзя
  направлять в новую импортированную копию») — других target-пространств,
  которые сами были бы одновременно remap'нуты, в текущей архитектуре
  одного-пространства-на-импорт не бывает, поэтому эта строка матрицы §8
  безопасно никогда не переходит в фактический remap. Frontend-путь (Optimize)
  имеет свой positive-тест («issue 265 Optimize resolves an import-of-import
  lineage without guessing») — умеет падать: на старом однослойном regex
  `importedRoom`/`importedSpace` (двухслойные lineage-id) не матчились бы вовсе.
- **AC3 (полная матрица).** Каждая строка §8 представлена: `marker.space`,
  `marker.room_id`, `vacuum.segment_map`, `marker.controls`, `value_badge.ref`,
  `layout` (`rl_`, marker-key, `position.s`), `room.open_to`, `opening.host` — в
  коде `_repair_target_space_refs` и в `model-invariants.mjs`
  (`marker_room`/`vacuum_room`/`marker_control`/`marker_badge`/`room_open_to`/
  `opening_host`). Geometry carriers (`walls[*].key`, `open_spans`) не тронуты
  ни в одном из добавленных путей — подтверждено чтением: `_fresh`/lineage
  вызываются только для `_IMPORT_ID_NAMESPACES`, wall keys туда не входят.
- **AC4 (точный preview/apply).** `_candidate_digest` считает SHA-256 от
  canonical JSON (`sort_keys=True`) по всему материализованному кандидату
  (document, policy, revisions, `target_config`, `target_layout`, `details`).
  `prepare_apply` (import_export.py:1819-1840) больше не строит merge повторно —
  берёт `candidate["target_config"]/["target_layout"]/["details"]` буквально;
  `test_issue_265_apply_uses_the_exact_materialized_preview_candidate`
  monkeypatch'ит `_fresh` так, чтобы AssertionError бросался при повторном
  вызове — тест умеет падать (это была бы старая архитектура: apply вызывал
  `build_space_merge` заново). `revalidate_candidate` пересчитывает
  `target_config/target_layout/details/digest` заново при каждом вызове
  (`import_export.py:1763-1817`) — старое подтверждение обязано быть сброшено:
  проверено чтением фронтенда, `src/houseplan-card.ts:15720` и `:15802`
  сбрасывают `confirmMissing: false` в обоих местах, где вызывается revalidate
  (явный клик и авто-revalidate после конфликта revision). Существующий тест
  `test_preview_candidate_digest_and_global_memory_cap_are_enforced` (не новый,
  но актуален для нового `_candidate_digest`) подтверждает детекцию мутации
  кандидата — прошёл на CI backend.
- **AC5 (lossless unresolved/tombstone).** `_repair_target_space_refs` не
  фильтрует `removed: true` маркеры перед репарингом их полей (в отличие от
  `model-invariants.mjs`, который их явно игнорирует для invariant-проверки) —
  это корректно: обновление внутренних ссылок tombstone-записи не является ни
  переименованием, ни удалением самой записи, и держит её консистентной для
  будущего повторного добавления. `preserve_once`/`preservedUnresolved`
  никогда не удаляют исходные данные — только помечают.
- **AC6 (invariant gate).** Shared fixture parity — см. AC1. Мутанты новых
  категорий: `test/model-invariants.test.mjs` тест «#265: полный внутренний
  ссылочный граф...» одним вызовом ломает все 6 новых полей и проверяет, что
  `checkReferences` возвращает все 6 kind — до этого диффа ни один из них не
  существовал в `checkReferences`, то есть тест гарантированно падал на коде
  без фикса.
- **AC9 (в части O(n²) и секретов), кроме synthetic-size (M2).** Отсутствие
  квадратичной сложности проверено чтением (см. M2). `examples` ограничены
  `_REPORT_EXAMPLE_LIMIT = 24` на backend и дополнительно `.slice(0, 8)` на
  фронтенде; поля `owner`/`reference` — это plan-internal id, не секреты и не
  полные payload.
- **AC10 (i18n/доки), кроме принятого golden baseline — см. H1.** RU/EN ключи
  из §10 ТЗ добавлены синхронно в `src/i18n/en.json`/`ru.json`, названия
  совпадают со списком ТЗ буквально. `docs/USER-GUIDE.md`/`.ru.md` и оба
  `CHANGELOG` обновлены в том же коммите (`51810164`, `User-Visible: yes`) —
  трейлеры корректны, оба changelog присутствуют. Терминология
  («Оптимизировать планы», «Подробности восстановления ссылок») совпадает с
  уже принятой в `USER-GUIDE.ru.md` (не изобретена). «Одно число — один
  источник»: верхняя строка `backup.repaired_target_refs` и сумма
  `remapped.target` внутри `▶ Подробности` увеличиваются в одном и том же месте
  кода (`replace()` в `_repair_target_space_refs`, `repaired += 1` и
  `_report_remap(..., "target", ...)` — соседние строки одного `if`) — то же
  для `preserved_unresolved_refs`: и backend-сумма, и frontend-сумма читают
  один и тот же словарь `reference_report.preservedUnresolved`, посчитанный
  один раз. Расхождения источников не нашёл.
- **Трейлеры коммитов.** Все восемь коммитов диапазона несут `Issue: #265` и
  корректный `User-Visible:`; единственный `yes` (`51810164`) сопровождается
  правками обоих changelog в том же коммите — проверено `git show
  51810164 --stat`.

## 5. Чего не проверял

- Не переисполнял backend pytest локально — среда ревью не содержит
  `homeassistant`/`.venv-backend` (см. AGENTS.md: `test_ha_*.py` тихо
  пропускаются без реального HA). Каноническое доказательство взял из CI
  `backend` job на точном SHA — green, включая все шесть новых
  `test_issue_265_*` тестов и не изменённые тесты #244/#248/#252/#258/#262 (их
  прохождение на этом SHA подтверждает отсутствие регрессии от рефакторинга
  `_repair_target_space_refs`/`prepare_apply`, хотя ни один явно не назван по
  этим номерам в диффе — не стал заново перечитывать каждый построчно, доверяю
  зелёному прогону полного файла).
- Не гонял `npm run golden:capture`/`accept` и не пытался сам принять
  baseline — это шаг автора, не ревьюера (принятие требует
  `Baseline-Reviewed:` трейлера с реальной ссылкой на прогон, которую не
  вправе изобретать).
- Не прогонял полный `demo/smoke_*.mjs` набор (188 смоков) локально — доверился
  зелёным CI `smoke` (1)(2)(3) на этом SHA, которые включают весь набор, и
  выводу `smoke-select.mjs`.
- Не проверял вручную UI в браузере (ручного тестирования в цикле код-ревью
  нет по процессу) — визуальную корректность новой ветки диалога подтвердил
  через `actual/backup-space-preview-mobile-ru.png` из golden-артефакта CI, а
  не собственным запуском demo-стенда.
- Не перечитывал построчно код валидации geometry/wall carrier инвариантов —
  диф их не трогает (подтверждено `git diff --stat`), доверился этому факту, а
  не повторной проверке недвинутого кода.
- Performance-профили не запускал целенаправленно — в AC не названы явно,
  `performance_smoke` CI green попутно.

## 6. Итог

High: 1 (H1, golden красный на заявленном SHA для изменённого экрана — AC10 не
доказан). Medium: 2 (M1, M2 — пробелы в обязательной по §15.1 матрице
доказательств тестами; оба в скоупе, не блокируют логику, но не выполнены).
Ядро реализации (lineage-канонизация, safe cross-generation repair, матрица
ссылок, неизменяемый candidate/digest, invariant gate, i18n/доки) проверено
построчно и тестами CI на заявленном SHA и выглядит корректным — единственная
причина невозможности зелёного вердикта — недоказанный (и на деле красный)
AC10-гейт плюс два пробела тестового покрытия, требуемого тем же документом,
который автор сам утвердил на SPEC-REVIEW r3.
