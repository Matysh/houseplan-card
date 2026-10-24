# CODE-REVIEW-1058-r2

## Материал

- SHA: `a75de781798094e9113aee3f4685644e34e3ca30` (= `git rev-parse HEAD`, совпадает с меткой задачи). Не делал `fetch`/`pull`/`checkout` — рабочая копия уже на нём.
- Диапазон: `git log --oneline origin/dev..HEAD` — 2 коммита: `af6572310` (`ci: give complete selected browser plans a finite 50-minute budget`, Issue #1058, User-Visible: no) и `a75de7817` (`docs: review document for #1058`, добавляет только `docs/reviews/CODE-REVIEW-1058-r1.md`, 173 вставки, других файлов не трогает — проверено `git show --stat`/`git show -- . ':!docs/reviews/CODE-REVIEW-1058-r1.md'`, вторая команда дала пустой diff).
- Трек: `show`, этап `code`, заход `r2`, блокирующих циклов использовано 0 из 2 (лимит show, #227: зелёный r1 цикл не образовал).
- `git rev-list --left-right --count HEAD...origin/dev` → `2 0` (HEAD впереди на 2, не отстаёт); `git merge-tree --write-tree HEAD origin/dev` — один write-tree хэш, конфликтов нет.
- Validate-gate на этом материале принят заранее (review-light proof,
  https://github.com/Matysh/houseplan-card/actions/runs/40090648716, «review-light proof is complete», `full=false`/`mutants=false`) — переиспользован без повторного прогона общего гейта. Ниже — только адресные проверки по делу, плюс целевая переподтверждающая выборка (см. «Повторный раунд — дельта»).

## Почему round r2, а не r1 (контекст из issue)

Это не возврат на правки — найдено 0 High/Medium в r1. Хронология по комментариям issue:

1. r1 (материал `3e363dec2`) — зелёный, High 0, Medium 0, бюджет 0/2.
2. Пока шло ревью, `origin/dev` продвинулся на 6 коммитов; патч-id материала и актуального кода разошлись (§2.10, #492) — владелец пометил вердикт неприменимым к уже другому дереву.
3. Первая попытка привести ветку к `dev` дала красный Validate (`product profile has no complete event coverage plan`, run `40089854765`) — ревью не запускалось, цикл не потрачен (гейт стоит до ревью намеренно, #510).
4. Повторное приведение к `dev@7ee838b2` конвейер выполнил сам: пересоздал содержательный коммит (`af6572310`, новый patch-id из-за соседних правок в тех же файлах — `scripts/ci-registry-inventory.json` получил вставку для #1056 между прежней и текущей версией, `docs/DEVELOPMENT.md` правился соседними задачами #1026/#1056) и заново применил уже принятый `docs/reviews/CODE-REVIEW-1058-r1.md` поверх — отсюда `a75de7817`.
5. Автор получил отдельный полный canonical review-light proof на точном SHA `a75de781` (run `40090648716`, SUCCESS) и вернул `S7-code-review`.

Итог: материал r2 содержит тот же логический диф, что и r1, пересаженный на новый `dev`; задача на независимую переоценку — не правки по находкам.

## Скоуп задачи

Issue #1058 (`docs/SCOPE.md`: инфраструктура CI, обслуживающая доставку, Core user job не затрагивается напрямую). Проблема: выбранный (не полный) план из 256 browser-смоков в #1025 был обрезан жёстким лимитом job `40m0s` на 246/256 выполненных сценариев (244 PASS, 2 FAIL, 10 не исполнены), фактический интервал 2358.432 с. Изменение — только `timeout-minutes` job `browser_selected` в каноническом `validate.yml` 40 → 50, пересоздание `validate-product.yml`, сопроводительная документация и инфра-ledger. Трейлеры коммита `af6572310`: `Issue: #1058`, `User-Visible: no` — верно, changelog не требуется.

## Критерий трека show (route, §5, #726)

Не изменился относительно r1 — дифф по содержанию тот же:

- **complexity** — одна строка значения (`40`→`50`) в двух синхронизированных файлах; риск низкий.
- **surfaces** — одна поверхность: бюджет job `browser_selected` в CI.
- **migration** — нет миграции конфига, нет новых compatibility-полей.
- **ux-contract** — `User-Visible: no`, поведение карточки не меняется.
- **perf-touch** — бюджет задания CI, не продуктовый perf-threshold; touch-контракт не затронут.
- **undocumented** — тот же зафиксированный приём из #1055 («конечный job-бюджет по измеренному инвентарю»), не новый паттерн.

Вывод: `route: fix`.

## Повторный раунд — дельта (§2.10)

Материал r1 (`3e363dec297fc0394cf7d672c110e3915920732d`, дерево `92fc833510c4db60e572921c8bac5773bebb9d4f`) не резолвится локально (`git cat-file -t` → `bad object`) — по правилу это обычное дело, не находка: ветка была пересажена конвейером на новый `dev`, старое дерево никогда не попадало в текущий форк. Прямой `git diff <r1 SHA>..HEAD` поэтому недоступен; дельта установлена по содержанию:

- Полный `git show af6572310` построчно сверен с таблицей AC и разделом «Как проверялось» документа r1 — совпадают: те же два файла workflow (`40`→`50`, тот же текст комментария про run `40084326899`/job `120844476069`, 246/256, 2358.432 с), тот же абзац в `docs/DEVELOPMENT.md`/`docs/STATUS.md`, тот же `docs/release-ledger/v1.82.0/1058.json`, та же строка в `scripts/ci-registry-inventory.json`. Расхождений в содержательной части не найдено.
- Единственное изменение относительно r1 по существу — коммит `a75de7817`, который только публикует уже принятый документ r1 в репозиторий; содержательных файлов не касается (пустой `git show -- . ':!docs/reviews/CODE-REVIEW-1058-r1.md'`).
- Причина смены patch-id объяснена и проверена: 6 промежуточных коммитов `dev` (#1026, #1056) трогали `docs/DEVELOPMENT.md` и `scripts/ci-registry-inventory.json` — те же файлы, что правит #1058, но другими абзацами/записями; ни один не касается `.github/workflows/validate*.yml` или тестов, которые r1 использовал как целевые (`test/workflow-hygiene.test.mjs`, `test/validate-workflow.test.mjs`, `test/ci-proof-registry.test.mjs`, `test/browser-push-plan.test.mjs`). `git merge-tree` подтверждает чистое слияние.
- Один входной файл всё же сдвинулся за пределы диффа #1058: `scripts/mutation-registry.mjs` правился коммитом `734f6ef81` (#1026/#1056) уже после того, как r1 его протоколировал через зависящие тесты. Это меняет oracle для r1-бакета «прочие tooling-тесты» — поэтому не наследую их результат, а переподтверждаю ниже.

## Как проверялось (переподтверждение целевых проверок на фактическом SHA)

| Проверка | Команда | Результат |
|---|---|---|
| Синхронность canonical/generated workflow | `node scripts/ci-profiles.mjs --check` | PASS (exit 0) |
| Реестр CI-инвентаря включает ledger #1058 | `node scripts/ci-registry-inventory.mjs --check` | PASS (exit 0) |
| Трейлеры/статус issue для 2-коммитного инфра-диапазона | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 ожидаемое WARN (п.8, тот же текст, что и в r1, теперь на 2 коммитах) |
| Документация/ссылки | `node scripts/check-docs.mjs --screenshots=warn --external=warn` | PASS (7 файлов, 17 внешних ссылок); WARN о несвежем снимке — не гейт задачи (#697) |
| Покрытие входов | `node scripts/check-inputs.mjs --coverage` | PASS |
| Целевые unit-тесты, парсящие изменённые workflow/реестр (риск-зона диффа, та же выборка, что в r1) | `node --test test/workflow-hygiene.test.mjs test/validate-workflow.test.mjs test/ci-proof-registry.test.mjs test/browser-push-plan.test.mjs test/review-doc-guard.test.mjs` | 159/159 PASS |
| Переподтверждение бакета «прочие tooling», т.к. `scripts/mutation-registry.mjs` сдвинулся в `dev` после r1 (изменился oracle — не наследую результат) | `node --test test/mutation-gate.test.mjs test/mutation-gate-report.test.mjs test/mutation-shards-899.test.mjs test/release-workflow.test.mjs test/smoke-exception-guard.test.mjs test/process-metrics.test.mjs test/coverage-diagnostic.test.mjs` | 166/166 PASS |
| Чистота слияния с актуальным `dev` | `git merge-tree --write-tree HEAD origin/dev`, `git rev-list --left-right --count HEAD...origin/dev` | один write-tree хэш, конфликтов нет; `2 0` (впереди 2, не позади) |
| Accepted validate-gate proof для точного SHA | ссылка в хендоффе задачи + подтверждение автора (команда `validate-gate.mjs --sha=a75de781... --mutants=false --full=false --no-wait`) | `result=green`, `review-light proof is complete`, run `40090648716` |

Ни один из тестов по-прежнему не хардкодит `40` специально для job `browser_selected` (видно по тексту тестов `workflow-hygiene` — диапазон `1..180` минут).

## Проверка AC

AC — обычные (CI job budget, не защитный гард продукта), таблица «чем краснеет» не требуется. Содержание AC не изменилось относительно r1; ниже — подтверждение, что текущий SHA по-прежнему реализует их.

1. **«Только selected browser job получает конечные 50 мин, остальное не трогается; canonical/generated согласованы»** — доказано чтением `git show af6572310` (ровно по 2 строки в каждом из двух workflow-файлов — комментарий и `timeout-minutes`) и исполнением `ci-profiles.mjs --check` (PASS). Коммит `a75de7817` этих файлов не касается. **Выполнен.**
2. **«Existing tooling/workflow/parser/CI-plan tests, derived metadata/static/process checks и обязательный pre-push hook проходят»** — доказано исполнением на фактическом SHA: 159+166 целевых тестов зелёные (325 всего, тот же набор, что в r1, плюс переподтверждённый mutation-registry-зависимый бакет из-за сдвинутого oracle), `process-gate.mjs`, `check-docs.mjs`, `check-inputs.mjs`, `ci-registry-inventory.mjs` зелёные. Полный pre-push hook самостоятельно не перезапускался — автор прогнал его при исходном push `3e363dec` и подтвердил отдельным каноническим review-light Validate на точном `a75de781` (run `40090648716`, SUCCESS). **Выполнен.**
3. **«После фактического S8 потребители включают accepted dev и исполняют полный собственный selected plan с новым бюджетом; новый infra PASS сам по себе не делает #1025/#1038 зелёными»** — условие о будущем поведении вне данного SHA, непроверяемое сейчас. Проверено чтением: ledger/комментарии коммита это явно отрицают, продуктовый код не тронут. Проверено чтением, не исполнением.

## Числа, видимые дважды (§8)

`50` минут и исходные `246/256`, `2358.432 с` — те же источники, что в r1 (issue, `docs/release-ledger/v1.82.0/1058.json`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `validate.yml`, `validate-product.yml`). `validate-product.yml` остаётся генерируемой проекцией `validate.yml`, подтверждено `ci-profiles.mjs --check`. Коммит `a75de7817` новых чисел не вводит. Расхождений нет.

## Побочные находки

Доверенный снимок политики: `{"schema":"houseplan-outside-findings-policy/v1","mode":"issues",...}`. Побочных находок вне скоупа задачи не обнаружено — новых issue не заводится. (Отдельно от этой задачи автор зарегистрировал #1059 про дефект выбора/fallback профиля Validate, обнаруженный при первой неудачной попытке приведения к `dev` — это уже существующий отдельный issue автора, не новая находка ревью, и в #1058 его код не включён.)

## Что проверено и корректно

- Диапазон изменений строго B+C: workflow-таймаут, сопроводительная документация, инфра-ledger и публикация документа ревью r1; продуктовый код, `src/**`, состав планов и отдельные invocation-лимиты не тронуты.
- Трейлеры `Issue: #1058`/`User-Visible: no` на содержательном коммите корректны; changelog не требуется и не менялся.
- `docs/release-ledger/v1.82.0/1058.json`: без изменений относительно r1 — `category: infra`, обоснование соответствует факту, `baseStable: v1.82.0` корректен (инфраструктура не входит в пользовательский milestone, #838).
- Смена SHA между r1 и r2 объяснена и проверена содержательно: это пересадка на новый `dev` плюс публикация уже принятого документа, не новая правка кода — соответствует правилу «смена SHA из-за review/docs сама по себе не отменяет пригодное доказательство».
- Критерий track show (route, §5) по-прежнему пройден по всем пунктам — reclassify не требуется.
- Отдельно переподтверждён бакет тестов, чей oracle (`scripts/mutation-registry.mjs`) сдвинулся в `dev` после r1 — 166/166 PASS на фактическом материале, а не унаследовано вслепую.

## Чего не проверял

- Реальный прогон GitHub Actions с новым 50-минутным лимитом (станет ли он достаточным для полных 256 смоков) — технически невозможно проверить без исполнения полного selected-плана в CI; риск назван автором и не является находкой.
- Полный обязательный pre-push hook и полный `gate:small`/tooling-набор целиком не перезапускались — переиспользован accepted review-light proof точного SHA (run `40090648716`) и целевые риск-зоны диффа перепроверены адресно (см. таблицу выше). Общий `npm test`/`gate:small` не являются запасным сценарием ревью при принятом proof.
- Мутанты, полная ночная mutation-matrix, perf/визуальная регрессия — не запускались: задача их не задевает (чистая CI-инфраструктура), явно согласовано ТЗ («перф/мутации/полную регрессию локально не запускать»).
- AC3 (будущее поведение потребителей после S8) — не тестируемо на этом SHA, разобрано чтением выше.
- Ручная dev/GPU-приёмка владельцем не проводилась — для трека show и инфраструктурной задачи без визуального риска это не находка (#929).
- История неудачной попытки Validate (run `40089854765`, «product profile has no complete event coverage plan») — не относится к текущему материалу: заменена отдельным успешным каноническим review-light proof на точном `a75de781`; основная причина дефекта зарегистрирована отдельно как #1059 и не входит в материал этой задачи.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| — (r1 завершился зелёным, High 0, Medium 0; находок, требующих закрытия, не было) | — | комментарий r1 в issue: «Вердикт: зелёный · заход r1 · … High: 0 · Medium: 0»; документ `docs/reviews/CODE-REVIEW-1058-r1.md`, раздел «Вердикт» |

r2 назначен не из-за возврата на правки, а из-за смены материала (патч-id разошёлся при опережении `dev` на 6 коммитов, §2.10/#492) и последующей пересадки ветки конвейером на новый `dev` — см. раздел «Почему round r2» выше.

## Унаследовано из r1

Без повторной проверки принято (документ `docs/reviews/CODE-REVIEW-1058-r1.md`, материал `3e363dec297fc0394cf7d672c110e3915920732d`, дерево `92fc833510c4db60e572921c8bac5773bebb9d4f` — не резолвится локально после пересадки на новый `dev`, что ожидаемо и не находка):

- Скоуп задачи и классификация B+C/`User-Visible: no`/track show — содержание не изменилось, подтверждено построчной сверкой диффа в разделе «Повторный раунд — дельта» этого документа.
- Анализ AC1 и AC2 по существу (что именно меняется и что — нет) — содержание не изменилось; на r2 переподтверждено исполнением на фактическом SHA (см. «Как проверялось»/«Проверка AC»), а не взято на веру.
- Разбор AC3 чтением (условие о будущем поведении потребителей) — логика не зависит от конкретного SHA, принята без повторного разбора.
- Отсутствие побочных находок вне скоупа — переподтверждено отдельно на r2 (см. «Побочные находки»), не наследовалось вслепую.

## Вердикт

Зелёный. High: 0, Medium: 0. Маршрут: `fix` (задача проходит все критерии §5 track show, reclassify не требуется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1058-selected-browser-budget`, коммит `a75de7817980` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d1cc3168def22dedff4a7948259f0d59d8dd4782`
  ```
  git log --all --format='%H %T' | grep d1cc3168def2
  ```
- Тело issue: `f6a31df227c80255373e0ce18de8ff65692e6d83302b7861c59009d259306c87`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTAsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTl9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjUyLCJvdXRwdXRfdG9rZW5zIjoyMzQzMiwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo3Mzk4NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE3MTk0NTEsImNvc3RVc2RFc3RpbWF0ZSI6MC44NzQyNTAyfV0sInR1cm5zIjozMSwiZHVyYXRpb25NcyI6NDYzMTY1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC44Nzk0NDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5142 output_tokens=23452 cache_creation_input_tokens=73984 cache_read_input_tokens=1719451 num_turns=31 -->
