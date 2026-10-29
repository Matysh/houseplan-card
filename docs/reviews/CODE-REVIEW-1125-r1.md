# CODE-REVIEW — issue #1125 (заход r1)

**Материал:** `61b0f22994394c7c8c58c78da1c57d4ae9d5036b` (дерево `9ea3e1517c4f3dbde2d289236315ebe119b20cc0`)
**База задачи:** `32cdf439a6cc03eb0f354c2eec63972a60b8d912` (принятая `#1120`)
**Трек:** show · **Этап:** code · **Цикл:** заход r1, блокирующих циклов 0/2

## Скоуп

Фикс гонки загрузки: стабильные entry-фасады (`houseplan-card.js`,
`houseplan-panel.js`) теперь ждут публичного определения `home-assistant` в
текущем custom-element registry, прежде чем импортировать любой eager
side-effect/implementation chunk в HA-документе. Цель — исправить
`Illegal constructor` у `HpDialog`, наблюдавшийся в реальном HA 2026.10.4
(холодный/повторный вход в настройки без модальной оболочки).

Изменённые файлы (ровно как в `changedFiles`): `scripts/bundle-manifest.mjs`,
`test/bundle-assets.test.mjs`, `scripts/mutation-registry.mjs`,
`scripts/monolith-baseline.json`, `scripts/ci-registry-inventory.json`,
`docs/release-ledger/v1.82.0/1125.json`, `docs/ARCHITECTURE.md`,
`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`. Класс изменения — B/C
(build-loader + generated inventories/baseline + документация), без правок
класса A/D, без схемы/API/конфига.

## Как проверялось

Static-first: `read:diff`, `read:log` (5 коммитов диапазона), контекст issue
(`review-context.json`, `sources-*.md`), хендофф автора, release-ledger
соседей `#1120/#1121/#1122` для сверки таксономии. Независимо прослежена
`waitForHaBootstrap` (scripts/bundle-manifest.mjs:484-515) и её встраивание в
обе фасадные замены (`entryFallbackPlugin`, строки ~563/596): барьер стоит
**до** `try{}`, то есть отказ готовности не создаёт запасной класс и не
проглатывается существующим `catch` для stale-импорта — это соответствует
АС3 («не скрывать ошибку retry/timeout», «не оставлять бесконечное ожидание»).
Документация (`docs/ARCHITECTURE.md`) словесно точно описывает оба ранних
`return` (нет `home-assistant` в документе / уже определён) и поведение по
таймауту (жёсткий отказ без fallback).

### Выполненные проверки (fixed-check runner)

| Check | Результат |
|---|---|
| `read:diff`, `read:log` | прочитано |
| `build:build` | PASS (45s) |
| `unit:test/bundle-assets.test.mjs` (до `build:build`) | 42/54 — 12 паданий, все `ENOENT dist/...` (нет собранного `dist/`), ни одно не относится к `#1125`-тестам (13–22 все `ok`) |
| `unit:test/bundle-assets.test.mjs` (после `build:build`) | **54/54 PASS**, включая все 10 новых `#1125`-тестов и 2 существующих мутационных якоря (`#486`, `#1018`) |
| `static:mutation-registry` | PASS |
| `static:bundle-budget` | PASS |
| `static:ci-registry-inventory` | PASS |
| `unit:test/monolith-metrics.test.mjs` | PASS (подтверждает `bundleBytes: 3715197` соответствует фактической сборке) |
| `unit:test/release-ledger.test.mjs` | PASS (схема записи `1125.json` валидна) |
| `unit:test/process-gate.test.mjs` | PASS |
| `unit:test/node-input-ledger.test.mjs` | PASS |
| `unit:test/ci-profiles.test.mjs` | PASS |

Первый прогон `unit:test/bundle-assets.test.mjs` без предварительного
`build:build` дал 12 паданий — ложная тревога окружения ревью (отсутствовал
`dist/`), не регрессия диффа; после `build:build` тот же файл — 54/54. Это
явно зафиксировано как методологическая деталь, а не находка.

### Переиспользованное доказательство (не повторялось)

- validate-gate `61b0f2299`: https://github.com/Matysh/houseplan-card/actions/runs/40890637671 — green, «review-light proof is complete».
- Real-HA негативный свидетель (причинная гонка на неизменённом `775`):
  https://github.com/Matysh/houseplan-card/actions/runs/40865674089 — 3 setup PASS /
  4 transfer FAIL, во всех 8 попытках один и тот же `HpDialog Illegal constructor`
  стек (`houseplan-card-CLY8lEFq.js:82:21053`).
- Real-HA позитивный свидетель (точный продуктовый коммит `fd95d11f7`, тот же
  companion): https://github.com/Matysh/houseplan-card/actions/runs/40872299778 —
  7/7 PASS (3 setup + 4 transfer), 0 skip/flaky/constructor-errors.
- Байтовое тождество рантайма/компилятора между `fd95d11f7` и `61b0f2299`
  (только ledger + 2 inventory-записи добавлены поверх) — подтверждено
  `static:ci-registry-inventory`/`unit:test/release-ledger.test.mjs` локально
  и описано в хендоффе с полными SHA256.
- Demo-смоки `smoke_esc_dialogs.mjs`, `smoke_dialog_footer_width.mjs`,
  `smoke_dialog_config_parity.mjs` — не перезапускались (Chromium не
  поднимался): тело issue (раздел «ТЗ») не называет конкретные smoke-файлы
  по имени (#696), а гейт на них уже зелёный в хендоффе на свежем рантайме
  `527fc27…`. Это «чего не проверял», не пробел: AC2 — обычная регрессия
  существующего диалога, не новый защитный путь без свидетеля.

### Не прогонялось и почему

- Полный real-HA e2e на финальном beta-кандидате — вне доступного oracle
  (нет настоящего HA окружения в ревью-раннере); сам автор и ТЗ фиксируют
  это как отдельный пререлизный гейт, не гейт этого ревью.
- `pytest tests_backend`, `npm run invariants` — в диффе нет Python и нет
  правок геометрии/её ссылок.
- Полные `gate:small`/ночные наборы — несоразмерны объёму задачи (один B/C
  loader-фикс), §8.
- Полные тексты коммитов (трейлеры `Issue:`/`User-Visible:` на каждом
  коммите) — недоступны через предоставленный набор checks (`read:log`
  отдаёт только oneline, `git show` не входит в оракул). Проверено по
  задаче в целом: `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` оба правлены
  в итоговом task-patch, что покрывает материальное требование
  `User-Visible: yes`; co-location трейлера в одном конкретном коммите не
  подтверждена напрямую — честно фиксирую как границу проверки, не как
  находку (нет основания подозревать нарушение).

## Независимый разбор кода

`waitForHaBootstrap(timeoutMs = 30000)`:
1. Нет `<home-assistant>` в документе → немедленный возврат (не-HA/demo
   документ сохраняет прежний immediate-путь).
2. `customElements.get('home-assistant')` уже определён → немедленный
   возврат (прогретый HA не ждёт).
3. Иначе — `Promise.race(whenDefined, timeout)` с `finally{clearTimeout}`;
   таймаут по умолчанию 30000 мс, отклоняет с именованной ошибкой.
4. После успешного `whenDefined` — повторная проверка `customElements.get(...)`
   текущего (возможно подменённого) реестра: если корень не найден —
   жёсткий отказ («no current root definition»). Это защищает от ситуации,
   когда `whenDefined` вернулся по прокси устаревшего shim, а не по
   актуальному реестру — именно то, что вызывало исходный дефект.

Функция сериализуется (`toString()`) и инлайнится как IIFE **перед** `try{}`
в обоих фасадах — значит отказ (таймаут/нет реестра/нет корня) не
перехватывается существующим `catch`, не создаёт fallback-класс и не
логируется как «stale import» (проверено тестом
`#1125 emitted ... readiness timeout cannot create a stale fallback`, в
котором `console.error` намеренно падает при любом вызове). При успешном
ожидании поведение неизменно: eager-ассеты и implementation-чанк
импортируются как раньше, существующий stale-fallback для отсутствующего
чанка срабатывает **после** барьера (тест на `missingMain: true`).
`scripts/mutation-registry.mjs` обновляет только литеральные якоря трёх уже
существующих мутантов (`#535 AC1/AC2`) под новый текст строки — сам
мутируемый смысл (что заменяется на что) не ослаблен, прогон
`static:mutation-registry` подтверждает это статически.

Дефектов в реализации, тестах или инвариантах не найдено. Остаточный риск
(повторная подмена `customElements` между проверкой корня и фактическим
`define` компонентов House Plan) признан и явно описан автором как
осознанный trade-off, эмпирически подтверждённый 8 прогонами real-HA без
flakiness — не считаю это находкой этого ревью.

## Находки

### Medium — release-ledger классифицирует пользовательский багфикс как `infra`

`docs/release-ledger/v1.82.0/1125.json` содержит `"category": "infra"` с
обоснованием «infrastructure bootstrapping repair… no class A/D changes».
Таблица категорий (`PROCESS.md` §11.9, строки 2494-2499) определяет:

- `infra` — «Инфраструктура/документация, **без изменения поведения
  продукта**» → milestone релиза: нет.
- `stable-fix` — «Багфикс/полировка поведения, уже существовавшего в
  предыдущем stable» → milestone релиза: да.

Эта задача меняет именно наблюдаемое поведение продукта: до фикса настоящий
HA открывал настройки без модальной оболочки (`Illegal constructor`,
подтверждено real-HA-прогоном `40865674089`), после — рабочий модальный
диалог (`40872299778`). Сам diff это подтверждает: `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md` формулируют ровно поведенческое исправление
(«preventing a rare missing modal shell on cold entry» / «диалог больше не
теряет модальную оболочку»). Для сравнения, соседние задачи `#1121`/`#1122`
корректно помечены `infra`, потому что их rationale явно говорит
«Product source styles and accepted UI remain unchanged» — здесь обратное:
поведение, которое видел пользователь, было сломано и теперь исправлено, то
есть ровно определение `stable-fix` («Багфикс… поведения, уже
существовавшего в предыдущем stable»). Класс изменения B/C (где лежит код
фикса — build loader) — отдельная ось («Скрипт не выводит категорию из
типа коммита или метки: это суждение агента о пользовательской разнице»,
§11.9) и не оправдывает `infra`.

**Последствие:** при текущей классификации пайплайн не назначит milestone
релиза этой задаче и не включит её в абзац пользовательских исправлений
стабильного changelog (§11.9: «Milestone релиза получают только
major/stable-fix»), хотя разработчики уже сами описали её как пользовательский
фикс в Unreleased-changelog. Конечные пользователи текущего stable
(v1.82.0), у которых проявляется этот дефект, не получат этот фикс в
официальных release notes следующего stable.

**Воспроизведение:** открыть `docs/release-ledger/v1.82.0/1125.json`,
сравнить поле `category` с `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` того
же диффа и с таксономией `PROCESS.md` §11.9 (строки 2494-2499).

**Исправление:** сменить `category` на `"stable-fix"` и переписать
`rationale`, отражая, что фикс восстанавливает ранее сломанное в stable
поведение диалога, а не только описывает build-механизм.

Находка в скоупе issue (сам файл — часть `changedFiles`). Повторный issue не
заводится.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 — причина установлена, real-HA воспроизводит дефект до фикса и чинит после | Real-HA `40872299778`, точный коммит `fd95d11f7`, 7/7 PASS, 0 flaky/constructor-errors (зарегистрированный свидетель, исполнен) | Real-HA `40865674089`, тот же неизменённый `775`, 3 setup PASS / **4 transfer FAIL**, идентичный стек `HpDialog Illegal constructor` во всех 8 попытках (зарегистрированный свидетель, исполнен, FAIL) |
| AC3 (защ.) — отказ готовности HA не создаёт fallback-класс и не маскируется под stale-import | `unit:test/bundle-assets.test.mjs` → `#1125 emitted {entry}.js readiness timeout cannot create a stale fallback` (card и panel), исполнено мной лично: 54/54 PASS | Тот же тест — ordinary negative-input case на неизменённой реализации: never-resolving `whenDefined`, фальшивый `setTimeout` с триггером таймаута, `define`/`console.error` обёрнуты в `assert.fail`; исполнен мной, подтверждает отказ с точным сообщением `/did not complete within 30000 ms/` |
| AC3 (защ.) — отсутствующий реестр / отклонённая готовность / «чужой» текущий корень падают закрыто | `#1125 missing registry, rejected readiness and an unowned current root fail closed`, исполнено мной: PASS | Тот же тест, 3 ordinary negative-input сценария (`customElements` отсутствует / `whenDefined` reject / resolve прокси без `get` на текущем реестре) — все три исполнены мной, все три `assert.rejects` сработали |
| AC2 — footer/header/focus/Escape/dirty/slots/data-hp не регрессируют | demo-смоки (esc_dialogs, dialog_footer_width, dialog_config_parity) — PASS по хендоффу на свежем `527fc27…` | не перезапускалось (см. «Не прогонялось»); обычная регрессия существующего диалога, не новый защитный путь |

Пустых третьих столбцов нет.

## Что проверено и корректно

- Барьер готовности размещён вне `try/catch`, не глотает ошибку и не создаёт
  запасной класс при таймауте — соответствует АС2/АС3.
- Иммедиат-путь для не-HA документов и уже прогретого HA сохранён (два
  ранних `return`).
- Повторная проверка владения `home-assistant` текущим реестром после
  `whenDefined` закрывает именно тот сценарий гонки, который вызвал
  исходный баг.
- `docs/ARCHITECTURE.md` точно и без расхождений описывает реализованное
  поведение.
- `scripts/monolith-baseline.json` (+2089 B) подтверждён исполнением
  `unit:test/monolith-metrics.test.mjs` и `static:bundle-budget` — не
  голословная цифра.
- `scripts/ci-registry-inventory.json` — две канонические добавления пути
  ledger-файла, подтверждено `static:ci-registry-inventory`.
- `scripts/mutation-registry.mjs` — только обновление литеральных якорей
  существующих мутантов под новый текст строки; смысл мутации не ослаблен.
- User-Visible-правка: оба CHANGELOG (ru/en) присутствуют в итоговом диффе
  с согласованной формулировкой; числовых величин, показанных пользователю
  дважды с разным источником, в диффе нет.

## Чего не проверял

- Полный real-HA прогон на финальном beta-кандидате (пререлизный гейт, не
  этого ревью).
- Co-location трейлеров `Issue:`/`User-Visible:` на уровне отдельного
  коммита (инструмент ревью не даёт полного текста коммитов, только
  oneline); материальное требование (changelog в task-patch) проверено.
- Demo-смоки диалога не перезапускались — переиспользовано зелёное
  доказательство хендоффа, т.к. тело issue не называет smoke-файлы (#696) и
  AC2 — обычная регрессия без нового защитного пути.

## Вердикт

**Жёлтый.** High: 0, Medium: 1 (в скоупе — неверная категория
release-ledger, см. находку выше). Маршрут: `fix` (критерии §5 проходятся:
сложность и риск ограничены одним build-loader примитивом, одна
поверхность, нет миграции/конфига, нет нового UX-контракта, нет влияния на
perf/touch, ожидаемое поведение зафиксировано в самом теле issue и теперь в
`docs/ARCHITECTURE.md`). Побочных находок нет; `outside_findings` пуст.

Публикация выполняется доверенным publisher после валидного audit/seal;
маршрут побочных находок — `mode=issues` (сверено с
`REVIEW_FINDINGS_POLICY`), но для этого раунда он не используется, так как
единственная находка — в скоупе задачи.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjFhNDg1NDc4MjA0NTY3MjY3OTRlNDAxYzNlNmRjOTFkNTE5NDE3OTFhYTQ4YzlmM2FhZWEwYzliYzcwM2M1MWQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwOGVjMjE3ZmE3ZGEwNzJhY2ExYzYxZDlhZTdmMmZkNGQ1OGM2ZWNkZjZjNjZkZjk1YWE4YzM3MjcyOWQ3ZDNkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTI1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI2MWIwZjIyOTk0Mzk0YzdjOGM1OGM3OGRhMWM1N2Q0YWU5ZDUwMzZiIiwidHJlZSI6IjllYTNlMTUxN2M0ZjNkYmRlMmQyODkyMzYzMTVlYmUxMTliMjBjYzAiLCJib2R5RGlnZXN0IjoiZmM4ODMzMTAzYTIzOTY1YzAwNTg2MDMzYzJmNWJiYjU1MjM0MjE0NjcxZjZmMmNkYzdhYmEwNmJiZDcxZWYwZiIsInByb2R1Y2VyUnVuIjoiNDA4OTE4MTE2MTkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjFkNjE2Yjc1Nzc5ZmM3ODhiMGVmM2E4YjQ5NmM4YmYyZmMzOGYwYTM4OWRmYmZlOTBjZTk2ZDg3M2M3MTRmN2QiLCJ2ZXJkaWN0RGlnZXN0IjoiZGVmZjc4OGFkZmExNjUyNzdmNzNkOTMxOWUwZTUyOGQ3OGRjZTUzMWEzODJlZTBlZWQ4NGFmMmQ0NmM0MWQ5YiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzNTA0YTYyZmJiZTE2ODlhZWQyNmUyYzEwNTJjZGNiYmVjNjA2MDc3ZWM2NGM4YmMyZmQ3NjFhZWJiNmY4ZTM0IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDk5NzM0ODEyLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTI1I2lzc3VlY29tbWVudC02NDk5NzM0ODEyIiwiYm9keURpZ2VzdCI6IjJlMzc4OTE5MzJhYTBjOTcyN2E3NTAzZjk3Zjk1MmQ2MjcxZjM1MGZmYmNjZGE5NTI4MDY2ZTRiMDc0MTI5YjUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1125-ha-bootstrap-order`, коммит `61b0f2299439` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9ea3e1517c4f3dbde2d289236315ebe119b20cc0`
  ```
  git log --all --format='%H %T' | grep 9ea3e1517c4f
  ```
- Тело issue: `fc8833103a23965c00586033c2f5bbb55234214671f6f2cdc7aba06bbd71ef0f`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTAsIm91dHB1dF90b2tlbnMiOjM5Mzk3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNzk4MiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjIwODk5ODAsImNvc3RVc2RFc3RpbWF0ZSI6MS4zNjM5OTR9XSwidHVybnMiOjQxLCJkdXJhdGlvbk1zIjo1ODMxNDgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjM2Mzk5NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=50 output_tokens=39397 cache_creation_input_tokens=137982 cache_read_input_tokens=2089980 num_turns=41 -->
