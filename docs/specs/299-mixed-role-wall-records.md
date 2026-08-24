# Issue #299 — записи толщины не пересекают границу роли стены

- **Issue:** https://github.com/Matysh/houseplan-card/issues/299
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся
  метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 9/10;
  сложность 8/10; риск 9/10
- **Область:** канонизация записей толщины в Optimize и после удаления комнаты
  с сохранением стен
- **Модель данных:** schema и `PLAN_MODEL_VERSION` не меняются
- **Связано:** #198, #228, #253, #287, #289, #298,
  [ADR #282](../adr/282-wall-geometry-representation.md),
  [WALL-THICKNESS.md](../WALL-THICKNESS.md)

## 1. Сценарий

Администратор дома обслуживает существующую планировку в Plan editor на
десктопе. Он нажимает **Общие настройки → Оптимизировать планы** либо удаляет
комнату с вариантом **Оставить стены**. Обе команды обещают привести физическую
геометрию в канонический вид без самопроизвольного изменения толщины соседних
стен.

Задача закрывает J6 из `docs/SCOPE.md`: план должен оставаться верным после
редактирования и обслуживания. Это точечная починка видимого дефекта живого
плана и потому соответствует исключению ADR #282 для текущих P1, несмотря на
принятое направление к новой модели стен.

## 2. Что человек увидит до и после

**До:** Optimize или «Удалить комнату, оставить стены» может сделать наружную
часть стены толщиной бывшей общей границы. **После:** общая и наружная части
остаются независимыми участками со своими толщинами; визуальная кладка после
команды совпадает с физическими ролями стен.

Новых кнопок, диалогов, предупреждений и терминов UI нет.

## 3. Подтверждённая причина

`normalizeWallIntervals()` в `src/wall-thickness.ts` уже атомизирует room edge
по концам соседних комнат, виртуальных участков и записей толщины. Но следующий
проход группирует соседние дочерние интервалы только по `cm` и признаку
«сплошной». Он не сравнивает владельцев физического пролёта. Поэтому два
соседних атома одинаковой толщины с ролями `shared(A,B)` и `outer(A)` снова
срастаются в одну запись.

На `test/fixtures/real-plan-first-floor.json` это воспроизводится двумя
производителями:

1. seed 1: Resize `room-a#1`, затем `optimizePlans()`;
2. seed 3: Resize, затем `_confirmRoomDelete(true)`.

В первом случае линия `y = 83` до обслуживания содержит `166..213` (22 см),
субшаговый `213..213.332` (15 см) и `213.332..235` (22 см). После Optimize
получается одна запись `166..235` толщиной 22 см, хотя `166..213` — общая стена
`room-a|room-h`, а `213..235` — наружная стена `room-h`.

Субшаговый фрагмент связан с #298, но не является необходимым условием дефекта:
даже при точном breakpoint два равных по толщине атома разных ролей нельзя
сливать. Поэтому #299 сохраняет самостоятельный контракт и после интеграции
#298.

## 4. Контракт роли и канонизации

### 4.1 Роль физического атома

Роль выводится только из текущих room polygons после всех геометрических
изменений операции. Записи `walls[]` не являются источником ownership.

Для каждого ненулевого сплошного атомарного пролёта строится каноническая
подпись владельцев:

- `outer(A)` — пролёт принадлежит ровно комнате `A`;
- `shared(A,B)` — пролёт принадлежит ровно двум комнатам, ids отсортированы;
- `ambiguous(A,...)` — больше двух владельцев либо противоречивые совпадения.

Совпадающие reversed room-owner copies описывают один физический атом и дают
одну подпись. Точка на конце записи не считается отдельным пролётом и не меняет
роль соседнего атома.

### 4.2 Допустимое слияние

Два соседних коллинеарных сплошных атома можно объединить только когда
одновременно совпадают:

1. положительная толщина `cm`;
2. непрерывная физическая ось;
3. каноническая подпись владельцев целиком, а не только `shared|outer`.

Следовательно, запрещено слияние:

- `shared(A,B)` с `outer(A)`;
- `shared(A,B)` с `shared(A,C)`;
- однозначного атома с `ambiguous`;
- через виртуальный участок или изменение толщины — действующие запреты
  сохраняются.

Соседние `outer(A)` одинаковой толщины и соседние `shared(A,B)` одинаковой
толщины по-прежнему срастаются в один максимальный run. Решение не должно
превратить нормализацию в blanket-disable compaction.

### 4.3 Субшаговый фрагмент

Optimize-only правило #198 может схлопнуть изолированный интервал строго короче
половины шага, если выполнены его прежние guards. После этого слияние всё равно
останавливается на ближайшей границе роли. Микроинтервал не может служить мостом
между общей и наружной частями.

#298 может независимо выровнять ошибочный endpoint. Результат #299 одинаков при
обоих порядках интеграции: с субшаговым breakpoint и без него итог не содержит
`mixed_role_record`.

### 4.4 Удаление комнаты с сохранением стен

`_confirmRoomDelete(true)` сохраняет действующий контракт #228:

- exclusive positive solid intervals удаляемой комнаты становятся
  независимыми `partitions`;
- shared/virtual/zero intervals не материализуются как partitions;
- openings перепривязываются без сдвига;
- после удаления room каноническая роль `walls[]` вычисляется по **оставшемуся**
  набору комнат.

Заключительная нормализация использует тот же role-aware helper, что Optimize.
Она не создаёт запись, чей внутренний пролёт частично общий, частично наружный,
и не меняет `cm` ради устранения нарушения.

## 5. Scope

### Входит

- role-aware compaction в единственном каноническом
  `normalizeWallIntervals()`;
- использование результата существующими путями Optimize и удаления комнаты;
- точные pure regressions для внешней/общей роли и разных пар владельцев;
- regression на `real-plan-first-floor.json` для последовательности Resize →
  Optimize;
- детерминированные seed 1 и seed 3 в `demo/smoke_edit_walk.mjs` без
  `mixed_role_record`, с обновлением `KNOWN` тем же коммитом;
- каноническая документация и оба changelog.

### Не входит

- изменение safe Resize или его eligibility/range (#289);
- исправление off-grid endpoints и перекроя записей при Resize (#298);
- исправление уже сохранённого плана без явного Optimize или пользовательской
  операции;
- угадывание «правильного» `cm` по соседям;
- изменение правил lossy micro-collapse #198;
- новая schema, stable wall ids или стадии 1–4 ADR #282;
- новая UI-строка, отдельный счётчик preview или новый диалог.

## 6. Модель данных, совместимость и миграция

Формат остаётся прежним:

```ts
walls: Array<{ key: string; cm: number; a?: [number, number]; b?: [number, number] }>
```

Role signature — вычисляемое transient значение; оно не сохраняется. Старые
key-only записи продолжают читаться через действующий fallback. Новые и
переписанные записи сохраняют exact `a/b` как сейчас.

Runtime render и обычное чтение конфигурации ничего не переписывают. Optimize
применяет role split только после preview/Confirm и сохраняет его через прежнюю
атомарную config+layout транзакцию с one-deep Undo. Удаление комнаты остаётся
одной geometry history/persistence транзакцией. `PLAN_MODEL_VERSION` и backend
schema не меняются; специальная backend-валидация не нужна, потому что форма и
допустимые лимиты записей прежние, а общий geometry preflight остаётся
обязательным.

Если role-aware split увеличивает число `walls[]`, результат нельзя усекать.
Действующий schema/geometry write обязан либо принять весь кандидат, либо
отклонить операцию атомарно; частичная потеря записей запрещена.

## 7. UX, i18n, touch и security

- Визуальная поверхность и управление не меняются.
- Новых i18n-ключей нет; существующие RU/EN названия Optimize и удаления
  комнаты сохраняются.
- Plan editor остаётся desktop-first. **Touch editor: best effort / intentionally
  degraded**; изменение не добавляет жестов и не ослабляет safety floor.
- View/kiosk не получают новых interactions и только отображают уже
  канонизированную физическую геометрию.
- HA service calls, permissions и security boundaries не меняются.

## 8. Acceptance criteria

### AC1. Слияние останавливается на границе роли

Synthetic room edge состоит из `shared(A,B)` и продолжения `outer(A)` с одним
`cm`. После `normalizeWallIntervals()` остаются две exact записи с breakpoint в
границе ownership. Ни одна запись не пересекает её.

**Доказательство:** table-driven unit в `test/wall-thickness.test.mjs`, включая
reversed winding/input order; `checkMixedRoleRecords()` возвращает ноль.

### AC2. Пара владельцев является частью роли

Коллинеарные `shared(A,B)` и `shared(A,C)` одинаковой толщины остаются двумя
записями. Два соседних `outer(A)` и два соседних `shared(A,B)` с одинаковым
`cm` срастаются в один максимальный run. Virtual gap и различный `cm` сохраняют
свои прежние breakpoints.

**Доказательство:** pure unit matrix; positive compaction assertions не дают
починить AC1 blanket-disable всех merge.

### AC3. Субшаговый обломок не склеивает роли

Fixture `shared(A,B):22 → outer(A):15` короче `0.5` grid step →
`outer(A):22` после разрешённого #198 collapse нормализуется в два run:
`shared(A,B):22` и `outer(A):22`. Вариант без микроинтервала даёт тот же
breakpoint роли.

**Доказательство:** optimizer unit до/после micro-collapse и idempotence после
storage canonicalization.

### AC4. Реальный Optimize исправляет сохранённый класс

Последовательность «Resize `room-a#1` на +4 → `optimizePlans()`» на
`test/fixtures/real-plan-first-floor.json` не создаёт ни одной записи со
смешанной ролью. На линии `y = 83` общая часть `166..213` и наружная часть
`213..235` остаются разными exact runs с корректной эффективной толщиной.
Повторный Optimize возвращает `changed:false` и deep-equal config/layout.

**Доказательство:** regression в `test/plan-optimizer.test.mjs` на committed
real-plan fixture плюс `checkMixedRoleRecords`, `checkWallKeys`, references и
physical geometry preflight.

### AC5. Keep walls использует тот же контракт

Последовательность seed 3 с `_confirmRoomDelete(true)` не создаёт
`mixed_role_record`. Exclusive positive walls удалённой комнаты становятся
partitions, shared/virtual/zero intervals не дублируются, hosted openings
сохраняют центр/угол/сенсоры, а Undo возвращает byte-equivalent исходную
геометрию.

**Доказательство:** расширение unit `test/room-deletion.test.mjs` либо pure
integration regression и production-bundle seed 3 smoke.

### AC6. Обход правок больше не содержит известный долг #299

Команды

```text
node demo/smoke_edit_walk.mjs --seed 1 --plan real-plan-first-floor.json
node demo/smoke_edit_walk.mjs --seed 3 --plan real-plan-first-floor.json
```

завершаются без новой находки `mixed_role_record`. Соответствующие строки
`KNOWN` удалены тем же implementation-коммитом. Иные заранее объявленные долги
фикстур не маскируются и не переименовываются.

**Доказательство:** обе названные production-bundle smoke-команды.

### AC7. Операции атомарны и не портят смежную геометрию

После обоих путей проходят `checkWallKeys`, `checkMixedRoleRecords`, reference
checks и production physical geometry preflight. Rooms, open spans,
partitions/openings вне затронутых owners и layout byte-equivalent. При ошибке
preflight/лимита нет config write и history entry.

**Доказательство:** unit/integration assertions на real fixture и существующий
preflight smoke; code review проверяет отсутствие нового обходного write path.

### AC8. Мутант доказывает роль guard

Mutation, убирающая сравнение owner signature либо заменяющая его сравнением
только `shared|outer`, обязана быть убита AC1 или AC2. Mutation, запрещающая
всю compaction, убивается положительными cases AC2.

**Доказательство:** targeted mutation command/registry проекта с записанным
результатом.

### AC9. Локальные гейты

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity через `npm run bundle:sync`;
- `node scripts/check-docs.mjs`, потому что меняется `src/**`;
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` и все выбранные
  targeted smokes, обязательно два запуска AC6;
- targeted mutation из AC8.

Полные smoke/golden/performance и Linux HA harness выполняются перед beta по
общему процессу. Визуальные golden baselines не меняются: ожидается сохранение
правильного существующего вида, а regression доказывается структурно и
production smoke.

## 9. План автотестов

1. Добавить pure helper для owner signature рядом с нормализатором либо оставить
   локальную вычисляемую карту, не создавая второй room-ownership resolver.
2. Расширить `test/wall-thickness.test.mjs` таблицей role boundaries, owner pairs,
   reversed order и positive compaction.
3. Добавить real-plan Optimize regression с точными endpoints/`cm`,
   idempotence и invariants.
4. Покрыть Keep walls через существующий production path, не прямой мутацией
   готового результата.
5. Удалить только debt-строки #299 из `KNOWN` и прогнать seed 1/3.
6. Убить targeted mutants comparison guard и blanket-disable.

## 10. Производительность

Изменение работает только во время канонизации физических стен, не в live
render/HA state tick и не в pointermove. Owner signatures строятся один раз из
уже вычисленных атомарных intervals; запрещено для каждого pairwise merge заново
обходить все комнаты. Целевой профиль — не хуже существующего порядка
`O(intervals log intervals + rooms/edges analysis)` и без нового
`O(walls × rooms × merge-rounds)`.

Если diff затрагивает общий `wallIntervals()` hot path, нужен targeted large-house
benchmark с допустимым отклонением не более 20% относительно `origin/dev`;
если подписи остаются локальны внутри explicit normalization, существующего
Full Performance перед beta достаточно.

## 11. Риски и меры

- **Ложное разделение одинаковой стены.** Мера: positive `outer(A)` и
  `shared(A,B)` compaction в AC2, order/winding matrix.
- **Неверная пара owners при reversed copy.** Мера: ids сортируются, совпадающие
  физические атомы дедуплицируются до сравнения.
- **Связь с #298 создаёт зависимый результат.** Мера: AC3 запускается с микро-
  breakpoint и без него; роль guard не зависит от порядка мержа задач.
- **Рост числа записей до backend limit.** Мера: не усекать; атомарный reject
  AC7 и real-fixture count assertion.
- **Исправление одного производителя, но не второго.** Мера: общий helper плюс
  независимые AC4/AC5 и два seed smoke.

## 12. Откат

Чистый revert implementation-коммита возвращает прежнюю compaction. Schema,
model version и миграции нет. Планы, уже явно оптимизированные исправленной
версией, остаются валидны для старой версии: несколько соседних записей вместо
одной читаются действующим compatibility path. Для возврата конкретного Optimize
кандидата пользователь также сохраняет прежний one-deep server Undo до
следующего edit.

## 13. Ожидаемые файлы

Product code:

- `src/wall-thickness.ts`;
- `src/plan-optimizer.ts` или `src/houseplan-card.ts` только если общий вызов
  нормализатора требует явной передачи уже вычисленного ownership; отдельная
  реализация правила в двух callers запрещена.

Tests/evidence:

- `test/wall-thickness.test.mjs`;
- `test/plan-optimizer.test.mjs`;
- `test/room-deletion.test.mjs` либо существующий production-path equivalent;
- `demo/smoke_edit_walk.mjs`;
- mutation registry/fixture, если требуется действующим harness;
- `test/fixtures/real-plan-first-floor.json` не переписывается под ожидаемый
  результат.

Documentation/release:

- `docs/WALL-THICKNESS.md`;
- `docs/CANVAS.md`, `docs/ARCHITECTURE.md` и RU/EN user guide в части
  role-aware Optimize/Keep walls;
- `docs/TESTING.md` с exact smoke evidence;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` в том же `User-Visible: yes`
  коммите;
- `docs/STATUS.md` не получает параллельный backlog/status; обновляется только
  если меняется релизный snapshot.

## 14. Release-артефакты

- один implementation-коммит или последовательность исправляющих коммитов с
  терминальными `Issue: #299` и `User-Visible: yes`;
- RU/EN changelog bullet со ссылкой на #299;
- локальные команды и результаты AC9 в issue handoff;
- code-review document Claude и зелёный verdict до автоматического merge в
  `dev`;
- issue остаётся открытой в `S8-merged` до выпуска следующей beta/RC;
- screenshots/golden не принимаются и не переписываются, если targeted verify
  не показывает реальный визуальный diff.

## 15. Принятые технические предположения

1. Каноническая роль хранится как отсортированный набор room ids; это transient
   вычисление и может быть заменено ревьюером на эквивалентное без изменения UX.
2. Ambiguous owner set не сливается ни с каким соседом, но исходный атом
   сохраняется fail-closed; #299 не исправляет invalid room overlap.
3. Текущий `normalizeWallIntervals()` остаётся единственным enforcement point
   для Optimize и Keep walls. Если реализация обнаружит ещё один product caller,
   он обязан использовать тот же helper, а не копировать guard.
4. `wallsMerged` продолжает считать только исчезнувшие записи. Role split может
   дать `canonicalized > 0` при `wallsMerged = 0`; отдельный пользовательский
   счётчик не добавляется в этой задаче.
5. #298 может быть слит до реализации #299. Автор ребейзится на актуальный
   `dev` перед кодом/ревью и сохраняет AC3 для обоих вариантов входных данных.

