<!-- release: v1.85.1 -->
<!-- stable-notes: 1 -->
<!-- base: v1.85.0 -->
<!-- language: ru -->
## Релиз Houseplan 1.85.1

Обновление делает интерфейс удобнее на телефоне и исправляет повседневные сценарии редактирования.

📱 **Шапка подстраивается под место.** Кнопки сохраняют два обычных ряда, а когда нужен третий — собираются в меню действий на всю доступную ширину. Выбор пространства остаётся доступен там, где он нужен; отдельная кнопка управляет боковой панелью Home Assistant. В узких редакторах кнопки закрытия, отмены и повтора расположены рядом в столбик. [#1347](https://github.com/Matysh/houseplan-card/issues/1347), [#1371](https://github.com/Matysh/houseplan-card/issues/1371)

🎨 **Надёжный выбор иконки устройства.** Собственный MDI picker предлагает поиск и предпросмотр иконок без зависимости от компонента HA. Крестик сразу возвращает автоматическую иконку текущей привязки; поле и предпросмотр совпадают после сохранения. Выпадающие поля больше не перекрываются системной подсветкой тапа. [#1375](https://github.com/Matysh/houseplan-card/issues/1375), [#1376](https://github.com/Matysh/houseplan-card/issues/1376)

🚪 **Стеклянные двери могут пропускать свет.** Новая настройка закрытой двери учитывается для искусственного света и внешних солнечных проёмов. Межкомнатные двери не расширяют солнечные лучи между комнатами. [#1348](https://github.com/Matysh/houseplan-card/issues/1348)

⚙️ **Удобнее настройки и переключение режимов.** Разделы настроек устройства остаются под рукой при прокрутке; подпись рядом с переключателем тоже переключает его. Меню и справка не закрываются из-за отложенной прокрутки. Переходы между просмотром и редакторами стали быстрее и устойчивее. [#1354](https://github.com/Matysh/houseplan-card/issues/1354), [#1350](https://github.com/Matysh/houseplan-card/issues/1350), [#1356](https://github.com/Matysh/houseplan-card/issues/1356), [#1360](https://github.com/Matysh/houseplan-card/issues/1360), [#1344](https://github.com/Matysh/houseplan-card/issues/1344), [#1358](https://github.com/Matysh/houseplan-card/issues/1358)

🏠 **Исправлены действия на плане.** Замкнутые комнаты распознаются с висячими внутренними стенами; после выхода из редактора снова доступны действия LED-ленты. Сохраняются кнопки настроек комнаты при предпросмотре изменения размеров, а после двойного клика для вписывания план сразу можно перетаскивать. [#1346](https://github.com/Matysh/houseplan-card/issues/1346), [#1361](https://github.com/Matysh/houseplan-card/issues/1361), [#1359](https://github.com/Matysh/houseplan-card/issues/1359), [#1371](https://github.com/Matysh/houseplan-card/issues/1371)

После обновления перезапустите Home Assistant и перезагрузите открытые страницы Houseplan.

Все изменения: [1.85.1](https://github.com/Matysh/houseplan-card/milestone/15?closed=1)
<!-- language: en -->
## Houseplan 1.85.1 release

This update improves the phone interface and everyday editing workflows.

📱 **A header that fits the available space.** Controls keep two ordinary rows and collapse into a full-width actions menu when a third would be needed. Space selection remains available where needed, and a separate button controls the Home Assistant sidebar. Close/Undo/Redo form a column in narrow editors. [#1347](https://github.com/Matysh/houseplan-card/issues/1347), [#1371](https://github.com/Matysh/houseplan-card/issues/1371)

🎨 **Reliable device icon selection.** The local MDI picker provides search and icon previews without relying on HA's picker component. Clear immediately restores the automatic icon for the current binding; the field and preview agree after saving. Dropdown controls no longer receive the browser's extra tap highlight. [#1375](https://github.com/Matysh/houseplan-card/issues/1375), [#1376](https://github.com/Matysh/houseplan-card/issues/1376)

🚪 **Glass doors can transmit light.** A new option for closed doors affects artificial light and exterior solar apertures. Interior doors do not extend sunlight between rooms. [#1348](https://github.com/Matysh/houseplan-card/issues/1348)

⚙️ **Easier settings and mode changes.** Device settings sections remain reachable while scrolling, and clicking a switch label toggles the switch. Dropdowns and Help stay open after delayed scrolling. View/editor transitions are faster and more reliable. [#1354](https://github.com/Matysh/houseplan-card/issues/1354), [#1350](https://github.com/Matysh/houseplan-card/issues/1350), [#1356](https://github.com/Matysh/houseplan-card/issues/1356), [#1360](https://github.com/Matysh/houseplan-card/issues/1360), [#1344](https://github.com/Matysh/houseplan-card/issues/1344), [#1358](https://github.com/Matysh/houseplan-card/issues/1358)

🏠 **Plan interactions repaired.** Closed rooms are recognized with dangling interior walls, LED strip actions work after returning from an editor, and room settings buttons remain available during resize preview. Dragging works immediately after a double-click fit. [#1346](https://github.com/Matysh/houseplan-card/issues/1346), [#1361](https://github.com/Matysh/houseplan-card/issues/1361), [#1359](https://github.com/Matysh/houseplan-card/issues/1359), [#1371](https://github.com/Matysh/houseplan-card/issues/1371)

After updating, restart Home Assistant and reload open Houseplan pages.

All changes: [1.85.1](https://github.com/Matysh/houseplan-card/milestone/15?closed=1)
