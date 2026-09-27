# CODE-REVIEW-271-r1

- Issue: [#271](https://github.com/Matysh/houseplan-card/issues/271) — «Degree-3 узел достраивает короткий луч до 8×H»
- Этап: code (PROCESS.md §2.7)
- Заход: r1 (первый код-ревью цикл; спека прошла ревью зелёным в отдельном r1 — `docs/reviews/SPEC-REVIEW-271-r1.md`)
- Материал: `git log --oneline origin/dev..HEAD` = `396b391` (fix), `77143d4` (docs: спек-ревью), `482b2be` (docs: спека)
- Коммит реализации: `396b391a93cc228bd6b779b9985db87e853bfa50`, трейлеры `Issue: #271` / `User-Visible: yes`, оба changelog в этом же коммите — корректно.
- Вердикт: **красный** (High: 1, Medium: 1 в скоупе)

## Скоуп

Диапазон `origin/dev...HEAD` — один продуктовый файл `src/wall-thickness.ts`
(добавлено поле `supports: MultiWallNodeRaySupport[]` на канонический луч
multi-wall узла и ограничение локальной реконструкции реальной длиной
support'а вместо `8×H`), плюс тесты (`test/wall-thickness.test.mjs`,
`test/golden-matrix.test.mjs`), таргетированный smoke
(`demo/smoke_junction_patch_resilience.mjs`), golden matrix/harness
(`demo/golden/matrix.mjs`, `demo/golden/harness.mjs`), мутация
(`scripts/mutation-gate.mjs`), реестр smoke-связей (`scripts/smoke-links.mjs`)
и документация (ARCHITECTURE/WALL-THICKNESS/TESTING/USER-GUIDE×2/CHANGELOG×2 +
`docs/images/screenshots.json`). Соответствует заявленным «Ожидаемым файлам»
§9 ТЗ.

Привязка к продукту подтверждена: J1 (план не должен показывать
несуществующую архитектуру) и J6 (одна каноническая геометрия для всех
потребителей) — сценарий и симптом (`docs/SCOPE.md`).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный, без вывода |
| Юнит | `npm test` | 1163 passed, 0 failed |
| Сборка | `npm run build` | зелёный |
| Синхронизация трёх копий бандла | `npm run bundle:sync` | зелёный; `git status --short` после — пусто (байт-в-байт) |
| Документация/скриншот-отпечаток | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| Целевая мутация | `node scripts/mutation-gate.mjs --id=multi-wall-finite-ray-disabled` | поймано 1/1, чистый прогон зелёный |
| Выбор smoke по дельте | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | назвал `smoke_junction_patch_resilience.mjs`, `smoke_multiwall_junction.mjs` (обе — «зарегистрированная связь») |
| Smoke #197/#271 | `node demo/smoke_junction_patch_resilience.mjs` | OK, все поля true, включая новые `*StopsAtFiniteRayEndpoint` |
| Smoke #249 | `node demo/smoke_multiwall_junction.mjs` | OK |
| **Целевой semantic golden (AC6)** | `node demo/golden/run.mjs --mode=capture --scenario=junction-patch-resilience-plan-dark` | **error**: `golden finite multi-wall ray contract failed` |
| **Целевой semantic golden (AC6)** | `node demo/golden/run.mjs --mode=capture --scenario=junction-patch-resilience-view-dark` | **error**: та же ошибка |
| Независимая проверка чтением | прямой вызов `buildMultiWallNodeMap`/`wallBodiesGeometry` из `test-build/wall-thickness.js` на той же фикстуре | подтвердил причину ошибки на уровне сырой геометрии (см. находку H-1) |

`npm run golden:verify` не запускался — инструмент сам это запрещает вне
полной матрицы (`policy.mjs: golden verify must run the complete matrix`),
что и является предусмотренным prerelease-гейтом (§8/AC9). Но именно поэтому
диагностический `--mode=capture --scenario=<id>` — единственный способ
исполнить добавленную семантическую проверку AC6 локально, и он был обязателен
для этих двух конкретных сценариев, потому что diff добавляет в них новую
проверку (`absentWallProbes`) целиком под этот issue.

## Находки

### [High] AC6 не выполняется: собственная семантическая golden-проверка issue падает на обоих сценариях

**Файлы:** `demo/golden/matrix.mjs:266,271` (значение `absentWallProbes[1]`),
`demo/golden/harness.mjs:582-588` (проверка, которая на нём падает).

**Воспроизведение:**

```
node demo/golden/run.mjs --mode=capture --scenario=junction-patch-resilience-plan-dark
# → error   junction-patch-resilience-plan-dark
# artifacts/golden/golden-report.json:
#   "error": "page.evaluate: Error: golden finite multi-wall ray contract
#   failed: junction-patch-resilience-plan-dark"
```

То же для `junction-patch-resilience-view-dark`. Точечной проверкой (клонирую
сценарий с одним `absentWallProbes` элементом за раз) показано, что падает
именно второй пробник — `[0.936524285, 0.345833333]`; первый
(`[0.420833333, 0.37625]`, тот же, что в
`smoke_junction_patch_resilience.mjs`) действительно пуст.

**Причина (подтверждена прямым вызовом продукт-функций на той же фикстуре
`test/fixtures/197-junction-patch.json`, без браузера):**

Узел `(887.5, 345.833)` (в render units) имеет три луча:

```
u=[1,0]  halfDepth=6.25     length=1.3819039326657503   ← искомый короткий луч из таблицы issue
u=[-1,0] halfDepth=9.1667   length=195.833...
u=[0,-1] halfDepth=12.083   length=295.833...
```

Это в точности совпадает со строкой из issue/ТЗ:
`1 / (887.500, 345.833) | 1.381904 | 96.667` — реализация действительно
ограничивает этот луч `1.3819`, а не `96.667`. Сам фикс на этом узле работает
правильно.

Но зонд `[936.524285, 345.833]` находится в `887.5 + 49.02` — то есть внутри
совершенно другого, независимого и полностью легитимного интервала стены:

```
room_8: a=[888.8819039326658, 345.8333], b=[979.1666666666666, 345.8333],
        cm=22, half=9.1666...
```

Этот интервал начинается сразу там же, где заканчивается короткий луч
(`888.88`), и тянется до `979.17` — то есть физически это настоящая,
непрерывная (без зазора) кладка `room_8`, никак не связанная с 8×H-багом.
Прямой point-in-polygon расчёт против `wallBodiesGeometry(...).geom`
подтверждает: `probe1 → true` (внутри), `probe0 → false` (пусто, как и
ожидается).

Значит: между реальным концом короткого луча (`1.3819`) и следующим
независимым сегментом (`888.88`) зазора попросту нет — вдоль этого
направления в принципе не существует точки, которая была бы одновременно
«дальше короткого луча» и «пуста», потому что там сразу начинается другая
настоящая стена. §6.3 ТЗ прямо предвидел этот случай («если другой
независимый ray/body законно занимает точку за этим торцом, final union
остаётся заполненным им») — но зонд был выбран без проверки этого условия.

**Почему это блокирует:** AC6 требует, чтобы «до pixel diff harness
проверял, что два probes за finite endpoint пусты» — с добавленным кодом
это происходит, и один из двух пробников красный. Это не спекуляция и не
пропущенный гейт: гейт исполнялся (дважды, разными методами — Chromium и
прямой вызов), и оба раза воспроизвёл одну и ту же ошибку. Если это попадёт
в предрелизный `npm run golden:verify` (§8), CI-джоб `golden` станет красным
на `dev` до следующей задачи — тот же класс инцидента, что уже стоил
продукту #237. Хендофф-комментарий автора не упоминает запуск этого сценария
вообще (перечислены typecheck/test/bundle:sync/check-docs/mutation-gate/два
smoke) — гейт добавлен в этот же коммит, но не был исполнен ни разу.

**Что нужно исправить:** заменить `absentWallProbes[1]` на координату,
которая действительно лежит в пустоте за реальным концом искомого короткого
луча (либо выбрать другой узел/направление для второй иллюстрации из
таблицы issue, для которого такая пустая точка вообще существует — у этого
конкретного направления её нет, зазора между сегментами нет). Требуется
перепрогнать оба golden-сценария до зелёного после правки.

### [Medium, в скоупе] AC4 не имеет собственного fixture/smoke с проёмом

ТЗ (§8, AC4) и сама формулировка issue («Обязательные регресс-тесты», п. 3)
требуют fixture с коротким перпендикулярным лучом рядом с дверью и
targeted browser smoke с реальным SVG/shadow probe, доказывающие: opening
slot остаётся пустым, короткий луч не заходит в slot, light/sun occluder не
получает лишней площади, а opening tunnel/symbol contract не меняется.

Ни новый unit-тест (`test/wall-thickness.test.mjs:840`, `openings: []`), ни
переиспользуемая фикстура `test/fixtures/197-junction-patch.json`
(`openings` отсутствует как ключ), ни `test/fixtures/249-multiwall-junction.json`
не содержат ни одного проёма. Единственная косвенная проверка —
`lightAndSunStopAtFiniteRayEndpoint` в `smoke_junction_patch_resilience.mjs`
— проверяет тот же общий occluder-механизм, но не рядом с дверью и без
проверки самого opening slot/tunnel/symbol.

**Проверено чтением, не исполнением:** `bevelMultiWallBody()` вызывается в
`wallBodiesGeometry()` (`src/wall-thickness.ts:2686`) строго до цикла вырезания
проёмов (`src/wall-thickness.ts:2688-2705`), который работает как чистое
булево вычитание по `openingWallIndex`, построенному из `walls`/`wallIntervals`
— эта функция в диффе не тронута. Значит вырезание проёма не может вести
себя иначе только потому, что рядом finite ray; фикс равно применяется вне
зависимости от наличия проёма поблизости, и вероятность отдельного,
специфичного для проёма дефекта архитектурно мала. Именно поэтому это
Medium, а не High: живого дефекта не нахожу, но обязательное по своему же ТЗ
регресс-покрытие именно того производственного симптома, который запустил
issue (тёмное пятно у двери на `2-1.png`), отсутствует.

В скоупе задачи, чинится в этом же цикле по правилу §2.7 (Medium без High —
жёлтый; здесь High уже есть, поэтому общий вердикт красный, но это не меняет
маршрут находки — не заводится отдельным issue).

## Что проверено и корректно

- **AC1** (node map хранит конечную длину, permutation/order-independent) —
  доказано автотестом `test/wall-thickness.test.mjs:840` (deep-equal supports,
  reversed/permuted intervals дают одинаковую подпись). Тест умеет падать:
  мутация `multi-wall-finite-ray-disabled` красит именно этот тест-файл
  (через ту же комбинированную проверку, что и AC2, — см. ниже).
- **AC2** (короткий луч не достраивается) — доказано автотестом и
  независимо — прямым вызовом `buildMultiWallNodeMap`/`wallBodiesGeometry` я
  воспроизвёл узел `(887.5,345.833)` и подтвердил `length=1.3819...`, а не
  `96.667`; probe `[0,10]` внутри, `[0,100]` и `roomGeom`-эквивалент — снаружи
  (тест). Совпадает с числами из таблицы issue.
- **AC3** (длинные rays/join #249 не обрезаны) — весь существующий набор
  `#249`/`#261`/`#197` зелёный; area-бейзлайн `#197`-фикстуры пересчитан с
  явным комментарием, объясняющим уменьшение (`124568.27...→124244.27...`),
  величина уменьшения (≈324 ед²) правдоподобна для одного убранного фантомного
  прямоугольника.
- **AC5** (все поверхности используют finite result) — доказано smoke:
  `planStopsAtFiniteRayEndpoint`, `viewStopsAtFiniteRayEndpoint`,
  `kioskStopsAtFiniteRayEndpoint`, `staticStopsAtFiniteRayEndpoint`,
  `hiddenIsoStopsAtFiniteRayEndpoint`, `lightAndSunStopAtFiniteRayEndpoint`,
  `cleanFloorOwnsAreaAfterFiniteEndpoint` — все `true` при реальном прогоне в
  Chromium.
- **AC7** (мутант ловит регрессию) — `node scripts/mutation-gate.mjs
  --id=multi-wall-finite-ray-disabled` подтверждает: чистый прогон зелёный,
  патч `supportExtent = extent` красит тест. Мутация задевает ровно ту
  строку (`src/wall-thickness.ts` в `bevelMultiWallBody`), которая
  реализует контракт §6.1/6.3 ТЗ.
- **AC8** (приватность/детерминизм)** — проверено чтением: fixture —
  переиспользование уже прошедшей ревью анонимизированной `197-junction-patch.json`,
  приватные `1.json`/`2.json` не коммитятся (в диффе их нет);
  `renderNeverWritesConfig` в smoke подтверждает отсутствие мутации config.
- **Failure isolation §6.5** — проверено чтением: `try/catch` вокруг цикла
  по узлам в `bevelMultiWallBody` не тронут, `canonicalRays`-фильтр
  (`Number.isFinite && > 0/eps`) исключает только невалидный ray/node, не
  весь план.
- **Compatibility §7** — persisted config/model version не тронуты (diff
  ограничен внутренним представлением `MultiWallNodeRay`/локальной
  реконструкцией); нет нового глобального `O(E²)` — `canonicalSupports`им
  `O(k²)` только по числу дублей на одном направлении одного узла, что и
  раньше было O(дублей) на дедупликации.
- **Трейлеры и changelog** — один коммит `396b391`, `Issue: #271`,
  `User-Visible: yes`, оба changelog внутри того же коммита — соответствует
  §7 PROCESS.
- **Документация** — `ARCHITECTURE.md`/`WALL-THICKNESS.md`/`TESTING.md`/оба
  `USER-GUIDE` обновлены точно в терминах реализованного контракта (non-dominated
  finite `(half-depth, length)` supports); `docs/images/screenshots.json` —
  только `sourceFingerprint` изменился, все `imageSha256` совпадают (PNG не
  тронуты) — подтверждено `check-docs.mjs` и сверкой diff вручную.
- **smoke-links** — `scripts/smoke-links.mjs` дополнен новыми символами
  (`buildMultiWallNodeMap`, `MultiWallNodeRay`, `MultiWallNodeRaySupport`) с
  причиной; `smoke-select` подтвердил именно эти два smoke как
  «зарегистрированная связь», оба фактически прогнаны.

## Чего не проверял и почему

- **Полный `npm run golden:verify`** — инструмент сам требует полную матрицу
  (не принимает `--scenario` в verify-режиме); это осознанный prerelease-гейт
  по AC9/§8, не подмена. Вместо этого исполнен диагностический
  `--mode=capture --scenario=<id>` для обоих сценариев, добавленных этим
  диффом — что и вскрыло находку H-1.
- **Полная smoke-матрица (174 сценария)** — не запускал; `smoke-select`
  назвал только 2 релевантных, оба прогнаны. Diff не расширяет поверхность
  за пределы multi-wall reconstruction, широких символов (>34 смоков) не
  затронуто.
- **`npm run invariants`** — не запускал. Diff не трогает хранение записей
  толщины, `layout`, `marker.space`, `open_spans` или ключи решёточных рёбер
  — только внутреннее представление `MultiWallNodeRay` и локальную
  реконструкцию тела в уже существующей структурной фазе, читающую уже
  разрешённые `WallInterval`. Ссылочная целостность конфигурации не может
  быть задета этим диффом; проверено чтением diff (`git diff --stat`
  показывает единственный продуктовый файл `src/wall-thickness.ts`, без
  затрагивания `setWallThickness`/хранения ключей).
- **`python -m pytest tests_backend`** — не запускал, `custom_components/**/*.py`
  не тронут (только скомпилированный `frontend/houseplan-card.js`).
- **Performance-профили** — не названы в AC, geometry hot-path не меняет
  алгоритмической сложности (см. Compatibility выше).
- **Полный golden/perf/Linux HA harness** — предрелизный гейт по PROCESS
  §8/AC9 «Release-артефакты» ТЗ, сознательно не гоняется в цикле ревью.

## Итог

Реализация верно устраняет корневую причину (потерю длины луча в
`buildMultiWallNodeMap`/`bevelMultiWallBody`) и большинство AC подтверждены
автотестами и независимым чтением/пересчётом. Но собственная семантическая
golden-проверка, которую сам диф добавляет для AC6, красная при реальном
исполнении — это High, блокирует. Плюс отсутствует обязательное по ТЗ
door-adjacent регресс-покрытие AC4 — Medium, в скоупе. Оба возвращаются
автору в этом же цикле, отдельный issue не заводится.
