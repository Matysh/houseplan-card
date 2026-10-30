# CODE-REVIEW-1062-r1

Материал: `0a75736b17fc645158be983b100cdf59416e584c` (ветка `issue/1062-registry-bounded-io`,
база `16b5fd77dad41a333b57b1c0ade94d89bce741d4`). Этап: code. Трек: ask. Заход r1,
блокирующих циклов израсходовано 0/4.

## Скоуп

Продолжение #1060: первый штатный product CI на материале #1060 (dev `16b5fd77`)
был отменён — job «Переиспользование: это дерево уже проверено» 83 с висел без
результата на `cat-file`/`show` в sparse partial clone и был убит минутным
job-timeout (run 40127934852). Задача инфраструктурная (признак §1 — ни одного
файла класса A): правка ровно immutable registry reader/probe
(`scripts/ci-registry-inputs.mjs`, `ci-proof-registry.mjs`, `ci-registry-cli.mjs`),
их тесты и документация/release-ledger. Диапазон `origin/dev..HEAD` — один
коммит:

```
Bound registry probe Git I/O and hydrate immutable blobs in batches
Issue: #1062
User-Visible: no
```

Изменённые файлы: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
`docs/release-ledger/v1.82.0/1062.json`, `scripts/ci-proof-registry.mjs`,
`scripts/ci-registry-cli.mjs`, `scripts/ci-registry-inputs.mjs`,
`scripts/ci-registry-inventory.json`, `test/ci-proof-registry.test.mjs`,
`test/ci-registry-inputs.test.mjs` — ровно классы B/C, трейлеры корректны,
`User-Visible: no` без изменений changelog (видимого поведения нет).

Классификация release-ledger (`docs/release-ledger/v1.82.0/1062.json`):
`infra`, `baseStable: v1.82.0` — верно: `docs/STATUS.md` подтверждает
`Latest stable tag: v1.82.0`; изменение не меняет поведение продукта, не
входит в пользовательский milestone — соответствует §11.9.

## Как проверялось

Принятый proof (review-light, validate-gate):
https://github.com/Matysh/houseplan-card/actions/runs/40129643485 (`Проверка (CI)`,
`workflow_dispatch`, `conclusion: success`, материал — ровно этот SHA). Из него
взяты как пройденные без повтора: build/typecheck, продуктовые юниты, `lint:unused`,
`no-new-any`, `smoke-select`, упаковка/бандл, HACS/Hassfest skip (диффу не
подпадают), процессный preflight/provenance/trailers/range.

Дополнительно адресно (этот proof не называет конкретно эти два теста и это
риск-специфичная таймерная логика, которую стоит перепроверить на этом дереве
напрямую):

| Команда | Результат |
|---|---|
| `node --test test/ci-registry-inputs.test.mjs` | 21/21 PASS, 15.6 с (совпадает с хендоффом) |
| `node --test test/ci-proof-registry.test.mjs` | 50/50 PASS, 0.8 с (совпадает с хендоффом) |
| `gh api .../actions/runs/40129643485/jobs` → шаг «Verify immutable registry producers» в job «Переиспользование: это дерево уже проверено» | `success`, 20:25:07→20:25:07 (<1 с) на том же sparse+`filter=blob:none` checkout (`validate.yml:535-540`), где run 40127934852 висел 83 с до отмены — прямое наблюдение факта AC3 на реальном CI, не повтор по заявлению автора |
| `gh api .../actions/runs/40129643485/jobs` → job «Инструменты: вычисляемый набор юнитов», шаг «Verify unchanged tooling producer» (`scripts/task-check-reuse.mjs` → тот же `registryReader`, не входит в скоуп задачи, но делит функцию) | `success`, 2 с — неявный новый дефолт `deadline = Date.now()+8000` не ломает этого другого потребителя на обычном полном (не sparse) checkout |
| Чтение полных файлов `ci-registry-inputs.mjs`, `ci-proof-registry.mjs`, `ci-registry-cli.mjs` целиком (не только диффа) | проверено чтением, не исполнением — см. «Что проверено» |

Не прогонялось и не требовалось (вне адресного пробела, полные наборы — предрелизный
гейт, §8): `npm run gate:small` целиком повторно (уже в принятом proof),
browser-смоки/Golden/performance (AC3 явно их не требует, диффу не касаются
UI/отрисовку), `pytest tests_backend` (бэкенд не менялся), инварианты геометрии
(геометрия не менялась), мутанты (ночной гейт — не гонится ревьюером, §2.7/#709;
защита живёт в `scripts/**`, тестируется чистыми `node --test` юнитами, реестр
мутантов не обязателен).

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (ограниченное пакетное чтение недостающих blob, явный fresh fallback, никакого запроса на каждый blob) | `node --test test/ci-registry-inputs.test.mjs` 21/21, тесты `#1062 actual sparse partial clone hydrates one immutable batch per dependency frontier` и `#1062 immutable reader refuses unsafe modes, wrong blob bytes and an exhausted shared deadline` | Настоящий `file://` partial clone (`uploadpack.allowFilter`/`allowAnySHA1InWant`, sparse-checkout, `--filter=blob:none`): 24 отсутствующих test-blob + helper + leaf требуют ровно 3 explicit fetch (не 26), посторонний PNG остаётся нехронированным; поддельные байты объекта (`deflateSync` поверх counterfeit content с тем же OID) и symbolic (`120000`) mode отклоняются с `missing/symbolic input`/`bytes differ from immutable Git OID`. Обычный negative-input на неизменённой реализации, команда и результат выше |
| AC2 (зависший/недоступный remote или missing blob не блокирует дольше бюджета, не даёт `reused=true`, fresh outputs до job timeout) | `node --test test/ci-proof-registry.test.mjs` 50/50 и 4 новых case в `ci-registry-inputs.test.mjs` (21/21) | Реальный зависший `uploadpack` (`remote.origin.uploadpack` → скрипт с `setTimeout(5000)`) останавливает синхронный Git по 800 мс бюджету, возврат <2.5 с (замерено до cleanup); offline origin даёт 1 fetch → refusal, без скрытого fetch на каждый blob; реальный заблокированный `Atomics.wait` child через `execFileSync` и зависший `Promise` в `withinRegistryDeadline` дают `REGISTRY_TIMEOUT`/`deadline exceeded`, а не поздний accept; тест `probe authenticates…` новым случаем показывает, что `store.read()`, бросающий исключение (как бросал бы настоящий истёкший deadline вне `fetchRegistry`), теперь перехватывается `probeRegistry` и даёт `accepted:false` вместо падения всего `Promise.all` — это реальный баг, закрытый в этом диффе (`store.read` раньше стоял вне `try`) |
| AC3 (реальный CI на ветке заканчивает registry probe без отмены) | `mandatory gate` 234 с (хендофф); CI tooling/docs runs 40129085151/40129085016; **прямое наблюдение этим ревью**: run 40129643485, job «Переиспользование…», шаг «Verify immutable registry producers» — `success` за <1 с на том же sparse+`blob:none` checkout, где прежде (40127934852) была 83-секундная отмена | Postmerge проверяется штатным run; прежняя отмена 40127934852 не объявляется PASS нигде в документации/коде |

Третий столбец ни по одному AC не пуст — защитные AC закрыты обычными
negative-input case на неизменённой реализации, не мутантами; это допустимо
для чистых `scripts/**`-юнитов без дорогого гейта (§2.7).

## Что проверено и корректно

- **Деадлайн — не декорация.** `registryRemaining(deadline, cap)` кидает ошибку
  вместо `timeout: 0` (который в Node отключил бы таймаут вовсе) при
  `remaining < 1` или `NaN` — граница протестирована прямо
  (`registryRemaining(NaN)`, `deadline: Date.now() - 1`).
- **Каждый синхронный Git-вызов** (`ls-tree`, `cat-file --batch-all-objects`,
  explicit fetch, `cat-file --batch`, `status`, `rev-parse`, `show`, `python -c`,
  `gh auth token`) получил `timeout`+`killSignal: 'SIGKILL'`, привязанный к
  общему `deadline`. Асинхронный `withinRegistryDeadline`/`AbortController`
  честно объявлен (комментарий в коде) защитой только для async-цепочек; защиту
  от зависшего синхронного потомка даёт исключительно OS-таймаут
  `execFileSync` — ровно то, чего не хватало в run 40127934852.
- **Явный пакетный fetch воспроизводит внутренний механизм Git** для partial
  clone (`-c fetch.negotiationAlgorithm=noop fetch origin --filter=blob:none
  --stdin` по списку OID), а не наивный «fetch по каждому blob»: подтверждено
  трассировкой `GIT_TRACE2_EVENT` — ровно 3 fetch на 4 фронтира зависимостей,
  не 26.
- **Enumerate, не hydrate.** `cat-file --batch-all-objects …
  --batch-check=%(objectname)` перечисляет уже присутствующие объекты без
  лёгкой подгрузки отсутствующих — так определяются «холодные» OID без
  обращения к сети по каждому из них.
- **Новая проверка байтов.** После explicit fetch содержимое перепроверяется
  SHA-1 (`blob {size}\0` + content → oid) и границами (`end + size + 1 >=
  bytes.length`, `bytes[end+size+1] !== 10`) — защита от повреждённых/чужих
  байт, которой не было в прежней реализации; тест с реально подменёнными
  байтами в `.git/objects` подтверждает отказ.
- **Замена пути без дублей (#1014).** Старый раздельный «bulk-prefetch для
  control-файлов» и отдельная `read()`-реализация полностью удалены, заменены
  одним `readMany`-путём; `read = path => readMany([path])[0]`. Дубликатов не
  осталось.
- **`probeRegistry` больше не падает целиком**, если `store.read()` бросает
  (приоритетная находка #1060/#1062): `store.read` теперь внутри `try` —
  реальный баг устранён и покрыт тестом с кастомным бросающим `store`.
- **Fresh fallback не выдаёт себя за `reused=true` нигде**: при истечении
  бюджета в `registryProbeCli` результат принудительно переписывается в
  `accepted:false` для всех `REGISTRY_JOBS`, даже если часть уже успела
  принять `accepted:true` до истечения (комментарий и тест
  `#1062 total lookup deadline covers sync index lazy reads and never accepts
  their late result` это явно проверяют).
- **AC3 подтверждён не только по заявлению автора**, а прямым запросом к тому
  же workflow run на том же SHA, на той же sparse/`blob:none` конфигурации
  checkout, которая изначально воспроизводила баг.
- Путь historical fixture в `docs/DEVELOPMENT.md` исправлен на
  `test/data/smoke-selection-history.json` — файл существует по этому пути,
  старый путь `test/fixtures/smoke-select/historical-plans.json` отсутствует
  (Low из #1060 закрыт).
- Побочный эффект на `scripts/task-check-reuse.mjs` (делит `registryReader`,
  не упомянут в AC) — новый неявный дефолт `deadline≈8с` не был в скоупе задачи,
  но эмпирически не ломает этот путь: тот job использует полный (не sparse)
  checkout, блобы уже материализованы чекаутом, и реальный CI-шаг
  «Verify unchanged tooling producer» на этом материале прошёл за 2 с.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Чего не проверял

- Полный `npm run gate:small` не повторялся — принят proof run 40129643485 на
  точном SHA материала.
- Browser-смоки, Golden, performance-профили, `pytest tests_backend`, инварианты
  геометрии — не запускались: диапазон не трогает `src/**`,
  `custom_components/**/*.py`, геометрию или отрисовку, и ни один AC их не
  называет.
- Мутанты не гонялись (запрещено ревьюеру вне ночного workflow, §2.7/#905);
  регистрация мутанта не требуется — защита в `scripts/**` доказана чистыми
  юнитами.
- Поведение `registryReader`/`task-check-reuse.mjs` на реальном sparse+partial
  checkout (а не только на полном, как в сегодняшнем CI) — не наблюдалось
  вживую для этого второго потребителя; риск низкий (см. выше), но это не
  исполненное доказательство для этой конкретной комбинации.
- Механика самого review-триггера (более ранний комментарий «Механическая
  подготовка ревью не пройдена» на теле issue) — это состояние конвейера
  предзапуска, не код изменения; к моменту этого ревью `REVIEW_CONTEXT` и
  хендофф уже синхронизированы с материалом `0a75736b1`, так что это не
  предмет код-ревью.

## Маршрут

`route: fix` (код-ревью, не `show`).

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1062-registry-bounded-io`, коммит `0a75736b17fc` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8ece938f6c261d77fd24911f5aa92df6e131b3c2`
  ```
  git log --all --format='%H %T' | grep 8ece938f6c26
  ```
- Тело issue: `4d475272202ffe7b45feb96188594ea7ee3e74117d47497f2625701d2db9816d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NjcsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODcyMDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjYsIm91dHB1dF90b2tlbnMiOjQ4OTkwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2MDY5NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM2ODA3NTMsImNvc3RVc2RFc3RpbWF0ZSI6MS44Njg5NjI2MDAwMDAwMDA0fV0sInR1cm5zIjo1MywiZHVyYXRpb25NcyI6NjA4MDYwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS44NzM4MzQ2MDAwMDAwMDA2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4833 output_tokens=49011 cache_creation_input_tokens=160695 cache_read_input_tokens=3680753 num_turns=53 -->
