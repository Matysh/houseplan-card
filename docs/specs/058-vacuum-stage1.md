# ТЗ #58 — HP-VAC-02 Stage 1: покрытие vacuum-интеграций

- Issue: https://github.com/Matysh/houseplan-card/issues/58
- Приоритет: P1
- Статус ТЗ: реализовано с owner override F6; целевой gate v1.61.0-beta.1 пройден, ожидается публикация
- Полная нормативная спецификация: `docs/superpowers/specs/2026-08-09-vacuum-integration-coverage-design.md`

## Назначение документа

Этот файл связывает каноническую issue с утверждённой rev.7 и фиксирует
release boundary. Формулы, состояния и тестовые векторы не дублируются: при
расхождении источником истины является полная нормативная спецификация.

## Scope Stage 1

- Dreame/Mova, Xiaomi Cloud Map Extractor и MQTT Vacuum Camera/Valetudo;
- sticky source resolver и внешний camera picker;
- multi-subpath path без мостов, 64 сегмента/4000 точек;
- room area-centroid, bbox-center как последний compatibility fallback,
  auto-fit по пригодным совпавшим именам;
- confirm до записи matrix при residual >40 см;
- стабильный map id без nonce `vacuum_json_id`;
- capability diagnostics и deduplicated backend source health;
- общие fixture TS/Python, unit/backend/browser tests и ru/en docs.

## Не входит

- Roomba string pose — #10, отдельный Stage 2;
- path для Dreame/Valetudo без подтверждённого контракта;
- новая модель сохранённых matrix/trails.

## Дочерние задачи

- #6 — XCME multi-subpath;
- #7 — Valetudo outlines;
- #8 — support matrix и XCME setup hint;
- #11 — source health lifecycle;
- #27 — explicit source picker.

## Release gate

1. Targeted unit + backend transitions + оба vacuum smoke.
2. Production build и синхронные bundle snapshots.
3. Beta/RC до stable согласно promotion rule.
4. Issue и дочерние задачи закрываются только после зелёного exact-SHA CI и
   проверки release asset.

## Приёмка

Приёмка равна чек-листу rev.7: resolver не делает silent rebind, subpaths не
соединяются, outline rooms калибруются, high residual не пишет config, map-id
не рвётся от nonce, health warnings дедуплицированы, старые данные не мигрируют.
