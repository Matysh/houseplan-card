# CODE-REVIEW — issue #441 · заход r1

Ветка `issue/441-vacuum-route-draft`, коммит на ревью `fa41d298` (после
приведения к dev конвейером; исходный коммит автора — `014b7480`,
логически тот же диф). Заход первый, разбор полный.

## Скоуп

Баг: блок «Карты и этажи» писал второй и последующий маршрут пылесоса
с `space: ''`, что отвергают и семантический валидатор, и
voluptuous-схема. Кнопка «Добавить текущую карту» при этом оставалась
активной, а отклонённая запись ничего не откатывала.

Три AC (trivial-трек, ТЗ = §9.2 из `docs/specs/162-vacuum-map-space-routing.md`):
- AC1 — черновик до выбора этажа;
- AC2 — только валидная атомарная запись;
- AC3 — отмена/отказ не оставляют фантом.

Диф: `src/editors/vacuum-maps-section.ts`, `src/vacuum-route-edit.ts`
(новый черновичный API), `test/vacuum-routes.test.mjs`,
`demo/smoke_vacuum_route_draft.mjs` (новый), `scripts/smoke-links.mjs`,
`docs/CHANGELOG.md` / `.ru.md`, плюс однострочная правка вызова в
`src/houseplan-editor-runtime.ts` (убран неиспользуемый параметр
`setVac`). Backend, i18n, View, модель геометрии не тронуты — совпадает
с заявлением автора и с оценкой владельца.

## Как проверялось

Ручного тестирования в цикле нет, поэтому доказательства — тест
(с проверкой, что он умеет падать) и чтение кода.

**AC1** — `beginVacuumRouteDraft` (`src/vacuum-route-edit.ts:30-35`):
`space: routes.length ? '' : dockSpace`. Первый маршрут (routes.length
== 0, включая виртуальные legacy-маршруты через `effectiveRoutes`)
наследует этаж дока, второй и следующие — пустая строка. Кнопка
«Сохранить» в черновике: `?disabled=${!!draft.saving ||
!spaceIds.has(draft.space)}` (`vacuum-maps-section.ts:283`) — недоступна,
пока `space` не входит в множество существующих этажей. Доказано
юнит-тестом `test/vacuum-routes.test.mjs:279` (АC1) — **проверил, что
тест умеет падать**: временно вернул старую формулу
`space: dockSpace` (без `routes.length ?`), тест 25 упал
(`not ok 25`), после отката — снова зелёный (`node --test
test/vacuum-routes.test.mjs`: 32/32). Дополнительно смоком
`demo/smoke_vacuum_route_draft.mjs` (`firstRoutePreselectsDock`,
`secondCurrentStartsBlank`, `separateSourceStartsBlank`,
`blankDraftCannotSave`) — прогнан, зелёный.

**AC2** — `commitVacuumRouteDraft` (`vacuum-route-edit.ts:45-56`)
возвращает `null`, если `space` не входит в `spaceIds`, либо если пара
`source`+`map_id` уже существует среди маршрутов; иначе — ровно один
новый маршрут через `addRoute`. `writeRoutes` в `vacuum-maps-section.ts:126-137`
конвертирует legacy весь целиком (`convertLegacyRoutes`, не тронут
этим дифом) и передаёт кандидат в `persistRoutes` только если он не
`null` — невалидная запись никогда не доходит до сохранения. Доказано
юнит-тестом `test/vacuum-routes.test.mjs:287` (AC2, включая проверку
«одну карту нельзя добавить дважды») и смоком
(`noEmptySpaceEverSubmitted`, `rejectedPayloadWasValid`,
`retryKeepsExactIdentity`).

**AC3** — `persistRoutes` (`vacuum-maps-section.ts:89-123`) сохраняет
`previous = host._serverCfg` до применения, использует
`optimisticAttempt`/`rollbackOptimistic` (`src/serialized-write-queue.ts`)
для отката именно этой попытки (защищено сверкой `_cfgRev` — чужая
более новая правка откатом не будет затёрта). `confirmDraft`
(`vacuum-maps-section.ts:240-255`) при отказе восстанавливает исходный
`current` (без `saving: true`), при успехе — удаляет черновик; в обоих
случаях `pendingRoute` не трогается, если за время ожидания
изменилась identity черновика (гонка с параллельным закрытием
диалога). Отмена (`cancelDraft`) не вызывает `writeRoutes` вовсе —
конфигурация не меняется. Доказано смоком: `cancelLeavesAcceptedRoutes`,
`rejectionRestoresAcceptedMarker` (после синтетического отказа
бэкенда первый маршрут `r1` не изменился), `rejectionKeepsEditorUsable`
(черновик остаётся с выбранным этажом, повторное сохранение проходит
без переоткрытия диалога).

Прочитал also `docs/SCOPE.md` (J4/J6 — штатная настройка через GUI и
поддержание валидности конфига), `AGENTS.md`/`PROCESS.md` (формат
вердикта, трейлеры), issue #441 целиком и все три комментария
(аналитика, взятие в работу, отчёт о реализации).

## Гейты — что прогнал и с каким результатом

- `npx tsc --noEmit` — чисто, без вывода.
- `npm test` — 1857 тестов, 1856 passed, 1 skipped, 0 fail (совпадает
  с заявлением автора). Отдельно перепрогнал
  `test/vacuum-routes.test.mjs` и подтвердил, что новые тесты AC1/AC2
  падают на буквальном откате фикса (см. выше) — дисциплина
  «тест умеет падать» соблюдена для прогнанных тестов.
- `npm run build` и `npm run bundle:sync` — зелёные, три копии бандла
  (`dist/`, `custom_components/houseplan/frontend/`,
  `demo/srv/assets`) синхронны и байт-в-байт совпадают с
  закоммиченными после пересборки — working tree после прогона чист.
- `node scripts/check-docs.mjs` — **КРАСНЫЙ**: `ERROR screenshot
  source fingerprint is stale; run npm run build && node
  demo/docs/capture.mjs`. Перепроверил на `origin/dev` (тот же
  чекаут скриптов) — там гейт зелёный («Documentation checks passed»),
  то есть красный статус — следствие именно этого дифа (правка
  `src/editors/vacuum-maps-section.ts` затронула отпечаток всего
  `src/**`), а не унаследованная проблема. Автор не называет этот шаг
  в своём списке проверок. См. находку ниже.
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` —
  32 символа на изменённых строках, 23 «прямых совпадения» + 23 «слабые
  связи», НЕОПРЕДЕЛЁННОСТИ нет. Все прямые совпадения — это общие
  символы записи конфига (`_cfgRev`, `_saveConfigDebounced`,
  `_cfgContentFingerprint`, `_showToast`, `DevItem`, `Marker`),
  которые встречаются в диффе только потому что `persistRoutes`
  впервые применяет к путям retarget/drop уже существующий разделяемый
  механизм `optimisticAttempt`/`rollbackOptimistic` (сам механизм этим
  дифом не тронут — правка только в вызывающем коде одного файла).
  Прогнал точечно, а не весь список: `demo/smoke_vacuum_route_draft.mjs`
  (новый, основной), `demo/smoke_vacuum_firstuse.mjs` и
  `demo/smoke_vacuum_multifloor.mjs` (тема диффа — vacuum-раздел
  редактора), `demo/smoke_save_race.mjs` и `demo/smoke_config_writer.mjs`
  (тестируют именно `optimisticAttempt`/`rollbackOptimistic`/debounce,
  которые `persistRoutes` теперь использует). Все пять — зелёные.
  Остальные 18 прямых и 23 слабых совпадения не прогонял: правка не
  трогает их собственную логику (decor, sun, discovery, room resize,
  area relocation и т.д. используют те же общие поля конфигурации, но
  не код, который правка меняет), а общий примитив записи проверен
  выше двумя целевыми смоками.
- `npm run golden:verify` — не прогонял. Диф ограничен диалогом
  редактора устройства (лениво загружаемый блок); ни один golden-сценарий
  (`demo/golden/matrix.mjs`) не рендерит этот диалог — они снимают
  View/canvas. Видимый результат View не меняется.
- `python -m pytest tests_backend -q` — не прогонял, диф не трогает
  `custom_components/**/*.py` (только generated JS-бандл).
  Perf-профили — не прогонял, в AC не названы, путь не
  perf-чувствительный.
- `npm run invariants -- --config ...` — не прогонял. Диф пишет
  `marker.vacuum.map_routes[].space` — по форме похоже на «ссылку на
  геометрию», но `scripts/model-invariants.mjs` эту ссылку не
  проверяет вовсе (там только `marker.vacuum.segment_map` →
  `roomId`, см. `model-invariants.mjs:150-155`); рёбра комнат, записи
  толщины, `layout`, `open_spans`, `marker.space` (то есть верхнеуровневая
  привязка маркера к этажу, а не маршрут пылесоса) этим дифом не
  затронуты. Собственная защита от dangling-ссылки — как раз предмет
  AC2 (`spaceIds.has(draft.space)`), проверена юнит-тестом и падением
  выше.
- `test/single-source-numbers.test.mjs` — прогнан отдельно (входит в
  `npm test`), 3/3 зелёных. Дублирующегося пользовательского числа
  диф не добавляет: `mapId`/`space` — идентификаторы, а не измеряемая
  величина, и в черновике, и в подтверждённой строке читаются из
  одного и того же значения (`currentMapId`/`host._vacObservedMapId`),
  второго источника нет.
- Трейлеры коммита `fa41d298`: `Issue: #441`, `User-Visible: yes` —
  оба CHANGELOG (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) правлены
  в этом же коммите, формулировки соответствуют реализации.

## Находки

### Medium (в скоупе, чинится в этой же ветке) — стал причиной жёлтого вердикта

**Отпечаток скриншотов документации устарел, `check-docs.mjs` красный
на `fa41d298`.**
- Файл: `docs/images/screenshots.json` (не обновлён), причина —
  `src/editors/vacuum-maps-section.ts`.
- Воспроизведение: `node scripts/check-docs.mjs` на текущем HEAD →
  `ERROR screenshot source fingerprint is stale; run npm run build &&
  node demo/docs/capture.mjs`; тот же скрипт на `origin/dev` проходит
  чисто — красный статус специфичен для этого дифа.
- Почему это не мелочь: ровно этот пропуск в #230 и #234 оставил
  `dev` с красным job `docs` до следующей задачи (#237) — то есть при
  мёрже без правки CI-джоб `docs` станет красным на `dev` для всех
  последующих задач, пока кто-то не поймает и не почини́т его
  отдельно.
- Что нужно: `npm run build && node demo/docs/capture.mjs`, закоммитить
  обновлённые `docs/images/screenshots.json` и (если изменились пиксели)
  сами PNG, затем перепрогнать `node scripts/check-docs.mjs` до
  зелёного.

Больше High/Medium в скоупе не найдено. AC1–AC3 выполнены и доказаны;
рассмотренный продуктовый сценарий (второй и следующие маршруты через
штатный UI) решается, регрессии в соседний сценарий (первый маршрут,
retarget, drop, легаси-конверсия, `trail_mode`/`live`) не внесено —
подтверждено чтением и прогоном смоков.

## Что проверено и корректно (без отдельной находки)

- Сигнатура `renderVacuumMapsSection` лишилась неиспользуемого
  параметра `setVac`; единственный вызов в
  `src/houseplan-editor-runtime.ts:10973` обновлён синхронно, `tsc`
  подтверждает отсутствие расхождений.
- Побочный эффект дифа: `retarget`/`drop` (переещё раньше существовавшие
  операции) раньше писали через `this._saveConfig()` (дебаунс, без
  отката при отказе бэкенда — тот самый пробел, который отдельно
  трекает #439) и теперь используют тот же атомарный
  `persistRoutes`/`rollbackOptimistic`, что и новый draft-флоу. Это не
  требовалось ни одним AC #441, но не является регрессией: это
  строгое усиление (retarget/drop теперь тоже откатываются при
  отказе), сам примитив уже покрыт `smoke_save_race.mjs` и
  `smoke_config_writer.mjs` (оба прогнаны и зелены выше). Отмечаю как
  наблюдение: выделенного браузерного смока именно на отказ
  бэкенда при retarget/drop нет ни до, ни после этого дифа — не
  блокирует, т.к. общий примитив протестирован, а AC #441 этого пути
  не касаются.
- `.vacroute`/`.pending`/`.vacroute-draft-*` не имеют выделенных CSS-правил
  нигде в дереве (`grep -rn vacroute src --include=*.ts` — только сам
  файл раздела) — это унаследовано от #162, не введено этим дифом.
- Использование `host._saveConfigDebounced.cancel()` (а не `.flush()`,
  как в большинстве других мест `houseplan-card.ts`/`houseplan-editor-runtime.ts`)
  — корректно: `persistRoutes` сразу после отмены сам вызывает
  `_saveConfigNow()` с уже актуальным `_serverCfg` (включающим любые
  ожидавшие правки), поэтому `cancel()` избегает второго избыточного
  сетевого вызова, а не теряет данные.
- Новых ключей i18n нет (`git diff` по `src/i18n/**` пуст) — совпадает
  с заявлением аналитики в комментарии владельца.
- `docs/SCOPE.md`: задача закрывает J4 (штатная GUI-настройка без
  YAML) и J6 (конфиг не должен становиться невалидным) — соответствует
  заявке автора, продуктовое обоснование в скоупе.

## Чего не проверял

- Ручной запуск карточки в браузере вне смоков (нет такого шага в
  этом цикле по правилам процесса) — заменено чтением кода и
  прогоном `demo/smoke_vacuum_route_draft.mjs`, который управляет
  теми же DOM-элементами, что и живой пользователь.
- 18 из 23 «прямых совпадений» и все 23 «слабые связи» из
  `smoke-select.mjs` — см. обоснование в разделе «Гейты» (общий
  механизм записи, а не специфика этого дифа, уже покрыт двумя
  целевыми смоками).
- `npm run golden:verify`, `pytest tests_backend`, `npm run
  invariants`, perf-профили — не запускал, обоснование по каждому — в
  разделе «Гейты».
- Многопользовательский конфликт (два клиента редактируют один и тот
  же маркер одновременно, оба добавляют разные маршруты) — не тестовый
  сценарий этого issue; общая защита от такого конфликта — существующий
  `_cfgRev`/`rollbackOptimistic`, не изменённый этим дифом.

## Вердикт

Жёлтый: AC выполнены и доказаны, но `check-docs.mjs` красный на
проверяемом SHA из-за пропущенного шага пересъёмки — Medium в скоупе,
возврат автору на прогон `npm run build && node demo/docs/capture.mjs`
и коммит обновлённого манифеста/скриншотов.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/441-vacuum-route-draft`, коммит `014b74805533` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a372d3d387b4eefe464eda9079fa930f4d3f896c`
  ```
  git log --all --format='%H %T' | grep a372d3d387b4
  ```
