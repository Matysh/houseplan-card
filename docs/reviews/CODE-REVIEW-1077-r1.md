# Код-ревью #1077 — заход r1

Репозиторий: Matysh/houseplan-card · Этап: code · Трек: ask
Материал: `c57bbbb7ab02047d2b0868ebcaaf997332a490c7` (неизменен на всём ревью)
Коммиты: `45d7f8484 fix(zigbee): distinguish hidden placements in diagnostics`,
`c57bbbb7a refactor(zigbee): share diagnostic detail presentation`

## Скоуп

ТЗ #1077 (ревью ТЗ r1 — зелёный, `docs/reviews/SPEC-REVIEW-1077-r1.md`) требует согласовать три
факта — «размещения нет», «есть, но скрыто пользователем», «показано локальным глазом» — между
диагностикой общих настроек, mapper'ом (`mapTopologyNodes`) и overlay, не трогая сохранённую
видимость, ZHA/Z2M-протоколы и registry authority. AC1–AC7 из тела issue.

Изменённые поверхности: `src/zigbee-topology.ts` (mapper), `src/zigbee-topology-diagnostics.ts`
(diagnostics projection), `src/hp-zigbee-topology-settings.ts` (UI-разделение «нет
значка»/«скрыто»/«показано»), `src/editors/general-settings-dialog.ts` (caller теперь передаёт
`host._renderDevices` вместо `host._devices`), 4 локали `src/i18n/topology/*.json`, новый
unit-файл `test/zigbee-hidden-placement.test.mjs`, новый browser-smoke
`demo/smoke_zigbee_hidden_placement.mjs`, новая golden-сцена `zigbee-hidden-child-flat-light`,
registry-записи (`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`,
`scripts/ci-registry-inventory.json`), release-ledger `docs/release-ledger/v1.82.0/1077.json`,
документация (ARCHITECTURE/CONFIG-COMPATIBILITY/DEVICE-PRESENTATION/STATUS/USER-GUIDE ru+en),
CHANGELOG ru+en.

## Как проверялось

Static-first: прочитан `read:diff`/`read:log` (неизменный материал), полный текст изменённых
файлов (`zigbee-topology.ts`, `zigbee-topology-diagnostics.ts`, `hidden-device-visibility.ts` —
не менялся, но несёт ключевой `canRevealUserHidden`/`HiddenDeviceRoster`, — `hp-zigbee-topology-settings.ts`,
`general-settings-dialog.ts`), а также сопутствующий код в `houseplan-card.ts`
(`_displayDevices`/`_renderDevices`/`_renderDeviceSnapshot`/`captureRenderDeviceSnapshot`), чтобы
убедиться, что diagnostics и overlay теперь питаются одной и той же эффективной проекцией.

Прослежена логика `mapTopologyNodes` построчно против каждого кейса нового
`test/zigbee-hidden-placement.test.mjs` (hidden-only, hidden-revealed, hidden↔hidden, настоящий
placement-missing, 5 lifecycle-отказов, провайдерские/route-ошибки поверх hidden, дубликат hidden
physical, entity-alias поверх скрытого device-маркера) — код и тест совпадают построчно.

Переиспользован зелёный CI материала (`https://github.com/Matysh/houseplan-card/actions/runs/40256038244`,
review-light-golden proof complete) как контекст, не как замена адресному исполнению. Дополнительно
выполнены адресные проверки для нового/критичного кода этим раундом (см. таблицу ниже); gate:small
целиком не перезапускался (не требовалось — §8, пропорциональность).

### Выполненные проверки (fixed-check runner)

| Check | Результат | Назначение |
|---|---|---|
| `build:test` | PASS | подготовка `test-build/*` для unit-тестов |
| `unit:test/zigbee-hidden-placement.test.mjs` | PASS | все 9 новых сценариев AC1–AC5 |
| `build:build` → `build:bundle:sync` | PASS | сборка бандла для browser-smoke (без них smoke падал с `Failed to fetch dynamically imported module`, см. «Что не проверялось») |
| `smoke:demo/smoke_zigbee_hidden_placement.mjs` | PASS (все 10 проверок `out.*` true) | реальный caller General Settings + overlay: AC1, AC2, AC6, AC7 на живом Chromium |
| `unit:test/zigbee-provider-routes.test.mjs` | PASS | регрессия: существующие сценарии `mapTopologyNodes`/`hover` не задеты новой сигнатурой/веткой |
| `unit:test/zigbee-topology.test.mjs` | PASS | регрессия соседнего модуля |
| `unit:test/zigbee-topology-diagnostics.test.mjs` | PASS | регрессия diagnostics |
| `unit:test/hidden-device-visibility.test.mjs` | PASS | регрессия `canRevealUserHidden`/`HiddenDeviceRoster` (не менялись, но критичны для контракта) |
| `build:typecheck` | PASS | типы `hiddenPlacements`/`hidden?` непротиворечивы |
| `unit:test/i18n.test.mjs`, `unit:test/i18n-dead-keys.test.mjs` | PASS | 3 новых ключа × 4 локали валидны и используются |
| `unit:test/bundle-policy.test.mjs` | PASS | новый `bundleBytes=3510824` в `scripts/monolith-baseline.json` согласован с собранным бандлом и бюджетами |
| `unit:test/golden-matrix.test.mjs` | PASS | новая сцена `zigbee-hidden-child-flat-light` структурно корректна |
| `static:mutation-registry` | PASS, якорь `zigbee-hidden-diagnostics-raw-roster-1077` — `ok` | анкор мутанта жив в `general-settings-dialog.ts`; сам мутант не исполнялся — заявлено честно как «не исполнялся», это допустимо (nightly-гейт, не гейт ревью) |
| `unit:test/release-ledger.test.mjs` | PASS | `docs/release-ledger/v1.82.0/1077.json` валиден |
| `unit:test/docs-acceptance.test.mjs`, `unit:test/docs-freshness.test.mjs` | PASS | документация синхронна с кодом/STATUS.md |
| `unit:test/ci-registry-inputs.test.mjs` | PASS | registry-записи (новый unit/smoke) согласованы |
| `unit:test/commit-provenance.test.mjs` | PASS | трейлеры коммитов в допустимом формате |

Неучтённый нюанс исполнения: первый запуск browser-smoke упал с `Failed to fetch dynamically
imported module: http://demo.local/assets/houseplan-card.js`, потому что в рабочей копии ещё не
было собранного бандла для материала ревью (инфраструктурный пробел окружения ревью, не дефект
продукта) — после `build:build`+`build:bundle:sync` smoke прошёл со всеми 10 проверками true.

## AC → доказательство → чем краснеет (проверено независимо)

| AC | Независимая проверка | Чем краснеет |
|---|---|---|
| AC1 | код-трасса + `unit:test/zigbee-hidden-placement.test.mjs` (`#1077 hidden-only is an existing placement…`) + `smoke_zigbee_hidden_placement` (`hiddenHasActionableReason`, `hiddenIsNotMissingOrProviderPartial` = true) | реально отсутствующий marker даёт `placement_missing` (тест `#1077 actual absent placement remains missing…`), скрытый — отдельный `hidden` факт |
| AC2 | код-трасса `resolveMappedTopologyHover`/`hiddenPlacements` + unit `#1077 revealed hidden origin and neighbour…`, `#1077 hidden to hidden…` + smoke (`hiddenOriginOutgoingAndVisibleOriginIncoming`, `exactPaintedEndpoints`, `eyeOffRemovesMarker`, `hiddenToHiddenDirectLink` = true) | глаз off убирает маркер/линию, сырой config не переписан (`noVisibilityConfigWrite` true) |
| AC3 | unit `#1077 provider and route failures remain independent of hidden-only placement` (PASS) | provider_scan_failure/`provider_partial` остаются при наличии hidden-факта на том же узле |
| AC4 | unit 5× lifecycle-отказов (`HA disabled/orphaned/unverified/removed/virtual`) + `#1077 duplicate hidden physical placements remain ambiguous` (все PASS) | каждый недопустимый вход даёт `placement_missing`/`ambiguous_placement`, не `hidden` |
| AC5 | unit `#1077 a visible entity alias remains a valid radio representative…` + регрессия `zigbee-provider-routes.test.mjs`/`zigbee-topology.test.mjs` (PASS) | alias/координатор/duplicate-физический сценарии не меняют смысл |
| AC6 | код-трасса `_displayDevices`→`_renderDevices`→`captureRenderDeviceSnapshot` (единая проекция для overlay и диагностики) + smoke (`noVisibilityConfigWrite`, `noAutomaticRescan` = true) + `static:mutation-registry` (анкор `zigbee-hidden-diagnostics-raw-roster-1077` жив) | мутант (возврат `host._devices` вместо `host._renderDevices`) зарегистрирован, в этом раунде не исполнялся (допустимо вне nightly) |
| AC7 | diff локалей (ru/en/de/fr, 4 новых ключа идентичного смысла) + `unit:test/i18n.test.mjs`/`i18n-dead-keys.test.mjs` + smoke (`narrowReasonWraps` = true на 390px) | длинный/узкий экран не переполняется, HTML не используется (literal text) |

Пустых третьих столбцов нет — защитный AC4 имеет явный негативный свидетель.

## Находки

Находок нет (High: 0, Medium: 0).

Независимый разбор кода подтвердил: мэппер различает «нет представителя» → `placement_missing`/
`ambiguous_placement` от «есть позитивно разрешённый user-hidden representative» → `hidden`/`shown`,
используя тот же `canRevealUserHidden` (единственный резолвер, как требует ТЗ — «один общий resolver
eligibility, не два фильтра»). Diagnostics (`describeZigbeeTopology`) и overlay (`mapTopologies`/
`resolveMappedTopologyHover`) используют общий `hiddenPlacements`, построенный внутри одного вызова
`mapTopologyNodes`, так что раздвоения источников истины не осталось. `general-settings-dialog.ts`
теперь передаёт `host._renderDevices` — тот же источник, что и оверлей (`_renderDevices` =
`_renderDeviceSnapshot?.devices || this._displayDevices`, а снэпшот тоже строится на
`_displayDevices`), закрывая расхождение raw/effective roster, описанное в «Наблюдении по коду»
issue. Удаление скрытия никогда не переживает `marker.removed`/`ha_disabled`/`orphaned`/`unverified`/
`virtual` (отдельно проверено 5 unit-кейсами) и не склеивает неоднозначные дубликаты в одну
радиоточку. Провайдерские/route-ошибки остаются независимыми от hidden-факта на том же узле (unit
«provider and route failures remain independent…»).

Качество кода: без лишних абстракций, один resolver, комментарии только там, где неочевидны инварианты
(например, почему entity-дубликаты не считаются неоднозначными). Release-артефакты (changelog ru+en
в одном коммите, STATUS.md, USER-GUIDE ru+en, release-ledger с обоснованием stable-fix) присутствуют.
User-Visible изменение (новый пользовательский текст диагностики) отражено в обоих changelog одним
коммитом — единственное видимое пользователю число (`bundleBytes`) находится только в
`scripts/monolith-baseline.json`, один источник, подтверждён `bundle-policy.test.mjs`.

## Что проверено и корректно

- Разделение трёх фактов (нет/скрыто/показано) в mapper и diagnostics, включая кеш `hiddenPlacements`.
- Hidden↔visible, hidden↔hidden, направления in/out, конечные точки линий (smoke, `exactPaintedEndpoints`).
- Toggle глаза без reload и без записи config/без пересканирования (smoke `before === after`, `callWS('zha/devices')` вызван один раз).
- Независимость реальных provider/registry/route ошибок от hidden-факта.
- Lifecycle-отказы (HA-disabled/orphaned/unverified/removed/virtual) не оживают через скрытие.
- Неоднозначные дубликаты (физические) остаются `ambiguous_placement`.
- Entity-alias остаётся валидным representative, когда device-маркер того же узла скрыт.
- i18n: 4 ключа, 4 локали, используются, не мёртвые, читаемы на 390px.
- Бандл-бюджет и его обоснование в issue соответствуют собранному артефакту.
- Release-ledger классификация `stable-fix` обоснована: фича «глаз»/#919 вышла задолго до v1.82.0 (видно в истории CHANGELOG.md), баг воспроизводится в уже стабильной версии.
- Трейлеры коммитов (`commit-provenance.test.mjs`) и регистрация smoke/registry (`ci-registry-inputs.test.mjs`) согласованы.

## Что не проверялось / границы

- Полный `gate:small`/`ci:golden` целиком не перезапускался — переиспользован зелёный CI материала
  (`review-light-golden proof is complete`, run 40256038244) плюс адресные проверки выше для нового/
  рискового кода (§8, пропорциональность; полные наборы — предрелизный гейт).
- Пиксельный golden-рендер новой сцены `zigbee-hidden-child-flat-light` не перезахватывался в этом
  ревью (это предмет визуального гейта/review, не код-ревью); release-ledger помечает её как `new`
  без принятия baseline — корректно по процессу.
- `demo/smoke_zigbee_incomplete_reasons.mjs`, `demo/smoke_zigbee_led_topology.mjs`,
  `demo/smoke_hidden_device_toggle.mjs` (упомянуты в release-ledger как неизменные смоки) не
  перезапускались отдельно — их зона (чужой, не изменённый код) покрыта существующим зелёным CI;
  логика, которую они бы проверяли (provider_partial, LED-эндпоинты, сам тумблер глаза), уже
  независимо верифицирована через unit-трассировку и через новый smoke.
- Мутант `zigbee-hidden-diagnostics-raw-roster-1077` зарегистрирован, но не исполнялся в этом раунде
  (допустимо: обычный негативный вход/исполнение мутанта вне ночного workflow запрещено политикой
  ревью). Анкор проверен статически — жив.
- Живой HA/ZHA/Z2M и приватный диагностический пакет не использовались (не требуется по ТЗ — синтетические данные).

## Маршрут вердикта

route: fix (как указано в задаче).

## Вердикт

**Зелёный.** Заход r1. High: 0, Medium: 0. Блокирующих циклов: 0/4.

Outside-findings policy: mode=issues (трейлер `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`). Побочных
находок за пределами скоупа #1077 не обнаружено — `outside_findings` пуст.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImIxODIxMmUzNDE0NDMxMmM4OWU0YWVlMDBkMTM1Mzc0M2NkYWFkZWM1NDFmZTU5NDY5MTJlOGIxMTYzYjI3MDQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIxNTk0YWY0NGIyOGM5NzgxMmMyODczMWFkY2YxOTY3NGU1NGU5N2Y0YzdkZmQxNmZmNGQ0MTU4YTJkNjdhZjk1IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDc3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJjNTdiYmJiN2FiMDIwNDdkMmIwODY4ZWJjYWFmOTk3MzMyYTQ5MGM3IiwidHJlZSI6IjYzNTUxNGZhYWFjYzQ0ZmQwNTExYWQxZmIzOTE5Y2JmZGM5NWU1NjEiLCJib2R5RGlnZXN0IjoiN2FjYzZkZWZjMDg5YWU3OGVmYzUxNmM4MzIxMDg3M2Y1YjVmMmRkNjQwNTQzYWIxMDFiNGUxNWE1YmNjMWIzOSIsInByb2R1Y2VyUnVuIjoiNDAyNTY2NDA5NTMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImU0NGU4NGZkYjVhNDdhMTkyOTAxZTE5ZjkyOGY0ZDJmYjkwOThjZDdmMjMwZDNiOWEwZmI5MWUwNjIyNWFkODMiLCJ2ZXJkaWN0RGlnZXN0IjoiMTczNTNlYTNhYzk3ZmY2MjI5ZmU2Njc1ZDZlOTgwOGFiM2Q1Y2VlNjFjZmZiMmIzMTQ4YTUyZjcyZWQzNzFlYSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI3NWM4YzdkMDZiNjU3Mzg2ZGIzZjUwNDEwZWQzMTk3ZDQ5ZmYzMmNkYzA2NjcyODhkNzA4MWZlZjQ4Njg5OTE3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA2NjYzODEyLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDc3I2lzc3VlY29tbWVudC02NDA2NjYzODEyIiwiYm9keURpZ2VzdCI6IjEzZTAyZmQ5NWMwMzZiNzY5NTYyMDYxYWVmOTk2OTU3ZjJhOWI5NWM4MWNkMTUwNDA5ZmI0NjY3OTM1ZjlmN2YifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1077-hidden-zigbee`, коммит `c57bbbb7ab02` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `635514faaacc44fd0511ad1fb3919cbfdc95e561`
  ```
  git log --all --format='%H %T' | grep 635514faaacc
  ```
- Тело issue: `7acc6defc089ae78efc516c83210873f5b5f2dd640543ab101b4e15a5bcc1b39`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40256640953,"run_attempt":1,"digest":"114ade88b1463b35ff4e3e44bd6b137548ae43757c329eb7564a6179172439a6"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MTIyLCJvdXRwdXRfdG9rZW5zIjozNTU4MSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxOTE2NjcsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjo4OTMyNDgyLCJjb3N0VXNkRXN0aW1hdGUiOjIuOTA5MjE4NH1dLCJ0dXJucyI6ODIsImR1cmF0aW9uTXMiOjY0NjU5NSwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjIuOTA5MjE4NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=122 output_tokens=35581 cache_creation_input_tokens=191667 cache_read_input_tokens=8932482 num_turns=82 -->
