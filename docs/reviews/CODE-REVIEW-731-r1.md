# CODE-REVIEW-731-r1

**Материал раунда.** `0931a08794b40fc708b310abaf3a4f81c542e77d` (ветка
`issue/731-moon-status-revive`, HEAD, origin/dev @ `bc59917e`). Трек
`track:show`, заход r1, блокирующих циклов использовано 0/2.

## Скоуп

#731 — продолжение #718 К7: строка статуса луны («Сейчас: …») в
диалоге «Общие настройки» не появлялась, если диалог был восстановлен
после warm revive карточки (смена вкладки/перестройка дашборда), потому
что `_warmReviveDialog` восстанавливал только черновик, а не открытие
диалога, через которое строка запрашивается.

Правка — `case 'settings'` в `_warmReviveDialog` (`src/houseplan-card.ts`)
теперь вызывает новый `_reviveMoonStatus()`, который через
`_editorRuntime._openMoonStatus()` (новый метод-обёртка в
`src/houseplan-editor-runtime.ts`) вызывает тот же `openMoonStatus`, что
и обычное открытие. Одна поверхность («Общие настройки» после warm
revive), без нового UX-контракта — поведение зафиксировано в #718 К7 и
в ТЗ #731. Диапазон правки — 9 файлов, 161/−7 строк, один коммит.

## Как проверялось

| Гейт | Результат | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + bundle-policy verify | зелёные | Validate на `0931a087`: https://github.com/Matysh/houseplan-card/actions/runs/36825293924 (повторно не гонял — см. §8, #343) |
| `node scripts/bundle-budget.mjs` | зелёный, exit 0 | прогнал сам: `initial View: 300142 B gzip (потолок 300142 B +2000, budget 301066 B, headroom 924 B)`, `lazy moon: 11386 B gzip`; предупреждение `LOW_HEADROOM` — существующий долг #367/#474, не из этого диффа |
| `node scripts/mutation-gate.mjs --check` | зелёный (реестр, без исполнения мутантов — трек show их не гоняет) | прогнал сам |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 13 прямых совпадений, 47 слабых связей, 3 зарегистрированные связи (все три — `smoke_moon*`, по символам `_reviveMoonStatus`/`openMoonStatus`), «НЕОПРЕДЕЛЁННОСТЬ» — 0 | прогнал сам |
| `node demo/smoke_moon_status.mjs` (назван в AC1) | **OK**, все 23 проверки `true`, включая 7 новых `r731_*` | прогнал сам после `npm run build` + `node scripts/bundle-sync.mjs`; рабочее дерево восстановлено (`git checkout -- dist && git clean -fd dist demo/srv/assets`) |
| `npm run gate:small`, полный `npm test` | не гонял отдельно | дешёвый гейт уже зелёный на этом SHA (Validate); смысла повторять нет |
| `golden:verify`, `pytest tests_backend`, инварианты модели, performance-профили | не гонял | диффа в рендере плана, Python и геометрии нет; метки `ci:golden` нет; AC их не называет |
| 47 «слабых связей» из smoke-select | не прогонял по отдельности | правка — точечная глиссада вызова через уже протестированный `openMoonStatus`; прямые совпадения и зарегистрированная связь покрывают риск предметно (warm revive, lazy editor runtime, другие виды диалогов) |

Остальные 60 смоков из прямых/слабых совпадений не прогонялись:
изменение не трогает их домены (align guides, furniture, zigbee hover,
pdf export и т.д.) — связь по `_editorRuntime`/`_settingsDialog`
отражает общий паттерн ленивой загрузки редактора, не специфику правки.

## Доказательство AC

| AC | Чем доказан | Чем краснеет | Проверка |
|---|---|---|---|
| AC1 (строка появляется после revive, тот же текст/`data-moon-status`, что у обычного открытия в тот же момент) | `demo/smoke_moon_status.mjs`, блок `#731 AC1/AC2` — сценарии View и редактора плана (`r731_ac1_revivedDialogHasTheLine`, `r731_ac1_sameAsARegularOpening`, `r731_ac1_revivedInAnEditorHasTheLine`) | Функциональный AC (не защитный) | исполнено, все `true` |
| AC2.1 (снимок — новый, не перенесён из старого открытия) | тот же смок (`r731_ac2_reviveTakesItsOwnSnapshot`: `stale.reason==='shown'` при открытии, `after.reason==='day_sun'` после revive, когда солнце уже взошло) + юнит `test/moon-settings.test.mjs` `#731 AC2`, явный негативный случай `assert.equal(moonStatusOf(live), undefined, …)` до повторного запроса | негативный случай в самом тесте (WeakMap ключ `openings` не находит статус до нового `openMoonStatus`) | исполнено (смок — реально запущен; юнит — не гонял отдельно, дешёвый гейт уже зелёный на SHA) |
| AC2.2 (черновик не становится грязным от прихода строки) | юнит, явный негативный случай: toggled `moon: false` → `generalDirty === true`, а приход строки без правки драфта → `generalDirty === false`; смок `r731_ac2_lineLeavesTheRevivedDraftClean` (`saveDisabled && draftAfter === draft`) | негативный случай в самом тесте (сравнение `generalDraftKey` до/после, грязный драфт остаётся грязным) | исполнено |
| AC3.1 (стартовый граф View не растёт статическим импортом `editors/moon-status`) | чтением: `moon-status` импортируется только в `src/houseplan-editor-runtime.ts:114`, не в `houseplan-card.ts`; `_reviveMoonStatus` обращается к нему только через `this._editorRuntime` (ленивый) | защитный AC — граница ленивого графа | проверено чтением + `bundle-budget` зелёный (прогнан) |
| AC3.2 (восстановление других видов диалогов не грузит чанк луны) | смок, блок `#731 AC3`: `revivedSpace` (ревайв `space`-диалога) → `afterSpace === 0` запросов; `r731_ac3_reviveWhileTheChunkLoads` — ревайв `settings` во время уже идущей загрузки чанка не даёт второго запроса (`moonRequests.length === 1`) | защитный AC, негативный случай в самом смоке (счётчик запросов к `moon-runtime-*.js`) | исполнено |

## Прочитанный код

- `src/houseplan-card.ts:3500` — `case 'settings'` действительно вызывает
  `_reviveMoonStatus()` сразу после восстановления черновика;
  `restoreWarmDialogBaseline` (не тронут диффом) остаётся источником
  правды для dirty-состояния самого черновика — правка luna-статуса его
  не задевает, потому что статус хранится вне `_settingsDialog`
  (`WeakMap` в `src/editors/moon-status.ts`), а не в самом объекте
  черновика.
- `src/houseplan-card.ts:10129-10136` — `_reviveMoonStatus` повторяет
  паттерн `_openSettingsDialog`/`_openSupportDialog` (ожидание
  `_ensureEditorRuntime()`), но добавляет identity-проверку
  `this._settingsDialog === dialog`, которой нет у соседей: более
  консервативно, не регрессия.
- `src/houseplan-editor-runtime.ts:8471-8472` — `_openMoonStatus()` -
  тонкая обёртка над уже протестированным (#718) `openMoonStatus(this.host)`;
  никакой новой логики статуса не добавляет.
- `src/editors/moon-status.ts` — не менялся; `openings` — `WeakMap<host,
  Opening>`, ключ — карточка (`this.host`), поэтому у возрождённого
  экземпляра карточки (другой объект) результат погибшего экземпляра
  структурно не виден — совпадает с утверждением AC2.

## Находки

Нет. High: 0, Medium: 0, Low: 0.

Отмечено, но не находка (Low, снято без правки): риск, названный самим
автором — если ленивый рантайм редактора во View догрузится только к
следующей отрисовке, возрождённый диалог откроется без строки на первом
кадре. Это не регрессия: так же ведёт себя отложенный путь
`_openSettingsDialog` при обычном открытии (не доказательство правки
#731, а существующее поведение дедлайна гонки загрузки чанка), и в
обоих местах строка появляется, как только чанк догружается (гейт
AC12/#718 и смок `ac12_lineArrives`/revive-сценарии здесь).

## Чего не проверял

- Полные наборы `golden:verify`, `pytest tests_backend`,
  `npm run invariants`, performance-профили — диффа в рендере плана,
  Python-коде и геометрии нет, `ci:golden` не назначен, AC их не
  требует.
- 47 «слабых связей» `smoke-select` по отдельности — общий паттерн
  `_editorRuntime`/`_settingsDialog`, не специфика этой правки;
  предметный риск (warm revive, lazy loading, другие виды диалогов)
  закрыт тремя «зарегистрированными связями» (`smoke_moon*`) и прямым
  AC1-смоком, которые реально прогнаны.
- Мутационное тестирование диффа — трек show мутанты в разработке не
  гоняет ни на каком треке (#709); реестр (`mutation-gate --check`)
  зелёный, а защитные AC2/AC3 доказаны негативными случаями внутри
  самих тестов, не мутантами.
- `npm run gate:small` и полный `npm test`/`tsc`/`build` повторно — уже
  зелёные на этом SHA по Validate, доверяю ссылке (#343).
- Ручное тестирование в браузере вне смока — не делал; `demo/smoke_moon_status.mjs`
  прогнан мной лично в headless Chromium и даёт идентичный результат
  заявленному автором («5/5» новых проверок эквивалентны 7 зелёным
  `r731_*`, включая два, что и на dev были бы зелёными без правки —
  `lineLeavesTheRevivedDraftClean` и `otherRevivesLeaveTheChunkAlone`,
  как и указано в комментарии автора).

## Вердикт

Зелёный. AC1–AC3 доказаны исполнением (смок, лично прогнан) и чтением
кода; защитные части AC2/AC3 имеют негативные случаи в самих тестах.
Трейлеры `Issue: #731` и `User-Visible: yes` на месте, оба CHANGELOG
правлены в том же коммите. Критерии §5 (`complexity`, `surfaces`,
`migration`, `ux-contract`, `perf-touch`, `undocumented`) пройдены —
см. ниже.

## Критерии §5 (route)

- `complexity` — пройден: точечная правка, сложность автора 2/10,
  подтверждается диффом (9 файлов, суть — одна строка вызова плюс
  обёртка).
- `surfaces` — пройден: одна поверхность, диалог «Общие настройки»
  после warm revive.
- `migration` — пройден: ни конфига, ни новых compatibility-полей.
- `ux-contract` — пройден: контракт зафиксирован в #718 К7, здесь —
  закрытие пробела в его покрытии.
- `perf-touch` — пройден: не касается производительности рендера плана
  и touch-контракта.
- `undocumented` — пройден: поведение зафиксировано в #718 К7 и теперь
  также в `docs/SUN.md`/`docs/WARM-REMOUNT.md`.

`route: fix` (вердикт зелёный — `reclassify` не применяется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/731-moon-status-revive`, коммит `0931a08794b4` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5f782e1ae7365754dfb24ae284609d3b9aecc778`
  ```
  git log --all --format='%H %T' | grep 5f782e1ae736
  ```
- Тело issue: `e1b5b1c1d03184a5124e809cc9139824eb2c2b9d3ba64b76d072fe35c89d41f8`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
