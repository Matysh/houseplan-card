<!-- release: v1.81.0-beta.3 -->

## Основное

- Надёжнее управление: отменённые нажатия не срабатывают позже, а подтверждения относятся только к выбранному устройству.
- Киоск возвращается к листанию после паузы и может обновиться даже на увеличенном плане. Карточки проёмов понятнее, переход в HA-зону доступен с клавиатуры.
- Больше контроля над Zigbee-сигналом: общая настройка, переопределение для этажа и скрытие для отдельного устройства; у маркеров сущностей появился LQI родительского устройства.
- Удобнее редактирование: направляющие учитывают только видимые устройства, проёмы следуют за перегородкой в превью, а Optimize умеет безопасно убрать лишние записи.
- Меньше лишних пересчётов при переключении света на больших планах; ошибки загрузки дополнительных панелей показывают понятную возможность повторить попытку.

## Highlights

- More reliable controls: cancelled presses cannot fire later, and confirmations apply only to the selected device.
- Kiosk cycling resumes after a pause, and a zoomed plan can receive updates. Opening cards are clearer, and HA area links work with the keyboard.
- More control over Zigbee signal display: a global setting, floor overrides and per-device hiding; entity markers now show their physical device's LQI.
- Easier editing: guides use visible devices only, openings follow a partition in its drag preview, and Optimize can safely remove obsolete records.
- Switching a light avoids rebuilding unrelated device icons, while failed optional panels offer a clear retry action.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.81.0-beta.3/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.81.0-beta.3/docs/CHANGELOG.md)
