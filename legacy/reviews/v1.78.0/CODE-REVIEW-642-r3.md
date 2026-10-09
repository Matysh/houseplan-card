# CODE-REVIEW-642-r3

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD` на
`c70aab8bbfa23a4339fc1d6cf96956443f124719`, рабочая копия уже на нём.
`origin/dev` = `79ee16546d9b` (после #623, #643, #641-r2, процессного
фикса `92b83d95` и снятия ночного реестра мутантов `44ee23ee`). Один
содержательный коммит `66ae952c` поверх `origin/dev`, плюс два докс-коммита
публикации r1 (`345e613a` — документ, `b7747bc7` — индекс) и один докс-коммит
публикации r2 (`c70aab8b`, тот же коммит, что и материал раунда — он
одновременно и головной пуш, и публикация r2). `Issue: #642`,
`User-Visible: no`.

## Почему r3, а не слияние зелёного r2

И r1, и r2 вынесли зелёный вердикт. Оба раза слияние срывалось не на
находке, а на одном и том же механическом конфликте — генерируемый
`docs/reviews/INDEX.md`, пока шёл ревью, `dev` уходил вперёд. Комментарий
автора `2026-09-24T07:37:19Z` в issue объясняет вторую итерацию этого:
после `#643` конвейер (`process.yml`, зеркалированный в `main` =
`8741f3f6`) научился сам пересобирать индекс при конфликте только в нём —
но ветку `issue/642-optimize-plans-dialog` это не избавило от повторного
раунда: код не менялся (`524c5bee`), поменялась только доказуемость
дерева относительно новой вершины `dev`, и по §7.2 это отдельный раунд, а
не автопродление r2.

Это тот же случай из инструкции ревью «ребейз на ушедший вперёд `dev`» —
разбор обязан остаться полным. Полнота здесь означает то же, что и в r2:
не поверить хендоффу/автору на слово, а установить по git-объектам
независимо, что дерево кода не изменилось, и что новый материал,
принесённый очередным продвижением `dev` (`#641`-r2, `#643`, `#623`,
`92b83d95`, `44ee23ee`), не просочился в файлы, которые трогает #642.

## Скоуп

Не изменился с r1/r2: первый вынос подсистемы из монолита по образцу
`live-*`/`RadarSetupController` (#624 — измерительная база). Диалог
«Оптимизировать планы» (373 строки в `HouseplanEditorRuntime`) переезжает
в `src/optimize-plans-dialog.ts` за узкий порт `OptimizePlansDialogPort`
(18 членов). Пять делегатов-заглушек и две стрелки-заглушки в карточке
удалены. Харнесс (13 смоков, `wall-draw-click-harness`,
`golden/harness.mjs`) переведён на новый адрес. 11 текстовых утверждений
`i18n.test.mjs` и 8 мутантов реестра переведены на исполнение через
`test/optimize-plans-dialog.test.mjs`. Продукт не меняется байт-в-байт;
персоны из `docs/SCOPE.md` изменения не видят — работа обслуживает J6
через связность и тестируемость, не пользовательскую функцию.

## Как проверялось

### 1. Идентичность дерева коду, который разобрали r1 и r2

Сверил блобы напрямую (`git rev-parse HEAD:<file>`) с якорями,
опубликованными в материале r2 (`docs/reviews/CODE-REVIEW-642-r2.md`) и
в хендоффе автора `2026-09-24T05:28:38Z`:

| Файл | Блоб HEAD (`c70aab8b`) | Совпадает с r1/r2 |
|---|---|---|
| `src/optimize-plans-dialog.ts` | `b51f5c0b…` | да, byte-for-byte |
| `src/houseplan-editor-runtime.ts` | `35ff6bce…` | да |
| `src/houseplan-card.ts` | `77e8988e…` | да |
| `src/editors/general-settings-dialog.ts` | `90d7a599…` | да |
| `test/optimize-plans-dialog.test.mjs` | `57dd9688…` | да |
| `test/i18n.test.mjs` | `a4946f7b…` | да |
| `scripts/monolith-baseline.json` | `9f8b6c07…` | да |
| `scripts/bundle-budget.mjs` | `e11ebf05…` | да |
| `test/core-file-budget.test.mjs` | `6896b2fd…` | да |

Все девять ключевых файлов — идентичные блобы. Это то же самое дерево,
которое r1 прочитал целиком, а r2 подтвердил байт-в-байт после первого
ребейза: третий раунд подряд не меняет ни строки продуктового кода.

`scripts/mutation-registry.mjs` и `tsconfig.test.json` блобы не
совпадают ни с r1, ни с r2 — ожидаемо: `dev` продвинулся ещё раз (через
`#641`-r2, `#643`, `#623`), и оба файла — общие с другими задачами.

### 2. Что именно принёс третий ребейз — не заявление, а diff

`git diff origin/dev...HEAD -- scripts/mutation-registry.mjs`: диф
касается ровно тех же 9 `id:`, что и в r1/r2 (`optimize-preflight-bypassed`,
`optimize-preflight-renders-apply-on-failure`,
`near-axis-optimize-confirmation-bypassed`, `preflight-reason-lost-in-dialog`,
`preflight-fingerprint-from-saved-config`,
`preflight-fallback-survives-dialog-close`,
`preflight-diagnostics-without-reason`, `preflight-dev-log-disabled`,
`optimize-dialog-imports-host-port`) — гварды и патчи переносят диалог с
`src/houseplan-card.ts`/`src/houseplan-editor-runtime.ts`/смок-гвардов на
`src/optimize-plans-dialog.ts`/юнит-гварды, слово в слово то же
содержание, что уже разобрали r1 и r2. Ни одной строки, принадлежащей
`#641`/`#643`/`#623` (их id в диффе нет — они уже в `dev`, общий предок
их не считает). `tsconfig.test.json`: диф — 2 строки, только добавление
`src/optimize-plans-dialog.ts` в `include`, как и раньше. Дополнительно
прочитан построчно свежий диф `src/houseplan-card.ts` против нового
`origin/dev` целиком (делегаты и `_alignDialog`/`_preflightClipboardFallback`
удалены, рендер-ветка карточки — `${this._alignDialog && this._editorRuntime
? this._editorRuntime.optimizePlans.render() : nothing}`) — расхождений
с описанием r1/r2 нет. `git diff origin/dev...HEAD -- test/i18n.test.mjs
test/core-file-budget.test.mjs test/mutation-gate.test.mjs` также
перечитан и соответствует тому, что уже описали r1/r2 (11 удалённых
`assert`, два потолка `CAPS` опущены на выигрыш выноса, один тест #550
переадресован на `src/optimize-plans-dialog.ts`).

Grep по репозиторию на все удалённые имена
(`_reportPreflightFailure`, `_copyPreflightDiagnostics`,
`_previewAlignDialog`, `_openAlignDialog`, `_toggleOptimizeLivePositions`,
`_runAlignToGrid`, `_renderAlignDialog`, `_preflightClipboardFallback`,
`_reportedPreflightFingerprint`, `_preflightVersionsDiffer`) вне
`src/optimize-plans-dialog.ts` — пусто.

### 3. Гейты — что унаследовано из Validate CI на этом точном SHA, что перепрогнано лично

Validate на `c70aab8b` — success (run `35972798790`, `workflow_dispatch`).
Не поверил галочке — прочитал логи шагов и job'ов напрямую через
`gh api .../jobs`:

| Шаг Validate | Job/шаг | Результат по логу |
|---|---|---|
| Typecheck, `no-new-any`, `npm test`, `npm run build` | «Фронтенд: типы, юниты, мутанты, синхрон бандла» | success по каждому шагу |
| `bundle-tree.mjs` + `npm run bundle:budget` | «Card bundle trees in sync» | success; в логе: `lazy editor: 244976 B gzip (потолок 246000 B ±2000)`, то же предупреждение о запасе initial View (11793 Б, доконтекстный долг #367/#474) |
| `npm run lint:unused` (AC1) | «Мёртвый код и связность монолита» | success; в логе: `delegates=154 portMembers=348 hostRefs=4869 portPrivates=94 harnessPrivates=101 bundleBytes=2499182` — точное совпадение с таблицей АС1 хендоффа и с r1/r2 |
| 6 шардов «Мутанты по диффу» | — | все success, но ни один из 9 id #642 не встречается по имени ни в одном из 6 логов шардов (проверил grep'ом по скачанным логам) — ledger кеширует по отпечатку и не печатает пропущенные по совпадению отпечатка мутанты; не засчитал это как независимое доказательство, перепрогнал все 9 лично (см. ниже) |

Итог: typecheck/unit/build/bundle-sync/budget/AC1-connectivity подтверждены
чтением реальных логов CI на этом SHA, повторно не гонял. `check-docs`
перепрогнал сам, потому что diff трогает `src/**`.

То, что Validate без `full=true` не покрывает (смоки, golden), плюс
мутанты, для которых CI-лог не давал независимого доказательства, —
перепрогнал лично, на этом точном SHA:

| Гейт | Команда | Результат |
|---|---|---|
| Синхрон демо-стенда (нужен для смоков/golden) | `node scripts/bundle-sync.mjs` | ok, `git status` после — чисто |
| `check-docs` | `node scripts/check-docs.mjs --screenshots=warn` | зелёный (7 файлов, 12 внешних ссылок); тот же нерегрессионный WARN про скриншоты (#479), что видели r1/r2 |
| Юнит модуля (AC2/AC3) | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/optimize-plans-dialog.test.mjs` | 21/21 pass |
| Смоки, названные в AC (13 шт.) | `node demo/smoke_<name>.mjs` × 12 + `node demo/wall-draw-click-harness.mjs` и отдельно `node demo/smoke_wall_draw_click.mjs` (реальный гвард 13-го смока) | все 13 — `OK`, все под-проверки `true` (полный список ниже) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | тот же профиль, что в r1/r2: 36 прямых совпадений (12 — смоки диалога), 17 слабых (`_editorRuntime`), 1 зарегистрированная связь (`smoke_wall_union_isolation`) — выборка не меняет решение |
| Golden, полный демо-набор | `npm run golden:verify` | все 175 сценариев `passed`, exit 0, включая все 4 кадра диалога: `optimize-preflight-dialog-{dark-en,light-ru}`, `optimize-orphan-references-{dark-en,light-ru}` |
| Все 9 защитных мутантов AC2/AC4 | `node scripts/mutation-gate.mjs --id=<id>` × 9 (`optimize-dialog-imports-host-port`, `optimize-preflight-bypassed`, `optimize-preflight-renders-apply-on-failure`, `near-axis-optimize-confirmation-bypassed`, `preflight-reason-lost-in-dialog`, `preflight-fingerprint-from-saved-config`, `preflight-fallback-survives-dialog-close`, `preflight-diagnostics-without-reason`, `preflight-dev-log-disabled`) | у каждого «поймано 1 из 1» |

13 смоков (все `OK`): `smoke_optimize_geometry_preflight`,
`smoke_preflight_diagnostics`, `smoke_near_axis_optimize`,
`smoke_orphan_space_references`, `smoke_optimize_coordinate_canonicalization`,
`smoke_optimize_coincident_partition`, `smoke_optimize_micro_interval`,
`smoke_grid_snap`, `smoke_resize_outer_reconciliation`,
`smoke_unified_wall_tool`, `smoke_warm_dialogs`, `smoke_writer_fixed_point`,
`smoke_wall_draw_click`.

### AC — чем доказан — независимо перепроверено в r3

| AC | Заявлено | Перепроверено в r3 |
|---|---|---|
| AC1 числа падают, бандл не растёт | таблица чисел | лог CI-шага «Мёртвый код и связность монолита» на `c70aab8b` — точное совпадение всех 6 чисел |
| AC2 порт узкий (≤20), модуль не знает host | юнит + мутант `optimize-dialog-imports-host-port` | юнит зелёный (21/21); мутант лично прогнан на этом SHA → «поймано 1 из 1» |
| AC3 разметка исполнением (11 утверждений) | 5 юнитов render | юниты зелёные; диф `i18n.test.mjs` перечитан — 11 `assert` действительно удалены и заменены комментарием со ссылкой на новый юнит |
| AC4 защиты сохранены (8 мутантов) | 8 переведённых мутантов | все 8 лично перепрогнаны на этом SHA → «поймано 1 из 1» у каждого (не унаследовано — CI-лог не давал независимого доказательства по имени) |
| AC5 текстовые якоря не растут | `monolith-text-anchors.test.mjs` зелёный | файл вне диффа `origin/dev...HEAD` (0 изменений с r2) — логика заморозки расходиться не может; покрыт `npm test` в CI на этом SHA |
| AC6 продукт не изменился | смоки + golden без пересъёмки | golden — 175/175 `passed` на этом точном SHA; 13 смоков — все на этом SHA |

## Закрытие раунда r2

r2 не нашёл ни одной находки (High 0, Medium 0) и вынес зелёный вердикт —
вернуть было нечего.

| Что случилось после r2 | Чем закрыто | Где это видно |
|---|---|---|
| Слияние r2 отказало — конфликт только в генерируемом `docs/reviews/INDEX.md`, `dev` продвинулся, пока шло ревью | Автор подтвердил в issue (`2026-09-24T07:37:19Z`): код не менялся (`524c5bee`), с `#643` конвейер сам пересобирает индекс при таком конфликте; ветка вернулась на `S7-code-review` | комментарий issue #642 `2026-09-24T07:37:19Z`; docs-коммиты `345e613a`/`b7747bc7`/`c70aab8b` несут только `CODE-REVIEW-642-{r1,r2}.md` и пересборку `INDEX.md` |
| Нужно доказать, что дальнейшее продвижение `dev` (`#641`-r2, `#643`, `#623`, `92b83d95`, `44ee23ee`) не изменило код, который видели r1/r2 | Блобы всех девяти содержательных файлов идентичны байт-в-байт материалу r1/r2 | таблица в разделе «Как проверялось» п.1 |
| Единственные два файла с изменившимся блобом (`mutation-registry.mjs`, `tsconfig.test.json`) — нужно исключить утечку `#641`/`#643`/`#623` | Диф против нового `origin/dev` содержит ровно те же 9 `id:` #642, что и в r1/r2, построчно то же содержание | «Как проверялось» п.2 |

## Унаследовано из r1/r2

Без повторного построчного чтения «с нуля» (код неизменен, установлено
байт-в-байт — см. п.1), но с самостоятельным перечтением диффа против
нового `origin/dev` (п.2) и полным собственным прогоном исполняемых
гейтов (раздел «Как проверялось» п.3 — 13 смоков, 175 golden-кадров,
21 юнит-тест, все 9 мутантов лично, а не по цепочке доверия):

- Разбор эквивалентности WeakMap-фолбэка (`run()` создаёт новый объект
  диалога только в ветке, где `d.preflight?.ok` уже истинно; фолбэк
  живёт только при красном preflight) — код `src/optimize-plans-dialog.ts`
  не изменился (тот же блоб `b51f5c0b…`), разбор путей из r1/r2 остаётся
  в силе; дополнительно подтверждён личным прогоном
  `preflight-fallback-survives-dialog-close` на этом SHA.
- Отступления от ТЗ (перекалибровка потолка lazy-editor gzip, AC2 без
  `satisfies`, точечные мутанты #3–5 из хендоффа) — оценены и приняты
  r1, содержимое не изменилось.
- Порт `checkGeometry` идёт через `host._checkOptimizeGeometry` (делегат
  остался на карточке) ради `space-copy-runtime.ts` — читал сам диф
  `src/houseplan-card.ts` в п.2, обе точки на месте, расхождений с
  r1 нет.

## Что проверено и корректно

- Дерево кода `66ae952c` идентично байт-в-байт коду, который читали r1
  и r2 (девять ключевых файлов сверены по блобам); два ребейза подряд
  после двух зелёных вердиктов не внесли ни строки нового продуктового
  кода — только механическую пересборку `docs/reviews/INDEX.md` и
  перенос точки привязки `mutation-registry.mjs`/`tsconfig.test.json` на
  новую вершину `dev`.
- Диф против нового `origin/dev` (`scripts/mutation-registry.mjs`,
  `tsconfig.test.json`, `src/houseplan-card.ts`, `test/i18n.test.mjs`,
  `test/core-file-budget.test.mjs`, `test/mutation-gate.test.mjs`)
  построчно прочитан и содержит только контент #642, без утечки
  `#641`/`#643`/`#623`.
- Никаких оставшихся ссылок на удалённые имена — grep по `src/`, `test/`,
  `demo/` чист.
- AC1–AC6 доказаны исполнением лично на этом точном SHA (`c70aab8b`):
  connectivity-гейт (прочитан по логу CI), все 13 названных смоков, полный
  `golden:verify` (175/175 `passed`), 21/21 юнит-тест модуля, все 9
  защитных мутантов вручную — «поймано 1 из 1» у каждого.
- Трейлеры `Issue: #642`, `User-Visible: no` корректны на всех четырёх
  коммитах диапазона (`66ae952c`, `345e613a`, `b7747bc7`, `c70aab8b`);
  changelog не тронут (`git diff origin/dev...HEAD --stat` не содержит
  `CHANGELOG*`) — ожидаемо для внутреннего рефакторинга без видимого
  пользователю поведения.
- Одно число, один источник: числа связности по-прежнему живут только в
  `scripts/monolith-baseline.json`; `LAZY_EDITOR_GZIP_CEILING` — отдельная
  метрика, задвоения нет. Пользовательских чисел изменение не показывает.

## Чего не проверял

- `npx tsc --noEmit` / `npm test` / `npm run build` со сверкой бандла —
  дешёвые гейты уже подтверждены зелёным Validate на этом точном SHA
  (`c70aab8b`, run `35972798790`); прочитал реальные логи шагов (см.
  таблицу в п.3), а не только статус — повторно не гонял.
- `npm run golden:capture`/пересъёмку — не требовалась, контракт
  «байт-в-байт», `golden:verify` прогнан вместо неё.
- `python -m pytest tests_backend -q` — диф не касается
  `custom_components/**/*.py` (только скопированный бандл).
- `npm run invariants` — диф не меняет геометрию, только
  адресацию/связность.
- Performance-профиль — не назван в AC.
- Широкий и «слабый» хвосты `smoke-select.mjs` (17 слабых + 1
  зарегистрированная связь + часть из 36 прямых, не относящихся к
  диалогу) — тот же профиль, что и в r1/r2; не гонялись, то же
  обоснование (широкий `_editorRuntime`, не задевает перенесённый код).
- Полный предрелизный набор (все 263 сценария смоков, `performance_smoke`,
  HA-бэкенд) — по правилу «полные наборы — предрелизный гейт», не гейт
  ревью.
- Windows-прогон — не делал (и r1, и r2, и автор — тоже нет).

## Вердикт

High: 0. Medium: 0 (ни в скоупе, ни вне его). Low: 0 новых.

Зелёный. Причина r3 — процессная (второй подряд конфликт только в
генерируемом `docs/reviews/INDEX.md` при продвижении `dev`, §7.2), не
находка. Установлено независимо по git-объектам, а не по заявлению
хендоффа/автора/предыдущих раундов, что дерево кода не изменилось ни
первым, ни вторым, ни третьим ребейзом; диф против новой вершины `dev`
построчно подтверждён как содержащий только материал #642. AC1–AC6
доказаны исполнением лично на точном материале этого раунда: чтение
реальных логов CI (не только статуса) для typecheck/unit/build/bundle/
connectivity, плюс личный прогон всех 13 названных смоков, всех 175
golden-кадров и всех 9 защитных мутантов на `c70aab8b`. Харнесс не
ослаблен, продукт байт-в-байт не изменился.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/642-optimize-plans-dialog`, коммит `c70aab8bbfa2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9a733c378bafa64602f34f0669fd9f86c441a975`
  ```
  git log --all --format='%H %T' | grep 9a733c378baf
  ```
- Тело issue: `11d5073fbd1128d0f49f8b082936f26d677bd425b78e516d070b9a8d992d8651`
- Вердикт конвейера: `green` · High 0
