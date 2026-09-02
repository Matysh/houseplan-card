# CODE-REVIEW — issue #419, заход r1

- SHA: `567a45ab` (ветка `issue/419-area-snapshot-roster-guard`)
- Диапазон: `origin/dev..HEAD` (5 коммитов)
- Этап: code (PROCESS.md §2.7) · заход r1 · блокирующих циклов израсходовано 0 из 4
- Вердикт: **зелёный** · High: 0 · Medium: 0

## Скоуп

ТЗ `docs/specs/419-area-snapshot-roster-guard.md` (принято зелёным SPEC-REVIEW-419-r1,
High 0 / Medium 0). Задача: `resolveDeviceAreaRelocations()` считала отфильтрованную
презентационную проекцию `devices` доказательством исчезновения binding из HA и стирала
`marker_area_snapshot` при пустом/усечённом ростере. Контракт: отделить destructive
orphan-cleanup от presentation-роутинга, ввести positive evidence (полный Device/Entity
Registry, exact live state, живой marker), запретить cleanup при пустом namespace,
требовать два различных непустых authoritative revisions перед удалением, один
confirmation refresh, runtime-only кандидаты.

Job из docs/SCOPE.md: J6 «Keep the plan true as the home evolves» — сохранность
persisted lifecycle-метаданных при живом плане. Смежная линия — «never delete a user's
file on an inference» (тот же принцип: слабая улика не повод для необратимого удаления),
применённая здесь не к файлам, а к Area provenance.

Диапазон изменений: `src/device-area-relocation.ts`, `src/houseplan-card.ts`,
`test/device-area-relocation.test.mjs`, `demo/smoke_area_relocation.mjs` (новый),
`scripts/mutation-gate.mjs`, `docs/CONFIG-COMPATIBILITY.md`, `docs/FILTERING.md`,
`docs/TESTING.md`, `docs/CHANGELOG.md`/`.ru.md`, синхронные bundles. Геометрия, layout
edges, `marker.space`, `open_spans`, wall-thickness записи и Python backend не тронуты —
инварианты модели и pytest не запускались обоснованно (см. «Чего не проверял»).

## Как проверялось

Материал — `git log --oneline origin/dev..HEAD` и `git diff origin/dev...HEAD`, плюс
чтение полного `resolveAreaSnapshotCleanup`/`resolveDeviceAreaRelocations` и вызывающего
кода в `houseplan-card.ts`, а также `ha-binding-status.ts` (семантика `revision`,
`authoritative`, дебаунс `scheduleReload`) — читал, чтобы доказать AC9 (никакого
reload-loop на state tick, ровно один confirmation refresh), а не поверил описанию.

Гейты прогнаны самостоятельно на `567a45ab` (зелёного Validate на этом SHA не найдено):

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | 1743 tests, 1742 pass, 0 fail, 1 skip |
| `npm run bundle:sync` (build + 3 копии) | green; `git status` после сборки чист — bundles уже синхронны с коммитом |
| `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» |
| `node scripts/mutation-gate.mjs --check` | 341/341 ok, 0 FAIL (якоря патчей не устарели) |
| `node scripts/mutation-gate.mjs --id=area-snapshot-cleanup-*` (все 4 новых/обновлённых мутанта, реальный прогон, не только anchor-check) | все 4: `тест покраснел, как обязан`, поймано 1 из 1 каждый |
| `node demo/smoke_area_relocation.mjs` | все 26 полей `true`, включая новые `#419`-сценарии (recovered/confirmed/empty probes) |
| `node demo/smoke_readonly_cold_start.mjs` (прямое совпадение по `_canEdit`) | все поля `true` |
| `node demo/smoke_binding_picker.mjs` (прямое совпадение по `_markers`) | все поля `true` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «130 строк в 2 файлах, новых any нет» |
| `node scripts/bundle-budget.mjs` | green, initial View 291046 B / бюджет 300000 B, запас 8954 Б (известный долг #367, не регрессия этой задачи) |
| `node scripts/process-gate.mjs --issues` | «гейт пройден, предупреждений 0» |
| `git diff --stat -- custom_components/**/*.py` | пусто — pytest backend обоснованно не прогонялся |

Все цифры совпали с тем, что автор заявил в комментарии от 16:27:33Z — включая
`smoke-select` вывод (10 прямых/17 слабых совпадений, оба прогнанных прямых совпадения
подтверждены).

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` (прогнан повторно):
10 прямых совпадений (`NORM_W`×7, `Marker`, `_markers`, `_canEdit`), 17 слабых
(все — `_model`). Решение по каждому: `NORM_W`/`Marker` — не поведенческая правка (тип
и уже существующий параметр `coordinateScale` не меняются по значению), эти 8 смоков не
гоняю; `_markers`→`smoke_binding_picker`, `_canEdit`→`smoke_readonly_cold_start` — оба
прогнаны выше, зелёные. `_model`-слабая связь (17 смоков) — диффом не задета (модель
пространств/комнат не читается новым кодом), не гоняю. `demo/smoke_area_relocation.mjs`
не входит в вывод инструмента, так как это новый файл — прогнан отдельно как основной
AC-носитель (AC1,2,5–7,9–11).

Инварианты модели (`npm run invariants`) не запускались: diff не трогает рёбра комнат,
записи толщины, `layout`, `marker.space`, `open_spans` — только lifecycle-решение по
`marker_area_snapshot` (Record `binding`+`area`, формат не изменён).

## Находки

Нет. High: 0, Medium: 0, Low: 0 (без сравнения с предыдущим раундом — это заход r1 code,
делить не с чем).

## Что проверено и корректно (по AC)

- **AC1/AC12** — `resolveAreaSnapshotCleanup` строит `exists` из `markerBindings`,
  `markerIds`, `deviceIds`/`entityIds`/`liveEntityIds`, никогда из `devices[]`.
  Юнит «orphan cleanup uses full registry evidence instead of the presentation roster»
  и мутант `area-snapshot-cleanup-forgets-registry-evidence` (реально прогнан, покраснел).
- **AC2/AC12** — пустой `deviceIds`/`entityIds` блокирует confirmation (`namespaceNonEmpty`
  проверяется раздельно по kind). Юнит «empty registry namespaces never confirm...» и
  мутант `area-snapshot-cleanup-trusts-empty-namespace` (прогнан, покраснел). Смок
  `emptyRegistryPreservesSnapshot` + `emptyRegistryDoesNotReloadLoop` (deviceRegistryCalls
  === 1) — подтверждено исполнением.
- **AC3** — `liveEntityIds` строится из `options.liveStates` без фильтра по `state`,
  так что `on`/`unavailable`/`unknown` одинаково считаются доказательством. Параметризован
  в юните «exact live entity state preserves registry-less snapshot provenance».
- **AC4** — `markerBindings`/`markerIds` собираются с `if (marker.removed) continue;` —
  tombstone не даёт положительного доказательства. Юнит «a live saved marker preserves
  matching id or binding but a tombstone does not».
- **AC5/AC6/AC7** — состояние `candidates: Map<binding, revision>` двигается по строгой
  машине (undefined → отметить + запросить refresh; та же revision → no-op; другая
  revision → confirm removeIds; появление binding → `candidates.delete`). Три юнита
  покрывают все переходы plюс мутант `area-snapshot-cleanup-trusts-first-absence`
  (прогнан, покраснел). Смок: `confirmationRefreshRunsOnce` (recoveredProbe:
  deviceRegistryCalls===2, cleanupWrites===0) доказывает «первое отсутствие не удаляет,
  восстановление снимает кандидат» на реальном production bundle, не только на чистой
  функции.
- **AC8** — «limited frames and runtime reset do not confirm an earlier absence»: смена
  `authoritative:false` не продвигает кандидата; свежий `Map()` (эмуляция remount) снова
  стартует с первого отсутствия. В карточке `_areaSnapshotCleanupCandidates.clear()`
  вызывается в `_ensureHaRegistryAuthority()` при смене connection — то же место, где уже
  сбрасывались `_haBindingCacheKey`/`_haRegistryRev`.
- **AC9** — `revision` в `ha-binding-status.ts` инкрементируется только в `finally` блока
  `loadFullRegistries` (то есть на завершение полного registry-фетча), не на state tick —
  прочитано и проверено чтением, что `haRegistryBuildSignature`/`_maybeRebuildDevices` не
  создают новых кандидатов на каждый рендер без изменения revision. `needsConfirmationRefresh`
  устанавливается только в ветке `firstRevision === undefined`, то есть ровно один раз на
  binding до следующей смены revision. Смок `confirmationRefreshRunsOnce` и
  `emptyRegistryDoesNotReloadLoop` доказывают счётчиком WS-вызовов, не только по количеству
  полей результата.
- **AC10** — явный rebind/delete/explicit-placement идёт старым однопроходным путём в
  `resolveDeviceAreaRelocations` (`if (!binding) { if (previous) removeSnapshot: true }`),
  который читает `registryFollowingBinding(device)` по актуальному marker/binding, а не
  затрагивается двойным подтверждением. Проверено чтением и существующими юнитами/смоком
  (`explicitOverrideExcluded`, `compositeGroupExcluded`, вся матрица #126/#403/#406 в
  `smoke_area_relocation.mjs` зелёная).
- **AC11** — `confirmedProbe` (rejectFirstCleanup) в смоке: первый `config/set` с
  уменьшённым `marker_area_snapshot` синтетически падает, `cleanupWrites >= 2` доказывает
  повтор после отказа; неподтверждённый (recoveredProbe) кандидат даёт `cleanupWrites === 0`
  — подтверждённое решение не может утечь в write batch раньше срока.
- **AC12** — 3 новых + 1 обновлённый мутант в `scripts/mutation-gate.mjs`, все проверены
  полным прогоном (`--id=...`), а не только anchor-check: каждый покраснел на именно том
  юните, что указан в `guard`.
- **AC13** — tsc/test/build зелёные (см. таблицу), `git status` после `bundle:sync` пуст
  (три копии синхронны), `no-new-any` — 0 новых.
- **AC14** — `docs/CONFIG-COMPATIBILITY.md`, `docs/FILTERING.md`, `docs/TESTING.md`,
  оба CHANGELOG обновлены в одном коммите `489e289f` вместе с кодом; терминология
  («Area provenance», «registry-following») согласована с существующим текстом этих же
  файлов, новых пользовательских терминов не вводится (UI не меняется — `docs/USER-GUIDE.ru.md`
  трогать не требовалось и не тронут). `check-docs` зелёный; commit `567a45ab` отдельно
  обновляет только screenshot fingerprint со ссылкой на канонический CI run и подтверждением
  на независимом `dev`-прогоне, что дельта инфраструктурная (runner image), а не визуальная.

Трейлеры `Issue:`/`User-Visible:` на месте во всех 5 коммитах; коммит с `User-Visible: yes`
(`489e289f`) содержит правки обоих CHANGELOG в себе же (`process-gate.mjs --issues` зелёный).

## Один источник числа

Диффом не добавлено и не изменено ни одной пользовательски видимой величины (UI не
меняется, спека прямо это фиксирует). Раздел неприменим.

## Чего не проверял

- `npm run golden:verify` и performance-профили — не прогонял: diff не меняет рендер,
  геометрию или чувствительный к перфу путь (только registry/lifecycle-решение до
  input/render веток); AC и риски задачи явно относят их к предрелизным гейтам.
- `npm run invariants` — не прогонял: diff не касается рёбер комнат, записей толщины,
  `layout`, `marker.space`, `open_spans`.
- `python -m pytest tests_backend -q` — не прогонял: ни один `custom_components/**/*.py`
  не в диффе.
- Остальные 8 «прямых совпадений» `smoke-select` (`NORM_W`×7, `Marker`) и все 17 «слабых»
  (`_model`) — не гонял: символы задеты только как неизменённый тип/константа, диффом не
  меняется их пользовательский путь (см. раздел «Как проверялось»).
- Полный `demo/smoke_*.mjs` набор целиком — не гонял: задача не задевает все подсистемы,
  это предрелизный гейт (PROCESS.md §8).
- Ручное тестирование в браузере HA — не проводилось (не часть цикла ревью); достоверность
  обеспечена browser smoke на production bundle плюс unit/mutation.

## Заключение

ТЗ выполнено полностью и доказуемо: каждый AC либо подтверждён юнит-тестом, либо browser
smoke на production bundle с точными счётчиками сетевых вызовов, либо явной записью
«проверено чтением» с указанием конкретных строк (`ha-binding-status.ts` revision
semantics). Мутанты реально прогоняются и падают на удаление доказательства, а не только
проходят anchor-check. Гейты, прогнанные самостоятельно, совпали с заявленными автором
результатами один в один. Находок нет — вердикт зелёный.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/419-area-snapshot-roster-guard`, коммит `567a45ab6bf5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `58de96f55f1d82cb5695cf151b597b09edfc2505`
  ```
  git log --all --format='%H %T' | grep 58de96f55f1d
  ```
- ТЗ `docs/specs/419-area-snapshot-roster-guard.md`, блоб `eb5a7a352d742be601c7c695d27256f9af9bc0ad`
  ```
  git log --all --find-object=eb5a7a352d742be601c7c695d27256f9af9bc0ad -- docs/specs/419-area-snapshot-roster-guard.md
  ```
