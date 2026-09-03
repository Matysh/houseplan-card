# ТЗ #443 — Полиш маршрутов карт робота

- Issue: https://github.com/Matysh/houseplan-card/issues/443
- Приоритет: P3, `bug` / `polish` / `vacuum`
- Статус ТЗ: готово к ревью
- Маршрут: full; меняются frontend и backend semantics, single-space export,
  локализованный Device editor и performance-sensitive render snapshot
- Связанные контракты: #162 (маршрутизация карт по пространствам), #441
  (атомарное добавление новой карты робота)

## Сценарий

Home admin удаляет у робота последний явный маршрут карты, редактирует старую
конфигурацию с маршрутами в удалённые пространства либо показывает большой
многоэтажный план с сотнями устройств. Пустой список маршрутов должен означать
осознанное отсутствие маршрутов, строки с потерянным пространством должны быть
понятно собраны, а View не должен повторно просматривать все не относящиеся к
роботам устройства ради vacuum overlay.

## Что человек увидит до и после

**До:** `map_routes: []` может снова включить оставшийся legacy `calibration` и
показать робота/карту там, откуда пользователь удалил маршрут. При экспорте
одного пространства отфильтрованный до пустоты список может превратиться в
`null` и создать тот же эффект после импорта. Маршруты в удалённые пространства
помечены построчно и оказываются в конце, но визуально не образуют явную группу.
Каждый render vacuum layer ещё раз перебирает все устройства плана.

**После:** любой массив `map_routes`, включая пустой, является явной authority;
legacy fallback действует только при отсутствующем или `null` поле. Экспорт не
теряет осознанную пустоту. Потерянные маршруты собраны в локализованную группу
«Пространство удалено», остаются редактируемыми и имеют стабильный порядок.
Vacuum renderer получает сохранённый в snapshot список только роботов, сохраняя
межэтажные маршруты и визуальное поведение.

## Подтверждённая проблема

1. `src/vacuum-routes.ts::effectiveRoutes()` и
   `custom_components/houseplan/vacuum_routes.py::effective_routes()` выбирают
   explicit routes только при непустом массиве/списке. Это противоречит #162
   §7.3 и `docs/VACUUM.md`: наличие `map_routes` как массива уже означает
   единственную route authority.
2. Single-space export в `custom_components/houseplan/import_export.py`
   записывает `kept_routes or None`. Когда все маршруты отфильтрованы, явная
   пустота теряется, а оставшийся в marker legacy `calibration` может ожить при
   последующем чтении.
3. Заявленная в issue случайная перестановка missing-space строк по коду не
   подтверждается: comparator уже детерминирован по space order, `map_id` и
   source, а schema запрещает повтор пары source/map. Подтверждён UX-недочёт:
   строки лишь неявно идут в конце и не имеют отдельной группы.
4. `_captureRenderDeviceSnapshot()` уже обходит все устройства и рассчитывает
   vacuum facts. Затем `_renderVacuums(this._renderDevices, ...)` повторно
   перебирает весь device roster, хотя vacuum renderer нужны только роботы.

## Скоуп

В скоупе:

- единая frontend/backend семантика absent, `null`, пустого и непустого
  `map_routes`;
- сохранение явного пустого массива при single-space export;
- явная локализованная группа строк, чьё `space_id` больше не существует;
- стабильный порядок валидных и потерянных маршрутов;
- vacuum-only subset в immutable render snapshot и его использование слоем
  vacuum overlay;
- сохранение межэтажного отображения робота, hidden/static правил и continuity
  при временном отсутствии нового snapshot;
- unit, backend, browser smoke, mutation и performance evidence;
- актуализация документации и обоих changelog.

## Не-скоуп

- новый каталог vacuum integrations, обнаружение карт или изменение протокола
  источников;
- изменение route identity, калибровки, puck/trail/room outline либо команд
  уборки;
- автоматический выбор нового пространства для потерянного маршрута;
- автоматическое удаление missing-space route;
- миграция или eager rewrite сохранённых legacy markers;
- изменение семантики malformed non-array `map_routes`;
- оптимизация остальных проходов по device roster и полный рефактор render
  snapshot;
- изменение удаления пространства за пределами экспортного edge case;
- изменение static space-card UX или редакторов вне vacuum maps section.

## Контракт поведения

### 1. Authority `map_routes`

Frontend и backend используют одну таблицу решений:

| Состояние marker | Эффективные маршруты |
|---|---|
| поле `map_routes` отсутствует | legacy fallback из `calibration`, как сейчас |
| `map_routes: null` | legacy fallback из `calibration`, как сейчас |
| `map_routes: []` | пустой explicit result; legacy полностью игнорируется |
| `map_routes: [ ... ]` | только нормализованные explicit routes; legacy игнорируется |

Проверка должна зависеть от типа массива/списка, а не от его truthiness или
длины. Пустой массив не создаёт overlay, trail, puck или route-space
presentation из legacy calibration.

Malformed non-array значения остаются на прежнем compatibility path; #443 не
расширяет schema и не пытается молча исправлять неизвестные будущие формы.
Никакой фоновой записи конфигурации при чтении не выполняется.

### 2. Single-space export

Если исходный vacuum marker содержит массив `map_routes`, export одного
пространства сохраняет `map_routes` массивом даже тогда, когда фильтрация не
оставила ни одного route. Результат в этом случае — `[]`, а не `null`,
отсутствующее поле или возврат legacy calibration.

Если исходное поле отсутствовало или было `null`, действующее legacy-compatible
поведение не меняется. Экспорт не создаёт synthetic routes и не удаляет
legacy-поля из source marker: безопасность обеспечивается сохранённой explicit
empty authority.

### 3. Группировка потерянных пространств

Device editor показывает маршруты в следующем порядке:

1. маршруты существующих пространств — по текущему порядку spaces, затем по
   `map_id`, source и route id как детерминированному tie-breaker;
2. отдельная группа потерянных маршрутов после всех валидных групп — по
   `map_id`, source и route id.

Группа имеет видимый локализованный заголовок с семантикой «Пространство
удалено». Рекомендуемые строки:

- ru: «Пространство удалено»;
- en: “Deleted space”;
- de: “Gelöschter Bereich”;
- fr: “Espace supprimé”.

Существующая построчная индикация missing-space и общий warning сохраняются:
заголовок помогает сканировать список, но не является единственным объяснением
ошибки. Каждая строка по-прежнему доступна для выбора, редактирования и
удаления; House Plan не угадывает замену пространства. Pending draft добавления
маршрута не смешивается с группой и сохраняет контракт #441.

Если потерянных маршрутов нет, заголовок и дополнительная группа не
рендерятся. Порядок валидных строк визуально не меняется.

### 4. Vacuum-only render snapshot

Capture одного device snapshot формирует immutable vacuum-only subset из той
же согласованной копии device roster, на которой рассчитаны facts. Vacuum
renderer в обычном View перебирает этот subset, а не полный список устройств.

Subset обязан содержать всех роботов плана, а не только устройства текущего
пространства. Поэтому сохраняются:

- показ робота на route-space другого этажа относительно пространства базы;
- выбор map route и route facts из того же snapshot;
- suppression скрытых и static devices;
- отсутствие повторного resolve route authority внутри renderer;
- snapshot continuity: незавершённый новый capture не смешивает старые devices
  с новыми facts.

Fallback полного списка допустим только на существующем snapshot-less
инициализационном/тестовом пути и не должен становиться обычным render path.
Изменение сокращает повторный render scan с `O(N)` до `O(V)`, где `N` — все
device markers, а `V` — vacuum markers; capture остаётся `O(N)` и не обязан
ускоряться в этой задаче.

## Данные и совместимость

- Schema version и persisted shape не меняются; миграции нет.
- Старые конфигурации без `map_routes` и с `map_routes: null` продолжают читать
  legacy `calibration`.
- Уже сохранённый `map_routes: []` меняет только ошибочную read semantics и
  перестаёт оживлять legacy routes.
- Frontend и backend обязаны дать одинаковый результат на четырёх состояниях
  таблицы authority.
- Atomic add/dedup/rollback из #441 не меняются.

## Touch, клавиатура и доступность

Новых жестов и targets нет. Группа missing-space получает обычный
неинтерактивный текстовый заголовок и структурную связь со следующими строками;
состояние не передаётся только цветом. Tab order, действия строк, focus restore
и touch targets остаются прежними. Новая строка проходит en/ru/de/fr completeness
и locale smoke.

## Ошибки, гонки и крайние случаи

| Случай | Ожидаемое поведение |
|---|---|
| `map_routes: []` и непустой legacy `calibration` | 0 effective routes, legacy не читается |
| `map_routes: null` и legacy calibration | прежний legacy route |
| все routes отфильтрованы single-space export | в export остаётся `map_routes: []` |
| один valid и несколько missing routes | valid group первая, затем одна missing-space group со стабильными строками |
| отсутствуют все пространства routes | после draft area показывается только missing-space group; строки редактируемы |
| несколько роботов на разных этажах | subset содержит всех; каждый показывается только по своим route facts |
| roster меняется между HA updates | кадр использует одну immutable snapshot revision без смешения |
| нет captured snapshot | существующий fallback не падает и не фильтрует робота по dock space |
| malformed non-array `map_routes` | прежнее compatibility/fail-closed поведение без новой миграции |

## Acceptance criteria и доказательства

### AC1. Единая route authority

TS unit проверяет absent, `null`, `[]` и non-empty `map_routes` при наличии
legacy calibration. Пустой массив даёт ноль routes; непустой — только explicit;
absent/`null` сохраняют legacy.

### AC2. Backend parity

Python unit прогоняет ту же матрицу и сверяет нормализованные результаты с
frontend contract. Как минимум один отрицательный кейс обязан падать при
возврате старого условия «список непуст».

### AC3. Export не оживляет legacy

Backend import/export test экспортирует одно пространство из marker с explicit
routes, полностью удалёнными фильтром, и оставшимся legacy calibration.
Результат содержит `map_routes: []`; повторное вычисление effective routes после
round-trip даёт пустоту.

### AC4. Понятная и стабильная группа

Browser smoke открывает Device editor с valid и несколькими missing routes,
проверяет порядок групп/строк, единственный локализованный заголовок, warning и
доступность edit/delete. Повторный render и перестановка входного словаря spaces
при том же canonical order не меняют порядок. Pending draft остаётся отдельно.

### AC5. Renderer получает только роботов

Unit/contract test создаёт roster с не-vacuum и vacuum markers и проверяет, что
captured subset immutable, содержит только всех vacuum markers и используется
обычным `_renderVacuums` call site. Renderer не выполняет второй полный scan.

### AC6. Межэтажное и snapshot-поведение сохранено

Существующий multifloor vacuum smoke и cold/live continuity test остаются
зелёными: робот с базой на другом этаже отображается в route-space, hidden и
static suppression прежние, старые devices не смешиваются с новыми facts.
Mutation, возвращающий current-space `devs` в vacuum renderer, обязан уронить
межэтажный witness.

### AC7. Производительность не ухудшена

Large-house профиль 60 rooms / 200 devices на exact SHA проходит действующий
performance smoke и budget. Дополнительный structural witness фиксирует
`V < N` и один vacuum-only render pass; отдельный новый timing budget не
вводится, поскольку изменение сокращает сложность и не добавляет visual work.

### AC8. Совместимость и документация

Typecheck, unit и build зелёные. Перед бетой проходят golden, smoke и
performance по канону процесса; Linux CI является каноном полного HA harness.
`docs/VACUUM.md` явно называет пустой массив authority, оба changelog описывают
пользовательское исправление, en/ru/de/fr dictionaries проходят completeness.

## План тестирования

- расширить TS unit для `effectiveRoutes()` таблицей всех состояний поля;
- расширить backend unit `vacuum_routes` и import/export round-trip;
- добавить/расширить browser smoke vacuum route editor для missing-space group;
- расширить render snapshot unit/contract vacuum-only subset;
- сохранить и прогнать multifloor/cold-view vacuum smokes;
- обновить `scripts/mutation-gate.mjs`: explicit-empty mutant возвращает старую
  проверку длины и краснеет; cross-floor mutant подменяет vacuum subset на
  current-space devices и краснеет;
- в implementation loop запускать только `typecheck`, `unit`, `build`; golden,
  smoke и performance запускать перед бетой согласно runbook.

## Карта реализации

- `src/vacuum-routes.ts` — array presence вместо non-empty selection;
- `custom_components/houseplan/vacuum_routes.py` — backend parity;
- `custom_components/houseplan/import_export.py` — сохранение explicit empty;
- `src/editors/vacuum-maps-section.ts` — partitions/groups и stable tie-breaker;
- `src/locales/{en,ru,de,fr}.ts` — заголовок missing-space group;
- `src/render-device-snapshot.ts` и `src/houseplan-card.ts` — immutable
  vacuum-only subset и renderer call site;
- `test/`, `tests_backend/`, `demo/`, `scripts/mutation-gate.mjs` — witnesses;
- `docs/VACUUM.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — release
  artifacts.

## Риски и rollback

- Главный compatibility risk — ошибочно отключить legacy fallback для absent или
  `null`; его закрывает одинаковая четырёхстрочная матрица в TS и Python.
- Главный render risk — отфильтровать робота по текущему пространству/этажу;
  subset строится глобально, а cross-floor mutant обязан краснеть.
- Главный snapshot risk — создать subset из другого поколения devices; список
  формируется и замораживается вместе с основной snapshot revision.
- UI-группа может нарушить focus/order; smoke проверяет интерактивные строки, а
  заголовок остаётся неинтерактивным.
- Rollback code path не требует data rollback: schema не меняется. Возврат
  implementation не переписывает сохранённые конфигурации.

## Release-артефакты

- Обязательны записи в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же
  user-visible коммите.
- Обновляется `docs/VACUUM.md` для явного empty-array/export контракта.
- Изменение Device editor требует browser screenshot/smoke evidence в
  light/dark темах; новый постоянный golden добавляется только если этот экран
  уже входит в canonical golden surface, иначе review artifact прикладывается
  к issue без расширения baseline.
- Перед бетой обязательны штатные golden, smoke и full performance artifacts;
  новый security artifact не требуется.

## Принятые предположения

- Явный массив `map_routes` является authority независимо от длины — это уже
  принятое решение #162, а не новый вопрос.
- Требование issue «явная группа» означает отдельный локализованный заголовок
  после всех валидных пространств; действия строк не меняются.
- Исправление производительности ограничено устранением второго полного обхода:
  отдельный новый latency threshold без подтверждённой деградации не нужен.
- `map_routes: null` остаётся legacy-compatible, чтобы не создавать скрытую
  миграцию старых конфигураций.
