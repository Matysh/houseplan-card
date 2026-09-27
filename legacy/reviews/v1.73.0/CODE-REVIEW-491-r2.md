# CODE-REVIEW-491-r2

Issue: [#491](https://github.com/Matysh/houseplan-card/issues/491) — «Optimize/Undo: не терять незавершённую парную транзакцию при следующей записи».
Материал ревью: ветка `issue/491-optimize-undo-pair-recovery`, **точный SHA `1787e505a192f400c363666b549dbcf46834d90f`** (рабочая копия уже на нём).
Заход: r2. Блокирующих циклов израсходовано: 1/4.
ТЗ: `docs/specs/491-optimize-undo-pair-recovery.md`, ревью ТЗ зелёное (`SPEC-REVIEW-491-r1`).

## Почему разбор полный, а не по дельте

Поверх материала r1 (`4ee83716`, ныне осиротевший после ребейза — SHA умер уже
после публикации отчёта r1, это обычное дело, PROCESS §2.10) легли 2 коммита
`dev` (`e0e68f25` #496, `9bfe7885` #503). После ребейза на ушедший вперёд `dev`
это другой код (§7.2), поэтому разбор — полный, не по дельте, как и предписано
в постановке раунда.

Проверка содержимым, а не доверием: `git diff 4ee83716 1787e505 --stat`
показывает изменения ровно в трёх файлах — `.github/workflows/process.yml`,
`scripts/mutation-gate.mjs`, `test/mutation-gate.test.mjs` — все три из
несвязанных с #491 коммитов `dev` (CI-инфраструктура ревью-экшна и
`package.json`-релевантность гварда). Ни один продуктовый Python-файл
(`store.py`, `websocket_api.py`, `__init__.py`), ни один `tests_backend/*.py`,
ни один файл документации #491 между r1 и r2 не менялся ни байтом. Это не
основание сократить объём разбора (диктует §2.10 полноту при ребейзе), но
объясняет, почему полный независимый разбор ниже приходит к тем же выводам,
что и r1, а не к новым дефектам в самом протоколе.

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
docs/reviews/CODE-REVIEW-491-r1.md            | 304 ++++++++++++++++++++
docs/reviews/SPEC-REVIEW-491-r1.md            | 165 +++++++++++
docs/specs/491-optimize-undo-pair-recovery.md | 385 ++++++++++++++++++++++++++
docs/specs/README.md                          |   1 +
scripts/mutation-gate.mjs                     | 111 ++++++++
tests_backend/test_ha_import_export.py        |  31 +++
tests_backend/test_ha_websocket.py            | 357 ++++++++++++++++++++++++
17 files changed, 1789 insertions(+), 141 deletions(-)
```

Backend-only (класс A: `custom_components/houseplan/*.py`; класс B:
`scripts/mutation-gate.mjs`, `tests_backend/**`; класс C: `docs/**`). `src/**`
не тронут — фронтенд браузерные гейты (smoke, golden, check-docs) вне
обязательного набора.

6 коммитов на ветке относительно `origin/dev`, все с `Issue: #491`; коммит
`488f70c4` (`User-Visible: yes`) несёт код и правки обоих changelog в одном
коммите.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium (в скоупе): AC6 («неразрешимый pending блокирует новый write») — защита в продуктовом коде, проверяется только дорогим HA-harness гейтом, не имела названного мутанта | Добавлен мутант `pair-recovery-fence-ignores-resolution-failure` в `scripts/mutation-gate.mjs`, патчащий `except Exception:` в `_resolved_write_pair` так, чтобы отказ `async_resolve_pending_pair` игнорировался и writer продолжал со свежим несведённым `ResolvedStorePair` вместо `commit_failed`; guard — `test_issue_491_failed_fence_blocks_point_write_and_keeps_intent` | Коммит `1787e505` (тот же код, что был в `4ee83716` до ребейза), `scripts/mutation-gate.mjs:7795-7818`. Проверено мной исполнением: `node scripts/mutation-gate.mjs --check --id=pair-recovery-fence-ignores-resolution-failure` → `ok pair-recovery-fence-ignores-resolution-failure` (якорь патча найден ровно один раз в текущем дереве, патч синтаксически валиден — `ResolvedStorePair(config_data=…, layout_data=…)` соответствует сигнатуре dataclass). Сам guard-тест (реальный HA-harness прогон, покрасит ли мутант тест) не воспроизведён ни мной, ни r1 — окружение по-прежнему без Python ≥3.14/HA (см. «Чего не проверял») |

## Унаследовано из r1

Поскольку разбор полный (см. выше), ниже перечислено не «пропущено», а то, что
я подтвердил **тем же способом, что r1** (чтение, не исполнение) и пришёл к
тем же выводам независимо, без изменений в самом коде между раундами:

- **Совместимость со старым форматом pending** (ветка `replace_metadata=False`
  в `async_converge_store_pair`, `store.py`) — код идентичен тому, что читал
  r1 (`docs/reviews/CODE-REVIEW-491-r1.md`, раздел «Разбор по коду», материал
  r1 `4c08b8ab`/`4ee83716`). Я перечитал эту ветку самостоятельно (см. ниже) и
  подтверждаю тот же вывод.
- **AC9 (форматы и совместимость) и AC7 (setup)** через существующие,
  нетронутые этим диффом тесты `test_setup_recovers_durable_import_pair` и
  `test_setup_recovers_exact_optimize_storage_roundtrip_pair` — я не
  перечитывал их текст заново построчно (r1 это сделал), полагаюсь на вывод
  r1: код `__init__.py`, который они покрывают, я перечитал сам и он не
  менялся между раундами.
- **Документация ARCHITECTURE/CONFIG-COMPATIBILITY/USER-GUIDE построчно
  сверена с кодом на материале r1** — я самостоятельно перепроверил
  `ARCHITECTURE.md` и `CONFIG-COMPATIBILITY.md` против кода (см. «Разбор по
  коду» ниже) и подтверждаю; `TESTING.md` перепроверил и нашёл новое
  расхождение (Low, см. «Находки»), которого в материале r1 быть не могло, так
  как мутант, о котором идёт речь, появился только в фиксе r1→r2.

Всё остальное — гейты, весь код `websocket_api.py`/`store.py`/`__init__.py`,
все девять точек `_resolved_write_pair`, тесты `test_issue_491_*` — я прочитал
заново сам в этом раунде (результаты ниже), а не принял на веру.

## Как проверялось

### Дешёвые гейты — прогнаны сам, на `1787e505`

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| JS unit | `npm test` | **2341 passed, 1 skipped, 0 failed** |
| Build + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | зелёный, побайтовое совпадение (ожидаемо: `src/**` не менялся) |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (0 строк в 0 файлах) |
| `smoke-select` | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «исполняемого frontend-диффа нет» — смоки не выбираются |
| `process-gate` (локально, свежий `origin/dev`) | `node scripts/process-gate.mjs --issues` | «диапазон origin/dev..HEAD, коммитов 6; гейт пройден, предупреждений 0» |
| Синтаксис Python | `python3 -m py_compile custom_components/houseplan/{store,websocket_api,__init__}.py` | OK |
| Python pure-subset | `python3 -m pytest tests_backend -q` (после `pip install pytest pytest-asyncio voluptuous`) | 395 passed, 4 skipped — **не проверяет новый код**: все `test_issue_491_*` живут в `test_ha_*.py`, который `conftest.py` пропускает без `homeassistant` |
| Мутант-якоря #491 (самостоятельная проверка, дешёвая) | `node scripts/mutation-gate.mjs --check --id=<5 id>` (все пять: `pair-recovery-config-writer-skips-fence`, `pair-recovery-point-writer-skips-fence`, `pair-recovery-fence-ignores-resolution-failure`, `optimize-skips-pair-retry-rollback`, `optimize-undo-skips-pair-retry-rollback`) | все пять: `ok` — патч-якорь найден в текущем дереве ровно один раз, синтаксически валиден |

Не прогонялись и почему:
- `golden:verify`, `check-docs.mjs`, browser-smoke — не нужны: `src/**` не
  менялся, `smoke-select` подтвердил пустой выбор.
- `npm run invariants` — диффа геометрии/ссылок нет. Проверил сам (не только
  со слов r1): `canonicalize_config_geometry`/`canonicalize_layout_geometry` в
  новой функции `async_converge_store_pair` (`store.py:282-283`) — это те же
  вызовы, что уже существовали в `layout_store_payload`/`async_save_config_state`
  (`store.py:172,220`, не тронуты этим диффом); новой геометрической
  трансформации диф не добавляет, меняется только протокол персистентности.
- `python -m pytest tests_backend -q` **с реальным Home Assistant** —
  недоступно: `pytest-homeassistant-custom-component==0.13.357` требует Python
  ≥3.14, в этом окружении только 3.12.3, других интерпретаторов нет,
  `.venv-backend` не создан. Ограничение то же, что было у r1 — окружение с
  тех пор не изменилось.

### Зелёный CI на этом SHA

**Не существует — Validate на `1787e505` красный**, а не просто «не найден»:
[прогон](https://github.com/Matysh/houseplan-card/actions/runs/34288755708),
job «Предполётные проверки» упал на `node scripts/process-gate.mjs
--github-range --issues`:

```
process-gate: диапазон 71aeb860791709b3011d280f65add13c92cb79f1..1787e505..., коммитов 8
FAIL п.8 статус issue -  issue #496: статус не проставлен, а нужен один из S5-ready / S6-in-progress / S7-code-review / S8-merged
```

Разобрано, а не списано на «гейт не тот»: issue #496 закрыт корректно (без
`S*`-метки — это правильное состояние закрытого issue). Диапазон `71aeb860..`
на 2 коммита шире, чем `origin/dev..HEAD` (`9bfe7885..HEAD`, 6 коммитов) —
`71aeb860` предшествует обоим приземлившимся на `dev` коммитам `e0e68f25`
(#496) и `9bfe7885` (#503, hotfix конвейера ревью). В `--github-range` режиме
`process-gate.mjs` резолвит базу через `mergeBaseWithDev`, вычисляемый по
`git fetch origin dev` **в момент самого CI-джоба** (23:01:53 UTC); похоже, в
эту секунду `origin/dev` на стороне GitHub ещё не был виден job'у с учётом
`e0e68f25`/`9bfe7885` (гонка с параллельным push хотфикса #503 в `dev`,
случившимся в разгар этого же цикла ревью — см. комментарии issue про
неотработавший конвейер 22:28–22:39). В диапазон попали два уже смёрженных,
не относящихся к #491 коммита, один из которых ссылается на закрытый issue —
и правило 8 фейлится по чужому, легитимно закрытому issue.

Проверено, а не предположено: тот же чек **сейчас**, со свежим
`git fetch origin dev` (`origin/dev` = `9bfe7885`, уже включает оба коммита):

```
$ node scripts/process-gate.mjs --issues
process-gate: диапазон origin/dev..HEAD, коммитов 6
гейт пройден, предупреждений 0
```

**Вывод:** красный Validate на `1787e505` — не дефект диффа #491, а гонка в
CI-инфраструктуре ревью (`scripts/process-gate.mjs` в режиме `--github-range`
чувствителен к моменту `git fetch` относительно параллельного push в `dev`).
Дефект не в скоупе #491 (класс B, чужая подсистема — CI-гейт, не
`custom_components/houseplan/*.py`) и заведён отдельно:
[#504](https://github.com/Matysh/houseplan-card/issues/504).

## Разбор по коду (проверено чтением, самостоятельно в этом раунде)

Перечитаны построчно `custom_components/houseplan/store.py` (весь diff:
`ResolvedStorePair`, `_pending_target`, `async_converge_store_pair`,
`async_resolve_pending_pair`), весь diff `custom_components/houseplan/websocket_api.py`
(`_resolved_write_pair`, `PairCommitFailure`, `_persist_pair_intent`,
`_converge_pair`/`_commit_pair` и все девять точек вызова) и diff
`custom_components/houseplan/__init__.py` (перенос resolver'а перед
square-canvas миграцией).

Ключевые проверки, которые я провёл сам (не переписывание вывода r1):

- **Порядок auth → fence проверен по всем девяти вызовам, не по выборке.**
  `grep` по файлу подтверждает: каждый вызов `_resolved_write_pair(hass,
  connection, msg["id"], rt)` (строки 532, 732, 794, 881, 1365, 1591, 1858,
  1978, 2167) стоит **после** ближайшего предшествующего `_check_write`
  (521, 725, 783, 868, 1357, 1574, 1845, 1963, 2158 соответственно) — во всех
  девяти writer'ах (5 ordinary + 4 paired по счёту ТЗ §5) permissions
  проверяются раньше recovery, ни разу наоборот.
- **`ws_layout_update` (point writer, AC4).** `data = resolved.layout_data`
  (восстановленный после fence документ), дельта `{**layout,
  msg["device_id"]: msg["pos"]}` применяется поверх него, `new_rev =
  int(data.get("rev", 0)) + 1` — считается от восстановленной ревизии, не от
  сырой. Соответствует ТЗ §7 п.4 буквально.
- **`ws_layout_set` (CAS writer, AC3/AC4).** `current_rev` берётся из
  `resolved.layout_data` **до** сравнения с `expected_rev` — устаревший клиент
  после recovery получает `conflict` по свежей ревизии, не тихий merge.
- **`_commit_pair` — идентичен бывшему `_commit_import_pair` по протоколу**
  (intent → converge → один retry → rollback intent → converge rollback →
  `PairCommitFailure`), переименован и обобщён, поведение Import/`space/delete`
  не меняется — только сообщение в логе.
- **`async_converge_store_pair` reload-vs-guess.** Оба try/except (config,
  layout) ловят исключение и **перечитывают** стор, сравнивая с точным
  ожидаемым payload (`if config_data != expected_config: raise` /
  `if layout_data != expected_layout: raise`) — решение об «успело записаться
  или нет» принимается по факту на диске, а не по типу исключения, буквально
  требование ТЗ §6.2.
- **`__init__.py` setup**: resolver (`async_resolve_pending_pair`) вызывается
  **до** square-canvas миграции; после миграции `optimize_revs` пересчитывается
  свежим чтением обоих store перед `hass.bus.async_fire`, событие не описывает
  устаревшую (домиграционную) ревизию.
- **Мутант-якоря — исполнено, не только прочитано.** Все пять патчей #491 в
  `scripts/mutation-gate.mjs` синтаксически валидны и уникально адресуют
  текущий код (`--check`, вывод выше). Это не доказывает, что HA-harness guard
  краснеет (недоступно в этом окружении — см. «Чего не проверял»), но
  исключает класс дефектов «мутант ссылается на текст, которого уже нет».

Дефектов, ломающих AC1–AC5, AC7–AC9, чтением не найдено — согласуется с
выводом r1, полученным независимо мной, а не переписанным с его документа.

## Находки

### High — 0

### Medium в скоупе — 0

Единственная Medium-находка r1 закрыта (см. «Закрытие раунда r1»).

### Medium вне скоупа — 1, заведена отдельным issue

**`process-gate.mjs --github-range` может дать ложный красный по правилу 8,
когда параллельный push в `dev` обгоняет `git fetch` внутри CI-джоба
ревьюемой ветки.** Разобрано выше в разделе «Зелёный CI на этом SHA».
Не в скоупе #491 (чужая подсистема — CI-инфраструктура, класс B в
`scripts/process-gate.mjs`, не `custom_components/houseplan/*.py`). Заведено:
[#504](https://github.com/Matysh/houseplan-card/issues/504) с метками
`process`, `P2`, `S1-new`, ссылкой на #491.

### Low — 1

**`docs/TESTING.md` не называет пятый мутант, добавленный фиксом r1.**

- Файл: `docs/TESTING.md`, пункт «An unfinished config/layout pair survives
  the next writer (#491)» (добавлен в исходном коммите `488f70c4`).
- Список `mutations:` перечисляет 4 идентификатора
  (`pair-recovery-config-writer-skips-fence`,
  `pair-recovery-point-writer-skips-fence`,
  `optimize-skips-pair-retry-rollback`,
  `optimize-undo-skips-pair-retry-rollback`), но не пятый —
  `pair-recovery-fence-ignores-resolution-failure` — добавленный **после**
  этого коммита, в фиксе r1→r2 (`1787e505`, ранее `4ee83716`), именно для
  закрытия AC6. Сама реализация и сам мутант корректны (см. «Закрытие раунда
  r1»); расходится только текст канонического списка доказательств в
  `TESTING.md`.
- Влияние: AC10 требует, чтобы Testing «фиксировал… точные команды
  доказательства» — сейчас читатель `TESTING.md` не узнает о существовании
  пятого, самого свежего мутанта, закрывающего именно AC6 (историю которого
  ТЗ и оба код-ревью подробно обсуждают). Функционально ничего не сломано:
  мутант существует, зарегистрирован в `scripts/mutation-gate.mjs`,
  проверен `--check`.
- Решение ревьюера: **снимается с записью**, без возврата на цикл. Причина —
  находка чисто текстовая (список из пяти строк, где не хватает одной),
  не затрагивает ни один AC по существу, её цена правки тривиальна и не
  соразмерна очередному циклу ревью при нулевых High. Если браться за неё —
  одна строка в `docs/TESTING.md`, добавляющая
  `` `pair-recovery-fence-ignores-resolution-failure` `` в список `mutations:`
  того же пункта; отдельный issue не требуется (Low, §2.7).

## Что проверено и корректно

- **AC1/AC2 (Optimize/Undo — общий retry/rollback).** Код идентичен
  проверенному в r1 материалу; я перечитал `ws_plan_optimize`/
  `ws_plan_optimize_undo` целиком заново — оба строят `pending`/`rollback` с
  `final_metadata` и идут через `_commit_pair`. Мутанты
  `optimize-skips-pair-retry-rollback`/`optimize-undo-skips-pair-retry-rollback`
  целятся именно в замену `_commit_pair` на голый
  `_persist_pair_intent + _converge_pair` — точное попадание в защищаемую
  строку (подтверждено якорем `--check`).
- **AC3/AC4 (ordinary writers резолвят pending до CAS/точечной записи).**
  Проверено самостоятельно по всем пяти ordinary-путям (`config/set`,
  `layout/set`, `layout/update`, `layout/delete`, `geometry/repair`):
  `_resolved_write_pair` вызывается до чтения revision/CAS/дельты; `layout/update`
  применяет дельту к `resolved.layout_data`, не к сырому.
- **AC5 (paired writers не начинают вторую пару поверх первой).** Общий
  `_resolved_write_pair` вызывается идентично во всех четырёх paired writer'ах
  — не дублированная логика. Мутанты AC3/AC4 покрывают тот же вход
  (`_resolved_write_pair`/fence), которым защищено и AC5; отдельного мутанта
  для AC5 ТЗ не требует (§13 AC5: «тесты и чтение кода общего входа») — это
  решение принято ещё на этапе спек-ревью, не пересматриваю.
- **AC6 (неразрешимый pending блокирует новый write).** Закрыто в этом
  раунде — см. «Закрытие раунда r1».
- **AC7 (setup завершает недоделанное).** `__init__.py`: resolver вызывается
  до square-canvas миграции, ревизии для события пересчитываются после
  миграции по свежему чтению — проверено самостоятельно, см. «Разбор по
  коду».
- **AC8 (one-deep семантика).** `_discard_optimizer_snapshot` по-прежнему
  вызывается в `config/set`; `layout/set`/`layout/update` по-прежнему
  передают `remove=(_OPTIMIZE_BACKUP, _OPTIMIZE_PENDING)`. Логика не менялась
  этим диффом (тот же код, что видел r1).
- **AC9 (форматы и совместимость).** Новых persisted-полей нет;
  `final_metadata`/`kind`/`clear_backup` — существовавшие поля. Legacy
  pending без `final_metadata` обрабатывается веткой `replace_metadata=False`
  — код идентичен материалу r1.
- **AC10 (документация).** `ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`,
  `USER-GUIDE(.ru).md` сверены мной построчно с кодом заново, расхождений
  нет; `docs/CHANGELOG.md`/`.ru.md` — в том же коммите `488f70c4`
  (`User-Visible: yes`), формулировки на пользовательском языке, без
  терминов реализации. `TESTING.md` — расхождение найдено, см. «Находки»
  (Low).
- **Трейлеры и процесс.** 6 коммитов, каждый с `Issue: #491`; ветка
  `issue/491-optimize-undo-pair-recovery`; `process-gate.mjs --issues`
  зелёный на актуальном `origin/dev` (см. «Как проверялось»); документов
  ревью на issue — 2 существующих (`SPEC-REVIEW-491-r1`,
  `CODE-REVIEW-491-r1`) плюс этот, лимит §10.2 п.7 не превышен.

## Чего не проверял

- **Исполнение HA-harness backend тестов** (`test_ha_*.py`, все 9 новых
  `test_issue_491_*`, все 5 мутантов #491 через реальный
  `backend-test-guard.mjs`) — недоступно в этом окружении: та же причина, что
  у r1, `pytest-homeassistant-custom-component==0.13.357` требует Python
  ≥3.14, доступен только 3.12.3. Проверено самостоятельно и переподтверждено
  сейчас, не только со слов r1. Все выводы по AC1–AC9 выше — чтение кода и
  сопоставление с тестами, не запуск; мутант-якоря проверены исполнением
  (`--check`), но не сам факт «гвард краснеет».
- **Зелёный CI на точном SHA `1787e505`** — существует, но красный, причина
  разобрана выше и не относится к #491 (заведено #504).
- **Golden/визуальные гейты, браузерные smoke, `check-docs`, `model-invariants`**
  — сознательно не прогонялись, обоснование в «Как проверялось» (нет `src/**`,
  нет геометрической трансформации, `smoke-select` вернул пустой список).
- **Ручное тестирование в HA** — вне цикла по PROCESS §2; не проводилось
  никем.

## Вердикт

Ноль High, ноль Medium в скоупе — единственная находка r1 закрыта
(подтверждено исполнением `--check`, не только чтением). Одна Medium-находка
вне скоупа заведена отдельным issue #504 и не возвращает #491 автору. Одна
Low-находка (устаревшая строка в `TESTING.md`) снята решением ревьюера с записью —
не соразмерна возврату на цикл.

Полный независимый разбор (обязателен из-за ребейза на ушедший вперёд `dev`,
§7.2/§2.10) не нашёл новых дефектов в протоколе: девять точек входа fence,
порядок auth→fence, retry/rollback и setup recovery проверены самостоятельно
и подтверждают выводы r1. Красный Validate на этом SHA разобран и отнесён к
гонке CI-инфраструктуры, не к диффу #491.

**Зелёный.**

---

<!-- material-anchors: заполняется конвейером (#414) -->

## Материал раунда

- Ветка: `issue/491-optimize-undo-pair-recovery`, коммит `1787e505a192f400c363666b549dbcf46834d90f`.
- Вердикт этого документа: `green` · High 0 · Medium 0 в скоупе / 1 вне скоупа (#504) · Low 1 (снята)

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/491-optimize-undo-pair-recovery`, коммит `4ee837168efd` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f8e79336179590bc03fa49c01388f34918e43436`
  ```
  git log --all --format='%H %T' | grep f8e793361795
  ```
- ТЗ `docs/specs/491-optimize-undo-pair-recovery.md`, блоб `c73fde225d4f284d917879b5c4a7a54d1ff7994e`
  ```
  git log --all --find-object=c73fde225d4f284d917879b5c4a7a54d1ff7994e -- docs/specs/491-optimize-undo-pair-recovery.md
  ```
- Вердикт конвейера: `green` · High 0
