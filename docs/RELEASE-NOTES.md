<!-- release: v1.85.1-beta.1 -->
## Houseplan 1.85.1-beta.1

Первая бета линии **1.85.1** после стабильной 1.85.0.

- **Удобнее на узком экране.** Перед появлением третьего ряда кнопок шапка собирает действия в одно меню. Выбор пространства остаётся сверху; в карточке с закреплённым пространством он скрывается. В основной панели с одним пространством остаётся только меню действий. (#1347)
- **Плавнее переходы к редакторам.** Подготовка редактора начинается заранее при намерении его открыть; сцена остаётся доступной до показа конечного кадра. (#1344)
- **Свет через стеклянные двери.** Новая настройка «Пропускает свет» позволяет закрытой двери передавать освещение и сохраняется при переносе плана. (#1348)
- **Надёжнее работа с планом.** Замкнутая комната распознаётся и при внутренней тупиковой перегородке. (#1346)
- **Доработан интерфейс.** Подпись тумблера переключает его значение; тип проёма выбирается стандартным списком; выровнены кнопка закрытия, панели редакторов и положение общих кнопок шапки. (#1349, #1350, #1351, #1352)

После обновления перезапустите Home Assistant и перезагрузите открытые страницы Houseplan.

---

First beta of **1.85.1**, based on stable 1.85.0.

- **A compact header for narrow screens.** Actions move into one menu before a third button row appears. Space selection stays above it; pinned-space cards omit the selector, and a single-space primary panel shows actions only. (#1347)
- **Smoother editor transitions.** Editor preparation starts on user intent while the current scene remains available until its final frame is presented. (#1344)
- **Light through glass doors.** The new “Lets light through” setting lets closed doors transmit illumination and survives plan transfers. (#1348)
- **More reliable plan editing.** Closed rooms are recognized with dangling internal walls. (#1346)
- **UI refinements.** Switch labels activate their controls, opening types use the standard dropdown, and editor close controls, toolbar heights and shared header positions are aligned. (#1349, #1350, #1351, #1352)

Restart Home Assistant and reload open Houseplan pages after upgrading.
