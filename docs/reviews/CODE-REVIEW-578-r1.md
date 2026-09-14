# CODE-REVIEW-578-r1

**Issue:** [#578](https://github.com/Matysh/houseplan-card/issues/578) — «Touch: второй палец pinch на устройстве запускает long-press и HA more-info»
**Материал ревью:** SHA `5790abaa1f3e8701e3de190968178e63156e3fe5` (рабочая копия зафиксирована на нём, `git fetch`/`checkout` не выполнялись)
**Заход:** r1 · блокирующих циклов израсходовано 0/4
**Трек:** полный (обоснован в ТЗ, спор-ревью ТЗ зелёное — комментарий пайплайна в issue)

## Скоуп

Диапазон `git diff origin/dev...HEAD` — один продуктовый коммит:

- `src/houseplan-card.ts` — на bubble-обработчике маркера `_pointerDown` добавлена проверка `_touchSequenceMultitouch` перед вооружением 600-мс `_holdTimer`; capture-guard `_guardTouchGesture` расширен на `contextmenu` и `keydown` и делегирует активационные события в новый метод `TouchGestureClickGuard.handleActivation`.
- `src/touch-gesture-click-guard.ts` — добавлен `handleActivation(event, suppressClick)`: единая точка подавления `click`/`contextmenu`, пока `clickBlocked`; `keydown` с `ContextMenu`/`Shift+F10` при отсутствии активных touch-контактов снимает `_postGestureClickBlocked`.
- `test/touch-gesture-click-guard.test.mjs` — два новых unit-теста (#578) на активную/завершённую multi-touch-блокировку и на keyboard re-arm.
- `demo/smoke_editor_gestures.mjs` — существенно расширенный browser-smoke: оба порядка начала pinch (stage→marker, marker→stage), churn с третьим контактом, все терминальные варианты, touch- и mouse-`contextmenu`, keyboard `Shift+F10`, следующий одиночный tap и long-press.
- `scripts/mutation-registry.mjs` — два именованных мутанта: `touch-pinch-marker-hold-rearmed`, `touch-pinch-contextmenu-guard-removed`, оба со свидетелем `smoke_editor_gestures.mjs`.
- `docs/TOUCH-SUPPORT.md`, `docs/TESTING.md` — контракт и таблица покрытия обновлены под новую формулировку.
- `docs/CHANGELOG.md` + `docs/CHANGELOG.ru.md` — правка в том же коммите, `User-Visible: yes`.
- `dist/**`, `custom_components/houseplan/frontend/**`, `demo/srv/assets/**` (класс D) — пересобранный бандл, синхронность подтверждена локально (см. ниже).

Не в диффе: конфигурация, backend/Python, i18n-строки, geometry/`layout`/`marker.space`/`open_spans` — инварианты модели не применимы к этой задаче.

## Как проверялось (таблица гейтов)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | green |
| unit | `npm test` | 2706 pass, 0 fail, 1 skipped (совпадает с хендоффом) |
| build + bundle sync | `npm run bundle:sync` (`build` + `bundle-sync.mjs --check`) | green, дерево `custom_components/houseplan/frontend` и `demo/srv/assets` byte-stable |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 33 добавленные строки в 2 файлах, новых `any` нет |
| check-docs | `node scripts/check-docs.mjs` | green (7 файлов, 12 внешних ссылок) — обязателен, диф трогает `src/**` |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 4 прямых совпадения по `_suppressClick`: `smoke_editor_gestures`, `smoke_furniture`, `smoke_linked_virtual_light`, `smoke_plan_snap_overlay`; 32 слабые связи по `_mode` (одно распространённое имя — не прогонялись, см. ниже) |
| browser smoke (прямые) | `node demo/smoke_editor_gestures.mjs` | green, все 15 полей `true`, включая новые `stageThenDeviceHoldBlocked`, `stageThenDeviceContextMenuBlocked`, `nextDeliberateDeviceLongPressWorks`, `mouseContextMenuStillWorks`, `keyboardContextMenuStillWorks` |
| browser smoke (прямые) | `node demo/smoke_furniture.mjs` | green |
| browser smoke (прямые) | `node demo/smoke_linked_virtual_light.mjs` | green |
| browser smoke (прямые) | `node demo/smoke_plan_snap_overlay.mjs` | green |
| browser smoke (по теме бага, не в выборке) | `node demo/smoke_tap_ctx.mjs` | green |
| browser smoke (по теме бага, не в выборке) | `node demo/smoke_long_press_gesture.mjs` | green |
| mutation witness | `node scripts/mutation-gate.mjs --id=touch-pinch-marker-hold-rearmed` | green: чистый прогон зелёный, мутант красный (поймано 1/1) |
| mutation witness | `node scripts/mutation-gate.mjs --id=touch-pinch-contextmenu-guard-removed` | green: чистый прогон зелёный, мутант красный (поймано 1/1) |

Валидация в CI на этом SHA не запрашивалась: гейты дешёвые, прогнаны локально самим ревьюером, потому что готового зелёного Validate на `5790abaa` в контексте задачи не подтверждён отдельной ссылкой для этого раунда — прогон занял единицы минут.

### Чего не проверял и почему

- **`golden:verify`** — не прогонялся. Диф не меняет геометрию, стили, слои и видимую разметку; правка — событийная (какие обработчики активации подавляются), рендер маркера и стадии не тронут. Golden — предрелизный гейт (§8), не гейт ревью для этой задачи.
- **`python -m pytest tests_backend`** — не прогонялся, диф не касается `custom_components/**/*.py`.
- **Модельные инварианты** (`npm run model-invariants`) — не прогонялись, диф не трогает geometry/`layout`/`marker.space`/`open_spans`.
- **Perf-профили** — не прогонялись; AC9 не называет perf-влияние, влияние на touch-путь ограничено O(1)-проверками поверх уже существующей `Map`/`Set`, что подтверждено чтением (`pointerDown`/`handleActivation` не создают новых структур, не сканируют DOM).
- **32 «слабые связи» по `_mode`** (`smoke_decor*`, `smoke_modes`, `smoke_kiosk` и т.д.) — не прогонялись. `_mode` упоминается в диффе только как условие входа (`this._mode !== 'view' && this._mode !== 'devices') return`, не изменено по существу; логика самих режимов не тронута. Просмотр списка не выявил смока, специфичного именно для touch-активации маркера вне уже прогнанных четырёх прямых совпадений и двух тематических (`smoke_tap_ctx`, `smoke_long_press_gesture`).
- **Полный набор `demo/smoke_*.mjs`** — не прогонялся целиком; задача не задевает поверхность плана/редакторов вне touch-guard контура.
- **Full pre-release набор (golden/smoke/performance/E2E на реальном HA)** — предрелизный гейт, не гейт код-ревью; хендофф-комментарий сам это отметил в «НЕ сделано», это корректно.

## AC → доказательство

| AC | Доказано | Как | Чем краснеет |
|---|---|---|---|
| AC1 stage→marker, удержание >600мс | да | `smoke_editor_gestures`: `stageThenDeviceHoldBlocked=true`, `stageThenDeviceZooms=true` (внутри `pinchZoomsFromDevice`) | мутант `touch-pinch-marker-hold-rearmed` красит именно этот путь |
| AC2 marker→stage (регресс #563) | да | тот же smoke: `pinchIntermediateClickBlocked`, `pinchDelayedClickBlocked`, `pinchCancelsDeviceLongPress` = true | покрыт существующим мутантом #563 (не тронут) |
| AC3 churn, терминальные варианты, третий контакт | да | smoke: `terminalGesture` ×2 + отдельный блок с 3 контактами → `pinchTerminalVariantsBlocked=true` | косвенно через `noActivation()`; отдельного мутанта на «третий контакт» нет, но код пути общий с AC1/AC2 |
| AC4 contextmenu (touch блокируется, mouse проходит) | да | smoke: `stageThenDeviceContextMenuBlocked`, `mouseContextMenuStillWorks=true` (moreInfoCalls строго считается) | мутант `touch-pinch-contextmenu-guard-removed` красит touch-путь |
| AC5 новая одиночная последовательность (tap + long-press) | да | smoke: `nextDeliberateDeviceTapWorks`, `nextDeliberateDeviceLongPressWorks=true`, без искусственной задержки (сразу после terminal) | заявленный тест умеет падать — проверено чтением: без early-return на 7131 `_holdTimer` не отличит новую последовательность (не мутировалось отдельно, покрыто тем же мутантом AC1) |
| AC6 mouse/keyboard совместимость | да | smoke: `mouseContextMenuStillWorks`, `keyboardContextMenuStillWorks=true`; unit `#563 a new mouse sequence...` | чтением: `pointerDown()` в guard сбрасывает `_postGestureClickBlocked` для любого `pointerType`, включая `mouse`, при отсутствии активных touch-контактов |
| AC7 чистая машина состояний unit | да | `test/touch-gesture-click-guard.test.mjs`, 6 тестов (4 старых #563 + 2 новых #578) покрывают single→multi→post-blocked→fresh, оба порядка release, cancel/lost-capture, keyboard re-arm | unit явно ассертит `false`/`true` на каждом переходе |
| AC8 отрицательные mutation witnesses (раздельно) | да | `mutation-gate.mjs --id=touch-pinch-marker-hold-rearmed` и `--id=touch-pinch-contextmenu-guard-removed`, оба «поймано 1 из 1» | сам гейт и есть доказательство: чистый прогон зелёный → мутант красный |
| AC9 стандартные гейты на точном SHA | да | таблица выше: typecheck/test/build/check-docs/подобранные smoke/оба mutation witness — все зелёные на `5790abaa` | — |

## Находки

Нет High. Нет Medium. Одна Low, снятая ревьюером без правки:

- **Low.** AC3 («churn и terminal events») не получил отдельного именованного mutation witness — оба существующих мутанта (#563-й на терминалы и новые #578-е) покрывают смежные, но не тождественные пути; регресс именно в порядке «третий контакт поверх уже блокированной последовательности» ловится теми же двумя мутантами лишь косвенно (через общий early-return). Не блокирует: browser smoke явно воспроизводит сценарий с третьим контактом и проверяет `noActivation()`, а требование ТЗ (АC8) называло ровно два witness — «marker hold guard» и «contextmenu capture guard», оба присутствуют. Дополнительный мутант не заявлен ни ТЗ, ни AC — снимаю без правки.

## Что проверено и корректно

- Порядок исполнения `pointerdown` подтверждён структурно и эмпирически: guard навешан с `capture: true` на корневой `ha-card`, маркер — потомок без капчура, поэтому `TouchGestureClickGuard.pointerDown()` гарантированно успевает выставить `_sequenceMultitouch=true` до того, как `_pointerDown()` маркера проверит `_touchSequenceMultitouch` на строке `src/houseplan-card.ts:7131`.
- `contextmenu` от touch внутри/сразу после pinch гасится `handleActivation` (`preventDefault` + `stopImmediatePropagation`) до того, как событие дойдёт до `@contextmenu` маркера (`_ctxDevice`, `src/houseplan-card.ts:12553`), а настоящий mouse-контекстное меню не задето, потому что `clickBlocked` ложно вне активного/только что завершённого multi-touch.
- Keyboard `Shift+F10`/`ContextMenu` восстанавливает контекстное меню сразу после завершения всех старых контактов, но не раньше — юнит и smoke по отдельности проверяют оба состояния.
- «Одно число — один источник» неприменимо: диф не добавляет и не меняет видимую пользователю величину.
- Оба changelog правлены тем же коммитом, что и поведение; терминология («долгое нажатие», «внутренняя карточка House Plan», «HA more-info», «правый клик») совпадает с `docs/USER-GUIDE.ru.md`, а не изобретена.
- Изменение не расширяет скоуп: правка ограничена activation-контуром `pointerdown/contextmenu/keydown`, не трогает pan/pinch-скорость, конфиг, i18n, назначаемые действия — согласно «Вне scope» ТЗ.
- Продуктовая рамка (`docs/SCOPE.md`): закрывает J3 («tap-to-act безопасно») для touch-персон View/kiosk — ложные открытия карточек/`more-info` во время pinch нарушали именно этот контракт; правка не добавляет нового поведения, только убирает ложные срабатывания — риска выхода за J1–J7 нет.

## Материал раунда

- SHA: `5790abaa1f3e8701e3de190968178e63156e3fe5`
- Дерево: см. `git diff origin/dev...HEAD --stat` выше
- ТЗ: тело issue #578, раздел `## ТЗ`; ревью ТЗ зелёное, комментарий пайплайна (SPEC-REVIEW-578-r1)

## Вердикт

Зелёный. AC1–AC9 доказаны исполняемыми свидетелями (unit + browser smoke + два отдельных mutation witness), гейты соразмерны диффу и все зелёные, документация и changelog в том же коммите, терминология из `docs/USER-GUIDE.ru.md`. Единственная Low-находка снята без правки.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/578-touch-pinch-longpress`, коммит `5790abaa1f3e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ad6f177adb21efe046fe4e88a6ef7dfede174f32`
  ```
  git log --all --format='%H %T' | grep ad6f177adb21
  ```
- Тело issue: `ec0f61cba0a9ebb0afa611f400145755e567714b91b307e18928aed57bbb61be`
- Вердикт конвейера: `green` · High 0
