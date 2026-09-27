# Issue #242 — символ проёма по центру толщины стены

- Дата: 2026-08-22
- Тип: bug · приоритет P2 · ценность 6/10 · сложность/риск 5/10 и 6/10
- Issue: [#242](https://github.com/Matysh/houseplan-card/issues/242)
- Ветка: `issue/242-opening-symbol-center`
- Статус ТЗ: на ревью

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/WALL-THICKNESS.md`, `docs/TOUCH-SUPPORT.md`,
`docs/ISOMETRIC.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/USER-GUIDE.ru.md`.

## 1. Сценарий и персона

Администратор дома размещает дверь, окно или ворота в толстой стене комнаты
либо независимой стене. Во View он ожидает, что символ обозначает один и тот же
физический проём независимо от порядка комнат в конфигурации и от направления,
в котором была нарисована стена.

Сейчас видимая створка/дуга/стекло сдвигается к выбранной грани стены. Для
общей стены выбор зависит от первой комнаты в model order, для независимой — от
направления segment. Поэтому перестановка комнат или разворот endpoints меняет
вид готового плана без изменения его архитектуры.

## 2. Что человек увидит до и после

**До:** символ проёма находится у одной из граней толстой стены; выбранная грань
может измениться после перестановки комнат либо при эквивалентной записи стены с
обратным направлением.

**После:** обычный символ проёма находится точно на центральной оси толщины
стены на всех render surfaces. Косяки по-прежнему показывают полную глубину
проёма. Сохранённый `flip_v: true` остаётся явным ручным исключением для двери
и окна, а у ворот меняет только направление лёгкого поворота створок.

## 3. Подтверждённый диагноз

Дефект подтверждён на актуальном `dev`:

1. `openingInnerFaceOffsetFromIndex()` выбирает natural room side после
   сортировки кандидатов по `order`, то есть зависит от порядка комнат.
2. `partitionOpeningFace()` выбирает normal side из направления endpoints
   независимой стены.
3. `renderOpeningVisibleGeometry()` переводит всю видимую группу на `face.ox`
   / `face.oy`; окно переносит вместе с ней стекло, дверь — створку и дугу,
   ворота — обе створки.
4. `buildIsoOpeningBasis()` использует те же offsets для скрытого Iso.
5. Косяки вычисляются отдельно из полной `face.cm`, поэтому сам физический
   tunnel уже имеет правильную глубину и не требует изменения.

Тесты и golden сейчас закрепляют старое edge-aligned поведение, включая
room-order dependency; их необходимо заменить новым инвариантным контрактом.

## 4. Зафиксированные продуктовые решения

1. Если `flip_v` отсутствует либо равен `false`, дверь, окно и ворота
   центрируются по толщине host wall.
2. Для двери и окна сохранённый `flip_v: true` остаётся ручным выравниванием к
   грани на стороне «открывается в другую сторону». Сторона определяется
   собственной канонической локальной осью проёма и не зависит от model order
   комнат либо направления endpoints host wall.
3. Створки ворот остаются по центру при обоих значениях `flip_v`; флаг меняет
   только знак существующего 10° поворота.
4. Один контракт действует в committed Flat/View, preview размещения, hosted
   Static и скрытом Iso.
5. У окна центрируется вся видимая группа: стекло, створки и дуги. Косяки всех
   типов сохраняют полную физическую глубину стены.

## 5. Цели

- убрать случайную зависимость положения символа от порядка комнат и
  направления рисования стены;
- сделать default-положение физически честным и одинаковым на всех surfaces;
- сохранить совместимость сохранённых `flip_v` и направленность ворот;
- не менять cut, tunnel, hit geometry, свет, HA state и persisted schema.

## 6. Границы задачи

### Входит

- разделение физической толщины/направления face и визуального translation;
- центрирование door/window/gate на room-wall и partition host;
- детерминированная локальная сторона для `flip_v: true` у door/window;
- preview, Flat/View, hosted Static и hidden Iso parity;
- обновление unit, browser smoke, golden и нормативной документации;
- оба changelog в user-visible implementation commit.

### Не входит

- изменение wall cut, jamb depth, opening length или безопасного остатка стены;
- новый persisted field, миграция, backend/schema/compatibility change;
- изменение passage: у него нет видимого символа;
- новая UI-настройка или переименование существующего `flip_v`;
- изменение lock badge, hitbox, info/action, contact/lock state;
- изменение Glow/spill, солнца, room fill, decor или vacuum;
- публикация скрытого Iso либо новый Iso UX.

## 7. Геометрический контракт

Resolver проёма обязан различать три независимые величины:

- `cm` — полная физическая толщина host wall;
- `side` — детерминированное направление в локальной системе проёма;
- visual translation — сдвиг видимой группы относительно центральной оси.

Для любого valid host и конечной положительной толщины:

| Тип | `flip_v` | Translation видимой группы | Направление |
|---|---:|---|---|
| door | absent / `false` | `(0, 0)` | default local side |
| door | `true` | `normal * side * cm/2` | opposite local side |
| window | absent / `false` | `(0, 0)` | default local side |
| window | `true` | `normal * side * cm/2` | opposite local side |
| gate | absent / `false` | `(0, 0)` | знак текущего 10° поворота |
| gate | `true` | `(0, 0)` | противоположный знак 10° поворота |
| passage | любое | нет видимой группы | не применяется |

`normal` вычисляется из канонической локальной оси opening, а не из первого
room candidate и не из сырого порядка endpoints host. Эквивалентная геометрия
с переставленными room objects или reversed partition endpoints должна давать
битово одинаковые center/translation и визуально одинаковое направление.

Косяки всегда остаются на `±cm/2` от центральной оси и не входят в translated
группу. Window glass входит в ту же translated группу, что створки/дуги.
Gate leaves используют centered origin, а только их angle зависит от `side`.

Invalid/non-finite host geometry сохраняет действующий fail-safe и не получает
новых попыток inference. Эта задача не меняет правила выбора host.

## 8. Render parity

Один resolved geometry contract используется:

- в preview до клика и в записанном Flat/View;
- для legacy room-wall и explicit partition-hosted opening;
- в hosted Static card;
- в скрытом Iso через `buildIsoOpeningBasis()`.

Переход между Plan/View, reload и HA state tick не должен менять center. Preview
и committed opening обязаны совпадать при той же геометрии и `flip_v`.
`hide_openings` продолжает скрывать только символ по существующему контракту.

## 9. Данные, compatibility, i18n, a11y и touch

**Данные и migration:** отсутствуют. `OpeningCfg.flip_v` сохраняет boolean
формат; read/write/export/import и backend schema не меняются. Обновление
`docs/CONFIG-COMPATIBILITY.md` не требуется.

**i18n:** новых строк нет. Существующая подпись «Открывается в другую сторону»
остаётся применимой; подробная геометрическая семантика фиксируется в guide.

**A11y:** DOM controls и accessible names не меняются. Исправление касается
только SVG-геометрии.

**Touch editor: parity, no new interaction.** Preview и committed symbol на
touch используют тот же center contract; жесты, hit targets, pinch, pan и
`pointercancel` не меняются.

## 10. Производительность и безопасность

Изменение остаётся pure arithmetic на уже разрешённом opening/host. Нельзя
добавлять поиск комнат, обход всех стен или allocation cache на каждый render.
HA-only state tick не должен пересчитывать wall index чаще текущего поведения.

Новых service calls, доверенных строк, HTML и persisted input нет. Existing
guards для orphan/invalid opening и actions остаются единственным authority.

## 11. Acceptance criteria

| AC | Требование | Доказательство |
|---|---|---|
| AC1 | Door/window/gate без `flip_v` находятся на центральной оси стен толщиной 1/15/100 cm для horizontal/vertical/diagonal room wall и partition | geometry unit + reviewed golden |
| AC2 | Перестановка room objects и reversed partition endpoints не меняют default-символ и направление gate; физически эквивалентные fixtures дают одинаковые metrics | unit permutation matrix + browser smoke |
| AC3 | `flip_v: true` у door/window детерминированно выравнивает видимую группу к противоположной локальной грани; window glass движется вместе со створками/дугами | unit + golden |
| AC4 | Gate при обоих значениях `flip_v` центрирован, но знак 10° поворота меняется; jambs остаются full-depth | unit + golden |
| AC5 | Preview, committed Flat/View, hosted Static и hidden Iso используют один center/flip contract | cross-render smoke + golden |
| AC6 | Passage, wall cut, tunnel, hitbox, lock badge, HA state/actions, Glow и sun остаются без изменений | targeted regression units/smokes |
| AC7 | Existing configs round-trip без migration; schema/backend diff отсутствует | diff review + existing config tests |
| AC8 | Typecheck, unit, build и три bundle-копии зелёные; оба changelog и normative docs обновлены | gates + diff review |

## 12. План автотестов

### 12.1. Unit

- `openingInnerFaceOffsetFromIndex` либо новый resolver: empty/one/shared room,
  room-order permutations, 1/15/100 cm и non-finite guards;
- partition resolver: original/reversed endpoints, horizontal/vertical/diagonal;
- `openingVisibleMetrics` и SVG geometry для door/window/gate, оба `flip_v`;
- window glass, leaves/arcs and gate angle; full-depth jamb endpoints;
- Iso basis center and flip direction;
- negative checks для passage, lock badge и hit metrics.

### 12.2. Browser smoke

- разместить door/window/gate в толстой room wall и independent partition;
- сравнить preview с committed View;
- переставить rooms в fixture и развернуть partition endpoints без видимого
  изменения;
- переключить `flip_v`, reload и Plan/View;
- проверить hosted Static и hidden Iso semantic geometry;
- убедиться, что lock/action и HA state продолжают работать.

### 12.3. Golden

Обновить/добавить semantic scenes:

- centered door/window/gate на толстой room wall, Light;
- те же типы на diagonal partition, Dark;
- door/window с `flip_v: true` и gate `false/true` рядом;
- hidden Iso parity для center и gate direction.

Golden semantic guard обязан до PNG сравнения проверить wall centerline,
visible-group center, jamb depth, `flip_v` и gate angle. Baseline принимается
только из reviewed Linux release artifact перед бетой; локальный accept
запрещён.

## 13. Mutation guards

| id | Что ломает | Что обязано покраснеть |
|---|---|---|
| `opening-symbol-default-uses-room-face` | возвращает room-order-dependent translation по умолчанию | AC1/AC2 unit + smoke |
| `opening-symbol-partition-follows-endpoints` | разворот partition endpoints меняет symbol side | AC2 permutation matrix |
| `opening-gate-flip-translates-leaves` | `flip_v` снова переносит ворота к грани | AC4 unit + golden guard |

Минимум основной мутант выполняется локально: clean test зелёный, возвращённый
дефект красный. Реестр mutation gate обновляется по действующему формату проекта.

## 14. Гейты реализации

Обязательные:

```text
npm run typecheck
npm test
npm run build
сверка dist / integration frontend / demo bundle
node scripts/smoke-select.mjs --base origin/dev --head HEAD
все выбранные opening/static/iso browser smokes
node scripts/mutation-gate.mjs --check
основной мутант #242
npm run golden:verify
node scripts/check-docs.mjs
```

Backend pytest не требуется, пока backend/schema не затронуты. Отдельный
performance benchmark не требуется; действующий geometry/performance smoke
прогоняется, если его выберет `smoke-select`.

## 15. Release-артефакты

User-visible implementation commit одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — default center и сохранённая семантика `flip_v`;
- `docs/WALL-THICKNESS.md` — centerline, full-depth jamb и render parity;
- `docs/ARCHITECTURE.md` и `docs/ISOMETRIC.md` — разделённые physical direction
  и visual translation;
- затронутые opening golden scenes/semantic guards.

Пользовательский docs screenshot не нужен: инструкция текстовая, а визуальное
доказательство даёт reviewed golden. Если реализация всё же изменит canonical
изображение guide, оно обновляется только workflow `Docs screenshots` и
`npm run docs:accept -- --reviewed --from=<run-id>`.

## 16. Откат

Одна code revision возвращает прежний face translation. Данные и migration для
отката не нужны: формат `flip_v` не меняется. Откат снова возвращает заявленный
визуальный дефект, но не повреждает сохранённые планы.

## 17. Риски

1. **Центрирование створки ломает jamb depth.** Митигация: separate metrics и
   AC1/AC4 с толщинами 1/15/100 cm.
2. **`flip_v` теряет сохранённое значение.** Митигация: round-trip не меняется,
   оба значения покрыты unit/golden.
3. **Gate становится визуально симметричным и теряет направление.** Митигация:
   angle использует side отдельно от translation, AC4.
4. **Flat исправлен, preview/Static/Iso расходятся.** Митигация: shared resolver
   и AC5.
5. **Новая канонизация меняет не только представление host.** Митигация:
   permutation matrix и явные negative checks cut/hit/light.

## 18. Принятые предположения (техническое, менять свободно)

1. Предпочтительно расширить resolved face отдельным полем visual offset либо
   передавать policy в общий renderer; точные имена типов и helper свободны.
2. Каноническая локальная ось может строиться из нормализованного opening angle
   или эквивалентного stable tangent; важен инвариант, а не конкретная формула.
3. Lock badge остаётся на существующей позиции: задача исправляет только
   видимый symbol opening и не меняет action affordance.
4. Existing golden можно заменить новой сценой, если прежняя была создана
   только для доказательства ошибочного inner-face offset.

**Не являются предположениями:** default center, ручное edge alignment только
для `flip_v: true` у door/window, centered gate с меняющимся 10° направлением,
full-depth jambs и parity всех четырёх render surfaces — решения владельца.
