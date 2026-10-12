# CODE-REVIEW-855-r1

Issue: #855 · code · track:show · r1 · блокирующих циклов 0/2.
Материал: `issue/855-review-preflight` @ `a6dddb091aefa0921437d525c53812207583f4c0`.
База: `origin/dev` @ `d0bfb9626cb11c8ddacc5fc13eeea2ecc6c47f1a`.
Тело issue: `46b87b68aa075e4fcab00b6c3fad10b74d54c79113688d3c90b3d049a086fb2f`.
Дата: 2026-10-12.

Саморевью по прямому разрешению владельца для семи инфраструктурных задач,
зафиксированному [в комментарии](https://github.com/Matysh/houseplan-card/issues/855#issuecomment-6125735643).
Это разрешённое исключение из независимости автора и ревьюера для этой
подборки, не результат независимой модели. Вызова модели и model usage нет.

## Скоуп и метод

Прочитаны полный diff, AUTHOR/REVIEWER, PROCESS §1/§7/§10.4, существующие
ledger/provenance/track/status helpers и прежнее ревью #868. B/C: один
механический preflight и его два workflow-входа, тесты, канон/конспект/STATUS,
infra ledger. Класс A, runtime, бандл и пользовательские настройки неизменны.

Первый вход останавливает неподготовленный материал до Validate/reuse/model;
второй перечитывает тело, метки и трек после меж-job передачи непосредственно
перед моделью. Скрипты берутся из закреплённого trusted dev, а не из материала
автора. Форматный отчёт versioned, привязан к stage/track/issue/SHA/tree/body и
явно имеет `semanticApproval:false`. Он не заменяет семантический verdict,
защищённый artifact handoff, доказательства AC или гейты слияния.

Исполнен настоящий shell-шаг workflow в изолированном git-репозитории с fake
GitHub: валидный ledger проходит, испорченный ledger/body возвращается в S6,
сбой API при наличии старого файла отчёта останавливает job. Никакой модель,
реальный merge или публикация в fixture не вызываются.

## Гейты

| Команда | Результат |
|---|---|
| `npm run gate:small` | Финальный PASS, 130 s: build/typecheck, весь unit-набор, bundle-policy/budget, lint:unused, layout/private-write/any guards, smoke-select |
| `node --test test/review-preflight.test.mjs test/release-ledger.test.mjs test/review-doc-guard.test.mjs test/process-prepare-tools.test.mjs test/process-digests.test.mjs` | PASS |
| `node --test test/process*.test.mjs test/workflow*.test.mjs test/review*.test.mjs test/task-packet.test.mjs test/entry-cost.test.mjs test/release-ledger.test.mjs` | 368/368 PASS |
| `node --test test/rebase-generated.test.mjs test/mutation-gate.test.mjs test/review-preflight.test.mjs` | 109/109 PASS; чистые unit/статические проверки, не исполнение реестра мутантов |
| `node scripts/check-docs.mjs --screenshots=warn` | PASS, 7 файлов/12 внешних ссылок |
| `git diff --check` | PASS |
| `node scripts/process-gate.mjs --issues` | PASS: механически infra, без статуса до S7 |

Первый small-прогон и диагностический полный unit были красными на двух наших
интеграционных ошибках: повторение текстового anchor `usage-script-from-moving-dev`
и изменение формы условия, на которую опирается прежний #705 witness.
Однозначный anchor восстановлен, исходный rebase/refused guard сохранён вместе
с preflight. Финальные целевой и полный прогоны зелёные; это не flaky retry.
Сборочный D-дифф убирается штатным `bundle:clean`, не входит в задачу.

## AC → доказательство → чем краснеет

| AC | Доказательство | Отрицательный случай |
|---|---|---|
| AC1: stage/track формат без семантической подмены | Матрица spec/code × ask/show/ship × infra в unit; настоящая подготовка workflow | Нет ТЗ/разделов/AC, AC2 без AC1, отсутствующий способ доказательства, 4 AC на show, quoted fake ТЗ, класс A в infra. PASS всегда semanticApproval:false |
| AC2: ledger/trailers/handoff/связанные отчёты | Existing ledger/provenance validators и unit/isolated git fixture | Неразбираемый ledger, нет терминальных трейлеров, нет обязательного поля handoff, отсутствующий локальный report; статический link не выдаётся за доступность remote |
| AC3: точный материал и безопасный отказ без модели/цикла | Identity/schema unit, fresh API перед моделью, настоящий shell-шаг и status callbacks | Другие SHA/tree/body/track, unknown schema, withdrawn/closed/blocked request, несколько S-меток, setup failure со старым report. Старый PASS не принимается, чужой статус не перезаписывается |

Проверка содержит около 0.6 s суммарно для нескольких локальных CLI fixtures
в целевом прогоне; это добавленная дешёвая проверка, не измерение экономии
модели. Реальный quality/token эффект требует последующих раундов.

## Риски и границы

- Async/owners: свежий запрос перед отказом и перед моделью; неблокирующие
  старые статусы не меняются. GitHub labels API не транзакционен: существующая
  `moveStatusLabel` сохраняется, request reread сужает, но не отменяет API race.
- Данные/права: fixed argv, bounded API/git output, trusted scripts; локальные
  связанные пути с `..` отвергаются. Новых secrets/transcripts нет.
- Геометрия: не затронута. Визуал: DOM/CSS/PNG не затронуты.
- Performance/объём: форматное чтение без model call/build/mutation application;
  API/HTTP отказ не превращается в разрешение продолжать.
- Host/input: изменений View/editors/kiosk/touch/keyboard нет.

Числа/правила ledger, трейлеров, трека и статуса берутся из существующих
канонических helpers; stage/track формат впервые имеет один источник в
preflight. Новых текстовых проверок монолита нет. Category=infra,
User-Visible:no, без user milestone/changelog.

Не проверены: реальный независимый model call, уже опубликованный Validate
новой ветки и интеграция кандидата; их будущий PASS не выдуман. Backend,
golden, performance browser/full suites не применимы к данному diff;
smoke-select не назначает frontend smokes. Мутанты, beta/stable/main/tag/
Telegram/manual dev merge не запускались.

## Вердикт

Вердикт: зелёный · r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 · Low: 0.
Материал соответствует рабочим AC. Штатный конвейер всё равно обязан
подтвердить Validate точного материала/кандидата и интеграцию перед S8.
Саморевью выполнено по явному исключению владельца, не независимой моделью.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/855-review-preflight`, коммит `a6dddb091aef` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `92ff116cf4bda84cc8dc17753b932892a9481d92`
  ```
  git log --all --format='%H %T' | grep 92ff116cf4bd
  ```
- Тело issue: `46b87b68aa075e4fcab00b6c3fad10b74d54c79113688d3c90b3d049a086fb2f`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
