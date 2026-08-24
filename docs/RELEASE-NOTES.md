<!-- release: v1.67.0-rc.1 -->

## Основное

- Многостенные стыки больше не вырезают длинные участки соседних стен: кладка остаётся непрерывной даже рядом с коротким лучом узла.
- Resize сохраняет роли и толщины общих стен, действительно двигает активную ручку, а для недоступных стен показывает конкретную понятную причину.
- Почти осевые стены и невидимый координатный шум теперь исправляются предсказуемо: Walls сохраняет точную ось, а «Оптимизировать планы» и общий барьер записи приводят старые значения к канонической сетке.
- Мелкие исправления и улучшения.

## Highlights

- Multi-wall junctions no longer cut long sections out of neighbouring walls: masonry stays continuous even beside a short node ray.
- Resize preserves shared-wall roles and thicknesses, enabled handles actually move, and unavailable walls now expose a specific human-readable reason.
- Nearly axial walls and invisible coordinate noise are repaired predictably: Walls stores an exact axis, while Optimize plans and the common write barrier converge older values onto the canonical grid.
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.67.0-rc.1/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.67.0-rc.1/docs/CHANGELOG.md)
