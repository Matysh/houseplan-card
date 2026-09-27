# ТЗ #8 — Матрица поддержки пылесосов и подсказка XCME

- Issue: https://github.com/Matysh/houseplan-card/issues/8
- Приоритет: P1
- Статус ТЗ: реализовано по HP-VAC-02 rev.7; целевой gate v1.61.0-beta.1 пройден, ожидается публикация
- Родительский контракт: HP-VAC-02 §5.1 и §5.3

## Цель

Пользователь должен до настройки понимать фактическое покрытие интеграции, а
при найденной Xiaomi Cloud Map Extractor без нужных атрибутов — видеть точную
инструкцию вместо общего «источник не найден».

## Документация

В `docs/VACUUM.md`, пользовательском руководстве и обзорном README должна быть
одна непротиворечивая матрица:

| Семейство | Position | Rooms/auto-fit | Integration path | Map id | Discovery |
|---|---|---|---|---|---|
| XCME | при включённых attributes | да | да, включая subpaths | `map_name` при наличии | явный picker допустим |
| Dreame/Mova | да | да, `x/y` anchor | нет в Stage 1 | `selected_map` fallback | same-device |
| Valetudo camera | да | при outline rooms | нет в Stage 1 | обычно `default` | same-device |
| Roomba string pose | Stage 2 | нет room fit | нет | — | Stage 2 |

## Диагностика и подсказка

1. Диалог показывает source, integration/platform, статус, position, rooms,
   совпадения имён, path и map id.
2. Registry-confirmed same-device XCME с отсутствующей position показывает
   hint независимо от того, выбран ли этот source.
3. Явно выбранная camera без position также показывает hint.
4. Глобальная невыбранная camera не должна случайно активировать подсказку для
   другого устройства.
5. Hint содержит готовый YAML-фрагмент `vacuum_position`, `rooms`, `path`,
   `map_name` и ссылку на документацию.
6. Documentation action видим при любом source status, включая missing.

## Локализация и доступность

- Весь текст ru/en; YAML не переводится.
- Hint имеет текстовый заголовок, код можно выделить, ссылка открывается в новой
  вкладке с `noopener`.
- Capability не сообщается только цветом.

## Приёмка

- новый пользователь XCME получает конкретный путь исправления;
- матрица не обещает неподдерживаемый path;
- диагностика и реальная доступность auto-calibration используют один matcher;
- ссылки и термины одинаковы в README/User Guide/VACUUM.
