# Диагностика #1327 — 2026-11-06

Продукт: v1.84.0 / 626c645948d2f9ecab458b410497641fd3487c69.
Продуктовые исходники и пользовательская HA-инсталляция не изменялись.

## Материалы

- minimal-config.json — минимальный обезличенный случай: две комнаты, перегородка, 6 узлов и 8 рёбер. Точные исходные координаты/ID/толщины сохранены. Без устройств, entity_id, layout, декора и других пространств. Полный пользовательский экспорт не публикуется.
- reported.png — исходный скриншот пользователя с двумя отмеченными стыками.
- card.png — настоящий houseplan-card в локальном Chromium: минимальная геометрия, без имён и устройств, статичный тёмный фон. Не live HA/E2E.
- geometry.png — изолированная SVG-визуализация production directWallGeometry: белая paperGeom и штрихованная geom. Это иллюстрация расчёта, не golden.
- witnesses.json — две точки внутри paperGeom, вне видимой geom и room-centre полигонов; exact-predicate contains.
- probe.mjs / witness.mjs / card.mjs — воспроизведение на подготовленном v1.84.0 с существующими test-build, demo bundle и Chromium.

## Повторение

Разместить материалы в artifacts/corner-20261106/ рабочего каталога v1.84.0 с подготовленными зависимостями/сборками:

```sh
node artifacts/corner-20261106/probe.mjs
node artifacts/corner-20261106/witness.mjs
node artifacts/corner-20261106/card.mjs
```

Результат: builder status ok, source plan_graph unchanged. Для обеих точек paperContains true, masonryContains false, centreRoomsContain false. После удаления только partition-4fada5bd-e743-466d-8239-2447101588cb из диагностической копии paperGeom не меняется, а masonryContains становится true в обеих точках. Это room-only paper / full-incidence masonry mismatch, не ошибка arrangement и не SVG antialiasing. Исходный полный экспорт и минимальный случай воспроизведены отдельно с тем же результатом.

Первый дефектный коммит не устанавливался. direct-wall-geometry.ts в v1.84.0 и проверенном dev 0c7e8838681f68d5d908d9d6e76f8b1d874b58cf совпадает.

Локально сохранён исходный экспорт houseplan-space-Test2-2026-11-06_02-55-46.json (SHA256 0a66caba1ef741a9ccfa0e9b4e4ceb43e45e521bcf77be66973f48c92910de46). Исходный скриншот SHA256 c33ffaa8dd5c25d38e1e2165cabfd15f16ccf77f36c3a25e4836734f61ea4238.

Исследование не изменяло продукт, тесты, golden-baseline или рабочую установку HA. Диагностические скрипты не являются готовыми регрессионными тестами продукта.
