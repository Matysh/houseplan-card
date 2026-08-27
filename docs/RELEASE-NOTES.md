<!-- release: v1.68.0 -->

## Основное

- Стены получили стабильные ID: Resize, Undo/Redo, импорт, оптимизация и повторные правки сохраняют толщину и проёмы; переход на новую модель выполняется атомарно и сам разрешает конфликты старых границ с проёмами.
- Виртуальные стены заменены обычными стенами толщиной 0 см. Пунктирный вид пропускает Glow и солнце, сплошной работает как световой барьер.
- Перед первым структурным сохранением или «Оптимизировать планы» рекомендуется экспортировать резервную копию: старые версии не понимают новую модель стен.
- Мелкие исправления и улучшения.

## Highlights

- Walls now have stable IDs: Resize, Undo/Redo, import, optimization and repeated edits preserve thickness and openings; the new model upgrades atomically and resolves legacy boundary/opening conflicts by itself.
- Virtual walls are replaced by ordinary 0 cm walls. Dashed walls transmit Glow and sunlight, while solid ones act as light barriers.
- Exporting a backup before the first structural save or Optimize plans run is recommended because older versions do not understand the new wall model.
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.68.0/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.68.0/docs/CHANGELOG.md)
