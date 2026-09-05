# ТЗ #461 — быстрый commit промежуточной точки цепочки стен

- **Issue:** https://github.com/Matysh/houseplan-card/issues/461
- **Статус:** первая редакция; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Область:** редактор плана, инструмент «Стены», physical-geometry и junction
  preflight, wall-model write barrier, performance harness
- **Связано:** #451 (лёгкий live-слой и локальный preflight Resize), #330
  (линейные junction limits), #314 (атомарный откат отклонённой геометрии),
  #294 (завершение цепочки без потери сегментов)

## 1. Проблема

В редакторе плана первый клик инструмента «Стены» только ставит начальную
точку. Каждый следующий клик синхронно сохраняет новый сегмент через общий
`_commitPhysicalGeometry()`. До того как браузер сможет показать принятый
отрезок и превью продолжения, этот общий барьер:

1. проверяет физическую геометрию всего пространства;
2. канонизирует wall-segment model;
3. второй раз проверяет физическую геометрию всего пространства;
4. сравнивает junction limits по пространству;
5. записывает историю и запускает сохранение.

На живом плане владельца — 12 комнат, 36 сегментов положительной толщины и
четыре сохранённых черновика — один такой клик занимает 1 278–1 309 мс. Около
720 мс уходят на две полные physical-geometry проверки, ещё около 273 мс — на
junction limits. При удалении четырёх черновиков одна полная проверка падает с
342 до 194 мс: активная и брошенные цепочки делают каждый следующий клик всё
дороже.

Это отдельный hot path, не закрытый #451. #451 прекратила полный render на каждом
`pointermove`, но terminal click по-прежнему блокирует main thread общим
геометрическим commit.

## 2. Сценарий и пользовательский результат

**Персона:** администратор дома.

**Поверхность:** desktop browser, редактор плана, инструмент «Стены»; безопасные
touch-ограничения редактора сохраняются без обещания полной touch-паритетности.

**Момент:** пользователь последовательно ставит точки длинной цепочки в уже
нарисованном пространстве с комнатами, стенами и сохранёнными черновиками.

**До:** после каждого клика со второй точки отрезок и превью продолжения
замирают примерно на секунду; задержка растёт вместе с планом и черновиками.

**После:** каждый промежуточный отрезок появляется без заметной секундной
паузы, остаётся crash-safe и доступен через Undo; при завершении цепочки весь
план по-прежнему проходит полный fail-closed preflight.

## 3. Scope

### 3.1 Входит

1. Отдельный bounded preflight/commit для сохранения очередного сегмента
   активного `room_draft` в текущем model v9.
2. Локальная проекция предыдущего и нового состояния вокруг добавленного
   сегмента с точной production-геометрией затронутого компонента.
3. Локальное сравнение новых junction-limit нарушений с переиспользованием
   physical-geometry артефакта кандидата.
4. Безусловный полный preflight при завершении/преобразовании цепочки.
5. Fallback на существующий полный барьер для legacy-документа, который ещё не
   материализован в текущую wall model.
6. Unit, production-bundle smoke, mutation witnesses и performance benchmark,
   воспроизводящие размер и форму нагрузки из issue.
7. Документация технического write-контракта и release-артефакты.

### 3.2 Не входит

- показ сегмента до окончания проверки, асинхронный optimistic commit и откат
  уже показанного кадра;
- изменение snap, hover, толщины, автообъединения, создания комнаты, Esc,
  Ctrl/Cmd+Z, смены инструмента или поведения `pointercancel`;
- автоматическое удаление или слияние существующих брошенных черновиков;
- ослабление правил physical geometry или junction limits;
- ускорение остальных generic-вызовов `_commitPhysicalGeometry()`;
- изменение backend validation, WebSocket protocol, schema/model version,
  импорта, экспорта или Optimize;
- новая настройка, Labs-флаг или пользовательский текст.

## 4. Нормативный UX-контракт

### 4.1 Первый и последующие клики

- Первый чистый клик при пустой цепочке по-прежнему ставит только начальную
  точку и не создаёт config write.
- Каждый принятый клик начиная со второго добавляет ровно одну точку и один
  segment record с выбранной толщиной.
- Обработчик не возвращает управление до локального verdict: новый сегмент не
  показывается как принятый, если write barrier его отклонил.
- После успеха SVG-превью начинается в новой последней точке; выбранный
  инструмент и active draft остаются теми же.
- Повторный клик, невалидная толщина, превышение лимитов, pan/pinch,
  `pointercancel` и второй pointer сохраняют действующие no-extra-segment и
  no-extra-write правила.

### 4.2 История и persistence

- Один успешный промежуточный клик остаётся одним шагом истории с именем
  `history.draft_segment`.
- Undo/Redo удаляет и возвращает именно последнюю принятую точку вместе с её
  толщиной и стабильным segment ID.
- Сохраняется полный config, а не локальный patch. Очередь записи, revision,
  pending physical transaction и server rejection rollback следуют контракту
  #314 без отдельного пути.
- Отказ preflight до записи восстанавливает `before` локально, очищает
  недопустимый gesture тем же способом и показывает существующий toast. Он не
  оставляет точку, укороченный массив толщин, history entry или config write.
- Отказ backend после optimistic write восстанавливает самый ранний snapshot
  pending-транзакции; более поздний отклонённый сегмент не может быть
  легализован следующим кликом.

### 4.3 Завершение цепочки

Любой действующий terminal path — смена инструмента/редактора/пространства,
`Esc` по #294 и штатное создание/преобразование комнаты — сохраняет свою
нынешнюю семантику. Перед финальным принятием результата вызывается generic
full-space `_commitPhysicalGeometry()`:

- полный physical-geometry preflight не заменяется локальным результатом и не
  берётся из его кэша;
- junction limits сравниваются для полного пространства;
- полный отказ не оставляет частично преобразованную комнату/partition;
- успешное завершение по-прежнему удаляет active draft и сохраняет ordinary
  partitions или комнату в соответствии с текущим сценарием.

Задержка одного terminal действия допустима; переносить её обратно на каждый
промежуточный клик запрещено.

## 5. Граница fast path

Fast path выбирается только когда одновременно выполняются условия:

1. вызов сделан из `_persistActiveDraftSegment()` после добавления одной точки;
2. `before` и live config относятся к одному существующему пространству;
3. документ уже имеет текущую `WALL_SEGMENT_MODEL_VERSION`;
4. изменилось только содержимое одного active `room_draft`, а прочая физическая
   геометрия пространства byte-equivalent соответствующему `before`;
5. новая запись имеет конечные координаты, согласованные `points/segments` и
   стабильную идентичность.

Если любое условие не доказано, используется существующий generic full-space
barrier. Неизвестное состояние не считается разрешением ускоренного пути.

Первый структурный write legacy-документа обязан пройти прежнюю полную
materialisation/identity проверку. Если он успешен и документ стал текущей
версии, следующие сегменты той же цепочки могут использовать fast path.

## 6. Локальный physical-geometry proof

### 6.1 Seed

Seed — новый segment active draft и две его конечные точки. Предыдущие сегменты
этой цепочки не включаются автоматически целиком: в proof входят только те,
которые геометрически способны взаимодействовать с seed по правилам ниже.
Именно это не даёт стоимости расти с каждым кликом длинной цепочки.

### 6.2 Что обязательно входит

Одинаковый pure projector строит local `before` и local `candidate`. Он обязан
сохранить идентичность и неизвестные поля выбранных записей и включить:

- seed и все положительно-толстые/нулевые rays, инцидентные любой его конечной
  точке;
- коллинеарный связный run, необходимый для правила минимальной длины стены;
- room wall atoms и комнаты, чьи реальные wall/body envelopes касаются seed
  либо первого слоя включённых соседей;
- partitions и сегменты других drafts, тело или ось которых пересекает либо
  входит в применимый 5-сантиметровый clearance seed-компонента;
- wall columns, способные пересечь тот же компонент с учётом фактического
  размера;
- openings/open spans, hosted либо геометрически относящиеся к выбранным
  стенам/комнатам/partitions;
- все rays конкретного junction, если в компонент вошёл хотя бы один его ray,
  чтобы angle/valence нельзя было доказать неполным узлом;
- malformed/непозиционируемую физическую запись, если projector не может
  доказать, что она удалённая. Неизвестное fail-closed, а не исчезает из proof.

Простое сравнение AABB осей без толщины недопустимо. Расстояния учитывают
фактическую половину толщины обеих стен/перегородок, размер колонны, grid
epsilon и 5-сантиметровое правило узлов.

### 6.3 Что исключается

Комнаты, стены, независимые тела и старые drafts, для которых pure projector
доказал отсутствие указанного контакта, не входят в local config. Удвоение
числа таких удалённых объектов не должно удваивать стоимость клика.

Фильтрация не изменяет исходный config и не становится новой persist-моделью.
Она создаёт только runtime proof input.

### 6.4 Exact production pass

На local candidate выполняется `checkSpacePhysicalGeometry()` с теми же
`prepareSpacePhysicalGeometryInputs`, `wallBodiesGeometry` и
`floorFootprintGeometry`, что используются generic barrier/Optimize. Упрощённая
геометрическая формула специально для теста или fast path запрещена.

Успешный wall pass отдаёт свой `roomGeom`/`multiWallNodes` как transient
артефакт следующему junction proof. Один candidate click не оплачивает тот же
wall union второй раз.

Исключение, `null`, `degraded-extra`, `failed-core`, floor failure либо
невозможность построить local candidate отклоняют fast path и приводят к
generic full barrier; они не дают fail-open принятия.

## 7. Локальный junction-limit proof

- Previous и candidate сравниваются после одной и той же wall-model
  materialisation и через один и тот же local projector.
- `checkNodes`, valence/angle, полная длина включённого collinear run и
  node-distance применяются ко всем segment records local component.
- Room-clearance считается только для вошедших комнат и использует wall
  artifact из §6.4; повторный union запрещён.
- Унаследованное local-нарушение не блокирует клик. Любое увеличение нарушения
  по действующим правилам отклоняет его тем же toast, что generic barrier.
- Ошибка candidate judgment остаётся `check_failed` и отклоняет write.
- Кэш baseline допустим только по identity/fingerprint `before`, space и seed
  component; stale reuse после следующего принятого сегмента запрещён.

## 8. Эквивалентность generic barrier

На наборе локальных вмешательств fast path и generic full barrier обязаны иметь
одинаковый verdict:

- новый сегмент продолжает свободную цепочку;
- 14°/15° junction;
- valence 6/7;
- стена 19/20 см и короткий атом внутри более длинного collinear run;
- node distance 4/5 см до чужой стены и узла;
- пересечение комнаты, partition, другого draft и column;
- физический `wall-degraded-extra` на соседней комнате из production fixture
  #278;
- hosted room/partition opening рядом с seed;
- нулевая стена;
- malformed local carrier.

Отдельная fixture добавляет много удалённых валидных комнат и drafts. Их
наличие не меняет verdict локального вмешательства. Full terminal barrier всё
равно видит намеренно повреждённую удалённую геометрию и отказывает завершению.

## 9. Performance-контракт

### 9.1 Профиль

Добавляется отдельный воспроизводимый профиль `wall-draw-click-v1` на
production bundle. Основная fixture соответствует живому измерению:

- пять пространств в config;
- редактируемое пространство: 12 комнат, не менее 36 сегментов с
  положительной толщиной и четыре сохранённых open drafts;
- активная новая цепочка ставит не менее семи последовательных сегментов после
  warm-up;
- remote-вариант удваивает число не взаимодействующих с seed физических
  сегментов без изменения local component.

Runner измеряет время terminal click от входа в production handler до его
возврата, число full/local physical passes, wall unions, junction passes,
history entries и config writes. Synthetic click считается валидным только
если он действительно дошёл до `_persistActiveDraftSegment()` и изменил draft.

### 9.2 Структурные assertions

Для каждого промежуточного клика текущего v9-документа:

- `fullSpacePhysicalChecks = 0`;
- `localPhysicalChecks = 1`;
- candidate wall union выполнен не более одного раза и переиспользован в
  junction proof;
- одна history entry и одна queued config write;
- число объектов local proof ограничено геометрическим компонентом, а не
  общим числом комнат/черновиков пространства.

Для terminal finish — как минимум одна независимая full-space physical
проверка и полный junction verdict. Для legacy первого structural write —
generic full barrier, а не fast path.

Assertions краснят runner независимо от времени.

### 9.3 Абсолютные и scaling budgets

На каноническом Linux browser runner после warm-up:

| Метрика | Бюджет |
|---|---:|
| median terminal click, fixture 36 segments + 4 drafts | ≤ 150 мс |
| худший из 7 измеряемых кликов | ≤ 250 мс |
| remote-вариант с удвоенным числом удалённых сегментов | не более `base × 1.5 + 20 мс` |

Это bootstrap-потолки относительно измеренных 1 278–1 309 мс, а не разрешение
расходовать весь кадр. Они дополняют structural assertions и существующие
base-relative performance checks. Ослаблять другие budgets запрещено.

Node/unit benchmark дополнительно проверяет, что 80 удалённых сегментов не
дороже 40 более чем вдвое; его главный witness — счётчики выбранного local
component, поэтому шум таймера не может скрыть возврат full-space пути.

## 10. Acceptance criteria

- **AC1 (`unit` + `smoke`):** первый клик не пишет config; каждый следующий
  успешный клик добавляет одну точку/толщину/ID, одну history entry и одну
  queued write, оставляя active draft и preview в новой точке.
- **AC2 (`unit` + code review):** fast path доступен только
  `_persistActiveDraftSegment()` на доказанном current-model draft-only diff;
  legacy, mixed либо unknown diff использует generic barrier.
- **AC3 (`unit`):** pure local projector выполняет правила §6 для комнат,
  room walls, partitions, drafts, columns, openings, zero walls, junction rays
  и malformed records; удалённая геометрия исключается детерминированно.
- **AC4 (`unit` + mutation witness):** verdict fast/full совпадает на матрице
  §8. Мутации «выбросить соседнюю комнату», «не включать чужой draft/column» и
  «не замыкать junction rays» делают соответствующие проверки красными.
- **AC5 (`unit` + mutation witness):** candidate physical artifact
  переиспользуется junction proof и candidate wall union не считается второй
  раз; возврат повторного union красит счётчик/benchmark.
- **AC6 (`unit` + `smoke`):** отказ local proof полностью восстанавливает
  `before`, не пишет history/config и показывает действующий rule/geometry
  toast; снятие rollback красит отрицательный smoke.
- **AC7 (`smoke` + mutation witness):** все terminal paths §4.3 выполняют
  независимый full-space preflight. Мутация, заменяющая его local verdict,
  краснеет на fixture с удалённой повреждённой геометрией.
- **AC8 (`smoke`):** Undo/Redo, server rejection rollback #314, merge двух
  drafts, room offer/creation, Esc #294, смена инструмента и pointer/touch
  cancellation сохраняют существующие результаты и число записей.
- **AC9 (`performance`):** профиль `wall-draw-click-v1` проходит structural,
  absolute и scaling budgets §9; возврат generic full preflight на каждый клик
  доказанно красит профиль.
- **AC10 (`typecheck` + `unit` + `build`):** implementation-loop гейты зелёные,
  no-new-any не ухудшен, generated bundles синхронны.
- **AC11 (`golden` + existing smoke):** задача не меняет пиксели; canonical
  light/dark Plan frames совпадают с эталоном, существующие wall-draw,
  wall-chain, physical-geometry, junction и touch smokes зелёные без ослабления
  ожиданий.
- **AC12 (`documentation review`):** architecture/compatibility и performance
  README описывают новую границу; оба changelog содержат пользовательский
  эффект со ссылкой на #461. Новых i18n-ключей нет.

## 11. План автотестов

### 11.1 Unit

- projector: выбор каждого типа локальной геометрии, фактическая толщина и
  clearance, incident closure, collinear run, malformed fail-closed, stable
  identity/unknown fields, отсутствие mutation исходного config;
- route guard: v9 draft-only, legacy, mixed diff, no-op и missing snapshot;
- parity матрица §8 для previous/candidate;
- wall-artifact reuse и число full/local passes;
- history/pending-write/rejection invariants.

### 11.2 Targeted production-bundle smoke

- реальная pointer/click цепочка на fixture §9: preview, persistence, Undo/Redo,
  Esc/finish и повторный вход;
- local physical/junction rejection с проверкой UI и нулевой записи;
- backend rejection после двух быстро принятых сегментов;
- mouse и один безопасный touch путь: pan/pinch/cancel не создают сегмент;
- все сценарии synthetic events обязаны подтвердить вход в production handler.

### 11.3 Mutation gate

В `scripts/mutation-gate.mjs` регистрируются как минимум witnesses:

1. `wall-draw-full-preflight-again` — промежуточный click возвращён на generic
   full-space barrier;
2. `wall-draw-local-neighbour-dropped` — projector теряет взаимодействующий
   соседний body/room;
3. `wall-draw-terminal-full-check-skipped` — finish доверяет local verdict;
4. `wall-draw-rejection-rollback-skipped` — отклонённая точка остаётся в draft.

Каждый мутант связан с точной командой и ожидаемым красным тестом для таблицы
«AC · чем доказан · чем краснеет» код-ревью.

### 11.4 Гейты

- цикл реализации: `npm run typecheck`, `npm test`, `npm run build`;
- до передачи на код-ревью: targeted production-bundle smoke, benchmark #461,
  `npm run bundle:sync`, `npm run bundle:budget`, `check-docs`, `no-new-any`;
- canonical screenshots после `src/**`: только Linux capture, ожидается нулевой
  diff; принимать новые эталоны этой задачей нельзя без найденной отдельной
  визуальной причины;
- перед бетой: полный smoke/golden/performance и HA harness по runbook.

## 12. Модель данных, совместимость и i18n

- Schema и `model_version` не меняются.
- Persisted `rooms`, `wall_segments`, `room_drafts[].points/segments`,
  partitions, columns и openings сохраняют существующий формат и unknown-field
  round-trip.
- Legacy read остаётся side-effect free; первый structural write проходит
  полный current barrier и материализует wall identity по прежним правилам.
- Older frontend/backend interoperability не меняется: сервер получает тот же
  полный config и применяет свои действующие validators.
- Новых i18n-ключей и текстов нет; используются существующие history/toast
  строки.

## 13. Touch, accessibility и security

- View, kiosk и household-member surfaces не затронуты.
- Редактор остаётся desktop-first. Один чистый touch tap может добавить один
  сегмент; pan, pinch, second pointer и `pointercancel` — ни одного, как требует
  `docs/TOUCH-SUPPORT.md`.
- Keyboard, focus и screen-reader контракт не меняются.
- Новых HA actions, прав, network endpoints и данных в логах нет.
- Проектор/benchmark не публикует пользовательскую геометрию; fixture
  синтетическая.

## 14. Ожидаемые модули и файлы

Точные имена новых pure-модулей не являются продуктовым контрактом. Ожидаются:

1. `src/houseplan-editor-runtime.ts` — выбор fast path, commit/rollback/history
   и terminal full barrier.
2. Новый узкий `src/*draft*preflight*.ts` либо обобщённый существующий helper —
   pure local projector и proof result/counters.
3. При необходимости `src/resize-live-preflight.ts`,
   `src/plan-geometry-preflight.ts`, `src/junction-limits.ts` — только
   переиспользуемые seams без изменения действующих verdicts.
4. `test/*draft*preflight*.test.mjs` и регрессии существующих wall/junction
   suites.
5. `demo/smoke_*wall*draw*.mjs`, `demo/benchmark_*wall*draw*.mjs`, performance
   budgets/README и регистрация smoke/CI.
6. `scripts/mutation-gate.mjs` и fixtures witnesses.
7. `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
   `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`; generated bundles.

## 15. Риски и меры

| Риск | Мера |
|---|---|
| Local projector не включает влияющего соседа | §6 задаёт физические envelopes и closure; parity fixtures и три отрицательных мутанта; terminal full check независим |
| Ускорение случайно ослабляет legacy migration | fast path закрыт до current model; отдельный legacy regression |
| Старое нарушение удалённой области блокирует локальный клик иначе, чем раньше | это намеренная граница: локальный клик отвечает только за введённое им изменение; terminal full check сохраняет общий verdict |
| Повторное использование wall artifact становится stale | artifact живёт один click и связан с candidate fingerprint; тест меняет candidate между вызовами |
| Performance test флапает | structural counters являются главным verdict; timing — median после warm-up с широким bootstrap budget |
| Backend позже отклоняет промежуточную запись | прежняя очередь и атомарный rollback #314 не обходятся; end-to-end rejection smoke |
| Рефакторинг generic barrier затрагивает другие редакторские операции | fast path доступен только одному call site; все остальные вызовы остаются прежними |

## 16. Откат

Чистый revert fast path возвращает `_persistActiveDraftSegment()` на generic
barrier. Миграция и восстановление данных не нужны: ускоренный путь сохраняет
тот же current-model config. Новые runtime helpers/caches не переживают remount.

Если performance-гейт выявит недостаточную локализацию, откатывается fast path,
а не ослабляются physical/junction правила, rollback либо terminal full check.

## 17. Release-артефакты

- обычная следующая beta после зелёного code review;
- `docs/CHANGELOG.ru.md` и `docs/CHANGELOG.md`: одна пользовательская запись о
  быстрой фиксации отрезков на больших планах со ссылкой на #461;
- `docs/ARCHITECTURE.md` и `docs/CONFIG-COMPATIBILITY.md`: intermediate-local /
  terminal-full write boundary;
- `demo/performance/README.md`: профиль, counters, budgets и локальный запуск;
- пользовательский гайд не меняется: видимое поведение и команды прежние;
- новые screenshots/golden не ожидаются; canonical capture должен подтвердить
  отсутствие pixel diff;
- release body формируется штатно при выпуске и не обещает численный budget
  конкретного компьютера пользователя.

## 18. Принятые предположения

1. Не показываем отрезок до verdict и не вводим асинхронный optimistic кадр:
   пользователь видит прежнюю последовательность, только быстрее.
2. Не удаляем брошенные drafts автоматически — это пользовательские данные;
   задача лишь перестаёт платить их полную стоимость на каждом новом клике.
3. Не ускоряем generic `_commitPhysicalGeometry()` для resize, openings,
   columns и других writers: их оптимизация требует отдельных профилей.
4. Число 150 мс — acceptance budget канонического runner, а не обещание
   одинакового wall-clock времени на любом клиентском устройстве.
5. Точные имена helper-файлов и форма bounded runtime cache технические и могут
   меняться при ревью без изменения UX/AC.
