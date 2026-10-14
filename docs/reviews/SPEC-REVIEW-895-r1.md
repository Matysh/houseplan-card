# SPEC-REVIEW-895-r1

Этап: ревью ТЗ (PROCESS.md §2.4). Трек: `ask`. Заход r1, блокирующих циклов
израсходовано 0 из 4.

Материал: тело issue [#895](https://github.com/Matysh/houseplan-card/issues/895),
раздел `## ТЗ`, снятое через `gh issue view 895 --json body` в начале этого
ревью; `specFormatErrors` подтверждает структуру раздела на этом же снимке.
Комментарии issue (аналитика + хендофф автора) прочитаны целиком — оба от
2026-10-14, реализация не начата.

## Скоуп проверки

- `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md` — прочитаны перед
  началом (порядок §7.1/entry-cost).
- Тело issue #895 и оба комментария — через `gh issue view`/`gh issue view
  --json comments` (MCP `get_issue`/`get_issue_comments` недоступны в этой
  сессии, использован эквивалентный CLI-путь).
- Обязательные разделы ТЗ (§7.1) и нумерация AC — структурной проверкой
  `specFormatErrors()` из `scripts/review-preflight.mjs`, вызванной напрямую
  на сохранённом теле issue.
- Технические утверждения проблемы сверены с текущим кодом на `ef1aeaf6`:
  `src/device-presentation.ts` (markerStates/`options.lightSources`),
  `src/render-snapshot-reuse.ts` (#850, presentation key, incremental
  invalidation), `src/render-snapshot-capture.ts` (reuse window владеет
  `planLightSources`).
- Классификация Release-артефактов (`ledger stable-fix относительно v1.80.1`)
  сверена: `git log`/`git show` на времени появления кода, сравнение с уже
  принятым `docs/release-ledger/v1.80.1/850.json` (прецедент той же дельты).
- Ссылки на смежные issue (#850, #888, #889, #813) проверены `gh issue view`
  на существование и тему.
- Канонический документ подсистемы — `docs/DEVICE-PRESENTATION.md`: термины
  ТЗ (`derived_marker_state`, `lightSources`, `shared physical owner`, `manual
  virtual`, cycles) сверены с ним и с кодом — совпадают, новых терминов без
  основания не найдено.

## Чего не проверял и почему

- Гейты реализации (`tsc`, `npm test`, `npm run build`, golden, performance,
  invariants) — не прогонял: `реализация не начата` (хендофф автора), код
  продукта не менялся, Validate на `ef1aeaf6` зелёный и к этой задаче
  неприменим (это ревью ТЗ, а не кода).
- Числовую воспроизводимость измерения «203 маркера → 40 600 builds» на
  `oracleFixture` не перепроверял запуском — это утверждение «Проблемы», а не
  AC; для спек-ревью важна проверяемость будущего AC, а не повторный прогон
  уже выполненного профиля. Код самого узла (filter/map по
  `options.lightSources` независимо от `needsMarkerState`) прочитан и
  подтверждает механизм, которым объясняется число.
- Черновик кода автора (если он есть в локальной ветке) не читается и
  доводом не считается (§2.4, §11.8) — не открывал ветку `issue/895-*`.

## Находки

Ни одной High- или Medium-находки после проверки.

Рассмотренная и снятая гипотеза (не находка): можно было заподозрить, что
классификация «ledger stable-fix относительно v1.80.1» в разделе
«Release-артефакты» неверна, поскольку сам механизм инкрементального reuse
(`render-snapshot-reuse.ts`) впервые появился в коде только 2026-10-14, уже
после тега `v1.80.1` (2026-10-09) — то есть выглядит как часть текущей беты,
а не починка существующего стабильного поведения. Проверка истории показала
обратное и сняла вопрос: до #850 **любой** HA-тик (не только световой)
пересобирал весь кадр презентаций заново — это и есть зафиксированное в
`docs/release-ledger/v1.80.1/850.json` поведение, уже существовавшее в
v1.80.1 («В v1.80.1 уже были те же горячие пути... #850 исправляет это
существующее поведение без новой функции»). #850 убрал лишнюю работу для
обычных сенсорных тиков, но для срабатывания по изменению light graph
поведение осталось тем же, что было до v1.80.1 — полная пересборка. #895
описывает именно это: отдельно измеряемый, оставшийся кусок той же
pre-v1.80.1 проблемы, а не новую функцию поверх #850. Классификация
`stable-fix` относительно v1.80.1 для #895 поэтому согласована с прецедентом
собственного ledger-файла #850 и не требует `introducedBy` на бета-фичу.
Отдельно: конкретный код, на который указывает «Проблема» (`markerStates =
markerStateGraph.filter(...).map(...)` в `resolveDevicePresentation`),
подтверждённо существует с 2026-08-29 — задолго до v1.80.1 — что независимо
подтверждает дату происхождения дефекта.

## Что проверено и корректно

- Все обязательные разделы §7.1 присутствуют и в правильном порядке:
  сценарий, что человек увидит, проблема, скоуп и не-скоуп, контракт
  поведения, UX и доступность, модель данных и миграция, i18n, критерии
  приёмки, план автотестов и риски, откат, release-артефакты. Структурная
  проверка `specFormatErrors()` возвращает пустой список ошибок.
- AC1…AC5 пронумерованы подряд без пропусков, у каждого явно назван способ
  доказательства (`unit`, `unit`, `smoke/performance`, `unit`,
  `smoke/golden`) и численный/качественный порог, который делает критерий
  проверяемым, а не намерением: AC1 (`≤1/tick`, `rebuilds=0` после
  warm-up, явное «краснеет на…»), AC2 (deep-equal с канонической полной
  проекцией на каждый tick, явный fallback-кейс и его «краснеет»), AC3
  (не менее 50% сокращения на независимом сценарии, допустимое «без
  изменений» на связанном сценарии, запрет поднимать ceiling существующих
  профилей), AC4 (отсутствие orphan cache, устойчивость к повторной подмене
  HA-объекта), AC5 (golden как доказательство неизменности пикселей/сцен,
  запрет принимать baseline ради ускорения).
- Технические утверждения «Проблемы» перепроверены чтением кода, а не
  приняты на слово: `resolveDevicePresentation` (`src/device-presentation.ts:703-709`)
  действительно строит `markerStates` через `filter`/`map` по всему
  `markerStateGraph = options.lightSources || …` на каждый вызов —
  независимо от того, нужен ли этому конкретному маркеру
  `derived_marker_state`; `RenderSnapshotReuseWindow` (`src/render-snapshot-reuse.ts:87`)
  действительно включает `lightSources` в «presentation key» целиком по
  идентичности, так что любое изменение этого графа переводит окно в режим
  `refreshed` (полная пересборка всех презентаций) — ровно то, что описывает
  раздел «Проблема».
- Терминология ТЗ (`derived_marker_state`, `options.lightSources`, `shared
  physical owner`, `manual virtual`, `controls`, `cycles`) совпадает с кодом
  и с `docs/DEVICE-PRESENTATION.md`; новых пользовательских терминов,
  требующих сверки с `docs/USER-GUIDE.ru.md`, нет — задача
  **не меняет видимое поведение/UI-терминологию**, только внутреннюю
  производительность (раздел UX и доступность прямо фиксирует «Видимых
  изменений интерфейса нет»).
- Скоуп/не-скоуп перечисляет и модули (`device-presentation/light-sources`,
  `render-device-snapshot/capture/reuse/live runtime`), и явный список
  неприкасаемых соседних инвариантов (`controls`, cycle handling,
  ownership/de-dup, alarm/battery/value/LQI, Glow geometry, LED, schema,
  View fallback) — граница читается однозначно.
- Ссылки на дубликаты и смежные задачи (#850, #888, #889, #813) существуют
  и соответствуют заявленной теме; разграничение «следующий, отдельно
  измеряемый скоуп» после #850 подтверждено чтением обоих
  `render-snapshot-reuse.ts` и ledger-файла #850.
- DoR-пункты (§2.5) закрыты текстом ТЗ: i18n — явное «нет»; миграция —
  явное «нет» (runtime-only); влияние на touch — явное «как прежде»;
  release-артефакты (changelog RU+EN, ARCHITECTURE/DEVICE-PRESENTATION/
  STATUS, ledger, milestone) названы; откат описан (отключение reuse,
  отсутствие потери данных, revert без миграции схемы); риски перечислены;
  открытых продуктовых вопросов в тексте нет, и ни одного места, где факт
  подменял бы непроверенное предположение, не нашлось — единственное
  предположение («принято предположительно, поменять свободно»: структура
  dependency index и то, что порог rebuild зафиксирован только для
  independent-фикстуры) явно помечено как таковое самим автором, в теле
  issue, а не скрыто в тексте контракта.
- Раздел «Принято предположительно» корректно разводит технический выбор
  (структура индекса зависимостей) и продуктовый инвариант (порог в AC3 не
  обещание ускорения произвольных графов) — ревьюеру нечего оспаривать:
  оба пункта — не наблюдаемое пользователем поведение (§7.1).
- Методологический пункт 5 контракта (сопоставимость profiling: тот же
  base/material, pins, workload, bootSoft/continuity на обеих сторонах,
  запрет bypass boot phase на одном SHA или подмены бюджета/фикстуры) закрывает
  типичный способ незаметно "улучшить" перформанс-метрику без реального
  выигрыша — проверяемое и однозначное требование.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/SPEC-REVIEW-895-r1.md

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `ef1aeaf6cf94` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c017a35e0a1fd3b3a5043aa3b969a09901c92316`
  ```
  git log --all --format='%H %T' | grep c017a35e0a1f
  ```
- Тело issue: `22931526ed7b96663a1b7bff401c1236208ce70ca970b84c13ce91a263ae2ab6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQyNjksIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0MzU0fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2Niwib3V0cHV0X3Rva2VucyI6MzQ0MDAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTE5MDM3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6Mjc3NjgzNiwiY29zdFVzZEVzdGltYXRlIjoxLjM3NTY0NzIwMDAwMDAwMDR9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjo0MDU5NDEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjM4MDAwMTIwMDAwMDAwMDQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4335 output_tokens=34417 cache_creation_input_tokens=119037 cache_read_input_tokens=2776836 num_turns=40 -->
