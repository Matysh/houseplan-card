<!-- release: v1.85.0-beta.1 -->
<!-- base: v1.84.0 -->
<!-- language: ru -->
## Houseplan 1.85.0-beta.1

Первая бета после стабильной 1.84.0 улучшает редактирование плана и подсказки.

- Висячий конец стены можно перетащить на середину другой стены или перегородки: цель подсвечивается, стена разбивается точно в месте соединения, действие поддерживает отмену и повтор. [#1330](https://github.com/Matysh/houseplan-card/issues/1330)
- Прямая и винтовая лестницы видны под курсором до размещения. Исправлены отмена черновика, контекстное меню узлов и обновление панелей во время предпросмотра. [#1253](https://github.com/Matysh/houseplan-card/issues/1253), [#1338](https://github.com/Matysh/houseplan-card/issues/1338)
- Shift при повороте декора и изображения плана привязывает угол с шагом 45°; нажатие и отпускание клавиши сразу обновляет предпросмотр. [#1255](https://github.com/Matysh/houseplan-card/issues/1255)
- В пустом пространстве появилась подсказка с переходом в редактор. Ложная стрелка «План там» исчезла; подсказка под привязкой комнаты к зоне Home Assistant теперь остаётся видимой. [#1329](https://github.com/Matysh/houseplan-card/issues/1329), [#1333](https://github.com/Matysh/houseplan-card/issues/1333), [#1334](https://github.com/Matysh/houseplan-card/issues/1334)
- Исправлены выступы заливки комнаты в стыках стен с отдельной перегородкой. Обновлены три принятых владельцем эталона диалогов комнаты. [#1327](https://github.com/Matysh/houseplan-card/issues/1327), [#1334](https://github.com/Matysh/houseplan-card/issues/1334)

После обновления перезапустите Home Assistant и перезагрузите страницы Houseplan.

<!-- language: en -->
## Houseplan 1.85.0-beta.1

The first beta after stable 1.84.0 improves plan editing and guidance.

- Drag a dangling wall endpoint onto the interior of another wall or partition. The highlighted target splits exactly at the attachment, with Undo and Redo support. [#1330](https://github.com/Matysh/houseplan-card/issues/1330)
- Straight and Spiral stairs preview under the pointer before placement. Cancellation, node context menus and toolbar updates work during preview. [#1253](https://github.com/Matysh/houseplan-card/issues/1253), [#1338](https://github.com/Matysh/houseplan-card/issues/1338)
- Hold Shift while rotating decor or the plan image to snap to absolute 45° increments. Pressing and releasing Shift updates the preview immediately. [#1255](https://github.com/Matysh/houseplan-card/issues/1255)
- Empty spaces offer a shortcut to the plan editor and no longer show a misleading off-screen-plan arrow. The room's Home Assistant area helper stays visible. [#1329](https://github.com/Matysh/houseplan-card/issues/1329), [#1333](https://github.com/Matysh/houseplan-card/issues/1333), [#1334](https://github.com/Matysh/houseplan-card/issues/1334)
- Fixed room-floor protrusions at mixed wall and partition junctions. Updated the three owner-approved room-dialog baselines. [#1327](https://github.com/Matysh/houseplan-card/issues/1327), [#1334](https://github.com/Matysh/houseplan-card/issues/1334)

After updating, restart Home Assistant and reload Houseplan pages.
