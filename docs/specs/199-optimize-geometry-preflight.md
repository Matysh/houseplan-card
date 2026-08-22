# Issue #199 — geometry preflight перед записью Optimize

- **Issue:** https://github.com/Matysh/houseplan-card/issues/199
- **Тип / приоритет:** tech-debt / P1
- **Оценка:** пользовательская ценность 8/10; ценность для разработки 9/10;
  сложность 7/10; риск 8/10
- **Трек:** обычный
- **Область:** explicit whole-plan Optimize, canonical physical geometry,
  preview/Apply, RU/EN i18n, unit/smoke/performance
- **Модель данных:** без изменений и миграции
- **Связано:** #197, #198, #223, #224, #229, `docs/CANVAS.md` §9.5,
  `docs/WALL-THICKNESS.md`, `docs/TOUCH-SUPPORT.md`

## 1. Сценарий и персона

**Персона:** домашний администратор, который обслуживает старый или импортированный
план через «Общие настройки → Оптимизировать планы».

**Поверхность и момент:** администратор открывает preview Optimize и собирается
подтвердить единое изменение всех пространств. Один из maintenance-pass создаёт
candidate, для которого production geometry builder не может построить кладку
либо бумагу хотя бы одного пространства.

Задача поддерживает J6 из `docs/SCOPE.md`: долговечный редактируемый план не
должен становиться непригодным после штатной операции обслуживания. Она также
закрывает safety floor `docs/TOUCH-SUPPORT.md`: editor-действие не имеет права
молча записать повреждённую геометрию. View/киоск не получают нового control,
но защищаются от результата опасной записи.

## 2. Что человек увидит до и после

**До:** preview показывает обычный структурный отчёт и разрешает Apply, даже
если candidate уже не строится тем же geometry engine, которым затем рисуется
план. Ошибка становится видна только после записи; one-deep Undo исчезает после
следующего изменения.

**После:** если хотя бы одно пространство candidate не проходит production-
эквивалентную проверку, preview называет проблемные пространства, сообщает,
что планы не изменены, и не показывает кнопку «Оптимизировать». Ни config, ни
layout не записываются.

## 3. Подтверждённая проблема

Текущий путь на `origin/dev`:

1. `HouseplanCard._openAlignDialog()` вызывает чистый
   `optimizePlans(this._serverCfg, this._layout)`;
2. `OptimizeResult` содержит exact `config`/`layout`, отчёт и `changed`, но не
   состояние канонической geometry;
3. `_renderAlignDialog()` показывает отчёт только по структурным счётчикам;
4. `_runAlignToGrid()` отправляет сохранённый candidate в
   `houseplan/plan/optimize`;
5. backend проверяет permission, size, expected revisions, schema, marker/light/
   opening semantics и наличие файлов, после чего crash-resumably записывает
   два Store и создаёт one-deep snapshot;
6. ни frontend preview/Apply, ни Python endpoint не вызывают
   `wallBodiesGeometry()`/`floorFootprintGeometry()` для candidate.

#197 доказал цену этого разрыва: один junction patch делал
`wallBodiesGeometry() === null` после Optimize, а пользователь обнаруживал
исчезнувшую кладку уже после записи. #197 исправил конкретный patch-loop, но не
общий барьер. #198/#229 меняют отдельные optimizer-pass, #223 очищает координаты
внутри Optimize, #224 канонизирует координаты на общих write barriers. Ни одна
из этих задач не проверяет итоговую renderability candidate, поэтому #199 не
является дубликатом.

## 4. Решения владельца

Владелец принял defaults 2026-08-22:

1. отказ любого пространства блокирует **весь** whole-plan Optimize;
2. уже деградированное пространство также блокирует запись, даже когда candidate
   не выглядит хуже исходника;
3. preview показывает понятное сообщение и названия пространств, не раскрывает
   exception/polyclip details и не показывает Apply.

Эти решения являются продуктовым контрактом, а не техническими предположениями.

## 5. Scope

В задачу входят:

1. чистый production-equivalent preflight exact config candidate по всем
   пространствам;
2. единая подготовка geometry inputs для preflight и production renderer либо
   общий чистый helper, исключающий два расходящихся алгоритма;
3. проверка room masonry/paper вместе с независимыми partitions, незаконченными
   drafts, columns, обычными и hosted-partition openings;
4. различение structural failure (`null`/exception) и корректного пустого
   результата;
5. fail-closed preview и Apply: один failure блокирует всю операцию и ноль WS
   writes;
6. понятное RU/EN сообщение с детерминированным списком пространств;
7. привязка preflight result к exact candidate fingerprint и отсутствие
   повторной проверки при неизменном candidate;
8. сохранение нынешней одной backend-транзакции и one-deep Undo для успешного
   candidate;
9. unit, production-bundle smoke, visual state, mutation и large-house
   performance evidence;
10. пользовательская, архитектурная, тестовая и release-документация.

## 6. Non-scope

- исправление geometry, из-за которой preflight стал красным;
- частичная оптимизация только исправных пространств;
- сравнение «до/после» и разрешение уже существующего structural failure;
- raw-ring, centreline либо renderer-specific fallback;
- замена `polyclip-ts`, общая смена tolerance/precision или новый geometry engine;
- port polygon boolean engine в Python;
- новый persisted field, `PLAN_MODEL_VERSION`, schema migration или Store;
- фоновая проверка при обычном Save/read/render/import;
- сохранение stack trace или исходного config в диагностике/telemetry;
- новый ручной repair control;
- изменение срока жизни Optimize Undo;
- публичное включение скрытой изометрии.

Найденная preflight проблема получает отдельный bug issue с reproducer; #199 не
используется как umbrella для её попутного исправления.

## 7. Контракт geometry preflight

### 7.1 Exact candidate и область проверки

`checkOptimizeGeometry(config)` (рабочее имя) является чистой функцией: не
читает DOM/Lit/HA state, не пишет Store, не мутирует config и не зависит от
активного этажа. Вход — exact `OptimizeResult.config`; выход содержит:

- content fingerprint входа;
- ordered list пространств со статусом `ok | failed | not-applicable`;
- публичный failure list только из `spaceId` и безопасного display name;
- внутренний bounded reason code для unit/diagnostic assertions без exception
  text.

Порядок совпадает с `config.spaces`; перестановка пространств меняет только
порядок отчёта, не результат каждого пространства.

Проверяются **все** пространства candidate, не только активное и не только
изменённые по счётчикам Optimize. Проверка запускается лишь когда
`OptimizeResult.changed === true`: no-op preview ничего не записывает и
сохраняет действующее сообщение «Все планы уже используют актуальную…».

### 7.2 Production-equivalent inputs

Для каждого пространства используются те же чистые источники и параметры, что
production render pipeline:

- `spaceModels()` и `NORM_W` для render coordinates;
- persisted `walls` в config coordinates;
- `resolveOpenCuts()` для explicit/legacy room spans;
- ordinary room openings и валидные hosted-partition openings с тем же compat
  resolver;
- `wallIntervals()` + `partitionOpeningHasCompositeRoomWall()` для решения,
  режет ли hosted opening совпавшую room masonry;
- `physicalBodyParts()` с `PartitionOpeningCut[]` для partitions/drafts/columns;
- `GRID_STEP_N`, `cell_cm`, `GRID_PITCH`, `NORM_W`;
- `wallBodiesGeometry()` для общей masonry/paper geometry;
- `floorFootprintGeometry()` только там, где есть хотя бы одна комната и нет
  уже построенного `paperGeom`.

Подготовка opening/physical inputs выносится в общий pure helper либо напрямую
переиспользует существующие pure resolvers. Копия private card-логики с
отличающимися условиями запрещена.

### 7.3 Успех, failure и not-applicable

Пространство успешно, когда каждый обязательный production pass, который должен
быть вызван для его данных, завершился без exception и вернул не-`null` geometry.

- При наличии wall records либо independent physical bodies
  `wallBodiesGeometry()` обязан вернуть object. Его документированный successful
  empty result не является failure сам по себе.
- При наличии комнат должен существовать paper/floor result: `paperGeom` от
  wall pass либо `floorFootprintGeometry()` без него.
- Пространство без комнат, wall records и independent bodies имеет
  `not-applicable`, а не failure: image-only/пустой новый этаж разрешён.
- Пространство без комнат, но с валидными partitions/drafts/columns проверяет
  physical/masonry pass; отсутствие room floor не является ошибкой.
- Невалидный hosted opening, который действующий compat renderer намеренно не
  материализует, остаётся обязанностью schema/semantic validation и не получает
  новую альтернативную трактовку в preflight.
- Любой неожиданный exception внутри подготовки или boolean pass превращается
  в bounded failure reason; наружу и в UI exception text не выходит.

Preflight ничего не чинит, не округляет и не канонизирует сверх уже полученного
Optimize candidate.

### 7.4 Fingerprint и повторная проверка

Preflight result хранит `contentFingerprint(candidate.config)`. Dialog хранит
тот же exact candidate и result.

- Обычный Apply использует готовый зелёный result и не выполняет второй дорогой
  boolean pass.
- Перед WS call код снова вычисляет дешёвый fingerprint. Совпадает — result
  применим. Не совпадает — preflight выполняется заново для изменившегося
  candidate.
- Красный повтор переводит dialog в тот же failure state и не вызывает WS.
- Изменение server config другим клиентом по-прежнему ловится backend revision
  conflict; preflight не заменяет optimistic locking.
- Result не кладётся в глобальный render cache и не переживает закрытие dialog.

## 8. UX-контракт

### 8.1 Failure preview

При failure обычный отчёт о сдвигах/миграциях не показывается как предложение к
записи. Вместо него dialog показывает:

- RU: «Не удалось безопасно проверить геометрию следующих пространств:
  {spaces}{more}.»
- RU hint: «Планы не изменены. Обновите House Plan и повторите. Если ошибка
  останется, приложите экспорт пространства к отчёту об ошибке.»
- EN: equivalent plain-language text without implementation terms.

Display name: непустой `space.title`, иначе `space.id`, иначе локализованное
«Пространство N» / `Space N`. Первые три имени перечисляются в config order;
при большем числе добавляется локализованный suffix «и ещё N» / `and N more`.
Lit text binding экранирует имена; HTML интерполяция запрещена.

Footer содержит только «Отмена»/закрытие. Кнопка «Оптимизировать» **не
рендерится**, а не только получает `disabled`: пользователь не должен принимать
failure как предупреждение, которое можно обойти.

Title, Escape, focus trap, scrim close и restore focus остаются общими для
`hp-dialog`. Новых жестов нет. На узком/touch экране сообщение переносится и
остаётся целиком доступным; editor touch parity не обещается, но safety floor
блокирует запись так же, как на desktop.

### 8.2 No-op и success

- `changed: false`: действующий `gs.align_none`, без preflight failure UI и без
  Apply.
- `changed: true`, preflight green: нынешний точный отчёт, warning и Apply без
  текстовых/поведенческих изменений.
- Cancel/close в любом состоянии ничего не пишет.
- Успешный Apply по-прежнему показывает `gs.align_done`; Undo по-прежнему
  доступен до следующего edit.

## 9. Backend, atomicity, compatibility и security

`houseplan/plan/optimize` не получает новый параметр. Python не имеет и не
должен получать вторую реализацию TypeScript/polyclip geometry. Preflight —
защитный барьер штатной карточки, не security attestation от недоверенного
клиента.

Backend сохраняет независимые гарантии:

- admin permission и size limit;
- schema/semantic validation;
- expected config/layout revisions;
- missing-plan validation;
- intent-first config+layout commit;
- one-deep snapshot и crash recovery.

При красном preflight endpoint не вызывается вообще, поэтому не создаются
pending/backup, revisions и update events. При зелёном вызывается ровно один
существующий endpoint с exact candidate; частичной записи по пространствам нет.

Старый сохранённый config читается без миграции. Новые i18n keys — единственное
добавление к пользовательскому контракту. Неизвестные поля candidate, files,
layout metadata и backend Undo сохраняются существующими механизмами.

Имена пространств считаются недоверенным пользовательским текстом и выводятся
только через Lit escaping. Exception, geometry coordinates и config payload не
логируются в browser console как часть штатного failure и не отправляются
третьим сторонам.

## 10. Производительность

Проверка user-triggered и выполняется не чаще одного раза для одного открытого
dialog/candidate. Она запрещена в:

- render/update и HA state tick;
- pointermove, pan, pinch и hover;
- обычном config/layout Save;
- переключении этажа, темы или View/Plan режима.

Базовое измерение автора ТЗ 2026-08-22 на текущем Windows checkout после
`npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs`: прямой
production wall/physical pass существующей `large-house` fixture (3 пространства,
60 комнат, 100 проёмов, 60 partitions, 40 columns) — median 155.9 ms, p95
162.56 ms, max 163.67 ms по 20 warm samples.

Acceptance budget для готового helper на той же fixture:

- все 3 пространства green;
- p95 не больше **250 ms** после не менее 3 warmups и 20 samples;
- wrapper/input-preparation overhead относительно прямого production builder
  того же процесса не больше **20% + 15 ms**;
- повторный Apply неизменного candidate не вызывает второй geometry pass;
- heap/result cache не растёт после закрытия dialog.

Отдельный benchmark script печатает fixture counts, median/p95/max, baseline и
candidate timings. Если абсолютный budget нестабилен в CI, ревьюер не повышает
его молча: измеряет same-run baseline и заводит отдельный performance issue;
для #199 остаётся обязательным относительный budget.

## 11. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Exact Optimize candidate проверяется по всем пространствам теми же room/opening/wall/physical builders и параметрами, что production renderer; вход не мутируется. | Focused unit + code review call-site parity table. |
| AC2 | Валидная матрица room masonry, ordinary/hosted openings, partitions, drafts, columns, image-only и empty space даёт `ok/not-applicable` без false positive. | Parameterized unit fixtures. |
| AC3 | Forced `wallBodiesGeometry() === null`, floor failure и thrown exception дают bounded failure соответствующего пространства; successful empty geometry не считается failure. | Injectable seam/mutant unit. |
| AC4 | Failure одного из нескольких пространств возвращает deterministic ordered list и блокирует whole-plan operation; исправные пространства не записываются отдельно. | Multi-space unit + browser smoke. |
| AC5 | Уже красное исходное пространство не получает исключения «не стало хуже»: changed candidate блокируется и оставляет exact config/layout/revisions без изменений. | Before/after regression unit + browser smoke. |
| AC6 | Failure dialog выводит первые три безопасных display names, RU/EN suffix остальных и plain-language hint без exception; Apply отсутствует, Cancel/Escape/focus работают. | i18n/UI unit + production-bundle smoke + dark/light golden candidate. |
| AC7 | `changed:false` сохраняет прежний no-op dialog без preflight; green candidate сохраняет прежний report/Apply/toast. | UI unit + existing Optimize smokes. |
| AC8 | Green fingerprint используется ровно для exact config candidate; unchanged Apply не повторяет geometry pass, changed fingerprint rechecks и fail-closes до WS. | Controlled-call-count unit. |
| AC9 | Красный preflight делает 0 `houseplan/plan/optimize` calls, не меняет `_serverCfg`, layout, revisions, history/Undo и не создаёт events; green делает ровно один atomic call. | Production-bundle smoke with WS recorder. |
| AC10 | Успешный Apply/Undo, revision conflict и backend semantic validation остаются без изменений. | Existing frontend/backend suites + targeted smoke. |
| AC11 | Large-house helper выполняет budget §10, не попадает в render/state/pointer пути и не оставляет растущий cache. | Targeted benchmark + call-count regression. |
| AC12 | Mutation gates ловят bypass preflight, active-space-only check, acceptance `null` и отображение Apply при failure. | `scripts/mutation-gate.mjs` entries, каждый caught 1/1. |
| AC13 | RU/EN changelog, user/canvas/testing/status docs и три bundle-копии актуальны; docs fingerprint green. | `check-docs`, bundle byte comparison, doc review. |
| AC14 | Рабочие gates задачи зелёные. | typecheck, unit, build, targeted smoke, targeted golden candidate/benchmark as required by process. |

## 12. План реализации и тестов

### 12.1 Код

1. Добавить pure module `src/plan-geometry-preflight.ts` (имя может быть
   изменено ревьюером) с per-space preparation/check и result/fingerprint types.
2. Вынести из `houseplan-card.ts` только необходимую production input projection
   в pure helpers либо переиспользовать существующие resolvers напрямую; renderer
   и preflight должны сходиться на одной функции, а не копиях условий.
3. Расширить private `_alignDialog` preflight result и integration в
   `_openAlignDialog`, `_runAlignToGrid`, `_renderAlignDialog`.
4. Добавить RU/EN i18n keys для failure, hint, fallback name и `more` suffix.
5. Backend endpoint и persisted schema не менять.

Предполагаемые продуктовые файлы: `src/plan-geometry-preflight.ts`,
`src/houseplan-card.ts`, при необходимости общий geometry/opening helper,
`src/i18n/ru.json`, `src/i18n/en.json`.

### 12.2 Автотесты

- `test/plan-geometry-preflight.test.mjs`: AC1–AC5, AC8, call parity,
  immutability, empty/failure matrix;
- существующие `plan-optimizer`, `wall-thickness`, `partition-openings` tests
  остаются зелёными;
- `demo/smoke_optimize_geometry_preflight.mjs`: собранный bundle, multi-space
  red/green/no-op, RU/EN, zero/one WS calls, state/Undo preservation;
- `demo/benchmark_optimize_geometry_preflight.mjs`: §10;
- golden matrix: failure dialog dark/light; baselines принимаются только из
  полного Linux CI artifact через `golden:accept -- --reviewed`;
- mutation ids: `optimize-preflight-bypassed`,
  `optimize-preflight-active-space-only`, `optimize-preflight-accepts-null`,
  `optimize-preflight-renders-apply-on-failure` либо эквивалентные точные anchors.

До `S7-code-review` выполняются fast gates и targeted smoke/benchmark из AC.
Полный smoke set, golden verify и общий performance остаются pre-beta gates.

## 13. Риски и меры

| Риск | Мера |
|---|---|
| Preflight расходится с renderer | Общий pure input helper + AC1 parity table; никакого упрощённого polygon check. |
| Проверяется только активный этаж | Pure function обходит ordered `config.spaces`; mutant active-space-only. |
| False positive на пустом/virtual-only плане | Явный `not-applicable` и successful-empty contract, parameterized AC2/AC3. |
| Старый failure пропускается как «не хуже» | Решение владельца Q2 и AC5: любой candidate failure блокирует. |
| Whole-plan Apply становится частичным | Ноль WS calls при любом failure; backend endpoint вызывается один раз только на green. |
| UI показывает внутреннюю ошибку или ломается от title | Bounded reason codes, Lit escaping, список ≤3 + count. |
| Дорогой boolean pass тормозит обычный View | Только explicit dialog, fingerprint reuse, budget и call-count tests. |
| Cache удерживает config/geometry | Result живёт только в dialog; geometry не хранится, только statuses/fingerprint. |
| Старый browser bundle может вызвать endpoint без preflight | Это не security boundary; пакет поставляет card+integration вместе. Backend продолжает schema/semantic guards, но не дублирует polyclip. |

## 14. Touch и accessibility

Touch editor: **best effort**, но safety behavior полностью поддерживается.
Проверка запускается той же кнопкой General settings; failure не допускает
запись ни мышью, ни tap. Message/footer не требуют hover, помещаются в общий
responsive `hp-dialog`, Escape/focus restore остаются desktop guarantees.
Новых pointer handlers и рисков pinch/pointercancel нет. View/киоск rendering
не меняется; предотвращение повреждённой записи улучшает их надёжность.

## 15. Release-артефакты и rollback

Изменение пользовательское. Implementation commit имеет `User-Visible: yes` и
включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #199;
- `docs/USER-GUIDE.ru.md` — failure behavior Optimize и действие пользователя;
- `docs/CANVAS.md` — preflight/fingerprint/whole-plan contract;
- `docs/ARCHITECTURE.md` — граница frontend geometry barrier/backend atomicity;
- `docs/TESTING.md` — unit/smoke/mutation/performance evidence;
- `docs/STATUS.md` — фактическая release-line запись;
- RU/EN i18n, tests, smoke, benchmark, mutation entries;
- recapture `demo/docs/capture.mjs`/`docs/images/screenshots.json` для актуального
  source fingerprint при любом `src/**` diff;
- три byte-identical bundle-копии;
- dark/light golden candidate; acceptance baseline только по reviewed full Linux
  artifact перед beta.

Security report, schema migration, backend release note и persisted recovery
artifact не требуются.

Rollback — revert implementation commit. Persisted данные не меняются новым
preflight, поэтому обратной миграции нет. После rollback Optimize снова разрешит
запись unchecked candidate; уже успешно оптимизированные планы и Undo snapshots
остаются в прежнем формате.

## 16. Принятые технические предположения

Эти решения не наблюдаемы пользователем и могут быть изменены ревьюером без
нового решения владельца, если AC сохраняются:

1. Pure module/result/type names не являются публичным API.
2. Fingerprint использует существующий `contentFingerprint`, а не новый hash.
3. No-op candidate не проверяется: Apply отсутствует, значит опасной записи нет.
4. Preflight result хранит statuses/reasons, но не polygon geometry, чтобы dialog
   не становился вторым render cache.
5. Backend endpoint не требует декларативного `preflight_passed` поля: без
   возможности исполнить polyclip оно не добавляет доказательства и ломает
   старые clients.
6. Performance budget относится к geometry helper отдельно от уже существующего
   `optimizePlans()`; same-run baseline отделяет новый overhead от polygon engine.
7. `space.title → id → Space N` — единственный display-name fallback.
8. Targeted file/fixture names могут меняться без изменения доказательной
   матрицы AC.
