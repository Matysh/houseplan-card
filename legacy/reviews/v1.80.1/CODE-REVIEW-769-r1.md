# CODE-REVIEW-769-r1

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
HEAD = `d7b6bdfbf26a471ce3535d8cf892d108029f53b8` (рабочая копия на нём же).
ТЗ: тело issue #769, редакция r1, SPEC-REVIEW-769-r1 зелёный (без находок).
Трек: `ask`. Заход r1, блокирующих циклов израсходовано 0/4.

## Скоуп

Четыре коммита поверх `dev` (`f19087bf` на момент последнего ребейза, слиты
#770/#778/#809):

1. `bf771c32` perf(summary): пофлорное мемо сводной площади по содержимому
   записи этажа — `User-Visible: yes`, CHANGELOG.md/.ru.md правлены в этом же
   коммите.
2. `ff4c69ac` test(perf): сторож #735 на счётчиках построений
   (`_floorCacheBuilds`), исправление `openingWallIndex` в снимке размеров.
3. `5a1b0c20` refactor(cache): единый модуль ключей и записи пула #744
   (`src/floor-geometry-key.ts`) — удалён мёртвый засев объединения в
   `_rszAcceptPreview`.
4. `d7b6bdfb` chore(monolith): подъём `bundleBytes` 2 715 446 → 2 718 072 с
   разбивкой по коммитам.

Соответствует скоупу ТЗ п.1–4 ровно; пункты «не входит» (индекс стен проёмов
и ключ солнца на эпохе, одноместные кэши в пул, бюджеты #770, геометрический
узкий ключ) в диффе не затронуты — проверено по `git diff --stat` и чтением.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на самом материале (`d7b6bdfb`,
https://github.com/Matysh/houseplan-card/actions/runs/37562183935,
conclusion: success) — перепроверено запросом к ran `gh run view`, SHA job'а
совпадает с HEAD. Внутри: «Фронтенд: типы, юниты, мутанты, синхрон бандла» —
success (типы, `npm test`, `mutation-gate --check`, синхронизация бандла);
«Смоки в браузере» 3/3 шарда — success; «Перф-смок: бюджет времени кадра»
(`ci:full`/`performance_smoke`, требуется AC6/AC9) — success; Golden — success
(не требовался AC, но прошёл). Backend pytest и геометрия TS/Python parity —
skipped (в диффе нет Python). Мутанты по диффу (ночные/beta-прогоны) —
skipped штатно (§2.6: мутанты в разработке не гоняются ни на одном треке).

Дополнительно прогнано мной поверх уже зелёного SHA (дёшево, без
дублирования тяжёлых гейтов):

- `node scripts/mutation-gate.mjs --check` — `ok` по всем патчам, включая 6
  новых мутантов #769 (`floor-cache-counter-skips-evicting-miss`,
  `resize-bodies-rekey-format-diverges`, `wall-union-fingerprint-from-stored-record`,
  `summary-area-key-global-epoch`, `summary-area-key-rooms-only` и
  перенесённые якоря #744); `browser guards: 251/200`, тот же итог, что в
  ручном подсчёте автора после ребейза (счётчики в
  `docs/testing-notes/mutation-browser-guards.md` пересчитаны по спискам, не
  переписаны руками — совпали).
- Чтение (не исполнение) всей продуктовой правки: `src/floor-geometry-key.ts`,
  `src/summary-panel-metrics.ts`, `src/summary-panel-runtime-loaded.ts`,
  `src/clean-floor.ts`, `src/furniture-wall-surface.ts`, `src/houseplan-card.ts`
  (9 веток промаха), `src/houseplan-editor-runtime.ts` (`_rszAcceptPreview`,
  `_rszEdgeDown`, `_rszCancelDrag`), `src/led-strip-editor.ts`,
  `src/summary-panel-host.ts`.
- Построчное сравнение каждого нового теста (`test/summary-panel-area-memo.test.mjs`,
  `test/floor-geometry-key.test.mjs`, `test/switch-cycle-guard.test.mjs`, правки
  `test/performance-contract.test.mjs`, `test/performance-workflow.test.mjs`,
  `demo/benchmark_large_house.mjs`, `demo/smoke_floor_geometry_cache.mjs`) с
  утверждениями контракта ТЗ.
- Сверка заявленного отступления от буквы ТЗ (удаление, а не перенос, засева
  объединения в `_rszAcceptPreview`) чтением `origin/dev`:
  `_rszProjectPreview` безусловно возвращает `artifact: null` (единственная
  ветка `ok: true`), и `_rszAcceptPreview` на `dev` делает `if (!preview ||
  !wallGeometry) return;` — `wallGeometry` всегда `null`, то есть ветка засева
  действительно была мёртвым кодом уже на `dev`. Вывод автора подтверждён
  чтением, не заявлением.
- Проверка «список текстовых якорей монолита заморожен» (#624,
  `test/monolith-text-anchors.test.mjs`): `performance-contract.test.mjs` уже
  был в замороженном списке до #769; новые regex-утверждения добавлены в уже
  замороженный файл, нового имени в список не вошло. `switch-cycle-guard.mjs`
  / `test/switch-cycle-guard.test.mjs` не читают монолит как текст (импортируют
  чистую функцию) — не подпадают под правило вовсе.

Чего не проверял: `npx tsc --noEmit`, `npm test`, `npm run build` +
`bundle-policy --verify` вручную — зелёный Validate на этом же SHA уже
подтвердил (см. выше, строкой «Фронтенд»). Полный `ci:full` с несколькими
семплами на каждый профиль (только `--samples=1` в ветке по контракту ТЗ) —
не требуется гейтом ревью, это предрелизный Full Performance (AC9 явно
ограничивает приёмку одним семплом в ветке). Ручной мутационный прогон по
каждому из 6 новых мутантов (патч → гард → откат) не повторял — автор
заявил «все CAUGHT» для 4 мутантов до ребейза, ребейз их не затронул
(конфликт был только в счётчиках документа инвентаря); полагаюсь на
статический `mutation-gate --check` (сам прогнал) и на чтение кода, которое
показывает, что красный вариант каждого мутанта действительно меняет
наблюдаемое поведение, проверяемое соответствующим смоком/юнитом.
HA-харнесс (`test_ha_*.py`) не запускался и не требуется: диффа в Python нет.

## AC — доказательства

| AC | Доказано | Чем | Защитный? чем краснеет |
|---|---|---|---|
| AC1 (пересчёт только изменённых этажей) | да | `test/summary-panel-area-memo.test.mjs`, 14 сценариев таблицы ТЗ на трёхэтажной фикстуре; счётчик `floors`/`computed`/`portions` через внедряемый `geometryOf` и шаг-генератор | мутант `summary-area-key-global-epoch` (ключ = эпоха) — CAUGHT юнитом AC1 |
| AC2 (итог `===` независимому пересчёту) | да | тот же файл: `assert.equal(adopt(next).value, fresh(next))` после каждого сценария + дубликат id + падающий/восстановленный этаж | мутант `summary-area-key-rooms-only` (ключ только по `rooms`) — CAUGHT юнитом AC2 |
| AC3 (свежесть дешёвая) | да | тест «100 вызовов без новой эпохи — 0 отпечатков, 0 порций; новая эпоха — 1 отпечаток на этаж» со шпионом `fingerprint` | красный вариант явно воспроизведён тестом (счётчик `fingerprints`) |
| AC4 (поведение #509 не меняется) | проверено чтением, не исполнением нового кода (использует существующие тесты без изменений) | `test/summary-panel-runtime.test.mjs`, `test/summary-panel.test.mjs` не тронуты диффом, прошли в зелёном Validate; `smoke_summary_panel`/`smoke_summary_warm_attach` — браузерные шарды Validate | — (неразрушающий AC, не защитный) |
| AC5 (решение по магниту мебели) | да, чтением | `src/furniture-wall-surface.ts` — только добавлен комментарий с измерением, код не менялся (сверено диффом построчно); `test/furniture.test.mjs` не тронут | — |
| AC6 (сторож на счётчиках) | да | `test/switch-cycle-guard.test.mjs` (7 сценариев чистой функции `judgeSwitchCycle`), `demo/benchmark_large_house.mjs` и `test/performance-workflow.test.mjs` (регекс-контракт исходника раннера), Full Performance в CI (`ci:full`→success) | мутант не нужен отдельно: тест прямо кодирует красный вариант (рост судимого семейства → `ok:false`) |
| AC7 (холодная сборка в полном пуле ловится) | да | `demo/smoke_floor_geometry_cache.mjs` — пул заполнен искусственно (`private-ok` пометки), 4 переключения, `ac7TheCycleBuildsTheUnionOnce=1`, `ac7TheSizeGuardSeesNothing=[]`, `ac7TheDecisionNamesTheWallUnion=['wall union +1']` | мутант `floor-cache-counter-skips-evicting-miss` — CAUGHT смоком (прогнан в Validate) |
| AC8 (один источник ключей; засев/алиас попадают и верны) | да (с заменой засева на вывод о мёртвом коде, см. «Отступление» ниже) | `test/floor-geometry-key.test.mjs` (формат ключей/лимита/записи) + `test/performance-contract.test.mjs` (статический контракт: ровно 1/2/2/1 вхождение каждого хелпера, нет копий формата вне модуля) + `demo/smoke_floor_geometry_cache.mjs` AC8 a/b/c (0 построений посреди перетаскивания/после отмены, геометрия равна независимой карточке) | мутанты `resize-bodies-rekey-format-diverges`, `wall-union-fingerprint-from-stored-record` — CAUGHT смоком |
| AC9 (соседние гарантии) | да | `smoke_floor_geometry_cache.mjs` (#744 AC1–AC2c) зелёный в Validate; `gate:small`/`smoke-select`/`mutation-gate --check` — заявлены автором и перепроверены мной (`mutation-gate --check` — ok) | — |

## Находки

Находок нет — ни High, ни Medium.

Рассмотренные кандидаты, снятые при проверке:

- **Потенциальный разнобой индексов `records[index]` vs `raw` в
  `summary-panel-runtime-loaded.ts:793–795`.** `records = this.host._renderCfg?.spaces`,
  `raw` ищется по id в `this.host._serverCfg`. Проверено чтением: `_model`
  (и, значит, `models[index]` в `cleanFloorAreaSteps`) строится как
  `spaceModels(this._renderCfg).map(...)` — тот же порядок и длина, что
  `_renderCfg.spaces`; `_renderCfg` — это `_serverCfg` с точечной заменой
  одного элемента на превью той же позиции. Поэтому `records[index]` всегда
  — запись, из которой построен `models[index]`, как и требует контракт
  «model — запись, из которой построена модель этажа». Для дублирующихся id
  `config.spaces.find` берёт первую запись, что и даёт «current» —
  воспроизведено юнит-тестом AC2 (`a duplicate id`) и подтверждено построчно.
  Не находка.
- **Отступление от буквы ТЗ: удаление засева объединения в
  `_rszAcceptPreview` вместо переноса (контракт п.4.1 ТЗ).** Автор прямо
  вынес это на суд ревьюера с обоснованием «с #451 артефакт всегда `null`».
  Перепроверено чтением `origin/dev`: `_rszProjectPreview` имеет единственную
  успешную ветку, и она безусловно кладёт `artifact: null`;
  `_rszAcceptPreview` на `dev` проверяет `!wallGeometry` и всегда выходит
  раньше кода засева. Значит засев был мёртвым кодом уже на базе, и его
  замена двумя точечными мутантами (вместо «другой формат засева») в реестре
  корректна: красный вариант AC8 «другой формат ключа засева» физически не
  существует в этом дереве. Решение принимаю как верное техническое решение
  в рамках §7.1 («технический вопрос снимает ревьюер»), не как находку.
- **`floorRecordKeyMemo`/`areaKeys` не сбрасывается на `resetLifecycle`,
  сбрасывается только `areaFloors`.** Проверено чтением: ключ, который вернёт
  несброшенный `areaKeys` для тех же объектов и той же эпохи, идентичен тому,
  что вернул бы свежий экземпляр (детерминированная функция содержимого) —
  отсутствие сброса не может дать другую строку ключа, только переиспользовать
  уже верную. Поскольку `areaFloors` (хранилище значений) очищено, любой ключ
  даёт промах и пересчёт — ровно то, что требует тест «lifecycle reset
  forgets the per-floor memo» (прошёл). Не находка.

## Что проверено и корректно

- Пофлорное мемо площади (`src/summary-panel-metrics.ts`): вычисление
  `floorCleanAreaSteps` — дословно перенесённое тело старого цикла (построчно
  сверено диффом, арифметика не менялась), поэтому строгое `===` с
  независимым пересчётом не может нарушиться округлением порядка суммирования
  — порядок суммирования по `models` не изменён.
- Прунинг неиспользованных ключей памятки (`for (const key of
  [...memo.values.keys()]) if (!used.has(key)) memo.values.delete(key);`)
  корректно работает с перестановкой/удалением/добавлением этажей — ключ
  несёт собственный `id` этажа, а не позиционный индекс, так что перестановка
  этажей не теряет кеш (сценарий «floors reordered» — `computed: []`, тест
  проходит).
- Счётчики построений (`_floorCacheBuilds`) вставлены ровно в ветку промаха
  каждого из 9 кэшей, включая промах-с-вытеснением (пул объединений: счётчик
  инкрементируется до `writeWallUnionPool`, независимо от того, вытеснит ли
  запись кого-то) — проверено чтением всех 9 точек в `houseplan-card.ts`.
- Единый модуль ключей: вхождения `wallUnionKey(`/`physicalBodiesKey(` в
  карточке, рантайме редактора и LED-редакторе ровно те, что заявлены
  (1/2/1 и 1/2/1) — перепроверено и регексом теста, и ручным grep.
- `_rszEdgeDown` теперь берёт `space.rooms.length` из `this.host._spaceModel()`
  вместо `this._rszRooms().length` (отфильтрованного/коалесцированного
  списка) — это делает его ключ ПОЛНОСТЬЮ совпадающим с тем, что использует
  сама карточка при построении кеша (та же формула), устраняя скрытый
  риск несовпадения ключей на этажах с отсутствующими `id`/`poly` у отдельных
  комнат; явно описано в коммите, не скрытое поведение.
- Трейлеры: все 4 коммита несут `Issue: #769`; `User-Visible: yes` только у
  `bf771c32`, и именно в нём правка `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md`
  — одной строкой, с одинаковым пользовательским текстом на обоих языках.
- Одно число — один источник: `bundleBytes` 2 718 072 — единственный источник
  `scripts/monolith-baseline.json`, подтверждён отдельным обоснованным
  коммитом с разбивкой по вкладам; `251/200` (браузерные гарды) — выводится
  из `scripts/mutation-registry.mjs` тестом `test/mutation-gate.test.mjs`,
  документ лишь отражает число, не хранит его независимо (перепроверено
  прогоном `mutation-gate --check`).
- Монолит-фриз (#624): `performance-contract.test.mjs` уже был в
  `FROZEN_TEXT_ANCHOR_TESTS`, новых имён в список не добавлено.

## Чего не проверял

- Полные `tsc --noEmit` / `npm test` / `npm run build` + сверку трёх копий
  бандла вручную — подтверждены зелёным Validate на точном SHA материала.
- Ручной прогон `node demo/benchmark_large_house.mjs` / `smoke_floor_geometry_cache.mjs`
  в браузере локально — это сделал CI (шарды Validate), не дублировал.
- Поштучную (патч→гард→откат) ручную перепроверку всех 6 новых мутантов —
  доверился заявлению автора (сделано до ребейза, ребейз их не касался) плюс
  статической проверке `mutation-gate --check` и собственному прочтению кода,
  показавшему, что каждый мутант действительно меняет наблюдаемое поведение,
  которое ловит названный гард.
- HA pytest harness — нет изменений в Python, гейт пропущен штатно
  (skipped в CI, не относится к задаче).
- Производительность в миллисекундах (`switchCycleMs` и прочие бюджеты) —
  ТЗ прямо выводит это за рамки приёмки (методика — счётчики, не время);
  Full Performance на `main` после слияния — предрелизный гейт, не гейт
  ревью.

## Вердикт

Зелёный. AC1–AC9 доказаны, защитные AC (1, 2, 6, 7, 8) имеют заполненный
столбец «чем краснеет» со ссылкой на мутанта в реестре или on встроенный
негативный сценарий теста. Трейлеры и changelog корректны. Дешёвые гейты
подтверждены зелёным Validate на материале; гейты по диффу (`ci:full`/
`performance_smoke`, смоки, `mutation-gate --check`) тоже зелёные. Находок
нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/769-epoch-caches-build-counters`, коммит `d7b6bdfbf26a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7d9f72ac69aa5534dc4009216d0fa171049275ca`
  ```
  git log --all --format='%H %T' | grep 7d9f72ac69aa
  ```
- Тело issue: `d3331fc68880ae8f869b1dd27f4f6aa101e8bef0d04ff0e151083a384863b3fd`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4124 output_tokens=38537 cache_creation_input_tokens=173016 cache_read_input_tokens=7793044 num_turns=66 -->
