# Issue #276 — совпадающая partition становится одной общей стеной

- **Issue:** https://github.com/Matysh/houseplan-card/issues/276
- **Статус:** первая редакция для ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 8/10;
  сложность 7/10; риск 8/10
- **Область:** Optimize, независимые стены и hosted openings, общие границы,
  Wall thickness, Boundary, Plan/View/static/hidden Iso и световая геометрия
- **Модель данных:** без schema migration; явная lossless-канонизация по команде
- **Связано:** #132, #173, #177, #186, #199, #229, #276, #277, #278,
  `docs/WALL-THICKNESS.md`, `docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`

## 1. Сценарий и персона

Домашний администратор построил соседние комнаты и отдельно нарисовал стену на
уже существующей общей границе. На independent partition размещена дверь. Для
человека это одна физическая стена, однако модель хранит два тела: room wall и
partition.

В `1.67.0-beta.7` уменьшение толщины room wall визуально не действует, увеличение
создаёт ступень, а инструмент «Граница» отказывается сделать участок
виртуальным. Optimize сливает только соседние partitions и не устраняет
совпадение с room wall.

После исправления явная команда Optimize превращает доказанно эквивалентную
пару в одну общую room wall, безопасно переводит hosted openings в обычные
проёмы этой границы и становится идемпотентной. После этого Thickness и Boundary
редактируют ровно один физический объект.

## 2. Подтверждённая причина

На исследованном экспорте две shared room boundaries полностью совпадают с
independent partitions. Первая пара имеет 20/20 см, вторая — room wall 30 см и
вложенную в неё partition 20 см. Обе partitions содержат hosted doors; у концов
границ есть корректные короткие ортогональные рёбра.

- `physicalBodyParts()` добавляет partition независимо от room masonry;
- hosted cut режет partition и, через composite-room-wall resolver, room wall,
  но идентичность объектов не устраняет;
- `_boundaryBlocked()` считает partition препятствием поверх shared boundary;
- wall-thickness изменяет room interval, оставляя partition прежней;
- `optimizePlans()` умеет `mergeCollinearPartitions()`, но не умеет
  room-wall/partition reconciliation.

Короткое 5-см ребро не является причиной. Дефект — семантически дублированная
физическая стена.

## 3. Зафиксированное продуктовое решение

1. Исправление существующих данных выполняется только явной командой
   «Оптимизировать планы», с preview/report, единым Apply и прежним Undo.
2. Автоматически удаляется только partition, для которой доказана полная
   физическая эквивалентность одной solid shared room boundary.
3. Все hosted openings удаляемой partition сохраняются как ordinary room-wall
   openings с теми же id, типом, длиной, ориентацией, contact/lock и прочими
   неизвестными полями.
4. Для одного exact coincident body каноническая толщина room wall равна
   `max(roomCm, partitionCm)`: это не эвристический выбор, а точный внешний
   envelope union двух соосных прямоугольных тел. Неоднозначный/неоднородный
   случай остаётся без изменений; Optimize не удаляет проём и не угадывает
   ближайшую стену.
5. После успешной канонизации видимая кладка и проёмы не меняют положение;
   Thickness и Boundary начинают работать с единственной общей стеной.
6. Рендер сам по себе ничего не записывает. Общая защита от исчезновения всей
   кладки относится к #278.

Открытых продуктовых вопросов нет.

## 4. Точное условие безопасной канонизации

Одна partition является кандидатом только если одновременно выполняется всё:

1. `a/b`, `cm` и длина конечны; длина больше действующего geometry epsilon.
2. Её ось совпадает endpoint-to-endpoint, с учётом направления, ровно с одним
   атомарным solid shared interval двух разных комнат. Частичное покрытие,
   несколько составных intervals и внешний/одиночный room edge не подходят.
3. Shared interval не virtual/open и имеет одну ненулевую эффективную толщину
   на всей длине.
4. `partition.cm` конечна и положительна. Итоговая effective thickness
   `max(roomCm, partition.cm)` даёт точно тот же centred physical envelope,
   что исходный union. Сравниваются физические сантиметры, а не SVG half-depth
   либо compatibility key.
5. На той же оси нет второй independent partition/draft/column и нет
   неоднозначного перекрытия с другой room boundary.
6. Каждый hosted opening partition успешно разрешается compat-resolver'ом,
   полностью помещается на shared interval и после снятия `host` однозначно
   разрешается на ту же ось, центр и угол как ordinary opening.
7. После преобразования проёмы не перекрываются между собой и не конфликтуют с
   уже существующим ordinary opening на том же месте.
8. Точный candidate проходит общий geometry preflight #199 до того, как
   Optimize предложит Apply.

Проверка использует production coordinate contract: room geometry в render
coordinates, persisted `partition.a/b`, `walls[].a/b` и openings — в своих
документированных координатах. Пользовательская сетка не является epsilon.

## 5. Преобразование

Для каждого безопасного кандидата в детерминированном порядке:

1. разрешить все hosted openings на исходной partition;
2. для каждого opening записать совместимые `x/y/angle` из разрешённого центра,
   удалить только `host`, сохранить все остальные известные и неизвестные поля;
3. удалить partition;
4. если partition не толще room wall, не создавать новую wall-запись; если
   толще — lossless установить exact shared interval в
   `max(roomCm, partitionCm)`. Остальные `walls` и `open_spans` не переписывать
   сверх обычной lossless canonicalization Optimize;
5. после всей пачки повторно подготовить exact production geometry и выполнить
   preflight;
6. если любой шаг либо preflight неуспешен, весь Optimize candidate отклоняется
   до WS-вызова; исходный config/layout/Undo остаются byte-equivalent.

Преобразование идемпотентно. Повторный `optimizePlans()` не удаляет ничего и
возвращает нулевые новые счётчики.

## 6. UI и отчёт Optimize

Preview добавляет две строки/счётчика:

- `Совпадающие перегородки преобразованы в стены: N` /
  `Coincident partitions converted to room walls: N`;
- `Проёмы перепривязаны к стенам комнат: N` /
  `Openings reattached to room walls: N`.

Нулевые строки скрыты по действующему правилу отчёта. Общая сумма изменений и
кнопка Apply учитывают оба счётчика. Failure preflight использует существующий
диалог #199 и не раскрывает внутренние id/координаты.

После Apply:

- Wall thickness 20→10 и 20→30 немедленно дают выбранную видимую толщину;
- Boundary разрешает сделать общую стену virtual;
- door/window/gate остаётся на прежнем месте и продолжает использовать
  прежние contact/lock bindings;
- одноразовый серверный Undo Optimize восстанавливает partition и исходный
  hosted `host`. Отдельного Redo у Optimize нет; следующая edit-операция делает
  server backup устаревшим по действующему контракту.

## 7. В скоупе

- pure reconciliation helper и типизированный отчёт;
- интеграция в exact candidate `optimizePlans()` до storage canonicalization;
- перенос hosted opening к ordinary shared-room opening;
- UI/i18n отчёта Optimize;
- parity канонической геометрии всех runtime consumers после Apply;
- синтетическая fixture с двумя комнатами, короткими 5-см end offsets,
  совпадающей partition и hosted door;
- unit, production-bundle smoke, Optimize preflight, one-shot Undo, mutation и
  targeted visual regression;
- документация и release artifacts.

## 8. Не входит

- частично совпадающие, более длинные/короткие либо составные partitions;
- неоднородный effective room profile, несколько coincident partitions либо
  конфликты, для которых один `max` не описывает исходный physical envelope;
- перенос или удаление drafts/columns;
- автоматическая запись при render/load;
- nearest-wall восстановление orphan hosted opening;
- изменение schema `OpeningCfg` либо backend migration;
- исправление Resize (#277) и generic wall-union fallback (#278);
- публикация hidden Iso.

## 9. Архитектурный контракт

1. Pure helper живёт рядом с Optimize/wall merge либо в отдельном модуле и
   возвращает candidate + counts/reasons без мутации входа.
2. Shared-wall eligibility переиспользует canonical wall intervals и opening
   resolvers; отдельная упрощённая модель совпадения запрещена.
3. Рендер, Boundary и Thickness не получают скрытых runtime-исключений. Их
   исправление является следствием одной persisted physical object после Apply.
4. `PLAN_MODEL_VERSION` повышается только если новый pass должен один раз
   маркировать реально изменённый план; version marker без meaningful diff не
   создаётся.
5. Backend остаётся atomic storage/schema/revision boundary. Frontend exact
   geometry preflight выполняется до единственного WS call.
6. Unknown fields partition не переносятся в room wall: auto-reconciliation
   разрешён только для действующей `PartitionCfg`; неизвестное поле, способное
   означать особую семантику, делает candidate неоднозначным и оставляет его.

## 10. Производительность

Pass запускается только при открытии Optimize и повторной проверке изменившегося
fingerprint перед Apply, не на pointer/render/state paths. Для large-house
fixture дополнительный p95 не превышает 15% от текущего Optimize candidate pass
и 25 ms абсолютного overhead на той же машине. Память не кэширует geometry
между диалогами.

## 10.1. Затронутые файлы и модули

Ожидаемый implementation scope:

- новый pure helper `src/coincident-partition-reconciliation.ts` либо
  эквивалентный узкий модуль;
- `src/plan-optimizer.ts` — вызов pass, идемпотентность и новые counters;
- `src/partition-openings.ts` — переиспользуемое exact rehost/materialization;
- `src/plan-geometry-preflight.ts` — проверка точного post-pass candidate без
  отдельной модели production inputs;
- `src/houseplan-card.ts` — строки отчёта Optimize и one-shot Undo integration;
- `src/types.ts` только если existing types нельзя переиспользовать без копии;
- `src/i18n/en.json`, `src/i18n/ru.json`;
- `test/coincident-partition-reconciliation.test.mjs`,
  `test/plan-optimizer.test.mjs`, `test/partition-openings.test.mjs`;
- `demo/smoke_optimize_coincident_partition.mjs`, targeted benchmark/golden и
  `scripts/mutation-gate.mjs`/smoke registry;
- перечисленные в §14 release/docs artifacts и tracked bundles.

Backend Python, schema/manifest и unrelated editor modules не меняются.

## 10.2. Риски и меры

| Риск | Мера |
|---|---|
| Partial либо merely-near partition ошибочно удаляется | Exact endpoint-to-endpoint + one atomic shared interval + negative AC2/mutant. |
| Разные 20/30 см ошибочно считаются конфликтом либо меняют видимый envelope | Явный `max(roomCm, partitionCm)` для centred exact bodies, nested/wider fixtures и geometry-equivalence AC2/AC5. |
| Rehost сдвигает/разворачивает проём или теряет sensor fields | Resolve исходного host, materialize centre/angle, unknown-field round-trip AC3. |
| Конфликтующий ordinary opening превращается в duplicate | Ambiguity fail-closed AC4; автоматического dedup нет. |
| Candidate выглядит эквивалентно, но ломает canonical boolean geometry | Shared post-pass preflight #199 до WS, zero-write AC9. |
| Optimize перестаёт быть идемпотентным после backend rounding | Storage canonicalization + second pass/backend echo AC8. |
| UI обещает несуществующий Redo | Только действующий one-shot Undo; smoke проверяет disappearance/expiry server backup. |
| Новый pass замедляет обычный render | Helper вызывается только в Optimize candidate/recheck; §10 benchmark и call-count. |
| Старые версии не смогут прочитать результат | Результат использует существующие ordinary openings/room walls; rollback §14 без schema migration. |

## 11. Touch и accessibility

Новых жестов нет. Optimize dialog доступен мышью и touch; failure и Apply не
зависят от hover. Существующие focus trap, Escape, disabled/busy и restore-focus
сохраняются. View/киоск остаются release-blocking и получают тот же structural
result после Apply.

## 12. Критерии приёмки

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Exact shared-wall partition определяется независимо от направления endpoints и порядка комнат. | Unit matrix. |
| AC2 | Exact same-cm, narrower-partition (20 внутри 30) и wider-partition (30 поверх 20) канонизируются с итогом `max`; partial/longer/shorter/composite/non-shared/virtual/non-uniform/ambiguous-extra cases остаются byte-equivalent. | Positive/negative unit matrix. |
| AC3 | Один и несколько hosted door/window/gate переводятся в ordinary openings без сдвига центра/угла и без потери любых полей. | Unit + schema/unknown-field test. |
| AC4 | Orphan, non-fitting, overlapping или ambiguous opening запрещает преобразование без частичного результата. | Unit mutation matrix. |
| AC5 | После candidate physical geometry и opening cuts эквивалентны исходному видимому результату; после 20→10/30 существует ровно одно тело выбранной толщины. | Canonical geometry unit + targeted golden. |
| AC6 | Boundary после Apply не blocked и virtual conversion сохраняет opening; до Apply никакого скрытого config write нет. | Production-bundle smoke. |
| AC7 | Optimize report показывает точные RU/EN counters; Apply — один WS call, одноразовый server Undo восстанавливает исходную форму и становится недоступен после следующей edit по действующему контракту. | i18n unit + browser smoke. |
| AC8 | Первый Optimize меняет fixture, второй является no-op; backend echo/canonical coordinates не создают третий diff. | Optimizer round-trip unit. |
| AC9 | Exact candidate проходит shared #199 preflight; forced failure блокирует весь Apply и делает 0 writes. | Injectable unit + browser smoke. |
| AC10 | Plan, View/static, hidden Iso, floor/paper, Glow/source guard и солнце получают один canonical body после Apply. | Consumer parity test + code review. |
| AC11 | Large-house benchmark выполняет бюджет §10 и helper не вызывается на render/pointer. | Benchmark + call-count test. |
| AC12 | Мутации «удалить без rehost», «принять partial» и «обойти post-pass preflight» пойманы 1/1. | Mutation gate. |
| AC13 | Typecheck, unit, build и targeted smokes зелёные; три tracked bundle-копии byte-identical. | Fast gates. |
| AC14 | RU/EN changelog и пользовательская/архитектурная/тестовая документация актуальны. | Docs gate + review. |

## 13. План тестов

- `test/coincident-partitions.test.mjs`: AC1–AC5, AC8;
- расширение `test/plan-optimizer.test.mjs`: report, idempotence, backend echo;
- расширение `test/partition-openings.test.mjs`: exact rehost и ambiguity;
- `demo/smoke_optimize_coincident_partition.mjs`: production bundle,
  RU/EN preview, Apply/one-shot Undo, Thickness/Boundary;
- targeted golden: short 5-cm offsets + hosted door до/после 10/30/virtual;
- mutation ids для AC12;
- targeted benchmark поверх large-house fixture.

Полные golden/smoke/performance и Linux HA harness выполняются перед бетой по
процессу, а не в implementation loop.

## 14. Release-артефакты и rollback

Изменение пользовательское. Коммит реализации содержит `User-Visible: yes` и:

- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` со ссылкой #276;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` — что исправляет Optimize;
- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`;
- `docs/TESTING.md`, `docs/STATUS.md`;
- RU/EN i18n, tests/smoke/mutations/benchmark и reviewed golden candidate;
- синхронные tracked bundles и docs screenshot fingerprint при необходимости.

Rollback — revert implementation commit. Уже преобразованный plan остаётся
валидным: ordinary opening и room wall читаются старыми версиями. Обратная
автоматическая миграция в redundant partition не выполняется; пользователь
может вернуть exact исходное состояние штатным Undo до следующей операции либо
из backup/export.

## 15. Принятые технические предположения

1. Geometry helper/module names и внутренние reason codes не являются API.
2. Thickness envelope использует конечные physical `cm` после действующей
   validation и точный `max` для centered coincident bodies, без
   цветового/пиксельного сравнения.
3. Report хранит два счётчика, потому что один partition может иметь несколько
   openings; UI показывает человеку и structural, и reference change.
4. Короткие 5-см рёбра fixture сохраняются; pass не упрощает room topology.
5. Existing ordinary opening с иным id, но тем же slot, считается ambiguity и
   не дедуплицируется автоматически.
