# SPEC-REVIEW — issue #1071, заход r3

Материал: тело issue #1071, раздел `## ТЗ` (issue закреплён на SHA дерева
`7d4ad36b150824a6a33c420d3bca6b9fda5e2b20`, tree
`a7221189e684ae6a593f193cb4185992d1a46434`, bodyDigest
`78bf15319e2621657457d2fbadeb6deb6da137ab500276fa2db2609915c8ef01`).
Трек: `track:ask`. Этап: `S4-spec-review`, заход r3.

## Скоуп

Обслуживаемая работа — J6 «Keep the plan true as the home evolves»
(`docs/SCOPE.md`): редактор подложки, групповое редактирование существующих
объектов декора без заметного подвисания. Предмет r3 — закрытие единственной
находки r2 (Medium, в скоупе): «Технические решения» не называли
`src/glow-scene.ts`, хотя «Скоуп» прямо включал «...и зависящие от них
sun/light consumers», а «Аналитика» называла Glow источником измеренной
задержки.

## Предмет раунда — дельта тела issue

Точный дифф тела issue между захваченным r2 материалом (bodyDigest
`41b2d95a5966c44898e76a1a7d67c2ffa6e17dc43a43edf8c2481a20928ecedc`) и текущим
r3 материалом (bodyDigest `78bf15319e2621657457d2fbadeb6deb6da137ab500276fa2db2609915c8ef01`)
получен не по памяти, а исполнением `gh api graphql` над
`issue.userContentEdits[].diff` (GitHub хранит полный текст тела на каждый
edit; оба digest сверены побайтно с `REVIEW_CONTEXT`/комментариями владельца
08:31:52Z и 08:43:31Z). Дельта строго локальна — три места:

1. Контракт п.1: добавлено предложение про `src/glow-scene.ts
   lightGeometryFingerprint` — та же decor-исключающая проекция плюс прежнее
   исключение `led_strips`; один источник считает и wall-union
   `sourceFingerprint`, и свежий `revision.geometryFingerprint`; вызывающие
   места (`_resolveLightBarriers`, `space-render.ts`) не меняются.
2. AC1: результат расширен словом «И lightBarrier/lightPhysicalBodies»;
   доказательство — «все пять build counters» вместо безымянного «structural
   build counters», плюс новое уточнение про консервативную очистку кешей при
   Undo/Redo и повторный прогрев на следующих commit'ах.
   AC2: результат расширен пунктом «Light geometry/tag исключают decor и LED
   sources, но сохраняют все остальные архитектурные поля и масштабы»;
   доказательство добавляет suite `glow-scene` и «aligned recut».
3. «Технические решения»: общая проекция перенесена в новый модуль
   `src/structural-space-record.ts` (ранее — «внутри floor-geometry-key.ts»);
   добавлено предложение про `glow-scene.ts::lightGeometryFingerprint` на
   общем helper'е и про то, что `LiveRuntime.geometry`, `_resolveLightBarriers`
   и `space-render` уже вызывают эту функцию и отдельно их менять не нужно;
   список модулей/тестов расширен до
   `src/{floor-geometry-key,structural-space-record,device-contact-card,glow-scene}.ts`
   и `test/{floor-geometry-key,glow-scene}.test.mjs`.

Сценарий, проблема, «Что человек увидит», Скоуп/не-скоуп (кроме
непосредственно процитированного предложения), контракт п.2–4, UX/i18n,
модель данных/совместимость/производительность, AC3, план автотестов, риски,
откат и release-артефакты — побайтно идентичны r2 (подтверждено тем же
диффом). Дельта локальна, задевает только AC1 и AC2; по §2.10 разбор ниже
сокращён до затронутых AC и унаследованных фактов, а не повторяет весь r2.

## Как проверялось

Кодовый Validate не запускался — не требуется на этапе spec (§2.4). Адресная
проверка осуществимости новой части контракта на зафиксированном материале
(рабочая копия уже на `7d4ad36b1`), без tsc/build/npm test/gate:small:

- прочитаны обязательные источники роли: `docs/SCOPE.md`, `AGENTS.md`,
  `docs/process/REVIEWER.md` (включая «Повторный раунд», «Отрицательные
  проверки и мутанты», «Находки и вердикт»);
- получен точный дифф тела issue r2→r3 через GraphQL
  `userContentEdits[].diff` (см. раздел выше) — единственный конкретный
  непокрытый вопрос этого раунда: «закрывает ли новая формулировка контракта
  п.1/AC1/AC2 находку r2 технически корректно, без новой двусмысленности?»;
- прочитан `docs/reviews/SPEC-REVIEW-1071-r2.md` и сверен с текущим телом —
  предмет находки совпадает дословно с изменённым текстом;
- адресно прочитан `src/glow-scene.ts:248-257` (`lightGeometryFingerprint`):
  сегодня фильтрует только `led_strips` — подтверждает описанную r2 точку
  старта, план технически реализуем как точечное расширение фильтра на
  `decor`;
- адресно прочитан `src/glow-scene.ts:365-372` (`buildLightBarrierScene`,
  `recut`-ветка по `sharedWallGeometry.sourceFingerprint ===
  revision.geometryFingerprint`) и `src/floor-geometry-key.ts:113-130`
  (`wallUnionPoolEntry` уже тегирует пул wall-union/physical-bodies тем же
  `lightGeometryFingerprint(record, cellCm, gridPitch)` как
  non-enumerable `sourceFingerprint`) — **один и тот же источник уже
  считает обе стороны сравнения `recut`**, заявление контракта п.1 не
  гипотеза, а точное описание уже существующего кода;
- адресно прочитан `src/live-interaction-runtime.ts:73` и
  `src/space-render.ts:475` — оба напрямую вызывают
  `lightGeometryFingerprint(record/spCfg, cellCm, gridPitch)` без собственной
  проекции — подтверждает заявление «их вызывающие места остаются прежними»:
  точечное расширение фильтра внутри одной функции действительно
  распространяется на оба потребителя без правки их кода;
- адресно прочитан `src/houseplan-card.ts:1861-1864`
  (`_floorCacheBuilds = { wallUnion, innerContour, cleanFloor,
  openingWallIndex, lightBarrier, glowClip, physicalBodies, openingTunnel,
  lightPhysicalBodies, sunRays, isoSun }`) — ровно пять полей, перечисленных в
  обновлённом AC1 (`wallUnion`, `physicalBodies`, `innerContour`,
  `lightBarrier`, `lightPhysicalBodies`), реально существуют как счётчики;
  «все пять build counters» — проверяемое, не расплывчатое утверждение;
- адресно прочитан `src/houseplan-card.ts:10100-10102`
  (`sunGeometryKey(..., physicalBodiesKey(this._floorKey(space.id), ...), ...)`)
  — `sunRays`/`isoSun` ключуются через тот же `_floorKey`
  (`floorGeometryKeyReader`), то есть уже выигрывают от первой половины п.1
  (default-проекция) без отдельного упоминания в AC1; их отсутствие в списке
  AC1 — не пробел, а то, что они фиксируются другой частью того же контракта,
  не новой;
- сверено существование `test/glow-scene.test.mjs` (есть) и прочитана его
  структура: существующий тест `lightGeometryFingerprint` уже параметризован
  ровно по шаблону, который понадобится для `decor` (блок исключения
  `led_strips` на строках 27–35, цикл «все прочие ключи инвалидируют» на
  строках 37–39, отдельный тест «LED-only edits retain the aligned
  shared-masonry recut fast path» на строке 54 проверяет именно
  `sourceFingerprint`/`geometryFingerprint`-выравнивание) — заявленный в AC2
  suite «glow-scene... включая aligned recut» имеет реальную, а не
  гипотетическую тестовую инфраструктуру для расширения;
- проверено отсутствие `src/structural-space-record.ts` на материале —
  ожидаемо: модуль ещё не создан, это предстоящая реализация, а не
  несуществующий файл, который ТЗ ошибочно называет существующим;
- сверено, что `decor` действительно не фильтруется нигде в
  `src/floor-geometry-key.ts` сегодня (`grep` пуст) — заявление «декор ещё не
  исключён ни из одного ключа» точно.

Обычных negative-input прогонов не потребовалось: единственное конкретное
сомнение («закрывает ли новая формулировка Glow-пробел r2 технически
корректно») снято чтением уже существующего, неизменного кода
(`lightGeometryFingerprint`, `wallUnionPoolEntry`, `buildLightBarrierScene`,
`_floorCacheBuilds`, `sunGeometryKey`), а не поведением, которого ещё нет.

## Закрытие раунда r2

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| Medium (в скоупе): «Технические решения» не называли `src/glow-scene.ts`/Glow-потребителей, хотя «Скоуп» обещает «...и зависящие от них sun/light consumers», а «Аналитика» называет Glow источником задержки | Контракт п.1 добавил явное предложение про общий источник `lightGeometryFingerprint` (decor + прежний `led_strips`) для wall-union `sourceFingerprint` и свежего `revision.geometryFingerprint`; AC1 расширен до «И lightBarrier/lightPhysicalBodies» и «все пять build counters»; AC2 добавил «Light geometry/tag исключают decor и LED sources»; «Технические решения» добавили `src/structural-space-record.ts`, `src/glow-scene.ts` и `test/glow-scene.test.mjs` в перечень затрагиваемых модулей/тестов | Тело issue, bodyDigest `78bf1531...`, контракт п.1 (абзац про `src/glow-scene.ts`), таблица AC1/AC2, последний абзац «Технических решений» (список модулей `src/{floor-geometry-key,structural-space-record,device-contact-card,glow-scene}.ts`) — точный дифф против r2 получен `gh api graphql` (раздел «Предмет раунда» выше), независимо подтверждён чтением `glow-scene.ts:248-257,365-372`, `floor-geometry-key.ts:113-130`, `live-interaction-runtime.ts:73`, `space-render.ts:475`: один источник действительно уже кормит все названные потребители, правка одной функции закрывает весь список без изменения их кода |

## Унаследовано из r2

Всё, что дифф не затронул, принято без повторной проверки с документом
`docs/reviews/SPEC-REVIEW-1071-r2.md` (материал: дерево
`d76cdb13a3357fee1f5d9929e3e8516e0280cc43`, bodyDigest `41b2d95a...`):
сценарий, «что человек увидит», скоуп/не-скоуп (кроме процитированного
предложения п.1), контракт п.2–4 (epoch/model-current/LRU неизменны,
групповой Save остаётся одним шагом истории, аудит #1038), UX/i18n (нет
новых строк/ключей), модель данных/совместимость/производительность (нет
миграции, bounded memo), AC3 и план автотестов, риски, откат,
release-ledger `line-fix` (обоснование по `git show v1.82.0:...` уже
перепроверено дважды — в r1 и в r2 — заново на материале r3 не повторялось,
так как сам файл и тег `v1.82.0` не менялись).

## Находки

Находок нет. Единственная находка r2 (Medium, в скоупе) закрыта текстом ТЗ
технически корректно — независимым чтением кода (не на слово автора)
подтверждено, что `lightGeometryFingerprint` уже сегодня является тем единым
источником, который одновременно тегирует `sourceFingerprint` wall-union пула
и вычисляет свежий `geometryFingerprint` для сравнения в `recut`, и что три
названных в r2 потребителя (`_resolveLightBarriers` через
`revision.fingerprint`, `LiveRuntime.geometry`, `space-render.ts`) вызывают
именно эту функцию напрямую, без собственной проекции. Точечное расширение
фильтра `lightGeometryFingerprint` с «только `led_strips`» на «`led_strips`
и `decor`» действительно закрывает весь список без правки их вызывающих
мест — ровно то, что теперь явно записано в контракте п.1 и «Технических
решениях». Новой двусмысленности делта не вносит: «все пять build counters»
в AC1 — точный, проверяемый список (сверен с реальными полями
`_floorCacheBuilds`), а Undo/Redo-оговорка сужает claim до «после прогрева»,
не ослабляя защитную часть AC1.

## Что проверено и корректно

- Дифф тела issue r2→r3 получен исполнением (`gh api graphql`), а не по
  памяти или по цитатам из r2-документа — делта подтверждена побайтно.
- Заявление контракта п.1 «один и тот же источник считает и wall-union
  sourceFingerprint, и свежий revision.geometryFingerprint» — не гипотеза
  автора, а точное описание уже существующего кода
  (`wallUnionPoolEntry`/`buildLightBarrierScene`).
- Заявление «их вызывающие места остаются прежними»
  (`_resolveLightBarriers`, `LiveRuntime.geometry`, `space-render.ts`)
  подтверждено: все три читают `lightGeometryFingerprint` напрямую или через
  производные (`revision.fingerprint`), без отдельной проекции, которую
  нужно было бы переписывать.
- «Все пять build counters» в AC1 — реальные поля `_floorCacheBuilds`
  (`wallUnion`, `physicalBodies`, `innerContour`, `lightBarrier`,
  `lightPhysicalBodies`), ни одно не придумано.
- `sunRays`/`isoSun` не названы в AC1 не по ошибке: они ключуются через
  `_floorKey`/`floorGeometryKeyReader` (ту же default-проекцию, что чинит
  первая половина п.1) — их выигрыш покрыт контрактом без отдельного
  упоминания, и это не противоречит ни одному AC.
- `test/glow-scene.test.mjs` уже содержит структурно готовый шаблон для
  decor-исключения (аналогичный существующему led_strips-блоку) и отдельный
  тест на `recut`/`sourceFingerprint`-выравнивание — заявленный в AC2 «glow-
  scene suite... включая aligned recut» реалистичен, не голословен.
- Перенос общей проекции в новый `src/structural-space-record.ts` —
  технический выбор, явно помеченный как «принято предположительно, поменять
  свободно»; создание нового общего модуля для функции, которую используют
  и `floor-geometry-key.ts`, и `glow-scene.ts`, и `device-contact-card.ts`,
  архитектурно уместно и не создаёт противоречий с текущим кодом.

## Чего не проверял

- Исполнение ещё не написанного `smoke_decor_group_style_cache.mjs` и ещё не
  расширенных unit-тестов `glow-scene`/`floor-geometry-key` — предмет кода,
  не ТЗ.
- Фактическую реализацию `src/structural-space-record.ts` — модуля не
  существует, проверялась только осуществимость плана его создания.
- Точное числовое распределение вклада Glow/light-barrier против wall
  union/physical bodies в измеренных 380/427 мс — методологически недоступно
  на этапе ТЗ.
- Полноту аудита #1038 и golden-сцены — работа код-ревью/пререлизного гейта,
  не этого этапа (§8, #929).
- Реальное ручное устройство/GPU-приёмку владельцем — не гейт этапа.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| tsc/build/npm test/gate:small | нет | этап spec, кодовый Validate не требуется |
| demo-смоки | нет | продукт не менялся; существование/структура файлов (`test/glow-scene.test.mjs`) проверены чтением, не исполнением |
| golden/`ci:golden` | нет | визуальных изменений нет на этапе ТЗ |
| invariants/performance | нет | ТЗ не меняет код; целевые инварианты (единый источник ключа, bounded LRU) оценены чтением |
| адресное чтение кода (осуществимость дельты) | да | `src/glow-scene.ts:248-257,365-372`, `src/floor-geometry-key.ts:1-130`, `src/live-interaction-runtime.ts:73`, `src/space-render.ts:475`, `src/houseplan-card.ts:1861-1864,10095-10102`, `test/glow-scene.test.mjs` (структура, строки 17-54), отсутствие `decor`-фильтра в `floor-geometry-key.ts`, отсутствие `src/structural-space-record.ts` — все перечислены в «Как проверялось» |
| дифф тела issue r2→r3 | да | `gh api graphql` (`issue.userContentEdits[].diff`), сверено побайтно с bodyDigest r2/r3 |

## Маршрут и побочные находки

Доверенный снимок `REVIEW_FINDINGS_POLICY`: `mode=issues`, `round=3` — сверено
с переданным в промпте снимком prepare, расхождений нет. Находок нет —
побочных находок вне скоупа нет, новый issue не заводится. Маршрут вердикта
(#726): `route: fix`.

## Вердикт

Вердикт: зелёный · заход r3 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `7d4ad36b1508` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a7221189e684ae6a593f193cb4185992d1a46434`
  ```
  git log --all --format='%H %T' | grep a7221189e684
  ```
- Тело issue: `78bf15319e2621657457d2fbadeb6deb6da137ab500276fa2db2609915c8ef01`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ2NjksIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Nzc0MDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjgsIm91dHB1dF90b2tlbnMiOjM1OTc0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjExNzA4NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMxODQxMjgsImNvc3RVc2RFc3RpbWF0ZSI6MS40NjUwMzc2MDAwMDAwMDA1fV0sInR1cm5zIjo0MSwiZHVyYXRpb25NcyI6NDIwODE3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40Njk4MTE2MDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=4737 output_tokens=35995 cache_creation_input_tokens=117084 cache_read_input_tokens=3184128 num_turns=41 -->
