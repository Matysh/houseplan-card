# CODE-REVIEW-117-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/117
- **ТЗ:** `docs/specs/117-registryless-opening-entity.md`, зелёное
  `docs/reviews/SPEC-REVIEW-117-r1.md` (High 0, Medium 0)
- **Предыдущий цикл:** `docs/reviews/CODE-REVIEW-117-r1.md` — зелёный, High 0,
  Medium 0. Слияние не удалось (конфликт с `dev`), задача вернулась в
  `S6-in-progress` не по правкам кода, а для ребейза (комментарий владельца от
  2026-08-18). Ветка ребейзнута на актуальный `origin/dev` и опубликована
  `--force-with-lease` на `c65cbcc96c644a2bfca3dbd6c62482dc16c092c3`.
- **Диапазон:** `git log --oneline origin/dev..HEAD` — четыре коммита:
  - `563a850` `docs: specify registryless opening entities` (`Issue: #117`,
    `User-Visible: no`)
  - `9baf533` `docs: review document for #117` (`Issue: #117`, `User-Visible: no`)
  - `01fe48d` `fix: support registryless opening entities` (`Issue: #117`,
    `User-Visible: yes`)
  - `c65cbcc` `docs: review document for #117` (`Issue: #117`, `User-Visible: no`)
- **Роль:** ревьюер кода (не автор), свежая сессия без контекста реализации,
  этап `S7-code-review`, цикл **r2/4** (лимит считается по этапу — вердикт ТЗ
  бюджет код-ревью не расходует).

## Скоуп ревью

`git diff origin/dev...HEAD --stat` — 18 файлов:

| Класс | Файлы |
|---|---|
| A (продукт) | `src/ha-binding-status.ts` |
| B (гейты/инструменты) | `demo/smoke_registryless_opening.mjs` (новый), `scripts/mutation-gate.mjs`, `test/ha-binding-status.test.mjs`, `test/render-device-snapshot.test.mjs` |
| C (документация) | `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/TESTING.md`, `docs/USER-GUIDE.ru.md`, `docs/images/screenshots.json`, `docs/specs/117-registryless-opening-entity.md`, `docs/specs/README.md`, `docs/reviews/SPEC-REVIEW-117-r1.md`, `docs/reviews/CODE-REVIEW-117-r1.md` |
| D (сгенерированное) | `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` |

**Что изменилось между r1 и r2:** сам продуктовый диф не изменился ни на
строку — `git show 01fe48d -- src/ha-binding-status.ts` даёт байт-в-байт тот же
патч, что был одобрен в r1 (единственная точка: `renderOpeningEntityAvailable`
в `src/ha-binding-status.ts:533-546` больше не требует одновременно
`projectedHass.entities[entityId]` и `projectedHass.states[entityId]`, только
наличие state в замороженной проекции). Ребейз добавил только слияние трёх
generated-бандлов с ушедшим вперёд `dev` (конфликт разрешён пересборкой) и
`docs/images/screenshots.json` (изменился только `sourceFingerprint`/
`sourceSha256` из-за нового содержимого бандла; все `imageSha256` — то есть сам
пиксельный результат существующих golden-сцен — не изменились). Это не
формальность: я не полагался на констатацию «код тот же», а сверил патч
построчно и независимо пересобрал бандл, см. ниже.

## Как проверялось

Я не ассистент автора — свежая сессия, ни один гейт не принят «со слов».
Все команды ниже прогнаны лично на этом дереве (`origin/issue/117-registryless-opening`
@ `c65cbcc`).

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | 870/870 pass (совпадает с заявленным автором после ребейза; в r1 было 804/804 — рост за счёт коммитов `dev`, вошедших при ребейзе) |
| Build + сверка бандлов | `npm run build`, затем `sha256sum` трёх копий | зелёный; все три — `72f660c0c574574ab07d8d7dd96262c928f333dbe5747e8091c48fbb6f0094ca`, совпадает с заявленным автором хешем и с уже закоммиченными файлами (`git status --short` после сборки — пусто) |
| Целевой smoke (AC1/2/3/7/8/9) | `node demo/smoke_registryless_opening.mjs` | `OK`, все 13 подпроверок `true` |
| Регрессия opening-биндинга | `node demo/smoke_opening_binding.mjs` | `OK`, все 15 подпроверок `true` |
| Регрессия lock action | `node demo/smoke_lock_action.mjs` | `OK`, все 8 подпроверок `true` |
| Регрессия lock invariant (SCOPE.md) | `node demo/smoke_lock_invariant.mjs` | `OK`, все 7 подпроверок `true` |
| Mutation-guard | `node scripts/mutation-gate.mjs --id=registryless-opening-requires-registry-row` | `поймано 1 из 1` — возврат `.entities[entityId]` красит smoke, чистый прогон зелёный |
| Process-gate (офлайн + `--issues`) | `node scripts/process-gate.mjs --range origin/dev..HEAD --target-ref refs/heads/issue/117-registryless-opening --issues` | `коммитов 4`, `гейт пройден, предупреждений 0` |

Что не прогонял и почему (соразмерность гейтов, PROCESS.md §8, диф не менялся
относительно уже принятого r1):

- **Полный набор из 127 browser-смоков** — diff по-прежнему задевает ровно одну
  логическую точку и один класс потребителей (opening contact/lock). Целевой
  smoke плюс три регрессионных (opening-биндинг, lock action, lock invariant)
  покрывают contract, security-инвариант и frame-atomicity — этого достаточно
  для поверхности изменения; расширение до полного набора не добавило бы
  сигнала сверх r1.
- **`npm run golden:verify`** — не прогонял. Прочитал diff `src/space-render.ts`
  и геометрических модулей в `origin/dev...HEAD` — их там нет; единственная
  правка убирает один операнд `&&`, который для уже зарегистрированных
  сущностей (`entities[eid]` и `states[eid]` присутствуют или отсутствуют
  синхронно) не меняет результат вовсе. `docs/images/screenshots.json` в этом
  же коммите подтверждает то же самое замером: `imageSha256` всех 10 сцен не
  изменился, изменился только `sourceFingerprint` (хеш нового бандла). Ни один
  golden-сценарий не использует YAML-only fixture без registry row.
- **`python -m pytest tests_backend -q`** — не прогонял, диф не касается
  `custom_components/houseplan/**/*.py` (таких файлов в изменениях нет).
- **Performance-профили** — не прогонял. ТЗ §14 явно заявляет «нет», правка не
  добавляет новый проход по кадру или структуру данных.
- **Реальную установку Home Assistant с живой YAML-сущностью без `unique_id`**
  — вне возможностей код-ревью; демо-стенд с фейковым `hass`/registry —
  канонический суррогат по `AGENTS.md`, и я прогнал его лично.
- **Ребейз/историю ветки как таковую** (корректность merge-base, что именно
  было в конфликте) — не переисполнял `git rebase`; вместо этого сверил *итог*:
  продуктовый патч побайтово идентичен r1, три бандла воспроизводимо
  собираются из текущего дерева с тем же хешем, что заявил автор, `npm test`
  зелёный на полном (после ребейза выросшем) наборе. Это доказывает результат
  ребейза, а не процесс его выполнения — для код-ревью этого достаточно.
- **Локальный `pre-push`, обойдённый автором при публикации ребейзнутой ветки**
  — не входит в скоуп код-ревью #117: это отдельный дефект инструмента
  (диапазон `pre-push` после `--force-with-lease` неверно берёт старый remote
  SHA), заведён владельцем отдельно как **#190** (`process`, `bug`, `P2`,
  `S1-new` — проверено `gh issue view 190`, issue существует с ровно этими
  метками). Страховка CI (`process-gate` job в `validate.yml`) не обходится
  этим действием, и я независимо прогнал тот же скрипт офлайн — гейт чист.

## Находки

Находок уровня **High** и **Medium** нет.

Low не завожу. Диф идентичен уже одобренному в r1, повторное построчное чтение
не выявило ничего нового; единственное новое обстоятельство ребейза
(`docs/images/screenshots.json`) — ожидаемое следствие смены хеша бандла, а не
дефект.

## Что проверено и корректно

Ревью выполнено заново, не как штамп поверх r1: каждый AC перепроверен чтением
текущего кода на этом SHA и/или повторным исполнением, без опоры на текст
предыдущего документа как на источник истины.

- **AC1 (registry-less live contact меняет presentation).** Прочитан
  `_openingAmt()` (`src/houseplan-card.ts:17101-17107`): amount берётся из
  `this._renderPlanHass.states[o.contact]` только когда
  `_renderOpeningEntityAvailable(o.contact)` истинно. Доказано smoke:
  `closedContactControlsPresentation` (closed) и `stateTickSwapsOneAtomicFrame`
  (open) на `binary_sensor.hp117_yaml_contact`, для которой smoke явно проверяет
  `noRegistryRowsExist` (нет строки в `card.hass.entities`).
- **AC2 (registry-less live lock badge).** `_renderOpeningLocks()`
  (`src/houseplan-card.ts:17221-17224`) фильтрует по тому же
  `_renderOpeningEntityAvailable(o.lock)`. Доказано smoke:
  `yamlLockBadgeRendersLocked`, затем `.oplock.unlocked` после смены состояния,
  `unknownKeepsExistingTypeSemantics` — `unknown` не становится
  ни `locked`, ни `unlocked`, значок `.oplock.unknown`.
- **AC3 (frame — только immutable projection, не raw hass).** Прочитано:
  `_renderOpeningEntityAvailable` (`src/houseplan-card.ts:17129-17131`) —
  однострочная делегация в `renderOpeningEntityAvailable(this._renderPlanHass, eid)`,
  `this.hass` не упоминается нигде в теле. Source-contract тест
  `test/render-device-snapshot.test.mjs` проверяет это регексом на тело именно
  этого метода (`assert.doesNotMatch(openingRenderAvailability, /this\.hass\b/)`)
  и через `methodBody`. Mutation-гейт подтверждает, что тест красится при
  регрессии (возврат `.entities[entityId]`), а не только выглядит проверкой.
- **AC4 (active registry entity — прежнее поведение).** Логическое обоснование
  подтверждено чтением `activeRegistryHass()` (`src/ha-binding-status.ts:323-354`):
  для зарегистрированной активной сущности `entities[eid]` и `states[eid]`
  присутствуют или отсутствуют синхронно — удаление одного операнда `&&` не
  меняет результат. Исполнением подтверждено `smoke_opening_binding.mjs`
  (`exactOpeningReferencesStayActive` и вся регрессионная матрица, 15/15).
- **AC5 (disabled/orphan/missing остаются unavailable).** Прочитан
  `activeRegistryHass()` построчно: явный `disabled_by` на сущности или
  родительском устройстве, а также authoritative-orphan (`device_id` указывает
  на отсутствующее устройство) — все три ветки удаляют `state` из проекции
  *до* её передачи в render helper, поэтому `renderOpeningEntityAvailable`
  честно не может их оживить. Доказано unit
  (`test/ha-binding-status.test.mjs`, кейсы `lock.disabled_entity`,
  `lock.disabled_parent`, `lock.orphan`, `lock.missing` — все `false`) и smoke
  (`explicitDisabledRowsRemoveStaleStates`, с ожиданием debounce-паузы `220ms`
  перед проверкой удаления state).
- **AC6 (limited-registry live exact entity работает).** Доказано unit —
  `limitedFrame` с `authoritative: false` и без registry rows,
  `renderOpeningEntityAvailable(limitedFrame, 'binary_sensor.limited_yaml')`
  → `true`.
- **AC7 (marker tombstone не блокирует opening reference).** Доказано unit
  (`markerTombstoneIsNotAnInput` — projection с `removed: true` маркером той же
  сущности всё равно даёт `true`) и smoke
  (`markerTombstonesDoNotBlockOpening`, который дополнительно контрастирует с
  `!card._planEntityAvailable(...)`, то есть общий marker-путь по-прежнему
  блокируется, а opening-путь — нет; узкий скоуп из ТЗ §4 не создаёт разрыва).
- **AC8 (lock security/unlock confirmation не меняются).** Прочитан
  `_lockAction()` (`src/houseplan-card.ts:17260-17273`) — вне дифа, по-прежнему
  проверяет `_openingEntityAvailable()` (live path) перед `callService`,
  `confirm()` только для `unlock`. Значок `.oplock` по клику лишь открывает
  info-карточку (`this._openingInfo = o`), не вызывает сервис — прочитано на
  `src/houseplan-card.ts:17246-17250`. Подтверждено исполнением:
  `smoke_lock_action.mjs`, `smoke_lock_invariant.mjs` зелёные (SCOPE.md-инвариант
  «The lock invariant, stated precisely» не ослаблен), плюс новый smoke явно
  проверяет `planOpeningAndBadgeNeverActuate` (тап по проёму и badge не меняет
  число вызовов `callService`) и `explicitInfoActionStillWorks` (только явное
  действие в открытой info-карточке вызывает `lock.unlock`).
- **AC9 (state update не пересобирает geometry/config).** Доказано smoke:
  `stateTickDoesNotRebuildGeometryOrConfig` сравнивает `_physicalBodiesCache`,
  `_cfgEpoch` и сериализованный `_serverCfg` до/после тика состояния.
- **AC10 (existing opening golden/interactions без регресса).** Golden baseline
  в дифе не тронут; `docs/images/screenshots.json` показывает, что все 10
  `imageSha256` не изменились — то есть уже принятые пиксельные сцены
  идентичны и после ребейза. Поведенческая регрессия подтверждена отдельно
  исполнением `smoke_opening_binding.mjs` (зелёный).
- **Трейлеры и changelog.** Все четыре коммита несут терминальные `Issue: #117`
  и `User-Visible: yes|no` (проверено `git show -s --format` по каждому).
  Коммит с `User-Visible: yes` (`01fe48d`) правит `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в себе же (`git show 01fe48d --stat`), обе записи под
  одним и тем же заголовком `v1.65.0-beta.2`, без дублирования с уже
  существующими записями.
- **Соответствие ТЗ и SCOPE.md.** Диф не расширяет скоуп (§4 ТЗ дословно
  соблюдён: picker, миграция, marker lifecycle, generic registry-less для
  прочих marker-биндингов, geometry не тронуты). Задача лежит внутри уже
  закрытых J1/J3/J6 (`docs/SCOPE.md`), lock-инвариант не ослаблен.
- **Целостность ребейза.** Продуктовый патч (`src/ha-binding-status.ts`)
  побайтово идентичен версии, одобренной в r1 (сверено `git show` diff-текста).
  Три копии бандла воспроизводимо пересобираются из текущего дерева с тем же
  SHA-256, что заявил автор в хендоффе. `git status --short` после сборки —
  пусто: закоммиченные бандлы уже соответствуют пересборке, конфликт разрешён
  корректно, а не «на глаз».

## Чего не проверял

- Полный набор из 127 browser-smoke — предрелизный гейт, не гейт ревью;
  обоснование сужения дано выше и не изменилось относительно r1.
- `npm run golden:verify` — обоснование дано выше (`imageSha256` неизменны,
  геометрические/стилевые модули вне дифа).
- `python -m pytest tests_backend -q` — Python не тронут этим дифом.
- Performance-профили — ТЗ §14 явно исключает влияние, изменение не меняет
  проход по кадру.
- Реальную установку Home Assistant с YAML-сущностью без `unique_id` — вне
  возможностей ревью; демо-стенд — канонический суррогат, прогнан лично.
- Сам процесс `git rebase` (порядок разрешения конфликтов, промежуточные
  состояния) — не переисполнялся; проверен итог (см. «Целостность ребейза»
  выше), что для код-ревью достаточно.
- Дефект `pre-push` при force-push после rebase — вне скоупа этого issue,
  отслеживается отдельно в #190; подтверждено, что issue заведён и что CI
  backstop (`process-gate`) при этом не обойден (перепрогнан лично, чист).

## Вердикт

Зелёный. High: 0, Medium: 0. Ребейз не изменил продуктовый код ни на строку —
проверено побайтовым сравнением диффа, а не заявлением автора; три копии
бандла воспроизводимо пересобираются с тем же хешем; полный (выросший после
ребейза) unit-набор 870/870, typecheck и целевые/регрессионные smoke зелёные,
mutation-guard подтверждает, что покрытие умеет падать. Каждый AC1–AC10 либо
доказан автотестом, который я лично прогнал, либо разобран чтением текущего
кода на этом SHA с явной пометкой «проверено чтением, не исполнением».
Трейлеры, changelog (RU+EN) и process-gate в порядке. Задача готова к слиянию.
