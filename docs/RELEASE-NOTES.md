<!-- release: v1.72.0 -->

## Основное

- В плане появилась контекстная диагностика связей ZHA и Zigbee2MQTT:
  прямые соседи, качество связи и путь к координатору показываются только
  по запросу и не захламляют план
  ([#54](https://github.com/Matysh/houseplan-card/issues/54),
  [#450](https://github.com/Matysh/houseplan-card/issues/450),
  [#457](https://github.com/Matysh/houseplan-card/issues/457),
  [#459](https://github.com/Matysh/houseplan-card/issues/459)).
- Клик или тап по комнате теперь вписывает её в экран, двойное нажатие по фону
  вписывает весь план, а настройки пространства умеют создать копию без комнат
  ([#152](https://github.com/Matysh/houseplan-card/issues/152),
  [#449](https://github.com/Matysh/houseplan-card/issues/449),
  [#456](https://github.com/Matysh/houseplan-card/issues/456)).
- Большие планы и цепочки стен работают заметно плавнее, а House Plan теперь сам
  диагностирует проблемы обновления и надёжно восстанавливает карточку и диалоги
  после переподключения
  ([#451](https://github.com/Matysh/houseplan-card/issues/451),
  [#461](https://github.com/Matysh/houseplan-card/issues/461),
  [#462](https://github.com/Matysh/houseplan-card/issues/462),
  [#463](https://github.com/Matysh/houseplan-card/issues/463)).
- Мелкие исправления и улучшения.

## Highlights

- Contextual ZHA and Zigbee2MQTT diagnostics now show direct neighbours, link
  quality and the route towards the coordinator only on demand, without covering
  the plan ([#54](https://github.com/Matysh/houseplan-card/issues/54),
  [#450](https://github.com/Matysh/houseplan-card/issues/450),
  [#457](https://github.com/Matysh/houseplan-card/issues/457),
  [#459](https://github.com/Matysh/houseplan-card/issues/459)).
- Clicking or tapping a room now fits it on screen, double-activating free
  background fits the complete plan, and space settings can create a room-free
  copy ([#152](https://github.com/Matysh/houseplan-card/issues/152),
  [#449](https://github.com/Matysh/houseplan-card/issues/449),
  [#456](https://github.com/Matysh/houseplan-card/issues/456)).
- Large plans and wall chains respond noticeably more smoothly, while House Plan
  diagnoses update problems and reliably restores the card and its dialogs after
  reconnects ([#451](https://github.com/Matysh/houseplan-card/issues/451),
  [#461](https://github.com/Matysh/houseplan-card/issues/461),
  [#462](https://github.com/Matysh/houseplan-card/issues/462),
  [#463](https://github.com/Matysh/houseplan-card/issues/463)).
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.72.0/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.72.0/docs/CHANGELOG.md)
