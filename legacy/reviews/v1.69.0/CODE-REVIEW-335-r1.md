# CODE-REVIEW-335-r1

Issue: #335 «Трейлы пылесосов: осиротевшие маркеры навсегда остаются в
store, точки после рестарта не сохраняются» · этап code · заход r1 ·
блокирующих циклов израсходовано 0 из 2

SHA под ревью: `1d818905` (после rebase на `origin/dev`, конфликт был
только в двух changelog — см. комментарий владельца в issue).
`origin/dev` на момент ревью: `dd093625`.

## Скоуп

Задача — light track (small), ТЗ живёт в теле issue #335, прошло
SPEC-REVIEW r1 (жёлтый) → r2 (зелёный, `docs/reviews/SPEC-REVIEW-335-r2.md`).
Один issue-коммит `1d818905` «Fix vacuum trail lifecycle persistence»
(`Issue: #335`, `User-Visible: yes`), диапазон `origin/dev..HEAD`:

```
custom_components/houseplan/__init__.py      |   7 +-
custom_components/houseplan/trails.py        |  82 ++++++++++++++----
custom_components/houseplan/websocket_api.py |  39 ++++-----
docs/CHANGELOG.md                            |   6 ++
docs/CHANGELOG.ru.md                         |   6 ++
docs/TESTING.md                              |   5 ++
docs/VACUUM.md                               |   6 +-
tests_backend/test_ha_websocket.py           |  68 +++++++++++++++
tests_backend/test_trail_recorder.py         | 121 +++++++++++++++++++++++++++
9 files changed, 295 insertions(+), 45 deletions(-)
```

Одна backend-поверхность (`TrailRecorder` + три websocket-хендлера +
`__init__.py`), без миграции конфига, без изменений `src/**`, без
геометрии. Соответствует заявленному small-треку.

Продуктовая рамка (`docs/SCOPE.md`): серверные трейлы — часть J1
(«live spatial overview») через `docs/VACUUM.md`. Исправление
устраняет утечку хранения и потерю данных о живом положении —
внутри J1, новых продуктовых поверхностей не добавляет.

## Как проверялось

Прочитан полный `git diff origin/dev...HEAD` (500 строк) построчно,
включая `custom_components/houseplan/trails.py` целиком (414 строк) и
контекст всех трёх мест вызова в `websocket_api.py` (`ws_config_set`,
`ws_import_apply`, `ws_plan_optimize_undo`) и `__init__.py`
(`recovered_import`). Сверено с `docs/VACUUM.md` (новый абзац) и с
телом issue (AC1–AC4).

### Гейты — что прогнано и результат

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit` | прогнан | чисто, без вывода |
| `python -m pytest tests_backend/test_trail_recorder.py -q` (pure, без HA) | прогнан | 30 passed |
| `python -m pytest tests_backend/test_ha_websocket.py -q` (HA harness, `pytest-homeassistant-custom-component` установлен в этом раунде) | прогнан | 61 passed, 1 error |
| `npm test` | прогнан | 1461 passed, 0 failed, 1 skipped |
| `npm run build` + сверка бандла | прогнан | `git status` после build чист — три копии бандла совпадают |
| `git diff --check` | прогнан | чисто |

**Про 1 error в `test_ha_websocket.py`.** Падает
`test_issue_244_space_delete_is_authoritative_and_revision_guarded` —
тест не про пылесосов и не тронут диффом (пространства/маркер
`virtual`). Ошибка — `AssertionError` в teardown fixture `hass`
(`pytest-homeassistant-custom-component`) о постороннем потоке
`_run_safe_shutdown_loop`, не о ассертах теста. Перепроверено:
тот же прогон на чистом `origin/dev` (`dd093625`, отдельный
`git worktree`) даёт идентичную ошибку — `60 passed, 1 error`, тот же
трейсбек. Это окружение-специфичный флейк текущего Linux-раннера, не
регрессия этого диффа. Целевой новый тест
`test_config_set_purges_tombstoned_and_absent_trails_durably` вошёл в
61 passed.

### Гейты — что не прогонялось и почему

- `node scripts/check-docs.mjs` — не требуется: диф не трогает
  `src/**` (только `custom_components/**/*.py` и docs).
- `npm run invariants` — не требуется: диф не трогает геометрию,
  `layout`, `marker.space`, `open_spans`, рёбра комнат.
- Browser-smoke (`demo/smoke_*.mjs`) — проверено инструментом:
  `node scripts/smoke-select.mjs --base origin/dev --head HEAD` →
  «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут).
  Browser-smoke этим диффом не выбираются». Смоки гоняют собранную
  карточку, диф в неё не попадает.
- `npm run golden:verify` — не требуется: диф не меняет рендер,
  геометрию, стили или слои (чистый backend).
- «Одно число — один источник»: диф не добавляет и не меняет ни
  одной пользовательски видимой величины (никаких новых чисел на
  экране), проверка неприменима.

## Разбор по AC

**AC1 — очистка при `config/set`.**
Реализовано общим методом `TrailRecorder.async_purge_orphans(config)`
(`trails.py:252-274`): живой marker-id = «`id` присутствует и
`removed is not True»`, ровно граница, которую уже использует
`async_refresh` (`trails.py:169-171`) и `import_export.live_layout`
(`import_export.py:175-177`). Вызывается из `ws_config_set`
(`websocket_api.py:1409`) **после** `async_save_config_state` (durable
write уже совершён) и **всё ещё под `rt.write_lock`** — комментарий в
коде (`websocket_api.py:1405-1408`) явно называет причину: не дать
следующему `config/set` воскресить маркер между коммитом и решением
об удалении трейла. Доказано тестом
`test_config_set_purges_tombstoned_and_absent_trails_durably`
(`test_ha_websocket.py:291+`): удалены и tombstone (`removed: true`),
и полностью отсутствующий id (`hard_drop`), проверены и in-memory
`recorder.book.data`, и долговечный `recorder.store` — обе половины
контракта из ТЗ («marker-id отсутствует в памяти recorder и в
долговечном trail store»). Тест умеет падать: без правки старый код
проверял только полное отсутствие `id` (`live_marker_ids` без
фильтра `removed`), tombstone остался бы в `recorder.book.data`, и
`assert set(recorder.book.data) == {"live", "hidden"}` не прошёл бы.

**AC2 — никаких побочных удалений.**
`live`/`hidden` (без `removed: true`) сохраняются — то же тест
подтверждает построчно. No-op write не запускает очистку: прочитано
по коду, не на слово автора — семантический no-op в `ws_config_set`
возвращается на `websocket_api.py:1375` **до** присвоения `new_rev` и
до `async_save_config_state`, то есть до строки с покупкой purge
(`1409`); ветка ошибки валидации/`missing_plan`/`conflict` возвращает
раньше по коду ещё сильнее. Дополнительно доказано тем же
websocket-тестом (вторая часть, `test_ha_websocket.py:344-356`):
повторная отправка того же `candidate` с прежним `expected_rev`
получает `noop["result"]["rev"] == removed["result"]["rev"]`, а
искусственно добавленный `late_orphan` остаётся и в памяти, и в
сторе — прямое доказательство, что no-op не чистит. Неуспешная запись
(ошибка валидации) не покрыта отдельным websocket-тестом, но граница
доказана чтением кода (задокументировано выше) — приемлемо, так как
она структурная (ранний `return`), а не условная логика, которую
легко сломать будущей правкой незаметно.
`hidden`-без-`removed:true` не считается удалением — подтверждено тем
же тестом (маркер `hidden` в обоих сравнениях). `disabled` в контракте
относится к HA-статусу источника (`_source_failure_reason`), не к
полю конфига маркера — `async_purge_orphans` его не читает вовсе,
семантика верна по построению.

**AC3 — долговечность refresh-точки.**
`async_refresh()` теперь агрегирует `changed` по всем `src` в одном
проходе и вызывает общий `_handle_sample_change(changed, now)`
(`trails.py:190-194`, `397-403`) — тот же метод, которым пользуется
`_on_state`. Доказано pure-тестом
`test_refresh_persists_and_announces_a_new_startup_sample_once`
(`test_trail_recorder.py:370-411`, входит в 30 passed): первый refresh
с новой точкой планирует ровно одно сохранение (`SAVE_DELAY_S`) и
шлёт ровно одно `houseplan_trail_updated`; повторный refresh без
изменений не планирует второе и не шлёт второе событие. Тест умеет
падать: до правки `async_refresh` вызывал `self._sample(...)` без
использования результата и без вызова `_handle_sample_change` —
`scheduled` и `hass.bus.fired` остались бы пустыми, оба ассерта не
прошли бы.

**AC4 — единая семантика и регрессии.**
Общий helper `async_purge_orphans`/`_async_delete_many` используется
во всех четырёх местах: `ws_config_set`, `ws_import_apply` (kind
`full`), `ws_plan_optimize_undo` (`restored_kind == "import"`) и
`__init__.py` recovered_import при старте (`async_purge_orphans` →
`async_refresh`, тот же порядок, что и в websocket-хендлерах: purge
до refresh — согласовано). Прежний дублирующийся цикл `for marker_id
in ... if marker_id not in live_marker_ids: await
recorder.async_delete(marker_id)` (по одному «store.async_save» на
маркер, без единой границы `removed`) заменён везде на один вызов.
Регрессии: `test_trail_delete_prunes_pair_and_replaces_subscription`
(явный `houseplan/trail/delete`, `async_delete` теперь тонкая обёртка
над `_async_delete_many`) и вся остальная сюита backend + frontend
зелёные (см. таблицу гейтов). Откат/повтор при сбое стора покрыт
новым `test_failed_orphan_store_write_rolls_back_and_can_be_retried`
(`test_trail_recorder.py`, входит в 30 passed) — при ошибке
`store.async_save` `book.data`/`pairs`/подписка откатываются, событие
не летит, повторный вызов успешен. Это не было отдельным AC, но
предотвращает конкретный сценарий регрессии («сбой записи стора при
purge насовсем теряет живой маркер») — засчитано как часть «единой
семантики», не отдельная находка.

## Что проверено и корректно (не в составе AC, но задето диффом)

- Единственность источника собранного конфига для purge:
  `ws_config_set` передаёт в `_purge_trail_recorder` тот же
  провалидированный объект `msg["config"]`, что и в
  `async_save_config_state` (после `msg["config"].clear();
  msg["config"].update(checked)` на `websocket_api.py:1326-1327`) —
  проверено чтением, drift между сохранённым и очищаемым конфигом
  невозможен структурно.
  `ws_import_apply`/`ws_plan_optimize_undo` аналогично используют
  `target_config`/`restored_config` — те же объекты, что были
  закоммичены в `_commit_import_pair`.
- `docs/VACUUM.md` обновлён в том же коммите ровно тем текстом,
  который описывает новый контракт («backend reconciles both a
  removal tombstone and a completely absent marker… after every
  successful config change… An initial position sampled during
  integration startup follows the same debounced persistence and
  live-update path as a later state event») — соответствует коду.
- `docs/TESTING.md` дополнение точно называет оба файла доказательства
  (`test_ha_websocket.py` + `test_trail_recorder.py`) и описывает
  ровно то поведение, которое тесты проверяют.
- Трейлеры коммита: `Issue: #335`, `User-Visible: yes`; оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в том же коммите
  `1d818905`, формулировки согласованы между языками и с телом ТЗ.
- Порядок `purge → refresh` (не наоборот) согласован во всех четырёх
  местах вызова — не было явно потребовано ТЗ, но убирает
  потенциальный разнобой между вызовами.

## Находки

Нет находок серьёзности High или Medium. Ниже — только замеченная,
но не блокирующая асимметрия, снятая без правки.

- В `ws_config_set` purge держится под `rt.write_lock` с явным
  комментарием о защите от гонки «commit → purge»; в
  `ws_import_apply`/`ws_plan_optimize_undo` purge вызывается уже
  **после** выхода из `write_lock` (как и было устроено в прежнем
  коде — сам факт блокировки на время цикла удаления там никогда не
  держался). Диф не увеличивает и не уменьшает это несоответствие
  относительно `origin/dev`, ТЗ не называет его в скоупе (импорт/undo
  — не «обычное редактирование» из «Проблема» №1), новых наблюдаемых
  дефектов эта разница не создаёт при обычном однопользовательском
  сценарии. Снимаю без правки: не регрессия этого диффа, вне
  предмета AC1–AC4.

## Чего не проверял

- Ручной прогон в реальном Home Assistant (WSL/CI harness автора) —
  недоступен в этом окружении; вместо него — полный HA-websocket-тест
  через `pytest-homeassistant-custom-component`, установленный в этом
  раунде (см. таблицу гейтов).
- Многопользовательская гонка «второй клиент успевает воскресить
  маркер между commit и purge» для `import`/`undo`-путей (см. находку
  выше) — не воспроизводилась вручную, только прочитана по коду;
  вне скоупа AC.
- Perf-профили — не запрашивались AC, диф не касается путей,
  чувствительных к производительности (debounce/throttle интервалы
  прямо названы «вне скоупа» в ТЗ и не изменены).

## Вердикт

Зелёный. Все четыре AC доказаны — либо автотестом, который умеет
падать без правки, либо чтением кода с явной пометкой. Регрессионный
периметр (существующий `trail/delete`, живые/скрытые маркеры, полный
frontend + pure backend) зелёный. Один флейк в
`test_ha_websocket.py` подтверждён как окруженческий и не связанный с
диффом (воспроизведён на `origin/dev` без изменений #335).
