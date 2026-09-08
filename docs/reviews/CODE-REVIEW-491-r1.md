# CODE-REVIEW-491-r1

Issue: [#491](https://github.com/Matysh/houseplan-card/issues/491) — «Optimize/Undo: не терять незавершённую парную транзакцию при следующей записи».
Материал ревью: ветка `issue/491-optimize-undo-pair-recovery`, **точный SHA `4c08b8abfca4a81240f98d654cc4766faae8ec58`** (рабочая копия уже на нём).
Заход: r1. Блокирующих циклов израсходовано: 0/4.
ТЗ: `docs/specs/491-optimize-undo-pair-recovery.md`, ревью ТЗ зелёное (`SPEC-REVIEW-491-r1`, `S5-ready`).

## Скоуп диффа

`git diff origin/dev...HEAD --stat`:

```
custom_components/houseplan/__init__.py       |  86 ++----
custom_components/houseplan/store.py          | 151 ++++++++++
custom_components/houseplan/websocket_api.py  | 251 ++++++++++++-----
docs/ARCHITECTURE.md                          |  26 +-
docs/CHANGELOG.md                             |   5 +
docs/CHANGELOG.ru.md                          |   7 +
docs/CONFIG-COMPATIBILITY.md                  |  20 ++
docs/TESTING.md                               |  15 +
docs/USER-GUIDE.md                            |   7 +
docs/USER-GUIDE.ru.md                         |   8 +
docs/reviews/SPEC-REVIEW-491-r1.md            | 165 +++++++++++
docs/specs/491-optimize-undo-pair-recovery.md | 385 ++++++++++++++++++++++++++
docs/specs/README.md                          |   1 +
scripts/mutation-gate.mjs                     |  87 ++++++
tests_backend/test_ha_import_export.py        |  31 +++
tests_backend/test_ha_websocket.py            | 357 ++++++++++++++++++++++++
16 files changed, 1461 insertions(+), 141 deletions(-)
```

Изменение backend-only (класс A: `custom_components/houseplan/*.py`; класс B:
`scripts/mutation-gate.mjs`, `tests_backend/**`; класс C: `docs/**`). `src/**`
не тронут — фронтенд-гейты (typecheck, smoke, golden, check-docs) вне
обязательного набора для этого диффа.

4 коммита на ветке, все с `Issue: #491`; коммит `ba52a10f` (`User-Visible: yes`)
несёт весь код и правки обоих changelog в одном коммите — трейлеры и правило
«документация в том же коммите» соблюдены.

## Как проверялось

### Дешёвые гейты — прогнаны сам, на `4c08b8ab`

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| JS unit | `npm test` | **2318 passed, 1 skipped, 0 failed** |
| Build + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | зелёный, бандл побайтово совпадает (ожидаемо: `src/**` не менялся) |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (0 строк в 0 файлах — diff не по TS) |
| `smoke-select` | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет... браузер-smoke этим диффом не выбираются» — прогон смоков не нужен |
| `process-gate` | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» |
| Синтаксис Python | `python3 -m py_compile custom_components/houseplan/{store,websocket_api,__init__}.py` | OK |
| Python pure-subset | `python3 -m pytest tests_backend -q` (после `pip install voluptuous==0.15.2`) | 395 passed, 4 skipped — **не проверяет новый код**: `test_ha_*.py` пропущен, `conftest.py` игнорирует эти файлы без `homeassistant` |

Не прогонялись и почему:
- `golden:verify`, `check-docs.mjs`, browser-smoke — не нужны: `src/**` не
  менялся, видимый рендер не меняется, `smoke-select` подтвердил пустой выбор.
- `npm run invariants` — диффа геометрии/ссылок (`layout`, `marker.space`,
  `open_spans`, записи толщины) нет; меняется только протокол персистентности
  уже существующих config/layout документов, не их геометрическое содержимое.
- `python -m pytest tests_backend -q` **с реальным Home Assistant** —
  недоступно в этом окружении. `tests_backend/requirements.txt` пинует
  `pytest-homeassistant-custom-component==0.13.357`, который требует
  Python **>=3.14**; в песочнице стоит Python 3.12.3, и других версий на
  машине нет (проверено — `python3.13`/`python3.14` отсутствуют,
  `.venv-backend` не создан). Установка `pip install -r
  tests_backend/requirements.txt` падает на резолвере с этой причиной.
  Все AC1–AC9 этой задачи доказываются исключительно HA-harness тестами —
  этот гейт я не смог исполнить и не подтверждаю его результат экспериментально.

### Зелёный CI на этом SHA

По условиям раунда — не найден. Разработчик в хендоффе ссылается на
`exact-SHA CI 98c1923e` и «полный HA backend harness в WSL: 728 passed» — оба
прогона сделаны **до** ребейза на `dev` (конфликт был только в
`docs/specs/README.md`, попытка слияния без ревью отклонена ботом,
issue-комментарий от `2026-09-08T22:06:57Z`). Ни тот прогон CI, ни WSL-прогон
не относятся к точному SHA `4c08b8ab`, который является материалом этого
ревью. Ребейз, по описанию владельца, тронул только строку в
`docs/specs/README.md` (список ТЗ, класс C) — не код; я не могу
пере-проверить это побайтово, потому что предребейзный SHA `98c1923e` уже не
резолвится локально (обычное дело после ребейза, PROCESS §2.10), но
`git diff origin/dev...HEAD` для файлов класса A/B, который я разбирал ниже,
не содержит ничего, что выглядело бы как след мержа/конфликта.

**Вывод:** ни один AC этой задачи не подтверждён исполнением HA-harness ни
мной, ни зелёным CI на этом точном SHA. Все AC1–AC10 ниже доказаны
**чтением, не исполнением** — с указанием, что именно я проследил по коду и
какому сценарию из существующих тестов это соответствует.

## Разбор по коду (проверено чтением)

Прослежены построчно: `custom_components/houseplan/store.py` (новые
`ResolvedStorePair`, `_pending_target`, `async_converge_store_pair`,
`async_resolve_pending_pair`), `custom_components/houseplan/websocket_api.py`
(`_resolved_write_pair`, `PairCommitFailure`, `_persist_pair_intent`,
`_converge_pair`→`_commit_pair`, все точки вызова в `ws_import_apply`,
`ws_layout_set/update/delete`, `ws_geometry_repair`, `ws_config_set`,
`ws_space_delete`, `ws_plan_optimize`, `ws_plan_optimize_undo`) и
`custom_components/houseplan/__init__.py` (перенос recovery до миграции
square-canvas).

Ключевые находки чтения (все — «работает корректно», не дефекты):

- **Разрешение конфликта write fence vs auth.** Во всех восьми writer'ах
  `_check_write`/`_runtime` вызываются **до** `_resolved_write_pair` —
  предположение ТЗ №5 («проверка permissions остаётся до fence») выполнено
  (проверено на `ws_layout_set` L710, `ws_config_set` L1588,
  `ws_plan_optimize` L1963 и т.д.).
- **Совместимость со старым форматом pending.** `async_converge_store_pair`
  ветвится по `isinstance(pending.get("final_metadata"), dict)`. Ветка
  `replace_metadata=False` — дословно перенесённая из старого
  `custom_components/houseplan/__init__.py` (был: `if not replace_metadata
  and not pending.get("clear_backup") and "optimize_backup" in lay_stored: ...`)
  логика сохранения backup по `clear_backup`; существующий
  `test_setup_recovers_exact_optimize_storage_roundtrip_pair`
  (`tests_backend/test_ha_import_export.py:2282`, не тронут этим диффом)
  по-прежнему использует старый формат (`clear_backup: False`, без
  `final_metadata`) и по коду обязан пройти тот же путь — AC9 для setup
  подтверждён без изменений в самом тесте, только в реализации, которая
  теперь общая.
- **Идемпотентность recovery.** Для нового формата (`replace_metadata=True`)
  запись config пропускается, если `config_data.get("config") ==
  target_config and config_rev == target_config_rev`; запись layout
  выполняется всегда (это и есть операция, которая в последний момент снимает
  `optimize_pending`) — соответствует §8 ТЗ («target уже записан в обе
  половины... повтор удаляет intent без нового смыслового состояния»).
- **Постоянный порядок операций в setup** (`__init__.py`): resolver теперь
  вызывается **до** square-canvas миграции (раньше — после), с явным
  комментарием о причине; после миграции `optimize_revs` пересчитывается
  свежим чтением обоих stores перед `hass.bus.async_fire`, так что событие не
  описывает уже устаревшую (домиграционную) ревизию.
- **`_commit_pair`** — прямое переименование бывшего `_commit_import_pair`
  (intent → converge → retry once → rollback intent → converge rollback →
  `PairCommitFailure`), протокол не менялся, только обобщено имя и убраны
  специфичные для импорта строки лога; поведение для Import/`space/delete`
  не отличается от `dev` кроме сообщения в логе.
- **Мутационный трейс AC6 вручную** (пояснение ниже, в разделе находок):
  прочитан код `_resolved_write_pair`, при отказе `async_resolve_pending_pair`
  функция шлёт `commit_failed` и возвращает `None`; вызывающий writer делает
  ранний `return`. Гипотетическая мутация «проглотить исключение и продолжить
  со свежим (не сведённым) состоянием» превратила бы
  `test_issue_491_failed_fence_blocks_point_write_and_keeps_intent` в
  проходящий *успешный* ответ вместо `commit_failed` — то есть тест по факту
  умеет её ловить. Это прослежено по коду, не исполнено.

Дефектов, ломающих AC1–AC5, AC7–AC10, чтением не найдено.

## Находки

### Medium (в скоупе, чинится в этой же задаче) — 1

**AC6 не имеет названного мутанта, хотя защита живёт в продуктовом коде и
проверяется исключительно дорогим HA-harness гейтом.**

- Файл: `custom_components/houseplan/websocket_api.py`, функция
  `_resolved_write_pair` (обработка исключения `async_resolve_pending_pair` →
  `commit_failed`, без записи и без удаления pending/backup).
- Доказательство AC6 в хендоффе: `test_issue_491_failed_fence_blocks_point_write_and_keeps_intent`.
  Третий столбец таблицы «чем краснеет» в хендоффе — «exact Store pair и
  pending сравниваются до/после»: это описание проверок самого теста, а не
  название мутации/снятой защиты/отдельной отрицательной пробы с
  результатом прогона.
- PROCESS.md §2.7: «Мутант ... обязателен, когда защита живёт в продуктовом
  коде и проверяется дорогим гейтом (смок, бэкенд, golden): там ревьюер не
  воспроизведёт отрицательный прогон второй раз... Пустой третий столбец —
  находка Medium, а не примечание». AC6 — ровно такая защита (backend,
  дорогой гейт, я сам не смог исполнить HA-harness в этом окружении и не могу
  подтвердить «падает» без названного мутанта — см. раздел «Чего не
  проверял»).
- Сценарий отказа без исправления: если протокол recovery когда-нибудь
  сломают правкой рядом (например, вернут `return ResolvedStorePair(...)`
  вместо `return None` в except-блоке), ни один существующий мутант в
  `scripts/mutation-gate.mjs` этого не поймает — 4 добавленных мутанта
  (`pair-recovery-config-writer-skips-fence`,
  `pair-recovery-point-writer-skips-fence`,
  `optimize-skips-pair-retry-rollback`,
  `optimize-undo-skips-pair-retry-rollback`) целятся в отсутствие вызова
  fence, а не в то, что происходит, когда fence **сам возвращает ошибку**.
- Что требуется: мутант в `scripts/mutation-gate.mjs`, патчащий
  `_resolved_write_pair` так, чтобы отказ `async_resolve_pending_pair`
  игнорировался и writer продолжал со свежим (не гарантированно сведённым)
  состоянием, с guard на `test_issue_491_failed_fence_blocks_point_write_and_keeps_intent`
  (или новый более специфичный тест) и подтверждённым результатом прогона —
  либо эквивалентная запись «снял защиту руками, прогнал, вот вывод» в
  документации задачи. Без High-находок это влечёт жёлтый вердикт раунда;
  находка в скоупе issue #491 (сам мутационный гейт для этой задачи, п.5
  «HA-harness fault-injection тесты» из раздела 4 ТЗ) и правится в этой же
  ветке, отдельный issue не заводится.

### Low — 0

Не найдено.

## Что проверено и корректно

- **AC1/AC2 (Optimize/Undo — общий retry/rollback).** Прочитаны
  `ws_plan_optimize`/`ws_plan_optimize_undo` целиком: обе теперь строят
  `pending`/`rollback` с `final_metadata` и идут через `_commit_pair`, тот же
  примитив, что Import/`space/delete`. Тесты
  `test_issue_491_optimize_failure_restores_before_pair`,
  `test_issue_491_optimize_undo_failure_restores_pre_undo_pair`,
  `test_issue_491_optimize_fail_after_final_write_is_success` монтируют
  реальный `monkeypatch` на `Store.async_save` (не подмену чистой функции) и
  сверяют **точное** содержимое обоих store после отказа — структурно
  корректный дизайн теста, ловит и «до записи», и «после durable записи»
  сбой. Названные мутанты `optimize-skips-pair-retry-rollback`,
  `optimize-undo-skips-pair-retry-rollback` целятся именно в замену
  `_commit_pair` на голый `_persist_pair_intent + _converge_pair` — точное
  попадание в защищаемую строку.
- **AC3/AC4 (ordinary writers резолвят pending до CAS).** Все шесть
  ordinary-путей (`config/set`, `layout/set`, `layout/update`,
  `layout/delete`, `geometry/repair`) вызывают `_resolved_write_pair` до
  чтения revision/CAS; `layout/update` — единственный без CAS — применяет
  дельту к `resolved.layout_data` (восстановленному), не к сырому. Мутанты
  `pair-recovery-config-writer-skips-fence` и
  `pair-recovery-point-writer-skips-fence` целятся именно в удаление вызова
  fence на этих двух путях.
- **AC5 (paired writers не стартуют вторую пару поверх первой).**
  Общий `_resolved_write_pair` вызывается идентично во всех четырёх paired
  writer'ах (`import/apply`, `space/delete`, `plan/optimize`,
  `plan/optimize_undo`) — не дублированная логика, а один и тот же вызов.
  Для `import/apply` и `space/delete` есть прямые тесты
  (`test_issue_491_import_apply_fences_an_older_pending_pair`,
  `test_issue_491_space_delete_fences_before_pair_revisions`); для
  `plan/optimize`/`plan/optimize_undo` — только чтение кода (тот же вызов на
  той же позиции), что соответствует принятому в ТЗ доказательству («тесты и
  чтение кода общего входа»).
- **AC7 (setup завершает недоделанное).** `__init__.py` использует тот же
  `async_resolve_pending_pair`; порядок операций (resolver → geometry
  migration → пересчёт revs → событие) не даёт события со старой ревизией.
  Существующий `test_setup_recovers_durable_import_pair` (не изменён, но
  проходит по общему коду) и `test_setup_recovers_exact_optimize_storage_roundtrip_pair`
  закрывают одновременно новый и legacy формат pending.
- **AC8 (one-deep семантика).** `_discard_optimizer_snapshot` по-прежнему
  вызывается в конце `config/set` после успешной обычной правки (инвалидирует
  backup); `layout/set`/`layout/update` по-прежнему передают
  `remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING)`. Логика инвалидации backup
  обычным edit'ом не менялась.
- **AC9 (форматы и совместимость).** Persisted-схема не меняется: новых
  ключей нет, `final_metadata`/`kind`/`clear_backup` — уже существовавшие
  поля, используемые как общий протокол. Legacy pending без `final_metadata`
  обрабатывается веткой совместимости (см. выше).
- **AC10 (документация).** `docs/ARCHITECTURE.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/TESTING.md`,
  `docs/USER-GUIDE(.ru).md` описывают ровно реализованный протокол (write
  fence до CAS/no-op, retry→rollback, порядок setup, отсутствие новых
  persisted-полей) — сверено построчно с кодом, расхождений нет.
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в одном коммите с кодом
  (`ba52a10f`, `User-Visible: yes`).
- **Трейлеры и процесс.** 4 коммита, каждый с `Issue: #491`; ветка
  `issue/491-optimize-undo-pair-recovery`; `process-gate.mjs` зелёный
  локально.

## Чего не проверял

- **Исполнение HA-harness backend тестов** (`test_ha_*.py`,
  включая все 8 новых `test_issue_491_*`) — недоступно в этом окружении:
  `pytest-homeassistant-custom-component==0.13.357` требует Python ≥3.14,
  доступен только 3.12.3, других интерпретаторов на машине нет.
  Соответственно не проверены исполнением и 4 новых мутанта в
  `scripts/mutation-gate.mjs` (`node scripts/backend-test-guard.mjs ...`
  тоже требует HA). Все выводы по AC1–AC9 в разделе выше — чтение кода и
  сопоставление с существующими (не тронутыми) тестами, не запуск.
- **Зелёный CI на точном SHA `4c08b8ab`** — не существует на момент
  ревью (условие раунда). Прогон, на который ссылается хендофф разработчика,
  сделан на предребейзном SHA `98c1923e`, недоступном для сверки.
- **Golden/визуальные гейты, браузерные smoke, `check-docs`,
  `model-invariants`** — сознательно не прогонялись, обоснование в разделе
  «Как проверялось» (нет `src/**`, нет геометрии, `smoke-select` вернул пустой
  список).
- **Ручное тестирование в HA** — вне цикла по PROCESS §2; не проводилось
  никем.

## Вердикт

Один Medium в скоупе задачи (отсутствие мутационного свидетеля для AC6),
High нет. По PROCESS §2.7/§4 это жёлтый вердикт: цикл возврата автору, без
отдельного issue — правка (мутант или эквивалентная запись прогона со снятой
защитой) делается в той же ветке `issue/491-optimize-undo-pair-recovery`.

Основная реализация (общий crash-resumable commit-протокол, write fence,
setup recovery, обратная совместимость) при чтении кода выглядит корректной
и хорошо согласованной с ТЗ; дешёвые гейты зелёные. Возврат вызван узким
процессным требованием к доказательству одного защитного AC, а не сомнением
в самом протоколе.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/491-optimize-undo-pair-recovery`, коммит `4c08b8abfca4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `697d7e922c8b91078551d280f65add13c92cb79f`
  ```
  git log --all --format='%H %T' | grep 697d7e922c8b
  ```
- ТЗ `docs/specs/491-optimize-undo-pair-recovery.md`, блоб `c73fde225d4f284d917879b5c4a7a54d1ff7994e`
  ```
  git log --all --find-object=c73fde225d4f284d917879b5c4a7a54d1ff7994e -- docs/specs/491-optimize-undo-pair-recovery.md
  ```
- Вердикт конвейера: `yellow` · High 0
