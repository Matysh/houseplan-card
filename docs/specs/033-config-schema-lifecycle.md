# ТЗ #33 — Единый registry схемы и lifecycle compatibility-полей

- Issue: https://github.com/Matysh/houseplan-card/issues/33
- Приоритет: P1
- Статус ТЗ: Stage A частично реализован; документ определяет завершение

## Цель

Сделать drift между TypeScript, UI, runtime и Voluptuous обнаруживаемым в CI,
а судьбу каждого public/legacy/internal поля — явной и проверяемой.

## Канонический registry

Развить `scripts/config-field-registry.mjs` до полного manifest. Запись поля:

```text
path, owner, value kind, enum/range/default, inheritance,
frontend type, backend schema, UI surface, runtime consumers,
introduced, write policy, read-compat-until, migration, unknown-child policy
```

Manifest описывает все сохраняемые `config` и `layout` поля, а не только legacy.
Для dynamic maps (`calibration`, layout ids) фиксируется shape значения и
policy ключей. Секреты/контент в manifest не попадают.

## Паритет и CI

1. Скрипт извлекает/нормализует enum/ranges из frontend declarations и
   backend schema adapters.
2. Любой отсутствующий field decision или несовпадение enum/range ломает CI.
3. `extra=ALLOW_EXTRA` сохраняет future fields, но не освобождает известное поле
   от регистрации.
4. Fixtures содержат oldest-supported, current и future-field config; load/save
   без explicit optimization сохраняет неизвестные поля и визуальную семантику.

## Локальный audit

`scripts/config-audit.mjs` принимает экспортированный JSON локально, ничего не
отправляет наружу и выдаёт counts по legacy fields, planned migrations и
unknown paths без значений персональных данных. Exit codes различают clean,
migration available и invalid.

## Lifecycle

- `read-only legacy`: читается, но никогда не пишется новым UI;
- `migrate-on-explicit-optimize`: preview diff → atomic write → undo;
- `deprecated`: имеет дату/версию окончания чтения и changelog;
- `internal supported`: получает documented UI/default либо становится
  фиксированным правилом и удаляется из storage;
- неизвестное future field сохраняется losslessly.

Первый decision set включает `tap_action`, display `ripple`, `show_all`,
`weather_entity`, vacuum `room_highlight/segment_map`, `group_lights` и
`exclude_integrations`; последние два координируются с #44.

## Приёмка

- 100% известных persisted paths зарегистрированы;
- schema drift имеет понятный CI diff;
- audit не выводит имена/id/координаты по умолчанию;
- Optimize показывает точные изменения до записи и имеет безопасный undo;
- обычное открытие/сохранение старого/future config не меняет визуал.
