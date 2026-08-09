# ТЗ #50 — Экспорт/импорт конфигурации и пространства

- Issue: https://github.com/Matysh/houseplan-card/issues/50
- Приоритет: P1
- Статус ТЗ: ready for review
- Security scope: только владелец/admin согласно существующей write policy

## Цель

Дать переносимую резервную копию модели House Plan и безопасный перенос одного
пространства между собственными HA instances без silent overwrite.

## Формат v1

Один UTF-8 JSON с envelope:

```json
{
  "format": "houseplan-export",
  "export_version": 1,
  "kind": "full|space",
  "created_at": "ISO-8601",
  "card_version": "…",
  "integration_version": "…",
  "model_version": 0,
  "payload": { "config": {}, "layout": {} },
  "content_manifest": []
}
```

Trails, optimizer undo/pending snapshots, revisions, signed URL tokens и
runtime caches не экспортируются. Config и layout экспортируются вместе:
backup без positions неполон.

`content_manifest` описывает ссылки, но v1 JSON не содержит бинарные файлы.
На той же instance существующие content refs продолжают работать. При
cross-instance import локальная `/api/houseplan/content/...` ссылка помечается
missing и пропускается/очищается только после явного подтверждения preview;
external safe URLs сохраняются. Portable ZIP с assets — отдельный будущий этап.

## Full export/import

- Export содержит полные `spaces`, `markers`, `settings` и live layout records.
- Import проходит envelope limits, JSON parse, migration/read compatibility,
  `CONFIG_SCHEMA` и `LAYOUT_SCHEMA`, затем dry-run preview.
- Preview: counts current→incoming, spaces replaced, markers/layout, orphaned
  bindings, missing content, unknown future fields, incompatible version.
- Apply — один admin-only backend command под `write_lock`: recheck expected
  config/layout revisions, atomic two-store transaction/rollback, затем events.
- Full import заменяет модель полностью; Cancel не пишет ничего.

## Space export/import

- Payload содержит один space целиком и только относящиеся к нему markers и
  layout ids: marker ids, `rl_<roomId>` и другие документированные owners.
- Import всегда добавляет новое пространство. Новый safe id генерируется;
  title conflict получает ` (2)`, ` (3)`.
- Все внутренние room/opening/decor/draft ids remap при collision; references
  (`open_to`, room_id, layout keys) переписываются по одной map.
- HA binding/entity ids сохраняются. Не существующие на target становятся
  orphaned через текущий lifecycle, import не угадывает замену.
- Binding, уже занятая live marker target config, не дублируется молча: preview
  предлагает импортировать marker как unbound virtual copy либо пропустить;
  default — пропустить marker, geometry пространства сохранить.

## Ограничения и безопасность

Размер файла и collection caps не выше backend schema; prototype pollution
keys и non-finite JSON невозможны. Export скачивается локально, без внешней
телеметрии. Никакие HA services не вызываются при preview.

## Проверки и приёмка

- full roundtrip сохраняет normalized config+layout и unknown future fields;
- atomic rollback при второй store failure и revision race;
- remap всех space-owned ids/references, name/id collisions;
- orphan/disabled/removed/virtual/vacuum calibration cases;
- invalid/oversize/newer export не меняет stores и даёт stable error code;
- mobile/desktop preview, explicit confirmation и локализованные итоги;
- документация прямо говорит, что v1 JSON не переносит бинарные assets/trails.
