# Issue #224 — Канонические координаты на каждой записи

- Дата: 2026-08-22
- Тип: bug / storage invariant · приоритет P1
- Оценка: пользовательская ценность 6/10 · ценность для разработки 8/10 · сложность 5/10 · риск 5/10
- Issue: [#224](https://github.com/Matysh/houseplan-card/issues/224)
- Ветка: `issue/224-config-coordinate-canonicalization`

Канонические документы: `docs/SCOPE.md`, `docs/CANVAS.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md`,
`docs/TESTING.md`. Связанные задачи: #218 и #223.

## 1. Сценарий, персона и момент

Администратор много раз редактирует реальный план: делит и меняет комнаты,
перемещает проёмы, стены, декор и устройства, импортирует или восстанавливает
план. Обычная арифметика JavaScript создаёт числа, которые описывают одну точку,
но отличаются последними битами IEEE-754. Пользователь этого не видит и не
должен обслуживать вручную: после любой штатной записи House Plan хранит одну
устойчивую форму геометрии.

Сценарий относится к `docs/SCOPE.md` J6: план остаётся достоверным при развитии
дома и повторных правках. #218 оставляет потребителя устойчивым к старым данным,
#223 вручную очищает уже накопленный шум, а #224 не даёт новому шуму закрепиться.

## 2. Что человек увидит до и после

**До:** визуально одинаковые общие вершины могут сохраниться как разные double.
Через много правок это статистически ломает объединение комнат, Glow и другие
геометрические операции. Для уже повреждённого плана требуется Optimize.

**После:** Save, перемещение устройства, импорт, Optimize/Undo и восстановление
после перезапуска сохраняют геометрию в одной числовой форме. Внешний вид и
точность размещения не меняются; планы, уже содержащие шум, очищаются при
следующей записи либо сразу явной кнопкой Optimize из #223.

Нового UI, уведомления или настройки нет.

## 3. Подтверждённая причина

В backend `_COORD`, `_GEOM`, extents, углы и масштабы проверяют конечность и
диапазон, но возвращают исходный `float`. `CONFIG_SCHEMA`, `LAYOUT_SCHEMA`
и `POS_SCHEMA` поэтому пропускают ULP-шум без изменения.

Frontend `_writeConfig()` отправляет текущий mutable `_serverCfg`, а
`_persistLayout()` — текущую позицию. Сервер не возвращает канонический
payload, и карточка обновляет только revision. Даже если очистить данные лишь
на backend, открытая вкладка продолжит считать геометрию по сырому локальному
объекту до перезагрузки.

Кроме обычных WebSocket-команд, `async_save_config_state()` и
`async_save_layout_state()` вызываются импортом, Optimize/Undo, startup
recovery, setup migration и geometry repair. Один guard только в декораторе
WebSocket не даёт абсолютной гарантии.

## 4. Scope

- единый чистый контракт квантования в Python и TypeScript;
- явная канонизация геометрических полей в `CONFIG_SCHEMA`,
  `LAYOUT_SCHEMA` и `POS_SCHEMA`;
- общий storage barrier для всех внутренних config/layout writers;
- канонизация локального frontend config и layout до отправки;
- одинаковый allowlist полей на обеих сторонах, без рекурсивного обхода всех
  чисел;
- no-op для повторной обычной записи того же канонического config/layout без
  новой ревизии, store write, event или потери Undo-снимка;
- lazy-очистка старых данных при следующей записи и совместимость с #223;
- общая fixture, backend/frontend unit tests и mutation guards;
- документация числового storage-инварианта.

## 5. Non-scope

- фоновая или startup-миграция всех существующих планов;
- привязка произвольной геометрии к узлам сетки либо изменение `snapN()`;
- изменение `GRID_STEP_N`, `cell_cm`, координатной системы, допустимых
  диапазонов или model/storage version;
- ослабление защитных сравнений и union-fallback из #218;
- канонизация live HA states, температуры, влажности, яркости или LQI;
- изменение vacuum affine calibration;
- новый UI, i18n-строки, toast, warning или telemetry;
- общая pre-write проверка топологии плана из #199;
- исправление самостоятельных geometry bugs, обнаруженных тестовой fixture.

## 6. Числовой контракт

### 6.1 Одна операция

Для конечного числа `v` из allowlist:

```text
factor = 1_000_000_000
q = sign(v) * floor(abs(v) * factor + 0.5) / factor
result = 0, если q == 0, иначе q
```

Это округление до **9 десятичных знаков**, ближайшая половина — от нуля,
`-0` нормализуется в `+0`. Встроенные Python `round` и JavaScript
`Math.round` не являются контрактом: их tie-поведение различается.

Все канонизируемые значения ограничены так, что `abs(v) * factor` остаётся
ниже `Number.MAX_SAFE_INTEGER`. Повторное применение даёт тот же IEEE-754
double. При максимальном `cell_cm=1000` сдвиг координаты не превышает примерно
`0,00012 см` (1,2 мкм); для угла — `5e-10°`. Это квантование
представления, не snapping к сетке.

Невалидные числа по-прежнему отклоняет существующая schema. Чистый frontend
helper не исправляет `NaN`/Infinity и не расширяет диапазоны: вне schema он
оставляет нечисловое/не-конечное поле как есть, чтобы сервер оставался
авторитетом валидации.

### 6.2 Явный allowlist

| Объект | Канонизируются |
|---|---|
| `spaces[]` | `plan_x`, `plan_y`, `plan_scale`, `plan_scale_x`, `plan_scale_y`, `plan_angle` |
| `rooms[]` | rect `x/y/w/h`; каждая компонента `poly[][]` |
| `walls[]` | компоненты exact endpoints `a/b` |
| `openings[]` | `x/y/angle/length`; `host.t` |
| `decor[]` line | `x1/y1/x2/y2` |
| `decor[]` rect/ellipse/furniture | `x/y/w/h/angle` |
| `decor[]` text | `x/y/scale/angle` |
| `room_drafts[]` | компоненты `points[][]` |
| `partitions[]` | компоненты `a/b` |
| `wall_columns[]` | компоненты `center`; square `angle` |
| `open_spans[]` | компоненты `a/b` |
| `markers[]` | `angle` |
| layout records | только `x/y` |

Отсутствующие optional-поля не материализуются. Массивы, порядок объектов,
строки, boolean, `null` и неизвестные/future поля сохраняются.

### 6.3 Явный negative contract

Не меняются:

- `cell_cm`, `plan_aspect` и все четыре компоненты `view_box`;
- физические `cm`/`*_cm`, ширина линий, размер текста в сантиметрах;
- `settings`: opacity, fill alpha, temperature limits, compass north,
  font/presentation scales и прочие числовые настройки;
- marker `size`, `ripple_size`, `glow_radius_cm`, brightness и value data;
- все шесть коэффициентов каждой `vacuum.calibration[map_id]`;
- layout `s`, `k` и любые неизвестные metadata fields;
- цвета и любые числа внутри неизвестных extension objects.

## 7. Write barriers и revisions

### 7.1 Backend schema

Один pure Python helper выполняет allowlist traversal после структурной
валидации. Его используют `CONFIG_SCHEMA`, `LAYOUT_SCHEMA` и
`POS_SCHEMA`, поэтому карточка, импорт, ручной клиент и будущие endpoints
получают одинаковый результат. Helper не мутирует вход.

### 7.2 Общий storage barrier

`async_save_config_state()` и `async_save_layout_state()` повторно применяют
тот же idempotent helper к live `config`/`layout` перед сборкой store
payload. Это защищает внутренних writers, которые законно обходят WebSocket
schema. Возвращаемый payload содержит именно записанный канонический объект;
dependent reconciliation получает его же.

Известные recovery snapshots создаются уже каноническими:

- `optimize_backup.config/layout`;
- `optimize_pending.config/layout`;
- `repair_backup.positions`.

Старый noisy snapshot, найденный при startup recovery, может быть прочитан, но
его live target проходит barrier до записи. Он не способен вернуть шум в
доступные через `config/get` или `layout/get` данные.

Никакой рекурсивной канонизации произвольной metadata store не выполняется.

### 7.3 Обычная no-op запись

Для `config/set`, `layout/set` и `layout/update` порядок такой:

1. authentication, size/range/schema и CAS-проверки выполняются как раньше;
2. semantic delta validation выполняется относительно текущего объекта;
3. server сравнивает канонический live candidate с текущим live payload;
4. при равенстве отвечает `ok: true` с текущим `rev`;
5. store не пишется, revision не растёт, update event не публикуется,
   Optimize/Import Undo snapshot не удаляется и file collection не запускается.

Неверный `expected_rev` остаётся конфликтом даже для совпадающего payload:
no-op не превращается в обход optimistic locking. У
`layout/update` по-прежнему нет нового CAS-поля; равенство проверяется под
общим `write_lock`.

Команды с собственной наблюдаемой транзакцией — import apply,
Optimize/Undo, geometry repair/Undo и migrations — сохраняют существующую
семантику revisions. Канонизация сама по себе не добавляет им дополнительную
ревизию.

## 8. Frontend convergence

Новый pure TypeScript helper зеркалит Python contract и allowlist.
`_writeConfig()` перед `callWS`:

1. удаляет legacy segments как сейчас;
2. строит канонический immutable candidate;
3. принимает candidate в `_serverCfg` до отправки и синхронно инвалидирует
   geometry-derived caches/epoch;
4. отправляет ровно этот объект.

Принятие происходит до `await`, поэтому ответ более ранней записи не
перетирает правки, сделанные во время запроса. Очередь и debounce сохраняются.
Если после первой отправки появились новые правки, следующий элемент очереди
канонизирует актуальный `_serverCfg`.

`_persistLayout()` канонизирует `x/y` каждой dirty position, записывает тот
же record в `_layout`, `_sentPos`, server request и cached snapshot.
`s`, `k` и future fields сохраняются. Local-storage fallback также хранит
канонический layout. Никакой server echo нового payload не вводится.

## 9. Optimize, импорт и Undo

Import preview/apply уже проходит `CONFIG_SCHEMA`/`LAYOUT_SCHEMA`; тест
фиксирует, что внешний JSON с noisy geometry даёт канонический candidate и
live store. Экспорт может выдавать канонизированную копию, но не меняет store
и revision.

Optimize из #223 остаётся способом немедленно обработать старый план и
показать отдельный счётчик. После #224 обычные последующие записи уже не
накапливают новый ULP-шум.

Undo восстанавливает прежнюю **семантическую геометрию и неизвестные поля**, но
не исходные noisy bits. Снимок создаётся каноническим, а storage barrier
остаётся последней защитой. Поэтому прежняя формулировка #223 «Undo restores
the original noisy bits» заменяется в канонических документах на «Undo restores
the original geometry in canonical representation». Пользовательский срок
жизни, one-deep slot, freshness guard и доступность Undo не меняются.

## 10. Data compatibility, migration и losslessness

Формат остаётся JSON number, новые persisted-поля не добавляются,
`PLAN_MODEL_VERSION` и версии Store не меняются. Старые карточки читают
канонические значения как обычные валидные числа.

При загрузке старый live store не переписывается и revision не меняется.
Первая последующая запись объекта канонизирует весь allowlist этого config или
layout. Для немедленной массовой очистки пользователь запускает #223.

Канонизация copy-on-write: входные объекты и recovery candidates не мутируются.
Unknown/future поля и их числовые значения сохраняются побитово. Порядок
массивов и ключей не является частью контракта, но реализация не должна
намеренно пересортировывать их.

## 11. i18n, accessibility и security

Новых строк и элементов интерфейса нет; keyboard, touch, focus и screen-reader
контракты не меняются. Golden должен остаться визуально прежним.

Backend остаётся единственным авторитетом authentication, permission, limits,
semantic validation и optimistic locking. Helper не исполняет строки, не
обходит schema, не добавляет внешних запросов и не раскрывает данные.

## 12. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Python и TypeScript округляют noisy, positive/negative tie, boundary и `-0` до exact одинаковых double при точности 9. | Общая JSON fixture; backend и frontend focused units. |
| AC2 | `CONFIG_SCHEMA`, `LAYOUT_SCHEMA`, `POS_SCHEMA` канонизируют все и только allowlist-поля §6.2. | Parameterized schema matrix + negative matrix §6.3. |
| AC3 | Повторная канонизация идемпотентна и не мутирует input; unknown fields сохраняются. | Deep-freeze/identity units на обеих сторонах. |
| AC4 | `config/set`, `layout/set`, `layout/update`: первая noisy-запись создаёт одну canonical revision; повторная canonical запись возвращает тот же rev без save/event/Undo invalidation. | HA websocket tests со spy store/event bus; stale CAS negative case. |
| AC5 | Прямые storage writers сохраняют canonical live config/layout и передают exact config в virtual-light reconciliation. | Focused store unit с обходом schema. |
| AC6 | Frontend после начала Save держит тот же canonical config/layout, который отправлен; правка во время in-flight write не теряется. | Queue/debounce unit с controlled promises. |
| AC7 | Import внешнего noisy JSON даёт canonical preview/candidate/store; startup recovery не возвращает шум. | Backend import/recovery tests; mutant `import-path-bypasses-schema`. |
| AC8 | Optimize и Optimize/Import/repair Undo сохраняют прежнюю семантическую геометрию, one-deep lifecycle и unknown fields, но live result canonical. | Existing transaction tests + noisy snapshot variants. |
| AC9 | Fixture из #218 после schema/write имеет совпадающие общие вершины; union и Glow clip-path не пусты. | Frontend geometry regression на реальной fixture + backend fixture parity. |
| AC10 | Диагональные и off-grid объекты с отличием больше шага квантования не прилипают к сетке; максимальный сдвиг укладывается в §6.1. | Numeric tolerance unit. |
| AC11 | Temperature/brightness/colors, calibration, view_box, physical sizes и presentation scales сохраняются exact. | Negative fixture и mutant `quantization-hits-allowlist`. |
| AC12 | Visual golden не меняется; три bundle-копии синхронны. | Предрелизный golden verify и bundle parity. |
| AC13 | Implementation gates зелёные. | `typecheck`, `unit`, `build`; full golden/smoke/performance — перед бетой. |

## 13. План реализации и автотестов

1. Добавить pure Python и TypeScript modules с одной именованной precision
   constant, scalar helper и явными config/layout walkers.
2. Подключить Python walkers к трём schema и двум storage helpers.
3. Добавить no-op branches в три обычных WebSocket writer-а после CAS и
   semantic checks, но до save/cleanup/events.
4. Подключить frontend helper к `_writeConfig()`, dirty layout и localStorage.
5. Канонизировать известные recovery snapshots при создании; обновить
   Optimize/Import/repair recovery tests.
6. Создать общую fixture в `test/fixtures/`: noisy allowlist, tie/`-0`,
   полный denylist и expected object. Оба runner-а читают один файл.
7. Добавить regression fixture #218, import/recovery/no-op tests и четыре
   mutation entries из issue.
8. Обновить canonical docs и release artifacts.

Mutation IDs:

- `schema-quantization-removed`;
- `frontend-writes-raw-coords`;
- `quantization-hits-allowlist`;
- `import-path-bypasses-schema`.

В implementation-цикле выполняются только `typecheck`, `unit`, `build`.
Golden, smoke и performance выполняются общими gate-ами перед бетой. Linux CI
остаётся каноном полного HA-harness.

## 14. Риски, performance и rollback

| Риск | Мера |
|---|---|
| Python/JS расходятся на половинах или negative zero | Явная формула вместо native round; одна fixture; exact double assertions. |
| Walker задевает пользовательские данные | Закрытый allowlist, denylist fixture, unknown numeric sentinel и mutant. |
| Внутренний writer обходит schema | Повторный idempotent storage barrier и прямые store/recovery tests. |
| No-op обходит CAS или съедает Undo | CAS до equality; spy tests на save/event/metadata. |
| Frontend принимает устаревший snapshot | Candidate принимается до await; controlled concurrent-write test. |
| Undo #223 снова вносит шум | Канонический snapshot плюс storage barrier; обновлённый regression contract. |
| Большой config дорожает на Save | Один линейный allowlist traversal; лимит config 2 MB; без работы в render/live-state tick. |

Время — `O(n)` по persisted geometry, память — `O(n)` только для изменяемого
candidate; point layout frontend остаётся `O(1)`, backend и сейчас сериализует
весь layout store. Отдельный runtime performance baseline не вводится; общий
предрелизный gate обязан остаться зелёным.

Rollback — revert implementation-коммита. Уже канонизированные значения
валидны для старой версии и не требуют обратной миграции. Возвращать потерянные
последние биты бессмысленно и невозможно, но это не пользовательские данные:
максимальное изменение ограничено §6.1.

## 15. Release-артефакты

Изменение пользовательски значимо как исправление долговечности плана.
Implementation-коммит имеет `User-Visible: yes` и включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #224;
- `docs/CANVAS.md` — storage canonicalisation против grid snapping;
- `docs/CONFIG-COMPATIBILITY.md` — lazy, lossless write contract;
- `docs/USER-GUIDE.ru.md` — обычные записи предотвращают новый шум, Optimize
  обслуживает старые данные;
- `docs/TESTING.md` — no-op/schema/import/Undo/mutation coverage и исправление
  прежней формулировки #223;
- `docs/STATUS.md` — фактическая unreleased-линия;
- unit fixtures, mutation entries и синхронные production bundles.

Новых i18n, screenshots, golden baseline, schema migration, security artifact
или отдельного performance artifact нет. Перед бетой выполняются общие
golden/smoke/performance gates.

## 16. Принятые технические предположения

Принято предположительно, поменять свободно на ревью ТЗ:

1. Точность 9 знаков едина для координат, normalized extents, углов и
   геометрических scale. Переход на 10–12 меняет constants/fixture и оценку
   максимального сдвига, но не UX или формат.
2. Marker `angle` и backdrop/decor transforms — геометрия; marker size,
   room-label `k`, `view_box` и физические размеры — presentation/calibration
   и не входят в allowlist.
3. Undo обещает восстановить смысл геометрии, а не невидимый IEEE-754 мусор.
   Иной выбор разрушит абсолютный storage-инвариант #224.
4. No-op обязателен для обычных config/layout writes. Maintenance-команды
   сохраняют собственные revision/Undo contracts и лишь не получают
   дополнительной ревизии от canonicalisation.
5. Старые live stores не мигрируют при чтении; immediate bulk treatment
   остаётся #223.
