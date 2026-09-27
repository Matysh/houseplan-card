# ТЗ #40 — Floors/Areas как направляемый onboarding

- Issue: https://github.com/Matysh/houseplan-card/issues/40
- Приоритет: P2
- Статус ТЗ: draft, требует подтверждения fallback при отсутствии floor registry

## Цель

При создании комнат помогать последовательно разметить HA areas выбранного
floor, оставаясь read-only потребителем HA registries.

## Space ↔ floor

Space draft получает optional `floor_id`. Import/create wizard предлагает HA
floor, но разрешает «Без этажа». Существующий space без floor продолжает
работать. House Plan не создаёт, не переименовывает и не переносит floor/area.

## Room dialog

Area options группируются:

1. неиспользованные areas выбранного floor;
2. уже используемые areas этого floor (disabled для duplicate binding, с
   указанием комнаты);
3. areas без floor/других floors в раскрываемой группе «Другие зоны»;
4. явное option «Без зоны».

При выборе area новое room name предлагается из `area.name`, но вручную
введённое имя не перезаписывается. «Без зоны» является валидным select value и
не требует отдельной кнопки.

## Progress

В Plan editor/room create flow: «Размечено N из M зон этажа». `M` — active HA
areas выбранного floor, `N` — unique room.area этого space. Disabled/deleted
areas не увеличивают M; orphaned saved binding отображается отдельно и не
исчезает из room config.

## Registry lifecycle

- limited registry: UI сообщает, что список может быть неполным, не объявляет
  зоны удалёнными;
- floor change space не переносит areas автоматически; preview показывает
  несоответствия и требует подтверждения;
- area moved to another floor обновляет группировку, но не меняет room;
- одна area не может быть назначена двум live rooms через UI; imported
  collision показывается как validation warning.

## Проверки и приёмка

- floor/no-floor/limited/disabled/orphaned matrices;
- name suggestion не затирает user input;
- progress unique count и registry refresh;
- keyboard/mobile select groups;
- никакой HA registry write/service call;
- room без area сохраняется обычной Save и ведёт себя как сейчас.
