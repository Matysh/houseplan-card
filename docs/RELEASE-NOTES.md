<!-- release: v1.85.0 -->
<!-- stable-notes: 1 -->
<!-- base: v1.84.0 -->
<!-- language: ru -->
## Релиз Houseplan 1.85.0

Редактировать план стало проще, а обновление Zigbee LQI — устойчивее.

🧲 **Присоединяйте конец стены к другой стене.** Перетащите висячий конец на середину стены или перегородки: подсветка покажет место соединения, а стена разделится точно в этой точке. Действие поддерживает отмену и повтор. [#1330](https://github.com/Matysh/houseplan-card/issues/1330)

🪜 **Видно, куда встанет лестница.** Прямая и винтовая лестницы показываются под курсором до размещения. Исправлены отмена черновика, меню узлов и обновление панелей во время предпросмотра. [#1253](https://github.com/Matysh/houseplan-card/issues/1253), [#1338](https://github.com/Matysh/houseplan-card/issues/1338)

↗️ **Поворачивайте с шагом 45°.** Удерживайте Shift при повороте фигур, текста, мебели, изображений и подложки. Нажатие и отпускание клавиши сразу обновляет предпросмотр. [#1255](https://github.com/Matysh/houseplan-card/issues/1255)

🏠 **Понятнее первый шаг и настройка комнаты.** В пустом пространстве появилась подсказка с переходом в редактор плана; ложная стрелка «План там» больше не мешает. Пояснение под привязкой комнаты к зоне Home Assistant остаётся видимым. Исправлены выступы заливки пола в стыках стен с отдельной перегородкой. [#1329](https://github.com/Matysh/houseplan-card/issues/1329), [#1333](https://github.com/Matysh/houseplan-card/issues/1333), [#1334](https://github.com/Matysh/houseplan-card/issues/1334), [#1327](https://github.com/Matysh/houseplan-card/issues/1327)

📶 **Zigbee LQI продолжает обновляться при ошибке сторонней интеграции.** Некорректный идентификатор устройства в реестре Home Assistant больше не прерывает обновление остальных устройств ZHA/Zigbee2MQTT. Корректные идентификаторы того же устройства сохраняются в обработке. [#1341](https://github.com/Matysh/houseplan-card/issues/1341)

После обновления перезапустите Home Assistant и перезагрузите открытые страницы Houseplan.

Все изменения: [1.85.0](https://github.com/Matysh/houseplan-card/milestone/13?closed=1)
<!-- language: en -->
## Houseplan 1.85.0 release

This release improves plan editing and makes Zigbee LQI updates more resilient.

🧲 **Attach a wall endpoint to another wall.** Drag a dangling endpoint onto the interior of a wall or partition. Highlighting shows the attachment point, the wall splits precisely there, and Undo/Redo supports the operation. [#1330](https://github.com/Matysh/houseplan-card/issues/1330)

🪜 **See where a staircase will go.** Straight and Spiral stairs preview under the pointer before placement. Cancellation, node menus and toolbar updates work during preview. [#1253](https://github.com/Matysh/houseplan-card/issues/1253), [#1338](https://github.com/Matysh/houseplan-card/issues/1338)

↗️ **Rotate in 45° increments.** Hold Shift while rotating shapes, text, furniture, images or the plan backdrop. Pressing and releasing Shift immediately updates the preview. [#1255](https://github.com/Matysh/houseplan-card/issues/1255)

🏠 **Clearer first steps and room setup.** Empty spaces offer a shortcut to the plan editor without a misleading off-screen-plan arrow. The Home Assistant area helper stays visible in room settings. Room floors no longer protrude at mixed wall and partition junctions. [#1329](https://github.com/Matysh/houseplan-card/issues/1329), [#1333](https://github.com/Matysh/houseplan-card/issues/1333), [#1334](https://github.com/Matysh/houseplan-card/issues/1334), [#1327](https://github.com/Matysh/houseplan-card/issues/1327)

📶 **Zigbee LQI keeps updating despite malformed third-party records.** An invalid device identifier in Home Assistant's registry no longer interrupts other ZHA/Zigbee2MQTT updates. Valid identifiers on the same device continue to be processed. [#1341](https://github.com/Matysh/houseplan-card/issues/1341)

After updating, restart Home Assistant and reload open Houseplan pages.

All changes: [1.85.0](https://github.com/Matysh/houseplan-card/milestone/13?closed=1)
