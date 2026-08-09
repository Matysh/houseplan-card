# ТЗ #43 — Отчёт для поддержки без персональных данных

- Issue: https://github.com/Matysh/houseplan-card/issues/43
- Приоритет: P2
- Статус ТЗ: draft, privacy defaults нормативны

## Цель

Пользователь копирует воспроизводимый технический snapshot, предварительно
видя весь текст. Default report не содержит данных, по которым можно
восстановить дом, устройства или адреса.

## Формат

Versioned JSON/text envelope `houseplan_support_report: 1`:

- card, integration и HA versions;
- browser engine family/major и supported feature flags без user-agent string;
- model/config/layout schema versions и revisions;
- counts: spaces, rooms, room drafts, physical/open walls, partitions,
  columns, openings по типу, decor по kind, markers по lifecycle/status;
- read-only validation result: stable codes + counts;
- optimizer/migration pending flags;
- active House Plan Repair issue ids/codes без descriptions/user values;
- registry authority level (`full|limited|unknown`) и last sync age bucket;
- checksum только структуры/schema, не raw config.

## Privacy allowlist

Report строится исключительно из typed allowlist projection. Запрещены:
space/room/device/entity names и ids, area/floor/config-entry ids, coordinates,
polygons, URLs, filenames/paths, descriptions, templates/live values, IP/host,
HA installation id, exact timestamps событий. Redaction после сериализации не
считается защитой.

Adversarial fixture заполняет каждое запрещённое поле уникальным sentinel;
ни один sentinel/его URL-encoded/base64 form не встречается в report.

## Архитектура

Backend read-only `houseplan/support/report` выполняет authoritative schema,
store и Repair projection; frontend добавляет card/browser flags. Command
доступен authenticated user, не делает writes/services и возвращает stable
error codes. Если backend старый, frontend создаёт reduced report и явно это
пишет.

## UX

General Settings → Maintenance → «Скопировать отчёт для поддержки». Открывается
wide `hp-dialog` с plain-text preview, предупреждением privacy и действиями
Copy/Download/Cancel. Clipboard failure предлагает `.json` download. Никакой
автоматической отправки/телеметрии.

## Приёмка

- sentinel privacy corpus зелёный frontend/backend;
- preview полностью равен copied/downloaded bytes;
- report работает при invalid config, limited registry и active Repairs;
- copy/download доступен keyboard/touch;
- документация перечисляет включённые и исключённые категории.
