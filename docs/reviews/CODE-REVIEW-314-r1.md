# CODE-REVIEW-314-r1

Issue: [#314](https://github.com/Matysh/houseplan-card/issues/314) — Model v8: рисование комнат
отклоняется, draft IDs теряются, возможны ложные перегородки.

Ветка: `issue/314-v8-draft-write-regression`. Материал ревью: диапазон
`origin/dev...HEAD`, вершина `ce18012fb9f3c2addc957f19360a1beb9dbf96f7`
(`git rev-parse HEAD`, сверено непосредственно перед подведением итогов — §2.7).
Спека: `docs/specs/314-v8-draft-write-regression.md`. Спек-ревью r1 зелёное,
High: 0, Medium: 0 (комментарий issue от `claude`, 2026-08-26T05:38:59Z).
Заход код-ревью: **r1** — первый реальный прогон; две предыдущие попытки
(06:05:40Z, 06:10:57Z) не состоялись из-за конфликта ребейза на `dev` и не
расходуют бюджет циклов (код не читался, вердикта не было).

## Скоуп

18 файлов, +1219/-196: `src/houseplan-card.ts`, `src/wall-segment-model.ts`,
`custom_components/houseplan/validation.py`, новый
`demo/smoke_v8_draft_write.mjs`, `test/wall-segment-model.test.mjs`,
`tests_backend/test_wall_segment_model.py`, два мутанта в
`scripts/mutation-gate.mjs`, документация (`ARCHITECTURE.md`,
`CONFIG-COMPATIBILITY.md`, `TESTING.md`, оба `CHANGELOG`, `specs/README.md`),
сгенерированные копии бандла и `docs/images/screenshots.json` (только
`sourceFingerprint`, `imageSha256` не изменился — визуал не тронут).

Три коммита класса A/B несут поведение и трейлеры `Issue: #314`; коммит с
поведением (`2347e8df`, `User-Visible: yes`) правит оба changelog в том же
коммите. Два後 hoc-коммита (`0e18038c`, `ce18012f`) — правки provenance
скриншотов и статуса спеки после ребейза, `User-Visible: no`, без
продуктового кода — проверено чтением diff каждого.

## Как проверялось

### Дешёвые гейты (гоняются в каждом раунде, §2.10)

| Команда | Результат |
|---|---|
| `npx tsc --noEmit` | зелёный |
| `npm test` | 1336 passed, 1 skipped |
| `npm run build` + `cmp dist/… custom_components/…` + `bundle:sync` | три копии бандла байт-в-байт идентичны (SHA-256 `29f2d4c7…`) |
| `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» — обязателен, diff трогает `src/**` |

### Смоки — выбор по дельте, не весь набор

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` даёт 46 прямых
совпадений и 50 слабых (порог «широкого» превышен: 29 символов на
изменённых строках). Причина раздутого числа прямых совпадений —
`_frame`/`_modelCache`/`_wallUnionCache`/`_physicalBodiesCache = null` внутри
нового `_rollbackRejectedPhysicalWrites`: это стандартная идиома
инвалидации кэша, которая уже встречается по всему файлу, а не признак
того, что диф действительно затрагивает рендер/юнионы стен/junction-логику.
Полный прогон 46+ смоков здесь не задача ревью — это предрелизный масштаб.
Прогнаны сам как ревьюер, независимо от заявленного автором списка:

| Смок | Результат | Почему выбран |
|---|---|---|
| `smoke_v8_draft_write.mjs` (новый) | OK, 11/11 | прямое совпадение, написан для #314 |
| `smoke_config_writer.mjs` | OK | прямое совпадение, ядро write-serialization |
| `smoke_lattice_write_barrier.mjs` | OK | прямое совпадение, `_pendingPhysicalWrites` — центральная структура фикса |
| `smoke_room_autoclose.mjs` | OK | прямое совпадение, AC5 закрывает комнату тем же путём |
| `smoke_unified_wall_tool.mjs` | OK | прямое совпадение, `_draftSegmentCms`/`_geometryHistory` в цепочке рисования |
| `smoke_wall_chain_merge.mjs` | OK | прямое совпадение, промоушен draft→partition — риск root cause C |
| `smoke_save_race.mjs` | OK | прямое совпадение `_reloadConfigOnly`, ровно про очередь записи под конфликт |
| `smoke_ws_resilience.mjs` | OK | прямое совпадение `_reloadConfigOnly`, отказ WS/восстановление |

Первые шесть — то же, что назвал автор в хендоффе; `smoke_save_race` и
`smoke_ws_resilience` добавлены мной: они прямо совпадают по
`_reloadConfigOnly`, который получил новую ветку вызова
(`_reloadRejectedPhysicalWrite`), и не были явно упомянуты в отчёте автора.
Остальные 38 прямых и все 50 слабых совпадений не прогонялись — они
объясняются тем же кэш-инвалидационным идиомом или общими полями
(`_maybeRebuildDevices`, `_cfgRev` в несвязанных смоках устройств/освещения),
без содержательной связи с сегментной identity, stale-guard или rollback.

`golden:verify` не запускался: визуальный результат не меняется —
`imageSha256` во всех 10 сценариях `screenshots.json` идентичен дифу,
только `sourceFingerprint` сдвинулся вслед за `src/**`.

### Бэкенд — реально исполнено, не переписано с чужих слов

В песочнице изначально не было `homeassistant`; установил его
(`pip install homeassistant`, кэшированные wheels, ~15 c) и прогнал:

- `python -m pytest tests_backend/test_wall_segment_model.py -q` →
  **13 passed** — совпадает с заявленным автором числом;
- `python -m pytest tests_backend -q --ignore-glob="tests_backend/test_ha_*.py"` →
  206 passed, 1 skipped, 1 failed. Упавший тест —
  `test_coordinate_canonicalization.py::test_storage_helpers_are_the_final_canonical_barrier`,
  падает из-за отсутствия плагина `pytest-asyncio` в этой песочнице
  (`async def functions are not natively supported`), файл дифом не
  тронут — не регрессия #314, а гэп окружения.
- `test_ha_*.py` пропущены офлайн-частью (нет `pytest-homeassistant-custom-component`),
  как и предупреждает `AGENTS.md`: «зелёный результат без HA ничего не
  доказывает» — сказано прямо здесь, а не заявлено «verified».

### Мутационные гейты — оба новых мутанта проверены лично

```
node scripts/mutation-gate.mjs --id=v8-draft-sanitation-shifts-segment-identity
  → поймано 1 из 1
node scripts/mutation-gate.mjs --id=v8-rejected-physical-write-keeps-optimistic-draft
  → поймано 1 из 1
```

### Дисциплина «тест умеет падать» — проверено самостоятельно, не со слов автора

Спека требует для AC5: «Тест обязан падать на `dev` до исправления». Поднял
временный `git worktree` на `origin/dev@98a0a24` (до фикса), перенёс туда
**только** новый `demo/smoke_v8_draft_write.mjs` и `tests_backend/test_wall_segment_model.py`,
собрал бандл этой (старой) ветки и прогнал:

- `node demo/smoke_v8_draft_write.mjs` на pre-fix коде →
  завершается некэймд-исключением (`Cannot read properties of undefined
  (reading '0')` — `server.spaces[0].room_drafts` пуст, потому что fake WS
  отверг payload с `v8 draft wall segments require ids` ровно как
  предсказывает root cause A), exit code 1;
- `pytest -k "test_current_v8_independent_geometry… or test_downgraded_independent_partition_round_trip_is_hydrated"`
  на pre-fix `validation.py` → оба падают с
  `WallModelClientOutdatedError: stored model=8; unchanged wall catalogue` /
  `submitted model=0` — ровно root cause B.

Оба падения воспроизводят ровно те симптомы, которые ТЗ приписывает
исходному багу. Тесты не декоративны.

### Инварианты модели — не прогонялись, с обоснованием

Диф не трогает вычисление рёбер/толщины (`degradeWalls`, `commitWallSegmentModel`,
`deterministicWallSegmentId`) и не меняет `layout`/`marker.space`/`open_spans`.
Правки исчерпываются: (a) сохранением уже существующего client-side
`draft.segments[].id` при санитации/Undo — сама геометрия точек не
пересчитывается, дедуп той же функцией `samePoint`, что и раньше; (b) веткой
сравнения на backend, определяющей, что считать «изменением каталога»; (c)
атомарным откатом уже существующего `SpaceGeometryState`. Ни один из трёх
классов дефектов, для которых заведены инварианты (#253 потеря записи
толщины, #244/#252 неразрешимая ссылка, #258/#259 несовпадение ключа записи
толщины с ключом решёточного ребра), этой правкой не затрагивается: draft ID
— клиентский временный идентификатор с префиксом `draft:`, а не решёточный
ключ. `npm run invariants` сознательно не прогонялся.

## Находки

### Medium (в скоупе, чинится в этом issue) — M1: не поставлен обязательный тест AC8

**Файл:** `docs/specs/314-v8-draft-write-regression.md` (контракт) vs
отсутствие соответствующего теста в дифе.

Раздел «Обязательные регрессионные тесты» реви́юенного (зелёного) ТЗ прямо
требует:

> минимизированная обезличенная fixture из отчёта владельца: исправление не
> меняет существующие намеренные стены и не создаёт новых invariant
> violations.

AC8 называет способ доказательства «model-invariant unit + review кода».
В дифе нет ни одной синтетической fixture в форме отчёта владельца (13
комнат / 44 wall_segments / 24 partitions / 1 draft с уже существующим
`unusable_draft`), и нигде в новых тестах не вызывается
`npm run invariants` / модуль `scripts/model-invariants.mjs` — я проверил
это `grep` по всему дифу, совпадений нет. Единственный имеющийся прокси —
блок `sanitationPreservesExistingIndependentObjects` в
`demo/smoke_v8_draft_write.mjs`: это синтетическая пара «одна intentional
partition + один intentional draft», подтверждающая, что `_dropLegacySegments()`
их не роняет, но она не воспроизводит масштаб/плотность реального отчёта и
не считает инварианты вообще — только присутствие ID.

**Почему это не «нашёл к чему придраться»:** сама спека ставит именно этот
тест в раздел «Обязательные», и спек-ревью r1 прошло по контракту, где этот
пункт уже был. Раз AC8 не имеет требуемого автотеста, по §2.7 остаётся
только «проверено чтением, не исполнением» — и чтением я могу подтвердить
первую половину claim (существующая логика фильтрации/дедупа `partitions`
и `wall_columns` в `_dropLegacySegments()` дифом не тронута, значит
персистентные объекты не удаляются новым кодом), но не вторую («не создаёт
новых invariant violations» на реалистично плотном плане) — это по природе
эмпирическое утверждение, а не то, что можно установить чтением diff'а.
Риск невысокий (никакая изменённая ветка не пишет геометрию заново), но
контракт, под который заведено зелёное ревью ТЗ, не выполнен буквально.

**Воспроизведение отсутствия:** `git diff origin/dev...HEAD | grep -i invariant`
даёт только упоминания в тексте спеки/спек-ревью, ни одного исполняемого
вызова.

**Что нужно:** синтетическая (обезличенная) fixture с формой отчёта
владельца — несколько комнат, независимые partitions, один заведомо
`unusable_draft` — и тест/скрипт-прогон `npm run invariants` до/после
операции «нарисовать и закрыть новую комнату», сравнивающий число findings.
Либо, если автор считает это избыточным против уже имеющегося покрытия
(AC5–AC7 через `smoke_v8_draft_write.mjs` косвенно проверяют тот же риск
через `rejectionCannotCreateGhostPartition`), явно снять пункт из ТЗ по
согласованию — но не оставлять расхождение между зелёным спек-ревью и
не выполненным пунктом молча.

Других High/Medium/Low находок нет.

## Проверка AC — сводно

| AC | Доказательство | Статус |
|---|---|---|
| AC1 (ID переживают sanitation) | `test/wall-segment-model.test.mjs` unit + `tests_backend` schema, оба прогнаны | подтверждён |
| AC2 (Undo сохраняет lineage) | `smoke_v8_draft_write.mjs: successfulWriteHasStableIds`, прогнан | подтверждён |
| AC3 (валидные independent writes не stale) | `test_current_v8_independent_geometry_does_not_require_contour_catalog_change`, прогнан, падает на pre-fix | подтверждён |
| AC4 (настоящий stale writer блокируется) | 3 сохранённых негативных backend-теста, прогнаны в составе 13/13 | подтверждён |
| AC5 (комната сохраняется end-to-end) | `smoke_v8_draft_write.mjs`, реальный click/close/reload путь; лично проверено падение на pre-fix `dev` | подтверждён |
| AC6 (rejected write не оставляет transient geometry) | `rejectionRollsBackSynchronously`/`rejectionCannotCreateGhostPartition`, прогнаны; код `_rollbackRejectedPhysicalWrites` прочитан построчно | подтверждён |
| AC7 (успешная очередь не теряет новую команду) | `successQueueIsSerialized`/`successQueueRetainsF2`, прогнаны; логика earliest-`before`/selective-fingerprint-очистки прослежена по коду вручную (F1/F2 сценарий) | подтверждён |
| AC8 (данные владельца не чистятся молча) | частично: код-ревью подтверждает «не удаляет», «не плодит новые violations» не доказано автотестом | **см. M1**, дочитано, не подтверждено полностью |
| AC9 (совместимость/View/touch) | `imageSha256` неизменны, compatibility-тесты в составе 206 backend passed, UI-веток в дифе нет (grep по `render`/`html\`` в патче пуст вне уже обсуждённых мест) | подтверждён |
| AC10 (документация и локальный гейт) | все команды выше зелёные, `ARCHITECTURE/CONFIG-COMPATIBILITY/TESTING/CHANGELOG×2` обновлены в том же коммите | подтверждён |

## Что проверено чтением, не исполнением

- Полная логика `_writeConfig()`/`_rollbackRejectedPhysicalWrites()` для
  сценария «F1 в полёте, F2 создан локально, F1 отклонён» — прослежена по
  ссылкам объектов в `Map`, подтверждено, что `strictEntries` держит старую
  ссылку, а `_pendingPhysicalWrites.get()` во время отката возвращает
  актуальную запись с исходным (earliest) `before` — откатываются обе
  команды на общую базу, как требует AC7. Смоковый сценарий это же
  подтверждает эмпирически (см. таблицу выше), чтение было для проверки
  «почему», а не единственным доказательством.
- `_restoreGeometryStateInConfig()` (не новый код, не в дифе) — подтверждено,
  что при вызове без `preserveIdentityHints` (как в новом rollback-пути) он
  делает полную замену полей геометрии, а не merge — соответствует
  «восстановить earliest snapshot» из §6.3.
- `_cancelPath()` vs `_clearGeometryGesture()`: в rollback-пути используется
  именно `_clearGeometryGesture()`, которая (в отличие от `_cancelPath()`) не
  кладёт отклонённый `_activeDraftId` в `_resumeDraftBySpace` для
  последующего «возобновления рисования» — иначе отвергнутый draft мог бы
  быть предложен пользователю повторно тем же ID. Это осознанный и
  правильный выбор, не описанный явно в тексте спеки, но соответствующий
  её духу (п. 3 §6.3: «Undo или смена инструмента не могли воскресить
  отклонённый draft»).
- Backend-проекции `_catalog_coupled_wall_geometry_projection` /
  `_wall_catalog_projection`: построчно сверены со спекой §5.1/§5.2,
  расхождений нет.

## Чего не проверял

- `npm run invariants` — не прогонялся, см. обоснование выше и находку M1.
- `npm run golden:verify` — не прогонялся: визуальный вывод не меняется
  (byte-equal `imageSha256`), AC9 явно говорит «не меняют визуальный
  результат», основание не «пропуск», а отсутствие предмета проверки.
- Полный набор `demo/smoke_*.mjs` (192 файла) и «слабые связи» (50 файлов из
  вывода `smoke-select.mjs`) — не прогонялся; это предрелизный масштаб
  (§8), выбраны только прямые совпадения с содержательной связью к дифу
  (см. таблицу «Как проверялось»).
- `tests_backend/test_ha_*.py` — недоступны без
  `pytest-homeassistant-custom-component`, канон для них — Linux CI.
- Performance-профили — не названы в AC, диф не в горячем пути рендера.
- Реальный экспорт владельца (13 комнат/44 сегмента/24 partitions) —
  недоступен в этой сессии и не должен коммититься сырым; именно его
  отсутствие как обезличенной fixture — предмет M1.

## Итог

High: 0. Medium: 1, в скоупе задачи (M1 — отсутствует обязательный по ТЗ
регрессионный тест AC8 на реалистичной обезличенной fixture с проверкой
инвариантов). Все остальные девять AC подтверждены прогнанными автотестами
или отслеживаемым по коду рассуждением; для двух самых рискованных
сценариев (AC3, AC5) лично воспроизведено падение на pre-fix `dev`.
Вердикт — жёлтый: без High это возврат автору на доработку в рамках
текущего issue, не новый issue (#202).
