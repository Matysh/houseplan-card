# SPEC-REVIEW — issue #1071, заход r2

Материал: тело issue #1071, раздел `## ТЗ` (issue закреплён на SHA дерева
`dba7a826b5e3a0932ce9bd42c7d212592701ae1b`, bodyDigest
`41b2d95a5966c44898e76a1a7d67c2ffa6e17dc43a43edf8c2481a20928ecedc`).
Трек: `track:ask`. Этап: `S4-spec-review`, заход r2.

Аналитический абзац issue явно фиксирует, что весь текст r1 отозван
(«Первоначальный разбор и SPEC r1 ошибочно предлагали другую семантику: тот
текст отозван, непушенный черновик полностью снят. Нужен новый вердикт на
этом тексте») и заменён другим сценарием: r1 судил баг верхнего тулбара
группового перекрашивания (#1038, уже закрыт отдельно), r2 судит новый
контракт — исключение decor из ключа структурных floor-кешей ради
производительности группового изменения цвета через боковую панель. Это смена
подсистемы и контракта, а не локальная правка текста, поэтому разбор ниже —
полный, а не по дельте (PROCESS.md §2.10, «объём разбора полон, если дельта не
локальна»).

## Скоуп

Обслуживаемая работа — J6 «Keep the plan true as the home evolves»
(`docs/SCOPE.md`): редактор подложки, групповое редактирование существующих
объектов декора без заметного подвисания интерфейса. Сценарий, проблема,
скоуп/не-скоуп, контракт поведения (п.1–4), UX/i18n, модель
данных/совместимость/производительность, AC1–AC3 с доказательством, план
автотестов, риски, откат и release-артефакты — все обязательные разделы
§7.1 присутствуют и однозначны; явного открытого продуктового вопроса в тексте
нет, и по итогам независимого разбора кода ниже эскалация владельцу
действительно не требуется — единственная найденная проблема решается
техническим выбором автора (расширить список затрагиваемых модулей или честно
сузить формулировку скоупа), а не продуктовой неоднозначностью.

## Как проверялось

Кодовый Validate не запускался — не требуется на этапе spec (§2.4). Выполнена
только осуществимость/доказуемость AC чтением материала на зафиксированном
SHA `dba7a826b` (рабочая копия уже на нём), без tsc/build/npm test/gate:small:

- прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
  `docs/process/REVIEWER.md` (включая «Повторный раунд», «Отрицательные
  проверки и мутанты», «Находки и вердикт»);
- прочитан предыдущий документ `docs/reviews/SPEC-REVIEW-1071-r1.md` и
  сверено, что его предмет — другой, снятый текст (подтверждено текстом
  «Аналитика» issue и полным несовпадением сценария/контракта);
- прочитан канонический `docs/DECOR-EDITOR.md` — в частности §3.3 (слои,
  «The image is purely decorative and never changes rooms, walls, openings,
  devices, Glow or sun geometry»), подтверждающий заявление issue, что декор
  геометрически не участвует в стенах/свете;
- адресно прочитан `src/floor-geometry-key.ts` целиком: `floorRecordKeyMemo`,
  `floorGeometryKeyReader`, `wallUnionKey`/`physicalBodiesKey`/`floorPoolEntry`
  — подтверждает, что ОДИН `_floorKey = floorGeometryKeyReader(this)`
  (`src/houseplan-card.ts:1902`) кормит wall union (:8997), opening-tunnel pool
  (:9207), physical bodies (:9641), inner room contour (:9042) и `cleanFloor`
  (:9665 — читает тот же `this._floorKey`) — заявление «один источник на все
  структурные кеши» подтверждено чтением, план технически осуществим именно
  так, как описан;
- адресно прочитан `src/device-contact-card.ts:54-69`: уже существует
  собственная проекция `withoutDecor`/`wallFingerprint`, дублирующая задуманную
  default-проекцию `floorGeometryKeyReader` — заявление «переиспользовать этот
  же источник вместо второго алгоритма» подтверждено на реальном коде, а не на
  гипотезе;
- **адресно прослежена цепочка Glow/sun, не названная в «Технических
  решениях»** (см. находку ниже): `src/glow-scene.ts:249-259`
  (`lightGeometryFingerprint`, исключает только `led_strips`), `:367-371`
  (`recut` против полного `wallBodiesGeometry` по совпадению
  `sourceFingerprint`/`geometryFingerprint`), `src/houseplan-card.ts:10517-10559`
  (`_resolveLightBarriers`, ключ пула — `revision.fingerprint`),
  `src/live-interaction-runtime.ts:56-76` (`LiveRuntime.geometry`, WeakMap
  по identity записи, инвалидируется новым объектом записи после
  `_saveConfig`), `src/space-render.ts:462-479` (тот же паттерн во
  View-рендере статической карточки);
- сверено существование всех названных в AC/плане автотестов артефактов:
  `demo/smoke_floor_geometry_cache.mjs`, `demo/smoke_floor_cache_reuse.mjs`,
  `demo/smoke_decor_multiselect.mjs`, `demo/smoke_decor_group_text_scale.mjs`,
  `test/decor-group-edit.test.mjs`, `test/decor-group-text.test.mjs`,
  `test/properties-group-color.test.mjs`, `test/floor-geometry-key.test.mjs` —
  все существуют;
- сверена release-ledger классификация: `git show
  v1.82.0:src/editors/decor/group-edit.ts` → `fatal: path ... exists on disk,
  but not in 'v1.82.0'`, первый коммит файла — `66de9bb9f` (после v1.82.0) —
  `line-fix` обоснован реальной git-историей, не заявлением автора;
  `docs/release-ledger/v1.82.0/` существует как каталог.

Не прогонялись (и не требовались на этом этапе): tsc, build, npm test,
gate:small, demo-смоки, golden, invariants, performance — продукт не менялся,
единственная проверка осуществимости — адресное чтение перечисленного выше
кода на зафиксированном SHA. Обычных negative-input прогонов не
потребовалось: единственное конкретное сомнение (см. находку) снято чтением
уже существующего, неизменного кода `lightGeometryFingerprint` и его
потребителей, а не поведением, которого ещё нет.

## Закрытие раунда r1

Закрывать нечего: r1 (зелёный, 0/0) принял **другой, впоследствии отозванный**
текст ТЗ — баг верхнего тулбара группового цвета (#1038-смежный), не текущий
контракт структурных floor-кешей. Ни одна находка r1 не переносится, потому
что находок там не было, а предмет сменился полностью (§2.10, «дельта не
локальна»).

## Унаследовано из r1

Ничего не наследуется без повторной проверки: контракт, сценарий, скоуп и AC
текущего текста не пересекаются с r1 ни по одному пункту (сравнение текста
r1 `docs/reviews/SPEC-REVIEW-1071-r1.md` и тела issue на `dba7a826b`
проведено в разделе «Как проверялось» выше). Единственный факт, перепроверенный
заново, а не взятый на веру из r1, — классификация release-ledger `line-fix`:
в r1 он был обоснован для другого контракта (#1038 отсутствует в v1.82.0), в
r2 обоснование то же самое по факту (та же точка отсчёта v1.82.0, тот же файл
`group-edit.ts`), но сверено заново по тому же SHA v1.82.0, а не процитировано.

## Находки

### Medium (в скоупе) — «sun/light consumers» из Скоупа не достигают заявленного нуля перебора

**Файлы:** `src/glow-scene.ts:249-259`, `:367-371`; `src/houseplan-card.ts:10517-10559`;
`src/live-interaction-runtime.ts:56-76`; `src/space-render.ts:462-479`.

Раздел «Скоуп» прямо включает в объём задачи «...wall union, physical bodies,
inner contours **и зависящие от них sun/light consumers**», а «Аналитика»
прямо называет причиной измеренной задержки «CPU profile показывает wall
union, polygon clipping, **paper/Glow** в render после принятия цвета». Но
раздел «Технические решения» называет только `src/floor-geometry-key.ts` и
`src/device-contact-card.ts` как затрагиваемые модули продукта (plus тест и
witness) — ни `src/glow-scene.ts`, ни место вызова `_resolveLightBarriers` в
`src/houseplan-card.ts`, ни `src/live-interaction-runtime.ts`, ни
`src/space-render.ts` в списке нет.

Чтением кода подтверждено, что независимо от фикса `floorGeometryKeyReader`
ключ, которым Glow/light-barrier решают «переиспользовать геометрию стен или
пересчитать её заново», остаётся decor-чувствительным:

- `lightGeometryFingerprint(rawSpaceConfig, cellCm, gridPitch)`
  (`glow-scene.ts:249-259`) фильтрует из `rawSpaceConfig` только `led_strips`;
  `decor` остаётся частью отпечатка;
- в `buildLightBarrierScene` (`glow-scene.ts:367-371`) `recut` (дешёвое
  переиспользование уже построенной wall-union геометрии) выбирается только
  если `sharedWallGeometry.sourceFingerprint === revision.geometryFingerprint`;
  `sourceFingerprint` — это `lightGeometryFingerprint` записи, из которой была
  построена закешированная wall-union-геометрия, `geometryFingerprint` —
  свежий `lightGeometryFingerprint` текущей записи. После смены **только**
  decor оба всё ещё расходятся (decor в обоих участвует) → ветка `recut` не
  срабатывает → выполняется полный `wallBodiesGeometry(...)` — то самое
  «polygon clipping», которое фикс должен был устранить, просто для другого
  потребителя;
- `_resolveLightBarriers` (`houseplan-card.ts:10517-10534`) кеширует
  `_lightBarrierPool` по `revision.fingerprint`, производному от того же
  `geometryFingerprint`; смена decor меняет ключ → `_floorCacheBuilds.lightBarrier`
  (и, через `physicalBodies` колбэк, потенциально `lightPhysicalBodies`)
  увеличивается на каждый decor-коммит;
- `LiveRuntime.geometry()` (`live-interaction-runtime.ts:65-76`) — тонкая
  WeakMap-мемоизация той же функции по identity объекта записи; после
  `_saveConfig` (групповой Save decor, по контракту п.3 — «один логический
  Save») запись становится новым объектом → memo промахивается → пересчёт
  `lightGeometryFingerprint` всё равно видит новый decor;
- тот же паттерн, независимо, дублируется в `space-render.ts:462-479`
  (статическая View-карточка): `lightGeometryFingerprint(spCfg, ...)` тоже
  без исключения decor — значит путь живого sync (другой клиент меняет decor)
  тоже не выигрывает от фикса.

Итог: AC1 как буквально сформулирован («...не пересобирает wall
union/physical/inner contours») может остаться зелёным — именно эти три/четыре
кеша действительно чинятся единственным предложенным изменением
(`floorGeometryKeyReader`). Но заявление раздела «Скоуп» про «зависящие от них
sun/light consumers» и сценарное обещание «не должно быть заметного
подвисания» — шире, чем то, что способен дать названный список файлов: на
плане с источниками света (ламп, Glow) часть измеренной задержки (CPU-профиль
автора прямо называет Glow) сохранится без правки `lightGeometryFingerprint`.
Это ровно случай из REVIEWER.md: «Жёлтый вердикт допустим и при выполненных
AC, если изменение не решает заявленный сценарий».

**Чем закрывается:** либо (а) распространить ту же decor-исключающую
проекцию на `lightGeometryFingerprint`/единый источник, которым
`_resolveLightBarriers`/`space-render.ts` ключуют свои пулы (тогда формулировка
«Скоуп» станет выполнимой буквально), либо (б) честно сузить «Скоуп» и
сценарное обещание до «wall union/physical bodies/inner contours», явно
исключив Glow/light-barrier как смежный, неполностью решённый остаток
задержки (с пометкой в «не-скоуп» или в «Рисках»). Технический выбор
автора, продуктовой эскалации владельцу не требует.

## Что проверено и корректно

- Единый источник `_floorKey`/`floorGeometryKeyReader` действительно кормит
  wall union, physical bodies, inner contours и `cleanFloor` — план «один
  projection, одна точка правки» подтверждён чтением всех вызывающих мест, а
  не декларацией автора.
- Заявление «device-contact-card уже независимо исключает decor» точно
  соответствует существующему коду (`withoutDecor`, denylist по одному полю,
  без узкого whitelist) — план «переиспользовать этот же источник вместо
  второго алгоритма» реалистичен и устраняет именно описанное дублирование.
- `floorRecordKeyMemo` при отсутствии кастомного `fingerprint` остаётся
  полным (включает decor) — решение «memo сводных данных не теряет decor» не
  требует правки `summary-panel-runtime-loaded.ts`, что совпадает с
  заявлением «не менять summary area memo и writer».
- Контракт п.1–4 (исключить только `decor`, сохранить все прочие поля без
  whitelist, epoch/LRU/authority без изменений, групповой Save остаётся одним
  шагом истории) не противоречит ни `DECOR-EDITOR.md` §3.3, ни существующему
  групповому контракту #1038.
- Release-ledger `line-fix` для `docs/release-ledger/v1.82.0/1071.json`
  обоснован: `src/editors/decor/group-edit.ts` отсутствует в теге `v1.82.0`
  (первый коммит `66de9bb9f` — после стабильного релиза).
  Все файлы, названные в AC1–AC3 и плане автотестов, существуют на
  зафиксированном материале.

## Чего не проверял

- Исполнение ещё не написанного `smoke_decor_group_style_cache.mjs` — его нет,
  это предмет кода, а не ТЗ.
- Фактическое числовое соотношение вклада Glow/light-barrier против wall
  union/physical bodies в измеренных 380/427 мс — методологически недоступно
  на этапе ТЗ (нужен профиль на реализованном коде); находка выше опирается
  только на логический факт «ключ decor-чувствителен», не на долю вклада.
- Полноту аудита #1038 по всем kind/mixed-комбинациям — это работа код-ревью,
  здесь проверялась только осуществимость формулировки аудита.
- Golden-сцены и реальную GPU/ручную приёмку — не гейт этапа (§8, #929).

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/gate:small | нет | этап spec, кодовый Validate не требуется |
| demo-смоки | нет | продукт не менялся; существование файлов проверено чтением, не исполнением |
| golden/`ci:golden` | нет | визуальных изменений нет на этапе ТЗ |
| invariants/performance | нет | ТЗ не меняет код; целевые инварианты оценены чтением (`_floorKey` единый источник, LRU bounds не меняются) |
| адресное чтение кода (осуществимость) | да | `floor-geometry-key.ts`, `device-contact-card.ts`, `glow-scene.ts`, `houseplan-card.ts` (`_floorKey`, `_resolveLightBarriers`, `_wallUnionGeometry`, `_innerRoomContour`, `_cleanFloor`), `live-interaction-runtime.ts`, `space-render.ts`, `DECOR-EDITOR.md` §3.3, `git show v1.82.0:...`, существование тестовых/demo-файлов — все перечислены в «Как проверялось» |

## Маршрут и побочные находки

Доверенный снимок `REVIEW_FINDINGS_POLICY`: `mode=issues`, `round=2` — сверено,
расхождений нет. Единственная находка (Medium) лежит внутри заявленного
«Скоупа» самого issue #1071 («...и зависящие от них sun/light consumers»), то
есть находка **в скоупе**: по политике `mode=issues` отдельный issue не
заводится, Medium в скоупе возвращается автору в текущей задаче (#202).
Побочных находок вне скоупа нет. Маршрут вердикта (#726): `route: fix`.

## Вердикт

Вердикт: жёлтый · заход r2 · блокирующих циклов 0/4 · High: 0 · Medium: 1 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `dba7a826b5e3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d76cdb13a3357fee1f5d9929e3e8516e0280cc43`
  ```
  git log --all --format='%H %T' | grep d76cdb13a335
  ```
- Тело issue: `41b2d95a5966c44898e76a1a7d67c2ffa6e17dc43a43edf8c2481a20928ecedc`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2NjYsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NzYxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4MCwib3V0cHV0X3Rva2VucyI6Mzk3ODcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTA5OTkwLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzE4NzQ5OSwiY29zdFVzZEVzdGltYXRlIjoxLjQ3NTQ4OTgwMDAwMDAwMDN9XSwidHVybnMiOjQxLCJkdXJhdGlvbk1zIjo0NjQ2MDksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjQ4MDI1MDgwMDAwMDAwMDMsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4746 output_tokens=39806 cache_creation_input_tokens=109990 cache_read_input_tokens=3187499 num_turns=41 -->
