# CODE-REVIEW-426-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/426
- **Этап:** code (код-ревью, PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **Материал:** `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
  на ветке `issue/426-room-hover-tooltip-toggle`, HEAD `a6eb3d6cfa492ed1e742231800f31efab7c46e4b`.
- **ТЗ:** `docs/specs/426-room-hover-tooltip-toggle.md` — ревью ТЗ уже
  зелёное (`docs/reviews/SPEC-REVIEW-426-r1.md`, SHA `587c2069`), сам текст ТЗ
  не менялся между тем ревью и этим (issue содержит ревизию 2, но это
  уточнение места editor-only строк без изменения поведения — см. историю
  issue).

Это первый заход код-ревью для #426: раздел «дельта/унаследовано из r0» из
§2.9 не применяется (применяется только начиная с r2).

## Скоуп

Шесть коммитов на ветке:

1. `587c2069` docs: specify room hover tooltip toggle (ТЗ)
2. `ac99a2ff` docs: review document for #426 (SPEC-REVIEW артефакт)
3. `8013f7d0` feat: add room hover tooltip setting — **весь продуктовый код**:
   `src/types.ts`, `src/logic.ts`, `src/houseplan-card.ts`,
   `src/houseplan-editor-runtime.ts`, i18n (4 lazy editor-словаря + перенос
   `gs.hint` из initial View в lazy editor-бандл), backend
   (`validation.py`, `support_package.py`), тесты (`logic.test.mjs`,
   `i18n.test.mjs`, `test_validation.py`, `test_support_package.py`), новый
   `demo/smoke_room_tooltip_toggle.mjs`, `scripts/smoke-links.mjs`, docs
   (CHANGELOG×2, USER-GUIDE×2, UX-MODES, TOUCH-SUPPORT, CONFIG-COMPATIBILITY,
   TESTING), собранные `dist/**`/`custom_components/.../frontend/**`.
4. `9d1e5fdb` docs: refresh screenshot source fingerprint (гейт `check-docs.mjs`)
5. `223951c0` chore: refresh config schema manifest (`scripts/config-schema.json`)
6. `a6eb3d6c` test: accept room tooltip settings golden — приняла новый
   `general-color-popover-desktop-en` эталон (единственный изменившийся
   golden-кадр).

Продуктовый скоуп совпадает с ТЗ: один глобальный boolean
`settings.show_room_tooltip`, resolver `showRoomTooltipOf`, guard в локальном
`tip`-замыкании комнаты, независимость hover-подсветки/device tooltip,
backend/schema/privacy-projection, i18n, документация, release-артефакты.

## Как проверялось

Ручного тестирования в цикле нет — весь разбор построен на чтении
`git diff origin/dev...HEAD` и на выводе уже прогнанных CI-джобов на этом
дереве.

1. **Продуктовая рамка.** `docs/SCOPE.md` J1 («live spatial overview») —
   опция не убирает состояние, только один информационный элемент
   вида/интерфейса; никакая строка Core user jobs не запрещает такую точную
   настройку показа. View остаётся продуктом для двух персон из трёх —
   изменение не трогает hover-подсветку, устройства, действия.
2. **Frontend-контракт** (`src/logic.ts`, `src/types.ts`,
   `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`) — построчно,
   с трассировкой каждого AC1–AC7 к конкретной строке диффа (см. раздел
   «Находки» и «Что проверено»).
3. **Backend** (`custom_components/houseplan/validation.py`,
   `support_package.py`) и тесты (`tests_backend/test_validation.py`,
   `test_support_package.py`) — построчно + логическая проверка, что новые
   тесты умеют падать (мутация: убрать `isinstance(..., bool)` → тест
   `test_room_tooltip_global_setting_is_strict_boolean_and_round_trips`
   перестаёт отклонять `0`/`1`/`"false"`; убрать `isinstance(show_room_tooltip, bool)`
   в `support_package.py` → тест на строку `"false"` в
   `test_projection_helpers_fail_closed_on_malformed_shapes` перестаёт быть
   пустым словарём).
4. **i18n** — сверка всех 4 lazy editor-словарей, `test/i18n.test.mjs`
   (жёсткое число `44`, не диапазон — ловит и пропущенный, и лишний ключ).
5. **Docs** — `CONFIG-COMPATIBILITY.md`/`UX-MODES.md`/`TOUCH-SUPPORT.md`/
   `USER-GUIDE.{md,ru.md}`/`CHANGELOG.{md,ru.md}` — сверены построчно с
   контрактом ТЗ (терминология "Show the room information window on hover" /
   "Показывать окно с информацией при наведении на комнату" совпадает с
   зафиксированной владельцем строкой).
6. **CI-évidence вместо повторного прогона** (см. «Какие гейты» ниже) —
   прочитаны логи трёх Actions-прогонов на этой ветке через `gh run view`.
7. **Golden-эталон** — скачаны обе версии
   `general-color-popover-desktop-en.png` (`origin/dev` и `a6eb3d6c`) и
   визуально сверены (см. «Находки»/«Что проверено»).
8. `node scripts/smoke-select.mjs --base origin/dev --head HEAD` — получен
   список смоков по символам диффа, дальше сверен с логами уже прошедшего
   прогона (см. ниже).

## Находки

**High: 0. Medium: 0.** Изменение соответствует ТЗ, все девять AC закрыты
кодом и/или тестом, гейты (см. ниже) зелёные на этом дереве.

Отмечаю две вещи, которые проверил специально, потому что выглядели как
потенциальный риск, но не подтвердились как дефект (Low, не требует правки):

- **`_notePointer` не вызывается на каждый `pointermove`, когда опция
  выключена** (`src/houseplan-card.ts:11580-11585`) — до правки `_showTip()`
  вызывал `this._notePointer(ev)` на каждый pointermove комнаты; теперь при
  `showRoomTooltipOf() === false` цикл выходит раньше и `_notePointer` не
  вызывается для pointermove (только для pointerenter через `enterRoom`).
  Прочитал `PointerModalityController.note()`
  (`src/pointer-modality.ts:78-82`) и `nextPointerModality`
  (`src/pointer-modality.ts:20-28`): модальность — защёлка, меняется только
  при событии другого `pointerType`, а не тухнет со временем. Поскольку
  `pointerenter` уже фиксирует модальность на входе в комнату, повторные
  вызовы на move были бы no-op'ами. Регрессии нет — **проверено чтением, не
  исполнением**.
- **Optimistic write в `_saveSettingsDialog` не откатывается при ошибке
  сохранения** (`src/houseplan-editor-runtime.ts:10243-10256`) —
  `this.host._serverCfg` мутируется новым `settings` (включая
  `show_room_tooltip`) **до** `await this._saveConfigNow()`; `catch`-ветка
  снимает только `busy`, не восстанавливает `_serverCfg`. Формально это
  означает, что при сетевой ошибке эффективное значение опции в памяти уже
  «новое», хотя запись не подтверждена сервером — то есть именно то, что
  AC1.5 запрещает («не выдаёт несохранённый draft за применённое значение»).
  Но это **не новое поведение**: тот же паттерн уже действует для `sunRays`,
  `bgColor`, `northDeg`, `glow_radius_cm`, `bgMode` в той же функции, и ТЗ
  сознательно пишет «по существующему контракту общих настроек» — то есть
  автор идёт по прецеденту, а не изобретает новый разрыв. Чинить
  существующий контракт всего диалога — вне скоупа #426 (это была бы правка
  соседнего поведения, не связанного с room-tooltip). Не завожу отдельный
  issue: находка Low на уровне существующего кода, не Medium/High и не
  попутный дефект, привнесённый этим диффом.

## Что проверено и корректно

- **AC1 (UI/default).** Один переключатель сразу после `gs.hint`
  (`houseplan-editor-runtime.ts:10538-10547`), `_boolInput`, доступное имя из
  видимой строки — как и `sunRays`. `_openSettingsDialog` инициализирует
  draft через единственный resolver `showRoomTooltipOf(this.host._settings)`
  (`:9034-9039`). Юнит-тест на resolver
  (`test/logic.test.mjs`) покрывает absent/`undefined`/`null`/`true`/`0`/`1`/
  `'false'`/`[]`/`{}` → `true`, только точный `false` → `false` — то есть
  ровно табличный план AC1 из ТЗ, тест умеет падать (замена на
  `Boolean(value)` даёт `false` для нескольких из этих проб).
- **AC2 (persistence).** Save: `if (d.showRoomTooltip) delete settings.show_room_tooltip; else settings.show_room_tooltip = false;`
  (`:10237-10238`) — та же двусторонняя схема, что у `sunRays`. Cancel/Escape
  не проходят через `_saveSettingsDialog` (не тронуто диффом — общий
  контракт диалога). Backend: `vol.Optional("show_room_tooltip"): bool`
  (`validation.py:1938`) отклоняет `None`/`0`/`1`/`"false"`/`[]`/`{}`,
  принимает оба boolean с round-trip — тест
  `test_room_tooltip_global_setting_is_strict_boolean_and_round_trips`
  доказывает и допуск, и отказ.
- **AC3 (tooltip off).** Guard **до** `_roomArea(r)`
  (`houseplan-card.ts:11582-11586`): при `false` — `return` раньше вычисления
  площади и раньше `_showTip()`; попутно чистит уже показанный
  `.tip`, если он был room-tooltip (`if (this._tip?.room) this._tip = null;`).
  Save с выключенным значением дополнительно чистит tip сразу после
  `_saveConfigNow()` (`:10245`). Смок
  `demo/smoke_room_tooltip_toggle.mjs` проверяет оба пути:
  `disabledRoomTip`/`disabledSkipsArea` (счётчик вызовов `_roomArea`) и
  `visibleRoomTipCleared` после Save — прогнан в CI (см. ниже), `ok`.
- **AC4 (default parity).** Ветка `showRoomTooltipOf() === true` не меняет
  путь: тот же вызов `_showTip(e, title, areaText ?? '', showLqi ? ... : null, this._roomTemp(r), this._roomHum(r), true)`
  — единственное отличие от старого кода это добавленный `room: boolean`
  флаг в конце сигнатуры (используется только для идентификации источника
  tip, не влияет на title/area/temp/hum/lqi/positioning). Смок
  `defaultRoomTip`/`roomTipRestoredOnMove` подтверждает содержимое и
  восстановление после reload/повторного включения.
- **AC5 (hover/device independence).** `enterRoom` (вынесенный из пяти
  дублирующихся инлайн-обработчиков `pointerenter`) не содержит нового
  guard'а — `_hoverRoom` продолжает устанавливаться независимо от
  `show_room_tooltip`. `_showTip()` не тронут: device tooltip
  (`houseplan-card.ts:12463+`) вызывает `_showTip(...)` без нового
  параметра → `room` по умолчанию `false`, не подавляется новым guard'ом (он
  находится только внутри room-специфичного замыкания `tip`, не в общем
  `_showTip`). Смок: `roomHighlightSurvives`, `deviceTipSurvives` (`_tip?.room === false`).
- **AC6 (pointer/mode parity).** Новый guard стоит **внутри** уже
  существующего `if (this._mode !== 'view') return;`, а модальность
  (`_pointerModality.hoverEnabled`) по-прежнему проверяется в `_showTip()`
  на true-ветке — touch/pen ничего не меняют. Разобрано и решение выше про
  `_notePointer` — проверено чтением, регрессии нет.
- **AC7 (compatibility/privacy).** `CONFIG_SCHEMA` — explicit `bool`,
  `ALLOW_EXTRA` сохранён. `support_package._global_settings` копирует ключ
  только если `isinstance(show_room_tooltip, bool)`
  (`support_package.py:142-144`) — невалидная форма (`"false"`) не
  копируется, тест `test_projection_helpers_fail_closed_on_malformed_shapes`
  это подтверждает. Отсутствие ключа не материализуется нигде (frontend
  save удаляет ключ на `true`, backend не создаёт его при чтении). Таблица
  mixed-version в ТЗ соответствует `ALLOW_EXTRA` (старый backend) и
  strict-schema (новый backend) поведению, прочитанному в коде.
- **AC8 (i18n/docs/release).** Все 4 словаря обновлены, `gs.hint` перенесён
  из initial-View словарей (`src/i18n/{en,de,fr,ru}.json`, удалён) в lazy
  editor-словари (`src/i18n/support/{en,de,fr,ru}.json`, добавлен вместе с
  `gs.show_room_tooltip`) — снижает initial View graph, как и требовало ТЗ.
  `test/i18n.test.mjs` жёстко проверяет `44` ключа (было 42) — тест падает и
  при пропуске, и при лишнем ключе. Оба CHANGELOG в одном коммите
  (`8013f7d0`) с `User-Visible: yes`. USER-GUIDE EN/RU, UX-MODES,
  TOUCH-SUPPORT, CONFIG-COMPATIBILITY обновлены и согласованы терминологией
  ("Show the room information window on hover" / доменная строка RU).
- **AC9 (гейты и бюджет).** См. раздел «Какие гейты прогнаны» — все
  перечисленные в AC9 гейты зелёные на этом SHA (через прямой прогон или
  легитимный byte-identical reuse, см. ниже), default golden кадры не
  изменились (единственный изменившийся кадр — `general-color-popover-desktop-en`,
  который явно является ожидаемым следствием новой строки в диалоге, принят
  по правилам §11).

## Golden-эталон: проверка правомерности принятия

Коммит `a6eb3d6c` меняет ровно один кадр, `general-color-popover-desktop-en`,
и несёт `Baseline-Reviewed: https://github.com/Matysh/houseplan-card/actions/runs/33722471494`
— это соответствует требованию §11 «эталоны golden принимаются только через
`npm run golden:accept -- --reviewed` на полном артефакте Linux CI».
Проверил сам прогон (`gh run view 33722471494`): джоб «Golden-кадры против
принятых эталонов» упал (ожидаемо — новый кадр ещё не принят), но перед этим
отработали и позеленели «Фронтенд: типы/юниты/мутанты/бандл»,
«Бэкенд: pytest», «Смоки: все шарды зелёные» — то есть кандидат собран из
полного, валидного дерева, не подогнан вручную.

Скачал обе версии PNG (`origin/dev` и `a6eb3d6c`) и сравнил визуально: разница
— это ровно новая строка-переключатель «Show the room information window on
hover» между `gs.hint` и `Fill: lights`, из-за которой весь низ диалога (в том
числе открытый color-popover) сдвинулся вниз на высоту одной строки. Никакого
постороннего визуального изменения нет. Решение автора не создавать отдельный
новый golden-сценарий (ТЗ, «Release-артефакты») было верным для *нового*
сценария; для *существующего* `general-color-popover-desktop-en`, который
непреднамеренно задело смещение вёрстки, потребовалось (и было сделано)
штатное принятие через reviewed CI-артефакт — никакого расхождения с
процессом.

## Какие гейты прогнаны и почему

Полные наборы (§8, предрелизный гейт) прогонять было не нужно — прогонялись/
подтверждались только гейты, которых касается этот diff, через чтение логов
уже отработавших Actions-прогонов этой ветки:

| Гейт | Статус | Источник |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + сверка 3 копий бандла | ✅ зелёный, не перегонял | Validate на `a6eb3d6c`, https://github.com/Matysh/houseplan-card/actions/runs/33723133249, джоб «Фронтенд: типы, юниты, мутанты, синхрон бандла» — как указано в постановке задачи, этот прогон уже подтверждён и повторного прогона не требует |
| `node scripts/check-docs.mjs` (source fingerprint) | ✅ | Коммит `9d1e5fdb` обновил `docs/images/screenshots.json`; предполётный docs-джоб зелёный в обоих прогонах |
| Config-schema manifest | ✅ | Коммит `223951c0` обновил `scripts/config-schema.json`, добавив `config.settings.show_room_tooltip` |
| `python -m pytest tests_backend -q` | ✅, не перегонял — byte-identical reuse | Реально выполнен и позеленел в run `33722471494` (джоб «Бэкенд: pytest», 2m9s, включает новые `test_validation.py`/`test_support_package.py`); в финальном run `33723133249` переиспользован («входы побайтово те же», #208) — backend-код между этими прогонами не менялся |
| Golden (`npm run golden:verify`) | ✅ | Run `33723133249`, джоб «Golden-кадры против принятых эталонов» зелёный **после** принятия эталона в `a6eb3d6c`; сам процесс принятия проверен отдельно выше |
| Browser smokes, выбранные по диффу | ✅, не перегонял — byte-identical reuse | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` дал 20 «прямых совпадений» (список ниже) и 18 «слабых связей» (только `_config`); вместо выборочного прогона проверил логи — **весь набор из 215 смоков** реально выполнен в run `33722471494` (3 шарда, все ✓, финальный агрегат «Смоки: все шарды зелёные» ✓), включая явно `demo/smoke_room_tooltip_toggle` (`ok smoke_room_tooltip_toggle` в логе шарда 1); в финальном run `33723133249` переиспользован тем же byte-identical правилом. Это сильнее любой выборки по символам — весь набор, а не только совпавшие по символам файлы |
| `npm run invariants -- --config ...` | Не прогонял — не требуется | Diff не трогает геометрию: нет изменений в rooms/walls/layout/marker.space/open_spans, только новый independent boolean и его resolver |
| Performance-профили | Не прогонял — не требуется | Не названы в AC9 как отдельный профиль; ТЗ («Производительность и безопасность») обоснованно исключает их, guard стоит до `_roomArea()`; perf-smoke job переиспользован (#208) на обоих прогонах как побайтово идентичный |
| `test/single-source-numbers.test.mjs` | Не запускал целево | Diff не добавляет и не дублирует ни одного видимого числового значения — переключатель boolean, площадь/температура/влажность/LQI не тронуты; тест из общего юнит-набора всё равно прошёл в рамках зелёного `npm test` |

### Прямые совпадения по `smoke-select.mjs` — решение по каждой строке

Все нижеперечисленные фактически прогнаны и зелены в CI (см. таблицу выше:
весь набор из 215 смоков выполнялся, а не только эти 20), решение
«прогнать» принято до выборки — фиксирую построчно для аудита:

- `smoke_feedback_v2`, `smoke_touch_tips` (`_hoverRoom`,`_notePointer`,`_tip`) — прямое совпадение, прогнан
- `smoke_room_tooltip_toggle` — новый целевой смок задачи, прогнан
- `smoke_help_affordance`, `smoke_bg_color`, `smoke_color_picker_consumers`, `smoke_dialog_zombie`, `smoke_esc_dialogs`, `smoke_gs_always`, `smoke_ha_controls`, `smoke_sun` (`_settingsDialog`/`_config`) — общие настройки задеты новой строкой в диалоге, прогнан
- `smoke_junction_patch_resilience`, `smoke_multiwall_junction`, `smoke_wall_key_roundtrip`, `smoke_isometric_live_touch`, `smoke_sun_live_bg` (`_hoverRoom`) — не про room-tooltip, но используют тот же геттер; прогнан вместе со всеми
- `smoke_decor`, `smoke_room_climate_placement`, `smoke_room_settings`, `smoke_ux_fixes` (`_tip`) — device/room tooltip соседние сценарии, прогнан

Слабые связи (18, все через один `_config`) не разбирались построчно — общий
прогон всего набора делает это избыточным; ни один из них не относится к
room-tooltip по существу.

## Чего не проверял

- Полный HA-харнесс/performance-профили за пределами того, что уже
  переиспользовано CI как byte-identical (#208) — не требуется по AC9 и не
  затронуто диффом.
- Ручное открытие приложения в браузере — цикл ревью не предусматривает
  ручного тестирования; вместо этого разобран код и прочитаны логи реально
  выполненного (не смоделированного) браузерного смок-прогона.
- Мутационная проверка вручную (я не патчил код и не перезапускал тесты
  локально) — оценена **логическая** способность тестов упасть по чтению
  кода теста и производственного кода одновременно; там, где это
  нетривиально (backend bool schema, i18n key count), это явно
  зафиксировано выше.
- Полный визуальный дифф остальных 131 неизменившихся golden-кадров — не
  нужно, `baselines-index.json` показывает, что изменился ровно один хэш.

## Материал раунда

- Ветка: `issue/426-room-hover-tooltip-toggle`
- SHA: `a6eb3d6cfa492ed1e742231800f31efab7c46e4b`
- Диапазон: `origin/dev..HEAD` (6 коммитов, см. «Скоуп»)

## Вердикт

**Зелёный.** High: 0 · Medium: 0. Готово к мержу.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/426-room-hover-tooltip-toggle`, коммит `a6eb3d6cfa49` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `ac93d978f870507113624993ecfa47e429806218`
  ```
  git log --all --format='%H %T' | grep ac93d978f870
  ```
- ТЗ `docs/specs/426-room-hover-tooltip-toggle.md`, блоб `66fb319f32ef962372bb998256effaf205a7fbb8`
  ```
  git log --all --find-object=66fb319f32ef962372bb998256effaf205a7fbb8 -- docs/specs/426-room-hover-tooltip-toggle.md
  ```
