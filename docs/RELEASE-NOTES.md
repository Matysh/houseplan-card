<!-- release: v1.71.0-beta.4 -->

## Основное

- Вторую и последующие карты робота теперь можно безопасно добавить после выбора этажа; пустой список маршрутов остаётся пустым, а удалённые пространства и лишний обход устройств обрабатываются корректно ([#441](https://github.com/Matysh/houseplan-card/issues/441), [#443](https://github.com/Matysh/houseplan-card/issues/443)).
- Если Home Assistant отклоняет сохранение устройства или калибровки робота, план атомарно возвращается к подтверждённому состоянию, сохраняя открытый редактор и введённый черновик для повтора ([#442](https://github.com/Matysh/houseplan-card/issues/442)).
- Мебель теперь примагничивается к видимой физической поверхности стены с учётом локальной толщины и стороны общей стены, а не проваливается в кладку из-за привязки к оси ([#445](https://github.com/Matysh/houseplan-card/issues/445)).
- Мелкие исправления и улучшения.

## Highlights

- A robot vacuum's second and later maps can now be added safely after choosing a floor; an empty route list stays empty, while deleted spaces and unnecessary device scans are handled correctly ([#441](https://github.com/Matysh/houseplan-card/issues/441), [#443](https://github.com/Matysh/houseplan-card/issues/443)).
- If Home Assistant rejects a device or robot-calibration save, the plan atomically restores its confirmed state while keeping the editor and entered draft ready for another attempt ([#442](https://github.com/Matysh/houseplan-card/issues/442)).
- Furniture now snaps to the visible physical wall surface with the local thickness and shared-wall side taken into account, instead of entering the masonry through centreline snapping ([#445](https://github.com/Matysh/houseplan-card/issues/445)).
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.71.0-beta.4/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.71.0-beta.4/docs/CHANGELOG.md)
