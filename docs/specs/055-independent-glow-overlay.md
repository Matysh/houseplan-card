# ТЗ #55 — Glow как независимый overlay поверх data fill

- Issue: https://github.com/Matysh/houseplan-card/issues/55
- Приоритет: P2
- Статус ТЗ: реализовано в v1.61.0-beta.2; уточнение #61 входит в v1.61.0-beta.3
- Связано: room override #36; additive pools #19; compatibility registry #33;
  custom fill #56

## Цель

Разделить две независимые функции:

1. заливку комнаты данными или статичным цветом;
2. световой Glow как отдельный слой поверх этой заливки.

Пользователь может одновременно видеть LQI/освещённость/температуру/свой цвет
и световые пятна Glow. Тёмная базовая подложка Glow применяется только когда
effective data fill равен `none`, поэтому полезная заливка не затемняется и не
меняет оттенок. Модель геометрии комнат, распространения света и проёмов не
меняется.

## Границы этапа и зависимости

- #55 первым вводит независимую модель и compatibility-проекцию;
- #36 после #55 добавляет room-level tri-state Glow;
- #56 после #55 добавляет `custom` fill и его цвета;
- #19 может заменить обычную группу световых пятен на isolated additive group,
  но не блокирует модель и миграцию #55.

Порядок поставки: **#55 → (#36, #56)**. Базовая часть #55 опубликована в
`v1.61.0-beta.2`; #56 реализована в текущей локальной итерации целиком — enum,
schema, UI и проверки добавлены вместе. Частично открывать будущий enum до
готовности всего этого вертикального среза по-прежнему запрещено.

## Persisted model и effective projection

### Новые поля

- `space.settings.fill_mode`: `none|lqi|light|temp`, плюс `custom` только после
  #56;
- `space.settings.glow_enabled?: boolean`, отсутствие в новом config = `false`;
- `room.settings.fill_mode`: прежний inherit/override без новых записей `glow`,
  плюс `custom` только после #56;
- `room.settings.glow?: boolean|null` по #36: `null/absent` = inherit.

Persisted read-type отдельно сохраняет legacy-токен `fill_mode:'glow'`.
Effective projection всегда возвращает два независимых значения:

```text
{ fill: none|lqi|light|temp|custom, glow: boolean }
```

Ни renderer, ни opening tunnel, ни `houseplan-space-card` не выводят Glow из
effective fill. Единственное место, где legacy `fill_mode:'glow'` влияет на
Glow, — compatibility projection ниже.

### Нормативный приоритет

Явное новое поле всегда сильнее legacy-токена:

```text
spaceGlow = space.glow_enabled
  ?? (space.fill_mode == 'glow' ? true : false)

roomGlow = room.glow
  ?? (room.fill_mode == 'glow' ? true : spaceGlow)
```

Legacy space `fill_mode:'glow'` проецируется в data fill `none`. Legacy room
`fill_mode:'glow'` проецируется в data fill `inherit`; затем обычный room/space
resolver определяет data fill. Поля разных уровней не смешиваются.

### Compatibility truth table

| Persisted space | Persisted room | Effective data fill | Effective Glow |
|---|---|---|---:|
| `fill=glow`, `glow_enabled` absent | inherit, `glow` absent | none | on |
| `fill=glow`, `glow_enabled=false` | inherit, `glow` absent | none | off |
| `fill=glow`, `glow_enabled=true` | inherit, `glow` absent | none | on |
| `fill=temp`, `glow_enabled` absent | inherit, `glow` absent | temp | off |
| `fill=temp`, `glow_enabled=true` | inherit, `glow` absent | temp | on |
| `fill=temp`, `glow_enabled=false` | inherit, `glow` absent | temp | off |
| `fill=temp`, Glow off | `fill=glow`, `glow` absent | temp | on |
| `fill=temp`, Glow on | `fill=glow`, `glow=false` | temp | off |
| `fill=light`, Glow off | `fill=glow`, `glow=true` | light | on |
| `fill=lqi`, Glow on | `fill=temp`, `glow` absent | temp | on |

Эта таблица обязательна для full plan и общей projection-функции. Статическая
карточка использует ту же data/base projection, но намеренно не рисует live
radial pools, см. ниже.

## Read compatibility, writes и смешанные версии клиентов

### Чтение

- открытие старого config ничего не записывает;
- backend принимает legacy `fill_mode:'glow'` всегда;
- в registry #33 оба legacy-path получают `deprecated-read`,
  `read-compat-until: never`, current-UI write = false и migration через явный
  Optimize;
- фраза «новые writes не используют `glow`» относится только к новому
  frontend. Старые HACS-клиенты и уже открытые dashboard bundle остаются
  допустимыми writers;
- unknown future fields сохраняются losslessly по #33.

### Обычный Save нового UI

Новый UI никогда не создаёт `fill_mode:'glow'`. При этом обычный Save не обязан
переписывать untouched legacy fields.

Если Save заменяет persisted `fill_mode:'glow'` новым data fill, он **обязан в
той же атомарной записи материализовать resolved Glow**:

- space legacy `glow` без явного поля → `fill_mode:<new>`,
  `glow_enabled:true`;
- room legacy `glow` без явного override → новый/удалённый data fill и
  `room.glow:true`;
- существующие explicit `false|true` сохраняются и не заменяются legacy
  значением;
- явное переключение Glow записывает boolean, включая `false`; оно не может
  исчезнуть как «значение по умолчанию», пока рядом остаётся legacy-токен.

Так смена заливки с legacy Glow на temperature/LQI не выключает свечение.
Save/Cancel/reload и future-field preservation входят в обязательную матрицу.

### Конфликт со старым writer

Если старый bundle снова записал `fill_mode:'glow'`, а explicit
`glow_enabled:false` сохранился, effective Glow остаётся off: новое поле сильнее.
Если старый writer физически удалил неизвестное поле, намерение восстановить
невозможно, и config снова считается чистым legacy (`glow` → on). Backend и
новый frontend не должны сами удалять неизвестные поля при round-trip.

## Явная migration через «Оптимизировать планы»

Optimize показывает preview до записи и выполняет один именованный command с
atomic undo:

- space `fill_mode:'glow'` → `fill_mode:'none'` + materialized effective
  `glow_enabled`; explicit boolean сохраняется;
- room `fill_mode:'glow'` → data fill inherit + materialized effective
  `room.glow`; explicit room boolean сохраняется;
- unrelated и unknown future fields не меняются;
- повторный Optimize идемпотентен и не создаёт новый diff.

Preview показывает число затронутых пространств/комнат и точные семантические
преобразования. Undo восстанавливает исходные persisted значения, а не только
визуально эквивалентную форму.

## Render contract

### Порядок слоёв

1. paper/backdrop;
2. resolved data/static room fill и matching data fill внутреннего тоннеля;
3. Glow base только для effective-Glow rooms с effective fill `none` и
   соответствующих частей тоннеля;
4. tunnel light sectors и radial pools;
5. sun и interactive layers по текущему контракту.

Glow base и pools pointer-transparent. Room hover, tooltip и editor hit targets
принадлежат геометрии под overlay.

### Нормативное смешивание Glow base

Glow base — отдельная SVG-геометрия с обычным `source-over`/`normal`
композитингом, которая создаётся только при
`effectiveGlow == true && effectiveFill == none`. `multiply`, `screen`, CSS
filter и дополнительная групповая opacity не применяются.

```text
a = clamp(fill_colors.glow_base.a, 0, 1)
Cout = Cglow_base * a + Cunderlay * (1 - a)
```

`Cunderlay` — paper без data fill. Используется существующий пользовательский
token `glow_base`. Для legacy `fill_mode:'glow'` под Glow base лежит paper, а геометрия
base повторяет прежние room/tunnel shapes, поэтому при штатной палитре результат
должен сохранять pixel parity старого режима. Для сочетаний LQI/light/temp/custom
с Glow обязательный контракт обратный: data/static fill сохраняет exact color и
alpha, Glow base отсутствует, а radial pools продолжают рисоваться поверх.

Room с effective Glow on и fill `none` получает base даже при отсутствии
источников света; radial pools тогда отсутствуют. Room с любым другим fill или
Glow off не получает base. Glow-off room исключается
из визуальных clip pools, но это не меняет физический transport через неё по
#36. Если Glow off у всех комнат, overlay не создаёт пустые SVG layers.

Тоннель сначала повторяет resolved data fill своей стороны. Glow-base overlay
получает только сторона с effective Glow и fill `none`; сторона с любой
data/static заливкой сохраняет её точный цвет. Геометрия световых
секторов, отсечение откосами и проникновение через двери/ворота не меняются.

### Radial pools

До #19 пятна сохраняют текущую семантику цвета, brightness и общей opacity
`0.7`. После #19 они переходят в его isolated additive group. #55 не меняет
радиус, список `resolvedLightSources(room)`, статусы устройств или transport.

### `houseplan-space-card`

Статическая карточка использует тот же effective resolver и показывает:

- data/static fill;
- Glow base поверх него только для effective-Glow rooms с fill `none`;
- matching базовую заливку поддерживаемых тоннелей.

Live radial pools и tunnel light sectors в статической карточке не рисуются —
это её существующее намеренное упрощение, а не drift. Parity-тест сравнивает
effective data/base styles между карточками и отдельно фиксирует отсутствие
pools.

## UX

Space dialog разделяет controls:

- «Заливка комнаты»: Нет / LQI / Свет / Температура / Свой цвет после #56;
- «Свечение источников»: отдельный switch.

Room dialog после #36 показывает независимый fill override и tri-state Glow.
Global palette визуально разделяет data colors и Glow colors. Preview в
диалогах использует тот же effective projection до Save. Переключение одного
control не сбрасывает второй, цвета, радиус или room geometry.

## Edge cases

- room Glow inherit/on/off и legacy room token;
- nested rooms/holes и clean-floor clips;
- двери, ворота, окна, виртуальные/физические стены;
- partitions/columns и `show_borders:false`;
- room без sources, hidden/removed/disabled light и source-glow device status;
- overlapping pools и Glow через открытый тоннель;
- старый/new writer conflict и future fields;
- full plan, kiosk, editor preview и `houseplan-space-card`.

Отключение overlay не меняет light aggregates, room card или controls.

## Performance contract

Независимая модель может одновременно считать temperature/LQI и Glow на каждом
HA tick. Performance gate получает отдельный детерминированный профиль
`large-house-glow-overlay-v1` на 60 комнатах с `fill_mode:'temp'` и
`glow_enabled:true`; существующий `large-house-v1` молча не переопределяется.

`stateUpdate p95`, Long Tasks, heap и cache growth обязаны уложиться в
relative-to-base и absolute budgets общей performance-инфраструктуры. Изменять
budget только ради прохождения #55 запрещено без отдельного обоснования и
review артефактов.

## Документация и release artifacts

В одном feature commit обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- пользовательская документация по заливкам/Glow на русском и английском, если
  соответствующая страница существует;
- compatibility registry/audit #33;
- скриншот новых независимых controls;
- owner-reviewed golden matrix temp+Glow/custom+Glow без base и static-card state.

Release body выделяет независимый Glow как пользовательскую функцию; чисто
технические детали группируются по общему release-правилу.

## Проверки и приёмка

1. Pure resolver покрывает полную space+room truth table, включая
   `legacy glow + explicit false`.
2. Backend продолжает принимать legacy token; новый frontend не пишет его;
   frontend/backend enum `custom` появляется только вместе с #56.
3. Обычный Save, заменяющий legacy token, атомарно материализует effective Glow;
   untouched Save, Cancel и reload не создают silent migration.
4. Optimize preview/apply/undo идемпотентен и сохраняет future fields.
5. Старый config до migration имеет pixel parity; normal source-over formula,
   отсутствие base поверх data/static fill и layer order проверены DOM/style unit-тестами.
6. Golden: dark/light, temp+Glow без base, custom+Glow без base, mixed room overrides, no-source,
   tunnel и hover; baseline принят владельцем до merge.
7. `houseplan-space-card` совпадает по data/base projection и не рисует pools.
8. Doors/gates, virtual/physical walls, nested holes, partitions/columns и
   `show_borders:false` не меняют transport/geometry.
9. Профиль `large-house-glow-overlay-v1` проходит performance budgets.
10. Документация, compatibility registry, ru/en changelog и screenshot
    обновлены.

Функция принята, когда модель больше не требует выбирать Glow вместо полезной
заливки, legacy-конфиги не меняют вид без явного действия, а смешанные версии
клиентов не могут молча отменить сохранённый explicit Glow state.
