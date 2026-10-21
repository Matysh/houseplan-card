# CODE-REVIEW-968-r1

Issue: #968 · Этап: code · Заход: r1 · Трек: show · Блокирующих циклов использовано: 0/2
Материал: `ce30aa4c13ff431c8725dd53c2a9d4d6d0e780c1` (ветка `issue/968-review-context-path-budget`, 2 коммита над `origin/dev`)

## Скоуп

Инфраструктурная задача B/C: поднять конечный cap списка изменённых путей в
`scripts/review-context.mjs` с 200 до 400, не отбрасывая generated/golden пути
и не обрезая `fullHunkReads`. Блокирует независимое ревью #963 (279-путевой
golden refresh отклонялся до модели). Продуктового кода (класс A) в диффе нет.

Изменённые файлы (`git diff origin/dev...HEAD --stat`):

- `scripts/review-context.mjs` — +3/-1: `changedFiles.length > 200` →
  `> 400`, пояснительный комментарий.
- `test/model-evidence-857.test.mjs` — +18: новый тест `#968 bounded golden
  refresh context retains every path and mandatory role sources`.
- `docs/release-ledger/v1.81.0/968.json` — новый, `category: infra`.

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | Переиспользован | Validate на точном SHA `ce30aa4c1` завершился `success` (run [39267020925](https://github.com/Matysh/houseplan-card/actions/runs/39267020925), `conclusion: success`, проверено `gh run view`) — дешёвые гейты подтверждены этим прогоном, повторно не гонял (материал/окружение не изменились). Собственная история прогона: attempt 1 упал на несвязанном `test/dev-build.test.mjs:227` (ENOTEMPTY при cleanup временного git-репозитория, отдельно заведено в #969), attempt 2 — чистый PASS без изменения исходников/ожиданий. |
| `node --test test/model-evidence-857.test.mjs` | **Прогнал сам** | 6/6 PASS. Новый тест AC1/AC2 проверяет 279 путей (200 golden PNG + 1 workflow + 78 src — точно совпадает с реальным инвентарём #963 из тела issue), границу 400 (принято) и 401 (отвергнуто, `assert.throws(/oversized immutable input/)`). |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | **Прогнал сам** | `гейт пройден, предупреждений 1` — предупреждение штатное (#562: инфраструктурный диапазон без S-класса-A файлов до первого S7). Трейлеры `Issue: #968` / `User-Visible: no` на обоих коммитах корректны (нет видимого поведения → changelog не требуется, и правда не тронут). |
| golden/smoke/pytest/invariants/performance | Не гонял | Diff не трогает `src/**`, `demo/**`, Python-бэкенд или геометрию; `ci:golden` на issue не стоит. AC не называют ни один из этих гейтов. |

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Что проверено и корректно

- **AC1** (подлинный пакет #963 принимается, полный список имён/роль
  сохраняется): модульный тест воспроизводит точный инвентарь — 200 golden
  PNG + `.github/workflows/_process.yml` + 78 `src/*.ts` = 279, совпадает с
  числом из тела issue. `context.fullHunkReads` равен входному списку один в
  один (`assert.deepEqual`, без фильтрации/усечения), `requiredRole` —
  `canon` (путь `.github/workflows/...` в списке верно поднимает роль через
  существующий `roleEntry`), `files` включает `PROCESS.md`, `material` и
  `body` не искажены. Второе звено доказательства — ручной прогон автора
  существующего CLI на подлинном `prepared.json` реального
  [run 39265479916](https://github.com/Matysh/houseplan-card/actions/runs/39265479916)
  против того же checkout `d717acfeed916da929349584d46cd65103084bc8`: до
  исправления exit 2, после — `canon; sources=4; full-hunk-files=279`. Эту
  часть я не переисполнял (артефакт `prepared.json` конкретного прошлого
  run недоступен в этой среде) — см. «Чего не проверял».
- **AC2** (400 принимается целиком, 401 отвергается, прежние отрицательные
  проверки не сломаны): тот же тест добавляет 121 путь к 279 (= 400) и
  проверяет полный `fullHunkReads`; затем ещё один путь (= 401) — обычный
  негативный кейс на неизменённой реализации, я его исполнил
  (`node --test`, PASS), он действительно падает в `assert.throws`. Защитный
  AC: таблица «AC · чем доказан · чем краснеет» —
  AC2 · `node --test test/model-evidence-857.test.mjs` (строка 87) ·
  обычный negative-input `changedFiles.length === 401` →
  `/oversized immutable input/`, исполнен, PASS. Существующий тест
  `#857 static-first context...` (строки 61–70: stale body, неверный
  material_sha, опасный путь, body > 256 KiB) не зависит от значения cap и
  остался зелёным без изменений.
- **AC3** (только B/C, infra ledger, обязательные локальные гейты,
  автоматический S8): диффом не тронут ни один файл класса A. Ledger
  `docs/release-ledger/v1.81.0/968.json` — `schema: 1`, `baseStable:
  "v1.81.0"` (совпадает с `docs/STATUS.md`: «Latest stable tag `v1.81.0`»),
  `category: "infra"` — по образцу соседних инфраструктурных записей
  (например `929.json`), без `summary` (не нужен для infra/без
  пользовательского поведения). `rationale` точно описывает изменение и
  явно отрицает расширение semantic-approval.
- Трейлеры `Issue:`/`User-Visible:` на обоих коммитах корректны; `User-Visible:
  no` оправдан — поведение, видимое пользователю продукта, не меняется (это
  внутренний инструмент ревью-конвейера).
- Число 400 — единственный источник правды: встречается в коде (`> 400`),
  в тесте (`boundary` = 279 + 121 = 400, overflow = 401) и в AC текста
  issue; не продублировано в другом месте с риском разойтись.
- Второй коммит (`ce30aa4c1`) — честная правка собственной ошибки автора:
  исходный тест был на 281 путь/119 boundary (не совпадало с реальными 279
  из тела issue), исправлено на 279/121 без изменения продукта — ревью
  своей работы тут ни при чём, это самостоятельная правка автора до подачи
  на ревью.
- Маршрут по критериям §5 (трек show, код-ревью): `complexity` —
  однострочная граница + тест, риск ≤3; `surfaces` — один модуль
  (`scripts/review-context.mjs`); `migration` — нет конфигурации/полей
  совместимости; `ux-contract` — нет UX, это внутренний инструмент
  ревью-конвейера; `perf-touch` — не затронуто; `undocumented` — ожидаемое
  поведение однозначно зафиксировано в теле issue (AC1/AC2 с конкретными
  числами 200→400, 400/401 границы). Все критерии пройдены → `route: fix`.

## Чего не проверял

- Не переисполнял ручной прогон CLI автора против реального `prepared.json`
  run 39265479916 (артефакт недоступен в этой среде) — принял как
  корроборирующее свидетельство к уже самодостаточному модульному тесту
  AC1, который я исполнил сам и который воспроизводит тот же инвентарь
  (279 путей, 200 golden) один в один.
- Не гонял `npx tsc --noEmit` / `npm test` (полный) / `npm run build` +
  сверку бандла — переиспользован зелёный Validate на этом же SHA (см.
  таблицу гейтов); материал и окружение не менялись.
- Не гонял golden/smoke/pytest/invariants/performance — вне диффа и вне AC
  (см. обоснование в таблице гейтов).
- Не исполнял мутанты/временные патчи гарда или продукта — запрещено общей
  политикой вне ночного workflow; «чем краснеет» доказано обычным
  negative-input внутри самого теста.

## Побочные находки

Побочных находок, подпадающих под `REVIEW_FINDINGS_POLICY` (`mode: issues`),
нет — новый issue не заводился.

## Вердикт

Зелёный. Все три AC доказаны (два — модульным тестом, который я исполнил и
который умеет падать; AC1 дополнительно подкреплён ручным CLI-прогоном
автора на реальном материале #963), диапазон строго B/C, трейлеры и ledger
корректны, дешёвые гейты подтверждены зелёным Validate на точном SHA,
релевантные по диффу гейты (тест, process-gate) прогнаны самим ревьюером.
Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/968-review-context-path-budget`, коммит `ce30aa4c13ff` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `31d349e3848ff2bc1ebf90c49ed8977b64461071`
  ```
  git log --all --format='%H %T' | grep 31d349e3848f
  ```
- Тело issue: `062a641286efcefbda831b38deaca79eb1660c0310ad4682c5652a129e32e487`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDYsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTgxMDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1Miwib3V0cHV0X3Rva2VucyI6MTgyMjQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzQ2MzQsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNzUyMDExLCJjb3N0VXNkRXN0aW1hdGUiOjAuODMxMjgyMjAwMDAwMDAwMX1dLCJ0dXJucyI6MzUsImR1cmF0aW9uTXMiOjIyNzYxMSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuODM2NDYzMjAwMDAwMDAwMiwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5158 output_tokens=18239 cache_creation_input_tokens=74634 cache_read_input_tokens=1752011 num_turns=35 -->
