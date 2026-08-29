# CODE-REVIEW-376-r1

Issue: #376 — «Пачка Low из adversarial-аудита beta.4» (лёгкий трек, редакция 2)
Ветка: `issue/376-audit-lows-beta4`, база — актуальный `origin/dev`
Коммиты: `db7f0587` (fix, User-Visible: yes) + `dceaf2d8` (build: refresh bundle trees, User-Visible: no)
Заход: r1 · этап code · блокирующих циклов израсходовано 0 из 2 (лёгкий трек)

## 1. Скоуп

ТЗ (редакция 2, принята зелёным SPEC-REVIEW-376-r2) содержит пять точечных
правок; пункт (в) вынесен в #377 на полный трек и в этот код-ревью не входит:

- **(а)** `houseplan-space-card`: `title: null` (YAML `title:` без значения)
  получает тот же компактный кадр, что и `title: ''`.
- **(б)** USER-GUIDE(.ru), раздел «Редактор подложки»: зафиксировано, что
  маркеры устройств и подписи комнат не перехватывают указатель. Код не
  трогается — это осознанно существующее поведение.
- **(г)** `furnitureScreenScale` в labs-изометрии больше не применяет
  2D-формулу компенсации камеры; в iso — `1`, как у обычного декора.
- **(д)** `docs/TESTING.md:1704` — оговорка про `light_pools` opt-in (#374).
- **(е)** `space-card.ts`: dispose-гейт `light_pools` выровнен на `!== true`,
  зеркально строгому рендер-гейту `=== true`.

Диапазон разбора: `git log --oneline origin/dev..HEAD` (2 коммита),
`git diff origin/dev...HEAD` (40 файлов: 2 файла продукта класс A
(`src/houseplan-card.ts`, `src/space-card.ts`), тесты/скрипты класс B
(`demo/smoke_space_card.mjs`, `test/*.mjs`, `scripts/mutation-gate.mjs`),
документация класс C (`CHANGELOG*`, `USER-GUIDE*`, `TESTING.md`,
`docs/images/**`), сгенерированный бандл класс D (`dist/**`,
`custom_components/houseplan/frontend/**`)).

Первый заход код-ревью для этого issue — раздел «унаследовано» не нужен, все
пять пунктов разобраны заново по коду и по AC ТЗ rev2.

## 2. Как проверялось

### Построчная сверка кода против ТЗ и AC

- **AC-а** (`src/space-card.ts:826`): `compactTopFrame: this._config.title === '' || this._config.title === null` —
  дословно как в ТЗ. `title` для рендера заголовка (`:816`)
  `this._config.title !== undefined ? this._config.title : sp?.title || ''`
  — `null !== undefined`, так что `title = null`, и `${title ? … : nothing}`
  (:875) уже скрывал header для `null` до этой правки; правка меняет только
  кадр — согласуется с утверждением ТЗ «скрытие header уже работает».
  `undefined`-ветка (дефолтный заголовок) не тронута.
- **AC-б**: код `plan.styles.ts` не менялся (проверено — файла нет в диффе).
  Утверждение ТЗ и текста доков проверено по коду: `.stage.mode-decor
  .devlayer, .stage.mode-decor .devlayer *, .stage.mode-decor .dev::before`
  (`plan.styles.ts:863-865`) — `devlayer` действительно является родителем
  разметки room-label (`houseplan-card.ts:11069`, CSS-переменные
  `--rl-icon-size`/`--rl-font` заданы на том же `<div class="devlayer">`, что
  оборачивает и устройства, и лейблы), так что универсальный потомок `*`
  накрывает и лейблы. Формулировка в `USER-GUIDE.md:694-696` и
  `USER-GUIDE.ru.md:1242-1244` («device markers and room labels do not
  intercept the pointer» / «маркеры устройств и подписи комнат не
  перехватывают указатель») — не догадка, а точное описание существующего
  кода.
- **AC-г** (`src/houseplan-card.ts:8089`): `const furnitureScreenScale =
  this._renderProjection === 'iso' ? 1 : furniturePlanScreenScale(...)`.
  Прослежен весь путь потребления значения: единственный вызов
  `furniturePlanScreenScale(` во всём `_renderDecorLayer` (:8074-8209, тест
  `furniture-stroke-contract.test.mjs` считает вхождения — единственный
  источник для декор-слоя), проброс в `furnitureStrokePx(strokeWidth,
  furnitureScreenScale)` (:8157) и в `_renderFurniturePlacementPreview(
  furnitureScreenScale)` (:8209) — общий и превью, и сохранённые фигуры берут
  одно и то же число. `_renderDecorLayer()` вызывается безусловно (единственный
  сайт — `:10992`, гейт только `hideDecor`, не проекция), то есть декор,
  включая мебель, рендерится и в iso — значит правка реально исполняется в
  iso-режиме, а не мертвый код. `_renderWallBodies`/`_renderIsoWalls` (:8771,
  :8888) — гейты проекции на стены, к декору не относятся, не спутаны.
- **AC-д** (`docs/TESTING.md:1705`): `unless \`light_pools: true\` opts them
  in (#374)` — добавлено ровно к пункту про static room cards, дословно как
  в AC-д (grep подтверждён).
- **AC-е** (`src/space-card.ts:290-297, 847`): dispose-гейт
  `this._config.light_pools !== true` — точное зеркало рендер-гейта
  `lightPools: this._config.light_pools === true` (:847). `light_pools: 1`
  теперь и не рисует пулы (уже было так, `===true` не давал `1`), и не
  сохраняет рантайм живым (раньше `!this._config.light_pools` было `false`
  для `1`, рантайм не dispose'ился — асимметрия, которую чинит эта правка).

### Гейты — прогнаны лично на этом SHA (зелёного Validate для `dceaf2d8` не найдено)

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | чисто, без вывода |
| `npm test` | **1551 pass / 0 fail / 1 skip** (1552 всего) — совпадает с заявленным автором числом |
| `npm run build` | сборка чистая, `git status` после — пусто (бандл в `dist/` уже байт-в-байт совпадает с закоммиченным) |
| `npm run bundle:sync` | без диффа (три копии дерева уже синхронны) |
| `npm run bundle:budget` | initial View **275801 B** / 300000 (headroom 24199) — совпадает с числом автора |
| `node scripts/check-docs.mjs` | **passed (7 files, 10 external links)** — обязателен, диф трогает `src/**` |

Мутанты (дишонести-дисциплина: тест обязан уметь падать) — прогнаны лично,
не только по слову автора:

```
node scripts/mutation-gate.mjs --id=space-card-null-title-compact-narrowed
→ поймано 1 из 1 (test/space-card-audit-lows.test.mjs краснеет без правки)
node scripts/mutation-gate.mjs --id=furniture-stroke-iso-camera-mismatch
→ поймано 1 из 1 (test/furniture-stroke-contract.test.mjs краснеет без правки)
```

(Полный прогон `mutation-gate.mjs` без `--id` пробовал ошибочно как общий
чек — упал на несвязанной строке `tests_backend/test_frontend_assets.py`
из-за отсутствия `pytest` в окружении; это существующая инфраструктурная
дыра окружения, не относится к диффу #376 — `custom_components/**/*.py` и
`tests_backend/**` в диффе нет, так что backend-гейт для этой задачи не
обязателен и не разбирался дальше.)

### Смоки — выбор обоснован, не «прогнал всё»

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`: изменено 2
файла `src/**`, 3 символа на изменённых строках. Инструмент не нашёл ни
одного смока с прямым совпадением по символу; 19 файлов помечены как слабая
связь через одно распространённое имя `_config` (общее для всех карточек,
не специфично для этой правки) — решение ревьюера: не прогонять, связь
неинформативна. Неопределённость по `_renderProjection`,
`furniturePlanScreenScale` — новых смоков под них нет; решаю по AC и по
доказательству чтением (см. AC-г выше) плюс по одному прогнанному смоку,
который фактически упражняет соседний код того же слоя:

- `demo/smoke_space_card.mjs` — **обновлён самим диффом** (добавлена ветка
  `title: null`), прямое доказательство AC-а исполнением: `nullTitleFrame`
  байт-в-байт равен `compactFrame` (`{x:-50,y:100,w:1100,h:850}`),
  `nullTitleHasTitle:false`. Прогнан — **OK**.
- `demo/smoke_glow_blending.mjs` — регистрированная связь: явно создаёт
  `houseplan-space-card` с `light_pools: true` и без. Прогнан —
  `{"ok":true,"blend":"screen","pools":60,"staticParity":true,
  "staticPools":60}` — не деградировал (та же цифра, что в отчёте автора).
  Не покрывает конкретно новую ветку «`light_pools: 1`» (её ловит только
  новый юнит-тест) — рантайм-регрессию по `true`/`false` парности проверяет.
- `demo/smoke_furniture.mjs` — регистрированная связь (общий декор/мебель
  слой). Прогнан — все 18 полей `true`/OK, включая
  `furnitureFollowsPhysicalCameraZoom`, `designerAndPrimitiveMatchOrdinaryDecor`
  — не деградировал. Не покрывает iso-ветку напрямую (в фикстуре нет
  `projection: 'iso'`), только соседнее 2D-поведение.

Остальные 200 смоков **не прогонялись** — ни прямой, ни регистрированной
связи с изменёнными тремя символами инструмент не нашёл, а полный прогон
матрицы — предрелизная обязанность, не гейт этого ревью.

### Golden — сознательно не прогонялся, обоснование

Diff меняет видимый рендер (кадр space-card, толщина штриха мебели в iso),
что по правилам требует рассмотреть `golden:verify`. Проверено по
`demo/golden/matrix.mjs` и `demo/golden/harness.mjs`, что ни один текущий
golden-сценарий не упражняет ни одну из двух изменённых веток:

- **space-card** нигде не участвует в golden-матрице (нет ни одного
  сценария с `houseplan-space-card`) — `golden:verify` физически не может
  ни поймать, ни подтвердить AC-а.
- **iso + мебель**: все `projection: 'iso'` сценарии (`isometric-*`,
  7 штук) используют `space: 'golden-geometry' | 'golden-lighting' |
  'golden-wall-junctions' | 'perf-floor-2' | 'golden-opening-symbols'` без
  `decorOverride`; дефолтный `space.decor = []` (`harness.mjs:245,514`), то
  есть в них нет ни одной декор-фигуры вообще. Сценарии с мебелью
  (`golden-decor-sofa` через `decorOverride: decorLayerFixture`) — только в
  `mode: 'decor'`/`mode: 'view'` без `projection: 'iso'` (`furniture-*`,
  `decor-over-opaque-hover-light`, `decor-over-glow-base-dark`) — там
  `furnitureScreenScale` идёт по прежней 2D-формуле, не тронутой этой
  правкой.

Прогон `golden:verify` дал бы нулевую диагностическую ценность для этого
диффа — решение не прогонять, а не пропуск.

### Invariants / backend

Diff не трогает геометрию комнат, толщину стен, `layout`, `marker.space`,
`open_spans`, `custom_components/**/*.py` — `npm run invariants` и
`pytest tests_backend` не требуются и не запускались.

### Трейлеры и changelog

`db7f0587`: `Issue: #376`, `User-Visible: yes`, оба changelog
(`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены в этом же коммите —
верно. `dceaf2d8`: `Issue: #376`, `User-Visible: no` — верно для
build-коммита (только бандл-деревья).

### Одно число — один источник

Единственная новая пользовательская величина в этом диффе —
`furnitureScreenScale` для iso. Проверено: значение вычисляется один раз в
`_renderDecorLayer` и передаётся обоим потребителям (сохранённые фигуры и
placement-preview) одним и тем же параметром — дублирования источника нет,
и именно это утверждение теперь явно проверяет
`furniture-stroke-contract.test.mjs` («the viewport scale is resolved once
for the whole decor layer»). `compactTopFrame`/`lightPools` — булевы гейты
без дублирующего представления величины, вопрос неприменим.

## 3. Что проверено и корректно

- Все пять пунктов (а, б, г, д, е) реализованы ровно так, как описаны в
  принятом ТЗ rev2, без расширения скоупа и без пункта (в) — вынесен в #377.
- `title: null` даёт компактный кадр байт-в-байт равный `title: ''`,
  `undefined`-ветка (дефолтный заголовок) не задета — подтверждено
  исполнением смока и юнит-тестом с мутантом.
- iso-ветка мебели отключает 2D-компенсацию, не затрагивая ни один текущий
  golden/смок-сценарий (все они либо без мебели в iso, либо без iso для
  мебели) — подтверждено чтением плюс мутантом.
- `light_pools` render/dispose гейты симметричны — подтверждено чтением,
  юнит-тестом (grep-контракт с явным запретом старого гейта) и смоком на
  `true`/`false` параx.
- Документация (б, д) точно описывает существующий код, не выдаёт догадку
  за факт — сверено построчно с CSS/JS.
- Трейлеры, оба changelog, класс изменений (A: `src/*.ts`; B: тесты/скрипты;
  C: доки; D: бандл) — все соблюдены.
- Бюджет бандла практически не изменился (+3 Б), докстрока фингерпринта
  скриншотов синхронна с текущим `src/**`.

## 4. Чего не проверял (и почему)

- Полный смок-набор (203 файла) — не прогнан; `scripts/smoke-select.mjs` не
  нашёл ни прямой, ни сильной регистрированной связи, кроме уже прогнанных
  трёх. Это предрелизная обязанность, не гейт код-ревью соразмерного диффа.
- `npm run golden:verify` — не прогнан, обоснование в §2 (ни один сценарий
  не упражняет изменённые ветки; см. выше).
- `python -m pytest tests_backend` — не прогнан, диф не трогает
  `custom_components/**/*.py`.
- `npm run invariants` — не прогнан, диф не трогает геометрию/толщину/layout.
- Полный `mutation-gate.mjs` без `--id` — не завершён (упал на
  несвязанном backend-мутанте из-за отсутствия `pytest` в окружении
  ревьюера); не относится к диффу, не пересматривался повторно ради этого.
- Ручного браузерного тестирования не было (по правилам цикла) — заменено
  прогоном названных смоков и построчным чтением кода.

## 5. Находки

Нет ни одной High, ни одной Medium (в скоупе или вне). Все три находки
предыдущего (spec) раунда были закрыты в редакции 2 и здесь не
пересматриваются повторно — это код-ревью первого захода для этапа `code`,
делить по дельте не от чего.

## Вердикт

Все пять AC (а, б, г, д, е) выполнены и доказаны — частью исполнением
(смоки, мутанты), частью чтением с явной пометкой. Гейты, соразмерные
диффу, зелёные. Golden и backend осознанно не прогонялись с указанной
причиной. Возражений по скоупу, процессу или качеству нет.

**Зелёный.**
