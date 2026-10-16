<!-- release: v1.81.0 -->
<!-- stable-notes: 1 -->
<!-- base: v1.80.1 -->
<!-- language: ru -->
## Релиз Houseplan 1.81.0

План стало проще выравнивать, карта уборки — подробнее, а отображение Zigbee можно настроить под себя. Связи Zigbee2MQTT теперь сохраняются после перезапуска Home Assistant.

📡 **Показывайте только нужный сигнал.** Настройте индикаторы Zigbee для всего дома, этажа или отдельного устройства. Заряд и сигнал доступны и у отдельных сущностей устройства. [#867](https://github.com/Matysh/houseplan-card/issues/867), [#876](https://github.com/Matysh/houseplan-card/issues/876)

🔗 **Связи не пропадают после перезапуска.** Сохранённая карта Zigbee2MQTT остаётся на плане с пометкой об устаревании — до обновления или выключения связей. [#912](https://github.com/Matysh/houseplan-card/issues/912)

🤖 **Подробнее видно, где убирал пылесос.** Поддерживаемые карты показывают полный маршрут, сохраняя повороты и небольшие участки пути. [#872](https://github.com/Matysh/houseplan-card/issues/872)

📏 **Устройства легче расставить ровно.** Новый магнит помогает выдержать одинаковые расстояния между значками и подсвечивает промежутки. [#873](https://github.com/Matysh/houseplan-card/issues/873)

📐 **Стены проще выравнивать.** При рисовании и перемещении узлов концы горизонтальных и вертикальных стен точно выравниваются по параллельным стенам — даже вне сетки. [#885](https://github.com/Matysh/houseplan-card/issues/885)

Ускорили обновления больших планов и перетаскивание узлов. Исправили отмену изменений и сохранение после ошибок, сделали понятнее очистку старых записей в Optimize. Диалог толщины стены можно передвинуть, а редактируемая стена остаётся выделенной.

[Все пользовательские изменения релиза](https://github.com/Matysh/houseplan-card/issues?q=is%3Aissue%20milestone%3A%221.81%22)
<!-- language: en -->
## Houseplan 1.81.0 release

Aligning your plan is easier, vacuum maps show more detail, and Zigbee indicators can be tailored to your home. Zigbee2MQTT links now survive Home Assistant restarts.

📡 **Show only the signal you need.** Set Zigbee indicators for the whole home, a floor or an individual device. Battery and signal readings are also available for individual device entities. [#867](https://github.com/Matysh/houseplan-card/issues/867), [#876](https://github.com/Matysh/houseplan-card/issues/876)

🔗 **Links survive a restart.** Your saved Zigbee2MQTT map stays on the plan, marked as stale, until you refresh it or turn links off. [#912](https://github.com/Matysh/houseplan-card/issues/912)

🤖 **See more of your vacuum's work.** Supported maps show the full route, preserving turns and short stretches of the path. [#872](https://github.com/Matysh/houseplan-card/issues/872)

📏 **Space devices evenly.** A new snap helps keep equal gaps between icons and highlights the spacing. [#873](https://github.com/Matysh/houseplan-card/issues/873)

📐 **Line up walls more easily.** While drawing or moving nodes, horizontal and vertical wall endpoints snap into line with a parallel wall's end — even off the grid. [#885](https://github.com/Matysh/houseplan-card/issues/885)

Large-plan updates and wall-node dragging are faster. Undo and saving after errors are more reliable, and Optimize explains how to clean up old records. You can move the wall-thickness dialog while the wall being edited stays highlighted.

[All user-facing changes in this release](https://github.com/Matysh/houseplan-card/issues?q=is%3Aissue%20milestone%3A%221.81%22)
