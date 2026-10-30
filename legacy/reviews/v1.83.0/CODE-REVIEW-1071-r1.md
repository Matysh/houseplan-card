# Код-ревью #1071 — заход r1

Материал: `fbfed682c7c9a53d53ed07df53873a619fafc1bf` (рабочая копия на нём, `git diff origin/dev...HEAD`).
Трек: `ask`. Маршрут вердикта (#726): `route: fix`.

## Скоуп

ТЗ (тело issue, после трёх раундов SPEC-ревью, финальный текст
`sha256:78bf15319e2621657457d2fbadeb6deb6da137ab500276fa2db2609915c8ef01`):
исключить `decor` из ключа строго структурных floor-кешей (wall union, physical
bodies, inner contours, и, после SPEC r2 Medium, light barrier/light physical
bodies), переиспользовать один и тот же источник в `device-contact-card.ts`
вместо дублирующей проекции, сохранить полноту generic/config fingerprint,
epoch, model/current различение, LRU. Не-скоуп: верхняя toolbar-палитра
(остаётся defaults-only), новые групповые команды, миграция модели, release.
Риск по изменённым участкам (#707): perf-класс на `src/glow-scene.ts:253–258`
(старая LED-only проекция, удалена) — покрыт контрактом п.1 ТЗ
(`lightGeometryFingerprint` явно назван вместе с `floor-geometry-key.ts`) и
AC1/AC2; других классов риска в дельте нет.

## Как проверялось

Независимый разбор кода до сопоставления с хендоффом:

- Проследил весь путь ключа: `structuralSpaceRecord` (новый `src/structural-space-record.ts`)
  → `structuralFingerprint` в `floor-geometry-key.ts` (новый default
  `floorGeometryKeyReader`, использует его `houseplan-card.ts:1902` —
  `_floorKey`, фактический потребитель wall union/physical bodies/inner
  contours) → `device-contact-card.ts` (удалена собственная `withoutDecor`/
  `wallFingerprint`, читатель теперь зовёт `floorGeometryKeyReader(host)` без
  аргумента, т.е. тот же структурный default) → `glow-scene.ts::lightGeometryFingerprint`
  (старая инлайн-фильтрация `led_strips` заменена на
  `structuralSpaceRecord(rawSpaceConfig, 'led_strips')`, тот же helper).
- Проверил, что одна функция действительно считает обе стороны сравнения
  light-реюза: `wallUnionPoolEntry` (`floor-geometry-key.ts:130-138`) тегирует
  пул `sourceFingerprint = lightGeometryFingerprint(record, cellCm, gridPitch)`,
  а `buildLightBarrierScene` (`glow-scene.ts:362-365`) сравнивает его с
  `revision.geometryFingerprint`, который сам вычислен той же
  `lightGeometryFingerprint` (`resolveLightBarrierRevision`). Потребители
  (`_resolveLightBarriers`, `LiveRuntime.geometry` — `live-interaction-runtime.ts:73`,
  `space-render.ts:475`) зовут функцию напрямую без второй проекции —
  авторский план технически подтверждается чтением, а не на слово.
  Генерация ключа не копирует/не обходит исключённые поля (`Object.keys`
  + `filter`, не `delete` на клоне) — соответствует «no second persistent
  model».
- Проверил, что generic memo остаётся полным: `floorRecordKeyMemo()` без
  аргумента (`summary-panel-runtime-loaded.ts:102`, area key) по-прежнему
  зовёт `contentFingerprint` — ни один вызывающий код сводного/area key не
  переключён на структурную проекцию.
- Прочитал `wall-thickness.ts`/`physical-geometry.ts`/`houseplan-card.ts` на
  предмет скрытой связи decor→физика — не нашёл: decor используется только в
  рендере decor-слоя, Properties/toolbar, assets; ни один геометрический
  алгоритм стен/светового барьера его не читает. Исключение безопасно по
  инвариантам продукта (docs/DECOR-EDITOR.md).
- Прочитал замену пути (§7.2, #1014): старая `withoutDecor`/`wallFingerprint`
  в `device-contact-card.ts` и старая инлайн-фильтрация в `glow-scene.ts`
  удалены полностью, второго алгоритма не осталось.
- Прочитал тесты: `test/floor-geometry-key.test.mjs` (два новых теста #1071) —
  явно проверяют, что геттер `decor` не читается (бросает при обращении),
  что generic `floorRecordKeyMemo()`/durable `contentFingerprint` остаются
  decor-aware, что все прочие поля (включая `future_geometry`, неизвестное
  поле) инвалидируют и для model, и для current записи, и что ключ не мутирует
  вход. `test/glow-scene.test.mjs` — аналогично для `lightGeometryFingerprint`:
  decor исключён, LED по-прежнему исключён, все прочие ключи инвалидируют.
- Прочитал `demo/smoke_decor_group_style_cache.mjs` (новый native witness,
  99 строк): large-house фикстура (`commitWallSegmentModel` — обычная сборка
  текущей модели перед сценарием, не исполнение мутанта), боковой
  inline/popup commit цвета двух furniture, проверка всех пяти
  `_floorCacheBuilds` счётчиков (`wallUnion/physicalBodies/innerContour/
  lightBarrier/lightPhysicalBodies`) до/после preview/save/undo/redo/inline/
  cancel/toolbar/cold-mount, реальный SVG stroke/opacity, полный сохранённый
  config, one-write/one-history, пустая selection после cold mount. Сценарий
  соразмерен защищаемому инварианту (исполняемый oracle, не замена чтением).
- Проверил release-ledger `docs/release-ledger/v1.82.0/1071.json`:
  `line-fix`, `introducedBy: 1038` (групповое редактирование появилось после
  stable v1.82.0) — обоснование корректно, задача не входит в пользовательский
  milestone релиза. `visual` называет ровно два новых regression-кадра с
  `expectation: new`, без pixel-allowance существующим кадрам.
- Проверил трейлеры: `a81e96ac6` (`User-Visible: yes`) правит оба
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в этом же коммите; текст описывает
  одно наблюдаемое изменение (убрано подвисание), без дублирующего числа с
  отдельным источником. `Spec-Draft` трейлер = финальный SPEC r3 sha256 из
  хендоффа. Остальные два коммита — `User-Visible: no`, корректно для
  test/doc-правок без видимого поведения.
- Проверил реестр мутантов: существующий `contact-wall-key-includes-decor`
  (#935) ретаргетирован на новый `src/structural-space-record.ts` (патчит
  `key !== 'decor'` → `__mutation_never_excluded__`) — не удалён, его guard
  (`test/device-contact-card.test.mjs`, тест #935) по-прежнему перекрывает
  переехавшую логику напрямую через `syncHouseplanDeviceContacts`. Новый
  `decor-colour-rebuilds-physical-walls-1071` зарегистрирован со статусом «не
  исполнялся» (execution=0, caught=unknown) — корректно по общей политике:
  обычный ночной мутант, не требующий прогона на ревью.
- Проверил защитную AC-таблицу (§2.7): «AC1/2/3 · доказан · чем краснеет» в
  хендоффе заполнена (обычный positive commit на исходнике краснеет на лишней
  сборке + названный зарегистрированный witness с «не исполнялся»), третий
  столбец не пуст — не находка.

Принятый `validate-gate` на точном материале (review-light-golden,
run [40180747990](https://github.com/Matysh/houseplan-card/actions/runs/40180747990),
headSha = материал ревью, `conclusion: success`):

| Проверка | Результат (из job-лога CI) | Что покрывает |
|---|---|---|
| `Фронтенд: типы, юниты, мутанты, синхрон бандла` | PASS, 1225 pure product unit tests, 0 fail | включает `floor-geometry-key.test.mjs`, `glow-scene.test.mjs`, `device-contact-card.test.mjs` |
| `Браузер: выбранные проверки push` (BROWSER_PLAN selected) | PASS: `smoke_decor_group_style_cache.mjs`, `smoke_decor_multiselect.mjs`, 15 связанных contact/resize/e2e смоков, golden `decor-group-style-applied-dark`/`-light` | AC1 (native structural-build witness), AC2 (контактные стены), выбранные Golden-сцены (ci:golden) |
| `Продукт: свежие проверки диапазона и упаковки`, `Упаковка`, `Классификация файлов`, `Предполёт`, `Переиспользование` | PASS | диапазон коммитов, провенанс, бандл |
| `Доказательство выполненных проверок` | PASS | сводный proof-степ |

Я не повторял эти проверки — вход (диапазон коммитов, те же файлы/тесты),
окружение (pinned CI Chromium) и oracle (те же counters/SVG/config) не
менялись после этого прогона; материал ревью и `headSha` совпадают
побайтово. Не прогонял и не требую: HA-pytest backend (Python не менялся,
job skipped закономерно), полный golden-матрикс/полный смоук-корпус
(предрелизный гейт, не гейт ревью — задача просит только два названных
кадра и связанные смоки), мутации по ночному registry (нерабочее время
гейта ревью: #709). Это весь перечень прогнанных/непрогнанных проверок.

## Находки

Независимый разбор не выявил ни одной находки — ни High, ни Medium, ни Low.
Побочных находок вне скоупа тоже нет.

## Что проверено и корректно

- AC1: `_floorKey`/`floorGeometryKeyReader` default (использует `houseplan-card.ts`
  wall union/physical bodies/inner contours) и `lightGeometryFingerprint`
  (light barrier/light physical bodies) оба используют общую
  decor-исключающую проекцию; подтверждено чтением и зелёным native witness
  в CI на точном материале.
- AC2: generic/config fingerprint, epoch, model/current различение, LRU —
  не тронуты; unit-тесты явно проверяют инвалидацию всех прочих полей и то,
  что исключённые данные не читаются (geter-ловушка).
- AC3: групповые контракты #1038 не задеты (toolbar остаётся defaults-only,
  изменений в этом пути нет); аудит в хендоффе ссылается на существующие
  зелёные unit/smoke без новых регрессий.
- Замена пути: старые дублирующие проекции в `device-contact-card.ts` и
  `glow-scene.ts` удалены целиком, второго алгоритма не осталось.
- Ledger, трейлеры, changelog — корректны и консистентны с диффом.
- Риск по изменённым участкам (#707), perf-класс на `glow-scene.ts` —
  покрыт контрактом ТЗ п.1 и AC1/AC2, видимым кодом и тестами.

## Чего не проверял

- Реальный GPU/Windows-прогон (владелец отметил как diagnostic-only,
  не гейт задачи, #929) — не повторял, достаточно headless CI proof.
- Полный 443+ браузерный корпус и полная Golden-матрица — не входят в объём
  ревью этой задачи (предрелизный гейт).
- Исполнение зарегистрированного мутанта `decor-colour-rebuilds-physical-walls-1071`
  и ретаргетированного `contact-wall-key-includes-decor` — по общей политике
  исполняются только в ночном workflow; на ревью это не требуется и не
  являлось бы допустимым.

## Вердикт

Зелёный. AC доказаны исполнимым native witness и unit-тестами с
зарегистрированными/обычными негативными случаями; защитная таблица
«AC · доказан · чем краснеет» заполнена; трейлеры и changelog корректны;
risk-класс perf по изменённым участкам покрыт ТЗ. Замечаний нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1071-decor-multiselect-color`, коммит `fbfed682c7c9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `809bd2285855333d118dbd1293afbe1a0ef49dbb`
  ```
  git log --all --format='%H %T' | grep 809bd2285855
  ```
- Тело issue: `78bf15319e2621657457d2fbadeb6deb6da137ab500276fa2db2609915c8ef01`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40181456368,"run_attempt":1,"digest":"9511c331fdd17209fba7b5fc736e8e2759a3d0c6769e91c72d1be1cba8defdc8"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwMDUsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MDk5OTk5OTk5OTk5OTk5NX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzgsIm91dHB1dF90b2tlbnMiOjE5NTkwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyNjgzOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQyMTE4MDcsImNvc3RVc2RFc3RpbWF0ZSI6MS41NDU3Njk0MDAwMDAwMDAyfV0sInR1cm5zIjo1NSwiZHVyYXRpb25NcyI6MjQ1NDI0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41NTA4Njk0MDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5083 output_tokens=19609 cache_creation_input_tokens=126838 cache_read_input_tokens=4211807 num_turns=55 -->
