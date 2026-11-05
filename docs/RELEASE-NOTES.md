<!-- release: v1.84.0 -->
<!-- stable-notes: 1 -->
<!-- base: v1.83.1 -->
<!-- language: ru -->
## Релиз Houseplan 1.84.0

Обновление делает редактирование стен надёжнее, добавляет погоду в сводку и расширяет настройку домашних экранов.

🧲 **Узлы стен можно объединять перетаскиванием.** Магнит и подсветка показывают цель; соединяющая стена корректно удаляется. Стены и проёмы сохраняют связи при редактировании, Optimize и Undo/Redo. Край видимого узла тоже реагирует на перетаскивание и правый клик. [#1167](https://github.com/Matysh/houseplan-card/issues/1167), [#1305](https://github.com/Matysh/houseplan-card/issues/1305), [#1259](https://github.com/Matysh/houseplan-card/issues/1259)

🏠 **Создавайте комнаты инструментом «Выбрать».** Наведите указатель на замкнутый контур без комнаты: он подсветится, а клик откроет создание комнаты. Инструмент «Стены» позволяет свободно рисовать внутри таких контуров. Пол аккуратно продолжается в проёмах, двери и окна правильно отображаются в статической карточке. [#1176](https://github.com/Matysh/houseplan-card/issues/1176), [#1250](https://github.com/Matysh/houseplan-card/issues/1250)

🖥️ **Свой вид каждого пространства на домашнем экране.** В профиле отдельно задаются масштаб, поворот и оформление пространств; автовозврат восстанавливает настроенный вид. План может учитывать место, занятое сводной панелью. В киоске появился компактный переключатель пространств по касанию. [#1165](https://github.com/Matysh/houseplan-card/issues/1165), [#1127](https://github.com/Matysh/houseplan-card/issues/1127)

🌦️ **Погода в сводной панели.** Текущие условия и прогноз на три дня можно показать даже без других разделов сводки; при нескольких источниках выбирается нужный. Обычный Просмотр тоже умеет центрировать план с учётом панели — эта общая опция по умолчанию выключена. [#1174](https://github.com/Matysh/houseplan-card/issues/1174), [#1242](https://github.com/Matysh/houseplan-card/issues/1242)

🤖 **Непрерывный путь пылесоса.** Пока интеграция догружает настоящий маршрут, временные отрезки соединяют его с текущим положением пылесоса, затем заменяются настоящими. [#1175](https://github.com/Matysh/houseplan-card/issues/1175)

🛠️ **Удобнее повседневная настройка.** Обновлены формы и кнопки, переключение редакторов сохраняет ракурс. При копировании пространства можно отдельно выбирать мебель и другой декор. Ускорено сохранение настроек и узлов, исправлены точные отмена и повтор операций. [#1156](https://github.com/Matysh/houseplan-card/issues/1156), [#1207](https://github.com/Matysh/houseplan-card/issues/1207)

📶 **Понятнее диагностика Zigbee.** Можно показывать только слабый сигнал; пояснения помогают разобраться в неизвестном маршруте и отличиях от карты интеграции. [#1130](https://github.com/Matysh/houseplan-card/issues/1130), [#1157](https://github.com/Matysh/houseplan-card/issues/1157)

После обновления перезапустите Home Assistant и перезагрузите открытые страницы House Plan.

Все изменения: [1.84.0](https://github.com/Matysh/houseplan-card/milestone/11?closed=1)
<!-- language: en -->
## Houseplan 1.84.0 release

This update makes wall editing more reliable, adds weather to the summary and expands home-screen profiles.

🧲 **Merge wall nodes by dragging.** The magnet and highlight identify the target, and a connecting wall is removed correctly. Walls and openings retain their relationships through editing, Optimize and Undo/Redo. Dragging and right-clicking also work at the visible edge of a node. [#1167](https://github.com/Matysh/houseplan-card/issues/1167), [#1305](https://github.com/Matysh/houseplan-card/issues/1305), [#1259](https://github.com/Matysh/houseplan-card/issues/1259)

🏠 **Create rooms with Select.** Hover an enclosed wall outline without a room to highlight it, then click to open room creation. Walls remains available for drawing freely inside these outlines. Room floors continue cleanly through openings, and doors and windows appear correctly in static cards. [#1176](https://github.com/Matysh/houseplan-card/issues/1176), [#1250](https://github.com/Matysh/houseplan-card/issues/1250)

🖥️ **An individual view for each space on a home screen.** Profiles provide per-space scale, rotation and presentation; idle return restores the configured view. The plan can account for the summary panel's occupied area. Kiosk adds a compact space switcher revealed by touch. [#1165](https://github.com/Matysh/houseplan-card/issues/1165), [#1127](https://github.com/Matysh/houseplan-card/issues/1127)

🌦️ **Weather in the summary panel.** Show current conditions and a three-day forecast even without other summary sections, choosing a source when several are available. Ordinary View can also centre the plan around the panel; this general option is off by default. [#1174](https://github.com/Matysh/houseplan-card/issues/1174), [#1242](https://github.com/Matysh/houseplan-card/issues/1242)

🤖 **A continuous vacuum trail.** Temporary segments connect the last downloaded route to the vacuum's current position, then give way to the real path as the integration supplies it. [#1175](https://github.com/Matysh/houseplan-card/issues/1175)

🛠️ **Smoother everyday editing.** Updated forms and buttons share a consistent presentation, and switching editors preserves the camera. Space copies can include furniture and other decor independently. Settings and node saves are faster, with fixes to exact Undo/Redo. [#1156](https://github.com/Matysh/houseplan-card/issues/1156), [#1207](https://github.com/Matysh/houseplan-card/issues/1207)

📶 **Clearer Zigbee diagnostics.** Show weak signal only, with explanations for unknown routes and differences from the integration's map. [#1130](https://github.com/Matysh/houseplan-card/issues/1130), [#1157](https://github.com/Matysh/houseplan-card/issues/1157)

After updating, restart Home Assistant and reload open House Plan pages.

All changes: [1.84.0](https://github.com/Matysh/houseplan-card/milestone/11?closed=1)
