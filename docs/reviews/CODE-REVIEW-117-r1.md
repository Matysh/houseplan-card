# CODE-REVIEW-117-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/117
- **ТЗ:** `docs/specs/117-registryless-opening-entity.md`, зелёное
  `docs/reviews/SPEC-REVIEW-117-r1.md` (High 0, Medium 0)
- **Диапазон:** `git log --oneline origin/dev..HEAD` — три коммита:
  - `03cca97` `fix: support registryless opening entities` (`Issue: #117`,
    `User-Visible: yes`)
  - `3bd80ff` `docs: review document for #117` (`Issue: #117`, `User-Visible: no`)
  - `cc22988` `docs: specify registryless opening entities` (`Issue: #117`,
    `User-Visible: no`)
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`, цикл r1/4

## Скоуп ревью

Диф (`git diff origin/dev...HEAD --stat`, 16 файлов):

| Класс | Файлы |
|---|---|
| A (продукт) | `src/ha-binding-status.ts` |
| B (гейты/инструменты) | `demo/smoke_registryless_opening.mjs` (новый), `scripts/mutation-gate.mjs`, `test/ha-binding-status.test.mjs`, `test/render-device-snapshot.test.mjs` |
| C (документация) | `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/TESTING.md`, `docs/USER-GUIDE.ru.md`, `docs/reviews/SPEC-REVIEW-117-r1.md`, `docs/specs/117-registryless-opening-entity.md`, `docs/specs/README.md` |
| D (сгенерированное) | `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` |

Продуктовая правка — ровно одна логическая точка: `renderOpeningEntityAvailable()`
в `src/ha-binding-status.ts:533-545` больше не требует `projectedHass.entities[entityId]`
одновременно с `projectedHass.states[entityId]`; сохранена проверка только
наличия state в замороженной активной проекции. `_openingAmt()` и
`_renderOpeningLocks()` в `src/houseplan-card.ts` не менялись — оба уже шли
через единственную точку `_renderOpeningEntityAvailable()`, поэтому фикс
закрывает contact и lock одновременно без риска рассинхронизации.

## Как проверялось

Гейты, которые прогнал я лично (не со слов автора):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | 804/804 pass |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | зелёный; `sha256sum` всех трёх копий совпадает: `73fffed183e23ab015cb0dd43ee0b3d2b277822bdd2f44813af6a1051398c881` |
| Целевой smoke (AC1/2/3/7/8/9) | `node demo/smoke_registryless_opening.mjs` | `OK`, все 13 подпроверок `true` |
| Регрессия opening-биндинга | `node demo/smoke_opening_binding.mjs` | `OK`, все 15 подпроверок `true` |
| Регрессия lock action | `node demo/smoke_lock_action.mjs` | `OK`, все 8 подпроверок `true` |
| Регрессия lock invariant (SCOPE.md) | `node demo/smoke_lock_invariant.mjs` | `OK`, все 7 подпроверок `true` |
| Mutation-guard | `node scripts/mutation-gate.mjs --id=registryless-opening-requires-registry-row` | `поймано 1 из 1` — мутант (возврат `.entities[entityId]`) красит smoke, чистый прогон зелёный |

Дополнительно — доказательство «тест умеет падать» для unit-покрытия, не
только для smoke (§2.7 требует это явно): временно вернул проверку
`!!projectedHass?.entities?.[entityId]` в `src/ha-binding-status.ts`,
пересобрал `test-build` (`npx tsc -p tsconfig.test.json && node
scripts/fix-test-build.mjs`) и прогнал `node --test test/ha-binding-status.test.mjs
test/render-device-snapshot.test.mjs` — результат `18 pass / 1 fail`, упал
именно новый тест `'opening render availability trusts one frozen active
projection'` (assert на `binary_sensor.yaml_only === true`). После проверки
восстановил `src/ha-binding-status.ts` из `git`, пересобрал `test-build` и
перепрогнал `npm test` — снова 804/804, дерево чистое (`git status --short`
пусто, `npx tsc -p tsconfig.test.json` — сгенерированный `test-build/` не
версионируется).

Что не прогонял и почему (соразмерность гейтов, PROCESS.md §8):

- **Полный набор из 127 browser-смоков** — diff задевает ровно одну точку
  (`renderOpeningEntityAvailable`) и один потребитель (opening
  contact/lock); прогнал новый целевой smoke плюс три регрессионных,
  напрямую покрывающих opening-биндинг и lock-security — этого достаточно
  для поверхности изменения, полный прогон здесь не добавил бы сигнала.
- **`npm run golden:verify`** — не прогонял. Обоснование не «со слов
  автора», а по коду: `space-render.ts`/`logic.ts`/любой геометрический или
  стилевой путь не тронуты; единственная правка убирает одно `&&`-условие,
  которое для уже зарегистрированных сущностей (у них `entities[eid]` и
  `states[eid]` совпадают одновременно) не меняет результат вообще —
  registry-backed painted frame буквально не может стать другим. Влияет
  только на entity без registry row, которых ни в одном golden-сценарии нет
  (не заведены YAML-only fixtures). Golden-эталоны диф не трогает.
- **`python -m pytest tests_backend -q`** — не прогонял, диф не касается
  `custom_components/houseplan/**/*.py` (нет таких файлов в списке
  изменений).
- **Performance-профили** — не прогонял. ТЗ §14 явно заявляет «нет», и
  правка добавляет один and-член в уже читаемый на каждом кадре boolean —
  не новый проход по данным, не новая структура.

## Находки

Находок уровня **High** и **Medium** нет.

Low не завожу: код, тесты и документация построены по написанному в ТЗ
без отклонений, я не нашёл ни одного места, которое стоило бы поправить или
снять с запиской.

## Что проверено и корректно

- **AC1 (registry-less live contact меняет presentation)** — доказано
  smoke: `closedContactControlsPresentation` (closed) и
  `stateTickSwapsOneAtomicFrame` (open) на `binary_sensor.hp117_yaml_contact`
  без registry row (`card.hass.entities[...] == null` подтверждено смоком).
- **AC2 (registry-less live lock badge)** — доказано smoke:
  `yamlLockBadgeRendersLocked`, затем `.oplock.unlocked` после смены
  состояния, `unknownKeepsExistingTypeSemantics` для `unknown`.
- **AC3 (frame — только immutable projection, не raw hass)** — доказано и
  чтением, и исполнением: `_renderOpeningEntityAvailable` (`src/houseplan-card.ts:16283`)
  — однострочная делегация в `renderOpeningEntityAvailable(this._renderPlanHass, eid)`,
  `this.hass` не упоминается; source-contract тест
  `test/render-device-snapshot.test.mjs` проверяет это регексом
  (`assert.doesNotMatch(..., /this\.hass\b/)`) и подтверждает через
  `methodBody`. Мутационный гейт и мой ручной revert показывают, что тест
  красится при регрессии — не косметическая проверка.
- **AC4 (active registry entity — прежнее поведение)** — не могло
  измениться логически (см. «Что не прогонял», golden) и подтверждено
  smoke-регрессией `smoke_opening_binding.mjs` (`exactOpeningReferencesStayActive`
  и другие).
- **AC5 (disabled/orphan/missing остаются unavailable)** — доказано unit
  (`test/ha-binding-status.test.mjs`, ветки `lock.disabled_entity`,
  `lock.disabled_parent`, `lock.orphan`, `lock.missing` — все `false`) и
  smoke (`explicitDisabledRowsRemoveStaleStates`, включая ожидание паузы на
  дебаунс реестра `220ms` перед проверкой). Логика опирается на уже
  существующий (не изменённый этим дифом) `activeRegistryHass()`
  (`src/ha-binding-status.ts:323-354`) — прочитано построчно: state
  registry-less сущности проходит проекцию, только когда для неё нет
  соответствующей записи `entities[eid]` вовсе (значит проверки disabled
  не применяются), либо запись есть и явно не отключена.
- **AC6 (limited-registry live exact entity работает)** — доказано unit
  (`limitedFrame` в тесте, `authoritative: false`).
- **AC7 (marker tombstone не блокирует opening reference)** — доказано unit
  (`markerTombstoneIsNotAnInput`) и smoke (`markerTombstonesDoNotBlockOpening`,
  который дополнительно контрастирует с `!card._planEntityAvailable(...)` —
  показывает, что общий marker-путь по-прежнему блокируется, а
  opening-путь — нет, то есть сужение скоупа из ТЗ §4 не создало разрыва).
- **AC8 (lock security/unlock confirmation не меняются)** — подтверждено
  чтением: `_lockAction()` (`src/houseplan-card.ts:16411-16424`) не входит в
  диф, по-прежнему проверяет live `_openingEntityAvailable()` перед
  `callService`, требует `confirm()` только для `unlock`. Регрессия
  подтверждена исполнением: `smoke_lock_action.mjs`,
  `smoke_lock_invariant.mjs` зелёные, плюс новый smoke явно проверяет
  `planOpeningAndBadgeNeverActuate` (тап по проёму/badge не вызывает
  `callService`) и `explicitInfoActionStillWorks` (только явное действие в
  открытой info-карточке вызывает `lock.unlock`). Инвариант SCOPE.md «The
  lock invariant, stated precisely» не ослаблен.
- **AC9 (state update не пересобирает geometry/config)** — доказано smoke:
  `stateTickDoesNotRebuildGeometryOrConfig` сравнивает
  `_physicalBodiesCache`, `_cfgEpoch` и сериализованный `_serverCfg` до/после
  тика состояния.
- **AC10 (существующие opening golden/interactions без регресса)** — golden
  baseline в дифе не тронут; логическое обоснование неизменности
  registry-backed пути дано выше (AC4); `smoke_opening_binding.mjs` зелёный
  подтверждает поведенческую регрессию отдельно от golden.
- **Трейлеры и changelog:** все три коммита несут терминальные `Issue: #117`
  и `User-Visible: yes|no`; коммит с `User-Visible: yes`
  (`03cca97`) правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же
  коммите (проверено `git show --stat 03cca97`, оба файла присутствуют).
- **Документация:** `docs/USER-GUIDE.ru.md` описывает новое поведение
  словами, согласующимися с уже принятой терминологией раздела («Контактный
  датчик», «замок»); `docs/ARCHITECTURE.md` фиксирует правило проекции;
  `docs/TESTING.md` добавляет пункт с явным списком `[auto: ...]`, все
  перечисленные файлы существуют и были прогнаны выше.
- **Соответствие ТЗ и SCOPE.md:** правка не расширяет скоуп (§4 «не входит»
  дословно соблюдён — picker, миграция, marker lifecycle, generic
  registry-less для прочих marker-биндингов, geometry не тронуты), лежит
  внутри уже закрытых J4/J6, лок-инвариант не ослаблен.

## Чего не проверял

- Полный набор из 127 browser-smoke (см. обоснование сужения выше) —
  предрелизный гейт, не гейт ревью.
- `npm run golden:verify` — обоснование дано выше (логическая неизменность
  registry-backed пути плюс отсутствие изменений в geometry/render-стилях).
- `python -m pytest tests_backend -q` — Python не тронут этим дифом.
- Performance-профили — ТЗ явно исключает влияние, изменение не добавляет
  новый проход по кадру.
- Реальную установку Home Assistant с живой YAML-сущностью без `unique_id` —
  вне возможностей этого ревью; демо-стенд (`demo/srv/demo.html`) и его
  фейковый `hass`/registry являются каноническим суррогатом по
  `AGENTS.md`/`docs/DEVELOPMENT.md`, и я прогнал его лично, а не со слов
  автора.
- Историю ветки/ребейз на `dev` — вне обязанностей код-ревью; это забота
  конвейера при слиянии (риск отмечен автором в хендоффе).

## Вердикт

Зелёный. High: 0, Medium: 0. Каждый AC либо доказан автотестом, который я
лично прогнал и для которого лично подтвердил способность падать (unit —
ручным откатом фикса, smoke — mutation-гейтом), либо разобран чтением кода с
явной пометкой выше. Регрессионные lock-security смоки и SCOPE.md-инвариант
подтверждены исполнением, а не только чтением ТЗ. Продуктовый диф — одна
точка (`renderOpeningEntityAvailable`), в точности соответствующая описанию
и границам ТЗ; трейлеры, changelog (RU+EN) и три копии бандла в порядке.
