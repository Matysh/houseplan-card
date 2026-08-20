# Issue #218 — floating-point шум одной комнаты не гасит Glow всего пространства

- **Issue:** https://github.com/Matysh/houseplan-card/issues/218
- **Связанные контракты:** #19, #55, #61, #65–#67, #197
- **Тип:** bug, обычный полный трек
- **Приоритет:** P1
- **Пользовательское изменение:** да

## 1. Сценарий и персона

**Персона:** домочадец или гость, который смотрит состояние освещения в View или
kiosk, и администратор, проверяющий тот же план в редакторе устройств.

**Сценарий:** в пространстве есть несколько комнат и включённый источник света.
После обычных операций редактора две координаты общей границы могут отличаться
на один ULP (`5.55e-17` или `1.11e-16`). На таком плане polyclip не завершает
объединение полов. Сейчас одна комната с этим численным шумом делает пустым
clipPath каждого источника пространства, поэтому Glow не виден ни при каких
настройках, хотя источник включён и visibility polygon построен.

## 2. Что человек увидит до и после

До исправления одна численно нестабильная комната может молча погасить все
световые пятна пространства. После исправления обычный floating-point шум не
влияет на свет, а действительно некорректная комната в худшем случае исключает
только свою часть пола: остальные комнаты продолжают освещаться.

## 3. Подтверждённая причина

Текущая цепочка:

```text
_renderGlowLayer
  → intersectionPaths([visibilityPolygon], floor всех комнат)
  → unionBodies(floor)
  → polyclip union с исходными double-координатами
  → exception → null → lit=[] → пустой clipPath
```

`src/physical-geometry.ts` передаёт координаты в polyclip без численной
стабилизации. `unionBodies()` проглатывает исключение и возвращает `null`, а
`intersectionPaths()` не отличает сбой одной комнаты от отсутствующего пола.
В результате fail-dark, нужный против утечки света за пределы дома, применяется
к целому пространству вместо минимального проблемного фрагмента.

Реальный экспорт владельца локализовал две пары координат с расхождением в
последнем бите. Экспериментальное квантование входа union до `1e-6` единицы
плана восстановило непустой clipPath. Экспериментальный патч в код не вошёл.

## 4. Нормативные источники и приоритет

При расхождении применяются:

1. решения владельца и приёмка в #218;
2. это ТЗ после зелёного SPEC-REVIEW;
3. действующий fail-dark контракт Glow и smoke `smoke_glow_fail_dark`;
4. контракт #197: локальный сбой булевой операции не удаляет валидную геометрию
   всего пространства;
5. текущая реализация как compatibility baseline для явно не изменяемого
   поведения.

## 5. Цели

1. Сделать булевы операции пола устойчивыми к невидимому floating-point шуму.
2. Ограничить отказ одной комнаты этой комнатой, не всем пространством.
3. Сохранить fail-dark там, где свет действительно не должен рисоваться.
4. Сделать остаточную деградацию диагностируемой и не заспамить консоль.
5. Не менять сохранённые координаты и вид валидных планов.

## 6. Scope

В задачу входят:

- численная стабилизация входных колец общего boolean-слоя
  `src/physical-geometry.ts` непосредственно перед polyclip;
- устойчивое пересечение visibility fan с набором комнат;
- покомнатная деградация при исключении после стабилизации;
- диагностический callback из pure geometry и дедуплицированный `console.warn`
  на уровне карточки с id пространства и id проблемной комнаты;
- минимизированная regression fixture, сохраняющая проблемные координаты из
  реального экспорта без пользовательских имён, entity ids и остального конфига;
- проверка full View, kiosk/тот же renderer и Glow-base;
- unit, targeted smoke, mutation gate, golden verification и документация.

## 7. Не входит в задачу

- изменение радиуса, цвета, opacity, falloff, blend или анимации Glow;
- изменение visibility algorithm, occluders, проёмов или кладки;
- ослабление защиты источника внутри стены и луча вне пола;
- исправление произвольной самопересекающейся комнаты или автоматический repair;
- изменение/сохранение/миграция координат пользователя;
- предупреждение в UI, repair issue или новая настройка точности;
- логирование названий комнат, координат, entity ids или полного конфига;
- изменение статических room fills, если наблюдение Glow-base не связано с той
  же численной причиной;
- принятие golden baseline на Windows или выпуск без команды владельца.

## 8. Численный контракт

### 8.1. Стабилизация

- каждое конечное `x/y`, передаваемое из `unionBodies()` в polyclip,
  нормализуется с quantum `1e-6` единицы плана;
- квантование применяется только к вычисляемой копии; входные массивы не
  мутируются;
- `-0` канонизируется в `0`;
- соседние дубликаты, возникшие после квантования, удаляются, замыкающая точка
  добавляется ровно один раз;
- кольцо, у которого после нормализации меньше трёх различных точек или нулевая
  площадь в пределах quantum, считается непригодным и не передаётся polyclip;
- результат детерминирован, не зависит от порядка тел и повторного вызова;
- смещение любой точки не превышает половины quantum и многократно меньше
  физической/экранной точности плана.

Quantum является техническим контрактом этой задачи. Его изменение после
ревью требует доказать те же ULP-fixtures, raster parity и отсутствие слипания
реально различных геометрических деталей.

### 8.2. Пересечение с полом

Нормальный путь сохраняет объединение валидных комнат до intersection, чтобы
перекрытия legacy-планов не превращались в evenodd-дыры. Если объединение или
пересечение всего набора всё же падает, применяется покомнатный путь:

1. visibility fan остаётся ограничивающей геометрией и никогда не возвращается
   без floor clipping;
2. комнаты обрабатываются независимо;
3. успешные результаты объединяются в итоговый набор path fragments;
4. комната, для которой boolean operation упала, пропускается и сообщает свой
   индекс/id через diagnostic callback;
5. отсутствие всех валидных комнат возвращает `[]`.

Fallback не может вернуть raw visibility fan или осветить область вне пола.

## 9. Диагностика

Pure-функции геометрии не вызывают `console` напрямую. Они предоставляют
структурированный сигнал о покомнатной ошибке. `_renderGlowLayer()` связывает
индекс пола с `room.id` и пишет предупреждение формата, эквивалентного:

```text
HOUSEPLAN GLOW GEOMETRY FALLBACK: #218, space <space-id>, room <room-id>
```

Требования:

- нет room name, entity id, координат и текста polyclip exception;
- одинаковая ошибка логируется не чаще одного раза на сочетание
  `space id + geometry fingerprint + room id`;
- новый fingerprint может дать новое предупреждение, чтобы ремонт геометрии и
  повторный дефект были различимы;
- валидный ULP-шум, исправленный квантованием без fallback, не создаёт warning;
- warning не влияет на render result и не требует i18n.

## 10. Glow-base

Наблюдение `0 из 6` проверяется на той же минимизированной fixture при условиях,
когда текущий контракт действительно требует тёмную базу: Glow включён, а
effective room fill отсутствует. Для каждой пригодной комнаты должен
существовать `.glow-base`.

Если тест уже зелёный, код Glow-base не меняется и результат фиксируется в
implementation evidence. Если тест красный из-за того же raw-coordinate
boolean path, исправление выполняется общей стабилизацией без отдельного
renderer. Иная причина является отдельной задачей и не расширяет #218.

## 11. UX, accessibility и touch

Новых элементов UI и взаимодействий нет. View/kiosk, mouse, touch и pen получают
один и тот же исправленный render. Pointer targets, focus, tooltip, reduced
motion и editor gestures не меняются. Ошибка не показывается домочадцу: для
администратора остаётся redacted console warning только при реальной деградации.

## 12. Данные, migration, privacy и i18n

Config, layout, backend schema, localStorage и сериализация не меняются.
Миграция не нужна. Исходные координаты остаются байт-в-байт прежними после
Open → Save без пользовательского изменения. Regression fixture хранит только
минимальную анонимизированную геометрию. Новых строк и i18n-ключей нет.

## 13. Архитектура и зоны изменений

Ожидаемая цепочка:

```text
saved room coordinates (immutable)
  → normalized boolean input copy
  → normal union + intersection
  → per-room fail-dark fallback only on exception
  → path fragments + structured diagnostics
  → existing Glow clipPath
```

Ожидаемые зоны:

- `src/physical-geometry.ts` — normalization, robust union/intersection API;
- `src/houseplan-card.ts` — room ids, deduplicated redacted warning и cache key;
- `test/physical-geometry.test.mjs` — ULP, malformed-room, immutability,
  permutation и fail-dark unit tests;
- targeted browser smoke/fixture для реального шестикомнатного случая и
  Glow-base assertion;
- `scripts/mutation-gate.mjs` и его registry test;
- `docs/TESTING.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- generated bundles после build.

Нельзя создавать второй Glow renderer или применять квантование при записи
данных.

## 14. Performance и security

- нормальный render path выполняет не больше одного дополнительного линейного
  прохода по вершинам перед уже существующей boolean operation;
- покомнатная обработка запускается только после исключения/невалидного общего
  результата и не является постоянным per-frame N×boolean path;
- существующий LRU clip cache сохраняется; diagnostic dedupe ограничен текущими
  space/fingerprint keys и очищается/ограничивается вместе с жизненным циклом
  карточки;
- нельзя добавлять таймеры, observers, network calls или persisted telemetry;
- warning redacted согласно §9;
- fail-dark security boundary не ослабляется.

## 15. Acceptance criteria

1. **AC1 — ULP union.** Два прямоугольника с общей гранью, отличающейся на один
   ULP, после `unionBodies()` дают валидную объединённую геометрию.
   **Доказательство:** unit, красный при mutant без normalization.
2. **AC2 — реальная regression fixture.** Анонимизированная шестикомнатная
   fixture с точными проблемными парами координат даёт непустой `lit` и
   непустой DOM clipPath включённого источника. **Доказательство:** unit +
   targeted browser smoke; тест красный на коде до #218.
3. **AC3 — локальная деградация.** Самопересекающаяся/намеренно непригодная
   комната не удаляет пересечение с валидными комнатами. Проблемная комната не
   получает свет. **Доказательство:** unit с injected/deterministic failure.
4. **AC4 — диагностический след.** Fallback сообщает space/room id один раз на
   fingerprint и не раскрывает names, entities, coordinates или exception.
   **Доказательство:** unit/browser console capture и повторный render.
5. **AC5 — fail-dark.** Источник в кладке, visibility fan мимо пола, пустой floor
   и полный отказ всех комнат остаются тёмными. **Доказательство:** существующий
   `smoke_glow_fail_dark` без ослабления плюс unit.
6. **AC6 — неизменность валидных планов.** Обычные Glow-сцены дают ту же площадь
   с допуском boolean quantum и те же pixels в reviewed golden; входные arrays
   и persisted config не мутируются. **Доказательство:** unit, golden verify и
   config round-trip/source review.
7. **AC7 — Glow-base.** На regression fixture каждая eligible-комната имеет
   текущую Glow-base; если observation не воспроизводится, implementation
   evidence прямо это фиксирует без лишнего продуктового изменения.
   **Доказательство:** targeted browser smoke.
8. **AC8 — deterministic geometry.** Повторный вызов и перестановка room bodies
   дают эквивалентную площадь/path coverage; `-0`, adjacent duplicates и
   quantum-degenerate rings обрабатываются явно. **Доказательство:** unit.
9. **AC9 — performance/privacy.** Fast path остаётся O(vertices + текущие
   boolean operations), fallback не работает постоянно, warning redacted и
   deduplicated. **Доказательство:** source review и targeted performance smoke.
10. **AC10 — release artifacts.** Оба changelog, testing docs, mutation registry,
    generated bundles и screenshot/golden fingerprints актуальны.
    **Доказательство:** docs check, build parity и review diff.

## 16. План автотестов

### 16.1. Цикл реализации

```bash
npm run typecheck
npm test
npm run build
```

Unit matrix:

- 1 ULP и `±1e-12/±1e-9` на общей вертикальной/горизонтальной границе;
- exact six-room minimized fixture;
- invalid room среди двух валидных;
- empty/missed floor и source-outside-floor;
- input immutability, repeatability, reversed/permuted bodies;
- structured callback и diagnostic dedupe.

### 16.2. Targeted smoke перед S7

```bash
node demo/smoke_glow.mjs
node demo/smoke_glow_blending.mjs
node demo/smoke_glow_fail_dark.mjs
```

Добавляется отдельный узкий smoke либо детерминированное расширение
`smoke_glow` для ULP-fixture, DOM clipPath, Glow-base и console warning.

### 16.3. Mutation gate

| id | Мутация | Обязанный guard |
|---|---|---|
| `union-quantization-removed` | убрать normalization перед polyclip | AC1/AC2 unit |
| `union-failure-kills-space` | вернуть общий отказ всего floor | AC3 unit/smoke |
| `union-failure-silent` | убрать structured diagnostic/warning | AC4 console test |
| `glow-fail-dark-weakened` | вернуть raw fan или пропустить source guard | существующий fail-dark smoke |

Перед S7 выполняются `node scripts/mutation-gate.mjs --check` и целевые мутанты,
если их runtime укладывается в локальный review gate.

### 16.4. Golden и предрелиз

Golden verify выполняется на существующих Glow-сценах: валидные планы не должны
получить видимый raster diff. Если для #218 добавляется новый visual scenario,
его baseline принимается только через `npm run golden:accept -- --reviewed` по
полному Linux CI artifact перед бетой. Полный smoke/golden/performance —
предрелизный гейт по PROCESS, не цикл реализации.

## 17. Release-артефакты

В user-visible implementation commit обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — одна комната с численным шумом
  больше не гасит Glow пространства;
- `docs/TESTING.md` — ULP-fixture, покомнатный fail-dark fallback и диагностика;
- targeted smoke/mutation registry;
- generated `dist`, demo и integration bundles;
- `docs/images/screenshots.json`, только если build/visual harness этого требует.

User Guide не меняется: настройки и пользовательский сценарий остаются прежними.

## 18. Откат

Откат выполняется одним user-visible implementation commit вместе с tests,
bundles и changelog. Persisted rollback/migration не нужен. При откате вернётся
старый полный fail-dark, но сохранённые планы останутся совместимыми.

## 19. Принятые предположения

Можно свободно изменить на ревью ТЗ без вопроса владельцу:

1. quantum `1e-6` применяется ко всем входам `unionBodies()`, а не только Glow,
   потому что это общий boolean boundary и эксперимент #218 подтвердил его;
2. pure geometry сообщает индексы, а room/space ids добавляет renderer;
3. warning дедуплицируется по space + fingerprint + room;
4. приватный реальный экспорт не коммитится — только минимальная геометрия с
   сохранёнными проблемными double-значениями;
5. наблюдение Glow-base считается частью #218 только при той же корневой причине.
