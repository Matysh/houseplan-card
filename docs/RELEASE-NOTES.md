<!-- release: v1.85.3-beta.1 -->
<!-- base: v1.85.2 -->
<!-- language: ru -->
## Houseplan 1.85.3-beta.1

Первая бета после 1.85.2.

- У кнопок одна рамка для наведения, выбора и перехода клавишей Tab. Выход из редактора и возврат из диалога больше не оставляют лишнего кольца фокуса. Управление с клавиатуры сохранено. [#1428](https://github.com/Matysh/houseplan-card/issues/1428)
- Свет доходит до полотна закрытой двери, а не обрывается у края проёма. Учтены распашные и откатные двери, LED и статическая карточка. [#1421](https://github.com/Matysh/houseplan-card/issues/1421)
- Переработаны русское и английское руководства: содержание, повседневные сценарии, области настроек, редакторы и профили экранов. Обновлены README и иллюстрации. [#1427](https://github.com/Matysh/houseplan-card/issues/1427), [#1429](https://github.com/Matysh/houseplan-card/issues/1429)
- Подготовлены независимое ядро и границы хоста для будущего автономного редактора, усилена проверка входных данных. Публичный автономный сайт в этой бете не выпускается; существующие планы и работа внутри HA сохраняются. [#1390](https://github.com/Matysh/houseplan-card/issues/1390)

Перед обновлением сохраните резервную копию. После установки перезапустите Home Assistant и перезагрузите страницы Houseplan.

<!-- language: en -->
## Houseplan 1.85.3-beta.1

The first beta after 1.85.2.

- Buttons use one border for hover, selection and native Tab navigation. Leaving an editor or returning from a dialog no longer leaves an extra focus ring. Keyboard operation is preserved. [#1428](https://github.com/Matysh/houseplan-card/issues/1428)
- Artificial light reaches a closed door leaf instead of stopping at the wall slot. Swing and sliding doors, LEDs and the static card are covered. [#1421](https://github.com/Matysh/houseplan-card/issues/1421)
- Reworked Russian and English guides with contents, everyday workflows, scoped settings, editors and screen profiles. Updated README and illustrations. [#1427](https://github.com/Matysh/houseplan-card/issues/1427), [#1429](https://github.com/Matysh/houseplan-card/issues/1429)
- Prepared the independent core and host boundaries for a future standalone editor and strengthened input validation. This beta does not publish a standalone website; existing plans and HA operation are retained. [#1390](https://github.com/Matysh/houseplan-card/issues/1390)

Back up your plan before updating. Restart Home Assistant after installation and reload Houseplan pages.
