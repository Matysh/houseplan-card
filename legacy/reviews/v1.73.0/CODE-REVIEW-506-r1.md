# CODE-REVIEW-506-r1

Issue: [#506](https://github.com/Matysh/houseplan-card/issues/506) — «v1.73.0: лишние перерисовки при запуске плана блокируют Full Performance».
Этап: код-ревью (PROCESS.md §2.7). Заход: r1. Блокирующих циклов израсходовано 0 из 4.
Материал ревью: диапазон `origin/dev..HEAD`, вершина `9d6ac98d3a4256ec550962028d65813604d0f130`
(«fix: attach a warm summary runtime before the first render (#506)»). Ветка `issue/506-startup-performance`.
ТЗ: `docs/specs/506-startup-performance.md`, ревью ТЗ зелёное на `e17cdb51` (`docs/reviews/SPEC-REVIEW-506-r1.md`, вердикт: зелёный, High 0).

## Скоуп

Diff (59 файлов) — по существу три группы:

1. **Продукт (класс A):** `src/summary-runtime-loader.ts` (новый, 143 строки) + 8 строк в `src/houseplan-card.ts` (подключение `SummaryRuntimeSlot`/`summaryRuntimeLoader` в `connectedCallback`/`disconnectedCallback`, замена прежнего `import().then()`).
2. **Гейты/инструменты (класс B):** `test/summary-runtime-loader.test.mjs` (новый), `demo/smoke_summary_warm_attach.mjs` (новый), `demo/smoke_summary_panel.mjs` (readiness-условие витринного смока), `scripts/mutation-gate.mjs` (+1 мутант), `scripts/bundle-budget.mjs` (перецентровка потолка), `tsconfig.test.json` (+1 файл в include).
3. **Документация (класс C) и сгенерированное (класс D):** `docs/ARCHITECTURE.md`, оба `CHANGELOG*`, `docs/images/screenshots.json` (только fingerprint, см. ниже), `dist/**`, `custom_components/houseplan/frontend/**` (бандл-промоушен), плюс класс-D спецификация/ревью ТЗ, уже принятые предыдущим этапом.

Соответствует ТЗ §3 (объём задачи): загрузчик/фабрика runtime, устранение позднего header roundtrip, независимость карточек, узкие unit/browser/mutation проверки, неизменные performance-пары. Не задето: #500, дизайн/опции панели, backend, геометрия света, continuity/camera — подтверждено чтением диффа, посторонних файлов нет.

Коммит один (`9d6ac98d`), трейлеры `Issue: #506` / `User-Visible: yes` на месте (`git show -s --format=full`), оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом же коммите — требование §2.6/№10 выполнено.

## Как проверялось

Свежая сессия без контекста реализации; вердикт состязательный, не пересказ хендоффа автора.

### Что уже было зелёным на этом SHA (проверено, не повторялось)

Validate `9d6ac98d`: https://github.com/Matysh/houseplan-card/actions/runs/34343078025 — success. Я прочитал состав этого прогона по логам и джобам, а не принял «success» на слово:

| Джоб | Вывод |
|---|---|
| Предполётные (докс/провенанс/process-gate) | success |
| Фронтенд: типы, юниты, мутанты, синхрон бандла | success — значит `tsc --noEmit`, `npm test`, `npm run build` + сверка копий на этом SHA уже зелёные |
| Мутанты по диффу (3 шарда) | success — CI уже прогнал «затронутые» мутанты, включая новый |
| Переиспользование (reuse) | success, но по логу — cache miss на всех четырёх маркерах (`smoke`/`golden`/`performance_smoke`/`backend`): реального переиспользования не было |
| Перф-смок, Смоки в браузере, Golden, Бэкенд pytest | **skipped** |

Важная находка по механике, не по коду: событие — `push` в ветку `issue/506-startup-performance` (не PR, без трейлера `Release:`), поэтому `scripts/classify-changes.mjs --heavy` вернул `heavy=false`, и тяжёлые джобы (перф-смок, полная браузерная матрица, golden, backend) в этом прогоне **не выполнялись вовсе** — это штатное поведение (validate.yml условие `if: needs.changes.outputs.heavy == 'true'`, PROCESS.md §8: «тяжёлые job только на PR/кандидате/по кнопке»), а не пропуск дефекта. Значит фраза «Validate зелёный» покрывает дешёвые гейты и уже прогнанные по диффу мутанты, но **не** перф-смок и не общую браузерную матрицу — эти два я закрыл сам ниже.

### Что прогнал сам на `9d6ac98d`

| Гейт | Команда | Результат |
|---|---|---|
| Applicability нового мутанта | `node scripts/mutation-gate.mjs --check --id=summary-runtime-attaches-after-first-render` | `ok` |
| **Негативный свидетель мутанта** | `node scripts/mutation-gate.mjs --id=summary-runtime-attaches-after-first-render` | чистый прогон зелёный, «summary-runtime-attaches-after-first-render: тест покраснел, как обязан» → «поймано 1 из 1» (независимо от заявления автора и от джобы `changed_mutants` в CI) |
| `npx tsc -p tsconfig.test.json` | — | 0 ошибок |
| `npm run build && npm run bundle:sync` | — | сборка ok; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичны; `git status` после сборки чист (третья копия `demo/srv/assets` тоже совпала побайтно) |
| `node --test test/summary-runtime-loader.test.mjs` (после `fix-test-build.mjs`) | — | 5/5 pass (AC1–AC3: разные instance у разных host; общий pending import без общего instance; отменённая попытка не доходит до host, реконнект подключает один раз; провал импорта не кешируется, следующий attach повторяет; `reset()`) |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | — | «Новых any нет» (147 новых строк в 2 файлах) |
| `node scripts/bundle-budget.mjs` | — | initial View 298 891 Б при потолке 299 600±2000 — совпадает с заявленным в коммите |
| `demo/smoke_summary_warm_attach.mjs` (новый, AC4/AC5/AC6) | — | все 17 проверок `true`, включая позитивного свидетеля реального resize |
| `demo/smoke_summary_panel.mjs`, `demo/smoke_summary_panel_polish.mjs` (зарегистрированная связь по `smoke-select`) | — | OK |
| `demo/smoke_warm_remount.mjs`, `demo/smoke_visual_continuity.mjs`, `demo/smoke_isometric_contract.mjs` | — | OK (перепроверены независимо от хендоффа автора) |
| 4 смока с «прямым совпадением» по диффу, которых автор не прогонял: `smoke_danger_confirm_branches`, `smoke_dialog_modal_recovery`, `smoke_space_card_bg`, `smoke_sun_live_bg` (вывод `smoke-select.mjs`, символы `connectedCallback`/`disconnectedCallback`/`_dayCycleTimer`) | — | все 4 OK. Прочитал каждый файл: совпадение — по обобщённым именам методов жизненного цикла, изменённые строки диффа с их предметной областью (диалоги, фон space-карточки, Sun-фон) не связаны; прогнал их не по необходимости уже доказанного риска, а чтобы не оставлять непроверенный «прямой» вывод инструмента без решения |
| **Перф-смок (пропущенный CI на этом SHA), 3 профиля** | `npm run benchmark:glow -- --profile=large-house-glow-overlay-v1 --variants=60 --samples=3 --warmups=1` + `compare --budgets=demo/performance/budgets-glow-smoke.json`; то же для `large-space-card-glow-v1`; `npm run benchmark:large-house -- --profile=large-house-interaction-v1 --samples=3 --warmups=1` + `compare --budgets=demo/performance/budgets-interaction-smoke.json` (профиль включён `classify-changes.mjs` из-за правки `houseplan-card.ts`) | **Все абсолютные потолки пройдены**: overlay `longTask.countP95` 1/12, `stateUpdate60Ms.median` 294/2200 мс; space-glow аналогично; interaction-v1 `longTask.countP95` 15/30, `maxSingleMs` 1156/3000 мс, `switchCycleMs.median` 2065/7000 мс — везде запас, ни один показатель не у потолка |

Это именно тот класс проверки, которого не хватало: перф-смок — быстрый (без парного sameRunner-сравнения) абсолютный потолок, который по PROCESS.md §8 «ловит регрессию в разы ещё в ревью» (пример #160). Он не выполнялся в CI на этом SHA (обычный push), и я закрыл этот пробел сам, а не принял отсутствие данных.

### Защитный AC — таблица «чем краснеет» (правило #435)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (синхронный fresh runtime на прогретой фабрике) | `test/summary-runtime-loader.test.mjs` тест «AC1», `demo/smoke_summary_warm_attach.mjs` (`warmReplacementRuntimeBeforeFirstRender`, `coldKeyRuntimeBeforeFirstRender`) | мутант `summary-runtime-attaches-after-first-render` (снимает синхронный fast path целиком) — прогнан лично, «поймано 1 из 1» |
| AC4/AC5 (нет позднего header/refit-каскада на прогретой странице) | `demo/smoke_summary_warm_attach.mjs` (`warmReplacementHeaderStableFromFirstFrame`, `warmReplacementNoStageResize`, `firstTickSingleRender`, `firstTickNoStageResize`) | тот же мутант — тот же смок как guard в `mutation-gate.mjs`, лично воспроизведено красным |
| AC2 (нет дублирующего instance/connect при cold-race и отмене) | unit-тесты «AC2» (3 сценария) | для чистых юнитов правилом допускается прогон со снятой защитой в документе, а не обязательный мутант — прочитан код: без гарда `live`/`if (this.runtime) return` в `adopt()` тест «cancelled attachment» и «concurrent cold mounts» упадёт по построению (двойной push в `seen`/срабатывание отменённого коллбэка) |
| AC6 (реальный resize по-прежнему открывает continuity) | `demo/smoke_summary_warm_attach.mjs` (`realResizeOpensStageResize`, `realResizeStageFollows`) — позитивный свидетель | не защитный AC в обратную сторону (расположение/поведение, не отказ), отдельного мутанта не требует — п. #435 «не защищающие» |

## Находки

Блокирующих (High) нет. Medium в скоупе и вне скоупа не найдено.

Один пункт зафиксирован явно, но не как находка — как унаследованный по ТЗ, преднамеренно отложенный риск:

**Not-a-finding: официальный парный Full Performance (7 образцов+1 прогрев, `performance.yml`, база `fff171c7`/эквивалент v1.72.0) не прогнан на `9d6ac98d`.** Автор прогнал только локальный приближённый прогон (сэндбокс, `--samples=3/2 --warmups=1`, CPU×4) и прямо пишет: для isometric «предел ×1.2 по count всё ещё может не проходить» — не заявляет «verified», а честно признаёт неопределённость. Это ровно тот сценарий, который ТЗ §7 предусмотрело заранее: «если гипотеза не закрывает isometric — stable остаётся заблокирован, результаты фиксируются в issue, бюджеты не ослабляются» — риск закрывается не этим код-ревью, а гейтом стабильного релиза (PROCESS.md §8: «Гейт стабильного релиза: полный локальный прогон плюс Validate и Full Performance зелёные на точном SHA»), который идёт **после** S8/беты. Дешёвый суррогат этого же класса регрессии (перф-смок, три профиля) я прогнал сам выше и он зелёный с запасом — по нему катастрофического отката нет. Не понижаю вердикт: это не пропуск, а корректно спроектированная отложенная проверка, зафиксированная тут, чтобы не превратиться в молчаливое доверие при подготовке стабильного релиза.

## Что проверено и корректно

- **Контракт владения (ТЗ §4.1).** `SummaryRuntimeLoader` кеширует только фабрику (`factory`/`pending`), `SummaryRuntimeSlot` держит `runtime` per-host. `LoadedSummaryPanelRuntime` (читал `summary-panel-runtime-loaded.ts:66-97`) не имеет статических/модульных полей — конструктор пишет только `this.host`, все состояния (`local`, `dialog`, `stage`, `presentation`, таймеры) — per-instance. Значит побочный, никогда не подключённый instance (проигравший гонку при повторном connect во время pending import) безопасен: конструктор не создаёт подписок/таймеров, они появляются только в `.connect()`.
- **Синхронность до первого рендера.** `_summarySlot.connect()` вызывается сразу после `super.connectedCallback()`, синхронно в теле `connectedCallback`; Lit планирует первый апдейт микрозадачей после возврата из `connectedCallback`, поэтому синхронный путь гарантированно предшествует первому `render()`/`updated()`. Проверено чтением `src/houseplan-card.ts:2295, 2628-2629` и подтверждено смоком (`!c2.hasUpdated` в момент проверки `_summary`).
- **Same-node reconnect.** `disconnect()` не обнуляет `this.runtime`, `connect()` при существующем `runtime` просто вызывает `.connect()` повторно — переиспользование instance гарантировано структурой кода (проверено чтением, не отдельным тестом — тривиальный инвариант, не защитный AC в терминах #435).
- **Инвалидация подписки (AC3).** `_capturedSnapshotSequence = -1` выставляется в колбэке `adopted`, который срабатывает ровно один раз на host (гард `if (this.runtime) return` в `adopt()`) — тот же побочный эффект, что был в старом `import().then()`-коде, просто перенесённый.
- **Ленивая граница (§4.1, «static import недопустим»).** В `houseplan-card.ts` статически импортирован только сам загрузчик (~140 строк, без тяжёлых зависимостей); `summary-panel-runtime-loaded` по-прежнему подключается через `import()` внутри фабрики. Подтверждено бандл-бюджетом: initial View выросло всего на 299 Б (только загрузчик), `summary-panel-runtime-loaded-*.js` остаётся отдельным chunk-файлом в `dist/houseplan-assets/`.
- **Ядро карточки** — 13 699 строк против потолка 13 700 (`test/core-file-budget.test.mjs`) — не задет вынесением в модуль.
- **Docs fingerprint.** `docs/images/screenshots.json`: у всех сценариев изменился только `sourceFingerprint`/`sourceSha256`, ни один `imageSha256` не изменился — совпадает с заявлением «11 кадров пиксель-идентичны»; job `check-docs` в Validate это же и проверяет и был зелёным (не warn, а реальный success шага, который иначе завалил бы «Вердикт предполётных проверок» через `exit $fail`).
- **Changelog/трейлеры/ветка/i18n** — все формальные требования §2.6/§7.1/№10 выполнены, i18n не затронут (нет новых пользовательских решений/строк).

## Чего не проверял

- Официальный Full Performance (9 профилей / 3 нужных по этой задаче, 7+1 на Linux-раннере, `performance.yml`) — не прогонял и не запускал через `run_workflow`: по PROCESS.md §8 это гейт стабильного релиза, а не код-ревью, автор сам не смог его продиспатчить (недостаточные права токена) и явно передал это владельцу — см. раздел «Находки» выше, риск явно назван, а не спрятан.
- `python -m pytest tests_backend` — не запускал: диффа в `custom_components/**/*.py` нет.
- `node scripts/model-invariants.mjs` — не запускал: диффа в геометрии/`layout`/`marker.space`/`open_spans` нет, симптом задачи и правка целиком в lifecycle сводной панели.
- `npm run golden:verify` — не запускал: диффа в рендер-логике/стилях/геометрии нет (только lifecycle подключения панели), а фингерпринт-доказательство docs-скриншотов (0 отличающихся пикселей на 11 кадрах) уже закрывает вопрос «видимый результат не изменился» для затронутых сценариев сильнее, чем повторный кадр golden дал бы для несвязанных сценариев.
- 228 из 236 смоков матрицы (`ls demo/smoke_*.mjs | wc -l` = 236 на дату ревью) — вне «прямого совпадения»/«зарегистрированной связи» по `smoke-select.mjs`; полный прогон матрицы — предрелизный гейт (PROCESS.md §8), не гейт ревью, а диапазон дельты (lifecycle одного нового модуля + 8 строк в `houseplan-card.ts`) не даёт оснований подозревать более широкое пересечение.
- `npm run benchmark:junction-limits`, `benchmark:wall-draw-click` — часть того же CI-джоба перф-смока, но не относятся к диффу (геометрия стыков/стен не тронута) — не прогонял, посчитал избыточным.

## Вердикт

Зелёный. Изменение реализует контракт ТЗ §4 буквально: код кешируется постранично, состояние — per-host, синхронный fast path подтверждён и чтением, и personally воспроизведённым красным мутантом, асинхронный lifecycle (гонки cold/pending/disconnect) закрыт пятью юнит-тестами, ленивая граница и лимит ядра сохранены, budget/docs-fingerprint пересчитаны корректно и обоснованно, оба changelog на месте в одном коммите с верными трейлерами. Дешёвые гейты, пропущенные CI на этом SHA как обычном push (перф-смок, часть браузерной матрицы), прогнаны лично и все зелёные с запасом. Единственный непокрытый на этом SHA пункт — официальный парный Full Performance — по процессу и по самому ТЗ является гейтом стабильного релиза, а не код-ревью, и явно зафиксирован здесь как открытый риск, а не молчаливо пропущен.

---

<!-- material-anchors: заполняется конвейером -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/506-startup-performance`, коммит `9d6ac98d3a42` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `dc12b608285572d3f25abf88868f2546f4a9a34c`
  ```
  git log --all --format='%H %T' | grep dc12b6082855
  ```
- ТЗ `docs/specs/506-startup-performance.md`, блоб `d2517458924164f801f493ff8597ebdd2a8e4e35`
  ```
  git log --all --find-object=d2517458924164f801f493ff8597ebdd2a8e4e35 -- docs/specs/506-startup-performance.md
  ```
- Вердикт конвейера: `green` · High 0
