# ТЗ #28 — Карточка комнаты в режиме View

- Issue: https://github.com/Matysh/houseplan-card/issues/28
- Приоритет: P1
- Статус ТЗ: draft, требуется UX-утверждение
- Зависимости: #31 использует карточку как основную доступную точку комнаты

## Цель

Сделать информацию о комнате одинаково доступной мышью, touch и клавиатурой,
не заменяя быстрый desktop hover и не меняя модель комнаты.

## Нормативное поведение

1. В View tap/click по свободной части чистого пола открывает компактный
   `hp-dialog` «Комната».
2. Диалог показывает:
   - отображаемое имя либо локализованное «Без названия»;
   - чистую площадь через существующий `_roomArea()`/clean-floor geometry;
   - только доступные temperature, humidity, LQI и light stats;
   - подписанную кнопку «Открыть зону в Home Assistant» только при `room.area`.
3. Источники метрик и форматирование ровно те же, что у hover и room label:
   `_roomTemp`, `_roomHum`, `_roomLqi`, `resolvedLightSources/Stats`.
4. Hover tooltip остаётся без клика; открытый dialog убирает hover tooltip.
5. Комната без area открывает карточку, но не показывает навигационное действие.
6. События устройства, проёма, room label/link, vacuum puck, control, tooltip и
   других интерактивных слоёв обязаны остановить propagation.

## Gesture arbitration

- Решение принимается на `pointerup`, только если pointerdown начался на той же
  room hit-shape и движение не превысило существующий click threshold.
- Pan, pinch, long press, drag и `_suppressClick` отменяют room activation.
- Glow, sun rays, tunnel fills и hover outline остаются `pointer-events:none`.
- Для вложенных комнат выигрывает верхняя/самая внутренняя реальная hit-shape;
  отверстие пола родителя не является его hit-area.
- Один жест может открыть только один dialog.

## Доступность

- Доступный trigger получает локализованное имя комнаты; Enter/Space открывают
  тот же dialog через модель навигации #31.
- Dialog наследует trap, initial/restore focus и Escape у `hp-dialog`.
- Метрики представлены текстом, не только иконками/цветом.

## Эдж-кейсы

Толстые/скрытые стены, отверстия, перегородки и колонны используют уже
вычисленную clean-floor path. Общая стена не принадлежит hit-area комнаты.
Изменение HA state обновляет метрики открытой карточки. Удаление/смена
пространства закрывает карточку без навигации.

## Проверки и приёмка

- unit: единая projection модели карточки из room + aggregates;
- browser desktop/touch/keyboard: open/close, pan suppression, nested room;
- browser: click по device/opening/link не проваливается в room;
- площадь байт-в-байт совпадает с tooltip formatter;
- mobile golden: длинное имя, все/нет метрик, стабильный footer.
