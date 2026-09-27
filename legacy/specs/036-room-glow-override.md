# ТЗ #36 — Явный Glow override на уровне комнаты

- Issue: https://github.com/Matysh/houseplan-card/issues/36
- Приоритет: P2
- Статус ТЗ: draft, рекомендованное product decision зафиксировано ниже
- Зависимость: foundation независимого overlay #55

## Цель

Комната может явно наследовать, включить или выключить Glow независимо от
последующего изменения space default и data fill.

## Рекомендуемое решение владельцу

Room override влияет только на визуализацию внутри чистого пола комнаты и не
меняет физическую проницаемость границ. Комната с Glow off не становится
стеной: light transport через двери/виртуальные границы продолжается, но base
и pools не рисуются в её clip. Если за ней находится Glow-on комната и
геометрический путь света существует, свет может появиться там. Это сохраняет
разделение «настройка представления» и «физическая модель».

## Модель

- `space.settings.glow_enabled?: boolean` — default overlay пространства;
- `room.settings.glow?: boolean | null` — `null/absent` inherit, `true` on,
  `false` off.
- Effective resolver: `room.glow ?? space.glow_enabled ?? false`.
- Поле `fill_mode` больше не определяет room Glow после миграции #55.

## UX

Room settings, раздел «Заливка и свет»: radio «Как у пространства / Включён /
Выключен». Рядом read-only effective state. Выбор data fill находится отдельно.
Переключение не стирает fill, light sources, radius или room geometry.

## Нормативная матрица

| Effective Glow комнаты | Base darkness | Local pools | Tunnel/transport |
|---|---:|---:|---|
| off | нет | нет | геометрия продолжает расчёт |
| on | да | да | по существующим opening/virtual rules |

Physical wall всегда блокирует; дверь/ворота используют текущий tunnel; окно не
становится межкомнатным проходом. `show_borders:false` не меняет физику.

## Edge cases

Nested rooms получают собственный clean-floor clip; parent Glow не рисуется в
hole. Перегородки/колонны вычитаются как сейчас. Glow under hover остаётся
pointer-transparent. Комната без sources всё равно получает base, если Glow on.

## Проверки и приёмка

- resolver truth table inherit/on/off;
- соседние rooms on→off→on через open boundaries;
- doors, virtual walls, physical walls, nested/hole, partitions/columns;
- room fill temp/LQI/custom одновременно с override;
- migration/read compatibility #55;
- один room override переживает смену space default и reload.
