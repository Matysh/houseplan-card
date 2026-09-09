<!-- release: v1.73.0-beta.7 -->

## Основное

- Над планом появилась настраиваемая сводная панель. Она адаптируется к размеру
  карточки, показывает выбранные состояния и показатели, обновляется вживую и
  остаётся отзывчивой в крупных установках Home Assistant
  ([#437](https://github.com/Matysh/houseplan-card/issues/437),
  [#490](https://github.com/Matysh/houseplan-card/issues/490),
  [#493](https://github.com/Matysh/houseplan-card/issues/493)).
- Радары присутствия теперь можно привязать, откалибровать прямо на плане и
  использовать для показа актуальных целей внутри выбранной комнаты; доступны
  ESPHome LD2450 и явные схемы сопоставления для других mmWave-датчиков
  ([#485](https://github.com/Matysh/houseplan-card/issues/485)).
- Оптимизация, отмена, импорт и удаление пространства теперь восстанавливаются
  после прерванной записи без потери частей плана и позиций устройств
  ([#491](https://github.com/Matysh/houseplan-card/issues/491)).
- Мелкие исправления и улучшения.

## Highlights

- A configurable summary panel now floats over the plan, adapts to card size,
  shows selected live states and totals, and stays responsive on large Home
  Assistant installations
  ([#437](https://github.com/Matysh/houseplan-card/issues/437),
  [#490](https://github.com/Matysh/houseplan-card/issues/490),
  [#493](https://github.com/Matysh/houseplan-card/issues/493)).
- Presence radars can now be bound and calibrated directly on the plan to show
  current targets inside the selected room, with ESPHome LD2450 discovery and
  explicit mappings for other mmWave sensors
  ([#485](https://github.com/Matysh/houseplan-card/issues/485)).
- Optimize, Undo, import and space deletion now recover interrupted writes
  without losing parts of the plan or device positions
  ([#491](https://github.com/Matysh/houseplan-card/issues/491)).
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.73.0-beta.7/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.73.0-beta.7/docs/CHANGELOG.md)
