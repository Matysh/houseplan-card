# ТЗ #55 — Glow как независимый overlay поверх data fill

- Issue: https://github.com/Matysh/houseplan-card/issues/55
- Приоритет: P2
- Статус ТЗ: ready for review
- Связано: room override #36; additive pools #19

## Цель

Разделить две независимые функции: data/static room fill и световой Glow.
Пользователь может видеть temperature/LQI/light/custom color и Glow одновременно.

## Модель

- `space.settings.fill_mode`: `none|lqi|light|temp|custom`;
- `space.settings.glow_enabled?: boolean`;
- `room.settings.fill_mode`: прежний inherit/override + `custom` после #56;
- `room.settings.glow?: boolean|null` по #36.

Effective projection возвращает `{fill, glow}` двумя полями. Ни renderer, ни
opening tunnel не выводят Glow из fill mode после migration.

## Read compatibility и migration

Old `space.settings.fill_mode:'glow'` читается как
`fill_mode:'none', glow_enabled:true` без записи. Old room
`settings.fill_mode:'glow'`, если встречается future/legacy config, читается как
`fill inherit, room.glow:true`.

Новый UI при первом Save не обязан мигрировать untouched fields. Явное
«Оптимизировать планы» показывает conversion и atomic undo. Backend окно чтения
регистрируется в #33; новые writes не используют `fill_mode:'glow'` после
начала migration phase.

## Render order

1. paper/backdrop;
2. resolved data/static room fill и matching opening tunnel floor fill;
3. Glow base darkness в clips effective-Glow rooms;
4. tunnel light sectors и radial pools;
5. sun/interactive layers согласно текущему contract.

Glow base не заменяет data fill: compositing/opacity должен сохранять читаемый
underlay. Radial pools используют isolated additive group #19, если feature
доступна. Все Glow shapes pointer-transparent.

## UX

Space dialog: отдельные controls «Заливка комнаты» и «Свечение источников».
Global palette разделяет data colors и Glow colors. Room dialog показывает
independent fill override и tri-state Glow #36. Preview обновляет оба без Save.

## Edge cases

Room Glow off, nested holes, doors/gates, virtual/physical walls,
partitions/columns, no sources, source-glow device status, hidden/removed light,
show_borders false. Отключение overlay не меняет light aggregates/controls.

## Проверки и приёмка

- compatibility truth table old/new space+room values;
- все data fills одновременно с Glow, tunnel colors и hover;
- Optimize preview/apply/undo и future field preservation;
- golden dark/light, temp+Glow, custom+Glow, mixed room overrides;
- старый config до migration выглядит без pixel regression;
- модель больше не требует выбрать Glow вместо полезной заливки.
