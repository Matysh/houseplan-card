# Issue #290 — не создавать молча почти осевые уступы

- **Issue:** https://github.com/Matysh/houseplan-card/issues/290
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P2
- **Оценка:** пользовательская ценность 8/10; ценность для разработки 8/10;
  сложность 9/10; риск 9/10
- **Область:** Walls drawing, safe Resize output, единый near-axis classifier,
  explicit Optimize preview/report/Undo, room/wall/opening rekey и invariants
- **Модель данных:** schema не меняется; существующая геометрия меняется только
  после подтверждения Optimize
- **Связано:** #141, #173, #223, #248, #277, #279, #284,
  `docs/CANVAS.md`, `docs/RESIZE.md`, `docs/WALL-THICKNESS.md`

## 1. Сценарий и подтверждённая причина

На реальном плане две комнаты хранят общее ребро от `(-401, 708)` до
`(-85, 709)` в индексах решётки: 316 шагов вдоль и ровно один поперёк. Угол
`0.181315°` неразличим на обычном зуме, но это законная grid geometry, поэтому
обычная канонизация и текущий Optimize её не меняют. Такой уступ уже потребовал
renderer tolerance в #279 и остаётся источником нестабильных junction inputs.

Проблема состоит из двух частей:

1. Walls/Resize не имеют единого authoring-правила, запрещающего почти
   горизонтальный/вертикальный результат;
2. Optimize не имеет явно разрешённого lossy pass и поэтому правильно считает
   существующий `316×1` каноническим.

## 2. Решения владельца

Зафиксированы 2026-08-24:

1. При создании ребро в пределах допуска автоматически выравнивается по
   ближайшей горизонтальной/вертикальной оси. Специального modifier bypass нет.
2. Существующие уступы исправляются отдельным lossy-пунктом Optimize с отчётом
   «Выпрямлено стен: N; максимальное перемещение: X» и только после общего
   подтверждения.
3. Единый допуск — отклонение не более `0.25°` от горизонтали или вертикали,
   тот же продуктовый порог, что использует устойчивый renderer #279.
4. Настоящие диагонали за пределами допуска не меняются.

Открытых продуктовых вопросов нет.

## 3. Пользовательский результат

При рисовании preview сразу показывает точную горизонталь/вертикаль, и click
сохраняет именно её. Resize никогда не оставляет почти осевой side/moving edge.
Для старого плана Optimize заранее показывает число исправляемых физических
стен и максимальный сдвиг; Cancel оставляет план byte-equivalent, Confirm даёт
одну Undo-операцию. Диагональные стены остаются диагональными.

## 4. Единая классификация

Один pure helper и одна экспортируемая константа являются источником для
authoring, Optimize и multi-wall renderer:

- `NEAR_AXIS_MAX_DEGREES = 0.25`;
- сравнение выполняется по нормализованному отношению minor/major component,
  эквивалентному `tan(0.25°)`; renderer может продолжать использовать
  эквивалентный dot/sine form для orthogonal pairs;
- граница включительна;
- zero-length не классифицируется;
- exact horizontal/vertical уже canonical и не считается исправлением;
- endpoint order, winding, coordinate scale и theme не влияют на результат.

Для exact grid edges это означает: `316×1` классифицируется, `316×2` — нет.
Порог не расширяется экранным zoom/tolerance и не поглощает полный grid step
на коротком сегменте, если угол превышает `0.25°`.

## 5. Authoring contract

### 5.1 Walls chain

После архитектурного endpoint/grid snap, но до hover preview и commit, free
endpoint сравнивается с anchor. Если сегмент near-axis, minor coordinate free
endpoint приравнивается minor coordinate anchor. Это точный grid node и один
результат для hover/click.

Architectural endpoint на соседнем узле не имеет более высокого приоритета,
если соединение создало бы запрещённый near-axis segment: авторская линия
остаётся exact-axis, а существующий узел не объявляется соединённым. Resolver
обязан показывать фактически сохраняемую точку; невидимый post-click rewrite
запрещён.

Shift сохраняет своё действующее 45°-ограничение. Оно сначала выбирает exact
45° ray и потому не превращается в near-axis. Ctrl/Cmd closure применяет то же
правило к closing edge; если выравнивание не замыкает exact first node, contour
не объявляется закрытым автоматически.

### 5.2 Resize

Safe Resize #277 по-прежнему принимает только exact horizontal/vertical input
с допуском на storage noise. Near-axis edge, существовавшая до задачи, не
становится автоматически eligible: для неё есть Optimize.

Каждый candidate Resize строится из axis/normal plan и перед preview проходит
тот же exact-axis postcondition. Любая minor-coordinate арифметическая погрешность
схлопывается на исходную axis; результат в пределах 0.25° не может быть
сохранён как уступ. Это не разрешает diagonal/partial-shared Resize и не меняет
topology. Если postcondition потребовал бы сдвинуть unrelated vertex, candidate
fail-closed вместо скрытой правки.

## 6. Explicit Optimize repair

### 6.1 Кандидаты

Lossy pass рассматривает room polygon edges, saved room drafts и independent
partitions после ordinary grid alignment. Physical shared wall считается один
раз независимо от двух room owners. Openings, open spans и wall thickness
records не являются отдельными кандидатами: они reproject/rekey из исправленной
host geometry существующим canonical pipeline.

Для near-horizontal edge рассматриваются две exact-axis цели `y=a.y` и
`y=b.y`; для near-vertical — `x=a.x` и `x=b.x`. Изменяется equivalence class
совпадающего topology endpoint во всех owners, чтобы shared centreline не
расходилась. Выбирается кандидат:

1. прошедший room simplicity/orientation, ownership, opening fit и production
   geometry preflight;
2. с меньшим максимальным физическим сдвигом;
3. при равенстве — сохраняющий endpoint с большим числом incident exact edges;
4. при полном равенстве — детерминированный lexicographic endpoint.

Кандидаты не каскадируют: список строится из immutable input, а конфликтующие
endpoint changes объединяются только если требуют одну и ту же target node.
Конфликт/невалидная цель остаётся неизменной и учитывается как skipped, а не
частично записывается.

### 6.2 Отчёт, Confirm и Undo

`OptimizeReport` получает как минимум:

- `wallsStraightened` — число уникальных physical segments;
- `maxStraightenShiftCm` и пространство, где достигнут максимум;
- `wallsStraightenSkipped` — число распознанных, но небезопасных кандидатов.

Диалог показывает отдельную строку, не смешивая lossy straightening с
`coordsCanonicalized` или обычным `moved`. Максимум — верхняя граница по всем
реально перемещаемым endpoints через `cell_cm` собственного пространства.
Cancel/закрытие не пишет ничего. Confirm отправляет exact preview pair одной
revision-guarded config/layout transaction; обычный Optimize Undo возвращает
предыдущую геометрию. Повторный прогон после Confirm идемпотентен.

## 7. Scope

### Входит

- shared near-axis helper/constant и перевод #279 на него;
- Walls hover/click/closure authoring rule;
- exact-axis postcondition safe Resize;
- lossy Optimize pass/report/dialog/Undo;
- wall/open-span/opening rekey и structural preflight;
- RU/EN i18n, unit, production smoke, backend optimize transaction, mutation,
  targeted golden и performance;
- canonical docs и оба changelog.

### Не входит

- изменение grid pitch или координатного барьера #291;
- исправление углов больше 0.25°, arbitrary vertex editor или angle dialog;
- автоматическая миграция на load/save без Optimize confirmation;
- изменение renderer bevel/junction geometry #288;
- modifier для сохранения невидимого уступа;
- auto-repair кандидата, который не проходит structural preflight.

## 8. Acceptance criteria

### AC1. Единая boundary matrix

Pure tests покрывают exact axis, `0.181315°`, mirrored/reversed варианты, ровно
`0.25°`, значение выше порога, `316×1`, `316×2`, short edges и diagonal 30°.
Authoring, Optimize и renderer #279 импортируют один threshold source; source
guard запрещает отдельные литералы `0.25` в этих classifiers.

### AC2. Walls не сохраняет `316×1`

Production-bundle smoke рисует сегмент с raw/grid result `316×1`. Hover
rubber-band и committed draft/room показывают `316×0`; exact endpoint,
segment count и thickness metadata согласованы. Отдельно проверяются ordinary
click, resumed draft, closure и existing-node snap conflict.

### AC3. Resize не создаёт near-axis output

Outer и exact-shared safe drags сохраняют moving/side edges exact-axis на всех
grid nodes. Mutation, добавляющая minor component меньше порога перед commit,
либо канонизируется без unrelated changes, либо fail-closed. Pre-existing
`316×1` handle остаётся disabled как diagonal до Optimize.

### AC4. Optimize чинит реальный `316×1`

Minimized fixture из #284 содержит duplicated shared physical edge `316×1`.
Preview сообщает `wallsStraightened: 1`, maximum одного grid step в корректных
сантиметрах и ноль double-counting owners. Confirm создаёт exact horizontal
shared edge; Cancel оставляет JSON byte-equivalent.

### AC5. Related geometry сохраняется

После repair:

- обе room copies имеют exact одинаковые endpoints;
- topology vertex count/order и room ids не меняются;
- wall thickness/open spans rekey lossless;
- openings остаются на host, fit и angle корректны;
- `checkWallKeys`, `checkMixedRoleRecords`, references и production geometry
  preflight дают ноль нарушений;
- повторный Optimize `changed:false` и все straightening counters нулевые.

### AC6. True diagonals не меняются

`316×2`, 30° room edge, diagonal partition и 45° Walls segment byte-equivalent
после preview/Confirm; они не входят в `wallsStraightened`/`skipped`.

### AC7. Report является верхней границей

Multi-space fixture с разными `cell_cm` доказывает, что
`maxStraightenShiftCm` не меньше фактического движения ни одного endpoint и
правильно называет space. Shared owners не удваивают count. Unsafe candidate
не попадает в moved count и остаётся в skipped.

### AC8. UI/Undo/revision safety

Dialog light/dark показывает отдельную строку lossy repair. Confirm без
актуальных revisions получает conflict и не пишет partial pair; success даёт
одну Undo. Reload/event/cold read совпадают с preview.

### AC9. Мутанты

Обязательны мутанты:

- порог ниже `0.181315°`;
- strict `<` вместо inclusive boundary;
- bypass authoring snap;
- repair only one owner shared wall;
- считать room copies как две стены;
- применять Optimize без confirmation.

Каждый убивается соответствующим AC без повышения global golden tolerance.

### AC10. Локальные гейты

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- targeted Walls/Resize/Optimize smokes и mutation;
- targeted semantic golden verify.

Полные golden, smoke, performance и Linux HA harness выполняются перед beta.

## 9. Совместимость, touch, security и performance

Schema/model/storage version не меняются. Old frontend/backend читают
исправленный обычный polygon; downgrade не требует migration. Старый near-axis
план сохраняется до явного Optimize.

Plan editor desktop-first. Touch editor — best effort: near-axis rule работает
для clean tap, а pinch/pan/pointercancel не создают segment и не подтверждают
Optimize. View/kiosk rendering fully supported и сохраняет #279.

Новых HA actions/security boundaries нет. Authoring classifier `O(1)`.
Optimize pass линейный по edges плюс существующий bounded preflight; candidate
evaluation не может стать global unbounded combinatorial search. Safe Resize
сохраняет p95 budgets из `docs/RESIZE.md`; full performance gate обязателен.

## 10. Ожидаемые файлы

Product code:

- новый/существующий pure axis helper;
- `src/wall-thickness.ts` (единый threshold import);
- `src/houseplan-card.ts`;
- `src/resize.ts`;
- `src/align-grid.ts` / `src/plan-optimizer.ts`;
- `src/i18n/en.json`, `src/i18n/ru.json`.

Backend boundary:

- websocket Optimize применяет уже существующую exact preview transaction;
  schema изменения не ожидаются.

Tests/evidence:

- unit для helper, align/optimizer/resize/wall-thickness;
- minimized fixture без пользовательских имён;
- production-bundle Walls/Resize/Optimize smoke;
- mutation registry, targeted golden и performance.

Документация:

- `docs/CANVAS.md`, `docs/RESIZE.md`, `docs/WALL-THICKNESS.md`,
  `docs/ARCHITECTURE.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/TESTING.md`, `docs/CONFIG-COMPATIBILITY.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 11. Release

Implementation-коммит имеет `Issue: #290`, `User-Visible: yes` и оба
changelog. Изменившиеся editor/Optimize goldens и docs screenshots принимаются
только из штатного Linux artifact после `npm run bundle:sync`.

## 12. Принятые технические предположения

1. Выравнивается free endpoint, а не anchor текущего Walls segment; уже
   существующая geometry не сдвигается молча.
2. Near-axis existing edge не становится Resize-eligible: её исправляет только
   подтверждённый Optimize, после чего ordinary Resize доступен по #277.
3. Если обе exact-axis цели Optimize одинаково безопасны, degree/lexicographic
   tie-break является техническим детерминизмом, а не новым пользовательским
   выбором.
4. Unsafe repair перечисляется как skipped; Optimize не обязан чинить
   structural-invalid geometry любой ценой.
5. Touch editor: best effort / intentionally degraded; safety floor сохранён.
