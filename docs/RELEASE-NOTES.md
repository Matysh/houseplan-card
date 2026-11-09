<!-- release: v1.85.1-beta.2 -->
## Houseplan 1.85.1-beta.2

Вторая бета линии **1.85.1**. Изменения относительно beta.1:

- **Одна строка на узком экране.** Название или выбор пространства и кнопка ⋮ теперь стоят рядом. При одном пространстве, в том числе в закреплённой карточке, остаётся его название без выпадающего списка. Настройки пространства и добавление доступны через общее меню действий. (#1364, #1365)
- **Надёжнее переходы между просмотром и редакторами.** После быстрого переключения не остаются временный поворот и ширина сцены; LED-ленты снова реагируют на действия после выхода из редактора. (#1358, #1361)
- **Навигация настроек устройства остаётся на месте.** Длинное содержимое прокручивается отдельно от списка разделов; после «Сведения» появился компактный разделитель. (#1354)
- **Удобнее настройки.** Выпадающий список и подсказка не закрываются от отложенной прокрутки, которая только показала их кнопку. Настоящее перемещение кнопки по-прежнему закрывает меню. (#1356, #1360)
- **Стабильнее редактирование комнат.** Кнопка настроек комнаты сохраняет перемещённое положение при предпросмотре изменения размера и его отмене. (#1359)

Обновлены проверки реального Home Assistant и визуальные эталоны. (#1357, #1362, #1363)

После обновления перезапустите Home Assistant и перезагрузите открытые страницы Houseplan.

---

Second beta of **1.85.1**. Changes since beta.1:

- **One row on narrow screens.** The space name or selector sits beside the ⋮ button. A single space, including a pinned card, keeps its plain name without a dropdown. Space settings and Add space are available through the shared actions menu. (#1364, #1365)
- **More reliable View/editor transitions.** Rapid switches no longer leave residual scene rotation or width; LED strip actions work again after leaving an editor. (#1358, #1361)
- **Device settings navigation stays in place.** Long content scrolls independently from the section list, with a compact divider after Details. (#1354)
- **Better settings interaction.** A dropdown or Help stays open after a queued scroll that only revealed its trigger. Actual trigger movement still dismisses the menu. (#1356, #1360)
- **More stable room editing.** A moved room settings button keeps its position during resize preview and cancellation. (#1359)

Real Home Assistant checks and visual references have been updated. (#1357, #1362, #1363)

Restart Home Assistant and reload open Houseplan pages after upgrading.
