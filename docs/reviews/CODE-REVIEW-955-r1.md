# CODE-REVIEW-955-r1

Issue: #955 · Этап: code · Трек: ask · Заход r1 · блокирующих циклов 0/4
Материал: `1013342ffac3b1b76fde4e3bc9da343f11e12709` (issue/955-settings-polish),
диапазон `origin/dev..HEAD` (24 коммита, 107 файлов, +2399/−337).

## Скоуп

Полировка четырёх принятых диалогов настроек (General/Space/Room/Device,
#944/#945/#946/#947) по девяти прямым замечаниям владельца от 18.10.2026:
перенос длинной подписи Zigbee, единый hover/pointer/tap для подсказок,
радио-превью вместо select для начала оконных лучей, выравнивание
label+toggle+help, лишний разделитель у лунной подсказки, полное поле
прозрачности (включая число 100), стабильная высота диалога при появлении
внутреннего scroll, видимая hover-рамка «Как в теме», единый hover для
типовых кнопок/confirm/Save (включая оптический центр текста+SVG в Save).
Правки идут в общие токены/компоненты (`settings-dialogs.styles.ts`,
`settings-action.styles.ts`, `form-kit.ts`, `hp-dialog.ts`, `hp-help.ts`,
`hp-color-opacity.ts`, `hp-zigbee-topology-settings.ts`,
`sun-settings-view.ts`, `radar-section.ts`, `vacuum-settings-section.ts`),
без изменения модели настроек, Save/Cancel/dirty-контракта, View или
Zigbee-диагностики — подтверждено чтением всего нелокального/нестилевого
диффа (ни один из `_saveMarker/_saveRoom/_saveSettingsDialog/requestClose`
путей не тронут).

Job из SCOPE.md: J4/J6 (администратор настраивает дом) — редакторы
desktop-first по TOUCH-SUPPORT.md, View не затронут.

## Риск по изменённым участкам (#707) — сверка с AC ТЗ

| Класс | Участок | Вывод |
| --- | --- | --- |
| touch | `settings-dialogs.styles.ts` `touch-action:none` (North-dial) | Чистое форматирование (убраны переносы/пробелы), значение не изменилось: `git show origin/dev:…` и `git show HEAD:…` дают идентичный токен. Не относится к #955, риска нет. |
| devices | `houseplan-editor-runtime.ts` `is_admin` (backup-диалог) | Переименование `_backupT`→`_toolsT`, условие `hass.user.is_admin===true` не менялось. Доказано чтением полного диффа файла (19 строк, все — переименование/проводка `toolsT`). |
| perf | `settings-action.styles.ts` / `settings-dialogs.styles.ts` `filter:brightness(1.08)` | Существовавшее правило вынесено в общий токен `settingsActionHover`, значение то же. Бюджеты бандла не расширены (raw/editor/onboarding/View/host — без изменений, release-ledger `category:"line-fix"`, `introducedBy:948`, "No new stored setting or View behavior"). |
| ux | `marker.vacuum_*_help`, `marker.radar_profile_help` и др. в `i18n/tools/*.json` | Буквальный перенос из `i18n/settings/*.json` в `i18n/tools/*.json` — текст RU/EN/DE/FR побайтово идентичен (сверено диффом по всем 4 языкам). Назначение: встроить обе подсказки в `toolsT`, который теперь прокинут в `vacuum-settings-section.ts`/`radar-section.ts` (AC2 «вложенные профильные секции устройства»). Проверено исполнением (ниже). |

Все четыре класса закрыты либо как дериватив форматирования, либо как
прямое покрытие AC2/AC3 ТЗ — `route: fix`, повышать/перeklassifицировать
нечего (трек и так `ask`).

## Как проверялось

Дешёвые гейты подтверждены Validate на этом SHA (success,
run 39171593327): `preflight`, `tsc/unit/мутанты-статика/синхрон бандла`,
`pytest Home Assistant`, `Golden-кадры против принятых эталонов` — все
success. **Браузерные смоки в этом прогоне были `skipped`** (обычный push
в ветку задачи не гоняет полный шардинг) — это гейт, который по
«Объёму гейтов» остаётся на мне, не на Validate.

Я пересобрал бандл (`npm run build && npm run bundle:sync`, dist/demo —
generated outputs) и прогнал смоки, выбранные по диффу и AC, затем вернул
дерево командой `npm run bundle:clean` (git status чист после ревью).

| Гейт | Результат | Почему |
| --- | --- | --- |
| `npx tsc --noEmit`, `npm test`, `npm run build` | Не перегонял отдельно | Подтверждены Validate на этом SHA (success), материал не менялся (#343) |
| `node scripts/mutation-gate.mjs --check` (статика) | ok × 8 новых id `…-955`, предупреждения не относятся к задаче | Регистрация мутантов #955 резолвится однозначно; исполнение — только ночью (#709), не делал |
| `golden:verify` (ci:golden) | success (Validate) | Golden прошёл в рамках этого Validate-прогона до ревью (полный 212, 16 объявленных отличий, приняты коммитом `1013342ff` с `Baseline-Reviewed-Local`) |
| `demo/smoke_settings_polish_955.mjs --fast` (general) | PASS (все ключи true) | Прямое AC1–AC3 покрытие для general |
| `demo/smoke_settings_polish_955.mjs --case=led` (полный) | PASS (повторный прогон в одиночку) | Первый параллельный прогон (одновременно с 4 другими браузерами) дал 6 ложных `…_help_N: false` — повторил в одиночку, 0 failed. Вывод: таймингово-чувствительная проверка `transition:background 150ms` требует запаса >160 мс под нагрузкой хоста ревью, не дефект продукта. См. «Чего не проверял» |
| `--case=vacuum` (полный, без `--geometry`) | PASS | Прямая проверка прокинутого `toolsT` в hover/tap/focus подсказках пылесоса (AC2, риск «ux») |
| `--case=sensor/climate/vacuum/radar/room/space --geometry` | PASS (все) | Геометрия/выравнивание/стабильная высота/footer-hover по остальным профилям Device + Space/Room |
| `demo/smoke_settings_button_alignment_955.mjs` (полный, 4 языка × 4 формы × 2 ширины) | PASS 32/32 | AC2/п.9: Save-текст+SVG по вертикали, все 4 диалога, RU/EN/DE/FR |
| `demo/smoke_sun.mjs` | PASS | Радио вместо select для источника лучей — полный прогон смежного файла |
| `demo/smoke_general_settings_form.mjs`, `smoke_general_settings.mjs`, `smoke_dialog_segments_i18n.mjs`, `smoke_dialog_polish_605.mjs`, `smoke_room_settings_form.mjs` | PASS | Прямые совпадения/изменённые смоки из `smoke-select` и ручного диффа |
| `demo/smoke_device_signal_settings.mjs` (прямое совпадение `helpLabel`) | PASS | smoke-select: «Прямое совпадение» |
| `demo/smoke_settings_select.mjs`, `smoke_settings_navigation.mjs` (зарегистрированная связь) | PASS | smoke-select: «Зарегистрированная связь» |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`: 15 прямых
совпадений (разобраны/прогнаны выше или являются широкими символами
`_markerDialog`/`stopPropagation`, не специфичными для #955 — решение
ревьюера: не гонять весь хвост из ~48 слабых совпадений, видящих общий
символ `_markerDialog`, поскольку изменение в этом файле — только
переименование `_backupT→_toolsT`, не затрагивающее поведение диалогов
устройств); 7 зарегистрированных связей (две прогнаны выше как прямо
относящиеся к стилям/select, остальные — к несвязанным подсистемам:
`smoke_lazy_admin_locale`/`smoke_editor_styles_lazy`/
`smoke_zigbee_topology_job`/`smoke_room_settings_form`/
`smoke_space_settings_form` триггернулись на широкие символы `toolsT`,
файл `editor-dialogs.styles.ts`, `unitInput` — не трогались по существу
этим диффом; `smoke_room_settings_form.mjs` прогнан выше явно).

Инварианты модели (`npm run invariants`) не прогонял — диффа геометрии
плана нет (только CSS/разметка диалогов настроек, не план/стены/устройства
на холсте).

## Находки

Находок, блокирующих вердикт, нет.

## Что проверено и корректно

- **AC1** (визуальное совпадение с макетами). Golden принят в материале
  (16/212 намеренных отличий, явно перечисленных и подтверждённых владельцем
  по именам сцен, `Baseline-Reviewed-Local` присутствует на commit
  `1013342ff`). Сверх golden — pixel-ink проверка Save (`buttonPaint`,
  `demo/helpers/button-paint.mjs`) меряет реальные закрашенные пиксели
  текста и SVG, а не контейнер — ровно то, что требовало уточнение
  владельца от 18.10.2026.
- **AC2** (единые интерактивные состояния). Ray-origin теперь нативная
  радиогруппа (`role=radiogroup`, `<input type=radio>` в `.hpf-sr-only`,
  подпись — `<label class="hpf-ray-choice">`, весь блок кликабелен), тот же
  callback `changed(origin)`, что и раньше у select — проверено чтением
  (`sun-settings-view.ts`) и исполнением (`smoke_sun.mjs`,
  `smoke_settings_polish_955.mjs` `no_duplicate_origin_select`,
  `ray_preview_click`, `ray_native_keyboard`). Подсказки пылесоса/радара
  перенесены на `toolsT` и прокинуты как пропс в
  `vacuum-settings-section.ts`/`radar-section.ts` — проверено исполнением
  (`--case=vacuum` без `--geometry`: все `_help_N`/`_help_immediate_N`
  PASS). Встроенный `hp-zigbee-topology-settings` получил свой
  `pointerHover` (через существующий `PointerHoverObserver`,
  `POINTER_HOVER_TARGET_SELECTOR` расширен) и прокидывает его во
  внутренний `hp-help` — закрывает ранее нерабочий instant-hover у
  длинной Zigbee-подсказки внутри вложенного custom element; зарегистрирован
  мутант `settings-help-needs-host-hover-955`.
- **AC3** (матрица 9×4). Таблица PASS/N/A в теле issue снята мной по каждому
  профилю Device (sensor/LED/climate/vacuum/radar) — геометрические и
  интерактивные прогоны выше подтверждают заявленные PASS, N/A обоснованы
  отсутствием соответствующих контролов в форме (например, alpha скрыт в
  RGB-пикере Device).
- **AC4** (контракт данных/Cancel/Save/dirty). Ни один файл логики
  сохранения/черновика не менялся — проверено чтением полного
  нестилевого диффа (единственная логика — рендер разметки Save-кнопки,
  радиогруппы лучей и проводка `toolsT`/`pointerHover`). Инвариант
  `cancel_preserves_config` (побайтовое сравнение `_serverCfg` до/после
  Cancel) выполнен во всех 8 прогнанных сценариях (general/space/room/
  sensor/led/climate/vacuum/radar).
- Защитные проверки имеют «чем краснеет»: 8 новых мутантов
  `settings-*-955` в `scripts/mutation-registry.mjs`
  зарегистрированы и резолвятся однозначно (`mutation-gate --check`:
  `ok` по каждому), исполнение — только в ночном прогоне (#709), честно
  не исполнялись мной (политика не позволяет патчить текущую реализацию
  вне ночного workflow).
- Трейлеры: все 24 коммита класса A/B несут `Issue: #955`; `User-Visible:
  yes` — 9 коммитов, в каждом правка `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в том же коммите (сверено `git show --stat` по
  каждому). Коммиты без трейлеров (`b6517688a`, `817bb26a8`, `614973841`,
  `ce3a55558`, `809720bb6`, `8f6ac3883`, `7ce4bb51b`, `4a3dc57b1`) трогают
  только `docs/design/settings-dialogs-944/implementation-evidence/**` —
  класс C (документация), трейлеры не требуются.
- Коммит с бандлом (`1013342ff`) несёт `Release: v1.82.0-beta.1` и
  `Baseline-Reviewed-Local: sha256:…`, как того требует правка
  `demo/golden/baselines/**`.
- `docs/release-ledger/v1.81.0/955.json`: `category: line-fix`,
  `introducedBy: 948`, `baseStable: v1.81.0` — совпадает с текущим
  стабильным тегом и циклом 1.82; полировка внутри-бетной фичи корректно
  исключена из пользовательского milestone (не `major`/`stable-fix`).
- Одно число — один источник: единственная «видимая дважды» величина в
  диффе — высота диалога настроек (`--hp-dialog-settings-height,756px`),
  читается из одного и того же CSS custom property в `hp-dialog.ts` и
  `settings-dialogs.styles.ts`; новое дублирование `height`+`max-height`
  в `hp-dialog.ts` — не второй источник значения, а фиксация одной и той
  же переменной в обоих свойствах ради стабильности высоты (сам AC7).
- i18n: перенесённые ключи `marker.vacuum_*_help`/`marker.radar_*_help`
  идентичны по тексту во всех 4 языках (ru/en/de/fr) — не новая
  копирайтинг-работа, а смена чанка загрузки.
- `.radargroup > label:not(.hpf-toggle):not(.srcrow)` и
  `.markerlightgroup .srcrow > span:first-of-type` (правила, удалённые из
  `editor-dialogs.styles.ts`) не имели соответствующей разметки в
  `radar-section.ts` (все целевые `<label>` там — внуки `.radargroup`
  через обёртку `.radarcoordinates`, не прямые потомки) — мёртвый CSS,
  удаление безопасно, подтверждено чтением markup на `origin/dev` и
  `HEAD` (идентичны).

## Чего не проверял

- Полный `golden:verify`/`смоки: все шарды`/`performance_smoke` заново не
  гонял — Validate на точном SHA материала уже дал `success` по golden;
  полный шардинг смоков и перфобюджет — предрелизный гейт, не гейт ревью
  на этом объёме задачи (§8).
- `npx tsc --noEmit`/`npm test`/`npm run build` отдельно не перегонял —
  Validate на этом SHA зелёный, материал не менялся с момента прогона.
- `npm run invariants` не гонял — в диффе нет изменений геометрии плана/стен/
  устройств, только CSS и разметка диалогов настроек.
- Полная интерактивная матрица (`--case=` без `--geometry`) для `sensor`,
  `climate`, `radar`, `room`, `space` не прогонялась мной — сделаны
  геометрические прогоны (выравнивание/высота/footer-hover) плюс один
  репрезентативный полный прогон на похожем по сложности `vacuum`
  (прокидка `toolsT` в подсказки) и `led` (сложный профиль с реальным
  найденным автором багом). Полная интерактивная матрица по всем 8
  сценариям уже заявлена автором как выполненная локально (304 native,
  33 пары, 64 Save-кейса) — не переисполнял построчно вне выбранных по
  риску случаев.
- Первый параллельный прогон `--case=led` дал 6 ложных `_help_N: false`
  при одновременном запуске 5 браузеров Chromium на этой машине —
  повторный одиночный прогон дал 0 failed. Это ограничение среды ревью
  (ресурсная нагрузка влияет на проверку 150 мс CSS-transition), не
  находка к продукту; дальнейшие параллельные прогоны не делал.
- Доступность на реальном сенсорном устройстве/физическом GPU не
  проверялась — синтетический headless по политике #929 (ручная
  dev/GPU-приёмка владельцем добровольна).
- Разделы ТЗ про mobile/низкий viewport в AC3 проверены в headless-эмуляции
  (390/320 px, `hasTouch`), не на физическом телефоне.

## Вывод

Все заявленные 9 симптомов воспроизводимо исправлены, AC1–AC4 доказаны
смесью исполненных смоков и чтения кода там, где логика не менялась.
Классы риска «touch»/«devices»/«perf» из промпта — ложные срабатывания
детектора на переформатированном/переименованном коде без изменения
поведения; класс «ux» (перенесённые i18n-ключи) прямо закрыт AC2. High и
Medium не найдено.

Побочных находок нет. Доверенный снимок `mode=issues`: маршрут публикации —
новых issue не заводил (нет оснований).

**Вердикт: зелёный.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/955-settings-polish`, коммит `1013342ffac3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7634bbe0af54d7ca8d9ebb406f0b1018aeb12c97`
  ```
  git log --all --format='%H %T' | grep 7634bbe0af54
  ```
- Тело issue: `a5ba63e91638e9f96406256e61acb7a04fc8af44033a924344d0d3d0be35ac63`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNTQsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjM5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxODQsIm91dHB1dF90b2tlbnMiOjUxMDI1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIzNTk4OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE1NDMyMjE2LCJjb3N0VXNkRXN0aW1hdGUiOjQuNTQxMDEzMjAwMDAwMDAxfV0sInR1cm5zIjoxMTcsImR1cmF0aW9uTXMiOjExMDkwOTEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjo0LjU0NjI1MjIwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5338 output_tokens=51042 cache_creation_input_tokens=235988 cache_read_input_tokens=15432216 num_turns=117 -->
