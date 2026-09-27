# CODE-REVIEW-564-r2

**Issue:** #564 — «В узкой колонке нажатие достаётся соседнему маркеру: круг 44 px без разрешения перекрытий»
**Заход:** r2 (второй заход код-ревью; циклов ревью кода потрачено 1/4 — потрачены на жёлтый вердикт r1, зелёный вердикт бюджет не тратит, #227)
**Материал:** зафиксирован на точном SHA `032616f2237a8de5c5cbc2c125267a09902c2594`. Рабочая копия уже на нём; `git fetch`/`checkout` не выполнялись.

## Предыдущий раунд и дельта

Вердикт r1 (документ `docs/reviews/CODE-REVIEW-564-r1.md`, материал зафиксирован на SHA
`0af582daa56632736560df0bff6c78f778618c5a`) — **жёлтый**, единственная блокирующая находка
**M1 (Medium, в скоупе)**: AC2 требовал обязательным доказательством, помимо чистой unit-матрицы,
ещё и browser smoke для Icon/Text/Double/legacy capsule во всех четырёх направлениях; в диффе
r1 такого прогона не было — только синтетические прямоугольники (unit) и один реальный
браузерный прогон на обычных Icon-маркерах без direction-вариаций.

Дельта раунда: `git diff 0af582da..032616f2` — ровно один продуктовый коммит:

```
032616f2 test: покрыть реальные капсулы маркеров (#564)
```

(коммит `27126ad3` между ними — публикация документа ревью r1, не код). Диапазон
`origin/dev..HEAD` не менялся между раундами (`git merge-base origin/dev HEAD` = `a65c88bc`,
то же самое дерево `dev`, что и на r1) — ребейза не было, дельта локальна.

Изменённые файлы дельты:

```
demo/smoke_device_hit_capsules.mjs | 252 ++++++++++++++++++++++++++
docs/TESTING.md                    |  10 +-
scripts/mutation-registry.mjs      |  12 ++
```

Ни один файл дельты не лежит в `src/**` — `node scripts/smoke-select.mjs --base 0af582da --head
032616f2` подтверждает: «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не
выбираются». Это ожидаемо: правка добавляет тест и мутанта, не трогая резолвер.

**Разбор этого раунда ограничен дельтой** (§2.10): полноценно перепроверено только то,
до чего дельта дотягивается — доказательство AC2 и связанный с ним мутационный виджет AC9.
Остальные AC (AC1, AC3–AC8, AC10, AC11) не имеют изменившегося доказательства в дельте и
наследуются из r1 (раздел ниже), кроме дешёвых гейтов, которые прогнаны заново, как требует
правило «дешёвые гейты — каждый раунд».

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium, в скоупе) — AC2 не имел browser-smoke доказательства painted-priority для Icon/Text/Double/legacy capsule во всех четырёх направлениях | Новый `demo/smoke_device_hit_capsules.mjs`: рендерит реальные Icon (`static_icon`), Text (`display: value`), Double (`badge` + явный `value_badge`) и legacy (`badge` без `value_badge` → авто-производный двухзначный legacy-режим, `legacySupplementalMetrics` в `src/device-face.ts:35-48`) маркеры, по каждому — 4 кардинальных направления (`pos-right/bottom/left/top` для with-values типов, все 4 стороны painted core для Icon/Text). Соседа `hit-neighbour` кладёт раньше в DOM/index order и позиционирует так, что тестовая точка лежит строго в invisible 44 px floor соседа и вне его painted capsule, но внутри painted capsule цели. Проверяет одновременно `elementFromPoint` (нативный DOM hit-test), `_deviceHitOwnerAt` (семантический owner) и настоящий `page.mouse.click` с открытием info card. Плюс именованный мутант `dense-device-hit-browser-skips-painted-priority` (`scripts/mutation-registry.mjs`), который отключает `if (painted.length) return nearest(painted, point)` в `src/device-hit-owner.ts:77`. | Прогнано в этом раунде: `node demo/smoke_device_hit_capsules.mjs` → `{"realFaceKinds":true,"allSixteenCasesRan":true,"everyPaintedPointOwnsNativeAndSemanticHit":true,"everyPaintedPointOwnsClick":true}` / `OK`. `node scripts/mutation-gate.mjs --id=dense-device-hit-browser-skips-painted-priority` → «чистый прогон» зелёный, мутант «покраснел» → «поймано 1 из 1». `docs/TESTING.md:552-557` теперь называет обе строки доказательства AC2 явно. |

Других блокирующих находок в r1 не было (High: 0).

## Унаследовано из r1

Документ: `docs/reviews/CODE-REVIEW-564-r1.md`, материал зафиксирован на SHA
`0af582daa56632736560df0bff6c78f778618c5a`. Принято без повторной проверки в этом раунде, потому
что дельта (`032616f2`) не касается их доказательств:

- **AC1** — J7 390/780 px, реальный click → dense1..dense5 (`demo/smoke_household_journeys.mjs`,
  не тронут дельтой);
- **AC3** — минимум 44×44 не уменьшен (`.dev::before` не изменён дельтой r2 по значению);
- **AC4** — латч владельца pointerdown→pointerup/cancel (`src/device-hit-owner.ts`,
  `test/device-hit-owner.test.mjs` — не тронуты дельтой);
- **AC5** — hover/tooltip у ближайшего owner, touch/pen без ложного mouse-hover;
- **AC6** — pinch/#563-совместимость (`src/touch-gesture-click-guard.ts` не тронут);
- **AC7** — детерминированный tie-break, изоляция карточек, фильтр hidden/removed/other-space;
- **AC8** — отсутствие per-frame layout scan, кэш с инвалидацией по контракту;
- **AC10** — typecheck/unit/build в цикле реализации, smoke/golden/perf — до беты;
- **AC11** — схема/координаты/action settings/i18n/backend API не менялись;
- трейлеры и changelog пяти коммитов диапазона `origin/dev..0af582da`;
- `check-docs`, `no-new-any`, байтовая идентичность бандла и скриншотов на момент r1.

Два из трёх именованных мутантов AC9, унаследованных из r1 (`dense-device-hit-falls-back-to-input-order`,
`device-touch-hover-gate-removed`, `zigbee-topology-hovered-endpoint-elevation-removed`), не
изменены дельтой — тем не менее перепроверены заново в этом раунде вместе с дешёвыми гейтами
(см. ниже), а не приняты слепо, поскольку это стоит недорого и дельта физически меняет тот же
файл `scripts/mutation-registry.mjs`, в который они прописаны.

## Как проверялось

Дешёвые гейты — гоняются в каждом раунде независимо от дельты:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Build + синхронизация трёх копий бандла | `npm run bundle:sync` (запускает `build`), затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp … demo/srv/assets/houseplan-card.js` | зелёный, все три копии побайтово идентичны; `git status` после — чисто, новых diff'ов не осталось |
| `node scripts/no-new-any.mjs --base 0af582da --head 032616f2` | ручной прогон | «Новых any нет» (0 добавленных строк в `src/**/*.ts` — дельта не трогает `src/**`) |
| `node scripts/check-docs.mjs` | ручной прогон | `Documentation checks passed (7 files, 12 external links)` |
| `npm test` (2691 unit) | **не перегонялся** | подтверждён зелёным Validate на точном SHA `032616f2` (см. ниже) — правило «дешёвые гейты не перегонять, если Validate зелёный на этом SHA» |

CI Validate на точном SHA подтверждён напрямую, не только по ссылке автора:
`gh run view 34794194982` → `{"conclusion":"success","headSha":"032616f2237a8de5c5cbc2c125267a09902c2594","name":"Проверка (CI)","status":"completed"}`.
https://github.com/Matysh/houseplan-card/actions/runs/34794194982

Гейты по дельте (M1/AC2/AC9):

| Гейт | Команда | Результат |
|---|---|---|
| Новый browser smoke | `node demo/smoke_device_hit_capsules.mjs` | зелёный, все 16 случаев (`allSixteenCasesRan`), painted-приоритет и click подтверждены |
| Новый мутант | `node scripts/mutation-gate.mjs --id=dense-device-hit-browser-skips-painted-priority` | «поймано 1 из 1» |
| Унаследованные мутанты AC9, перепроверены т.к. общий файл реестра изменён | `node scripts/mutation-gate.mjs --id=dense-device-hit-falls-back-to-input-order` / `--id=device-touch-hover-gate-removed` / `--id=zigbee-topology-hovered-endpoint-elevation-removed` | все три — «поймано 1 из 1» |
| `smoke-select` по дельте | `node scripts/smoke-select.mjs --base 0af582da --head 032616f2` | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» — корректно, дельта не трогает `src/**` |
| Трейлеры/changelog коммита дельты | `git show -s --format=full 032616f2` | `Issue: #564`, `User-Visible: no` — оба класс-B файла (`demo/**`, `scripts/**`) плюс `docs/TESTING.md`; changelog не требовался и не тронут (`git diff 0af582da..032616f2 -- docs/CHANGELOG.md docs/CHANGELOG.ru.md` пуст) |

**Не прогонялись в этом раунде** (осознанно): `golden:verify`, полный `performance_smoke`,
`pytest tests_backend`, полный набор из 248+ смоков и 15 смоков, выбранных под r1 (household
journeys, drag/modes/align/history/grid-snap/pan-zoom/static-icon/wireless-parity/touch-
tips/feedback/room-tooltip/room-fit, linked-light) — они уже прогнаны в r1 на SHA `0af582da`,
дельта их файлы не трогает, и `smoke-select` по дельте не выбрал ни одного из них. По AC10/ТЗ
§10 golden/perf/pytest остаются пред-релизным гейтом.

## Находки

Новых находок нет. High: 0, Medium: 0.

## Проверено и корректно

- **AC2 закрыт полностью**: painted core/capsule реально выигрывает у невидимого floor соседа
  для всех четырёх типов лица маркера (Icon/Text/Double/legacy) и всех четырёх направлений
  капсулы, подтверждено настоящим DOM (`getBoundingClientRect`, `elementFromPoint`) и настоящим
  кликом мыши, не только семантическим резолвером. Отображение типов в `demo/smoke_device_hit_
  capsules.mjs` сверено с реальной логикой `renderDeviceFace` (`src/device-face.ts:92-101`,
  `legacySupplementalMetrics` строки 35-48) — `badge.configured !== false` действительно даёт
  auto-derived двухзначный `with-legacy` путь, что подтверждает `setup.realFaceKinds: true` в
  выводе смока.
- Мутант `dense-device-hit-browser-skips-painted-priority` бьёт именно по строке приоритета
  painted-областей (`src/device-hit-owner.ts:77`, `if (painted.length) return nearest(painted,
  point)` → `if (false && painted.length) …`) и красит новый смок, не другие тесты — точечность
  подтверждена независимым прогоном.
- Дешёвые гейты (typecheck, build+3 копии бандла, no-new-any, check-docs) — зелёные при
  собственном прогоне на этом SHA; unit-набор из 2691 теста подтверждён зелёным Validate на
  точном SHA, факт green-конклюжна проверен напрямую через `gh run view`, а не только со слов
  автора.
- Трейлеры и класс изменённых файлов корректны: `demo/**`, `scripts/**`, `docs/TESTING.md` —
  класс B/C, `Issue: #564` присутствует, `User-Visible: no` оправдан (тестовая инфраструктура,
  без изменения поведения) и changelog не требовался.
- Дельта не расширяет scope и не трогает `src/**`, `custom_components/**`, схему конфигурации,
  координаты маркеров или action-контракты — согласовано с ТЗ §4 «Не входит в задачу».

## Чего не проверял

- `npm test` целиком не перегонялся — заменён подтверждённым зелёным Validate на точном SHA
  `032616f2` (см. таблицу выше), что соответствует явному разрешению для этой задачи: дешёвые
  гейты не дублируются, если green Validate уже назван на этом SHA.
- Golden-эталоны, полный `performance_smoke`, `pytest tests_backend`, полный набор browser-
  смоков и 15 смоков r1 — не гонялись повторно: делта их не касается (`smoke-select` подтверждает
  «выбирать нечего»), а по ТЗ §10/AC10 golden и perf в любом случае пред-релизные гейты.
- Кросс-браузерное поведение `click instanceof PointerEvent` (риск, отмеченный в r1 как контекст,
  не находка) — не переисследовалось, дельта его не касается.
- Ручного тестирования в браузере поверх automated smoke не проводилось — весь браузерный
  прогон в этом раунде выполнен через `demo/smoke_device_hit_capsules.mjs` (Playwright/Chromium),
  что и есть требуемое AC2 browser-доказательство.

## Материал раунда

- Ветка: `issue/564-dense-marker-hit` (по комментариям issue); рабочая копия — detached HEAD на
  `032616f2237a8de5c5cbc2c125267a09902c2594`.
- `git rev-parse HEAD` = `032616f2237a8de5c5cbc2c125267a09902c2594`.
- `git merge-base origin/dev HEAD` = `a65c88bc11db09c65afe1d59ab1c51fdd01a6f30` — то же дерево
  `dev`, что и на r1; ребейза между раундами не было.
- Материал r1 для сравнения: SHA `0af582daa56632736560df0bff6c78f778618c5a`, документ
  `docs/reviews/CODE-REVIEW-564-r1.md`.

## Вердикт

Зелёный. Единственная блокирующая находка r1 (M1) закрыта исполняемым browser-smoke и именованным
мутантом, оба перепроверены в этом раунде и умеют падать. Новых находок нет, High: 0, Medium: 0.
Дешёвые гейты зелёные (частично перепрогнаны вручную, частично подтверждены Validate на точном
SHA). Issue готова к переходу в `S8-merged` по завершении промоушена.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/564-dense-marker-hit`, коммит `032616f2237a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `621d422b3a6cfc589a8659e8c6e9dc55c94b6b13`
  ```
  git log --all --format='%H %T' | grep 621d422b3a6c
  ```
- Тело issue: `f958e178616c6d48277f99106f9d84e76de72762c0c7b3e6f315231ff1cfec08`
- Вердикт конвейера: `green` · High 0
