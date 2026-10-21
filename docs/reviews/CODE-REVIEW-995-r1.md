# CODE-REVIEW-995-r1

Issue: #995 · Этап: code · Трек: show · Заход: r1 · Блокирующих циклов: 0/2
Материал: `340282bde6de13b0c55f800bb99a23754ab4b324` (единственный коммит ветки
над `origin/dev`), рабочая копия ревью стояла ровно на нём; `git fetch/pull/
checkout` не выполнялись.

## Скоуп

Локальная полировка одной поверхности — диалог настроек устройства
(J4/J6 из `docs/SCOPE.md`): восстановить оформление реального HA MDI-picker
в «Отображение на плане» (двойная рамка/нестилизованное поле, регресс от
#988) и вертикальный интервал между селектом «Активно при» и ручным вводом
значения (регресс от #977/#991). Правка — только CSS двух монолитных листов
(`src/styles/form-kit.styles.ts`, `src/styles/settings-dialogs.styles.ts`),
без изменений JS/TS-логики, конфигов, i18n, миграций. Трек `show`
подтверждён автором в теле issue (риск 3/10, одна поверхность, без нового
UX-контракта).

Изменённые файлы: 14; продуктовый код — только 2 CSS-монолита, остальное —
смоки (`demo/smoke_device_settings_form.mjs`,
`demo/smoke_marker_state_source.mjs`, `demo/ui-lab/verify-icon-picker.mjs`),
замороженные CSS-фикстуры и их тест, документация и release-ledger.

## Маршрут §5 (трек show)

| Критерий | Оценка |
|---|---|
| complexity | ≤3 — два CSS-токена и одно правило `display:grid;gap:18px` |
| surfaces | один диалог настроек устройства |
| migration | нет — ни конфига, ни новых compatibility-полей |
| ux-contract | нет нового контракта — восстановление уже принятого оформления form-kit (#988 AC2) и типового интервала формы (18px используется в том же листе) |
| perf-touch | нет влияния — чистый CSS, не затрагивает touch-жесты |
| undocumented | поведение зафиксировано: form-kit граница/фон поля (`docs/ARCHITECTURE.md` «Composite form focus», `docs/DEVELOPMENT.md` «HA icon-picker lifecycle (#988)») и 18px-ритм формы (множественные правила `gap:18px`/`margin-top:18px` в том же файле) |

Все критерии пройдены → **`route: fix`**, не `reclassify`.

## Как проверялось

### Дешёвые гейты (прогнаны лично — зелёного Validate на `340282bde` не было)

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | чисто, без вывода |
| Юниты | `npm test` | `tests 5502 · pass 5501 · fail 0 · skipped 1`, exit 0 (включая замороженный байт-в-байт `test/form-kit.test.mjs`) |
| Сборка | `npm run build` | `tsc --noEmit && rollup -c` — успех, `dist` создан |
| Бандл | `node scripts/bundle-policy.mjs --verify` | «свежая сборка dist цела (60 ассетов); закоммиченная копия не сверяется — бандл меняет только кандидат (#657)» |
| Восстановление дерева | `npm run bundle:clean` | бандл возвращён к закоммиченному; `git status` чист |

### По диффу и AC (смоки, названные в AC + `smoke-select`)

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`: два
зарегистрированных, но файловых (широких) совпадения
(`smoke_settings_navigation.mjs`, `smoke_ui_polish_976.mjs` — регистрация на
весь `settings-dialogs.styles.ts`, не на конкретный хук) и явная
**НЕОПРЕДЕЛЁННОСТЬ** с визуальным минимумом (8 смоков). Решение по каждой
строке:

- `smoke_settings_navigation.mjs` / `smoke_ui_polish_976.mjs` — слабая
  файловая связь с несвязанными поверхностями (#948 навигация настроек,
  #976 закрытие/фокус инструментов); дифф их не касается по символам —
  не гонял, это повод посмотреть, а не обязанность (§8 REVIEWER.md).
- Визуальный минимум (8 смоков режимов/слоёв/отрисовки) — прецедент #687/#234
  прямо предупреждает не пропускать его при «НЕОПРЕДЕЛЁННОСТИ» на CSS-правке.
  Прогнал все восемь: `smoke_modes`, `smoke_mode_transition`,
  `smoke_hide_layers`, `smoke_decor_layer_order`,
  `smoke_daycycle_zoom_layers`, `smoke_static_zoom_sharpness`,
  `smoke_wall_hatch_density`, `smoke_visual_continuity` — все `OK`, без
  побочного влияния на canvas/отрисовку плана.

Смоки, названные в самом AC:

- **AC1** — `demo/ui-lab/verify-icon-picker.mjs` (реальный официальный HA
  frontend, подготовлен `node demo/ui-lab/prepare-ha.mjs`, версия
  `20260930.4`). Прогнан: `OK #988 genuine HA: 8 checks`. Проверено
  исполнением: `fieldBackground`/`lineColor` поля перестали быть
  `rgba(0,0,0,0)` (поле не «без оформления») в светлой и тёмной теме,
  `outerOutline: 'none'` при фокусе (нет вложенной двойной рамки),
  `visibleFocus: true` на клавиатурном фокусе, стилизованный попап (непрозрачный
  фон, `borderWidth ≤ 1`, `radius ≥ 7`, тень) в обеих темах, выбор/очистка
  не пишут черновик до Save, Cancel сохраняет прежнюю иконку и не рвёт guard
  родителя (#988).
- **AC2** — `demo/smoke_marker_state_source.mjs` (дополнен в этом коммите
  прямым измерением прямоугольников). Прогнан: `#995 manual field gap: 18` →
  `manualFieldHasFormSpacing: true` (допуск 12–24px, факт 18px — ровно
  стандартный интервал формы), плюс `automaticHidesManualField`/
  `manualCanBeRestored` (новые проверки переключения туда-обратно) и
  `saved`/`singleManualField` — все `true`, `OK`.
- **AC3** — `demo/smoke_device_settings_form.mjs` (дополнен проверкой
  `fallbackHasSingleFocusOwner`) и тот же `smoke_marker_state_source.mjs`
  (соседние поля, Save/Cancel, текстовый fallback). Прогнаны оба целиком:
  все проверки `true`, `OK`, включая `fallbackHasSingleFocusOwner`,
  `iconFieldHasPreview`, `manualIconWrites`, `clearResetsIcon`,
  `saveEnabledWhenDirtyWithoutDuplicateStatus`, `discardAsksFirst` и полную
  адаптивную матрицу (320–1920px).

### Защитный AC — таблица «AC · чем доказан · чем краснеет»

AC3 требует явно: «прежняя защита parent от lifecycle вложенного picker
сохраняется». Этот коммит не меняет JS/TS lifecycle-код (`marker-dialog.ts`,
обработчики `wa-hide`/Escape) — только CSS. Guard остаётся тем же кодом,
что и в #988, и доказан теми же зарегистрированными мутантами реестра:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC3 (parent close guard при вложенном picker) | Исполнен `verify-icon-picker.mjs`: `activeInPicker: true` на всех шагах, `Cancel preserves saved icon; parent close guard remains active` — PASS; код guard'а не менялся с #988 (прочитано чтением — `marker-dialog.ts` вне diff) | id `dialog-picker-hide-closes-owner-988`, id `dialog-picker-escape-closes-owner-988` (`scripts/mutation-registry.mjs`) — не исполнялись (мутанты вне ночного workflow не гоняются, #709/#905) |
| AC1 (парный второй wrapper-border при ha-icon-picker) | Исполнено: `wrapperBorder: 'rgba(0,0,0,0)'`, `wrapperOutline: 'none'` во всех 4 комбинациях тема×ввод | id `icon-picker-wrapper-restores-second-border-988` — не исполнялся |

AC1 (визуальное оформление: фон/контур поля, попап) и AC2 (интервал 18px) —
не защитные AC в терминах §2.7 (не валидация/гард/лимит/отказ/инвариант), а
обычные визуальные контракты; доказаны прямыми измерениями исполненного
смока (значения выше), третий столбец для них не требуется.

## Разбор по коду (проверено чтением, не исполнением — дополнительно к смокам)

- `src/styles/form-kit.styles.ts:489` — `--ha-color-form-background` и
  `--ha-color-border-neutral-loud` у `.${p}-iconfield-control > ha-icon-picker`
  меняются с `transparent` на `var(tokens.canvas)`/`var(tokens.line)`. Сосед
  `.${p}-iconfield-control:has(> ha-icon-picker){border-color:transparent;
  background:transparent;}` (не менялся) по-прежнему гасит рамку
  **обёртки**, так что получается ровно одна тема-окрашенная рамка (сама
  HA-картонка), а не ноль и не две — именно это и проверяет
  `verify-icon-picker.mjs`.
- `src/styles/settings-dialogs.styles.ts` — удалена строка
  `.hpf-settings-form .hpf-iconfield:focus-within{outline:2px solid
  var(--hpf-accent);outline-offset:2px;border-radius:8px;}` (введена в
  `0b5db4c2a`, до #988). `.hpf-iconfield` — единственная обёртка в
  `marker-dialog.ts:616`, общая для HA-picker и текстового fallback.
  Для HA-picker эта рамка была лишней (HA уже красит фокус через
  `--mdc-outlined-text-field-focus-outline-color`, не тронуто). Для
  fallback-варианта фокус остаётся: `.${p}-iconfield-control:focus-within:
  not(:has(> ha-icon-picker))` в `form-kit.styles.ts:485` не менялся и
  единолично красит рамку — подтверждено исполнением
  (`fallbackHasSingleFocusOwner: true`).
- `src/styles/settings-dialogs.styles.ts:158` — новое правило
  `.hpf-settings-pane [data-state-source]{display:grid;gap:18px;}`.
  `data-state-source` — единственная обёртка в
  `src/editors/marker-state-source.ts:36`, прямые дети — `.hpf-field`
  (сам `.hpf-field{display:grid;gap:7px}` не даёт межблочного отступа,
  `form-kit.styles.ts:176`), поэтому до правки соседние `.hpf-field`
  (селект режима и блок ручного ввода) не имели отступа друг от друга —
  это и есть баг из issue. 18px совпадает с конвенцией того же файла
  (`.hpf-north-values{gap:18px}`, `margin-top:18px` в нескольких местах).
- `test/form-kit.test.mjs` — замороженный байт-в-байт тест обновлён вместе
  с обеими фикстурами (`test/fixtures/form-kit-card-dialog{,-with-switch}.css`)
  и комментарием, называющим issue — контракт по монолиту подтверждён
  исполнением (см. «Юниты» выше), а не regex по тексту.

## Трейлеры, changelog, release-ledger

- Коммит `340282bde` несёт `Issue: #995` и `User-Visible: yes`; `docs/
  CHANGELOG.md` и `docs/CHANGELOG.ru.md` правлены в том же коммите (§3 п.10
  соблюдён).
- `docs/release-ledger/v1.81.0/995.json`: `category: "line-fix"`,
  `introducedBy: 988`, обоснование называет три источника регресса (#988
  — неоформленное поле, #977 — отсутствие отступа ручного значения, #976 —
  лишнее фокусное кольцо) и прямо исключает правку из пользовательского
  changelog/milestone стабильного `v1.81.0` (функции не существовало в
  стабильном релизе) — согласуется с прецедентом `991.json` (та же форма,
  тот же `baseStable`).
- Единственное видимое число диффа — интервал 18px. Источник один:
  CSS-правило `gap:18px` (`settings-dialogs.styles.ts:158`); тест сверяет
  его измерением прямоугольников с допуском, а не вторым литералом
  константы — повторного/расходящегося источника числа нет.

## Что проверено и корректно

- Оба дефекта из issue воспроизводимы по git-истории правок (`0b5db4c2a`
  добавил двойное кольцо, #988 занулил токены picker'а, #977/#991 не
  добавили отступ `data-state-source`) и устранены минимальными CSS-правками
  без побочного переноса логики.
- Lifecycle-guard #988 (Escape/`wa-hide` не закрывает родителя раньше
  времени) не тронут и остаётся доказанным тем же реестром мутантов.
- Fallback (текстовый ввод иконки без `ha-icon-picker` в рантайме) сохраняет
  единственный источник фокусной рамки — проверено исполнением.
- Переключение «Задать вручную» ↔ «Авто» и обратно, ввод, Save/Cancel,
  соседние поля формы (320–1920px) не ломаются — подтверждено `smoke_
  device_settings_form.mjs` и `smoke_marker_state_source.mjs` целиком.
- Монолитные CSS-листы карточки/диалогов не разошлись нигде, кроме
  объявленных строк (байт-в-байт тест).
- Документация (`ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`) описывает
  фактическое поведение после правки, без противоречий с
  `docs/DEVICE-PRESENTATION.md` (логика `marker-state-source.ts` не менялась).
- Рабочее дерево после всех локальных прогонов возвращено в чистое
  состояние (`npm run bundle:clean`, удалены сгенерированные `demo/out`);
  в материал ревью ничего не внесено.

## Чего не проверял

- Golden/`golden:verify` — не прогонял: диффу не присвоена метка
  `ci:golden`, изменения не затрагивают геометрию/отрисовку плана (только
  CSS диалога настроек), визуальный минимум (8 смоков, выше) прогнан как
  более дешёвая и целевая для CSS-регресса проверка.
- `npm run invariants` — не прогонял: геометрия модели и ссылки на неё не
  менялись.
- `pytest tests_backend` / HA-харнесс — не прогонял: диапазон не содержит
  правок Python (`custom_components/houseplan/**`).
- Performance-гейт — не прогонял: в AC не назван, правка не затрагивает
  рендер-цикл плана.
- Полная матрица смоков и ночной реестр мутантов — не прогонял намеренно:
  это предрелизная/ночная обязанность (§8, #709), не гейт этого ревью.
- Ручная dev/GPU-приёмка владельцем — не выполнялась и не требуется:
  автоматические свидетели (включая реальный HA frontend в
  `verify-icon-picker.mjs`) дают честное headless-доказательство.
- Побочных находок вне скоупа нет — задача не породила файлов за пределами
  заявленного диффа.

## Находки

Нет. High: 0, Medium: 0.

## Маршрут побочных находок

`mode=issues` (доверенный снимок `HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`).
Побочных находок не обнаружено — новые issue не заводились.

## Вердикт

**Зелёный.** Оба AC-дефекта устранены точечными CSS-правками, граница
скоупа не нарушена, защитный AC доказан исполнением + ссылкой на
незатронутый реестр мутантов #988, все дешёвые и названные в AC гейты
прогнаны лично и зелёные, changelog/release-ledger корректны. Маршрут: `fix`
(критерии §5 пройдены, `reclassify` не требуется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/995-device-dialog-polish`, коммит `340282bde6de` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6d3d0557923b4f34d8851530b398db19cb7582ee`
  ```
  git log --all --format='%H %T' | grep 6d3d0557923b
  ```
- Тело issue: `d13c4766a899ae99bea0e3a35f5244be6adb8b3809d0b25290322557e46e8de9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMjIsIm91dHB1dF90b2tlbnMiOjE0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDkyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNjQsIm91dHB1dF90b2tlbnMiOjM1MTgzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyOTI1NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjgyMTMwOTIsImNvc3RVc2RFc3RpbWF0ZSI6Mi41MTE3OTY0MDAwMDAwMDF9XSwidHVybnMiOjg2LCJkdXJhdGlvbk1zIjo4NDk5MTAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjUxNjg4ODQwMDAwMDAwMDUsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5186 output_tokens=35197 cache_creation_input_tokens=129255 cache_read_input_tokens=8213092 num_turns=86 -->
