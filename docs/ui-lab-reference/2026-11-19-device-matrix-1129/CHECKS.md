# Фактическая проверка 19.11.2026

База: e5c56c0e45d6c0742e4c3302611d27ff3d3d85de.

- npm run build: PASS (TypeScript + Rollup).
- node inspect.mjs http://localhost:8890/: PASS, Chromium 1920 × 1080, отдельная сессия.
- 336 ячеек; 328 видимых проверяемых устройств, 8 HA-disabled намеренно не рисуются.
- 80 штатных групповых контуров; нейтральные соседи присутствуют.
- Закреплённые hover/selection синий; focus с обводкой; offline приглушён.
- Reduced motion: animated=false, indicator=dot. Live states off: pulse=none.
- Светлая и тёмная темы; снимки overview, alarms, interactions, diagnostics-light.
- Ошибок JavaScript в проверочном браузере: 0.
- /health: synthetic dataset, productCommit соответствует базе.

Это проверка диагностического стенда, не тестирование исправления #1129. Полный CI не запускался. Исходники продукта не изменены.
