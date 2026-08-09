# ТЗ #44 — Явные фильтры и группировка устройств

- Issue: https://github.com/Matysh/houseplan-card/issues/44
- Приоритет: P2
- Статус ТЗ: policy proposal ready for owner review
- Связано: device inbox #29, field registry #33

## Цель

Убрать скрытые настройки, влияющие на discovery. Каждый ключ либо получает
поддерживаемый advanced UI и documented default, либо мигрирует в фиксированное
product rule.

## Решение v1

Оба текущих ключа остаются поддерживаемыми и становятся видимыми в Advanced
разделе inbox:

### `group_lights`

- default `true`;
- label: «Объединять несколько светильников комнаты»;
- preview показывает, какие bindings будут группой/отдельными marker;
- переключение не применяется до Save и не удаляет explicit markers;
- existing light-group marker сохраняет lifecycle; конфликт bindings preview.

### `exclude_integrations`

- default — текущий `EXCLUDED_DOMAINS`/product list;
- UI — searchable multi-select интеграций, реально присутствующих в registry,
  плюс reset to recommended defaults;
- изменение влияет только на automatic candidates/seed, не скрывает explicit
  live marker и не удаляет tombstone;
- reason в inbox — «Исключена интеграция X».

Название storage key `exclude_integrations` сохраняется для compatibility;
семантика и default фиксируются в registry #33.

## Исследование перед включением Save

Локальный config-audit считает значения/отклонения от defaults без вывода ids.
Synthetic fixtures моделируют реальные классы: group lights, parent device,
service/bridge, explicit override, tombstone. Если audit показывает, что ключ
невозможно объяснить без вредного поведения, owner может отдельным решением
перевести его в fixed rule до реализации UI.

## UX/transaction

Preview diff: новые/скрытые/grouped candidates counts и конкретный список в
локальной session. Apply пишет settings один раз, rebuild devices и создаёт
named undo/config snapshot. Cancel no-op. Два клиента используют config rev.

## Приёмка

- ни один runtime discovery key не скрыт от пользователя/registry;
- defaults совпадают frontend, backend, docs и fixtures;
- explicit marker никогда не исчезает из-за filter change;
- preview объясняет каждую изменившуюся binding;
- old config даёт прежний result до user action.
