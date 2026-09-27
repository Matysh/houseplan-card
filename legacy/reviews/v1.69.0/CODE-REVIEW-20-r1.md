# CODE-REVIEW-20-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/20
- ТЗ: `docs/specs/020-glow-open-door-spill.md` (ревью ТЗ зелёное, `docs/reviews/SPEC-REVIEW-20-r1.md`, 2026-08-28)
- Ветка: `issue/20-glow-open-door-spill`
- SHA материала ревью: `f62926fbeb9e79e850eef54f01448bdf3aed5b68` (единственный коммит с продуктовым кодом; впереди него в ветке — `72e6939f` docs: review document, `3fa98a09` docs: actualize spec, оба до реализации и без изменений в `src/**`)
- Заход: r1 · блокирующих циклов израсходовано 0/4 (это первый заход)

## Скоуп

Дифф `origin/dev...HEAD`: `src/logic.ts`, `src/houseplan-card.ts`, `src/physical-geometry.ts`,
`src/space-render.ts`, тесты (`test/logic.test.mjs`, `test/physical-geometry.test.mjs`,
`test/golden-matrix.test.mjs`), `demo/smoke_glow.mjs`, `demo/golden/matrix.mjs`,
`demo/fixtures/visual-matrix.mjs`, `docs/LIGHT.md`, `docs/ARCHITECTURE.md`, changelog RU/EN,
плюс сгенерированные bundle-деревья и пересобранные скриншоты документации. Ровно один
коммит класса A/B (`f62926fb`) с трейлерами `Issue: #20` / `User-Visible: yes`.

Задача полного трека (не `small`): геометрия и горячий render/cache-путь.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | OK |
| unit | `npm test` | 1503 тестов: 1502 passed, 1 skipped, 0 failed |
| build + сверка копий | `npm run build && npm run bundle:sync` | OK; `dist/`, `custom_components/.../frontend`, `demo/srv/assets` идентичны, `git status` чист после sync |
| bundle budget | `npm run bundle:budget` | initial View 271455 B gzip / бюджет 282000 B, запас 10545 B |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 111 добавленных строк в 4 файлах, новых `any` нет |
| check-docs (diff трогает `src/**`) | `node scripts/check-docs.mjs` | OK: 7 файлов, 10 внешних ссылок |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 10 прямых совпадений (список ниже) |
| browser smokes (все 10 прямых совпадений) | `node demo/smoke_{registryless_opening,glow,opening_binding,linked_virtual_light,open_passage,opening_entity_search,opening_preview,partition_openings,plan_drawing_repairs,plan_snap_overlay}.mjs` | все 10 — OK |
| golden | `npm run golden:verify` (полная матрица, 80 сцен) | 79 passed, 1 **different**: `lighting-opaque-glow-two-doorways-dark` — см. «Известный пробел» ниже |
| invariants | не запускал | диф не меняет сохранённую геометрию/схему (см. обоснование ниже) |
| backend pytest | не запускал | `custom_components/**/*.py` не тронут |
| performance smoke | не запускал | AC9 сам называет доказательством exact-SHA CI performance smoke перед бетой, не код-ревью |

**smoke-select, вывод целиком:**
```
Изменено файлов src/**: 4 · символов проекта на изменённых строках: 24
Прямое совпадение (10): smoke_registryless_opening.mjs (_openingAmt, _openingsR,
_renderOpeningEntityAvailable, _renderPlanHass), smoke_glow.mjs (_cmToUnits, _openingsR,
_pointInRoom), smoke_opening_binding.mjs (_openingAmt, _openingsR),
smoke_linked_virtual_light.mjs (_renderPlanHass), smoke_open_passage.mjs (_openingsR),
smoke_opening_entity_search.mjs (_openingsR), smoke_opening_preview.mjs (_openingsR),
smoke_partition_openings.mjs (_openingsR), smoke_plan_drawing_repairs.mjs (_cmToUnits),
smoke_plan_snap_overlay.mjs (_cmToUnits). Ничего не учтено как «широкий» символ (порог >40).
```
Прогнал все 10, а не только тематически близкие: инструкция прямо предупреждает, что
тематическое сужение уже один раз пропустило регресс (#234), а здесь все 10 — прямые
совпадения, не слабые связи.

**Инварианты модели не прогонял.** Диф не меняет сохранённую геометрию, `layout`,
`marker.space`, `open_spans` или ключи записи толщины — вырезы, которые теперь зависят от
`amount`, вычисляются заново на каждый рендер из НЕ сохраняемого состояния HA и не пишутся
обратно в конфиг (спека прямо это фиксирует: «Модель и сохранённый JSON не меняются»).
Автор указал ту же причину в хендоффе. Согласен: инварианты отвечают на вопросы про
персистентную геометрию, здесь её нет.

## Находки

Блокирующих (High) находок нет. Находок уровня Medium в скоупе или вне скоупа нет.

### Low L1 — AC7 для контурной (не partition) стены доказан только чтением кода, не тестом

`test/physical-geometry.test.mjs` получил новый тест именно для перегородки
(«partition body uses the same full, partial and closed light aperture» —
`pointInOpaquePlanBody` проверен для full/half/closed на партиционном хосте). Для обычного
проёма в контурной стене (не partition) аналогичного прямого теста «источник внутри
закрыто-схлопнутого выреза подавлен» не добавлено — существующий `sourceInsideWallSuppressed`
в `demo/smoke_glow.mjs` не изменился и проверяет источник внутри обычной стеновой массы,
а не внутри именно закрытой (`amount<=0`) двери.

Прочитал код и убеждён, что риск закрыт по конструкции, а не только по вере в автора:
`_lightBarriers()` (`src/houseplan-card.ts:10267-10410`) отдаёт `masonryGeometry`/`opaqueBodies`
из ТОГО ЖЕ `passageStates`/`roomPassages`, из которого строится видимость — вырез контурной
стены создаётся, только если `amount > 0` (см. `passages = passageStates.filter(({amount}) =>
amount > 0)` → `_roomWallOpeningInputs(passages, space)` → `recutWallBodiesGeometry`/
`wallBodiesGeometry`). Guard источника читает именно этот `masonryGeometry`
(`pointInOpaquePlanBody(sourcePoint, masonryGeometry, opaqueBodies)`, строка 10481) — то есть
закрытая контурная дверь механически становится частью той же непрозрачной кладки, что и окно,
для которого fail-dark уже покрыт существующими тестами (`test/physical-geometry.test.mjs`,
`test/houseplan-runtime-contract.test.mjs`, оба не в этом диффе и не задеты). Это тот же код
до и после диффа — диф не добавил отдельной ветки для «закрытой двери», он лишь расширил
множество «непрозрачных» проёмов условием `amount<=0` вместо жёсткого «окно/наружная».

**Проверено чтением, не исполнением.** Оставляю Low: тест — не догадка, будущая правка того
же файла с меньшей вероятностью сломает это неявно проверенное свойство, если бы у контурного
случая было явное assert-покрытие. Решение по Low — на усмотрение автора/следующего раунда, не
блокирует.

## Что проверено и корректно (по AC ТЗ)

- **AC1** (закрытая привязанная дверь не пропускает Glow). Доказано: `openingAmount()`
  (`src/logic.ts:305-330`) возвращает `0` для закрытого бинарного контакта; при `amount<=0`
  проём не входит в `passages` → не вырезается из кладки (`src/houseplan-card.ts:10317-10327`).
  `demo/smoke_glow.mjs`: `closedDoorBlocksGlow` — прогнан, OK (`closedDelta <= 3`).
- **AC2** (открытие в течение одного render tick, без сохранения конфига). Доказано:
  `demo/smoke_glow.mjs` меняет только `c.hass.states` (без `_cfgEpoch++`/`_glowClipCache.clear()`
  вручную) и получает изменённые пиксели после `updateComplete` + двух rAF — то есть проверяет
  сам факт автоматической инвалидации кэша по сигнатуре, а не подложенную вручную очистку. OK.
- **AC3** (`current_position=50` → центрированный вырез вдвое короче, символ получает тот же
  `amount`). Доказано unit: `openingLightApertureLength(80, 0.5) === 40`
  (`test/logic.test.mjs`); `openingAmount('gate','open',false,50) === 0.5`. Единый источник:
  и `_lightBarriers()` (`src/houseplan-card.ts:12332-12341`, `_openingAmt`), и видимый символ
  партиционного проёма (`src/space-render.ts:508-514`), и видимый символ обычного проёма
  (`src/houseplan-card.ts:12392`), и изометрия (строка 8753) читают ровно один и тот же
  `_openingAmt`/`openingAmount()` с одним и тем же `entity.attributes.current_position`.
  Проверено чтением всех вызовов (grep `_openingAmt(` и `openingAmount(`), дублирующего
  вычисления процента нет — «одно число, один источник» выполняется.
  `smoke_glow.mjs`: `partialDoorNarrowsGlow` — прогнан, OK (`0 < halfWidth < openWidth`).
- **AC4** (invert меняет известное значение, не меняет outage-fallback). Доказано unit-матрицей
  `test/logic.test.mjs`: `openingAmount('gate','unavailable',true,25) === 1` — инверсия не
  трогает fallback, потому что в коде (`src/logic.ts:317-319`) ветка `unavailable/unknown`
  возвращает результат ДО применения `invert`. Тест «умеет падать»: если убрать ранний
  `return`, значение стало бы `0`, а не `1`.
- **AC5** (ворота как двери; passage всегда прозрачен; окно/неизвестный тип/наружный проём —
  всегда непрозрачны). Классификатор `isInteriorLightOpeningType` не менялся этим диффом —
  проверено чтением, регресс невозможен без изменения этой функции. `openingAmount('passage', …)
  === 1` всегда — юнит подтверждает.
- **AC6** (тот же контракт full/zero/partial для partition). Доказано
  `test/physical-geometry.test.mjs`: новый тест `scalePartitionOpeningCut` (центр сохраняется,
  `depth`/`hostId` неизменны, немутирующая функция) плюс `physicalBodyParts` full/half/closed
  через `pointInOpaquePlanBody`. `smoke_partition_openings.mjs` — прогнан, OK (не специфичен
  под Glow, но подтверждает отсутствие регрессии в общей семантике partition-openings).
- **AC7** (источник внутри закрытого проёма полностью гаснет). Partition-случай — юнит
  (см. AC6). Контурный случай — см. Low L1 выше: проверено чтением общего fail-dark пути,
  дефекта не нашёл, но отдельного нового теста для этой ветки нет.
- **AC8** (кэш переиспользуется при постороннем HA-апдейте, разный `amount` — новый ключ, LRU
  bounded). Структура ключа проверена чтением
  (`fingerprint = contentFingerprint([geometryFingerprint, openingStateSignature])`,
  `cacheKey = space.id|fingerprint`, `lruWrite(this._lightBarrierPool, cacheKey, entry, 8)` —
  лимит 8 не менялся) плюс существующий текстовый unit
  (`test/golden-matrix.test.mjs`: «a light source paints exactly one region…» сверяет буквальный
  текст сборки fingerprint — тот же приём, что уже использовался в проекте для `_cfgEpoch`).
  Поведенчески: `demo/smoke_glow.mjs`'s `setDoorPosition` меняет только состояние без явной
  очистки кэшей — рендер обновляется, то есть сигнатура действительно входит в реальный
  cache key, а не только в текст. `recut`-путь (переиспользование стеновой геометрии) сверяет
  `sharedFingerprint === geometryFingerprint` (только геометрия, без состояния дверей) —
  прочитал: `_wallUnionGeometry()`'s `sourceFingerprint` считается из
  `[this._curSpaceCfg, this._cellCm, this._gridPitch]`, то есть идентичен `geometryFingerprint`
  и не зависит от состояния дверей — смена состояния двери не форсирует пересборку общей
  wall-union геометрии, только пересчёт вырезов поверх неё. Корректно.
- **AC9** (перф-бюджет на large-house). Вне скоупа код-ревью по собственной формулировке
  ТЗ — доказательство «exact-SHA CI performance smoke перед бетой». Не проверял.
- **AC10** (golden-сцена closed/open/50%). Сценарий `lighting-opaque-glow-two-doorways-dark`
  расширен третьей дверью с `current_position: 50` и второй с закрытым cover — структурно верно
  и соответствует AC. Baseline не обновлён — см. «Известный пробел» ниже.

## Известный пробел (не блокирует, не Medium)

`npm run golden:verify` на этом SHA даёт **1 different** из 80 сцен:
`lighting-opaque-glow-two-doorways-dark`. Причина не в коде: сценарий (`demo/golden/matrix.mjs`)
теперь рисует другую геометрию (2 двери → 3, изменена позиция второй), а PNG-эталон в
`demo/golden/baselines/lighting-opaque-glow-two-doorways-dark.png` не обновлён. Диф `git diff
origin/dev...HEAD --stat -- demo/golden/baselines` пуст — эталон действительно не менялся.

Это не находка, а корректное следование процессу: правило §13/AGENTS.md запрещает принимать
golden-эталон иначе как `npm run golden:accept -- --reviewed` по полному Linux CI-артефакту, и
автор явно зафиксировал это в хендоффе («baseline локально не обновлялся… эталон должен принять
Linux CI»). Приложенный AC10 сам называет доказательством «reviewed Linux golden artefact», а не
локальный прогон код-ревью. Требовать здесь зелёный `golden:verify` значило бы просить автора
нарушить §13. Фиксирую как открытый пункт для пре-релизного гейта (Validate/CI на `dev`), не как
дефект этой задачи.

## Унаследовано / контекст ревью ТЗ

Ревью ТЗ уже зелёное (`docs/reviews/SPEC-REVIEW-20-r1.md`, комментарий 2026-08-28T19:07:32Z,
High 0 / Medium 0). Спека не менялась после этого вердикта (единственный коммит, трогающий
`docs/specs/020-glow-open-door-spill.md`, — `3fa98a09`, который по топологии истории идёт ДО
вердикта ревью ТЗ). Контракт спеки не пересматривал повторно, кроме сверки с фактическим кодом
построчно по AC — раздел «Что проверено и корректно» выше.

## Чего не проверял и почему

- **Performance smoke / large-house budget (AC9)** — по формулировке AC доказывается
  exact-SHA CI перед бетой, не код-ревью; локального перф-фикстур-прогона не делал.
- **`python -m pytest tests_backend`** — диф не трогает `custom_components/**/*.py`.
- **`node scripts/model-invariants.mjs`** — диф не меняет персистентную геометрию/схему
  (обоснование выше); нет пользовательского export/config для конкретной конфигурации.
- **Полный browser-smoke матрикс (200 файлов)** — не запускал все, диф не задевает всё;
  прогнал ровно те 10, что `smoke-select.mjs` пометил прямым совпадением.
- **Приёмка golden-эталона** — вне полномочий код-ревью и вне возможностей локальной машины
  без CI-артефакта; см. «Известный пробел».
- **Ручное тестирование в браузере** — не проводилось (в цикле его нет); AC поддержаны
  автотестами/смоками, которые я прогнал сам и для ключевых — перечитал, что они умеют падать
  (openingAmount invert-fallback, cache-signature через отсутствие ручной очистки в смоке).

## Вердикт

Зелёный. Реализация соответствует контракту ТЗ, единый источник числа `amount` подтверждён по
всем потребителям (символ/Glow/изометрия), кэш-инвалидация проверена и поведенчески, и по
формуле ключа, fail-dark для источника внутри закрытого проёма верен по конструкции для обоих
типов стен. Единственная Low-находка (недостающий прямой тест для контурного варианта AC7) не
блокирует и не требует правки в этом заходе. Незакрытый golden diff — ожидаемый и корректно
задокументированный пункт пре-релизного гейта, не дефект этой задачи.
