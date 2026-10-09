<!-- release: v1.80.1 -->

## Основное

- Редактирование плана: перетаскивайте узлы стен в «Выбрать» с полупрозрачным превью, привязками, Esc и Undo/Redo; превью ускорено для больших связных планов ([#803](https://github.com/Matysh/houseplan-card/issues/803), [#834](https://github.com/Matysh/houseplan-card/issues/834)). Пространство можно удалить вместе с его устройствами, не меняя Home Assistant ([#819](https://github.com/Matysh/houseplan-card/issues/819)), а при переустановке — восстановить прежние планы или начать заново с сохранением архива ([#820](https://github.com/Matysh/houseplan-card/issues/820)).
- Заряд батарей на плане: цветные индикаторы, показ только низкого заряда и скрытие для отдельных устройств; в подсказке — процент или состояние батареи по данным Home Assistant ([#792](https://github.com/Matysh/houseplan-card/issues/792), [#806](https://github.com/Matysh/houseplan-card/issues/806), [#807](https://github.com/Matysh/houseplan-card/issues/807), [#817](https://github.com/Matysh/houseplan-card/issues/817)).
- Zigbee-связи используют родителей и активные следующие узлы, сообщённые ZHA/Zigbee2MQTT, вместо вычисленного дерева соседей ([#798](https://github.com/Matysh/houseplan-card/issues/798)). Сканирование карты Zigbee2MQTT продолжается после закрытия настроек или браузера ([#800](https://github.com/Matysh/houseplan-card/issues/800)). Обновите и перезапустите также интеграцию.
- Мелкие исправления и улучшения.

## Highlights

- Plan editing: drag wall nodes in Select with a translucent preview, snapping, Esc cancellation and Undo/Redo; previews are faster on large connected plans ([#803](https://github.com/Matysh/houseplan-card/issues/803), [#834](https://github.com/Matysh/houseplan-card/issues/834)). Delete a space together with its devices without changing Home Assistant ([#819](https://github.com/Matysh/houseplan-card/issues/819)), or restore previous plans when reinstalling, with an archived copy preserved if you start fresh ([#820](https://github.com/Matysh/houseplan-card/issues/820)).
- Battery charge on the plan: colour indicators, a low-only display option and per-device hiding; tooltips show a percentage or battery status from Home Assistant ([#792](https://github.com/Matysh/houseplan-card/issues/792), [#806](https://github.com/Matysh/houseplan-card/issues/806), [#807](https://github.com/Matysh/houseplan-card/issues/807), [#817](https://github.com/Matysh/houseplan-card/issues/817)).
- Zigbee links use parents and active next hops reported by ZHA/Zigbee2MQTT instead of an inferred neighbour tree ([#798](https://github.com/Matysh/houseplan-card/issues/798)). Zigbee2MQTT map scans continue after settings or the browser are closed ([#800](https://github.com/Matysh/houseplan-card/issues/800)). Update and restart the integration too.
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.80.1/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.80.1/docs/CHANGELOG.md)
