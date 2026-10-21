# CODE-REVIEW-960-r1

Issue: #960 · Этап: code · Заход: r1 · Трек: show · Блокирующих циклов использовано: 0/2
Материал: `bab5be9758d63dd33f527c2b1a2178a2c6e48da2` (коммиты `be1aa765a` реализация + `bab5be975` doc-only сокращение TESTING.md)
Вердикт: **зелёный** · Route: `fix`

## Скоуп

Инфраструктурная задача, обнаруженная при #957: `npm run gate:small` краснел на
native Windows / Node 22 на уже существующих тестах окружения (без изменения
их исполняемого кода). Исходный диапазон — наблюдение, расследование и
исправление вынесены в #960 отдельно. Три AC из тела issue:

- **AC1** — native workflow fixtures используют Bash/sh из Git for Windows
  вместо WSL-лаунчера `system32\bash.exe`; тело и флаги шага не меняются.
- **AC2** — `candidate-reviews-index` не даёт libuv неявно унаследовать
  PATH/user-переменные из родителя на Windows; receipt окружения сравнивает
  имена без регистра только на Windows, сохраняя значимые отличия.
- **AC3** — `pre-push` владеет исходным потоком destination refs до любого
  дочернего процесса (в частности `gh auth status` через WSL interop на
  Windows), не отдавая auth то, что должен прочитать сам хук.

Продуктовый код (`src/**`) не тронут — подтверждено:
`git diff origin/dev...HEAD --name-only | grep '^src/'` → пусто. Файлы:
`.githooks/pre-push`, `scripts/candidate-reviews-index.mjs`,
`scripts/local-gate-proof.mjs`, новый `scripts/local-gate-environment.mjs`,
`test/helpers/posix-shell.mjs` (новый), `test/helpers/workflow-step.mjs`,
шесть обновлённых fixture-тестов, `docs/DEVELOPMENT.md`/`STATUS.md`/`TESTING.md`,
`docs/release-ledger/v1.81.0/960.json`.

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build` + `bundle-policy --verify` | не перегонял | зелёный Validate на точном SHA материала: https://github.com/Matysh/houseplan-card/actions/runs/39211897019 (#343) |
| Целевые unit-тесты AC1–3 | **прогнал** | `node --test test/candidate-reviews-index.test.mjs test/development-loop-954.test.mjs test/pre-push-gate.test.mjs test/workflow-step.test.mjs test/wait-verdict.test.mjs test/wall-parity-ci.test.mjs test/dev-build.test.mjs test/proof-loop-856.test.mjs` → 88/88 PASS |
| `smoke-select --base origin/dev --head HEAD --json` | **прогнал** | `noExecutableDiff: true` — браузерные смоки не требуются, совпадает с заявлением автора |
| `pytest tests_backend` | не требуется | Python не затронут |
| `npm run invariants` | не требуется | геометрия не затронута |
| native Windows прогон (реальная платформа) | **не прогонял** (нет доступа) | только чтение кода + отчёт автора: `gate:small` PASS на native Windows (Node 22.23.2/npm 10.9.8/Git 2.43.0.windows.1/Git Bash 5.2.21/jq 1.8.2, 230 с), независимый Linux/ext4 `gate:small` PASS (165 с), реальный `git push` с включённым хуком PASS (201 с, `gate:small зелёный`) |

Трейлеры: `be1aa765a` — `Issue: #960`, `User-Visible: no` (верно для чисто
инфраструктурной правки без видимого поведения); `bab5be975` — без трейлеров,
что допустимо по §2.6/#701: коммит только из документации (`docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/TESTING.md`), трейлеры для doc-only коммита не нужны.
Changelog не трогали — согласуется с `User-Visible: no`.
`docs/release-ledger/v1.81.0/960.json`: `category: infra`, обоснование
("No product behavior changes") соответствует диффу — ревьюер согласен с
авторской классификацией, в пользовательский milestone не входит.

## Находки

### Low — Windows-ветка `candidate-reviews-index.mjs` не инъецируется по платформе, поэтому не исполняется в Linux CI

`scripts/candidate-reviews-index.mjs:54-58` строит объект окружения для
дочернего Node по жёсткому `process.platform === 'win32'`, в отличие от
`scripts/local-gate-environment.mjs:2`, где платформа — параметр функции
(`platform = process.platform`), и поэтому `test/development-loop-954.test.mjs`
может детерминированно гонять Windows-ветку `localGateEnvironment` на любой
ОС (тест «#960 receipt environment follows Windows key casing…» реально
исполняется и красится при регрессии). Для `candidate-reviews-index.mjs`
аналогичного пути нет: `test/candidate-reviews-index.test.mjs` защищает
Windows-ветку (`PATH`/user-переменные не текут в дочерний процесс) только
веткой `process.platform === 'win32' ? [...] : []`, которая на Linux
вырождается в `allowed = []` и фактически не проверяет новый код AC2 вообще —
проверяется чтением, не исполнением, и только отчётом автора о реальном
native Windows прогоне.

**Чем краснит:** ничем на доступной мне платформе — это и есть находка:
регрессия в Windows-ветке (например, кто-то по ошибке уберёт
`PATH: ''`/`USERPROFILE: ''` и либо так же вернёт `SystemRoot`-only allowlist)
не поймается ни одним CI-прогоном этого репозитория, поскольку выделенного
Windows CI нет.

**Почему Low, не Medium:** в репозитории нет Windows CI вообще (не только у
этой задачи), платформенно-условные тесты — существующий паттерн кода
(пример в этом же диффе: `test/pre-push-gate.test.mjs` ветвится по
`process.platform === 'win32'`), AC2 для своей расчётной (не Windows) части
покрыт исполняемым тестом, а для Windows-специфики автор привёл конкретный
зелёный native-прогон с версиями инструментов и длительностью — большего
способа проверки без собственной Windows-машины у ревьюера нет. Трек `show`:
это не дефект поведения, который увидит пользователь, и не невыполненный AC —
бухгалтерия тестируемости. Низкий приоритет, цикла не открывает, не чиню сам
(запрещено ревьюеру).

Побочных находок вне скоупа нет — новый issue не заводится (режим `mode=issues`
не задействован, поскольку нечего маршрутизировать).

## Разбор по AC

| AC | Чем доказан | Чем краснит | Оценка |
|---|---|---|---|
| AC1 (Bash/sh из Git for Windows, флаги раннера сохранены) | `test/workflow-step.test.mjs` новый тест «#960: real POSIX step reads paths with spaces…» — реально исполняет `runStep` с путём, содержащим пробелы, fixture-инструментом на PATH и несуществующей командой | Отсутствующая команда даёт код 127, следующая строка `echo must-not-run` не печатается (bash -e останавливает выполнение) — проверено исполнением, `assert.equal(red.stdout, '')` упадёт при регрессии errexit | Выполнено |
| AC2 (credential-free окружение, receipt без регистра на Windows) | `test/candidate-reviews-index.test.mjs` (AC5, исполняет настоящий `candidateReviewsIndex`); `test/development-loop-954.test.mjs` новый тест с параметризуемой платформой для `localGateEnvironment` | Receipt-часть — реально красится (конфликтующие алиасы кидают `conflicting environment key`, PATH/MSYS/MSYSTEM меняют хэш); утечка-часть в `candidate-reviews-index.mjs` — проверено чтением, не исполнением (см. находку Low выше) | Выполнено, с ограничением покрытия |
| AC3 (исходный поток refs до auth, auth не читает stdin) | `test/pre-push-gate.test.mjs` — настоящий `git push` через `.githooks/pre-push` с gh-заглушкой, которая пытается вычитать stdin до EOF | `assert.equal(readFileSync(authInput, 'utf8'), '', ...)` — если вернуть старый порядок (`gh auth status` до `refs=$(cat)`), заглушка `gh` поглотит исходные ref-строки до того, как хук их прочитает, и либо эта проверка, либо более ранняя `assert.notEqual(red.status, 0, ...)` покраснеют (gate:small не был бы вызван вовсе из-за пустых refs) | Выполнено |

Отдельно прочитан код `.githooks/pre-push`: перестановка `refs=$(cat)` перед
проверкой `gh auth status` и явный `</dev/null` на самой проверке — именно тот
порядок, которого не хватало (#960, комментарий автора о потере stdin в
interop/auth-status пути). Мутанты не исполнялись; рассуждение о «чем краснит»
сделано чтением обеих версий скрипта (`git diff origin/dev..be1aa765a --
.githooks/pre-push`), без патча исполняемой реализации.

## Что проверено и корректно

- Нет изменений `src/**`, нет новых файлов конфигурации/compatibility-полей,
  нет UX-контракта, нет влияния на performance/touch — задача инфраструктурная
  (§1), критерии `track:show` (§5) выполнены: сложность и риск низкие, одна
  связная поверхность (надёжность локального Windows-гейта: shell-резолюция +
  утечка окружения + порядок чтения stdin — три грани одной проблемы из
  наблюдения в теле issue), миграций нет, UX нет, перф/touch нет, ожидаемое
  поведение однозначно зафиксировано тремя AC в самом issue. → `route: fix`.
- `localGateEnvironment` (новый `scripts/local-gate-environment.mjs`) корректно
  вынесен в отдельную тестируемую функцию с инъецируемой платформой; сохраняет
  прежнюю фильтрацию `GIT_*`/`WSL_INTEROP`, добавляет регистронезависимость
  только для Windows и явный отказ на конфликтующих алиасах ключей.
  `local-gate-proof.mjs` использует её без изменения внешнего поведения на
  Linux (это подтверждают уже проходящие прежние тесты #954 в одном прогоне
  выше).
  `test/helpers/posix-shell.mjs` аккуратно разделяет Windows- и POSIX-пути:
  на не-Windows платформе `gitTools()` не вызывается вовсе, поведение старых
  тестов (`PATH` руками) воспроизведено через `prependPath` — проверено и
  исполнением (88/88 PASS), и чтением всех мест вызова.
- `candidate-reviews-index.mjs`: расширение allowlist Windows-переменных
  задокументировано ссылкой на источник поведения libuv (required_vars),
  пустые значения для PATH/HOMEDRIVE/HOMEPATH/LOGONSERVER/SYSTEMDRIVE/
  USERDOMAIN/USERNAME/USERPROFILE и управляемый `TEMP` — последовательная
  реализация декларируемой цели «не дать libuv подставить родительские
  значения».
- `.githooks/pre-push`: `refs=$(cat)` перемещён в начало скрипта, до любого
  вызова `gh`; `gh auth status </dev/null` — вторая линия защиты. Таблица
  AC3 выше показывает конкретный red-путь при регрессии порядка.
- Трейлеры и changelog соответствуют `User-Visible: no`; release-ledger
  `category: infra` обоснован и согласуется с содержимым диффа.
- Документация (`DEVELOPMENT.md`, `STATUS.md`, `TESTING.md`) точно описывает
  реализацию без противоречий с кодом; `TESTING.md` сократили до прежнего
  лимита строк отдельным doc-only коммитом, не меняя код — согласуется с
  авторским «Сделано».
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` —
  перепроверено лично, `noExecutableDiff: true`, визуальный риск отсутствует.

## Чего не проверял

- Не перегонял `npx tsc --noEmit`/`npm test`/`npm run build`+`bundle-policy
  --verify` целиком — зелёный Validate уже на точном SHA материала (#343,
  ссылка выше); гонял только целевые тестовые файлы AC1–3 (88/88 PASS).
- Не исполнял Windows-специфичные ветки (`candidate-reviews-index.mjs` env
  allowlist, `posix-shell.mjs` резолюция `bash.exe`/`jq` из Git for Windows,
  `pre-push`+WSL interop сценарий) сам — нет доступной Windows-машины; у
  репозитория нет Windows CI вообще. Эти участки разобраны чтением и
  опираются на зелёный native Windows прогон автора (конкретные версии
  инструментов и длительности в комментарии «Сделано»); единственная находка
  (Low) — об этом ограничении тестируемости.
- Мутанты/ночной прогон не исполнялись и не нужны: все «чем краснит» в
  таблице AC — обычные отрицательные входы на неизменённой реализации
  (реальный `git push`, реальный недостающий бинарь, реальная заглушка `gh`),
  не временные патчи продуктового кода.
- `pytest tests_backend` и `npm run invariants` не гонял — Python и геометрия
  задачей не затронуты.
- Ручная приёмка на реальной Windows-машине ревьюером не проводилась
  (добровольна и не требуется §7.1, #929); зачтён только автоматический
  зелёный прогон автора.

## Побочные находки

Побочных находок нет. Доверенный снимок `REVIEW_FINDINGS_POLICY`
(`mode: issues`) сверен — маршрутизировать нечего, новых issue не заводил.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/960-windows-gate`, коммит `bab5be9758d6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a22c88615b1eca04a7bccc0d43521551de596bcd`
  ```
  git log --all --format='%H %T' | grep a22c88615b1e
  ```
- Тело issue: `df75c2891d40be82d279e498f35937d1ac9282a3997fd8639f344b7581272fe9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDUsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mn0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjYsIm91dHB1dF90b2tlbnMiOjM5ODkwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyNjQ0NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMyNjIzMjgsImNvc3RVc2RFc3RpbWF0ZSI6MS41NTcyODE2MDAwMDAwMDA1fV0sInR1cm5zIjo0NiwiZHVyYXRpb25NcyI6NDgzMzc2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41NjI0ODE2MDAwMDAwMDA0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5171 output_tokens=39909 cache_creation_input_tokens=126446 cache_read_input_tokens=3262328 num_turns=46 -->
