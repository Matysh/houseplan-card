# #306 — Нулевые стены вместо виртуальных границ

- **Issue:** [#306](https://github.com/Matysh/houseplan-card/issues/306)
- **Статус документа:** актуализировано после #282; готово к независимому ревью ТЗ
- **Приоритет / тип:** P1 / feature
- **Целевая версия модели:** `PLAN_MODEL_VERSION = 9`
- **Пользовательское изменение:** да

## 1. Сценарий

Администратор дома создаёт или исправляет планировку в Plan editor на десктопе.
В момент рисования новой стены, изменения толщины существующего участка или
настройки пространства ему нужно обозначить границу без физической толщины, не
переключаясь на отдельный инструмент с другой логикой.

Задача закрывает J4 и J6 из `docs/SCOPE.md`: первоначальная настройка становится
понятнее, а последующее обслуживание плана использует одну систему стен без
рассинхронизации площади, света и геометрии.

## 2. Что человек увидит до и после

**До:** граница без физической стены создаётся отдельным неочевидным инструментом
и ведёт себя иначе обычной стены. **После:** пользователь рисует и меняет её как
обычную стену с толщиной 0, а в настройках пространства выбирает, показывать её
пунктиром с пропусканием света или сплошной линией с блокировкой света.

## 3. Цель

Убрать из продукта отдельный инструмент **«Граница»** и канонические сущности
`space.open_spans` / `rooms[].open_to`. Их роль выполняют обычные атомарные
отрезки стен с явным `cm: 0`.

В редакторе остаётся одна модель:

- `cm > 0` — стена с физическим телом;
- `cm = 0` — топологическая стена без физического тела.

После #282 каждый contour atom уже хранится в authoritative-каталоге
`space.wall_segments[]` со стабильным `id`, точными `a/b` и явным `cm`.
Происхождение нулевого атома не сохраняется и не влияет на результат: прежняя
физическая ось без тела, бывшая виртуальная граница и новая стена, нарисованная
с толщиной 0, становятся одной и той же сущностью.

Пользователь рисует и изменяет оба вида инструментами **«Стены»** и
**«Толщина»**. Настройка пространства определяет, показываются ли все нулевые
стены пунктиром или сплошной линией и пропускают ли они свет.

## 4. Зафиксированные продуктовые решения

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
   Это правило применяется ко **всем** `cm:0`, включая атомы, которые #282
   создала из старых физических осей без толстого тела. В результате часть
   старых планов после обновления неизбежно изменит вид или светопроницаемость;
   это принятое владельцем поведение, а не ошибка миграции.
6. Нулевая стена в обоих режимах остаётся частью топологии, но не создаёт
   физическое тело, бумагу, тоннель проёма и вычет площади.
7. Новый проём на нулевой стене запрещён. Перевод участка с проёмом в `0`
   отклоняется до записи; проём автоматически не удаляется и не деактивируется.
8. Legacy `open_spans`, а при их отсутствии legacy `open_to`, переводят
   покрытые атомы v8 в `cm:0`; все остальные уже существующие `cm:0` остаются
   неотличимыми от них. Простое чтение конфигурации ничего не записывает.
9. После канонической записи старые поля больше не пишутся. Downgrade на версию,
   не понимающую `cm:0`, не поддерживается; восстановление выполняется из backup.
10. Plan editor остаётся desktop-first. View и kiosk на touch входят в
    блокирующий acceptance floor.

Открытых продуктовых вопросов нет.

## 5. Термины и инварианты

### 5.1 Атом стены

Атом — максимальный коллинеарный интервал с одними и теми же:

- координатами носителя;
- ролью `outer(room)`, `shared(roomA,roomB)` либо `independent(id)`;
- множеством владельцев;
- толщиной `cm`;
- границами, заданными узлами, концами существующих записей и проёмов.

Слияние соседних атомов разрешено только при полном совпадении роли, владельцев,
носителя и `cm`. Нельзя сливать `outer(A)` с `shared(A,B)`, разные пары shared,
room-wall с independent wall или пересекать узел/проём.

### 5.2 Authoritative wall model v8

#282 уже реализовала Stage 1 модели стен:

- `space.wall_segments[]` содержит **каждый** contour atom и является
  authoritative для identity и толщины;
- `rooms[].wall_ids[]` ссылается на эти атомы в порядке обхода `poly`;
- `space.walls[]` — только compatibility-проекция положительных толщин и не
  является источником истины;
- `partitions[]` и `room_drafts[].segments[]` сохраняют собственные стабильные
  ID и явный `cm`.

#306 не создаёт второй каталог и не возвращает midpoint-key identity. Она
расширяет уже существующий v8-инвариант: `cm:0` получает единый пользовательский
смысл и диапазон записи `0..100` на всех segment-based write paths. Функции
физического тела фильтруют `cm > 0`; функции топологии и редактора сохраняют и
видят `cm = 0`. При замыкании draft нулевой сегмент наследует ID по lineage-
правилам #282.

Никаких `zero_kind`, `legacy_origin`, скрытых compatibility-флагов или эвристик
по происхождению сегмента не добавляется. Два `cm:0` с одинаковой ролью и
геометрией всегда эквивалентны.

### 5.3 Единый resolver

Новый pure-модуль `src/zero-walls.ts` (имя можно уточнить без изменения
контракта) является единственной точкой для:

- `resolveZeroWallMode(space): { style, transmitsLight }`;
- проекции legacy `open_spans/open_to` на authoritative v8 atoms;
- классификации явных нулевых атомов по роли;
- получения линий световых барьеров и derived room connectivity;
- миграции v8 candidate в канонический v9 document без смены stable ID там,
  где carrier не разрезается.

Glow и солнце не имеют собственных проверок `dashed/solid`. Оба используют
результат этого resolver. Визуальный renderer получает тот же `style`, но не
определяет световое поведение через CSS.

## 6. Persisted schema

### 6.1 Новое поле пространства

```ts
type ZeroWallStyle = 'dashed' | 'solid';

interface SpaceConfig {
  zero_wall_style?: ZeroWallStyle; // missing/unknown read fallback = dashed
  wall_segments: Array<{ id: string; a: number[]; b: number[]; cm: number }>;
  walls?: Array<{ key: string; cm: number; a: number[]; b: number[] }>;
  room_drafts?: Array<{ segments: Array<{ id: string; cm: number }> }>;
  partitions?: Array<{ id: string; a: number[]; b: number[]; cm: number }>;
}
```

Backend принимает `cm: 0..100` для `wall_segments[]`,
`room_drafts[].segments[]` и `partitions[]`; `wall_columns[].cm` остаётся
`1..150`. Compatibility `walls[]` генерируется только из `cm>0`, всегда имеет
точные `a/b` и никогда не содержит zero record.

`PLAN_MODEL_VERSION` повышается с `8` до `9` только при фактической канонической
записи хотя бы одного затронутого пространства. Открытие карточки и
неструктурные изменения версию не повышают.

### 6.2 Deprecated compatibility fields

`space.open_spans` и `rooms[].open_to`:

- временно принимаются backend/import reader для старых документов;
- сохраняются без мутации при read-only загрузке;
- проецируются в runtime поверх v8 catalog: покрытые интервалы имеют `cm:0`, а
  остальные существующие `cm:0` не получают отдельного происхождения;
- удаляются из затронутого пространства одной транзакцией после успешной
  канонической миграции;
- никогда не создаются новым frontend;
- в экспорте канонического v9 отсутствуют;
- регистрируются в `docs/CONFIG-COMPATIBILITY.md` и
  `scripts/config-field-registry.mjs` существующими статусами
  `deprecated-read` для compatibility-read и `migrate-on-write` для
  документированных structural-write/Optimize/import путей.

Если одновременно есть валидные `open_spans` и `open_to`, источником геометрии
являются `open_spans`; `open_to` не расширяет их. Если `open_spans` отсутствует
или пуст, `open_to` материализует полный доказанный общий интервал каждой пары.

Unknown sibling-поля сохраняются на read/write как сейчас.

## 7. UX редактора

### 7.1 Основная панель

- Кнопка **«Граница»**, её submenu/context tray, подсказки и состояния удаляются.
- Поле толщины у **«Стен»** принимает локализованный эквивалент `0..100 см`.
- Пустое, `NaN`, отрицательное или больше максимума значение блокирует начало
  сегмента и показывает существующий range-feedback с новым диапазоном.
- `0` рисует обычный сегмент текущей wall/draft/partition цепочки. Замыкание
  комнаты, Ctrl+click и Shift 45° работают без отдельной ветки.
- Pointer cancel, pinch и уход из редактора не записывают незавершённый нулевой
  сегмент.

### 7.2 Инструмент «Толщина»

- Диалог/поле принимает `0..100 см` для room wall, draft и partition.
- `positive → 0` атомизирует только выбранный доказанный интервал и сохраняет
  толщину соседних остатков.
- `0 → positive` восстанавливает физическое тело обычным путём.
- Пустое поле не означает `0`: Save неактивен/операция отклонена.
- Если выбранный интервал пересекает размещённый проём, `positive → 0`
  атомарно отклоняется с сообщением удалить проём прежде. Остальной план не
  меняется.

### 7.3 Рисование по существующей оси

Рисование `cm:0` поверх доказанного участка room wall изменяет/атомизирует
authoritative `wall_segments[]` через identity barrier #282. Оно не создаёт
совпадающую `partition`. Повторное рисование того же интервала — semantic no-op
и не добавляет Undo-команду.

На совпадающей independent partition меняется существующий объект только если
есть ровно один однозначный carrier. T/X-узел, несколько carrier или конфликт
ролей отклоняются до write с локализованным сообщением. Частичный кандидат не
сохраняется.

### 7.4 Настройки пространства

В секции отображения стен добавляется radio/select:

- заголовок RU: **«Стены нулевой толщины»**;
- варианты RU: **«Пунктирные»**, **«Сплошные»**;
- видимое пояснение RU: **«Пунктирные стены пропускают свет. Сплошные стены
  блокируют свет, даже при нулевой толщине.»**;
- эквивалентные EN-строки перечислены в §15.

Изменение применяется сразу ко всем нулевым стенам пространства одной config
транзакцией, поддерживает обычную отмену несохранённого диалога и не переписывает
геометрию.

## 8. Геометрия и операции

### 8.1 Физическое тело, площадь и пол

- `cm:0` никогда не передаётся в wall-body union как полигон и не заменяется
  внутренним epsilon/`1 см`.
- Чистая площадь комнаты и inset floor игнорируют его физическую толщину, но
  продолжают использовать ось как контур комнаты.
- Independent `cm:0` не создаёт бумагу/пол и не вычитает площадь.
- Замкнутая цепочка independent нулевых стен не создаёт комнату сама по себе;
  комната возникает только через существующий flow предложения комнаты.

### 8.2 Проёмы

- Picker/placement не предлагает нулевой wall interval как host.
- Изменение host wall в `0` запрещено, пока любой door/window/gate/passage
  пересекает целевой атом.
- У нулевой стены нет tunnel fill, откосов и opening cut.
- Legacy-конфликт `open_span/open_to` с проёмом блокирует миграцию всего
  пространства. Runtime остаётся читаемым по legacy projection; Optimize и
  структурная запись показывают конкретный blocker и не удаляют проём.

### 8.3 Split, Merge, Delete, Resize

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

### 8.4 Нормализация и Optimize

- Identity writer #282 сохраняет stable ID и явные нули; соседние атомы
  объединяются только при совпадении role/owners/cm и по документированным
  lineage-правилам (survivor ID детерминирован, ссылки opening остаются валидны).
- Ни один helper не должен применять `clampWallCm(0) → 1`.
- Optimize preview отдельно считает `legacy virtual spans migrated` и
  `zero-wall atoms merged`.
- После Confirm все пространства мигрируют атомарно; ошибка/лимит в одном
  пространстве отменяет весь candidate и оставляет one-deep Optimize Undo.
- Повторный Optimize канонического v9 — byte/semantic no-op.

## 9. Свет и отображение

### 9.1 Свет

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

### 9.2 Flat, isometric и редакторы

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

## 10. Алгоритм миграции v8 → v9

Миграция pure, deterministic, idempotent и возвращает либо полный candidate,
либо typed blocker. Документ старее v8 сначала проходит уже реализованный
identity barrier #282 и только затем этот алгоритм; отдельный второй каталог
стен не строится.

1. Валидировать v8 `rooms[].poly/wall_ids`, `wall_segments`, openings, limits и
   координаты без изменения input. Для pre-v8 input получить полный v8 candidate
   существующим `commitWallSegmentModel()`.
2. Если есть валидные `open_spans`, использовать их. Иначе построить полные
   shared intervals по `open_to` через существующий `sharedBoundary` resolver.
3. Нормализовать и clip legacy spans строго к доказанным contour carriers.
   Висящий, неоднозначный или non-finite span — blocker, не silently drop.
4. Убедиться, что endpoints каждого legacy span являются границами атомов.
   Если v8 catalog уже атомизирован #282, stable IDs сохраняются. Если требуется
   дополнительный split, применяется lineage #282: один доказанный survivor
   сохраняет исходный ID, остальные получают новые ID, а `room.wall_ids` и
   wall-hosted references обновляются атомарно.
5. Каждый атом, покрытый legacy virtual span, получает `cm:0`. Положительный
   остаток сохраняет точный `cm`. Любой атом, который уже имел `cm:0`, остаётся
   нулевым без отдельной метки происхождения и получает тот же style/light mode.
6. Проверить проёмы на **всех** итоговых `cm:0`, а не только на бывших virtual
   spans. Zero opening host — blocker всего пространства: opening и исходный v8
   документ сохраняются, молчаливое удаление запрещено.
7. Role-aware normalization объединяет только эквивалентные соседние нулевые
   атомы и сохраняет валидную identity/host lineage.
8. Перегенерировать compatibility `walls[]` только из `cm>0`. Удалить
   `space.open_spans` и `rooms[].open_to` только из полностью готового candidate.
9. Не добавлять `zero_wall_style`, если пользователь его не сохранял: runtime
   fallback `dashed` применяется ко всем `cm:0`. Это намеренно может изменить
   вид и свет старых bodyless-физических осей после обновления.
10. Прогнать geometry preflight, model invariants и backend schema. При
    превышении `MAX_WALL_SEGMENTS` (сейчас 200 000) или любого другого
    актуального backend-лимита отказать целиком; усечение запрещено.
11. При записи установить `model_version: 9`. Повторный запуск возвращает no-op.

### 10.1 Когда выполняется write

- Read adapter всегда строит runtime projection без persistence.
- Структурная транзакция конкретного пространства (изменение rooms, walls,
  drafts, partitions, openings, Split/Merge/Delete/Resize/Thickness/Draw)
  сначала мигрирует это пространство и пишет всё одной транзакцией.
- Сохранение marker/layout, HA state, настроек устройства, названия/заливки
  пространства и простое открытие карточки не запускают migration write.
- **«Оптимизировать планы»** строит preview и мигрирует все legacy-пространства
  одной подтверждённой транзакцией.
- Full/space import старого документа проецирует и валидирует migration в
  preview; Apply сохраняет canonical v9 candidate либо отказывает целиком.

### 10.2 Масштаб и round-trip

Координаты переносимых `a/b` проходят существующий lattice write barrier.
Space-only import с другим `cell_cm` сохраняет нормализованную геометрию и
сантиметровый `cm:0` без масштабирования значения. Full export/import и
config/layout round-trip не восстанавливают deprecated fields.

## 11. Backend, import/export и concurrency

- `custom_components/houseplan/validation.py` принимает новый enum и сохраняет
  существующий v8 диапазон `wall_segments[].cm = 0..100`.
- Validation v9 запрещает zero opening host, non-finite/negative cm, нарушение
  catalog/room projection и canonical наличие `open_spans/open_to`; legacy
  document допускается только через compatibility read/import path.
- `import_export.py` включает `zero_wall_style`, умеет preview старой миграции и
  выдаёт локализуемый/машиночитаемый blocker code.
- Config revision/CAS и атомарная config+layout запись остаются обязательными;
  конфликт ревизии не повторяет migration поверх устаревшего candidate.
- Permissions, HA service calls, entity registry и security boundary не
  меняются. Новые данные не исполняются и проходят существующие bounds.

## 12. Совместимость и откат

### 12.1 Forward compatibility

Старые `open_spans/open_to` до записи продолжают читаться. Одновременно runtime
применяет единый zero-wall mode ко всем v8 `cm:0`: при отсутствующей настройке
это `dashed`, поэтому ранее bodyless-физические оси могут стать пунктирными и
начать пропускать свет уже после обновления. Этот переход намеренно не является
lossless по визуалу/свету; координаты, stable IDs, комнаты, положительные
толщины и сами opening records не меняются. Backend сохраняет compatibility-
reader минимум весь релизный цикл v1.68.x; удаление reader требует отдельного
issue и данных telemetry/fixtures.

### 12.2 Downgrade / rollback

Версия до #306 понимает v8 `cm:0`, но не понимает их новую единую семантику и
может снова записать `open_spans/open_to`. Поэтому downgrade после canonical v9
write не поддерживается. До первой структурной записи пользователь может сделать
полный backup. После Optimize доступен существующий one-deep Undo в текущей
сессии; надёжный откат между версиями — импорт backup.

Релизный rollback до первой beta выполняется revert коммита. После beta нельзя
возвращать старую schema в stable; исправление выпускается forward-only с
сохранением v8 reader. Labs-флаг не используется: две одновременно пишущие
модели создадут больший риск, чем feature flag способен снять.

## 13. Производительность

- Migration/atomization выполняется только на structural write/Optimize/import,
  не на HA state tick и не на каждом render.
- Runtime projection, wall-role index, light barriers и render geometry
  fingerprint/cache включают `space id + geometry revision + zero_wall_style`.
- Смена HA state не пересобирает wall atoms, connectivity или sun barriers.
- Лимит authoritative-каталога остаётся равен backend-константе
  `MAX_WALL_SEGMENTS` (сейчас 200 000); результат не truncates.
- Benchmark на large-house fixture сравнивает v8 compatibility projection и v9 canonical:
  p95 построения barrier/first render не должен регрессировать более чем на 10%,
  steady HA-state render — более чем на 5% относительно baseline ветки.
- Нулевые line barriers не превращаются в полигоны, что ограничивает рост
  polyclip input.

## 14. Touch и accessibility

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

## 15. i18n

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

## 16. Затронутые модули

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
  `src/wall-segment-model.ts`, `src/coordinate-canonicalization.ts` — migration
  v9 поверх identity barrier #282, limits/idempotence;
- `custom_components/houseplan/const.py`, `validation.py`, `import_export.py`,
  `coordinate_canonicalization.py` — model version, schema и import/export;
- `src/i18n/en.json`, `src/i18n/ru.json`;
- `docs/WALL-THICKNESS.md`, `docs/LIGHT.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`, оба
  changelog;
- unit/backend/smoke/golden/performance fixtures из §17.

Противоречащие актуальные ТЗ #148 и #173 получают короткую superseded-note со
ссылкой на #306; история их acceptance contract не переписывается задним числом.

## 17. Acceptance criteria и доказательства

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

### AC3. Все `cm:0` имеют одну семантику

Для v8 plan с двумя нулевыми contour atoms — один получен из прежней физической
оси без тела, второй совпадает с `open_spans` — runtime и v9 migration не
различают происхождение. Оба следуют одному `zero_wall_style`; persisted
`zero_kind`/compatibility-marker отсутствует. При default `dashed` оба становятся
пунктирными и пропускают свет.

**Доказательство:** migration/runtime unit на смешанной v8 fixture + source-
contract, запрещающий discriminator происхождения.

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
старые barrier/render caches не используются, координаты и `wall_segments[]` не
меняются.

**Доказательство:** unit fingerprint/cache test + browser smoke в одном session.

### AC8. Миграция `open_spans` сохраняет данные и idempotent

Полный/частичный/соседний span, разные positive residues и shared/outer role
преобразуются в exact `cm:0` atoms; stable IDs сохраняются по lineage #282,
deprecated fields удаляются только в candidate, model становится v9. Второй
запуск no-op. Координаты/комнаты/opening records не теряются; визуальная и
световая losslessness для прежних bodyless `cm:0` намеренно не обещается.

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
Undo возвращает исходные v8/legacy data в сессии. Full/space v8 или более старый
import создаёт v9 candidate через последовательные identity и zero-wall barriers.
Превышение любого актуального backend-лимита, invalid span, opening conflict
или revision conflict отклоняет весь candidate без truncation/partial apply.

**Доказательство:** optimizer unit, `tests_backend/test_ha_import_export.py`,
`tests_backend/test_validation.py`, browser backup transfer smoke.

### AC14. View/isometric/editor/export parity

Один и тот же style виден в flat, isometric, Plan/Decor contexts и visual export.
`show_borders:false` скрывает линию в View/kiosk, но не меняет выбранную световую
семантику; Plan axes/nodes видны во всех режимах редактора.

**Доказательство:** golden matrix desktop + narrow viewport; source assertions и
smoke `show_borders`.

### AC15. Backend и compatibility registry согласованы

Backend принимает canonical v9 `wall_segments[].cm:0` с exact endpoints,
отклоняет negative, non-finite, zero opening host и legacy virtual fields в v9.
Старый v8/pre-v8 документ читается через compatibility path.
`docs/CONFIG-COMPATIBILITY.md` описывает оба deprecated поля и downgrade.

**Доказательство:** backend parameterized tests + docs review.

### AC16. Touch safety floor

На touch View/kiosk линия и свет совпадают с desktop. Pinch/cancel в Plan editor
не записывает нулевой сегмент и не оставляет активную command session.

**Доказательство:** Playwright touch smoke; ручное редактирование сверх этого —
best effort и не блокирует.

### AC17. Производительность и кэши

Large-house v8 projection/v9 canonical проходят бюджеты §13; HA state tick не
запускает atomization/barrier rebuild; style toggle запускает ровно одну
инвалидацию требуемых geometry/light caches.

**Доказательство:** benchmark artefact JSON + source-fingerprint unit.

### AC18. Документация и релизные артефакты

RU/EN UI, changelog и user docs описывают одну систему стен, новый диапазон,
стиль/свет и backup перед migration. ТЗ #148/#173 помечены superseded в части
Boundary. Bundle-копии синхронны.

**Доказательство:** i18n/docs/bundle tests и ревью артефактов.

## 18. Обязательные проверки реализации

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
- large-house performance capture с бюджетами §13;
- полный импорт v8 и pre-v8 full/space fixtures и v9 round-trip;
- сверку `dist/houseplan-card.js` и
  `custom_components/houseplan/frontend/houseplan-card.js`.

Golden принимаются только через действующую policy после визуального review;
изменение baseline ради зелёного CI запрещено.

## 19. Release-артефакты

В том же коммите, что пользовательское поведение:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: удаление «Границы», стены `0`,
  настройка пунктир/сплошная и предупреждение о migration backup;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/WALL-THICKNESS.md`,
  `docs/LIGHT.md`;
- `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`;
- RU/EN screenshots/golden: toolbar, space setting, dashed/solid flat и iso,
  Glow/sun matrix;
- performance JSON и полный review-документ;
- security artefact не требуется: permissions/service boundary не меняется;
  backend bounds покрываются tests.

## 20. Риски и защита

| Риск | Защита |
|---|---|
| Отсутствующая thickness-запись ошибочно станет open | explicit-presence invariant + AC3 |
| Потеря positive residue при partial span | breakpoint atomization + snapshot AC8 |
| Проём исчезнет/переедет | migrate blocker и запрет positive→zero |
| Glow и sun разойдутся | единый resolver, совместная матрица AC5/AC6 |
| `0` превратится в `1` старым clamp | отдельный zero-aware parser + AC2/AC11 |
| Atomization превысит лимит | atomic failure, no truncation |
| Старый клиент вернёт legacy-поля в v9 | документированный unsupported downgrade + backup |
| Cache переживёт style toggle | style in fingerprint + AC7/AC17 |
| Две модели продолжат писаться | source-contract запрещает production legacy writers |

## 21. Зависимости и вне скоупа

### Зависимости

- #33 — compatibility lifecycle;
- #173 — единый инструмент «Стены»;
- #199 — geometry preflight;
- #224/#299 — canonical coordinates и role-aware records;
- #282 — реализованная обязательная основа: stable `wall_segments[].id`,
  `rooms[].wall_ids` и единый structural identity barrier. #306 не дублирует и
  не обходит этот writer.

### Вне скоупа

- Stages 2–4 ADR #282 (integer lattice, единый planar graph, closed-form junctions);
- разный style/light mode у отдельных zero walls;
- проёмы в нулевых стенах и «неактивные» сохранённые проёмы;
- создание внешней световой зоны;
- автоматическое разделение HA area независимой стеной;
- полноценная гарантия Plan editor на touch сверх safety floor;
- удаление compatibility reader в том же релизе.
