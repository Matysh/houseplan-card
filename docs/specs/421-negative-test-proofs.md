# ТЗ #421 — Отрицательные доказательства для трёх защитных проверок

- Issue: https://github.com/Matysh/houseplan-card/issues/421
- Приоритет: P2, tech-debt/tests/infra
- Маршрут: standard; три независимые поверхности нарушают критерий `small`
- Связанные контракты: #43 (support preview), #404/#407 (browser error
  guard), #401/#409 (приёмка документационных скриншотов), #85 (mutation gate)

## Цель

Сделать три существующих утверждения доказательными: тест или гейт обязан
краснеть, когда ломается ровно тот механизм, защитой которого он объявлен.
Пользовательское поведение не меняется; закрепляются уже действующие контракты.

## Проблема

### 1. Lifecycle support-preview

`test_support_preview_replacement_and_discard_are_draft_local` создаёт три
разных токена, а затем отправляет три идемпотентных `discard`. Успех `discard`
ничего не говорит о наличии токена в runtime-map. Поэтому тест остаётся зелёным,
если убрать replacement-loop из `ws_support_preview()`.

Отдельно не доказано истечение `SUPPORT_PREVIEW_TTL_S`: ни один тест не
переводит monotonic clock за границу TTL и не пытается применить истёкший токен.

### 2. `reportPageErrors()`

Browser probes `guard_tail_exception`, `guard_tail_rejection` и
`guard_closed_page` завершаются через `finish()`. Существующие мутанты ломают
round-trip внутри `finish()` либо общий registry страниц, но не отдельный
round-trip в `reportPageErrors()`. Удаление этого `await` остаётся зелёным.

### 3. Acceptance trace документационных скриншотов

Чистые тесты `docsAcceptancePlan()` проверяют выбор replace/keep/witnesses, но
не ветку в `docs-accept.mjs`, которая при fingerprint-only refresh переносит
предыдущий `manifest.acceptance`. Возврат к пустому следу приёмки не замечается.

## Скоуп

В скоупе:

- реальные submit-проверки заменённого и явно удалённого preview-токена;
- доказательство, что токен другого `draft_id` не инвалидируется заменой;
- детерминированный TTL-тест без ожидания реального времени;
- отдельная browser probe, использующая `reportPageErrors()`, а не `finish()`;
- адресный мутант, удаляющий round-trip только из `reportPageErrors()`;
- исполняемая, экспортируемая логика построения нового manifest acceptance
  внутри `docs-accept.mjs` и её unit-тест;
- адресный мутант, возвращающий потерю прежнего acceptance trace;
- запись отрицательных доказательств в mutation registry и документ ревью.

## Не-скоуп

- изменение WebSocket API, кодов ошибок, TTL, лимитов или idempotency semantics;
- изменение идемпотентного ответа `preview/discard` для отсутствующего токена;
- изменение UI Help & feedback или текста privacy notice;
- переработка общего browser smoke harness и всех существующих probes;
- изменение правил принятия скриншотов, witness floor или CLI-флагов;
- новый общий процессный документ: требование показать, что тест умеет падать,
  уже закреплено в `AGENTS.md` и `PROCESS.md`;
- полный аудит всех тестов проекта за пределами трёх названных швов.

## Контракт

### 1. Replacement, discard и TTL preview-токена

Для одного HA user и одного `draft_id` новый preview заменяет предыдущий:

- submit со старым токеном отвечает `support_preview_expired`;
- submit с новым токеном остаётся доступным, пока токен не удалён, не истёк и не
  был успешно использован;
- preview другого `draft_id` того же user заменой не затрагивается и может быть
  успешно отправлен;
- после успешного `preview/discard` submit того же токена отвечает
  `support_preview_expired`;
- сам `discard` остаётся идемпотентным и по-прежнему может ответить `{ok: true}`
  для уже отсутствующего токена.

TTL проверяется управляемым monotonic clock:

- до `expires` токен пригоден;
- при `now >= expires` следующий submit вызывает pruning и отвечает
  `support_preview_expired`;
- relay transport для отклонённого токена не вызывается;
- тест не использует `sleep` и не зависит от скорости CI.

Тесты используют разные idempotency keys, чтобы результат lifecycle токена не
маскировался relay/idempotency-кэшем.

### 2. Отдельный отрицательный путь `reportPageErrors()`

Новая browser probe:

1. запускает настоящий Chromium через существующий harness;
2. регистрирует страницу штатным `watchPage`/`launch` путём;
3. создаёт page error в хвосте текущего browser turn;
4. завершает сценарий только через `await reportPageErrors()`;
5. ожидает ненулевой exit code и сообщение
   `uncaught exception(s) inside the card`.

Probe не вызывает `finish()`: иначе она снова доказывала бы чужую ветку.
`verify-guard.mjs` запускает probe рядом с существующими и отличает ожидаемый
красный вердикт от timeout/crash без диагностического сообщения.

Mutation registry содержит адресный патч, который удаляет
`await roundTripLivePages()` только из тела `reportPageErrors()`. Патч обязан
иметь уникальный anchor и краснеть на новой probe.

### 3. Сохранение acceptance trace

CLI-owned функция построения принятого manifest получает:

- candidate manifest;
- прежний `acceptance` либо отсутствие значения;
- решение `docsAcceptancePlan()`;
- флаг/причину сознательного пропуска witnesses.

Она возвращает новый manifest без мутации входов:

- если `decision.replace` непуст, записывает новый trace с точными
  `declared`, `witnesses`, `floor` и, при необходимости,
  `witnessesSkippedBecause`;
- если пиксели не заменялись, сохраняет все поля прежнего trace и добавляет
  `lastWriteWasFingerprintOnly: true`;
- если прежнего trace нет, fingerprint-only refresh создаёт только
  `lastWriteWasFingerprintOnly: true`, не выдумывая witnesses;
- `main()` использует эту функцию как единственный путь формирования поля
  `acceptance` перед записью `docs/images/screenshots.json`.

Unit-тест живёт рядом с тестами `docs-accept.mjs`, а не только в тестах чистого
планировщика. Mutation registry возвращает старый пустой fallback и обязан
получить красный результат именно от этого теста.

## Затрагиваемые файлы

Ожидаемый набор:

- `tests_backend/test_ha_websocket.py` — submit-проверки replacement/discard и
  отдельный TTL case;
- `demo/guard/guard_report_page_errors.mjs` — новая отрицательная browser probe;
- `demo/guard/verify-guard.mjs` — запуск и проверка новой probe;
- `scripts/docs-accept.mjs` — тестируемая CLI-owned сборка acceptance trace;
- `test/docs-accept.test.mjs` — точная матрица нового/сохранённого trace;
- `scripts/mutation-gate.mjs` — адресные мутанты трёх разрывов;
- `test/mutation-gate.test.mjs` — существующая применимость реестра; новые
  специальные тесты нужны только если текущий общий контракт их не покрывает;
- `docs/TESTING.md` — только если без короткого описания новых guard IDs их
  невозможно обнаружить из действующего runbook.

Production modules `custom_components/houseplan/websocket_api.py` и
`demo/serve.mjs` менять не требуется, если новые доказательства подтверждают
текущее поведение. Если тест выявит реальный дефект поведения, реализация
останавливается и найденный продуктовый scope оформляется отдельно.

## i18n, compatibility, touch и security

- новых строк и изменений словарей нет;
- persisted config, import/export и WebSocket schema не меняются;
- desktop/touch/kiosk/accessibility не меняются;
- новых входов, прав, URL и раскрытия данных нет;
- тесты support preview не должны писать raw package/message в failure output;
- временные mutation worktrees удаляются существующим cleanup-контрактом.

## Производительность

Обычный `npm test` получает только дешёвые unit/registry проверки. HA integration
test выполняется в закреплённом backend job. Новая browser probe и адресные
мутанты входят в дорогой mutation/release gate и не запускаются на каждом
обычном frontend unit прогоне сверх уже существующего `verify-guard` там, где
он явно вызван.

Никаких runtime-издержек продукта нет. Реальные `sleep` запрещены; TTL управляет
mocked monotonic clock.

## Критерии приёмки

- **AC1.** После replacement submit старого токена получает
  `support_preview_expired`, а submit токена другого `draft_id` достигает
  подменённого transport с точными preview bytes. Доказательство: HA backend
  test + отрицательный прогон без replacement-loop.
- **AC2.** После `preview/discard` submit удалённого токена получает
  `support_preview_expired`; идемпотентный success самого discard не используется
  как доказательство удаления. Доказательство: HA backend test + отрицательный
  прогон без удаления записи.
- **AC3.** Токен принимается до TTL и отклоняется при `now >= expires`, transport
  после истечения не вызывается; тест не ждёт реальное время. Доказательство:
  HA backend test + отрицательный прогон без submit-pruning.
- **AC4.** Новая browser probe завершается ожидаемым failure и сообщением через
  `reportPageErrors()` без вызова `finish()`. Доказательство:
  `node demo/guard/verify-guard.mjs`.
- **AC5.** Мутант, удаляющий round-trip только из `reportPageErrors()`, оставляет
  probe без требуемого вердикта и mutation gate считает мутанта пойманным.
  Доказательство: адресный запуск `scripts/mutation-gate.mjs --id=...`.
- **AC6.** При замене пикселей новый acceptance trace точен; при
  fingerprint-only refresh прежние `declared`, `witnesses`, `floor` и
  произвольные совместимые поля сохраняются, выставляется
  `lastWriteWasFingerprintOnly`. Входы не мутируются. Доказательство: unit.
- **AC7.** Мутант, возвращающий пустой fingerprint-only trace, краснеет на
  тесте CLI-owned функции, а не на тесте `docsAcceptancePlan()`.
  Доказательство: адресный запуск mutation gate.
- **AC8.** `node scripts/mutation-gate.mjs --check`, typecheck, полный frontend
  unit suite, build и затронутые backend tests зелёные. Доказательство: локальные
  гейты и Linux CI.
- **AC9.** Runtime product behavior, публичные API, i18n, config schema и
  пиксели не изменены. Доказательство: diff/code review; smoke/golden/docs
  screenshots не требуются при отсутствии product-source visual delta.

## План отрицательной проверки

До реализации или в review evidence фиксируются три независимых красных
результата:

1. удалён replacement-loop (и отдельно pruning/discard для AC2–AC3) — HA-тесты
   падают на ожидаемом коде/transport call;
2. удалён round-trip только из `reportPageErrors()` — новая browser probe не
   выдаёт требуемый красный вердикт, `verify-guard`/mutation gate падает;
3. fingerprint-only fallback заменён пустым trace — unit CLI-owned функции
   показывает потерю прежних полей.

Зелёный прогон без зафиксированного соответствующего red proof не закрывает AC.

## Риски

- **Backend test маскирует результат успешным relay mock.** Каждый submit
  проверяет и WebSocket response, и число/байты transport calls.
- **TTL test становится flaky.** Время передаётся через monkeypatch
  `time.monotonic`; ожидания и реальные таймеры запрещены.
- **Новая probe снова попадает в `finish()`.** Source/contract test фиксирует,
  что её развязка вызывает `reportPageErrors()` напрямую.
- **Мутант ложится в одноимённый round-trip `finish()`.** Anchor включает имя
  функции и уникальный соседний код; `--check` требует ровно одно совпадение.
- **Тест manifest helper расходится с CLI.** `main()` не дублирует ветку и
  вызывает экспортированную функцию непосредственно.
- **Release mutation gate дорожает.** Добавляются только адресные guards;
  backend/browser выполнение остаётся в существующих shard/time budgets.

## Откат

Откат одного implementation-коммита удаляет новые тесты/probe/mutants и
возвращает inline-сборку acceptance trace. Данные, API и пользовательская
конфигурация не мигрируются. Откат безопасен для runtime, но снова оставляет три
заявленных контракта без отрицательного доказательства.

## Release-артефакты

- changelog RU/EN не меняется: пользовательское поведение не изменено;
- golden, docs screenshots, performance profile и security artefact не нужны;
- документ код-ревью обязан перечислить red proof для AC1–AC7;
- issue остаётся открытым в `S8-merged` до пакетного закрытия при выпуске беты.

## Принятые предположения

- Текущая production-реализация трёх контрактов верна; задача чинит их
  доказательства. Красный тест, выявивший реальную ошибку поведения, расширением
  этой задачи автоматически не считается.
- Для backend mutation guard используется действующий
  `scripts/backend-test-guard.mjs`, чтобы запускать один именованный HA-тест.
- Сохранение произвольных совместимых полей прежнего acceptance trace важнее
  жёсткого перечисления только `declared/witnesses/floor`: fingerprint-only
  refresh не является новой приёмкой и не должен переписывать её историю.
- Названия probe и mutant IDs технические и могут быть уточнены при реализации
  без изменения AC.
