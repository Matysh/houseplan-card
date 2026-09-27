# CODE-REVIEW-360-r2

Issue: #360 «Основной default-цвет декора на главной панели»
Этап: код-ревью (PROCESS.md §2.7)
Заход: r2 · блокирующих циклов израсходовано 0 из 2 (§4: зелёный вердикт бюджет не тратит, #227)
SHA материала ревью: `ae6486de7a8b7eeb87dd313926c52c510fdd3545`
Диапазон: `git diff origin/dev...HEAD` (origin/dev = `e21f02b295dff30339906a7b57071bb4113d8cb3`, 0 позади / 5 впереди)

## Вердикт

**Зелёный.** High: 0, Medium: 0 (ни в скоупе, ни вне скоупа), Low: 0.

## Почему разбор полный, а не по дельте (PROCESS.md §2.10, §7.2)

Формально это второй заход код-ревью (`r1` уже дал зелёный вердикт на SHA
`f91b0ff5`, документ `docs/reviews/CODE-REVIEW-360-r1.md`), но между `r1` и
этим заходом ветка **дважды не сливалась без конфликта** и **дважды
ребейзилась**: сперва на `a041934b` (после чего вершина стала `f91b0ff5`),
затем — после того как в `dev` вошёл #369 (`8ee1c91f`, `2c984d8f`) — на
`e21f02b2` (вершина стала `ae6486de`). Второй ребейз принёс в `dev` новый
инвариант `_decorPointerDown` («только основная кнопка мыши двигает
объекты», #369(e)) — это ровно тот случай из §2.10/§7.2 «ребейз на ушедший
вперёд `dev` — после ребейза это другой код», когда сокращение объёма до
чистой дельты не допускается. Поэтому ниже — полный разбор AC1–AC8 и полный
прогон гейтов на точном SHA `ae6486de`, а не только точка, которую тронул
ребейз.

При этом сам разбор показал, что дельта **фактически** локальна: единственный
продуктовый файл `src/houseplan-editor-runtime.ts` побайтово идентичен между
проверенным в `r1` `f91b0ff5` и текущим `ae6486de` (сверено `git diff
origin/dev...HEAD -- src/houseplan-editor-runtime.ts` — блок `+9` строк в
`_renderDecorBar` тот же, что цитирует `CODE-REVIEW-360-r1.md`). Всё, что
изменилось после `r1`, — один коммит `ae6486de` (тест-only, 1 строка) плюс
служебные последствия ребейза (пересборка бандлов, повторная съёмка
скриншотов, документ `r1` в `docs/reviews/`).

## Закрытие раунда r1

`r1` (SHA `f91b0ff5`) был зелёным без находок — таблица «находка → закрытие»
пуста по построению. Единственное, что требует внимания в `r2`, — не
находка `r1`, а последствие двух последующих ребейзов:

| Что изменилось после r1 | Чем закрыто | Где видно |
|---|---|---|
| Слияние `r1` отменено предохранителем #312 (вершина ветки после `golden:accept` разошлась с проверенным `f91b0ff5`) | Автор подтвердил и показал, что разница после `f91b0ff5` — только штатное принятие 10 golden-эталонов из полного Linux CI (commit `577e654e`, класс D, `Release`+`Baseline-Reviewed` на месте) | Комментарии issue 08:44–08:45Z; `git show --stat 577e654e` — только `demo/golden/baselines/**` |
| Конфликт ребейза на `dev` (дважды, из-за class D путей и `docs/images/**`) | Оба раза — авторский `git rebase origin/dev` + разрешение конфликта в пользу продукта #360 поверх новых генераций; заявлено «продуктовый код после f91b0ff5 не менялся» | Комментарии 08:30Z и 08:55Z; проверено этим ревью — диф `src/houseplan-editor-runtime.ts` идентичен |
| `dev` получил #369(e): «только основная кнопка мыши» в `_decorPointerDown` | `demo/smoke_decor.mjs` получил явный `button: 0` в синтетическом `PointerEvent` для text-инструмента (коммит `ae6486de`) | `git show ae6486de` — 1 строка; перепроверено этим ревью (см. «тест умеет падать» ниже) |

## Унаследовано из r1

Из `docs/reviews/CODE-REVIEW-360-r1.md` (SHA `f91b0ff5`) без повторного
самостоятельного анализа архитектуры контракта принято:

- контракт «один постоянный `hp-color-opacity` в `_renderDecorBar`, без
  условия по `_decorTool`» и его противопоставление условному контекстному
  picker'у в `_renderDecorSecondary` — код не менялся, перечитан заново в
  этом заходе и подтверждён тем же;
- разбор AC4 (событие `hp-color-opacity-change` несёт только `color`/`opacity`,
  `fillColor`/`fillOpacity` не затрагиваются) — код обработчика не менялся;
- рассуждение о неотделимости этого выбора от требования ТЗ «не хрупкий
  общий счётчик call sites» для `test/color-picker.test.mjs` — сверено, что
  сам текст теста в этом заходе не менялся относительно того, что описал `r1`.

Не наследовано, перепроверено заново в этом заходе (потому что либо файл
менялся после `r1`, либо это требование самого §2.10 при неполной дельте):
все гейты (`typecheck`/`test`/`build`/`check-docs`/`no-new-any`/`bundle:budget`),
все три прямых смока, дисциплина «тест умеет падать» для новой строки
`ae6486de`, целостность трейлеров и changelog по всем 5 коммитам диапазона,
уникальность `decor-default-color` в собранном бандле.

## Скоуп диффа

5 коммитов `origin/dev...HEAD`, все с `Issue: #360`:

| Коммит | Класс | User-Visible | Содержание |
|---|---|---|---|
| `822c8000` feat: expose decor default color in main toolbar | A+B+C+D | yes | продуктовый код (+9 строк), `test/color-picker.test.mjs`, `demo/smoke_decor.mjs`, `docs/DECOR-EDITOR.md`, `docs/USER-GUIDE.ru.md`, оба changelog, синхронные бандлы, один экран документации |
| `577e654e` test: accept decor default color golden frames | D | no | только `demo/golden/baselines/**`; `Release: v1.69.0-beta.3` + `Baseline-Reviewed: …/33243321606` на месте |
| `1f032d51` docs: review document for #360 | C | no | публикация `docs/reviews/CODE-REVIEW-360-r1.md` |
| `7daaae72` docs: accept background picker screenshots | C | no | `docs/images/*.png` + `screenshots.json` (переснято канонической workflow из-за смены `sourceFingerprint`) |
| `ae6486de` test: model primary decor pointer explicitly | B | no | 1 строка в `demo/smoke_decor.mjs` — явный `button: 0` |

Диффу соответствует ровно одна цель ТЗ: сделать существующий session-default
`_decorStyle.color`/`_decorStyle.opacity` видимым и управляемым с основной
панели редактора подложки при любом инструменте, ничего больше не меняя.
Заявленный не-скоуп ТЗ (заливка фигур, уже размещённые объекты, persisted
модель, i18n, touch-контракт, другие редакторы) не задет — подтверждено
построчным чтением диффа и списком изменённых файлов (`git diff --stat`):
i18n-файлы, `custom_components/**/*.py`, `manifest.json`/`hacs.json`,
геометрические поля (`layout`, `marker.space`, `open_spans`, рёбра) в дифф не
входят.

## Как проверялось

Зелёного Validate на `ae6486de` нет (не найден/не завершён), все гейты
прогнаны локально мной, на точном SHA:

| Гейт | Статус | Примечание |
|---|---|---|
| `npx tsc --noEmit` | 🟢 | без вывода |
| `npm test` | 🟢 | 1538 тестов: 1537 passed / 1 skipped / 0 failed |
| `npm run build` | 🟢 | `git status` после сборки чист — `dist/**` побайтово совпадает с закоммиченным |
| `npm run bundle:sync` | 🟢 | `custom_components/houseplan/frontend/**` и `demo/srv/assets/**` синхронны, рабочее дерево чисто после |
| `node scripts/check-docs.mjs` | 🟢 | «Documentation checks passed (7 files, 10 external links)» — обязателен, diff трогает `src/**` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 🟢 | 9 добавленных строк в 1 файле, новых `any` нет |
| `npm run bundle:budget` | 🟢 | initial View 273697 B / budget 282000 B (headroom 8303 B) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выполнен | 3 «прямых совпадения» по символу `_decorStyle`: `smoke_decor.mjs`, `smoke_color_picker.mjs`, `smoke_furniture.mjs` — все три ниже прогнаны |
| `node demo/smoke_decor.mjs` | 🟢 | целевой смок ТЗ (план тестов, п.6); все новые проверки AC1–AC6 (`defaultStyleLivesInMainBarAndContextTray`, `defaultStyleVisibleForEveryDecorTool`, `mainPickerUpdatesOneSessionDefault`, `mainPickerLeavesExistingObjectsUntouched`, `contextPickerUpdatesMainPicker`, `everyNewDecorKindUsesMainDefault`, `mainDefaultDoesNotOverwriteShapeFill`, `objectDialogRefreshesMainDefault`, `narrowToolbarKeepsToolsAndCloseApart`, `narrowToolbarKeepsDefaultPickerUsable`, `defaultPickerReadableInLightAndDark`) — `true` |
| `node demo/smoke_color_picker.mjs` | 🟢 | прямое совпадение smoke-select |
| `node demo/smoke_furniture.mjs` | 🟢 | прямое совпадение smoke-select (мебель — потребитель `_decorStyle`) |
| `npm run golden:verify` | **не прогонялся** | см. обоснование ниже |
| `npm run invariants -- --config …` | **не прогонялся** | diff не трогает геометрию/`layout`/`marker.space`/`open_spans`/рёбра — единственный продуктовый файл правит только UI-toolbar |
| `python -m pytest tests_backend -q` | **не прогонялся** | `custom_components/**/*.py` не тронут |
| performance-профили | **не прогонялись** | не названы в AC; чувствительный к перфу код (рендер геометрии, маски) не тронут — добавлен один статический биндинг в toolbar |

### Обоснование пропуска `golden:verify`

Диф меняет видимый результат (10 golden-кадров редактора + 10 docs-скриншотов),
но локальный `golden:verify` не даёт здесь новой информации:

1. Единственный рендер-значимый продуктовый файл (`src/houseplan-editor-runtime.ts`)
   побайтово не менялся с момента, когда полный Linux CI (run `33243705008`,
   SHA `237e8d9f`) уже прогнал `golden:verify` **зелёным** по принятым
   эталонам того же изменения — это подтверждено выше построчным диффом.
2. Сами эталоны (`577e654e`) приняты штатно —
   `npm run golden:accept -- --reviewed` по полному Linux-артефакту, с
   `Release`/`Baseline-Reviewed`, не мной и не для «зелёного CI ради
   зелёного CI».
3. Docs-скриншоты (`7daaae72`) переснимал не автор локально, а канонический
   `Docs screenshots` (`workflow_dispatch`, run `33244132186`), что и требует
   §8; `check-docs.mjs` в этом заходе подтверждает: текущий `sourceFingerprint`
   совпадает с деревом.

Таким образом, локальный `golden:verify` по всей 143-кадровой матрице был бы
предрелizным гейтом (§8: «Полные наборы — предрелизный гейт, а не гейт
ревью»), не добавляющим доказательства к тому, что уже проверено CI на этом
самом рендер-коде.

### Дисциплина «тест умеет падать»

Для новой (после `r1`) строки `ae6486de` — единственного изменения, не
унаследованного от `r1`, — проверено практически: временно откатил `button: 0`
в синтетическом `PointerEvent` `demo/smoke_decor.mjs` (text-инструмент) —
`node demo/smoke_decor.mjs` упал: `FAILED (1): everyNewDecorKindUsesMainDefault:
expected true, got false` (без основной кнопки `_decorPointerDown` из #369(e)
возвращает `false` и текст не создаётся). Файл восстановлен
(`cp`/оригинал), `node demo/smoke_decor.mjs` вновь зелёный, `git status`
чист.

Для остального диффа (продуктовый код `_renderDecorBar`, основной массив
`smoke_decor.mjs`, `test/color-picker.test.mjs`) дисциплина уже доказана в
`CODE-REVIEW-360-r1.md` (временное изъятие блока `<hp-color-opacity
class="decor-default-color">` роняло и смок, и unit-тест) — код этих файлов
с `r1` не изменился, повторное разрушительное исполнение не добавляет
доказательства.

## Разбор по AC

- **AC1 (постоянная доступность).** `_renderDecorBar` (src/houseplan-editor-runtime.ts:5412)
  рендерит новый `hp-color-opacity.decor-default-color` безусловно (вне
  `_renderDecorSecondary`, где картинка контекстного picker'а зависит от
  `_decorTool`). В исходнике и в собранном бандле
  (`houseplan-editor-runtime-DpcuLOlh.js`) ровно одно вхождение класса
  `decor-default-color` (проверено `grep -c`). Смок `defaultStyleVisibleForEveryDecorTool`
  перебирает все 8 инструментов. **Доказано чтением + browser-смоком.**
- **AC2 (все новые типы).** Смок `everyNewDecorKindUsesMainDefault` создаёт
  line/rect/ellipse/text/furniture после смены default и сравнивает
  `color`/`opacity` каждого с новым значением. **Доказано смоком.**
- **AC3 (существующее неизменно).** `mainPickerLeavesExistingObjectsUntouched`
  сравнивает JSON контрольного объекта побайтово до/после смены default.
  **Доказано.**
- **AC4 (заливка независима).** `mainDefaultDoesNotOverwriteShapeFill`:
  `fill_color`/`fill_opacity` новых rect/ellipse остаются прежними. В коде
  обработчик пишет `{ ...this.host._decorStyle, ...e.detail }`, а `e.detail`
  из `hp-color-opacity-change` содержит только `color`/`opacity` (проверено
  чтением `src/hp-color-opacity.ts`, событие не несёт fill-полей).
  **Доказано кодом и смоком.**
- **AC5 (единый state).** `mainPickerUpdatesOneSessionDefault` (main→context),
  `contextPickerUpdatesMainPicker` (context→main), `objectDialogRefreshesMainDefault`
  (сохранение properties-диалога существующей линии обновляет main picker
  через уже существующий `_decorSaveShape`, диффом не изменённый). Оба
  picker'а читают один `this.host._decorStyle` — «одно число, один источник»
  выполнено конструктивно, а не two independent renders одного значения.
  **Доказано.**
- **AC6 (responsive/a11y).** `narrowToolbarKeepsToolsAndCloseApart` (560×820:
  инструменты и Undo/Redo не наезжают на закреплённый `.editbar-end`, все 8
  кнопок и close на месте), `narrowToolbarKeepsDefaultPickerUsable` (popover
  целиком в viewport), `defaultPickerReadableInLightAndDark` (trigger 40×40,
  `visibility: visible` в обеих темах) — все `true`. Golden/screenshot-ревью
  по AC6 — по решению самого ТЗ (план тестов, п.6, подтверждено зелёным
  SPEC-REVIEW-360-r2) предрелизный гейт; здесь дополнительно подтверждено,
  что полный CI уже прогнал его зелёным на этом же рендер-коде (см. выше).
  **Доказано смоком + чтением; golden — по плану ТЗ.**
- **AC7 (совместимость и гейты).** Новых persisted-полей и i18n-ключей нет
  (`git diff --name-only` не содержит `src/i18n/*.json` и
  `custom_components/**/translations/**`); `decor.color`/`space.opacity`
  переиспользованы, значения в `ru.json` («Цвет»/«Прозрачность») совпадают с
  текстом `USER-GUIDE.ru.md`. `_decorStyle` остаётся session-only полем.
  typecheck/test/build/bundle-budget/no-new-any зелёные. **Доказано чтением
  и гейтами.**
- **AC8 (документация).** `docs/DECOR-EDITOR.md` и `docs/USER-GUIDE.ru.md`
  описывают постоянный main-bar picker, его связь с контекстным и
  сохранение через properties-диалог; оба changelog правлены в том же
  коммите `822c8000`, что и продуктовый код, со ссылкой на #360.
  `check-docs.mjs` зелёный. **Доказано.**

## Что проверено и корректно

- Единственная точка изменения продуктового кода — 9 строк в
  `_renderDecorBar`, без второй модели цвета и без нативного
  `<input type="color">` (unit-тест на отсутствие таких input по всем
  `src/**` зелёный).
- «Одно число — один источник» выполнено конструктивно: main и context
  picker — два рендера одного и того же поля `_decorStyle`, не два разных
  вычисления одной величины.
- Провенанс всех 5 коммитов корректен: терминальные трейлеры `Issue: #360` +
  ровно один `User-Visible`, `Release`+`Baseline-Reviewed` на коммите класса D
  (`577e654e`), оба changelog — в том же коммите, что и продуктовый код.
- Бандлы (`dist/**`, `custom_components/houseplan/frontend/**`,
  `demo/srv/assets/**`) синхронны с исходником побайтово после чистой
  пересборки в этом заходе.
- Единственное послеревьюшное изменение (`ae6486de`) — механическая, точечная
  правка теста под независимо принятый инвариант #369(e), продуктовый код и
  контракт #360 не задевает; проверена на способность падать.

## Чего не проверял

- `npm run golden:verify` целиком — обоснование выше (рендер-код не менялся
  с зелёного полного CI-прогона на этом же коде; локальный прогон 143-кадровой
  матрицы не добавляет доказательства и является предрелизным гейтом).
- `npm run invariants` — diff не касается геометрии/`layout`/`marker.space`/
  `open_spans`/рёбер.
- `pytest tests_backend` — `custom_components/**/*.py` не менялся.
- Производительность — не названа в AC, чувствительный к перфу код не тронут.
- Ручное визуальное тестирование в браузере вне Playwright — не проводилось;
  вместо него — целевой и два смежных browser-смока плюс явная проверка
  «тест умеет падать» на живом бандле для единственной новой строки.

## Итог

Реализация дословно соответствует контракту ТЗ (`small`, revision 2, зелёное
SPEC-REVIEW-360-r2): один постоянный `hp-color-opacity` на главной панели,
без побочных изменений в персистентной модели, заливке фигур, существующих
объектах, i18n или touch/View-контракте. Оба предыдущих откатa слияния
(#312 и конфликт ребейза) не были содержательными циклами код-ревью — код
никто не читал, вердикт `r1` не аннулирован, а этот, второй, заход —
независимый полный разбор на итоговом, дважды ребейзнутом SHA, поскольку
дельта после `r1` не локальна по правилу §2.10/§7.2. Единственное
послеревьюшное изменение — однострочная тестовая адаптация к независимо
принятому #369(e), проверенная на способность падать. Все AC1–AC8 доказаны
браузерным смоком, unit-тестом или чтением кода. Оснований для Medium/High
нет.
