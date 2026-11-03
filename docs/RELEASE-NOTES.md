<!-- release: v1.84.0-beta.3 -->
## Основное

- Геометрия плана хранится в точном графе с постоянными ID узлов и стен. Старые планы переходят на новую модель при структурном сохранении с резервной копией исходных данных.
- Обновлены общий UI Kit, подсказки, всплывающие сообщения и переходы редактора; исправлены залипающие превью стен и вспышки заливки проёмов.
- Внешние экраны получили отдельные настройки вида каждого пространства: поворот, масштаб, размеры значков и учёт сводной панели. Добавлена общая настройка учёта сводки при центрировании обычного Просмотра.
- Восстановлена привязка импортированных проёмов; исправлены отдельные ошибки создания комнат, рисования и позднего обновления камеры. Optimize сохраняет диагностику даже без изменений плана.
- Для Zigbee добавлены пояснения о различиях карт связей и маршрутов, убрано повторение сообщения об отсутствии данных. Названия карточек в HA и заголовок погодной сводки приведены в порядок.

[Подробный технический список](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.3/docs/CHANGELOG.ru.md)

## Highlights

- Plan geometry uses an exact graph with stable node and wall IDs. Existing plans migrate on structural saves, retaining a backup of their original data.
- Shared UI components, help, toasts and editor transitions have been refined; stale wall previews and opening-fill flashes are fixed.
- External screens support per-space rotation, zoom, marker sizes and summary-aware framing. Ordinary View has a shared option to include the summary when centering the plan.
- Imported openings retain their bindings, with fixes for room creation, drawing and delayed camera refresh. Optimize retains diagnostics even when the plan needs no changes.
- Zigbee help explains differences between link maps and confirmed routes, duplicate missing-data messages are removed, and HA picker metadata and weather headings are localized consistently.

[Detailed technical changelog](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.3/docs/CHANGELOG.md)
