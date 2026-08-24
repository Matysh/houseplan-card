# Issue #289 — Resize не создаёт стену со смешанной ролью

- **Issue:** https://github.com/Matysh/houseplan-card/issues/289
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 9/10;
  сложность 8/10; риск 9/10
- **Область:** safe Resize eligibility/range, side-wall ownership, thickness
  preservation, disabled UX, commit preflight и model invariants
- **Модель данных:** schema и число room/wall records не меняются автоматически
- **Связано:** #233, #253, #254, #264, #277, #281, #284, #287,
  `docs/RESIZE.md`, `docs/WALL-THICKNESS.md`, `docs/TOUCH-SUPPORT.md`

## 1. Сценарий и подтверждённая причина

На реальном плане пользователь сдвинул нижнюю стену одной комнаты на 43 шага.
Соседняя комната не изменилась. Боковая запись толщины 20 см, которая до
жеста целиком описывала общую границу, растянулась с узла 928 до 971, хотя
соседняя комната по-прежнему заканчивается на 928. Новый участок стал наружной
стеной, но сохранил толщину общей границы вместо соседних наружных 30 см.

Текущий `resolveSafeResize()` проверяет ownership самой moving edge. Он не
доказывает, что две удлиняемые/укорачиваемые side edges сохранят одну физическую
роль на всём новом пролёте. `rekeyWallsAfterMove()` затем честно переносит
старую запись по геометрии и получает mixed-role record. Инвариант
`checkMixedRoleRecords` из #287 уже обнаруживает результат.

## 2. Решение владельца

Зафиксировано 2026-08-24:

- частичный сдвиг, который превращает часть прежней общей стены в наружную или
  наоборот, запрещён;
- Resize не разрезает запись и не угадывает новую наружную толщину;
- рукоятка заранее disabled и объясняет: «Нельзя сдвинуть только часть общей
  стены»;
- shared ownership допустим только пока обе комнаты владеют одним и тем же
  endpoint-to-endpoint пролётом.

Открытых продуктовых вопросов нет.

## 3. Пользовательский результат

Опасную стену нельзя начать перетаскивать. Рукоятка остаётся видимой, hover и
keyboard focus показывают понятную причину, click/tap повторяет её в toast.
План, history и сервер не меняются. Безопасный наружный Resize и точный
endpoint-to-endpoint Resize двух комнат работают как раньше.

## 4. Ownership-контракт

### 4.1 Роль атомарного пролёта

Для moving edge и обеих side edges resolver строит ownership profile по
реальным room polygons до начала жеста. Каждый атомарный интервал имеет одну
роль:

- `outer` — владелец ровно одна room;
- `shared(A,B)` — ровно две rooms с одной exact centreline;
- invalid/multiple — больше двух owners либо неоднозначное наложение.

Thickness records не являются источником ownership: роль выводится из room
geometry, а затем используется как обязательное условие lossless rekey.

### 4.2 Запрещённая смена роли

Кандидат недопустим, если любой side interval после изменения длины:

- объединяет `shared(A,B)` и `outer(A)` в одну запись/неразделённое ребро;
- оставляет продолжение у B, которым A больше не владеет;
- создаёт новую общую часть только на подмножестве существующего outer edge;
- требует вовлечь третью room либо разрезать/создать vertex.

Resolver обязан обнаружить класс до pointer capture. Если хотя бы один
направленный шаг может быть разрешён без смены роли, handle может остаться
enabled, но `clampSafeResize()` обязан остановить конкретное направление на
последнем safe node. В exact пользовательском repro оба направления не дают
сохранить один endpoint-to-endpoint ownership profile, поэтому handle disabled
с `partial-shared`.

### 4.3 Thickness preservation

После каждого разрешённого preview и commit:

- ни одна wall entry не описывает одновременно shared и outer intervals;
- effective `cm` каждого старого атомарного physical interval сохраняется;
- значения `cm` не назначаются по соседству и не создаются автоматически;
- untouched walls/open spans/rooms byte-equivalent;
- число topology vertices не меняется.

## 5. Scope

### Входит

- side-edge ownership analysis в safe resolver/validator;
- directed clamp на первой смене роли;
- `partial-shared` disabled reason и RU/EN текст владельца;
- exact 43-step regression, production pointer smoke и model invariant;
- unit/mutation/performance evidence;
- resize/user/testing docs и оба changelog.

### Не входит

- автоматический split wall record и выбор новой толщины;
- изменение толщины стен как часть Resize;
- partial-shared topology cascade, vertex insertion или `simplifyPoly`;
- общий рефактор controller #264;
- исправление уже сохранённых mixed-role records через Optimize;
- renderer defects #288 и near-axis repair #290.

## 6. Acceptance criteria

### AC1. Exact пользовательский repro запрещён до жеста

Fixture содержит общую боковую стену 20 см, наружные продолжения 30 см и
moving edge, чей сдвиг на 43 шага создал бы mixed-role interval. Для этой
ручки `resolveSafeResize()` возвращает
`{enabled:false, reason:'partial-shared'}`; pointer capture, preview, history и
write не создаются.

### AC2. Причина доступна человеку

RU: «Нельзя сдвинуть только часть общей стены». EN передаёт тот же смысл.
Disabled handle сохраняет hit area, `aria-disabled`, localized accessible name,
tooltip на hover/focus и toast на click/tap. Он не запускает drag.

### AC3. Directed safe range не перепрыгивает смену роли

Для fixture, где один direction имеет несколько безопасных grid nodes, а
затем доходит до конца соседней комнаты, preview останавливается на последнем
endpoint-to-endpoint node. Он не перескакивает через запрещённый node к более
дальнему валидному polygon. Обратное безопасное направление остаётся рабочим.

### AC4. Разрешённые сценарии #277 сохраняются

- non-shared outer wall изменяет одну room;
- exact shared endpoint-to-endpoint wall изменяет ровно две rooms;
- irregular-room clamp у первого corner;
- perpendicular opening jamb stop;
- zero-range handle #281 disabled по своей точной причине;
- pinch, pointercancel и lostpointercapture дают ноль записей.

### AC5. Persisted model чиста

После каждого разрешённого commit `checkMixedRoleRecords` возвращает ноль.
`checkWallRecordsPreserved`, `checkWallKeys`, references и production geometry
preflight также возвращают ноль нарушений. Exact forbidden repro оставляет
JSON config/layout byte-equivalent.

### AC6. Preview и commit используют один proof

Ownership profile входит в immutable `SafeResizePlan`/его signature и
проверяется `validateSafeResize()` перед pointerup. Если committed snapshot или
owners изменились, весь жест отменяется с `resize.commit_failed`, без partial
write. Commit принимает только exact preview.

### AC7. Production-bundle smoke

`demo/smoke_room_resize.mjs` выполняет реальную попытку forbidden 43-step drag,
проверяет disabled reason и отсутствие WS/config/history mutation. Затем тем же
bundle выполняет разрешённый outer и exact-shared drag, доказывая, что Resize
не отключён целиком.

### AC8. Мутант

Mutation убирает side ownership check либо разрешает rekey mixed-role записи.
AC1 или AC5 обязаны падать. Проверка не может быть удовлетворена безусловным
disable всех shared/adjacent handles — positive AC3/AC4 остаются зелёными только
при точной классификации.

### AC9. Локальные гейты

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- targeted Resize smoke, invariants и mutation.

Полные golden, smoke, performance и Linux HA harness выполняются перед beta.

## 7. Совместимость, touch, security и performance

Persisted schema/model version не меняются; старые планы читаются без
перезаписи. Изменяется только eligibility нового жеста. Plan editor остаётся
desktop-first; touch editor — best effort, но safety floor обязателен: disabled
handle и cancellation не сохраняют геометрию.

Новых HA actions и security boundaries нет. Ownership profile строится один
раз на committed snapshot и кэшируется вместе с eligibility. Pointermove не
получает новый глобальный `O(R×E)` анализ: он проверяет подготовленный plan и
contiguous deltas. Действующие p95 budgets из `docs/RESIZE.md` сохраняются.

## 8. Ожидаемые файлы

Product code:

- `src/resize.ts`;
- `src/houseplan-card.ts` только для передачи profile/UX, если требуется;
- `src/i18n/en.json`, `src/i18n/ru.json`.

Tests/evidence:

- `test/resize.test.mjs`;
- privacy-minimized fixture из #284 без имён/полного экспорта;
- `demo/smoke_room_resize.mjs`;
- `scripts/model-invariants.mjs` используется как acceptance oracle и не
  дублируется в product code;
- mutation registry и benchmark safe resize при изменении hot path.

Документация:

- `docs/RESIZE.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/TESTING.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 9. Release и порядок интеграции

Implementation-коммит имеет `Issue: #289`, `User-Visible: yes` и оба
changelog. Если меняется вид disabled handle, targeted golden/docs screenshots
принимаются только из штатного Linux workflow после bundle sync.

Инфраструктурная #260 должна попасть в `dev` до финальной пересъёмки, но не
входит в product branch #289.

## 10. Принятые технические предположения

1. Существующий reason key `partial-shared` переиспользуется, но его текст
   меняется на принятое владельцем объяснение.
2. Ownership сравнивается на atomic centreline intervals с действующим
   geometry epsilon; epsilon поглощает storage noise, но не целый grid step.
3. Наличие safe direction не требует двух разных handles: текущий handle
   остаётся bidirectional, а unsafe direction физически clamp'ится.
4. Уже сохранённый mixed-role plan не чинится молча; задача предотвращает новый
   результат и тестирует конкретный pre-save candidate.
5. Touch editor: best effort / intentionally degraded; safety floor сохранён.
