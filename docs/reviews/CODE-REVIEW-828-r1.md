# CODE-REVIEW-828-r1

Issue: #828 «Select: частые отказы перемещения узлов, залипающий preview и
полупрозрачные исходные стены». Трек `track:ask`, заход r1, блокирующих
циклов 0/4. Материал: ровно `55a8430d8525681e68bfbe9a1015e38bb1106569`
(`origin/dev..HEAD`, один коммит, рабочая копия уже на нём, `git rev-parse
HEAD` сверен). Маршрут вердикта: `route: fix` (задан заранее, #726; на `ask`
маршрут не пересматривается мной).

## Скоуп

Один коммит `55a8430d` (`Issue: #828`, `User-Visible: yes`), три класса:

- **Геометрия (A)**: `src/wall-node-move.ts` + `custom_components/houseplan/wall_node_move.py`
  — признание прежнего конечного контакта у формально ставшей угловой
  коллинеарной пары стен и наследование доказанной lineage родителя для
  X-сплита.
- **Рендер/владение transient-DOM (A)**: `src/wall-node-editor.ts` — единый
  live-владелец предупреждения/guide/X-подсказки/активной ручки (устранение
  дублирования после полного Lit/hass render) + заморозка исходной кладки в
  новый `.hp-node-source` слой (opacity .35).
- **Тесты/инфраструктура/документация (B+C)**: общая TS/Python fixture
  `test/fixtures/803-wall-node-parity.json`, новый `demo/smoke_wall_node_reliability.mjs`,
  правки `smoke_wall_node_move.mjs`/`smoke_wall_node_topology.mjs`/`scripts/smoke-links.mjs`,
  6 новых якорей `scripts/mutation-registry.mjs`, оба `CHANGELOG`,
  `docs/{ARCHITECTURE,DEVELOPMENT,STATUS,UX-MODES,WALL-THICKNESS,USER-GUIDE.ru}.md`,
  `docs/testing-notes/mutation-browser-guards.md`.

Вне диффа (по `git diff --stat`): `wall-node-preview.ts`, card-adapter,
снап/пороги, schema/model v10, бандл — ТЗ и допускало их не трогать
(«при необходимости»). Соответствует границам ТЗ §4 дословно.

## Риск по изменённым участкам (#707)

Единственный заявленный класс — **geometry** (`src/wall-node-editor.ts:54,55,137,138,139`
и ещё 54 строки, участок `wall-*`). Это новые поля `sourceGhost`/`sourceCoverage`
и блок заморозки исходной кладки при `pointerdown`, плюс (по остальным
строкам того же участка) вычисление `strips`/`stripsFor`/`sourceCoverage` в
`render()` и аналогичный геометрический блок в `wall-node-move.ts`/
`wall_node_move.py` (прежний-контакт/lineage фикс).

Покрытие AC ТЗ: класс geometry целиком закрыт AC1 (прежний коллинеарный
контакт, TS+Python parity), AC2 (X-lineage), AC3 (негативы: новое
пересечение/контакт/перекрытие), AC5 (раскраска/растр нового слоя .35) и
разделом 5 «Контракт геометрии» ТЗ буквально по тексту задачи. Отдельного
непокрытого риск-класса нет — `ask` не находит «не покрыт AC».

## Как проверялось

**Дешёвые гейты уже подтверждены на этом SHA** — Validate,
workflow_dispatch, https://github.com/Matysh/houseplan-card/actions/runs/37740164515,
`conclusion: success`. Проверил не на слово, а по логам:

- job «Переиспользование: это дерево уже проверено» — маркеры `smoke`,
  `golden`, `performance_smoke`, `geometry_parity`, `backend` все
  `Cache not found` (`gh run view --job 113188901823 --log`), то есть
  golden/смоки/perf-смок/backend ниже выполнились **заново на самом `55a8430d`**,
  не переиспользованы из более раннего прогона.
- «Golden-кадры против принятых эталонов» — `success` (4m32s, не skip).
- «Смоки в браузере» (3 шарда) — все `success`.
- «Перф-смок: бюджет времени кадра» — `success` (но это профиль `glow`, см.
  ниже про отдельное наблюдение по perf).
- «Бэкенд: pytest в Home Assistant» — `success` (полный `tests_backend/`,
  включая `test_ha_websocket.py`, с pinned HA-харнесом, которого в этой
  ревью-сессии нет).
- «Фронтенд: типы, юниты, мутанты, синхрон бандла» — `success` (`tsc`,
  `npm test`, статический реестр мутаций, сверка бандла).
- «Мутанты по диффу» и «Геометрия: TS/Python parity исполнена» показаны `-`
  **по независимым от материала причинам**, не как пробел: первое отключено
  по #709 (развитие мутантов — только ночной прогон реестра, Validate их
  больше не включает); второе — отдельный узкий guard `junction_limits.py`/
  `junction-limits.ts` (`scripts/check-inputs.mjs:380-389`), который этот
  дифф не затрагивает вовсе (ни `junction_limits.py`, ни `junction-limits.ts`
  в `git diff --stat` нет). Не пробел и не находка.

`npx tsc --noEmit`/`npm test`/`npm run build` поэтому не перегонял — уже
подтверждены на этом SHA. Вместо этого бюджет раунда ушёл на то, что Validate
не покрывает по диффу (рендер правится, значит golden-уровня смоки по диффу —
моя обязанность, а не повторный прогон уже зелёного CI):

| Команда | Результат |
|---|---|
| `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs` | чисто, без ошибок (локальная сборка под юнит-тесты) |
| `node --test test/wall-node-move.test.mjs test/wall-node-editor.test.mjs` | `34 passed, 0 failed` |
| `python3 -m pytest -q tests_backend/test_wall_node_move.py` | `27 passed` (чистый pure-Python прогон, без HA-харнеса — он уже зелёный в Validate выше) |
| `npm run build` + `node scripts/bundle-sync.mjs` | бандл собран и засинхронен в `demo/srv/assets` локально, чтобы запустить браузерные смоки |
| `node demo/smoke_wall_node_reliability.mjs` | `OK` (новый смок AC4/AC5, с реальным Chromium) |
| `node demo/smoke_wall_node_move.mjs` | `OK`, `writes: 3` |
| `node demo/smoke_wall_node_topology.mjs` | `OK`, `scenarios: 4, cycles: 100, writes: 112` |
| `node scripts/mutation-gate.mjs --check` | exit 0; все 6 новых узлов `#828` — `ok`; `browser guards: 279/200` — совпадает с `docs/testing-notes/mutation-browser-guards.md` построчно |
| `node demo/benchmark_wall_node_drag.mjs` | `p50 2.83ms / p95 3.64ms / max 6.08ms` при бюджете 16ms — зелёно |

Плюс контрольная проверка «тест умеет падать» — не чтением, а исполнением:
временно откатил `src/wall-node-move.ts` и отдельно
`custom_components/houseplan/wall_node_move.py` к версии `origin/dev`,
перегнал те же юнит/pytest-наборы, вернул правку и перепроверил зелёный
прогон (рабочая копия чистая, `git status --short` пуст по завершении).

- TS, до фикса: `node --test test/wall-node-move.test.mjs` →
  `not ok 1 - 828 preserves finite fixed contacts...`, остальные 17 — зелёные
  (регрессии в соседних тестах нет, падает только новый).
- Python, до фикса: `pytest -k 828` →
  `5 failed` (`node_move_invalid` на всех 4 параметрах
  `test_828_fixed_contacts_and_new_contact_negatives` + `test_828_room_wall_fixed_collinear_contact_preserves_foreign_room`).

Это прямое доказательство, не разбор по коду: оба языковых зеркала красные на
исходной beta.8-логике и зелёные на фиксе.

## Разбор AC

**AC1 (unit+backend parity, прежний коллинеарный контакт).** Доказано
исполнением выше (TS 34/34, Python 27/27, оба красные без фикса). Общая
fixture `test/fixtures/803-wall-node-parity.json` содержит ровно минимальный
пример из аналитики issue (`moving [0,1]→[1,1]`, `side`, `far [1,1]→[2,1]`,
target `[-.25,.75]`) плюс zero/reversed варианты и три негатива
(`828-new-crossing-not-old-extension`, `828-new-collinear-overlap-at-old-end`,
`828-new-foreign-endpoint`, все `ok:false`). Тест параметризован по
`reversed`/`zero`, проверяет `buildNodePreview(...).safe`, отсутствие новых
junction violations, точную неизменность `far`-стен и (Python) `CONFIG_SCHEMA`.
Прочитал обе реализации построчно (`src/wall-node-move.ts:320-345`,
`wall_node_move.py:254-270`) — фикс симметричен между языками: `parentRefs`/
`parent_refs` строится внутри самой функции из фактических `replacements`
сплита, не из клиентских данных, и fallback-проверка контакта
(`[oldA.a, oldA.b].find(p => sameNodePoint(p, hit) && onWall(p, oldB))`)
ограничена фактическим отрезком старой стены (`onWall`/`_on`: `t ∈
[-EPS, 1+EPS]`), а не бесконечной прямой — буквально запрет из ТЗ §5.1 «нельзя
разрешить контакт по продолжению прямой».

**AC2 (unit+backend/HA, X-lineage).** Fixture `828-X-fixed-neighbour` и
`828-X-both-neighbours-reversed` (оба направления, оба конца). И TS, и Python
тест отдельно проверяют отказ при поддельном `{'partition:v': 'far'}` и
коллизии `{'partition:far': 'new-v'}` — `parentRefs` строится из
`replacements`, которые сама функция заполняет при реальном сплите
(`src/wall-node-move.ts:254-311`), произвольный clientский id в lineage не
попадает. Backend-тест дополнительно гоняет `apply → undo → redo` через
`node_move_candidate` c `"undo"`/повтором и сверяет точное равенство с `before`/`after`.
HA-уровень (`test_ha_websocket.py`) подтверждён зелёным Validate (строка
выше) — pinned-харнеса в этой сессии нет, не прогонял сам.

**AC3 (негативы).** Три `ok:false`-сценария в общей fixture плюс существующий
большой негативный набор (T/X noisy atoms, foreign node, carrier interval) —
не тронут и остаётся зелёным (34/34, 27/27 включает их).

**AC4 (browser smoke, реальные pointer events).** `demo/smoke_wall_node_reliability.mjs`
воспроизводит ровно последовательность из ТЗ: invalid A → unrelated hass
tick + полный Lit tick (`card.requestUpdate()`) → invalid B → valid C, с
контролем `ticks: [false, true]`. Причина дубликата была в том, что
`render(false)` (вызываемый на каждый полный ре-рендер,
`houseplan-editor-runtime.ts:930` → `nodeMove.render()` без аргумента)
рисовал predupreждение/guide/X-подсказку в «settled» DOM без привязки к
`live`; я прочитал диф построчно (`wall-node-editor.ts:276-304`) — все эти
элементы теперь завёрнуты в `live &&`, а единственный «живой» экземпляр
создаётся отдельным прямым вызовом `render(..., this.liveRoots[2])`
(`wall-node-editor.ts:320-348`), не затрагиваемым полным component re-render.
Смок это подтверждает исполнением: `settled` счётчик `0` на каждом шаге,
ровно одно предупреждение, X prompt/guide остаются единичными через
несколько тиков (секция «X prompt and snap guides» того же смока, не
процитирована выше ради места — прочитана целиком).

**AC5 (raster/visual, .35).** Та же смока меряет пиксели: фон скрыт CSS
(`independent raster background`), `assert.ok(Math.abs(visible / full - .35) < .09, ...)`
— это растровое сравнение, не чтение CSS-атрибута (ровно запрет ТЗ «один
лишь CSS opacity недостаточен»). Прогнано исполнением (вывод выше:
`ratio: 0.32–0.34` на 8 комбинаций dark/cm/invalid), плюс проверка
неприглушённых соседних пикселей, сохранённого выреза проёма и общего угла
комнаты (секция «shared node» смоки). `node-source-ghost-opaque` мутант
(`scripts/mutation-registry.mjs`) ломает именно эту строку
(`ghost.style.opacity = '1'`) — проверил `--check`: `ok`.

**AC6 (отмены/HA).** `demo/smoke_wall_node_topology.mjs` (100 циклов
commit/cancel + 10 lifecycle/context terminals) и `demo/smoke_wall_node_move.mjs`
прогнаны мной исполнением — `OK` у обоих. Прочитал `up()`/`cancel()`
(`wall-node-editor.ts:177-226`): все пять путей завершения (ранний `current()`-отказ
дважды, invalid-check, catch при записи, успешная запись) сходятся в один
`finally`/`cancel()`, который снимает `sourceGhost`/`sourceCoverage`
безусловно — нет пути, где терминал жеста оставляет ghost. HA-уровень —
зелёный Validate, не прогонял сам.

**AC7 (review+executable checks).** Таблица автора в хендоффе (комментарий
#828 от 2026-10-08T06:52) соответствует фактическому коду: 4 браузерных
мутанта (`node-source-ghost-opaque`, `node-invalid-warning-settled-copy`,
`node-guide-settled-copy`, `node-axis-prompt-settled-copy`) + 2 небраузерных
(`node-finite-old-collinear-contact-refused`, `node-backend-child-loses-proven-parent`)
— ровно совпадает с заявленными «4 browser guards». `mutation-gate.mjs --check`
зелёный (прогнал сам, см. таблицу), `browser guards: 279/200` совпадает
построчно с `docs/testing-notes/mutation-browser-guards.md` (там тоже `279/200`,
не устаревшее число). Бандл/budgets не менялись — подтверждено job'ом
«Фронтенд: …синхрон бандла» в Validate.

## Отдельное наблюдение: упомянутый в хендоффе коммит `cdc3ad93` отсутствует в материале

Комментарий-хендофф (#828, 2026-10-08T06:52) приводит замеры perf
(`benchmark_wall_node_drag.mjs`/`benchmark_wall_node_browser.mjs`, p95/Long
Tasks) и `golden:verify`/`process-gate.mjs` на коммите `cdc3ad9388a892c73c19a3be4baea37a42571a6a`.
Этого объекта нет ни в репозитории (`git cat-file -t cdc3ad93` →
`Not a valid object name`), ни в `git log --all`, ни на ветке
`issue/828-node-move-reliability` (единственный коммит там — ровно `55a8430d`,
материал этого раунда). Похоже на коммит, осиротевший при squash/amend перед
пушем — не повод подтягивать его (#499), и в данном случае не меняет вывода:
независимый `workflow_dispatch` Validate уже перегнал golden/смоки/backend
**заново на самом `55a8430d`** (см. «Как проверялось», «Cache not found» по
всем пяти маркерам) — то есть вывод по AC1-AC6 не опирается на несуществующий
коммит. Единственное, что осталось не переподтверждённым на `55a8430d`:
конкретные числа `benchmark_wall_node_drag.mjs`/`benchmark_wall_node_browser.mjs`
из хендоффа — эти скрипты не входят ни в один npm-script и не триггерятся
классификатором `scripts/check-inputs.mjs` (профиль `perf_interaction` реагирует
на `src/(live-|render-|houseplan-render-lifecycle|houseplan-card)…\.ts`,
`wall-node-editor.ts`/`wall-node-move.ts` в этот список не входят — сам
Validate-прогон использовал профиль `glow`, не wall-node). Производительность
не входит в явные AC1-AC7 (это риск §9, не критерий приёмки с требованием
доказательства), поэтому не поднимаю это до Medium; сам прогнал дешёвый
`benchmark_wall_node_drag.mjs` на материале — см. таблицу выше, бюджет 16ms не
задет. Браузерный `benchmark_wall_node_browser.mjs` (Long Tasks/pointer-to-paint)
не перегонял — непропорционально объёму раунда (§8) для не-AC риска, когда
алгоритмическая часть (чистый TS/Python) уже измерена и укладывается на
порядок ниже бюджета.

## Один номер — один источник (§8)

Opacity `.35` — не новая величина, а повтор существующей проектной конвенции
(`src/live-editor.ts:344`, `src/houseplan-card.ts` decor-mode, `editor-secondary.ts`)
для одного и того же визуального приёма «приглушённый слой», используется как
обычный литерал в каждом месте и так было до этой задачи — не дублирование
одного вычисляемого числа в двух местах, которое могло бы разойтись.
`browser guards: 279` указано один раз в `docs/testing-notes/mutation-browser-guards.md`
и воспроизводится мной независимым прогоном — совпадает, не раздвоено.

## Трейлеры и changelog

`55a8430d`: `Issue: #828`, `User-Visible: yes`. `docs/CHANGELOG.md` и
`docs/CHANGELOG.ru.md` правятся в этом же коммите (проверено `git diff
--stat`), оба описывают ровно то же поведенческое изменение (сохранённый
дальний контакт при повороте, отсутствие залипания/дублирования, .35
исходный слой, атомарность cancel/Undo/Redo) — согласовано между языками.

## Что проверено и корректно

- Фикс контакта симметричен между TS и Python (построчное сравнение,
  идентичная структура `parentRefs`/`old_by_ref`/fallback).
- `parentRefs`/`parent_refs` строится из внутреннего `replacements`, не из
  клиентского ввода — поддельный parent/child id не проходит (проверено и
  исполнением теста, и чтением).
- Единый live-владелец transient-DOM: все предупреждение/guide/X-подсказка/
  активная точка гейтятся `live &&`, единственный вызов `render(true)` пишет
  в выделенный `liveRoots[2]`, не трогаемый полным component re-render.
- `cancel()` — единая точка завершения жеста (вызывается из всех веток `up()`,
  `pagehide`, смены pointer id, `current()`-отказа); всегда обнуляет
  `sourceGhost`/`sourceCoverage`.
- `onWall`/`_on` ограничивают проверку контакта фактическим отрезком
  (`t ∈ [-EPS, 1+EPS]`), не бесконечной прямой — соответствует явному запрету
  ТЗ §5.1.
- Растровая проверка .35 — по пикселям с независимым CSS-скрытым фоном, не по
  чтению стиля; проходит на valid/invalid, light/dark, нулевой/положительной
  толщине, с вырезом проёма и общим углом комнаты.
- `docs/USER-GUIDE.ru.md`/`UX-MODES.md`/`WALL-THICKNESS.md`/`ARCHITECTURE.md`
  переписаны по новому контракту без оставленных противоречащих утверждений
  (проверил — старых формулировок «старые стены скрываются» нигде не
  осталось).
- `scripts/mutation-registry.mjs`: 6 новых якорей, `--check` зелёный, число
  `279/200` совпадает между прогоном и документацией.

## Чего не проверял и почему

- `npx tsc --noEmit`/`npm test`/`npm run build` как отдельный шаг —
  дешёвые гейты уже зелёные на этом точном SHA (Validate, run 37740164515);
  локально всё же пересобрал (`npm run build`, `tsc -p tsconfig.test.json`)
  ради запуска браузерных смоков, оба раза чисто.
- Полный `tests_backend/` с pinned HA-харнесом (`pytest-homeassistant-custom-component==0.13.357`,
  Python 3.14) — в этой ревью-сессии только Python 3.12, установить пин
  нельзя (`ERROR: Could not find a version that satisfies the requirement`);
  опираюсь на зелёный лог job'а «Бэкенд: pytest в Home Assistant» на этом же
  SHA. Прогнал локально только чистый pure-python срез (`test_wall_node_move.py`,
  без `test_ha_*`) — 27 passed, включая откат/возврат фикса для контроля
  «умеет падать».
- Полный `golden:verify` (205 сценариев) сам не перегонял — дорогой набор;
  убедился, что job «Golden-кадры против принятых эталонов» в Validate
  реально выполнился заново на `55a8430d` (не reuse — см. «Как проверялось»),
  и это релевантно, поскольку дифф трогает рендер.
- `benchmark_wall_node_browser.mjs` (реальный pointer-to-paint/Long Tasks в
  Chromium) не гонял — не формальный AC, непропорционально объёму раунда
  (§8); чистый алгоритмический `benchmark_wall_node_drag.mjs` прогнал сам
  (см. таблицу), бюджет 16ms не задет на 2-3ms запас.
- `npm run invariants`/`model-invariants.mjs` отдельно не гонял — покрыты
  тем же `--build-dir`/тестовым циклом внутри `node --test`, явного
  отдельного запроса в AC нет; геометрическая модель (schema v10) не
  менялась.
- Ручной интерактивный прогон в живом Home Assistant/браузере не делал —
  ручного тестирования в цикле нет по правилам конвейера; вместо этого
  исполнил три существующих/новых browser-смока с реальными Chromium
  pointer events (таблица выше) и перечитал код против каждого AC.
- Свежесть скриншотов документации не проверял — не гейт задачи (#697).

## Находки

Нет находок High или Medium — ни в скоупе, ни вне скоупа. Единственное
отдельное наблюдение (несуществующий в материале `cdc3ad93`) разобрано выше
отдельным разделом и не поднимается до находки: вывод по всем AC не зависит
от него, независимый `workflow_dispatch` Validate подтверждает материал
`55a8430d` напрямую.

## Вердикт

Зелёный. AC1-AC7 доказаны: геометрические AC1-AC3 — исполнением юнит/pytest
с подтверждённым переходом red→green при откате фикса (не просто чтением);
AC4-AC5 — исполнением соответствующих browser-смоков с реальными pointer
events и растровой оценкой пикселей; AC6 — исполнением существующих смоков +
чтением единой точки завершения жеста; AC7 — воспроизведённым `mutation-gate.mjs --check`
и сверкой документации. Трейлеры и changelog в порядке, оба языка синхронны.
Риск-класс geometry (#707) закрыт AC1/AC2/AC3/AC5 буквально. Маршрут — `fix`
(трек `ask`, задан заранее, не пересматриваю).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/828-node-move-reliability`, коммит `55a8430d8525` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `82b0f8d9cc1ea3f0b22192efed22615ec92b9fc4`
  ```
  git log --all --format='%H %T' | grep 82b0f8d9cc1e
  ```
- Тело issue: `d8d552ce9f1251c713b180a1d87f676d396142d01b46609422a3b8f09eebf02b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4367 output_tokens=60887 cache_creation_input_tokens=201108 cache_read_input_tokens=13333546 num_turns=112 -->
