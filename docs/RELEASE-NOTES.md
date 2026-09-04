<!-- release: v1.72.0-beta.1 -->

## Основное

- Скрытый 3-D Просмотр снова доступен тестировщикам через единый бессрочный
  ключ `hp_alpha=1`; старое включение `hp-labs=iso` намеренно не переносится
  ([#448](https://github.com/Matysh/houseplan-card/issues/448)).
- В Просмотре и киоске клик или тап по комнате теперь центрирует её и вписывает
  видимый пол и стены с полями 10%, а подпись даёт то же действие с клавиатуры;
  мебель примагничивается к обеим физическим граням наружной стены, а стрелки
  сдвигают выбранный объект подложки ровно на одну клетку
  ([#152](https://github.com/Matysh/houseplan-card/issues/152),
  [#447](https://github.com/Matysh/houseplan-card/issues/447)).
- Администратор может включить диагностику Zigbee-сети и при наведении видеть только прямые связи выбранного устройства из снимка ZHA или Zigbee2MQTT, не закрывая план полной сеткой ([#54](https://github.com/Matysh/houseplan-card/issues/54)).
- Мелкие исправления и улучшения.

## Highlights

- Hidden 3-D View is available to testers again through the single indefinite
  `hp_alpha=1` switch; the former `hp-labs=iso` state is intentionally not
  migrated ([#448](https://github.com/Matysh/houseplan-card/issues/448)).
- In View and kiosk, clicking or tapping a room now centres it and fits its
  visible floor and walls with 10% margins, while the label offers the same
  keyboard action; furniture snaps to either physical face of an exterior wall,
  and Arrow keys move a selected Background object by exactly one grid cell
  ([#152](https://github.com/Matysh/houseplan-card/issues/152),
  [#447](https://github.com/Matysh/houseplan-card/issues/447)).
- Administrators can enable Zigbee diagnostics and hover a device to see only its direct links from a ZHA or Zigbee2MQTT snapshot, without covering the plan with the full mesh ([#54](https://github.com/Matysh/houseplan-card/issues/54)).
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.72.0-beta.1/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.72.0-beta.1/docs/CHANGELOG.md)
