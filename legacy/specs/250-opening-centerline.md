# Issue #250 — символы всех проёмов всегда на осевой стены

- Дата: 2026-08-23
- Тип: bug + polish · приоритет P2
- Оценка: пользовательская ценность 6/10 · сложность 3/10 · риск 4/10
- Issue: [#250](https://github.com/Matysh/houseplan-card/issues/250)
- Предшественник: [#242](https://github.com/Matysh/houseplan-card/issues/242)
- Ветка: `issue/250-opening-centerline`
- Статус ТЗ: на ревью

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/WALL-THICKNESS.md`, `docs/ISOMETRIC.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/USER-GUIDE.ru.md`.

## 1. Сценарий и персона

Администратор дома размещает дверь или окно в толстой стене и выбирает
«Открывается в другую сторону». Затем он и остальные жильцы видят проём во
View, на статической карточке либо в скрытом изометрическом режиме.

Человек ожидает, что настройка меняет сторону открывания створки, но не
переносит весь архитектурный символ к одной из граней стены. Одна и та же дверь
должна оставаться на осевой линии стены при любом направлении створки.

## 2. Что человек увидит до и после

**До:** дверь или окно с включённым «Открывается в другую сторону» сдвинуто на
половину толщины стены и выглядит стоящим у её грани; такое же смещение видно в
скрытой изометрии.

**После:** дверь, окно, ворота и открытый проём всегда привязаны к осевой линии
стены. Переключение направления только зеркалит створку или меняет направление
её поворота; положение проёма не меняется.

## 3. Проблема и подтверждённый диагноз

#242 ввела общий pure helper `openingSymbolOffset()` и центрировала default
состояние, но намеренно сохранила compatibility-исключение: door/window с
`flip_v: true` получают translation на одну локальную полутолщину стены.

На текущем `dev` это закреплено тремя уровнями:

1. `src/opening-symbol-placement.ts` возвращает ненулевой offset для
   door/window при `flip_v: true`;
2. `src/render/opening-symbol.ts` переводит внутреннюю группу створок, дуг и
   оконного стекла на этот offset;
3. `src/iso-openings.ts` прибавляет offset к structural origin каждой створки.

При этом направление уже представлено отдельно. Flat renderer зеркалит
door/window через `sy`; Iso применяет эквивалентное преобразование basis. У
ворот знак 10° поворота приходит через `face.side`. Полная глубина косяков
берётся из `face.cm` и не зависит от visual translation.

Следовательно, позиционное значение `flip_v` можно удалить без изменения
persisted данных, wall cut, tunnel либо выбора стороны створки.

## 4. Зафиксированное решение владельца

1. Видимый архитектурный символ любого проёма располагается на осевой линии
   host wall при обоих значениях `flip_v`.
2. `flip_v` остаётся только командой направления:
   - у door/window зеркалит створки, дуги и оконную группу относительно оси;
   - у gate меняет знак существующего 10° поворота;
   - у passage неприменим, потому что видимого символа нет.
3. Настройка направления не меняет saved `x/y`, host, wall cut, tunnel,
   jamb depth, hitbox или отдельный lock badge.
4. Контракт одинаков для preview, committed Flat/View, hosted Static и
   скрытого Iso.

Продуктовых вопросов не осталось.

## 5. Цели

- убрать последнее позиционное исключение из контракта #242;
- сделать centerline безусловным инвариантом любого opening symbol;
- сохранить направление створок и ворот при `flip_v`;
- сохранить единую геометрию на всех render surfaces;
- не переписывать и не мигрировать существующие конфиги.

## 6. Скоуп

### Входит

- безусловный нулевой visual offset для door/window/gate/passage;
- сохранение зеркала door/window и смены знака поворота gate;
- Flat/View, placement preview, hosted Static и hidden Iso parity;
- room-wall и explicit partition-hosted openings;
- горизонтальные, вертикальные и диагональные стены любой валидной толщины;
- unit, mutation guard, targeted browser smoke и semantic golden;
- нормативные документы, пользовательская инструкция и changelog RU/EN.

### Не входит

- изменение `flip_h`, петель либо длины проёма;
- изменение wall association, `compareOpeningSides`, `face.side` или
  `partitionOpeningFace`;
- изменение cut, room-coloured tunnel, jambs, wall fill, Glow или солнца;
- изменение lock badge, contact/lock state, actions и interaction hitbox;
- изменение формы дуг, створок, ворот или окна помимо удаления translation;
- persisted migration, backend/schema либо новый compatibility field;
- новый UI-control или переименование существующей настройки;
- публикация скрытого Iso.

## 7. Контракт поведения и геометрии

### 7.1. Безусловный centerline

Для всех комбинаций:

```text
type ∈ {door, window, gate, passage}
flip_v ∈ {false, true}
angle ∈ любое конечное направление, включая диагональ
face ∈ valid room-wall или partition face любой положительной толщины
```

visual translation относительно saved opening origin равен точно
`{ ox: 0, oy: 0 }`. Это точный инвариант, а не значение в пределах pixel
tolerance. Порядок комнат, направление endpoints и знак resolved face его не
меняют.

Для malformed/non-finite angle или face helper также fail-safe возвращает
точный ноль: вычислять позицию по повреждённой геометрии не требуется.

### 7.2. Направление остаётся отдельным

Нулевой translation не отменяет transform направления:

| Тип | `flip_v: false` | `flip_v: true` | Origin |
|---|---|---|---|
| door | текущая сторона дуги/полотна | зеркальная сторона | saved `x/y` |
| window | текущая сторона створок/дуг | зеркальная сторона | saved `x/y` |
| gate | текущий знак поворота 10° | противоположный знак 10° | saved `x/y` |
| passage | символ отсутствует | неприменимо | saved `x/y` cut |

Для door/window точка крепления створки остаётся на том же centerline origin,
а открытая геометрия уходит на противоположную сторону. Для window стекло,
дуги и створки используют один origin и не расходятся друг с другом.

### 7.3. Толстая стена

На стене 70 см:

- translation всей movable visible group от оси равен 0 см / 0 render units;
- jamb endpoints остаются на `±35 см` от оси по нормали стены;
- wall cut и coloured tunnel продолжаются через полные 70 см;
- переключение `flip_v` не меняет ни одно из этих трёх чисел.

То же правило действует для толщин 1, 15 и 100 см и для `cell_cm` 1/2.54/5/30:
физическая толщина меняет jamb depth, но никогда symbol origin.

## 8. UX и render parity

- Preview до клика и committed opening после Save имеют одинаковый origin.
- Переключение Plan/View, reload и HA state tick не меняют origin.
- Static использует тот же shared visible renderer, а Iso — тот же pure offset
  contract при построении structural basis.
- Открывание/закрывание меняет только live amount, не structural center.
- `hide_openings` и passage сохраняют существующее поведение.
- Lock badge остаётся отдельным status/action affordance и не считается частью
  архитектурной группы, центрируемой этой задачей.

## 9. Модель данных, migration и compatibility

Модель данных не меняется. `OpeningCfg.flip_v` остаётся boolean, сохраняется и
round-trip проходит как прежде. Существующие записи не переписываются: их новое
отображение получается на render-time.

Это намеренное изменение видимой семантики уже сохранённого `flip_v`, одобренное
владельцем, а не migration. Старый reader продолжит edge-align, новый reader
всегда центрирует; отдельный model-version bump не требуется, потому что формат
и валидность данных не изменились.

`docs/CONFIG-COMPATIBILITY.md` проверяется, но содержательно не меняется, если
реализация не затронет формат.

## 10. i18n, accessibility и touch

**i18n:** новых ключей нет. Текущие `opening.flip_v` — «Открывается в другую
сторону» / “Opens to the other side” — после исправления точнее соответствуют
реальному поведению.

**Accessibility:** controls, accessible names и DOM-порядок не меняются.

**Touch:** новых жестов нет. Preview и committed symbol на touch получают тот
же centerline contract; pan, pinch, pointercancel и hit targets не меняются.
View/kiosk parity блокирующая, потому что View является основной поверхностью.

## 11. Производительность и безопасность

Helper становится константным O(1) без тригонометрии. Нельзя добавлять обход
комнат/стен, новый cache или state-dependent geometry. Structural Iso cache
по-прежнему может учитывать flips, потому что они меняют basis direction, хотя
больше не меняют origin.

Новых service calls, HTML, доверенных строк или persisted input нет. Lock и
opening action guards остаются без изменений.

## 12. Критерии приёмки

| AC | Требование | Доказательство |
|---|---|---|
| AC1 | `openingSymbolOffset()` возвращает точный `{ox:0, oy:0}` для матрицы 4 типов × 2 flip × horizontal/vertical/diagonal angles × positive/negative/zero/malformed face | unit matrix + основной mutant |
| AC2 | Flat door/window при `flip_v: false/true` имеют один centerline origin; flip зеркалит дугу/створку, а window glass остаётся в общей группе | geometry/SVG unit + semantic golden |
| AC3 | Hidden Iso door/window при обоих flip имеют тот же origin, но противоположную направленную basis; Flat и Iso согласованы | Iso unit + cross-render smoke + golden |
| AC4 | Gate остаётся центрированным, `flip_v` по-прежнему меняет знак 10° поворота; passage не создаёт visible symbol | unit + существующий gate mutant + smoke |
| AC5 | На room wall и reversed partition host preview, committed View и Static совпадают; room order/endpoints не влияют на origin | browser smoke + golden semantic guard |
| AC6 | Для стены 70 см offset равен 0, jamb depth равен 70 см; cut, tunnel, hitbox, lock badge, bindings/actions, Glow и sun не меняются | focused units/smokes + code review |
| AC7 | Existing `flip_v` configs не переписываются, round-trip/export/import прежние; backend/schema/model_version diff отсутствует | existing config tests + diff review |
| AC8 | Нормативные документы и guide больше не обещают edge alignment; changelog RU/EN описывает видимое изменение | check-docs + code review |
| AC9 | Typecheck, unit и build зелёные; три поставляемые bundle-копии побайтово одинаковы | локальный implementation gate |

## 13. План автотестов

### 13.1. Unit

- заменить edge-aligned ожидания в
  `test/opening-symbol-placement.test.mjs` полной exact-zero матрицей;
- в `test/opening-symbol.test.mjs` доказать общий origin, противоположное
  направление door/window и неизменный full-depth jamb;
- в `test/iso-openings.test.mjs` отделить same-origin от mirrored basis;
- сохранить тест противоположного gate turn при `flip_v`;
- проверить passage и malformed inputs;
- проверить, что `openingVisibleMetrics()` и hit geometry не зависят от
  удалённого translation.

### 13.2. Browser smoke

Расширить существующие `demo/smoke_wall_thickness.mjs`,
`demo/smoke_opening_preview.mjs` и `demo/smoke_isometric_contract.mjs` либо
добавить один узкий smoke, если существующие не дают наблюдать origin:

- 70-см room wall и diagonal partition;
- door/window с `flip_v=false/true` рядом;
- preview → Save → View → reload;
- hosted Static и hidden Iso;
- gate turn sign, jamb depth, opening cut/tunnel и lock action regression.

### 13.3. Golden

Переиспользовать четыре semantic scenes #242:

- `opening-symbol-room-wall-light`;
- `opening-symbol-diagonal-partition-dark`;
- `opening-symbol-flip-pairs-light`;
- `isometric-opening-symbol-parity-dark`.

Их semantic contract меняется только для flipped door/window offset: ожидается
точный ноль вместо полутолщины. До PNG guard проверяет centerline, jamb depth,
зеркальное направление door/window и противоположный gate turn.

Полный `golden:verify` и принятие baseline выполняются перед бетой из reviewed
Linux CI artifact; локальный accept запрещён. Реализация обязана перечислить
весь фактический golden impact, а не только четыре целевые сцены.

## 14. Mutation guards

Старые мутанты #242, завязанные на удаляемую ветку
`opening-symbol-default-uses-room-face`,
`opening-symbol-partition-follows-endpoints` и
`opening-gate-flip-translates-leaves`, выводятся из реестра либо заменяются:
после безусловного нуля их anchors больше не описывают production contract.

Добавляется основной мутант:

| id | Что ломает | Что обязано покраснеть |
|---|---|---|
| `opening-symbol-flip-restores-edge-offset` | возвращает для door/window с `flip_v:true` старый сдвиг на `cm/2` | AC1 placement unit, AC2 Flat unit, AC3 Iso unit |

Существующий `opening-gate-flip-cancels-turn` сохраняется и обязан продолжать
падать, если новая правка случайно отменит направление ворот.

## 15. Гейты реализации

В implementation loop:

```text
npm run typecheck
npm test
npm run build
сверка dist / integration frontend / demo bundle
```

Перед передачей в code review дополнительно выполняются выбранные
`smoke-select` opening/Static/Iso smokes, clean mutation gate, основной mutant,
`check-docs` и `process-gate` в объёме задачи.

Полный golden, полный smoke suite и performance — предбетовые гейты по
PROCESS.md. Backend pytest не требуется, пока backend/schema не затронуты.

## 16. Release-артефакты

User-visible implementation commit одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #250;
- `docs/USER-GUIDE.ru.md` — `flip_v` меняет только направление;
- `docs/WALL-THICKNESS.md` — безусловный centerline contract;
- `docs/ARCHITECTURE.md` и `docs/ISOMETRIC.md` — removal compatibility offset;
- `docs/TESTING.md` и semantic golden guards.

Любое изменение `src/**` делает screenshot provenance предметом проверки.
Канонический workflow `Docs screenshots` запускается после implementation
commit; результат принимается только через
`npm run docs:accept -- --reviewed --from=<run-id>`. Если пиксели не меняются,
обновляется только проверяемый provenance; если целевая сцена содержит flipped
opening, принимается и ожидаемая визуальная дельта.

Golden baselines принимаются только в предрелизном цикле из reviewed Linux
artifact.

## 17. Откат

Одна code revision возвращает прежнюю compatibility-ветку translation. Данные
и migration для отката не нужны; сохранённый `flip_v` не меняется. Откат
возвращает видимый дефект, но не повреждает план.

## 18. Риски

1. **Вместе со сдвигом исчезает зеркало door/window.** Митигация: AC2/AC3
   сравнивают направление при одном origin.
2. **Gate теряет противоположный 10° turn.** Митигация: AC4 и существующий
   mutation guard.
3. **Косяки схлопываются к оси.** Митигация: AC6 фиксирует 70-см depth отдельно
   от нулевого symbol offset.
4. **Flat исправлен, Iso остаётся у грани.** Митигация: общий helper, AC3/AC5 и
   hidden-Iso golden.
5. **Golden impact недооценён.** Митигация: полный pre-beta verify, exact impact
   list и запрет локального accept.
6. **Старые мутанты становятся зелёными без предмета.** Митигация: явная замена
   трёх obsolete anchors в §14.

## 19. Принятые предположения — технические, менять свободно

1. Предпочтительно сохранить `openingSymbolOffset()` как единственную pure
   точку безусловного centerline-контракта и вернуть из неё константный ноль.
   Удаление helper допустимо, если Flat и Iso продолжают использовать один
   доказуемый contract без дублирования.
2. Текущую сигнатуру с `type/flipV/angle/face` можно временно оставить ради
   ясного вызова и mutation test; unused parameters допустимо переименовать.
3. Existing four golden scenes #242 достаточны и не требуют пятой сцены, если
   semantic guard действительно различает старый edge offset и новый zero.
4. Отдельный lock badge остаётся на текущей стороне стены: он сообщает статус
   замка и не является частью архитектурной opening group.

**Не являются предположениями:** нулевой offset при любом `flip_v`, сохранение
направления створок/ворот, full-depth jambs, отсутствие migration и parity
Flat/preview/Static/Iso — решения владельца.
