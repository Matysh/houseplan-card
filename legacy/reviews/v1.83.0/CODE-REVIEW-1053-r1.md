# CODE-REVIEW-1053-r1

Материал: `02579c4482b2bc0e77ac390d5d7bfdd9e21492bf` (merge, база `4b5e1b007`), ветка
`issue/1053-signal-host-lifecycle`, `git log origin/dev..HEAD` = `1d80783e7`
(`fix(signal): fence direct LQI to mounted hosts`) + `02579c448` (merge,
продукт идентичен `1d80783e7`, резолвит только generated CI inventory #1052).
Трек: `show`. Заход: r1, блокирующих циклов 0/2.

## Скоуп

ТЗ (тело issue #1053, три AC) и дифф совпадают построчно:
`src/device-signal-runtime.ts` + узкие тесты/демо-смоки/реестр мутантов/
документы/release-ledger. Backend/config schema/writer/retry cadence/HA radio
adapters не тронуты — подтверждено чтением диффа (`tests_backend/*` — только
новые тесты, не изменение API).

Работа закрывает J1/J7 (`docs/SCOPE.md`): прямой LQI (#1029) должен корректно
жить/умирать с жизненным циклом карточки и не плодить лишние запросы к
бэкенду. Правка — защита существующего, уже описанного поведения
(`docs/DEVICE-PRESENTATION.md`, `docs/CONFIG-COMPATIBILITY.md`), не новый
UX-контракт.

## Маршрут (§5)

- `complexity` — один файл ядра (17 строк диффа) + тесты, риск низкий — проходит.
- `surfaces` — одна поверхность: `DeviceSignalController`/`start()` в
  `device-signal-runtime.ts` — проходит.
- `migration` — нет новых compat-полей, формат `config/get fields:[...]`
  существует с #256 — проходит.
- `ux-contract` — видимое поведение (LQI то же, что раньше ожидалось от
  #1029) не меняется по контракту, только чинится жизненный цикл — проходит.
- `perf-touch` — нет влияния, touch не трогается — проходит.
- `undocumented` — ожидаемое поведение зафиксировано в
  `docs/DEVICE-PRESENTATION.md`/`docs/CONFIG-COMPATIBILITY.md`, патч их же и
  обновляет — проходит.

Все критерии пройдены → `route: fix`.

## Как проверялось

Принят proof `review-light` на материал `02579c448` (validate-gate run
[40045744437](https://github.com/Matysh/houseplan-card/actions/runs/40045744437),
`head_sha` подтверждён через `gh api .../runs/40045744437` = точно наш SHA,
`conclusion: success`). Покрытые этим прогоном проверки не повторялись:

| Гейт | Статус в validate-gate | Что подтверждает |
|---|---|---|
| Бэкенд: pytest в HA (job 120727063194) | PASS, `HA-harness присутствует: 885` коллектировано, `2213 passed, 1 skipped` | AC2 backend: `test_issue_1053_projected_probe_keeps_capability_outside_config`, `test_issue_1053_capability_probe_model_tag_projection_is_small` реально выполнены в HA-харнессе, не только собраны |
| Фронтенд: типы/юниты/мутанты/бандл (job 120727063280) | PASS, `tests 1196 / pass 1196 / fail 0` | AC1/AC2 юниты `test/device-signal-runtime.test.mjs`, tsc, static mutation `--check` |
| Браузер: выбранные проверки push (job 120727556755) | PASS, лог: `passed smoke smoke_direct_signal_lifecycle.mjs`, `passed smoke smoke_view_recovery.mjs`, план включал также `smoke_direct_zigbee_lqi.mjs` | AC1/AC3 полным именованным браузерным прогоном на точном SHA |
| Мутанты по диффу (шард 1–6) | SKIPPED (ночной) | Подтверждает «мутанты не исполнялись» — согласовано с политикой, не находка |
| Golden-кадры / Геометрия TS-Python parity | SKIPPED | Нет визуальных/геометрических изменений — скоуп не требует |

Адресно — после proof, только непокрытое и дешёвое:
- `npx tsc -p . --noEmit` и `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/device-signal-runtime.test.mjs test/device-signal.test.mjs` — локально, **17/17 PASS**, совпадает с цифрой автора.
- `node scripts/mutation-registry.mjs --check` и `node scripts/smoke-links.mjs --check` — exit 0, три новых мутанта (`direct-signal-detached-host-acquires-1053`, `direct-signal-full-config-probe-1053`, `direct-signal-old-projection-retries-1053`) зарегистрированы корректно, `find` встречается по одному разу.
- `node scripts/ci-registry-inventory.mjs` — exit 0, generated inventory свежий (не stale).
- `gh issue view 1054` — подтверждён как реально открытый issue, на который корректно сослалось «НЕ сделано».

Backend `pytest` локально не прогонялся повторно (в контейнере нет `pytest`/нужной
версии Python — `pip3 list` не находит `pytest`, система на 3.12, харнесс
закреплён на 3.14) — это не пробел, т.к. validate-gate уже выполнил именно эту
проверку на этом SHA с коллекцией HA-тестов (885 шт., не 0), см. таблицу выше.

### Разбор AC по коду и тестам

**AC1** (detached lifecycle). `DeviceSignalController` получил `connected`
флаг: `hostConnected()` взводит и зовёт `hostUpdate()`; `hostUpdate()` выходит
немедленно при `!connected` (`src/device-signal-runtime.ts:158-166`);
`hostDisconnected()` снимает флаг и зовёт отделённый `release()`. Прочитано и
прослежено: без этой проверки `full.assign(late.hass); full.signal.hostUpdate()`
из теста `test/device-signal-runtime.test.mjs` (новый тест «#1053 detached Lit
controllers…») обязана была бы вызвать `subscribeDirectSignal` на `late.hass`
(т.к. `hass.connection !== this.connection` после `release()`), что сломало бы
assert `late.counts() === {commands:0, subscriptions:0}` — т.е. тест умеет
падать (проверено чтением, не исполнением, повторный checkout запрещён
правилами). Зарегистрированный мутант `direct-signal-detached-host-acquires-1053`
(инверсия этой же строки) подтверждает то же самое для браузерного смока.
Доказано автотестом (юнит, PASS в validate-gate) + защитная строка таблицы
автора корректна.

**AC2** (узкая проекция). `start()` теперь шлёт
`{ type: 'houseplan/config/get', fields: ['model_version'] }`
(`src/device-signal-runtime.ts:91`), капабилити читается из
`response.zigbee_lqi_api` вне `config`, тело `config` игнорируется целиком —
подтверждено тестом «capability acquisition requests only metadata and ignores
any config body», который специально подсовывает поддельный
`config.zigbeeLqi` и проверяет, что `directSignalReadings` остаётся пустым.
`invalid_format` добавлен в терминальные коды наравне с `unknown_command`/
`unauthorized` (строка 119) — старые/неподдерживающие backend не уходят в
retry-loop, проверено тестом с `setTimeout(..., 1100)` и счётчиком `requests===1`.
Backend-контракт (`fields:[]` = полный документ, а не metadata-only) зафиксирован
и проверен `test_projection.py` (`project_config(CONFIG, fields=[]) is CONFIG`)
и реальным HA WS-тестом `test_issue_1053_projected_probe_keeps_capability_outside_config`
— оба выполнены в validate-gate (см. таблицу).

**AC3** (generic recovery). `demo/smoke_view_recovery.mjs` отделяет
`fields:['model_version']`-запросы предикатом `metadata()` от подсчёта
`calls`; при этом `detachBeforeLateHassCancelsIntent` сознательно проверяет
*весь* `requests` (включая metadata) — это корректно, т.к. AC1 требует, чтобы
detached host не начинал даже capability-пробу, а не только mandatory
config/layout. Все исходные assertions (A/B/ABA, held reply, exact pairs)
сохранены построчно — дифф не удаляет ни одной старой проверки, только
добавляет фильтр. Пройден в validate-gate как `smoke_view_recovery.mjs` PASS
на точном SHA.

### Трейлеры, changelog, release-ledger

- Оба коммита несут `Issue: #1053`; `1d80783e7` — `User-Visible: yes` с
  правками `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в этом же коммите
  (проверено `git show --stat`); merge `02579c448` — `User-Visible: no`,
  реально без изменений продукта (только `scripts/ci-registry-inventory.json`
  и чужой #1052 материал).
- `docs/release-ledger/v1.82.0/1053.json`: `category: line-fix`,
  `introducedBy: 1029` — корректно, т.к. #1029 (прямой LQI) не входит в
  `v1.82.0` stable; это внутрибетное исправление, не пользовательский
  milestone релиза.
- Число «482→483 / 241→242» в `docs/testing-notes/mutation-browser-guards.md`
  генерируется из реестра мутантов (`node scripts/mutation-registry.mjs --check`
  подтверждает согласованность) — один источник, не дублируется вручную
  где-то ещё.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа. Побочных находок нет
(маршрут `mode=issues` по доверенному снимку политики; новых issue не заводится,
т.к. заводить нечего).

## Что проверено и корректно

- Lit-жизненный цикл `hostConnected/hostUpdate/hostDisconnected` с явным
  fence, разделение `release()` (внутреннее) от реального disconnect.
- Узкая проекция `fields:['model_version']`, капабилити вне `config`, тело не
  принимается как signal authority — и на фронте, и на бэкенде (unit + HA WS).
- Терминальность `invalid_format`/`unknown_command`/`unauthorized` без
  retry-loop.
- Generic recovery отличает metadata от mandatory config/layout, все прежние
  assertions (pairs/no-load-before-HA/detach/A-B-ABA/held reply) сохранены.
- Мутанты трёх новых витнессов зарегистрированы, не исполнены; `--check`
  статика зелёная; `ci-registry-inventory` свежий.
- Трейлеры, changelog (оба языка, тот же коммит), release-ledger
  (`line-fix`/`introducedBy:1029`) корректны.
- Скоуп диффа не выходит за `src/device-signal-runtime.ts` и узкие
  тесты/документы — backend schema/writer/radio adapters не тронуты.
- #1054 (вынесенная отдельная проблема) реально существует и открыт.

## Чего не проверял

- Полный `npm test`/`gate:small`/ночная матрица смоков — не гейт этого
  ревью (§8), покрытие AC уже дано точечно validate-gate + локальным
  прогоном юнитов.
- `pytest tests_backend` я не перезапускал локально (нет `pytest`/python3.14
  в этой среде) — опирался на зелёный прогон validate-gate на этом же SHA с
  подтверждённой коллекцией HA-харнесса (885 тестов, не 0).
- Ночное исполнение зарегистрированных мутантов (`direct-signal-detached-host-acquires-1053`,
  `direct-signal-full-config-probe-1053`, `direct-signal-old-projection-retries-1053`) —
  не моя задача по текущей политике; защитные AC доказаны чтением кода +
  ordinary unit PASS, это допустимый способ по правилам ревью.
- Полная визуальная/golden матрица — нет визуального риска в задаче, `ci:golden`
  не проставлялась и не требовалась.
- Ручная dev/GPU-приёмка владельцем — добровольна, её отсутствие не находка.

## Вердикт

Все три AC выполнены, доказаны автотестами (юнит + реальный HA WS + браузерный
смок), защитные случаи AC1/AC2 имеют непустой столбец «чем краснеет» с
зарегистрированным витнессом либо подтверждённым чтением кода негативным
случаем. Backend/конфиг/протокол не менялись сверх заявленного. Трейлеры,
changelog и release-ledger корректны. Находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1053-signal-host-lifecycle`, коммит `02579c4482b2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e87547a4dafd998f29e225c7972282ccac7bf74b`
  ```
  git log --all --format='%H %T' | grep e87547a4dafd
  ```
- Тело issue: `e53c33b14eaa278010294223dd8d487739d771d453899533db44c41b2a8c96a5`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTg2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3NCwib3V0cHV0X3Rva2VucyI6MjY2MTQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTAwODk3LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzEyMjc5OCwiY29zdFVzZEVzdGltYXRlIjoxLjI5NDQzNTZ9XSwidHVybnMiOjQ4LCJkdXJhdGlvbk1zIjozNzE0OTgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjI5OTYyMTYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5170 output_tokens=26632 cache_creation_input_tokens=100897 cache_read_input_tokens=3122798 num_turns=48 -->
