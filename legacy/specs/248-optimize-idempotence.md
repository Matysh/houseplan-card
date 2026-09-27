# Issue #248 — Optimize остаётся идемпотентной после записи и reload

- Дата: 2026-08-23
- Тип: bug · приоритет P2
- Оценка: пользовательская ценность 6/10 · ценность для разработки 8/10 · сложность 4/10 · риск 4/10
- Issue: [#248](https://github.com/Matysh/houseplan-card/issues/248)
- Ветка: `issue/248-optimize-idempotence`
- Статус ТЗ: утверждено (SPEC-REVIEW-248-r1 green), реализовано в ветке задачи

Канонические документы: `docs/SCOPE.md`, `docs/CANVAS.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/USER-GUIDE.ru.md`, `docs/TESTING.md`; связанные задачи:
[#223](https://github.com/Matysh/houseplan-card/issues/223) и
[#224](https://github.com/Matysh/houseplan-card/issues/224).

## 1. Сценарий и персона

Администратор дома открывает «Общие настройки → Оптимизировать планы»,
просматривает отчёт и подтверждает обслуживание старого либо импортированного
плана. Сразу после успешной записи он открывает действие повторно, не меняя
план. Это проверка результата: после первого прохода инструмент обязан показать,
что план уже приведён к текущей модели и исправлять больше нечего.

Сценарий относится к J6 из `docs/SCOPE.md`: план должен оставаться правдивым и
обслуживаемым по мере развития дома. Действие находится на desktop-first
административной поверхности; View и kiosk только читают сохранённый результат.

## 2. Что человек увидит до и после

**До:** после успешной оптимизации второе нажатие подряд снова предлагает
применить изменения и сообщает об «устранённом шуме координат», хотя между
запусками план не менялся.

**После:** первый запуск по-прежнему показывает и применяет реальные изменения,
а второй запуск после server event, повторного чтения config/layout или полной
перезагрузки страницы показывает существующее состояние «исправлять нечего».
Ни одна строка, кнопка или счётчик не переименовывается.

## 3. Подтверждённая причина

Причина из первоначальной гипотезы issue уточнена по актуальному `dev`.
`ws_plan_optimize` передаёт в storage helpers сырые аргументы `msg`, однако
`async_save_config_state()` и `async_save_layout_state()` уже являются общим
барьером #224 и канонизируют их. `optimize_pending` также канонизирован. Поэтому
постоянная запись и crash-intent не расходятся из-за отсутствующего вызова
backend helper.

Расходятся два корректных по отдельности числовых контракта:

1. сетка имеет шаг `GRID_STEP_N = 1 / 240`; `snapN()` возвращает двоичный
   результат вроде `0.004166666666666667`;
2. storage contract #224 округляет allowlist persisted-геометрии до девяти
   десятичных знаков и возвращает после reload `0.004166667`;
3. следующий `snapN()` снова получает первый вариант; разница `3.33e-10`
   меньше `EPS`, поэтому `alignAllToGrid()` считает её новым
   `coordsCanonicalized` и `optimizePlans().changed` снова становится `true`.

Минимальный прогон текущих production helpers доказал:

```text
первый результат в памяти        changed=false, coordsCanonicalized=0
тот же результат после barrier   changed=true,  coordsCanonicalized=6
```

Проблема затрагивает не только один масштаб: шаг нормализованной сетки одинаков,
а `cell_cm` меняет физическую цену шага, не его persisted-представление.

## 4. Scope

В задачу входят:

- единое каноническое представление результата Optimize, совпадающее с
  действующим девятизнаковым storage contract #224;
- вычисление `changed` и всех change-счётчиков по паре config/layout, которая
  действительно может быть записана и затем прочитана;
- идемпотентность в памяти, после frontend canonicalization, после штатного
  backend handler, после server-event reload и после startup recovery;
- сохранение побайтового равенства target config/layout в durable intent и в
  конечных live store payload;
- unit/backend regression и mutation guards на обе половины пары;
- уточнение канонических документов, что идемпотентность проверяется через
  write/reload boundary, а не только повторным вызовом pure optimizer.

## 5. Non-scope

Не входят:

- изменение шага сетки `1 / 240`, `EPS`, `cell_cm` или допустимых координат;
- изменение точности, формулы или allowlist канонизации #224;
- автоматический запуск Optimize, новая миграция Store/model version;
- изменение preview, toast, Undo, названий счётчиков или i18n;
- исправление wall/open-span алгоритмов, кроме доказательства, что их результат
  не создаёт повторную работу на write/reload boundary;
- ослабление schema, CAS, permission, preflight либо crash-recovery гарантий;
- визуальные изменения плана.

## 6. Контракт поведения

### 6.1 Каноническая пара Optimize

`optimizePlans(config, layout)` возвращает config/layout уже в том же числовом
представлении, которое создают `canonicalizeConfigGeometry()` и
`canonicalizeLayoutGeometry()` из #224. Повторное применение этих helpers к
результату deep-equal и не меняет ни одного allowlist-поля.

Все optimizer passes могут выполнять внутренние вычисления с большей точностью,
но окончательная пара, сравнение с входом и возвращаемое значение используют
storage-canonical boundary. Derived geometry — размеры прямоугольников,
wall-bound позиции и углы проёмов, endpoints стен/спанов и layout — входит в это
же правило; исправление только room polygon недостаточно.

`PLAN_MODEL_VERSION` повышается только если storage-canonical config/layout
содержит реальное изменение, как и до задачи. Более новая версия модели не
понижается.

### 6.2 Идемпотентность и отчёт

Для результата первого успешного Optimize должны быть эквивалентны три входа:

1. объект, возвращённый pure optimizer;
2. объект после TypeScript canonicalization helpers;
3. объект, прочитанный `config/get` + `layout/get` после backend handler или
   завершения `optimize_pending` при startup.

Для каждого из них следующий запуск возвращает:

- `changed === false`;
- config/layout deep-equal входу;
- `moved`, `coordsCanonicalized`, `rotated`, `removedDrafts`, `migrated`,
  `canonicalized`, `wallsMerged`, `spansMerged`, `partitionsMerged` и счётчики
  repair — нулевые;
- `maxShift`, `maxShiftCm` — `0`, `maxSpace` — пустая строка.

`total` остаётся диагностическим количеством просмотренных элементов и не обязан
быть нулём. Если внутренний проход временно получил другое double, но
storage-canonical итог совпадает с входом, это не исправление и не может попасть
в пользовательский отчёт.

Первый запуск на реально noisy/off-grid/legacy входе сохраняет действующие
счётчики и upper-bound обещание §9.5 `docs/CANVAS.md`; задача не превращает
настоящие изменения в no-op.

### 6.3 Backend pair transaction

После schema validation handler формирует один storage-canonical target:

- `optimize_pending.config/layout` содержит этот target;
- config store и layout store после успешного commit содержат тот же target;
- startup finisher записывает тот же target;
- recovery metadata и revisions не входят в сравнение самих config/layout;
- final layout удаляет `optimize_pending`, сохраняет актуальный
  `optimize_backup` и прежний lifecycle Undo.

Проверка должна сравнивать структуры exact/deep-equal, а не только отдельные
координаты. Байтовое равенство понимается как одинаковый JSON payload при одной
и той же стабильной сериализации; порядок ключей не становится новой частью
публичной модели.

### 6.4 Reload и concurrency

События `houseplan_config_updated` / `houseplan_layout_updated` и полная
перезагрузка страницы могут заменить optimistic state данными сервера, но не
создают новый Optimize candidate. CAS, revision increments и запись one-deep
backup первого реального Optimize не меняются. Повторный preview сам по себе не
пишет store и не меняет Undo.

## 7. UX, i18n, accessibility и touch

Новых элементов UI и строк нет. Используется существующая ветка
`gs.align_none`; существующий change-preview и итоговый toast первого запуска
остаются прежними.

Keyboard/focus/screen-reader контракты не меняются. Touch editor:
**best effort / intentionally degraded**, как и вся maintenance-поверхность;
исправление числового результата одинаково на desktop и touch. View/kiosk,
включая действия устройств, не затронуты.

## 8. Модель данных, compatibility и миграция

Persisted schema, ключи, Store version и `PLAN_MODEL_VERSION` не меняются.
Точность девять знаков, scalar formula, allowlist/denylist и lazy-write контракт
#224 сохраняются. Старые и новые версии читают результат как обычные JSON number.

Миграции нет. Уже сохранённый plan исправляется обычным первым Optimize; после
него новый инвариант не позволяет maintenance-циклу повторяться. Unknown/future
поля сохраняются по контракту #224 и не канонизируются рекурсивно.

## 9. Acceptance criteria

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | На существующих optimizer fixtures, общей coordinate-canonicalization fixture и отдельном двухмасштабном плане первый реальный проход возвращает storage-canonical config/layout, а второй в памяти и после TypeScript write-barrier даёт `changed:false`, нулевые change-счётчики и deep-equal пару. | `unit`: `test/plan-optimizer.test.mjs` + shared fixture; mutation, убирающая final canonical boundary. |
| AC2 | Grid-bound room rect/poly/draft, decor, partition/column, layout; wall-bound opening; exact wall/open-span endpoints не создают повторную работу после девятизнакового round-trip. Реальный off-grid и ULP-noisy вход по-прежнему меняется один раз и сохраняет честный отчёт/maxShift. | `unit`: parameterized surface matrix на `cell_cm` 1/3/5/1000; существующие align-grid tests; mutant, возвращающий raw `1/240` на boundary. |
| AC3 | `houseplan/plan/optimize` сохраняет config/layout exact равными target внутри durable pending и final store; normal completion и startup recovery дают одну пару, revisions/Undo metadata корректны. Удаление канонизации у config или layout half краснит тест. | `backend`: handler/store spies + recovery pytest на общей JSON fixture; два mutation guards. |
| AC4 | Композиционное frontend→backend→reload доказательство использует одну fixture: Node получает Optimize candidate и expected canonical pair; Python schema/handler сохраняет exact ту же pair; повторный Node Optimize на expected pair — no-op. | Общая fixture, frontend unit и backend pytest; fixture parity guard запрещает независимые expected-копии. |
| AC5 | После server-event reload и после полного remount существующий диалог показывает `gs.align_none`; первый реальный Optimize сохраняет прежние preview/Apply/toast/Undo, повторный preview не пишет и не инвалидирует Undo. | targeted production-bundle browser smoke с mocked WS events/get; чтение кода Undo lifecycle. |
| AC6 | Нет visual/i18n/schema/performance/touch-регрессии; implementation loop зелёный. | `typecheck`, `unit`, `build`; bundle parity. Golden/smoke/performance — общие предрелизные гейты. |

## 10. План реализации и тестов

1. В `src/plan-optimizer.ts` применить существующие TypeScript helpers #224 к
   окончательной config/layout pair до сравнения, model-version decision и
   возврата результата. Не создавать вторую формулу округления.
2. Согласовать change-report с окончательным persisted delta: no-op pair не
   несёт фантомных change-счётчиков. Если потребуется, канонизировать отдельные
   grid-bound результаты раньше, но только через общий helper.
3. Расширить `test/plan-optimizer.test.mjs` matrix всеми категориями §6.1 и
   масштабами; добавить общий fixture round-trip, читаемый Node и Python.
4. Расширить backend websocket/recovery tests: перехватить pending write,
   завершить commit, перечитать stores и сравнить обе halves с fixture exact.
5. Добавить mutation guards минимум для отсутствующего optimizer boundary,
   сырой config half и сырой layout half.
6. Добавить targeted production-bundle smoke на первое применение, update
   events/reload и второй no-op preview. Smoke пишется сейчас, но исполняется
   перед передачей кода на ревью согласно текущему процессу.
7. Обновить `docs/CANVAS.md`, `docs/CONFIG-COMPATIBILITY.md`,
   `docs/TESTING.md`, пользовательскую документацию и оба changelog.

В implementation-цикле запускаются только `typecheck`, `unit`, `build`.
Targeted browser smoke выполняется перед передачей кода на review; полный
golden/smoke/performance и Linux HA harness — перед бетой по общему процессу.

## 11. Риски, performance, security и rollback

| Риск | Мера |
|---|---|
| Phantom counters скрывают реальную правку | `changed` и report сверяются с final canonical pair; noisy/off-grid negative fixtures обязаны остаться changed. |
| Исправлена только room poly, цикл остаётся на derived geometry | Полная surface matrix §AC2 и общий config/layout walker #224. |
| Frontend/Backend expected расходятся | Одна JSON fixture, обе реализации читают её; exact whole-pair assertions. |
| Recovery пишет не то, что normal path | Перехват pending + normal completion + startup recovery в AC3. |
| Канонизация случайно расширит allowlist | Используется существующий helper; denylist/unknown sentinels #224 остаются зелёными. |
| Базовый optimizer станет заметно дороже | Один дополнительный `O(n)` copy-on-write traversal только при открытии maintenance dialog; не render/live-state loop. |

Память и время остаются `O(n)` по persisted config/layout. Объём ограничен
существующими schema limits; отдельный performance budget не вводится, общий
предрелизный performance gate обязан остаться зелёным.

Authentication, admin-only permission, size limits, schema, CAS и preflight не
меняются. Новых данных, внешних запросов и security surface нет.

Rollback — revert implementation-коммита. Формат данных не меняется, поэтому
обратная миграция не нужна. На старой версии повторный phantom Optimize может
вернуться, но сохранённая девятизнаковая геометрия остаётся валидной.

## 12. Release-артефакты

Изменение пользовательски видимо как исправление ложной повторной работы.
Implementation-коммит получает `User-Visible: yes` и включает:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #248;
- `docs/CANVAS.md` — идемпотентность через storage/reload boundary;
- `docs/CONFIG-COMPATIBILITY.md` — композиция Optimize с девятизнаковым writer;
- `docs/USER-GUIDE.ru.md` — существующая фраза об идемпотентности точечно
  уточнена границей reload (Low из SPEC-REVIEW-248-r1);
- `docs/TESTING.md` — shared fixture, backend pair/recovery и mutation coverage;
- `docs/STATUS.md` — только если текущая unreleased-сводка перечисляет
  исправления этого уровня;
- unit/backend/smoke fixture и синхронные production bundles.

Новых i18n, screenshots, golden baseline, schema/model migration,
security-артефакта или отдельного performance-артефакта нет. Golden не должен
измениться; перед бетой выполняются общие гейты.

## 13. Принятые технические предположения

Принято предположительно, поменять свободно на ревью ТЗ:

1. Авторитетным persisted-представлением остаётся девятизнаковый контракт #224;
   сетка подстраивает свой возвращаемый candidate под storage, а не наоборот.
2. Сквозное доказательство компонуется из Node unit и Python backend test через
   одну fixture. Запуск Node subprocess из pytest не нужен и не становится
   runtime/build dependency интеграции.
3. «Побайтово» означает exact JSON structure/value при стабильной сериализации,
   а не новый публичный контракт порядка ключей Python/JavaScript objects.
4. Если final canonical pair deep-equal входу, change-счётчики равны нулю;
   `total` может отражать реально выполненный обход.
5. Исправление не требует менять backend production code, если тест докажет,
   что общий writer #224 уже сохраняет pending и live pair одинаково. Тесты
   backend всё равно обязательны, потому что именно этот шов является частью AC.
