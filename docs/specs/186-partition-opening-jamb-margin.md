# #186 — Безопасный остаток стены у торцов партиционного проёма

Статус: готово к ревью ТЗ  
Issue: [#186](https://github.com/Matysh/houseplan-card/issues/186)  
Связано: [#132](https://github.com/Matysh/houseplan-card/issues/132)

## 1. Сценарий пользователя

Администратор размещает или перемещает дверь, окно, ворота либо открытый проём
в независимой стене. Редактор оставляет у каждого торца стены физически
правдоподобный участок, поэтому проём не может закончиться вровень с торцом.

## 2. Проблема

Редактор и backend считают валидным проём, край которого совпадает с торцом
независимой стены. У такой geometry нет физического остатка стены под откос,
хотя контракт #132 требует jamb safety margin; frontend и backend одинаково
пропускают это нарушение.

### До / после

**До:** frontend считает валидным любой проём, целиком находящийся между
математическими endpoints host. Backend повторяет эту границу с одним лишь
floating-point epsilon. Край проёма можно сохранить прямо на торце стены.

**После:** у обоих торцов host резервируется остаток, равный половине фактической
толщины этой стены. Новое или геометрически изменённое размещение использует одну
границу во frontend и backend. Существующая пограничная запись не исчезает, не
сдвигается сама и может без изменений пройти через постороннее сохранение.

## 3. Решения владельца

1. Jamb safety margin у каждого endpoint равен половине фактической толщины
   конкретной partition.
2. Правило одинаково для `door`, `window`, `gate` и `passage`.
3. Между соседними проёмами новый зазор не вводится: остаётся только действующий
   запрет пересечения интервалов.
4. Уже сохранённые проёмы, нарушающие новый предел, остаются видимыми и рабочими;
   silent clamp и write-on-read запрещены.
5. Новая граница обязательна при создании, перемещении самого проёма, изменении
   его длины и перепривязке. Отказ имеет локализованное объяснение.
6. Полный backup/restore всегда сохраняет legacy near-end проёмы: поверх
   текущего плана, на пустой и на другой инсталляции. Full import проверяет
   структурное попадание внутрь host, но не применяет новый jamb margin.

## 4. Техническая база и единицы

Сейчас `resolvePartitionOpening()` уже принимает `jambMargin`, но default равен
нулю и production call sites ненулевое значение не передают. Placement и drag
ограничивают центр только половиной длины проёма. Backend
`_space_geometry_invariants()` также проверяет лишь попадание внутрь endpoints.

Единый физический контракт:

```text
wallDepth = wallCmToUnits(partition.cm, cellCm, gridPitch)
jambMargin = wallDepth / 2
requiredShoulder = openingLength / 2 + jambMargin
valid = along >= requiredShoulder
     && along <= hostLength - requiredShoulder
```

Равенство границе валидно с общим geometry epsilon. Для backend в хранимых
normalized units та же формула имеет вид
`partition.cm / cell_cm / 240 / 2`; литерал `240` должен быть общей именованной
константой масштаба canvas, а не новым настраиваемым параметром. При отсутствии
`cell_cm` используется действующий default 5 cm.

## 5. В scope

- pure helper/режим проверки jamb margin в `partition-openings`;
- размещение и preview на independent partition;
- drag hosted opening вдоль partition;
- изменение длины в opening dialog и explicit rebind;
- frontend commit validation и отдельная причина `does-not-fit-jamb` либо
  эквивалентный typed result;
- backend semantic delta validation для config/set и optimize;
- совместимый full import/restore без нового jamb margin, в том числе без
  trusted previous на пустой или другой инсталляции;
- совместимое чтение и рендер уже сохранённых нарушающих записей;
- RU/EN сообщение, unit/backend/browser coverage и документация.

## 6. Не в scope

- дополнительный зазор между двумя проёмами;
- изменение формы jamb returns, symbols, tunnel, light cut либо room topology;
- новый persisted field, настройка размера запаса или migration конфига;
- автоматический перенос/уменьшение старого проёма;
- resize partition как новый жест; действующее перемещение segment остаётся
  rigid translation;
- полная touch parity редактора.

## 7. Frontend-контракт

### 7.1 Два явных режима resolver

Все consumers `resolvePartitionOpening()` должны осознанно выбрать режим:

- **compat/read:** прежняя проверка `jambMargin=0`; используется для render,
  cuts, symbols, hit-test, static/Iso и materialized projection уже принятого
  конфига;
- **strict/write:** margin равен половине resolved depth; используется для
  нового placement, direct opening drag, rebind и сохранения изменённой
  geometry.

Нельзя менять default так, чтобы старый near-end opening стал orphan/fail-dark
только из-за обновления frontend. Именованный helper/policy должен исключить
копирование формулы по call sites.

### 7.2 Размещение

Для partition target resolver:

- считает target eligible, только если
  `hostLength >= openingLength + 2 * physicalHalfWidth`;
- после grid/center magnet ограничивает `along` диапазоном
  `[openingLength/2 + physicalHalfWidth,
  hostLength - openingLength/2 - physicalHalfWidth]`;
- preview, ruler и следующий click используют один resolved candidate;
- room-wall placement сохраняет прежнюю границу без нового jamb margin;
- физически слишком короткая partition не получает preview, а click рядом с
  ней показывает новое локализованное сообщение, не generic orphan.

На точной границе preview и click валидны. Размеры ruler измеряют фактические
плечи от края проёма до endpoints и потому показывают минимум, равный margin.

### 7.3 Drag и dialog

Direct drag hosted opening к торцу ограничивает центр тем же strict-диапазоном;
preview не может показать и commit не может сохранить меньше margin. Если host
слишком короток для текущей длины, drag не меняет config.

При сохранении dialog strict rule применяется, когда изменены `host.id`,
`host.t` или `length`, либо создаётся новая запись. Изменение только type,
binding, invert/flip или другого негеометрического поля у legacy near-end
opening разрешает прежнюю geometry без автоматического исправления.

Dialog различает отсутствующий host и недостаточный остаток стены. Для второго
случая показывает status banner и при попытке сохранения сообщение:

- RU: `Оставьте от края проёма до торца стены минимум {distance}`;
- EN: `Leave at least {distance} between the opening and the end of the wall`.

`{distance}` форматируется действующим `formatLength()` в системе единиц HA.
Rebind на слишком короткую partition использует ту же строку. Missing partition
продолжает использовать `opening.partition_orphan`.

### 7.4 Перемещение host

Rigid translation partition сохраняет `t`, length, thickness и относительные
плечи, поэтому не создаёт нового нарушения и совместимо переносит даже legacy
near-end opening. Изменение длины host или его `cm`, способное создать либо
усилить нарушение, должно пройти strict backend boundary; будущий frontend
resize обязан использовать тот же helper.

## 8. Backend и compatibility

Структурная `SPACE_SCHEMA` сохраняет прежний zero-margin fit check, чтобы
полученный ранее near-end config мог быть прочитан и провалидирован перед
semantic delta comparison. Новый jamb contract реализуется в semantic validator
рядом с `validate_partition_opening_hosts()` либо в его расширении.

Для обычного write с `previous`:

- новая hosted opening проверяется strict;
- существующая проверяется strict, если изменились `host.id`, `host.t`,
  `length`, длина host либо `cm`;
- неизменённая relative geometry допускается, включая rigid translation обоих
  endpoints на один вектор и посторонние изменения config;
- удаление opening вместе с host остаётся валидным;
- существующий downgrade guard удаления `host` сохраняется;
- overlap rule не меняется.

Полный import/restore всегда использует compatibility-границу: structural
validation по-прежнему требует, чтобы opening целиком находился внутри host,
но jamb margin не применяется ни поверх текущего плана, ни без trusted previous
на пустой или другой инсталляции. Поэтому неизменённый legacy backup остаётся
восстановимым. Осознанная цена решения владельца: вручную изменённый полный
backup тоже может содержать near-end geometry, которую обычный UI создать уже
не позволит; следующий direct geometry edit потребует исправления.

Для strict config/set/optimize отказ возвращает стабильный public code
`invalid_partition_opening_jamb_margin` (или расширенный typed reason того же
уровня), включая `space`, `opening` и требуемый margin в diagnostic message.
Backend ничего не нормализует и не переписывает.

## 9. UX-состояния

| Состояние | Результат |
|---|---|
| Новая opening на длинной partition | preview/click clamp оставляют по половине толщины у торцов |
| Partition короче `opening + thickness` | preview отсутствует, click даёт jamb guidance |
| Drag к endpoint | opening останавливается на точной допустимой границе |
| Увеличение длины в dialog нарушает margin | banner + локализованный отказ, config не меняется |
| Legacy near-end opening без geometry edit | видим, интерактивен и losslessly сохраняется |
| Full restore с legacy near-end opening | импортируется без jamb-проверки, в том числе на пустой/другой инсталляции |
| Legacy opening получил direct move/length/rebind | новая geometry обязана соответствовать margin |
| Два соседних opening касаются, но не пересекаются | допустимо по прежнему overlap contract |
| Missing partition | прежний orphan/fail-dark contract #132 |

## 10. Модель данных, i18n и доступность

Модель данных и schema полей не меняются. Добавляются синхронные RU/EN ключи для
jamb guidance/banner; один и тот же текст используется мышью и клавиатурным
сохранением. Banner имеет действующий `role="status"`; цвет/preview не является
единственным объяснением отказа.

**Touch editor: best effort / intentionally degraded.** Новых жестов нет.
Обязателен safety floor: tap повторно разрешает candidate, а pinch, второй
pointer и `pointercancel` не сохраняют opening. Hover parity не обещается.

## 11. Критерии приёмки

### AC1 — единая физическая граница

Для partition толщиной `D` каждый endpoint сохраняет плечо не меньше `D/2` для
door/window/gate/passage. Точная граница валидна, значение меньше неё — нет.
Frontend и backend дают одинаковый результат минимум для `cm=1/15/100`, default
и нестандартного `cell_cm`, horizontal/diagonal/reversed host.

**Доказательство:** pure unit matrix + backend parametrized tests с exact
boundary и boundary-minus-epsilon.

### AC2 — placement и drag не создают плохую geometry

Hover/click на partition clamp к strict range; слишком короткий host не создаёт
candidate. Direct drag останавливается на той же границе. Preview, rulers и
сохранённые `host.t/x/y` соответствуют одному resolved center.

**Доказательство:** `opening-placement`/`partition-openings` units + browser
smoke placement и drag у обоих endpoints.

### AC3 — dialog и rebind объясняют отказ

Недопустимое изменение length/host получает jamb-specific RU/EN status/toast с
форматированным физическим расстоянием; missing host остаётся отдельным orphan.
После отказа config/history не изменены. Rebind на валидный host проходит.

**Доказательство:** source/i18n contracts + browser smoke dialog/rebind и
отсутствия config write.

### AC4 — legacy compatibility

Сохранённый near-end opening остаётся видимым и рабочим во всех прежних
consumers, не получает silent clamp и проходит backend round-trip при
постороннем edit или rigid host translation. Direct geometry edit того же
нарушения отклоняется, а полный backup/restore сохраняет запись без
jamb-проверки поверх текущего плана и без trusted previous.

**Доказательство:** frontend render/cut regression unit + backend delta tests
для ordinary write и full-import compatibility tests поверх текущего, пустого
и другого config.

### AC5 — overlap и остальные host не меняются

Между соседними openings не появляется новый gap; пересечение по-прежнему
запрещено. Room-wall opening, orphan policy, cut/symbol/tunnel/light и delete
semantics #132 не меняются.

**Доказательство:** существующие tests #132/#157/#193 + новые negative units.

### AC6 — server parity и error code

`config/set` и optimize применяют один semantic validator. Новый/изменённый
invalid record возвращает стабильный jamb error code, а structural schema не
ломает совместимый unchanged round-trip. Full import остаётся на zero-margin
structural boundary и не вызывает этот jamb validator.

**Доказательство:** backend validator tests и websocket tests обоих strict
write paths плюс full-import compatibility regression.

## 12. План проверок

В implementation loop:

- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- целевые backend tests для validation/websocket.

Перед `S7-code-review`:

- затронутый browser smoke placement/drag/dialog;
- golden capture/verify только если реализация меняет видимые pixels.

Визуальный стиль не должен меняться, поэтому новый baseline не ожидается. Если
появится новый banner в зафиксированной golden-сцене, candidate обязан пройти
обычный Linux review, а не приниматься автоматически. Полные golden, smoke и
performance остаются pre-beta gate по release runbook.

## 13. Риски и производительность

| Риск | Мера |
|---|---|
| Default strict скрывает старые openings | явные compat/read и strict/write call sites |
| Frontend/backend расходятся в масштабе | shared named formula и boundary matrix |
| Structural schema блокирует round-trip раньше delta validator | zero-margin schema + semantic comparison с previous |
| Full restore ошибочно становится strict | отдельный compat import path и tests с/без текущего config |
| Негеометрическое редактирование требует миграции | сравнивать только relative geometry contract |
| Rigid translation ошибочно считается resize | сравнивать span, `cm`, host identity/t, а не absolute endpoints |
| Room-wall placement получает новый отступ | margin только при `partitionHost` |
| Новый gap появляется между openings | не менять `hostedOpeningIntervalsOverlap` |

Расчёт O(1) на candidate/opening; новых geometry passes, observers, animation и
network calls нет. Backend остаётся O(openings + partitions) на space при index
partition по id. Отдельный performance profile не требуется.

## 14. Откат

Откат удаляет strict jamb policy, semantic delta validator, новые i18n строки и
tests. Persisted schema не менялась, поэтому downgrade/migration не нужны;
поведение возвращается к zero-margin границе.

## 15. Release-артефакты

- user-visible implementation commit обновляет `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.md` (либо актуальный раздел Plan editor) фиксирует минимум у
  торца независимой стены;
- `docs/CONFIG-COMPATIBILITY.md` описывает delta-validation и tolerant legacy
  round-trip без нового поля;
- `docs/TESTING.md` перечисляет unit/backend/smoke proof;
- синхронные `dist`, integration frontend и demo bundle;
- новых screenshots/golden baselines нет, если pixels не меняются;
- issue остаётся открытой до выпуска беты.

## 16. Принятые технические предположения

1. Rigid translation host не является geometry change относительно jamb rule:
   относительные shoulders не меняются, поэтому legacy opening переносится без
   принудительного ремонта.
2. Изменение `type` без изменения длины не влияет на jamb geometry и само по
   себе не включает strict-проверку.
3. Имена helper, typed reason и i18n key не являются публичным API; ревьюер может
   изменить их при сохранении AC и стабильного backend error code.
4. Для malformed `cm/cell_cm` сохраняется действующий schema/fail-dark contract;
   #186 не вводит fallback физической толщины.
