# #162 — многоэтажный робот: карты отдельно от пространства базы

- Issue: [#162](https://github.com/Matysh/houseplan-card/issues/162)
- Приоритет: P2
- Тип: bug
- Ветка: `issue/162-vacuum-map-space-routing`
- Статус документа: редакция 2, правка по spec-review r1 (Medium §11.3 «compatible source»)
- Источник: аналитическая проверка [#125](https://github.com/Matysh/houseplan-card/issues/125) и решение владельца от 2026-08-15
- Первая редакция: 2026-08-15, коммит `d7c34a9`; расхождения зафиксированы в §3.4

## 1. Пользовательская проблема и результат

Один физический робот может хранить несколько карт и работать на разных этажах,
хотя его док-станция постоянно стоит только на одном из них. Сейчас House Plan
хранит по `map_id` разные матрицы, но marker робота имеет одно `space`. Поэтому
док, live puck и пути фактически привязаны к одному пространству: другая карта
либо молча скрывает live overlay, либо рисуется на этаже базы.

После #162 администратор сопоставляет каждую увиденную карту с пространством и
калибрует её именно относительно этого плана. Док остаётся на своём этаже, а
движущийся puck и пути направляются в пространство активной карты. House Plan
поддерживает как один источник с меняющимся `map_id`, так и разные camera
entities для карт. Если активную карту нельзя однозначно определить или она не
настроена, карточка ничего не угадывает и явно показывает проблему у дока.

## 2. Персоны, поверхности и before/after

- **Home admin:** настраивает источники, карты, пространства и калибровку в
  Device editor на desktop.
- **Домочадец:** видит фактическое местоположение на планшете и не может
  исправлять routing.
- **Гость/киоск:** видит только безопасный View и должен отличать отсутствие
  данных от ложной позиции.

Затронуты Full View, обычный и kiosk режимы, Device editor, Flat и скрытая
изометрия как два способа показать тот же live overlay. Static space card не
рисует live vacuum overlays и в scope не входит.

- **До:** док и robot overlay имеют один floor; неизвестная карта исчезает без
  объяснения; отдельные camera sources взаимно заменяются.
- **После:** dock space и map route независимы; текущий и предыдущий runs
  показываются в пространствах своих routes; неготовый route fail-visible.

## 3. Итог аналитики

### 3.1 Оценка

- пользовательская ценность: **8/10**;
- ценность для разработки: **7/10** — появляется единый route authority вместо
  разрозненных допущений frontend/backend;
- сложность: **8/10** (поднято в актуализации 2026-08-31: добавились ratchet
  ядровых файлов и ленивый граф, см. §3.4);
- риск: **9/10** — persisted config, legacy calibrations, неразличимые `default`,
  несколько sources/роботов, cross-space export и устаревшие trails нельзя
  исправлять независимо.

P2 bug, обычный полный трек. Входит в J1 и J6 `docs/SCOPE.md`. View, touch и
kiosk являются блокирующими поверхностями; editor touch остаётся best effort.

### 3.2 Подтверждённая техническая база

Проверено исполнением на `dev` d4dd027b (v1.71.0-beta.2) 2026-09-03; ссылки на
строки действительны на этот коммит.

- слой устройств отбирается **только** по пространству дока —
  `src/houseplan-card.ts:11334`
  `const devs = this._renderDevices.filter((d) => d.space === space.id && …)`;
  маркер робота отбрасывается до чтения телеметрии, поэтому на другом этаже
  оверлея не может быть в принципе;
- матрица выбирается по одному лишь map id —
  `src/houseplan-card.ts:12347`
  `const matrix = d.marker?.vacuum?.calibration?.[mapNow]`; при промахе
  `_renderVacuums()` делает молчаливый `continue`;
- в схеме `Marker.vacuum` (`src/types.ts:141`) полей ровно семь: `live`,
  `trail`, `trail_mode`, `room_highlight`, `source`, `calibration`,
  `segment_map`. Поля, связывающего карту с пространством, нет;
- `marker.vacuum.source` хранит одну pinned entity; auto/manual calibration
  всегда использует `d.space`;
- active `map_id` вычисляется стабильной nullish-цепочкой
  (`vacMapIdFromAttrs`/`vacMapIdWithFallback`, `src/vacuum.ts:310,322`) и
  согласован с backend recorder, включая `0`, `"0"` и пустую строку;
- серверный run опознаётся парой (marker, map_id) и не несёт ни route id, ни
  space — `custom_components/houseplan/trails.py`
  `cur = {"map_id": map_id, "started": now, "ended": None, "points": []}`;
  `can_resume_trail_run()` сравнивает только `map_id`;
- `room_highlight` и `segment_map` присутствуют в схеме, но runtime consumer
  по-прежнему не реализован; это scope отдельной #12;
- руководство ошибочно выводит поддержку нескольких пространств только из
  наличия per-map matrices.

Базовая линия тестов на этом коммите: `npm test` — 1819 pass / 0 fail / 1 skip.

### 3.3 Дубликаты и зависимости

- #58 — завершённый Stage 1 source/calibration contract; #162 его расширяет.
- #125 — завершённая проверка, из которой выделен дефект.
- #12 — будущая room-level подсветка без координат. #162 не реализует её, но
  route resolver обязан отдавать `route_id` и `space`, чтобы #12 не создала
  второй floor resolver.
- #27 — реализованный external source picker; его UI и sticky semantics
  переиспользуются.

Дубликата map-to-space routing среди открытых product issues нет.

### 3.4 Ограничения, появившиеся после первой редакции ТЗ

Между редакцией 1 (2026-08-15) и редакцией 2 в `dev` вошло 1707 коммитов.
Продуктовая часть ТЗ выдержала проверку без изменений; изменились рамки
реализации, и они нормативны:

1. **Храповик ядровых файлов (#425).** `test/core-file-budget.test.mjs`
   держит потолки `src/houseplan-card.ts` = 13659 и
   `src/houseplan-editor-runtime.ts` = 14323 строк при slack 250. Факт на
   d4dd027b — 13545 и 14320, то есть запас 114 и **3** строки. Поэтому весь
   новый код #162 обязан жить в отдельных модулях: чистые контракты и резолвер
   — в новом `src/vacuum-routes.ts`, редакторский блок «Карты и этажи» — в
   новом модуле рядом с `src/editors/`. В ядрах допустимы только вызовы. Если
   вынос попутно уменьшит ядро более чем на slack, потолок обязан быть опущен
   тем же коммитом — храповик требует фиксировать выигрыш.
2. **Ленивый граф и бюджет бандла.** Резолвер маршрутов нужен View, поэтому
   его модуль входит в `initialViewFiles`; редакторский UI обязан остаться в
   `lazyEditorFiles` и не попасть в initial-граф. Гейт —
   `scripts/bundle-budget.mjs`; порог initial отдельно дорабатывается в #438,
   и #162 не должен молча съесть его запас: рост initial-чанка фиксируется в
   PR как отдельная цифра.
3. **Мутант на каждый защитный контракт.** Правило введено после #426: для
   каждой новой проверки, которая обязана краснеть (`ambiguous`,
   `missing_space`, `unmapped`, отказ semantic validator, route-aware GC),
   в PR должен быть прогон отрицательного мутанта штатным
   `scripts/mutation-gate.mjs`, а не рассуждение о том, что проверка работает.
4. **Удаление пространства уже имеет владельца.** `src/space-deletion.ts`
   (`collectSpaceMarkerDependencies`, `createSpaceDeletionCandidate`) и
   `src/space-reference-repair.ts` появились после редакции 1. AC16 обязан
   встроиться в них, а не заводить второй пересчёт зависимостей; при этом
   `repairSpaceReferences()` по своей доктрине не трогает вложенные
   calibration-данные — значит, восстановление `space` у routes при
   импорте/переименовании делается явным кодом #162, а не наследуется.
5. **Снимок фактов.** `src/render-device-snapshot.ts` — существующая точка,
   через которую рендер получает `facts.get('vacuum:<id>')`. Route resolution
   обязана попасть в этот снимок, а не вызываться заново внутри `render()`.


## 4. Нормативные продуктовые решения

1. Один физический робот имеет **один marker дока** и несколько map routes.
2. Перемещение marker между пространствами меняет только положение дока.
   Сохранённые map routes самостоятельно не перепривязываются.
3. Надёжная identity карты — сохранённый route с exact `source`, exact
   `map_id` и target `space`. Один `map_id` недостаточен: разные camera entities
   могут публиковать одинаковый `default`.
4. House Plan не обещает получить каталог всех карт из HA. Он показывает
   сохранённые routes и текущую наблюдаемую карту; остальные появляются после
   переключения карты в integration либо явного выбора camera source.
5. Новый route всегда сохраняет exact source. Автоматический source остаётся
   способом первичного обнаружения, но не неявной identity уже настроенной карты.
6. Target space выбирает пользователь. Для первого route default — dock space;
   для второго и последующих пустой выбор блокирует Save.
7. Source и `map_id` сохранённого route неизменяемы. Ошибочную identity удаляют
   и добавляют заново; это исключает молчаливое переиспользование calibration и
   trails другой системы координат.
8. Смена target space требует отдельного подтверждения, сбрасывает calibration,
   создаёт новую route identity и удаляет связанные derived trails.
9. Док всегда остаётся в `marker.space`. Live puck и current trail принадлежат
   target space активного route. Previous run в режиме `always` принадлежит
   space собственного сохранённого route, даже если робот уже на другом этаже.
10. Неразмеченная, неоднозначная, missing-space или некалиброванная активная
    карта не рисуется на предположенном этаже.
11. Пока робот движется, routing failure даёт небольшой amber warning badge на
    marker дока с accessible текстом. В Device editor полная причина видна всегда.
12. Порядок registry/camera candidates не выбирает этаж и не разрешает
    неоднозначность.
13. `default` — допустимый id для single-map source, но не доказательство
    стабильной multi-floor identity. UI показывает предупреждение; два
    неразличимых active routes дают `ambiguous`, а не guessed floor.
14. Несколько роботов полностью независимы по marker id, routes, runtime и
    stored runs.
15. `static_icon`, hidden, removed и HA-disabled сохраняют текущий запрет live
    vacuum overlays и не получают новый warning badge.

## 5. Scope

### 5.1 Модель и validation

- новый canonical `marker.vacuum.map_routes[]`;
- legacy-read `source` и `calibration` без eager migration;
- referential validation target space и change-aware compatibility;
- route identity для frontend runtime и server trail runs;
- bounds/uniqueness/finiteness validation.

### 5.2 Device editor

Весь новый UI — в отдельном ленивом модуле (§3.4.1); в
`houseplan-editor-runtime.ts` остаются только точки вызова.

- список сохранённых карт с source, map id, space и calibration/status;
- блок текущей наблюдаемой карты;
- «Добавить текущую карту»;
- явный выбор другой camera source через существующий picker;
- target space select;
- auto/manual calibration в target space;
- смена space и удаление route с предупреждением;
- диагностика unstable, unmapped, ambiguous, missing/disabled source и missing
  target space.

### 5.3 Runtime и backend

- новый модуль `src/vacuum-routes.ts`: типы, semantic validation, чтение
  legacy и pure route resolver; ядра только вызывают его (§3.4.1);
- pure route arbitration;
- snapshot всех exact route sources;
- независимый от dock-space рендер live overlays;
- route-aware local trail split;
- route-aware backend subscriptions, current/previous run storage и GC;
- reload/warm-remount continuity;
- Flat/Iso parity без нового визуального стиля puck/path;
- результат резолвера кладётся в `src/render-device-snapshot.ts`
  (`facts.get('vacuum:<id>')`), а не пересчитывается внутри `render()`.

### 5.4 Lifecycle, перенос и документация

- marker/route/space delete;
- full и space export/import;
- downgrade/rollback notes;
- RU/EN i18n;
- VACUUM, USER-GUIDE, ARCHITECTURE, CONFIG-COMPATIBILITY и TESTING;
- unit/backend/smoke/golden evidence.

## 6. Non-scope

- получение каталога карт через integration-specific private API;
- переключение карты робота или запуск уборки из House Plan;
- автоматическое определение этажа по координатам, комнатам, порядку camera
  entities, времени обновления либо proximity;
- одновременный показ одного active route в нескольких spaces;
- команды переноски/возврата робота к доку;
- реализация `room_highlight`/`segment_map` из #12;
- миграция или объединение вручную созданных duplicate markers одного робота;
- изменение внешнего вида puck/path и режимов trail;
- live vacuum overlay в Static space card;
- новая поддержка Roomba string-position;
- history/cleaning-log UI сверх current + previous run.

Если #12 реализуется после #162, она обязана потреблять route authority. Если
#12 окажется в `dev` раньше, интеграция #162 должна перенаправить её результат в
`route.space`, не меняя визуальный контракт #12.

## 7. Контракт данных

### 7.1 TypeScript

```ts
type Affine = [number, number, number, number, number, number];

interface VacuumMapRoute {
  id: string;          // stable marker-local identity, e.g. vr_<random>
  source: string;      // exact HA entity id
  map_id: string;      // exact canonical ID; "", "0" and "default" are valid
  space: string;       // exact House Plan space id
  calibration?: Affine | null;
}

interface MarkerVacuumCfg {
  live?: boolean | null;
  trail?: boolean | null;
  trail_mode?: 'never' | 'cleaning' | 'always' | null;
  room_highlight?: boolean | null;       // reserved for #12
  source?: string | null;                // discovery + legacy compatibility
  calibration?: Record<string, Affine>;  // legacy-read only after #162
  segment_map?: Record<string, string>;  // reserved for #12
  map_routes?: VacuumMapRoute[];
}
```

`map_routes` — массив, а не record по `map_id`: две разные sources могут иметь
один id `default`. `route.id` нужен trail store и остаётся стабильным при
recalibration. Он меняется при source/map/space identity change.

### 7.2 Canonical validation

- максимум 32 routes на marker;
- `id`: непустой marker-local id, максимум 128 символов;
- `source`: syntactically valid entity id, максимум 255 символов;
- `map_id`: строка максимум 255 символов, пустая строка допустима;
- `space`: существующий `spaces[].id`;
- calibration отсутствует/null либо содержит ровно шесть finite numbers;
- `id` уникален внутри marker;
- пара `(source, map_id)` уникальна внутри marker;
- route не может ссылаться на removed marker или отсутствующий space в новой
  записи/import;
- неизвестные sibling fields сохраняются по lossless doctrine.

Semantic validator применяется к `config/set`, optimize и обоим import flows.
Новый/изменённый invalid route отклоняется атомарно стабильным error
`invalid_vacuum_map_route`. Неизменённый legacy/future-broken route не блокирует
несвязанное сохранение; явное редактирование routing обязано исправить его.

### 7.3 Legacy-read и канонизация

Если `map_routes` отсутствует, каждый valid
`calibration[map_id]` читается как effective legacy route:

- source = сохранённый `vacuum.source`, а при его отсутствии — текущий
  automatic resolution;
- space = `marker.space`;
- calibration = legacy matrix;
- runtime id детерминированно выводится из marker/source/map id и не пишется.

Загрузка ничего не переписывает. Обычный Save других полей marker также не
мигрирует vacuum block.

При первом явном изменении routing UI атомарно:

1. требует exact source для каждой сохраняемой legacy matrix;
2. создаёт routes для всех legacy matrices, а не только текущей;
3. сохраняет их target space = прежний marker space;
4. удаляет `calibration` только после успешного config write;
5. оставляет root `source` как discovery default.

Если exact source нельзя определить, UI не удаляет legacy data и требует
выбрать source до конверсии. Partial migration запрещена. При наличии
`map_routes` они являются единственной canonical route authority; параллельный
legacy `calibration` не участвует в render.

## 8. Route resolution

### 8.1 Нормализованный результат

Pure resolver возвращает один из результатов:

```ts
type VacuumRouteResolution =
  | { kind: 'ready'; route: VacuumMapRoute; telemetry: VacTelemetry }
  | { kind: 'needs_calibration'; route: VacuumMapRoute; telemetry: VacTelemetry }
  | { kind: 'unmapped'; source: string; mapId: string }
  | { kind: 'ambiguous'; routeIds: string[] }
  | { kind: 'missing_space'; route: VacuumMapRoute }
  | { kind: 'source_error'; routeIds: string[]; status: VacSourceStatus }
  | { kind: 'none' };
```

Имена types могут отличаться; набор семантических состояний нормативен.

### 8.2 Алгоритм

Для каждого configured route:

1. exact source проверяется общим binding-status resolver;
2. telemetry читается только из текущего active snapshot, без stale attrs;
3. observed map id вычисляется существующей nullish-цепочкой source attrs →
   vacuum `selected_map` fallback;
4. route совпадает только при exact string equality observed ID и `route.map_id`;
5. target space обязан существовать;
6. calibration обязана быть finite six-number matrix для `ready`.

Результат:

- один совпавший valid route + matrix → `ready`;
- один совпавший route без matrix → `needs_calibration`;
- текущий default/discovery source даёт telemetry/map id, но route отсутствует
  → `unmapped`;
- более одного совпавшего route → `ambiguous`, независимо от list order;
- совпавший route указывает удалённый space → `missing_space`;
- source missing/disabled/unavailable/unverified → `source_error` по существующей
  sticky semantics;
- нет положительных данных → `none`.

Friendly name, порядковый номер карты, совпадение комнат и `last_updated` не
разрешают ambiguity. Exact source/map identity никогда не ретаргетится молча.

### 8.3 `default` и нестабильный id

`default` остаётся рабочим single-map ключом. В UI он помечен:

> Источник не сообщает стабильный ID карты. Несколько этажей нельзя различить
> без другого источника или `selected_map` робота.

Два route sources с `default` допустимы в config, потому что sources разные, но
runtime выбирает их только при ровно одном положительном совпадении. Если оба
выглядят активными, результат `ambiguous`. House Plan не обещает multi-floor
для integration, которая не предоставляет различимого сигнала.

## 9. UX Device editor

### 9.1 Блок «Карты и этажи»

После общей source diagnostics показывается отдельный блок:

- текущая наблюдаемая карта: map id, source, routing status;
- saved routes: display map id, source friendly name + entity id, target space,
  calibration status;
- кнопки «Добавить текущую карту» и «Добавить источник карты»;
- actions route: «Настроить автоматически», «Подогнать вручную», «Изменить
  пространство», «Удалить».

Rows сортируются по порядку spaces, затем map id, затем source entity id. Active
row помечается текстом «Текущая», не только цветом.

### 9.2 Добавление текущей карты

Кнопка доступна, когда source/telemetry дают exact наблюдаемую пару, которой нет
в routes.

- первый route preselects dock space;
- следующий route открывается без target selection;
- Save disabled, пока space не выбран;
- source и map id показываются read-only;
- после создания row получает stable route id и `needs_calibration`;
- пользователь сразу видит actions calibration, но может закрыть dialog и
  вернуться позже.

### 9.3 Отдельная camera на карту

«Добавить источник карты» переиспользует capability picker и ленивую секцию
«Все камеры». После выбора source House Plan читает его текущий map id с тем же
vacuum fallback. Если identity нельзя получить, route не создаётся и UI
объясняет, что карту нужно активировать в integration либо выбрать source со
стабильным id.

Ручного текстового ввода entity id или map id нет.

### 9.4 Калибровка

Auto-calibration сопоставляет robot rooms только с rooms `route.space`. Manual
fit переключает canvas на `route.space`, а не `marker.space`. Save пишет matrix
в `route.calibration`, не в legacy dictionary.

Residual threshold, Apply/Manual/Cancel, rotate/mirror и exact numeric contract
Stage 1 не меняются. Recalibration сохраняет route id, поэтому raw stored trails
безопасно перепроецируются новой matrix.

### 9.5 Смена пространства и удаление

Смена route space показывает confirm:

- RU: `Калибровка и сохранённые пути этой карты будут удалены. Продолжить?`
- EN: `Calibration and saved paths for this map will be removed. Continue?`

После подтверждения создаётся новая route identity с теми же source/map id и
новым space, без matrix; old route runs удаляются. Cancel byte-for-byte
сохраняет config и trails.

Удаление route показывает аналогичный confirm и удаляет route-associated
current/previous runs. Root source и другие routes не меняются.

### 9.6 Удаление пространства

Confirm удаления пространства дополнительно показывает число чужих vacuum map
routes, которые на него ссылаются. После подтверждения такие routes удаляются и
их derived runs очищаются в той же логической операции. Marker дока на другом
этаже и остальные routes сохраняются. При config conflict partial cleanup
запрещён.

## 10. View, kiosk и isometric behavior

### 10.1 Layer routing

Dock face продолжает попадать в `devs` по `device.space`. Vacuum overlay больше
не строится только из current-space `devs`: route facts рассчитываются для всех
visible active vacuum markers, после чего каждый визуальный элемент фильтруется
по собственному route space.

| Элемент | Space authority |
|---|---|
| dock marker | `marker.space` / device space |
| live puck | active `route.space` |
| integration/current server/local path | active `route.space` |
| previous server run в `always` | route id самого run |
| routing warning badge | dock marker space |

Live puck не дублируется на dock floor. Если dock и route находятся в одном
space, визуал совпадает с текущим Stage 1.

Flat и Iso используют тот же resolved route и те же raw points/matrix. #162 не
добавляет новую изометрическую геометрию, высоту или тень.

### 10.2 Fail-visible badge

Когда vacuum entity в moving state, а result равен `unmapped`,
`needs_calibration`, `ambiguous`, `missing_space` или route-related
`source_error`, на dock marker показывается маленький amber warning badge.

- badge не заменяет device face и не меняет tap action;
- hover/focus/accessible name содержит локализованную причину;
- цвет не единственный сигнал: используется `mdi:alert-outline`;
- клик по обычному marker по-прежнему открывает info; admin получает путь в
  Device editor существующим способом;
- reduced motion не анимирует badge;
- hidden/removed/disabled/static-icon marker badge не показывает.

Если target space неизвестен, House Plan не создаёт ghost puck на dock floor.
В kiosk warning остаётся читаемым, но editing не открывается.

## 11. Trail runtime и backend

### 11.1 Run schema

Новая запись current/previous:

```json
{
  "route_id": "vr_floor_2",
  "source": "camera.robot_floor_2",
  "map_id": "floor_2",
  "started": 123,
  "ended": null,
  "points": [[100, 200], [110, 210]]
}
```

`route_id` и `source` добавляются без смены raw-coordinate doctrine. Store всё
ещё держит current + previous per marker и не хранит matrix/space.

### 11.2 Recorder

- подписывается на deduplicated union exact route sources + vacuum entities;
- legacy marker без routes использует существующий root source flow;
- на событии применяет тот же route arbitration contract к доступным states;
- пишет точку только при одном active route;
- смена route завершает/переносит прежний current в previous без false bridge;
- ambiguity/unmapped не пишет guessed point;
- source health учитывает каждый `(marker, route_id, source)` и сохраняет
  существующую dedup/recovery semantics;
- marker delete удаляет всю книгу; route delete/space reroute удаляет runs
  только старого route id;
- refresh/restart в середине уборки продолжает тот же route run.

Frontend и backend route selection покрываются общей JSON fixture. Отдельные
реализации допустимы, расходящиеся правила — нет.

### 11.3 Legacy trails

Legacy run — сохранённая запись без `route_id`. Такая запись физически несёт
только `{"map_id", "started", "ended", "points"}`: поля `source` в ней нет, и
никакой источник из неё не восстанавливается. Поэтому «совместимость
источника» определяется не сравнением с содержимым run, а сравнением routes с
единственным сохранившимся свидетелем прежней подписки — корневым
`marker.vacuum.source`, по которому recorder эту запись и писал (§7.3 явная
конверсия его сохраняет).

#### 11.3.1 Правило усыновления

Чистая функция `adoptLegacyRun(run, routes, rootSource)` (модуль
`src/vacuum-routes.ts`, побайтово зеркалится в `trails.py`). Вход — только
сохранённые данные, поэтому результат детерминирован и проверяется unit-тестом
без HA.

Кандидатами считаются routes **того же marker**, для которых верно:

1. `route.map_id === run.map_id` — строгое строковое равенство по тому же
   nullish-контракту, что и в §8.2 (`0`, `"0"`, `""` значимы);
2. отбор по источнику: если `rootSource` — непустая строка, дополнительно
   требуется `route.source === rootSource`; если корневой source отсутствует
   (пуст, удалён), условие 2 **не применяется** — второго свидетеля нет, и
   отбор ведётся только по `map_id`.

Исход:

- ровно один кандидат → run рисуется в `route.space` с калибровкой этого
  route; `route_id` в хранилище при этом **не** дописывается;
- ноль кандидатов → `orphan_run`;
- больше одного кандидата → `ambiguous_run`.

Оба отрицательных исхода fail-closed: run не рисуется ни в одном пространстве,
guessed route не подставляется, запись не переписывается и не удаляется. В
Device editor обе причины показываются текстом рядом с соответствующей картой.

При полном отсутствии explicit routes поведение прежнее: unique legacy map
matrix и `marker.space` (§7.3), то есть до первой правки routing картина не
меняется байт в байт.

Следующий доказанный point создаёт canonical route-aware current run по §11.1;
прежний legacy run уезжает в previous как есть. Миграция trail Store целиком
не выполняется.

## 12. Lifecycle и перенос

### 12.1 Marker lifecycle

- hide сохраняет routes/calibration/trails, но ничего не рисует;
- removed marker не участвует в recorder/render и при delete очищает trails по
  существующему contract;
- re-add того же binding создаёт свежий marker без resurrection старых routes;
- HA-disabled source/robot сохраняет config, но не выводит stale overlays;
- duplicate legacy markers одного robot binding не объединяются автоматически;
  Device editor показывает diagnostic с рекомендацией оставить один dock
  marker и настроить routes.

### 12.2 Full export/import

- сохраняет routes, ids, exact sources, map ids, target space ids и matrices;
- sources/map ids переносятся буквально, без guessed matching;
- space references валидируются против импортируемого full config;
- trails по действующему общему contract в export не входят;
- foreign HA missing sources отображаются sticky/missing после import.

### 12.3 Space export/import

Space export включает marker дока только когда он принадлежит экспортируемому
space. Для такого marker:

- routes в тот же space включаются;
- cross-space routes исключаются и считаются отдельной строкой preview/export
  summary;
- retained route space remap-ится на новый imported space;
- source/map id/route id/matrix сохраняются буквально;
- payload с route на отсутствующий внешний space отклоняется, не создаёт orphan.

Экспорт пространства, где есть только live route, но нет dock marker, не
создаёт копию робота: one-marker doctrine важнее частичного переноса.

## 13. I18n, accessibility и touch

Минимальная семантика новых RU/EN keys:

- section/title/hint maps;
- current map и add current/source actions;
- source/map id/space/calibration column labels;
- statuses ready, needs calibration, unmapped, ambiguous, missing space,
  unstable id;
- first/subsequent target-space help;
- space-change/delete confirmations;
- View warning reasons;
- duplicate-marker diagnostic.

Точные имена keys выбирает реализация, RU/EN parity обязательна.

Требования:

- table/list имеет keyboard navigation и обычные associated labels;
- status и active row выражены текстом/icon, не только цветом;
- entity id и raw map id доступны как selectable text;
- warning badge имеет accessible name и не перехватывает tap marker;
- editor desktop-first; touch best effort, но select/actions сохраняют минимум
  touch target и manual fit не регрессирует;
- View/kiosk touch и reduced-motion являются блокирующими.

## 14. Performance, security и observability

- максимум 32 routes per marker;
- resolver O(vacuum routes + exact sources), без глобального camera scan на
  каждом HA tick;
- «Все камеры» остаётся ленивым и открывается только пользователем;
- subscriptions deduplicate source/vacuum entity ids;
- render snapshot включает exact route sources, но не весь `hass.states`;
- route resolution вычисляется один раз на immutable frame и потребляется
  dock warning, puck и trail;
- unbounded cache/timer per route запрещён;
- entity ids, map ids и room names не отправляются наружу и не добавляются в
  telemetry; backend logs сохраняют действующую redaction/health policy;
- permissions и HA service calls не меняются;
- общий pre-beta performance gate обязан подтвердить отсутствие regressions
  large-house/continuous updates.

## 15. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Один dynamic source с `m1/m2` создаёт два routes на разные spaces и сохраняет exact source/map/space | unit + browser smoke |
| AC2 | Dock остаётся на floor 1, а live puck/current path для `m2` видны только на floor 2 | multi-space smoke + golden |
| AC3 | При возврате `m1` overlay возвращается на floor 1 без перемещения dock marker или переписывания route | smoke |
| AC4 | Separate cameras с различимыми map ids выбираются по exact route, order permutation не влияет | unit shared fixture |
| AC5 | Два одновременно подходящих sources дают `ambiguous`; guessed puck/path отсутствуют, dock badge виден во время движения | unit + smoke + golden |
| AC6 | Unmapped current map и route без calibration ничего не рисуют на guessed floor, но различимо сообщаются в editor и View | unit + smoke |
| AC7 | `default`, `0`, `"0"`, `""` сохраняют nullish semantics; unstable default получает warning | TS/Python shared fixture |
| AC8 | Auto/manual calibration использует rooms/viewBox/cell size target `route.space`, а не dock space | unit + smoke |
| AC9 | Space change подтверждается, создаёт новую route identity, сбрасывает matrix и удаляет только old-route trails; Cancel ничего не меняет | frontend + backend tests |
| AC10 | Previous run режима `always` виден в space своего route после перехода robot на другую карту | backend unit + multi-space smoke |
| AC11 | Reload и warm remount продолжают active canonical run без bridge/duplicate и сохраняют routing | backend + browser smoke |
| AC12 | Два робота на разных floors не смешивают sources, routes, runtime, current/previous trails или warnings | unit + smoke |
| AC13 | Legacy `source + calibration` работает byte-for-byte до routing edit; explicit conversion включает все matrices и не бывает partial | unit/backend compatibility tests |
| AC14 | `adoptLegacyRun(run, routes, rootSource)` (§11.3.1) даёт ровно три исхода: unique → рисуется в `route.space`; `orphan_run` и `ambiguous_run` → не рисуются нигде и не переписывают хранилище. Отбор по `rootSource` отключается, когда корневой source пуст | TS/backend unit на общей фикстуре |
| AC15 | Full import round-trips routes; space import remap-ит local routes и исключает cross-space routes с preview evidence | backend import/export tests |
| AC16 | Удаление target space явно сообщает count и атомарно удаляет routes/route-runs, не трогая dock/other routes | frontend + backend test |
| AC17 | Hidden/removed/HA-disabled/static-icon vacuum не создаёт live overlay/warning; exact restored source возобновляет route | regression unit/smoke |
| AC18 | #162 не создаёт room highlight; route result exposes route id/space для будущей #12 | source review + unit API test |
| AC19 | RU/EN parity, keyboard, touch targets и reduced-motion warning проходят | unit + smoke/review |
| AC20 | typecheck, unit/backend и build зелёные; pre-beta smoke/golden/performance проходят по runbook | command/CI evidence |

## 16. Тест-план

### 16.1 TypeScript unit

Pure route resolver matrix:

- same source m1/m2;
- two sources with unique ids;
- two sources `default`: one positive, two positive, none;
- order permutations;
- missing/disabled/unavailable/unverified source;
- unmapped, missing space, missing/invalid matrix;
- zero/empty IDs;
- two robots with identical map names;
- legacy effective routes and partial-migration rejection;
- active/current/previous route space projection;
- config immutability and deterministic route sorting.

`render-device-snapshot` verifies inclusion of all exact route sources and no
unrelated camera states.

### 16.2 Backend unit

- schema bounds, duplicate id/pair, finite matrix, referential space;
- change-aware broken-read cases for config/set/optimize/import;
- TrailBook route change and legacy run;
- recorder subscribes deduplicated route sources;
- ambiguity does not write;
- current run survives restart;
- route delete/space delete GC and marker delete whole-book cleanup;
- health incidents independently key routes without warning storms;
- shared TS/Python route fixture;
- full/space import matrix from AC15.

### 16.3 Browser smoke

Добавить канонический `smoke_vacuum_multifloor` либо расширить vacuum smoke
отдельным сценарием:

1. spaces f1/f2, dock на f1, dynamic camera с m1;
2. add current route f1, calibrate;
3. switch m2, add route f2, manual/auto calibrate;
4. cleaning m2: f1 показывает только dock, f2 — puck/current trail;
5. switch m1: overlay переходит f1 без duplicate;
6. `always`: previous run остаётся на собственном floor;
7. unmapped m3 и ambiguous cameras дают dock warning, no guessed overlay;
8. reload + warm remount;
9. second vacuum independent;
10. route/space delete and Cancel/confirm;
11. keyboard and touch sanity;
12. hidden/static/disabled regressions.

### 16.4 Golden

Reviewed evidence:

- Device editor maps block с двумя routes и active/current status;
- Flat dark: dock f1, live robot f2;
- Flat light: moving routing warning badge;
- скрытая Iso: live robot на target floor без изменения существующего puck
  style;
- reduced-motion warning state.

Unrelated flat/iso baselines не обновляются. Baseline acceptance выполняется
только штатным reviewed flow перед бетой.

### 16.5 Мутанты защитных контрактов

Правило §3.4.3. Для каждого пункта прогоняется штатный
`node scripts/mutation-gate.mjs` и в PR прикладывается его вывод:

| Мутант | Что ломаем | Какой тест обязан покраснеть |
|---|---|---|
| M-A | резолвер возвращает первый совпавший route вместо `ambiguous` | unit ambiguity + smoke «двух активных карт» |
| M-B | `missing_space` трактуется как dock space | unit + smoke «удалённое пространство» |
| M-C | `unmapped` рисует puck по последней известной матрице | unit + golden |
| M-D | semantic validator пропускает дубль пары `(source, map_id)` | unit валидации + import test |
| M-E | смена target space сохраняет старую matrix | frontend unit + backend GC test |
| M-F | recorder пишет run без route id (как сегодня) | backend unit + legacy-read test |
| M-G | legacy-конверсия переносит только текущую матрицу | compatibility unit |
| M-H | `adoptLegacyRun` при двух кандидатах берёт первый вместо `ambiguous_run` | unit §11.3.1 + backend read-compat |

Мутант, который не покраснел, означает дефект теста, а не доказательство
корректности: перед сдачей каждый из восьми обязан быть проверен отрицательным
прогоном.

### 16.6 Команды и момент запуска

В цикле реализации:

```text
npm run typecheck
npm test
npm run build
python -m pytest tests_backend
```

Golden, browser smoke и performance запускаются перед бетой. Полный HA harness
канонически выполняется в Linux CI; Windows `fcntl` не заменяется обходом.

## 17. План реализации

Разбит на коммиты так, чтобы каждый был отдельно проверяем, а ядровые файлы не
росли (§3.4.1).

1. `src/vacuum-routes.ts`: типы, semantic validation, чтение legacy как
   effective routes, pure route resolver + shared TS/Python фикстуры.
   Мутанты M-A…M-D. Ядра не меняются.
2. Снимок: `render-device-snapshot.ts` отдаёт route resolution; локальный
   runtime получает route identity. Ядра — только вызовы.
3. Рендер: overlay перестаёт зависеть от dock-space фильтра устройств;
   dock остаётся в `marker.space`. Golden + multi-floor smoke.
4. Backend: route-aware TrailBook/Recorder, чтение legacy runs, GC.
   Мутанты M-F, M-E (серверная половина).
5. Редакторский модуль: блок «Карты и этажи», добавление текущей карты,
   отдельная camera, калибровка в target space, смена space и удаление.
   Мутанты M-E (клиентская половина), M-G.
6. Fail-visible badge у дока и accessibility.
7. Space deletion (через `space-deletion.ts`) и full/space import-export.
8. Документация, i18n RU/EN и release artifacts.

После каждого коммита с изменением `src/**` — `npm run docs:capture` и
`check-docs` (правило из #330/#331: узкая дельта слепа к реальному плану).

## 18. Release-артефакты

В user-visible class A/B commit обязательны:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — заменить неверное multi-space обещание точным flow;
- `docs/VACUUM.md` — map route/source/status/trail contract;
- `docs/ARCHITECTURE.md` — route authority и snapshot/backend boundary;
- `docs/CONFIG-COMPATIBILITY.md` — legacy matrix, import и downgrade;
- `docs/TESTING.md` — multi-floor smoke/golden route;
- reviewed golden artifacts и issue/PR evidence.

Терминальные trailers:

```text
Issue: #162
User-Visible: yes
```

## 19. Риски и меры

| Риск | Мера |
|---|---|
| Один map id у разных cameras | array routes + exact source + stable route id |
| Stale camera выбирает неверный floor | exact observed ID, ambiguity fail-closed, no freshness guess |
| Live overlay остаётся dock-filtered | отдельная all-vacuum route projection и multi-space smoke |
| Map switch соединяет этажи линией | route-aware run split и no-bridge tests |
| Recalibration портит trails | raw points + stable route id; matrix только projection |
| Space change показывает old trail новой matrix | new route id + route-run GC after confirm |
| Legacy config теряет matrices | lazy all-or-nothing conversion, no migration on unrelated Save |
| Old run выбирает wrong route | unique-only legacy match |
| Space export оставляет cross-space ref | explicit exclusion + preview count + backend validation |
| `default` создаёт ложную уверенность | single-map warning and ambiguity state |
| #12 создаёт второй floor resolver | route API boundary и явная dependency |
| Large registry ухудшает tick | exact route sources, cap 32, lazy global picker |
| Duplicate legacy markers показывают два robots | diagnostic, no new duplicate creation, no unsafe auto-merge |

## 20. Откат и downgrade

Новый backend принимает `map_routes`; старый backend schema его не знает.
Поэтому полный downgrade на pre-#162 backend после canonical write не считается
безопасным.

Безопасный rollback релиза:

1. сохранить read/schema/import support `map_routes` и отключить только новый UI
   и route rendering либо исправить feature флагом;
2. не преобразовывать routes обратно в один legacy dictionary автоматически:
   это потеряет target spaces и sources;
3. при ручном downgrade пользователь сначала оставляет один route на dock space,
   затем экспортирует его как legacy source/calibration;
4. unknown route fields не удаляются несвязанным Save.

Старый frontend с новым backend не должен падать: он игнорирует `map_routes`, но
не обязан показывать multi-floor live overlay. Это ограничение явно входит в
CONFIG-COMPATIBILITY и release notes.

## 21. Принятые технические предположения

- имя persisted поля — `map_routes`, route id имеет локальный `vr_` prefix;
- route source обязателен и exact; root source остаётся discovery default;
- список интеграционных карт нельзя получить универсально, поэтому UI работает
  с current observed map и explicit camera selection;
- first route defaults to dock space, subsequent route требует выбора;
- source/map identity read-only после Save; correction = delete + add;
- space change считается новой route identity и очищает derived runs;
- View warning показывается только во время moving state, editor status — всегда;
- route limit 32 достаточен для бытового робота и защищает tick/subscriptions;
- `default` остаётся valid single-map id, но не multi-floor guarantee;
- `room_highlight/segment_map` не получают runtime consumer в #162;
- space export не клонирует robot marker, если в space есть только live route;
- duplicate legacy markers не мигрируют и не объединяются автоматически;
- Static space card сохраняет отсутствие live vacuum overlays;
- редакция 2: новый код размещается в `src/vacuum-routes.ts` и отдельном
  ленивом редакторском модуле; имена модулей могут уточниться в ревью, но
  запрет на рост ядровых файлов — нормативен;
- редакция 2: `repairSpaceReferences()` не восстанавливает `space` у routes
  сам по себе; за это отвечает явный код #162;
- редакция 2 (правка r1): единственный свидетель источника legacy run —
  корневой `marker.vacuum.source`; при его отсутствии отбор ведётся только по
  `map_id`, а неоднозначность закрывается наглухо, а не разрешается эвристикой.
