# Код-ревью #1072 — заход r1

Материал: `ddca9832aebe4b0c5ef72d720673a8938362f2c9` (рабочая копия, неизменна за время ревью).
Трек: `show`, этап `code`. Блокирующих циклов: 0/2.
Маршрут побочных находок: `mode: issues` (доверенный снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`) — побочных находок Medium вне скоупа нет, `outside_findings` пуст, REVIEW_FINDINGS не создавался.

## Скоуп

Issue #1072 — узкий инфраструктурный follow-up: добавить **пассивную** диагностику
(конкретный Git-шаг, длительность, таймаут, остаток бюджета, безопасный код
ошибки, валидность JSON, реальный Node/CPU профиль) к уже существующему
реальному CAS fixture-тесту `test/ci-proof-registry.test.mjs`, не трогая
`scripts/ci-proof-registry.mjs`/`scripts/unit-groups.mjs`, дедлайны 3000/8000 ms,
конкурентные CAS-writers и fail-closed проверки. Задача не обслуживает ни одну
строку Core user jobs напрямую (docs/SCOPE.md) — это инфраструктурная задача
(`infra`, не класс A), что соответствует правилу AGENTS.md «инфраструктурная
задача — не единственный class A файл — входит сразу в S7-code-review».

Изменённые файлы (из REVIEW_CONTEXT, подтверждено `read:diff`):
- `test/helpers/registry-probe-diagnostics.mjs` — новый helper, класс B.
- `test/ci-proof-registry.test.mjs` — класс B.
- `.github/workflows/validate-tooling.yml`, `scripts/ci-profile-paths.json`,
  `scripts/ci-registry-inventory.json` — механическая регистрация нового файла
  в путях триггеров/инвентаре, класс B.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/release-ledger/v1.82.0/1072.json`
  — класс C.

Класс A (`src/**`, Python-интеграция) и класс D (bundle/golden) не затронуты —
подтверждено по диффу.

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT, политика находок, манифест проверок,
тело issue и все 8 комментариев (включая отказы предыдущих механических
попыток и разрешение владельца на один повтор — к модельному ревью это не
имеет отношения, т.к. модель ранее не запускалась; цикл не израсходован).

Независимо прочитан код:
- `scripts/ci-proof-registry.mjs` (`fetchRegistry`) — подтверждено, что сигнатура
  `gitOp` seam и дедлайны 3000/8000 ms не изменены (не входит в diff).
- `test/helpers/registry-probe-diagnostics.mjs` — прослежена логика обёртки
  `gitOp`: что именно попадает в `entry` (step/timeoutMs/outcome/durationMs/
  remainingMs/json/code/status/signal) и что в неё **не** попадает (сырые
  `args`, `dir`/`root`, `error.message`, `stderr`, содержимое записи).
- `test/ci-proof-registry.test.mjs` — прослежены все три новых теста `#1072 …`
  и изменение существующего теста `real orphan registry survives…`.

Выполненные адресные проверки (manifest `ebeca8975a352225de511c650e1e1ac11f8daf9a946b01b607ff2d798165be15`):

| Check | Результат |
|---|---|
| `read:diff` | passed — полный диапазон diff прочитан и сверен построчно |
| `read:log` | passed — ровно один коммит `ddca9832a` в диапазоне |
| `unit:test/ci-proof-registry.test.mjs` | passed, 53/53 PASS, 0 FAIL (доступный профиль: Node v22.23.3, availableParallelism=4, logicalCpus=4). Включает реальный CAS-fixture тест (`real orphan registry survives…`) и все три новых `#1072 …` теста. TAP-вывод содержит напечатанный `t.diagnostic()` с полной трассой на успешном прогоне — соответствует требованию AC1 "успешный тест печатает TAP diagnostic" |
| `static:status-snapshot` | passed — снимок `docs/STATUS.md` (включая счётчик Node unit 5588→5591) соответствует регенерации |
| `static:ci-registry-inventory` | passed — `scripts/ci-registry-inventory.json` соответствует регенерации |
| `static:inventory` | passed — общий инвентарь (включая `scripts/ci-profile-paths.json`) соответствует регенерации |

Переиспользовано без повторного исполнения (материал/входы не менялись):
- **validate-gate** на точном материале `ddca9832a…`: https://github.com/Matysh/houseplan-card/actions/runs/40276265133 — зелёный, `review-light proof is complete`. Это внешняя authority по полному Product/Tooling/Docs конвейеру на кандидате, не пересчитывается здесь.
- Хендофф-прогоны автора (контекст, не доказательство само по себе): адресный `node --test` на WSL Node22.23.2 и native Windows Node22.23.4 (53/53 PASS каждый), полный `unit-groups --group=tooling` в WSL (2356 PASS/0 FAIL), полный native Windows tooling (2262 PASS/6 FAIL — все шесть вне CAS/новых тестов, явно отнесены к известным #858/#811/#857/#926), реальный `HP_PREPUSH_GATE=1 git push` (255 с/0 FAIL).

Не выполнялось (и не требовалось): browser-смоки (issue не называет видимое поведение, UI не меняется), общий `npm test`/`tsc`/`gate:small` с нуля (переиспользован зелёный validate-gate на этом же SHA), нативный Windows-прогон с моей стороны (окружение недоступно; выводы автора о six известных FAIL вне CAS принимаются как контекст, а не как самостоятельное доказательство — первичным доказательством остаётся зелёный validate-gate и мой собственный прогон `unit:test/ci-proof-registry.test.mjs`).

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| **AC1** — bounded, passive trace (step/duration/timeout/remaining/safe code/status/signal/JSON validity/Node-CPU), без argv/путей/stderr/error.message/содержимого записей; assertion несёт trace, успешный тест печатает TAP diagnostic | Прочитан код `traceRegistryProbe`: `entry` строится только из белых списков `code`/`signal`, `step` выводится сравнением с константным списком (не копирует `args`), `root`/`dir` нигде не попадает в `diagnostic()`. Три новых теста запущены мной (`unit:test/ci-proof-registry.test.mjs`, 53/53 PASS): тест «preserves fail-closed fetch errors» напрямую проверяет `text.includes(secret) === false`, где `secret` — это и `root`, и `error.message`, и `stderr`; тест «distinguishes successful Git with malformed input from a failed show» проверяет, что `code`/`status` утечки `'private code'`/`'private output'` не происходит; тест «retains the absolute deadline and bounds its diagnostic history» проверяет cap в 16 записей (22 вызова → 16 operations + omitted=6) и что истёкший дедлайн не инициирует Git-вызов (`calls === 0`) | Обычный негативный вход, исполнен: если бы обёртка сериализовала `error.message`/`stderr`/`root` или не ограничивала историю/не уважала истёкший дедлайн — любой из трёх `#1072 …` тестов красит FAIL (воспроизведено логически по ассертам; тесты зелёные на материале) |
| **AC2** — `scripts/ci-proof-registry.mjs` и `scripts/unit-groups.mjs` не изменены; 3000/8000 ms, конкурентная CAS-коллизия, три точные записи, неизменный checkout, fail-closed corrupt JSON сохранены; мутанты не исполнялись | `read:diff` подтверждает: ни `scripts/ci-proof-registry.mjs`, ни `scripts/unit-groups.mjs` не входят в diff (0 правок). Тест `real orphan registry survives concurrent CAS writers…` в исполненном прогоне (PASS) по-прежнему проверяет `pushes === 2` (retry лишней CAS), три точные записи через обёрнутый `probe.store.read`, `git(b,['rev-parse','HEAD']) === head` (checkout не двигается) и `fetchRegistry(a).read(...) === null` на повреждённом JSON | Исполненный обычный прогон теста (не мутант): все инварианты теста остались зелёными на неизменной реализации; отдельное временное исполнение мутанта реализации запрещено политикой ревью и не проводилось |
| **AC3** — адресный и полный tooling-контроль с runtime/CPU, native Windows описан отдельно от WSL/CI, успешные текущие прогоны не объявлены причиной/исправлением старых RED | Внешняя authority: validate-gate зелёный на точном материале (run 40276265133). Мой адресный прогон `unit:test/ci-proof-registry.test.mjs` — 53/53 PASS с явным профилем (Node v22.23.3, availableParallelism=4, logicalCpus=4). `docs/STATUS.md`/`docs/DEVELOPMENT.md` текстуально не объявляют историческую причину найденной; формулировки честные («Successful current runs do not establish the cause…») | Не защитный AC в узком смысле (фактическая проверка покрытия), краснеет при появлении FAIL в указанных прогонах — не произошло |

## Находки

Находок нет — ни High/Medium в скоупе, ни Medium вне скоупа.

Рассмотренные и отклонённые гипотезы дефектов:
- **Утечка секретов через `error.message`/`stderr`/`root`.** Проверено чтением и прогоном теста — исключено явно (см. таблицу AC1).
- **Ослабление guard/deadline.** Проверено диффом — `fetchRegistry`/`publishRegistry` байт-в-байт не изменены, 3000/8000 ms не трогались.
- **Рассинхронизация счётчика тестов в `docs/STATUS.md`.** +3 новых теста (`#1072 …`) соответствуют изменению 5588→5591; подтверждено `static:status-snapshot` PASS; других мест в живой документации с этим числом не найдено (`grep` по репозиторию — совпадения только в исторических `docs/reviews/*` снимках и несвязанных бинарных/SVG-данных).
- **Нарушение класса изменений / правила №1.** Все файлы — класс B/C, класс A/D не тронуты; задача отмечена `infra` и не требует спека (AGENTS.md).
- **Ledger-категория.** `docs/release-ledger/v1.82.0/1072.json`: `category: "infra"`, обоснование соответствует факту (диагностика теста, без изменения поведения продукта) — не пользовательский milestone, что корректно для инфраструктурного/внутри-бетного исправления (#838).
- **User-Visible/CHANGELOG.** Видимое для пользователя поведение не меняется (чистая тестовая диагностика + документация разработки); `docs/CHANGELOG*.md` не тронуты — согласуется с отсутствием видимых изменений.
- **Избыточный overhead обёртки.** `diagnostic()`/push в `operations` происходит и на успехе (используется как сообщение `assert.deepEqual` и явный `t.diagnostic()`), это тестовый hot path, не продакшен; активных perf-гейтов не касается.

## Что не проверялось (честная граница)

- Буквальный текст commit-трейлеров `Issue:`/`User-Visible:` в полном теле коммита не инспектировался — доступный `read:log` отдаёт только oneline. Изменение не класс C-only (есть B-файлы), поэтому терминальные трейлеры обязательны; локальный commit-msg hook репозитория штатно блокирует их отсутствие, а push и внешний validate-gate на этом материале прошли без обхода (`--no-verify` не упоминается нигде в хендоффе/комментариях) — прямых оснований сомневаться нет, но сам текст трейлеров не читан напрямую инструментами, доступными на этом этапе.
- Нативный Windows-прогон полного tooling-набора не воспроизводился с моей стороны (недоступное окружение); использована только как контекст авторская раскладка (six FAIL вне CAS, отнесены к известным #858/#811/#857/#926) — не как самостоятельное доказательство.
- Полный `gate:small`/релизный прогон заново не запускался — переиспользован зелёный validate-gate на этом же SHA (политика ревью: смена SHA из-за review/docs не отменяет пригодное доказательство; материал не менялся).
- Browser-smoke не запускались — тело issue не называет видимое поведение/смоук, UI не меняется.

## Маршрут

`route: fix`. Критерии §5 пройдены: сложность/риск ≤3 (точечная диагностическая обёртка вокруг существующего seam), одна поверхность (тестовая инфраструктура CAS-fixture), миграций конфига/совместимости нет, нового UX-контракта нет (продукт не меняется), на производительность/touch не влияет, ожидаемое поведение зафиксировано в теле issue (AC1–AC3) и задокументировано в `docs/DEVELOPMENT.md`/`docs/STATUS.md`.

## Вердикт

`green`. High: 0. Medium: 0.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjA1ZmY0ZjZiNTE1MGNlODA0YzIyNDFhMWUxNzhiNWJkZTgxZWY1Nzk5ZjNiZDFmODMzZjk5MDI4M2Y5YzBkNGEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI5OWUyMWEyZTEyMDc4ZjU3ZWU4ZDFiMzAwODk3NDBhODFhY2MzODRiOWQ2Y2NhZmUxOTJhN2QyNmQyMWNhNGZhIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDcyLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJkZGNhOTgzMmFlYmU0YjBjNWVmNzJkNzIwNjczYTg5MzgzNjJmMmM5IiwidHJlZSI6IjQxMzY0ODk1ZTFhYmMyNjE2M2U4MjdjZTM2OGQzYjlhYzJkNGIxZWYiLCJib2R5RGlnZXN0IjoiMjNkOWQ4MDFmOTg3Y2FhYWFmMTkwNzAzMzVjNjE5YWE3OGQ4YzI4NzI4YzlmYTRhNGY0ZjRlYzI4NDFlZWUzYiIsInByb2R1Y2VyUnVuIjoiNDAyNzg3ODA4NTciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImVkOTRjOGMwNjU0MDM0MWY2OTk3YzUwZjQ3NWY5NGNhY2NmODU5ZmZiZDM0YTAxNjdlNWZlZGFjMWU1Yjc5ZWMiLCJ2ZXJkaWN0RGlnZXN0IjoiNDAyODU5ZWVmZDM2NzhmNDUwOGRmMjc3NGM1NzJhNWU5MjM0MjgzNjU3NjMwNDI5Yzk1ZDcxMzBmN2VhM2E0MiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJhNTc2NDBiY2E0ODNmNTg3NzdlYjhjZDAyOWNhMWI0ZmJmZmJkZWE5ZTcyMDJmNWZjYmFmOTlhZjY5MzY0NWZhIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA5NjY3NjQ5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDcyI2lzc3VlY29tbWVudC02NDA5NjY3NjQ5IiwiYm9keURpZ2VzdCI6ImJjZjljZWUwMGFhMGFhNTVmYzdkMzJhNzk5ODZmNzNkNDVjMjNiYjhhZjkxMDk0OTAwOGZmNzUyMDIxODhkMDQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1072-registry-diagnostics`, коммит `ddca9832aebe` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `41364895e1abc26163e827ce368d3b9ac2d4b1ef`
  ```
  git log --all --format='%H %T' | grep 41364895e1ab
  ```
- Тело issue: `23d9d801f987caaaaf19070335c619aa78d8c28728c9fa4a4f4f4ec2841eee3b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40278780857,"run_attempt":1,"digest":"a8282edbbe77081ea373f916280c80df09b5427b0f01953c30b66df3bac417b6"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjIsIm91dHB1dF90b2tlbnMiOjIzOTQ3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwOTIxNCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI1MzM1OTEsImNvc3RVc2RFc3RpbWF0ZSI6MS4xODMxNjgyMDAwMDAwMDAxfV0sInR1cm5zIjozNSwiZHVyYXRpb25NcyI6MzYxMzM2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4xODMxNjgyMDAwMDAwMDAxLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=62 output_tokens=23947 cache_creation_input_tokens=109214 cache_read_input_tokens=2533591 num_turns=35 -->
