# ТЗ #31 — Доступная семантика режима View

- Issue: https://github.com/Matysh/houseplan-card/issues/31
- Приоритет: P1
- Статус ТЗ: draft, требуется UX-проверка screen reader
- Зависимость: room dialog #28

## Цель

Обеспечить основные View-сценарии клавиатурой и screen reader без сотен
tab-stop и без изменения pointer UX.

## Рекомендуемая модель

Над SVG существует одна визуально скрытая, но screen-reader доступная
`PlanNavigator`-структура с тремя группами: Комнаты, Устройства, Проёмы.
Внутри применяется roving tabindex: в общем Tab-порядке одна активная запись,
стрелки перемещают активную запись, Home/End — края группы, Ctrl+стрелка —
соседняя группа. SVG shapes остаются `aria-hidden`, чтобы не дублировать дерево.

## Accessible projection

Один pure resolver создаёт для объекта:

- стабильный id и role (`button` для действия, `group` для read-only);
- label: имя, тип, комната, локализованное состояние, основное действие;
- description: доступные метрики/предупреждения;
- action: room dialog, device action/more-info, opening status.

`static_icon` влияет на визуал, но accessible label всё равно сообщает реальное
HA-состояние. Disabled/orphaned объекты явно называются недоступными.

## Keyboard и focus lifecycle

- Enter/Space активирует основной action; контекстное more-info остаётся
  отдельной подписанной командой в открывшейся карточке.
- Смена пространства фокусирует PlanNavigator heading, затем первую комнату.
- Закрытие room/device dialog возвращает фокус на исходную запись.
- Исчезнувший объект возвращает фокус к ближайшему соседу/заголовку.
- Kiosk сохраняет доступный View, но editor controls отсутствуют.

## Нецветовые состояния

Critical alarm получает alert glyph и текст; open/unlocked — outline/glyph;
mechanical activity — motion glyph/accessible live text. Не добавлять постоянные
satellite badges каждому marker. `prefers-reduced-motion` отключает pulse, но
не текстовый state.

## Проверки и приёмка

- axe: name/role/value, landmark, focus order, dialog boundaries;
- NVDA/Chrome и TalkBack ручной checklist;
- keyboard: room, ordinary device, alarm, opening, disabled device;
- 200 markers дают один Tab entry на plan navigator, не 200;
- выключенный цвет/анимация не лишает пользователя состояния;
- pointer hit-testing и golden View не меняются без осознанного glyph delta.
