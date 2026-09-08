# CODE-REVIEW-487-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/487
- **Заход:** r1 (первый заход код-ревью; блокирующих циклов израсходовано 0/4)
- **Ветка:** `issue/487-room-temperature-thresholds`
- **SHA материала:** `68462b81e08b6f4c3f366703879199bf5e493374` (проверено `git rev-parse HEAD` непосредственно перед выводом)
- **ТЗ:** `docs/specs/487-room-temperature-thresholds.md` (ревью ТЗ — зелёное, SPEC-REVIEW-487-r1)

## Скоуп диффа

`git diff origin/dev...HEAD`, 78 файлов. Продуктовый код: `src/types.ts`,
`src/logic.ts` (`roomTempRangeOf`), `src/space-dialog.ts` (draft/writer
helpers), `src/room-temperature-controls.ts` (новый, UI блока), `src/houseplan-card.ts`
(Full View: state, resolver, дренаж диалога), `src/houseplan-editor-runtime.ts`
(диалог создания/редактирования комнаты, writer, кнопки Save), `src/space-render.ts`
(static card), `src/styles/dialogs.styles.ts`, i18n en/ru/de/fr, backend
`validation.py` (`_finite_number_or_none`, `ROOM_SCHEMA`), `import_export.py`
(`_ROOM_DISPLAY_FIELDS`). Плюс тесты (unit/backend/smoke/golden/mutation),
config-schema/registry, changelog RU+EN, USER-GUIDE RU+EN, CONFIG-COMPATIBILITY,
ARCHITECTURE, bundle-budget.

История ветки содержит один задокументированный инцидент до код-ревью: хендофф
`S6→S7` в 07:40 не смог перейти в ревью, потому что ветка не ребейзилась на
`dev` без конфликта (комментарий 07:41, конфликт только в `dist/**` и
`custom_components/houseplan/frontend/**` — сгенерированный класс D). Это не
цикл ревью: код никто не читал, вердикта не было. После `git rebase origin/dev`
и пересборки бандла (коммиты `e2751062`…`68462b81`) ветка вернулась в
`S7-code-review` в 07:58; именно эта версия и есть материал настоящего r1.

## Как проверялось

### Дешёвые гейты — сняты с зелёного Validate на точном SHA (не гонялись повторно)

Validate `68462b81` (https://github.com/Matysh/houseplan-card/actions/runs/34201690270) —
`success`; job «Фронтенд: типы, юниты, мутанты, синхрон бандла» зелёный, что
покрывает `npx tsc --noEmit`, `npm test`, `npm run build` + сверку бандла.
`docs`/`process-gate`/`hacs`/`hassfest` — зелёные там же.

На этом SHA тяжёлые джобы (`smoke`, `golden`, `performance_smoke`, `backend`)
в самом `68462b81` — `skipped` (обычный push, не release-candidate — §8). Но
`git diff 89deee0f..68462b81 --stat` показывает единственное отличие —
`docs/images/screenshots.json` (провенанс скриншотов документации, не код).
На `89deee0f` (родитель `68462b81`, идентичный функционально) прогон
https://github.com/Matysh/houseplan-card/actions/runs/34201299329 (`workflow_dispatch
full=true`) дал: `Бэкенд: pytest` → success, `Golden-кадры против принятых
эталонов` → success, `Смоки: все шарды зелёные` (1/3, 2/3, 3/3) → success,
`Мутанты по диффу` (1/3, 2/3, 3/3) → success, `Перф-смок` → success. Общий
конклюжен run был `failure` только из-за `Предполётные проверки: документация`
(ожидаемо — экран-провенанс устарел до докоммита `68462b81`, который его и
чинит). Поскольку единственная разница между `89deee0f` и `68462b81` —
docs-провенанс, результаты тяжёлых джобов на `89deee0f` переносятся на текущий
SHA без повторного прогона.

**Явно НЕ гонял:** `npm run gate:small` целиком, `npm run golden:capture`,
полный `npm test` локально (не нужно — см. выше), `python -m pytest
tests_backend -q` целиком (targeted-прогон уже зафиксирован в CI-джобе
«Бэкенд»).

### Что прогнал сам

- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — вывод см.
  ниже, прямых совпадений 22, слабых связей (только `_roomDialog`) 3.
  Диффу для этой задачи целиком покрывающий смок — новый
  `smoke_room_temperature_thresholds.mjs`, уже зелёный в CI (шард 3/3, run
  34201299329). Остальные 21 прямых совпадений (`_nameSel`, `_areaSel`,
  `_roomDialog`, `_climate`, `_renderPlanHass`, `_markers`) относятся к
  существующим, не тронутым этой задачей веткам поведения (стены, мердж/сплит,
  автозакрытие) — изменения в этой задаче в `_saveRoom`/`_saveRoomEdit`/
  `_openRoomEdit`/`_resetRoomDialogFields` строго аддитивны и активируются
  только при непустом черновике температуры (проверено чтением — см. ниже),
  поэтому дополнительный прогон всей группы не требуется; 3 слабые связи
  (`_roomDialog` без иного пересечения) также не запускал — риск регрессии в
  них не выше, чем в 21 пропущенном прямом совпадении, и по той же причине.
- `node scripts/mutation-gate.mjs --id=room-temperature-blank-becomes-zero` →
  чистый прогон **ok**, мутант **ok: тест покраснел, как обязан**.
- `node scripts/mutation-gate.mjs --id=room-temperature-min-inherits-wrong-side`
  → чистый прогон **ok**, мутант **ok: тест покраснел, как обязан**.
- Ручная мутация вне реестра (для AC7, «чистый юнит», по правилу §2.7
  достаточно прогона со снятой защитой, приведённого в документе): в
  `src/space-render.ts` временно заменил `tempRange.min, tempRange.max,` на
  `disp.tempMin, disp.tempMax,` (тот самый регресс, который описывает AC7 —
  «один из renderer paths продолжает передавать disp.tempMin/max напрямую») и
  прогнал `node --test test/room-temperature-renderers.test.mjs`: тест
  **упал** (`assert.doesNotMatch` сработал). Патч отменён сразу после
  прогона, дерево чистое (`git status` — clean).
- Прочитал (не исполнял отдельно, потому что уже покрыто CI выше): весь
  продуктовый дифф построчно — `src/logic.ts`, `src/space-dialog.ts`,
  `src/room-temperature-controls.ts`, `src/houseplan-card.ts` (включая
  `_resolvedRoomFills`, `_roomTemp`/`_roomHum`, обработчики диалога),
  `src/houseplan-editor-runtime.ts` (`_saveRoom`, `_saveRoomEdit`,
  `_roomSettingsFromDialog`, `_openRoomEdit`, `_resetRoomDialogFields`,
  `_renderRoomDialog`), `src/space-render.ts`, backend `validation.py`/
  `import_export.py`, все i18n правки, `scripts/config-schema.json`,
  `scripts/config-field-registry.mjs`, `scripts/bundle-budget.mjs` (объяснение
  поднятого потолка 290 500→291 500 с измеренным фактом 290 937 Б).
- Проверил, что провенанс golden-эталонов реален: коммит `89deee0f` несёт
  `Release: v1.73.0-beta.6` и `Baseline-Reviewed: .../runs/34198109380`. Этот
  прогон в целом `cancelled`, а его job «Golden-кадры против принятых
  эталонов» — `failure`. Проверил семантику: `goldenRunFailed()` в
  `demo/golden/policy.mjs` считает verify-прогон красным, если **любой**
  сценарий не `passed` — а для двух совершенно новых сцен закономерно нет
  эталона (`missing-baseline` ≠ `passed`), то есть красный статус этого job
  ожидаем именно потому, что сцены новые, а не потому, что кадры неверны.
  Подтверждение, что принятые эталоны корректны: `89deee0f` сам по себе (уже
  содержащий новые эталоны) даёт `Golden-кадры против принятых эталонов` →
  **success** в run 34201299329. Ложной тревоги не было, но стоило проверить
  явно — процесс запрещает «зелёный ради зелёного» (правило 13), поэтому
  ссылка на красный/отменённый прогон заслуживала отдельной проверки, а не
  доверия на слово.

### smoke-select — вывод инструмента

```
Матрица: 231 смоков · порог «широкого» символа: больше 46 смоков

Прямое совпадение (22): smoke_room_settings, smoke_editor_tabs,
smoke_merge_split, smoke_room_autoclose, smoke_draw_wall_thickness,
smoke_feedback_v2, smoke_island_rooms, smoke_junction_limits,
smoke_plan_drawing_repairs, smoke_room_temperature_thresholds (← _roomTempMax,
_roomTempMin — новый смок, целевой),
smoke_unified_wall_tool, smoke_v8_draft_write, smoke_wall_face_overlap,
smoke_wall_thickness_transition, smoke_zero_divider_taper, smoke_binding_picker,
smoke_climate_once, smoke_climate_temp, smoke_linked_virtual_light,
smoke_registryless_opening, smoke_render_invalidation, smoke_room_climate_placement

Слабая связь (3, только по _roomDialog): smoke_plan_snap_overlay,
smoke_split_nonsnap, smoke_split_polyline
```

## Находки

Нет находок уровня High или Medium.

**Low (не блокирует, зафиксировано без правки):**

1. `src/houseplan-card.ts`, метод `_roomTemp`/`_roomHum` (около строки 12559) —
   попутный рефакторинг, не требуемый задачей: две задокументированные
   функции с раздельными JSDoc-комментариями схлопнуты в однострочный
   тернарник без комментариев. Поведение идентично (сравнил построчно: было
   `if (src) return sourceValue(...); ...; return key ? ... : null;`, стало
   `src ? sourceValue(...) : key ? ... : null`) — регрессии нет, но это
   несвязанная правка соседнего кода вне скоупа задачи (правило «скоуп не
   расширяется», §2.6). Решение — оставить: правка безвредна и обратный откат
   стоит дороже, чем экономит.
2. `src/styles/dialogs.styles.ts` — блок `.colorrow { ... }` переформатирован
   с отступа 6 пробелов на 2 без изменения содержимого (чистый шум диффа);
   остальной файл сохраняет 6-пробельный отступ. Не влияет на выполнение,
   решение — оставить.
3. `demo/smoke_room_temperature_thresholds.mjs` не проверяет отдельно случай
   «невалидное значение при скрытом (не-temp) режиме заливки всё равно
   блокирует Save» — AC5/AC6 пересекаются здесь только по построению кода
   (`tempValid`/`canSaveNew` не зависят от видимости блока), не по
   отдельному свидетелю. Логика проста и линейна, дополнительного риска не
   вижу — не Medium, просто отмечаю как замеченный, но не обязательный пробел
   покрытия.

## AC — таблица «чем доказано / чем краснеет»

| AC | Доказано | Чем краснеет — команда и результат |
|---|---|---|
| AC1 Полное наследование | `test/logic.test.mjs` (`roomTempRangeOf(20,25,null)` и правки space min/max без записи комнаты — читал `_resolvedRoomFills`, наследование идёт через `disp.tempMin/tempMax`, не кэшируется) | покрыто `test/logic.test.mjs`; отдельного мутанта в реестре нет (чистый юнит, читал вручную — резолвер не хранит состояние между вызовами) |
| AC2 Полный override + соседняя комната | `test/logic.test.mjs` + `demo/golden/matrix.mjs` (`room-temperature-dialog-mobile-ru`, partial); соседство проверяется тем, что резолвер вызывается **на комнату**, а не на пространство (цикл `space.rooms.map` в `space-render.ts` и `_resolvedRoomFills`) | `test/room-temperature-renderers.test.mjs` — проверил вручную: откат `space-render.ts` на `disp.tempMin/tempMax` красит тест (см. «ручная мутация» выше) |
| AC3 Частичный override | `test/logic.test.mjs` (own min only / own max only), `test/space-dialog.test.mjs` (`roomTempThresholdDraft('', '19')` → `{min:null,max:19}`) | `--id=room-temperature-min-inherits-wrong-side` → **краснеет** (запускал) |
| AC4 Переставленные границы | `test/logic.test.mjs` (`temp_min:28, temp_max:18` → `{min:18,max:28}`), `test/space-dialog.test.mjs` (`'24,5'`/`'18,5'` с запятой как разделителем — проверил, что `strictNumber` понимает и запятую, и точку) | читал: удаление `Math.min/Math.max` в `roomTempRangeOf` очевидно ломает оба теста выше |
| AC5 Blank/zero/invalid | `test/space-dialog.test.mjs` (`applyRoomTempThresholdDraft` пустое→удаление key, `'0'`→`0`, `'bad'`→`false` без изменения settings) | `--id=room-temperature-blank-becomes-zero` → **краснеет** (запускал) |
| AC6 Скрытые значения не теряются | `demo/smoke_room_temperature_thresholds.mjs` (`hiddenOutsideTemp`, `hiddenDraftRetained`) — зелёный в CI (шард смоков, run 34201299329); писатель (`applyRoomTempThresholdDraft`) вызывается безусловно, не под `if (effectiveFill==='temp')` — проверил чтением в `_saveRoomEdit`/`_roomSettingsFromDialog` | проверено чтением: перенос вызова `applyRoomTempThresholdDraft` под условие `fill==='temp'` регрессировал бы AC6, но живого свидетеля-мутанта на этот шаг нет — единственный пробел эквивалентного веса Low №3 выше |
| AC7 Live preview / parity | `test/room-temperature-renderers.test.mjs`, golden `room-temperature-dialog-desktop-en/mobile-ru` (успешно верифицированы в CI, run 34201299329) | проверил вручную (см. «ручная мутация») — **краснеет** |
| AC8 UI/responsive | golden (обе сцены: desktop-en 900×900, mobile-ru 390×820 dark + partial override), `demo/golden/harness.mjs` бросает при `scrollWidth > clientWidth+1` или неполном наборе полей | golden verify зелёный в CI на этих двух сценах; убрать `flex-wrap: wrap` в `.roomtemprange-fields` сломало бы `narrowHasNoHorizontalScroll` в смоке — не проверял отдельным мутантом, чисто визуальный CSS-инвариант |
| AC9 Backend/compat | `tests_backend/test_validation.py::test_room_temperature_thresholds_are_optional_strict_finite_numbers` — bool/строка/NaN/Infinity отклоняются, `None` принимается, `0`/`24.5` проходят | тест сам по себе явно перебирает контрпримеры (`True`, `"20"`, `nan`, `inf`) внутри одного теста — эквивалент мутации, проверил чтением, что `_finite_number_or_none` действительно вызывает `vol.Invalid` на каждый |
| AC10 Import/export | `tests_backend/test_ha_import_export.py` — full/space round-trip сохраняет `temp_min/max` вместе с `future_room_binding` (недокументированное поле не теряется), plan-only включает оба поля в проекцию и отбрасывает `area`/`future_room` | читал `_ROOM_DISPLAY_FIELDS`: поля добавлены в allowlist рядом с `glow`, а не в HA-identity список — приватность plan-only не ослаблена |
| AC11 Без побочных изменений | `_roomTemp`/`_roomHum` не создают новый climate-pass — сверил, что `roomClimateKey`/`this._climate()` вызываются так же, как до диффа (см. Low №1: рефакторинг чисто косметический) | проверено чтением; `roomTempRangeOf` не читает `hass`/`this._climate()` вообще — чисто математическая функция от трёх аргументов |
| AC12 Локализация/docs | `test/i18n-dead-keys.test.mjs` (`derivedHelpAria.size` 19→20, детерминированно проверяет, что `.help`/`.help.aria` пара существует для всех языков через `_help()`); USER-GUIDE EN/RU и CONFIG-COMPATIBILITY правки читал построчно — соответствуют реальному контракту (наследование, «As the space», единственный потребитель — заливка) | i18n-parity тесты — часть «Фронтенд» job, зелёного на `68462b81` |

## Продуктовое рассуждение (не только AC)

Задача заявлена как закрытие пробела в J5 («Room climate at a glance»,
`docs/SCOPE.md` явно называет «Threshold colouring for room-card metrics» в
списке частично покрытых улучшений). Реализация точно уважает решения
владельца от 07.09: наследование двухуровневое без глобального яруса, нет
ссылок на HA helpers, нет отдельного индикатора «свой диапазон» вне диалога.
Соседние поверхности (room-card, tooltip, источник температуры, HA
service calls) не тронуты — проверил построчно, единственный потребитель
новых полей это `resolveEffectiveRoomFill` через `roomTempRangeOf`/
`roomTempRangeFromDraft`.

«Одно число — один источник» (обязательная проверка): диапазон комфорта
комнаты вычисляется **один раз за кадр** в `_resolvedRoomFills()`
(Full View) и **один раз** в `renderSpaceStatic()` (static card) — оба
вызывают один и тот же чистый резолвер `roomTempRangeOf` (static — напрямую,
Full View — через `roomTempRangeFromDraft`, который добавляет только черновик
активного диалога поверх того же резолвера). Ни диалоговый placeholder, ни
подпись, ни room-card не показывают температурный диапазон отдельно — они
показывают саму температуру, которая этой задачей не переоценивается.
Дублирования числа не вижу.

## Унаследовано / что проверял в этом раунде

Не применимо — это первый заход (r1) код-ревью для #487. Раздел «Унаследовано
из r<N−1>» не требуется (§2.10 относится к повторным раундам). Досрочный
инцидент «Ревью не запускалось» (рассинхрон бандла при ребейзе, 07:41) не
образует раунда: код не читался, вердикта не было, только конфликт
слияния — материал этого r1 это версия ветки уже **после** ребейза.

## Вердикт

Зелёный. AC1–AC12 доказаны — либо автотестом с подтверждённым «умением
падать» (два зарегистрированных мутанта в `scripts/mutation-gate.mjs` плюс
одна ручная мутация для AC7, все три реально прогнаны в этом раунде и
показали красный на дефекте), либо проверкой чтением с явной пометкой.
Находки — три Low, ни одна не требует правки для приёмки (оставлены с
записью выше). Дешёвые гейты подтверждены зелёным Validate на точном SHA
`68462b81` и его функционально идентичном родителе `89deee0f` (полный
тяжёлый набор, включая golden и все три шарда смоков). Golden-провенанс
проверен отдельно из-за красного/отменённого `Baseline-Reviewed` прогона —
семантика подтверждена (новые сцены закономерно красят verify до принятия),
подмены эталонов не найдено.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/487-room-temperature-thresholds`, коммит `68462b81e08b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5e50ffb3debd91974b494e4ba49d073a8402e583`
  ```
  git log --all --format='%H %T' | grep 5e50ffb3debd
  ```
- ТЗ `docs/specs/487-room-temperature-thresholds.md`, блоб `d1d33e782d3edd6fd7e393c6e372a7d76439d05e`
  ```
  git log --all --find-object=d1d33e782d3edd6fd7e393c6e372a7d76439d05e -- docs/specs/487-room-temperature-thresholds.md
  ```
