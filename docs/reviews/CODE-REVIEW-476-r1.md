# CODE-REVIEW-476-r1

- **Issue:** #476 — Явное завершение выбора цвета кнопкой «ОК»
- **Этап:** код-ревью (PROCESS.md §2.7), заход r1, блокирующих циклов израсходовано 0 из 4
- **Ветка:** `issue/476-color-picker-ok`, HEAD `b5a1001e` (приведена к `dev` конвейером,
  поверх легло 4 коммита `dev`: `34a6b276 → b5a1001e`). Разбор — полный, не по дельте
  (ребейз на ушедший вперёд `dev`, §7.2/§2.10).
- **Диапазон:** `git log --oneline origin/dev..HEAD` — 7 коммитов (2 ТЗ, 2 документа
  ревью ТЗ, 3 реализации); материал — `git diff origin/dev...HEAD`, 53 файла.
- **ТЗ:** `docs/specs/476-color-picker-ok.md`, лёгкий трек не применялся (полный трек по
  собственному решению аналитики — новый UX-контракт), ревью ТЗ зелёное на r2
  (`docs/reviews/SPEC-REVIEW-476-r2.md`).

## Скоуп диффа

Общий `hp-color-opacity`: полноширинная кнопка «ОК» (последний DOM-control),
CSS-контракт (100% width, ≥40px, forced-colors), новый признак `_hexNeedsValidInput`
(защита от снятия ошибки повторным «ОК» без нового ввода), `color_picker.confirm` в
4 словарях, per-card labels в `houseplan-card.ts`, обновлённые unit/i18n-тесты,
расширенный `demo/smoke_color_picker.mjs` и правки `demo/smoke_help_affordance.mjs`
(fallback-путь), запись в `scripts/smoke-links.mjs`, оба changelog, `docs/TESTING.md`,
пересобранные `dist/**`/`custom_components/houseplan/frontend/**`, обновлённый
`docs/images/screenshots.json` (только fingerprint, PNG не менялись). Backend, модель
геометрии, config/storage не затронуты.

## Как проверялось

Зелёного Validate на `b5a1001e` не найдено — прогнал дешёвые и часть тяжёлых гейтов сам.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без вывода |
| Unit-тесты | `npm test` | `2077 tests, pass 2076, fail 0, skipped 1` — совпадает с заявленным в хендоффе |
| Build + sync | `npm run build && npm run bundle:sync` | `dist` собран; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — идентичны; `git status --short` после `bundle:sync` пуст (demo/srv/assets, custom_components и dist совпадают с закоммиченным, включая несобственную копию стенда) |
| Docs-гейт | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 12 external links)` — обязателен, diff трогает `src/**` |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет» (59 добавленных строк в 2 файлах) |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Зарегистрированная связь (2): `smoke_color_picker.mjs`, `smoke_help_affordance.mjs`. Слабая связь (15, общее имя `stopPropagation`) — просмотрел список: `smoke_cover_*`, `smoke_decor`, `smoke_edit_walk`, `smoke_editor_gestures`, `smoke_furniture`, `smoke_hide_layers`, `smoke_inert_openings`, `smoke_modes`, `smoke_room_cards`, `smoke_space_settings`, `smoke_tap_ctx`, `smoke_tap_run`, `smoke_toggle_confirmation`, `smoke_value_face_source` — все про другие компоненты, ни один не адресует `hp-color-opacity`; не гонял |
| Целевой смок 1 | `node demo/smoke_color_picker.mjs` | `OK`, все 21 поле `true` |
| Целевой смок 2 | `node demo/smoke_help_affordance.mjs` | `OK`, все поля `true`, включая новые `fallbackPickerHasConfirm`/`fallbackPickerConfirmCloses` |
| Bundle budget | `npm run bundle:budget` | initial View `299683 B` gzip, потолок `300500±2000` — в бюджете; `::warning::` про низкий запас (1383 Б) — долг #367, не новый и не вызван этим диффом |
| Golden (advisory) | `npm run golden:verify` | 5 названных ТЗ сцен (`decor-color-popover-mobile-ru`, `decor-color-popover-desktop-en`, `general-color-popover-desktop-en`, `device-ripple-color-popover-mobile-ru`, `space-room-color-popover-desktop-ru`) — `different`, ожидаемо (новая кнопка); остальные ~100 сцен — `passed`. Просмотрел `actual/`+`diff/` для обеих цветовых сцен глазами — разница только в кнопке и вертикальном сдвиге содержимого попапа, цвет/геометрия/тема не поехали. Принятие эталонов — предрелизный гейт (`golden:accept -- --reviewed` на Linux CI), не гейт код-ревью; автор в хендоффе прямо назвал это «НЕ сделано» |
| Docs screenshots | ссылка автора: run `34029831929` | `gh run view` → `completed/success`; SHA `ce07db74` — предок HEAD; `check-docs.mjs` на HEAD зелёный, то есть текущий фингерпринт уже совпадает с деревом |
| Process-gate | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» |
| Трейлеры | `git log origin/dev..HEAD` (7 коммитов) | у всех `Issue: #476`; `11cc5386` (реализация) — `User-Visible: yes`, оба changelog в том же коммите; остальные 6 — `User-Visible: no` |

**Мутации, прогнанные лично** (§2.7 «чем краснеет», защитные AC):

| # | Мутация | Файл | Прогон | Результат |
|---|---|---|---|---|
| 1 | Снял ветку `if (this._hexNeedsValidInput) { this._hexInvalid = true; return; }` в `_commitHex` — повторное «ОК» без нового ввода закрывало бы picker | `src/hp-color-opacity.ts` | `npm run bundle:sync && node demo/smoke_color_picker.mjs` | `repeatedConfirmCannotBypassInvalidHex: expected true, got false` — тест красится, как обязан (см. M1) |
| 2 | Убрал `if (normalized !== this._lastValidColor)` — `_commitHex` эмитит всегда | `src/hp-color-opacity.ts` | то же | `confirmClosesWithoutDuplicateOrClickThrough: false`, `validCorrectionAllowsConfirm: false` — AC2 доказан исполнением |
| 3 | Убрал `event.stopPropagation()` из `_confirm` | `src/hp-color-opacity.ts` | то же + отдельный probe-скрипт с листенерами на каждом уровне DOM | `confirmClosesWithoutDuplicateOrClickThrough: true` — **тест НЕ покраснел** (см. M2); probe показал, что событие гасится на `.editor-secondary`, на один уровень выше `hp-color-opacity`, независимо от этой мутации |

После каждой мутации источник восстановлен из `git show HEAD:src/hp-color-opacity.ts`,
`npm run bundle:sync` прогнан повторно, `git status --short` — пусто, `demo/smoke_color_picker.mjs`
снова `OK` (проверено).

**Не гонял и почему:**
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.
- `npm run invariants` — diff не меняет рёбра комнат, записи толщины, `layout`,
  `marker.space`, `open_spans`; геометрия не затронута.
- Performance-профили — не названы в AC; §15 ТЗ обоснованно утверждает отсутствие
  влияния (один статический `button`, один `click`-handler в уже открытом lazy-picker).
- Полная матрица `demo/smoke_*.mjs` и полный `scripts/mutation-gate.mjs` — предрелизные
  гейты (PROCESS §8), не гейт код-ревью; по дельте прогнаны только зарегистрированные
  смоки плюс личные точечные мутации.
- `npm run golden:accept` — не моя роль на этом этапе; смотри выше.

## Находки

### Medium (в скоупе задачи, обе)

**M1 — AC4: защита от обхода невалидного HEX повторным «ОК» не имеет постоянного
свидетеля в `scripts/mutation-gate.mjs`.**

Признак `_hexNeedsValidInput` — это ровно то, что r1 ревью ТЗ потребовало добавить
(`SPEC-REVIEW-476-r1.md`), и ровно то, что доказывается только браузерным смоком
(`demo/smoke_color_picker.mjs`, дорогой гейт: пересборка бандла + Chromium). По
PROCESS.md §2.7: «Мутант в `scripts/mutation-gate.mjs` обязателен, когда защита живёт
в продуктовом коде и проверяется дорогим гейтом… там ревьюер не воспроизведёт
отрицательный прогон второй раз». Диф не добавляет ни одной записи в
`scripts/mutation-gate.mjs` (только запись-указатель в `scripts/smoke-links.mjs`, это
другой реестр — для выбора смоков, не для мутационного гейта).

Я лично применил ровно эту мутацию (см. таблицу выше, #1) и получил красный
`repeatedConfirmCannotBypassInvalidHex`, так что защита реальна и смок сегодня её ловит
— но без постоянной записи в реестре это разовое доказательство ревьюера, а не
воспроизводимый гейт: следующий рефакторинг того же кода останется незамеченным, если
не начитает эту главу отчёта.

**Чинится:** зарегистрировать мутант (по образцу #366/#384/#330 — `guard: node
demo/smoke_color_picker.mjs`, патч — снятие ветки `if (this._hexNeedsValidInput)` в
`_commitHex`), прогнать `node scripts/mutation-gate.mjs --check` и целевой `--id=`.

**M2 — AC3/§7.2.4: заявленная защита «клик не проваливается в план/toolbar под
поверхностью» не имеет проверки, способной упасть на снятой защите.**

Я убрал `event.stopPropagation()` из `_confirm` (единственный код защиты, добавленный
этой задачей) и прогнал `demo/smoke_color_picker.mjs` — `confirmClosesWithoutDuplicateOrClickThrough`
остался `true`. Добавил зонды-слушатели на каждом уровне DOM (кнопка → `.picker` →
shadowRoot picker → хост `hp-color-opacity` → `.editor-secondary` → shadowRoot `card`
→ `card`) и увидел, что событие в проверяемом сценарии (decor-tool color внутри
`.editor-secondary`) гасится ещё на `.editor-secondary`, на уровень выше самого
пикера, независимо от того, вызывает ли `_confirm` `stopPropagation()`.

Продуктового бага здесь нет — клик в план сегодня не проваливается, даже с двойным
запасом. Но это значит, что заявленная в АС3/§7.2.4 защита самого `hp-color-opacity`
не доказана ни одним тестом, который способен упасть: в единственном
протестированном потребителе есть посторонний внешний гаситель, а другие потребители
общего пикера (general settings, room/space, ripple color) не обязательно обёрнуты
таким же контейнером — для них `_confirm`'s `stopPropagation()` может быть
единственной защитой, и она никем не проверяется.

**Чинится** одним из двух путей: (а) перенести click-through-пробу в потребителя без
такого внешнего гасителя (например, `general-color` или `device-ripple-color`,
благо они уже в golden-матрице) так, чтобы снятие `stopPropagation()` красило смок;
либо (б) зарегистрировать мутант в `scripts/mutation-gate.mjs` с guard'ом на
`demo/smoke_color_picker.mjs`, но тогда сам смок сначала должен научиться падать по
пункту (а) — иначе мутант зарегистрирован, но бесполезен.

High: 0. Medium вне скоупа: 0.

### Low (сняты с записью, не блокируют)

- **L1** `src/houseplan-card.ts:5932` — `invalidHex: …, confirm: …` на одной строке
  (`git diff` слепил две записи объекта). Чисто косметика, синтаксис и typecheck
  корректны; не мешает чтению настолько, чтобы требовать отдельного цикла. Снято.
- **L2** AC3 «keyboard activation» (Enter/Space по кнопке) проверяется в смоке только
  через `.click()`, не через реальный `KeyboardEvent`. Риск исчезающий: кнопка —
  нативный `<button type="button">` без собственного `keydown`-перехватчика, поэтому
  активация с клавиатуры и мышью в браузере производят один и тот же `click`. Снято.
- **L3** AC5 в ТЗ (§12) декларирует доказательство «smoke» для всех путей закрытия
  (`outside pointer`, `trigger`, `Escape`), но ни `demo/smoke_color_picker.mjs`, ни
  unit-тесты не проверяют `outside pointer` и повторный клик по `trigger` — ни до
  этой задачи, ни после (проверил `git show origin/dev:demo/smoke_color_picker.mjs`
  — тоже нет). Код `_outsidePointerDown` и ветка закрытия в `_toggle()` этим диффом
  не тронуты (проверено чтением, не исполнением) — риска регрессии нет, `Escape`
  же покрыт и прогнан зелёным. Пред-существующий пробел плана тестов, не этой
  задачи; попутно не чиню (§ «скоуп не расширяется»), фиксирую, чтобы не читать
  как «покрыто», когда это не так.

## AC — таблица доказательств (весь список, r1)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 видимая кнопка/геометрия | unit (`color-picker.test.mjs`: `width:100%`, `min-height:40px`, DOM-порядок) + `golden:verify` (5 сцен, диф — только кнопка, см. выше) | не защитный AC (расположение/CSS), правило §2.7 не требует столбца |
| AC2 live parity, без дублирующего события | smoke `confirmClosesWithoutDuplicateOrClickThrough`, `validCorrectionAllowsConfirm` | мутация #2 лично: `_commitHex` эмитит всегда → оба поля `false` |
| AC3 успешное завершение / без click-through | smoke `confirmClosesWithoutDuplicateOrClickThrough` (aria-expanded, focus, `parentClicks`) | click-through часть — **не красится** (M2); закрытие/фокус — красится (проверено логикой `_closePicker(true)`, не мутировал отдельно, риск низкий, код тривиален) |
| AC4 невалидный HEX / защита от обхода | unit (regex на `_hexNeedsValidInput`) + smoke `invalidHex*`, `repeatedConfirmCannotBypassInvalidHex` | мутация #1 лично: красное (M1 — нет постоянной регистрации) |
| AC5 прежние close paths | smoke `escapeClosesFirstAndRefocuses` (Escape); outside/trigger — не проверены автотестом, проверено чтением (L3) | Escape: не мутировал отдельно, код path нетронут диффом |
| AC6 i18n/a11y | unit (`test/i18n.test.mjs`, `color-picker.test.mjs` — EN/RU/DE/FR parity, DOM-порядок = порядок Tab) + smoke `englishLabels`/`cardLanguageOwnsCopy` | не защитный AC (текст/раскладка) |
| AC7 touch/fallback/lifecycle | smoke `confirmIsFullWidthTouchTarget`, `smoke_help_affordance.mjs` (`fallbackPickerHasConfirm`, `fallbackPickerConfirmCloses`) | не мутировал; оба пути (Popover/fallback) реально прогнаны через разные смоки, расхождения нет |
| AC8 совместимость/release/бюджеты | `no-new-any`, `check-docs`, `bundle:budget`, оба changelog в одном коммите (см. таблицу гейтов) | не защитный AC в терминах §2.7 |

## Что проверено и корректно

- Состояние `_hexNeedsValidInput` синхронно с §7.3 ТЗ: снимается только новым
  `input`-событием с валидным HEX (`_hexInput`), не снимается нормализацией draft в
  `_commitHex`, не снимается повторным «ОК», не снимается `blur` — прочитано построчно
  и подтверждено мутацией #1.
- `_hexDraft`/`_lastValidColor` остаются синхронными после любого live-изменения (hue/
  sat/val/opacity тоже проходят через `_emit`, который обновляет `_hexDraft`), поэтому
  обычное «ОК» после слайдеров не создаёт дублирующий emit — подтверждено мутацией #2
  от противного и штатным прогоном смока.
- Кнопка — последний DOM-control независимо от `showOpacity` (проверено и unit-, и
  smoke-ассертами на разных инстансах, включая `showOpacity=false`).
- i18n: 4 языка добавлены синхронно; DE/FR allow-list для омографов с EN обновлён
  обоснованно (`OK` там действительно совпадает с английским текстом — это ожидаемый
  омограф, а не пропущенный перевод).
- Оба changelog в одном `User-Visible: yes` коммите (`11cc5386`), трейлеры на всех 7
  коммитах корректны, ветка/issue совпадают.
- Backend, config, миграция, геометрия не затронуты — соответствует ТЗ §10 и §6
  (не входит).
- Golden-diff глазами: разница ровно в кнопке и вертикальном сдвиге контента, ничего
  постороннего не поехало ни в одной из 5 сцен.

## Чего не проверял

- `pytest tests_backend`, `npm run invariants`, performance-профили, полная матрица
  `demo/smoke_*.mjs`, полный `scripts/mutation-gate.mjs`, `golden:accept` — см.
  обоснование в таблице гейтов выше.
- 15 «слабых» смоков по `stopPropagation` из вывода `smoke-select.mjs` — просмотрел
  список имён, все про другие поверхности, не про `hp-color-opacity`; не гонял.

## Вывод

High: 0. Medium в скоупе: 2 (M1, M2) — обе чинятся в этой же задаче, без отдельного
issue (#202). Verdict: жёлтый.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/476-color-picker-ok`, коммит `34a6b276473c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `94485fdc0eca504692dd2776c7f3c86518a8dfb9`
  ```
  git log --all --format='%H %T' | grep 94485fdc0eca
  ```
- ТЗ `docs/specs/476-color-picker-ok.md`, блоб `d21066d56e69c35fe7d0b40d9f965968dac9f803`
  ```
  git log --all --find-object=d21066d56e69c35fe7d0b40d9f965968dac9f803 -- docs/specs/476-color-picker-ok.md
  ```
