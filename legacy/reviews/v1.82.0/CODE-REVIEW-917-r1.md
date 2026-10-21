# CODE-REVIEW-917-r1

Issue: #917 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов 0/2
Материал: `60eaa5500a7c8ce451821456adc895f7b819b2cc` (две коммиты, `origin/dev..HEAD`)

## Скоуп

Инфраструктурная задача (класс B/C, без `src/**`): чинит пять свидетелей,
сбежавших/не давших вердикт в ночном мутационном прогоне `38853768073`
(2026-10-16), открывает учётный цикл 1.82 к milestone #7 после релиза
v1.81.0 и, с явным разрешением владельца в комментарии (см. «Что проверено»),
добавляет узкую read-only проверку опубликованных метаданных предыдущего
stable относительно его собственного исторического каталога — без изменения
строгого HEAD-bound пути новой публикации.

Изменённые файлы: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/release-ledger/cycle.json`,
`docs/release-ledger/v1.81.0/917.json`,
`docs/testing-notes/mutation-browser-guards.md`,
`scripts/mutation-registry.mjs`, `scripts/release-contract.mjs`,
`test/live-editor.test.mjs`, `test/mutation-gate.test.mjs`,
`test/release-contract.test.mjs`, `test/wall-thickness-selection.test.mjs`.
Продуктовый код (`src/**`) и bundle не затронуты.

Какую строку `docs/SCOPE.md` обслуживает: прямо никакую (чистая
инфраструктура тестирования и релизного учёта), что и отражено
классификацией `infra` в `docs/release-ledger/v1.81.0/917.json` — без
пользовательского changelog/milestone, корректно по `docs/DEVELOPMENT.md`
(раздел про `docs/release-ledger`).

## Как проверялось

Дешёвые гейты на этом SHA подтверждены ранее зелёным Validate
(https://github.com/Matysh/houseplan-card/actions/runs/38882389695) —
`npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy не
перегонялись повторно. Дополнительно в этом раунде прогнано:

| Гейт | Команда | Результат |
|---|---|---|
| typecheck тестовой сборки | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` | PASS, без ошибок |
| целевые unit-наборы (ordinary run, без мутации) | `node --test test/live-editor.test.mjs test/wall-thickness-selection.test.mjs test/mutation-gate.test.mjs test/release-contract.test.mjs` | PASS 124/124, 0 fail, 0 skipped |
| статическая готовность реестра мутаций | `node scripts/mutation-gate.mjs --check` | PASS; `browser guards: 376/200` (ожидаемо, см. ниже); 5 WARN — все про ID вне диффа (#650), не регрессия |
| выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — браузерные смоки этим диффом не выбираются, нечего прогонять |
| whitespace/diff hygiene | `git diff origin/dev...HEAD --check` | чисто |
| реальный тег предыдущего stable в окружении ревьюера | `git tag --merged HEAD -l v1.81.0` | тег присутствует и достижим — новая ветка `verifyPublishedStable` в этом окружении действительно упирается в реальные данные, а не только в изолированную фикстуру теста |

Что НЕ проверялось и почему: `npm run invariants` — в диффе нет геометрии
и ссылок на неё; `pytest tests_backend`/HA harness — Python не тронут;
performance-гейт — не назван в AC и не затронут; golden — рендер карточки
не тронут, `ci:golden` не требуется; браузерные smoke (Chromium) — AC не
называет smoke, `smoke-select` явно говорит «нечего выбирать» (нет
`src/**` диффа). Мутации НЕ исполнялись ни разу — это запрещено вне
ночного workflow; «чем краснеет» по каждому AC разобрано чтением кода и
сверено с таблицей автора в хендоффе (ниже).

## Разбор AC

**AC1** (обычные unit + неизменённый browser smoke kiosk; gesture-entry и
retained-dialog через реальных consumers). Проверено чтением и
исполнением:
- `test/live-editor.test.mjs` новый тест вызывает реальный
  `routeHouseplanEditorUpdate` из `src/live-editor.ts:119-141` для
  `_decorDraft`/`_dtDrag` с `oldValue` null/undefined — это именно та
  ветка (строки 129-135), которую патч мутанта
  `live-editor-first-gesture-frame-goes-live` убирает
  (`scripts/mutation-registry.mjs:13436-13443`). Удаление ветки сделало бы
  первый кадр жеста «живым» (`scheduleHouseplanEditor`, `frames.size`
  стало бы 1, возврат `true`) — тест бы упал на `assert.equal(..., false)`
  и на `frames.size === 0`. Чем краснеет: обычный негативный случай внутри
  теста, id `live-editor-first-gesture-frame-goes-live` зарегистрирован,
  **не исполнялся**.
- `test/wall-thickness-selection.test.mjs` новый тест вызывает реальный
  `HouseplanEditorRuntime.prototype._renderWallThickUi`
  (`src/houseplan-editor-runtime.ts:5455-5473`) с сохранённым валидным
  `_wallDialog`/кэшем и чужим `_tool`. Мутация
  `wall-selection-ignores-tool-boundary` убирает `this.host._tool ===
  'wallthick'` из условия — тогда ветка бы выполнилась и
  `wallThickSelectionCache` не обнулился бы, что уронило бы
  `assert.equal(receiver.wallThickSelectionCache, null, ...)`. id
  зарегистрирован, **не исполнялся**.
- Два оставшихся browser-свидетеля wall-selection
  (`wall-selection-hidden-with-dialog`, `wall-selection-not-live-owned`)
  не тронуты и по-прежнему используют
  `compiledNodeSmoke('smoke_wallthick_standalone')` — заявление «paint
  остаётся покрытым» подтверждено чтением реестра.
- `node demo/smoke_kiosk_cycle_context.mjs` (ordinary, по хендоффу автора
  PASS 08:40:31) не менялся.

**AC2** (пять ID сохранены; два preparation-патча типобезопасны;
stale-door учитывает обе защиты; wall-tool — прямой renderer unit; caught
только ночью/с разрешением владельца). Проверено чтением:
- `error-details-json-branch-cut`: замена литерала `{space:null,
  fields:null}` на `JSON.parse('{}')` сохраняет исходный тип `any`
  вместо `{space: null; fields: null}` — та же типизация, что и
  немутированный `JSON.parse(raw)` (`src/houseplan-card.ts:9538-9540`).
  Guard — `node --test test/open-passage-contract.test.mjs`;
  `guardNeedsTestBuild()` (`scripts/mutation-preparation.mjs:3-5`)
  распознаёт его как требующий `tsc`-сборки мутированного дерева
  (паттерн `node --test` без `tsconfig.test.json` в строке) — то есть
  компиляция действительно встроена в guard pipeline, и «ошибка
  подготовки» из отчёта о ночном прогоне правдоподобна этим механизмом.
- `layout-full-read-drops-real-overlap-rearm`: guard дословно содержит
  `npx tsc -p tsconfig.test.json && …` — компиляция явно часть guard.
  `if (Boolean(false) && repeatLayoutRead)` рантайм-эквивалентен `if
  (false && repeatLayoutRead)`, но не является статическим
  compile-time-constant для TS, поэтому не создаёт тот же путь отказа
  компиляции, что и прежде.
- `kiosk-space-change-retains-old-door`: второй патч
  (`if (before && this._openingInfoSpace !== this._space) return;`,
  вставлен сразу после `const before = this._openingInfo;` в
  `_syncOpeningInfo`, `src/houseplan-card.ts:12582-12591`) обходит
  вторую защиту (#894: `willUpdate` → `_syncOpeningInfo` переоценивает
  `currentOpeningContext` относительно `this._curSpaceCfg` нового этажа
  и обнуляет устаревший `_openingInfo`/`_openingInfoSpace`). Первый патч
  убирает немедленную очистку в `_commitSpace`
  (`src/houseplan-card.ts:1487`). Вместе оба патча действительно снимают
  обе независимые защиты, не удаляя их из продукта — соответствует
  заявлению автора.
- `wall-selection-ignores-tool-boundary`: см. AC1.
- Все пять ID подтверждены не исполнявшимися — таблица автора в хендоффе
  (комментарий от 09:42) прямо называет три ID «сохранены и не
  исполнялись; caught не заявляется» и два ID «зарегистрированы, не
  исполнялись» — это ровно формат, который требует общая политика.
- `node scripts/mutation-gate.mjs --check` — PASS (см. таблицу выше),
  это статическая готовность, не caught; воспринимается именно так в
  документе, не подменяется.

**AC3** (gate:small/process-gate проходят; bundle/бюджеты/полный ночной
охват неизменны; infra без milestone/changelog; цикл 1.82 → milestone
#7). Проверено чтением и частично исполнением:
- Классификация `docs/release-ledger/v1.81.0/917.json`: `category:
  "infra"`, `rationale` заполнен, схема валидна по
  `scripts/release-ledger.mjs:26-37` (infra не требует `summary`).
- `docs/release-ledger/cycle.json`: `baseStable: v1.81.0, targetStable:
  v1.82.0, milestone: {7, "1.82"}` — сверено напрямую с GitHub API
  (`gh api repos/Matysh/houseplan-card/milestones/7`): milestone #7
  существует, title `"1.82"`, state `open` — совпадает дословно.
- Коммиты несут `Issue: #917` и `User-Visible: no` — корректно, видимых
  изменений нет, changelog не трогается (и не должен).
- `scripts/release-contract.mjs`: `verifyPublishedStable` несовместим с
  `requireStable` (explicit throw), не выставлен в CLI
  (`invokedDirectly`-блок принимает только `--stable`/`--repo=`), ветка
  исполняется только когда `narrative && verifyPublishedStable &&
  !parsed.prerelease` — то есть путь новой стабильной публикации
  (`requireStable: true`, без `verifyPublishedStable`) полностью
  не изменился (`candidate` остаётся `'HEAD'`). Это подтверждено и
  исполнением: ordinary run 124/124 PASS включает тесты на отказ при
  попытке совместить оба флага (`/cannot authorize stable publication/`),
  на недостижимый/чужой тег (`merge-base --is-ancestor` бросает), на
  переписанные notes (`/immutable tag/`) и на рассинхронизированные
  версии источников (`/not synchronized/`).
- Дополнение AC3 (разрешение владельца): подтверждено текстом комментария
  владельца в issue («Да» на блокирующий вопрос) и явной ссылкой автора
  на этот комментарий в хендоффе.

## Одно число — один источник (§8)

Единственная пользователь-видимая метрика в диффе —
`docs/STATUS.md`: `Node unit 4620 → 4624`. Источник один —
`node scripts/status-snapshot.mjs`, перегенерированный автоматически;
прирост (+4) соответствует ровно четырём новым top-level `test(...)` в
диффе (`live-editor.test.mjs` +1, `mutation-gate.test.mjs` +2,
`wall-thickness-selection.test.mjs` +1); вложенные `t.test(...)` в
`release-contract.test.mjs` не считаются отдельно инвентарём — не
расхождение. `mutation-browser-guards.md`: `377/200 → 376/200` и
`81 → 80` в строке «Pointer geometry…» — единственный источник тоже один
(переместившийся `wall-selection-ignores-tool-boundary` ушёл из
browser-инвентаря в Node-unit), дважды нигде не показано иначе.

## Находки

Находок нет. High: 0. Medium: 0.

## Что проверено и корректно

- Все пять определений реестра мутаций указывают на существующие guard-файлы;
  патчи применяются к уникальным, существующим в `src/**` строкам (проверено
  `grep` по каждому `find`).
- Новые unit-тесты вызывают реальные экспортируемые функции продукта
  (`routeHouseplanEditorUpdate`, `HouseplanEditorRuntime.prototype._renderWallThickUi`),
  а не копии/моки — ревью проверило построчно, что убираемая мутацией ветка
  действительно является той, которую тест проверяет.
- `docs/testing-notes/mutation-browser-guards.md` корректно отражает перенос
  свидетеля из browser-инвентаря в Node unit, с новым объяснением независимости
  от toolbar cleanup.
- Классификация release-ledger (`infra`, без milestone/changelog) соответствует
  `docs/DEVELOPMENT.md` и не создаёт пользовательского changelog-требования;
  `User-Visible: no` на обоих коммитах корректен.
- `verifyPublishedStable` — узкая, явно огороженная от строгого пути новой
  публикации опция; не достижима из CLI; её добавление не ослабляет ни один
  существующий гейт (подтверждено исполнением полного таргетного набора и
  логикой early-throw при `requireStable`).
- Трейлеры `Issue:`/`User-Visible:` присутствуют на обоих некоммитах класса
  B; `git diff --check` чист.
- Milestone #7 / «1.82» сверен напрямую с GitHub, а не только с
  утверждением автора.

## Чего не проверял

- Полный ночной мутационный прогон (caught-статус пяти ID) — вне доступа
  ревью по общей политике; доказательство оставлено как «зарегистрирован,
  не исполнялся», что соответствует требованиям.
- `npx tsc --noEmit` на основном (не тестовом) `tsconfig` и `npm run build`
  с полной сверкой бандла — не перегонялись повторно, т.к. Validate на этом
  точном SHA уже зелёный (ссылка в задаче) и диапазон коммитов не трогает
  `src/**`/бандл.
- Браузерные smoke (Chromium) и golden — не выбраны `smoke-select` (нет
  frontend-диффа) и не затронуты (ci:golden не требуется).
- Python/HA harness — не затронут, pytest не запускался.
- Фактическое выполнение владельцем разового разрешения на прогон пяти ID
  в ночном workflow — вне материала этого ревью; это будущий шаг.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/917-mutation-witnesses`, коммит `60eaa5500a7c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `044c57b81714b16cccc3ad972c369b70d2b57d78`
  ```
  git log --all --format='%H %T' | grep 044c57b81714
  ```
- Тело issue: `74257bbfbc947b8375c95dd4f98554363add6576a5bc956e71c10859f79df9fa`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4ODcsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTc3fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMzQsIm91dHB1dF90b2tlbnMiOjQwOTE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0NjEyNCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjY2ODUzNjEsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zMzA5ODYyfV0sInR1cm5zIjo3NywiZHVyYXRpb25NcyI6NjMxMzM0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi4zMzU5NjMxOTk5OTk5OTk3LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5021 output_tokens=40933 cache_creation_input_tokens=146124 cache_read_input_tokens=6685361 num_turns=77 -->
