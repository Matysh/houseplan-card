# CODE-REVIEW-1008-r1

Issue: #1008 · Колор-пикер: выравнивание бегунков и единое оформление трёх цветовых шкал
Трек: ask · Этап: code · Заход: r1 · блокирующих циклов использовано 0/4
Материал: `3f82bcb6ce8c386c61891a4ddfd55791a7e885c4` (рабочая копия на нём, `git rev-parse HEAD` сверен)
Диапазон: `origin/dev..HEAD`, 5 коммитов, диапазон `origin/dev...HEAD` — 21 файл

## Скоуп

ТЗ (зелёное ревью SPEC-REVIEW-1008-r1) требует в общем `src/hp-color-opacity.ts`:
единый CSS-класс и геометрию для трёх HSV-ranges (круглый бегунок 20 px поверх
дорожки 10 px, вертикально центрированный на любой позиции), центр каждого
бегунка показывает текущий результирующий цвет, динамические градиенты S/V по
заданным формулам, единые hover/focus-visible/active кольца (42%/65% accent),
сохранение всей существующей семантики (события, draft, Save/Cancel,
клавиатура, перетаскивание, opacity, позиционирование попапа, forced-colors,
reduced-motion). Не-скоуп (не затронут): SV-поле, сами диалоги, backend,
сериализация, геометрия плана — подтверждено чтением диффа.

Диапазон правок: `src/hp-color-opacity.ts` (продукт), новый
`demo/smoke_color_picker_presentation.mjs`, правка `demo/smoke_color_picker.mjs`,
`test/color-picker.test.mjs` (старый CSS-regex тест заменён комментарием —
переезд на браузерный paint-oracle), `scripts/mutation-registry.mjs` +
`docs/testing-notes/mutation-browser-guards.md` (5 новых зарегистрированных
мутантов #1008), 5 golden PNG + индекс, `docs/release-ledger/v1.82.0/1008.json`,
оба CHANGELOG, ARCHITECTURE/DEVELOPMENT/STATUS/USER-GUIDE (RU+EN).

## Как проверялось

Зелёного Validate на `3f82bcb6c` на момент ревью не было (последний запуск
model review оборвался на стадии S6↔S7, см. комментарий от автора
2026-10-22T07:53:15Z) — все гейты ниже я прогнал сам на точном материале.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS, 0 ошибок |
| Юнит-тесты | `npm test` | PASS: tests 5542 (с подтестами), pass 5541, fail 0, skipped 1 |
| Сборка | `npm run build` | PASS, `dist` собран |
| Bundle policy | `node scripts/bundle-policy.mjs --verify` (после `bundle-sync.mjs`) | PASS, корректно поясняет, что закоммиченная копия не сверяется на обычной задаче (#657) |
| Smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прямое совпадение: `smoke_color_picker_presentation`, `smoke_color_picker` |
| Названный smoke | `node demo/smoke_color_picker.mjs` | OK (все пункты true) |
| Названный smoke (новый, AC1/AC2/AC3) | `node demo/smoke_color_picker_presentation.mjs` | OK — все пункты true, включая `forcedColorsFocus`, `colorUpdatesPreserveControllerPlacementBeforePaint`, 5 `consumer-*`, `fallback-320*` |
| Consumer/lifecycle (названы в AC3) | `smoke_color_picker_consumers`, `smoke_activity_color_settings`, `smoke_stairs`, `smoke_settings_navigation`, `smoke_dialog_help_clipping` | все OK |
| Известный посторонний smoke | `smoke_room_settings_form` | 7 `w*_basicsColumns` красные — воспроизвёл независимо, совпадает с заявленным и с #1013 (см. ниже) |
| Мутанты (статика, не исполнение) | `node scripts/mutation-gate.mjs --check` | PASS/static-readiness, execution=0, caught=unknown; WARN только по общему ориентиру 457/200 (ожидаемо, документировано) |
| Трейлеры/процесс | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений |
| Инварианты геометрии | не прогонял | диапазон не трогает геометрию плана/room-polygon модель (только CSS native range + computed HSV→hex), неприменим |
| Pytest backend | не прогонял | диапазон не содержит Python |
| Полный golden/performance | не прогонял (предрелизный гейт) | см. ниже визуальная проверка 2 из 5 принятых кадров |

Мутанты сам не исполнял и не патчил продукт/бандл/гард вручную ни на миг —
только статический `--check` и чтение `scripts/mutation-registry.mjs`;
это соответствует общей политике раздела «Отрицательные проверки и мутанты».

### Визуальная проверка golden

Diff golden-кадров смотрел напрямую (decor-color-popover-desktop-en.png,
space-room-color-popover-desktop-ru.png, до/после из `origin/dev`): до — синий
круглый бегунок без рамки, явно смещённый вниз относительно дорожки, S/V —
платформенные одноцветные ranges; после — три одинаковых бегунка (белая рамка,
тёмный контур, центрированы по дорожке), живые градиенты S (серый→насыщенный)
и V (чёрный→яркий). Соответствует контракту UI-016 буквально. Коммит
`4ceb8a6c0` несёт корректные `Release: v1.83.0-beta.1` +
`Baseline-Reviewed-Local: sha256:…` (WSL-аттестация), меняет ровно 5
объявленных сцен, остальные 215 сохранены.

### Проверка #1013 (посторонний baseline failure)

Отдельная задача #1013 уже заведена автором 2026-10-22 с воспроизведением тех
же 7 `w*_basicsColumns` на неизменённом `dev` (до #1008) в WSL и Windows;
дефект лежит в противоречии oracle `smoke_room_settings_form` после прошлого
#1007 (вертикальная vs колоночная раскладка), не связан с `hp-color-opacity.ts`.
Мой независимый прогон на материале ревью даёт ровно те же 7 падений и ничего
нового — предметная область (column layout диалога) не пересекается с правками
#1008 (native HSV range CSS). Считаю отчёт честным, не находкой этого цикла.

## AC → доказательство (проверено чтением и исполнением)

| AC | Статус | Как проверено |
|---|---|---|
| AC1 визуальное совпадение | Доказан | `smoke_color_picker_presentation` (геометрия/цвет центров/ring), 5 принятых golden кадров (визуально сверены 2/5), forced-colors+hover+focus исполнен и зелёный |
| AC2 цветовая связь | Доказан | `smoke_color_picker_presentation`: H/S/V/HEX/SV-поле, chёрный/белый/серый/края, invalid HEX не эмитит |
| AC3 общий компонент без регрессий | Доказан | те же presentation-smoke (5 реальных открытий: general/space/room/device/decor) + названные consumer/lifecycle smokes, все PASS; 320px/no-Popover fallback подтверждён |

Таблица «AC · чем доказан · чем краснеет» в хендоффе автора заполнена по
каждому пункту (red-witness до кода либо id зарегистрированного, но не
исполнявшегося мутанта) — пустых третьих столбцов нет. Пять новых мутантов в
`mutation-registry.mjs` (`color-picker-hsv-thumb-below-track-1008`,
`...-loses-result-color-1008`, `...-saturation-ignores-brightness-1008`,
`...-render-erases-placement-1008`, `...-forced-focus-loses-hover-1008`) при
чтении их патчей действительно воспроизводят ровно те пять дефектов, что автор
описал как найденные и исправленные в процессе (смещение бегунка, потеря
результирующего цвета, игнорирование текущей яркости в S-градиенте, сброс
inline-координат попапа при ре-рендере, потерю focus-outline под hover в
forced-colors) — не формальная отписка, а точное попадание в регрессии.

## Находки

Нет. High: 0. Medium: 0. Low: 0.

Разобрал отдельно потенциально подозрительный участок CSS — сдвоенный
селектор `:host([data-pointer-hover]) .hsv-range:focus-visible,
.hsv-range:focus-visible { outline: 2px solid Highlight; … }` в
`forced-colors`-блоке (строка ~470). На первый взгляд выглядит как
избыточность (второй селектор — надмножество первого по совпадению
элементов). При разборе специфичности оказалось, что это не избыточность, а
точное попадание в исправленный баг (коммит `3f82bcb6c`): конкурирующее
правило hover (строка ~377) имеет специфичность `(0,3,0)` на своей `:hover`-ветке,
когда `data-pointer-hover` установлен и курсор реально наведён одновременно с
клавиатурным фокусом; старое focus-правило в forced-colors имело только
`(0,2,0)` и проигрывало каскад, оставляя `outline: none`. Добавленная
host-ветка поднимает эффективную специфичность focus-правила до `(0,3,0)` на
элементе, где оба условия истинны, и порядок источника (идёт позже) решает в
его пользу. `smoke_color_picker_presentation`'s `forcedColorsFocus` проверяет
именно эту комбинацию (hover+focus-visible+forced-colors) и зелёный. Не
находка.

## Проверено и корректно

- Переиспользование существующей общекарточной инфраструктуры
  `data-pointer-hover`/`pointerHover` (уже используется в `hp-help.ts`,
  `hp-settings-select.ts`, `space-card.ts` и т.д., селектор
  `POINTER_HOVER_TARGET_SELECTOR` в `houseplan-card.ts` уже включал
  `hp-color-opacity` до этой задачи) — новая реактивная property корректно
  восполняет пробел и прокидывает модальность в fallback-портал
  (`_renderFallback`), не вводя новых слушателей/наблюдателей.
- Прозрачность (`opacity` range) осталась нетронутой — без класса
  `hsv-range`, нативный рендер, что и требовало ТЗ; подтверждено
  `opacityStaysNativeAndIndependent` (height 40, `appearance: auto`).
- `.sv-field` (вне скоупа) не затронут: старые переменные `--hp-picker-hue`
  используются только там и не конфликтуют с новыми `--hp-picker-color`/
  `--hp-picker-track` на трёх range-входах.
- Цветовые CSS-свойства — на самих `<input>`, не на `.picker`-диве: устраняет
  найденный и исправленный в процессе баг со сбросом inline-координат
  controller-owned surface при Lit-рендере.
- `touch-action: none` для range сохранён (наследуется от общего
  `input[type='range']`, `.hsv-range` его не переопределяет).
- Трейлеры: на каждом из 5 коммитов `Issue: #1008`; на 4 коммитах с
  `User-Visible: yes` оба CHANGELOG правятся в том же коммите (проверено
  `git show --stat` по каждому SHA). Коммит с golden-кадрами несёt
  `Release: v1.83.0-beta.1` + `Baseline-Reviewed-Local: sha256:…`,
  `User-Visible: no` — корректно (сам новый визуал уже объявлен предыдущим
  коммитом).
- `docs/release-ledger/v1.82.0/1008.json`: классификация `stable-fix`
  обоснована — дефект (смещённый hue-бегунок, платформенные S/V) уже
  присутствует в текущем stable v1.82.0 (видно по golden "до"), правка не
  добавляет новой функциональности. Milestone 1.83 — согласуется с правилом
  «stable-fix попадает в пользовательский milestone релиза».
- Число юнит-тестов/смоков в `STATUS.md` (5036/408) и мутационный инвентарь
  (457/200) — не «на глаз»: перепроверено исполнением `node
  scripts/inventory.mjs` на точном материале, совпадает один-в-один с
  зафиксированным в STATUS.md и `mutation-browser-guards.md`. Единый
  источник — `npm run inventory`.
- Старый юнит-тест `test/color-picker.test.mjs` (regex по CSS-тексту для
  `.hue-range`) оправданно удалён: проверял переменные
  (`--hp-picker-hue-track`/`--hp-picker-hue-thumb-shadow`), которых больше нет
  по дизайну; его роль перешла к браузерному paint-oracle в
  `smoke_color_picker_presentation`, что соответствует разделу «План
  автотестов» ТЗ («без зеркальных тестов реализации»).
- i18n: подписи "Hue"/"Saturation"/"Brightness"/рус. "Оттенок"/"Насыщенность"/
  "Яркость" не изобретены — это уже существующие `DEFAULT_LABELS` компонента;
  новые фрагменты USER-GUIDE(.ru).md используют ту же терминологию.

## Чего не проверял

- Полный `golden:verify` (220 сцен) и `golden:wsl:capture` сам не
  перезапускал — это предрелизный гейт (PROCESS.md §8), а не гейт ревью;
  проверил вместо этого 2 из 5 принятых кадров напрямую (до/после) и корректность
  trailers коммита golden-приёмки.
- `npm run invariants` — диапазон не меняет геометрию плана/room-polygon
  модель, негеометрический CSS/HSV-рефактор, гейт неприменим.
- `pytest tests_backend` — диапазон не содержит Python, неприменим.
- Performance-бенчмарки — не названы в AC, не прогонял.
- Реальный Firefox, физический GPU/устройство, touch-drag на реальном
  тачскрине, viewport 320 px в полном регрессионном цикле всех потребителей —
  не проверял и не требую: ТЗ прямо фиксирует это как непроверенное на
  уровне прототипа/реализации, редакторы — best effort на touch
  (`docs/TOUCH-SUPPORT.md`), а View/kiosk не затронуты.
- Мутанты из реестра (#1008: 5 штук) не исполнял — ни как часть ревью, ни как
  проверку «действительно ли они красные»: политика прямо запрещает это вне
  ночного workflow. Их правдоподобность разобрал чтением патчей (см. раздел
  AC выше), не исполнением.
- Не проверял `smoke_room_settings_form` на `origin/dev` отдельным checkout'ом
  (это дорого — требует второй `npm ci`/build/bundle-sync); опираюсь на
  независимое воспроизведение тех же 7 падений на материале ревью плюс
  задокументированное автором двойное (WSL + Windows) воспроизведение на
  неизменённом `dev` в отдельном issue #1013 с правдоподобной гипотезой о
  причине, не связанной с этим диффом.

## Побочные находки

Побочных находок нет. Маршрут публикации — `mode=issues`
(`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`), но заводить нечего: всё найденное
относится к материалу этой задачи напрямую (ложная тревога на forced-colors
селекторе разобрана выше и снята) или уже оформлено автором отдельным issue
(#1013, не новая находка этого ревью).

## Вердикт

Зелёный. route: fix. High: 0, Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1008-color-picker-polish`, коммит `3f82bcb6ce8c` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `02bd1ead1be465dbae4bfb094ea658e1231d888f`
  ```
  git log --all --format='%H %T' | grep 02bd1ead1be4
  ```
- Тело issue: `ea05324d0ed7d3da8f23e6dca62f0fa544341313252a9b57efbf5533ea43a871`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2MjQsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzE4OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMjYsIm91dHB1dF90b2tlbnMiOjM4NjcyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzODExNiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjcyMjk3NjcsImNvc3RVc2RFc3RpbWF0ZSI6Mi4zODUzODkzOTk5OTk5OTl9XSwidHVybnMiOjczLCJkdXJhdGlvbk1zIjo5MjE1NjcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjM5MDEwODM5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=4750 output_tokens=38691 cache_creation_input_tokens=138116 cache_read_input_tokens=7229767 num_turns=73 -->
