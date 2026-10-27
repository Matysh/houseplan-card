# SPEC-REVIEW — issue #1096, заход r1

Материал: тело issue #1096, bodyDigest `218e561f9...e66cd` (REVIEW_CONTEXT),
дерево `21b98559a22c9cfd6792c7310109d493fe1d08d2`, SHA `334db095d0f9d31a180ff77369030d1cf5e6ff7a`.
Трек: `ask`. Этап: `spec`. Маршрут вердикта: `fix` (задан пакетом).

## Скоуп ревью

Оценивается ТЗ в разделе `## ТЗ` тела issue #1096: scoped-проход `config/set`/
`config/get` (пропуск полной геометрической проверки и обходов реестра/
состояний HA для нетронутых пространств/маркеров), отметка чистоты ревизии
`schema_clean_rev`, условные обходы `_readable_entity_ids`/
`radar_registry_evidence`/LQI-реестра, одна канонизация без лишних копий,
условный пропуск обхода каталогов `collect_plans`/`collect_attachments`.
Кодовый Validate на этапе spec не требуется (реализации ещё нет — явно
сказано в хендоффе автора).

## Как проверялось

Кодового изменения нет, поэтому гейты `tsc`/`build`/`npm test`/`gate:small`/
`pytest tests_backend` не запускались — это не гейт этапа spec. Вместо этого:

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md`.
2. Прочитано тело issue #1096 целиком (ТЗ + все 3 комментария автора) из
   `REVIEW_CONTEXT`/`sources-*.md`.
3. Чтением (без исполнения) проверена осуществимость контракта против
   текущего кода на материале `334db095d`: `websocket_api.py` (`ws_config_get`
   :1752-1835, `_readable_entity_ids` :1947-1960, `ws_config_set` :1963-2209,
   `_commit_pair`/`PairCommitFailure` :240,450-483), `validation.py`
   (`validate_wall_model_transition` :247-311, `_space_geometry_invariants`
   :1952-1991, `SPACE_SCHEMA` :1994-2099, `_config_wall_segment_invariants`
   :2248-2306, `preserve_summary_panel_namespace`/`validate_summary_panel_references`/
   `prepare_ordinary_summary_candidate` :2424-2490), `junction_limits.py`
   (`validate_junction_limits`/`space_violation_counts` :370-420),
   `radar_validation.py` (`_validate_verified_adapter` :164-197, подтверждён
   `registry is None` ранний выход на :171), `zigbee_lqi.py`
   (`async_config_saved` :94-108), `zigbee_lqi_model.py`
   (`represented_devices` :97-120), `room_appearance.py` (целиком),
   `coordinate_canonicalization.py` (`canonicalize_config_geometry` :121-156),
   `plans.py` (`collect_plans` :370-453, `collect_attachments` :133-190),
   `store.py` (`HouseplanData` :87-137, `async_save_config_state` :229-288,
   вызывающие :2141,2281,2362 в `websocket_api.py` и :406 в `store.py`).
4. Сверены номера строк и поведение, которые ТЗ цитирует из аудита #1094 —
   все совпали с текущим деревом (путь записи не менялся с `51fde59d`, как и
   заявлено в шапке ТЗ).
5. Проверен конкретный непокрытый вопрос (п.5 контракта, `preserve_space_appearance`)
   адресным чтением `room_appearance.py` — ниже, находка F-подобная (в
   скоупе, без отдельного issue).
6. Сверена классификация релиза: `docs/release-ledger/cycle.json` —
   `baseStable: v1.82.0`, `targetStable: v1.83.0` — совпадает с заявленным
   в ТЗ `v1.82.0` как база для `stable-fix`.

Негативных/смежных прогонов кода не выполнялось — на этапе spec это
оправдано только для named непокрытого вопроса (REVIEWER.md, «Ревью ТЗ»); он
разобран чтением ниже без запуска тестов, так как кода ещё нет.

## Находки

### Medium (в скоупе) — M1: `preserve_space_appearance` не оговаривает легаси-документ, хотя `config/get` в том же пункте оговаривает

**Где:** Контракт поведения, п.5 («Одна канонизация, без лишних копий»),
раздел «Принято предположительно, поменять свободно при ревью» (третий
пункт).

**Что утверждается:** «`preserve_space_appearance` читает `name_color`/
`wall_fill` напрямую из записи сохранённого документа, без
`normalize_room_appearance(previous)` и deepcopy; результат тот же, что
через `normalize_room_appearance(previous)`».

**Почему это не всегда так:** `normalize_room_appearance` (`room_appearance.py:19-34`)
не просто копирует два поля — она **вычисляет** `name_color`/`wall_fill` по
умолчанию (`_color()` из `room_color`/`room_opacity`/глобального
`settings.fill_colors.wall_fill`), если эти поля в записи пространства
**отсутствуют**, и только `setdefault` оставляет уже присутствующие поля как
есть. Текущий `preserve_space_appearance` (`room_appearance.py:37-54`) вызывает
`normalize_room_appearance(previous)` целиком именно поэтому — чтобы отдать
кандидату вычисленное значение, если сохранённый документ сам ещё не
материализован (не прошёл ни одного `config/set` после #1037,
`docs/release-ledger/v1.82.0/1037.json`). Прямое чтение `settings.name_color`/
`settings.wall_fill` из `previous["spaces"]` без normalize-фоллбэка даёт `None`
именно в этом легаси-случае — то есть результат **не тот же**.

Сам документ в этом же пункте 5 делает ровно это различие для `config/get`:
«`config/get` не делает deepcopy, если каждое пространство уже несёт
`name_color` и `wall_fill` (материализованный документ после #1037);
легаси-документ по-прежнему нормализуется копией». Симметричная оговорка для
`preserve_space_appearance` в тексте отсутствует — утверждение о равенстве
дано безусловно.

**Наблюдаемое следствие при буквальной реализации:** на первом ordinary
`config/set` после этой задачи для дома, который не перезаписывался через
`config/set` с момента выпуска #1037, у пространств, где клиент не прислал
`name_color`/`wall_fill` (обычный случай — цвет наследуется от режима/первой
настройки), эти поля тихо не унаследуются и уйдут в дефолт схемы вместо
сохранённого легаси-цвета — визуальная регрессия для существующих
инсталляций. Раздел «Риски» прямо пишет «визуал — нет», что при этом
сценарии неверно.

**Доказательство пробела:** ни один AC не покрывает этот путь. AC6 проверяет
материализованный/легаси случай только для `config/get` («материализованного
документа не делает deepcopy, легаси — делает»); для
`preserve_space_appearance` корпус AC1/AC9 не включает «легаси previous без
`name_color`/`wall_fill`» как отдельный входной кейс.

**Что нужно от автора:** либо явно перенести ту же материализованную/легаси
развилку на `preserve_space_appearance` (прямое чтение только когда
`previous`-пространство уже несёт оба поля, иначе прежний
`normalize_room_appearance(previous)` для конкретного пространства — не
всего документа), либо явно обосновать, почему это неприменимо, и в любом
случае добавить соответствующий входной кейс в корпус AC1/AC9 и убрать
«визуал — нет» из раздела «Риски», если регрессия возможна хотя бы в легаси
случае.

Других Medium/High находок нет. Побочных находок вне скоупа этой задачи не
найдено — `outside_findings` пуст.

## Что проверено и корректно

- Обязательные разделы ТЗ присутствуют и в заявленном PROCESS.md §7.1
  порядке: сценарий → что человек увидит → проблема → скоуп/не-скоуп →
  контракт поведения → UX → модель данных и миграция → i18n → AC1–AC11 с
  доказательством → план автотестов → риски → откат → release-артефакты.
- Сценарий и «что человек увидит» сформулированы в терминах персоны/
  продукта (J4/J6, `docs/SCOPE.md`), без терминов реализации — ревьюерский
  критерий §7.1 выполнен.
- Все номера строк и имена функций, на которые опирается контракт, сверены
  построчно с текущим деревом материала и совпадают с описанием аудита
  #1094 — ни одного устаревшего или ошибочного указателя не найдено.
- Правило «затронутости» по `==` после шагов сохранения технически
  состоятельно: `SPACE_SCHEMA`/`_space_geometry_invariants` локальны для
  одного пространства (не читают другие пространства); `_config_wall_segment_invariants`
  обращается только к глобальному `model_version` (уже отдельный триггер
  полного прохода) и к данным своего пространства; `validate_junction_limits`
  уже поддерживает `baseline_counts` по `space_id` именно для этого сценария
  (`junction_limits.py:379-420`) — перенос «для нетронутых счётчик кандидата
  = счётчик baseline» не требует новой инфраструктуры.
- Условие пропуска `radar_registry_evidence` совпадает с реальным ранним
  выходом `registry is None` в `radar_validation.py:171` — заявленный «реестр
  не нужен» подтверждён чтением, а не домыслен.
- `schema_clean_rev` как новое поле `HouseplanData` (dataclass) по образцу
  уже существующего `junction_baseline` (`store.py:123`) — дешёвое,
  непротиворечивое расширение в памяти, без persisted-следа, миграции не
  требуется.
- Точки сброса отметки чистоты (`async_save_config_state` при
  `canonical=False` и `_commit_pair`) действительно покрывают все
  нестандартные писатели: `_commit_pair` — общая функция для `marker/copy`,
  `device_contact`-ветки и других парных писателей (`websocket_api.py:450-483`,
  вызовы на :552,2152,2689,2918,3024), а не точка на каждый обработчик —
  это снижает риск забытого сброса в одном из писателей по сравнению с
  ручным сбросом в каждом обработчике.
- `collect_plans`: пропуск обхода каталога при пустом `replaced` безопасен —
  в текущем коде `collect_plans` не делает никакой независимой TTL-уборки,
  весь обход существует только ради `replaced`-ветки (`plans.py:370-453`);
  побочных эффектов пропуск не создаёт.
- Классификация `stable-fix` относительно `v1.82.0` совпадает с текущим
  `docs/release-ledger/cycle.json` (`baseStable: v1.82.0`) — база выбрана
  верно.
- Негативные/смежные входы названы для каждого AC кроме «бухгалтерских»
  счётчиков (AC2, AC4, AC7, AC8), где сам факт счётчика и есть свидетель;
  для защитных AC9 (идемпотентность) и AC10 (бюджет) способ «чем краснеет»
  указан явно текстом: AC9 — «нарушение идемпотентности любым будущим шагом
  делает тест красным» (страж в самом тесте), AC10 — «RED на неизменённой
  базе обязателен до правки» (обычное отрицательное свидетельство, не
  мутант) — это соответствует общей политике о допустимых свидетелях.

## Чего не проверял

- Не проверялась исчерпывающая полнота списка «всегда на полном документе»
  (п.3) — есть ли ЕЩЁ не названная здесь валидация, зависящая от нескольких
  пространств сразу, помимо уже перечисленных (`normalize_led_strip_links`,
  `validate_summary_panel_references`, и т.д.). Сам документ признаёт это
  риском и закрывает корпусом AC1/AC9 — проверка полноты корпуса возможна
  только по факту написанных тестов, на code-ревью.
- Не проверялась чувствительность `_catalog_coupled_wall_geometry_projection`/
  `_wall_catalog_projection` к простому изменению порядка пространств в
  массиве (списковое сравнение, а не по `id`) — это существующее свойство
  кода до этой задачи, не введено ТЗ, и сам документ относит устаревшего
  клиента к покрытию существующими тестами #478/#529 плюс корпус AC1;
  отдельно не перепроверялось.
- Не выполнялся прогон `bench_config_set.py`/`proto_scoped.py` — они не
  входят в репозиторий (папка аудита владельца), числа в ТЗ помечены самим
  автором как «разведка, не доказательство» и становятся свидетелями только
  в AC9/AC10 после реализации.
- Не запускались `pytest tests_backend`, `npm run gate:small`, `tsc`,
  `build` — кода нет, эти гейты не относятся к этапу spec (PROCESS.md §8,
  REVIEWER.md «Ревью ТЗ»).

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| `tsc`/`build`/`npm test`/`gate:small` | Нет | Этап spec, реализации нет — не гейт ревью ТЗ |
| `pytest tests_backend` | Нет | Кода нет; тесты из «плана автотестов» ещё не написаны |
| Адресное чтение кода по конкретному вопросу (п.5, `preserve_space_appearance`) | Да (чтение, не исполнение) | Единственный найденный непокрытый вопрос ТЗ; разобран чтением `room_appearance.py` и зафиксирован как M1 |
| Сверка номеров строк/имён функций ТЗ с деревом материала | Да (чтение) | Обязательная проверка осуществимости ТЗ перед вердиктом |

## Вердикт

Один Medium в скоупе (M1) при отсутствии High — жёлтый вердикт, возврат
автору, отдельный issue не заводится.

Маршрут: `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjkzMzBiNTAxMWE1ZDYwMDM5ZDFkNDM3MzI5NjA2NGUyZjg3MTRlY2M3M2U4MDEzZWZjMmI4N2U2YWMxODQ0YjYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0ZGUyZTRiZWJhMTFkZjQ2YzQ0YTM4MDQ1OTljMTk5MmJiMjRmM2YwOWMyZGE4MzZjMzU0NGNlODYzMjUzMjE2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk2LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIzMzRkYjA5NWQwZjlkMzFhMTgwZmY3NzM2OTAzMGQxY2Y1ZTZmZjdhIiwidHJlZSI6IjIxYjk4NTU5YTIyYzljZmQ2NzkyYzczMTAxMDlkNDkzZmUxZDA4ZDIiLCJib2R5RGlnZXN0IjoiMjE4ZTU2MWY5NmQyODQ1ZmY3Y2MwYmFmNGVmZGM0NmQ1YzAyYjBjOGJjZjIyNmRmNWQzZmNjMGQ4ZTJmNjZjZCIsInByb2R1Y2VyUnVuIjoiNDA1MTc2NzU4NzgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImY0YTczZWNjZjIwZmY5Mjg4MTU2YTNkM2ZjMTQwNDI4OWIxNjlkMGY5N2U0ZDZkNWExMTMwNTFjMTRmYjkwNDMiLCJ2ZXJkaWN0RGlnZXN0IjoiNjEwOTVjMTVlMjQ2NGU1MDBhMjkzNWRkYjYxZGYxM2FlMmYyZWYwNTQyN2UxMjQ1MWRlNzFiMTgyNjU3YzQzYSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIwMzc3YmQ5OWEzZmY1MjNjNDM1ZTdiMzcyYjg4ZGE0ZTQyNjRhNTRjNzgyNTlkODA3ZTE1ODdjNTQ2NTY3YTAwIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDQ0MzQ4NjI3LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk2I2lzc3VlY29tbWVudC02NDQ0MzQ4NjI3IiwiYm9keURpZ2VzdCI6ImYyYzA1M2Y2MjFkMTU2NDIxN2ViMWRlNjdlMTljNzgzNmQyYWQyYzg0MTQ3YjUyYjliZmU3ZGY3NDRmZjU3MjcifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `334db095d0f9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `21b98559a22c9cfd6792c7310109d493fe1d08d2`
  ```
  git log --all --format='%H %T' | grep 21b98559a22c
  ```
- Тело issue: `218e561f96d2845ff7cc0baf4efdc46d5c02b0c8bcf226df5d3fcc0d8e2f66cd`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzIsIm91dHB1dF90b2tlbnMiOjQyODc5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0NDIyMywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM1Mzg0NjIsImNvc3RVc2RFc3RpbWF0ZSI6MS43MTM1MTg0fV0sInR1cm5zIjo1NCwiZHVyYXRpb25NcyI6NTY0MjY1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS43MTM1MTg0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=72 output_tokens=42879 cache_creation_input_tokens=144223 cache_read_input_tokens=3538462 num_turns=54 -->
