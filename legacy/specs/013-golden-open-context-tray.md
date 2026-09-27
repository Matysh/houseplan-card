# ТЗ #13 — Golden-сценарии открытой context tray

- Issue: https://github.com/Matysh/houseplan-card/issues/13
- Приоритет: P2
- Статус ТЗ: реализовано и проверено в v1.60.3; retrospective acceptance contract

## Цель

Pixel-regression gate должен видеть tray в materially different состояниях, а
не только пустую toolbar или случайно перекрытый color popover.

## Нормативная матрица

`demo/golden/matrix.mjs` содержит детерминированные page captures:

| Width | Language | Editor/state |
|---|---|---|
| wide 1180 | EN | Plan selection actions |
| wide 1180 | RU | Plan tool parameters |
| medium 760 | EN | Toolbar group submenu |
| medium 760 | RU | Decor selection actions |
| narrow 390 | EN | Furniture palette |
| narrow 390 | RU | Decor tool parameters |

Совокупность покрывает оба языка и все три adaptive width, не требуя
декартова произведения из 12 почти одинаковых кадров.

## Fixture и capture contract

- `editorTray` — declarative scenario input, harness не кликает по координатам;
- fixture выбирает реальный объект/tool и дожидается stable animation state;
- capture = page, чтобы видеть primary toolbar, overlay tray и рабочую область;
- caret/animations/fonts/theme/viewport фиксированы общей HP-QA-01 policy;
- любое неизвестное tray id или невозможность открыть нужную модель — hard fail.

## Приёмка

- все шесть кадров присутствуют в matrix manifest и reviewed Linux baseline;
- narrow tray не меняет высоту workspace/primary toolbar;
- RU/EN labels не обрезают actions и close-editor остаётся на месте;
- `golden:capture/verify/accept --reviewed` соблюдают freshness и complete-set gate.
