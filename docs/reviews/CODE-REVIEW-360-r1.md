# CODE-REVIEW-360-r1

Issue: #360 «Основной default-цвет декора на главной панели»
Этап: код-ревью (PROCESS.md §2.7)
Заход: r1 · блокирующих циклов израсходовано 0/2
SHA материала ревью: `f91b0ff51254fdf10aee1da56f20a307d7ea1e72`
Диапазон: `git diff origin/dev...HEAD` (один некоммит-мёрдж коммит `f91b0ff5`)

## Вердикт

**Зелёный.** High: 0, Medium: 0 (ни в скоупе, ни вне скоупа), Low: 0.

## Скоуп диффа

Один продуктовый коммит `f91b0ff5 feat: expose decor default color in main toolbar`,
трейлеры `Issue: #360` / `User-Visible: yes` на месте.

Файлы: `src/houseplan-editor-runtime.ts` (+9 строк — новый постоянный
`hp-color-opacity` в `_renderDecorBar`), `test/color-picker.test.mjs`,
`demo/smoke_decor.mjs`, `docs/DECOR-EDITOR.md`, `docs/USER-GUIDE.ru.md`,
`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/images/07-background-editor.png`
+ `screenshots.json` (отпечаток документации), сгенерированные `dist/**` и
`custom_components/houseplan/frontend/**` (класс D, синхронны с исходником).

Диффу соответствует ровно одна цель ТЗ: сделать существующий session-default
`_decorStyle.color`/`_decorStyle.opacity` видимым и управляемым с основной
панели редактора подложки при любом инструменте, ничего больше не меняя.
Правка не трогает геометрию, персистентную модель, i18n-ключи, миграции,
touch-контракт и любые другие редакторы — заявленный не-скоуп ТЗ выдержан
построчно.

## Как проверялось

Зелёного Validate на `f91b0ff5` нет, гейты прогнаны локально.

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit` | 🟢 зелёный | без вывода |
| `npm test` | 🟢 зелёный | 1534 passed / 1 skipped / 0 failed |
| `npm run build` | 🟢 зелёный | `git status` после сборки чист — `dist/**` и `custom_components/houseplan/frontend/**` побайтово совпадают с закоммиченными (сверка проведена `diff -q` дополнительно) |
| `node scripts/check-docs.mjs` | 🟢 зелёный | «Documentation checks passed (7 files, 10 external links)» — diff трогает `src/**`, поэтому обязателен |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выполнен | 3 «прямых совпадения» по символу `_decorStyle`: `demo/smoke_decor.mjs`, `demo/smoke_color_picker.mjs`, `demo/smoke_furniture.mjs` |
| `node demo/smoke_decor.mjs` | 🟢 зелёный | назван в тест-плане ТЗ (п.6) и это же смок расширен диффом; см. «тест умеет падать» ниже |
| `node demo/smoke_color_picker.mjs` | 🟢 зелёный | прямое совпадение из smoke-select |
| `node demo/smoke_furniture.mjs` | 🟢 зелёный | прямое совпадение из smoke-select (мебель — один из потребителей `_decorStyle`) |
| `node --test test/color-picker.test.mjs` | 🟢 зелёный | новые ассерты по `decor-default-color`; см. «тест умеет падать» ниже |
| `npm run golden:verify` | **не прогонялся** | ТЗ (план тестов, п.6) явно относит golden/screenshot-ревью к предрелизному гейту (AC6: «Доказательство: smoke + golden/screenshot review перед бетой»); это решение уже прошло зелёное ревью ТЗ (SPEC-REVIEW-360-r2). Локальный прогон дополнительно бессмыслен: правило §12/#13 принимает эталоны только `golden:accept -- --reviewed` по полному Linux-артефакту CI |
| `npm run invariants -- --config …` | **не прогонялся** | diff не трогает геометрию/`layout`/`marker.space`/`open_spans`/рёбра — только UI-state `_decorStyle` и его потребление существующими `decorStylePatch`/`_decorSaveShape`, которые сам diff не меняет |
| `python -m pytest tests_backend -q` | **не прогонялся** | `custom_components/**/*.py` не тронут |
| performance-профили | **не прогонялись** | не названы в AC, чувствительные к перфу пути (рендер геометрии, пересчёт масок) не тронуты — добавлен один статический biding в toolbar |

### Дисциплина «тест умеет падать»

Проверено исполнением, не только чтением: временно убран добавленный блок
`<hp-color-opacity class="decor-default-color" …>` из `_renderDecorBar`
(`src/houseplan-editor-runtime.ts`), пересобран бандл (`npm run bundle:sync`)
— `node demo/smoke_decor.mjs` упал (`Cannot read properties of null (reading
'dispatchEvent')` на обращении к main picker). Отдельно тем же способом
(без пересборки, тест читает `.ts`-исходник напрямую) `node --test
test/color-picker.test.mjs` упал на новом ассерте `defaultPickerStart >= 0`.
После проверки код и бандлы восстановлены (`git checkout --
src/houseplan-editor-runtime.ts` + `npm run bundle:sync`), `git status`
чист.

## Разбор по AC

- **AC1 (постоянная доступность).** `_renderDecorBar` (src/houseplan-editor-runtime.ts:5324)
  рендерит `.editbar-tools`, где новый `hp-color-opacity.decor-default-color`
  безусловен — не зависит от `this.host._decorTool`, в отличие от контекстного
  picker'а в `_renderDecorSecondary` (условие `draws`, строка 5252). В коде
  ровно один экземпляр `class="decor-default-color"`. Проверено чтением и
  смоком `defaultStyleVisibleForEveryDecorTool` (перебор всех 8 инструментов,
  включая `select`/`erase`/`backdrop`) — **доказано**.
- **AC2 (все новые типы).** Смок `everyNewDecorKindUsesMainDefault`: после
  смены основного default создаются line/rect/ellipse (через `_decorCommitDraft`),
  text (через `_decorPointerDown`+`_decorSaveText`) и furniture (через
  `_furnPlace`) — все получают записанный `color`/`opacity`. **Доказано
  browser-смоком**, как требует AC.
- **AC3 (существующее неизменно).** Смок `mainPickerLeavesExistingObjectsUntouched`
  сравнивает JSON контрольного объекта до/после смены default побайтово.
  **Доказано**.
- **AC4 (заливка независима).** Смок `mainDefaultDoesNotOverwriteShapeFill`:
  после смены default `fill_color`/`fill_opacity` новых rect/ellipse равны
  ранее выставленным `#fedcba`/`0.23`, а не новому основному цвету. В коде
  обработчик пишет только `{ ...e.detail }` (`color`, `opacity`), других полей
  событие не содержит. **Доказано и кодом, и смоком**.
- **AC5 (единый state).** Смок `mainPickerUpdatesOneSessionDefault` (main → context)
  и `contextPickerUpdatesMainPicker` (context → main) в обе стороны, плюс
  `objectDialogRefreshesMainDefault` — сохранение properties-диалога линии
  обновляет main picker по контракту `_decorSaveShape` (не менялся диффом).
  Оба picker'а читают один `this.host._decorStyle`, что даёт единый источник
  числа «текущий цвет/opacity» без дублирования (проверка на предмет «одно
  число — один источник» пройдена чтением). **Доказано**.
- **AC6 (responsive/a11y).** Обычная ширина уже покрыта существующими
  `colorPickerUsesTopLayer`/`colorPickerInsideViewport`. Добавлен отдельный
  прогон на viewport 560×820: `narrowToolbarKeepsToolsAndCloseApart` (Undo/Redo
  и все 8 кнопок инструментов не наезжают на закреплённый `.editbar-end`),
  `narrowToolbarKeepsDefaultPickerUsable` (popover целиком в viewport),
  `defaultPickerReadableInLightAndDark` (trigger 40×40 и `visibility: visible`
  в обеих темах). Стилизация не потребовала правок `chrome.styles.ts`: уже
  существующее правило `.decorbar hp-color-opacity { flex: 0 0 auto; }`
  (chrome.styles.ts:124) действует на любой `hp-color-opacity` внутри
  `.decorbar` по тегу, а не по конкретному call site — новый инстанс подпадает
  автоматически. Golden/screenshot-ревью по AC6 — явно предрелизный гейт (см.
  таблицу выше), здесь не требуется. **Доказано смоком + чтением; golden — по
  плану ТЗ, не на этом этапе**.
- **AC7 (совместимость и гейты).** Новых persisted-полей и i18n-ключей нет —
  переиспользованы `decor.color`/`space.opacity`, `_colorPickerLabels` (было
  ранее). `_decorStyle` остаётся приватным полем класса с исходным значением
  `{ ...DEFAULT_DECOR_STYLE }` (houseplan-card.ts:1006), нигде не пишется в
  конфиг/localStorage — session-only, как и раньше. typecheck/test/build
  зелёные (таблица выше). **Доказано чтением и гейтами**.
- **AC8 (документация).** `docs/DECOR-EDITOR.md` и `docs/USER-GUIDE.ru.md`
  описывают постоянный main-bar picker и его связь с контекстным; оба
  changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в том же
  коммите со ссылкой на #360. `check-docs.mjs` зелёный — отпечаток
  скриншотов документации пересчитан и совпадает. **Доказано**.

## Что проверено и корректно

- Единственная точка изменения продуктового кода — 9 строк в
  `_renderDecorBar`, использующие уже существующий контракт `_decorStyle` и
  компонент `hp-color-opacity` без второй модели цвета, без нативного
  `<input type="color">` (unit-тест на отсутствие таких input по всем `src/**`
  зелёный).
- Обработчик `@hp-color-opacity-change` у нового picker'а буквально совпадает
  с обработчиком контекстного picker'а того же назначения (строки 5267-5268 и
  5378-5379 идентичны) — не новая логика, а тот же паттерн, что уже
  используется в 10+ местах файла; дублирование стилистическое и не вводится
  этим диффом впервые, вычленять абстракцию ради одной новой строки не по
  задаче.
- Бандлы (`dist/**`, `custom_components/houseplan/frontend/**`) синхронны с
  исходником побайтово после чистой пересборки.
- Откат из ТЗ подтверждён: удаление добавленного блока — единственное
  необходимое действие, состояние и persisted-данные не завязаны на него
  (проверено практически при тесте «умеет падать»).

## Чего не проверял

- `npm run golden:verify` и обновление golden-эталонов — по решению ТЗ (AC6,
  п.6 плана тестов) это предрелизный гейт (PROCESS §8), а не гейт этого
  ревью; сам выбор уже прошёл зелёное ревью ТЗ.
- Инварианты модели геометрии (`npm run invariants`) — diff не касается рёбер,
  толщины, `layout`, `marker.space`, `open_spans`.
- Backend (`pytest tests_backend`) — `custom_components/**/*.py` не менялся.
- Производительность — не названа в AC, чувствительный к перфу код не тронут.
- Ручное визуальное тестирование в браузере (вне Playwright-смоков) — не
  проводилось; вместо него отработаны целевой и два смежных browser-смока
  плюс явная проверка «тест умеет падать» на живом бандле.

## Итог

Реализация соответствует контракту ТЗ дословно: один новый постоянный
`hp-color-opacity` на главной панели, никаких побочных изменений в
персистентной модели, заливке фигур, существующих объектах, i18n или touch/
View-контракте. Все AC либо доказаны browser-смоком (с подтверждённой
способностью упасть), либо разобраны по коду. Дешёвые и целевые гейты
зелёные. Оснований для Medium/High нет.
