# CODE-REVIEW-282-r3

- **Issue:** #282 — стабильная идентичность сегментов стен (ADR Stage 1)
- **Ветка:** `issue/282-wall-geometry-model`, HEAD `95fa23ca79db830b201e82d9a34a05dcc3cecb29` (после ребейза на `origin/dev` `5f0a7f5` — по словам автора конфликтов не было; проверено: `git merge-base --is-ancestor origin/dev HEAD` — true, ветка целиком впереди `dev`)
- **ТЗ:** `docs/specs/282-stable-wall-segment-identity.md` (spec-review зелёный на r2, `2f30c481`; в этом раунде правка только строки статуса — см. §1)
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r3 · блокирующих циклов израсходовано 2 из 4 до этого вердикта
- **Предыдущий раунд:** `docs/reviews/CODE-REVIEW-282-r2.md`, красный, HEAD на тот момент `3588284f` (после итогового ребейза переименован без конфликта в `0f54daf3` — коммит `git show 0f54daf3` содержит буквально текст «preserve passage validation during wall migration», совпадающий с описанием фикса в исходном r2-документе; сам документ r2 закоммичен в `c75c77d5`)
- **Вердикт:** **красный**

## 1. Скоуп проверки

Раунд не расширяется до полного повторного разбора всей подсистемы: финальный
ребейз на `dev` `5f0a7f5` прошёл **без конфликта** (в отличие от двух
предыдущих раундов, где конфликт вносил новый код прямо в identity-барьер и
поэтому требовал полного разбора). Дельта r2→r3 (`0f54daf3..HEAD`, что то же
самое, что `c75c77d5..HEAD` за вычетом самого коммита с документом r2) — 5
коммитов, 17 файлов без учёта review-документа:

```
demo/smoke_near_axis_optimize.mjs, demo/smoke_openwall.mjs,
demo/smoke_optimize_coincident_partition.mjs,
demo/smoke_resize_outer_reconciliation.mjs,
demo/smoke_resize_virtual_thick.mjs, demo/smoke_sun.mjs,
demo/smoke_wall_thickness.mjs (новый),
custom_components/houseplan/frontend/houseplan-card.js, dist/houseplan-card.js,
docs/CHANGELOG.md, docs/CHANGELOG.ru.md, docs/images/screenshots.json,
docs/specs/282-stable-wall-segment-identity.md,
src/houseplan-card.ts, src/space-render.ts,
test/open-passage-contract.test.mjs, test/wall-segment-model.test.mjs
```

Разобрана полностью именно эта дельта: обе находки r2 (H1, H2) закрыты в ней
же (коммит `20f5c396` = переименованный `bcf8089`), и следом идёт
самостоятельный коммит `cfc1bb06` («fix: preserve migrated wall interactions»)
с продуктовым кодом в `src/houseplan-card.ts`, не связанным ни с одной находкой
r1/r2 — по методологии §2.10 такой код в дельте разбирается так же строго, как
если бы он пришёл первым разом.

Остальной ~60-файловый диапазон диффа #282 (миграция, backend-зеркало,
import/export, i18n, документация подсистемы, lineage-логика
`wall-segment-model.ts`, mutation-gate) дельтой не затронут — наследуется из
r2 (§6 ниже), она сама наследовала это из r1.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Build + sync бандла | `npm run build && npm run bundle:sync` | зелёный; дерево осталось чистым (`git status` пусто) — предъявленный бандл побайтово совпадает с пересобранным из исходников на HEAD |
| Unit/frontend | `npm test` | 1335 тестов, **1334 passed, 0 failed, 1 skipped** — H1(r2) закрыт, регрессий нет |
| Docs fingerprint | `node scripts/check-docs.mjs` | зелёный (7 файлов, 10 внешних ссылок) — обязателен, дельта трогает `src/**` |
| Model invariants (синтетика) | часть `npm test` | зелёный |
| Model invariants (реальная нагрузка) | `node scripts/model-invariants.mjs --config <large-house dump, v7 и после commitWallSegmentModel>` | зелёный до и после миграции: «ссылки разрешимы, записи толщины находятся» |
| Model invariants — решётка | `node scripts/model-invariants.mjs --config <large-house v8> --lattice` | 0.00% шума у узла на всех классах объектов (room/partition/wall/column/opening/decor) |
| Smoke selection (delta-scoped) | `node scripts/smoke-select.mjs --base c75c77d5 --head HEAD` | 7 прямых совпадений, 0 зарегистрированных, 0 слабых — см. §4 разбор по каждой строке |
| Целевые смоки дельты | `node demo/smoke_{junction_holes,active_chain_ink,drag_bounds,grid_snap,infinite_canvas,sun,wall_union_isolation}.mjs` | все 7 — **OK** |
| Смоки, изменённые самой дельтой | `node demo/smoke_{openwall,resize_virtual_thick,near_axis_optimize,optimize_coincident_partition,resize_outer_reconciliation,wall_thickness}.mjs` | все 6 — **OK** |
| AC7-евиденс смок (не в дельте, но прямо касается найденного) | `node demo/smoke_open_passage.mjs` | формально **OK** (все 13 проверок), но см. H1 — сама проверка `staticCutsAndFillsPassage` не способна обнаружить найденный дефект (проверяет наличие элементов, не форму пути) |
| Целевой диагностический прогон (не входит в проектный набор) | см. H1: точечный запуск `wallBodiesUnionPath` с продукционными константами + модифицированная **локальная копия** `smoke_open_passage.mjs` (не коммитилась, лежит вне репозитория) | воспроизводит дефект детерминированно, дважды |
| CI на точном SHA | `gh run view 32910611706` + `gh run view 32911155216` (`Matysh/houseplan-card`) | первый прогон: `frontend/hacs/hassfest/backend/performance_smoke/golden/smoke(1-3)` зелёные, `process-gate` красный (инфраструктурная причина — force-push обнулил `before`); второй прогон: `process-gate` зелёный, тяжёлые джобы легитимно reused (побайтово те же входы, механизм #208) |
| Mutation gate | не перепрогонял отдельно — дельта не трогает ни один из трёх поименованных `wall-identity-*`-мутантов (файлы `plan-optimizer.ts`/history-restore/editor-commit не в дельте); автор заявляет 226/226 на этом же HEAD | принято из хендоффа автора, не переисполнено мной |
| `pytest tests_backend` | не прогонялся — среда без `homeassistant` (как в r2 §8) | backend в дельте не тронут вовсе (все 17 файлов — frontend/demo/docs) — не требуется в этом раунде |
| Полный `performance_smoke`, `golden:verify` локально | не прогонялся отдельно | пре-релизный гейт; CI-прогон (см. выше) покрывает golden/performance на точном SHA |

Дешёвые гейты и все целевые смоки дельты — зелёные. Но целевой AC7-evidence
смок, при точечной проверке глубже штатной ассерции, обнаруживает находку H1.

## 3. High — блокирующие находки

### H1. AC7 всё ещё нарушен: Static-карточка рисует сплошную стену прямо по месту прохода после миграции в v8

**Файл:** `src/space-render.ts:437` (`renderSpaceStatic`, канонический геометрический
union стен для Static-карточки) — строка **не входит в дельту r2→r3** (не
менялась ни в `20f5c396`, ни в любом более раннем коммите #282), но её
поведение изменилось из-за самой Stage 1: до миграции проход без хозяина не
имел `opening.host` вовсе; после миграции в v8 **любой** не-partition opening
получает `host: {kind:'wall', id, t}` (`hostRoomOpenings`,
`src/wall-segment-model.ts:531-557`, не тронут дельтой, но это и есть
источник новых входных данных для строки 437).

```ts
// src/space-render.ts:434-443 (без изменений в этой дельте)
const canonicalWallGeometry = needsCanonicalWallGeometry
  ? cachedStaticWallGeometry(o.cfg, space.id, wallGeometryFingerprint, () => wallBodiesUnionPath(
    space.rooms, walls, [], [
      ...staticPassages.filter((opening) => !opening.host).map((opening) => ({
        x: opening.rx, y: opening.ry, angle: opening.angle, length: opening.rlen,
      })),
      ...hostedCompositeOpenings,
    ], GRID_STEP_N, cellCm, GRID_PITCH, NORM_W, extras,
  ))
  : null;
```

Ровно двумя строками выше, в этой же дельте, H2(r2) закрыт правильным
паттерном: `opening.host?.kind !== 'partition'` / `!opening.host ||
opening.host.kind === 'wall'` (строки 221, 279). Строка 437 использует старый
одноусловный `!opening.host` — единственное оставшееся место в файле с этим
паттерном (проверено `grep -n "\.host\b" src/*.ts`: везде, где встречается
`opening.host`/`o.host` вне `space-render.ts:437`, различение
`kind === 'wall'` уже сделано — `plan-geometry-preflight.ts:207,259`,
`houseplan-card.ts:9204`, и сам `space-render.ts:221,279`).

**Последствие:** после того как пространство мигрирует в v8 (любое структурное
редактирование, Optimize, либо просто открытие Plan-редактора), обычный
(не-partition) `passage` получает `host.kind === 'wall'` и **выпадает** из
списка вырезов, который `wallBodiesUnionPath` вычитает из сплошной кладки —
масонри рисуется **сплошным** прямо по месту прохода. Декоративная заливка
тоннеля (`passageDataTunnels`, не затронута багом) продолжает рисоваться, но
раньше в DOM-порядке (`space-render.ts:540/544` против `545` для
`.wallbodies`) — сплошная стена рисуется поверх неё. Проход, который ТЗ
называет «negative architecture» (комментарий в самом
`demo/smoke_open_passage.mjs:1-3`), визуально становится обычной глухой
стеной на Static-карточке.

`showBorders` (стены вообще рисуются на Static) по умолчанию **включён**
именно для пространств без залитого plan-изображения (`src/logic.ts:1265`,
`showBorders: s.show_borders ?? noPlan` — «spaces without a plan default to
visible markup») — то есть для основного онбординг-сценария J4
(`docs/SCOPE.md`: «от нуля до плана за вечер... draw»), не для редкого угла.

**Доказательство (исполнено, не только прочитано):**

1. Точечный прогон чистой функции с продукционными константами проекта
   (`GRID_STEP_N=1/240`, `GRID_PITCH=1000/240`, `NORM_W=1000`), скомпилированной
   тем же `tsc -p tsconfig.test.json`, что используют штатные unit-тесты:
   ```
   wallBodiesUnionPath(rooms, walls, [], [passage], ...).d
     → "M 491.67 100 L 508.33 100 L 508.33 455 L 491.67 455 Z
         M 491.67 545 L 508.33 545 L 508.33 900 L 491.67 900 Z"   (разрыв есть)
   wallBodiesUnionPath(rooms, walls, [], [], ...).d
     → "M 491.67 100 L 508.33 100 L 508.33 900 L 491.67 900 Z"   (сплошная стена)
   ```
   Присутствие/отсутствие объекта прохода в 4-м аргументе детерминированно
   решает, будет ли в стене разрыв — то есть исключение `host.kind==='wall'`
   этим фильтром гарантированно убирает разрыв.

2. Полный браузерный прогон: **локальная копия** (вне репозитория, не
   коммитилась и не будет) `demo/smoke_open_passage.mjs` с одной добавленной
   диагностикой — чтением `d` у реального `<path>` внутри `.wallbodies` на
   том же самом fixture, что и штатный смок (проход `passage-main`,
   `x=0.5,y=0.45,length=0.1`, стена `cm:20`, после реального
   `_saveOpening()` → `_commitPhysicalGeometry` → v8), собранная тем же
   `npm run build && npm run bundle:sync`, что и остальные гейты этого
   раунда:
   ```
   "wallbodyPathCount": 2,
   "wallbodyD": "M 491.67 200 L 508.33 200 L 508.33 700 L 491.67 700 Z
                  || M 491.67 200 L 508.33 200 L 508.33 700 L 491.67 700 Z",
   "wallVerticesNearPassage": []
   ```
   Оба пути — сплошной прямоугольник от y=200 до y=700, разрыва у y=450
   (центр прохода) нет. Воспроизведено дважды, детерминированно.

3. Почему штатный `smoke_open_passage.mjs` (тот, что числится evidence AC7 в
   самом ТЗ, §-«Доказательство: source guard + projection snapshots +
   existing geometry suite») это пропускает: его единственная проверка формы
   — `staticCutsAndFillsPassage = !!staticRoot.querySelector('.wallbodies') &&
   !!staticRoot.querySelector('.static-opening-tunnels [data-kind="passage"]')`
   — оба селектора существуют независимо от того, вырезана ли стена: группа
   `.wallbodies` рендерится, если есть стены вообще, а тоннель считается по
   отдельному, не затронутому багом пути (`passageTunnelGeometry`, строки
   444-452, использует нефильтрованный `staticPassages`). Проверка смотрит на
   присутствие DOM-узлов, а не на геометрию пути — она не может упасть на
   этом классе дефекта ни сейчас, ни раньше.

**Дополнительно:** `docs/CHANGELOG.md`/`.ru.md`, добавленные тем же коммитом
`20f5c396`, который закрывал H2(r2), формулируют это как решённое: «The
compact space card keeps wall-hosted doors, windows, gates **and passages**
visible after the migration as well» / «...двери, окна, ворота **и проходы**,
привязанные к стенам». Для дверей/окон/ворот это верно (они не проходят через
`wallBodiesUnionPath` вовсе — Static рисует их старым символьным путём).
Для проходов утверждение неточное: символ и тоннель-заливка видимы, но
физический вырез в кладке — нет.

**Итог:** прямое нарушение AC7 («projection даёт текущим full, static...
consumers прежние inputs»; сам ТЗ называет доказательством именно
«existing geometry suite», и это ровно тот тест, который проверка выше не
способна исполнить содержательно) на документированной поверхности продукта
(`houseplan-space-card`, `ARCHITECTURE.md` «Second card», с v1.16.0),
конфликт с J1/J2 `docs/SCOPE.md` (план должен показывать, что происходит и
где — «negative architecture» превращается в глухую стену), тот же класс
дефекта, что и H2(r2), только один код-путь глубже в той же функции. Блокирует.

## 4. Medium — по существу задачи

Новых находок Medium нет. Мелкое наблюдение без действия: `smoke_near_axis_optimize.mjs`
ослабил проверку точного соответствия индексов вершин (`north.poly[1] ===
south.poly[0]`) до `.some(point => samePoint(...))` — без сопроводительного
комментария, чем вызвано изменение порядка точек. Не поднимаю до находки:
сама геометрическая позиция всё ещё проверяется байт-точно, теряется только
проверка порядка индексов, который не является частью ни одного AC.

## 5. Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** — `npm test` красный: `validate_opening_passages(` встречается 3 раза в `websocket_api.py`, тест ожидал 2 | `test/open-passage-contract.test.mjs:76-82` теперь ожидает 3 и явно матчит оба вызова (до и после барьера v7→v8) по тексту | `npm test` → 1334 passed / 1 skipped / **0 failed** (было 1329 passed / 1 failed) — перепрогнано мной |
| **H2** — AC7: `houseplan-space-card` теряет wall-hosted opening (символ/материализация) после v8 | `resolvedHosted` теперь `if (opening.host?.kind !== 'partition') return []`; `resolvedRawOpenings` теперь `if (!opening.host \|\| opening.host.kind === 'wall') return [opening]` | `src/space-render.ts:217-282`; `node demo/smoke_open_passage.mjs` → `staticDoesNotInventPassageSymbol`/`staticCutsAndFillsPassage` OK — перепрогнано мной. **Но** соседняя строка 437 этой же функции, отвечающая за физический вырез кладки под проходом, не была приведена к тому же паттерну — см. H1 этого раунда: класс дефекта H2(r2) закрыт не полностью, только для символа/материализации, не для геометрии кладки |

Находка закрыта частично: правка правильная и достаточная для того, что она
адресовала (материализация/символ), но не покрывает соседний код-путь той же
функции, потребляющий тот же новый `host.kind === 'wall'` — ровно та
проверка, которую сам документ r2 в итоговом абзаце (§9) явно рекомендовал:
«стоит проверить на этом же файле и другие пути, потребляющие opening.host…».

## 6. Унаследовано из r2

Дельта `0f54daf3..HEAD` не касается — принято на основании выводов r2
(`docs/reviews/CODE-REVIEW-282-r2.md`, HEAD на котором получен вывод —
`3588284f`/переименован в `0f54daf3`), которая сама наследовала это из r1
(`5adfdb5d`/`466a6765`):

- **Migration determinism/idempotence**, **backend-зеркало валидации**
  (unique-id, owner-count, dangling refs, edge-geometry parity,
  `_wall_catalog_projection`), **import/export remap**, **i18n-ключи**
  (`toast.wall_model_migration_blocked`, `toast.wall_model_client_outdated`,
  `gs.wall_segments_migrated`, `wall_model.reason.*`), **документация**
  (`WALL-THICKNESS.md`, `CANVAS.md`, `USER-GUIDE.{ru,}.md`, `TESTING.md`),
  **`config-field-registry.mjs`**, **три `wall-identity-*` мутанта
  mutation-gate**, **lineage hints** (`fixedTopologyWallLineageHints`),
  **off-grid guard база** (`wallModelOffGridValueCount`, до добавления
  `additionalAuthoredPoints` в этой дельте) — не в дельте r2→r3 (проверено
  `git diff --stat c75c77d5..HEAD`, приведён в §1), наследуется без
  переразбора.
- **Guard-порядок #278**, **8 именованных structural-smoke из H2(r1)** — файлы
  не в дельте r2→r3, наследуются из r2 §5/§6 (которая сама перепроверила их
  исполнением на своём HEAD).

Обоснование: находка этого раунда (H1) обнаружена не потому, что унаследованный
код изменился, а потому, что дельта r2→r3 (миграция `host.kind==='wall'`,
действующая с самого Stage 1, то есть с r1) впервые была прослежена до всех
потребителей `opening.host` в файле, который сама дельта модифицировала —
это ревизия по следу дельты (§2.10), а не расширение на несвязанный код.

## 7. Что проверено и корректно

- **Sun rays после структурного редактирования** (`cfc1bb06`,
  `src/houseplan-card.ts:15465-15471`) — фильтр окон-источников солнца
  заменён с `!o.host` на `o.host?.kind !== 'partition'` по той же причине,
  что и H2(r2); прочитано и подтверждено прогоном: `node demo/smoke_sun.mjs`
  → все проверки OK, включая переписанные `aboveThresholdDrawn`/
  `backAboveThreshold` (теперь защищены от `null` через `layer()?.`).
- **`additionalAuthoredPoints` в `_commitPhysicalGeometry`**
  (`src/houseplan-card.ts:7296-7367`) — открытая пользователем граница
  добавляет свои же конечные точки в список «авторских» точек до сравнения
  off-grid-счётчика, так что открытие границы на уже мигрированном плане не
  выглядит как рост шума и не блокируется собственным guard-ом; прочитано,
  подтверждено `node demo/smoke_openwall.mjs` → OK (все проверки), включая
  переработанный сценарий второго открытого пролёта через инструмент
  `boundary`, а не через прямую инъекцию `open_to`.
- **Явный ноль толщины не воскресает** (`src/houseplan-card.ts:12002-12010`,
  зеркалирование `next`→`wall_segments[].cm` до `_normalizeWalls`) — новый
  unit-тест `test/wall-segment-model.test.mjs` («an explicit canonical zero is
  not resurrected…») зелёный в составе `npm test`; логика прочитана и
  соответствует комментарию в коде.
- **Обновлённые смоки редактирования** (`smoke_resize_virtual_thick`,
  `smoke_near_axis_optimize`, `smoke_optimize_coincident_partition`,
  `smoke_resize_outer_reconciliation`, `smoke_wall_thickness`) — изменения
  адаптируют ассерции к тому, что после Optimize/Resize пространство законно
  становится v8 и все openings несут `host.kind==='wall'`; новый предикат
  `wallHostResolves` проверяет не только присутствие `host`, но и то, что он
  реально резолвится к существующему `wall_segments[]` — это усиление
  проверки, не ослабление; все 6 файлов перепрогнаны мной, зелёные.
- **Model invariants на реальной нагрузке** (`large-house`, 3486 координат) —
  0% шума у узла до и после `commitWallSegmentModel`, ссылки разрешимы —
  перепрогнано мной с нуля (собственный дамп фикстуры), не только принято из
  хендоффа автора.
- **Трейлеры** — все 5 коммитов дельты (`20f5c396`, `cfc1bb06`, `ad54716d`,
  `063026bc`, `95fa23ca`) несут `Issue: #282`; два `User-Visible: yes`
  (`20f5c396`, `cfc1bb06`) правят оба changelog в том же коммите (проверено
  `git show --stat` на каждом).
- **CI на точном SHA** — смоки (3 шарда), golden, performance, backend,
  frontend, hacs, hassfest зелёные (первый прогон, за вычетом инфраструктурного
  сбоя `process-gate` от force-push); повторный прогон закрыл `process-gate`
  и легитимно переиспользовал тяжёлые джобы (побайтово идентичные входы).

## 8. Чего не проверял и почему

- **`pytest tests_backend`** — не запускался: backend не входит в дельту
  r2→r3 вовсе (все 17 изменённых файлов — frontend/demo/docs), не требуется
  в этом раунде; полный HA-харнесс остаётся Linux CI-гейтом.
- **Mutation gate, полный `performance_smoke`, `golden:verify` локально** —
  не перепрогонялись мной отдельно: ни один из трёх поимённых
  `wall-identity-*` мутантов не задет дельтой (файлы вне диффа), а
  golden/performance покрыты зелёным CI-прогоном на точном SHA (§2) — считаю
  это достаточным для этих трёх пунктов в данном раунде.
- **7 «слабая связь» смоков** (`smoke_align_guides` и другие, связь только по
  `_path`) из полного `origin/dev..HEAD` смок-подбора — не прогонялись:
  методология не изменилась с r2, найденная блокирующая находка (H1) уже
  достаточна для возврата, а сама находка обнаружена не через этот список, а
  через целевой разбор дельты.
- **Глубокий аудит остальных потребителей `.host` за пределами
  `space-render.ts`** (hidden-isometric, `iso-openings.ts`) — точечно
  проверено (`grep` не находит там обращений к `.host` вовсе — изометрия
  потребляет уже резолвленные `_openingsR` из `houseplan-card.ts`, где паттерн
  подтверждённо корректен ещё с r2), но не воспроизведено исполнением
  отдельным браузерным прогоном — риск ниже, чем у Static, так как код там
  не содержит собственного `!opening.host`-фильтра.

## 9. Резюме

Красный вердикт, третий подряд, но предметно иной находке, чем r1/r2: обе
находки r2 (H1, H2) закрыты — H1 полностью и подтверждено исполнением
(`npm test` зелёный), H2 закрыт для символа/материализации, но не для
физического выреза кладки под проходом в той же функции того же файла.
Именно этот непокрытый код-путь — `src/space-render.ts:437` — воспроизведён
исполнением (не только прочитан) как реальный дефект: Static-карточка рисует
сплошную стену прямо по месту прохода на любом пространстве, мигрировавшем в
v8, если проход не привязан к перегородке. Это прямое нарушение AC7 задачи на
документированной, реально используемой поверхности продукта, в сценарии, где
стены по умолчанию видимы (J4, безкартиночный план).

Задача возвращается в «В разработке». Фикс структурно локален (тот же паттерн
`opening.host?.kind !== 'partition'` уже применён двумя строками выше в этом
же файле) и не должен требовать полного повторного разбора подсистемы в r4,
если дельта останется ограничена этой строкой и её прямыми следствиями —
но стоит одновременно перепроверить, не остался ли где-то в проекте ещё один
потребитель `opening.host` с тем же устаревшим одноусловным `!opening.host`
(в этом раунде такой список исчерпан `grep`, но `grep` не ловит эквивалентную
логику, выраженную иначе).
