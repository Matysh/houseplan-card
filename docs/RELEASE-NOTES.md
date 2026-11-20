<!-- release: v1.86.0-beta.1 -->
<!-- base: v1.85.2 -->
<!-- language: ru -->
## Houseplan 1.86.0-beta.1

Продолжаем тестирование новой линейки: следующая стабильная версия будет **1.86.0**. Эта бета продолжает 1.85.3-beta.3, а не начинает отдельный набор изменений.

Масштабирование колесом в 2.5D использует подготовленные фоновые кадры и подложку плана, чтобы реже прерываться полной отрисовкой. После остановки возвращается точное изображение. Во время масштабирования возможна временная мягкость картинки. [#1485](https://github.com/Matysh/houseplan-card/issues/1485)

Исправлены смена цвета и прозрачности стен и проёмов при зуме, артефакты общей обводки устройств и переходы между просмотром и редакторами. [#1480](https://github.com/Matysh/houseplan-card/issues/1480), [#1486](https://github.com/Matysh/houseplan-card/issues/1486), [#1482](https://github.com/Matysh/houseplan-card/issues/1482), [#1483](https://github.com/Matysh/houseplan-card/issues/1483), [#1484](https://github.com/Matysh/houseplan-card/issues/1484)

2.5D по-прежнему находится в разработке. Перед обновлением сохраните резервную копию. После установки перезапустите Home Assistant и перезагрузите страницы Houseplan.

<!-- language: en -->
## Houseplan 1.86.0-beta.1

Testing continues under the new release line: the next stable version will be **1.86.0**. This beta continues 1.85.3-beta.3 rather than starting a separate set of changes.

Wheel zoom in 2.5D uses prepared background frames and a plan overview to reduce full redraw interruptions. The exact image returns after scrolling stops. The picture may soften temporarily during zoom. [#1485](https://github.com/Matysh/houseplan-card/issues/1485)

Fixes address wall and opening colours and opacity during zoom, shared device-outline artefacts, and transitions between View and editors. [#1480](https://github.com/Matysh/houseplan-card/issues/1480), [#1486](https://github.com/Matysh/houseplan-card/issues/1486), [#1482](https://github.com/Matysh/houseplan-card/issues/1482), [#1483](https://github.com/Matysh/houseplan-card/issues/1483), [#1484](https://github.com/Matysh/houseplan-card/issues/1484)

2.5D is still under development. Back up your plan before updating. Restart Home Assistant after installation and reload Houseplan pages.
