# Issue #292 — объяснимая доступность Resize на реальном плане

- **Issue:** https://github.com/Matysh/houseplan-card/issues/292
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Область:** eligibility safe Resize, причины запрета, реальная regression fixture,
  production pointer smoke и документация ограничений
- **Модель данных:** schema и model version не меняются
- **Зависит от:** #276, #289, #290; активная, но инертная рукоятка исправляется в #293

## 1. Сценарий, персона и подтверждение

**Кто и где:** владелец сложного реального плана открывает Plan → Resize после
импорта либо Optimize и пытается предсказуемо изменить размеры комнаты.

**Момент проблемы:** большинство видимых ручек приглушены. Пользователь не
понимает, является ли это неисправностью плана, ограничением безопасного
Resize или дефектом самой ручки, и не знает, какое условие мешает операции.

**До/после:** до задачи запреты выглядят одинаково и не защищены exact audit;
после задачи каждая разрешимая стена активна, а настоящий запрет имеет
стабильную человеческую причину без внутреннего jargon.

На `test/fixtures/real-plan-second-floor.json` текущий Resize показывает 37
рукояток: 11 разрешены и 26 запрещены. Текущий расклад причин запрета:

| Причина resolver | Рукояток | Наблюдаемая геометрия |
|---|---:|---|
| `unequal-shared` | 7 | соседняя комната имеет другие endpoints/протяжённость |
| `partial-shared` | 6 | сосед владеет только частью moving edge |
| `side-angle` | 6 | примыкающее ребро не строго перпендикулярно |
| `duplicate-physical-wall` | 5 | совпадающая independent geometry |
| `diagonal` | 2 | moving edge не осевая |

Сама доля запретов не является ошибкой: unsafe resize обязан остаться
запрещённым. Ошибка — ложные запреты после исправления/оптимизации геометрии,
отсутствие стабильного аудита реального плана и тексты, из которых пользователь
не понимает, что именно мешает перемещению стены.

## 2. Пользовательский результат

После попадания зависимостей и повторного Optimize каждая стена, которую можно
сдвинуть без изменения topology, числа стен, физических толщин и более чем двух
комнат, получает активную рукоятку. Остальные рукоятки остаются видимыми и при
click, Enter или Space объясняют ограничение обычным языком и называют действие
только там, где оно безусловно: например, убрать перекрывающую independent
geometry. Статический текст не обещает, что Optimize исправит конкретную
наклонную стену.

Внутренние коды (`partial-shared`, `side-angle` и т. п.) пользователю не
показываются. Разрешённая рукоятка обязана реально двигаться; этот отдельный
интеграционный контракт закрывает #293.

## 3. Детерминированный eligibility audit

Один pure audit проходит те же room polygons, openings, walls, open spans,
partitions, drafts и columns и вызывает тот же `resolveSafeResize`, который
использует production render. Он возвращает:

- общее число rendered handles;
- enabled count;
- disabled count по каждому `SafeResizeReason`;
- стабильный идентификатор handle: room id, edge index, canonical endpoints;
- для exact shared pair — обе owner copies с одинаковым результатом.

Audit не является новой пользовательской телеметрией и не попадает в config.
Его результат для обеих real-plan fixtures хранится как test expectation.
После merge зависимостей implementation фиксирует новый точный baseline в том
же коммите; любое последующее изменение counts требует осознанного обновления
fixture expectation и объяснения в code review.

## 4. Правила доступности

1. Exact horizontal/vertical outer wall с двумя perpendicular side edges и без
   конфликтов разрешена, если существует хотя бы один ненулевой safe grid step.
2. Exact shared wall разрешена только при полном endpoint-to-endpoint владении
   ровно двух комнат и одинаковом допустимом диапазоне; обе owner-рукоятки дают
   один plan и один reason.
3. Ограничение #289 для mixed-role side edge не ослабляется: сохранение одной
   толщины ценой перезаписи другой запрещено.
4. Near-axis вход сначала исправляет явный Optimize #290. Сам Resize не меняет
   старую геометрию молча.
5. Совпадающая independent geometry после canonical cleanup #276 не должна
   оставаться ложным `duplicate-physical-wall`; настоящая partition/draft/column
   продолжает блокировать.
6. `enabled` разрешён только если один шаг в заявленном направлении проходит
   тот же structural/persistence preflight, что live preview. Resolver не может
   обещать операцию, которую первый pointermove гарантированно отвергнет.
7. Нельзя разрешать resize, изменяющий больше двух комнат, vertex count/order,
   число физических wall records либо их `cm`.

## 5. Тексты причин

RU/EN тексты должны отвечать «что мешает», а «что можно сделать» добавляется
только для безусловного действия, не требующего нового geometry analysis.
Минимальный контракт:

| Класс | Пользовательский смысл |
|---|---|
| angled / side angle | стена или примыкание не горизонтально/вертикально; Resize поддерживает только точные оси, без обещания автоматического Optimize |
| independent overlap | поверх границы лежит отдельная перегородка, черновой контур или колонна; её нужно убрать/перенести |
| partial / unequal shared | соседняя комната использует не всю ту же стену; безопасно двигать её как общую нельзя |
| multiple rooms | сдвиг затронул бы более двух комнат |
| thickness / opening | невозможно сохранить толщину либо безопасное положение проёма |
| invalid geometry | перемещение нарушило бы структуру плана; без внутреннего кода ошибки |

Динамический признак «Optimize способен исправить эту стену» и новые варианты
`SafeResizeReason` не вводятся этой задачей. Если в будущем появится такой
контракт, он оформляется отдельно и не является условием #292.

## 6. Scope

### Входит

- общий deterministic audit production eligibility;
- устранение доказанных ложных запретов после #276/#290;
- согласование owner copies exact shared wall;
- actionable RU/EN причины и keyboard/click activation;
- exact-count tests на обеих реальных фикстурах;
- production-bundle smoke, который проходит UI Plan → Resize.

### Не входит

- ослабление safe-resize ограничений для partial/mixed/diagonal topology;
- произвольный vertex editor или перемещение более двух комнат;
- исправление pointer no-op разрешённой рукоятки (#293);
- автоматический lossy repair при load/save;
- пользовательская аналитика/телеметрия.

## 7. Acceptance criteria

### AC1. Реальный baseline зафиксирован

После rebase поверх #276/#289/#290 тест запускает audit на
`real-plan-first-floor.json` и `real-plan-second-floor.json`, сравнивает exact
total/enabled/reason counts и печатает diff по handle id при расхождении.
Expectation не допускает `>=`, snapshots без причин или глобальную tolerance.

### AC2. Известная общая стена разрешена

Стена `room-a` edge 2 / `room-b` edge 2 второй фикстуры классифицируется как
одна exact shared physical wall: обе owner copies enabled, plan содержит ровно
две комнаты, endpoints и safe range совпадают. Ни одна третья комната не входит.

### AC3. Ложные причины исчезают после repair

Targeted fixtures доказывают, что подтверждённый near-axis repair #290 снимает
`diagonal`/`side-angle`, а canonical cleanup #276 снимает только ложный
`duplicate-physical-wall`. Настоящие diagonal и independent partition остаются
запрещены с правильной причиной.

### AC4. Unsafe cases остаются закрыты

Partial shared, unequal endpoints, mixed-role side edge #289, third-room,
thickness conflict и opening collision остаются disabled. Mutation, удаляющая
любой guard, убивается точным reason/count либо geometry invariant.

### AC5. Причина доступна в production UI

Production bundle показывает disabled handle с `aria-disabled=true`, доступным
focus и локализованным `aria-label`. Click, Enter и Space показывают тот же
actionable текст; pointerdown не создаёт drag и не пишет config/history.

### AC6. Resolver и render не расходятся

Source/production-path guard доказывает, что audit и render используют один
resolver и один reason type. Нельзя иметь отдельную упрощённую копию условий
для тестового счётчика.

### AC7. Первый шаг согласован с preview

Для каждого enabled handle хотя бы одно направление имеет ненулевой grid step,
проходящий topology и persistence preflight. Если оба направления отвергаются,
handle disabled с детерминированной причиной, а не active no-op.

### AC8. Инварианты

После всех разрешённых targeted moves на real fixtures проходят wall keys,
mixed-role records, references, opening host/fit, room simplicity/orientation,
physical geometry preflight; число стен и multiset `wall.cm` не меняются.

### AC9. Локальные гейты

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- targeted eligibility audit, production smoke и mutation.

Полные golden, smoke, performance и Linux HA harness выполняются перед beta.

## 8. Совместимость, touch и performance

Schema/storage не меняются. Старый frontend продолжает читать тот же план.
Touch editor остаётся best effort, но disabled reason доступен через tap, а
активный pointer stream не конфликтует с pinch/pan/pointercancel.

Audit выполняется только в тестах. Production render сохраняет существующий
snapshot cache: resolver не должен пересчитываться более одного раза на handle
за frame. Performance budget safe Resize из `docs/RESIZE.md` не меняется.

## 9. Риски и меры

- Погоня за меньшим процентом disabled может разрешить unsafe topology. Мера:
  точная negative matrix AC4 и structural/persistence preflight AC7–AC8.
- Counts могут разойтись с production render из-за второй реализации audit.
  Мера: один resolver/reason type и source guard AC6.
- Статический текст может пообещать repair, которого нет для true diagonal.
  Мера: §5 запрещает такое обещание; fixtures проверяют near-axis и настоящую
  диагональ раздельно.
- Полный audit в render может ухудшить editor responsiveness. Мера: test-only
  audit и существующий per-snapshot eligibility cache.

## 10. Откат

Чистый revert implementation-коммита возвращает прежнюю eligibility и тексты;
миграция/feature flag не требуются, persisted geometry/schema не меняются.

## 11. Ожидаемые файлы

- `src/resize.ts`, `src/houseplan-card.ts`;
- `src/i18n/en.json`, `src/i18n/ru.json`;
- unit/production-path tests и exact fixture audit;
- `demo/smoke_room_resize.mjs` либо отдельный real-plan smoke;
- `docs/RESIZE.md`, `docs/TESTING.md`, при необходимости `docs/ARCHITECTURE.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 12. Release

Implementation-коммит имеет `Issue: #292`, `User-Visible: yes` и обновляет оба
changelog. Issue не закрывается вручную: она закрывается выпуском beta.

## 13. Принятые предположения

1. Метрика 70% — диагностический сигнал, а не продуктовая цель «разрешить любой
   ценой»; после исправлений число запретов может оставаться высоким.
2. Точный post-dependency baseline фиксируется только после rebase всех трёх
   зависимостей, иначе тест законсервирует заведомо переходное состояние.
3. Дублированные owner handles допустимы в DOM для hit testing, но обязаны иметь
   одинаковый resolution; audit явно показывает physical equivalence.
