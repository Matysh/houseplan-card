# CODE-REVIEW-372-r1

Issue: [#372](https://github.com/Matysh/houseplan-card/issues/372) — «Компактное
верхнее кадрирование `houseplan-space-card` без заголовка»
Этап: code (PROCESS.md §2.7) · заход r1 · блокирующих циклов израсходовано 0 из 4
SHA материала ревью: `2bb7dfca5fa744a25f3af4d70260e2c41c42611f` (ветка
`issue/372-space-card-empty-title`, `git rev-parse HEAD` перепроверен в конце разбора)
Диапазон: `origin/dev..HEAD`, коммиты `d696541a`…`2bb7dfca` (spec → spec-review →
`feat` → `docs: accept screenshots` → `test`)
Трек: полный (аналитика назвала непройденный критерий `small`)

## Скоуп ревью

Первый заход по коду — предыдущего вердикта код-ревью нет, разбор полный.
Проверено: соответствие реализации ТЗ `docs/specs/372-space-card-empty-title.md`
и его 8 AC, `docs/SCOPE.md` (J1), `docs/USER-GUIDE.ru.md` (терминология
`title`), канонический `docs/CANVAS.md` §4/§4.1/§4.2/§6 (контракт content
frame / icon unit, который расширяет эта задача), трейлеры и release-артефакты
всех 5 коммитов диапазона.

## Как проверялось

1. Прочитаны issue #372 целиком (описание + 2 комментария аналитики/решения
   владельца), ТЗ, `SPEC-REVIEW-372-r1.md` (зелёный вердикт), `docs/SCOPE.md`,
   `AGENTS.md`, `PROCESS.md` §2, §4, §7, §8, `docs/USER-GUIDE.ru.md` §18,
   `docs/CANVAS.md` §4/§4.1/§4.2/§6.
2. Полный `git diff origin/dev...HEAD` прочитан построчно: `src/space-card.ts`,
   `src/space-geometry.ts`, `src/space-render.ts`, `test/canvas.test.mjs`,
   `demo/smoke_space_card.mjs`, оба changelog, оба user-guide, `dist/**` и
   зеркала класса D.
3. Прочитан весь `render()` в `src/space-card.ts:763-840` — порядок вычисления
   `title`/`compactTopFrame` и порядок DOM (title → body/stage → footer)
   сверены с контрактом ТЗ п.9 и разделом UX.
4. Прочитан `padRect`/`contentFrame`/`spaceFrame` целиком
   (`src/space-geometry.ts:338-446`): per-edge `FramePad` применяется
   одинаково в ветке `core`, в ветке `all` и в ветке `sane.length < MIN_VOTERS`;
   ветка stored-`view_box`-fallback (когда `f.core === null`) паддинг не
   применяет вовсе — контракт ТЗ п.6 подтверждён чтением, а не только словами
   автора.
5. Прочитан `iconUnit`/`iconCqw` (`src/space-geometry.ts:474-517`): масштаб
   иконок считается через собственный `contentFrame(items, {pad:0}).core` и
   делится на ширину (`vb[2]`), высоты `compactTopFrame` не касается —
   независимость иконок от компакт-режима подтверждена чтением.
6. Прочитан `src/space-render.ts:270-620`: единственный `vb` вычисляется один
   раз (строка 279 диапазона) и переиспользуется для `viewBox`, процентных
   координат маркеров/labels, `aspect-ratio` и `--icon-size` devlayer — SVG,
   devlayer и backdrop используют один и тот же compact `viewBox` (контракт
   п.8, «одно число — один источник» подтверждено чтением).
7. Проверены все 5 коммитов диапазона `git show -s --format=full` — трейлеры
   `Issue: #372` и `User-Visible: yes|no` корректны на каждом; единственный
   `User-Visible: yes` (`3c733c39`) несёт правки в оба changelog и оба
   user-guide в этом же коммите.
8. `gh run list` для workflow «Скриминот документации»: успешный
   `workflow_dispatch`-прогон в `10:22:06Z` предшествует коммиту `27a90dfd`
   (`10:24:33Z`) — приёмка скриншотов прошла через канонический workflow, а не
   локальным захватом.
9. `gh run list` для workflow «Проверка (CI)» на ветке задачи: прогон на точном
   SHA `2bb7dfca` в статусе `in_progress` на момент ревью — зелёного Validate
   ещё нет, гейты ниже прогнаны мной лично.

## Гейты — что прогнано и с каким результатом

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | `# tests 1544 · pass 1543 · fail 0 · skipped 1` (skip — известный, не из этой задачи) |
| build + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | `MATCH`; `git status --porcelain` после сборки пуст — закоммиченный `dist/**` побайтово совпадает со свежей сборкой |
| bundle sync/budget | `npm run bundle:sync && npm run bundle:budget` | синхронизировано; `initial View: 273864 B gzip` (бюджет 300000, запас 26136) |
| docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | `Новых any нет` (30 добавленных строк в 3 файлах проверено) |
| выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 1 прямое совпадение (`smoke_legacy_geometry.mjs` ← `spaceModels`), 19 слабых связей (все — один общий символ `_config`, полные/редакторские смоки, к кадрированию static space card отношения не имеющие) |
| смок из AC | `node demo/smoke_space_card.mjs` | **OK**, см. числа ниже |
| смок прямого совпадения | `node demo/smoke_legacy_geometry.mjs` | `OK`, `parity: true` |
| проверка «тест умеет падать» | временный откат `compactTopFrame: this._config.title === ''` → `compactTopFrame: false`, пересборка, повтор смока, затем `git checkout -- src/space-card.ts` | смок дал `FAIL space-card smoke`, `exit=1`; после отката рабочее дерево снова чистое (`git status --porcelain` пуст), смок снова `OK` |

Числа из живого браузерного прогона `demo/smoke_space_card.mjs` (AC1–AC4):

```
compactHasTitle: false, compactTopGap: 0
frame:               {x:-50, y:50,  w:1100, h:900}
namedFrame:           {x:-50, y:50,  w:1100, h:900}   (== frame, AC3)
compactFrame:         {x:-50, y:100, w:1100, h:850}
compactNoButtonFrame: {x:-50, y:100, w:1100, h:850}   (== compactFrame, AC4)
compactWidths: [320, 640]; compactOverflow: false
compactThemes: [false, true]
```

`x` и `w` не меняются между `frame` и `compactFrame` (левый/правый край
padding сохранён), `y+h` совпадает (950 = 950, нижний край сохранён), `y`
сдвинут ровно на удалённый верхний паддинг (50 → 100 при уменьшении `h` с 900
до 850) — то есть AC2 доказан не только unit-тестом на синтетической
fixture, но и настоящим browser DOM/SVG прогоном на demo-фикстуре.

### Не прогнано и почему

- **Полный browser smoke (202 файла) и `golden`** — предрелизный гейт
  (PROCESS.md §8), не гейт код-ревью. `golden` дополнительно нерелевантен по
  содержанию: `grep -rli "space-card\|space_card" demo/golden/` не находит ни
  одного упоминания — `houseplan-space-card` не входит в golden-матрицу
  вообще, значит `golden:verify` не покрыл бы этот диф ни при каком прогоне.
- **19 «слабых связей»** из вывода `smoke-select` (все — единственный общий
  символ `_config`, используемый в любом смоке, где карточка вообще
  конфигурируется: `smoke_color_picker`, `smoke_kiosk`,
  `smoke_multiwall_junction` и т. п. — полные/редакторские сценарии, не
  использующие `spaceFrame`/`space-render.ts`). Просмотрены по именам и
  назначению, ни один не имеет отношения к static space card или к
  `padRect`; не прогонялись.
- **`node scripts/model-invariants.mjs`** — диф не трогает геометрию модели
  или ссылки на неё (рёбра комнат, `layout`, `marker.space`, `open_spans`,
  записи толщины стен): изменение затрагивает только рендер-тайм вычисление
  `viewBox`/frame, что подтверждено чтением всего дифа `space-geometry.ts`
  (новый код — только `padRect`/`FramePad`, ни один вызов не модифицирует
  хранимую модель). Инварианты не запускались как нерелевантные.
- **`python -m pytest tests_backend`** — Python не тронут (`custom_components/**`
  в дифе есть только как класс D, сгенерированный бандл).
- **performance-профили** — не названы в AC, влияние на производительность
  не заявлено и неправдоподобно (одна дополнительная ветка `typeof pad ===
  'number'` в чистой функции, вызываемой раз на рендер, как и раньше).
- **`test/single-source-numbers.test.mjs`** отдельно не запускался вне общего
  `npm test` (он уже входит в набор и прошёл в нём) — диф не добавляет новую
  пользовательскую величину с единицей измерения, поэтому смысловая часть
  «одно число — один источник» здесь неприменима: единственное «число,
  видимое дважды» — сам frame (`viewBox`), и он проверен как раз тем, что все
  потребители (`svg`, проценты меток, `aspect-ratio`, `--icon-size`) читают
  один и тот же `vb` (см. «Как проверялось», п.6).
- **Зелёный CI Validate на точном SHA** — прогон идёт (`in_progress` на
  момент ревью), гейты выше прогнаны мной лично взамен.

## Проверка AC

| AC | Доказательство | Вердикт |
|---|---|---|
| AC1 (компактность при `title:""`) | browser smoke: `compactHasTitle:false`, `compactTopGap:0`; проверено, что тест умеет падать (см. таблицу гейтов) | доказан |
| AC2 (меняется только верх frame) | unit-тест `test/canvas.test.mjs` («per-edge frame padding can remove only the top inset») + browser smoke (`compactFrame` vs `frame`: тот же `x`/`w`, тот же `y+h`, `y` сдвинут на удалённый top-pad) | доказан |
| AC3 (omitted/non-empty совместимы) | browser smoke: `omittedTitle:"Ground floor"`, `namedTitle:"Named floor"`, `frame === namedFrame` побайтово | доказан |
| AC4 (SVG/devlayer/footer в одном frame, `show_button` не влияет) | чтение `space-render.ts` (один `vb` на все слои) + browser smoke `compactFrame === compactNoButtonFrame` | доказан |
| AC5 (edge cases без NaN/Infinity, voting не меняется) | новый unit-тест «per-edge padding keeps frame fallback and degenerate protection» (stored-`view_box` fallback и вырожденная точка) + весь существующий пакет `canvas.test.mjs`/`space-geometry` зелёный (1543/1543) | доказан |
| AC6 (desktop/touch width, light/dark, inert) | browser smoke на 320px/640px, `darkMode:false/true`, `compactOverflow:false`; `pointer-events:none` — общий CSS-класс `.hp-static-stage`, не зависящий от режима title (проверено чтением) | доказан по коду + смоком; полный Linux smoke/golden — предрелизный гейт, не здесь |
| AC7 (документация) | `docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.md`/`.ru.md` — правки прочитаны, ссылка на #372 на месте, различие omitted/non-empty/explicit-empty описано в обоих гайдах | доказан |
| AC8 (сборка и бюджет) | таблица гейтов выше (`tsc`, `test`, `build`+`cmp`, `bundle:budget`, `check-docs`, `no-new-any`) | доказан |

## Проверка по SCOPE.md

Задача остаётся в компактном read-only варианте J1: `houseplan-space-card` —
View-поверхность, интерактивность не меняется (`pointer-events:none` на
`.hp-static-stage` сохранён и не зависит от режима заголовка). Лок-инвариант
не затронут. Соответствует.

## Проверка скоупа и не-скоупа

- Полная `houseplan-card` не затронута: `spaceFrame` в `src/houseplan-card.ts`
  вызывается без переопределения `pad` (числовой дефолт `0.05` остаётся типом
  `FramePad`), подтверждено побайтовым совпадением пересобранного `dist/**` с
  закоммиченным и зелёным полным набором unit-тестов, включая тесты полной
  карточки/wall-geometry, не относящиеся к этой задаче.
- Боковой/нижний padding static-карточки не removed — доказано и unit-тестом,
  и browser-smoke (см. AC2).
- Новых UI-контролов, i18n-ключей, миграций конфигурации нет — подтверждено
  чтением дифа (только `src/space-card.ts`, `src/space-geometry.ts`,
  `src/space-render.ts`, тесты и документация).
- `spaceFrame` для других потребителей не изменена по поведению (только
  расширен тип параметра `pad`) — не-скоуп соблюдён.

## Находки

Нет находок уровня High или Medium — ни в скоупе, ни вне скоупа.

Low (не требует правки, фиксирую с записью): `FramePadding` экспортирован из
`src/space-geometry.ts`, но нигде не импортируется — `space-render.ts`
передаёт литерал объекта, полагаясь на структурную типизацию TypeScript.
Мёртвый публичный экспорт, не влияет на бандл (типы стираются на этапе
сборки) и не нарушает ни один AC; ТЗ прямо разрешает автору свободу в
«имени pure helper и точном месте per-edge арифметики» (раздел «Принято
предположительно»). Не считаю нужным возвращать на правку.

## Что проверено и корректно

- Реализация 1:1 соответствует контракту поведения ТЗ (все 9 пунктов),
  включая независимость масштаба иконок от `compactTopFrame` и общий `vb` для
  всех слоёв сцены.
- Все 8 AC доказаны — либо автотестом, для которого проверено умение падать
  (browser smoke, целенаправленный откат кода), либо unit-тестом с
  осмысленными числовыми ассертами (не тавтологичными), либо чтением кода с
  прямой пометкой «доказан по коду».
- DOM-порядок (title → body/stage → footer) не изменился.
- Трейлеры и release-артефакты во всех 5 коммитах диапазона корректны;
  `User-Visible: yes` несёт правки в оба changelog и оба user-guide в одном
  коммите с поведением.
- Приёмка скриншотов документации прошла через канонический workflow
  «Скриншоты документации» (проверено по времени прогона в `gh run list`), а
  не локальным захватом.
- Гейты `typecheck`/`test`/`build`/`bundle:budget`/`check-docs`/`no-new-any`
  зелёные, бандл трёх копий синхронизирован и побайтово совпадает со свежей
  сборкой.

## Чего не проверял

- Полный browser smoke (202 файла) и `golden:verify` — предрелизный гейт;
  `golden` дополнительно не покрывает `houseplan-space-card` (см. таблицу).
- 19 «слабых связей» из `smoke-select` — просмотрены по именам/назначению, не
  прогонялись (общий символ `_config`, не геометрия static-карточки).
- `model-invariants.mjs` — диф не касается модели/геометрии, только render-time
  frame.
- Backend/Python — не тронут.
- Performance-профили — не заявлены и неправдоподобны для этого дифа.
- Зелёный CI Validate на точном SHA `2bb7dfca` — прогон был `in_progress` на
  момент ревью; гейты выполнены мной лично вместо ожидания.

## Вердикт

Зелёный. Все 8 AC доказаны автотестами (с подтверждённым умением падать) и/или
прямым чтением кода; реализация точно соответствует контракту ТЗ и не выходит
за его скоуп; дешёвые и относящиеся к дифу гейты прогнаны лично и зелёные;
трейлеры и release-артефакты корректны. Находок уровня High/Medium нет; одна
Low-находка (мёртвый экспорт типа) снята с записью, без возврата на правку.
