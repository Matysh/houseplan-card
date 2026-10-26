# CODE-REVIEW-997-r1

**Issue:** #997 — Шапка карточки: сворачивать выбор этажей в выпадающий список на узких экранах (продолжение #993)
**Трек:** ask · **Этап:** code · **Заход:** r1 · блокирующих циклов: 0/4
**Материал:** `3caf714cc5a7181f0bcfe6a997d8b47313f6ce02` (ровно этот SHA, рабочая копия уже на нём)
**Маршрут:** fix

## Скоуп

Проверялся полный диапазон коммитов `50f6795e2..3caf714cc` (15 коммитов, серия
`feat(header): compact floor navigation at card width` +
`test/fix/docs(header): …` + три финальных `refactor(header): move floor
navigation presentation into its owner`). Диапазон изменённых файлов — ровно
список из `REVIEW_CONTEXT.changedFiles` (продуктовый код
`src/header-space-select.ts` (новый), `src/houseplan-card.ts`,
`src/hp-settings-select.ts`, `src/styles/chrome.styles.ts`; тесты/смоки;
документация; budgets/registries/ledger).

SPEC прошёл независимое ревью: r1 жёлтый (2 Medium в скоупе: неверная ссылка
на `smoke_editor_tabs.mjs` вместо реальных nav-смоков в AC2/AC3; не описанная
судьба `.tabedit`/`.tabadd` в диапазоне 481–1024 px), r2 зелёный — обе находки
закрыты правкой тела issue. Этот заход — первое code-ревью (r1), дельта с
прошлым раундом не ведётся за отсутствием кода на r1.

## Как проверялось

1. Static-first: `REVIEW_CONTEXT` и три страницы источников (полная история
   issue #997, включая обе SPEC-находки и их закрытие, и весь журнал
   хендоффов разработчика с WIP-паузами/ребейзами).
2. `read:log` и `read:diff` (адресные check'и runner'а) — построчный разбор
   всего диффа (118 910 байт), включая каждый hunk продуктового кода,
   стилей, тестов, смоков и документации.
3. Прямое чтение рабочей копии на материале: `src/header-space-select.ts`
   (новый файл целиком), затронутые участки `src/houseplan-card.ts`
   (`_tabPointerDown/_tabPointerMove/_tabPointerUp/_endTabDrag/_tabClick/
   _commitTabOrder/_canReorderTabs`, измерение `_roHdr`/`_compactSpaces`,
   точка рендера `renderHeaderSpaceNavigation`), `src/hp-settings-select.ts`
   целиком (существующий принятый UI-029 компонент + точечные правки),
   `src/styles/chrome.styles.ts` (весь блок `.tabs`/`.compact-spaces` и
   медиа-запрос `max-width:480px`), `test/view-accessibility.test.mjs`
   целиком, `demo/smoke_header_compact_spaces.mjs` целиком (новый).
4. Сопоставление с docs/SCOPE.md (Core user job: управление/просмотр плана на
   узких устройствах), AGENTS.md (карта пакета, трек ask), docs/TOUCH-SUPPORT.md,
   docs/UX-MODES.md, docs/USER-GUIDE.ru.md — терминология и контракт шапки.
5. Сопоставление найденного с хендоффом автора (AC-таблица, бюджеты, risk-лог)
   — после независимого разбора, не как план.
6. Gates: **не перезапускались**. Используется принятое `validate-gate`
   (https://github.com/Matysh/houseplan-card/actions/runs/40372118294) —
   「review-light-golden proof is complete」— как действующее доказательство
   на этом же материале (`3caf714cc`). Это подтверждает: `gate:small`
   (build/typecheck/unit/budgets/unused/monolith/range guards),
   `process-gate.mjs --issues`, 10 целевых `node demo/<smoke>.mjs`
   (включая `smoke_header_compact_spaces`, `smoke_mobile_view_header`,
   `smoke_fixed_floor`, `smoke_nav_persist`, `smoke_space_switch_transitions`,
   `smoke_space_tab_reorder`, `smoke_editor_tabs`, `smoke_settings_select`,
   `smoke_decor_group_text_scale`, `smoke_decor_multiselect`) +
   `smoke_household_journeys`, 39 view-accessibility/immutable-policy/source
   unit-тестов, 2/2 новых Golden-кадра и статическую регистрацию мутантов
   (`mutation-gate.mjs --check`, execution=0). Отдельного адресного прогона
   не потребовалось: независимое чтение не выявило конкретного AC, риска или
   negative-input кейса без пригодного доказательства, а материал/входы/
   окружение/oracle с момента этого прогона не менялись.

## Разбор по изменённым участкам (#707) — поверхность риска

Вынесенный риск — перенос `pointermove`/`pointerdown`/`pointerup`/
`pointercancel` с `<nav>`/`<button>` в `src/houseplan-card.ts` (строки ~11059,
~11069, удалены) в `src/header-space-select.ts:50,57,58`. Независимо
проверено построчно:

- `renderHeaderSpaceNavigation` воспроизводит прежний JSX/lit-шаблон 1:1 —
  `@pointermove` по-прежнему висит на `<nav>` безусловно (и в компактном, и
  в широком режиме), `@pointerdown/@pointerup/@pointercancel/@click` — на
  каждой `<button data-hp="space-tab">`, только в ветке `else` (широкий
  режим); в компактном режиме кнопок-вкладок нет вообще, поэтому
  `_tabPointerDown` физически не может быть вызван без вкладки — это не
  регрессия, а прямое следствие замены разметки.
- Логика-обработчики (`_tabPointerDown/_tabPointerMove/_tabPointerUp/
  _endTabDrag/_tabClick/_commitTabOrder/_canReorderTabs`) в
  `houseplan-card.ts` не тронута ни на одну строку — только точка вызова
  переехала в параметры `renderHeaderSpaceNavigation({ pointerMove: event =>
  this._tabPointerMove(event), … })`. Типы (`HeaderSpaceNavigation.drag`)
  структурно совместимы с приватным полем `_tabDrag` (подмножество полей).
- Граничный сценарий «resize меняет compact ровно во время активного
  pointer-drag перетаскивания вкладки» не ломается: `window.addEventListener
  ('pointerup'/'pointercancel', …)` в `_tabPointerDown` навешан на `window`,
  а не на удаляемый `<button>`, поэтому неявная потеря capture при
  ре-рендере (смена разметки на компактную) всё равно доставит
  `pointercancel` в `window` и закроет жест через `_endTabDrag()` — это
  существующий механизм (комментарий в коде, не новый для #997), не
  изменённый диффом.
- Вывод: перенос — чистое извлечение представления в собственный модуль
  (три коммита `refactor(header): move floor navigation presentation into
  its owner` в конце серии), поведение pointer-путей не изменено.

## Независимая проверка по AC (ТЗ)

| AC | Что проверено чтением | Чем доказано (переиспользовано) |
|---|---|---|
| AC1 (порог 1024 px, собственная ширина карточки) | `headerWidth` берётся из `ResizeObserver` `contentRect.width` элемента `.hdr` (CSS `container: hp-head / inline-size`, из #993) — не `window.innerWidth`; `compact = headerWidth > 0 && headerWidth <= 1024` — включительно 1024, 1025 уже widе. Первая синхронная `measure()` при ширине 0 даёт non-compact на один кадр до первого колбэка `ResizeObserver` — ожидаемое асинхронное поведение (риск явно принят автором: «Async select сохраняет старую навигацию до готовности»). | `smoke_header_compact_spaces.mjs`: реальные content-box 1023/1023.75/1024/1024.25/1025 + «узкая карточка в широком окне»; 2 новых Golden-кадра (390 px закрыт, 1000 px открыт). Зарегистрированный мутант `compact-space-navigation-uses-window-width` (не исполнялся) — патч на `window.innerWidth` правдоподобно ломает ровно этот смок (окно 1440 px остаётся «wide» независимо от ширины карточки). |
| AC2 (выбор = прежний путь, guards/hash/pinned, отказ не меняет поле) | `chooseHeaderSpace`: `select.value = current` выполняется **синхронно до** вызова `pick(requested)`, то есть поле возвращается к принятому значению немедленно, независимо от исхода/задержки `_pickSpace` → `_editorRuntime.properties.beforeIntent`. `?selected=${space.id === current}` на `<option>` (атрибут, не только property) гарантирует, что `MutationObserver` общего `hp-settings-select` увидит смену и обновит видимый label. `create`/`configure` условия (`this._canEdit && !this._kiosk && !this._hasFixedFloor`, `this._norm && this._canEdit`) перенесены буквально. | `smoke_header_compact_spaces.mjs` (реальные клики выбора/настройки/создания на 481/768/1024, read-only/pinned отказ, `header.refused-dirty-navigation.*`), `smoke_nav_persist`, `smoke_fixed_floor`, `smoke_space_switch_transitions`, `smoke_space_tab_reorder`; 2 юнит-кейса `test/header-space-select.test.mjs` — реальная (не тавтологичная) проверка «поле держит принятое значение» и «ошибка guard не оставляет непринятый этаж». Зарегистрированный мутант `compact-space-navigation-keeps-unaccepted-choice` (не исполнялся) целится ровно в удаление строки `select.value = current`. |
| AC3 (mouse/keyboard/touch/Escape/resize/тема/kiosk) | Escape/Tab/стрелки/typeahead — не изменены (существующий `hp-settings-select`, только добавлены `data-hp` хуки и `part="label"`). Фикс контраста поля: было статическое `#282930/#202126` в тёмной ветке фолбэка, стало `color-mix(... var(--card-background-color) ... var(--primary-text-color) ...)` — корректно реагирует на кастомную/светлую тему даже без стилей редактора (ровно заявленный баг-фикс, подтверждён коммитом `fix(header): retain readable select colours without editor styles`). CSS `.head > .tabs.compact-spaces { overflow:visible; }` внутри `@media(max-width:480px)` специально переопределяет `overflow-x:auto` общего правила `.tabs`, иначе триггер/попап компактного поля рисковали обрезаться в телефонном ряду. | `smoke_header_compact_spaces.mjs` (клавиатура/Escape/фокус/touch/resize-ориентация/длинные названия/light-dark-custom с замером реального контраста через canvas). Зарегистрированный мутант `compact-space-select-dark-fallback-in-light-theme` (не исполнялся) целится ровно в откат этого CSS-фикса; правдоподобно ломает `header.theme.light.field-contrast`. |

Обе Medium-находки SPEC r1 отражены в коде: `smoke_editor_tabs.mjs`
используется в `scripts/smoke-links.mjs` только с пометкой «covers mode
changes only», а `smoke_nav_persist/fixed_floor/space_switch_transitions/
space_tab_reorder` действительно связаны с `src/header-space-select.ts`;
`.tabedit`/`.tabadd`/шестерёнка текущего пространства реально видимы на
481–1024 px (`compact-space-settings`, `nav.create`) и проверены кликами в
смоке.

## Прочее проверенное

- Бюджеты (`scripts/bundle-budget.mjs`, `scripts/monolith-baseline.json`)
  пересчитаны с объяснением (собственная дельта +536 B gzip initial,
  сохранены полоса 2000 и стена 352000; lazy-editor reference не поднят).
  Обоснование соразмерно фактическому изменению (новая lazy-точка общего
  select + CSS/hooks, редактор не грузится в View).
  `docs/release-ledger/v1.82.0/997.json`: классификация `stable-fix`
  относительно v1.82.0 обоснована — #993 (сжатие кнопок редакторов до
  1024 px) вошёл в `v1.82.0-beta.5`, то есть уже часть текущего stable
  v1.82.0 (проверено по `docs/CHANGELOG.md`), значит #997 как полировка
  той же области действительно «stable-fix», а не фича новой беты.
- CHANGELOG.md/.ru.md — запись добавлена в `## Unreleased` в обоих файлах
  одновременно, формулировка согласована с USER-GUIDE/UX-MODES.
- Документация (`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`,
  `TOUCH-SUPPORT.md`, `USER-GUIDE.md`/`.ru.md`, `UX-MODES.md`) описывает
  именно реализованное поведение (порог 1024 px, сохранённые
  gear/add/reorder-правила, kiosk без шапки); термины «компактный выбор
  пространства»/«выпадающий список» согласуются с уже существующим стилем
  `USER-GUIDE.ru.md`, нового термина не введено.
- `docs/data-hp-contract.json` — новые `data-hp` хуки (`space-select`,
  `space-select-value`, `select-trigger`, `select-menu`, `select-option`)
  промаркированы `"audience": ["test"]`, обратная совместимость заявлена
  (`additionsAreCompatible: true`), существующий хук `space-settings`
  расширен на `button` (компактная шестерёнка) без удаления `ha-icon`.
- `demo/helpers/hp-test.mjs` `switchSpace` — честный fallback: сначала ищет
  вкладку, иначе открывает попап через `select-trigger`/`select-option`;
  не считается «ослаблением» оракула, так как для широкого режима поведение
  не изменилось, а для компактного — использует реальный UI-путь, а не
  прямую запись `select.value`.
- Множество существующих смоков (`smoke_mobile_view_header`,
  `smoke_fixed_floor`, `smoke_stairs`, `smoke_render_perf`,
  `smoke_vacuum_camera`, `smoke_view_recovery`, `smoke_warm_dialogs`,
  `smoke_warm_mode_adoption`, `smoke_led_strip_glow`, `smoke_readonly_cold_start`,
  `smoke_test_facade`, `smoke_houseplan_panel`, `smoke_decor_*`,
  `smoke_editor_*`) адаптированы к наличию `[data-hp="space-select-value"]`
  как альтернативного источника текущего пространства — проверено, что
  фолбэк на `[data-hp="space-tab"]` сохранён везде, то есть у широких/старых
  сценариев (зафиксированная ширина >1024 px через явный `addStyleTag`)
  поведение не изменилось; местами явно расширен viewport/добавлен
  `page.addStyleTag` (`smoke_e2e_hooks`, `smoke_household_journeys`,
  `smoke_iso_floor_switch`, `smoke_space_tab_reorder`, `smoke_styling_hooks`),
  чтобы явно удержать эти единичные сценарии в широком (не компактном)
  варианте — осмысленно, так как они привязаны к вкладкам/reorder/native
  кнопкам, не к компактному полю.
- Golden ledger (`docs/release-ledger/v1.82.0/997.json`) перечисляет ~40
  существующих кадров как `expectation: change` с единой причиной (узкие
  вьюпорты ≤1024 px меняют высоту шапки/стейджа) — правдоподобно, так как
  перечисленные id (`tray-narrow-*`, `*-mobile-ru`, `*-narrow-*`,
  `support-phone-*`) действительно телефонные/узкие сцены.

## Находки

Нет High. Нет Medium в скоупе.

## Чего не проверял / границы

- Не выполнял повторно браузерные смоки/golden/gate — переиспользовано
  зелёное `validate-gate` на этом же материале (см. «Как проверялось»).
  Основание: независимое чтение не выявило ни одного AC, риска или
  negative-input кейса без пригодного доказательства, а входы/окружение/
  oracle с момента прогона не менялись.
- Не проверял полные трейлеры коммитов (Issue:/User-Visible:) напрямую —
  инструмент даёт только `--oneline` лог; доверился `process-gate.mjs
  --issues` (GREEN, 0 предупреждений) из принятого прогона, который и
  валидирует этот формат, плюс факт совместного изменения обоих CHANGELOG
  в материале.
- Не проверял прочие ~450 существующих browser-смоков вне diff-select —
  вне объёма ревью (риск/AC ограничены #707 и ТЗ issue).
- Полный regression и исполнение мутантов намеренно не входят в план этой
  задачи (зафиксировано в ТЗ §«План автотестов»); статическая регистрация
  (`mutation-gate.mjs --check`) подтверждена переиспользованным прогоном.

## Вердикт

Зелёный · High: 0 · Medium: 0 · маршрут: fix.

Рефакторинг — чистое извлечение представления навигации пространств в
`src/header-space-select.ts` с переиспользованием принятого UI-029
(`hp-settings-select`), все существующие guard'ы/права/hash/pinned/reorder
сохранены буквально, оба Medium из SPEC r1 закрыты в коде и смоках, бюджеты
и документация согласованы. Блокирующий цикл не расходуется.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImViOWEzMTAwNDM0ZjYzMTdlOGQ3M2VkNjA1YmM4YWM4NzQ2ODI4ODUyOTc5MTkyMDk5Y2EwMDg2OTQyNDlhYzUiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJkMTRiN2FjMDk0MzU0MmQ1YmJmZmQ5NjljNDgxNDczYTIwMWRmNWM2NmVlZDkyYzM1NjFmODhjNmUxMTUyZjM2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjo5OTcsInN0YWdlIjoiY29kZSIsInJvdW5kIjoxLCJtYXRlcmlhbCI6IjNjYWY3MTRjYzVhNzE4MWYwYmNmZTZhOTk3ZDhiNDczMTNmNmNlMDIiLCJ0cmVlIjoiY2RlMzU5NzE5YjkyYTI2ZGUzMzcxNmU2OTE0YTA3NDgzMjMzZDI1ZCIsImJvZHlEaWdlc3QiOiI4M2Y0ZjYxMmI0OWQ5YWVhOTFjMTYzYjJiZTgyNjU0ZDg1MTZmZWIxN2IyZjExMzg0MTlkNzNkY2EyMWNhYWU4IiwicHJvZHVjZXJSdW4iOiI0MDM3Mjk5NTUxMSIsInByb2R1Y2VyQXR0ZW1wdCI6IjEifSwicmVwb3J0RGlnZXN0IjoiOTA1YzNkNWVlNzFkY2EwZGNlZjY0NzNiMjYyZjA3MDEzNTg2M2ZkYTE1OGVlMTg1ZWY2MjBmNTMyMjU0ZTBiZSIsInZlcmRpY3REaWdlc3QiOiJkZWRkZTMwYTJhMDdmN2NmZTVhYjM4MGQxZGQ4YWI2ZWVkMzgwZjM3ZDgwNjE2ZWY0MGNiMzM0MTE1NjU3NDViIiwidmVyZGljdENhbm9uaWNhbERpZ2VzdCI6IjQzMDg5NDkxYjUwMWNmYjY5M2I5MTRkOGViYWQyZDE5ZDU3ZGRkOGNmMTlhYzBjNTg2ZTMwMTFhN2U1NGUwMzQiLCJmaW5kaW5ncyI6W10sImNvbW1lbnQiOnsiaWQiOjY0MjM2NDk1NjksInVybCI6Imh0dHBzOi8vZ2l0aHViLmNvbS9NYXR5c2gvaG91c2VwbGFuLWNhcmQvaXNzdWVzLzk5NyNpc3N1ZWNvbW1lbnQtNjQyMzY0OTU2OSIsImJvZHlEaWdlc3QiOiI2N2U2OTkwYzA4YzYwOGYyYjM0MTllMzg4MmRjZTg2YTc1NjUyMWZmYTY1ZDE0ZjUwMzRjNDMyOTA5MGJkMzgxIn19fQ -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/997-compact-space-navigation`, коммит `3caf714cc5a7` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `cde359719b92a26de33716e6914a07483233d25d`
  ```
  git log --all --format='%H %T' | grep cde359719b92
  ```
- Тело issue: `83f4f612b49d9aea91c163b2be82654d8516feb17b2f1138419d73dca21caae8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40372995511,"run_attempt":1,"digest":"1f4820105a1758222c7489cd5c081d7aa1db2696949597c6363c87f4f0710bd5"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjIsIm91dHB1dF90b2tlbnMiOjM2NjY2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE4MTE2NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQwNDg0MTgsImNvc3RVc2RFc3RpbWF0ZSI6MS45MDExMzU2fV0sInR1cm5zIjozOCwiZHVyYXRpb25NcyI6NDc1Mjk4LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS45MDExMzU2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=62 output_tokens=36666 cache_creation_input_tokens=181167 cache_read_input_tokens=4048418 num_turns=38 -->
