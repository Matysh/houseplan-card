<!-- release: v1.85.0-beta.2 -->
<!-- base: v1.84.0 -->
<!-- language: ru -->
## Houseplan 1.85.0-beta.2

Исправлено периодическое падение обновления **Zigbee LQI**, когда сторонняя интеграция записывает в реестр Home Assistant идентификатор устройства некорректного формата. Такие записи теперь пропускаются, а корректные идентификаторы того же устройства и остальные устройства ZHA/Zigbee2MQTT продолжают обрабатываться. [#1341](https://github.com/Matysh/houseplan-card/issues/1341)

Остальные возможности линии 1.85 описаны в [beta.1](https://github.com/Matysh/houseplan-card/releases/tag/v1.85.0-beta.1).

После обновления перезапустите Home Assistant и перезагрузите открытые страницы Houseplan.

<!-- language: en -->
## Houseplan 1.85.0-beta.2

Fixed periodic **Zigbee LQI** refresh failures caused by malformed device identifiers registered by a third-party integration in Home Assistant. Invalid records are now skipped while valid identifiers on the same device and other ZHA/Zigbee2MQTT devices continue to update. [#1341](https://github.com/Matysh/houseplan-card/issues/1341)

See [beta.1](https://github.com/Matysh/houseplan-card/releases/tag/v1.85.0-beta.1) for the other changes in the 1.85 line.

After updating, restart Home Assistant and reload open Houseplan pages.
