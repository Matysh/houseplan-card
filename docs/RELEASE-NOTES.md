<!-- release: v1.85.2-beta.2 -->
## House Plan 1.85.2-beta.2

### Русский

- **Стабильные подсказки устройств.** Короткая задержка перед появлением, плавное появление и исчезновение. Подсказка остаётся на месте при движении указателя внутри значка и обновлении показаний HA. После переподключения карточки подсказка ждёт нового движения мыши. [#1409](https://github.com/Matysh/houseplan-card/issues/1409), [#1413](https://github.com/Matysh/houseplan-card/issues/1413)
- **Понятные переносы.** Название показателя, значение и единица измерения переносятся вместе: например, «LQI 172» больше не разделяется между строками. [#1411](https://github.com/Matysh/houseplan-card/issues/1411)
- **Курсор селектора.** У Icon state source исправлен текстовый курсор; поиск сохраняет привычное поведение. [#1410](https://github.com/Matysh/houseplan-card/issues/1410)

Включены изменения [1.85.2-beta.1](https://github.com/Matysh/houseplan-card/releases/tag/v1.85.2-beta.1).
После обновления перезапустите Home Assistant и перезагрузите страницы House Plan. Это предварительная версия; перед редактированием важного плана сохраните резервную копию.

### English

- **Stable device tooltips.** A short hover delay and smooth appearance/disappearance. The tooltip stays anchored while the pointer moves inside the icon and HA readings update. After the card reconnects, the tooltip waits for fresh mouse movement. [#1409](https://github.com/Matysh/houseplan-card/issues/1409), [#1413](https://github.com/Matysh/houseplan-card/issues/1413)
- **Readable wrapping.** Each metric label, value and unit wraps together; for example, “LQI 172” stays on one line. [#1411](https://github.com/Matysh/houseplan-card/issues/1411)
- **Picker cursor.** Correct the text cursor on Icon state source while preserving normal search behavior. [#1410](https://github.com/Matysh/houseplan-card/issues/1410)

Includes the changes from [1.85.2-beta.1](https://github.com/Matysh/houseplan-card/releases/tag/v1.85.2-beta.1).
Restart Home Assistant and reload House Plan pages after updating. This is a prerelease; save a backup before editing an important plan.
