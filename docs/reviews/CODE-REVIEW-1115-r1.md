# CODE-REVIEW — issue #1115 · заход r1

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче | — · Документ: docs/reviews/CODE-REVIEW-1115-r1.md**

Материал: `4cec874a8326ceb4efac37cda3df2cd57c0b749c` (ветка `issue/1115-native-finalization`), трек `show`, этап `code`.

## Скоуп

Issue #1115 — попутное наблюдение флака `test/review-native-runner.test.mjs:173`
(#1065): owned pipe-holder фикстуры иногда фиксировался как `R` сразу после
завершения native runner в полном tooling-наборе. Автор взял задачу и исправил
гонку наблюдения: единичное немедленное чтение `/proc/<pid>/stat` заменено на
опрос того же PID в пределах прежнего единого абсолютного лимита 2000мс, без
продления. Диапазон коммитов: ровно один коммит
`4cec874a8 test(review): observe owned-child exit within original deadline`.

Изменённые файлы (все класса B/C, инфраструктура — задача входит сразу в
S7-code-review, AGENTS.md «Rule #1»):
- `test/review-native-runner.test.mjs` — единственный содержательный файл (класс B);
- `docs/STATUS.md`, `docs/DEVELOPMENT.md` — описание исправления (класс C);
- `docs/release-ledger/v1.82.0/1115.json` — новая запись `category: infra`;
- `scripts/ci-registry-inventory.json` — механическая регистрация нового
  release-ledger файла в двух списках инвентаря.

Продуктовый код (`scripts/review-native-runner.mjs`, сигналы, таймауты,
permissions) не менялся — подтверждено диффом (`read:diff`) и независимым
чтением `scripts/review-native-runner.mjs`.

## Как проверялось

1. Статически: `REVIEW_CONTEXT`, тело issue #1115 и все 3 комментария (включая
   take-up и хендофф), `docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`,
   `docs/SCOPE.md` — обязательные источники роли, каждый прочитан один раз.
2. Независимый разбор кода **до** сопоставления с хендоффом:
   - прочитан весь `test/review-native-runner.test.mjs` (260 строк) целиком;
   - прослежен вызывающий путь: `scripts/review-native-runner.mjs` —
     `terminate()`/`signalOwned()`/`finalizeTimer`/`drainTimer` (строки 136–230),
     чтобы убедиться, что тест действительно проверяет наблюдаемое
     production-поведение (SIGTERM→SIGKILL по группе процессов,
     `native-stdio-timeout` при утечке pipe), а не подогнан под фикстуру;
   - разобрана новая функция `assertOwnedProcessStopped` (строки 41–52):
     порядок операций (чтение состояния → проверка остатка лимита → проверка
     терминальности), её использование в двух новых юнит-тестах (строки 54–69)
     и в исправленном сценарии (строка 233, было — разовая проверка без опроса).
3. Исполнена адресная проверка оставшегося риска: `read:diff` (точный дифф),
   `read:log` (коммит в диапазоне) — подтвердили, что единственное
   содержательное изменение — замена разового чтения `/proc` на
   `assertOwnedProcessStopped` (было: строки 196–199 старой версии, стало:
   извлечённая функция + опрос).
4. Исполнен `unit:test/review-native-runner.test.mjs` (run_check) —
   независимый прогон в среде ревью (отличной от CI validate-gate), поскольку
   это ровно файл — предмет флака с историей из трёх предыдущих RED-инцидентов
   (#1099, #1100, сама задача #1115) на разных материалах; валидный повод для
   адресного перезапуска — другая среда исполнения.

## Что проверено и корректно

- **Логика исправления.** Старый код делал один синхронный `readFileSync`
  сразу после возврата `runNativeReview` и падал, если ядро ещё не успело
  перевести процесс в `Z`/отсутствующий, хотя `SIGKILL` уже отправлен
  (`finalizeTimer`, `scripts/review-native-runner.mjs:176-182`). Новый код
  опрашивает то же состояние в оставшееся время **того же** абсолютного
  дедлайна 2000мс (заведённого **до** вызова `runNativeReview`,
  строка 217: `const deadline = performance.now() + 2000`), не продлевая его —
  подтверждено тестом `#1115 owned-process observation waits for exit without
  renewing the deadline` (строки 62–69), который явно проверяет отказ при уже
  истёкшем дедлайне даже с терминальным состоянием `Z`.
- **Fail-closed сохранён.** `R/S/D/T` по-прежнему отклоняются немедленно (через
  `assert.ok(remaining >= 0, ...)`, которое при live-состоянии почти всегда
  ложно уже на первой итерации из-за `deadline = performance.now()` в тесте
  строки 54–57); отдельный юнит-тест (строки 54–60) явно проверяет это для
  всех четырёх живых состояний и обоих терминальных (`''`, `'Z'`).
  «Чем краснеет»: `R/S/D/T` → `assert.rejects(...,
  /owned descendant remains running/)` — обычный отрицательный случай в самом
  тесте, исполнен (см. ниже, PASS 1/1 на этих ветках внутри прогона).
- **Производственный путь не ослаблен.** `scripts/review-native-runner.mjs` не
  входит в дифф; `terminate()`/`signalOwned()` по-прежнему убивают всю группу
  процессов (`process.kill(-child.pid, signal)`, строка 167) по тем же
  `terminateGraceMs`/`stdioGraceMs`. Тест проверяет наблюдение результата этого
  пути, а не подменяет его.
- **Главный регрессионный сценарий фактически исполнялся, не просто читался.**
  Тест `#1065 exited native leader cannot leave an owned pipe-holder beyond
  bounded finalization` (строка 207) помечен `{ skip: process.platform !==
  'linux' }` — в среде ревью платформа linux, тест не был пропущен (ok 16 в
  TAP-выводе), прошёл за 164.97ms, что подтверждает реальный прогон сценария с
  настоящим Linux-процессом-держателем pipe, а не статическую проверку.
- **Прогон в среде ревью:** `unit:test/review-native-runner.test.mjs` →
  `17/17 PASS`, `0 failed`, 953ms суммарно (receipt `bf5cb7ff-04b7-4dd3-a919-
  4c8480a05ab1`, `materialUnchanged: true`, `executed: true`). Число тестов
  (17) совпадает с добавлением ровно двух новых тестов к прежним 15
  (подтверждено диффом и ручным подсчётом `test(` в файле).
- **Один источник числа (§8).** `docs/STATUS.md` Node unit счётчик вырос с
  5832 до 5834 — ровно на 2 новых теста; строка внутри сгенерированного блока
  `status-snapshot:begin/end` (`node scripts/status-snapshot.mjs --write`),
  единственный источник — `npm run inventory`, дублирования не нашёл.
- **Release-ledger.** `docs/release-ledger/v1.82.0/1115.json`:
  `category: infra`, `baseStable: v1.82.0`, без `introducedBy` — соответствует
  устоявшемуся в репозитории паттерну (все 49 действующих записей `infra` не
  используют `introducedBy`; это поле применяется только у `line-fix`,
  корректирующих конкретную бета-фичу). Инфраструктурные правки вне
  пользовательского milestone — соответствует #838.
- **Трейлеры/changelog.** `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в диффе
  отсутствуют — согласуется с `User-Visible: no` (инфраструктурная правка теста
  ревью, не видна пользователю продукта). Доступный инструментарий (`read:log`,
  `read:diff`) не вскрывает полный текст коммита с трейлерами `Issue:`/
  `User-Visible:` — см. «Чего не проверял».
- **Маршрут вердикта (§5).** Все критерии reclassify пройдены для вывода
  `route: fix`: `complexity` (локальная правка теста, риск низкий),
  `surfaces` (один модуль — тестовый файл), `migration` (нет), `ux-contract`
  (продуктовый UX не затронут — правка вне `src/**`), `perf-touch` (нет),
  `undocumented` (поведение зафиксировано в этом же диффе — `docs/STATUS.md`,
  `docs/DEVELOPMENT.md`, release-ledger).
- **Качество/читаемость.** Вынесение опроса в переиспользуемую функцию с
  параметром `readState` для тестируемости — оправданное локальное улучшение,
  не избыточная абстракция (используется в трёх местах: прямое юнит-тестирование
  ×2 и реальный Linux-сценарий).

## Находки

**Low (снимаю, не открывает цикл):** сообщение ассерта в
`assertOwnedProcessStopped` (`test/review-native-runner.test.mjs:48`) —
`` `owned descendant remains running at the deadline: ${state}` `` —
подставляет `state`, даже когда дедлайн истёк при уже терминальном состоянии
(`''`/`'Z'`), выводя противоречивый текст вида «remains running: Z». Поведение
при этом корректное и намеренное (автор явно описал это во взятии задачи:
«даже terminal result вне deadline отказывает», подтверждено тестом строк
66–68), дефекта логики нет — только текст сообщения вводит в заблуждение при
долгом хвосте опроса. Последствие: при редком реальном срабатывании этой ветки
лог ревью/CI будет читаться как «процесс жив», хотя на самом деле истёк общий
лимит уже после фактического завершения процесса. Не блокирует, не открывает
цикл (§10.4, трек `show`).

Medium/High в скоупе — не найдено. Побочных находок вне скоупа — не найдено,
`outside_findings` пуст.

## Гейты — что прогнал и почему

| Гейт | Статус | Источник |
|---|---|---|
| `unit:test/review-native-runner.test.mjs` (`node --test`, 17/17 PASS, включая реальный Linux pipe-holder сценарий, не skip) | Прогнан адресно в среде ревью | `run_check`, receipt `bf5cb7ff…`, 953ms |
| `read:diff` / `read:log` | Прогнан | подтверждение точного содержимого диффа и единственного коммита в диапазоне |
| `gate:small` (build/product/budget/unused GREEN, push CI) | Переиспользован, не повторялся | validate-gate на этом же SHA (`actions/runs/40766850265`), «review-light proof is complete»; новый прогон не требовался — SHA/вход/окружение CI не менялись |
| `tsc`/`build`/`bundle` и полные browser-smokes | Не прогонял | дифф не затрагивает `src/**`, продуктовую сборку или визуальный путь; задача инфраструктурная, полные наборы — предрелизный гейт, не гейт ревью (§8) |
| `pytest tests_backend`, инварианты модели, Golden | Не прогонял | дифф не касается Python/геометрии/рендера; AC задачи не называют эти гейты |
| Полный текст коммита с трейлерами `Issue:`/`User-Visible:` | Не проверял напрямую | в доступном инструментарии нет команды для чтения тела коммита (только `--oneline` и diff); отсутствие правок `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в диффе согласуется с ожидаемым `User-Visible: no`, process-gate по хендоффу — PASS |

## Чего не проверял

- Полный текст коммита (трейлеры `Issue:`/`User-Visible:`) — инструментарий
  ревью не даёт доступа к телу коммита, только к `--oneline`/diff; судил по
  косвенному признаку (отсутствие изменений changelog).
- Долгосрочную статистическую непрокручиваемость флака — один зелёный прогон
  (в CI и повторно в среде ревью) не доказывает полное устранение причины
  исходного флака; это согласуется с собственной оценкой автора («причина не
  установлена... правка убирает синхронную проверку состояния ОС»). Задача не
  заявляет полного устранения, только исправление конкретной гонки наблюдения —
  это и проверено.
- `ci-registry-inventory.json` как отдельный гейт — это механический список
  файлов для инвентаря; сверил вручную, что добавленная строка соответствует
  новому `docs/release-ledger/v1.82.0/1115.json` и месту в существующем
  порядке, отдельный исполняемый гейт не запускал (нет AC/риска, требующего
  этого).

## Унаследовано

Не применимо — это первый заход (r1).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjU0ZGJjYWMzMzIyY2M3OTYyODY1YTZkYmQ4YjE4NGE4ZTRlZWY0NDgzZGEyYTQ1ZjY5NzNlMTc5NGE1NGFmM2UiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJkNThjMWEwMWRiZGU0YjM4YWVkMGM1MzBlODZhNWEwYjFiZTFjZTRmMWZjN2M3N2I0MDYwNmNkYmEzMTZlYjNkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI0Y2VjODc0YTgzMjZjZWI0ZWZhYzM3Y2RhM2RmMmNkNTdjMGI3NDljIiwidHJlZSI6IjFjNGMwNTg3YzNmOWJhZGI2MWM3OGU1N2M1ODhhYThhZDQxZmZlOTYiLCJib2R5RGlnZXN0IjoiM2RkMDE2YjU3MWNhM2VmOTcyNjVmZmRhZjMxZmFkN2JhNzc2ZjczOGI1Nzc4MTIzZTg3N2YwYTBiZTkzZjc2ZSIsInByb2R1Y2VyUnVuIjoiNDA3NjgwNzM1MDIiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjViMjQ5ZGNlNjU2YWUyYWZlZDI4YmNjNjUyNGIwZTJkMmZhODllZGFhYzMxMTBkZTRjYzc1N2E4MzMwMjE3NzUiLCJ2ZXJkaWN0RGlnZXN0IjoiOTlkMzFmY2IzMGViNWRlNzc2ZGRjYTg3NTBkZGE0OTQ2ZTM0YmE5YmYzYTVkOThkNWQ1OGUzMGM2MDA5ZGNhNSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI4MDk2MDRlOGM5NTQyYTQzODU4NjRiYmQ1MGNjMGRjOGFlNjkzNjMyMmQ2ZjE0MTc1MTkzZjFlNjg0OTdhNmYyIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgwNzQwODE2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE1I2lzc3VlY29tbWVudC02NDgwNzQwODE2IiwiYm9keURpZ2VzdCI6IjRjYTFjNzQ3NGRiZDA2OGRhMTg2MDg5Nzc2MmEyYjA1YjVlOGVlMjNkMTMxMjY0ZDRmYzBmYWVkYjYzNGUwNWUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1115-native-finalization`, коммит `4cec874a8326` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1c4c0587c3f9badb61c78e57c588aa8ad41ffe96`
  ```
  git log --all --format='%H %T' | grep 1c4c0587c3f9
  ```
- Тело issue: `3dd016b571ca3ef97265ffdaf31fad7ba776f738b5778123e877f0a0be93f76e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40768073502,"run_attempt":1,"digest":"7b2ba906d7ceac00c5fe6be4d93907b7c3b79fcc59c111935ea14cfbe3edf3ff"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTYsIm91dHB1dF90b2tlbnMiOjI3MTIzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExOTk3NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIyMzE3MTUsImNvc3RVc2RFc3RpbWF0ZSI6MS4xOTc1ODl9XSwidHVybnMiOjQwLCJkdXJhdGlvbk1zIjozNzgwMjgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjE5NzU4OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=56 output_tokens=27123 cache_creation_input_tokens=119976 cache_read_input_tokens=2231715 num_turns=40 -->
