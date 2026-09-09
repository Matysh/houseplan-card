<!-- release: v1.73.0-beta.9 -->

## Основное

- План открывается без лишних тяжёлых перерисовок сразу после первого кадра:
  когда сводная панель уже загружена на странице, её элементы входят в
  первый кадр, и первое обновление устройств и свечения ложится на
  стабильную сцену. Это снимает регресс времени запуска, найденный при
  подготовке стабильной v1.73.0
  ([#506](https://github.com/Matysh/houseplan-card/issues/506)).
- Мелкие исправления и улучшения.

## Highlights

- The plan opens without an extra round of heavy redraws right after the first
  frame: when the summary panel is already loaded on the page, its controls
  are part of the first frame, so the first device/glow update lands on a
  stable stage. This removes the startup-time regression found while
  preparing stable v1.73.0
  ([#506](https://github.com/Matysh/houseplan-card/issues/506)).
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.73.0-beta.9/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.73.0-beta.9/docs/CHANGELOG.md)
