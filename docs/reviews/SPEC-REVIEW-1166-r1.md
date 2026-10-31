# SPEC-REVIEW-1166-r1

**Issue:** #1166 · **Этап:** spec (ревью ТЗ, PROCESS.md §2.4) · **Трек:** ask
**Материал:** тело issue #1166, commit `53e04995196b88d6d77a81de0d9a18d64ee2edee`
(tree `fdd04e7e8edff96865295aa97a57c9dc4fa450db`), bodyDigest
`6d75b05ea8642b95867ce690f2ea3b7bd335b10ca9a68fc8b50340dfe42518dc`.
Заход r1, блокирующих циклов 0/4.

## Скоуп

Хотфикс 1.83.1 поверх stable 1.83.0: распознавание допустимых замкнутых
областей при субпиксельном расхождении представлений одного Т/X-стыка
(`sourceVertex` в `src/wall-face-graph.ts`), согласованное выравнивание
связанных узлов в Optimize без разрыва примыканий и без новых
`junction_limit_distance`-нарушений, плюс регрессионные тесты. Обслуживает
J4 («от нуля до плана») и J6 («держать план актуальным») из `docs/SCOPE.md`,
поверхность — desktop editor «Стены»/Optimize. Полная координатная миграция
(#1167), новый UI диагностики Optimize (#1170) и пропадание дверей в карточке
из нового отчёта — явно вне скоупа.

## Как проверялось

Это ревью ТЗ: кодовый Validate не требуется, отсутствие CI на SHA документа
не является поводом гонять tsc/build/npm test/`gate:small`. Разбор —
чтением материала: тело issue, `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, профильный `docs/WALL-THICKNESS.md`
(раздел «Source coordinates (#1061)», строки 985–992).

Для проверки, что числа и ссылки в ТЗ не выдуманы, а не только внутренне
непротиворечивы, адресно сверено чтением (без исполнения кода и без
изменения предмета ревью):

- `docs/analysis/1166-wall-face/ANALYSIS.md` и `README.md` — пакет
  действительно присутствует на материале ровно на заявленном SHA; значения
  координат `[350,400]`/`[-200,1240]` при `NORM_W=1000` дают AC1-овские
  `[0.35,0.4]`/`[-0.2,1.24]`; диапазон расхождений `2.72e-11…4.52e-10`
  нормализованной единицы в ТЗ совпадает с `8.934e-11, 2.719e-11, 4.521e-10`
  в ANALYSIS.md (мин/макс совпадают).
- `src/wall-face-graph.ts:409-424` (`sourceVertex`) — текущий dev-код
  содержит ровно описанный допуск `Number.EPSILON*16*max(1,|coords|)` и
  комментарий «Only arithmetic roundoff is interchangeable… ambiguous, not a
  licence to move one» — диагностика ТЗ нацелена на реальную, точно
  локализованную функцию, а не на устаревшее/вымышленное поведение.
- `custom_components/houseplan/junction_limits.py` — существует, backend
  validator, упомянутый в AC3/AC5/AC6, реален.
- Существование всех файлов, названных в «Плане автотестов»: `test/wall-face-
  graph.test.mjs`, `wall-face-repair.test.mjs`, `wall-face-room-split.test.mjs`,
  `wall-face-lineage.test.mjs`, `plan-optimizer.test.mjs`,
  `tests_backend/test_junction_limits.py`, `test_junction_parity.py`,
  `test_wall_face_lineage.py`, `test_wall_segment_model.py`,
  `demo/smoke_wall_face_lineage.mjs`, `demo/smoke_wall_face_room_split.mjs` —
  все на месте; план реалистично расширяет существующие наборы, а не
  ссылается на несуществующую инфраструктуру.
- `demo/benchmark_optimize_geometry_preflight.mjs` — для Optimize уже
  существует отдельный performance-harness (см. находку ниже).

Исполняемый fixed-check runner (`mcp__houseplan_review__run_check`) не
вызывался: на этапе spec не обнаружено конкретного непокрытого вопроса,
который требовал бы адресного прогона или negative-input case сверх чтения
материала — вся осуществимость AC1–AC8 прослеживается по тексту ТЗ, текущему
коду и уже опубликованным диагностическим скриптам/JSON на этом же SHA.

## Находки

### Medium (в скоупе) — не назван перформанс-эффект (DoR §2.5 / §8)

ТЗ не содержит ни одного упоминания влияния на производительность
(`производительность`/`performance`/`бюджет` не встречаются ни в одном
разделе, включая «Риски» и «Release-артефакты»), хотя §2.5 требует явно
назвать влияние на производительность и бюджеты **или** явное «нет», и этот
же пункт в разделе release-артефактов отдельно требует «performance/security —
либо явное „нет“».

Это не формальная придирка: сам контракт поведения описывает реальное
архитектурное изменение с ненулевой ценой — «Источники и ограничения
контактов хранить в памяти на операцию; корректно инвалидировать по
изменению структурных данных» (раздел «Технические решения») и
согласованное (не независимое по-сегментно) выравнивание Т/X-контактов в
Optimize на весь план (контракт п.4). Для подсистемы уже существует
отдельный измерительный инструмент — `demo/benchmark_optimize_geometry_
preflight.mjs` — который ТЗ не упоминает и не привязывает к задаче. На
плане с сотнями перегородок (SCOPE: дом на 20–200 устройств, несколько
этажей) переход от независимого снэппинга каждого конца к связному графу
контактов, пересчитываемому на каждую операцию, может заметно изменить
время отклика инструмента «Стены» и Optimize — в любую сторону, но
направление и порядок величины сейчас не оценены и не зафиксированы как
«нет эффекта» или как измеримый пункт плана автотестов.

**Воспроизведение:** полнотекстовый поиск по телу issue #1166 — ни одного
совпадения на `производительн|performance|перформанс|budget|бюджет`.

**Чем закрывается:** одна явная строка в ТЗ — либо «влияние на
производительность: нет» с кратким обоснованием (почему пересчёт
ограничен локальной окрестностью, а не всем графом), либо явный пункт
плана автотестов, ссылающийся на существующий `benchmark_optimize_
geometry_preflight.mjs` (или новый адресный benchmark) с численным порогом.
Это технический, не продуктовый вопрос — владельцу не передаётся, решается
автором ТЗ в текущем цикле.

Других Medium/High находок не выявлено.

## Что проверено и корректно

- Все обязательные разделы §7.1 присутствуют и в правильном порядке:
  сценарий → что человек увидит до/после → проблема и аналитика → скоуп/
  не-скоуп → контракт поведения → UX и доступность → модель данных и
  миграция → i18n → AC1…AC8 с указанием доказательства → план автотестов →
  риски → откат → release-артефакты.
- Каждый AC (AC1–AC8) однозначен и называет конкретный способ доказательства
  (unit/backend/HA harness/browser smoke/конкретный Python validator),
  включая числовые ориентиры (точки кликов, допустимые диапазоны расхождений,
  требование «без новых distance-нарушений», «no-op» при повторном Optimize).
  Для защитных AC (AC5 — настоящие зазоры/неоднозначный carrier/негативы
  #1061; AC6 — отказ ACK/guard атомарен) план явно называет конкретный
  отрицательный сценарий своей красной проверки (зазор больше обоснованной
  точности, но меньше topology epsilon; задержанный ACK и отказ записи) —
  это и есть «чем краснеет» на уровне ТЗ, пустых мест нет.
- Скоуп/не-скоуп корректно отделяют задачу от #1061 (сохраняет его защиты и
  негативы), #1167 (координатная миграция, явно не ждётся), #1168 (дубликат,
  материалы которого влиты сюда) и #1170 (новый UI диагностики, вынесен).
- Диагностика ТЗ согласована с канонической документацией подсистемы:
  `docs/WALL-THICKNESS.md` («Source coordinates (#1061)») уже фиксирует
  «Independent cuts may agree within arithmetic roundoff, while incompatible
  source representatives fail closed» — #1166 калибрует именно этот
  существующий, а не новый инвариант; реализация не меняет роль #1061.
- Модель данных/миграция/i18n корректно закрыты: не требуется bump
  `model_version`, новых персистентных полей/графов/ключей локализации нет;
  это явно и обоснованно, а не пропущено.
- «Технические решения» раздел корректно размечен как предположение
  («принято предположительно, поменять свободно», «оспариваются на
  ревью») — численные пороги и место helpers намеренно не зафиксированы в
  ТЗ и остаются вопросом код-ревью, а не продуктовой неоднозначностью;
  это соответствует правилу «технический вопрос решает не владелец».
- Откат, release-ledger (классификация `stable-fix` относительно v1.83.0),
  трейлеры будущих коммитов, E2E-вердикт («надо», с названными двумя
  сценариями) — присутствуют и конкретны.
- Числовые утверждения ТЗ (координаты, диапазоны расхождений, допуск
  `sourceVertex`) перепроверены против фактического dev-кода и
  опубликованного диагностического пакета на том же SHA — не выдумка и не
  подгонка, см. раздел «Как проверялось».
- Публичный тестовый экспорт и его SHA256 присутствуют в репозитории именно
  там, где заявлено (`docs/analysis/1166-wall-face/`), частный план из
  отчёта поддержки в материалах не фигурирует — требование
  нераспространения соблюдено.

## Чего не проверял

- Браузерная/HA-приёмка — на этапе spec кода нет, реализация не
  запускалась; это и не требуется (контекст прямо это исключает).
- Корректность будущего численного порога «доказанной точности хранения» —
  намеренно не зафиксирована автором как implementation-деталь, подлежит
  код-ревью, а не этому ревью.
- Полное содержимое `docs/analysis/1166-wall-face/*.json` (сырые результаты
  диагностических скриптов) — прочитаны только профильные `ANALYSIS.md`/
  `README.md`; достаточно для проверки происхождения заявленных в ТЗ чисел.
- Частный отчёт `hpr-e58a280d1b` — недоступен и не должен публиковаться;
  его числа (например, 2.12e-7 render units) приняты как заявленные автором
  и не фальсифицируемы независимо на этом этапе.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/`npm test`/`gate:small` | Нет | Этап spec: кодовый Validate не требуется, отсутствие CI на SHA документа — не повод (явное указание задачи) |
| `run_check` (fixed-check runner) | Нет | Не найдено конкретного непокрытого вопроса, требующего адресного исполнения/negative-input case; осуществимость прослежена чтением материала, текущего кода и уже опубликованных диагностических скриптов на этом же SHA |
| Чтение/сверка материала (SCOPE, AGENTS, REVIEWER, WALL-THICKNESS, ANALYSIS.md, src/wall-face-graph.ts, junction_limits.py, тестовые файлы) | Да | Основной метод проверки осуществимости и доказуемости AC на этапе spec |

## Маршрут

`route: fix` — Medium-находка в скоупе, чинится автором ТЗ в текущем issue,
без эскалации владельцу (технический вопрос) и без отдельного issue.

## Побочные находки

Побочных находок вне скоупа #1166 нет.

**Вердикт: жёлтый · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче · Документ: docs/reviews/SPEC-REVIEW-1166-r1.md**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjY1NTJjMDhhZGRjYzZlZWZiZDE3NjM0ODhhMjk4NWM0ZTgzZTExZjlmNTAyODBiZTQ1NTFjOWEzNGQ4MTdhYzYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI2NDA2Zjk1NmQxZTZlYTA3YTY2MWZkZTA5ZDNhZGE0ZTY5MjQxMzI4N2M0Yzk1YjRlZThlOTliMzE5MTM5MzMxIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTY2LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI1M2UwNDk5NTE5NmI4OGQ2ZDc3YTgxZGUwZDlhMThkNjRlZTJlZGVlIiwidHJlZSI6ImZkZDA0ZTdlOGVkZmY5Njg2NTI5NWFhOTdhNTdjOWRjNGZhNDUwZGIiLCJib2R5RGlnZXN0IjoiNmQ3NWIwNWVhODY0MmI5NTg2N2NlNjkwZjJlYTNiN2JkMzM1YjEwY2E5YTY4ZmM4YjUwMzQwZGZlNDI1MThkYyIsInByb2R1Y2VyUnVuIjoiNDExODk0NTM4NDciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjlmM2FhMjVjMjE3NzRjYmU2NDYxNzE2MDdhZGU2MGQ3NDBlYmQ3MWM4OGU3NjJiZDBlN2M3ZTg3YjhmN2ZjNTUiLCJ2ZXJkaWN0RGlnZXN0IjoiZjRkNzFmZmFiMzdiMWE4NGQ2NjRkMDFiMWQ0MmY1OWY0MWI3YzQyMWQzYzM1MjAyNWY3MTkwM2VmMzZiOGM4MyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJlNWJkY2ZiNjdjYzFkMzJmMGZhOTdiZDBhYzc5MzczNTUwNjVjNDBjZmMxNjk2Y2ZkMGYwYWQ4OTIzY2EwOGM5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQxODU0MTczLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTY2I2lzc3VlY29tbWVudC02NTQxODU0MTczIiwiYm9keURpZ2VzdCI6IjZmNTkzMmExZGYyNWU1N2Q2NjMyZDY5NjdjMTVlMjIzYTc2Yjc4Nzk3MzNlMjkwZjIzMjFlNTZkNjJkZDJiYjMifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1166-diagnostics`, коммит `53e04995196b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fdd04e7e8edff96865295aa97a57c9dc4fa450db`
  ```
  git log --all --format='%H %T' | grep fdd04e7e8edf
  ```
- Тело issue: `6d75b05ea8642b95867ce690f2ea3b7bd335b10ca9a68fc8b50340dfe42518dc`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDgsIm91dHB1dF90b2tlbnMiOjI4NjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk1NTI4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTU0NjczNywiY29zdFVzZEVzdGltYXRlIjowLjk3NzcwNTQwMDAwMDAwMDF9XSwidHVybnMiOjM2LCJkdXJhdGlvbk1zIjozNjEzODgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjk3NzcwNTQwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=48 output_tokens=28615 cache_creation_input_tokens=95528 cache_read_input_tokens=1546737 num_turns=36 -->
