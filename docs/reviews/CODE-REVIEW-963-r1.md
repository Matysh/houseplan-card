# CODE-REVIEW-963-r1

Issue: #963 · Трек: ask · Этап: code · Заход: r1 · Материал: `4e47a920f4e91a2e7fa94f73b9d39448ec1ae7a1` (рабочая копия на нём, `git rev-parse HEAD` сверен)

## Скоуп

Диапазон `origin/dev..HEAD` — 16 коммитов, 280 изменённых путей (большинство — `demo/golden/baselines/**`, класс D). Непосредственно продуктовый код (класс A): панель свойств (`src/editors/properties/*`), общий tooltip-механизм (`src/chrome-tooltip.ts`, `src/chrome-tooltip-lazy.ts`, `src/hp-help.ts`), меню инструментов трёх редакторов (`src/houseplan-editor-runtime.ts`, `src/editor-secondary.ts`), общая шапка (`src/houseplan-card.ts`, `src/header-menu.ts`), стили (`src/styles/*`), i18n (`ru/en/de/fr`). Класс B — демо-смоки (`demo/smoke_ui_polish_963*.mjs`, фикстуры, мутанты в `scripts/mutation-registry.mjs`, бюджет в `scripts/bundle-budget.mjs`). Класс C — документация (`USER-GUIDE*.md`, `ARCHITECTURE.md`, `DECOR-EDITOR.md`, `STAIRS.md`, `UX-MODES.md`, release-ledger).

Соответствие `docs/SCOPE.md`: J4/J6 (администратор редактирует план/устройства/подложку) — полоса из тела issue. ТЗ ревью этой же задачи прошло зелёным r1 (см. комментарий issue от 2026-10-19T09:04:24Z), поэтому код-ревью сверяет реализацию с уже принятым текстом ТЗ (body SHA-256 `6dda5c08f0266928d073aa3c45e57d2375816d4553ef65afcffbc94e5ac2ad2c`, как и заявлено в хендоффе), а не пересматривает сам контракт.

## Риск по изменённым участкам (#707) — покрытие AC ТЗ

| Класс | Участок | Покрыт AC/документом |
|---|---|---|
| geometry | `wall-node-editor.ts:357-358`, `node_move_unsupported_junction` | AC-нерелевантно по содержанию: чистая миграция `<title>` → `data-hp-tooltip`+`aria-label` с тем же текстом, см. «Что проверено». §4 ТЗ («подсказки инструментов/узлов на плане»). |
| touch | `chrome-tooltip-lazy.ts:16/22/44`, `PointerEvent`/`pointerType`/`pointerdown` | §4 ТЗ («не должны перехватывать клики/жесты»), AC4, AC9 touch-пункт §11. Проверено чтением + `demo/smoke_ui_polish_963_touch.mjs`. |
| perf | `chrome-tooltip*.ts`, `section-motion.ts` (`getBoundingClientRect`, `requestAnimationFrame`, `ResizeObserver`) | §11 ТЗ («Measurements limited to panel/content updates; hover/timers released on lifecycle»), AC1/AC4. Проверено чтением — см. ниже. |
| ux | новые ключи `markup.rooms`, `decor.shapes` (все 4 локали) | §11 ТЗ, AC3. Подтверждено `test/properties-i18n.test.mjs` (новый тест для всех 4 локалей). |

Все перечисленные классы покрыты либо явным пунктом ТЗ, либо конкретным тестом — `route: reclassify` не требуется (вопрос неприменим: трек уже `ask`).

## Как проверялось

Прогон Validate на точном материале `4e47a920f` зелёный (https://github.com/Matysh/houseplan-card/actions/runs/39293721495, attempt 1, browser 397/397, frontend/backend/golden/performance green) — принят как опора для дешёвых и полных гейтов по правилу «дешёвые гейты на этом SHA уже подтверждены» (#343) и по тому, что автор запрашивал `ci:full`+`ci:golden` именно на этот диапазон. Я не перегонял `tsc`/`npm test`/`npm run build`/`golden:verify`/полный browser-набор — они уже зелёные на этом SHA, перегон добавил бы только избыточный расход. Вместо этого бюджет раунда потрачен на чтение диффа (в первую очередь risky hunks выше) и сверку с текстом принятого ТЗ и `docs/USER-GUIDE.ru.md`.

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | Не перегонялся (принят по Validate на этом SHA) | run 39293721495 |
| `npm run golden:verify` | Не перегонялся (принят; 212/212 PASS в хендоффе, WSL-аттестация `38d9f88b...` под `Baseline-Reviewed-Local` коммита `1ea5a4381`) | хендофф + трейлер коммита |
| Выбранные смоки AC (`smoke_ui_polish_963*.mjs`, `smoke_properties_panel.mjs`, `smoke_toolbar_stable_width.mjs` и др.) | Не перегонялись отдельно — входят в заявленный browser 397/397 полного CI на этом же SHA | run 39293721495, хендофф §«Гейты» |
| `npm run invariants -- --config demo/ui-lab/fixture.json` | Не перегонялся — геометрическая модель не меняется (вращение колонны — тот же gesture/command path), заявлен PASS/0 в хендоффе | хендофф |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | Не перегонялся — заявлен PASS/16 коммитов/0 предупреждений, трейлеры проверены вручную ниже | хендофф + собственная проверка трейлеров |
| `node scripts/mutation-gate.mjs --check` (статическая регистрация) | Не перегонялся — заявлено 1708/427, сверено чтением 6 новых определений в `scripts/mutation-registry.mjs` | см. «Что проверено» |
| pytest / HA-harness | Не прогонялся — Python/backend не затронуты (нет изменений в `custom_components/`) | `git diff --stat` |

**Чего не проверял:** реальный drag вращателя колонны и сравнение парных PNG с замороженным UI Lab (требует живого браузера и приватного эталона — не воспроизводимо в ревью; принято по описанию 98/98 PASS в хендоффе и по тому, что `golden:verify` 212/212 зелёный на том же материале). Личную GPU-приёмку владельцем — вне скоупа ревью (ТЗ §1 «не-скоуп» явно это исключает). Полную ручную проверку всех 9 AC по UI Lab не делал — заменил чтением кода+тестов, как разрешено §2.7.

## Находки

### Medium (в скоупе, возврат автору) — потеряна содержательная подсказка двух кнопок панели инструментов редактора устройств

**Файл:** `src/houseplan-editor-runtime.ts` (метод `_renderDevicesBar`), затронуты ключи `device_inbox.title` и `title.icon_rules` в `src/i18n/{ru,en,de,fr}.json`.

ТЗ §4 прямо разделяет два случая: «У кнопок редакторских панелей убрать **только** подсказки, полностью дублирующие видимую подпись. Содержательные пояснения и подсказки кнопок без текста оставить. Не удалять accessible name вместе с дублирующим tooltip.» Диффы:

```
-        <button class="btn ${this.host._showAll ? 'on' : ''}" data-hp="tool" data-tool="device-inbox" @click=${() => this._openDeviceInbox()}
-          title=${this.host._t('device_inbox.title')}>
+          >
           <ha-icon icon="mdi:devices"></ha-icon>${this.host._t('device_inbox.button')}
...
-        <button class="btn" data-hp="tool" data-tool="icon-rules" @click=${() => this._openRulesDialog()} title=${this.host._t('title.icon_rules')}>
+        <button class="btn" data-hp="tool" data-tool="icon-rules" @click=${() => this._openRulesDialog()} >
           <ha-icon icon="mdi:shape-plus-outline"></ha-icon>${this.host._t('devbar.rules')}
```

Ключи удалены из всех 4 локалей целиком (например, `en.json`: `"title.icon_rules": "Icon rules: which MDI icon devices get by name"` удалена, видимая подпись кнопки — всего лишь `"devbar.rules": "Icon rules"`). Это не дубликат подписи — подсказка объясняла механику («какая MDI-иконка достаётся устройству по имени»), подпись кнопки её не содержит. Аналогично `device_inbox.title` («Devices on the plan») длиннее и конкретнее видимой подписи «Devices». У всех соседних кнопок той же панели (`add-device`, `device-magnets`) и панели плана (все перенесённые в «Комнаты») содержательные подсказки корректно мигрированы в `data-hp-tooltip`/`hint` — это единственные две кнопки, где подсказка исчезла совсем, без замены и без обоснования в тексте ТЗ или в эталонном `app.mjs`/`houseplan-card.css` (в приложенном извлечении прототипа эти две кнопки не упоминаются и их тултипы не трогаются).

**Чем краснеет:** обычный DOM-запрос `data-hp-tooltip` (или рендер `aria-describedby`) по кнопкам `[data-tool=icon-rules]` и `[data-tool=device-inbox]` в режиме устройств — атрибут отсутствует, а раньше был непустой `title`. Отрицательного witness на этот конкретный regress в текущем наборе смоков/registry нет; это и есть находка, а не требование создавать его сейчас.

**Почему Medium, не High:** это не защитный AC, не регресс данных/геометрии, затронуты только 2 из ~30 мигрированных кнопок, объём правки небольшой (вернуть `data-hp-tooltip=${...}` на оба элемента, восстановить 4 строки i18n). Поведение остальных 9 AC не страдает.

## Что проверено и корректно

- **AC1** (панель свойств, высота по контенту). `PropertiesSectionMotion` (`src/editors/properties/section-motion.ts`) меряет только `.hp-prop-group` внутри смонтированной wide-панели через `ResizeObserver` на детях секции, запускается из `editor.ts render()` с epoch-guard против гонки после `dispose()`. `reduced-motion` отключает анимацию (`motionChanged`), `measure()` не анимирует при `reduced`. Стили `.hp-prop-group { min-height: 0 }` убирают резервы под поля предыдущего объекта — ранее были `min-height: 200/206/180/232px` по типу секции, теперь удалены, что соответствует требованию «не резервировать место под поля предыдущего объекта». Тест `test/properties-catalog.test.mjs` проверяет `contour.groups.length===3` (нет пустой 4-й секции) — проверено чтением, не исполнением (эффект доказывается только браузерным смоком, который не перегонялся отдельно, но входит в полный CI).
- **AC2** (кнопки свойств, стороны окна). `.hp-prop-action.display_device` — отдельная бирюзовая заливка/рамка удалена, оставлена общая `.hp-prop-action` (нейтральная, как «Копировать») — соответствует требованию «та же нейтральная палитра... убрать белую заливку с чужой бирюзовой рамкой». `.hp-prop-action.delete` получил `var(--hpf-danger)` рамку в обеих темах + явный disabled-приглушённый вариант. Окно: `features.push(choice('flip_v','opening_side',...))` теперь единая ветка для window/gate (было отдельное «along_wall/across_wall» для window) — `into_room`/`outside` вычисляются в `editor.ts:openingSides()` через существующий `propertiesOpeningSides`, не новая модель данных. Покрыто новым блоком `test/properties-catalog.test.mjs` (`flip_v.options===[{value:'false',label:'A'},{value:'true',label:'B'}]` для fallback-фикстуры без привязанных комнат).
- **AC3** (меню «Комнаты»/«Фигуры», история без подписей). `_roomsToolbarGroup()`/`_shapesToolbarGroup()` строят `EditorToolbarGroup` с порядком `merge→split→resize→delroom` и `line→rect→ellipse`, как того требует ТЗ; `_renderGeometryHistory()` — общий компонент, используется во всех трёх барах (`_renderMarkupBar`, `_renderDecorBar`, `_renderDevicesBar` — последний не менялся по месту, уже был иконками). Удалены старые отдельные кнопки merge/split/resize/delroom и декора line/rect/ellipse — не задублированы (видно по диффу, старые строки полностью удалены, не оставлены рядом). `data-tool` у вложенных команд меню сохраняет прежние значения (`delroom`→`data-tool="delete-room"` в `editor-secondary.ts`), что важно для существующих тестов/селекторов.
- **AC4** (единые тултипы). `ChromeTooltip`/`LazyChromeTooltips` — один non-interactive `popover="manual"` top-layer bubble на карточку, ширина `min(320, viewport-16)`, задержка открытия 300 ms, fade 120 ms/3 px — совпадает с параметрами эталона §4. `pointerType !== 'mouse'` исключает touch; `:focus-visible` — исключает обычный (не клавиатурный) фокус. `hostUpdated()` скрывает протухшую подсказку при смене контекста (editor/selection) через `context()`+`stamp`. `aria-describedby` простановка/снятие на owner. Удаление `.hp-prop-tooltip` (старый hover/focus-within css-тултип для disabled «Удалить») и перевод на тот же `data-hp-tooltip` — единообразно. **Кроме находки выше**, остальные ~30 замен `title=`→`data-hp-tooltip=` сохраняют тот же текст 1:1 (построчно сверено по diff).
- **AC5** (общая шапка). Новый `<div class="header-actions">`-контейнер оборачивает `zoomctl`+hidden-devices+header-actions+header-menu — перенос «целиком» реализован оборачивающим div, а не построчным CSS-переносом (снижает риск «одна-две кнопки отдельно»). Zoom-кнопки получили `aria-label` вместе с `data-hp-tooltip` (ранее только `title`, который давал и tooltip, и accessible name — теперь явное разделение, accessible name не потерян).
- **AC6** (фильтр пространств, Save). `<select>` обёрнут в `<hp-settings-select>` — переиспользование существующего компонента, не второй CSS-набор, как требует ТЗ. disabled-состояние (`?disabled=${dialog.busy}`) сохранено.
- **AC7** (выделение). `renderPropertiesSelection` — убраны все `tag(...)` плашки (имя объекта/устройства/декора), кроме A/B стены (`target.kind==='contour'` ветка оставляет `tag(x1-14*px,...,'A')`/`'B'`), и убрана диагональная линия-указатель к хинджу двери вместе с `hingeLabel`. Обычные названия комнат/текст/бейджи не в этом файле — не затронуты.
- **AC8** (колонна, лестницы). Вращатель квадратной колонны получил классы `dtframe hp-column-frame`/`dtstem`/`dthandle dtrot`/`dtknob` — тот же набор классов, что у лестницы (`stairs-view.ts` паттерн), видимый круг уменьшен (`r=${rotationRadius/4}` для `dtknob`), а **hit target остался большим** — `<circle class="rotate-handle dthandle dtrot" ... r=${rotationRadius}>` с обработчиками `pointerdown/move/up` на этой же, большой окружности; визуально маленький `dtknob` — отдельный `aria-hidden` круг поверх, без обработчиков. Это прямо то, что требует ТЗ («визуальное уменьшение не уменьшает невидимую область захвата»). Зарегистрированный мутант `column-rotation-target-shrunk-963` целится именно в эту инвариацию (делит `r` вчетверо) — корректная защита, не исполнялся (честно заявлено).
- **AC9** (побочные эффекты). i18n: `propertiesT` для `de`/`fr` берёт из нового словаря `localized`, с fallback на `en` для непереведённых ключей — не ломает уже существующие ключи этих языков. Трейлеры `Issue:#963` на каждом нетривиальном коммите; `User-Visible: yes` у 3 коммитов (`164d70c`, `efbd3ad8`, `a0e82ed9`) — у каждого из них правка есть в обоих `docs/CHANGELOG*.md` (проверено `git show --stat`). `docs/release-ledger/v1.81.0/963.json` — `line-fix` относительно v1.81.0 с `introducedBy: 931`, обоснование соответствует факту (доводка панели свойств, появившейся в текущей бета-линии).
- **Защитные AC — таблица «чем краснеет».** Хендофф приводит её целиком (6 зарегистрированных witness id + 4 обычных отрицательных случая на неизменённой реализации с результатом). Я сверил, что все 6 id (`editor-tooltip-arms-after-touch-focus-963`, `properties-reserves-empty-height-963`, `editor-tooltip-opens-without-delay-963`, `editor-tooltip-survives-context-963`, `background-stairs-stay-opaque-963`, `column-rotation-target-shrunk-963`) реально существуют в `scripts/mutation-registry.mjs` с патчами, бьющими именно заявленный инвариант, и честно помечены «не исполнялись» — статическая регистрация и ordinary PASS этого не заменяют, замечаний нет.
- **Размеры.** `INITIAL_VIEW_GZIP_CEILING` 325453→327770 (+2317, задокументировано как перенос согласованного +2317 поверх базы #939), raw-бюджет не поднят (только +114 B в пределах утверждённой полосы, с отдельным владельческим разрешением в issue). Математика совпадает (325453+2317=327770), комментарий в коде это объясняет.

## Унаследовано (контекст прошлых находок, не этот раунд)

Это первый код-ревью раунд #963 (предыдущий запуск остановился до модели на служебном path cap — семантического вердикта не было, цикл не израсходован), поэтому раздела «Закрытие раунда r0» и «Унаследовано из r0» не формирую — делать нечего по PROCESS.md §2.10 (это не повторный раунд в терминах главы, так как предыдущая остановка не дошла до вердикта модели).

## Маршрут и вердикт

`route: fix` — трек `ask`, найденный Medium в скоупе ТЗ этой же задачи.

Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/963-ui-polish`, коммит `4e47a920f4e9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e9617f566510bc53c5e946b12ae14958824db88a`
  ```
  git log --all --format='%H %T' | grep e9617f566510
  ```
- Тело issue: `6dda5c08f0266928d073aa3c45e57d2375816d4553ef65afcffbc94e5ac2ad2c`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyMDYsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjk1OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6OTAsIm91dHB1dF90b2tlbnMiOjI5MDQxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE1MjIxMiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjUzNTc3MDMsImNvc3RVc2RFc3RpbWF0ZSI6MS45NzA5Nzg1OTk5OTk5OTk2fV0sInR1cm5zIjo0OCwiZHVyYXRpb25NcyI6Mzk4Mzc2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS45NzYyNzQ2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5296 output_tokens=29059 cache_creation_input_tokens=152212 cache_read_input_tokens=5357703 num_turns=48 -->
