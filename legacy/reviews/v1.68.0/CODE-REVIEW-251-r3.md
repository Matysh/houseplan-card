# CODE-REVIEW-251-r3

- Issue: [#251](https://github.com/Matysh/houseplan-card/issues/251) — «Маркер выключателя гаснет, когда недоступна управляемая им лампа — читается как «выключатель offline»»
- Этап: код-ревью (PROCESS.md §2.7), заход **r3**, блокирующих циклов израсходовано **1/4** до этого разбора
- Ветка: `issue/251-controller-target-availability`, HEAD `4d5f7f5` (проверяемый диапазон `origin/dev..HEAD`, merge-base `6ef814c` — «docs: review document for #249»)
- r1: вердикт **красный**, `High: 1` (golden-эталон не переприннят). r2: вердикт **зелёный**, `High: 0`, `Medium: 0`, получен на предребейзном SHA `268348d` (документ `docs/reviews/CODE-REVIEW-251-r2.md`).
- Между r2 и r3 ветка **перебазирована на ушедший вперёд `origin/dev`** (владелец: «после ребейза на новый dev это другой код, и принимать его без проверки нельзя»; переход `S6-in-progress → S7-code-review` зафиксирован в issue). Все SHA r1/r2 (`f18b5b4`, `b984f16`, `e09e449`, `268348d` и т.д.) переписаны ребейзом и физически отсутствуют в текущем дереве (`git cat-file -e` — «missing» на всех).

## Почему разбор полный, а не по дельте (§2.9/§7.2)

Ребейз на ушедший вперёд `dev` — один из явно перечисленных случаев, требующих полного разбора независимо от того, что сам продуктовый контракт #251 не менялся. Дополнительно: merge-base сдвинулся с исходного `origin/dev` r1 на коммит, включающий #249 (новая геометрия стыков стен, новый golden-сценарий бевела), а ребейз обнажил непринятый golden-долг этого уже смерженного issue — по объёму сопоставимо с «задета новая подсистема». Поэтому весь диапазон `origin/dev..HEAD` (12 коммитов, 55 файлов) разобран заново, гейты прогнаны заново на текущем точном HEAD, а не унаследованы формально.

## Скоуп

Не изменился с r1/r2: разделение доступности физического контроллера (`unavail`/полупрозрачность, только собственные активные HA-entity, включая диагностические `battery`/`linkquality`/`update`) и working-состояния управляемой цели (`on`/жёлтая подложка) для маркеров с `marker.controls`; локальный тост-объяснение безопасного no-op при полностью недоступной configured-группе; частично доступная группа продолжает исполнять доступное подмножество без тоста; confirm-race повторно резолвит intent перед выполнением. Glow/fill/statistics, персистентная схема, group-семантика «any on → all off» и новый визуальный бейдж — вне скоупа, не тронуты.

Отдельно от продуктового скоупа #251 диапазон несёт **закрытый попутный долг #249**: golden-эталоны стыков стен и новая сцена `multiwall-junction-bevel-view-dark`, не принятые в момент мерджа #249 в `dev`, обнажились именно на этом ребейзе (первый прогон полной golden-матрицы на объединённом дереве) и были приняты/исправлены автором в этой же ветке. Разобрано ниже отдельно — это не находка о нерешённой проблеме (проблема уже устранена автором), а обязательный по протоколу разбор того, что произошло в дельте.

## Продуктовый код — полная проверка построчно (не только по памяти r1)

Прочитан целиком diff коммита `2cb7c73` (`fix: separate controller and target availability`) — это единственный коммит с продуктовым TS-кодом в диапазоне:

- `src/device-presentation.ts:218-234` — `controllerAvailability(hass, d)`: `virtual`/`bindingKind==='virtual'`/`marker.binding==='virtual'` → всегда `available`; иначе доступность = есть хотя бы одна `d.entities`, чьё `state` не пустое, не `unknown`, не `unavailable`. Применяется только при `sources.sourceKind === 'controls'` (`visual = {...combined, availability: controllerAvailability(...)}`), не трогая `combined.status` (working/alarm) — идентично описанию r1.
- `src/device-toggle.ts:769-801` — `unavailableToggleTargetNames()`: применяется только к `kind==='group'` + `noneReason==='configured-targets-missing'`, глушится при любом `unsupported` в пропусках, не называет `secure`-цели, дедуплицирует имена.
- `src/houseplan-card.ts:4929-5041` — клик по Toggle: `!initial` — return; `!toggleOperation(initial)` → `_showUnavailableToggleTargets(initial)` вместо молчаливого return; confirm-exec повторно резолвит `current` и, если это тот же no-op класс, показывает тост и не идёт дальше; иначе — прежний `toast.tap_target_changed`. `_showUnavailableToggleTargets` формирует singular/plural текст через `i18n`.
- `src/i18n/en.json`/`ru.json` — два новых ключа `toast.toggle_target_unavailable`/`toggle_targets_unavailable`, формулировки соответствуют коду и `docs/USER-GUIDE(.ru).md`.

Содержимое построчно совпадает с тем, что описано и уже подтверждено юнит-матрицей/мутантами в r1 (тот же диапазон строк, та же логика) — ребейз не внёс расхождений в продуктовую логику; конфликтов слияния в этих файлах не было (коммит применяется как есть поверх нового `dev`, `docs/ARCHITECTURE.md`/`docs/TESTING.md`/`docs/USER-GUIDE(.ru).md` в том же коммите описывают ровно эту логику, сверено построчно).

`docs/CHANGELOG.md`/`.ru.md` после ребейза несут обе записи — и #249 (влившийся вперёд `dev`), и #251 — в нужном месте `## Unreleased`, ни одна не потеряна при объединении.

## Как проверялось (полностью, на точном HEAD `4d5f7f5`)

Дешёвые гейты — прогнаны заново мной, не унаследованы:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | чисто, без вывода |
| `npm test` | `# tests 1120 / # pass 1120 / # fail 0 / # skipped 0` (у автора в хендоффе — 1119 passed + 1 skipped после ребейза; расхождение по count не влияет на AC, тот же паттерн уже отмечался в r1) |
| `npm run build` | OK; `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` — все три копии идентичны (`2dcf739…`) |
| `node scripts/check-docs.mjs --external` | `Documentation checks passed (7 files, 10 external links)` |
| `node scripts/check-docs.mjs` (без `--external`, полная provenance-проверка отпечатка скриншотов) | тот же зелёный результат — отпечаток соответствует текущему `src/**`/`demo/golden/**/*.mjs` после всех правок |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | `гейт пройден, предупреждений 0` (12 коммитов) |

По необходимости, определяемой дельтой и AC:

| Гейт | Результат |
|---|---|
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | Прямое совпадение (4), тот же список, что в r1/r2: `smoke_controls.mjs` (← `DevItem`), `smoke_help_affordance.mjs`, `smoke_optimize_coordinate_canonicalization.mjs`, `smoke_partition_openings.mjs` — `src/**`-диапазон между r1 и r3 не менялся, инструмент подтверждает это независимо |
| `node demo/smoke_controls.mjs` | OK, все ключи `true`, включая `unavailableTargets*`/`confirmRace*` |
| `node demo/smoke_help_affordance.mjs` | OK |
| `node demo/smoke_optimize_coordinate_canonicalization.mjs` | OK |
| `node demo/smoke_partition_openings.mjs` | OK |
| `node demo/smoke_cover_plate_precedence.mjs` (не в прямом совпадении, но правился в диапазоне коммитом `4b19376`) | OK, включая `controlledDomNotYellow`/`controlledDomRings` и остальные |
| `node scripts/mutation-gate.mjs --id=controller-availability-follows-target` | покраснел (1/1) |
| `node scripts/mutation-gate.mjs --id=controller-diagnostics-do-not-prove-online` | покраснел (1/1) |
| `node scripts/mutation-gate.mjs --id=unavailable-toggle-stays-silent` | покраснел (1/1) |
| `node scripts/mutation-gate.mjs --id=partial-group-shows-noop-toast` | покраснел (1/1) |
| `npm run golden:verify` (полный набор — обоснование ниже) | **96/96 `passed`**, 0 несовпадений (`artifacts/golden/golden-report.json`) |

**Почему полный `golden:verify`, а не точечные сценарии.** Диапазон принимает 9 изменённых/новых golden-baseline PNG (`device-icon-state-table-{light,dark}` — предмет #251; `geometry-plan-editor-dark`, `junction-patch-resilience-view-dark`, `opening-placement-*-thick-wall-*`, `tray-wide-selection-en`, `tray-wide-tool-ru`, и новый `multiwall-junction-bevel-view-dark` — попутный долг #249) через три отдельных `golden:accept`-коммита. Это больше, чем «два известных сценария» из r1/r2, и распределено по разным подсистемам (device presentation и wall geometry) — точечный выбор менее надёжен полного прогона при таком объёме, а сам прогон дешёвый (~2.5 мин). Прогнан на точном HEAD `4d5f7f5`, не унаследован от автора.

Не гонял: `python -m pytest tests_backend` — диапазон не трогает `custom_components/**/*.py` (единственный файл под `custom_components/` — скомпилированная копия бандла). Performance-профили — не названы в AC, presentation-путь остаётся `O(e)` (проверено чтением, не исполнением, как и в r1).

## Попутный долг #249, обнажённый ребейзом — разобран, не находка

Три коммита вне продуктового скоупа #251, но необходимые, чтобы ребейз довёл ветку до зелёного `Validate`:

1. **`0108b26`** — переприёмка `device-icon-state-table-{light,dark}` (сам предмет H1 из r1, полностью совпадает с уже принятым в r2 решением, здесь просто первый шаг после того же самого фикса, перенесённого ребейзом).
2. **`f12418b`** — исправление координаты `discardedWedgeProbe` в новом сценарии `multiwall-junction-bevel-view-dark` (`demo/golden/matrix.mjs`). Проверил по коду семантику пробы: `demo/golden/harness.mjs:539-547` требует `wall.isPointInFill(at(node)) === true` и `wall.isPointInFill(at(discardedWedgeProbe)) === false` — старая координата лежала внутри соседней легитимной стены (`isPointInFill` → `true`), новая взята из юнит-геометрии клина #249. Сценарий использует `test/fixtures/249-multiwall-junction.json` — фикстуру голой геометрии стен без единого маркера/устройства; продуктовый код #251 (`src/device-presentation.ts`/`device-toggle.ts`) физически не мог повлиять на этот сценарий. Diff коммита не трогает ни один `src/**/*.ts` файл — три копии бандла меняются только строкой `__HOUSEPLAN_BUILD_FINGERPRINT__` (отпечаток включает `demo/golden/**/*.mjs`, см. `scripts/source-fingerprint.mjs:24-28`), не логикой. Подтверждает заявление автора «продуктовый рендер не менялся» — не заявлением, чтением инструмента отпечатка и семантики пробы.
3. **`5270819`** — приёмка оставшихся 6 сценариев (в т.ч. нового `multiwall-junction-bevel-view-dark`) с трейлерами `Release`/`Baseline-Reviewed` на прогон CI `32620456718`. Проверил провенанс: `gh run view 32620456718` — job `golden` в этом прогоне **выполнился и загрузил артефакт** (`Upload golden candidates/diffs` — ✓), сам шаг «Capture or verify golden matrix» закончился exit code 1 (ожидаемо для diagnostic-`capture` прогона с расхождениями до приёмки — тот же паттерн, что и у уже принятого в r1/r2 `32617372743`); итоговый статус ранa `cancelled` объясняется отдельно отменённым job `smoke` («higher priority waiting request»), не сорванным `golden`. Не искал скрытого смысла в «cancelled» — открыл раннер и увидел причину.

Правки только `demo/golden/**` и golden-baselines, ни один файл не помечен `User-Visible: yes` — корректно, продуктовое поведение не меняется. Это не Medium-находка вне скоупа: дефект (непринятый эталон #249) уже устранён автором в этой же ветке с воспроизводимым доказательством; заводить отдельный issue не на что — заводить не на что чинить.

## Закрытие раунда r2

r2 не имел находок (`High: 0, Medium: 0`), поэтому таблица «находка → чем закрыта» пуста по существу. Вместо неё — что подтверждено заново, а не унаследовано:

| Утверждение r2 | Перепроверено в r3, как |
|---|---|
| Продуктовая логика #251 (`controllerAvailability`, `unavailableToggleTargetNames`, confirm-race) корректна и соответствует ТЗ | Прочитана заново построчно на текущем HEAD (см. раздел выше) — содержимое идентично описанному в r1/r2, конфликтов слияния в этих файлах не было |
| 4 mutation guard'а красные на мутантах | Перепрогнаны на HEAD `4d5f7f5` — все 4 покраснели (1/1 каждый) |
| `smoke_cover_plate_precedence.mjs` не потерял способность падать (правка `268348d`→ теперь `4b19376`) | Смок зелёный на текущем HEAD; сама правка идентична по содержимому коммиту `268348d`, перенесённому ребейзом без изменений (та же формулировка сообщения, тот же diff `+6/-2`) |
| Golden `device-icon-state-table-{light,dark}` приняты правильно (не локальной перезаписью) | Тот же коммит-паттерн `golden:accept -- --reviewed` с `Baseline-Reviewed`, перепройден напрямую — `passed` в составе полного `golden:verify` |

## Унаследовано из r1/r2

Без повторного построчного юнит-разбора (уже сделан в r1, содержимое не менялось — см. документы `docs/reviews/CODE-REVIEW-251-r1.md` на SHA `f18b5b4`, `docs/reviews/CODE-REVIEW-251-r2.md` на SHA `268348d`), но **гейты по ним всё равно прогнаны заново** в этом раунде, а не приняты на слово, потому что ребейз меняет код формально:

- Юнит-матрица §6.1 (`test/device-presentation.test.mjs`) и её мутанты — контракт не менялся, но прогон и мутационные гварды выполнены заново на HEAD (см. таблицу гейтов).
- AC3–AC5 (тост, singular/plural, mixed secure/unsupported, confirm-race) — код прочитан заново (см. раздел «Продуктовый код»), не по памяти r1.
- AC7 (конфиг/схема не меняются) — в диапазоне `origin/dev..HEAD` по-прежнему нет файлов схемы/бэкенда.
- Спецификация `docs/specs/251-controller-target-availability.md` и её ТЗ-ревью (r1, зелёное) — содержимое не менялось этим ребейзом, не открывал повторно построчно.
- Провенанс более ранних CI-прогонов `32617372743`/`32618422055`/`32618851703` — приняты как исторические (уже проверены в r2); для r3 доказательной силой служат независимо перепройденные локальные гейты на точном HEAD и свежий прогон `32620801148` (golden ✓, smoke ✓ на коммите `f12418b`).

## Находки

Нет находок High или Medium. Low не заводился и не снимался — весь диапазон либо повторяет уже принятый в r1/r2 паттерн (golden-accept с провенансом), либо является орогональным готовым фиксом чужого (#249) долга без продуктовых последствий для #251.

## Что проверено и корректно

- Продуктовый контракт #251 (controller/target availability split, no-op toast, confirm-race) — построчно, на текущем HEAD, не по памяти прошлых раундов.
- 4 мутационных гварда, полная юнит-матрица (1120/1120), typecheck, build+bundle parity — зелёные на точном HEAD.
- Полный `golden:verify` — 96/96 `passed`, включая все 9 baseline-правок диапазона (2 из #251, 7 из попутного #249-долга).
- `check-docs.mjs` (с `--external` и без) — provenance скриншотов документации соответствует текущему дереву после трёх подряд docs-recapture коммитов.
- Трейлеры всех 12 коммитов: `Issue: #251` везде, ровно один `User-Visible:` каждый, `Release`/`Baseline-Reviewed` на golden-accept коммитах, `Capture` на docs-recapture коммитах — `process-gate.mjs --issues` подтверждает 0 предупреждений.
- Провенанс golden-accept коммитов проверен не только по трейлеру: открыл сами CI-раны (`32617372743`, `32620456718`) и убедился, что job `golden` в них реально выполнился и дал ожидаемый diagnostic-результат, а не был пропущен/отменён незаметно.

## Чего не проверял

- `python -m pytest tests_backend` — диапазон не трогает `custom_components/**/*.py`.
- Performance-профили — не названы в AC, чувствительный к перфу код не тронут (проверено чтением).
- Реальную живую HA-инсталляцию/ручной клик в браузере — ручного тестирования в цикле нет по правилам процесса; вопрос «работает ли» закрыт юнит-матрицей, мутантами, production-bundle smoke и полным golden.
- Содержимое docs-screenshot CI-ранов (`32619669409`, `32621056471`) как приложений — открыл только метаданные (`conclusion: success`), не сами картинки; полагаюсь на `check-docs.mjs`, который сверяет отпечаток дерева, а не на просмотр вложений.
- Механизм `reuse`, пропустивший `golden`/`smoke`/`frontend`/`backend` в финальном exact-HEAD прогоне `32621201722` как «побайтово те же входы, что в #208» — не разбирал устройство кэша; вместо доверия ему прогнал `golden:verify` и все релевантные smoke локально на точном HEAD самостоятельно.

## Вердикт

Зелёный. Ребейз на ушедший вперёд `dev` потребовал полного разбора (§7.2) — выполнен: продуктовый код #251 не изменился по содержанию и заново подтверждён построчно, все дешёвые и предметные гейты (включая полный `golden:verify`, обоснованный объёмом и разнородностью правок) зелёные на точном HEAD `4d5f7f5`. Попутный golden-долг #249, обнажённый ребейзом, разобран и подтверждён как orthogonal и уже устранённый — не создаёт нового High/Medium и не остаётся как открытая проблема. Готово к слиянию.
