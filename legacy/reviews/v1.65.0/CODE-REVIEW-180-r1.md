# Код-ревью #180 — r1

Issue: [#180](https://github.com/Matysh/houseplan-card/issues/180)
ТЗ: `docs/specs/180-all-color-call-sites.md`, ревью ТЗ: `docs/reviews/SPEC-REVIEW-180-r1.md` (зелёное, High 0/Medium 0)
Диапазон: `git diff origin/dev...HEAD` (коммиты `3540d24`, `f69ac71`, `fcee724`), реализация — `fcee724`
Вердикт: **красный** · цикл r1/4 · High: 1 · Medium: 0 → нет

## Скоуп

#180 переводит пять оставшихся source-шаблонов `<input type="color">`
(15 полей: 11 палитр общих настроек, глобальный статичный фон, marker
activity/ripple color, цвет комнаты пространства, фон пространства) на общий
`hp-color-opacity` из #57. Модель данных, backend, i18n-ключи не меняются.
Диапазон правок: `src/houseplan-card.ts`, `src/styles.ts`,
`test/color-picker.test.mjs`, `test/golden-matrix.test.mjs`,
`demo/golden/harness.mjs`, `demo/golden/matrix.mjs`,
`demo/smoke_color_picker_consumers.mjs` (новый), три копии бандла,
`docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.md`/`.ru.md`, `docs/TESTING.md`.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 896/896 зелёный |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный, `git status` после сборки — пусто (закоммиченные копии уже актуальны) |
| Целевой smoke (новый, AC1-AC5) | `node demo/smoke_color_picker_consumers.mjs` | зелёный, все 11 проверок `true` |
| Целевой smoke (существующий, общий контракт #57) | `node demo/smoke_color_picker.mjs` | зелёный, все 16 проверок `true` |
| Дисциплина «тест умеет падать» | мутация `showOpacity` ripple-picker с `false`→`true`, пересборка, повторный прогон `smoke_color_picker_consumers.mjs`; исходник и бандлы возвращены на место сразу после | `rippleUsesColorOnlyPicker` упал в `false` как и ожидалось → тест реально способен обнаружить регресс. Дерево восстановлено, `git status` пусто |
| Целевой golden capture (AC7, три новых dialog family) | `npm run golden:capture -- --scenario=general-color-popover-desktop-en` / `--scenario=device-ripple-color-popover-mobile-ru` / `--scenario=space-room-color-popover-desktop-ru` | все три рендерятся без runtime-ошибки (`missing-baseline` — ожидаемо для новых сценариев, эталоны не приняты и не должны быть); визуальный осмотр `artifacts/golden/actual/*.png` **вскрыл High-находку ниже** |
| Ручная DOM-проверка ripple-row (391px и RU/EN) | Playwright-скрипт, `getBoundingClientRect()` на `.label` пикера и соседнем `.opl` | подтвердил геометрическое перекрытие независимо от открытого/закрытого picker popover |
| `golden:verify` (полный) | не прогонялся | не нужен для ревью: сравнение с эталонами для новых сценариев невозможно (`missing-baseline` по дизайну — эталоны принимаются только через `golden:accept --reviewed` на Linux CI, это pre-beta шаг), а существующие сценарии, которые могла затронуть правка `styles.ts`, использую другой CSS-путь (`.editor-secondary`, `.gsrow`), затронутых регрессий не нашёл при точечном чтении |
| `python -m pytest tests_backend -q` | не прогонялся | диапазон не трогает `custom_components/**/*.py` |
| Performance-профили | не прогонялись | ни AC, ни diff не называют performance-чувствительный путь; спека §14 явно фиксирует «новых observers/подписок/network нет» |
| Полный набор `demo/smoke_*.mjs` (127 шт.) | не прогонялся | диапазон касается только color-picker consumers; остальные 125 смоков не относятся к затронутым поверхностям (PROCESS.md §8) |

## Находки

### High-1 — перекрывающиеся, нечитаемые подписи в строке "Цвет пульсации / Размер пульсации" на узком экране

**Файл:** `src/houseplan-card.ts:19334-19343` (шаблон), корень — `src/hp-color-opacity.ts:73-83` (`:host { display: inline-flex; }`, `.label { white-space: nowrap; }`)

**Что не так:** до #180 обе подписи в строке marker-ripple (`Активность`/`Размер пульсации`) рендерились как обычные `<span class="opl">` без `white-space: nowrap`, поэтому при недостатке ширины они просто переносились по словам внутри своего flex-элемента. После миграции подпись цвета переехала внутрь `hp-color-opacity`, чей host-стиль жёстко фиксирует `white-space: nowrap` на `.label`. В строке `.colorrow` (flex, `nowrap`, без `min-width:0` на элементах) это не переносит текст, а позволяет ему визуально вылезти за пределы выделенной flex-полосы и лечь на соседний `<span class="opl">` — тот в это время как раз ужимается и переносится в несколько строк на своей урезанной колонке.

Подтверждено чтением и исполнением:
- Скриншот `device-ripple-color-popover-mobile-ru` (390×1000, RU, dark) — сценарий, который сам #180 завёл именно для проверки AC7 на этой поверхности — показывает буквальное наложение текста «Цвет пульсации активности» и «Размер пульсации активности» друг на друга (см. `artifacts/golden/actual/device-ripple-color-popover-mobile-ru.png`, не коммитится, воспроизводится локально командами ниже).
- Прямое измерение `getBoundingClientRect()` (Playwright, диалог устройства, `display: 'icon_ripple'`, viewport 390×1000):
  - RU: `label` (цвет) `x: 17..171` (ширина 154, при этом текст `nowrap` — реальная отрисовка шире бокса), `opl` (размер) начинается в `x: 101.875` — то есть контейнер второй подписи стартует **внутри** горизонтального диапазона первой;
  - EN (короче текст, тот же экран): `label` `x: 17..116.4`, `opl` начинается в `x: 110.7` — то есть даже на английском перекрытие есть, просто на ~6px, а не на десятки.
- Причина локализована: то же самое поведение `_renderColorRow()`/`.gsrow`-строк не ломается, потому что там `hp-color-opacity` — единственный текстовый элемент строки; выделенная under CSS-правкой `.gsrow > hp-color-opacity { min-width: ...; justify-content: space-between; }` защита относится только к `.gsrow`, а строка ripple использует простой `.colorrow` без этой защиты и без own min-width на соседнем `.opl`.

**Как воспроизвести:**
```bash
npm run build && cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js
npm run golden:capture -- --scenario=device-ripple-color-popover-mobile-ru
# открыть artifacts/golden/actual/device-ripple-color-popover-mobile-ru.png
```
или через прямой DOM-замер: открыть `hp-dialog` устройства с `display: 'icon_ripple'` на viewport 390px, сравнить `getBoundingClientRect()` подписи `hp-color-opacity.label` (shadow DOM) и соседнего `span.opl`.

**Почему это блокирует:** сам AC7 ТЗ #180 требует именно для этой поверхности («marker activity mobile») отсутствия «double labels» и читаемости `ripple-size` control; golden-сценарий `device-ripple-color-popover-mobile-ru` был добавлен в этой же задаче специально для доказательства этого пункта, но реальный рендер ему не соответствует. Хендофф-комментарий сам признаёт, что «browser smoke and golden capture were authored but not executed» — целевой golden не был прогнан автором перед переводом в код-ревью, поэтому дефект не был замечен раньше. Это доказанный чтением+исполнением сбой конкретного, пронумерованного AC — по §2.7/§3(правило 8) High блокирует.

**Не входит в блокировку:** state-модель (цвет/размер/альфа) не задета — `rippleChangeLeavesSizeAndAlphaModelAlone` в смоке зелёный, независимость `rippleSize` от цвета подтверждена. Проблема исключительно визуальная/layout.

## Что проверено и корректно

- **AC1 (полное source-покрытие).** `node --test test/color-picker.test.mjs` (входит в `npm test`) рекурсивно сканирует весь `src/**/*.ts` на `input[type=color]` — подтверждено чтением скрипта сканирования (использует `readdirSync` рекурсивно от `src/`, не только два файла). `grep` подтвердил 0 вхождений `type="color"` в `src/**/*.ts`. Счётчик `<hp-color-opacity` — 13 (8 существующих + 5 новых template instances), совпадает с инвентаризацией ТЗ §4/§17-1.
- **AC2 (opacity внутри единой surface для 11 палитр + room color).** `showOpacity=${true}` встречается ровно 2 раза в источнике (общий `_renderColorRow()` template, room color) — соответствует ТЗ §7.1. Смок `generalColorAndOpacityStayAtomic` и `roomColorAndOpacityStayAtomic` подтверждают атомарное обновление `{color, opacity}` в правильный draft без побочных изменений соседних полей (`temp_cold` не тронут при правке `light_on`).
- **AC3 (color-only без alpha).** `showOpacity=${false}` — 4 раза (Glow — уже из #57, global bg, ripple, space bg). Событие `hp-color-opacity-change` всегда несёт `{color, opacity}` (`src/hp-color-opacity.ts:693-695`), но все три новых color-only handler деструктурируют только `e.detail.color` — прочитано в коде и подтверждено смоками `rippleChangeLeavesSizeAndAlphaModelAlone` (`!Object.hasOwn(..., 'rippleOpacity')`), `globalBackgroundIgnoresAlphaAndResets`, `spaceBackgroundIgnoresAlphaAndCancelPersistsNothing`.
- **AC4 (nullable/default/inherit).** Смоком подтверждено: открытие/закрытие global bg picker без изменения не материализует `null→explicit` (`globalBackgroundOpenCloseDoesNotMaterialize`); explicit-значение корректно откатывается кнопкой `Default`/`Inherit` в `null` (`globalBackgroundIgnoresAlphaAndResets`, `spaceBackgroundIgnoresAlphaAndCancelPersistsNothing`), причём второй тест также подтверждает, что закрытие space-диалога без Save не сохраняет черновик в `_serverCfg`.
- **AC5 (ripple/size независимость), кроме визуального сбоя выше.** State-уровень подтверждён смоком; `rippleSize` не меняется при правке цвета.
- **AC6 (один overlay).** Смок `generalPickersAreExclusive` подтверждает, что открытие второго picker (`tempCold`) закрывает первый (`lightOn`, `aria-expanded=false`) в строке из 12 инстансов. Общий keyboard/Escape/pointercancel/zoom-контракт компонента не тронут диапазоном (сам `hp-color-opacity.ts` не изменён логически, только новые consumers) и остаётся покрыт существующим `smoke_color_picker.mjs`, прогнанным зелёным.
- **AC8 (совместимость).** Модель данных (`FillColors`, `bg_color`, `ripple_color`, `room_color`/`room_opacity`) не изменена — прочитано в диффе, новых полей/ключей нет. `npm test` зелёный (включая i18n EN/RU parity, unaffected — новых ключей нет). Новых зависимостей/сетевых вызовов в диффе нет.
- **Трейлеры и changelog.** Коммит `fcee724`: `Issue: #180`, `User-Visible: yes`; `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в этом же коммите, формулировки соответствуют факту диффа (color-only поля не получают alpha, Default/Inherited не меняются).
- **Терминология.** `docs/USER-GUIDE.md`/`.ru.md` обновлены в терминах, которые уже использовались для #57 (тот же picker, Default/Inherited), новых терминов не введено.
- **Waived Low из ревью ТЗ.** Автор сдержал обещание из хендоффа: мёртвый CSS-селектор `.colorrow input[type='color']` удалён вместе с последним native input (`src/styles.ts`), подтверждено диффом.
- **Инфраструктурные правки (golden matrix/harness, smoke).** Прочитаны построчно: `demo/golden/harness.mjs` добавляет три новых `dialog` case, каждый ищет конкретный `hp-color-opacity` по `.label` и клика по `.trigger` — соответствует существующему паттерну `decor-color`. `GOLDEN_MATRIX_VERSION` инкрементирован (28→29) вместе с добавлением новых сценариев — обязательное правило `demo/golden/README.md` выполнено.

## Чего не проверял

- **`golden:verify` (полный прогон, включая существующие baseline-сравнения).** Не прогонял: для трёх новых сценариев эталонов нет по дизайну (`missing-baseline` — ожидаемый результат до `golden:accept --reviewed` на Linux CI), а полный набор — pre-beta гейт (PROCESS.md §8). Точечно прочитал изменённый `src/styles.ts` и убедился, что тронутое правило (`.gsrow > hp-color-opacity`) не пересекается с селекторами существующих golden-сценариев (`.editor-secondary hp-color-opacity` у decor); остаётся вероятность более отдалённого регресса, который увидит только полный pre-beta прогон.
- **`python -m pytest tests_backend -q`.** Не запускал — диапазон не касается `custom_components/**/*.py`.
- **Performance-профили.** Не запускал — ни AC, ни diff не называют performance-чувствительный путь.
- **Остальные 125 browser-смоков.** Не прогонялись — диапазон касается только color-picker consumers; смоки других поверхностей (стены, солнце, canvas и т.д.) не пересекаются с диффом.
- **Touch/pointer-специфичное поведение новых call sites (реальное multi-touch, а не эмулированное `pointercancel` в существующем `smoke_color_picker.mjs`).** Компонент не менялся логически, эмулированный прогон на decor-сайте пройден; отдельный touch-смок для новых пяти call sites не заводился ни автором, ни мной.
- **Полная accessible-name проверка (screen reader) для новых 15 полей** — проверено только через `aria-label`/`aria-expanded` в смоках и структурное чтение шаблонов; полноценного aXe-прогона не было (вне обычного объёма гейтов ревью).

## Рекомендация

Вернуть в `S6-in-progress`. Минимально необходимая правка — дать `.label` внутри `hp-color-opacity`, либо соседним `.opl`, возможность переноса/сжатия в контексте `.colorrow` (например, `min-width: 0` на flex-элементах строки и отказ от `white-space: nowrap` там, где рядом есть второй текстовый label), и подтвердить фактическим `golden:capture` для `device-ripple-color-popover-mobile-ru` перед повторным ревью — то есть выполнить собственный пункт §13 ТЗ, который в этом цикле был заявлен, но не исполнен до код-ревью.
