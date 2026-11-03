<!-- release: v1.84.0-beta.3 -->
## Основное

- Точная геометрия общих узлов и стен: микроскопические расхождения старого плана исправляются автоматически при первой структурной правке, исходная пара сохраняется для восстановления. Ускорены проверки геометрии и редактирование узлов; исправлены вырезы проёмов и надёжность больших сохранений.
- Переходы между Просмотром и редакторами сохраняют фактический масштаб и центр. Доработаны общие поля, подсказки, уведомления и состояния выбора; карточки Sections используют углы темы и обходятся без лишней шапки.
- Внешним экранам можно задать отдельный вид каждого пространства: поворот, масштаб 10–1000%, сводку и размеры значков/текста. Старые профили переносятся при сохранении.
- В киоске касание поля показывает переключатель пространств, доступный и при увеличении. После перехода по лестнице подсвечиваются обратные лестницы.
- В сводке появилась отключаемая погода с текущими условиями и прогнозом на три дня.
- Для LQI добавлен режим «Только слабый» с порогом ≤50 и отдельной настройкой пространства. Уточнены подсказки о маршрутах Zigbee.

[Подробный список изменений](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.3/docs/CHANGELOG.ru.md)

## Highlights

- Exact shared wall and node geometry automatically resolves microscopic legacy discrepancies on the first structural edit, retaining the original pair for recovery. Geometry checks and node edits are faster; opening cuts and large saves are more reliable.
- Switching between View and editors preserves physical scale and centre. Shared fields, hints, toasts and choice states are refined; Sections cards inherit theme corners without an extra title header.
- External screens can save a separate view for each space: rotation, 10–1000% scale, summary and icon/text sizes. Legacy profiles migrate on Save.
- A field tap reveals the kiosk space switcher even while zoomed. Stair arrivals highlight the return stairs.
- An optional summary weather widget shows current conditions and a three-day forecast.
- Zigbee LQI gains Low only at ≤50 with per-space overrides, plus clearer route diagnostics.

[Detailed changelog](https://github.com/Matysh/houseplan-card/blob/v1.84.0-beta.3/docs/CHANGELOG.md)
