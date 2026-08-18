# Code review — issue #150, cycle r1

Вердикт: **красный** · цикл r1/4 · High: 1 · Medium: 0

Ветка: `issue/150-wall-thickness-transition-fix` · implementation-коммит
[`1975d1a`](https://github.com/Matysh/houseplan-card/commit/1975d1ae3784a0b98cf2f489910370f37417a1c6)
на базе `origin/dev` (`a05aa5d`) · ТЗ:
[`docs/specs/150-wall-thickness-transition.md`](../specs/150-wall-thickness-transition.md)
(r2, зелёный `SPEC-REVIEW-150-r2`, High: 0 · Medium: 1 → #171, комментарий issue
от 2026-08-18T08:40:34Z).

Примечание по трассировке: чекаут, выданный ревью по умолчанию, стоял на
`origin/issue/150-wall-thickness-transition` (спек-ветка, коммит `003a9b5`),
которая **не содержит** фикса. Продуктовый код лежит в отдельной ветке
`issue/150-wall-thickness-transition-fix` (коммит `1975d1a`), на неё явно
указывает хендофф-комментарий владельца от 2026-08-18T08:49:25Z. Весь разбор
ниже сделан по `git diff origin/dev...origin/issue/150-wall-thickness-transition-fix`.

## Скоуп проверки

Диапазон `git diff origin/dev...HEAD` (13 файлов):

- ядро — `src/wall-thickness.ts` (14 строк: `pointOnSegment`,
  `exteriorBoundaryProfile`);
- тесты — `test/wall-thickness.test.mjs` (+172 строки: 3 новых теста, 2 новых
  probe-хелпера через `intersection`);
- новый browser smoke — `demo/smoke_wall_thickness_transition.mjs`;
- документация — `docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md`,
  `docs/TESTING.md`, `docs/specs/README.md`, оба changelog;
- три копии бандла (`dist/`, `custom_components/houseplan/frontend/`,
  `demo/srv/assets/`).

Единственный implementation-коммит `1975d1a`: трейлеры `Issue: #150` ·
`User-Visible: yes`; оба changelog обновлены в этом же коммите — требование
выполнено. Ветка называется `issue/150-…`, соответствует диапазону.
`custom_components/**/*.py`, i18n JSON и `src/types.ts` не затронуты —
согласуется с ТЗ §10/§14 (без миграции, без бэкенда, без i18n).

## Как проверялось

Работа велась в отдельном git-worktree на `origin/issue/150-wall-thickness-transition-fix`
(`node_modules` не переустанавливался — симлинк на уже установленный каталог
основного чекаута, `npm ci` не запускался).

Дешёвые гейты (всегда):

- `npx tsc --noEmit` → **зелёный**, без вывода.
- `npm test` → **831/831 green**, совпадает с числом из хендоффа.
- `npm run build` → зелёный; свежая сборка побайтно совпала со всеми тремя
  закоммиченными копиями (`sha256 74f35a36…c90f2d` — тот же хэш, что в
  хендоффе).

Дисциплина «тест умеет падать» — проверено вручную, а не на слово автора:
временно откатил ровно эти 14 строк `src/wall-thickness.ts` до состояния
`origin/dev` (в рабочей копии, без коммита) и перезапустил `npm test`.
Результат: **828/831**, ровно 3 новых теста краснеют —

```
not ok 792 - production-scale Split keeps the 10 → 0 facade transition at the divider
not ok 793 - production-scale collinear transitions keep both local depths in either direction
not ok 794 - production-scale 45° facade keeps an exact unequal-thickness breakpoint
```

— все остальные 828 тестов, включая существовавшие ранее регрессии по #123/#141,
не задеты. Это подтверждает: тесты не вакуальны и действительно проверяют
именно исправленный механизм, а не что-то попутное. Файл восстановлен обратно
после проверки.

Гейты по необходимости (diff меняет каноническую геометрию рендера/света, и
под задачу заведён именной smoke, названный в AC7):

- `node demo/smoke_wall_thickness_transition.mjs` (AC7 требует
  `[smoke + golden]`) — **упал**: 3 из 11 проверок `false`. Разбор — в разделе
  «Находки», это блокирующий High.
- Регрессионные smoke смежных задач и поверхностей, которые тот же
  `exteriorBoundaryProfile()`/`wallBodiesGeometry()` обслуживает:
  `demo/smoke_split_corner_wall.mjs` (#123, corner Split facade) — **зелёный**,
  все 13 проверок `true`; `demo/smoke_wall_junctions.mjs` (#141, независимые
  стыки) — **зелёный**, все 12 `true`; `demo/smoke_wall_thickness.mjs` — **зелёный**,
  все 17 `true`; `demo/smoke_opening_tunnel_fill.mjs` — **зелёный**, все 13
  `true`; `demo/smoke_draw_wall_thickness.mjs` — **зелёный**, все 11 `true`.
  Полный набор (127 файлов) не прогонялся — диф не задевает openings/сборку/
  editor UI за пределами толщины стен, прогон всех непропорционален узкому
  геометрическому фиксу.
- `npm run golden:verify` — **не прогонялся**. ТЗ §13 и хендофф автора прямо
  относят golden к предрелизному гейту по §11.4/AGENTS.md «Gates»; новых
  golden-сценариев в этом диффе нет (они по плану добавляются перед бетой).
  Риск в отношении уже существующих golden-сценариев закрыт достаточно другим
  способом: диф меняет только внутренний допуск в двух функциях одного файла,
  используемых исключительно при коллинеарном разрыве толщины — сценарий,
  которого в существующей golden-матрице не было (это и есть суть бага),
  так что регресс существующих baseline-кадров маловероятен; кроме того,
  зелёные regression-smoke выше покрывают ту же геометрическую функцию на
  смежных сценариях.
- `python -m pytest tests_backend` — не прогонялся: Python не тронут ни одним
  файлом диффа.
- performance-профили — не прогонялись: изменение — один дополнительный
  `Math.sqrt`/деление на уже существующий per-edge проход, не новый
  O(n²)/O(n·m) путь; ни ТЗ (AC11), ни диф не дают повода подозревать
  регресс, а полный performance-прогон — предрелизный гейт.

## Находки

### [High] Собственный AC7-smoke красный при первом запуске — фикстура не включает `show_borders`, а не дефект геометрии

**Файл:** `demo/smoke_wall_thickness_transition.mjs:44-58` (инициализация
фикстуры перед `_setMode('view')`/static/iso).

**Воспроизведено запуском, не только чтением:**

```
node demo/smoke_wall_thickness_transition.mjs
```

```json
{
  "splitDialog": true, "splitCommitted": true, "leftWallSelected": true,
  "savedIntervals": true, "planFullDepth": true, "planZeroSideClear": true,
  "paperZeroSideClear": true,
  "viewMatchesPlan": false,
  "lightUsesSteppedMasonry": true,
  "staticMatchesPlan": false,
  "hiddenIsoMatchesCanonical": false
}
FAILED (3): viewMatchesPlan, staticMatchesPlan, hiddenIsoMatchesCanonical
```

Ровно те три проверки, которые доказывают AC7 (единая геометрия Plan/View/
static/hidden Iso) — красные. Причина не в проекте `src/wall-thickness.ts`:
`_renderWallBodies()` (`src/houseplan-card.ts:10389-10392`) и симметричный код
static/iso-рендера пропускают отрисовку стен целиком, если `disp.showBorders`
ложно, а в режиме `view`/`devices` возвращают пустой `svg`:

```ts
private _renderWallBodies(disp: SpaceDisplay): TemplateResult {
  if (this._renderProjection === 'iso') return svg`` as unknown as TemplateResult;
  if (disp && !disp.showBorders && (this._mode === 'view' || this._mode === 'devices'))
    return svg`` as unknown as TemplateResult;
  …
```

Фикстура смока удаляет `walls`/`openings`/`open_spans`/`partitions`/
`room_drafts`/`wall_columns` из клона серверного конфига, но **не** выставляет
`space.settings.show_borders = true`, поэтому `showBorders` остаётся ложным
(дефолт для нового плана) и `[data-hp="wall"]` в режимах `view`/static/iso
попросту отсутствует в DOM — `viewD`/`staticD` пустые, `isoWalls` пустой.
Отдельно проверил через `page.evaluate` (`viewPathExists === false`,
`planD.length === 351`, `viewD.length === 6`) — путь для View не существует
вовсе, сравнение `viewD === planD` ложно тривиально, а не из-за расхождения
геометрии.

Прецедент того же класса задач уже решает эту проблему: соседний
регрессионный smoke `demo/smoke_split_corner_wall.mjs:54` (тоже про
Plan/View/static/iso-паритет фасада после Split, задача #123) явно ставит

```js
space.settings = { ...(space.settings || {}), show_borders: true };
```

перед переключением в View. В новом smoke этой строки нет.

**Подтверждение, что дефект — в фикстуре, а не в продукте:** взял копию
`demo/smoke_wall_thickness_transition.mjs`, добавил ровно ту же строку
(`space.settings = { ...(space.settings || {}), show_borders: true };`) сразу
после удаления полей конфига, пересобрал ничего (бандл не менялся) и
перезапустил — **все 11 проверок стали `true`**, включая
`viewMatchesPlan`/`staticMatchesPlan`/`hiddenIsoMatchesCanonical`, а
`viewD === planD` побайтно совпал. Это независимо подтверждает: сам
геометрический фикс в `src/wall-thickness.ts` работает верно и на
Plan, и на View, и на static, и на hidden Iso — реальный дефект есть только
в тесте, который должен был это доказать.

**Почему это блокирует, а не Low.** AC7 сформулировано как
`[smoke + golden]`; смок — единственное автоматическое доказательство именно
кросс-поверхностного паритета для этой задачи (golden отложен на
предрелизный гейт). Красный смок, дошедший до код-ревью, — ровно тот сценарий,
который `AGENTS.md` («Gates») явно называет дорогим («A red smoke that reaches
the review costs a cycle; run locally it costs a minute», со ссылкой на
прецедент #89) и который должен был отловиться локальным прогоном перед
переводом в `S7-code-review`. Хендофф-комментарий автора прямо говорит:
«по действующему процессу browser smoke не запускался в цикле реализации» —
но AC7 этой же задачи требует смок как доказательство, и в текущем состоянии
это доказательство отсутствует: `docs/WALL-THICKNESS.md` §8 и `docs/TESTING.md`
уже утверждают (со ссылкой на этот smoke), что паритет поверхностей
подтверждён — на актуальном коммите это не так.

**Требуется:** добавить `space.settings = { ...(space.settings || {}),
show_borders: true };` в фикстуру `demo/smoke_wall_thickness_transition.mjs`
(по образцу `smoke_split_corner_wall.mjs:54`) и приложить к следующему циклу
зелёный прогон именно этого smoke. Изменений в `src/wall-thickness.ts` для
этого не требуется — правка ограничена одним тестовым файлом.

## Что проверено и корректно

- **AC1 (data profile fixture, `coordScale = 1000`)** — юнит-тест
  `production-scale Split keeps the 10 → 0 facade transition at the divider`
  проверяет `top`/`divider` интервалы (`10`/`0`/`10`) именно на
  production-масштабе; проходит, и я подтвердил выше, что без фикса именно
  этот тест (и два соседних) красный.
- **AC2 (полное сечение 10 см = 5 наружу + 5 внутрь)** — тот же тест,
  `assertProbeInside`/`assertProbeOutside` на `half*0.75` и `half+0.2` по обе
  стороны centreline; корректно считает `half = wallCmToUnits(10, cellCm,
  GRID_PITCH) / 2`.
- **AC3 (точная ступень `10 → 0` на конце разделителя)** — unit-часть
  доказана (`assertProbeOutside(… [700, 96] …)`, `assertProbeOutside(…
  [700, 104] …)`, точка перехода на `x = 500` найдена в `geometry.geom.flat(2)`
  с допуском `1e-7`); golden-часть отложена на предрелизный гейт по плану ТЗ —
  не проверялась (см. «Чего не проверял»).
- **AC4 (матрица `0↔10`, `10↔20`, `1↔100`, оба направления, оба winding)** —
  тест `production-scale collinear transitions keep both local depths in
  either direction` перебирает ровно эту матрицу плюс равные толщины,
  сравнивает symmetric-difference площадей между прямым и развёрнутым
  winding (`closeTo(…, 0, 1e-7)` в обе стороны) — корректно.
- **AC5 (shared divider — полная толщина, без выступа наружу)** — тот же
  тест: `divider.length === 2`, `divider.every(iv => iv.cm === 10)`,
  `assertProbeOutside(… divider protrudes outside …)`.
- **AC6 (paper/clean floor/area по локальным depths)** — `assertProbeOutside`/
  `assertProbeInside` на `innerContourForRoom` обеих комнат и
  `geometry.paperGeom` на нулевой стороне — корректно; отдельно тест проверяет
  `JSON.stringify({rooms, walls})` неизменным до/после рендера (AC10).
- **AC7 (Plan/View/static/hidden Iso/свет — единая геометрия)** — **не
  доказано смоком как есть** (High выше); проверено независимо мной через
  исправленную копию фикстуры и regression-smoke #123/#141 — сам механизм
  общей канонической геометрии (одна функция `wallBodiesGeometry`/
  `exteriorBoundaryProfile` для всех потребителей, как описано в
  `docs/WALL-THICKNESS.md` §2) не менялся диффом за пределами двух
  проверенных функций, поэтому паритет поверхностей — тот же самый механизм,
  что уже подтверждён #123/#141 smoke, плюс моя ручная проверка.
- **AC8 (openings у transition)** — прямого нового теста на opening рядом с
  переходом в этом диффе нет, но `demo/smoke_opening_tunnel_fill.mjs`
  (существующий регресс на ту же геометрическую функцию) зелёный; диф не
  трогает association/opening-код (`OpeningWallIndex`, opening cut) —
  **проверено чтением, не отдельным исполнением новой сцены**: изменённые
  строки относятся только к `exteriorBoundaryProfile`/`pointOnSegment`,
  которые вызываются до/независимо от opening-cut пути.
- **AC9 (регрессии #123/#141 не открылись заново)** — `demo/smoke_split_corner_wall.mjs`
  и `demo/smoke_wall_junctions.mjs` зелёные целиком (см. «Как проверялось»);
  соответствующие unit-тесты (`corner Split …`, `linear wall joins …`) входят
  в те же 828 неизменных тестов при откате фикса.
- **AC10 (старый конфиг исправляется без миграции)** — юнит-тест явно
  сравнивает `JSON.stringify({rooms, walls})` до/после рендера; diff не
  добавляет новых полей в `WallEntry`/схему; подтверждено также diff'ом (нет
  правок в `src/types.ts`, нет migration-кода).
- **AC11 (кеш/fingerprint, HA tick не перестраивает topology)** —
  **проверено чтением, не исполнением**: диф не касается кеш-ключей/
  `_cfgEpoch`/`_wallUnionCache`/structural fingerprint — только внутренняя
  арифметика `pointOnSegment`/`exteriorBoundaryProfile`, вызываемых из уже
  существующего кешированного прохода; поведение кеша не изменено.
- **AC12 (fail-closed при сбое boolean)** — **проверено чтением**: код вокруг
  `exteriorBoundaryProfile`/`wallBodiesGeometry`, отвечающий за fallback при
  `null`/ошибке union, диффом не тронут.
- **Трейлеры/changelog/бандлы** — `Issue: #150` / `User-Visible: yes` на
  единственном коммите, оба changelog обновлены в нём же, три копии бандла
  побайтно совпадают со свежей локальной сборкой (см. «Как проверялось»).
- **Документация** — `docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md` §2/§8,
  `docs/TESTING.md`, `docs/specs/README.md` обновлены consistently с
  описанием причины (`t`/`eps` размерность) и списком потребителей; терминология
  соответствует уже принятой в `docs/WALL-THICKNESS.md` (`centreline ±½`,
  atomic interval, canonical masonry pass) — новых терминов не изобретено.
  Единственная неточность — `WALL-THICKNESS.md` §8 и `TESTING.md` уже
  утверждают зелёный кросс-поверхностный результат со ссылкой на
  `demo/smoke_wall_thickness_transition.mjs`, что на данный момент не так
  (см. High); текст документации менять не нужно — после починки фикстуры
  утверждение станет верным без правки самой документации.

## Чего не проверял

- **`npm run golden:verify` (полный набор)** — не прогонялся; см.
  обоснование в «Как проверялось». Новых golden-сценариев для #150 диф не
  добавляет — они по плану ТЗ идут перед бетой.
- **Полный browser smoke-suite (127 файлов)** — не прогонялся; прогнаны
  только именной AC7-smoke и 5 регрессионных smoke по тем же геометрическим
  функциям (#123, #141, толщина, тоннели проёмов, рисование с толщиной).
- **`python -m pytest tests_backend`** — не прогонялся, Python не тронут.
- **Performance smoke / Full Performance** — не прогонялись; изменение —
  O(1) на существующем per-edge проходе, ни ТЗ, ни диф не дают повода
  подозревать регресс.
- **Ручное визуальное сравнение в браузере (не headless)** — не выполнялось;
  вывод основан на unit/smoke harness и прямом воспроизведении через
  скомпилированный `test-build`/собранный бандл.
- **AC8 отдельным исполняемым сценарием** (opening ровно на transition) —
  разобран только чтением кода и косвенным regression-smoke; собственного
  прогона новой сцены «opening на переходе» не делал.

## Итог

High: 1 (собственный AC7-smoke красный из-за фикстуры, не из-за геометрии —
описано выше, блокирует). Medium: 0.

Вердикт красный: цикл возвращается автору на однострочную правку
`demo/smoke_wall_thickness_transition.mjs` (добавить `show_borders: true` в
фикстуру, по образцу `smoke_split_corner_wall.mjs:54`) и повторный зелёный
прогон именно этого smoke. Правка `src/wall-thickness.ts` не требуется —
геометрический фикс подтверждён как корректный независимо (юнит-тесты,
способные падать без него; regression-smoke #123/#141; ручной прогон
исправленной копии AC7-smoke).
