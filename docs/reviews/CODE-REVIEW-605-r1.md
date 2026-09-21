# CODE-REVIEW #605 · r1

Этап: код-ревью (PROCESS.md §2.7). Заход r1, первый цикл этапа code — раздел
«Унаследовано из r0» не нужен (§2.10 работает со второго захода code-review;
предыдущий зелёный документ, `docs/reviews/SPEC-REVIEW-605-r1.md`, относится к
этапу spec, не code).

Материал: `git diff origin/dev...HEAD` на SHA `2f1876a405cae50eb0aa86687adb1685200b2974`
(рабочая копия уже на нём, `git status` чист).

## Скоуп ревью

Остаточная полировка четырёх диалогов настроек после #600/#602/#603 — семь
пунктов из тела issue (AC1–AC8): числа прозрачности в плитках General не
обрезаются, сплошной свотч без второго шахматного квадрата (плитки и плашки),
uppercase hex в отображении, Reset у Wall fill, обведённые кнопки Data, единое
поле иконки Device без двойного превью, EN/DE подпись `Rotation`/`Drehung`.
Только CSS/markup/i18n, без изменения формата конфига. J4/J6 (`docs/SCOPE.md`) —
подтверждено уже на этапе аналитики/спек-ревью, продуктовых вопросов к владельцу
не осталось.

Продуктовый код: `src/editors/form-kit.ts`, `src/editors/general-settings-dialog.ts`,
`src/editors/marker-dialog.ts`, `src/editors/room-settings-dialog.ts`,
`src/editors/space-form.ts`, `src/hp-color-opacity.ts`, `src/styles/form-kit.styles.ts`,
`src/i18n/{en,de}.json`. Тесты/гейты: новый `demo/smoke_dialog_polish_605.mjs`,
правки `demo/smoke_general_settings{,_form}.mjs`, `demo/smoke_space_settings_form.mjs`,
`test/form-kit.test.mjs`, `test/i18n.test.mjs`, `test/fixtures/form-kit-card-dialog*.css`,
`scripts/smoke-links.mjs` (снята запись реестра, обоснование — прямая выборка уже
покрывает те же смоки). Три коммита: `08a56953` (продукт, `User-Visible: yes`, оба
changelog в этом же коммите), `551d4782`, `2f1876a4` (оба `User-Visible: no`,
инфраструктура тестов). Трейлеры `Issue:`/`User-Visible:` на месте на всех трёх.

## Как проверялось

| Гейт | Результат | Источник |
|---|---|---|
| `npx tsc --noEmit` / `npm test` / `npm run build` | зелёные (переиспользование дерева) | Validate `2f1876a4`: [35588739786](https://github.com/Matysh/houseplan-card/actions/runs/35588739786) — job «Фронтенд» reuse-skip после «Переиспользование: дерево уже проверено» success |
| Мутанты по диффу (6 шардов) | success 6/6 | тот же прогон 35588739786 |
| `npm run build && npm run bundle:sync` | локально: byte-identical, `git status` чист после сборки | прогнал сам |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 18 «прямых совпадений», 0 «зарегистрированных», 0 «неопределённость» | прогнал сам, вывод ниже |
| `node demo/smoke_dialog_polish_605.mjs` (новый, прямое совпадение) | зелёный, **и умеет падать**: снял `appearance:textfield`+spin-hiding → `noSpinner=false` (6/6), снял `flat-swatch cover-swatch` у плитки → `oneSurface=false` (6/6) | прогнал сам, дважды с мутацией и откатом |
| `node demo/smoke_general_settings.mjs`, `smoke_general_settings_form.mjs`, `smoke_space_settings_form.mjs`, `smoke_color_picker_consumers.mjs`, `smoke_color_picker.mjs`, `smoke_bg_color.mjs`, `smoke_ha_controls.mjs`, `smoke_backup_transfer.mjs`, `smoke_dialog_polish_603.mjs`, `smoke_dialog_config_parity.mjs` | все зелёные | прогнал сам |
| `npm run golden:verify` | 8 сцен `different` — ровно те, что диалоги задачи (см. ниже); остальные ~90 `passed` | прогнал сам |
| `node scripts/check-docs.mjs` | `ERROR: screenshot source fingerprint is stale` | прогнал сам; ожидаемо и системно (см. «Находки») |
| `python -m pytest tests_backend` | не прогонял | diff не трогает `custom_components/**/*.py` |
| `npm run invariants` | не прогонял | diff не трогает геометрию/`layout`/`marker.space`/`open_spans` |
| performance-профиль | не прогонял | не назван в AC, изменения не на кадровом пути (CSS/markup) |

Вывод `smoke-select.mjs` (18 прямых совпадений, ключевые):
`smoke_dialog_polish_605.mjs` ← `_setFillColor, coverSwatch, flatSwatch`;
`smoke_general_settings.mjs` ← `_setFillColor`; `smoke_bg_color.mjs`,
`smoke_color_picker.mjs`, `smoke_color_picker_consumers.mjs`, `smoke_ha_controls.mjs`
← `showOpacity` (легитимно: строка `this.flatSwatch ? 1 : this.showOpacity ? ...`
в `hp-color-opacity.ts` изменилась дословно); `smoke_backup_transfer.mjs` ←
`_openBackupExport`; шесть смоков Optimize/Align ← `_openAlignDialog`/
`_undoPlanOptimization` — по чтению кода все шесть вызывают `card._openAlignDialog()`
напрямую, минуя кнопку и её CSS-класс, поэтому смены `.btn.ghost.alignall → .btn`
не касаются; не прогонял, слабая связь снята чтением, не исполнением.

### golden:verify — какие сцены изменились

`different`: `device-dialog-desktop-en`, `device-dialog-mobile-ru`,
`device-dialog-desktop-de`, `device-help-popover-light-ru`,
`general-color-popover-desktop-en`, `settings-help-zoom-200-en-light`,
`settings-help-zoom-200-ru-dark`, `device-ripple-color-popover-mobile-ru` — ровно
диалоги General/Device, задетые задачей; ни одна geometry/lighting/junction/
furniture/tray-сцена не изменилась. Просмотрел `artifacts/golden/actual/*` для
`device-dialog-desktop-en` и `general-color-popover-desktop-en`: единое
округлённое 44px поле иконки с плейсхолдером `mdi:chip` (без второго превью),
плитка `Hot` показывает `#FFD45C` / `18 %` полностью, без второго шахматного
квадрата на плитке; `device-ripple-color-popover-mobile-ru` — плашка `#3EA6FF`
сплошная, без чекерборда. Расхождения — ожидаемое следствие задачи, не
регрессия; принятие эталонов остаётся предрелизным шагом (в ТЗ и в хендоффе
автора это явно названо, не скрыто).

## Находки

Блокирующих (High) нет. В скоупе задачи (Medium) — нет.

**Low** — мёртвый CSS-селектор. `src/styles/dialogs.styles.ts:1044` всё ещё
содержит `.btn.alignall { width: 100%; justify-content: center; }`, а класс
`alignall` в разметке этой задачей снят (`general-settings-dialog.ts`, было
`btn ghost alignall` → стало `btn`) и грепом по `src/editors/*.ts` больше нигде
не применяется. Правило теперь ни на что не действует — воспроизведение: `grep -rn
alignall src/editors/*.ts` пусто, `grep -n "\.btn\.alignall" src/styles/dialogs.styles.ts`
находит правило. Риска нет (мёртвое правило не меняет рендер), но правило стоит
снять при следующей правке этого файла. Снимаю без блокировки цикла — правка
для одной неиспользуемой строки непропорциональна отдельному циклу ревью.

**Не находка, отдельно фиксирую как ожидаемое** — `node scripts/check-docs.mjs`
кончает `ERROR: screenshot source fingerprint is stale`. Причина системная, не
специфична для #605: отпечаток считается по всему `src/**`, поэтому его делает
устаревшим любая правка фронтенда (см. напоминание процесса к этой задаче и
AGENTS.md — свежесть скриншотов это предупреждение на обычном пуше и жёсткий
гейт только на релизном кандидате). Задача не добавляла новых слов интерфейса
сверх уже отражённых в `docs/USER-GUIDE.md`/`.ru.md` (оба обновлены в этом же
коммите), новых скриншотов документации ТЗ не требует.

## AC → доказательство

| AC | Наблюдаемый результат | Доказано | Чем краснеет |
|---|---|---|---|
| AC1 | Число прозрачности 0/18/35/100 и `%` видны полностью, spinner не перекрывает | `smoke_dialog_polish_605`: `fits`, `noSpinner` на 320/360/560 px, light/dark | воспроизвёл: снял `appearance:textfield`+webkit-spin-hiding → `noSpinner` красный на всех 6 срезах |
| AC2 | Печатный hex uppercase, сохранённый цвет не меняется | `smoke_dialog_polish_605`: `upperHex`; `smoke_general_settings_form`, `smoke_space_settings_form` (сравнение с `.toUpperCase()`); чтением — `colorField`/`colorTile` в `form-kit.ts:277,320` печатают `hex.toUpperCase()`, значение в draft/config не тронуто | не защитный AC (формат вывода) — сравнение ожидаемого/фактического, третья колонка не нужна по §2.7 |
| AC3 | Одна сплошная поверхность на плитке, сплошной свотч на плашках, клик/Enter/Space открывают панель, alpha показывает число | `smoke_dialog_polish_605`: `oneSurface`, `tileWholeSurfaceOpens`, `tileKeyboardOpens`, `opensPicker` на всех срезах | воспроизвёл: снял `flat-swatch cover-swatch` у плитки General → `oneSurface` красный на всех 6 срезах |
| AC4 | Reset у Wall fill возвращает `#ffffff`/100% только в черновике, Save/Cancel как раньше | `smoke_dialog_polish_605`: `resetsDraftOnly` (сравнивает `_serverCfg` до/после — доказывает черновик-only); `smoke_dialog_config_parity` (общий Save пишет состояние) | защитный (draft-only) — снятый `onReset` тривиально ломает `resetsDraftOnly`; отдельно не воспроизводил снятие (полдесятка строк, поведение очевидно по чтению `_setFillColor`), фиксирую как проверено смоком, не мутацией |
| AC5 | Data-действия обведены, ≥44px, левое выравнивание, без обрезки на 320px, обработчики прежние | `smoke_dialog_polish_605`: `outlined`, `leftAligned`, `noOverflow`-эквивалент внутри `outlined` (границы `innerWidth`) на 320/360/560; `smoke_general_settings` (`rows` считает Optimize по метке, не по классу) | чтением: `.btn` база уже имеет `border:1px` (`dialogs.styles.ts:38-51`), `.btn.ghost{border:none}` снят с этих кнопок — воспроизводить не стал, эквивалентно AC2 по типу (замена класса, не guard) |
| AC6 | Единое 44px поле иконки, без двойного превью, фокус/выбор/Pin/Clear работают в обеих ветках | `smoke_dialog_polish_605`: `icon_fallback`, `icon_onePreview`, `icon_themed`, `icon_selects`, `icon_clears`; golden `device-dialog-desktop-en` (актуальный кадр — округлое поле с плейсхолдером `mdi:chip`, без отдельного квадрата) | ограничение честно названо автором: демо не грузит настоящий `ha-icon-picker`, ветка проверена на test double; реальная визуальная проверка в HA — до беты (зафиксировано в АС6 как допустимое отклонение, не скрыто) |
| AC7 | EN `Rotation`, DE `Drehung`, RU/FR без изменений | `smoke_dialog_polish_605`: `icon_rotation`; чтением — `en.json:259`, `de.json:259` изменены, `fr.json:259`/`ru.json:259` не тронуты (только 4 языка содержат ключ, все проверены) | не защитный — текстовое сравнение |
| AC8 | Нет `input[type=color]`; конфиг не меняется вне явного выбора/Reset; #602/#603 не регрессируют | `smoke_dialog_polish_605`: `noNative` на всех срезах; `smoke_dialog_config_parity` (4 диалога); `smoke_color_picker_consumers`, `smoke_dialog_polish_603` — все зелёные | защитный (отсутствие нативного контрола) — сам `noNative` тривиально краснеет при возврате `input[type=color]`, отдельно не мутировал (ноль native-input в разметке подтверждён и чтением, риск близок к нулю) |

## Что проверено и корректно

- DOM-порядок в `colorTile` (`form-kit.ts:313-329`): `${picker}<span>label</span>` —
  подпись имеет `z-index:1` и `pointer-events:none`, курсор проваливается на
  `hp-color-opacity` под ней; читаемость подписи не завязана на новую вёрстку
  (инлайновый `color` на контейнере по `isLightHex` не тронут).
- `flatSwatch`/`coverSwatch` в `hp-color-opacity.ts` не меняют поведение
  потребителей без атрибута: `this.flatSwatch ? 1 : this.showOpacity ? pct/100 : 1`
  при `flatSwatch=false` сворачивается к прежнему выражению — проверил чтением
  и подтвердил, что смоки соседних потребителей (`decor-image-editor.ts`,
  `houseplan-editor-runtime.ts`, не тронутые задачей) остались зелёными.
  `coverSwatch` используется только в паре с `flat-swatch` и только для плиток
  General (`general-settings-dialog.ts:67`) — грепом других применений нет.
- i18n: единственный потребитель `marker.angle_label` —
  `marker-dialog.ts:774,778-779`; конфликтов со строкой `"Rotate"` в
  smoke/test-фикстурах не нашёл.
- Формат конфига не изменён: `DEFAULT_FILL_COLORS`, `{c,a}`, `marker.icon`
  нетронуты; `smoke_dialog_config_parity` подтверждает четыре диалога.
- Трейлеры: `Issue: #605` на всех трёх коммитах, `User-Visible: yes` только на
  продуктовом `08a56953` с правками в оба `docs/CHANGELOG*.md` в этом же
  коммите; `User-Visible: no` на двух тестовых коммитах корректен (изменения
  только в `demo/**`/`scripts/**`/`test/**`).
- «Одно число — один источник»: новых видимых величин задача не вводит (только
  формат/раскладку существующих hex/opacity); отображаемый opacity в плитке и
  в открытой панели читают одно и то же поле черновика, второго источника нет.

## Чего не проверял

- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.
- `npm run invariants` — diff не трогает геометрию/рёбра/`layout`/`marker.space`.
- Полный `npm run golden:accept` / обновление эталонов — по процессу это
  предрелизный шаг, не код-ревью; автор явно отложил его туда же.
- Реальный `ha-icon-picker` конкретной версии HA (Shadow DOM) — демо использует
  test double; автор зафиксировал это как явное ограничение AC6 с обещанием
  визуальной проверки в HA до беты, не скрыл.
- Полный набор `demo/smoke_*.mjs` (260 файлов) — непропорционален объёму задачи
  (7 пунктов CSS/markup/i18n в 4 диалогах); прогнал прямые совпадения выборки
  целиком, слабые совпадения (Optimize/Align) разобрал чтением.
- `npx tsc --noEmit` / `npm test` / `npm run build` как отдельные локальные
  прогоны — не повторял, приняты по зелёному Validate на этом SHA
  (см. таблицу гейтов).

## Итог

Все восемь AC доказаны — либо исполняемым свидетелем, который я лично провёл
через отрицательную мутацию, либо чтением с прямой ссылкой на строку и явно
названным ограничением там, где автоматический oracle несоразмерен (реальный
HA icon picker). Единственная находка — Low (мёртвый CSS-класс), без риска и
без блокировки цикла. Задача решает заявленный сценарий, View не тронут,
смежные #602/#603 не регрессируют.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/605-settings-dialog-polish`, коммит `2f1876a405ca` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `c8896ce1dfb87a6da74992f143e7b2e6d467366a`
  ```
  git log --all --format='%H %T' | grep c8896ce1dfb8
  ```
- Тело issue: `1ac056c8046ac454209d0ddeffc96c18d4c9449728ba9cc70ffdf7f05a79915f`
- Вердикт конвейера: `green` · High 0
