# CODE-REVIEW — issue #961, r2

Материал: `931425dde196cc4cd037d558930e052d9f46353f` (рабочая копия уже на нём; `git fetch/pull/checkout` на другой коммит не выполнялись).
Трек: `show`. Заход: r2, блокирующих циклов израсходовано 0 из 2.
Доверенный снимок находок (встроен в Review prompt): `{"schema":"houseplan-outside-findings-policy/v1","source":"actions-variable","variable":"HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES","repo":"Matysh/houseplan-card","issue":961,"stage":"code","round":2,"mode":"issues","path":null}` — `mode=issues`, сверочный `REVIEW_FINDINGS_POLICY` совпадает, расхождений нет.

## Скоуп

Issue #961 — регрессия `process-resume.mjs`: job «Разбудить раунд, ждавший этот Validate» отклоняла завершённый sealed-green результат #957 с `completed model seal invalid: ... findings policy: invalid review identity`. r1 (зелёный, High 0 / Medium 0) принял точечный фикс `resumeEvidence`: `expected: { ...prepared, repo }`, где `repo` — аргумент контроллера, побеждающий любое постороннее поле в скачанном `prepared.json`.

r2 открылся не новым дефектом, а внешним событием: пока проверенный кандидат `f370cb29f07f` ждал Validate, в `dev` влился SPEC-REVIEW #956, и владелец зафиксировал «слияние приведёт ветку к dev, и это другой код (§2.10)» → `S6-in-progress`, причина `dev changed; fresh candidate required`. Автор прогнал `node scripts/rebase-on-dev.mjs` и запушил новый кандидат `931425dde`.

## Материал раунда r1 (для дельты)

- Документ: `docs/reviews/CODE-REVIEW-961-r1.md`.
- SHA материала r1: `fbd500798e78e497a6b9e121526dfdaadcf9c152` (не резолвится в локальном дереве после ребейза — ожидаемо, он осиротел ребейзом; это не находка, см. REVIEWER.md «Повторный раунд»).
- Вердикт r1: зелёный, High 0 / Medium 0, маршрут `fix`.

## Диапазон r2 (`origin/dev..HEAD`, 3 коммита)

```
5cc0f6adf fix(process): bind resumed findings to trusted repository (#961)
898cf3961 docs: review document for #961
931425dde docs(reviews): индекс после сдвига каталога (#961)
```

Проверка дельты — побайтовое сравнение содержимого с тем, что рецензировал r1 (а не повторное чтение логики):

| Файл | Blob на `931425dde` | Совпадает с r1 |
|---|---|---|
| `scripts/process-resume.mjs` | `67a3892d98e7cb508e91bc6ff7a95a84b79ba212` | да — автор и r1 называют тот же blob |
| `test/pipeline-outcomes-897.test.mjs` | `1b5726f88e6c7be7f40eb89ed36e635f3b3e698b` | содержимое идентично диффу, который рецензировал r1 |
| `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `release-ledger/v1.81.0/961.json` | — | идентичны r1 |

Коммит `898cf3961` — публикация собственного `docs/reviews/CODE-REVIEW-961-r1.md` (96 строк, только добавление), `931425dde` — добавление одной строки `#961` в `docs/reviews/INDEX.md`. Оба коммита — generated/doc-only артефакты конвейера за прошлый зелёный раунд, не новый авторский код. **Содержательного (исполняемого) изменения между материалом r1 и материалом r2 нет** — ребейз принёс только собственные артефакты r1 поверх нового `dev`; `dev`-часть (SPEC-REVIEW #956) в диапазон `origin/dev..HEAD` не входит, т.к. уже находится в `origin/dev`.

Это нелокальная по форме дельта (ребейз на ушедший вперёд `dev`, п. «Разбор остаётся полным» REVIEWER.md), поэтому ниже — не сокращение строгости, а независимое подтверждение всех пунктов r1 на фактическом HEAD, а не доверие заявлению автора.

## Независимая проверка исполнением (на `931425dde`)

- `git rev-parse HEAD:scripts/process-resume.mjs` → `67a3892d9...` — подтверждён как исполняемый код, не текстовое заявление.
- `node --test test/pipeline-outcomes-897.test.mjs` → **14/14 pass**, 0 fail/skip, включая все кейсы `#961 ...` (verified noop issues/file × push/workflow_dispatch; trusted repo defeats foreign policy; policy/seal/companion/epoch/body/material guards; реальный CLI-спавн `legacy/issues/file`).
- `node --test test/process-digests.test.mjs test/release-ledger.test.mjs` → **16/16 pass** — ссылки/якоря `REVIEWER.md`/`DEVELOPMENT.md` и схема `961.json` в реестре не нарушены.
- `node scripts/process-gate.mjs --issues` → PASS, диапазон 3 коммита, предупреждение ожидаемое («инфраструктурный диапазон, статусная метка не требуется до S7» — п.8, #562), файлов класса A нет.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` → `"noExecutableDiff": true` — браузерные смоки этим диапазоном не требуются.
- `git diff --check origin/dev...HEAD` → чисто (exit 0), без whitespace-ошибок.
- `docs/reviews/INDEX.md` → ровно одна строка `#961`, без дублей, формат совпадает с соседними записями.
- Validate на точном SHA материала подтверждён независимо: `gh run view 39218538320` → `headSha: 931425dde196cc4cd037d558930e052d9f46353f`, `conclusion: success` — совпадение SHA проверено напрямую, не со слов автора.

### AC · чем доказан · чем краснеет (идентично r1, код не менялся)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (repo контроллера, не поле артефакта; verified noop issues/file, push/workflow_dispatch) | `#961 sealed issues/file policy result stays a verified noop for push and dispatch` (прогнан выше, pass) | Разобрано чтением кода (унаследовано из r1, код побайтово тот же): без `repo` в `expected` → `identity()` в `review-findings-policy.mjs` требует `typeof repo === 'string'` → `findings policy: invalid review identity`, ровно наблюдение issue. Мутант не прогонялся — запрещено вне ночного workflow (#905) |
| AC2 (policy/seal/companion/continuation guards; чужой repo/issue/stage/round/path/source, corrupt JSON, битый manifest/hash, другой epoch/body/material — fail-closed) | `#961 trusted controller repo defeats foreign policy...`, `#961 current policy never bypasses...` (прогнаны выше, pass) | Обычные отрицательные случаи на неизменённой реализации, исполнены в составе прогона выше (throw/reject по каждому сценарию) |
| AC3 (реальный CLI на Linux, offline fixture: valid → exit 0, corrupted/forged → nonzero, без write API) | `#897/#961 actual resume CLI: legacy/issues/file policy...` (прогнан выше, pass, реальный спавн процесса) | Та же проверка — битый seal и подделанный repo с пересчитанными checksum → nonzero, исполнено |

## Трейлеры, changelog, release-ledger

- Все 3 коммита диапазона несут `Issue: #961` / `User-Visible: no` — корректно, два docs-коммита класса C не обязаны нести трейлеры по правилу («докс-only commit needs none»), но несут их явно без противоречия.
- `User-Visible: no` ⇒ правка CHANGELOG.md/CHANGELOG.ru.md не требуется и не делалась — верно, изменений, видимых пользователю HA, нет (внутренний конвейер ревью).
- `docs/release-ledger/v1.81.0/961.json`: `category: "infra"`, обоснование по существу относительно `v1.81.0`, `introducedBy` не требуется (нужен только `line-fix`). `infra` не входит в пользовательский milestone релиза — правило соблюдено.
- Чисел, видимых пользователю дважды, в диффе нет (process-инфраструктура, не продуктовый UI).

## Маршрут §726 / критерии §5 (трек show)

Критерии не изменились относительно r1, т.к. код идентичен:

- `complexity` ≤ 3 — да, точечная однострочная правка в одной функции.
- `surfaces` — одна поверхность (`resumeEvidence` в `scripts/process-resume.mjs`).
- `migration` — нет новых полей конфигурации/совместимости.
- `ux-contract` — нет, поведение непубличное (process-инфраструктура, не UI).
- `perf-touch` — не затронуто.
- `undocumented` — поведение «repo — authority контроллера, не поле артефакта» уже реализовано и задокументировано для соседнего пути (`review-result-gate.mjs` CLI, `expected.repo = process.env.REPO`); фикс приводит `resumeEvidence` к тому же канону, нового контракта нет.

Все критерии §5 пройдены → `route: fix`.

## Что проверено и корректно

- Дельта r1→r2 — исключительно ребейз-артефакты (собственный `CODE-REVIEW-961-r1.md` и строка `INDEX.md`), исполняемый код побайтово идентичен тому, что принял r1.
- Все узкие и смежные unit-тесты диапазона — зелёные прогоном на точном HEAD `931425dde`.
- `process-gate --issues`, `smoke-select`, `git diff --check` — зелёные прогоном.
- Validate CI на точном SHA материала — success, проверено напрямую через `gh run view`.
- Трейлеры, release-ledger, маршрут §5 — без расхождений с r1.

## Чего не проверял и почему

- `npx tsc --noEmit`, `npm test` (полный), `npm run build` + сверка трёх копий бандла — не перегонял: Validate на этом же SHA `931425dde` зелёный (run 39218538320, подтверждено выше), допустимо по §8/#343; диапазон не содержит кода бандла (`noExecutableDiff: true`).
- Браузерные смоки и `golden:verify` — не запускал: нет исполняемого UI/рендер-диффа, меток `ci:golden`/`ci:windows-native` нет, тело issue не называет смок.
- `pytest tests_backend` — не запускал: Python не затронут.
- Инварианты модели (`npm run invariants`) — неприменимо: геометрия плана не затронута.
- Живой прогон `process-resume.yml`/`process-reconcile.yml` на реальном GitHub Actions (сетевой, против `gh api`) — не выполнял; вне ревью, доказательство — офлайн CLI-фикстура (AC3), исполненная выше, плюс исторический read-only реплей подлинных #957-артефактов, задокументированный в r1 и не оспариваемый дельтой.
- Временный ручной патч `scripts/process-resume.mjs` (откат фикса) с последующим прогоном — не выполнял: исполнение мутанта продуктового/исполняемого кода запрещено вне ночного workflow даже ревьюеру (#905). Регрессионный сценарий AC1 разобран чтением (унаследовано из r1, код не менялся).
- Полный `npm run gate:small` на нескольких ОС — не перегонял повторно: автор привёл Linux/Windows прогоны на r1-материале и дополнительный Linux-прогон на `f370cb29` (PASS), а дешёвые гейты этого раунда уже покрыты зелёным Validate на точном SHA.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| — (находок в r1 не было) | не применимо | `docs/reviews/CODE-REVIEW-961-r1.md`, раздел «Находки»: «Нет» |

r1 завершился без находок; возврат в r2 вызван исключительно событием «dev changed» (§2.10), а не дефектом кода.

## Унаследовано из r1

Без повторной проверки логики (код побайтово идентичен — см. таблицу blob’ов выше), принято из `docs/reviews/CODE-REVIEW-961-r1.md` (материал `fbd500798e78e497a6b9e121526dfdaadcf9c152`):

- Разбор корня бага: отсутствие `repo` в `PASSPORT_FIELDS`/`prepared.json` и путь `identity()` в `review-findings-policy.mjs`, приводящий к точному тексту ошибки из issue.
- Анализ отсутствия побочных эффектов добавления `repo` в объект `expected` для других потребителей `prepared`.
- Read-only реплей подлинных исторических артефактов #957 (producer run 39204756581): до фикса — exit 1 с точным `invalid review identity`, после — exit 0 verified noop; наблюдение не переисполнялось в r2, т.к. не относится к дельте.
- Multi-OS прогоны `gate:small` (native Windows 227 с, independent Linux 173 с, pre-push Windows 205 с) на материале r1.

## Побочные находки

Побочных находок нет (`mode=issues` — новых issue не заводится, обязанность завести появилась бы только при находке Medium вне скоупа).

## Вердикт

Зелёный. Дельта r1→r2 — ребейз без исполняемых изменений (blob’ы идентичны), событие «dev changed», а не дефект. AC1–AC3 остаются доказанными тем же тестовым набором, независимо прогнанным на точном HEAD `931425dde`; Validate на этом SHA success; трейлеры, release-ledger и критерии §5 в порядке. Находок нет.

---

<!-- material-anchors: материал раунда -->

## Материал раунда

- Ветка: `issue/961-sealed-green-resume`, коммит `931425dde196cc4cd037d558930e052d9f46353f`.
- Диапазон: `origin/dev..HEAD` = 3 коммита (`5cc0f6adf`, `898cf3961`, `931425dde`).
- Вердикт раунда: `green` · High 0 · Medium 0 · маршрут `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/961-sealed-green-resume`, коммит `931425dde196` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2797a2080f2cc1b42788efe32633b73589ba853e`
  ```
  git log --all --format='%H %T' | grep 2797a2080f2c
  ```
- Тело issue: `d9ec3ec02d5fbf63ee25c8f74cfb86928bf4de724e6318ae49cad2694cdaa466`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTcsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTgyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozOCwib3V0cHV0X3Rva2VucyI6MTQyMDgsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6Njk4NDksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMjQ0NDY0LCJjb3N0VXNkRXN0aW1hdGUiOjAuNjcwNDQ0ODAwMDAwMDAwMX1dLCJ0dXJucyI6MzEsImR1cmF0aW9uTXMiOjE3MzgwOSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNjc1NjI2ODAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5135 output_tokens=14225 cache_creation_input_tokens=69849 cache_read_input_tokens=1244464 num_turns=31 -->
