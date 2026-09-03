<!-- release: v1.71.0-beta.3 -->

## Основное

- Карты многоэтажного робота теперь сопоставляются пространствам отдельно от базы: живое положение, след и калибровка следуют за активной картой, а неопределённый этаж не угадывается ([#162](https://github.com/Matysh/houseplan-card/issues/162)).
- Если Home Assistant отклоняет сохранение общих настроек, план возвращается к последнему подтверждённому состоянию, сохраняя введённые значения в диалоге для повтора ([#439](https://github.com/Matysh/houseplan-card/issues/439)).
- Пользовательские изображения подложки больше не могут подвесить Home Assistant специальным файловым объектом и корректно обрабатывают исчезновение файла или повреждённое изображение ([#440](https://github.com/Matysh/houseplan-card/issues/440)).
- Мелкие исправления и улучшения.

## Highlights

- A multi-floor robot's maps can now be assigned independently from its dock: live position, trails and calibration follow the active map, while an unknown floor is never guessed ([#162](https://github.com/Matysh/houseplan-card/issues/162)).
- If Home Assistant rejects a General settings save, the plan returns to its last confirmed state while retaining the entered values in the dialog for another attempt ([#439](https://github.com/Matysh/houseplan-card/issues/439)).
- Custom background assets can no longer hang Home Assistant through special filesystem objects and safely handle a disappearing file or a corrupt image ([#440](https://github.com/Matysh/houseplan-card/issues/440)).
- Small fixes and improvements.

[Полный список изменений на русском](https://github.com/Matysh/houseplan-card/blob/v1.71.0-beta.3/docs/CHANGELOG.ru.md)
· [Full changelog in English](https://github.com/Matysh/houseplan-card/blob/v1.71.0-beta.3/docs/CHANGELOG.md)
