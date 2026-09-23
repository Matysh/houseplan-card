# CODE-REVIEW-614-r1

Issue: [#614](https://github.com/Matysh/houseplan-card/issues/614) — «Диалоги настроек: единая политика пустого/невалидного поля,
тосты `_saveMarker` → ошибки под полем, снимок baseline забывается до валидации».

Материал: `bc6b243f56362ba89f157b891955b71a004d8e81` (two commits on
`issue/614-dialog-validation-baseline`: `1a6b12af` — основная реализация,
`User-Visible: yes`, оба changelog в том же коммите; `bc6b243f` — точечный
тип-фикс `no-new-any`, `User-Visible: no`).

Заход: **r1** — первый фактический код-ревью этой задачи. Предыдущая попытка
поставить `S7-code-review` на `1a6b12af` не дошла до модели: гейт-Validate с
мутантами упал до ревью (см. комментарий от 2026-09-23T12:43:43Z), цикл не
израсходован. Разделов «Закрытие раунда r0» и «Унаследовано из r0» поэтому
нет — это не сокращённый повторный проход, это первый разбор всего диффа.

Трек: полный (аналитика: сложность 6, риск 6, P2). Спецревью прошло зелёным
2026-09-23T12:02:30Z, документ `docs/reviews/SPEC-REVIEW-614-r1.md`, Q1/Q2
закрыты владельцем как Default/Default.

## Скоуп проверки

Полный разбор диффа `origin/dev...HEAD` (86 файлов, класс A: 13 файлов
`src/**`; класс B: 4 смока, `scripts/bundle-budget.mjs`,
`scripts/mutation-registry.mjs`, `tsconfig.test.json`, 2 unit-теста; класс C:
оба changelog, `USER-GUIDE.ru.md`; класс D: `dist/**` и зеркала — не
проверяю содержательно, только что сборка сошлась).

Читал построчно: `dialog-baseline.ts`, `general-form-state.ts`,
`general-settings-dialog.ts`, `space-form-state.ts`, `space-form.ts`,
`marker-form-state.ts`, `marker-dialog.ts`, `houseplan-editor-runtime.ts`
(`_saveMarker`, `_saveSpaceDialog`, `_saveSettingsDialog`,
`_openSpaceDialog`, `_openSettingsDialog`), `houseplan-card.ts`
(`_warmDialogState`, revive-switch, `_settingsDialog` type), `card-runtime.ts`
(`WarmDialog`), `houseplan-onboarding-runtime.ts`, `grid-scale.ts`,
`space-dialog.ts` (`strictNumber`, тип `SpaceDialogState`), i18n
`{en,ru,de,fr}.json` × 2 файла, оба changelog, `USER-GUIDE.ru.md`,
`scripts/mutation-registry.mjs` (шесть новых мутантов #614),
`scripts/bundle-budget.mjs` (два новых потолка).

## Как проверялось

Дешёвые гейты уже подтверждены на этом SHA: Validate
[run 35863114963](https://github.com/Matysh/houseplan-card/actions/runs/35863114963)
завершился success (`typecheck`, `test`, `build`+сверка бандла,
`no-new-any`). Не перегонял их заново по правилу «один зелёный прогон на SHA
не повторяется» — вместо этого потратил время ревью на код и на то, что
Validate не гарантирует.

Сам прогнал:
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — 27 прямых
  совпадений из 263, все по общеупотребимым символам (`_showToast`, `_mode`,
  `cellCm`, `_settings`, `_saveMarker`, `_settingsDialog`); ниже порог
  «широкого» символа (52) не превышен ни по одному имени. Из прямых
  совпадений отобрал по существу задачи четыре смока, которые сам диф и
  переписал под AC1–AC4 — остальные совпадения либо про соседний слой
  (`smoke_grid_scale_invariance`, `smoke_radar_*`, `smoke_partition_openings`
  и т.п. зацеплены только за `cellCm`/`_showToast` — общие символы, не
  контракт этой задачи), либо про warm-механику вне четырёх baseline-aware
  форм. Слабые совпадения (53) не разбирал построчно — все по одному общему
  имени, разрешение инструмента прямо говорит, что это не обязанность
  прогонять.
  - `npm run bundle:sync` (пересобрал — `demo/srv/assets` не закоммичен,
    #255) → `node demo/smoke_general_settings_form.mjs`,
    `smoke_space_settings_form.mjs`, `smoke_device_settings_form.mjs`,
    `smoke_warm_dialogs.mjs` — все четыре: **OK**, все ключи-ассерты
    (включая новые: `invalidGlowKeepsRawAndBlocksOldValue`,
    `northOutOfRangeBlocksSave`, `invalidScaleKeepsRawAndBlocksOldValue`,
    `twoInvalidTempsKeepRawAndCountSeparately`, `virtualNameIsAnInlineProblem`,
    `runWithoutTargetIsInline`, `badgeWithoutSourceIsInline`,
    `saveAttemptDoesNotForgetBaseline`, `eSettingsDirtyAfter`,
    `fRoomDirtyAfter` и т.д.) — `true`.
- `npm test` — 2838 тестов, 2837 pass, 1 skipped (не связан с #614), 0 fail.
- `npm run bundle:budget` — оба новых потолка (`INITIAL_VIEW_GZIP_CEILING`
  292000, `LAZY_EDITOR_GZIP_CEILING` 245400) сходятся с фактической сборкой
  (291016 Б / 244340 Б), заявленные в комментариях замеры (~291041/~244356)
  им не противоречат. Предупреждение про запас < 15000 Б — существующий долг
  (#367/#474), не новый и не по вине этой задачи.
- `node scripts/check-docs.mjs` — красный по отпечатку скриншотов; ожидаемо
  для любой правки `src/**` (см. ниже, это не гейт ревью).

Не гонял: `npx tsc --noEmit` / отдельный `npm run build` (уже green на этом
SHA), `golden:verify`, `pytest tests_backend`, geometry/invariants
performance — обоснование каждого пропуска в разделе «Чего не проверял».

## Находки

### M1 (Medium, в скоупе) — AC1/AC2/AC3 требуют unit-тест, а он не написан

ТЗ (принятое зелёным спецревью) для каждого из AC1–AC4 в явном виде называет
двойное доказательство: **«unit + browser smoke»**. Браузерные смоки
дописаны честно и содержательно (см. прогон выше). Юнит-тестов на саму
логику черновика — ни одного:

- `test/dialog-baseline.test.mjs` (новый) тестирует только перенос baseline
  между хостами (`dialogBaseline`/`restoreDialogBaseline`/`stableKey`) — это
  закрывает юнит-часть AC4.
- `test/space-dialog.test.mjs` получил один новый тест на `strictNumber` —
  но это существовавшая до задачи чистая функция, не новая логика черновика.
- `generalProblems` (`general-form-state.ts:35`), новая ветка
  `spaceDialogProblems` для `cellCm`/`tempMin`/`tempMax` (`space-form-state.ts:279`),
  и `markerProblems` с тремя новыми полями (`marker-form-state.ts:47`) —
  ни одна не импортирована ни одним `test/*.mjs`:
  `grep -rl "generalProblems\|markerProblems\|spaceDialogProblems" test/*.mjs`
  ничего не находит.
- Причина технически проста и указывает на пропуск, а не на решение:
  `tsconfig.test.json` компилирует `dialog-baseline.ts` для тестов (строка
  добавлена этим же диффом), но не `general-form-state.ts`,
  `space-form-state.ts` и `marker-form-state.ts` — юнит-тест для них
  физически не может быть собран без такого же добавления, которое для этих
  трёх файлов не сделано.

Это именно тот код, ради которого заведена задача (M3/M4 из аудита): контракт
«сырой текст не подменяется старым числом» и три инлайн-ошибки устройства.
Он проверен интеграционно (браузер, реальный DOM) и мутационно
(`scripts/mutation-registry.mjs` добавляет 6 новых мутантов на этот самый
код с смоками как guard), но не на уровне чистой функции, как того явно
требует принятое ТЗ. Мутационный guard ловит конкретную регрессию, которую
описал автор мутанта, а не проверяет функцию по всей области определения
(границы 0/359, `-0`, запятая как разделитель, пробелы, `NaN`-подобный текст,
`min === max` и т.п. — часть этих случаев в смоках не встречается вовсе).

**Воспроизведение:** `grep -rl "generalProblems\|markerProblems\|spaceDialogProblems" test/*.mjs`
— пусто. `grep -n "general-form-state\|space-form-state\|marker-form-state" tsconfig.test.json`
— пусто.

**Почему Medium, не High:** поведение реально работает — смоки и мутационные
guard'ы это подтверждают построчно и я перепроверил их сам (все зелёные на
этом SHA). Ничего не сломано и не потеряно для пользователя. Но принятое ТЗ
называет юнит-тест частью критерия приёмки трёх из четырёх AC, и его
объективно нет — это дыра в контракте задачи, не гипотетический риск.

**Что нужно:** добавить `general-form-state.ts`, `space-form-state.ts`,
`marker-form-state.ts` в `tsconfig.test.json` (по образцу уже добавленного
`dialog-baseline.ts`) и юнит-тесты на `generalProblems`, `spaceDialogProblems`
(ветки `scale`/`temp`/`north`) и `markerProblems` (три новых поля), минимум
по границам контракта: пусто/пробелы/запятая/мусор/выход за диапазон/валидное
значение.

Находка в скоупе задачи (оба файла-кандидата уже изменены этим диффом,
тестовая инфраструктура для них уже начата этим же диффом для соседнего
модуля) → жёлтый вердикт, доработка в этой же задаче, отдельный issue не
заводится (owner's decision #202).

## Что проверено и корректно

- **AC1 (общие настройки).** `generalProblems` читает `glowRadiusInput`/
  `northDegInput` напрямую (не «последнее валидное число»); typed-значение
  обновляется только при успешном разборе (`general-settings-dialog.ts:99-106,112-131`).
  `TRANSIENT` в `general-form-state.ts:11` исключает оба raw-поля из
  dirty-ключа — другой текст того же числа не создаёт ложного изменения, а
  само по себе изменение raw без изменения typed не разблокирует Save в
  обход неизменившегося dirty-ключа (согласуется с контрактом «Сырые поля
  исключаются из semantic dirty-key»). Reset-to-defaults синхронно обновляет
  оба представления (`general-settings-dialog.ts:136-142`). Смок
  `invalidGlowKeepsRawAndBlocksOldValue`/`northOutOfRangeBlocksSave`
  подтверждают на реальном DOM.
- **AC2 (пространство).** `spaceDialogProblems` пересчитывает `cellCm`
  строго из `cellCmInput` с учётом imperial-конверсии через
  `gridCellFieldToCm`, границы вынесены в единый источник
  `GRID_CELL_CM_MIN/MAX` (`grid-scale.ts:9-10`), на который теперь ссылаются
  и `space-form.ts` (`CELL_CM_MIN`/`MAX` реэкспорт), и `spaceDialogProblems` —
  один источник для одного числа. `tempMin`/`tempMax` проверяются
  раздельно, ошибка диапазона привязана к max, как того требует ТЗ
  (`space-form-state.ts:298-306`). North-инпут блокирует Save только пока
  выбран custom-режим; переключение на «как в общих» одним действием
  сбрасывает и `northDeg`, и `northDegInput` (`space-form.ts:429-432,453-454`).
  `_saveSpaceDialog`/`_saveSpaceDialog` (обычный редактор и онбординг)
  перепроверяют `spaceDialogProblems` перед записью — невалидный raw физически
  не может попасть в конфиг (`houseplan-editor-runtime.ts:8472`,
  `houseplan-onboarding-runtime.ts:695`). Проверил построчно, что итоговая
  запись в `sp.settings`/`sp.cell_cm` (`houseplan-editor-runtime.ts:8541-8574`)
  берёт только typed-поля (`d.northDeg`, `d.tempMin`, `d.tempMax`, `d.cellCm`) —
  ни один `*Input` в конфиг не попадает (AC5).
- **AC3 (устройство).** Три предусловия `_saveMarker` (`virtual_name`,
  `run_target`, `value_badge_source`) продублированы в `markerProblems`
  (`marker-form-state.ts:231-242`) в порядке полей формы, привязаны к
  `error`/`aria-invalid` под соответствующим полем (`marker-dialog.ts:171-198`).
  Старые тосты `toast.virtual_name_required`/`toast.run_target_required`/
  `toast.value_badge_source_required` удалены из всех четырёх локалей без
  расхождения (en/ru/de/fr идентичны), `_saveMarker` сохранил ранний `return`
  без тоста — это внутренняя защита от программного вызова, как и требует
  ТЗ, а не основной UX. `forgetMarkerBaseline` перенесён из обработчика клика
  внутрь `_saveMarker` и вызывается только после `configAccepted`/успешных
  побочных эффектов, непосредственно перед `_closeMarkerDialog()`
  (`houseplan-editor-runtime.ts:8125-8126`) — ранний выход или исключение в
  `catch` (строки 8127+) его не трогает, baseline переживает отказ записи.
  `requestClose` в `marker-dialog.ts:172,181` тоже явно забывает baseline
  только при закрытии без изменений или при подтверждённом discard — ровно
  условие «Cancel без confirm при отсутствии изменений» из ТЗ.
- **AC4 (warm revive).** `WarmDialog.baseline` переносится для всех четырёх
  baseline-aware форм одинаково — через общий хелпер `at()` в
  `_warmDialogState()` (`houseplan-card.ts:3579-3608`), который вызывает
  `warmDialogBaseline(this, kind)` независимо от вида диалога. Восстановление
  (`houseplan-card.ts:3709`, `restoreWarmDialogBaseline`) происходит синхронно
  сразу после того, как switch восстановил сам черновик диалога и до
  `requestUpdate()` — оба объекта (draft, baseline) оказываются на новом
  хосте в одном синхронном участке кода, что и требует ТЗ («атомарно до
  вычисления dirty-state»). `warmBaselineKind` ограничивает перенос ровно
  четырьмя видами (`space`/`marker`/`settings`/`room`), остальные виды
  warm-диалогов (`opening`, `decorText` и т.д.) не получают
  baseline-семантики — согласуется с «для остальных видов warm-диалогов
  поведение не меняется». Прогнал `smoke_warm_dialogs.mjs` целиком (включая
  новые блоки E/F про `settings` и `room`) — все ассерты `true`.
- **AC5 (совместимость).** Ни один `*Input`-ключ (`glowRadiusInput`,
  `northDegInput`, `cellCmInput`, `tempMinInput`, `tempMaxInput`) не
  сериализуется в `ServerConfig`; baseline живёт в модульном `WeakMap`
  (`dialog-baseline.ts:14`), не в `localStorage` — grep по `localStorage` в
  затронутых файлах не находит ничего нового рядом с warm-механикой. Формат
  валидного сохранения (`sp.settings.north_deg`, `temp_min`/`temp_max`,
  `cell_cm`, `marker.glow_radius_cm`) не изменился относительно `dev`.
- **i18n.** Пять новых ключей (`space.error_scale`, `space.error_temp_value`,
  `marker.error_virtual_name`, `marker.error_run_target`,
  `marker.error_value_badge_source`) добавлены во все четыре локали без
  расхождений; три отмерших тоста синхронно удалены из всех четырёх. Тексты
  EN/RU человекочитаемы, DE/FR — паритетны по смыслу.
- **Трейлеры/changelog.** `1a6b12af` — `Issue: #614`, `User-Visible: yes`,
  оба changelog в этом же коммите, формулировки соответствуют
  `USER-GUIDE.ru.md` (термин «Проверить N полей» использован как есть, не
  изобретён заново). `bc6b243f` — точечный тип-фикс, `User-Visible: no`,
  changelog не тронут — верно, изменение не поведенческое.
- **`docs/USER-GUIDE.ru.md`.** Формулировки про пустое поле-как-наследование
  сужены до «только там, где это прямо написано в подсказке» и добавлен абзац
  про warm revive — оба соответствуют принятому ТЗ, ничего не выдумано.

## Чего не проверял и почему

- `npx tsc --noEmit` / отдельный `npm run build` вне `bundle:sync` — уже
  green на этом SHA ([run 35863114963](https://github.com/Matysh/houseplan-card/actions/runs/35863114963));
  `bundle:sync`, который я запустил ради смоков, транзитивно прогнал и
  `tsc --noEmit`, и `rollup -c` без ошибок — повторное подтверждение получено
  бесплатно, отдельно не считаю.
- `golden:verify` — diff не трогает канвас/геометрию/слои; открытые диалоги
  настроек не входят ни в один сценарий `demo/golden/*.mjs`
  (`demo/golden/harness.mjs` трогает `_markerDialog` только для установки
  `display: 'icon_ripple'` в несвязанном сценарии, не для сравнения формы).
  Видимый результат, который меняет эта задача, — содержимое диалогов, не
  снимки плана.
- `python -m pytest tests_backend` — diff не касается ни одного
  `custom_components/**/*.py`.
- `npm run invariants` / geometry parity — diff не трогает рёбра комнат,
  толщину стен, `layout` или `open_spans`; единственная геометрическая
  величина в диффе (`cellCm`/`CELL_CM_MIN/MAX`) — это масштаб отображения
  формы, а не геометрия модели, и её пределы не изменились (0.1…1000,
  перенесены в общий источник без изменения значений).
- Полный `smoke`-набор (263 файла) — не запускал по решению из
  `smoke-select`: ни одно совпадение не перешагнуло порог «широкого» символа,
  совпадения — по общеупотребимым именам, а не по контракту задачи. Это
  предрелизная обязанность, не обязанность этого ревью.
- `check-docs --screenshots` — красный ожидаемо (любая правка `src/**`
  делает отпечаток скриншотов устаревшим); это ошибка только на релизном
  кандидате, не гейт ревью.
- Performance-профили — не названы в AC, diff не касается путей, к которым
  они привязаны.

## Итог

Единственная находка — Medium, в скоупе задачи (пропущенный юнит-уровень
доказательства для AC1–AC3, явно требуемого принятым ТЗ). Функциональность
работает: перепроверил лично все заявленные смоки и мутационные guard'ы на
этом SHA, юнит-сьют зелёный (2837/2838, 1 skip не по теме), бандл-бюджет
сходится. High-находок нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/614-dialog-validation-baseline`, коммит `bc6b243f5636` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a808be3f921a36d3943cc93fbc1d8a70ce3c79af`
  ```
  git log --all --format='%H %T' | grep a808be3f921a
  ```
- Тело issue: `3b8a95fd43a037cc6c1f3207c6f5b242ef566b28bde385f5e12b4a225d938221`
- Вердикт конвейера: `yellow` · High 0
