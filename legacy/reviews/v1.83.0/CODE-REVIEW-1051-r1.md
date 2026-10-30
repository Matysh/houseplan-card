# CODE-REVIEW-1051-r1

Issue: #1051 · трек: ask · этап: code · заход: r1 · блокирующих циклов: 0/4
Материал: `de1b1c10d5e09a949077d3f5d0546b499413df24` (рабочая копия на нём, `git status` чист, `HEAD` detached на этом SHA)
SPEC: зелёный r1 (`docs/reviews/SPEC-REVIEW-1051-r1.md`)
Validate-gate (review-light): https://github.com/Matysh/houseplan-card/actions/runs/40062380889 — proof accepted (review-light-golden proof is complete), используется как принятое доказательство без повтора.

## Скоуп

ТЗ #1051 (§ ТЗ тела issue, 11 пунктов UI-019–UI-028/UI-031): перенести в продукт
согласованные в UI Lab правки общего UI Kit — компактная панель действий
мебели/декора (UI-019), диалог свойств мебели (UI-020), прямой ввод HEX/процента
в боковой панели Properties (UI-021), общий tooltip образца цвета (UI-022), общий
спойлер `disclosure()` для обоих Zigbee-разделов (UI-023), hover текстовых ссылок
(UI-024), порядок секций «Оформление комнат» (UI-025), синяя заливка выбранного
устройства и исправление `focus-visible` после Tab→Space (UI-026), убрать
добавочное свечение выделения декора (UI-027), курсор инструмента «Выбрать»
только над доступной стеной (UI-028) и единое контекстное меню UI Kit (UI-031).
Модель данных, сохранение, геометрия и бизнес-логика диагностики не меняются;
UI-029/UI-030 (#998/#999) и новые команды (#1045/#1050) исключены.

Диапазон: `git log --oneline origin/dev..HEAD` — 11 коммитов (4×fix/feat,
2×refactor/test, 3×chore/test, 2×merge принятых зависимостей/SPEC-доставок).
Диф: `git diff origin/dev...HEAD` — 74 файла, +1595/−342: новый общий
`src/editor-context-menu.ts`/`.styles.ts`, новый `src/catalog-context-menu.ts`,
новый `src/editors/disclosure-motion.ts`, новый `src/editors/properties/color-draft.ts`,
точечные правки `decor-order-editor.ts`, `device-copy-editor.ts`,
`device-inbox-menu.ts`, `houseplan-editor-runtime.ts`, `editors/properties/{editor,
selection,controller,surface,styles}.ts`, `editors/space-form.ts`, `led-strip-editor.ts`,
стили (`devices`, `plan`, `dialog-composition`, `form-kit`, `settings-dialogs`,
`editor-dialogs`, `vacuum-settings`), i18n (`de/en/fr/ru` `tools`), docs
(`DIALOG-UI-KIT.md` новый, `USER-GUIDE.ru.md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`,
`STATUS.md`, changelog ×2), `release-ledger/v1.82.0/1051.json`, registry/inventory/
monolith-baseline/bundle-budget, тесты (новый `properties-color-draft.test.mjs`,
обновлённые `device-copy-editor`, `device-marker-polish-contract`,
`editor-dialog-styles`, `form-kit`, `geometry-history-refusal`, `golden-matrix`,
`browser-attestation`).

## Риск по изменённым участкам (#707)

Задача на треке `ask`, поэтому ниже — сверка каждого класса с покрывающим его AC,
а не критерий `show` (§5).

| Класс (из промпта) | Где это зафиксировано | Проверено |
|---|---|---|
| touch: удалённые `pointerdown`/`contextmenu` обработчики в `decor-order-editor.ts`, `device-copy-editor.ts` и ещё 10 мест | UI-031, AC6 («Escape/outside/focus, rapid reopen/reduced motion», «команда исполняется один раз; исчезающий слой неинтерактивен») | Код прочитан: старые локальные `window.addEventListener('pointerdown'/'keydown', …)` и ручная разметка меню удалены из `decor-order-editor.ts` и `device-copy-editor.ts` и заменены делегированием в общий `EditorContextMenu` (`src/editor-context-menu.ts`), который сам ставит `pointerdown/keydown/focusin/scroll/resize` слушатели, снимает их в `unlisten()`, и помечает выходящий узел `inert`+`aria-hidden` в `retire()` до фейда. Флаг `invoked` в `render()` гарантирует ровно одно выполнение команды. Это source-replacement, не дублирование путей (НЕ сделано в хендоффе честно называет единственный осознанно оставленный мёртвый CSS `src/styles/chrome.styles.ts:.menuwrap/.menu .hd` с отсылкой на #1019 — проверено `grep`, других живых дублей не найдено) |
| perf: добавленные/перенесённые `getBoundingClientRect` в `catalog-context-menu.ts`, `decor-order-editor.ts` (удалено), `device-inbox-menu.ts` (удалено) и ещё 16 мест | Явный риск-класс автора («объём/performance — menu/disclosure lifecycle и длинные подписи», покрывает AC2–AC7) | Код прочитан: все вызовы — в `place()`/`mount()`/`viewport()` `EditorContextMenu` и в `open()` `CatalogContextMenu`, которые выполняются только при открытии/репозиционировании меню (`scroll`/`resize`/`visualViewport` события), не в цикле рендера карточки. Старая функция `positionInboxMenu` с тем же паттерном удалена вместе с `<details>`-разметкой — перенос, а не добавление нового постоянного измерения |
| ux: новые i18n-ключи `decor.color_caption`, `decor.transparency_summary` | UI-020 («Строка цвета: «Цвет:» → образец → HEX → «прозрачность N%»») и раздел ТЗ «Модель данных, i18n» | Проверено построчно по всем 4 поддерживаемым языкам (`de/en/fr/ru`, других файлов `src/i18n/tools/*.json` в репозитории нет) — оба ключа добавлены везде, ru/en текст совпадает с формулировками ТЗ дословно («Цвет:»/«Color:», «прозрачность {n}%»/«transparency {n}%») |

Все три класса покрыты названными AC/документом; `route: reclassify` не требуется
(трек и так `ask`).

## Как проверялось

Задача пришла с принятым CI на материале: Validate 40062380889 SUCCESS на
`de1b1c10d`, canonical browser job 120786363876 — 223 passed smokes + 7 passed
selected Golden по объявленному intent (6 new + 1 change), failed 0,
неисполненных 0; build fingerprint совпал с предыдущим прогоном на f4d050e4a
(PNG побитно идентичны, 7/7). Golden `ui-1051-{color,menu,device}-{light,dark}`
и `tray-medium-selection-ru` соответствуют `visual` в `release-ledger/v1.82.0/1051.json`.
Это принятое доказательство AC1/AC7 используется как есть, без повторного запуска.

Дополнительно к принятому proof выполнены только адресные непокрытые проверки:

| Проверка | Команда/способ | Результат |
|---|---|---|
| Статический реестр мутантов (объявление, не исполнение) | `node scripts/mutation-registry.mjs --check` | PASS, exit 0 — все патчи (включая 6 новых `*-1051` witness) бьют ровно один раз |
| Живость 6 зарегистрированных `*-1051` witness из таблицы «чем краснеет» | `grep -F` точного `find`-якоря каждого патча по актуальному исходнику | Все 6 (`ui-inline-opacity-loses-grid-slot-1051`, `ui-led-menu-keeps-scene-pan-1051`, `ui-menu-close-retains-input-1051`, `ui-selected-device-loses-blue-1051`, `ui-plan-pointer-misses-hit-1051`, `ui-colour-preview-borrows-owner-1051`) совпали — не мёртвые регистрации |
| Трейлеры `Issue:`/`User-Visible:` на всех 8 некоторых-мерж коммитах класса A/B | `git log -1 --format=%B` по каждому коммиту | Присутствуют на всех; `User-Visible: yes` — на 2 (`9a55e2e06`, `dee521b2e`, `f4d050e4a`) — все три правят оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в том же диапазоне (сверено `git diff` — записи на месте, по одному общему абзацу (#1051) на обоих языках, без дублирования чисел) |
| Смысловая связь дифф↔смоки | `node scripts/smoke-select.mjs --base 39a3d38c8 --head HEAD` | Зарегистрированные (`smoke-links.mjs`) связи для новых файлов (`editor-context-menu*`, `catalog-context-menu.ts`, `color-draft.ts`, `disclosure-motion.ts`) указывают ровно на `smoke_ui_1051(_native)`, `smoke_ui_polish_976`, `smoke_zigbee_incomplete_reasons`, `smoke_dialog_ui_kit`, `smoke_decor_order`, `smoke_device_copy`, `smoke_properties_panel` — все перечислены PASS в хендоффе и покрыты каноническим 223-смоковым прогоном выше |
| Чтение кода без исполнения: UI-025 порядок секций, UI-026/027 селекторы выделения, UI-028 hit-resolver, UI-021 draft/commit контракт, UI-023 disclosure motion/scroll | `git diff`/`Read` целевых файлов | см. раздел «Проверено и корректно» |

Мутанты не исполнялись (ночной процесс вне этого ревью, политика §2.7/#905).
Golden/full regression не перезапускались — задача раунда не меняла их входы.

## Находки

Находок уровня High или Medium нет.

## Проверено и корректно

- **UI-031 (общее меню).** `EditorContextMenu` — единая реализация для
  `DeviceCopyEditor`, `DecorOrderEditor`, `CatalogContextMenu` (новый, для строк
  каталога устройств). Порядок пунктов декора — `front, back, copy, delete`
  (delete последний, как того требует контракт); device-copy сохраняет
  `returnFocus`/контекст записи неизменными. `retire()` ставит `inert`/
  `aria-hidden` и снимает слушатели **до** фейда (140ms, только opacity),
  открытие — 180ms ease-out, `translateY(-10px→0)`, `prefers-reduced-motion`
  отключает обе анимации — совпадает построчно с контрактом UI-031.
  LED-путь делегирует в тот же `_ctxDevice`/`DeviceCopyEditor`, отдельного
  упоминания в адресной карте не требовалось (решено уже в SPEC r1).
- **Source-replacement.** Старая `<details>`-разметка и `positionInboxMenu`
  (`device-inbox-menu.ts`) удалены вместе с CSS (`device-inbox-menu-items`,
  `.vacpicker > summary`, `:host([data-pointer-hover]) .aboutlink:hover`) —
  проверено, что замена, а не дублирование: старые токены `pointerdown`,
  `contextmenu`, `getBoundingClientRect` из риск-таблицы действительно удалены
  из исходных файлов, а не оставлены рядом с новыми.
- **UI-026/UI-027 (выделение).** `renderPropertiesSelection` больше не рисует
  круг/маркер вокруг устройства (`target.kind === 'device'` исключён из
  `render`); `devices.styles.ts` добавляет независимый (через запятую, не AND)
  селектор `.stage.mode-devices .dev.sel:not(.unavail):not(.alarm):not(.ghost)`
  с тем же `#0C82F0`/контрастной иконкой, что и hover — заливка не привязана к
  `:host([data-pointer-hover])` и переживает уход мыши. `.dev.sel { --device-ring-*
  }` удалён; `:focus-visible:not(.mode-devices .sel)` (комплексный `:not()`,
  поддержан целевым Chromium 151) не даёт focus-visible перекрашивать иконку
  поверх уже синего выделенного устройства — закрывает именно Tab→Space кейс
  контракта.
- **UI-028 (курсор).** `PropertiesEditor.hoverPlan/paintPlanHover` переиспользуют
  существующий `planHit` (тот же resolver, что и `selectPlanPoint`, включая
  допуск по `_cellCm`/`GRID_PITCH`), не создавая новый алгоритм геометрии;
  `data-plan-select-hit` гейтится инструментом `select`, режимом `plan` и
  отсутствием блокирующего диалога — соответствует «не расширять область
  захвата» и «сохранить приоритет проёмов» (resolver не менялся).
- **UI-021 (inline HEX/opacity).** `color-draft.ts` — чистые функции без
  побочных эффектов; `propertiesColorDraft`/`editPropertiesColor`/
  `parsePropertiesColor` отдельно проверены новым `test/properties-color-draft.test.mjs`
  (подключает реальный `test-build/.../controller.js`, не мок): 3/6-значный HEX
  с `#`/без, некорректный/неполный ввод не коммитится и не теряет последний
  валидный предпросмотр, опциональный `noFill` сохраняется, Enter и blur дают
  один и тот же `finish()` → один `commit`, `cancel()`/замена identity/authority
  сбрасывают `previewDraft` без записи. Это решает «ordinary RED→PASS» пункт
  из хендоффа (`f4d050e4a`: CSS-специфичность `.hpf-colorfield > .hpf-opacity.
  hpf-inline-opacity` вместо глобального `.hpf-inline-opacity`, что раньше
  клипало текст 100%).
- **UI-025 (порядок секций).** `space-form.ts`: `name → border → wall-fill →
  fill-mode-select → [fill, только custom/none] → [temp, только temp]` — ровно
  порядок контракта (названия/условия полей не менялись), перестановка — в
  самом массиве рендера, а не через CSS `order`.
- **UI-023 (спойлер).** `disclosure-motion.ts`: `duration=220`,
  `easing='cubic-bezier(.2,0,.2,1)'`, `scrollHeading` останавливается на
  `hp-dialog`/`body`/`documentElement` без прокрутки страницы, использует
  `assignedSlot`/`getRootNode().host` вместо приватных HA-селекторов; `content.inert`
  синхронизирован с `aria-hidden`. Применяется и к ручному ZHA/Z2M, и к причинам
  неполноты (эталон теста обновлён на использование общего триугольника вместо
  старого компактного 12px-маркера — ожидаемое изменение, не регрессия).
- **i18n/changelog/release-ledger.** Новые ключи — во всех 4 языках, текст
  совпадает с ТЗ; оба changelog (`ru`/`en`) получили один согласованный абзац
  без дублирования чисел; `release-ledger/v1.82.0/1051.json` — `stable-fix`
  относительно v1.82.0 с обоснованием (UI Kit поверх уже стабильных редакторов
  декора/мебели/устройств/пространства) — авторское суждение, оспаривать не
  вижу оснований: все перечисленные поверхности (Properties, decor, устройства,
  Space, Zigbee-диагностика) действительно в стабильном v1.82.0, новой
  подсистемы не создано.
- **Lazy/bundle budget.** `LAZY_EDITOR_GZIP_CEILING` поднят на измеренный
  (не суммированный с чужих веток) прирост +4220 Б / 1.24% к принятой базе
  #1046, с прежней полосой 2000 Б и абсолютным initial-View бюджетом
  352000 Б нетронутым; обоснование — разрешение владельца, процитированные
  комментарии существуют в треде issue.
- **Границы скоупа.** `grep`/чтение ТЗ подтверждают: UI-029/UI-030 (#998/#999),
  #1045/#1054/#1019 действительно не реализованы в этом диффе («НЕ сделано»
  в хендоффе соответствует факту).

## Чего не проверял

- Ручного браузерного прогона не делал — доверился принятому Validate-gate
  (223 smokes + 7 golden PASS на точном материале `de1b1c10d`) и собственному
  построчному чтению кода; это разрешено правилами (принятый proof не
  повторяется, адресный пробел не найден).
- Полную матрицу golden/`ci:full`/мутанты ночного реестра не запускал —
  не входит в объём ревью (§8, предрелизный гейт).
- `pytest tests_backend` — не запускал: диф не касается `custom_components/houseplan/**`.
- `npm run invariants` — не запускал: геометрическая модель не менялась
  (`planHit` переиспользует существующий resolver, новых полей/расчётов нет).
- Физическое touch/GPU-поведение не проверял — задача сама заявляет
  desktop-first/best-effort на touch (`docs/TOUCH-SUPPORT.md`), headless
  Chromium это honestly не покрывает, и в этом ревью это не AC.
- Побочные находки вне скоупа #1051 не искал специально и не нашёл ни одной
  в ходе проверки риск-классов и выборочного чтения остальных файлов диффа.

## Побочные находки

Доверенный снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`: `mode=issues`.
Побочных находок вне скоупа #1051 не обнаружено — новых issue не заводил.

## Вердикт

route: fix (трек `ask` — поле `route` не варьируется критерием §5).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1051-approved-ui-kit`, коммит `de1b1c10d5e0` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b4d17ac2e220ee017586ff94f085cfe79dee2853`
  ```
  git log --all --format='%H %T' | grep b4d17ac2e220
  ```
- Тело issue: `e10140ed2b865e6033d56639b0e68fdd4077658b18ba3e7a707c800891e9eb2a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyNDMsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzMzfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4NCwib3V0cHV0X3Rva2VucyI6MjkzOTQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTc3MTg0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDk2MDMyNiwiY29zdFVzZEVzdGltYXRlIjoxLjk5NDkwOTJ9XSwidHVybnMiOjUyLCJkdXJhdGlvbk1zIjozNTk2NjEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjAwMDI0MjIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5327 output_tokens=29412 cache_creation_input_tokens=177184 cache_read_input_tokens=4960326 num_turns=52 -->
