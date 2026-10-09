# CODE-REVIEW-688-r1

Материал ревью: `c04d0778ae63de6f2585c89301b5021560959591` (единственный коммит
на ветке, `origin/dev..HEAD`). Working copy уже стоит на этом SHA.
Заход r1, блокирующих циклов израсходовано 0 из 4.

## Скоуп

Issue #688: заменить экранную (фиксированный px, `vector-effect:
non-scaling-stroke`) толщину линий лестницы на единый физический контракт
3,6 см — по аналогии с мебелью (#361) — во всех поверхностях (View, Plan
editor, draft/preview, статический слой/2.5D, PDF), без нового
persisted-поля.

Изменённые файлы (`git diff origin/dev...HEAD --stat`):

```
docs/CHANGELOG.md         |  6 ++++++
docs/CHANGELOG.ru.md      |  6 ++++++
docs/STAIRS.md            |  8 ++++++++
src/pdf/pdf-scene.ts      | 11 ++++++-----
src/space-render.ts       |  2 +-
src/stairs-editor.ts      |  4 +++-
src/stairs-view.ts        |  5 ++++-
src/stairs.ts             | 30 +++++++++++++++++++++++++++++-
src/styles/plan.styles.ts | 13 ++++++-------
test/pdf-scene.test.mjs   | 14 +++++++++++---
test/stairs.test.mjs      | 35 +++++++++++++++++++++++++++++++++++
```

Один продуктовый коммит, трейлеры `Issue: #688` / `User-Visible: yes`
корректны; оба changelog обновлены в этом же коммите (§14 ТЗ, §3 п.10
PROCESS.md). Track — `small` (спецификация в теле issue, `## ТЗ`).

## Как проверялось

Дешёвый набор подтверждён зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/36419255223) и
дополнительно перепрогнан мной для доказательности AC (см. таблицу):

| Гейт | Прогнан | Результат |
|---|---|---|
| `tsc --noEmit` + `rollup` (`npm run bundle:sync`) | да | success, `dist`/`demo/srv/assets` пересобраны свежими |
| `npm test` (полный набор, 3212 тестов) | да | 3211 pass / 0 fail / 1 skip, 45 с |
| `node scripts/check-docs.mjs` | да | падает на **предсуществующей** записи `screenshot source fingerprint is stale (#479)`; воспроизводится и на `origin/dev` без единого изменения (проверено `git stash` — рабочая копия была чиста, стеш был пуст), к этой задаче не относится |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | да | 22 прямых совпадения; выбрал `demo/smoke_stairs.mjs` как прямое совпадение по стаирс-модулю |
| `node demo/smoke_stairs.mjs` | да | все 60+ проверок `true`, `OK` |
| `npm run golden:verify` (после `bundle:sync`) | да | 4 сцены `different`: `stairs-flat-normal-light`, `stairs-flat-hover-dark`, `stairs-flat-selected-light`, `stairs-isometric-dark` — см. раздел ниже; остальные ~60 сцен `passed` |
| Мутация `STAIR_STROKE_CM` 3.6→4.0 | да | новый unit-тест AC1/AC4 краснеет (1 fail из 19 в `stairs.test.mjs`), остальное зелёное |
| Мутация CSS (вернул `calc(2px / --hp-plan-screen-scale)` в `.hp-stair-trapezoid/.tread/.arrow`) | да | новый CSS-контрактный тест краснеет (1 fail из 19) |
| `python -m pytest tests_backend` | нет | дифф не трогает `custom_components/**/*.py` |
| `npm run invariants` | нет | дифф не меняет геометрию (см. AC9 ниже): функции `stairOutline`/`stairRenderGeometry`/`stairFootprintGeometry`/`stairIntervalCount` не тронуты, изменения — только толщина обводки |
| Performance-профили | нет | не названы в AC; AC9 закрыт ревью кода (см. ниже) |

Обе мутации подтверждают дисциплину «тест умеет падать» для двух новых
тестов; после мутаций файлы восстановлены (`cp` из бэкапа), рабочая копия
чиста (`git status --short -- src/ test/ docs/` — пусто).

## AC — доказательства

| AC | Как доказан | Вердикт |
|---|---|---|
| AC1 единое физическое значение | unit-тест `stairStrokeUnits`/`stairStyleVars` + CSS-блок-тест (нет отдельного `.hp-stair-arrow{stroke-width}`); мутация STAIR_STROKE_CM и мутация CSS обе красят целевые тесты | доказано автотестом, тест умеет падать |
| AC2 физический zoom | нет прямого browser/golden-теста с 2 zoom-уровнями и oracle (см. «Не проверял» ниже); доказано чтением: камера плана масштабирует через `viewBox` (`houseplan-card.ts` `_view`), а `.hp-stair-outline/.trapezoid/.tread/.arrow` больше не имеют `vector-effect: non-scaling-stroke` и берут `stroke-width` в plan-unit'ах (`var(--hp-stair-stroke)` = `(3.6/cellCm)*gridPitch`) — то есть толщина обязана масштабироваться вместе с геометрией по построению SVG, а не компенсироваться | проверено чтением, не исполнением |
| AC3 независимость от габаритов/поворота | проверено чтением: `stairRenderGeometry`/`worldPoint`/`rotate` (`src/stairs.ts:247-315`) вычисляют повёрнутые точки контура/трапеции/ступеней/стрелки напрямую в мировых координатах — на `<g class="hp-stair">` нет `transform=`, значит нет локального неравномерного transform, который штрих мог бы исказить; golden-диффы (ниже) визуально подтверждают отсутствие анизотропии на повёрнутой прямой лестнице и на спиральной | проверено чтением + golden-наблюдение |
| AC4 разные cell_cm | unit-тест `stairStrokeUnits(5)===3`, `stairStrokeUnits(1)≈15`, `stairStrokeUnits(5,10)≈7.2` — покрывает формулу `(3.6/cell)*pitch` для разных `cell_cm` и `gridPitch` | доказано автотестом |
| AC5 паритет поверхностей | один источник (`stairStyleVars`) вызывается из всех 3 живых поверхностей (`space-render.ts` статика/2.5D, `stairs-editor.ts` Plan/draft — draft делит код с обычным рендером через общий `renderStair`, `stairs-view.ts` View) плюс PDF отдельно через `stairStrokePrintMm`; golden `stairs-flat-normal-light/hover-dark/selected-light/isometric-dark` показывают, что разница ограничена именно линиями лестницы (см. ниже), без побочных искажений соседней геометрии | golden-наблюдение + ревью DOM/CSS |
| AC6 PDF | unit-тест `stairStrokePrintMm(50)=0.72`, `stairStrokePrintMm(100)=0.36` (2 масштаба) доказывает формулу; тест PDF-сцены доказывает применение к outline/trapezoid/tread/arrow, но только для **прямой** лестницы на одном (текущем) масштабе страницы — для **спиральной** лестницы ширина команд явно не проверяется отдельным assert (см. находку Low ниже); чтение кода `pdf-scene.ts` подтверждает, что `stairStroke` — одна переменная, применяемая в цикле без ветвления по `stair.kind` | доказано автотестом (частично) + чтением |
| AC7 конфиг не меняется | `Stair`/`StraightStair`/`SpiralStair` в `src/stairs.ts` не получили нового поля; тест проверяет `Object.hasOwn(straight(), 'width_cm') === false`; полный набор существующих stair round-trip/model тестов зелёный | доказано автотестом |
| AC8 соседние сценарии | весь существующий `test/stairs.test.mjs` зелёный (45/45 после моих мутаций-и-восстановления); `demo/smoke_stairs.mjs` зелёный полностью (магнит, drag/resize/rotate, направление, hit-area, target floor, focus, iso) | доказано автотестом и browser-смоуком |
| AC9 производительность | чтением: изменения — новая функция O(1) (`stairStrokeUnits`) и одна конкатенация строки в `stairStyleVars`; в цикле рендера/PDF нет новых обходов по числу ступеней, новых SVG-узлов не добавлено | проверено чтением, не исполнением |

## Golden — 4 «different», разобраны как ожидаемые

`npm run golden:verify` (после `npm run bundle:sync`, чтобы `demo/srv/assets`
отражал текущий код) даёт `different` ровно для четырёх stairs-сцен,
описанных в `demo/golden/matrix.mjs` (#663 AC3/AC10/AC12). Я визуально
сравнил baseline/actual/diff для всех четырёх:

- `stairs-flat-normal-light`, `stairs-flat-hover-dark`,
  `stairs-flat-selected-light` (View/Plan, прямая и спиральная лестница,
  hover/selected состояния), `stairs-isometric-dark` (2.5D).
- Diff-маска (пурпур) в каждой картинке ограничена исключительно линиями
  символа лестницы (контур/трапеция/ступени/стрелка); стены, комнаты,
  диммер, панель настроек и прочая геометрия не задеты.
- Линии стали физически толще и остаются равномерными по всем осям —
  включая повёрнутую на 45° прямую лестницу и спиральную — то есть
  ожидаемый эффект задачи, а не искажение или регрессия.

Baseline-файлы **не обновлены в этом коммите** — и это правильно: обычный
task-коммит не имеет права трогать `demo/golden/baselines/**` (класс D,
только релизный коммит с `Release:`+`Baseline-Reviewed*`, PROCESS.md §10.1),
а собственный план автотестов задачи (§11 ТЗ) прямо откладывает
пересъёмку golden на предрелизный процесс перед бетой. Это не находка —
но пересъёмка этих четырёх сцен и `Release:`-коммит с трейлером
`Baseline-Reviewed*` остаются обязательным пунктом перед следующей бетой;
называю это явно, чтобы не потерялось.

## Находки

### Low — AC6 не покрывает спиральную лестницу и второй масштаб печати на уровне PDF-сцены

`test/pdf-scene.test.mjs`, тест `#683/#688 PDF keeps stair styling
monochrome and one physical line weight` (строки ~199-227) проверяет
ширину PDF-команд только для лестницы `kind: 'straight'` и только на одном
(текущем автоматическом) масштабе страницы. Требование AC6 ("Доказательство:
unit-тест PDF scene commands для **обоих типов** и **минимум двух**
масштабов печати") формально не закрыто этим тестом: спиральная лестница
проверяется только в другом, более старом тесте (`#663 ...`), который не
сверяет числовую ширину команд вовсе. Отдельного assert на два разных
`scale` тоже нет — только `stairStrokePrintMm(50)`/`stairStrokePrintMm(100)`
на уровне чистой функции в `test/stairs.test.mjs`.

Снимаю без правки: чтением `src/pdf/pdf-scene.ts` (диф выше) подтверждено,
что `stairStroke` — одна переменная без ветвления по `stair.kind`,
применяемая в общем цикле `for (const stair of input.space.stairs)` ко всем
командам (`path`/`line`/`vector`) независимо от типа лестницы; поведение
корректно и без этого дополнительного assert. Не блокирует, эту задачу не
возвращаю — фиксирую как принятое с запиской, без отдельного issue (в
скоупе задачи, не самостоятельный дефект).

## Что проверено и корректно

- Единый физический контракт (`STAIR_STROKE_CM = 3.6`, `stairStrokeUnits`,
  `stairStrokePrintMm`) — один источник для CSS-поверхностей и PDF, без
  параллельных литералов (соответствует контракту мебели #361 и пункту 6
  контракта поведения ТЗ).
- CSS: `vector-effect: non-scaling-stroke` убран именно и только у базовых
  классов (`.hp-stair-outline`, `.hp-stair-trapezoid`, `.hp-stair-tread`,
  `.hp-stair-arrow`); hover/selected-акцент внешнего контура остался
  экранным (`non-scaling-stroke` + фиксированные px) — ровно то, что
  разрешает пункт 7 контракта.
- Персистентная модель `Stair`/`StraightStair`/`SpiralStair` не изменена;
  нет нового поля, нет миграции.
- `docs/STAIRS.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` обновлены
  в этом же коммите; термины совпадают с уже принятой формулировкой (та же
  фраза "3,6 см" уже была введена в `docs/STAIRS.md` в рамках этой же
  задачи — сверено, что это не рассинхрон, а описание того же контракта).
  `docs/USER-GUIDE.ru.md` не тронут и не должен быть: пользователю не видно
  ни нового поля, ни новой формулировки — только толщина линии (проверено
  `grep` — файл не упоминает конкретную толщину лестницы).
- Одно число — один источник: физическая толщина 3,6 см задана константой
  `STAIR_STROKE_CM` в `src/stairs.ts` и нигде не продублирована буквально;
  CSS и PDF читают её только через `stairStrokeUnits`/`stairStrokePrintMm`.

## Чего не проверял

- Не прогонял полную golden-матрицу (~90 сцен целиком) — ограничился
  результатом `golden:verify` (все не-stairs сцены `passed`) и ручным
  визуальным разбором 4 `different`; полное пересравнение с performance-
  и HA-гейтами — предрелизная обязанность, не гейт этого ревью.
- Не воспроизводил AC2 в реальном браузере на двух zoom-уровнях с
  измеримым oracle (голден/смоук для этого в задаче не добавлен и не
  запускался мной отдельно) — закрыл AC2 чтением кода камеры/CSS, отмечено
  в таблице выше как «проверено чтением, не исполнением».
- `python -m pytest tests_backend` не прогонял — диф не касается
  `custom_components/**/*.py`.
- `npm run invariants` не прогонял — диф не меняет геометрию лестницы ни в
  одной из геометрических функций (`stairOutline`, `stairRenderGeometry`,
  `stairFootprintGeometry`, `stairIntervalCount`), только толщину отрисовки.
- Не проверял `node scripts/check-docs.mjs` дальше факта, что его единственная
  ошибка (`#479`, screenshot fingerprint) предсуществует и к этой задаче не
  относится.

## Вердикт

Зелёный. AC1–AC9 доказаны (частично — чтением там, где явно указано); High
и Medium-находок нет. Единственная находка — Low, снята с запиской, не
требует правки в этой задаче. Пересъёмку 4 golden-сцен и `Release:`-коммит
с `Baseline-Reviewed*` явно фиксирую как обязательный пункт перед следующей
бетой (уже предусмотрено собственным §11 ТЗ автора, не новое требование).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/688-stair-physical-stroke`, коммит `c04d0778ae63` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `8263e941dc6449e6ed9633b22bc19efafa456246`
  ```
  git log --all --format='%H %T' | grep 8263e941dc64
  ```
- Тело issue: `ff3c781175c80e1cd6b25014945a3f818215e934a513905099262bcb8e5c25c6`
- Вердикт конвейера: `green` · High 0
