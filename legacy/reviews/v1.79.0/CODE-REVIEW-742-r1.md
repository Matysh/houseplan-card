# CODE-REVIEW-742-r1

Issue: #742 · Трек: `ask` (критерий §5 «перф») · Заход: r1 · блокирующих циклов 0/4
Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
SHA материала: `b7a1de5116ef8e13f4e1bd7c1471e4d74df35e25` (сверено `git rev-parse HEAD` перед итогом — совпадает)
Один коммит на ветке `issue/742-first-frames-white` поверх `dev`.

## Скоуп диффа

```
demo/smoke_space_switch_transitions.mjs       | 127 +++++++++++++++++++++++++-
docs/CHANGELOG.md                             |   5 +
docs/CHANGELOG.ru.md                          |   5 +
docs/testing-notes/mutation-browser-guards.md |   6 +-
scripts/mutation-registry.mjs                 |  29 ++++++
src/houseplan-card.ts                         |   7 +-
src/styles/plan.styles.ts                     |  15 ++-
7 files changed, 185 insertions(+), 9 deletions(-)
```

Ровно список из «Затронутые файлы» ТЗ, ничего лишнего. Правка: список SVG-фигур
комнат (`src/houseplan-card.ts:10946–11066`) стал
`keyed(space.id, repeat(shownRooms, (r, index) => r.id || index, (r) => {…}))`
вместо голого `map()` — та же форма, что уже стоит у маркеров и проёмов (#534).
Переход `.room { transition: 0.12s }` не тронут. Остальные файлы — свидетель,
два мутанта, их запись в реестр гвардов и CHANGELOG.

## Как проверялось

Рабочая копия уже стояла на материале (`b7a1de51`), `git status` чист и
восстановлен чистым в конце (`npm run bundle:clean`, проверено `git status --short`
— пусто).

| Гейт | Результат | Примечание |
|---|---|---|
| `npx tsc --noEmit` | ✅ (через `npm run build`, 3 раза) | Validate зелёный на этом SHA ([run 36845567363](https://github.com/Matysh/houseplan-card/actions/runs/36845567363)); перепрогнан дополнительно при каждом `bundle:sync` ниже — без ошибок |
| `npm run build` + сверка бандла | ✅ | Validate подтверждает; локально собран трижды (базовая проверка + 2 мутанта), во всех случаях чисто. Рабочая копия возвращена `npm run bundle:clean`, `git status --short` пуст |
| `npm test` (полный) | не перегонялся целиком | Validate зелёный на этом SHA, не гоняю повторно (§8). Точечно перегнаны `test/mutation-gate.test.mjs` и `test/testing-doc.test.mjs` (структура реестра и список гвардов) — 71/71 ok; `test/core-file-budget.test.mjs` отдельно — 7/7 ok |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выполнен | см. решение по строкам ниже |
| `demo/smoke_space_switch_transitions.mjs` (новый раздел, AC1–AC3) | ✅ зелёный на правке | прогнан на честно собранном бандле (`npm run bundle:sync`, demo.local дописан в `/etc/hosts` — требуется `demo/serve.mjs`, прецедент `legacy/reviews/v1.69.0/CODE-REVIEW-39-r1.md`) |
| Тот же смок на `src/houseplan-card.ts` = `origin/dev` (контроль) | ❌ красный, 7 проверок | см. «Доказательство негатива» ниже — свидетель действительно умеет падать |
| Мутант `rooms-rendered-without-keys` применён руками | ❌ ровно 1 проверка (`noRoomNodeSwappedInsideTheSpace`, AC2) | убивается смоком, как заявлено в реестре |
| Мутант `rooms-rendered-without-space-key` применён руками | ❌ ровно 3 проверки (same-id ветка AC1) | убивается смоком, как заявлено в реестре |
| `node scripts/mutation-gate.mjs --check` | ✅ exit 0, `browser guards: 203/200` (WARN, не fail — ориентир #699) | оба новых id документированы в `docs/testing-notes/mutation-browser-guards.md`, `missingReasons` пуст |
| AC4: `smoke_space_switch_transitions` целиком | ✅ | 37/37 проверок, включая старые разделы (двери/маркеры) |
| AC4: `smoke_daycycle_layer_budget` | ✅ | |
| AC4: `smoke_render_perf` | ✅ | |
| AC4: `smoke_visual_continuity` | ✅ | |
| AC5: Full Performance | ✅ (перечитан CI-лог) | см. разбор ниже — число в комментарии автора сверено с логом раннера |
| `python -m pytest tests_backend` | не прогонялся | дифф не касается `custom_components/**/*.py` |
| `npm run invariants` | не прогонялся | дифф не меняет геометрию и ссылки на неё (К4: «Геометрия… не меняется»), только порядок/идентичность DOM-узлов |
| `npm run golden:verify` | не прогонялся | метки `ci:golden` на issue нет; К4 + зелёный AC4 — согласовано ещё в ТЗ («golden не заказывается») |

### `smoke-select` — решение по строкам

Матрица: 285 смоков, изменено 2 символа строк (`_markup`, `_mode` — они
попали в выборку не из-за новой семантики, а потому что диапазон диффа
проходит через уже существующую строку фильтра
`r.area || this._mode === 'view' || this._markup || disp.showBorders`,
которую патч только вынес в константу `shownRooms`, не меняя).

- **Прямое совпадение (8, `_markup`)** — прогнаны все: `smoke_edit_walk`,
  `smoke_editor_gestures`, `smoke_geometry_corpus`, `smoke_merge_split`,
  `smoke_optimize_coincident_partition`, `smoke_resize_audit_1550`,
  `smoke_room_resize`, `smoke_split_nonsnap`. Все зелёные. `smoke_merge_split`
  и `smoke_room_resize` особенно релевантны — они напрямую упражняют К2
  (слияние/разделение комнат, вставка) на честно собранном бандле.
- **Слабая связь (37, `_mode`)** — не прогонялись. `_mode` — общий признак
  режима карточки, задействованный в сотнях мест; его совпадение здесь не
  указывает на изменённую логику (сам фильтр не тронут, только вынесен в
  переменную). Решение осознанное, не обязательное к прогону по правилу
  промпта.

### Доказательство негатива (свидетель умеет падать)

Подменил `src/houseplan-card.ts` на версию `origin/dev` (оставив новый раздел
смока из HEAD), пересобрал (`npm run bundle:sync`) и прогнал смок:

```
FAILED (7):
  - noRoomTransitionOnSwitch: expected [], got ["g1:fill","g1:fill-opacity","g1:stroke","g1:stroke-opacity","g1:stroke-width"]
  - noRoomNodeOutlivesTheSwitch: expected [], got ["r1 → g1"]
  - newFloorRoomsBornInTheirFill: expected "rgb(96, 125, 139) / 0.18", got "rgba(0, 0, 0, 0) / 1"
  - noRoomNodeSwappedInsideTheSpace: expected [], got ["r1","r2","r3","r4"]
  - noRoomTransitionOnSwitchWithSameId: expected [], got [...]
  - noRoomNodeOutlivesTheSwitchWithSameId: expected [], got ["r1 → r1"]
  - sameIdRoomBornInItsFill: expected "rgb(96, 125, 139) / 0.18", got "rgba(96, 125, 139, 0.16) / 0.866874"
```

Ровно симптом из «Итога исследования» (белый кадр, `rgba(0,0,0,0)/1`, узел
`r1 → g1`). После возврата патча (`cp` обратно, `bundle:sync`) смок снова
зелёный — не случайность окружения. Рабочая копия возвращена чистой.

## AC — разбор

| AC | Вердикт | Как доказано |
|---|---|---|
| AC1 | ✅ выполнен, свидетель умеет падать и красит мутант `rooms-rendered-without-space-key` | Разобрано чтением + исполнением. Раздел стоит до `physicalize`, как требует Oracle (первая комната рисуется `polygon` по `r.poly` на обоих этажах — проверено `roomWitnessFixtureHolds: true`). Оба случая (разные id, одинаковый id) красны на `dev`, зелены на правке |
| AC2 | ✅ выполнен, красит мутант `rooms-rendered-without-keys` | Вставка комнаты первой в список внутри того же пространства — старые узлы не свопаются (`noRoomNodeSwappedInsideTheSpace: []`), на `dev` свопались все 4 |
| AC3 | ✅ выполнен | Настоящая смена `custom_fill` того же пространства по-прежнему запускает `transitionrun` на `fill` того же узла (`aRealFillChangeStillAnimates: true`), узел не подменяется (`realFillChangeKeepsTheRoomNode: true`). Ложный фикс `transition: none` АС отклонил бы (сам фикс не применялся — учтена логика проверки события `transitionrun`, не кадра) |
| AC4 | ✅ выполнен | 4 названных смока + 8 из 8 «прямое совпадение» `smoke-select` — все зелёные на честно собранном бандле |
| AC5 | ✅ выполнен по существу, но **комментарий о проверке неполон относительно Oracle** (см. находку Low) | Workflow run [36838952536](https://github.com/Matysh/houseplan-card/actions/runs/36838952536) — `conclusion: success`, `headSha: bd5bb16c` на ветке. Проверил построчно: `bd5bb16c` ⇄ `b7a1de51` отличаются только на 13 несвязанных doc/process-файлов (#729, #758 и т.п.); `git diff` по `src/`, `demo/`, `CHANGELOG` между ними пуст — перф-данные валидны для материала ревью. Перечитал сырой лог раннера (9 джобов, 9 профилей): все ✅, ни один `longTask.countP95` не подошёл к лимиту (худший случай plan-snap: 12→14 при лимите 16.2, +16 % в абсолютных попугаях, но с большим запасом) |
| AC6 | ✅ выполнен | `src/houseplan-card.ts` = 12895 строк (`wc -l`) при потолке 12896 (`test/core-file-budget.test.mjs:52`) — потолок не поднят, запас 1 строка на `wc -l`/67 строк до потолок+полоса; расхождение с числом «12 896» в хендовере автора не риск (тот же класс неточности, что уже снят Low на ревью ТЗ — реальный гейт - число в тесте, а не число в прозе). Мутанты `rooms-rendered-without-keys`/`rooms-rendered-without-space-key` в реестре и в `mutation-browser-guards.md`, `mutation-gate --check` зелёный |

## Находки

### Low-1 — AC5: таблица в хендовере не покрывает весь Oracle (снято ревьюером)

**Файл:** комментарий автора в issue #742 (не код).
**Что видно:** Oracle AC5 требует в issue медианы ТРЁХ метрик
(`spaceSwitchMs`, `switchCycleMs`, `longTask.countP95`) кандидата и базы для
трёх профилей. Автор дал таблицу только по `switchCycleMs` (5 профилей, имена
короче, чем в AC: `large-house`, `plan-snap`, `isometric-stage3`,
`interaction`, `isometric`) и качественно упомянул «`spaceSwitchMs` в
пределах ±5 %» без чисел; `longTask.countP95` — та метрика, которая в
прецеденте #534 реально покраснела — в комментарии не названа вовсе.
**Почему не риск по существу:** перечитал сырой лог CI-раннера (таблица выше):
`longTask.countP95` нигде не подошёл к лимиту, худшее изменение — `plan-snap`
12 → 14 при лимите 16.2. Повторения #534 нет.
**Решение:** Low, снимаю записью — цифры из `switchCycleMs` в комментарии
автора сверены и совпадают с логом раннера до десятых, то есть автор
действительно смотрел в отчёт, просто не процитировал оставшиеся две строки.
Доказательство по существу я восстановил сам из публичного лога workflow;
новый цикл это не оправдывает (Low не образует цикла, §2.7).

Других находок нет. High: 0. Medium: 0.

## Что проверено и корректно

- Форма правки совпадает с «Принято предположительно» ТЗ дословно:
  `keyed(space.id, repeat(rooms, (r, i) => r.id || i, …))`, та же форма, что
  у маркеров/проёмов (#534); импорты `keyed`/`repeat` уже были в файле.
- К1 (смена пространства не путает комнаты, включая совпадающие `id` на двух
  этажах), К2 (вставка/перестановка внутри пространства не путает узлы), К3
  (настоящая смена заливки анимируется) — все три подтверждены исполнением
  смока на честно собранном бандле, причём с демонстрацией красного на `dev`.
- К4 (кадр в покое не меняется) — 4 независимых смока (включая
  `smoke_visual_continuity` и `smoke_daycycle_layer_budget`, ради которого
  заведена #742) зелёные без изменений.
- Пустой `id` ключуется по числовому индексу — `r.id || index` даёт `number`
  для безымянной комнаты, что по правилам `Map` в `repeat` никогда не
  совпадёт со строковым `id` — проверено чтением и логически (тип), ТЗ это же
  и требует (К2).
- `.room { transition: 0.12s }` не тронут (`plan.styles.ts:404–406`) — не-скоуп
  соблюдён, подтверждено и чтением, и тем, что AC3 зелёный (настоящая смена всё
  ещё анимируется).
- Оба новых мутанта реально убиваются названным guard'ом — проверено запуском
  патчей руками, а не доверием к `--check` (`--check` только сверяет якоря
  текста, не исполняет мутацию).
- Потолок файла не поднят, бюджет (`core-file-budget.test.mjs`) зелёный.
- Трейлеры `Issue: #742`, `User-Visible: yes` на коммите; оба CHANGELOG
  (RU/EN) правлены в том же коммите, тексты дословно совпадают с текстом ТЗ.
  Единственное число, которое меняется диффом и видно пользователю — тексты
  CHANGELOG описательные, числовых значений не содержат; единственное число
  в коде (потолок 12896 в `core-file-budget.test.mjs`) не менялось этим
  диффом и имеет один источник — сам тест.
- `no-new-private-writes`: смок использует существующий `__hpTest.setServerConfig`,
  не создаёт новых точек записи в `_serverCfg` — соответствует заявленному
  отклонению от ТЗ (п. 1).
- Рабочая копия репозитория после всех проверок чиста
  (`git status --short` пуст, `HEAD` = `b7a1de51`, dist/demo/srv/assets
  возвращены `npm run bundle:clean`).

## Чего не проверял

- Полный `npm test` (все сьюты) и полную сверку бандла из трёх копий — не
  перегонял, Validate зелёный на этом SHA ([run 36845567363](https://github.com/Matysh/houseplan-card/actions/runs/36845567363));
  перегнал точечно только сьюты, трогающие реестр мутаций и бюджет файла.
- 37 «слабых» смоков по символу `_mode` из `smoke-select` — решил не гонять,
  связь по общему признаку режима карточки, сам фильтр не менялся (см.
  обоснование выше).
- `golden:verify`, `pytest tests_backend`, `npm run invariants`,
  performance-профили кроме Full Performance — не требуются по диффу/AC (нет
  правки Python, нет правки геометрии, метки `ci:golden` нет, перф уже
  гонялся автором и перепроверен мной по логу).
- Ручная проверка в браузере (owner-подтверждение GPU/растра) — ТЗ явно
  пометило её как «по желанию, не AC»; не проверял, доказательство
  построено на `getComputedStyle`/`getAnimations`, что я подтвердил логикой
  смока и воспроизведением красного состояния.
- Пакетное/ночное ревью, release-review — вне объёма этого раунда (§8:
  объём гейтов соразмерен задаче).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/742-first-frames-white`, коммит `b7a1de5116ef` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `73235a2c94360c71299df042c1fa3451a416ce49`
  ```
  git log --all --format='%H %T' | grep 73235a2c9436
  ```
- Тело issue: `e1e4ad3459d8d681dab722e8636915bb56a64599c10e9c2ede34ef4e031e2456`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
