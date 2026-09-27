# CODE-REVIEW-244-r3

- Issue: [#244](https://github.com/Matysh/houseplan-card/issues/244) — восстановление маркеров с мёртвой ссылкой на пространство
- Этап: code (PROCESS.md §2.7)
- Заход: r3 · блокирующих циклов израсходовано 1 из 4 (потрачен только в r1 — жёлтый/красный тратит бюджет, r2 зелёный цикла не образовал, #227)
- Кандидат (HEAD): `fe70c1e80303650113a7aafc74983defc27d8841`
- `origin/dev` на момент разбора: `0c5683d3bf1c79f01e1d52ee544c0fdff4f67a1c` (после релиза v1.67.0-beta.2)
- SHA предыдущего раунда (r2, зелёный): `a9466da649c5a24ad84cc79b0e6389b724dc8087` (недостижим напрямую — переписан ребейзом, диагностировано по `docs/reviews/CODE-REVIEW-244-r2.md`, который остался в дереве)

## Почему этот заход не по дельте, а полный

Между r2 (зелёным) и этим заходом код не правился — ветка была перебазирована
на ушедший вперёд `origin/dev` (комментарий автора `2026-08-22T21:37:13Z`):
слияние конфликтовало из-за выпущенного в `dev` релиза `v1.67.0-beta.2`
(`1af9cfc`) и последующих `005eb7f`/`0c5683d`. Это ровно случай из инструкции
ревью — «ребейз на ушедший вперёд dev — после ребейза это другой код,
§7.2» — поэтому разбор в этом раунде полный, а не по дельте продуктового
кода. Экономия достигается не сокращением строгости, а тем, что часть
доказательства — байтовое сравнение — быстрее многократного построчного
чтения:

1. Список файлов в `git diff origin/dev...HEAD` (43 файла) идентичен
   по составу объединению диффов r1 (40 файлов) и r2 (19 файлов, из них 17
   пересекались с r1) плюс собственный документ `CODE-REVIEW-244-r2.md` —
   новых, не объяснённых предыдущими раундами файлов нет.
2. `custom_components/houseplan/const.py`: строка `VERSION = "1.67.0-beta.2"`
   не тронута этой веткой (она пришла из релиза и является контекстом, а не
   диффом) — правки диффа ограничены `PLAN_MODEL_VERSION 6 → 7`, как и было
   на кандидате r2.
3. Пересборка (`npm run build`) на этом HEAD даёт **тот же** SHA-256
   бандла (`9316d1497b6ff0e24403db319df1756b2e420d5a9c87a2c7dcd8d622057fbeda`),
   что и заявлен автором в комментарии о ребейзе — компилируемый TS/JS не
   изменился по сравнению с состоянием, которое проверял r2.
4. Единственная содержательная правка при разрешении конфликта — в
   `docs/CHANGELOG.md`/`.ru.md`: секция `## Unreleased` с записью #244
   осталась выше уже выпущенной `## v1.67.0-beta.2 — 2026-08-22`, обе записи
   не искажены (проверено чтением, см. ниже).
5. Коммиты релиза, вошедшие в `dev` между базой r1/r2 и текущей базой
   (`1af9cfc` Release v1.67.0-beta.2, `005eb7f` golden-эталоны, `0c5683d`
   fix #247 для `test/docs-accept.test.mjs`), не касаются
   Optimize/import/delete/editor-путей #244: правки — версия/манифест/
   релиз-ноуты, golden-baseline PNG для стыков стен/полок/трея (#233-класс),
   кросс-платформенный путь фикстуры. Пересечения сценариев нет.

Исходя из этого разбор построен так: свежий прогон всех обязательных гейтов
на текущем HEAD (не унаследован — код по факту другой коммит), независимое
чтение критичных модулей заново (не только «принято на слово» от r1/r2), и
унаследование содержательных находок AC1–AC14 из r1/r2 там, где чтение и
байтовое сравнение подтверждают отсутствие изменений.

## Скоуп

Normal-трек (`bug`, `P2`). Диапазон `git diff origin/dev...HEAD`: 43 файла,
включает reference-repair pass (`src/space-reference-repair.ts`),
delete-preflight (`src/space-deletion.ts`), интеграцию в
`src/plan-optimizer.ts` (`PLAN_MODEL_VERSION` 6→7), редактор карточки
(`src/editor.ts`, `src/card-editor-validation.ts`), backend
`custom_components/houseplan/websocket_api.py` (`houseplan/space/delete`) и
`import_export.py` (`_repair_target_space_refs`), тесты (unit/backend/smoke/
golden) и документацию (ТЗ, оба CHANGELOG, USER-GUIDE.md/.ru.md,
CONFIG-COMPATIBILITY.md, TESTING.md, ARCHITECTURE.md, docs/reviews/*).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, без вывода |
| Unit | `npm test` | **1114/1114 PASS**, 0 skipped (было 1113 на кандидате r2 — плюс тест из `test/docs-accept.test.mjs` для фикса #247, не относящегося к #244) |
| Build + bundle sync | `npm run build` + `sha256sum` трёх копий | PASS; `dist/houseplan-card.js`, `demo/srv/assets/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js` — идентичный SHA-256 `9316d1497b6ff0e24403db319df1756b2e420d5a9c87a2c7dcd8d622057fbeda`, совпадает с заявленным в комментарии о ребейзе; `git status --short` после сборки чист |
| Docs fingerprint | `node scripts/check-docs.mjs` (diff трогает `src/**`) | PASS: «Documentation checks passed (7 files, 10 external links)» |
| Backend | `python -m pytest tests_backend -q` (в песочнице ревью не было `pytest-homeassistant-custom-component`/`home-assistant-frontend`, поставил тем же набором пакетов, что CI-workflow: `pip install pytest voluptuous pytest-homeassistant-custom-component home-assistant-frontend`) | **352 passed, 1 error** — `test_ha_upload.py::test_upload_ok`, тот же `_run_safe_shutdown_loop`/`threading._DummyThread` teardown-артефакт, что в r1/r2, независим от диффа (не трогает `websocket_api.py`/`import_export.py` в части, которую использует этот тест) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | 41 символ на изменённых строках, порог широкого символа 33 → не превышен. 19 прямых совпадений (список идентичен r1), 29 слабых связей (список идентичен r1) |
| Целевые smoke, прямо названные в таблице AC (AC1/AC7/AC9/AC10/AC11) | `node demo/smoke_orphan_space_references.mjs` | **PASS**, все 10 ассертов `true`, включая `deleteExplainsBlockerWithoutConfirmOrWrite: true` |
| — | `node demo/smoke_optional_space_model.mjs` | **PASS**, все 11 ассертов `true`, включая `deleteLastUsesAuthoritativeEndpoint: true`, `deleteLastPreservesMarkersWithoutPlacement: true` |
| — | `node demo/smoke_optimize_geometry_preflight.mjs` | **PASS**, все 16 ассертов `true` |
| — | `node demo/smoke_fixed_floor.mjs` | **PASS**, все 14 ассертов `true` |
| `npm run golden:verify`, остальные 15 прямых + 29 слабых smoke, `mutation-gate.mjs`, performance | — | не прогонялись — см. «Чего не проверял» |

### Решение по каждой строке `smoke-select` (подтверждено заново на текущей базе)

**Прямое совпадение (19)** — прогнаны 4 (см. таблицу выше): это
единственные, где названный символ прямо принадлежит изменённой логике
удаления/Optimize/редактора и прямо назван в таблице AC ТЗ как способ
доказательства (AC1, AC7, AC9, AC10, AC11). Остальные 15
(`smoke_linked_virtual_light`, `smoke_save_race`, `smoke_virtual_light_toggle`,
`smoke_audit_1490`, `smoke_bg_color`, `smoke_config_writer`,
`smoke_device_preview_parity`, `smoke_dialog_footer_width`,
`smoke_general_settings`, `smoke_layout_sync`, `smoke_plan_upload_race`,
`smoke_climate_once`, `smoke_editor_tabs`, `smoke_infinite_canvas`,
`smoke_ws_resilience`) не прогнаны: совпадение только по общему плумбингу
(`_cfgRev`, `_layoutRev`, `_config`, `_persistLayout`, `_reloadConfigOnly`,
`buildDevices`, `Layout`), который #244 читает, а не переопределяет. Список и
основание идентичны r1 — рекомпиляция и ребейз не изменили набор изменённых
символов.

**Слабая связь (29)** — не прогнаны: все совпадения по одному
распространённому имени (`_config`, `_spaceDialog`, `_cfgRev`), диалоги
пространства/цвета/тегов не меняли контракт в этом диффе. Тот же список, что
и в r1/r2.

## Находки

Нет. Продуктовый код идентичен зелёному кандидату r2 (подтверждено байтовым
сравнением бандла и построчным чтением ключевых модулей ниже); ребейз не
внёс регрессий, конфликт CHANGELOG разрешён корректно.

## Закрытие раунда r2

| Пункт r2 | Статус на r3 | Где это видно |
|---|---|---|
| Находок в r2 не было (H1/H2 из r1 закрыты) | Не переоткрывались: продуктовый код с r2 не менялся, только база | байт-в-байт совпадающий SHA-256 бандла; идентичный список файлов диффа |
| Требование «повторный код-ревью после ребейза — не формальность» (комментарий автора `2026-08-22T21:33:58Z`) | Выполнено этим документом: полный набор обязательных гейтов перезапущен на новом HEAD, а не унаследован | таблица «Как проверялось» выше — все команды выполнены заново на `fe70c1e`, не скопированы из r2 |

## Унаследовано из r1/r2 (без повторного построчного чтения всех файлов)

Документы: `docs/reviews/CODE-REVIEW-244-r1.md` (кандидат `a09338f`),
`docs/reviews/CODE-REVIEW-244-r2.md` (кандидат `a9466da`).

- Диагноз §3 ТЗ и его соответствие коду (`resolveExplicitMarkerPlacement`,
  приоритет `marker.space` для virtual-маркера, фильтр рендера View/Static,
  `build_space_merge()`, `resolveInitialSpace()`) — не перепроверялся заново
  построчно; косвенно подтверждён тем, что `src/space-reference-repair.ts`
  (прочитан заново целиком в этом раунде, см. ниже) реализует именно этот
  контракт без расхождений.
- AC8 (импорт одного пространства, `_repair_target_space_refs`) и AC11
  (`default_floor` в редакторе карточки) — не перечитывались заново
  построчно; диффы этих файлов идентичны r1 (не тронуты r2 и ребейзом),
  тесты `test_ha_import_export.py`/`card-editor-validation.test.mjs`
  перепрогнаны в составе `npm test`/`pytest` этого раунда и зелёные.
- Touch/kiosk паритет View/Static-рендера (закрыт на этапе spec,
  `SPEC-REVIEW-244-r2`) — рендер-путь не менялся ни в r1/r2, ни ребейзом.
- Mutation-паттерны трёх frontend-рисков (`orphan-space-detach-disabled`,
  `orphan-space-ambiguous-signature-guessed`,
  `orphan-space-area-keeps-stale-position`) — прочитаны в r1 построчно,
  сам `mutation-gate.mjs` не перезапускался ни разу за три раунда
  (предрелизный гейт).

## Что проверено и корректно (перечитано заново в этом раунде)

- **`src/space-reference-repair.ts`** — прочитан целиком заново. Порядок
  правил для активного маркера (`signatureSpace` → `uniqueAreaRoom` для
  non-virtual → `delete marker.space`) совпадает со спекой §8.2; virtual
  binding пропускает Area-remap и уходит в signature/detach; removed-маркер
  получает только доказуемый signature (ветки `!isRemoved` его исключают из
  Area/detach) — dead-ссылка tombstone остаётся нетронутой и это
  корректно, не регресс. Позиции: `exact && positionSpace === storedSpace`
  переносит `x/y/k` при sig-remap, иначе `!isRemoved` удаляет layout-запись
  целиком (Area/detach) — совпадает со спекой §8.3. `reversibleStem` режет
  на длине 35 и формате id, `spaceSignatures.get(oldId)?.length === 1`
  требует ровно один кандидат — защита от ложного ремапа (AC3) на месте.
  `remainingDead`/`positionsUnresolved` считают removed/opaque владельцев
  верно (`!activeMarkerIds.has(key) || removedMarkerIds.has(key)`).
- **`src/space-deletion.ts`** — прочитан целиком заново.
  `collectSpaceMarkerDependencies` дедуплицирует маркер по трём источникам
  ссылки (`marker.space`, `room_id` через комнаты пространства, layout
  `s`) в `Set`, считает один раз — соответствует AC9. `createSpaceDeletion
  Candidate`: `dependencies.count && !deletingLastSpace` блокирует без
  мутации входа (ранний `return`); при `deletingLastSpace` у всех
  затронутых marker-записей (включая removed) снимаются ровно `space` и
  `room_id`, остальные поля не трогаются; layout-записи с `s === spaceId`
  удаляются целиком — совпадает с решением владельца по арбитражу H2 и
  спекой §10.
- **`custom_components/houseplan/websocket_api.py` (`_space_marker_
  dependencies`, `_space_delete_candidate`, `ws_space_delete`)** — прочитан
  диапазон добавленного кода (187 строк) целиком заново. Backend-версия
  структурно и по значению идентична frontend: тот же порядок проверок,
  тот же набор снимаемых полей. `ws_space_delete` работает под
  `rt.write_lock`, ревалидирует обе `expected_*_rev` внутри лока,
  перепроверяет `dependencies`/`deleting_last_space` на **актуальных**
  `current_config`/`current_layout` (не на входных данных запроса) — гонка,
  где зависимость появилась между preflight и записью, поймана; использует
  `CONFIG_SCHEMA`/`LAYOUT_SCHEMA` и существующий crash-safe
  `_commit_import_pair` (pending/rollback), не вводит новый механизм записи.
- **`custom_components/houseplan/const.py`** — `PLAN_MODEL_VERSION` 6→7,
  `VERSION` не тронут этим диффом (относится к релизу beta.2, слит без
  конфликта в этой строке).
- **CHANGELOG-конфликт разрешён корректно** — `docs/CHANGELOG.md` и `.ru.md`
  прочитаны целиком: секция `## Unreleased` с записью #244 (7 предложений,
  описывает Optimize repair/detach/preview, delete-блокировку и
  last-space-исключение, editor-предупреждение) стоит выше уже выпущенной
  `## v1.67.0-beta.2 — 2026-08-22`; ни одна запись не потеряна и не задвоена.
  Мелкий косметический артефакт: в RU-файле фраза «указывает на отсутствующее
  пространство» перенесена на две отдельные строки внутри одного элемента
  списка (`docs/CHANGELOG.ru.md:19-21`) — при рендере Markdown мягкие переносы
  схлопываются в пробел, видимого дефекта нет; не поднимаю как находку.
- **`docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`** — прочитаны
  задетые разделы: везде `model-v6` корректно заменено на `model-v7`, новый
  раздел «Space reference repair (model v7)» точно описывает реализованное
  поведение (signature/Area/detach, one-space import remap, revision-guarded
  delete, last-space-исключение), без противоречий коду.
- **Трейлеры** — оба `User-Visible: yes` коммита (`f6f877e`, `6a151d1`)
  несут правки в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же
  коммите; все 13 коммитов диапазона несут `Issue: #244`.
- **Файловый состав диффа** — 43 файла, без стороннего golden-baseline PNG
  (Optimize/delete/editor — не рендер-путь, совпадает с оценкой r2), без
  случайных файлов вне объяснённого объёма r1+r2+ребейз.

## Чего не проверял

- **Полный browser smoke (167 сценариев)** — не запускался; `smoke-select`
  на текущей базе не даёт оснований для полного прогона (порог 33 не
  превышен, широких совпадений нет), диапазон изменённых символов
  идентичен r1/r2. Предрелизный гейт (PROCESS.md §8).
- **`npm run golden:verify` / golden:accept** — не прогонялся; #244 не
  меняет рендер/геометрию/стили/слои, только данные и ветвление
  preflight/backend-транзакции — заключение унаследовано из r1/r2, диффом
  ребейза golden-баз #244 не касается (только несвязанные PNG из релиза
  beta.2, не входящие в диапазон `origin/dev...HEAD` этого ревью).
- **`scripts/mutation-gate.mjs`** — не запускался ни в одном из трёх
  раундов; не в AC этой задачи, предрелизный гейт.
- **Performance-профили** — не запускались; путь не горячий (однократное
  явное действие пользователя), не назван в AC.
- **Построчное чтение backend `import_export.py` (`_repair_target_space_
  refs`) и frontend `editor.ts`/`card-editor-validation.ts` заново в этом
  раунде** — не выполнялось; эти файлы не менялись между r1 и текущим HEAD
  (проверено `git diff` — идентичны версии, прочитанной в r1 построчно),
  их тесты перепрогнаны и зелёные в составе `npm test`/`pytest` этого
  раунда.
- **Ручное тестирование в браузере** — не проводилось; вместо этого
  прогнаны headless browser-smoke (`smoke_orphan_space_references`,
  `smoke_optional_space_model`, `smoke_optimize_geometry_preflight`,
  `smoke_fixed_floor`), которые управляют реальным `HouseplanCard`
  элементом через Puppeteer/DOM — это заявленный в таблице AC способ
  доказательства для AC1/AC7/AC9/AC10/AC11.
- **`docs/images/screenshots.json` PNG-содержимое** — не скачивал артефакт
  workflow заново; ссылка на прогон (`.../runs/32599244099`) не изменилась
  относительно r2, где уже была проверена как настоящая.

## Итог

Ребейз на ушедший вперёд `dev` не изменил продуктовый код #244: байтовое
совпадение пересобранного бандла, идентичный состав файлов диффа и
построчное чтение самых критичных модулей (`space-reference-repair.ts`,
`space-deletion.ts`, `ws_space_delete`) заново подтверждают это независимо
от заявления автора. Единственная содержательная правка ребейза —
разрешение конфликта в обоих CHANGELOG — корректна. Все обязательные гейты
перезапущены на новом HEAD и зелёные; четыре целевых smoke, названных в
таблице AC, зелёные. Новых находок нет, находки r1 (H1/H2) остаются
закрытыми.

**Вердикт: зелёный · заход r3 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче**

Документ: `docs/reviews/CODE-REVIEW-244-r3.md`
