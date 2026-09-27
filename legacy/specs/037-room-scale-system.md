# ТЗ #37 — Одна объяснимая система масштабов room card

- Issue: https://github.com/Matysh/houseplan-card/issues/37
- Приоритет: P2
- Статус ТЗ: draft, рекомендованная migration semantics зафиксирована

## Цель

Пользователь видит два понятных effective размера — название и метрики — с
одним space default и room overrides. Скрытый третий layout multiplier больше
не создаётся.

## Каноническая формула

После явной миграции:

```text
effectiveName = space.card_font_scale × (room.name_scale ?? 1)
effectiveMeta = space.card_font_scale × (room.label_scale ?? 1)
```

Диапазон каждого stored multiplier остаётся 0.5..3; итоговый CSS size имеет
отдельный safe clamp. Layout record `rl_<roomId>.k` — только read compatibility.

## UX

- Space dialog показывает общий default и preview.
- Room dialog показывает override «Наследовать» либо процент, рядом effective
  процент; отдельный Reset для name и metrics.
- Visual corner resize масштабирует оба effective room значения одним ratio:
  materializes `name_scale` и `label_scale`, сохраняя их относительное отличие.
  Он больше не пишет `layout.k`.
- Context tray при выборе room label показывает два effective значения и Reset.

## Legacy

До Optimize renderer умножает старый `layout.k` как сегодня, поэтому нет
скачка. «Оптимизировать планы» preview:

1. `name_scale = clamp(existingName × k)`;
2. `label_scale = clamp(existingLabel × k)`;
3. удалить только поле `k`, сохранив x/y/s layout record;
4. показать rooms, где clamp изменил точное значение;
5. atomic write config+layout и one-deep undo.

Обычный Save room/space не мигрирует `k` неявно. Если пользователь делает
visual resize конкретной legacy card, migration только этой room является
явным следствием жеста и сохраняет текущий visual до первого delta.

## Edge cases

Room без metrics всё равно хранит independent label_scale; будущие metrics его
используют. Rename/delete/remap room обрабатывает layout owner. Zoom карточки не
меняет stored scale. Несколько клиентов конфликтуют через существующие rev.

## Проверки и приёмка

- truth table defaults/overrides/k compatibility;
- zero-delta first drag без скачка; ratio с разными name/meta;
- Optimize preview/apply/undo/clamp;
- room/space dialogs, context tray, ru/en narrow layout;
- после Optimize нет `k`, а screenshot до/после совпадает в tolerance.
