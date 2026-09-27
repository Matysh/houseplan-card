# ТЗ #11 — Health lifecycle сохранённого vacuum source

- Issue: https://github.com/Matysh/houseplan-card/issues/11
- Приоритет: P2
- Статус ТЗ: реализовано в Stage 1; целевой gate v1.61.0-beta.1 пройден, ожидается публикация
- Родительский контракт: HP-VAC-02 rev.7 §5.2

## Цель

Переименование, удаление или отключение сохранённого source не должно молча
останавливать server trail. Backend сообщает дедуплицированный incident, UI —
статус и прямой путь перевыбора, не делая silent rebind.

## Backend state machine

Ключ health state — `(marker_id, source_entity_id)`, reason хранится как mutable
поле `missing|disabled` и не входит в identity.

- registry row disabled → `disabled`;
- registry row enabled или exact live state, включая `unavailable` и entity без
  vacuum attributes → доказанное существование/recovery;
- авторитетный registry без row и без exact state → `missing`;
- недоступный/ограниченный registry и отсутствие state → `unverified`.

`unverified` нейтрален: не создаёт, не закрывает и не изменяет incident.
Первый failure после healthy/recovery пишет один warning. Смена reason внутри
того же incident не пишет новый warning. Recovery очищает incident с info log.
Удаление marker/rebind удаляет старый ключ.

Нормативные последовательности:

- available→missing→disabled→missing→available→missing = 2 warnings;
- available→disabled→unsupported-existing→disabled = 2 warnings;
- missing→unverified→missing = 1 warning.

## UI

Resolver сохраняет pinned entity и показывает `missing`, `disabled` либо
`unverified`; stale attributes не рисуют puck. Banner содержит «Выбрать
источник», documentation остаётся доступна. Перевыбор немедленно обновляет
marker и backend subscription после config event.

## Приёмка

Нет log spam на refresh/restart; transition tests проходят; source не меняется
сам; re-pick восстанавливает trail; limited registry не создаёт ложный warning.
