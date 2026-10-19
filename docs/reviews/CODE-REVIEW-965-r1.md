# CODE-REVIEW-965-r1

Issue: #965 · Этап: code · Трек: show · Заход: r1 · блокирующих циклов израсходовано 0/2
Материал: `306bb6437409ea6d96958296d64ce6801e97f821` (рабочая копия на нём же, проверено `git rev-parse HEAD`)

## Скоуп

Инфраструктурная задача (только классы B/C): три коммита без изменений в
`src/**` и `custom_components/**`. Диапазон `origin/dev..HEAD`:

- `demo/helpers/hp-test.mjs` — контрактный селектор `toast`, методы фасада
  `toast()` и `waitForToastClear()`.
- `demo/smoke_controls.mjs`, `smoke_disabled_device.mjs`,
  `smoke_kiosk_cycle_context.mjs`, `smoke_placement_context_message.mjs`,
  `smoke_radar_setup.mjs`, `smoke_version_recovery.mjs` — переход с прямого
  чтения `sr().querySelector('.toast')` / приватных полей `_toast`,
  `_toastTimer` на фасадный DOM-ридер и штатное ожидание исчезновения.
- `demo/smoke_editor_styles_lazy.mjs` — абсолютный индекс `editor-dialogs`
  (было `=== 5`) заменён на динамический `cardStyles.flat(Infinity)
  .indexOf(dialogsStyles) + 1`.
- `scripts/mutation-registry.mjs` — guard двух мутантов
  (`editor-styles-adoption-dropped-from-runtime`,
  `editor-styles-adopted-once-per-page`) теперь компилирует
  `test-build/styles.js` перед прогоном смока, которому это чтение
  понадобилось.
- `docs/TESTING.md` — документирует новое поведение `settled()`/
  `waitForToastClear()`.
- `docs/release-ledger/v1.81.0/965.json` — `category: infra`, без `summary`
  (соответствует соседним infra-записям 957/964 и т. п.).

Повод: #956 перенёс единственный DOM-узел toast из декларативного рендера
карточки в программный портал (`ToastPresentation`, `data-hp="toast-portal"`),
который при открытом модальном окне перемещает узел в его shadow root; CSS
toast вынесен в отдельный `toastStyles`, который `baseStyles` теперь включает
первым элементом — это и сдвинуло позицию `dialogsStyles` в `cardStyles` на
единицу. Старые смоки читали `.toast` только в корне карточки и ожидали
абсолютный индекс `5` — оба предположения перестали быть верными. Этот диапазон
чинит только witnesses; продукт, тексты, persistence, тайминги и gate
thresholds не затронуты (подтверждено пустым диффом `src/**`).

## Как проверялось

Materially прочитаны: `docs/SCOPE.md`, `AGENTS.md`,
`docs/process/REVIEWER.md`, тело issue #965 и оба комментария (handoff
автора), `docs/TESTING.md` (полный раздел про фасад), затронутые файлы диффа
целиком, а также нетронутые, но релевантные `src/toast-presentation.ts`,
`src/houseplan-card.ts` (`_showToast`), `src/styles.ts`,
`src/editor-style-adoption.ts`, `src/styles/base.styles.ts` — чтобы
верифицировать, что абсолютный сдвиг индекса и перенос notice в портал
действительно случились в #956 и действительно объясняют заявленную находку
(прочитано чтением, не исполнением; дальше подтверждено исполнением ниже).

Исполнено лично (материал не менялся, права на Bash/Write для обычных
build/test использованы, предмет ревью не редактировался):

| Гейт | Команда | Результат |
|---|---|---|
| Освежить дерево стенда | `node scripts/bundle-sync.mjs` → `demo bundle manifest is stale`, затем `npm run bundle:sync` (= `npm run build` + sync) | PASS, `tsc --noEmit && rollup -c` зелёные (src не менялся — бандл идентичен по содержанию уже проверенному в Validate) |
| 7 изменённых смоков по отдельности | `node demo/smoke_controls.mjs`, `smoke_disabled_device.mjs`, `smoke_kiosk_cycle_context.mjs`, `smoke_placement_context_message.mjs`, `smoke_version_recovery.mjs`, `smoke_radar_setup.mjs` | PASS (все проверки `true`, `OK`) |
| `smoke_editor_styles_lazy.mjs` | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node demo/smoke_editor_styles_lazy.mjs` | PASS (`sheetsInCanonicalSlotsOnce`, `editorSheetsCarryTheMovedRules` и все 4 per-surface canonical-slot проверки — `true`) |
| Смежный продуктовый смок #956 (не в диффе, доказательство, что портал не задет) | `node demo/smoke_modal_toast_956.mjs` | PASS |
| Фасад | `node --test test/hp-test-facade.test.mjs` | 4/4 PASS — новый селектор `toast` контрактный, READS не расширен |
| Mutation registry (только static) | `node scripts/mutation-gate.mjs --check` | PASS: definitions=1699, браузерные guard 420/200 (превышение — не этой задачи, уже обоснованные строки реестра), `execution=0, caught=unknown (nightly only)`; обе изменённые guard-строки (`editor-styles-adoption-dropped-from-runtime`, `editor-styles-adopted-once-per-page`) — `ok` |
| Локальный pre-push набор | `npm run gate:small` | PASS, 268 с, 0 упавших: сборка+typecheck 33с, no-new-any 1с, render-sync 1с, смоки не пишут в приватное состояние 1с, smoke-select 1с, `npm test` (юниты) 222с, bundle-policy --verify 0с, bundle budget 0с, lint:unused 8с |
| Дешёвые гейты на материале | Validate [39253528014](https://github.com/Matysh/houseplan-card/actions/runs/39253528014) — success на `306bb6437` | принято по ссылке: `typecheck`/`npm test`/`npm run build` на этом SHA не перегонялись отдельно |

Негативный свидетель AC1 (RED → GREEN на одном и том же неизменном бандле,
без патча исполняемой реализации — патчился только текст смока, временно, на
рабочей копии, с немедленным восстановлением к материалу
`git checkout HEAD -- demo/...`):

| Смок (версия `origin/dev` 753bfbcb2, старый reader) | RED-находки (команда: `node demo/<файл>.mjs` на том же бандле) |
|---|---|
| `smoke_controls.mjs` | `unavailableTargetsPluralToast`, `unavailableTargetSingularToast`, `confirmRaceUnavailableToast` — все `false` |
| `smoke_disabled_device.mjs` | `showBlocked: false` |
| `smoke_kiosk_cycle_context.mjs` | `changedTargetHasExplanation: false` |
| `smoke_placement_context_message.mjs` | `humanMessage: false` (оба языка) |
| `smoke_version_recovery.mjs` | `terminalLazyToastSuppressedOnlyWithBanner: false` |
| `smoke_radar_setup.mjs` | `noContourWarns: false`, `unknownRoomIsAnError: false` |
| `smoke_editor_styles_lazy.mjs` (хардкод `=== 5`) | `sheetsInCanonicalSlotsOnce` и все 4 per-surface canonical-slot проверки — `false` (факт: вставка `editor-dialogs` стоит на индексе 6, не 5) |

После `git checkout HEAD -- demo/...` все семь файлов вернулись к состоянию
материала; `git status` — чисто, `dist/`, `demo/srv/assets/` восстановлены тем
же способом (generated outputs, не коммит).

Это закрывает защитный характер AC1 таблицей «AC · чем доказан · чем краснеет»:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (regression-свидетель смоков) | Обычный прогон 7 изменённых смоков на материале — все PASS | Тот же обычный прогон версии `origin/dev` (753bfbcb2) на том же бандле — см. таблицу RED выше, конкретные упавшие ключи названы |
| AC2 (cascade/портал контракт) | `smoke_editor_styles_lazy.mjs` PASS, `editorSheetsCarryTheMovedRules`/`sheetsInCanonicalSlotsOnce`/per-surface first-frame — все `true`; `toast()` ограничен `rootOf(need('toast'))` текущей карточки (код `demo/helpers/hp-test.mjs`), не читает `_toast` | Та же проверка на хардкоде `=== 5` — `false` (таблица выше) |
| AC3 (гейты) | `gate:small` PASS (ниже), `mutation-gate.mjs --check` PASS, ledger `infra` корректен, трейлеры `Issue:#965`/`User-Visible: no` на всех 3 коммитах | н/п — не защитный AC |

## Находки

Нет ни одной. High: 0, Medium: 0, Low: 0.

Отдельно проверено и не вызывает возражений:
- Позиционирование `dialogSlot` вычисляется из того же модуля
  (`src/styles.ts` → `test-build/styles.js`), что и реальная адопция в
  `src/editor-style-adoption.ts` (`list.indexOf(anchor.styleSheet!) + 1`,
  anchor = `dialogsStyles`) — тест и продукт используют один и тот же якорь,
  не дублируют магическое число.
- `toast()`/`waitForToastClear()` не входят в `READS` (ничего не читают из
  приватных полей карточки) и используют контрактный селектор
  `data-hp="toast"`, уже объявленный в `docs/data-hp-contract.json` с
  аудиторией `test` (не новый контракт).
- `waitForToastClear()` ждёт исчезновения реального DOM-узла (до 5000 мс,
  именованная ошибка при таймауте), не трогает `_toastTimer`/`_toast` — ровно
  то, что требует AC2 «не изменять продуктовые таймеры».
- Guard двух мутантов в `scripts/mutation-registry.mjs` обновлён на
  существующий паттерн `npx tsc -p tsconfig.test.json && node
  scripts/fix-test-build.mjs && …`, используемый десятками других guard —
  не новый приём, не исполнение мутанта (экзекуция остаётся nightly-only,
  `mutation-gate.mjs --check` подтверждает `execution=0`).
- Трейлеры `Issue: #965` + `User-Visible: no` на всех 3 коммитах; `no`
  корректен — ни одно пользовательское число/текст/поведение в диффе не
  меняется, changelog не требуется.
- `docs/release-ledger/v1.81.0/965.json` — `category: infra`, без
  `introducedBy` (поле используется только у `line-fix`, см. 941/951/955) и
  без `summary` (инфра-записи его не несут, см. 957/964) — соответствует
  устоявшемуся формату.
- Track `show`, §5 risk-check по изменённым классам: сложность низкая (≤3),
  одна поверхность (тестовый харнесс), миграций/новых compat-полей нет, новый
  UX-контракт не создаётся (продукт не меняется), perf/touch не затронуты,
  ожидаемое поведение (сам факт переноса toast в портал) уже зафиксировано
  документами #956. Понижения до `ask` не требуется — `route: fix`.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` с трёхсторонней
  сверкой копий бандла отдельно не гонял — принят по ссылке на зелёный
  Validate на этом же SHA (`306bb6437`, run 39253528014); использованный мной
  `npm run bundle:sync` неявно прогнал тот же `tsc --noEmit && rollup -c`
  ещё раз (PASS), но это не замена полного `npm test`.
  `npm run gate:small` (прогнан лично, см. таблицу) включает собственный
  набор unit-тестов и частично перекрывает `npm test`, но не идентичен ему.
- `golden:verify`, `pytest tests_backend`, инварианты модели, performance —
  не прогонял: диффа в рендере плана, Python и геометрии нет (metка
  `ci:golden` не нужна, визуального риска нет), AC их не называет.
- Полный `demo/smoke_*.mjs` набор (весь каталог) не гонял — только 7
  изменённых файлов плюс контрольный `smoke_modal_toast_956.mjs`;
  `node scripts/smoke-select.mjs --base origin/dev --head HEAD` подтверждает
  «браузер-smoke этим диффом не выбираются» (src не тронут) — названные в
  issue смоки прогнаны мной напрямую, не через selector.
  CI job «Смоки в браузере» на материале был **skipped** (`heavy=false`,
  т.к. диапазон не задевает `src/**`) — это явно описанный в промпте случай,
  когда ответственность за выбранные по диффу смоки остаётся за ревьюером.
  Golden/performance_smoke/мутанты-по-диффу в этом Validate run тоже были
  `skipped` по той же причине (`heavy=false`) — ожидаемо для B/C-инфры, AC их
  не требует.
- Ручная/GPU-приёмка владельцем не проводилась и не требуется (#929) —
  headless Chromium (пин 1.62.0 / chromium-headless-shell 151.0.7922.34,
  `browser-attestation ok` в каждом логе) — единственное визуальное
  доказательство, и оно не выдаётся за GPU-проверку.

## Вердикт

Зелёный. Все три AC доказаны исполнением с явным RED/GREEN свидетелем на
неизменном бандле (AC1), защитная таблица «AC · чем доказан · чем краснеет»
заполнена без пустых столбцов, гейты по объёму диффа и трекa `show`
соразмерны и честно перечислены. High: 0, Medium: 0. Побочных находок нет —
по доверенному снимку `mode=issues` новый issue не заводится, поскольку
заводить нечего.

route: fix (ни один критерий §5 track:show не пробит).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/965-smoke-modal-witnesses`, коммит `306bb6437409` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4f357d45162f5a00b002590057392b920edd6c5c`
  ```
  git log --all --format='%H %T' | grep 4f357d45162f
  ```
- Тело issue: `795f5115ce1819f6a92b4f76973be7cbda7b2c42e97087c2b621f9cd1d1a203a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `undocumented`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTcsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTcyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxODIsIm91dHB1dF90b2tlbnMiOjQxMTY2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE4NjQ0OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjExMzcwMDk1LCJjb3N0VXNkRXN0aW1hdGUiOjMuNDMxODM0OTk5OTk5OTk5fV0sInR1cm5zIjoxMDIsImR1cmF0aW9uTXMiOjg2Njc1NCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjMuNDM3MDA2OTk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5279 output_tokens=41181 cache_creation_input_tokens=186448 cache_read_input_tokens=11370095 num_turns=102 -->
