# ТЗ #52 — Размеры стен и площади в View

> **Закрыто 2026-09-07 решением владельца, объединено с #53.** Слой размеров
> в режиме просмотра не делается. Раздел «Площади» остаётся действующим
> контрактом и переиспользуется опцией «Отображать размеры» экспорта PDF
> (#53). Раздел «Длины» (осевые пролёты стен) на бумаге НЕ применяется:
> ТЗ #53 §7.3 печатает внутренние размеры каждой комнаты грань-в-грань и
> внешние размеры наружных граней. «Настройка» и «Collision/zoom» к экрану
> больше не относятся.

- Issue: https://github.com/Matysh/houseplan-card/issues/52 (закрыт, см. #53)
- Приоритет: P3
- Статус ТЗ: контракт измерений для #53

## Цель

Добавить read-only architectural annotation layer на основе существующей
геометрии и `cell_cm`, не создавая второй системы измерений.

## Настройка

Per-space `settings.dimensions: 'off' | 'areas' | 'full'`, default `off`.
Отдельный card/kiosk default: kiosk всегда скрывает dimensions, пока будущая
явная card option не разрешит их. Editor preview использует effective setting.

## Площади

- `areas` и `full` показывают значение чистого пола через тот же
  clean-floor/`geometryArea` resolver, что tooltip #28.
- Единицы/округление — существующий `formatArea`; metric m², imperial ft².
- Label anchor — сохранённый room label position либо interior visual point;
  annotation не перемещает пользовательское room name.
- Очень малая/узкая room скрывает annotation при отсутствии безопасного места,
  tooltip/card всё равно содержит площадь.

## Длины

- `full` аннотирует unique physical wall centreline spans из текущей
  normalized wall model. Общая стена рисуется один раз.
- Virtual/open boundary не получает physical length annotation.
- Doors/windows/gates не вычитаются из общей длины span; это размер стены по
  оси, а не чистая кладка.
- Partitions и physical segments сохранённых room drafts входят; columns не
  имеют линейного размера. Толщина не меняет длину оси.
- Collinear мусорные fragments сначала проходят существующую compaction;
  annotation не объединяет через угол/разрыв.

Label расположен параллельно span, читаемый текст никогда не upside-down;
offset выбирается со стороны вне clean floor при возможности. Значение
использует `segmentCm`/`formatLength` и space grid scale.

## Collision/zoom

Projection вычисляет candidates и детерминированно скрывает labels, чьи screen
bbox пересекаются с более приоритетными (selected room, outer wall, longer
span). Ни один label не становится меньше доступного font minimum. На малом
zoom слой постепенно скрывает wall dimensions, затем areas; stored setting не
меняется. `pointer-events:none`.

## Проверки и приёмка

- rectangles, diagonal/L/nested/shared/thick/open walls, partitions/drafts;
- metric/imperial, different cell_cm, resize and optimize;
- deterministic collision at several viewports/zooms;
- View/kiosk/editor visibility and print-friendly golden;
- area совпадает с room card, length с live ruler для того же span;
- никакой config mutation от отображения слоя.
