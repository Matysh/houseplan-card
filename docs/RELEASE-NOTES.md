<!-- release: v1.68.0-beta.2 -->

## Основное

- Отказ проверки геометрии перед оптимизацией теперь объясняет себя: причина по каждому пространству, копируемый диагностический блок и совет обновиться только при реальном расхождении версий.
- Инструмент «Толщина» берёт любую стену — отдельно стоящие перегородки и сегменты черновиков меняются так же, как контуры комнат.
- Рисование комнат на планах model v8 снова надёжно: цепочка стен переживает промежуточные сохранения и отмену, отклонённая запись сразу возвращает принятую геометрию.
- Мелкие исправления и улучшения.

## Highlights

- A refused pre-optimize geometry check now explains itself: a reason per space, a copyable diagnostics block, and update advice only when the card and integration versions actually differ.
- The Thickness tool serves every wall — standalone partitions and saved draft segments resize just like room contours.
- Drawing rooms on model-v8 plans is reliable again: a wall chain survives intermediate saves and Undo, and a rejected save restores the accepted geometry at once.
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.68.0-beta.2/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.68.0-beta.2/docs/CHANGELOG.md)
