# CODE-REVIEW-594-r2

Issue: #594 · Этап: code · Заход: r2 · блокирующих циклов израсходовано 1 из 4

Материал: `fd33a0dce3b9d7ffdcf37068dc5afc17dccbe39d` (рабочая копия уже на нём,
HEAD detached). `git diff origin/dev...HEAD` — 66 файлов, ветка `issue/594-form-kit-room`,
пять коммитов: `fb361c49` (feat), `bd3f0019` (refactor: типизация ключей заливки),
`63059739` (review-документ r1), `bbaa469c` (test: M2/M3), `fd33a0dc` (test: приёмка
четырёх эталонов).

## Почему разбор полный, а не по дельте

Между применением `S7-code-review` в прошлый раз (комментарий владельца от
2026-09-19 05:49) и этим запуском ветка была ребейзнута конвейером на ушедший
вперёд `dev`: поверх легло 4 чужих коммита (`dcd66575`, `2167d439`, `5b6d5d1d`,
`41722e15` — доработки issue #593 и #595), исходные SHA задачи переписаны
(`c54a7770→bd3f0019`, `ec23a351→bbaa469c`, `0585c1ba→fd33a0dc`, плюс появился
промежуточный `073c45b0/fb361c49`). Это другой код (§7.2 PROCESS.md), поэтому
разбор — полный: прочитан весь `git diff origin/dev...HEAD`, а не только три
находки r1.

Проверил отдельно, что чужие коммиты не задели предмет ревью: `git diff
origin/dev...HEAD` содержит исключительно файлы задачи #594 (`form-kit.*`,
`room-settings-dialog.ts`, i18n, тесты/смоки, changelog, эталоны, dist/D-классы) —
никаких посторонних правок в дифф не просочилось, значит ребейз не изменил
семантику того, что писал автор, только базу.

## Закрытие раунда r1

Код-ревью r1 (комментарий от 2026-09-18T21:36:30Z, документ
`docs/reviews/CODE-REVIEW-594-r1.md`) на материале `c54a7770` дал жёлтый
вердикт, три Medium в скоупе:

| # находка r1 | Чем закрыта | Где это видно | Перепроверено сейчас |
|---|---|---|---|
| M1 — `npm run golden:verify` показывал диф по объявленным сценам, но `demo/golden/baselines/**` в диффе не было: приёмки не произошло | Коммит `fd33a0dc` (после ребейза — прежний `0585c1ba`): 4 PNG + `baselines-index.json` | `git show fd33a0dc --stat`: только класс D; трейлеры `Release: v1.76.0-beta.5`, `Baseline-Reviewed: .../runs/35407468491` на месте | Прогнал `npm run golden:verify` сам (Chromium в песочнице — 151.0.7922.34, совпадает с индексом эталонов, в отличие от песочницы автора). **exit 0, все сцены `passed`**, включая обе объявленные AC7 (`room-temperature-dialog-{desktop-en,mobile-ru}`) и посторонний долг #588 (`device-icon-state-table-{light,dark}`) |
| M2 — отпечаток `docs/images/screenshots.json` устарел (диф трогает `src/**`) | Коммит `bbaa469c`: `npm run docs:accept -- --identical` | `git diff` по `docs/images/screenshots.json`: изменился только `sourceFingerprint`/`sourceSha256` во всех 10 сценариях, ни один `imageSha256` не сдвинулся — пиксели те же | Прогнал `node scripts/check-docs.mjs --screenshots=strict` сам — **зелёный**: «Documentation checks passed» |
| M3 — свидетель AC1 доказывал «пишет только своё поле» лишь для 3 из 8 контролов; `_areaSel`/`_roomFill` не имели исполнимого oracle | Коммит `bbaa469c`: добавлены `areaWritesOnlyItsOwnKey`, `fillWritesOnlyItsOwnKey` в `demo/smoke_room_settings.mjs`, по образцу трёх уже существующих | `git diff` по `demo/smoke_room_settings.mjs` — оба факта на месте, используют тот же снимок-черновика (`draft()`/`changedFields`) | Прогнал `node demo/smoke_room_settings.mjs` сам — **зелёный**, все 13 булевых полей `true`, включая оба новых |

Находка r1 была узко сформулирована («добавить 1–2 проверки по образцу...» — именно
для `_areaSel`/`_roomFill`); `tempSrc` и `labelScale` r1 не называл дефектом
(перепутывание temp/hum ловит мутант `form-kit-writes-to-a-neighbour-key`,
`labelScale` структурно идентичен уже проверенному `nameScale`) — фикс не расширяет
скоуп находки, а закрывает её ровно как сформулировано.

Все три находки закрыты и подтверждены исполнением, а не чтением заявления автора.

## Что проверялось и как (полный AC-разбор)

Материал изучен диффом (`git diff origin/dev...HEAD`), затем гейты прогнаны
руками (сборка `dist`/`custom_components/houseplan/frontend` через
`npm run bundle:sync` пересобралась байт-в-байт идентично закоммиченному —
заодно подтверждает `tsc --noEmit`/`build`, поверх подтверждённого Validate на
этом SHA):

| Команда | Результат |
|---|---|
| `npm run bundle:sync` (build+tsc, затем сверка дерева) | `git status` после — чисто, ни одного расхождения |
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/form-kit.test.mjs test/i18n.test.mjs test/i18n-dead-keys.test.mjs test/styles-split.test.mjs` | 43/43 |
| `node --test test/editor-dialog-modules.test.mjs` | 2/2 (набор остаётся в ленивом графе) |
| `node --test test/bundle-assets.test.mjs` | 31/31 |
| `node --test test/single-source-numbers.test.mjs` | 3/3 (диф не заводит второй источник числа) |
| `node scripts/mutation-gate.mjs --id=form-kit-segment-drops-radio-semantics` | поймано 1 из 1 |
| `node scripts/mutation-gate.mjs --id=form-kit-writes-to-a-neighbour-key` | поймано 1 из 1 |
| `npm run bundle:budget` | initial View 291872 Б / потолок 292400 Б, запас 9194 Б (совпадает с цифрой автора день-в-день); предупреждение про низкий общий запас — старый долг #367/#474, к #594 не относится |
| `npm run golden:verify` (Chromium 151.0.7922.34, совпадает с индексом) | **все сцены `passed`**, включая AC7 |
| `node scripts/check-docs.mjs --screenshots=strict` | зелёный |
| `node demo/smoke_room_settings.mjs` | зелёный, все поля включая новые `areaWritesOnlyItsOwnKey`/`fillWritesOnlyItsOwnKey`/`humiditySourceWritesOnlyItsOwnKey` |
| `node demo/smoke_color_picker_consumers.mjs` (AC3, без правок) | зелёный |
| `node demo/smoke_room_temperature_thresholds.mjs` (AC4, без правок) | зелёный |
| `node demo/smoke_help_affordance.mjs` (AC6, расширенный) | зелёный |
| `node demo/smoke_summary_panel.mjs`, `smoke_summary_panel_polish.mjs` (AC9, без правок) | зелёные |
| `node demo/smoke_font_scales.mjs`, `smoke_editor_tabs.mjs` (план автотестов, без правок) | зелёные |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 19 «прямых совпадений» — прогнаны названные в ТЗ плюс `smoke_render_parity` (упоминает `cardStyles` напрямую); остальные 15 не прогонялись (см. ниже) |
| `node demo/smoke_backup_transfer.mjs`, `smoke_binding_ui.mjs`, `smoke_general_settings.mjs`, `smoke_size_angle_parity.mjs`, `smoke_space_scale_defaults.mjs` | зелёные (см. отдельное расследование ниже) |

### Отдельное расследование: смоки, использующие общие классы

`smoke-select.mjs` матчит по JS-символам и не увидел совпадения по строковым
CSS-селекторам. Грепом по `demo/*.mjs` нашёл пять смоков, дёргающих классы,
которые диалог комнаты раньше рисовал (`.dispsection`, `.gsrow`, `.colorrow`,
`.dropbtn`, `.droppanel`): `smoke_backup_transfer.mjs`, `smoke_binding_ui.mjs`,
`smoke_general_settings.mjs`, `smoke_size_angle_parity.mjs`,
`smoke_space_scale_defaults.mjs`. Прочитал каждый: все пять открывают ДРУГИЕ
диалоги (настройки, бэкап, привязка устройства, диалог устройства/пространства)
— классы общие по имени, но не по диалогу, поэтому правка `room-settings-dialog.ts`
их не касается структурно. Прогнал все пять — зелёные. Это не было в списке ТЗ
и не входило в «прямое совпадение» инструмента, но стоило проверить именно
потому, что инструмент матчит по символам, а не по строкам-селекторам.

### AC-таблица (все — свежая проверка исполнением или чтением, не наследование)

| AC | Результат | Как подтверждено |
|---|---|---|
| AC1 | 8/8 ключей черновика подтверждены: name/nameScale/humSrc (было в r1), area/fill (добавлено в r2-фиксе), color/thresholds — отдельными AC3/AC4, tempSrc — мутантом (перепутывание с humSrc ловится) | чтение + исполнение смока и мутанта |
| AC2 | запись каждого поля через снимок-черновика; условия «Сохранить» не менялись (код диалога идентичен по условиям `canSaveNew`/`?disabled`) | смок зелёный, диф читаем |
| AC3 | `hp-color-opacity` не подменён, нативных пикеров 0 | смок без правок зелёный |
| AC4 | пороги температуры не изменились | смок без правок зелёный |
| AC5 | сегмент — радиогруппа, цель ≥44px, фокус берётся | смок + unit-тест `form-kit.test.mjs` |
| AC6 | 4 заголовка, у каждого «?» с текстом и aria-label, абзацев не осталось, мёртвых ключей нет | смок + `i18n-dead-keys.test.mjs` (24, было 20) |
| AC7 | ровно 2 объявленные сцены изменились и приняты, остальные (включая 3 сцены панели и все прочие диалоги) — побайтово прежние | `golden:verify` — все `passed`, эталоны в индексе принятые |
| AC8 | размер назван (+516 Б до initial View), лист набора ушёл в ленивый граф, а не в `cardStyles` | `bundle:budget` зелёный под потолком; `grep form-kit` — не встречается в `src/styles.ts`/`houseplan-card.ts`; `styles-split.test.mjs` подтверждает пятёрку каскада неприкосновенной |
| AC9 | `src/summary-panel-*` в диффе отсутствуют | `git diff --stat` — подтверждено; оба смока панели зелёные без правок |
| AC10 | полный набор зелёный | tsc/test/build — подтверждено Validate на этом SHA (ссылка в задаче ревью) + сборка вручную идентична; unit/смоки/мутанты/бандл/golden/docs — прогнаны вручную выше, все зелёные |
| AC11 | генератор с параметрами панели воспроизводит её текущие правила дословно | `test/form-kit.test.mjs` зелёный, плюс лично сверил фрагменты `PANEL_FRAGMENTS` с текстом `src/summary-panel-editor-style.ts` — совпадают |

К1–К7 (контракт поведения) проверены чтением `room-settings-dialog.ts` (см. диф
в анализе): ключи черновика те же, `hp-color-opacity`/событие те же,
`_renderRoomSource` переехал в модуль комнаты как единственный потребитель,
`FILL_CHOICES` типизирован без `as any` (закрывает красный `no-new-any` из
первого пуша), генератор параметризован скоупом/префиксом.

Трейлеры: все 5 коммитов несут `Issue: #594`; `User-Visible: yes` только на
`fb361c49`, и в нём же правки обоих changelog (`docs/CHANGELOG.md`,
`docs/CHANGELOG.ru.md`) и обоих `USER-GUIDE` — проверено `git show --stat` и
чтением текста, терминология («карточки-группы», «?», переключатель
«среднее/выбранный датчик») совпадает с формулировками ТЗ и UX-разделом.
Коммит с эталонами несёт `Release:`/`Baseline-Reviewed:` со ссылкой на реальный
прогон.

## Что проверено и корректно

- Полный контракт К1–К7 и AC1–AC11 — построчно, включая обе фиксовые правки r1.
- Golden — впервые в этом раунде подтверждён личным прогоном (не чтением
  утверждения автора): AC7 закрыт полностью, регрессий вне двух объявленных
  сцен нет.
- Отпечаток документации — тоже личным прогоном в строгом режиме.
- Пять «скрытых» смоков на общих CSS-классах — прогнаны, регрессий нет.
- Сборка (`bundle:sync`) воспроизводится байт-в-байт из исходников этого SHA —
  дифф в `dist/**`/`custom_components/houseplan/frontend/**` не является
  посторонним артефактом.
- Размер и архитектурное решение (лист в ленивом графе, `unsafeCSS`,
  параметризованный генератор) соответствуют цифрам, названным в хендоффе, и
  не расходятся с кодом.

## Чего не проверял и почему

- `npx tsc --noEmit` / `npm test` (весь набор) / `npm run build` как отдельные
  команды — не перегонял: Validate на этом SHA (`fd33a0dc`) зелёный, дешёвые
  гейты уже подтверждены; вместо этого пересобрал `bundle:sync`, что тоже
  прогоняет `tsc --noEmit`+`build` и byte-for-byte сверило дерево — то же самое
  доказательство другим путём.
- Полная матрица браузерных смоков (250 файлов) — не прогонял; прогнаны
  названные в ТЗ, `smoke_render_parity` (прямое совпадение по `cardStyles`) и
  пять найденных вручную по общим CSS-классам. Остальные 15 «прямых
  совпадений» инструмента (`smoke_room_autoclose`, `smoke_merge_split`,
  `smoke_plan_drawing_repairs`, `smoke_unified_wall_tool`,
  `smoke_v8_draft_write`, `smoke_feedback_v2`, `smoke_island_rooms`,
  `smoke_junction_limits`, `smoke_wall_face_overlap`,
  `smoke_wall_thickness_transition`, `smoke_draw_wall_thickness`,
  `smoke_split_polyline`, `smoke_zero_divider_taper`, `smoke_split_nonsnap`) не
  прогонял: символы совпадения — это состояние хоста комнаты (`_nameSel`,
  `_areaSel`, `_curSpaceCfg`, `_saveRoom`, `_pendingSplit`, `_wallFaceBatch`,
  `_roomDialogCancel`), а не что-то, что этот диф меняет — обработчики кнопок
  и сигнатуры методов в диффе идентичны прежним (см. `diff2.patch`/`diff3.patch`
  анализа), меняется только обёртка разметки внутри `.body`. 31 «слабых связей»
  инструмент сам не считает основанием для прогона.
- Полный HA-харнесс, перф-профили — не названы в AC и диф не касается
  чувствительных к перфу путей (только разметка/CSS одного диалога).
- `python -m pytest tests_backend` — диф не трогает `custom_components/**/*.py`.
- `npm run invariants` — диф не трогает геометрию/`layout`/`marker.space`/
  `open_spans`/записи толщины.

## Находки

Нет. Все три Medium из r1 закрыты и подтверждены исполнением; новых дефектов
в правках r1→r2 (типизация `FILL_CHOICES`, свидетель полей, отпечаток
документации, приёмка эталонов) и в ребейзе не найдено.

## Унаследовано из r1

Формально этот раздел почти пуст: инструкция для ребейза (§7.2) требует полный
разбор, поэтому весь код перепроверен заново своими руками (см. выше), а не
принят на слово документа r1. Единственное, что не переоткрывается сознательно —
продуктовые решения ТЗ, которые не относятся к предмету код-ревью:

- Само распределение полей по четырём группам, названия групп, решение не
  трогать ширину диалога и не менять «Сохранить только при изменениях» —
  приняты на этапе спецификации (`SPEC-REVIEW-594-r3.md`, зелёный вердикт,
  материал — тело issue #594 на момент коммита `073c45b0`/`63059739`). Код-ревью
  не переоценивает эти решения, только соответствие им реализации — оно
  проверено выше по каждому AC.

## Вердикт

Зелёный. Все находки r1 закрыты и подтверждены исполнением; полный повторный
разбор после ребейза новых дефектов не выявил.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/594-form-kit-room`, коммит `fd33a0dce3b9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8fefb135dda0fc5fae81091314c8a16df4fec42c`
  ```
  git log --all --format='%H %T' | grep 8fefb135dda0
  ```
- Тело issue: `594c7771e678dae203db75069c75806da3eec9c1d9b155a3d7ba2236d338052a`
- Вердикт конвейера: `green` · High 0
