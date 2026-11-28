<!-- release: v2.0.0 -->
<!-- stable-notes: 1 -->
<!-- base: v1.86.1 -->
<!-- language: ru -->
## Релиз Houseplan 2.0.0

🏠 **Настоящий 3D-план.** Новый режим 3D на WebGL показывает объём стен, проёмов, мебели и устройств в восьми ракурсах. Источники света и LED-ленты освещают пол и стены. Загруженные изображения декора остаются чёткими при приближении. Если браузер не поддерживает WebGL 2, Houseplan открывает плоский план; редакторы и плоский SVG по-прежнему доступны. [#1514](https://github.com/Matysh/houseplan-card/issues/1514), [#1567](https://github.com/Matysh/houseplan-card/issues/1567), [#1618](https://github.com/Matysh/houseplan-card/issues/1618)

📐 **Высота устройств и LED-лент.** В 3D можно задать высоту над полом: низкие устройства будут у пола, а настенные — на нужном уровне. Для LED-лент высота влияет и на свет. В плоском виде настройка ни на что не влияет. [#1608](https://github.com/Matysh/houseplan-card/issues/1608), [#1617](https://github.com/Matysh/houseplan-card/issues/1617)

🚨 **Сигналы на плане из автоматизаций.** Home Assistant может показать или снять сигнал «Внимание» или «Тревога» у устройства или сущности на плане. Активные сигналы восстанавливаются после переподключения и перезапуска Home Assistant. [#1001](https://github.com/Matysh/houseplan-card/issues/1001)

⚡ **Быстрее вход в редактор.** Первый переход в редактор и повторное переключение этажей после работы в редакторе занимают меньше времени. В мобильном приложении Home Assistant успешное действие со значком подтверждается лёгкой вибрацией. [#1595](https://github.com/Matysh/houseplan-card/issues/1595), [#1607](https://github.com/Matysh/houseplan-card/issues/1607)

[Полный список изменений](https://github.com/Matysh/houseplan-card/milestone/18?closed=1)
<!-- language: en -->
## Houseplan 2.0.0 release

🏠 **A true 3D floor plan.** The new WebGL view shows the depth of walls, openings, furniture, and devices from eight angles. Lights and LED strips illuminate both floors and walls. Uploaded decor images stay sharp when zooming in. Browsers without WebGL 2 open the flat plan; the editors and flat SVG export are still available. [#1514](https://github.com/Matysh/houseplan-card/issues/1514), [#1567](https://github.com/Matysh/houseplan-card/issues/1567), [#1618](https://github.com/Matysh/houseplan-card/issues/1618)

📐 **Height for devices and LED strips.** Set their height above the floor to place low devices at floor level and wall-mounted devices where they belong. The height also affects how LED strips light the room. The flat view is unchanged. [#1608](https://github.com/Matysh/houseplan-card/issues/1608), [#1617](https://github.com/Matysh/houseplan-card/issues/1617)

🚨 **Signals from Home Assistant automations.** Automations can show or clear Attention and Alarm signals for a device or entity on the plan. Active signals are restored after reconnecting or restarting Home Assistant. [#1001](https://github.com/Matysh/houseplan-card/issues/1001)

⚡ **Open the editor sooner.** The first editor entry and repeated floor switches after editing are faster. On Home Assistant Companion, a successful marker action gives light haptic feedback. [#1595](https://github.com/Matysh/houseplan-card/issues/1595), [#1607](https://github.com/Matysh/houseplan-card/issues/1607)

[Full list of changes](https://github.com/Matysh/houseplan-card/milestone/18?closed=1)
