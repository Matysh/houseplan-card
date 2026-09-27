# Код-ревью issue #197 — цикл r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/197
- **ТЗ:** `docs/specs/197-junction-patch-fail-dark.md` (r2, зелёное
  `docs/reviews/SPEC-REVIEW-197-r3.md`)
- **Диапазон:** `origin/dev...HEAD` (`db5718095624e55f6407e37f867e8e520f9c4882`,
  один продуктовый коммит `fix: isolate degenerate junction patches`)
- **Ревьюер:** Claude, свежая сессия без контекста реализации
- **Вердикт:** зелёный · цикл r1/4 · High: 0 · Medium: 0

## Скоуп изменения

Единственный класс-A файл в диффе — `src/wall-thickness.ts` (+60/-6 строк).
Остальное — тесты (`test/wall-thickness.test.mjs`,
`test/fixtures/197-junction-patch.json`, `test/golden-matrix.test.mjs`),
targeted browser smoke (`demo/smoke_junction_patch_resilience.mjs`), golden
candidate-сцены (`demo/golden/matrix.mjs`, `demo/golden/harness.mjs`),
документация (`WALL-THICKNESS.md`, `ARCHITECTURE.md`, `TESTING.md`,
`USER-GUIDE.ru.md`, `STATUS.md`, оба `CHANGELOG*`) и три синхронные копии
бандла. Ни backend, ни i18n, ни манифесты не затронуты — соответствует §6 ТЗ
(«не входит в задачу»).

Продуктовое изменение в `src/wall-thickness.ts`:

1. `stableJunctionPatch(patch, coordScale)` — квантует координаты вычисляемого
   junction-патча с относительным шагом `max(1, coordScale) × 10⁻¹²`,
   отбраковывает нефинитные точки и патчи с площадью не больше `quantum²`.
2. `unionJunctionPatches(body, patches, coordScale, unionFn)` — транзакционно
   добавляет каждый стабилизированный патч: локальный `try/catch` вокруг
   одного `union`, отказ сохраняет последнее валидное `body` и не прерывает
   обработку следующих патчей.
3. Цикл `for (const patch of junctions) body = body ? union(...) : ...` в
   `wallBodiesGeometry()` (`src/wall-thickness.ts:1760-1761` на `dev`) заменён
   вызовом `unionJunctionPatches(body, junctions, coordScale)`. Общий
   структурный `try { … } catch { return null; }`, оборачивающий весь
   остальной pass (exterior envelope, room rings, edge bodies, opening cuts,
   extraBodies), не тронут и по-прежнему оборачивает точку вызова.
4. `virtualJunctionPatches` сделана `export` (test seam, без изменения тела) —
   тот же паттерн, что и у остальных pure-geometry helpers этого модуля.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | 900/900, зелёный |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный; обе копии побайтно идентичны `dist/`, SHA-256 `b0dcd6651964c1bf9b964e750758b8dc5cad25bccf099a1b740af9b873fe68b5` — совпадает с хендофф-комментарием автора |
| Дисциплина «тест умеет падать» | временный откат `unionJunctionPatches(...)` на исходный незащищённый цикл в рабочей копии, `npm test` | ровно один новый тест (`issue #197 keeps the full masonry when one virtual-junction patch has ULP noise`) стал красным, остальные 899 остались зелёными; после возврата файла `npm test` снова 900/900. Мутация подтверждает, что регрессия реальна, а не тавтологична |
| Targeted smoke (AC7/AC8) | `node demo/smoke_junction_patch_resilience.mjs` (после свежей сборки и копирования в `demo/srv/assets`) | зелёный, все 15 проверок `true`: полный fixture (8/25/3), Plan/View/kiosk/static/hidden Iso держат один и тот же canonical `d`, paper/floor/Glow/sun barriers непустые, dark-theme toggle и HA state tick не меняют path и переиспользуют кеш (`_wallUnionCache`, fingerprint), рендер не пишет `_serverCfg` |
| Golden (доп. проверка, не входит в обязательный гейт) | `node demo/golden/run.mjs --mode=verify` (полный локальный прогон, уже был начат случайно и доведён до конца) | 0 `failed`; все существующие wall-junction сцены (`wall-junctions-plan-preview-light`, `wall-junctions-plan-t-dark`, `wall-junctions-view-dark`, `isometric-wall-junctions-dark`) — `passed`, т.е. численная стабилизация не сдвинула ни один уже принятый эталон; обе новые сцены `junction-patch-resilience-*` — ожидаемо `missing-baseline` (AC9 требует принятия только через `golden:accept -- --reviewed` на полном Linux CI артефакте, что вне этого цикла); одна несвязанная сцена `decor-color-popover-mobile-ru` — `different`, и 6 других `missing-baseline` — все они про `#180`/opening-placement, не задеты этим диффом (диффом не создаются и не меняются) |

Не прогонялось и почему:

- `npm run golden:capture`/принятие baseline — вне цикла ревью по процессу
  (§8 PROCESS.md, AC9 ТЗ): baseline принимается только `golden:accept
  -- --reviewed` на полном Linux CI артефакте, локальное принятие запрещено.
  `golden:verify` был прогнан целиком (см. выше) и дал полезный негативный
  результат — регрессий нет; этого достаточно.
- Полный набор `demo/smoke_*.mjs` (127 сценариев) — diff касается одной чистой
  geometry-функции без renderer-specific веток; ограничился targeted smoke,
  явно названным в AC7/АС8, плюс уже пройденным golden verify как независимым
  подтверждением на уровне рендера.
- `python -m pytest tests_backend -q` — backend не тронут (0 файлов
  `custom_components/**/*.py` в диффе).
- Performance-профили — ТЗ §13 явно оставляет fixture #197 вне отдельного
  performance-бюджета («добавляется в performance только если измерение
  покажет отдельный значимый профиль»); изменение — один дополнительный
  `try/catch` и линейное квантование вершин на патч, асимптотика не меняется.

## Разбор критериев приёмки

- **AC1 (unit).** `test/wall-thickness.test.mjs:794-856` строит полный fixture
  ровно по reproducer §3 ТЗ (только `rooms`/`open_spans` × `NORM_W`,
  `walls[].a/b` без предварительного масштабирования), проверяет
  `[8, 25, 3]`, наличие 20-см узла и вызывает production-сигнатуру
  `wallBodiesGeometry(...)`. На исходном `dev` эта же комбинация даёт `null`
  (см. мутационную проверку выше); после исправления —
  непустые `geom`/`paperGeom` с площадями `124991.31944444453` и
  `727303.8194444444`, что совпадает с числами из хендофф-комментария автора.
  Доказано автотестом, тест умеет падать. **AC1 выполнен.**
- **AC2 (unit).** Строки 818-843: `virtualJunctionPatches()` даёт ровно один
  патч с побайтно теми же четырьмя вершинами, что в §3 ТЗ;
  `stableJunctionPatch` на исходных вершинах и на предварительно нормированных
  (`/NORM_W`) даёт согласованные форкнутые координаты (`stable[1][0] ===
  stable[2][0]`, `stable[2][1] === stable[3][1]`) и bounds совпадают с
  исходным патчем с точностью `1e-9`. **AC2 выполнен.**
- **AC3 (unit).** Отдельный узкий тест `junction patch union isolates one
  failure and continues with later patches` (строки 881-902) инжектирует
  контролируемый throw через `unionFn`-параметр `unionJunctionPatches`:
  первый патч падает, второй получает именно последнее валидное `body`
  (`calls[1].body === 'initial-body'`), финальный результат —
  `'body-with-second-patch'`; отдельно проверено, что нефинитные/нулевые по
  площади патчи не доходят до boolean engine (`invalidCalls === 0`). Основной
  структурный `throw` по-прежнему даёт `null` — не покрыто отдельным новым
  unit-тестом, но подтверждено чтением кода: `unionJunctionPatches(...)`
  вызывается внутри неизменного внешнего `try { … } catch { return null; }`
  (`src/wall-thickness.ts:1771` и `:1844-1846`), который до этого изменения уже
  оборачивал весь structural pass и продолжает делать это после патча;
  существующие 900 тестов, включая множество null-return сценариев для
  #123/#141/#150/#172, продолжают проходить без регрессии этого поведения.
  Зафиксировано как «проверено чтением, не исполнением» в части общего
  fail-dark; изолирующая часть доказана исполняемой мутацией. **AC3
  выполнен.**
- **AC4 (unit).** Строки 806, 853-856: `before`/после сравнение
  `JSON.stringify({ rooms, walls, cuts, openings, extraBodies })` до и после
  вызова — побайтно равны; исходные 25 wall records не редактируются и не
  сливаются перед вызовом. **AC4 выполнен.**
- **AC5 (unit).** Строки 858-878: `[...rooms].reverse()`/`[...walls].reverse()`
  и вариант с разворотом каждого сегмента (`a`↔`b`) дают ту же geometry
  (`geometryDifferenceArea` в обе стороны `< 1e-7`); повторный вызов с теми же
  аргументами идемпотентен. **AC5 выполнен.**
- **AC6 (unit).** `npm test` зелёный на всех 900 тестах, включая существующие
  матрицы corner Split (#123), junction/thickness (#141), transition (#150),
  zero-divider (#172), openings, open spans, independent extras — без единой
  регрессии. **AC6 выполнен.**
- **AC7/AC8 (smoke).** `node demo/smoke_junction_patch_resilience.mjs` —
  зелёный, разобран выше по каждой проверке: Plan/View/kiosk/static/hidden
  Iso держат идентичный masonry path; paper, clean-floor hover, Glow/sun
  barriers непустые; dark-theme toggle и HA state tick не пересчитывают
  topology (кеш и fingerprint переиспользуются) и не пишут config. **AC7/AC8
  выполнены.**
- **AC9 (golden).** Кандидатные сцены `junction-patch-resilience-plan-dark` и
  `junction-patch-resilience-view-dark` добавлены в матрицу (dark theme, Plan
  и View), `test/golden-matrix.test.mjs` проверяет их состав (`[8, 25, 3]`) и
  версию матрицы (`GOLDEN_MATRIX_VERSION = 30`). Baseline не принят локально
  (`missing-baseline` в прогоне `golden:verify` — ожидаемо и корректно, ТЗ
  прямо требует принятия только через reviewed Linux CI артефакт). **AC9
  выполнен на уровне доступном код-ревью**; фактическое принятие эталона —
  вне этого цикла.
- **AC10 (ревью кода).** Diff ограничен `src/wall-thickness.ts`; ни
  renderer-specific обхода, ни grid-snapping физических offset-вершин
  (квантование идёт по `coordScale × 10⁻¹²`, не по шагу сетки), ни
  schema/backend/i18n правок, ни правок #198/#199 не найдено. Локальный
  `catch` окружает исключительно один `union(current, piece)` внутри
  `unionJunctionPatches`, а не остальной structural pass — основной отказ
  по-прежнему долетает до внешнего catch. **AC10 выполнен.**
- **AC11 (гейты).** Таблица выше: typecheck/unit/build зелёные, три копии
  бандла байтово идентичны, targeted smoke зелёный до передачи на ревью.
  **AC11 выполнен.**

## Находки

Находок нет. High: 0, Medium: 0, Low: 0.

Рассмотренные и отклонённые как не-находки:

- Экспорт `stableJunctionPatch`/`unionJunctionPatches`/`virtualJunctionPatches`
  как публичных функций модуля — это test seam в том же стиле, что и десятки
  других уже экспортированных pure-geometry helpers этого файла (см. список
  импорта в начале `test/wall-thickness.test.mjs`), а не новый runtime
  diagnostic API; ТЗ §17.6 явно допускает такой путь инъекции отказа.
- Квантование применяется ко **всем** вычисляемым junction-патчам, а не
  только к падающему — в спецификации (§7.1.2-4) это заложено как общее
  правило, и `golden:verify` подтверждает исполнением, что это не сдвинуло ни
  один уже принятый junction-эталон (`wall-junctions-*`, `isometric
  -wall-junctions-dark` — все `passed`).
- Продуктовый контракт (AC10, §4/§7 ТЗ со ссылкой на `docs/specs/141-wall-
  junctions.md`) соответствует итоговой реализации: изоляция ровно на
  границе optional patch, а не на границе всего structural pass.

## Документация и трейлеры

Коммит `db57180` несёт `Issue: #197` и `User-Visible: yes`; changelog правки
(`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) присутствуют в том же коммите,
формулировки на двух языках согласованы и ссылаются на #197. Обновлены
`docs/WALL-THICKNESS.md` (§3, §8 — per-piece failure и numeric stabilisation),
`docs/ARCHITECTURE.md` (граница optional patch vs. structural failure),
`docs/USER-GUIDE.ru.md` (новая строка диагностики «После оптимизации исчезла
вся толстая кладка» в таблице troubleshooting — терминология согласована с
остальной таблицей раздела), `docs/TESTING.md` (новый чеклист-пункт с явной
привязкой к unit/smoke/golden) и `docs/STATUS.md` (текущий локальный цикл).
Всё — в том же коммите, что и поведение, как того требует §2.6/§11
PROCESS.md.

## Что проверено и корректно

- Численная стабилизация патча собирает ровно ту же математику, что описана
  в ТЗ §7.1 и §17.1: относительный квантум, не завязанный на шаг сетки,
  отбраковка нефинитных/вырожденных патчей до попытки `union`.
- Изоляция патча — честная транзакция: присваивание `current = next`
  происходит только после успешного `unionFn`, при throw `current` не
  меняется; проверено и unit-тестом с инжектированным отказом, и чтением.
- Общий fail-dark контракт (структурный отказ вне патчей всё ещё даёт `null`)
  не нарушен — внешний `try/catch` не тронут.
- Единый canonical `wallBodiesGeometry()` остаётся источником истины для всех
  перечисленных в ТЗ §7.3 потребителей — подтверждено смоуком, не только
  декларацией в ТЗ.
- Persisted config не переписывается и не мутируется (immutability-проверка в
  unit и `renderNeverWritesConfig` в smoke).
- Три бандл-копии синхронны, SHA совпадает с заявленным в хендоффе.
- Golden-регрессий на существующих сценах нет (полный `golden:verify`,
  выполненный сверх обязательного минимума, подтвердил это исполнением).

## Чего не проверял

- Полный `demo/smoke_*.mjs` (127 сценариев за пределами
  `smoke_junction_patch_resilience.mjs`) — не запускал; diff ограничен одной
  чистой geometry-функцией без затронутых renderer-веток, targeted smoke плюс
  выполненный (сверх обязательного) полный `golden:verify` дают
  соразмерное покрытие.
- Принятие golden baseline (`golden:capture`/`golden:accept -- --reviewed`) —
  вне этого цикла по процессу; baseline принимается только на полном Linux CI
  артефакте.
- `python -m pytest tests_backend` — backend не тронут диффом, прогон не
  требуется.
- Performance-профили (`performance_smoke`, Full Performance) — не названы в
  AC, ТЗ §13 явно не требует отдельного бюджета для этого fixture; не
  запускал.
- Полный `npm run inventory` (актуальные счётчики тестов для документации) —
  не запускал; в этом обзоре количество тестов приведено по фактическому
  выводу `npm test` (900/900), а не скопировано из чужого документа.
