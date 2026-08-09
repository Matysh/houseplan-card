# ТЗ #34 — Поэтапная декомпозиция frontend

- Issue: https://github.com/Matysh/houseplan-card/issues/34
- Приоритет: P1
- Статус ТЗ: выполняется по slices
- Тип изменения: refactor-only, без пользовательского поведения

## Исходное состояние и цель

`src/houseplan-card.ts` сейчас около 14,9 тыс. строк, `styles.ts` — около 2,8
тыс. Корневой Lit-компонент должен стать composition/lifecycle shell, целевой
ориентир — менее 3500 строк после серии independently releasable slices.

## Правила slice

1. Один PR/этап переносит одну законченную ответственность вместе с types,
   pure tests и owned styles.
2. Внешний DOM, i18n keys, stored payload, command names, pointer thresholds и
   render order не меняются.
3. Существующие geometry/device/sun/vacuum pure modules остаются authority;
   вторая модель запрещена.
4. Новый product code использует `unknown` + guards; `any` допустим только в
   явно названном HA adapter boundary.
5. До/после slice проходит одинаковый test/golden/performance set.

## Целевая структура

- `app/`: card composition, normalized store, navigation/viewport;
- `editors/{plan,devices,decor}`: typed state machines и commands;
- `render/`: immutable projections для rooms/walls/openings/lighting/devices/vacuum;
- `dialogs/`: draft models, validation, serialization, render components;
- `components/`: общие dialog/confirm/color/tray primitives.

## Порядок

### Slice 1 — малые dialog models

Вынести partition/column property draft: `fromConfig`, validation,
`toPatch`, equality. Root сохраняет callbacks и geometry commands.

### Slice 2 — render-only layers

По одному: room shapes/hover, wall body, lighting, device overlay, vacuum.
Input — frozen projection; output — template + typed callbacks без store access.

### Slice 3 — крупные dialog models

Room/opening → space → device/settings. Не смешивать с IA #30.

### Slice 4 — editor controllers

Plan, Devices, Decor pointer/keyboard state machines; command stack остаётся
общим интерфейсом.

### Slice 5 — store/navigation/styles

Revision/conflict/save orchestration, warm viewport, затем scoped styles.

## Метрики и gate

- root lines и доля TS монотонно уменьшаются;
- feature module обычно <800 строк, исключение документируется;
- `any` count не растёт;
- circular import check, bundle size/perf budgets;
- no-op config roundtrip, complete smoke и reviewed golden без delta.

## Приёмка

Каждый slice может быть отдельно reverted/released, не содержит feature work и
имеет architectural note. Финал достигает целевой роли root и удаляет
временные compatibility adapters.
