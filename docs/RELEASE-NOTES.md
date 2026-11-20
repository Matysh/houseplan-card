<!-- release: v1.85.3-beta.3 -->
<!-- base: v1.85.2 -->
<!-- language: ru -->
## Houseplan 1.85.3-beta.3

Изменения после beta.2:

- Панорама и масштабирование в 2.5D переиспользуют уже отрисованный план. При зуме изображение может ненадолго смягчаться и снова становится резким после остановки. Свет пола, стен и мебели меняется плавно. [#1478](https://github.com/Matysh/houseplan-card/issues/1478)
- В 2.5D подняты значки и подписи, свет отображается на стенах, а мебель и лестницы используют общий материал. В настройках пространства можно задать отдельный акцент проёмов. [#1474](https://github.com/Matysh/houseplan-card/issues/1474)
- Распашная дверь по умолчанию располагается у стороны открывания. В свойствах можно выбрать любую сторону или центр проёма. Выбранное положение видно и при перепривязке двери. [#1475](https://github.com/Matysh/houseplan-card/issues/1475) · [#1476](https://github.com/Matysh/houseplan-card/issues/1476)
- Обводка значков разных размеров правильно закругляется в 2D и 2.5D. [#1477](https://github.com/Matysh/houseplan-card/issues/1477)

Перед обновлением сохраните резервную копию. После установки перезапустите Home Assistant и перезагрузите страницы Houseplan.

<!-- language: en -->
## Houseplan 1.85.3-beta.3

Changes since beta.2:

- Pan and zoom in 2.5D reuse the rendered plan. The image may soften briefly while zooming and sharpens again when scrolling stops. Lighting fades across the floor, walls and furniture together. [#1478](https://github.com/Matysh/houseplan-card/issues/1478)
- 2.5D raises markers and labels, adds lighting on walls, and uses matching materials for stairs and furniture. Space settings offer a separate accent colour for openings. [#1474](https://github.com/Matysh/houseplan-card/issues/1474)
- Swing doors sit on the opening side by default. You can choose either side or the centre in the door's properties. The preview keeps that choice when you reattach the door to another wall. [#1475](https://github.com/Matysh/houseplan-card/issues/1475) · [#1476](https://github.com/Matysh/houseplan-card/issues/1476)
- Device outlines follow the corners of mixed-size icons in 2D and 2.5D. [#1477](https://github.com/Matysh/houseplan-card/issues/1477)

Save a backup before updating. After installation, restart Home Assistant and reload Houseplan.
