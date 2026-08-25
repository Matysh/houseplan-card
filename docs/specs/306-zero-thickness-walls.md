# #306 — Нулевые стены вместо виртуальных границ

- **Issue:** [#306](https://github.com/Matysh/houseplan-card/issues/306)
- **Статус документа:** готово к независимому ревью ТЗ
- **Приоритет / тип:** P1 / feature
- **Целевая версия модели:** `PLAN_MODEL_VERSION = 8`
- **Пользовательское изменение:** да

## 1. Цель

Убрать из продукта отдельный инструмент **«Граница»** и канонические сущности
`space.open_spans` / `rooms[].open_to`. Их роль выполняют обычные атомарные
отрезки стен с явным `cm: 0`.

В редакторе остаётся одна модель:

- `cm > 0` — стена с физическим телом;
- `cm = 0` — топологическая стена без физического тела;
- отсутствие записи `walls[]` в старом разреженном формате — legacy-физическая
  осевая стена, а **не** нулевая стена.

Пользователь рисует и изменяет оба вида инструментами **«Стены»** и
**«Толщина»**. Настройка пространства определяет, показываются ли все нулевые
стены пунктиром или сплошной линией и пропускают ли они свет.

## 2. Зафиксированные продуктовые решения

1. Кнопка, сессия и термин **«Граница»** удаляются из UI.
2. Толщина обычной стены и перегородки принимает `0..100 см`; колонны сохраняют
   диапазон `1..150 см`.
3. `0` — сохранённое значение, не пустое поле и не команда удаления записи.
4. Стиль нулевых стен задаётся один раз на пространство:

   | Значение | Вид | Glow | Солнечные лучи | Общая граница комнат |
   |---|---|---|---|---|
   | `dashed` | пунктир | проходит | проходят | соединяет световые зоны |
   | `solid` | сплошная линия | блокируется | блокируются | не соединяет световые зоны |

5. Отсутствующее/неизвестное значение настройки читается как `dashed`.
6. Нулевая стена в обоих режимах остаётся частью топологии, но не создаёт
   физическое тело, бумагу, тоннель проёма и вычет площади.
7. Новый проём на нулевой стене запрещён. Перевод участка с проёмом в `0`
   отклоняется до записи; проём автоматически не удаляется и не деактивируется.
8. Legacy `open_spans`, а при их отсутствии legacy `open_to`, мигрируют lossless
   в явные атомы `cm: 0`. Простое чтение конфигурации ничего не записывает.
9. После канонической записи старые поля больше не пишутся. Downgrade на версию,
   не понимающую `cm:0`, не поддерживается; восстановление выполняется из backup.
10. Plan editor остаётся desktop-first. View и kiosk на touch входят в
    блокирующий acceptance floor.

Открытых продуктовых вопросов нет.

## 3. Термины и инварианты

### 3.1 Атом стены

Атом — максимальный коллинеарный интервал с одними и теми же:

- координатами носителя;
- ролью `outer(room)`, `shared(roomA,roomB)` либо `independent(id)`;
- множеством владельцев;
- толщиной `cm`;
- границами, заданными узлами, концами существующих записей и проёмов.

Слияние соседних атомов разрешено только при полном совпадении роли, владельцев,
носителя и `cm`. Нельзя сливать `outer(A)` с `shared(A,B)`, разные пары shared,
room-wall с independent wall или пересекать узел/проём.

### 3.2 Три состояния разреженного room-wall слоя

Пока не реализована целевая объектная модель #282, `space.walls[]` остаётся
разреженным слоем поверх осей комнат:

- явная запись `cm: 1..100` — положительная толщина;
- явная запись `cm: 0` — нулевая стена;
- нет записи на интервале — legacy-физическая ось без толстого тела.

Любой resolver обязан проверять **наличие явного атома**, а не подставлять `0`
из-за отсутствия записи. Функции физического тела фильтруют `cm > 0`; функции
топологии и редактора сохраняют и видят `cm = 0`.

Для независимых стен те же значения хранятся в `partitions[].cm` и
`room_drafts[].segments[].cm`. При замыкании draft его нулевые сегменты
переносятся в явные `walls[]` атомы созданной комнаты.

### 3.3 Единый resolver

Новый pure-модуль `src/zero-walls.ts` (имя можно уточнить без изменения
контракта) является единственной точкой для:

- `resolveZeroWallMode(space): { style, transmitsLight }`;
- проекции legacy `open_spans/open_to` в runtime-атомы;
- классификации явных нулевых атомов по роли;
- получения линий световых барьеров и derived room connectivity;
- миграции runtime-проекции в канонический persisted candidate.

Glow и солнце не имеют собственных проверок `dashed/solid`. Оба используют
результат этого resolver. Визуальный renderer получает тот же `style`, но не
определяет световое поведение через CSS.

## 4. Persisted schema

### 4.1 Новое поле пространства

```ts
type ZeroWallStyle = 'dashed' | 'solid';

interface SpaceConfig {
  zero_wall_style?: ZeroWallStyle; // missing/unknown read fallback = dashed
  walls?: Array<{ key: string; cm: number; a?: number[]; b?: number[] }>;
  room_drafts?: Array<{ segments: Array<{ cm: number }> }>;
  partitions?: Array<{ id: string; a: number[]; b: number[]; cm: number }>;
}
```

Backend принимает `cm: 0..100` для `walls[]`, `room_drafts[].segments[]` и
`partitions[]`; `wall_columns[].cm` остаётся `1..150`. Новые/переписанные room
wall records обязаны иметь точные `a/b`; key-only `cm:0` новая версия не пишет.

`PLAN_MODEL_VERSION` повышается с `7` до `8` только при фактической канонической
записи хотя бы одного затронутого пространства. Открытие карточки и
неструктурные изменения версию не повышают.

### 4.2 Deprecated compatibility fields

`space.open_spans` и `rooms[].open_to`:

- временно принимаются backend/import reader для старых документов;
- сохраняются без мутации при read-only загрузке;
- проецируются в runtime как `cm:0` при fallback `dashed`;
- удаляются из затронутого пространства одной транзакцией после успешной
  канонической миграции;
- никогда не создаются новым frontend;
- в экспорте канонического v8 отсутствуют;
- добавляются в `docs/CONFIG-COMPATIBILITY.md` как
  `deprecated-read / project-in-memory / migrate-on-structural-write`.

Если одновременно есть валидные `open_spans` и `open_to`, источником геометрии
являются `open_spans`; `open_to` не расширяет их. Если `open_spans` отсутствует
или пуст, `open_to` материализует полный доказанный общий интервал каждой пары.

Unknown sibling-поля сохраняются на read/write как сейчас.

## 5. UX редактора

### 5.1 Основная панель

- Кнопка **«Граница»**, её submenu/context tray, подсказки и состояния удаляются.
- Поле толщины у **«Стен»** принимает локализованный эквивалент `0..100 см`.
- Пустое, `NaN`, отрицательное или больше максимума значение блокирует начало
  сегмента и показывает существующий range-feedback с новым диапазоном.
- `0` рисует обычный сегмент текущей wall/draft/partition цепочки. Замыкание
  комнаты, Ctrl+click и Shift 45° работают без отдельной ветки.
- Pointer cancel, pinch и уход из редактора не записывают незавершённый нулевой
  сегмент.

### 5.2 Инструмент «Толщина»

- Диалог/поле принимает `0..100 см` для room wall, draft и partition.
- `positive → 0` атомизирует только выбранный доказанный интервал и сохраняет
  толщину соседних остатков.
- `0 → positive` восстанавливает физическое тело обычным путём.
- Пустое поле не означает `0`: Save неактивен/операция отклонена.
- Если выбранный интервал пересекает размещённый проём, `positive → 0`
  атомарно отклоняется с сообщением удалить проём прежде. Остальной план не
  меняется.

### 5.3 Рисование по существующей оси

Рисование `cm:0` поверх доказанного участка room wall изменяет/атомизирует этот
участок. Оно не создаёт совпадающую `partition`. Повторное рисование того же
интервала — semantic no-op и не добавляет Undo-команду.

На совпадающей independent partition меняется существующий объект только если
есть ровно один однозначный carrier. T/X-узел, несколько carrier или конфликт
ролей отклоняются до write с локализованным сообщением. Частичный кандидат не
сохраняется.

### 5.4 Настройки пространства

В секции отображения стен добавляется radio/select:

- заголовок RU: **«Стены нулевой толщины»**;
- варианты RU: **«Пунктирные»**, **«Сплошные»**;
- видимое пояснение RU: **«Пунктирные стены пропускают свет. Сплошные стены
  блокируют свет, даже при нулевой толщине.»**;
- эквивалентные EN-строки перечислены в §13.

Изменение применяется сразу ко всем нулевым стенам пространства одной config
транзакцией, поддерживает обычную отмену несохранённого диалога и не переписывает
геометрию.

## 6. Геометрия и операции

### 6.1 Физическое тело, площадь и пол

- `cm:0` никогда не передаётся в wall-body union как полигон и не заменяется
  внутренним epsilon/`1 см`.
- Чистая площадь комнаты и inset floor игнорируют его физическую толщину, но
  продолжают использовать ось как контур комнаты.
- Independent `cm:0` не создаёт бумагу/пол и не вычитает площадь.
- Замкнутая цепочка independent нулевых стен не создаёт комнату сама по себе;
  комната возникает только через существующий flow предложения комнаты.

### 6.2 Проёмы

- Picker/placement не предлагает нулевой wall interval как host.
- Изменение host wall в `0` запрещено, пока любой door/window/gate/passage
  пересекает целевой атом.
- У нулевой стены нет tunnel fill, откосов и opening cut.
- Legacy-конфликт `open_span/open_to` с проёмом блокирует миграцию всего
  пространства. Runtime остаётся читаемым по legacy projection; Optimize и
  структурная запись показывают конкретный blocker и не удаляют проём.

### 6.3 Split, Merge, Delete, Resize

- Split переносит `cm:0` на соответствующий новый room-wall atom без подстановки
  fallback thickness.
- Merge удаляет только доказанно внутренние дубли; нулевые атомы внешнего
  контура и независимые нулевые стены сохраняются.
- Delete room с сохранением стен не превращает `cm:0` в partition с положительной
  толщиной. Нулевой exclusive interval либо сохраняется как `partition cm:0`,
  если пользователь выбрал сохранить стены, либо удаляется вместе с комнатой.
- Resize меняет координаты carrier, но сохраняет `cm:0`, роль и breakpoints;
  примкнувшие independent стены по прежнему автоматически не двигаются.
- Каждая геометрическая операция остаётся одной именованной geometry-history
  командой. Undo/Redo восстанавливает одновременно геометрию, `cm` и legacy-поля,
  если миграция входила в эту транзакцию. `zero_wall_style` следует текущему
  контракту Save/Cancel настроек пространства и не добавляется в geometry stack.

### 6.4 Нормализация и Optimize

- Общий `normalizeWallIntervals()` сохраняет явные нули и объединяет только
  role-equivalent соседние атомы.
- Ни один helper не должен применять `clampWallCm(0) → 1`.
- Optimize preview отдельно считает `legacy virtual spans migrated` и
  `zero-wall atoms merged`.
- После Confirm все пространства мигрируют атомарно; ошибка/лимит в одном
  пространстве отменяет весь candidate и оставляет one-deep Optimize Undo.
- Повторный Optimize канонического v8 — byte/semantic no-op.

## 7. Свет и отображение

### 7.1 Свет

Для `dashed` нулевые сегменты исключаются из Glow/sun barriers. Shared нулевой
атом добавляет пару комнат в derived light connectivity. Для `solid` тот же
сегмент добавляется как **осевая line barrier без площади**, а shared atom не
соединяет комнаты.

Допустим вычислительный epsilon только внутри line-intersection predicate для
численной устойчивости. Он не попадает в wall body, floor, area, renderer,
opening depth или persisted data и не зависит от `cell_cm` как фиктивная
физическая толщина.

Смена `zero_wall_style` инвалидирует room connectivity, light regions, Glow
barriers, sun barriers, wall/render fingerprints и isometric cache. Она не
зависит от HA state ticks и не требует reload.

Outer и independent `cm:0` следуют тому же правилу barrier: dashed не блокирует,
solid блокирует пересечение луча. Нулевая outer wall сама не создаёт источник
солнечного света — источник по-прежнему возникает только из валидного окна.

### 7.2 Flat, isometric и редакторы

- Flat View, kiosk, isometric View и визуальный export используют выбранный
  solid/dashed стиль.
- Нулевая стена рисуется одной line primitive на оси, без hatch/body/end cap.
- При `show_borders:false` нулевые стены скрыты в View/kiosk, но их выбранная
  световая семантика сохраняется. Редакторы продолжают показывать их.
- Plan editor показывает служебные оси и узлы единым overlay во всех режимах;
  overlay не зависит от solid/dashed.
- Decor editor применяет к нулевым стенам ту же контекстную прозрачность, что к
  остальной планировке.
- Hover/hit target остаётся доступным минимумом текущего wall editor и не
  ограничивается визуальной толщиной линии.

## 8. Алгоритм миграции v7 → v8

Миграция pure, deterministic, idempotent и возвращает либо полный candidate,
либо typed blocker.

1. Валидировать rooms, walls, openings, limits и координаты без изменения input.
2. Если есть валидные `open_spans`, использовать их. Иначе построить полные
   shared intervals по `open_to` через существующий `sharedBoundary` resolver.
3. Нормализовать и clip spans строго к доказанным room-wall carriers. Висящий,
   неоднозначный или non-finite span — blocker, не silently drop.
4. Собрать breakpoints из концов carrier, legacy spans, положительных wall
   records, room ownership/role changes, nodes и opening intervals.
5. Разрезать carrier на атомы. Интервал, покрытый legacy span, получает явную
   запись `cm:0`; положительный остаток сохраняет точный `cm`; legacy-физический
   остаток без записи остаётся отсутствующей записью.
6. Проверить конфликт проёмов. Любое пересечение мигрируемого нулевого атома с
   opening host — blocker всего пространства.
7. Role-aware merge объединяет только эквивалентные соседние нулевые атомы.
8. Удалить `space.open_spans` и `rooms[].open_to` только из готового candidate.
   Если новое поле отсутствует, оставить его отсутствующим: read fallback
   `dashed` уже сохраняет поведение.
9. Прогнать geometry preflight и backend schema. При превышении 500 `walls[]`
   или любого лимита отказать целиком; усечение запрещено.
10. При записи установить `model_version: 8`. Повторный запуск возвращает no-op.

### 8.1 Когда выполняется write

- Read adapter всегда строит runtime projection без persistence.
- Структурная транзакция конкретного пространства (изменение rooms, walls,
  drafts, partitions, openings, Split/Merge/Delete/Resize/Thickness/Draw)
  сначала мигрирует это пространство и пишет всё одной транзакцией.
- Сохранение marker/layout, HA state, настроек устройства, названия/заливки
  пространства и простое открытие карточки не запускают migration write.
- **«Оптимизировать планы»** строит preview и мигрирует все legacy-пространства
  одной подтверждённой транзакцией.
- Full/space import старого документа проецирует и валидирует migration в
  preview; Apply сохраняет canonical v8 candidate либо отказывает целиком.

### 8.2 Масштаб и round-trip

Координаты переносимых `a/b` проходят существующий lattice write barrier.
Space-only import с другим `cell_cm` сохраняет нормализованную геометрию и
сантиметровый `cm:0` без масштабирования значения. Full export/import и
config/layout round-trip не восстанавливают deprecated fields.

## 9. Backend, import/export и concurrency

- `custom_components/houseplan/validation.py` принимает новый enum и `cm:0`, но
  различает новый explicit zero и отсутствие record.
- Validation запрещает key-only zero on new write, zero opening host и
  non-finite/negative cm; legacy document допускается только через compatibility
  read/import path.
- `import_export.py` включает `zero_wall_style`, умеет preview старой миграции и
  выдаёт локализуемый/машиночитаемый blocker code.
- Config revision/CAS и атомарная config+layout запись остаются обязательными;
  конфликт ревизии не повторяет migration поверх устаревшего candidate.
- Permissions, HA service calls, entity registry и security boundary не
  меняются. Новые данные не исполняются и проходят существующие bounds.

## 10. Совместимость и откат

### 10.1 Forward compatibility

Старые конфигурации отображаются прежним пунктиром и пропускают свет до любой
записи. Миграция не изменяет area, positive wall thickness, openings или
координаты. Backend сохраняет compatibility-reader минимум весь релизный цикл
v1.68.x; удаление reader требует отдельного issue и данных telemetry/fixtures.

### 10.2 Downgrade / rollback

Старая версия клиента не понимает explicit `cm:0`, поэтому downgrade после
canonical write не поддерживается. До первой структурной записи пользователь
может сделать полный backup. После Optimize доступен существующий one-deep Undo
в текущей сессии; надёжный откат между версиями — импорт backup.

Релизный rollback до первой beta выполняется revert коммита. После beta нельзя
возвращать старую schema в stable; исправление выпускается forward-only с
сохранением v8 reader. Labs-флаг не используется: две одновременно пишущие
модели создадут больший риск, чем feature flag способен снять.

## 11. Производительность

- Migration/atomization выполняется только на structural write/Optimize/import,
  не на HA state tick и не на каждом render.
- Runtime projection, wall-role index, light barriers и render geometry
  fingerprint/cache включают `space id + geometry revision + zero_wall_style`.
- Смена HA state не пересобирает wall atoms, connectivity или sun barriers.
- Лимит записей остаётся 500; результат не truncates.
- Benchmark на large-house fixture сравнивает v7 projection и v8 canonical:
  p95 построения barrier/first render не должен регрессировать более чем на 10%,
  steady HA-state render — более чем на 5% относительно baseline ветки.
- Нулевые line barriers не превращаются в полигоны, что ограничивает рост
  polyclip input.

## 12. Touch и accessibility

- View/kiosk: нулевые стены, свет и `show_borders` обязаны совпадать с desktop;
  pinch/tap не оставляет sticky hover и не меняет стену.
- Plan editor на touch — best effort / intentionally degraded по
  `docs/TOUCH-SUPPORT.md`, но cancel/pinch/scroll не имеют права совершить write.
- Select/radio настройки имеет label, keyboard focus и видимое пояснение;
  ошибка проёма/неоднозначности доступна через существующий status/toast flow.
- Контраст dashed/solid использует текущие wall tokens; смысл не кодируется
  только цветом.
- `prefers-reduced-motion` не требует отдельного поведения: новая фича не
  добавляет animation.

## 13. i18n

Добавляются симметрично в `src/i18n/ru.json` и `src/i18n/en.json`:

| Key | RU | EN |
|---|---|---|
| `space.zero_wall_style` | Стены нулевой толщины | Zero-thickness walls |
| `space.zero_wall_dashed` | Пунктирные | Dashed |
| `space.zero_wall_solid` | Сплошные | Solid |
| `space.zero_wall_help` | Пунктирные стены пропускают свет. Сплошные стены блокируют свет, даже при нулевой толщине. | Dashed walls let light through. Solid walls block light even at zero thickness. |
| `toast.zero_wall_opening_conflict` | Сначала удалите проём на этом участке стены. | Remove the opening on this wall segment first. |
| `toast.zero_wall_ambiguous` | Не удалось однозначно выбрать участок стены. Уточните геометрию узла. | The wall segment is ambiguous. Simplify or adjust the junction. |
| `toast.zero_wall_migration_blocked` | Пространство не преобразовано: {reason}. Данные не изменены. | The space was not converted: {reason}. No data was changed. |
| `gs.zero_walls_migrated` | Преобразовано виртуальных участков: {n}. | Virtual wall spans converted: {n}. |

Существующие `boundary.*`, `toast.boundary_*` и подписи инструмента удаляются
только после проверки отсутствия consumers. Compatibility import error codes
локализуются UI, backend возвращает стабильный machine code без текста интерфейса.

## 14. Затронутые модули

Обязательный минимум; точное разбиение большого `houseplan-card.ts` допускается
без изменения контракта:

- `src/zero-walls.ts` — новый canonical resolver/migration;
- `src/types.ts`, `src/space-geometry.ts`, `src/logic.ts` — schema/runtime model;
- `src/wall-thickness.ts`, `src/physical-geometry.ts`, `src/wall-face-graph.ts`,
  `src/wall-merge.ts` — explicit zero, role-aware normalization, no body;
- `src/open-spans.ts` — оставить compatibility adapter либо заменить им; новый
  production write не импортирует legacy mutators;
- `src/houseplan-card.ts` — убрать Boundary UX/session; Draw/Thickness/settings,
  render, Undo, Split/Merge/Delete/Resize, cache invalidation;
- `src/light-visibility.ts`, `src/sun.ts`, `src/iso-walls.ts` — единый light mode
  и visual parity;
- `src/plan-optimizer.ts`, `src/plan-geometry-preflight.ts`,
  `src/coordinate-canonicalization.ts` — migration v8, limits/idempotence;
- `custom_components/houseplan/const.py`, `validation.py`, `import_export.py`,
  `coordinate_canonicalization.py` — model version, schema и import/export;
- `src/i18n/en.json`, `src/i18n/ru.json`;
- `docs/WALL-THICKNESS.md`, `docs/LIGHT.md`, `docs/USER-GUIDE.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`, оба
  changelog;
- unit/backend/smoke/golden/performance fixtures из §15.

Противоречащие актуальные ТЗ #148 и #173 получают короткую superseded-note со
ссылкой на #306; история их acceptance contract не переписывается задним числом.

## 15. Acceptance criteria и доказательства

### AC1. Один пользовательский инструмент

В Plan editor нет кнопки/режима/подсказок «Граница». «Стены» принимают 0 и
создают нулевой room wall, draft или partition тем же pointer/keyboard flow.

**Доказательство:** source-contract unit + `demo/smoke_zero_walls.mjs` desktop;
golden основной панели до/после.

### AC2. Толщина переключается в обе стороны без побочного изменения

Для цепочки `15 → 0 → 20` инструмент «Толщина» переводит только выбранный атом
`0 ↔ positive`; соседи, ownership, coordinates и room topology неизменны.
Пустое поле не записывает ноль.

**Доказательство:** table-driven unit `test/wall-thickness.test.mjs` и smoke с
Undo/Redo.

### AC3. Отсутствующая запись не становится нулевой

Legacy room edge без `walls[]` record остаётся физической осевой стеной и не
получает dashed/open semantics. Только explicit `cm:0` является нулевой стеной.

**Доказательство:** migration unit + backend round-trip regression на v7 fixture.

### AC4. Физическая геометрия и площадь не получают тело

Shared, outer и independent `cm:0` дают нулевой wall-body contribution,
не меняют чистую площадь и не создают paper/hatch/tunnel. Положительные соседи
сохраняют точные mitre/end geometry.

**Доказательство:** `test/physical-geometry.test.mjs`, area unit и golden flat +
isometric на смешанной цепочке.

### AC5. Пунктир пропускает оба вида света

В `dashed` Glow и солнечный луч проходят shared/outer/independent zero line;
shared atom соединяет room light zones. Положительные стены продолжают блокировать.

**Доказательство:** unit light matrix (`test/light-visibility.test.mjs`,
`test/sun.test.mjs`) + deterministic Glow/sun golden.

### AC6. Сплошная нулевая стена блокирует оба вида света без фиктивного тела

В `solid` та же ось блокирует Glow и солнечные лучи и не соединяет комнаты, но
area/wall body остаются идентичны dashed-варианту.

**Доказательство:** shared fixture matrix и assertions, что physical geometry и
area byte/number equal между стилями; golden solid.

### AC7. Смена настройки работает без reload

Переключение `dashed ↔ solid` сразу меняет line style, Glow, sun и connectivity;
старые barrier/render caches не используются, координаты и `walls[]` не меняются.

**Доказательство:** unit fingerprint/cache test + browser smoke в одном session.

### AC8. Миграция `open_spans` lossless и idempotent

Полный/частичный/соседний span, разные positive residues и shared/outer role
преобразуются в exact `cm:0` atoms; deprecated fields удаляются только в
candidate, model становится v8. Второй запуск no-op.

**Доказательство:** `test/zero-wall-migration.test.mjs` fixture matrix и snapshot
до/после/после второго запуска.

### AC9. Legacy `open_to` fallback мигрирует только доказанную общую границу

При отсутствии `open_spans` симметричная или односторонняя legacy link создаёт
полный shared zero interval. При наличии spans link их не расширяет. Missing or
ambiguous room id блокирует write без partial result.

**Доказательство:** migration unit на winding/order/id variants.

### AC10. Проёмы защищены от потери

Новый проём нельзя разместить на zero atom. Positive→zero и legacy migration с
пересекающимся opening отклоняются атомарно, сохраняют opening и исходные стены.

**Доказательство:** `test/opening-placement.test.mjs`, backend validation и browser
smoke с RU/EN error lookup.

### AC11. Операции геометрии сохраняют ноль и роль

Split, Merge, Delete (оба варианта), Resize, room creation, повторное рисование,
T/X junction, совпадающая partition, Undo/Redo не clamp'ят zero и не создают
duplicate carrier/mixed-role record.

**Доказательство:** pure matrix в wall/resize/room-deletion tests +
`demo/smoke_edit_walk.mjs` deterministic seeds; ambiguous overlap asserts no write.

### AC12. Read-only загрузка ничего не мигрирует

Открытие View, HA state update, marker/layout save и изменение неструктурной
настройки не вызывают config write/model bump. Первая geometry write конкретного
space мигрирует его в той же CAS transaction.

**Доказательство:** mutation-gate unit + browser websocket call log.

### AC13. Optimize и import/export атомарны

Optimize preview показывает counts и мигрирует все spaces после Confirm; one-deep
Undo возвращает v7 data в сессии. Full/space v7 import создаёт v8 candidate.
Лимит 500, invalid span, opening conflict или revision conflict отклоняет весь
candidate без truncation/partial apply.

**Доказательство:** optimizer unit, `tests_backend/test_ha_import_export.py`,
`tests_backend/test_validation.py`, browser backup transfer smoke.

### AC14. View/isometric/editor/export parity

Один и тот же style виден в flat, isometric, Plan/Decor contexts и visual export.
`show_borders:false` скрывает линию в View/kiosk, но не меняет выбранную световую
семантику; Plan axes/nodes видны во всех режимах редактора.

**Доказательство:** golden matrix desktop + narrow viewport; source assertions и
smoke `show_borders`.

### AC15. Backend и compatibility registry согласованы

Backend принимает canonical v8 `cm:0` с exact endpoints, отклоняет negative,
non-finite, key-only zero и zero opening host. Старый v7 документ читается.
`docs/CONFIG-COMPATIBILITY.md` описывает оба deprecated поля и downgrade.

**Доказательство:** backend parameterized tests + docs review.

### AC16. Touch safety floor

На touch View/kiosk линия и свет совпадают с desktop. Pinch/cancel в Plan editor
не записывает нулевой сегмент и не оставляет активную command session.

**Доказательство:** Playwright touch smoke; ручное редактирование сверх этого —
best effort и не блокирует.

### AC17. Производительность и кэши

Large-house v7 projection/v8 canonical проходят бюджеты §11; HA state tick не
запускает atomization/barrier rebuild; style toggle запускает ровно одну
инвалидацию требуемых geometry/light caches.

**Доказательство:** benchmark artefact JSON + source-fingerprint unit.

### AC18. Документация и релизные артефакты

RU/EN UI, changelog и user docs описывают одну систему стен, новый диапазон,
стиль/свет и backup перед migration. ТЗ #148/#173 помечены superseded в части
Boundary. Bundle-копии синхронны.

**Доказательство:** i18n/docs/bundle tests и ревью артефактов.

## 16. Обязательные проверки реализации

Минимальный implementation gate до code review:

```text
npm run typecheck
npm test
npm run build
uv run pytest tests_backend/test_validation.py tests_backend/test_ha_import_export.py
```

Code-review/release gate дополнительно выполняет:

- `demo/smoke_zero_walls.mjs` desktop + touch safety;
- Glow и sun deterministic golden matrix;
- flat/isometric/show_borders golden review;
- large-house performance capture с бюджетами §11;
- полный импорт v7 full/space fixtures и v8 round-trip;
- сверку `dist/houseplan-card.js` и
  `custom_components/houseplan/frontend/houseplan-card.js`.

Golden принимаются только через действующую policy после визуального review;
изменение baseline ради зелёного CI запрещено.

## 17. Release-артефакты

В том же коммите, что пользовательское поведение:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: удаление «Границы», стены `0`,
  настройка пунктир/сплошная и предупреждение о migration backup;
- `docs/USER-GUIDE.md`, `docs/WALL-THICKNESS.md`, `docs/LIGHT.md`;
- `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`;
- RU/EN screenshots/golden: toolbar, space setting, dashed/solid flat и iso,
  Glow/sun matrix;
- performance JSON и полный review-документ;
- security artefact не требуется: permissions/service boundary не меняется;
  backend bounds покрываются tests.

## 18. Риски и защита

| Риск | Защита |
|---|---|
| Отсутствующая thickness-запись ошибочно станет open | explicit-presence invariant + AC3 |
| Потеря positive residue при partial span | breakpoint atomization + snapshot AC8 |
| Проём исчезнет/переедет | migrate blocker и запрет positive→zero |
| Glow и sun разойдутся | единый resolver, совместная матрица AC5/AC6 |
| `0` превратится в `1` старым clamp | отдельный zero-aware parser + AC2/AC11 |
| Atomization превысит лимит | atomic failure, no truncation |
| Старый клиент испортит v8 | документированный unsupported downgrade + backup |
| Cache переживёт style toggle | style in fingerprint + AC7/AC17 |
| Две модели продолжат писаться | source-contract запрещает production legacy writers |

## 19. Зависимости и вне скоупа

### Зависимости

- #33 — compatibility lifecycle;
- #173 — единый инструмент «Стены»;
- #199 — geometry preflight;
- #224/#299 — canonical coordinates и role-aware records;
- #282 — будущая объектная модель стен. #306 не ждёт #282, но не вводит вторую
  новую сущность: explicit zero является совместимым промежуточным атомом.

### Вне скоупа

- стабильные wall ids и полный graph rewrite #282;
- разный style/light mode у отдельных zero walls;
- проёмы в нулевых стенах и «неактивные» сохранённые проёмы;
- создание внешней световой зоны;
- автоматическое разделение HA area независимой стеной;
- полноценная гарантия Plan editor на touch сверх safety floor;
- удаление compatibility reader в том же релизе.
