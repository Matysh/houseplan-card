# SPEC-REVIEW-1166-r2

**Issue:** #1166 · **Этап:** spec (ревью ТЗ, PROCESS.md §2.4) · **Трек:** ask
**Материал:** тело issue #1166, commit `dc59bd62c3d0884ab1e683e23e1f7fd0cb1dc37e`
(tree `c359809878838b4828895f02fa5b520f22871235`), bodyDigest
`e87323eec5cd8343e3fccc7b4ea9bf8111a8e9b08397fb2f5a31b04438d7411e`.
Заход r2, блокирующих циклов 1/4.

## Скоуп

Без изменений относительно r1: хотфикс 1.83.1 поверх stable 1.83.0,
распознавание допустимых замкнутых областей при субпиксельном расхождении
представлений одного Т/X-стыка (`sourceVertex` в `src/wall-face-graph.ts`),
согласованное выравнивание связанных узлов в Optimize без разрыва примыканий
и без новых `junction_limit_distance`-нарушений, плюс регрессионные тесты.
J4/J6 из `docs/SCOPE.md`, поверхность — desktop editor «Стены»/Optimize.
#1167, #1170 и отчёт о пропадании дверей в карточке — вне скоупа.

## Как проверялось

Раунд 2 открыт по единственной Medium-находке r1 (не назван перформанс-эффект
AC/раздела релиза, DoR §2.5/§8). Между r1 и r2 изменилось только тело issue
на GitHub (bodyDigest `6d75b05e…` → `e87323ee…`); в репозитории — только два
docs-only коммита (`53e049951` аналитика, `dc59bd62c` публикация самого
документа r1), оба проверены `read:log`/`read:diff`: вся дельта диффа —
`docs/analysis/1166-wall-face/*` и `docs/reviews/SPEC-REVIEW-1166-r1.md`, код
в `src/`, `test/`, `custom_components/` не тронут. Это подтверждает, что
находки r1 по коду (`sourceVertex`, `junction_limits.py`, существование
тестовых файлов) остаются в силе без повторной проверки — материал под ними
не менялся.

Фокус раунда — новый раздел ТЗ «Влияние на производительность и бюджеты».
Проверено чтением и адресной сверкой с кодом (без исполнения):

- Раздел явно присутствует (ключевое слово «производительность» встречается
  многократно, включая количественные пороги) — формальное требование §2.5
  закрыто.
- Числа не выдуманы: `demo/benchmark_optimize_geometry_preflight.mjs:18-19`
  содержит ровно `ABSOLUTE_P95_MS = 250` и `RELATIVE_RATIO = 1.2`, строка 20 —
  `RELATIVE_NOISE_MS = 15`; формула `relativeLimit = baseline.p95 * 1.2 + 15`
  (строка 78) совпадает с формулировкой ТЗ «≤ baseline p95 × 1.2 + 15 мс»
  дословно, а не по памяти или округлению.
- «Трёхэтажный large-house fixture» — `demo/fixtures/large-house.mjs:8`
  задаёт `FLOOR_COUNT = 3`, который действительно используется как
  `LARGE_HOUSE_COUNTS.floors`. Утверждение ТЗ о количестве этажей точное.
- `optimizePlans` — экспортируемая функция `src/plan-optimizer.ts:425`,
  реально существует; план «сравнить полный `optimizePlans` до/после на том
  же fixture» ссылается на реальный вызываемый API, а не на вымышленную точку
  входа.
- Методологически раздел отвечает по существу, а не формально: явно
  разводит периодичность пересчёта («только при явном запуске/preview», «на
  pointermove/hover… не переносится») и алгоритмическую сложность поиска
  контактов («переиспользовать индексируемый структурный graph/sweep, не
  вводить… безусловный перебор всех пар стен») — это прямой ответ на
  сомнение r1 о цене связного пересчёта контактов на операцию, а не общая
  фраза «производительность не хуже».
- Раздел требует фиксировать оба SHA, вход, среду и исходные измерения в
  отчёте — это исполнимое, проверяемое при код-ревью требование, а не
  неформализуемое заявление.

Других изменений текста ТЗ (помимо вставки этого раздела перед «Риски») при
сопоставлении со структурой, зафиксированной в r1 («Что проверено и
корректно»), не обнаружено: порядок обязательных разделов §7.1, формулировки
AC1–AC8, скоуп/не-скоуп, откат, release-артефакты, i18n и модель данных
совпадают по содержанию с тем, что уже проверено в r1.

`run_check` использован адресно для подтверждения границ дельты
(`read:log`, `read:diff`) и для чтения закрытой r1-находки
(`read:base:docs/reviews/SPEC-REVIEW-1166-r1.md` — недоступен на базовом SHA,
прочитан напрямую из рабочей копии, т.к. это committed-файл текущего
материала). Полный повторный прогон gate:small/tsc/build не требуется:
этап spec, кодовый Validate не нужен, а дельта раунда — исключительно
формулировка ТЗ, не код.

## Находки

Новых High/Medium находок не выявлено. Добавленный раздел «Влияние на
производительность и бюджеты» закрывает Medium-находку r1 по существу:
называет и явную политику «нет эффекта на hot path» (hover/pointermove/View),
и измеримый критерий для holt path, который есть (Optimize), со ссылкой на
реальный существующий инструмент и его фактические численные пороги, плюс
отдельный адресный benchmark для сценария, который старый инструмент не
покрывает (полный `optimizePlans`, а не только preflight).

## Что проверено и корректно

- Весь материал дельты r1→r2 — docs-only (аналитика + сам ревью-документ);
  код не менялся, поэтому код-ориентированные проверки r1 (существование и
  содержимое `src/wall-face-graph.ts` допуска, `junction_limits.py`, полный
  список тестовых файлов плана автотестов) остаются валидными без повтора.
- Новый раздел о производительности присутствует, содержателен и проверяем:
  числа, имена инструментов и API в нём совпадают с реальным кодом на этом
  же SHA (см. «Как проверялось»).
- Раздел корректно разделяет два разных риска — hot path (hover/pointermove/
  View, явно «нет эффекта») и операцию Optimize (явный количественный порог
  с переиспользованием существующего и новым адресным замером) — вместо
  одной общей декларации «производительность не хуже».
- Унаследованные из r1 пункты (ниже, раздел «Унаследовано из r1») не
  требовали повторной проверки, так как подтверждающий их материал не
  менялся.

## Чего не проверял

- Корректность будущего численного порога «доказанной точности хранения» —
  implementation-деталь, вопрос код-ревью (без изменений с r1).
- Браузерная/HA-приёмка, фактическое исполнение нового benchmark-пункта на
  `optimizePlans`/large-house fixture — реализация ещё не запущена, это
  предмет код-ревью, а не этого цикла.
- Частный отчёт `hpr-e58a280d1b` — недоступен, его числа приняты как
  заявленные автором (без изменений с r1).

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/`npm test`/`gate:small` | Нет | Этап spec: кодовый Validate не требуется; дельта раунда — только текст ТЗ, код не менялся |
| `run_check: read:log`, `read:diff` | Да | Подтвердить границы дельты r1→r2 (докs-only, код не тронут) — это и есть конкретный непокрытый вопрос раунда |
| `run_check: read:base:docs/reviews/SPEC-REVIEW-1166-r1.md` | Выполнен, недоступен на базовом SHA (ожидаемо, файл появился после базы) | Прочитан напрямую из рабочей копии как committed-материал текущего SHA |
| Адресная сверка чисел/API нового раздела с кодом (`demo/benchmark_optimize_geometry_preflight.mjs`, `demo/fixtures/large-house.mjs`, `src/plan-optimizer.ts`) | Да | Единственный конкретный непокрытый вопрос раунда — не выдуманы ли пороги/API в новом разделе |

## Маршрут

`route: fix` — находок в текущем скоупе нет; r1-находка закрыта.

## Побочные находки

Побочных находок вне скоупа #1166 нет.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0 · Документ: docs/reviews/SPEC-REVIEW-1166-r2.md**

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| Medium: не назван перформанс-эффект (DoR §2.5/§8) — ни влияние Optimize-пересчёта контактов на весь план, ни «нет эффекта» не зафиксированы | Добавлен раздел ТЗ «Влияние на производительность и бюджеты»: явное «нет эффекта» на pointermove/hover/View, требование переиспользовать индексируемый graph/sweep без безусловного перебора пар стен, прогон существующего `node demo/benchmark_optimize_geometry_preflight.mjs` с порогом `p95 ≤ 250 мс и ≤ baseline p95 × 1.2 + 15 мс`, плюс новый адресный замер полного `optimizePlans` на трёхэтажном large-house fixture (3 прогрева, 20 измерений, тот же относительный порог) с обязательной фиксацией SHA/входа/среды/измерений в отчёте | Тело issue #1166, раздел «Влияние на производительность и бюджеты» (между «План автотестов» и «Риски»); числа проверены против `demo/benchmark_optimize_geometry_preflight.mjs:18-20,78`, `demo/fixtures/large-house.mjs:8,202`, `src/plan-optimizer.ts:425` на материале `dc59bd62c` |

## Унаследовано из r1

Принято без повторной проверки (материал-источник не менялся между r1 и
r2 — подтверждено `read:log`/`read:diff`: только docs-only коммиты
`53e049951`/`dc59bd62c`, код в `src/`, `test/`, `custom_components/` не
затронут):

- Соответствие §7.1 (все обязательные разделы на месте и в правильном
  порядке) — `docs/reviews/SPEC-REVIEW-1166-r1.md`, раздел «Что проверено и
  корректно», на SHA `53e04995196b88d6d77a81de0d9a18d64ee2edee`.
- Однозначность и доказуемость AC1–AC8, включая явное «чем краснеет» для
  защитных AC5/AC6 — там же.
- Корректное разграничение со скоупом #1061/#1167/#1168/#1170 — там же.
- Фактическая проверка допуска `sourceVertex` в `src/wall-face-graph.ts:409-
  424`, реальности `custom_components/houseplan/junction_limits.py` и
  существования всех файлов плана автотестов — там же, раздел «Как
  проверялось».
- Согласованность диагностики ТЗ с `docs/WALL-THICKNESS.md` («Source
  coordinates (#1061)») — там же.
- Корректность модели данных/миграции/i18n (явное «не требуется», а не
  пропуск) — там же.

---

**Политика сторонних находок:** доверенный снимок prepare указывает
`mode: "issues"`. Побочных Medium вне скоупа #1166 в этом раунде не найдено,
поэтому `outside_findings` пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImMyMDcwOThhYWY2NGVmMzc4NTNjMjQ1NTNjMjVjMmFiMzVjNzkxZjkxOGI2MjI5MDliZTg3M2QyNjBhNDZmNDkiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0NTI2NzJhOTEyYzkyZTAwYWJlNTA1NDUyYzAwZGM2OTFiZTcwYjdiYmE4Zjg0Y2EyZjY2MTQwMjU2ZjdiOTc5IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTY2LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJkYzU5YmQ2MmMzZDA4ODRhYjFlNjgzZTIzZTFmN2ZkMGNiMWRjMzdlIiwidHJlZSI6ImMzNTk4MDk4Nzg4MzhiNDgyODg5NWYwMmZhNWI1MjBmMjI4NzEyMzUiLCJib2R5RGlnZXN0IjoiZTg3MzIzZWVjNWNkODM0M2UzZmNjYzdiNGVhOWJmODExMWE4ZTliMDgzOTdmYjJmNWEzMWIwNDQzOGQ3NDExZSIsInByb2R1Y2VyUnVuIjoiNDExOTAyNzg4NDkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjQzMjY5NTZjMzgwNDY0YzI5ODk2Njg0OWJlYTMyY2I4ZWJjYTJhZWExMzUwY2U5NmVkZjgzMzBhMDdiYWQyZjgiLCJ2ZXJkaWN0RGlnZXN0IjoiYjQyMGI2Njk1MWJkN2Q1Y2RlOThiNGRlYzBkMjA1NGQ2YTdkOWE1MDcwZTNiOTE4NDRhODAzNzRiYTRlYTc2MiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkOGE2M2UxN2QxZWYwNGQ3ODlmOTRkOGQwM2FjOTRjZTE2NzEyMTc5NWE4NzBiYzM0NWJkMTdmODI0YWE5MDRlIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTQxOTM1ODI0LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTY2I2lzc3VlY29tbWVudC02NTQxOTM1ODI0IiwiYm9keURpZ2VzdCI6ImI4MmJkZDM1ZjA4NGE5Y2Y5ZGMwMTU3Mjg4ZTJiZjY0YzIwMTFiNjM3N2Y3YTQ0YTU5MTYyNDA1MjhmNDQ1MWYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1166-diagnostics`, коммит `dc59bd62c3d0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c359809878838b4828895f02fa5b520f22871235`
  ```
  git log --all --format='%H %T' | grep c35980987883
  ```
- Тело issue: `e87323eec5cd8343e3fccc7b4ea9bf8111a8e9b08397fb2f5a31b04438d7411e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzIsIm91dHB1dF90b2tlbnMiOjEzNjA2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjY2OTYyLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6OTMzOTI4LCJjb3N0VXNkRXN0aW1hdGUiOjAuNTkwNzU3Nn1dLCJ0dXJucyI6MjQsImR1cmF0aW9uTXMiOjE3NjU3MSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNTkwNzU3NiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=32 output_tokens=13606 cache_creation_input_tokens=66962 cache_read_input_tokens=933928 num_turns=24 -->
