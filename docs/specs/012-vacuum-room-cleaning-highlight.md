# ТЗ #12 — Vacuum Tier C: подсветка убираемой комнаты

- Issue: https://github.com/Matysh/houseplan-card/issues/12
- Приоритет: P2
- Статус ТЗ: ready for review
- Зависимости: Stage 1 resolver; room dialog #28 используется для текстового статуса

## Цель

Интеграции без координат, но с текущим segment/service-area, показывают место
уборки на уровне комнаты без выдуманного puck или trail.

## Normalized activity adapter

Pure adapter registry возвращает:

```ts
type VacRoomActivity = {
  sourceEntity: string;
  rawSegments: string[];
  state: 'cleaning' | 'inactive' | 'unknown';
  integration: string | null;
};
```

Stage 1 adapters: документированные Roborock segment attributes/services;
Matter RVC добавляется только после подтверждения HA contract. Неизвестный
attribute не угадывается по порядку/первому числу.

## Mapping

1. Сначала explicit `marker.vacuum.segment_map[rawSegment] = room_id`.
2. Затем exact canonical name match, только если source предоставляет имя.
3. Неоднозначный/удалённый room id не подсвечивается и получает диагностику.
4. UI в vacuum section показывает observed segments и room dropdown; mapping
   сохраняется только явным Save.
5. Несколько активных segments могут подсветить несколько комнат.

`room_highlight` становится поддерживаемым boolean: default on для Tier C,
явный off скрывает визуал, но не очищает mapping.

## Визуал и поведение

- Только при semantic cleaning state: мягкий 3 s breathing fill внутри
  существующей clean-floor path и небольшой robot badge в room label/dialog.
- `prefers-reduced-motion`: статичный outline/badge без pulse.
- Цвет не заменяет configured fill/Glow; overlay имеет отдельный class и
  `pointer-events:none`.
- Tier C не создаёт puck, path, fake coordinate, glow source или area split.
- Hidden/removed/HA-disabled vacuum не влияет на комнаты.

## Эдж-кейсы

Room rename не ломает explicit id map; room deletion делает mapping stale;
space mismatch блокирует highlight; segment меняется во время dialog; robot
returning/paused/docked прекращает pulse; несколько vacuum в комнате дают один
badge с count/accessible text.

## Проверки и приёмка

- adapter fixtures по интеграциям, invalid/array/string segment forms;
- mapping priority, ambiguity, room delete/rename, disabled marker;
- browser/golden обычный и reduced-motion;
- room dialog сообщает «Пылесос убирает эту комнату»;
- без координат пользователь получает честную room-level индикацию и никогда
  не видит движущийся объект в вымышленной точке.
