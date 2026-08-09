# ТЗ #7 — Valetudo: комнаты из outline-полигонов

- Issue: https://github.com/Matysh/houseplan-card/issues/7
- Приоритет: P1
- Статус ТЗ: реализовано по rev.7 с прямым owner override F6; целевой gate v1.61.0-beta.1 пройден, ожидается публикация
- Родительский контракт: `docs/superpowers/specs/2026-08-09-vacuum-integration-coverage-design.md`, §4.2

## Цель

Использовать комнаты MQTT Vacuum Camera/Valetudo вида
`{id: {name, outline: [[x,y], ...]}}` для ghost-предпросмотра и
автокалибровки по названиям.

## Геометрический контракт

1. Приоритет якоря: атомарная пара `cx/cy` → `center.x/center.y` → `x/y` →
   area centroid валидного outline → центр полного bbox `x0/y0/x1/y1`.
2. Поля разных уровней никогда не смешиваются в одну пару.
3. Центроид outline считается формулой shoelace. Повторённая замыкающая точка
   удаляется перед вычислением.
4. Для нулевой площади используется детерминированное среднее валидных вершин;
   нечисловая вершина делает outline непригодным.
5. Bbox вычисляется по вершинам или берётся из полной атомарной четвёрки
   `x0/y0/x1/y1`; перепутанные min/max нормализуются.
6. По решению владельца после code-review F6 bbox-center возвращён последним
   compatibility fallback. Он не должен побеждать ни явный центр, ни
   area-centroid outline, но bbox-only комнаты больше не пропускаются.
7. Plan-side якорь считается тем же `areaCentroid()` по реальному room polygon,
   включая legacy rectangle через `roomPoly()`.

## UX и деградация

- Автокалибровка доступна только при минимум трёх совпавших пригодных именах.
- Диагностика показывает общее число robot rooms и число совпавших имён.
- Непригодный outline не ломает остальные комнаты и не создаёт координаты 0/0.
- High residual свыше 40 см остаётся предложением до явного подтверждения.

## Проверки

- L-образный polygon доказывает отличие area centroid от vertex average;
- clockwise/counter-clockwise, закрытый/незакрытый, zero-area, butterfly;
- атомарный приоритет пар и bbox-only fallback с нормализацией min/max;
- browser: Valetudo ghost, matching names и confirm-flow high residual.

## Приёмка

- outline-only Valetudo rooms участвуют в fit и auto-calibration;
- bbox-only комнаты сохраняют ghost и могут участвовать в auto-calibration;
- форма ghost и bbox конечны;
- плохая комната не блокирует хорошие;
- конфиг не меняется до подтверждения грубой калибровки.
