# CODE-REVIEW-874-r1

Issue: #874 · Этап: code · Трек: ask · Заход: r1 · Блокирующих циклов: 0/4
Материал: `06992532 50784b8717f31b5b611f529009d27df5` (рабочая копия на этом SHA,
`dev` — `c93cdddc`, ветка строится на нём без расхождений).

## Скоуп

Баг #874: составное замыкание комнаты (новая стена + ранее нарисованная
перегородка + существующая общая стена с соседней комнатой) классифицировалось
как полностью вложенная комната, а не как Split родителя — отказ `third-owner`
оставлял диалог создания открытым с видимо активным, но неработающим Save.

Диапазон `origin/dev..HEAD` — 4 коммита, обслуживает J4/J6 (`docs/SCOPE.md`):
«держать план достоверным по мере эволюции дома», создание/разбор комнат через
редактор стен. Правки:

- `src/wall-face-room-split.ts` (новый, 167 строк) — чистый lazy-helper:
  классификация face как `plain|refuse|split` через `polyclip-ts`
  intersection/difference/union, подбор complementary-кандидатов, скоуп
  promotion carriers.
- `src/houseplan-editor-runtime.ts` — `_offerWallFaces`/`_offerExistingWallFace`
  переведены на единый `_classifyWallFaces`; `_applyWallFaceBatch` получил
  stamp `spaceId/geometryFingerprint`, восстановление исходной толщины по
  `sourceIntervals`/`model.partitions`, `_dismissWallFaceBatch`;
  `_clearGeometryGesture` закрывает только форму создания, не `roomEditId`.
- `src/houseplan-card.ts` — зеркальное объявление полей `WallFaceBatch`.
- Тесты: `test/wall-face-room-split.test.mjs` (16 unit), новый
  `demo/smoke_wall_face_room_split.mjs` (14 сценариев), правки в
  `smoke_room_autoclose.mjs`, `smoke_unified_wall_tool.mjs`,
  `smoke_wall_face_overlap.mjs` под новый контракт.
- Реестры: `scripts/smoke-links.mjs` (+1 связь), `scripts/mutation-registry.mjs`
  (+5 definitions), `docs/testing-notes/mutation-browser-guards.md`,
  `scripts/monolith-baseline.json`.
- Документация: `WALL-THICKNESS.md` §11, `ARCHITECTURE.md`, `USER-GUIDE.ru.md`,
  `STATUS.md`, `DEVELOPMENT.md`, оба `CHANGELOG`, `docs/release-ledger/v1.80.1/874.json`.

ТЗ (тело issue, раздел `## ТЗ`) прошло ревью ТЗ зелёным на `2f4c89b5`
(`docs/reviews/SPEC-REVIEW-874-r1.md`) и не менялось с тех пор — в этом раунде
не пересматривается, только AC↔код.

## Как проверялось

Дешёвые гейты уже подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/38379322915):
`npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла — не
перегонялись повторно.

Прогнано самостоятельно в этом раунде (все команды и результаты):

| Гейт | Команда | Результат |
|---|---|---|
| Unit нового helper | `node --test test/wall-face-room-split.test.mjs` | PASS 16/16 |
| Реестр мутаций | `node scripts/mutation-registry-check.mjs` | PASS, exit 0 |
| Named smoke (AC1,AC3,AC4,AC5,AC6) | `node demo/smoke_wall_face_room_split.mjs` | PASS, 14/14 сценариев |
| Named smoke (AC2) | `node demo/smoke_wall_face_overlap.mjs` | PASS, 12/12 проверок |
| Risky hunk (изменён) | `node demo/smoke_room_autoclose.mjs` | PASS, 9/9 |
| Risky hunk (изменён) | `node demo/smoke_unified_wall_tool.mjs` | PASS, 16/16 |
| Named smoke (AC5 lineage) | `node demo/smoke_wall_face_lineage.mjs` | PASS, все сценарии |
| Инварианты модели | встроены в `smoke_wall_face_room_split.mjs` (`checkReferences/checkWallKeys/checkMixedRoleRecords/checkHiddenObstacles/checkPhysicalGeometry` после Save) | PASS, 0 нарушений |
| Ratchet/monolith baseline | `npm run bundle:sync` + `node scripts/ratchets.mjs report` | bundleBytes факт 2 799 698 vs потолок 2 799 573 (+125, полоса ±2000) — в полосе |
| «Тест умеет падать» (AC1/AC2 ядро) | вручную откатил `return result ? {kind:'split',...} : {kind:'plain'}` → `return {kind:'plain'}` (это и есть зарегистрированный мутант `wall-face-composite-falls-back-to-island`), прогнал смок повторно | КРАСНЫЙ: 13 из 14 сценариев упали (third-owner возвращается, `created/sourceCmPreserved/cutCmPreserved/backendRefused/acceptedRoom` — false) |

Файл восстановлен сразу после проверки (`git diff` — пусто), рабочее дерево
после всех прогонов чистое (`git status --porcelain` — пусто,
сгенерированные `dist/**`/`demo/srv/**` возвращены в состояние материала).

Чтением, без исполнения: `_applyWallFaceBatch` целиком (захват
`sourceIntervals` до мутации, порядок `main.poly` → новые комнаты → толщины →
`reconcileCoincidentPartitions` → `_commitPhysicalGeometry`), `_clearGeometryGesture`
(условие `!this.host._roomEditId` не трогает обычный room-edit диалог),
классификация в `wall-face-room-split.ts` (контракт §4 ТЗ построчно против
кода), i18n-ключи (`geometry_unsafe` уже существовал в `src/i18n/{ru,en,de,fr}.json`
до этой задачи — новых строк не добавлено), ledger-обоснование относительно
`v1.80.1` (см. ниже).

## Классификация ledger и предыдущий stable

`docs/release-ledger/v1.80.1/874.json`: `category: "stable-fix"`. Проверено
чтением `git show v1.80.1:src/houseplan-editor-runtime.ts` — строка 2517
(`splitRoomPath(poly, this.host._path, ...)`) подтверждает, что уже
выпущенный `v1.80.1` использует тот же ограниченный по `this.host._path`
алгоритм без составной классификации — баг не внесён бета-циклом 1.81.0,
воспроизводится на уже стабильном поведении. Классификация корректна,
`introducedBy` не требуется.

## Находки

Блокирующих (High) и находок в скоупе (Medium) нет.

Один путь проверен адверсариально и не подтвердился как находка: ослабление
проверки «остаток — ровно один компонент без отверстий»
(`remainder.length !== 1 || remainder[0].length !== 1`, строка 107) до
`remainder.length < 1` не ломает ни один из 16 unit-тестов — но не потому,
что проверка лишняя, а потому что финальная двусторонняя проверка
`union(rest, child) === parent` (строки 119–123, в обе стороны через
`difference`) независимо перехватывает любой пропущенный компонент остатка:
потерянная площадь неизбежно всплывает как расхождение `parent` против
`union`. Это добротный redundant guard, а не дыра — не завожу находку.

## Что проверено и корректно

- **Контракт §4 ТЗ** построчно: `sharesSpan` отсекает point-only контакт и
  соседей без площади пересечения; `overlap<=epsilon²` отличает соседа от
  родителя; двусторонние area/intersection/union проверки гарантируют, что
  части не пересекаются и в сумме точно восстанавливают родителя (относительный
  допуск `1e-6`, как `splitRoomPath`); `result` уже установлен → `refuse`
  (несколько подходящих родителей не дают произвольный выбор); островная
  комната без общего участка границы остаётся `plain`, не предлагается как
  Split (`sharesSpan` ложно не сработает для неё).
- **Детерминированный выбор большей стороны и tie-break** (`ringKey`,
  winding/старт-независимый) — проверено unit-тестом с отражённым/сдвинутым
  входом и порядком комнат.
- **`classifyWallFaceCandidates`**: complementary faces дают одну меньшую
  комнату независимо от порядка подачи; конфликтующие cuts (разные остатки
  на одном `roomId`) не queue'ятся вовсе — подтверждено unit и
  `smoke_wall_face_overlap`.
- **Форма после отказа** (AC3): `_dismissWallFaceBatch` закрывает именно
  контекст создания (`_roomDialog=false`, очистка `_nameSel/_areaSel`) и не
  трогает обычный room-edit (`_roomEditId` guard в `_clearGeometryGesture`);
  зарегистрированный мутант `wall-face-reload-keeps-form-after-draft-loss`
  адресует именно эту строку.
- **Stale-proposal barrier** (AC6): `batch.spaceId`/`batch.geometryFingerprint`
  проверяются в начале `_applyWallFaceBatch` до любой мутации; и «публичный»
  reload (`setServerConfig` + settle), и явный race-инжект (`_cfgEpoch++` без
  замены пропозала) оба дают отказ без записи — подтверждено двумя разными
  smoke-сценариями plus мутант `wall-face-apply-overwrites-changed-geometry`.
- **Толщина/carrier-скоуп** (AC5): `sourceIntervals` захватывается ДО мутации
  геометрии (до `main.poly =`, до появления новых комнат) и используется как
  источник «родного» cm старых интервалов; `model.partitions` (тоже
  пре-мутационный) — источник cm для новосозданного cut; явный fallback —
  только для действительно новых интервалов без ни одного из двух
  источников. Проверено чтением порядка операций и тремя smoke-вариантами
  0/15, 25/15, 25/0 см.
- **`selectWallFacePromotionIds`**: promotion ограничен carriers, делящими
  положительный участок с принятым кольцом — посторонняя coincident legacy
  перегородка (`unrelated-coincident`) не поглощается; отдельный
  зарегистрированный мутант `wall-face-acceptance-sweeps-unrelated-carriers`
  и отдельный smoke-сценарий это проверяют.
- **Трейлеры**: все 4 коммита несут `Issue: #874`; `User-Visible: yes` у двух
  коммитов (`7c2eb277`, `ca42ff24`) правит оба `CHANGELOG.md`/`CHANGELOG.ru.md`
  в тех же коммитах; `test:`-коммиты — `User-Visible: no` без правок
  changelog, корректно.
- **Одно число — один источник**: новых пользовательски видимых чисел дифф не
  вводит (toast-тексты и диалоговые поля не меняются); toast-ключ
  `geometry_unsafe` переиспользует существующую строку всех 4 локалей.
- **i18n/модель**: `model_version` не менялся, `custom_components/**` не
  затронут — соответствует §6 ТЗ «Модель v10 без изменений».
- **monolith-baseline.json**: пересчитано локально (`npm run bundle:sync` +
  `node scripts/ratchets.mjs report`) — `hostRefs`/`bundleBytes` факт
  совпадает с заявленным потолком в пределах полосы, не фиктивная правка.

## Чего не проверял

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` с тройной сверкой
  бандла — не перегонял: зелёный Validate на этом SHA уже подтверждает их
  (см. выше), а `npm run bundle:sync` локально (для прогона смоков) дал
  идентичный по составу build без ошибок типов, что является их косвенным
  повтором.
- Полный `node scripts/smoke-select.mjs` список (65 «прямых совпадений» —
  почти целиком общие символы `_spaceModel/_curSpaceCfg/_path/_roomDialog`,
  используемые везде в runtime) не прогонял целиком: полный набор — предрелизный
  гейт, не гейт ревью. Прогнал прицельно пять смоков, явно названных в AC
  задачи и/или изменённых в этом диффе (`smoke_wall_face_room_split`,
  `smoke_wall_face_overlap`, `smoke_wall_face_lineage`, `smoke_room_autoclose`,
  `smoke_unified_wall_tool`) — это и есть прямое совпадение с наибольшим весом
  (новый/изменённый файл против символа) плюс именованная AC-цепочка.
- `pytest tests_backend`/HA harness — Python и зеркала моделей не менялись,
  гейт не применим к этой задаче.
- `node scripts/model-invariants.mjs --config <экспорт владельца>` против
  реального приватного экспорта из репорта — не запускал: у меня нет файла
  `houseplan-space-Tes-space-2026-10-13_08-03-38.json` (приватный, не
  коммитится по правилу ТЗ §9), полагаюсь на обезличенную fixture
  (`test/fixtures/874-room-closure.json`, точные координаты сохранены) и
  встроенные инварианты внутри `smoke_wall_face_room_split.mjs`, которые
  покрывают тот же код-путь после реального Save.
- Мутанты (все 5 новых и существующий реестр) не гонял批ч: по правилам раунда
  «в разработке мутанты не гоняются ни на каком треке», ловлю проверяю ночным
  прогоном (#709). Вручную воспроизвёл один из пяти (`wall-face-composite-falls-back-to-island`)
  как представительную проверку, что заявленная «чем краснеет» колонка не
  фиктивна — остальные четыре не трогал.
- Touch/kiosk ручное прохождение — изменение не затрагивает View/kiosk код
  (подтверждено чтением: `_offerWallFaces`/`_applyWallFaceBatch` вызываются
  только из Plan/Walls editor path), ручной touch-смок не требуется по ТЗ §7.
- Golden/perf capture — рендер, SVG, камера, шейдеры не менялись; задача это
  явно исключает в ТЗ §7, не прогонял.

## Вердикт

Все 6 AC проверены: защитные AC (AC2, AC3, AC5, AC6) имеют непустую колонку
«чем краснеет» — либо явный unit negative case в самом тесте, либо
зарегистрированный мутант, один из которых я лично воспроизвёл и подтвердил
красным. Геометрический контракт §4 ТЗ построчно соответствует коду. Risky
hunks (весь новый файл + интеграция в `_applyWallFaceBatch`/`_offerWallFaces`)
разобраны и покрыты автотестами, которые умеют падать. Документация,
changelog (оба языка), trailers и release-ledger корректны и согласованы с
предыдущим stable (`v1.80.1`). Находок нет.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/874-composite-room-closure`, коммит `069925325078` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `cc4b388e6a1b6ff4c1a00e2755f209b5cfa42dfe`
  ```
  git log --all --format='%H %T' | grep cc4b388e6a1b
  ```
- Тело issue: `f3403fd5e9ff7dea139ef90b458024919e55a3ae19dc8418800ef42ec6f9064a`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ0MzQsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0NTE5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxNTIsIm91dHB1dF90b2tlbnMiOjM2NDc0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NDA5NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjg0Mjg1ODgsImNvc3RVc2RFc3RpbWF0ZSI6Mi43MDcxMzc2MDAwMDAwMDA3fV0sInR1cm5zIjo4MiwiZHVyYXRpb25NcyI6NzY2MTQwLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi43MTE2NTY2MDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4586 output_tokens=36491 cache_creation_input_tokens=164094 cache_read_input_tokens=8428588 num_turns=82 -->
