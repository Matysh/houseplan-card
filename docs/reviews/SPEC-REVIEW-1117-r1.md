# SPEC-REVIEW-1117-r1

**Issue:** #1117 — «Dreame: история уборок не открывается, если архивная карта не содержит map_index»
**Этап:** spec (ревью ТЗ, PROCESS.md §2.4) · **Трек:** ask · **Заход:** r1 · Блокирующих циклов: 0/4
**Материал:** тело issue #1117, зафиксировано в REVIEW_CONTEXT при `bodyDigest: 08f82083a3333a38b0d2b911bb02dee97725ba3d336af1fe54061cc6ad3df296`; аналитический комментарий `#6476087544`. Материал чтения кода: dev `a054526cb676f9957f1b7a7387aad860b454594a` (рабочая копия на этом SHA).
**Маршрут вердикта (#726):** `fix`.

## Скоуп ревью

Проверяется только ТЗ в разделе `## ТЗ` тела issue: осуществимость и однозначность
каждого AC, способ его доказательства, полнота обязательных разделов DoR
(PROCESS.md §2.5), согласованность с `docs/SCOPE.md` и текущим кодом
`custom_components/houseplan/vacuum_history.py` / `vacuum_paths.py`. Кодовый
Validate на этапе spec не требуется (PROCESS.md §8, конспект «Ревью ТЗ»); tsc/
build/npm test/gate:small не запускались — это не гейт spec-этапа.

## Как проверялось

1. Прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
   `docs/process/REVIEWER.md` (по одному разу, static-first).
2. Прочитано тело issue #1117 (все три декодированные страницы контекста) и
   учтены аналитические выводы в комментарии владельца — как owner-решения,
   не как план автора (черновик кода на этапе spec не читается, §11.8).
3. Независимо, без доверия к диагностике автора, прослежен текущий код:
   `custom_components/houseplan/vacuum_history.py` (`history_snapshot`,
   `history_route`) и `vacuum_paths.py` (`dreame_coordinate_key`,
   `same_native_coordinates`, `is_current_dreame_snapshot`) — чтобы
   самостоятельно подтвердить механизм бага и осуществимость предложенного
   исправления.
4. Прочитаны существующие тесты `tests_backend/test_vacuum_history.py` и
   список тестов `tests_backend/test_ha_vacuum_history.py` (имена кейсов) —
   чтобы оценить, насколько заявленный «AC доказывается существующим +
   targeted набором» соответствует реальности, а не декларации.
5. Прочитан `test/fixtures/vacuum-history/produce.py` и существующие fixture
   JSON — чтобы оценить осуществимость AC5 (producer-derived fixture без
   map_index).
6. Сверено канонический `docs/VACUUM.md` (раздел «One-screen historical
   cleanup preview», passport-правила) на согласованность с ТЗ и с заявленным
   уточнением документации (файл C).
7. Сверены `docs/release-ledger/v1.82.0/999.json` (категория `major`, #999 —
   действительно новая в этом цикле возможность) и наличие каталога
   `docs/release-ledger/v1.82.0/*` — чтобы подтвердить корректность
   предварительной классификации `line-fix`, `introducedBy: 999`, база
   `v1.82.0`.
8. Сверено наличие i18n-ключей `marker.history_*` во всех четырёх локалях
   (`src/i18n/settings/{en,ru,de,fr}.json`) — чтобы подтвердить, что «новые
   ключи не нужны» не является домыслом.
9. Сверен лимит `VAC_ROUTE_LIMIT = 32` в `vacuum_routes.py` — подтверждает
   заявление ТЗ про «существующий лимит effective routes (32)».
10. Запрошен манифест `run_check` (`review-execution-policy.json.checks.md`):
    исполняемого Python/pytest-oracle в нём нет вообще (только Node unit/
    static checks) — адресная проверка через `run_check` для Python-кода
    backend на этом этапе физически недоступна, что согласуется с правилом
    «Зависимости и Chromium на этапе spec не ставились» (#696). Конкретного
    непокрытого вопроса, оправдывающего обычный negative-input прогон,
    не возникло: статическое прослеживание кода однозначно воспроизводит и
    объясняет и баг, и то, что предложенная таблица сравнения его устраняет
    без регрессии прежних путей отказа (см. ниже).

## Независимая проверка механизма бага и осуществимости правки

Текущий код:

- `history_snapshot()` (vacuum_history.py:169) формирует `map_key` как
  `json.dumps([map_id, saved_map_id, map_index])` и уже требует
  `saved_map_id is not None` — архив без доказанной сохранённой карты уже
  отвергается (`coordinates_unverified`), это решает рисковый пункт
  «transport map_id не подменяет saved_map_id» ещё в текущем коде.
- `dreame_coordinate_key()` (vacuum_paths.py:132) превращает тройку
  `[map_id, saved_map_id, slot]` в типизированную пару
  `(saved_map_id ?? map_id, slot)`, сохраняя `None`/`0`/тип как есть — то
  есть **floor и slot уже разделены** этой существующей функцией; её не
  нужно менять, чтобы реализовать табличное сравнение ТЗ (не-скоуп это и
  запрещает).
- `history_route()` (vacuum_history.py:212) на некотором witness сравнивает
  эти пары **строгим равенством**: `dreame_coordinate_key(identity[1]) !=
  dreame_coordinate_key(value.map_key)`. Для реального случая из диагностики
  это даёт `(36, None) != (36, 1)` → ни один native witness не матчится →
  `coordinates_unverified`. Это воспроизводит зафиксированный в issue дефект
  ровно тем же путём, который описан в диагностике, независимо от авторских
  выводов.

Предложенная ТЗ табличная замена (матчить по floor всегда, по slot — только
когда обе стороны его передают; при отсутствии исторического slot допускать
native с любым переданным slot, но требовать после этого единственность
route) реализуема как **локальный helper внутри `vacuum_history.py`**,
оперирующий уже готовыми парами `(floor, slot)` от существующего
`dreame_coordinate_key()`, без изменения этой функции и без изменения
`same_native_coordinates()` — ровно то ограничение, которое ставит раздел
«Не-скоуп». Существующий цикл по `("current", "previous")` и накопление
`matched` по `route["id"]` уже реализует «собрать всех кандидатов, посчитать
число различных routes» из раздела «Доказательство и выбор route» — это не
новая архитектура, а точечная замена одного условия сравнения. Строки
таблицы «Передан/Отсутствует → отказ» и «Отсутствует/Отсутствует → совпадение
слотов» уже являются текущим поведением (см. тесты
`test_history_transport_map_id_alone_does_not_prove_the_saved_floor` и
`test_previous_coordinate_witness_zero_and_ambiguous_routes` с `saved_map_id=0,
map_index=0`), то есть ТЗ формализует существующий код там, где он уже
правильный, и переопределяет только одну ранее отсутствовавшую строку
(«Отсутствует(H)/Передан(N)»). Риски из раздела «Производительность и
риски» (bool==0, first-match, wildcard по None) явно замкнуты существующими
типовыми проверками `dreame_coordinate_key` (bool не проходит `type(value)
not in (str, int)`) и наблюдаемым в тестах инвариантом «ни один кандидат —
отказ, а не угадывание».

Вывод: предложенное изменение осуществимо, локализовано и не требует новой
архитектуры или изменения запрещённых не-скоупом функций — независимая
проверка по коду подтверждает диагностику и план автора, а не просто
принимает её на веру.

## AC — однозначность и способ доказательства

| AC | Проверено чтением | Примечание |
|---|---|---|
| AC1 | да | Способ доказательства назван (red→green backend unit по точной форме реальной identity); сценарий точно совпадает с диагностированным кодом выше. |
| AC2 | да | Таблица слотов однозначна по типам (0 отделён от null/absent; bool/float/array исключены существующей типизацией `dreame_coordinate_key`). Способ — параметризованные unit, уже есть прецедент в `test_vacuum_history.py`. |
| AC3 | да | Переиспользует уже существующие негативные тесты (`test_same_bounds_foreign_or_unproved_native_map_is_refused`, `test_history_transport_map_id_alone_does_not_prove_the_saved_floor`) плюс один новый targeted случай; реалистично. |
| AC4 | да | Матрица неоднозначности — прямое расширение уже работающего дедупликатора по `route["id"]`; существующий тест `test_previous_coordinate_witness_zero_and_ambiguous_routes` — прямой прецедент того же механизма. |
| AC5 | да, с явной границей | Зависит от внешнего пинованного upstream-исходника `dreame_vacuum` (не в этом репозитории), который `produce.py` принимает через `--source`. Его фактическое поведение (действительно ли сериализатор опускает ключ `map_index` при `None`, а не пишет `null`) не проверяется чтением этого репозитория — это явно описано в ТЗ как проверяемое assertion («в полученном JSON поля действительно нет»), а не как заявленный факт. Реальная исходная диагностика уже подтвердила отсутствие поля на боевом устройстве с тем же pinned passport (hash match), так что риск невелик и корректно помечен в ТЗ как технически решаемый на реализации, а не как домысел. |
| AC6 | да | Существующий `tests_backend/test_ha_vacuum_history.py` уже содержит ровно заявленные кейсы (`test_held_read_cannot_publish_foreign_or_retired_record`, `test_real_household_user_losing_write_role_retires_held_history`, `test_public_source_ticks_keep_record_identity_but_catalog_aba_retires_it`, `test_timeout_*`, `test_history_capability_and_commands` и т.д.) — claim «existing unauthorized/held-read cases» подтверждён именами тестов, не только текстом ТЗ. |
| AC7 | да | UI не меняется, существующие смоки/геометрия по контракту `docs/VACUUM.md` остаются достаточным доказательством. |
| AC8 | да | Файлы/модули перечислены и совпадают с реальной структурой кода (`vacuum_history.py`, `vacuum_history_websocket.py` опционально, `test/fixtures/vacuum-history/`, `docs/VACUUM.md`); `docs/VACUUM.md` действительно формулирует слот как часть паспорта («typed `dreame_coordinate_key` floor/slot identity») без пометки optional — так что заявленное уточнение документации предметно, не пустое. |

Ни один AC не содержит догадки, выданной за факт: там, где ТЗ опирается на
недоказанное на этом этапе техническое допущение (AC5, поведение внешнего
пиннованного producer), оно явно помечено как подлежащее проверке на
реализации, а не записано как состоявшийся факт.

## DoR (PROCESS.md §2.5) — построчно

- ТЗ в теле issue, трек `ask`: присутствует, метка владельца подтверждена на
  уровне задачи (вне тела ТЗ, это зона конвейера, не ревью).
- AC1…AC8 пронумерованы, у каждого указан способ доказательства — да.
- Файлы и модули — раздел «Файлы и модули» (A/B/C) присутствует и совпадает
  с реальным деревом.
- i18n — явное «новых ключей не нужно», подтверждено наличием всех пяти
  `marker.history_*` ключей в четырёх локалях.
- Миграция/compatibility — явно «не нужна», байтовая неизменность Store
  заявлена и правдоподобна (правка не трогает формат записи).
- Производительность/бюджеты — явно названы границы (32 routes, 2 native
  slots, без нового скана/кэша/таймера); лимит 32 подтверждён в коде
  (`VAC_ROUTE_LIMIT` в `vacuum_routes.py`).
- Touch — явно «не меняется», обоснованно (UI не трогается).
- Release-артефакты — названы: технический CHANGELOG RU+EN,
  `docs/release-ledger/v1.82.0/1117.json`, классификация `line-fix`,
  `introducedBy: 999`; база `v1.82.0` и категория `major` у #999 подтверждены
  существующим `docs/release-ledger/v1.82.0/999.json`.
- Откат — раздел «Откат» присутствует и реалистичен (обратный коммит без
  персистентной миграции).
- Открытых продуктовых вопросов нет — заявлено явно; независимая проверка не
  обнаружила продуктового вопроса, требующего обращения к владельцу
  (единственный технический нюанс — AC5 producer-assumption — решается
  ревьюером по существу, не выносится владельцу, см. выше).

Все пункты DoR закрыты.

## Находки

Находок уровня High или Medium не выявлено.

Наблюдение не в счёт вердикта (не находка): раздел «Состояние подготовки» в
теле issue всё ещё содержит фразу «Оставить S3-spec. На ревью ТЗ не
отправлять…», оставшуюся от момента первоначальной подготовки аналитики.
Поскольку это ревью фактически запущено (следовательно, отдельная команда
владельца на продолжение уже была дана вне зафиксированного в контексте
текста), это стилистический след черновика, а не содержательный дефект ТЗ:
на доказуемость или однозначность AC он не влияет.

## Что проверено и корректно

- Диагностированный механизм бага независимо воспроизведён чтением кода
  (`dreame_coordinate_key`/`history_route`), а не принят на веру из текста
  issue.
- Предложенная табличная замена реализуема локальным helper'ом в
  `vacuum_history.py` без изменения запрещённых не-скоупом функций; текущий
  код уже содержит три из четырёх строк таблицы как рабочее поведение.
- Все восемь AC однозначны, у каждого назван реалистичный, проверяемый
  существующим или точечно расширяемым тестовым аппаратом способ
  доказательства.
- DoR (§2.5) закрыт по всем пунктам.
- Release-классификация (`line-fix`, `introducedBy: 999`, база `v1.82.0`)
  подтверждена существующим ledger.
- i18n-decision подтверждён существованием ключей во всех локалях.
- Производительность/лимиты подтверждены существующим кодом.

## Чего не проверял

- Не запускался и не мог быть запущен pytest/HA harness — на этом этапе
  недоступен ни через `run_check` (в манифесте этапа нет Python-checks), ни
  как часть гейта spec-этапа (кодовый Validate не требуется).
- Не проверялось фактическое поведение внешнего пиннованного upstream
  `dreame_vacuum` сериализатора (отсутствует в этом репозитории) — это
  предмет реализации (AC5), а не этого ревью.
- Полный Show через продуктовый WebSocket/браузер не воспроизводился — это
  явно вне скоупа ТЗ и этого этапа ревью (нет кода для исполнения).
- Golden/визуальные гейты не прогонялись — UI не меняется, свежесть
  скриншотов не гейт задачи.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/gate:small | нет | Кодовый Validate не требуется на этапе spec (PROCESS.md §8, конспект «Ревью ТЗ»); правок кода ещё нет. |
| pytest tests_backend / HA harness | нет | Недоступен на этом этапе: ни в манифесте run_check, ни как гейт spec-ревью; зависимости/Chromium на spec-этапе не ставятся (#696). |
| Статическое прослеживание диффа кода vs ТЗ | да | Выполнено чтением `vacuum_history.py`/`vacuum_paths.py` и существующих тестов — покрывает единственный уместный на этом этапе вид проверки (осуществимость AC чтением материала). |
| run_check static/unit (Node) | нет | Не относится к предмету ревью (Python backend); адресного непокрытого вопроса, который решался бы Node-проверкой, не возникло. |

## Маршрут публикации побочных находок

`REVIEW_FINDINGS_POLICY`: `mode=issues`. Побочных находок вне скоупа этой
задачи не обнаружено, `outside_findings` пуст.

## Вердикт

**Зелёный.** High: 0 · Medium: 0. ТЗ осуществимо, каждый AC однозначен и имеет
названный реалистичный способ доказательства, DoR закрыт полностью,
независимая проверка кода подтверждает и диагностированный дефект, и
осуществимость предложенного исправления в рамках заявленного скоупа и
не-скоупа. Статус переходит в «Готово к разработке».

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6Ijg2NmUxZDUxNGM5ZmFlYjQwZGUxYmU2ZTQ3YzA1OTMyZTY0NjJmMTkzMTg3OGY0ODA2Yjk3MDQxMTE0MWU2NDQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0YjIzNGY0ZTQxYzYxNTZkYjBmNjUzODVhZTUxMDkwNWVhOGNlMmVjMzliNzRjMjQ2OWUxMGE4MDNiOTcyNjQ0IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE3LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJhMDU0NTI2Y2I2NzZmOTk1N2YxYjdhNzM4N2FhZDg2MGI0NTQ1OTRhIiwidHJlZSI6ImI5ODk3OTZkNTM4ZDc4NGNmN2VkNmViZTcyMDUxN2Q1YjBmYjMwNTAiLCJib2R5RGlnZXN0IjoiMDhmODIwODNhMzMzM2EzOGIwZDJiOTExYmIwMmRlZTk3NzI1YmEzZDMzNmFmMWZlNTQwNjFjYzZhZDNkZjI5NiIsInByb2R1Y2VyUnVuIjoiNDA3MzgyMzc4NjUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImE1MjZjY2QyNWRjMDEzMTJmMTFjMjQxNWNkYWExMWZiMGJlZTc3ODRmODcxMTJkMzE4N2M2ZGIxYmQ3NWMxNTkiLCJ2ZXJkaWN0RGlnZXN0IjoiZGNhNWI2NWRhMWYzMjZhMzg4NzI0ODUxNTRhYzU4M2ZiODg5NTlmODdhNDEzODI2M2QwYjIxNGNkNjQ5NGFiMiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI4NDIyODQ2MzlmOTBhNTA5MmI0NTMyZWY1NDVlOTE2ZDkwNTAwYjUwMzg3ODI3ZWQ0ZjA3NTBiYzZmMjQzMGQ5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDc2NTg1NTkxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE3I2lzc3VlY29tbWVudC02NDc2NTg1NTkxIiwiYm9keURpZ2VzdCI6IjNjMDZkN2JkMjU5ZDkyMzVlODRiMGFjMjlhYTRlOTNiNmY1MDc4Y2EzYTFkM2UxY2QxNWRjYTk2MzhkMmY0YTgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `a054526cb676` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b989796d538d784cf7ed6ebe720517d5b0fb3050`
  ```
  git log --all --format='%H %T' | grep b989796d538d
  ```
- Тело issue: `08f82083a3333a38b0d2b911bb02dee97725ba3d336af1fe54061cc6ad3df296`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjIsIm91dHB1dF90b2tlbnMiOjI4MzQ0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMjY2MCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI2ODg2NTgsImNvc3RVc2RFc3RpbWF0ZSI6MS4zNTE5MzU2fV0sInR1cm5zIjozOSwiZHVyYXRpb25NcyI6MzkxNTEwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zNTE5MzU2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=62 output_tokens=28344 cache_creation_input_tokens=132660 cache_read_input_tokens=2688658 num_turns=39 -->
