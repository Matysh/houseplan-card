# ТЗ #27 — Явный выбор внешнего vacuum source

- Issue: https://github.com/Matysh/houseplan-card/issues/27
- Приоритет: P1
- Статус ТЗ: реализовано по HP-VAC-02 rev.7; целевой gate v1.61.0-beta.1 пройден, ожидается публикация
- Родительский контракт: HP-VAC-02 §4.4–4.5

## Цель

Позволить связать YAML/registry-less камеру XCME, которая не имеет DeviceInfo
связи с vacuum device, без угадывания и последующего silent rebind.

## Resolver

1. Единственный pure resolver возвращает `{entityId, status, pinned,
   candidates}` и используется renderer, dialog, fit, diagnostics и trail UI.
2. Сохранённый `marker.vacuum.source` sticky при `ok`, `unsupported`,
   `unavailable`, `disabled`, `unverified` и `missing`; автоматическая замена
   запрещена.
3. Automatic mode рассматривает только position-capable сущности того же HA
   device; глобальные камеры никогда не выбираются автоматически.
4. Порядок кандидатов детерминирован: capability score, camera выше прочего,
   затем `entity_id`; выбранный source всегда видим первым.
5. `missing` допустим только при авторитетном доказательстве. Незаполненный
   status pure resolver трактует как `unverified`.

## Picker

- Основной список: automatic, same-device candidates и сохранённый source.
- «Все камеры» закрыт по умолчанию и сканирует `camera.*` только при открытии.
- Глобальный список — snapshot на одно открытие; HA ticks не перепарсивают его.
- Повторное открытие делает новый snapshot; новый dialog не наследует старый.
- Каждый кандидат показывает имя, entity id, integration и capabilities.
- Missing/disabled/unverified banner содержит собственную кнопку выбора.
- Выбор first-use source немедленно перестраивает devices; ожидание следующего
  HA tick запрещено.

## Эдж-кейсы

- source удалён/переименован; registry ограничен правами; state unavailable;
- camera без position, но с rooms/path; несколько одинаково подходящих камер;
- первый edit ещё не материализовал marker; dialog закрыт во время scan;
- два экземпляра карточки не делят UI snapshot.

## Приёмка

- внешняя XCME камера выбирается и сохраняется с первого клика;
- reload не меняет выбранный source;
- missing source остаётся видимым и исправимым;
- глобальный scan ленивый и не влияет на автоматический resolver;
- источник одинаков во всех vacuum consumers.
