# CODE-REVIEW-357-r1

Issue: [#357](https://github.com/Matysh/houseplan-card/issues/357) · трек: `small` ·
заход r1 · SHA материала ревью: `49174e81f7a3118159a6686d1d69a16cdc337f3b`
(единственный коммит на ветке `issue/357-cold-view-toggle` поверх `origin/dev`).

## Скоуп

Регрессия #337 (ленивый сплит editor-runtime): четыре метода на карте
(`_toggleIntent`, `_toggleStateText`, `_toggleConfirmationStateText`,
`_toggleConfirmationLines`) остались заглушками `_editorRuntimeOrThrow()...`,
и клик по toggle-устройству на холодной вкладке (свежая страница, киоск,
рестарт браузера) бросал синхронное исключение прямо в обработчике клика —
до вызова HA/WS дело не доходило. «Лечилось» заходом в любой редактор, что и
маскировало баг от штатных смоков (все они грузят runtime через `launch()`).

Фикс переносит тела этих четырёх методов на карту (тонкий eager-модуль
`device-toggle.ts` и поля `_planHass`/`_fullRegistryHass`/`_virtualLights` уже
были в initial-графе), runtime теперь делегирует обратно в host. Диапазон
диффа: `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`,
`demo/smoke_cold_view_toggle.mjs` (новый), `scripts/mutation-gate.mjs`,
`scripts/smoke-links.mjs`, `docs/CHANGELOG.{md,ru.md}`, пересборка
`dist/**`/`custom_components/houseplan/frontend/**` и пересъёмка
`docs/images/**`+`screenshots.json` (фингерпринт документации считается по
всему `src/**`, поэтому обязателен при любой правке фронтенда).

ТЗ жило в теле issue (small-трек), ревью ТЗ — зелёный комментарий той же
сессии-ревьюера от 2026-08-28 (SPEC-REVIEW-357-r1, SHA на момент ревью ТЗ —
`399df907`, спецификация без изменений дошла до реализации).

## Как проверялось

Зелёного Validate на SHA `49174e81` не найдено — прогнал гейты сам.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| unit | `npm test` | `# tests 1499 / pass 1498 / fail 0 / skipped 1` — совпадает с хендоффом автора |
| build + сверка бандлов | `npm run build` затем `cmp dist/houseplan-card.js custom_components/.../houseplan-card.js` и `diff -rq dist/houseplan-assets custom_components/.../houseplan-assets` | обе копии побайтово совпадают; `git status` после сборки чист — коммит уже содержит актуальный бандл |
| docs fingerprint | `node scripts/check-docs.mjs` (diff трогает `src/**`) | `Documentation checks passed (7 files, 10 external links)` |
| bundle budget | `npm run bundle:budget` | `initial View: 271143 B gzip (budget 282000 B, headroom 10857 B)` — четыре метода переехали в eager-граф, бюджет (#352, поднят до 282000) не нарушен |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 7 «прямых совпадений»: `smoke_binding_picker`, `smoke_cold_view_toggle`, `smoke_controls`, `smoke_cover_not_primary`, `smoke_open_passage`, `smoke_static_icon`, `smoke_toggle_confirmation` |
| смоки: AC3 (названы в ТЗ) | `node demo/smoke_controls.mjs`, `smoke_card_controls.mjs`, `smoke_virtual_light_toggle.mjs`, `smoke_linked_virtual_light.mjs` | все 4 зелёные, файлы не менялись — ассерты те же |
| смоки: остальные прямые совпадения smoke-select, автором не названные | `node demo/smoke_binding_picker.mjs`, `smoke_cover_not_primary.mjs`, `smoke_open_passage.mjs`, `smoke_static_icon.mjs`, `smoke_toggle_confirmation.mjs` | все 5 зелёные — прогнал, т.к. инструмент назвал их прямым совпадением по символам диффа (`_planHass`, `_toggleIntent`, `DevItem`, `_virtualLights`, `_toggleConfirmationLines`), а не только по теме |
| новый смок | `node demo/smoke_cold_view_toggle.mjs` | зелёный, все 12 полей `true` (см. ниже) |
| мутант AC5 | `node scripts/mutation-gate.mjs --id=cold-view-toggle-delegated-to-runtime` | `тест покраснел, как обязан` — `поймано 1 из 1`; после прогона `git status` чист (патч откачен) |
| golden / performance / backend | не прогонял | diff не меняет геометрию, рендер-контракт устройств или Python; полные наборы — предрелизный гейт (§8), а не гейт ревью |
| invariants (модель) | не прогонял | diff не трогает рёбра комнат, `layout`, `marker.space`, `open_spans`, записи толщины — геометрия не задета |

Вывод новго холодного смока целиком зелёный:
```
runtimeColdBefore, initialAllOn, controllerTapCallsSwitch,
controllerTapTurnsAllOff, controllerTapTurnsAllOn, lampTapDrivesSwitch,
lampTapTurnsAllOff, confirmDialogShown, confirmExecTogglesVirtual,
runtimeColdAfter, noEditorRuntimeRequest, noPageErrors  → все true
```

## AC — доказательство

- **AC1** (холодный тап по контроллеру с `controls` из трёх виртуальных
  источников переключает их одним нажатием, glow появляется, editor-runtime
  не запрошен по сети): доказано `smoke_cold_view_toggle.mjs`
  (`controllerTapTurnsAllOff/On`, `noEditorRuntimeRequest`). Тест умеет
  падать — подтверждено мутантом `cold-view-toggle-delegated-to-runtime`
  (возврат старой заглушки в `_toggleIntent` красит именно этот смок).
- **AC2** (прямой toggle и `tap_confirm` в холодной вкладке): доказано тем же
  смоком (`lampTapDrivesSwitch`, `confirmDialogShown`,
  `confirmExecTogglesVirtual`). Падение при регрессии подтверждается тем же
  механизмом: любой из четырёх перенесённых методов, реверти́рованный назад
  к `_editorRuntimeOrThrow()`, бросает исключение синхронно внутри холодной
  вкладки — `page.on('pageerror', ...)` в `demo/serve.mjs` (строка 61)
  инкрементирует общий счётчик `_pageErrors`, который `finish()` красит
  независимо от локальных полей смока. Проверено чтением: путь клика по
  `confirmId` идёт через `_toggleConfirmationLines`/
  `_toggleConfirmationStateText`, обе перенесённые функции лежат на той же
  ветке кода, что и замутированный `_toggleIntent`.
- **AC3** (тёплый путь не меняется): доказано — `smoke_controls.mjs`,
  `smoke_card_controls.mjs`, `smoke_virtual_light_toggle.mjs`,
  `smoke_linked_virtual_light.mjs` зелёные, файлы этих смоков в диффе не
  тронуты (сверено по `git log --stat`).
- **AC4** (смок зарегистрирован в `smoke-links`): чтением —
  `scripts/smoke-links.mjs` содержит запись `symbols: [resolveToggleIntent,
  toggleOperation, projectedTapAction, toggleOriginOf, resolvedLightSources]
  → smokes: [smoke_cold_view_toggle.mjs]`; `smoke-select.mjs` действительно
  находит этот файл прямым совпадением по изменённым символам — реестр
  живой, не декларативная запись без эффекта.
- **AC5** (мутант красит холодный смок): доказано исполнением
  `node scripts/mutation-gate.mjs --id=cold-view-toggle-delegated-to-runtime`
  выше.

## Одно число — один источник

В диффе нет новой пользовательски видимой величины (площадь, толщина,
подпись, превью) — перенос кода меняет только то, ГДЕ разрешается
toggle-намерение, а не что показывается. `_toggleConfirmationLines`/
`_toggleConfirmationStateText` перенесены байт-в-байт (сверено построчно по
диффу — единственные замены: `this.host.` → `this.` и наоборот), формат
строк подтверждения не менялся. Неприменимо содержательно; ничего не задето.

## Продуктовое соответствие

Диагностированная в смоке семантика «пассивная лампа следует за состоянием
своего контроллера, а тап по ней шлёт `callService` на сущность контроллера;
`houseplan/virtual_light/toggle` уходит только у самостоятельной ручной
лампы» — не догадка автора, а прямая цитата `docs/USER-GUIDE.ru.md:832-845`
(«нажатие по связанной лампе переключает реальные реле её входящих
контроллеров… Без входящих связей та же точная тройка включает ручной режим
#107»). Смок закрепляет уже описанный контракт, ничего нового не
изобретает. Правка закрывает J3 (`docs/SCOPE.md`) — «tap-to-toggle for safe
domains» — без расширения скоупа: чинится ровно регрессия #337, публичные
контракты и конфиг не меняются, второй коммит с трейлерами `Issue: #357` /
`User-Visible: yes` и обоими changelog присутствует.

Пересъёмка `docs/images/**`+`screenshots.json` в том же коммите — по
документированному в PROCESS.md §8 пути «Пересъёмка — `npm run build && node
demo/docs/capture.mjs`, коммит вместе с задачей» (не спутано с отдельным
CI-артефактным `docs:accept --reviewed`, который применяется к содержательным
визуальным изменениям вроде #159 мебели): фингерпринт обязан обновляться при
любой правке `src/**`, содержательных визуальных изменений в этой задаче нет,
`check-docs.mjs` подтверждает целостность.

## Что проверено и корректно

- Все вызовы четырёх методов в `_clickDevice` (houseplan-card.ts:5188,
  5221, 5231) целиком на eager-пути — ни один toggle-путь View больше не
  ходит в `_editorRuntimeOrThrow()`.
- `resolveToggleIntent`/`formatToggleConfirmation` действительно eager
  (`houseplan-card.ts:131-137`, статический импорт из `device-toggle.ts`),
  поля `_planHass`/`_fullRegistryHass`/`_virtualLights` — поля карты, не
  runtime.
- Обратная делегация в `houseplan-editor-runtime.ts` (`_toggleIntent`,
  `_toggleStateText`, `_toggleConfirmationStateText`,
  `_toggleConfirmationLines` → `this.host....`) сохраняет редакторских
  потребителей (`_toggleIntentForDialog`, `_toggleHintLines`, превью
  диалога) рабочими — источник истины один, дублирования логики нет.
  `HouseplanEditorHostPort` пополнен ровно этими четырьмя членами.
- Смена видимости `private` → `public` у этих четырёх методов на карте —
  корректна и нужна для контракта `HouseplanEditorHostPort` (хотя явный `as
  unknown as` каст технически не потребовал бы этого от компилятора).

## Находки

**Low** — `src/houseplan-editor-runtime.ts:137`: после переноса тел методов
на карту символы `resolveToggleIntent` и `formatToggleConfirmation`
остались в списке импорта из `./device-toggle`, но нигде в файле больше не
используются (проверено — единственное вхождение обоих имён в файле это
сама строка импорта). Мёртвый код, не влияет на функциональность и,
предположительно, вычищается Rollup-бандлером при сборке (initial/lazy
бюджет в порядке — см. таблицу гейтов), `noUnusedLocals` в tsconfig
выключен, поэтому `tsc` не сигналит. **Снимаю с записью**: чисто
косметическая гигиена, не блокирует, не относится ни к одному AC; вычистить
можно в любой последующей правке этого файла.

Найдено High: 0, Medium: 0.

## Чего не проверял

- `python -m pytest tests_backend -q` — diff не трогает
  `custom_components/houseplan/**/*.py`, нерелевантно.
- `node scripts/model-invariants.mjs` — diff не меняет рёбра комнат,
  толщину, `layout`, `marker.space`, `open_spans`; геометрия не задета.
- `npm run golden:verify` — diff не меняет визуальный результат (рендер,
  геометрия, стили, слои); подтверждено чтением — единственная правка это
  порядок разрешения toggle-намерения, DOM/CSS не тронуты.
- performance-профили — не названы в AC, чувствительные к перфу пути не
  задеты (единственный перф-сигнал в скоупе — initial bundle budget,
  проверен отдельно и прошёл).
- Полный набор `demo/smoke_*.mjs` (199 файлов) — задача не задевает «всё»,
  прогнан выбор `smoke-select` (7 прямых совпадений) плюс 4 смока, названных
  в AC3; итого 10 из 199, с решением по каждой строке в таблице гейтов выше.
- Ручное тестирование в браузере (кроме Playwright-смоков выше) — вне
  цикла ревью по PROCESS.md §2.7; автотесты и мутант являются
  доказательством.

## Вердикт

Зелёный. Все 5 AC доказаны исполняемым тестом с подтверждённой способностью
падать (прямо для AC1/AC5, транзитивно через общий page-error гейт для
AC2), тёплый путь (AC3) и регистрация смока (AC4) не пострадали. Единственная
находка — Low, снята с записью, не блокирует.
