<!-- release: v1.85.2 -->
<!-- stable-notes: 1 -->
<!-- base: v1.85.1 -->
<!-- language: ru -->
## Релиз Houseplan 1.85.2

В этом выпуске — новые возможности проёмов, единые размеры на плане и более устойчивое редактирование.

🚪 **Новые возможности проёмов.** Окна поддерживают от одной до четырёх независимых створок, верхнее открывание, отдельные датчики и шторы. Шторы перекрывают долю света своей створки. У дверей и ворот появились откатный механизм и ручное положение без датчика. [#1024](https://github.com/Matysh/houseplan-card/issues/1024)

📏 **Единые чертёжные размеры.** Двусторонние размеры при рисовании стен, переносе узлов, изменении размера комнаты и выборе стены. Тот же механизм показывает отступы проёмов, длину линий подложки и равные интервалы между устройствами. Размеры следуют за планом и остаются видимыми рядом с панелями инструментов. [#1381](https://github.com/Matysh/houseplan-card/issues/1381), [#1397](https://github.com/Matysh/houseplan-card/issues/1397), [#1398](https://github.com/Matysh/houseplan-card/issues/1398)

↔️ **Resize через примыкания.** Стена проходит существующие узлы за один жест, без промежуточного сохранения. Сохраняются материалы, привязки проёмов и одна операция отмены. Убраны артефакты контура стен и лишние узлы на прямых участках. [#1383](https://github.com/Matysh/houseplan-card/issues/1383), [#1384](https://github.com/Matysh/houseplan-card/issues/1384)

⚙️ **Понятный результат оптимизации.** Видно ожидание, итог остаётся доступен после сохранения; отдельно объясняются пропущенные исправления, отказ и неподтверждённое сохранение. [#1170](https://github.com/Matysh/houseplan-card/issues/1170)

⚡ **Загрузка и повторный вход.** Повторные чтения реестров объединяются, краткое перемещение карточки не пересобирает модель этажа. Браузеры с поддержкой gzip получают заранее сжатые файлы интерфейса. [#1386](https://github.com/Matysh/houseplan-card/issues/1386), [#1387](https://github.com/Matysh/houseplan-card/issues/1387)

💬 **Устойчивые подсказки устройств.** Короткая задержка, плавное появление и исчезновение; подсказка сохраняет позицию при движении внутри значка и обновлениях HA. Название показателя, значение и единица переносятся вместе. После переподключения карточки подсказка ждёт нового движения мыши. [#1409](https://github.com/Matysh/houseplan-card/issues/1409), [#1411](https://github.com/Matysh/houseplan-card/issues/1411), [#1413](https://github.com/Matysh/houseplan-card/issues/1413)

🎨 **Исправления отображения.** SVG-подложки и их ручки одинаково рисуются на эквивалентных планах с сеткой 1 и 5 см. У Icon state source исправлен текстовый курсор. [#1400](https://github.com/Matysh/houseplan-card/issues/1400), [#1410](https://github.com/Matysh/houseplan-card/issues/1410)

Перед обновлением сохраните резервную копию плана. После обновления перезапустите Home Assistant и перезагрузите страницы Houseplan.

Все изменения: [1.85.2](https://github.com/Matysh/houseplan-card/milestone/17?closed=1)
<!-- language: en -->
## Houseplan 1.85.2 release

This release expands openings, unifies plan dimensions and makes everyday editing more reliable.

🚪 **More capable openings.** Windows support one to four independent leaves, top opening, separate sensors and shades. Each shade blocks its leaf's share of light. Doors and gates support sliding mechanisms and manual positions without a sensor. [#1024](https://github.com/Matysh/houseplan-card/issues/1024)

📏 **Shared drafting dimensions.** Two-sided dimensions while drawing walls, moving nodes, resizing rooms and selecting walls. The same mechanism covers opening offsets, background lines and equal device gaps. Dimensions follow the plan and stay clear of fixed tool controls. [#1381](https://github.com/Matysh/houseplan-card/issues/1381), [#1397](https://github.com/Matysh/houseplan-card/issues/1397), [#1398](https://github.com/Matysh/houseplan-card/issues/1398)

↔️ **Resize across junctions.** Move a wall through existing nodes in one gesture, without an intermediate save. Preserve materials, opening hosts and one Undo operation. Preview contour artifacts and redundant straight-segment nodes are removed. [#1383](https://github.com/Matysh/houseplan-card/issues/1383), [#1384](https://github.com/Matysh/houseplan-card/issues/1384)

⚙️ **Clear optimization outcomes.** Waiting states paint promptly and the report remains available after saving. Skipped repairs, rejection and unconfirmed saving are explained separately. [#1170](https://github.com/Matysh/houseplan-card/issues/1170)

⚡ **Loading and returning to the plan.** Registry reads are coalesced and temporary card moves reuse the floor model. Browsers supporting gzip receive precompressed frontend files. [#1386](https://github.com/Matysh/houseplan-card/issues/1386), [#1387](https://github.com/Matysh/houseplan-card/issues/1387)

💬 **Stable device tooltips.** A short hover delay and smooth appearance/disappearance. Tooltips stay anchored through pointer movement inside the icon and live HA updates. Metric labels, values and units wrap together. After the card reconnects, tooltips wait for fresh mouse movement. [#1409](https://github.com/Matysh/houseplan-card/issues/1409), [#1411](https://github.com/Matysh/houseplan-card/issues/1411), [#1413](https://github.com/Matysh/houseplan-card/issues/1413)

🎨 **Display fixes.** Equivalent plans with 1 cm and 5 cm grids render imported SVG backdrops and handles consistently. Icon state source uses the correct picker cursor. [#1400](https://github.com/Matysh/houseplan-card/issues/1400), [#1410](https://github.com/Matysh/houseplan-card/issues/1410)

Save a plan backup before updating. Restart Home Assistant and reload Houseplan pages after updating.

All changes: [1.85.2](https://github.com/Matysh/houseplan-card/milestone/17?closed=1)
