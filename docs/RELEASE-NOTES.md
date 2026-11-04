<!-- release: v1.84.0-beta.4 -->
## Основное

- Resize сохраняет общие стены, проёмы на разделённых участках и неподвижные углы соседних комнат, включая Undo/Redo и повторную загрузку.
- После Split две комнаты используют одну общую физическую стену с одинаковой толщиной. Draw сохраняет исходные участки стен и привязки проёмов при создании комнат на пересечениях.
- При переносе существующих проёмов снова работают размеры плеч и привязка к центру стены. Первый Escape отменяет перенос проёма или устройства; последующее отпускание мыши не сохраняет отменённое движение.
- В старых планах перемещение лестницы корректно отменяется и повторяется без изменения старых стен.
- Исправлены тесты геометрии, измерение кнопок сводной панели и диагностика производительности. Обновлены 236 визуальных эталонов, явно просмотренных и принятых владельцем; пороги сравнения сохранены.

Ограничение: известная проблема удаления некоторых коротких стен (#1258) в эту бету не входит.

[Подробный список изменений](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.4/docs/CHANGELOG.ru.md)

## Highlights

- Resize preserves shared walls, openings on split carriers and fixed neighbouring corners through Undo/Redo and reload.
- Split rooms share one physical divider with consistent thickness. Draw preserves original wall pieces and opening bindings when intersections create new rooms.
- Existing openings regain shoulder dimensions and wall-centre snapping. The first Escape cancels an opening or device drag; releasing the pointer cannot save the cancelled move.
- Moving stairs on legacy plans can be undone and redone without changing legacy walls.
- Repairs cover geometry tests, summary-control measurement and performance diagnostics. The owner explicitly reviewed and accepted 236 visual baselines; comparison thresholds remain unchanged.

Known limitation: the short-wall deletion issue (#1258) is outside this beta.

[Detailed changelog](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.4/docs/CHANGELOG.md)
